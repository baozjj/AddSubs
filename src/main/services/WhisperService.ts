import { whisper } from "whisper-node";
import { AIRecognitionResult, SubtitleEntry } from "../types";
import { promises as fs } from "fs";

/**
 * Whisper 配置选项
 */
export interface WhisperOptions {
  modelName?: string;
  whisperOptions?: {
    language?: string;
    gen_file_txt?: boolean;
    gen_file_subtitle?: boolean;
    gen_file_vtt?: boolean;
    word_timestamps?: boolean;
  };
}

/**
 * Whisper 语音识别服务
 */
export class WhisperService {
  private options: WhisperOptions;

  constructor(options: WhisperOptions = {}) {
    this.options = {
      modelName: options.modelName || "base",
      whisperOptions: {
        language: options.whisperOptions?.language || "auto",
        gen_file_txt: false,
        gen_file_subtitle: false,
        gen_file_vtt: false,
        word_timestamps: true,
        ...options.whisperOptions,
      },
    };
  }

  async recognizeAudio(audioPath: string): Promise<AIRecognitionResult> {
    try {
      console.log(`[WhisperService] 开始识别音频: ${audioPath}`);
      console.log(`[WhisperService] 使用模型: ${this.options.modelName}`);

      await fs.access(audioPath);

      const options = {
        modelName: this.options.modelName,
        whisperOptions: this.options.whisperOptions,
      };

      console.log(
        `[WhisperService] 识别选项:`,
        JSON.stringify(options, null, 2)
      );

      const result = await whisper(audioPath, options);

      console.log(
        `[WhisperService] 原始结果:`,
        JSON.stringify(result, null, 2)
      );

      const subtitles = this.parseResult(result);
      console.log(`[WhisperService] 成功识别 ${subtitles.length} 条文本`);
      console.log(
        `[WhisperService] 字幕内容:`,
        JSON.stringify(subtitles, null, 2)
      );

      return { success: true, subtitles };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "未知错误";
      console.error(`[WhisperService] 识别失败:`, error);
      return {
        success: false,
        subtitles: [],
        error: `Whisper 识别失败: ${errorMessage}`,
      };
    }
  }

  private parseResult(result: any): SubtitleEntry[] {
    const subtitles: SubtitleEntry[] = [];

    // 处理 whisper-node 的输出格式：[ { start, end, speech } ]
    if (Array.isArray(result)) {
      result.forEach((item: any, index: number) => {
        const startTime = this.parseTimestamp(item.start) || 0;
        const endTime = this.parseTimestamp(item.end) || 0;
        const text = item.speech?.trim();

        if (text) {
          subtitles.push({
            index: index + 1,
            startTime,
            endTime,
            text,
          });
        }
      });
    } else if (result && typeof result === "object") {
      // 单个结果对象
      const startTime = this.parseTimestamp(result.start) || 0;
      const endTime = this.parseTimestamp(result.end) || 0;
      const text = result.speech?.trim();

      if (text) {
        subtitles.push({
          index: 1,
          startTime,
          endTime,
          text,
        });
      }
    }

    return subtitles;
  }

  /**
   * 将时间戳格式 "HH:MM:SS.mmm" 转换为秒数
   */
  private parseTimestamp(timestamp: string | undefined): number {
    if (!timestamp) return 0;

    const parts = timestamp.split(":");
    if (parts.length !== 3) return 0;

    try {
      const hours = parseInt(parts[0], 10);
      const minutes = parseInt(parts[1], 10);
      const secondsAndMs = parts[2].split(".");
      const seconds = parseInt(secondsAndMs[0], 10);
      const milliseconds = parseInt(
        (secondsAndMs[1] || "0").padEnd(3, "0"),
        10
      );

      return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
    } catch (error) {
      console.error(`[WhisperService] 时间戳解析失败: ${timestamp}`, error);
      return 0;
    }
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  static getSupportedModels(): string[] {
    return ["tiny.en", "base.en", "small.en", "medium.en", "large-v3"];
  }
}
