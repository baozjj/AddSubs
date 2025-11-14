"use strict";
const electron = require("electron");
const path = require("path");
const utils = require("@electron-toolkit/utils");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegInstaller = require("@ffmpeg-installer/ffmpeg");
const ffprobeInstaller = require("@ffprobe-installer/ffprobe");
const fs = require("fs");
const os = require("os");
const whisperNode = require("whisper-node");
const icon = path.join(__dirname, "../../resources/icon.png");
Promise.all([
  fs.promises.chmod(ffmpegInstaller.path, 493).catch(() => {
  }),
  fs.promises.chmod(ffprobeInstaller.path, 493).catch(() => {
  })
]);
ffmpeg.setFfmpegPath(ffmpegInstaller.path);
ffmpeg.setFfprobePath(ffprobeInstaller.path);
class VideoService {
  async extractAudio(videoPath, onProgress) {
    const audioPath = path.join(os.tmpdir(), `audio_${Date.now()}.wav`);
    return new Promise((resolve, reject) => {
      ffmpeg(videoPath).outputOptions(["-vn", "-acodec pcm_s16le", "-ac 1", "-ar 16000"]).output(audioPath).on("progress", (p) => onProgress?.(p.percent || 0)).on("end", () => resolve(audioPath)).on("error", (err) => {
        if (err.message?.includes("does not contain any stream")) {
          this.generateSilentAudio(videoPath, audioPath, onProgress).then(resolve).catch(() => reject(new Error(`音频提取失败`)));
        } else {
          reject(new Error(`音频提取失败: ${err.message}`));
        }
      }).run();
    });
  }
  generateSilentAudio(videoPath, audioPath, onProgress) {
    return new Promise(async (resolve, reject) => {
      try {
        const info = await this.getVideoInfo(videoPath);
        const duration = info.format.duration || 0;
        ffmpeg().input(`anullsrc=r=16000:cl=mono`).inputOptions(["-f lavfi", `-t ${duration}`]).outputOptions(["-acodec pcm_s16le", "-ac 1", "-ar 16000"]).output(audioPath).on("progress", (p) => onProgress?.(p.percent || 0)).on("end", () => resolve(audioPath)).on("error", () => reject(new Error(`静音音频生成失败`))).run();
      } catch (error) {
        reject(error);
      }
    });
  }
  /**
   * 获取视频信息
   */
  getVideoInfo(videoPath) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) reject(err);
        else resolve(metadata);
      });
    });
  }
  async validateVideoFile(videoPath) {
    try {
      await fs.promises.access(videoPath);
      const info = await this.getVideoInfo(videoPath);
      return info.streams.length > 0;
    } catch {
      return false;
    }
  }
  async cleanupAudioFile(audioPath) {
    try {
      await fs.promises.unlink(audioPath);
    } catch (error) {
    }
  }
}
ffmpeg.setFfmpegPath(ffmpegInstaller.path);
class SubtitleService {
  /**
   * 将字幕数据转换为 SRT 格式
   * @param subtitles 字幕条目数组
   */
  convertToSRT(subtitles) {
    return subtitles.map((entry) => {
      const startTime = this.formatSRTTime(entry.startTime);
      const endTime = this.formatSRTTime(entry.endTime);
      return `${entry.index}
${startTime} --> ${endTime}
${entry.text}
`;
    }).join("\n");
  }
  /**
   * 将秒数转换为 SRT 时间格式 (HH:MM:SS,mmm)
   * @param seconds 秒数
   */
  formatSRTTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor(seconds % 3600 / 60);
    const secs = Math.floor(seconds % 60);
    const milliseconds = Math.floor(seconds % 1 * 1e3);
    return `${this.pad(hours, 2)}:${this.pad(minutes, 2)}:${this.pad(secs, 2)},${this.pad(milliseconds, 3)}`;
  }
  /**
   * 数字补零
   */
  pad(num, size) {
    return num.toString().padStart(size, "0");
  }
  /**
   * 保存字幕文件
   * @param subtitles 字幕数据
   * @param outputPath 输出路径
   */
  async saveSubtitleFile(subtitles, outputPath) {
    const srtContent = this.convertToSRT(subtitles);
    const srtPath = outputPath.replace(/\.[^.]+$/, ".srt");
    console.log(`[SubtitleService] 字幕内容 (${subtitles.length} 条):`, srtContent);
    if (!srtContent || srtContent.trim().length === 0) {
      throw new Error("字幕内容为空，无法生成 SRT 文件");
    }
    await fs.promises.writeFile(srtPath, srtContent, "utf-8");
    console.log(`[SubtitleService] 字幕文件已保存: ${srtPath}`);
    const stats = await fs.promises.stat(srtPath);
    console.log(`[SubtitleService] 字幕文件大小: ${stats.size} bytes`);
    return srtPath;
  }
  /**
   * 将字幕烧录到视频中（硬字幕）
   * @param videoPath 原视频路径
   * @param subtitlePath 字幕文件路径
   * @param outputPath 输出视频路径
   * @param onProgress 进度回调
   */
  async burnSubtitles(videoPath, subtitlePath, outputPath, onProgress) {
    return new Promise(async (resolve, reject) => {
      try {
        console.log(`[SubtitleService] 开始烧录字幕`);
        console.log(`[SubtitleService] 视频: ${videoPath}`);
        console.log(`[SubtitleService] 字幕: ${subtitlePath}`);
        console.log(`[SubtitleService] 输出: ${outputPath}`);
        const stats = await fs.promises.stat(subtitlePath);
        if (stats.size === 0) {
          throw new Error("字幕文件为空");
        }
        console.log(`[SubtitleService] 字幕文件大小: ${stats.size} bytes`);
        const srtContent = await fs.promises.readFile(subtitlePath, "utf-8");
        console.log(`[SubtitleService] 字幕内容预览:`, srtContent.substring(0, 200));
        const escapedSubtitlePath = subtitlePath.replace(/\\/g, "/").replace(/:/g, "\\\\:");
        console.log(`[SubtitleService] 转义后的字幕路径: ${escapedSubtitlePath}`);
        ffmpeg(videoPath).outputOptions([
          `-vf`,
          `subtitles=${escapedSubtitlePath}:force_style='FontName=Arial,FontSize=24,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=2,Shadow=1'`
        ]).output(outputPath).on("start", (commandLine) => {
          console.log(`[SubtitleService] FFmpeg 命令: ${commandLine}`);
        }).on("progress", (progress) => {
          const percent = progress.percent || 0;
          console.log(`[SubtitleService] 烧录进度: ${percent.toFixed(2)}%`);
          if (onProgress) {
            onProgress(percent);
          }
        }).on("end", () => {
          console.log(`[SubtitleService] 字幕烧录完成: ${outputPath}`);
          resolve(outputPath);
        }).on("error", (err, _stdout, stderr) => {
          console.error(`[SubtitleService] 字幕烧录失败:`, err);
          console.error(`[SubtitleService] FFmpeg stderr:`, stderr);
          reject(new Error(`字幕烧录失败: ${err.message}`));
        }).run();
      } catch (error) {
        console.error(`[SubtitleService] 验证失败:`, error);
        reject(error);
      }
    });
  }
  /**
   * 将字幕嵌入到视频中（软字幕）
   * @param videoPath 原视频路径
   * @param subtitlePath 字幕文件路径
   * @param outputPath 输出视频路径
   * @param onProgress 进度回调
   */
  async embedSubtitles(videoPath, subtitlePath, outputPath, onProgress) {
    return new Promise((resolve, reject) => {
      console.log(`[SubtitleService] 开始嵌入字幕（软字幕）`);
      console.log(`[SubtitleService] 视频: ${videoPath}`);
      console.log(`[SubtitleService] 字幕: ${subtitlePath}`);
      console.log(`[SubtitleService] 输出: ${outputPath}`);
      ffmpeg(videoPath).input(subtitlePath).outputOptions(["-c copy", "-c:s mov_text", "-metadata:s:s:0 language=chi"]).output(outputPath).on("start", (commandLine) => {
        console.log(`[SubtitleService] FFmpeg 命令: ${commandLine}`);
      }).on("progress", (progress) => {
        const percent = progress.percent || 0;
        console.log(`[SubtitleService] 嵌入进度: ${percent.toFixed(2)}%`);
        if (onProgress) {
          onProgress(percent);
        }
      }).on("end", () => {
        console.log(`[SubtitleService] 字幕嵌入完成: ${outputPath}`);
        resolve(outputPath);
      }).on("error", (err) => {
        console.error(`[SubtitleService] 字幕嵌入失败:`, err);
        reject(new Error(`字幕嵌入失败: ${err.message}`));
      }).run();
    });
  }
  /**
   * 生成输出文件路径
   * @param videoPath 原视频路径
   * @param suffix 后缀（默认为 '_with_subtitles'）
   */
  generateOutputPath(videoPath, suffix = "_with_subtitles") {
    const dir = path.dirname(videoPath);
    const ext = path.extname(videoPath);
    const basename = path.basename(videoPath, ext);
    return path.join(dir, `${basename}${suffix}${ext}`);
  }
}
class WhisperService {
  options;
  constructor(options = {}) {
    this.options = {
      modelName: options.modelName || "base",
      whisperOptions: {
        language: options.whisperOptions?.language || "auto",
        gen_file_txt: false,
        gen_file_subtitle: false,
        gen_file_vtt: false,
        word_timestamps: true,
        ...options.whisperOptions
      }
    };
  }
  async recognizeAudio(audioPath) {
    try {
      console.log(`[WhisperService] 开始识别音频: ${audioPath}`);
      console.log(`[WhisperService] 使用模型: ${this.options.modelName}`);
      await fs.promises.access(audioPath);
      const options = {
        modelName: this.options.modelName,
        whisperOptions: this.options.whisperOptions
      };
      console.log(
        `[WhisperService] 识别选项:`,
        JSON.stringify(options, null, 2)
      );
      const result = await whisperNode.whisper(audioPath, options);
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
        error: `Whisper 识别失败: ${errorMessage}`
      };
    }
  }
  parseResult(result) {
    const subtitles = [];
    if (Array.isArray(result)) {
      result.forEach((item, index) => {
        const startTime = this.parseTimestamp(item.start) || 0;
        const endTime = this.parseTimestamp(item.end) || 0;
        const text = item.speech?.trim();
        if (text) {
          subtitles.push({
            index: index + 1,
            startTime,
            endTime,
            text
          });
        }
      });
    } else if (result && typeof result === "object") {
      const startTime = this.parseTimestamp(result.start) || 0;
      const endTime = this.parseTimestamp(result.end) || 0;
      const text = result.speech?.trim();
      if (text) {
        subtitles.push({
          index: 1,
          startTime,
          endTime,
          text
        });
      }
    }
    return subtitles;
  }
  /**
   * 将时间戳格式 "HH:MM:SS.mmm" 转换为秒数
   */
  parseTimestamp(timestamp) {
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
      return hours * 3600 + minutes * 60 + seconds + milliseconds / 1e3;
    } catch (error) {
      console.error(`[WhisperService] 时间戳解析失败: ${timestamp}`, error);
      return 0;
    }
  }
  async isAvailable() {
    return true;
  }
  static getSupportedModels() {
    return ["tiny.en", "base.en", "small.en", "medium.en", "large-v3"];
  }
}
class AIService {
}
class MockAIService extends AIService {
  async recognizeAudio(audioPath) {
    console.log(`[MockAIService] 正在识别音频: ${audioPath}`);
    await this.delay(2e3);
    const mockSubtitles = [
      {
        index: 1,
        startTime: 0,
        endTime: 3.5,
        text: "欢迎使用自动字幕生成工具"
      },
      {
        index: 2,
        startTime: 3.5,
        endTime: 7,
        text: "这是一个基于 Electron 和 Vue 开发的桌面应用"
      },
      {
        index: 3,
        startTime: 7,
        endTime: 11,
        text: "它可以自动识别视频中的语音并生成字幕"
      },
      {
        index: 4,
        startTime: 11,
        endTime: 15,
        text: "当前使用的是 Mock 模式，用于演示和测试"
      },
      {
        index: 5,
        startTime: 15,
        endTime: 19,
        text: "您可以替换为真实的 AI 语音识别服务"
      },
      {
        index: 6,
        startTime: 19,
        endTime: 23,
        text: "支持 OpenAI Whisper、Azure 等多种服务"
      }
    ];
    return {
      success: true,
      subtitles: mockSubtitles
    };
  }
  async isAvailable() {
    return true;
  }
  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
class OpenAIWhisperService extends AIService {
  apiKey;
  constructor(apiKey) {
    super();
    this.apiKey = apiKey;
  }
  async recognizeAudio(audioPath) {
    console.log(`[OpenAIWhisperService] 识别音频: ${audioPath}`);
    return {
      success: false,
      subtitles: [],
      error: "OpenAI Whisper 服务尚未实现，请使用 Mock 服务进行测试"
    };
  }
  async isAvailable() {
    return !!this.apiKey;
  }
}
class WhisperNodeService extends AIService {
  whisperService;
  constructor() {
    super();
    this.whisperService = new WhisperService({
      modelName: "base",
      whisperOptions: {
        language: "auto",
        word_timestamps: true
      }
    });
  }
  async recognizeAudio(audioPath) {
    try {
      return await this.whisperService.recognizeAudio(audioPath);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "未知错误";
      console.error("[WhisperNodeService] 识别失败:", error);
      return {
        success: false,
        subtitles: [],
        error: `Whisper 识别失败: ${errorMessage}`
      };
    }
  }
  async isAvailable() {
    return await this.whisperService.isAvailable();
  }
}
class AIServiceFactory {
  /**
   * 创建 AI 服务实例
   * @param type 服务类型
   * @param config 配置参数
   */
  static createService(type = "mock", config) {
    switch (type) {
      case "openai":
        return new OpenAIWhisperService(config?.apiKey || "");
      case "whisper":
        return new WhisperNodeService();
      case "mock":
      default:
        return new MockAIService();
    }
  }
}
class VideoProcessService {
  videoService;
  subtitleService;
  constructor() {
    this.videoService = new VideoService();
    this.subtitleService = new SubtitleService();
  }
  /**
   * 处理视频：提取音频 -> AI 识别 -> 嵌入字幕
   * @param options 处理选项
   * @param onProgress 进度回调
   */
  async processVideo(options, onProgress) {
    const { videoPath, outputPath, aiServiceType = "whisper" } = options;
    let audioPath = null;
    try {
      onProgress?.({
        step: "extracting",
        percentage: 0,
        message: "正在验证视频文件..."
      });
      const isValid = await this.videoService.validateVideoFile(videoPath);
      if (!isValid) {
        throw new Error(
          "无法识别该视频文件。请确保：\n1. 文件是有效的视频格式（MP4、AVI、MKV 等）\n2. 文件没有损坏\n3. 文件可以被正常访问\n\n请查看控制台日志获取详细信息。"
        );
      }
      onProgress?.({
        step: "extracting",
        percentage: 10,
        message: "正在从视频中提取音频..."
      });
      audioPath = await this.videoService.extractAudio(videoPath, (percent) => {
        onProgress?.({
          step: "extracting",
          percentage: 10 + percent / 100 * 30,
          // 10% - 40%
          message: `正在提取音频... ${percent.toFixed(1)}%`
        });
      });
      onProgress?.({
        step: "recognizing",
        percentage: 40,
        message: "正在进行语音识别..."
      });
      const aiService = AIServiceFactory.createService(aiServiceType);
      const recognitionResult = await aiService.recognizeAudio(audioPath);
      if (!recognitionResult.success) {
        throw new Error(recognitionResult.error || "AI 识别失败");
      }
      onProgress?.({
        step: "recognizing",
        percentage: 60,
        message: `识别完成，共生成 ${recognitionResult.subtitles.length} 条字幕`
      });
      const finalOutputPath = outputPath || this.subtitleService.generateOutputPath(videoPath);
      const subtitlePath = await this.subtitleService.saveSubtitleFile(
        recognitionResult.subtitles,
        finalOutputPath
      );
      onProgress?.({
        step: "embedding",
        percentage: 65,
        message: "正在将字幕烧录到视频中..."
      });
      const resultPath = await this.subtitleService.burnSubtitles(
        videoPath,
        subtitlePath,
        finalOutputPath,
        (percent) => {
          onProgress?.({
            step: "embedding",
            percentage: 65 + percent / 100 * 35,
            // 65% - 100%
            message: `正在烧录字幕... ${percent.toFixed(1)}%`
          });
        }
      );
      onProgress?.({
        step: "completed",
        percentage: 100,
        message: "处理完成！"
      });
      return resultPath;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "未知错误";
      console.error("[VideoProcessService] 处理失败:", error);
      onProgress?.({
        step: "error",
        percentage: 0,
        message: "处理失败",
        error: errorMessage
      });
      throw error;
    } finally {
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
  getSupportedFormats() {
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
      ".mpeg"
    ];
  }
  /**
   * 检查文件格式是否支持
   */
  isSupportedFormat(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return this.getSupportedFormats().includes(ext);
  }
}
function createWindow() {
  const mainWindow = new electron.BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...process.platform === "linux" ? { icon } : {},
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      sandbox: false
    }
  });
  mainWindow.on("ready-to-show", () => {
    mainWindow.show();
  });
  mainWindow.webContents.setWindowOpenHandler((details) => {
    electron.shell.openExternal(details.url);
    return { action: "deny" };
  });
  if (utils.is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}
electron.app.whenReady().then(() => {
  utils.electronApp.setAppUserModelId("com.electron");
  electron.app.on("browser-window-created", (_, window) => {
    utils.optimizer.watchWindowShortcuts(window);
  });
  electron.ipcMain.on("ping", () => console.log("pong"));
  setupIpcHandlers();
  createWindow();
  electron.app.on("activate", function() {
    if (electron.BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    electron.app.quit();
  }
});
function setupIpcHandlers() {
  const videoProcessService = new VideoProcessService();
  electron.ipcMain.handle("dialog:selectVideo", async () => {
    const result = await electron.dialog.showOpenDialog({
      properties: ["openFile"],
      filters: [
        {
          name: "视频文件",
          extensions: [
            "mp4",
            "avi",
            "mkv",
            "mov",
            "wmv",
            "flv",
            "webm",
            "m4v",
            "mpg",
            "mpeg"
          ]
        }
      ]
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths[0];
  });
  electron.ipcMain.handle(
    "video:process",
    async (event, videoPath, aiServiceType) => {
      try {
        const outputPath = await videoProcessService.processVideo(
          {
            videoPath,
            aiServiceType: aiServiceType || "mock"
          },
          (progress) => {
            event.sender.send("video:progress", progress);
          }
        );
        return { success: true, outputPath };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "未知错误";
        return { success: false, error: errorMessage };
      }
    }
  );
  electron.ipcMain.handle("video:getSupportedFormats", () => {
    return videoProcessService.getSupportedFormats();
  });
  electron.ipcMain.handle("video:isSupportedFormat", (_event, filePath) => {
    return videoProcessService.isSupportedFormat(filePath);
  });
}
