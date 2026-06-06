<script setup>
import { ref, computed, onMounted, nextTick, watch } from 'vue';
import { toast } from 'vue3-toastify';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import ISO6391 from 'iso-639-1';
import { request, checkServerHealth, shortenWord } from '../lib/api.js';
import { AI_PROVIDERS, AI_MODELS, ANALYSIS_STATES } from '../lib/constants.js';
import { getSettings } from '../lib/storage.js';

// --- State ---
const serverOnline = ref(false);
const video = ref(null);
const videoId = ref(null);
const summary = ref(null);
const chats = ref([]);
const chatMessage = ref('');
const chatRef = ref(null);
const loading = ref(false);
const activeTab = ref('chat'); // 'chat' | 'summary' | 'settings'

// Provider/Model state
const selectedChatProvider = ref('gemini');
const selectedChatModel = ref('gemini-1.5-flash');
const selectedSummaryProvider = ref('gemini');
const selectedSummaryModel = ref('gemini-1.5-flash');
const selectedSummaryLang = ref('en');

const chatModels = computed(() => AI_MODELS[selectedChatProvider.value] || []);
const summaryModels = computed(() => AI_MODELS[selectedSummaryProvider.value] || []);

watch(selectedChatProvider, (val) => {
  selectedChatModel.value = AI_MODELS[val]?.[0] || '';
});
watch(selectedSummaryProvider, (val) => {
  selectedSummaryModel.value = AI_MODELS[val]?.[0] || '';
});

// Languages list
const languages = ISO6391.getAllCodes().map((code) => ({
  value: code,
  name: ISO6391.getName(code),
}));

const onHoldMessage = ref(false);

// --- Markdown Renderer ---
function renderMarkdown(text) {
  if (!text) return '';
  const html = marked.parse(text, { breaks: true });
  return DOMPurify.sanitize(html);
}

// --- Lifecycle ---
onMounted(async () => {
  const settings = await getSettings();
  selectedChatProvider.value = settings.defaultChatProvider || 'gemini';
  selectedChatModel.value = settings.defaultChatModel || 'gemini-1.5-flash';
  selectedSummaryProvider.value = settings.defaultSummaryProvider || 'gemini';
  selectedSummaryModel.value = settings.defaultSummaryModel || 'gemini-1.5-flash';
  selectedSummaryLang.value = settings.defaultSummaryLang || 'en';

  serverOnline.value = await checkServerHealth();

  // Listen for video info messages from content script or background
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'VIDEO_INFO' && message.payload) {
      handleVideoInfo(message.payload);
    }
  });

  // Also try to get video info from the current tab
  try {
    chrome.runtime.sendMessage({ type: 'GET_CURRENT_TAB_VIDEO' }, (response) => {
      if (response && response.videoId) {
        handleVideoInfo(response);
      }
    });
  } catch (e) {
    console.debug('[VecTube] No active YouTube tab found.');
  }
});

async function handleVideoInfo(payload) {
  if (payload.fromPopup && payload.videoId) {
    // Coming from popup with a database video ID
    await loadVideoById(payload.videoId);
    return;
  }

  if (!payload.videoId) return;

  // We have a YouTube video, try to process it or find it in our DB
  videoId.value = payload.videoId;

  if (serverOnline.value) {
    // First check if this video was already processed
    const response = await request(`/api/videos/1`);
    if (response.status_code < 400) {
      const found = response.payload.videos.find(
        (v) => v.youtube_id === payload.videoId || v.url?.includes(payload.videoId)
      );
      if (found) {
        await loadVideoById(found.id);
        return;
      }
    }
    // Video not found in DB, offer to process
    video.value = {
      title: payload.title,
      thumbnail: payload.thumbnail,
      youtube_id: payload.videoId,
      url: payload.url,
      analysis_state: -1, // Not yet processed
    };
  }
}

async function loadVideoById(id) {
  loading.value = true;
  try {
    const videoResponse = await request(`/api/video/detail/${id}`);
    if (videoResponse.status_code < 400) {
      video.value = videoResponse.payload;
      summary.value = videoResponse.payload.summary || null;

      const chatResponse = await request(`/api/chat/history/${id}`);
      if (chatResponse.status_code < 400) {
        chats.value = chatResponse.payload;
        await nextTick();
        scrollToBottom();
      }
    }
  } finally {
    loading.value = false;
  }
}

async function processCurrentVideo() {
  if (!video.value?.url) return;
  loading.value = true;
  try {
    const settings = await getSettings();
    const data = await request('/api/youtube/process', 'POST', {
      url: video.value.url,
      provider: settings.defaultAnalysisProvider || 'gemini',
    });
    if (data.status_code >= 400) {
      toast.error(data.message || 'Failed to process video');
    } else {
      toast.success('Video processing started!');
      video.value = data.payload;
      // Trigger analysis
      request('/api/video/analysis', 'POST', { video_id: data.payload.id });
    }
  } finally {
    loading.value = false;
  }
}

async function triggerAnalysis() {
  if (!video.value?.id) return;
  const data = await request('/api/video/analysis', 'POST', { video_id: video.value.id });
  if (data.status_code < 400) {
    video.value = data.payload;
    toast.success(
      data.payload.analysis_state === ANALYSIS_STATES.READY
        ? 'Video is ready for chat!'
        : 'Analysis in progress...'
    );
  }
}

// --- Chat ---
async function onChat() {
  if (!chatMessage.value.trim() || onHoldMessage.value) return;
  onHoldMessage.value = true;

  const question = chatMessage.value;
  chats.value.push({ question, answer: null });
  chatMessage.value = '';
  await nextTick();
  scrollToBottom();

  try {
    const chatResponse = await request('/api/chat', 'POST', {
      video_id: video.value.id,
      question,
      provider: selectedChatProvider.value,
      model: selectedChatModel.value,
    });

    chats.value.pop();
    if (chatResponse.status_code >= 400) {
      toast.error('Failed to get answer. Try again.');
      chats.value.push({ question, answer: 'Error: ' + (chatResponse.message || 'Unknown error') });
    } else {
      chats.value.push(chatResponse.payload);
    }
  } catch (e) {
    chats.value.pop();
    toast.error('Something went wrong.');
  } finally {
    onHoldMessage.value = false;
    await nextTick();
    scrollToBottom();
    chatRef.value?.focus();
  }
}

async function doSummary() {
  if (!video.value?.id) return;
  loading.value = true;
  try {
    const response = await request('/api/video/summary', 'POST', {
      video_id: video.value.id,
      lang_code: selectedSummaryLang.value || 'en',
      provider: selectedSummaryProvider.value,
      model: selectedSummaryModel.value,
    });
    if (response.status_code >= 400) {
      toast.error('Summary failed. Check your AI provider settings.');
    } else {
      summary.value = response.payload;
      toast.success('Summary generated!');
    }
  } finally {
    loading.value = false;
  }
}

async function doClearChat() {
  if (!video.value?.id) return;
  try {
    await request(`/api/chat/clear/${video.value.id}`, 'DELETE');
    chats.value = [];
    toast.success('Chat cleared');
  } catch {
    toast.error('Failed to clear chat');
  }
}

function scrollToBottom() {
  const container = document.getElementById('chatContainer');
  if (container) {
    container.scrollTop = container.scrollHeight;
  }
}

function autoResize(event) {
  const textarea = event.target;
  textarea.style.height = 'auto';
  textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
}

function handleKeydown(event) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    onChat();
  }
}

const isReady = computed(() => video.value?.analysis_state === ANALYSIS_STATES.READY);
const isNotProcessed = computed(() => video.value?.analysis_state === -1);
const enableChat = computed(() => isReady.value && chatMessage.value.trim() && !onHoldMessage.value);
</script>

<template>
  <div class="h-screen flex flex-col bg-base-100 overflow-hidden">
    <!-- Header -->
    <div class="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 px-4 py-2.5 flex items-center justify-between shrink-0">
      <div class="flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        <h1 class="text-white font-bold text-base tracking-tight">VecTube</h1>
      </div>
      <div class="server-status text-white/80">
        <span class="status-dot" :class="serverOnline ? 'online' : 'offline'"></span>
        {{ serverOnline ? 'Online' : 'Offline' }}
      </div>
    </div>

    <!-- Offline Banner -->
    <div v-if="!serverOnline" class="alert alert-warning rounded-none text-sm py-2">
      <span>⚠️ Backend server is offline. Start it on port 8000.</span>
    </div>

    <!-- No Video State -->
    <div v-if="!video" class="flex-1 flex items-center justify-center p-6">
      <div class="text-center text-base-content/50">
        <p class="text-5xl mb-3">🎥</p>
        <p class="font-semibold text-lg">No Video Selected</p>
        <p class="text-sm mt-2">Navigate to a YouTube video and click the <strong>VecTube</strong> button.</p>
      </div>
    </div>

    <!-- Video Loaded -->
    <template v-else>
      <!-- Video Info Bar -->
      <div class="px-3 py-2 bg-base-200 border-b border-base-300 flex items-center gap-3 shrink-0">
        <img
          v-if="video.thumbnail"
          :src="video.thumbnail"
          :alt="video.title"
          class="w-14 h-10 object-cover rounded"
        />
        <div class="flex-1 min-w-0">
          <h2 class="text-sm font-semibold truncate">{{ video.title }}</h2>
          <span
            class="badge badge-xs mt-0.5"
            :class="{
              'badge-success': isReady,
              'badge-warning': video.analysis_state === ANALYSIS_STATES.IN_PROGRESS,
              'badge-error': isNotProcessed,
              'badge-ghost': video.analysis_state === ANALYSIS_STATES.NOT_ANALYZED,
            }"
          >
            {{
              isReady ? 'Ready' :
              video.analysis_state === ANALYSIS_STATES.IN_PROGRESS ? 'Analyzing...' :
              isNotProcessed ? 'Not Processed' : 'Needs Analysis'
            }}
          </span>
        </div>
        <!-- Action buttons -->
        <button
          v-if="isNotProcessed"
          class="btn btn-primary btn-xs shrink-0"
          :disabled="loading"
          @click="processCurrentVideo"
        >
          Process
        </button>
        <button
          v-else-if="!isReady"
          class="btn btn-secondary btn-xs shrink-0"
          @click="triggerAnalysis"
        >
          {{ video.analysis_state === ANALYSIS_STATES.NOT_ANALYZED ? 'Analyze' : 'Refresh' }}
        </button>
      </div>

      <!-- Tabs -->
      <div v-if="isReady" class="tabs tabs-boxed bg-base-200 rounded-none px-2 pt-1 shrink-0">
        <button class="tab tab-sm" :class="{ 'tab-active': activeTab === 'chat' }" @click="activeTab = 'chat'">
          💬 Chat
        </button>
        <button class="tab tab-sm" :class="{ 'tab-active': activeTab === 'summary' }" @click="activeTab = 'summary'">
          📝 Summary
        </button>
        <button class="tab tab-sm" :class="{ 'tab-active': activeTab === 'settings' }" @click="activeTab = 'settings'">
          ⚙️ Config
        </button>
      </div>

      <!-- Chat Tab -->
      <div v-if="activeTab === 'chat' && isReady" class="flex-1 flex flex-col overflow-hidden">
        <!-- Messages -->
        <div id="chatContainer" class="flex-1 overflow-y-auto p-3 space-y-3">
          <div v-if="chats.length === 0" class="text-center text-base-content/40 py-10">
            <p class="text-3xl mb-2">💬</p>
            <p class="text-sm">Ask anything about this video!</p>
          </div>
          <div v-for="(chat, idx) in chats" :key="idx">
            <!-- User message -->
            <div class="chat chat-end">
              <div class="chat-bubble bg-primary text-primary-content text-sm">
                {{ chat.question }}
              </div>
            </div>
            <!-- AI response -->
            <div v-if="chat.answer" class="chat chat-start">
              <div class="chat-bubble bg-base-200 text-base-content text-sm">
                <article class="prose prose-sm max-w-none" v-html="renderMarkdown(chat.answer)"></article>
              </div>
              <div v-if="chat.provider" class="chat-footer opacity-80 mt-1 ml-2">
                <span class="badge badge-primary badge-xs gap-1">{{ chat.provider }}</span>
              </div>
            </div>
            <!-- Loading -->
            <div v-else class="chat chat-start">
              <div class="chat-bubble bg-base-200">
                <span class="loading loading-dots loading-sm text-primary"></span>
              </div>
            </div>
          </div>
        </div>

        <!-- Input -->
        <div class="p-3 border-t border-base-300 shrink-0">
          <div class="flex gap-2">
            <textarea
              ref="chatRef"
              v-model="chatMessage"
              :disabled="onHoldMessage"
              rows="1"
              class="textarea textarea-bordered flex-1 resize-none text-sm leading-snug"
              placeholder="Ask about this video..."
              @input="autoResize"
              @keydown="handleKeydown"
            />
            <button
              class="btn btn-primary btn-sm self-end"
              :disabled="!enableChat"
              @click="onChat"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Summary Tab -->
      <div v-if="activeTab === 'summary' && isReady" class="flex-1 overflow-y-auto p-3">
        <div v-if="summary" class="prose prose-sm max-w-none" v-html="renderMarkdown(summary)"></div>
        <div v-else class="text-center py-6">
          <p class="text-base-content/50 text-sm mb-3">No summary yet. Generate one below.</p>
          <div class="space-y-2 max-w-xs mx-auto">
            <select v-model="selectedSummaryProvider" class="select select-bordered select-sm w-full">
              <option v-for="p in AI_PROVIDERS" :key="p" :value="p">{{ p }}</option>
            </select>
            <select v-model="selectedSummaryModel" class="select select-bordered select-sm w-full">
              <option v-for="m in summaryModels" :key="m" :value="m">{{ m }}</option>
            </select>
            <select v-model="selectedSummaryLang" class="select select-bordered select-sm w-full">
              <option v-for="lang in languages" :key="lang.value" :value="lang.value">{{ lang.name }}</option>
            </select>
            <button class="btn btn-primary btn-sm w-full" :disabled="loading" @click="doSummary">
              <span v-if="loading" class="loading loading-spinner loading-xs"></span>
              Generate Summary
            </button>
          </div>
        </div>
      </div>

      <!-- Config Tab -->
      <div v-if="activeTab === 'settings' && isReady" class="flex-1 overflow-y-auto p-3 space-y-4">
        <div>
          <h3 class="font-semibold text-sm mb-2">Chat Provider</h3>
          <div class="grid grid-cols-2 gap-2">
            <select v-model="selectedChatProvider" class="select select-bordered select-sm w-full">
              <option v-for="p in AI_PROVIDERS" :key="p" :value="p">{{ p }}</option>
            </select>
            <select v-model="selectedChatModel" class="select select-bordered select-sm w-full">
              <option v-for="m in chatModels" :key="m" :value="m">{{ m }}</option>
            </select>
          </div>
        </div>
        <div class="divider my-1"></div>
        <div>
          <h3 class="font-semibold text-sm mb-2">Summary Provider</h3>
          <div class="grid grid-cols-2 gap-2">
            <select v-model="selectedSummaryProvider" class="select select-bordered select-sm w-full">
              <option v-for="p in AI_PROVIDERS" :key="p" :value="p">{{ p }}</option>
            </select>
            <select v-model="selectedSummaryModel" class="select select-bordered select-sm w-full">
              <option v-for="m in summaryModels" :key="m" :value="m">{{ m }}</option>
            </select>
          </div>
          <select v-model="selectedSummaryLang" class="select select-bordered select-sm w-full mt-2">
            <option v-for="lang in languages" :key="lang.value" :value="lang.value">{{ lang.name }}</option>
          </select>
        </div>
        <div class="divider my-1"></div>
        <button class="btn btn-error btn-sm btn-outline w-full" @click="doClearChat">
          🗑️ Clear Chat History
        </button>
      </div>
    </template>
  </div>
</template>
