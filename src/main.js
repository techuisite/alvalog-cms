import { createApp } from 'vue';
import App from './App.vue';
import './style.css';
import { registerSW } from 'virtual:pwa-register';

// Auto-register service worker for offline caching and PWA installation
registerSW({
  immediate: true,
  onNeedRefresh() {
    console.log('New content available, please refresh.');
  },
  onOfflineReady() {
    console.log('Alvalog CMS is ready for offline work.');
  },
});

createApp(App).mount('#app');
