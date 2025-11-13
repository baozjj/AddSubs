"use strict";
const electron = require("electron");
const preload = require("@electron-toolkit/preload");
const api = {
  // 选择视频文件
  selectVideo: () => electron.ipcRenderer.invoke("dialog:selectVideo"),
  // 处理视频
  processVideo: (videoPath, aiServiceType) => electron.ipcRenderer.invoke("video:process", videoPath, aiServiceType),
  // 监听处理进度
  onProgress: (callback) => {
    electron.ipcRenderer.on("video:progress", (_event, progress) => callback(progress));
  },
  // 移除进度监听器
  removeProgressListener: () => {
    electron.ipcRenderer.removeAllListeners("video:progress");
  },
  // 获取支持的视频格式
  getSupportedFormats: () => electron.ipcRenderer.invoke("video:getSupportedFormats"),
  // 检查文件格式是否支持
  isSupportedFormat: (filePath) => electron.ipcRenderer.invoke("video:isSupportedFormat", filePath)
};
if (process.contextIsolated) {
  try {
    electron.contextBridge.exposeInMainWorld("electron", preload.electronAPI);
    electron.contextBridge.exposeInMainWorld("api", api);
  } catch (error) {
    console.error(error);
  }
} else {
  window.electron = preload.electronAPI;
  window.api = api;
}
