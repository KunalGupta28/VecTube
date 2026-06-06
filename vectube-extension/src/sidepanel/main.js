import { createApp } from 'vue';
import { createPinia } from 'pinia';
import SidePanelApp from './SidePanelApp.vue';
import '../styles/global.css';
import 'vue3-toastify/dist/index.css';

const app = createApp(SidePanelApp);
app.use(createPinia());
app.mount('#app');
