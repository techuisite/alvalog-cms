<script setup>
import { ref, computed } from 'vue';

const props = defineProps({
  isOpen: { type: Boolean, default: false },
  posts: { type: Array, default: () => [] },
  isLoading: { type: Boolean, default: false },
  currentFilename: { type: String, default: '' }
});

const emit = defineEmits(['close', 'selectPost', 'createNew', 'refreshPosts']);
const searchQuery = ref('');

const filteredPosts = computed(() => {
  if (!searchQuery.value.trim()) return props.posts;
  const q = searchQuery.value.toLowerCase();
  return props.posts.filter(p => {
    const titleMatch = (p.frontmatter?.title || '').toLowerCase().includes(q);
    const slugMatch = (p.name || '').toLowerCase().includes(q);
    const tagMatch = (p.frontmatter?.tags || []).some(t => t.toLowerCase().includes(q));
    return titleMatch || slugMatch || tagMatch;
  });
});

function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}
</script>

<template>
  <div v-if="isOpen" class="modal-backdrop" @click="emit('close')">
    <div class="modal-panel" @click.stop>
      <div class="modal-header">
        <div class="header-left">
          <h3>Your Blog Posts</h3>
          <span class="count-badge">{{ posts.length }}</span>
        </div>
        <div class="header-actions">
          <button class="btn-secondary sm" :disabled="isLoading" @click="emit('refreshPosts')" title="Reload posts">
            <svg class="refresh-icon" :class="{ spinning: isLoading }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="23 4 23 10 17 10"></polyline>
              <polyline points="1 20 1 14 7 14"></polyline>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
            </svg>
            Sync
          </button>
          <button class="btn-primary sm" @click="emit('createNew')">
            + New Post
          </button>
          <button class="btn-icon" @click="emit('close')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>

      <div class="search-bar">
        <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input
          type="text"
          v-model="searchQuery"
          class="search-input"
          placeholder="Search by title, tag, or filename..."
        />
      </div>

      <div class="post-list">
        <div v-if="isLoading" class="loading-state">
          <div class="spinner"></div>
          <p>Loading posts from GitHub...</p>
        </div>

        <div v-else-if="filteredPosts.length === 0" class="empty-state">
          <p>No posts found matching your search.</p>
        </div>

        <div
          v-else
          v-for="post in filteredPosts"
          :key="post.name"
          class="post-item"
          :class="{ active: currentFilename === post.name }"
          @click="emit('selectPost', post)"
        >
          <div class="post-item-main">
            <h4 class="post-item-title">{{ post.frontmatter?.title || post.name }}</h4>
            <div class="post-item-meta">
              <span class="meta-date">{{ formatDate(post.frontmatter?.pubDate) }}</span>
              <span class="meta-dot">&bull;</span>
              <span class="meta-slug">{{ post.name }}</span>
            </div>
          </div>
          <div v-if="post.frontmatter?.tags?.length" class="post-item-tags">
            <span v-for="tag in post.frontmatter.tags.slice(0, 3)" :key="tag" class="small-tag">
              {{ tag }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(4px);
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.modal-panel {
  width: 100%;
  max-width: 600px;
  max-height: 80vh;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.4);
}

.modal-header {
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.header-left h3 {
  font-size: 1.15rem;
  font-weight: 600;
  margin: 0;
  color: var(--text-heading);
}

.count-badge {
  background: var(--chip-bg);
  border: 1px solid var(--border);
  color: var(--text-muted);
  font-size: 0.75rem;
  padding: 0.15rem 0.5rem;
  border-radius: 12px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.search-bar {
  padding: 0.75rem 1.5rem;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  gap: 0.6rem;
  background: var(--bg-input);
}

.search-icon {
  width: 16px;
  height: 16px;
  color: var(--text-muted);
}

.search-input {
  width: 100%;
  border: none;
  background: transparent;
  color: var(--text-main);
  outline: none;
  font-size: 0.95rem;
}

.post-list {
  flex: 1;
  overflow-y: auto;
  padding: 0.75rem;
}

.post-item {
  padding: 0.85rem 1rem;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  transition: background 0.15s ease;
  border: 1px solid transparent;
}

.post-item:hover {
  background: var(--chip-bg);
}

.post-item.active {
  background: var(--chip-bg);
  border-color: var(--accent);
}

.post-item-main {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 0;
}

.post-item-title {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text-heading);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.post-item-meta {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.75rem;
  color: var(--text-muted);
}

.meta-slug {
  font-family: 'JetBrains Mono', monospace;
}

.post-item-tags {
  display: flex;
  gap: 0.3rem;
  margin-left: 0.5rem;
}

.small-tag {
  font-size: 0.7rem;
  background: var(--border);
  color: var(--text-muted);
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
  white-space: nowrap;
}

.loading-state, .empty-state {
  padding: 3rem 1.5rem;
  text-align: center;
  color: var(--text-muted);
}

.spinner {
  width: 28px;
  height: 28px;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 0.75rem auto;
}

.refresh-icon.spinning {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.btn-secondary.sm, .btn-primary.sm {
  padding: 0.4rem 0.75rem;
  font-size: 0.85rem;
  border-radius: 6px;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.refresh-icon {
  width: 14px;
  height: 14px;
}
</style>
