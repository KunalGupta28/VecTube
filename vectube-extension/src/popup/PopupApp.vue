<script setup>
import { ref, onMounted, computed } from 'vue';
import { toast } from 'vue3-toastify';
import { request, checkServerHealth, shortenWord } from '../lib/api.js';
import { ANALYSIS_PROVIDERS, ANALYSIS_STATES } from '../lib/constants.js';
import { getSettings, saveSettings } from '../lib/storage.js';

// --- State ---
const view = ref('videos'); // 'videos' | 'add' | 'settings'
const serverOnline = ref(false);
const videos = ref([]);
const total = ref(0);
const pageNo = ref(1);
const loading = ref(false);

// Add video form
const newUrl = ref('');
const analysisProvider = ref('gemini');

// Settings
const settings = ref({
  apiUrl: 'http://localhost:8000',
  defaultChatProvider: 'gemini',
  defaultChatModel: 'gemini-1.5-flash',
  defaultAnalysisProvider: 'gemini',
});

// --- Lifecycle ---
onMounted(async () => {
  const s = await getSettings();
  settings.value = { ...settings.value, ...s };
  analysisProvider.value = s.defaultAnalysisProvider || 'gemini';

  serverOnline.value = await checkServerHealth();
  if (serverOnline.value) {
    await fetchVideos();
  }
});

// --- Methods ---
async function fetchVideos() {
  loading.value = true;
  try {
    const response = await request(`/api/videos/${pageNo.value}`);
    if (response.status_code < 400) {
      total.value = response.payload.total;
      if (pageNo.value === 1) {
        videos.value = response.payload.videos;
      } else {
        videos.value.push(...response.payload.videos);
      }
    }
  } finally {
    loading.value = false;
  }
}

async function loadMore() {
  if (videos.value.length >= total.value) return;
  pageNo.value++;
  await fetchVideos();
}

async function processVideo() {
  if (!newUrl.value) {
    toast.error('Please enter a YouTube URL');
    return;
  }
  loading.value = true;
  try {
    const data = await request('/api/youtube/process', 'POST', {
      url: newUrl.value,
      provider: analysisProvider.value,
    });
    if (data.status_code >= 400) {
      toast.error(data.message || 'Failed to process video');
    } else {
      toast.success('Video submitted for processing!');
      newUrl.value = '';
      videos.value.unshift(data.payload);
      view.value = 'videos';
      // Trigger analysis
      request('/api/video/analysis', 'POST', { video_id: data.payload.id });
    }
  } finally {
    loading.value = false;
  }
}

async function triggerAnalysis(id) {
  const data = await request('/api/video/analysis', 'POST', { video_id: id });
  if (data.status_code >= 400) {
    toast.error('Analysis failed');
  } else {
    const payload = data.payload;
    toast.success(
      payload.analysis_state === ANALYSIS_STATES.READY
        ? 'Video is ready!'
        : 'Analysis in progress...'
    );
    const index = videos.value.findIndex((v) => v.id === payload.id);
    if (index !== -1) {
      videos.value.splice(index, 1, payload);
    }
  }
}

async function openChat(videoId) {
  // Open side panel with this video's chat
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) {
    chrome.runtime.sendMessage({
      type: 'OPEN_SIDE_PANEL',
      payload: { videoId, fromPopup: true },
    });
  }
  window.close();
}

async function saveSettingsForm() {
  const saved = await saveSettings(settings.value);
  if (saved) {
    toast.success('Settings saved!');
    serverOnline.value = await checkServerHealth();
  } else {
    toast.error('Failed to save settings');
  }
}

const hasMore = computed(() => videos.value.length < total.value);
</script>

<template>
  <div class="w-[380px] min-h-[500px] max-h-[600px] flex flex-col bg-base-100 overflow-hidden">
    <!-- Header -->
    <div class="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 px-4 py-3 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        <h1 class="text-white font-bold text-lg tracking-tight">VecTube</h1>
      </div>
      <div class="flex items-center gap-2">
        <div class="server-status text-white/80">
          <span class="status-dot" :class="serverOnline ? 'online' : 'offline'"></span>
          {{ serverOnline ? 'Online' : 'Offline' }}
        </div>
      </div>
    </div>

    <!-- Navigation Tabs -->
    <div class="tabs tabs-boxed bg-base-200 rounded-none px-2 pt-1">
      <button class="tab tab-sm" :class="{ 'tab-active': view === 'videos' }" @click="view = 'videos'">
        📺 Videos
      </button>
      <button class="tab tab-sm" :class="{ 'tab-active': view === 'add' }" @click="view = 'add'">
        ➕ Add
      </button>
      <button class="tab tab-sm" :class="{ 'tab-active': view === 'settings' }" @click="view = 'settings'">
        ⚙️ Settings
      </button>
    </div>

    <!-- Content Area -->
    <div class="flex-1 overflow-y-auto p-3">
      <!-- Offline Banner -->
      <div v-if="!serverOnline" class="alert alert-warning mb-3 text-sm">
        <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-5 w-5" fill="none" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.072 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
        <span>Backend server is offline. Start it on port 8000.</span>
      </div>

      <!-- Videos List View -->
      <div v-if="view === 'videos'">
        <div v-if="loading && videos.length === 0" class="flex justify-center py-10">
          <span class="loading loading-spinner loading-lg text-primary"></span>
        </div>
        <div v-else-if="videos.length === 0" class="text-center py-10 text-base-content/50">
          <p class="text-4xl mb-2">🎬</p>
          <p class="font-medium">No videos yet</p>
          <p class="text-sm mt-1">Add a YouTube video to get started!</p>
        </div>
        <div v-else class="space-y-2">
          <div
            v-for="item in videos"
            :key="item.id"
            class="card card-side bg-base-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
          >
            <figure class="w-24 shrink-0">
              <img :src="item.thumbnail" :alt="item.title" class="h-full w-full object-cover" />
            </figure>
            <div class="card-body p-3 gap-1">
              <h3 class="card-title text-sm leading-tight">{{ shortenWord(item.title, 50) }}</h3>
              <div class="card-actions justify-end mt-auto">
                <button
                  v-if="item.analysis_state === 1"
                  class="btn btn-primary btn-xs"
                  @click="openChat(item.id)"
                >
                  Chat
                </button>
                <button
                  v-else
                  class="btn btn-secondary btn-xs"
                  @click="triggerAnalysis(item.id)"
                >
                  {{ item.analysis_state === 0 ? 'Analyze' : 'Refresh' }}
                </button>
              </div>
            </div>
          </div>
          <button
            v-if="hasMore"
            class="btn btn-ghost btn-sm w-full mt-2"
            :disabled="loading"
            @click="loadMore"
          >
            {{ loading ? 'Loading...' : 'Load More' }}
          </button>
        </div>
      </div>

      <!-- Add Video View -->
      <div v-if="view === 'add'" class="space-y-4">
        <h2 class="font-semibold text-lg">Add New Video</h2>
        <div class="form-control">
          <label class="label"><span class="label-text">YouTube URL</span></label>
          <input
            v-model="newUrl"
            type="text"
            placeholder="https://www.youtube.com/watch?v=..."
            class="input input-bordered w-full input-sm"
          />
        </div>
        <div class="form-control">
          <label class="label"><span class="label-text">Analysis Provider</span></label>
          <select v-model="analysisProvider" class="select select-bordered w-full select-sm">
            <option v-for="p in ANALYSIS_PROVIDERS" :key="p" :value="p">{{ p }}</option>
          </select>
        </div>
        <button
          class="btn btn-primary btn-sm w-full"
          :disabled="loading || !newUrl"
          @click="processVideo"
        >
          <span v-if="loading" class="loading loading-spinner loading-xs"></span>
          Process Video
        </button>
      </div>

      <!-- Settings View -->
      <div v-if="view === 'settings'" class="space-y-4">
        <h2 class="font-semibold text-lg">Settings</h2>
        <div class="form-control">
          <label class="label"><span class="label-text">Backend API URL</span></label>
          <input
            v-model="settings.apiUrl"
            type="text"
            class="input input-bordered w-full input-sm"
            placeholder="http://localhost:8000"
          />
        </div>
        <div class="form-control">
          <label class="label"><span class="label-text">Default Analysis Provider</span></label>
          <select v-model="settings.defaultAnalysisProvider" class="select select-bordered w-full select-sm">
            <option v-for="p in ANALYSIS_PROVIDERS" :key="p" :value="p">{{ p }}</option>
          </select>
        </div>
        <button class="btn btn-primary btn-sm w-full" @click="saveSettingsForm">
          Save Settings
        </button>
        <div class="divider text-xs">About</div>
        <p class="text-xs text-base-content/60 text-center">
          VecTube v1.0.0 — AI-powered YouTube Q&A
        </p>
      </div>
    </div>
  </div>
</template>
