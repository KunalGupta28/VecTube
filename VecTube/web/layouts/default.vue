<script lang="js" setup>
const route = useRoute();
const sidebarOpen = ref(true);
const showAddModal = useState("showAddModal", () => false);
const activeFilter = useState("activeFilter", () => "dashboard");

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: "fa-solid fa-grid-2", path: "/" },
  { id: "library", label: "Library", icon: "fa-solid fa-play", path: "/" },
  { id: "recent", label: "Recent", icon: "fa-solid fa-clock-rotate-left", path: "/" },
  { id: "favorites", label: "Favorites", icon: "fa-solid fa-heart", path: "/" },
  { id: "collections", label: "Collections", icon: "fa-solid fa-folder", path: "/" },
  { id: "analytics", label: "Analytics", icon: "fa-solid fa-chart-simple", path: "/" },
  { id: "settings", label: "Settings", icon: "fa-solid fa-gear", path: "/" },
];

const setFilter = (item) => {
  activeFilter.value = item.id;
  if (route.fullPath !== item.path) {
    navigateTo(item.path);
  }
};

onMounted(() => {
  if (route.fullPath.startsWith("/chat/")) {
    activeFilter.value = null;
  }
});

watch(
  () => route.fullPath,
  (newPath) => {
    if (newPath.startsWith("/chat/")) {
      activeFilter.value = null;
    } else if (!activeFilter.value) {
      activeFilter.value = "dashboard";
    }
  },
);
</script>

<template>
  <div class="flex min-h-screen bg-mesh" data-theme="vectube">
    <!-- Sidebar -->
    <aside
      :class="sidebarOpen ? 'w-56' : 'w-16'"
      class="sidebar fixed top-0 left-0 h-screen z-30 flex flex-col transition-all duration-300 ease-in-out"
    >
      <!-- Brand -->
      <div class="flex items-center gap-3 px-4 h-16 border-b border-indigo-500/10">
        <nuxt-link to="/" class="flex items-center gap-2.5 no-underline" @click="activeFilter = 'dashboard'">
          <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <i class="fa-solid fa-play text-white text-xs"></i>
          </div>
          <span v-show="sidebarOpen" class="text-base-content font-semibold text-lg tracking-tight">VecTube</span>
        </nuxt-link>
      </div>

      <!-- Navigation -->
      <nav class="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div
          v-for="item in navItems"
          :key="item.id"
          :class="{ active: activeFilter === item.id }"
          class="sidebar-link"
          @click="setFilter(item)"
        >
          <i :class="item.icon" class="icon"></i>
          <span v-show="sidebarOpen">{{ item.label }}</span>
        </div>
      </nav>

      <!-- Add Video Button -->
      <div class="px-3 pb-4">
        <button
          class="btn-glow w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm"
          @click="showAddModal = true"
        >
          <i class="fa-solid fa-plus text-xs"></i>
          <span v-show="sidebarOpen">Add Video</span>
        </button>
      </div>

      <!-- Sidebar Toggle -->
      <div class="px-3 pb-4 border-t border-indigo-500/10 pt-3">
        <button
          class="sidebar-link w-full justify-center"
          @click="sidebarOpen = !sidebarOpen"
        >
          <i :class="sidebarOpen ? 'fa-solid fa-angles-left' : 'fa-solid fa-angles-right'" class="icon"></i>
          <span v-show="sidebarOpen">Collapse</span>
        </button>
      </div>
    </aside>

    <!-- Main Content -->
    <main
      :class="sidebarOpen ? 'ml-56' : 'ml-16'"
      class="flex-1 transition-all duration-300 ease-in-out"
    >
      <!-- Top Bar -->
      <header class="sticky top-0 z-20 h-16 flex items-center px-6 border-b border-indigo-500/8 bg-base-200/80 backdrop-blur-xl">
        <div class="flex-1"></div>
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-xs font-semibold text-white">
            V
          </div>
        </div>
      </header>

      <!-- Page Content -->
      <div class="px-6 py-6">
        <slot />
      </div>
    </main>
  </div>
</template>
