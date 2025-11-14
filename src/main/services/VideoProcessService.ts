import { VideoService } from "./VideoService";
import { SubtitleService } from "./SubtitleService";
import { AIServiceFactory } from "./AIService";
import { VideoProcessOptions, ProcessProgress } from "../types";
import path from "path";

/**
 * 视频处理主服务
 * 整合视频处理、AI 识别、字幕嵌入等功能
 */
export class VideoProcessService {
  private videoService: VideoService;
  private subtitleService: SubtitleService;

  constructor() {
    this.videoService = new VideoService();
    this.subtitleService = new SubtitleService();
  }

  /**
   * 处理视频：提取音频 -> AI 识别 -> 嵌入字幕
   * @param options 处理选项
   * @param onProgress 进度回调
   */
  async processVideo(
    options: VideoProcessOptions,
    onProgress?: (progress: ProcessProgress) => void
  ): Promise<string> {
    const { videoPath, outputPath, aiServiceType = "whisper" } = options;

    let audioPath: string | null = null;

    try {
      // 步骤 1: 验证视频文件
      onProgress?.({
        step: "extracting",
        percentage: 0,
        message: "正在验证视频文件...",
      });

      const isValid = await this.videoService.validateVideoFile(videoPath);
      if (!isValid) {
        throw new Error(
          "无法识别该视频文件。请确保：\n" +
            "1. 文件是有效的视频格式（MP4、AVI、MKV 等）\n" +
            "2. 文件没有损坏\n" +
            "3. 文件可以被正常访问\n\n" +
            "请查看控制台日志获取详细信息。"
        );
      }

      // 步骤 2: 提取音频
      onProgress?.({
        step: "extracting",
        percentage: 10,
        message: "正在从视频中提取音频...",
      });

      audioPath = await this.videoService.extractAudio(videoPath, (percent) => {
        onProgress?.({
          step: "extracting",
          percentage: 10 + (percent / 100) * 30, // 10% - 40%
          message: `正在提取音频... ${percent.toFixed(1)}%`,
        });
      });

      // 步骤 3: AI 语音识别
      onProgress?.({
        step: "recognizing",
        percentage: 40,
        message: "正在进行语音识别...",
      });

      const aiService = AIServiceFactory.createService(aiServiceType);
      const recognitionResult = await aiService.recognizeAudio(audioPath);

      if (!recognitionResult.success) {
        throw new Error(recognitionResult.error || "AI 识别失败");
      }

      onProgress?.({
        step: "recognizing",
        percentage: 60,
        message: `识别完成，共生成 ${recognitionResult.subtitles.length} 条字幕`,
      });

      // 步骤 4: 生成字幕文件
      const finalOutputPath =
        outputPath || this.subtitleService.generateOutputPath(videoPath);

      const subtitlePath = await this.subtitleService.saveSubtitleFile(
        recognitionResult.subtitles,
        finalOutputPath
      );

      onProgress?.({
        step: "embedding",
        percentage: 65,
        message: "正在将字幕烧录到视频中...",
      });

      // 步骤 5: 烧录字幕到视频
      const resultPath = await this.subtitleService.burnSubtitles(
        videoPath,
        subtitlePath,
        finalOutputPath,
        (percent) => {
          onProgress?.({
            step: "embedding",
            percentage: 65 + (percent / 100) * 35, // 65% - 100%
            message: `正在烧录字幕... ${percent.toFixed(1)}%`,
          });
        }
      );

      // 步骤 6: 完成
      onProgress?.({
        step: "completed",
        percentage: 100,
        message: "处理完成！",
      });

      return resultPath;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "未知错误";
      console.error("[VideoProcessService] 处理失败:", error);

      onProgress?.({
        step: "error",
        percentage: 0,
        message: "处理失败",
        error: errorMessage,
      });

      throw error;
    } finally {
      // 清理临时音频文件
      if (audioPath) {
        await this.videoService.cleanupAudioFile(audioPath).catch((err) => {
          console.error("[VideoProcessService] 清理临时文件失败:", err);
        });
      }
    }
  }

  /**
   * 获取支持的视频格式
   */
  getSupportedFormats(): string[] {
    return [
      ".mp4",
      ".avi",
      ".mkv",
      ".mov",
      ".wmv",
      ".flv",
      ".webm",
      ".m4v",
      ".mpg",
      ".mpeg",
    ];
  }

  /**
   * 检查文件格式是否支持
   */
  isSupportedFormat(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return this.getSupportedFormats().includes(ext);
  }
}
