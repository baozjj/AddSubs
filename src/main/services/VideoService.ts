import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import ffprobeInstaller from "@ffprobe-installer/ffprobe";
import { promises as fs } from "fs";
import path from "path";
import os from "os";

// 确保 ffmpeg 和 ffprobe 有执行权限
Promise.all([
  fs.chmod(ffmpegInstaller.path, 0o755).catch(() => {}),
  fs.chmod(ffprobeInstaller.path, 0o755).catch(() => {}),
]);

// 设置 ffmpeg 和 ffprobe 路径
ffmpeg.setFfmpegPath(ffmpegInstaller.path);
ffmpeg.setFfprobePath(ffprobeInstaller.path);

/**
 * 视频处理服务
 */
export class VideoService {
  async extractAudio(
    videoPath: string,
    onProgress?: (progress: number) => void
  ): Promise<string> {
    const audioPath = path.join(os.tmpdir(), `audio_${Date.now()}.wav`);

    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .outputOptions(["-vn", "-acodec pcm_s16le", "-ac 1", "-ar 16000"])
        .output(audioPath)
        .on("progress", (p) => onProgress?.(p.percent || 0))
        .on("end", () => resolve(audioPath))
        .on("error", (err: any) => {
          if (err.message?.includes("does not contain any stream")) {
            this.generateSilentAudio(videoPath, audioPath, onProgress)
              .then(resolve)
              .catch(() => reject(new Error(`音频提取失败`)));
          } else {
            reject(new Error(`音频提取失败: ${err.message}`));
          }
        })
        .run();
    });
  }

  private generateSilentAudio(
    videoPath: string,
    audioPath: string,
    onProgress?: (progress: number) => void
  ): Promise<string> {
    return new Promise(async (resolve, reject) => {
      try {
        const info = await this.getVideoInfo(videoPath);
        const duration = info.format.duration || 0;

        ffmpeg()
          .input(`anullsrc=r=16000:cl=mono`)
          .inputOptions(["-f lavfi", `-t ${duration}`])
          .outputOptions(["-acodec pcm_s16le", "-ac 1", "-ar 16000"])
          .output(audioPath)
          .on("progress", (p) => onProgress?.(p.percent || 0))
          .on("end", () => resolve(audioPath))
          .on("error", (err) => reject(new Error(`静音音频生成失败`)))
          .run();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 获取视频信息
   */
  getVideoInfo(videoPath: string): Promise<ffmpeg.FfprobeData> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) reject(err);
        else resolve(metadata);
      });
    });
  }

  async validateVideoFile(videoPath: string): Promise<boolean> {
    try {
      await fs.access(videoPath);
      const info = await this.getVideoInfo(videoPath);
      return info.streams.length > 0;
    } catch {
      return false;
    }
  }

  async cleanupAudioFile(audioPath: string): Promise<void> {
    try {
      await fs.unlink(audioPath);
    } catch (error) {
      // 无声失败
    }
  }
}
