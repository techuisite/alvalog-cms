import { createApp } from 'vue';
import App from './App.vue';
import './style.css';
import { registerSW } from 'virtual:pwa-register';

// Auto-register service worker with instant update & reload
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    console.log('New version detected, activating immediately...');
    updateSW(true);
  },
  onOfflineReady() {
    console.log('Alvalog CMS is ready for offline work.');
  },
  onRegisteredSW(swUrl, registration) {
    if (registration) {
      // Check for updates every 30 seconds
      setInterval(() => {
        registration.update().catch(() => {});
      }, 30 * 1000);
    }
  }
});

// Provide a reliable cache-clear and update function accessible anywhere in the app
window.__clearCMSCacheAndReload = async () => {
  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) {
        await reg.unregister();
      }
    }
    if ('caches' in window) {
      const cacheKeys = await caches.keys();
      for (const key of cacheKeys) {
        await caches.delete(key);
      }
    }
  } catch (e) {
    console.warn('Cache clearing error:', e);
  }
  // Hard reload
  window.location.reload();
};

createApp(App).mount('#app');
