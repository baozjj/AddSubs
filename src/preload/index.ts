import { contextBridge, ipcRenderer } from "electron";
import { electronAPI } from "@electron-toolkit/preload";

// Custom APIs for renderer
const api = {
  // 选择视频文件
  selectVideo: (): Promise<string | null> =>
    ipcRenderer.invoke("dialog:selectVideo"),

  // 处理视频
  processVideo: (
    videoPath: string,
    aiServiceType?: string
  ): Promise<{ success: boolean; outputPath?: string; error?: string }> =>
    ipcRenderer.invoke("video:process", videoPath, aiServiceType),

  // 监听处理进度
  onProgress: (callback: (progress: any) => void) => {
    ipcRenderer.on("video:progress", (_event, progress) => callback(progress));
  },

  // 移除进度监听器
  removeProgressListener: () => {
    ipcRenderer.removeAllListeners("video:progress");
  },

  // 获取支持的视频格式
  getSupportedFormats: (): Promise<string[]> =>
    ipcRenderer.invoke("video:getSupportedFormats"),

  // 检查文件格式是否支持
  isSupportedFormat: (filePath: string): Promise<boolean> =>
    ipcRenderer.invoke("video:isSupportedFormat", filePath),
};

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld("electron", electronAPI);
    contextBridge.exposeInMainWorld("api", api);
  } catch (error) {
    console.error(error);
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI;
  // @ts-ignore (define in dts)
  window.api = api;
}
