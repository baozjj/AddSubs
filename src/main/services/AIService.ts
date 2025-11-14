import { AIRecognitionResult, SubtitleEntry } from "../types";
import { WhisperService } from "./WhisperService";

/**
 * AI 语音识别服务抽象基类
 */
export abstract class AIService {
  /**
   * 识别音频文件并生成字幕
   * @param audioPath 音频文件路径
   * @returns 识别结果
   */
  abstract recognizeAudio(audioPath: string): Promise<AIRecognitionResult>;

  /**
   * 检查服务是否可用
   */
  abstract isAvailable(): Promise<boolean>;
}

/**
 * Mock AI 服务实现（用于测试）
 * 生成模拟的字幕数据
 */
export class MockAIService extends AIService {
  async recognizeAudio(audioPath: string): Promise<AIRecognitionResult> {
    console.log(`[MockAIService] 正在识别音频: ${audioPath}`);

    // 模拟处理延迟
    await this.delay(2000);

    // 生成模拟字幕数据
    const mockSubtitles: SubtitleEntry[] = [
      {
        index: 1,
        startTime: 0.0,
        endTime: 3.5,
        text: "欢迎使用自动字幕生成工具",
      },
      {
        index: 2,
        startTime: 3.5,
        endTime: 7.0,
        text: "这是一个基于 Electron 和 Vue 开发的桌面应用",
      },
      {
        index: 3,
        startTime: 7.0,
        endTime: 11.0,
        text: "它可以自动识别视频中的语音并生成字幕",
      },
      {
        index: 4,
        startTime: 11.0,
        endTime: 15.0,
        text: "当前使用的是 Mock 模式，用于演示和测试",
      },
      {
        index: 5,
        startTime: 15.0,
        endTime: 19.0,
        text: "您可以替换为真实的 AI 语音识别服务",
      },
      {
        index: 6,
        startTime: 19.0,
        endTime: 23.0,
        text: "支持 OpenAI Whisper、Azure 等多种服务",
      },
    ];

    return {
      success: true,
      subtitles: mockSubtitles,
    };
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * OpenAI Whisper 服务实现（预留接口）
 */
export class OpenAIWhisperService extends AIService {
  private apiKey: string;

  constructor(apiKey: string) {
    super();
    this.apiKey = apiKey;
  }

  async recognizeAudio(audioPath: string): Promise<AIRecognitionResult> {
    // TODO: 实现 OpenAI Whisper API 调用
    console.log(`[OpenAIWhisperService] 识别音频: ${audioPath}`);

    return {
      success: false,
      subtitles: [],
      error: "OpenAI Whisper 服务尚未实现，请使用 Mock 服务进行测试",
    };
  }

  async isAvailable(): Promise<boolean> {
    return !!this.apiKey;
  }
}

/**
 * Whisper Node 本地服务实现
 */
export class WhisperNodeService extends AIService {
  private whisperService: WhisperService;

  constructor() {
    super();
    this.whisperService = new WhisperService({
      modelName: "base",
      whisperOptions: {
        language: "auto",
        word_timestamps: true,
      },
    });
  }

  async recognizeAudio(audioPath: string): Promise<AIRecognitionResult> {
    try {
      return await this.whisperService.recognizeAudio(audioPath);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "未知错误";
      console.error("[WhisperNodeService] 识别失败:", error);
      return {
        success: false,
        subtitles: [],
        error: `Whisper 识别失败: ${errorMessage}`,
      };
    }
  }

  async isAvailable(): Promise<boolean> {
    return await this.whisperService.isAvailable();
  }
}

/**
 * AI 服务工厂
 */
export class AIServiceFactory {
  /**
   * 创建 AI 服务实例
   * @param type 服务类型
   * @param config 配置参数
   */
  static createService(
    type: "mock" | "openai" | "azure" | "whisper" | "custom" = "mock",
    config?: Record<string, unknown>
  ): AIService {
    switch (type) {
      case "openai":
        return new OpenAIWhisperService((config?.apiKey as string) || "");
      case "whisper":
        return new WhisperNodeService();
      case "mock":
      default:
        return new MockAIService();
    }
  }
}
