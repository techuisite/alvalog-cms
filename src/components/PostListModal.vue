<script setup>
import { ref, computed, watch } from 'vue';

const props = defineProps({
  isOpen: { type: Boolean, default: false },
  publishedPosts: { type: Array, default: () => [] },
  draftPosts: { type: Array, default: () => [] },
  isLoading: { type: Boolean, default: false },
  currentFilename: { type: String, default: '' },
  currentType: { type: String, default: 'new' },
  draftsError: { type: String, default: '' }
});

const emit = defineEmits(['close', 'selectPost', 'deleteDraft', 'createNew', 'refreshPosts', 'openSettings']);

const activeTab = ref('published');
const searchQuery = ref('');

// Auto-select tab when modal opens
watch(() => props.isOpen, (open) => {
  if (open) {
    searchQuery.value = '';
    if (props.currentType === 'draft' || (props.draftPosts.length > 0 && props.publishedPosts.length === 0)) {
      activeTab.value = 'drafts';
    } else {
      activeTab.value = 'published';
    }
  }
});

const currentList = computed(() => {
  return activeTab.value === 'drafts' ? props.draftPosts : props.publishedPosts;
});

const filteredPosts = computed(() => {
  const list = currentList.value;
  if (!searchQuery.value.trim()) return list;
  const q = searchQuery.value.toLowerCase();
  return list.filter(p => {
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

function handleSelect(item) {
  emit('selectPost', item, activeTab.value === 'drafts' ? 'draft' : 'published');
}

function onDeleteDraft(item) {
  const title = item.frontmatter?.title || item.name;
  if (window.confirm(`Delete cloud draft "${title}"?\nThis cannot be undone.`)) {
    emit('deleteDraft', item);
  }
}
</script>

<template>
  <div v-if="isOpen" class="modal-backdrop" @click="emit('close')">
    <div class="modal-panel" @click.stop>
      <!-- Header -->
      <div class="modal-header">
        <div class="header-left">
          <h3>Your Posts & Drafts</h3>
        </div>
        <div class="header-actions">
          <button class="btn-secondary sm" :disabled="isLoading" @click="emit('refreshPosts')" title="Reload posts & drafts">
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

      <!-- Tab Switcher: Drafts vs Published -->
      <div class="tabs-bar">
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'drafts' }"
          @click="activeTab = 'drafts'"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
            <polyline points="17 21 17 13 7 13 7 21"></polyline>
            <polyline points="7 3 7 8 15 8"></polyline>
          </svg>
          <span>Cloud Drafts</span>
          <span class="tab-badge draft-badge">{{ draftPosts.length }}</span>
        </button>

        <button
          class="tab-btn"
          :class="{ active: activeTab === 'published' }"
          @click="activeTab = 'published'"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
          </svg>
          <span>Published</span>
          <span class="tab-badge published-badge">{{ publishedPosts.length }}</span>
        </button>
      </div>

      <!-- Search Input -->
      <div class="search-bar">
        <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input
          type="text"
          v-model="searchQuery"
          class="search-input"
          :placeholder="activeTab === 'drafts' ? 'Search cloud drafts...' : 'Search published posts...'"
        />
      </div>

      <!-- List Items -->
      <div class="post-list">
        <!-- Drafts Error Banner -->
        <div v-if="activeTab === 'drafts' && draftsError" class="drafts-error-banner">
          <div class="drafts-error-icon">⚠️</div>
          <div class="drafts-error-content">
            <div class="drafts-error-title">Cannot access private drafts repository</div>
            <div class="drafts-error-text">{{ draftsError }}</div>
            <button class="drafts-error-btn" @click="emit('openSettings')">Open GitHub Settings</button>
          </div>
        </div>

        <div v-if="isLoading" class="loading-state">
          <div class="spinner"></div>
          <p>Loading from GitHub...</p>
        </div>

        <div v-else-if="filteredPosts.length === 0" class="empty-state">
          <template v-if="activeTab === 'drafts'">
            <div class="empty-icon">📝</div>
            <p class="empty-title">No cloud drafts in progress</p>
            <p class="empty-hint">Drafts are stored securely in your private <code>techuisite/alvalog-drafts</code> repository.</p>
          </template>
          <template v-else>
            <p>No published posts found matching your search.</p>
          </template>
        </div>

        <div
          v-else
          v-for="post in filteredPosts"
          :key="post.name"
          class="post-item"
          :class="{ active: currentFilename === post.name }"
          @click="handleSelect(post)"
        >
          <div class="post-item-main">
            <div class="title-row">
              <span v-if="activeTab === 'drafts'" class="draft-pill-sm">Draft</span>
              <span v-if="currentFilename === post.name" class="active-pill-sm">Open Now</span>
              <h4 class="post-item-title">{{ post.frontmatter?.title || post.name }}</h4>
            </div>
            <div class="post-item-meta">
              <span class="meta-date">
                {{ formatDate(post.frontmatter?.updatedDate || post.frontmatter?.pubDate) }}
              </span>
              <span class="meta-dot">&bull;</span>
              <span class="meta-slug">{{ post.name }}</span>
            </div>
          </div>

          <div class="post-item-right">
            <div v-if="post.frontmatter?.tags?.length" class="post-item-tags hide-mobile">
              <span v-for="tag in post.frontmatter.tags.slice(0, 3)" :key="tag" class="small-tag">
                {{ tag }}
              </span>
            </div>

            <!-- Delete Draft button (Drafts tab only) -->
            <button
              v-if="activeTab === 'drafts'"
              class="delete-item-btn"
              @click.stop="onDeleteDraft(post)"
              title="Delete draft"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
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
  max-width: 620px;
  max-height: 82vh;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.4);
}

.modal-header {
  padding: 1rem 1.25rem;
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

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

/* Tabs Bar */
.tabs-bar {
  display: flex;
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border);
  padding: 0 1rem;
  gap: 0.5rem;
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 0.95rem;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--text-muted);
  font-size: 0.88rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.tab-btn:hover {
  color: var(--text-heading);
}

.tab-btn.active {
  color: var(--accent);
  border-bottom-color: var(--accent);
  font-weight: 600;
}

.tab-btn svg {
  width: 15px;
  height: 15px;
}

.tab-badge {
  font-size: 0.7rem;
  padding: 0.1rem 0.45rem;
  border-radius: 10px;
  background: var(--chip-bg);
  color: var(--text-muted);
}

.tab-btn.active .tab-badge.draft-badge {
  background: rgba(56, 189, 248, 0.2);
  color: #38bdf8;
}

.tab-btn.active .tab-badge.published-badge {
  background: rgba(34, 197, 94, 0.2);
  color: #22c55e;
}

.search-bar {
  padding: 0.75rem 1.25rem;
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
  font-size: 0.92rem;
}

.post-list {
  flex: 1;
  overflow-y: auto;
  padding: 0.75rem;
  min-height: 240px;
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
  margin-bottom: 0.25rem;
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
  gap: 0.25rem;
  min-width: 0;
  flex: 1;
}

.title-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.draft-pill-sm {
  font-size: 0.65rem;
  font-weight: 700;
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
  background: rgba(56, 189, 248, 0.15);
  color: #38bdf8;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.active-pill-sm {
  font-size: 0.65rem;
  font-weight: 700;
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
  background: rgba(34, 197, 94, 0.18);
  color: #22c55e;
  letter-spacing: 0.04em;
  text-transform: uppercase;
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
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.post-item-right {
  display: flex;
  align-items: center;
  gap: 0.4rem;
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

.delete-item-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  padding: 0.45rem;
  border-radius: 6px;
  cursor: pointer;
  opacity: 0.5;
  transition: all 0.15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.delete-item-btn:hover {
  opacity: 1;
  color: #ef4444;
  background: rgba(239, 68, 68, 0.12);
}

.delete-item-btn svg {
  width: 15px;
  height: 15px;
}

.loading-state, .empty-state {
  padding: 3rem 1.5rem;
  text-align: center;
  color: var(--text-muted);
}

.empty-icon {
  font-size: 2rem;
  margin-bottom: 0.5rem;
}

.empty-title {
  font-weight: 600;
  color: var(--text-heading);
  margin-bottom: 0.35rem;
}

.empty-hint {
  font-size: 0.85rem;
  line-height: 1.4;
  max-width: 360px;
  margin: 0 auto;
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

.btn-secondary {
  background: var(--chip-bg);
  border: 1px solid var(--border);
  color: var(--text-heading);
  cursor: pointer;
}

.btn-primary {
  background: var(--accent);
  border: none;
  color: #fff;
  font-weight: 600;
  cursor: pointer;
}

.btn-icon {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 0.35rem;
  border-radius: 6px;
}

.btn-icon:hover {
  background: var(--chip-bg);
  color: var(--text-heading);
}

.btn-icon svg {
  width: 18px;
  height: 18px;
}

.refresh-icon {
  width: 14px;
  height: 14px;
}

.drafts-error-banner {
  display: flex;
  gap: 0.75rem;
  background: rgba(245, 158, 11, 0.12);
  border: 1px solid rgba(245, 158, 11, 0.35);
  border-radius: 8px;
  padding: 0.85rem 1rem;
  margin-bottom: 0.85rem;
  color: #f59e0b;
}

.drafts-error-icon {
  font-size: 1.25rem;
  line-height: 1.2;
}

.drafts-error-content {
  flex: 1;
}

.drafts-error-title {
  font-weight: 600;
  font-size: 0.85rem;
  color: var(--text-heading);
}

.drafts-error-text {
  font-size: 0.78rem;
  color: var(--text-muted);
  margin-top: 0.25rem;
  line-height: 1.45;
}

.drafts-error-btn {
  margin-top: 0.6rem;
  padding: 0.35rem 0.75rem;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  color: var(--text-heading);
  border-radius: 6px;
  font-size: 0.78rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.drafts-error-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}

@media (max-width: 600px) {
  .hide-mobile {
    display: none;
  }
}
</style>
