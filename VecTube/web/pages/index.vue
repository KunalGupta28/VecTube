<script lang="js" setup>
import settings from "~/supports/settings.js";
import { useLoading } from "vue-loading-overlay";
import { request, shortenWord } from "~/supports/request.js";

const config = useRuntimeConfig();

const videos = ref([]);
const total = ref(0);
const pageNo = ref(1);
const searchQuery = ref("");
const showAddModal = useState("showAddModal", () => false);
const activeFilter = useState("activeFilter", () => "dashboard");

const fetchVideos = async () => {
  const response = await request(
    `${config.public.apiUrl}/api/videos/${pageNo.value}`,
    "GET",
  );
  if (response.status_code >= 400) {
    return;
  }
  total.value = response.payload.total;
  videos.value.push(...response.payload.videos);
};

const loadMore = async () => {
  if (videos.value.length >= total.value) {
    return;
  }
  try {
    pageNo.value++;
    await fetchVideos();
  } catch (e) {
    console.error(e);
    pageNo.value--;
    useNuxtApp().$toast.error("Cannot load more records", {
      autoClose: 2000,
    });
  }
};

onBeforeMount(async () => {
  await fetchVideos();
});

const url = ref(null);
const invalidUrl = ref(false);
const provider = ref("Analysis Provider");
const invalidProvider = ref(false);

const onOpenAddDialog = () => {
  showAddModal.value = true;
};
const onCloseAddDialog = () => {
  showAddModal.value = false;
};

const displayLoadMore = computed(() => videos.value.length < total.value);

const filteredVideos = computed(() => {
  let result = videos.value;

  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase();
    result = result.filter(
      (v) =>
        (v.title && v.title.toLowerCase().includes(q)) ||
        (v.description && v.description.toLowerCase().includes(q)),
    );
  }

  switch (activeFilter.value) {
    case "library":
      return result.filter((v) => v.analysis_state === 1);
    case "recent":
      return [...result].sort(
        (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0),
      );
    case "favorites":
      return result.filter((v) => v.summary);
    case "collections":
      return result;
    case "analytics":
      return result;
    case "settings":
      return result;
    default:
      return result;
  }
});

const stats = computed(() => ({
  total: videos.value.length,
  analyzed: videos.value.filter((v) => v.analysis_state === 1).length,
  processing: videos.value.filter((v) => v.analysis_state === 2).length,
  pending: videos.value.filter((v) => v.analysis_state === 0).length,
}));

const $loading = useLoading({ ...settings.LOADING_PROPERTIES });
const process = async () => {
  const error = [];
  if (!url.value) {
    error.push("Enter a valid YouTube URL");
    invalidUrl.value = true;
  }

  if (!provider.value || provider.value === "Analysis Provider") {
    error.push("Select a valid Provider");
    invalidProvider.value = true;
  }

  if (error.length > 0) {
    return;
  }

  invalidUrl.value = false;
  invalidProvider.value = false;
  onCloseAddDialog();
  const loader = $loading.show({});
  try {
    const data = await request(
      `${config.public.apiUrl}/api/youtube/process`,
      "POST",
      {
        url: url.value,
        provider: provider.value,
      },
    );
    if (data.status_code >= 400) {
      useNuxtApp().$toast.error(
        "Please provide valid Youtube URL and Provider",
        {
          autoClose: 2000,
        },
      );
    } else {
      useNuxtApp().$toast.success("Successful fetching new Youtube Video", {
        autoClose: 2000,
      });
      url.value = null;
      videos.value.unshift(data.payload);
      if (videos.value >= 50) {
        videos.value.pop();
      }
    }
    try {
      request(config.public.apiUrl + `/api/video/analysis`, "POST", {
        video_id: data.payload.id,
      });
    } catch (error) {
      console.warn(error);
    }
  } catch (e) {
    console.debug(e);
  } finally {
    setTimeout(() => {
      loader.hide();
    }, 500);
  }
};

const analysis = async (id) => {
  const data = await request(
    config.public.apiUrl + `/api/video/analysis`,
    "POST",
    {
      video_id: id,
    },
  );
  if (data.status_code >= 400) {
    useNuxtApp().$toast.error("Something went wrong", {
      autoClose: 2000,
    });
  } else {
    const payload = data.payload;
    useNuxtApp().$toast.success(
      payload.analysis_state === 1
        ? "Video is ready"
        : "Video is in analysis process",
      {
        autoClose: 2000,
      },
    );
    const index = videos.value.findIndex((item) => item.id === payload.id);
    if (index !== -1) {
      videos.value.splice(index, 1);
    }
    videos.value.splice(index, 0, payload);
  }
};

const getStatusLabel = (state) => {
  if (state === 1) return "Ready";
  if (state === 2) return "Processing";
  return "Pending";
};

const getStatusClass = (state) => {
  if (state === 1) return "status-ready";
  if (state === 2) return "status-processing";
  return "status-pending";
};
</script>

<template>
  <div>
    <!-- Analytics View -->
    <div v-if="activeFilter === 'analytics'" class="space-y-6">
      <h1 class="text-2xl font-semibold text-base-content">Analytics</h1>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="glass-card p-5">
          <p class="text-xs uppercase tracking-wider text-indigo-400/70 font-medium mb-1">Total Videos</p>
          <p class="text-3xl font-bold text-base-content">{{ stats.total }}</p>
        </div>
        <div class="glass-card p-5">
          <p class="text-xs uppercase tracking-wider text-green-400/70 font-medium mb-1">Analyzed</p>
          <p class="text-3xl font-bold text-green-400">{{ stats.analyzed }}</p>
        </div>
        <div class="glass-card p-5">
          <p class="text-xs uppercase tracking-wider text-yellow-400/70 font-medium mb-1">Processing</p>
          <p class="text-3xl font-bold text-yellow-400">{{ stats.processing }}</p>
        </div>
        <div class="glass-card p-5">
          <p class="text-xs uppercase tracking-wider text-violet-400/70 font-medium mb-1">Pending</p>
          <p class="text-3xl font-bold text-violet-400">{{ stats.pending }}</p>
        </div>
      </div>
    </div>

    <!-- Settings View -->
    <div v-else-if="activeFilter === 'settings'" class="space-y-6">
      <h1 class="text-2xl font-semibold text-base-content">Settings</h1>
      <div class="glass-card p-6 max-w-lg">
        <h2 class="text-lg font-medium text-base-content mb-4">Database</h2>
        <div class="flex items-center gap-3">
          <div class="w-3 h-3 rounded-full bg-green-500 shadow-lg shadow-green-500/30"></div>
          <span class="text-sm text-base-content/70">Connected to local backend</span>
        </div>
        <p class="text-xs text-base-content/40 mt-2">API: {{ config.public.apiUrl }}</p>
      </div>
    </div>

    <!-- Default: Dashboard / Library / etc. -->
    <div v-else class="space-y-6">
      <!-- Page Header -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 class="text-2xl font-semibold text-base-content capitalize">
            {{ activeFilter || 'Dashboard' }}
          </h1>
          <p class="text-sm text-base-content/40 mt-0.5">
            {{ total }} video{{ total !== 1 ? 's' : '' }} in your workspace
          </p>
        </div>

        <!-- Search -->
        <div class="relative w-full sm:w-80">
          <i class="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-base-content/30 text-sm"></i>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search videos..."
            class="input-premium w-full pl-10 pr-4 py-2.5 text-sm"
          />
        </div>
      </div>

      <!-- Featured Hero (first analyzed video) -->
      <div
        v-if="activeFilter === 'dashboard' && !searchQuery && videos.length > 0 && videos.find(v => v.analysis_state === 1)"
        class="glass-card p-0 overflow-hidden"
      >
        <div class="flex flex-col md:flex-row">
          <div class="md:w-2/5">
            <img
              :src="videos.find(v => v.analysis_state === 1).thumbnail"
              class="w-full h-48 md:h-full object-cover"
              alt="Featured video"
            />
          </div>
          <div class="p-6 md:w-3/5 flex flex-col justify-between">
            <div>
              <div class="flex items-center gap-2 mb-3">
                <span class="status-badge status-ready">
                  <i class="fa-solid fa-circle text-[6px]"></i> Ready
                </span>
                <span class="text-xs text-base-content/30">Featured</span>
              </div>
              <h2 class="text-xl font-semibold text-base-content mb-2">
                {{ shortenWord(videos.find(v => v.analysis_state === 1).title) }}
              </h2>
              <p class="text-sm text-base-content/50 line-clamp-2">
                {{ shortenWord(videos.find(v => v.analysis_state === 1).description) }}
              </p>
            </div>
            <div class="mt-4">
              <a
                :href="`/chat/${videos.find(v => v.analysis_state === 1).id}`"
                class="btn-glow inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm"
                target="_blank"
              >
                <i class="fa-solid fa-comments text-xs"></i>
                Chat Now
              </a>
            </div>
          </div>
        </div>
      </div>

      <!-- Video Grid -->
      <div
        class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
      >
        <div
          v-for="item in filteredVideos"
          :key="item.id"
          class="video-card"
        >
          <div class="thumbnail-wrap">
            <img :src="item.thumbnail" :alt="item.title" />
            <!-- Status overlay -->
            <div class="absolute top-3 left-3">
              <span :class="getStatusClass(item.analysis_state)" class="status-badge">
                <i class="fa-solid fa-circle text-[5px]"></i>
                {{ getStatusLabel(item.analysis_state) }}
              </span>
            </div>
          </div>

          <div class="p-4 flex flex-col flex-1">
            <h3
              :data-tip="item.title"
              class="text-sm font-semibold text-base-content mb-1 line-clamp-2 tooltip"
            >
              {{ shortenWord(item.title) }}
            </h3>
            <p
              :data-tip="item.description"
              class="text-xs text-base-content/40 line-clamp-2 mb-4 tooltip"
            >
              {{ shortenWord(item.description) }}
            </p>

            <div class="mt-auto flex justify-end gap-2">
              <a
                v-if="item.analysis_state === 1"
                :href="`/chat/${item.id}`"
                class="btn-glow px-4 py-2 rounded-lg text-xs flex items-center gap-1.5"
                target="_blank"
              >
                <i class="fa-solid fa-comments text-[10px]"></i>
                Chat
              </a>
              <button
                v-if="item.analysis_state === 0"
                class="px-4 py-2 rounded-lg text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 transition-colors"
                @click="analysis(item.id)"
              >
                Analyze
              </button>
              <button
                v-if="item.analysis_state === 2"
                class="px-4 py-2 rounded-lg text-xs font-medium bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 hover:bg-yellow-500/20 transition-colors"
                @click="analysis(item.id)"
              >
                <i class="fa-solid fa-arrows-rotate text-[10px] mr-1"></i>
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div
        v-if="filteredVideos.length === 0"
        class="glass-card py-16 flex flex-col items-center justify-center text-center"
      >
        <div class="w-16 h-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center mb-4">
          <i class="fa-solid fa-video text-2xl text-indigo-400/50"></i>
        </div>
        <h3 class="text-lg font-medium text-base-content/70 mb-1">No videos found</h3>
        <p class="text-sm text-base-content/40 mb-4">Add a YouTube video to get started</p>
        <button
          class="btn-glow px-5 py-2.5 rounded-xl text-sm flex items-center gap-2"
          @click="onOpenAddDialog"
        >
          <i class="fa-solid fa-plus text-xs"></i> Add Video
        </button>
      </div>

      <!-- Load More -->
      <div v-if="displayLoadMore" class="flex justify-center pt-4">
        <button
          class="px-6 py-2.5 rounded-xl text-sm font-medium text-base-content/50 bg-base-300/50 border border-indigo-500/10 hover:border-indigo-500/25 hover:text-base-content/70 transition-all"
          @click="loadMore"
        >
          Load More
        </button>
      </div>
    </div>

    <!-- Add Video Modal -->
    <Teleport to="body">
      <div
        v-if="showAddModal"
        class="fixed inset-0 z-50 flex items-center justify-center"
      >
        <!-- Backdrop -->
        <div
          class="absolute inset-0 bg-black/60 backdrop-blur-sm"
          @click="onCloseAddDialog"
        ></div>

        <!-- Modal -->
        <div class="modal-premium relative w-full max-w-md mx-4 p-6 z-10">
          <button
            class="absolute top-4 right-4 w-8 h-8 rounded-lg flex items-center justify-center text-base-content/40 hover:text-base-content/70 hover:bg-base-300/50 transition-colors"
            @click="onCloseAddDialog"
          >
            <i class="fa-solid fa-xmark"></i>
          </button>

          <div class="flex items-center gap-3 mb-6">
            <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <i class="fa-solid fa-plus text-white text-sm"></i>
            </div>
            <div>
              <h3 class="text-lg font-semibold text-base-content">Add New Video</h3>
              <p class="text-xs text-base-content/40">Paste a YouTube URL to begin analysis</p>
            </div>
          </div>

          <div class="space-y-4">
            <div>
              <label class="block text-xs font-medium text-base-content/50 mb-1.5">YouTube URL</label>
              <input
                v-model="url"
                :class="{ 'border-red-500/50': invalidUrl }"
                class="input-premium w-full px-4 py-2.5 text-sm"
                placeholder="https://youtube.com/watch?v=..."
              />
            </div>

            <div>
              <label class="block text-xs font-medium text-base-content/50 mb-1.5">Analysis Provider</label>
              <select
                v-model="provider"
                :class="{ 'border-red-500/50': invalidProvider }"
                class="select-premium w-full px-4 py-2.5 text-sm"
              >
                <option disabled selected>Analysis Provider</option>
                <option>local</option>
                <option>gemini</option>
                <option>voyageai</option>
                <option>openai</option>
                <option>mistral</option>
              </select>
            </div>

            <button
              class="btn-glow w-full py-2.5 rounded-xl text-sm mt-2"
              @click="process"
            >
              Process Now
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped></style>
