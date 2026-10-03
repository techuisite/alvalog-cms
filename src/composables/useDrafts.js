import { ref, computed } from 'vue';

const DRAFT_KEY = 'alvalog_current_draft';

export function useDrafts() {
  const isDirty = ref(false);
  const lastSavedAt = ref(null);

  function saveLocalDraft(postData) {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({
        ...postData,
        savedAt: new Date().toISOString()
      }));
      lastSavedAt.value = new Date();
      isDirty.value = false;
    } catch (e) {
      console.warn('Failed to save local draft:', e);
    }
  }

  function getLocalDraft() {
    try {
      const data = localStorage.getItem(DRAFT_KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  function clearLocalDraft() {
    try {
      localStorage.removeItem(DRAFT_KEY);
      lastSavedAt.value = null;
      isDirty.value = false;
    } catch (e) {
      console.warn('Failed to clear local draft:', e);
    }
  }

  function calculateWordCount(text = '') {
    const clean = text.replace(/<[^>]+>/g, ' ').replace(/[#*_~`\[\]()]/g, '');
    const words = clean.trim().split(/\s+/).filter(Boolean);
    return words.length;
  }

  function calculateReadingTime(text = '') {
    const count = calculateWordCount(text);
    const minutes = Math.max(1, Math.round(count / 200));
    return `${minutes} min read`;
  }

  return {
    isDirty,
    lastSavedAt,
    saveLocalDraft,
    getLocalDraft,
    clearLocalDraft,
    calculateWordCount,
    calculateReadingTime
  };
}
