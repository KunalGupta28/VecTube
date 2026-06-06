import { createApp } from 'vue';
import { createPinia } from 'pinia';
import PopupApp from './PopupApp.vue';
import '../styles/global.css';
import 'vue3-toastify/dist/index.css';

const app = createApp(PopupApp);
app.use(createPinia());
app.mount('#app');
