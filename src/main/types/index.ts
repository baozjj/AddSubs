/**
 * 字幕条目接口
 */
export interface SubtitleEntry {
  /** 字幕序号 */
  index: number;
  /** 开始时间（秒） */
  startTime: number;
  /** 结束时间（秒） */
  endTime: number;
  /** 字幕文本内容 */
  text: string;
}

/**
 * AI 识别结果接口
 */
export interface AIRecognitionResult {
  /** 是否成功 */
  success: boolean;
  /** 字幕数据 */
  subtitles: SubtitleEntry[];
  /** 错误信息（如果失败） */
  error?: string;
}

/**
 * 处理进度接口
 */
export interface ProcessProgress {
  /** 当前步骤 */
  step: "extracting" | "recognizing" | "embedding" | "completed" | "error";
  /** 进度百分比 (0-100) */
  percentage: number;
  /** 状态消息 */
  message: string;
  /** 错误信息（如果有） */
  error?: string;
}

/**
 * 视频处理选项
 */
export interface VideoProcessOptions {
  /** 视频文件路径 */
  videoPath: string;
  /** 输出文件路径（可选，默认为原文件名_with_subtitles） */
  outputPath?: string;
  /** AI 服务类型 */
  aiServiceType?: "mock" | "openai" | "azure" | "whisper" | "custom";
}
