<template>
  <div class="app-container">
    <!-- 视频选择区域 -->
    <div class="content" v-if="!selectedVideo && !isProcessing && !isCompleted">
      <h1 class="title">添加字幕</h1>
      <button class="select-button" @click="handleSelectVideo">选择视频</button>
      <p class="hint">支持 MP4、AVI、MKV 等常见格式</p>
    </div>

    <!-- 处理中 -->
    <div class="content" v-else-if="isProcessing">
      <h1 class="title">处理中</h1>
      <div class="progress-container">
        <div class="progress-bar">
          <div
            class="progress-fill"
            :style="{ width: progress.percentage + '%' }"
          ></div>
        </div>
        <p class="progress-text">{{ progress.percentage.toFixed(0) }}%</p>
      </div>
      <p class="status-text">{{ progress.message }}</p>
    </div>

    <!-- 完成 -->
    <div class="content" v-else-if="isCompleted && !progress.error">
      <h1 class="title">完成</h1>
      <p class="success-text">视频已成功添加字幕</p>
      <div class="output-info">
        <p class="output-label">输出文件</p>
        <p class="output-path">{{ outputPath }}</p>
      </div>
      <button class="select-button" @click="handleReset">处理新视频</button>
    </div>

    <!-- 错误 -->
    <div class="content" v-else-if="progress.error">
      <h1 class="title">出错了</h1>
      <p class="error-text">{{ progress.error }}</p>
      <button class="select-button" @click="handleReset">重试</button>
    </div>

    <!-- 已选择视频，等待处理 -->
    <div class="content" v-else>
      <h1 class="title">准备就绪</h1>
      <div class="video-info">
        <p class="video-label">已选择</p>
        <p class="video-path">{{ getFileName(selectedVideo) }}</p>
      </div>
      <button class="select-button primary" @click="handleProcess">
        开始处理
      </button>
      <button class="select-button secondary" @click="handleReset">
        重新选择
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";

interface ProcessProgress {
  step: "extracting" | "recognizing" | "embedding" | "completed" | "error";
  percentage: number;
  message: string;
  error?: string;
}

const selectedVideo = ref<string | null>(null);
const isProcessing = ref(false);
const progress = ref<ProcessProgress>({
  step: "extracting",
  percentage: 0,
  message: "准备开始...",
});
const outputPath = ref<string>("");

const isCompleted = computed(() => progress.value.step === "completed");

// 获取文件名
const getFileName = (filePath: string | null): string => {
  if (!filePath) return "";
  const parts = filePath.split(/[\\/]/);
  return parts[parts.length - 1];
};

// 选择视频文件
const handleSelectVideo = async () => {
  const videoPath = await window.api.selectVideo();
  if (videoPath) {
    selectedVideo.value = videoPath;
  }
};

// 开始处理
const handleProcess = async () => {
  if (!selectedVideo.value) return;

  isProcessing.value = true;
  progress.value = {
    step: "extracting",
    percentage: 0,
    message: "开始处理...",
  };

  try {
    const result = await window.api.processVideo(selectedVideo.value, "mock");

    if (result.success && result.outputPath) {
      outputPath.value = result.outputPath;
    } else if (result.error) {
      progress.value = {
        step: "error",
        percentage: 0,
        message: "处理失败",
        error: result.error,
      };
    }
  } catch (error) {
    progress.value = {
      step: "error",
      percentage: 0,
      message: "处理失败",
      error: error instanceof Error ? error.message : "未知错误",
    };
  } finally {
    isProcessing.value = false;
  }
};

// 重置状态
const handleReset = () => {
  selectedVideo.value = null;
  isProcessing.value = false;
  progress.value = {
    step: "extracting",
    percentage: 0,
    message: "准备开始...",
  };
  outputPath.value = "";
};

// 监听进度更新
const handleProgressUpdate = (newProgress: ProcessProgress) => {
  progress.value = newProgress;
};

onMounted(() => {
  window.api.onProgress(handleProgressUpdate);
});

onUnmounted(() => {
  window.api.removeProgressListener();
});
</script>

<style scoped>
.app-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #ffffff;
  padding: 2rem;
}

.content {
  width: 100%;
  max-width: 480px;
  text-align: center;
}

.title {
  font-size: 2.5rem;
  font-weight: 600;
  color: #1d1d1f;
  margin: 0 0 2rem 0;
  letter-spacing: -0.02em;
}

.select-button {
  width: 100%;
  padding: 1rem 2rem;
  font-size: 1.0625rem;
  font-weight: 500;
  color: #ffffff;
  background: #000000;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-bottom: 0.75rem;
}

.select-button:hover {
  background: #1d1d1f;
  transform: translateY(-1px);
}

.select-button:active {
  transform: translateY(0);
}

.select-button.secondary {
  background: #f5f5f7;
  color: #1d1d1f;
}

.select-button.secondary:hover {
  background: #e8e8ed;
}

.hint {
  font-size: 0.875rem;
  color: #86868b;
  margin: 1rem 0 0 0;
}

.video-info {
  background: #f5f5f7;
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 2rem;
}

.video-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: #86868b;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0 0 0.5rem 0;
}

.video-path {
  font-size: 0.9375rem;
  color: #1d1d1f;
  margin: 0;
  word-break: break-all;
  line-height: 1.5;
}

.progress-container {
  margin: 2rem 0;
}

.progress-bar {
  width: 100%;
  height: 4px;
  background: #f5f5f7;
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 1rem;
}

.progress-fill {
  height: 100%;
  background: #000000;
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 2rem;
  font-weight: 600;
  color: #1d1d1f;
  margin: 0 0 0.5rem 0;
}

.status-text {
  font-size: 0.9375rem;
  color: #86868b;
  margin: 0;
}

.success-text {
  font-size: 1.0625rem;
  color: #1d1d1f;
  margin: 0 0 2rem 0;
}

.error-text {
  font-size: 0.9375rem;
  color: #d70015;
  margin: 0 0 2rem 0;
  white-space: pre-line;
  line-height: 1.6;
}

.output-info {
  background: #f5f5f7;
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 2rem;
  text-align: left;
}

.output-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: #86868b;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0 0 0.5rem 0;
}

.output-path {
  font-size: 0.8125rem;
  color: #1d1d1f;
  margin: 0;
  word-break: break-all;
  line-height: 1.5;
  font-family: "SF Mono", "Monaco", "Menlo", monospace;
}
</style>
