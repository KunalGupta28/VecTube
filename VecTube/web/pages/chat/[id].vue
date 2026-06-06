<script lang="js" setup>
import { useRoute } from "#app";
import { request, shortenWord } from "~/supports/request";
import settings from "~/supports/settings";
import ISO6391 from "iso-639-1";
import { useLoading } from "vue-loading-overlay";
import { parseMarkdown } from "@nuxtjs/mdc/runtime";

const config = useRuntimeConfig();

const route = useRoute();
const video = ref({});
const summary = ref(null);

const providers = ref(["openai", "gemini", "claude", "mistral", "ollama"]);
const aiModels = {
  openai: [
    "gpt-4-turbo",
    "gpt-4",
    "gpt-4o",
    "gpt-4o-mini",
    "o1-mini",
    "gpt-3.5-turbo",
  ],
  gemini: ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-1.0-pro"],
  claude: [
    "claude-3-5-sonnet-20240620",
    "claude-3-opus-20240229",
    "claude-3-haiku-20240307",
  ],
  mistral: [
    "mistral-large-latest",
    "open-mistral-nemo",
    "open-mistral-7b",
    "open-mixtral-8x7b",
    "open-mixtral-8x22b",
  ],
  ollama: ["qwen2", "llama3.1"],
};

const selectedSummaryProvider = ref("gemini");
const selectedSummaryModel = ref("gemini-1.5-flash");
const selectedSummaryLang = ref("en");
const summaryModels = ref(aiModels[selectedSummaryProvider.value]);

const languages = ref([]);
ISO6391.getAllCodes().forEach((x) => {
  languages.value.unshift({
    value: `${x}`,
    name: `${ISO6391.getName(x)}`,
  });
});

watch(selectedSummaryProvider, (newValue) => {
  summaryModels.value = aiModels[newValue];
});

const $loading = useLoading({ ...settings.LOADING_PROPERTIES });
const doSummary = async () => {
  const loader = $loading.show({});
  try {
    const response = await request(
      `${config.public.apiUrl}/api/video/summary`,
      "POST",
      {
        video_id: video.value.id,
        lang_code: selectedSummaryLang.value ?? "en",
        provider: selectedSummaryProvider.value,
        model: selectedSummaryModel.value,
      },
    );
    if (response.status_code >= 400) {
      useNuxtApp().$toast.error(
        "Please select right configuration to summary",
        {
          autoClose: 2000,
        },
      );
    } else {
      useNuxtApp().$toast.success("Successful summary video", {
        autoClose: 2000,
      });
    }
    summary.value = await parseMarkdown(response.payload);
  } finally {
    setTimeout(() => {
      loader.hide();
    }, 500);
  }
};

const selectedChatProvider = ref("gemini");
const selectedChatModel = ref("gemini-1.5-flash");
const chatModels = ref(aiModels[selectedChatProvider.value]);
watch(selectedChatProvider, (newValue) => {
  chatModels.value = aiModels[newValue];
});

const chatMessage = ref("");
const chats = ref([]);
const chatRef = ref({});

const onHoldMessageResponse = ref(false);
const onChat = async () => {
  onHoldMessageResponse.value = true;
  try {
    chats.value.push({
      question: chatMessage.value,
      answer: null,
    });
    await nextTick();
    scrollToBottom();
    const chatResponse = await request(
      `${config.public.apiUrl}/api/chat`,
      "POST",
      {
        video_id: video.value.id,
        question: chatMessage.value,
        provider: selectedChatProvider.value,
        model: selectedChatModel.value,
      },
    );
    if (chatResponse.status_code >= 400) {
      chats.value.pop();
      useNuxtApp().$toast.error(
        "Fail to get answer from server, please try again",
        {
          autoClose: 2000,
        },
      );
      return;
    }
    chats.value.pop();
    chats.value.push(chatResponse.payload);
    chatMessage.value = null;
  } catch (e) {
    console.debug(e);
    chats.value.pop();
    useNuxtApp().$toast.error("Something went wrong, try again", {
      autoClose: 2000,
    });
  } finally {
    onHoldMessageResponse.value = false;
    await nextTick();
    scrollToBottom();
    chatRef.value.focus();
    chatRef.value.style.height = "auto";
  }
};

const scrollToBottom = () => {
  const chatContainer = document.getElementById("chatContainer");
  if (chatContainer) {
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }
};

const doClearChat = async () => {
  try {
    await request(
      `${config.public.apiUrl}/api/chat/clear/${route.params.id}`,
      "DELETE",
    );
    chats.value = [];
  } catch (e) {
    console.error(e);
    useNuxtApp().$toast.error("Something went wrong, try later", {
      autoClose: 2000,
    });
  }
};

onMounted(async () => {
  try {
    const videoResponse = await request(
      `${config.public.apiUrl}/api/video/detail/${route.params.id}`,
      "GET",
    );
    video.value = videoResponse.payload;
    summary.value = videoResponse.payload.summary
      ? await parseMarkdown(videoResponse.payload.summary)
      : null;

    const chatResponse = await request(
      `${config.public.apiUrl}/api/chat/history/${route.params.id}`,
      "GET",
    );
    chats.value = chatResponse.payload;
    await nextTick();
    if (chats.value.length > 0) {
      scrollToBottom();
    }
    chatRef.value.focus();
  } catch (e) {
    console.error(e);
    useNuxtApp().$toast.error("Something went wrong, try later", {
      autoClose: 2000,
    });
  }
});

const autoResize = (event) => {
  const textarea = event.target;
  textarea.style.height = "auto";
  textarea.style.height = textarea.scrollHeight + "px";
};

const enableChatButton = () => {
  return !chatMessage.value || onHoldMessageResponse.value;
};

const showSummarySettings = ref(false);
const showChatSettings = ref(false);
</script>

<template>
  <div class="flex flex-col lg:flex-row gap-5 h-[calc(100vh-7rem)]">
    <!-- Left Pane: Video & Summary -->
    <div class="lg:w-2/5 flex flex-col gap-4 overflow-y-auto">
      <!-- Video Player -->
      <div class="glass-card overflow-hidden">
        <iframe
          :src="video.play_url"
          class="w-full aspect-video"
          allowfullscreen
        />
        <div class="p-4">
          <h1 class="text-base font-semibold text-base-content leading-snug">
            {{ shortenWord(video.title) }}
          </h1>
        </div>
      </div>

      <!-- Summary Section -->
      <div class="glass-card flex flex-col flex-1 overflow-hidden">
        <div class="flex items-center justify-between px-4 py-3 border-b border-indigo-500/10">
          <div class="flex items-center gap-2">
            <i class="fa-solid fa-sparkles text-indigo-400 text-xs"></i>
            <span class="text-sm font-medium text-base-content/70">AI Summary</span>
          </div>
          <button
            class="text-xs text-base-content/40 hover:text-base-content/70 transition-colors flex items-center gap-1"
            @click="showSummarySettings = !showSummarySettings"
          >
            <i class="fa-solid fa-sliders text-[10px]"></i>
            Settings
          </button>
        </div>

        <!-- Summary Settings Panel -->
        <div v-if="showSummarySettings" class="px-4 py-3 border-b border-indigo-500/10 space-y-3 bg-base-200/30">
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-2">
            <select
              v-model="selectedSummaryProvider"
              class="select-premium w-full px-3 py-2 text-xs"
            >
              <option disabled selected>Provider</option>
              <option v-for="item in providers" :key="item" :value="item">
                {{ item }}
              </option>
            </select>
            <select
              v-model="selectedSummaryModel"
              class="select-premium w-full px-3 py-2 text-xs"
            >
              <option disabled selected>Model</option>
              <option
                v-for="model in summaryModels"
                :key="model"
                :value="model"
              >
                {{ model }}
              </option>
            </select>
            <select
              v-model="selectedSummaryLang"
              class="select-premium w-full px-3 py-2 text-xs"
            >
              <option disabled selected>Language</option>
              <option
                v-for="lang in languages"
                :key="lang.value"
                :value="lang.value"
              >
                {{ lang.name }}
              </option>
            </select>
          </div>
          <div class="flex justify-end">
            <button
              class="btn-glow px-4 py-1.5 rounded-lg text-xs"
              @click="doSummary"
            >
              Generate Summary
            </button>
          </div>

          <!-- Mobile summary display -->
          <div class="lg:hidden">
            <article v-if="summary" class="overflow-auto max-h-80">
              <MDCRenderer
                :body="summary.body"
                :data="summary.data"
                class="prose prose-invert prose-sm max-w-none"
              />
            </article>
          </div>
        </div>

        <!-- Summary Content (Desktop) -->
        <div class="hidden lg:block flex-1 overflow-y-auto p-4">
          <article v-if="summary">
            <MDCRenderer
              :body="summary.body"
              :data="summary.data"
              class="prose prose-invert prose-sm max-w-none"
            />
          </article>
          <div v-else class="flex flex-col items-center justify-center h-full text-center py-8">
            <div class="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center mb-3">
              <i class="fa-solid fa-wand-magic-sparkles text-lg text-indigo-400/40"></i>
            </div>
            <p class="text-sm text-base-content/40">No summary yet</p>
            <p class="text-xs text-base-content/25 mt-1">Configure settings above to generate</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Right Pane: Chat -->
    <div class="lg:w-3/5 flex flex-col glass-card overflow-hidden">
      <!-- Chat Header -->
      <div class="flex items-center justify-between px-4 py-3 border-b border-indigo-500/10">
        <div class="flex items-center gap-2">
          <i class="fa-solid fa-comments text-indigo-400 text-xs"></i>
          <span class="text-sm font-medium text-base-content/70">Chat</span>
          <span v-if="chats.length > 0" class="text-xs text-base-content/30">
            · {{ chats.length }} message{{ chats.length !== 1 ? 's' : '' }}
          </span>
        </div>
        <div class="flex items-center gap-2">
          <button
            class="text-xs text-base-content/40 hover:text-base-content/70 transition-colors flex items-center gap-1"
            @click="showChatSettings = !showChatSettings"
          >
            <i class="fa-solid fa-sliders text-[10px]"></i>
            Settings
          </button>
          <button
            v-if="chats.length > 0"
            class="text-xs text-red-400/60 hover:text-red-400 transition-colors flex items-center gap-1"
            @click="doClearChat"
          >
            <i class="fa-solid fa-trash text-[10px]"></i>
            Clear
          </button>
        </div>
      </div>

      <!-- Chat Settings Panel -->
      <div v-if="showChatSettings" class="px-4 py-3 border-b border-indigo-500/10 bg-base-200/30">
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-2">
          <select
            v-model="selectedChatProvider"
            class="select-premium w-full px-3 py-2 text-xs"
          >
            <option disabled selected>Provider</option>
            <option
              v-for="item in providers"
              :key="item"
              :value="item"
            >
              {{ item }}
            </option>
          </select>
          <select
            v-model="selectedChatModel"
            class="select-premium w-full px-3 py-2 text-xs"
          >
            <option disabled selected>Model</option>
            <option
              v-for="model in chatModels"
              :key="model"
              :value="model"
            >
              {{ model }}
            </option>
          </select>
        </div>
      </div>

      <!-- Chat Messages -->
      <div
        id="chatContainer"
        class="flex-1 overflow-y-auto px-4 py-4 space-y-4"
      >
        <!-- Empty Chat State -->
        <div
          v-if="chats.length === 0"
          class="flex flex-col items-center justify-center h-full text-center"
        >
          <div class="w-14 h-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center mb-4">
            <i class="fa-solid fa-message text-xl text-indigo-400/40"></i>
          </div>
          <p class="text-base text-base-content/50 font-medium mb-1">Start a conversation</p>
          <p class="text-xs text-base-content/30">Ask anything about this video</p>
        </div>

        <!-- Messages -->
        <div v-for="(chat, idx) in chats" :key="idx" class="space-y-3">
          <!-- User Message -->
          <div class="flex justify-end">
            <div class="chat-user px-4 py-3 max-w-[80%]">
              <p class="text-sm">{{ chat.question }}</p>
            </div>
          </div>

          <!-- AI Response -->
          <div v-if="chat.answer" class="flex justify-start">
            <div class="max-w-[85%]">
              <div class="chat-ai px-4 py-3">
                <MDC :value="chat.answer" class="prose prose-invert prose-sm max-w-none" tag="article" />
              </div>
              <div class="mt-1.5 ml-2">
                <span class="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400/60 font-medium">
                  {{ chat.provider }}
                </span>
              </div>
            </div>
          </div>

          <!-- Loading state -->
          <div v-else class="flex justify-start">
            <div class="chat-ai px-2 py-1">
              <div class="thinking-dots">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Chat Input -->
      <div class="px-4 py-3 border-t border-indigo-500/10">
        <div class="flex items-end gap-3">
          <textarea
            ref="chatRef"
            v-model="chatMessage"
            :disabled="onHoldMessageResponse"
            class="input-premium flex-1 px-4 py-2.5 text-sm resize-none min-h-[42px] max-h-32"
            placeholder="Ask about this video..."
            rows="1"
            @input="autoResize"
            @keydown.enter.prevent="onChat"
          />
          <button
            :disabled="enableChatButton()"
            class="btn-glow h-[42px] w-[42px] rounded-xl flex items-center justify-center flex-shrink-0 disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none"
            @click="onChat"
          >
            <i class="fa-solid fa-paper-plane text-sm"></i>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped></style>
