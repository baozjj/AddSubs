import { SubtitleEntry } from '../types'
import { promises as fs } from 'fs'
import path from 'path'
import ffmpeg from 'fluent-ffmpeg'
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg'

ffmpeg.setFfmpegPath(ffmpegInstaller.path)

/**
 * 字幕处理服务
 */
export class SubtitleService {
  /**
   * 将字幕数据转换为 SRT 格式
   * @param subtitles 字幕条目数组
   */
  convertToSRT(subtitles: SubtitleEntry[]): string {
    return subtitles
      .map((entry) => {
        const startTime = this.formatSRTTime(entry.startTime)
        const endTime = this.formatSRTTime(entry.endTime)
        return `${entry.index}\n${startTime} --> ${endTime}\n${entry.text}\n`
      })
      .join('\n')
  }

  /**
   * 将秒数转换为 SRT 时间格式 (HH:MM:SS,mmm)
   * @param seconds 秒数
   */
  private formatSRTTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    const milliseconds = Math.floor((seconds % 1) * 1000)

    return `${this.pad(hours, 2)}:${this.pad(minutes, 2)}:${this.pad(secs, 2)},${this.pad(milliseconds, 3)}`
  }

  /**
   * 数字补零
   */
  private pad(num: number, size: number): string {
    return num.toString().padStart(size, '0')
  }

  /**
   * 保存字幕文件
   * @param subtitles 字幕数据
   * @param outputPath 输出路径
   */
  async saveSubtitleFile(subtitles: SubtitleEntry[], outputPath: string): Promise<string> {
    const srtContent = this.convertToSRT(subtitles)
    const srtPath = outputPath.replace(/\.[^.]+$/, '.srt')

    await fs.writeFile(srtPath, srtContent, 'utf-8')
    console.log(`[SubtitleService] 字幕文件已保存: ${srtPath}`)

    return srtPath
  }

  /**
   * 将字幕烧录到视频中（硬字幕）
   * @param videoPath 原视频路径
   * @param subtitlePath 字幕文件路径
   * @param outputPath 输出视频路径
   * @param onProgress 进度回调
   */
  async burnSubtitles(
    videoPath: string,
    subtitlePath: string,
    outputPath: string,
    onProgress?: (progress: number) => void
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      console.log(`[SubtitleService] 开始烧录字幕`)
      console.log(`[SubtitleService] 视频: ${videoPath}`)
      console.log(`[SubtitleService] 字幕: ${subtitlePath}`)
      console.log(`[SubtitleService] 输出: ${outputPath}`)

      // 转义字幕路径中的特殊字符（Windows 路径处理）
      const escapedSubtitlePath = subtitlePath.replace(/\\/g, '/').replace(/:/g, '\\:')

      ffmpeg(videoPath)
        .outputOptions([
          `-vf subtitles='${escapedSubtitlePath}':force_style='FontName=Arial,FontSize=24,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=2,Shadow=1'`
        ])
        .output(outputPath)
        .on('start', (commandLine) => {
          console.log(`[SubtitleService] FFmpeg 命令: ${commandLine}`)
        })
        .on('progress', (progress) => {
          const percent = progress.percent || 0
          console.log(`[SubtitleService] 烧录进度: ${percent.toFixed(2)}%`)
          if (onProgress) {
            onProgress(percent)
          }
        })
        .on('end', () => {
          console.log(`[SubtitleService] 字幕烧录完成: ${outputPath}`)
          resolve(outputPath)
        })
        .on('error', (err) => {
          console.error(`[SubtitleService] 字幕烧录失败:`, err)
          reject(new Error(`字幕烧录失败: ${err.message}`))
        })
        .run()
    })
  }

  /**
   * 将字幕嵌入到视频中（软字幕）
   * @param videoPath 原视频路径
   * @param subtitlePath 字幕文件路径
   * @param outputPath 输出视频路径
   * @param onProgress 进度回调
   */
  async embedSubtitles(
    videoPath: string,
    subtitlePath: string,
    outputPath: string,
    onProgress?: (progress: number) => void
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      console.log(`[SubtitleService] 开始嵌入字幕（软字幕）`)
      console.log(`[SubtitleService] 视频: ${videoPath}`)
      console.log(`[SubtitleService] 字幕: ${subtitlePath}`)
      console.log(`[SubtitleService] 输出: ${outputPath}`)

      ffmpeg(videoPath)
        .input(subtitlePath)
        .outputOptions(['-c copy', '-c:s mov_text', '-metadata:s:s:0 language=chi'])
        .output(outputPath)
        .on('start', (commandLine) => {
          console.log(`[SubtitleService] FFmpeg 命令: ${commandLine}`)
        })
        .on('progress', (progress) => {
          const percent = progress.percent || 0
          console.log(`[SubtitleService] 嵌入进度: ${percent.toFixed(2)}%`)
          if (onProgress) {
            onProgress(percent)
          }
        })
        .on('end', () => {
          console.log(`[SubtitleService] 字幕嵌入完成: ${outputPath}`)
          resolve(outputPath)
        })
        .on('error', (err) => {
          console.error(`[SubtitleService] 字幕嵌入失败:`, err)
          reject(new Error(`字幕嵌入失败: ${err.message}`))
        })
        .run()
    })
  }

  /**
   * 生成输出文件路径
   * @param videoPath 原视频路径
   * @param suffix 后缀（默认为 '_with_subtitles'）
   */
  generateOutputPath(videoPath: string, suffix = '_with_subtitles'): string {
    const dir = path.dirname(videoPath)
    const ext = path.extname(videoPath)
    const basename = path.basename(videoPath, ext)
    return path.join(dir, `${basename}${suffix}${ext}`)
  }
}

