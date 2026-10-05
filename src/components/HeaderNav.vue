<script setup>
const props = defineProps({
  postTitle: { type: String, default: '' },
  isPublished: { type: Boolean, default: false },
  isDirty: { type: Boolean, default: false },
  isSaving: { type: Boolean, default: false },
  isSourceMode: { type: Boolean, default: false },
  isDark: { type: Boolean, default: true },
  hasToken: { type: Boolean, default: false },
});

const emit = defineEmits([
  'togglePosts',
  'toggleFrontmatter',
  'toggleSourceMode',
  'toggleTheme',
  'openSettings',
  'openImageUpload',
  'publishPost',
  'newPost',
  'lockApp'
]);
</script>

<template>
  <header class="app-header">
    <div class="header-left">
      <div class="brand" @click="emit('togglePosts')">
        <span class="brand-text">Alvalog<span class="brand-dot">.</span></span>
        <span class="cms-badge">CMS</span>
      </div>

      <button class="nav-btn" @click="emit('togglePosts')" title="Browse all posts">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="8" y1="6" x2="21" y2="6"></line>
          <line x1="8" y1="12" x2="21" y2="12"></line>
          <line x1="8" y1="18" x2="21" y2="18"></line>
          <line x1="3" y1="6" x2="3.01" y2="6"></line>
          <line x1="3" y1="12" x2="3.01" y2="12"></line>
          <line x1="3" y1="18" x2="3.01" y2="18"></line>
        </svg>
        <span class="hide-mobile">Posts</span>
      </button>

      <button class="nav-btn" @click="emit('newPost')" title="Create new post">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
        <span class="hide-mobile">New</span>
      </button>
    </div>

    <!-- Center: Post Title & Status -->
    <div class="header-center">
      <span class="current-post-title" :title="postTitle">
        {{ postTitle || 'Untitled Post' }}
      </span>
      <span
        class="status-pill"
        :class="{
          'status-published': isPublished && !isDirty,
          'status-modified': isPublished && isDirty,
          'status-draft': !isPublished
        }"
      >
        {{ isSaving ? 'Saving...' : isPublished ? (isDirty ? 'Modified' : 'Published') : 'Local Draft' }}
      </span>
    </div>

    <!-- Right: Tool buttons & Publish -->
    <div class="header-right">
      <!-- Frontmatter Drawer Toggle -->
      <button class="tool-btn" @click="emit('toggleFrontmatter')" title="Edit Post Frontmatter & Details">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
          <polyline points="10 9 9 9 8 9"></polyline>
        </svg>
        <span class="hide-tablet">Details</span>
      </button>

      <!-- Source / Visual mode toggle -->
      <button
        class="tool-btn"
        :class="{ active: isSourceMode }"
        @click="emit('toggleSourceMode')"
        :title="isSourceMode ? 'Switch to Visual WYSIWYG' : 'Switch to Raw Markdown Source'"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="16 18 22 12 16 6"></polyline>
          <polyline points="8 6 2 12 8 18"></polyline>
        </svg>
        <span class="hide-tablet">{{ isSourceMode ? 'Visual' : 'Source' }}</span>
      </button>

      <!-- Upload Image Button -->
      <button class="tool-btn" @click="emit('openImageUpload')" title="Upload image to blog">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <circle cx="8.5" cy="8.5" r="1.5"></circle>
          <polyline points="21 15 16 10 5 21"></polyline>
        </svg>
        <span class="hide-tablet">Image</span>
      </button>

      <!-- Theme Toggle -->
      <button class="icon-btn" @click="emit('toggleTheme')" :title="isDark ? 'Light Mode' : 'Dark Mode'">
        <svg v-if="isDark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="5"></circle>
          <line x1="12" y1="1" x2="12" y2="3"></line>
          <line x1="12" y1="21" x2="12" y2="23"></line>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
          <line x1="1" y1="12" x2="3" y2="12"></line>
          <line x1="21" y1="12" x2="23" y2="12"></line>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
        </svg>
        <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
        </svg>
      </button>

      <!-- Settings Button -->
      <button
        class="icon-btn"
        :class="{ 'needs-attention': !hasToken }"
        @click="emit('openSettings')"
        title="Settings"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
        </svg>
      </button>

      <!-- Lock App Button -->
      <button class="icon-btn" @click="emit('lockApp')" title="Lock App">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
        </svg>
      </button>

      <!-- Publish / Update Button -->
      <button
        class="publish-btn"
        :disabled="isSaving"
        @click="emit('publishPost')"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="22" y1="2" x2="11" y2="13"></line>
          <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
        </svg>
        <span>{{ isSaving ? 'Publishing...' : (isPublished ? 'Update' : 'Publish') }}</span>
      </button>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  --safe-top: env(safe-area-inset-top, 0px);
  min-height: calc(56px + var(--safe-top));
  padding-top: var(--safe-top);
  box-sizing: border-box;
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-left: max(1.25rem, env(safe-area-inset-left, 0px));
  padding-right: max(1.25rem, env(safe-area-inset-right, 0px));
  position: sticky;
  top: 0;
  z-index: 40;
  user-select: none;
}

@media all and (display-mode: standalone) {
  .app-header {
    --safe-top: max(32px, env(safe-area-inset-top, 0px));
  }
}

.header-left, .header-right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.brand {
  display: flex;
  align-items: baseline;
  gap: 0.35rem;
  cursor: pointer;
  margin-right: 0.5rem;
}

.brand-text {
  font-size: 1.15rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--text-heading);
}

.brand-dot {
  color: var(--accent);
}

.cms-badge {
  font-size: 0.65rem;
  font-weight: 700;
  color: var(--accent);
  background: rgba(59, 130, 246, 0.15);
  padding: 0.1rem 0.35rem;
  border-radius: 4px;
  letter-spacing: 0.05em;
}

.header-center {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  max-width: 40%;
}

.current-post-title {
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--text-heading);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.status-pill {
  font-size: 0.7rem;
  font-weight: 600;
  padding: 0.15rem 0.5rem;
  border-radius: 12px;
  white-space: nowrap;
}

.status-published {
  background: rgba(34, 197, 94, 0.15);
  color: #22c55e;
}

.status-modified {
  background: rgba(245, 158, 11, 0.15);
  color: #f59e0b;
}

.status-draft {
  background: rgba(148, 163, 184, 0.15);
  color: #94a3b8;
}

.nav-btn, .tool-btn {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  background: transparent;
  border: 1px solid transparent;
  color: var(--text-muted);
  padding: 0.35rem 0.65rem;
  border-radius: 6px;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.15s ease;
}

.nav-btn:hover, .tool-btn:hover {
  background: var(--chip-bg);
  color: var(--text-heading);
}

.tool-btn.active {
  background: var(--chip-bg);
  border-color: var(--accent);
  color: var(--accent);
}

.tool-btn svg, .nav-btn svg {
  width: 15px;
  height: 15px;
}

.icon-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.45rem;
  border-radius: 6px;
  position: relative;
}

.icon-btn:hover {
  background: var(--chip-bg);
  color: var(--text-heading);
}

.icon-btn svg {
  width: 18px;
  height: 18px;
}

.icon-btn.needs-attention:after {
  content: "";
  position: absolute;
  top: 4px;
  right: 4px;
  width: 7px;
  height: 7px;
  background: #f59e0b;
  border-radius: 50%;
}

.publish-btn {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  background: var(--accent);
  color: #fff;
  border: none;
  padding: 0.45rem 0.95rem;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s ease;
}

.publish-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.publish-btn svg {
  width: 14px;
  height: 14px;
}

@media (max-width: 768px) {
  .hide-tablet { display: none; }
  .header-center { max-width: 25%; }
}

@media (max-width: 580px) {
  .hide-mobile { display: none; }
  .header-center { display: none; }
}
</style>
