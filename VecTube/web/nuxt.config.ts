// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2024-04-03",
  devtools: { enabled: true },
  modules: ["@nuxtjs/tailwindcss", "@nuxtjs/mdc", "@nuxt/eslint"],
  app: {
    pageTransition: { name: "slide-in", mode: "out-in" },
    head: {
      title: "VecTube — AI-Powered Video Intelligence",
      meta: [
        {
          name: "description",
          content:
            "Extract knowledge from YouTube videos with AI-powered analysis, summaries, and conversational Q&A.",
        },
      ],
      link: [
        {
          rel: "preconnect",
          href: "https://fonts.googleapis.com",
        },
        {
          rel: "preconnect",
          href: "https://fonts.gstatic.com",
          crossorigin: "",
        },
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap",
        },
      ],
      script: [
        {
          src: "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.6.0/js/all.min.js",
          defer: true,
        },
      ],
    },
  },
  css: ["vue-loading-overlay/dist/css/index.css", "assets/css/global.css"],
  mdc: {
    highlight: {
      theme: "material-theme-darker",
    },
    components: {
      prose: true,
      map: {
        h1: "h3",
        h2: "h4",
        h3: "strong",
        h4: "strong",
        h5: "strong",
        h6: "strong",
      },
    },
  },
  runtimeConfig: {
    public: {
      apiUrl: "http://localhost:8000",
    },
  },
});
