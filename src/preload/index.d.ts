import { ElectronAPI } from "@electron-toolkit/preload";

interface ProcessProgress {
  step: "extracting" | "recognizing" | "embedding" | "completed" | "error";
  percentage: number;
  message: string;
  error?: string;
}

interface VideoAPI {
  selectVideo: () => Promise<string | null>;
  processVideo: (
    videoPath: string,
    aiServiceType?: string
  ) => Promise<{ success: boolean; outputPath?: string; error?: string }>;
  onProgress: (callback: (progress: ProcessProgress) => void) => void;
  removeProgressListener: () => void;
  getSupportedFormats: () => Promise<string[]>;
  isSupportedFormat: (filePath: string) => Promise<boolean>;
}

declare global {
  interface Window {
    electron: ElectronAPI;
    api: VideoAPI;
  }
}
