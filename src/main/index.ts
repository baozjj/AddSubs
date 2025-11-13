import { app, shell, BrowserWindow, ipcMain, dialog } from "electron";
import { join } from "path";
import { electronApp, optimizer, is } from "@electron-toolkit/utils";
import icon from "../../resources/icon.png?asset";
import { VideoProcessService } from "./services/VideoProcessService";
import { ProcessProgress } from "./types";

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === "linux" ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: false,
    },
  });

  mainWindow.on("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: "deny" };
  });

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId("com.electron");

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on("browser-window-created", (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  // IPC test
  ipcMain.on("ping", () => console.log("pong"));

  // 注册 IPC 处理器
  setupIpcHandlers();

  createWindow();

  app.on("activate", function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

/**
 * 设置 IPC 处理器
 */
function setupIpcHandlers(): void {
  const videoProcessService = new VideoProcessService();

  // 选择视频文件
  ipcMain.handle("dialog:selectVideo", async () => {
    const result = await dialog.showOpenDialog({
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
            "mpeg",
          ],
        },
      ],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  });

  // 处理视频
  ipcMain.handle(
    "video:process",
    async (event, videoPath: string, aiServiceType?: string) => {
      try {
        const outputPath = await videoProcessService.processVideo(
          {
            videoPath,
            aiServiceType: (aiServiceType as "mock" | "openai") || "mock",
          },
          (progress: ProcessProgress) => {
            // 发送进度更新到渲染进程
            event.sender.send("video:progress", progress);
          }
        );

        return { success: true, outputPath };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "未知错误";
        return { success: false, error: errorMessage };
      }
    }
  );

  // 获取支持的视频格式
  ipcMain.handle("video:getSupportedFormats", () => {
    return videoProcessService.getSupportedFormats();
  });

  // 检查文件格式是否支持
  ipcMain.handle("video:isSupportedFormat", (_event, filePath: string) => {
    return videoProcessService.isSupportedFormat(filePath);
  });
}
