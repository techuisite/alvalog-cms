<script setup>
import { ref, computed } from 'vue';
import { slugify } from '../utils/frontmatter.js';

const props = defineProps({
  isOpen: { type: Boolean, default: false },
  frontmatter: { type: Object, required: true },
  slug: { type: String, default: '' },
  knownTags: { type: Array, default: () => [] }
});

const emit = defineEmits(['close', 'update:frontmatter', 'update:slug', 'openImageUploader']);

const newTagInput = ref('');
const isCustomSlug = ref(false);

function updateField(key, value) {
  emit('update:frontmatter', {
    ...props.frontmatter,
    [key]: value
  });
}

function handleTitleChange(e) {
  const val = e.target.value;
  updateField('title', val);
  if (!isCustomSlug.value && !props.slug) {
    emit('update:slug', slugify(val));
  }
}

function handleSlugChange(e) {
  isCustomSlug.value = true;
  emit('update:slug', slugify(e.target.value));
}

function setDateNow() {
  updateField('pubDate', new Date().toISOString());
}

function addTag() {
  const tag = newTagInput.value.trim().replace(/^#/, '');
  if (!tag) return;
  const currentTags = [...(props.frontmatter.tags || [])];
  if (!currentTags.includes(tag)) {
    currentTags.push(tag);
    updateField('tags', currentTags);
  }
  newTagInput.value = '';
}

function removeTag(tagToRemove) {
  const currentTags = (props.frontmatter.tags || []).filter(t => t !== tagToRemove);
  updateField('tags', currentTags);
}

function selectSuggestedTag(tag) {
  const currentTags = [...(props.frontmatter.tags || [])];
  if (!currentTags.includes(tag)) {
    currentTags.push(tag);
    updateField('tags', currentTags);
  }
}

// Format ISO date to local datetime-local value
const dateInputValue = computed(() => {
  if (!props.frontmatter.pubDate) return '';
  try {
    const d = new Date(props.frontmatter.pubDate);
    if (isNaN(d.getTime())) return '';
    // YYYY-MM-DDTHH:mm
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  } catch {
    return '';
  }
});

function handleDateInput(e) {
  try {
    const localVal = e.target.value;
    if (localVal) {
      updateField('pubDate', new Date(localVal).toISOString());
    }
  } catch (err) {
    console.warn('Date parsing error', err);
  }
}
</script>

<template>
  <div v-if="isOpen" class="drawer-backdrop" @click="emit('close')">
    <div class="drawer-panel" @click.stop>
      <div class="drawer-header">
        <div class="drawer-title">
          <svg class="drawer-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10 9 9 9 8 9"></polyline>
          </svg>
          <h3>Post Details & Frontmatter</h3>
        </div>
        <button class="btn-icon" @click="emit('close')" title="Close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <div class="drawer-content">
        <!-- Title -->
        <div class="form-group">
          <label class="form-label">Post Title</label>
          <input
            type="text"
            class="form-input"
            :value="frontmatter.title"
            @input="handleTitleChange"
            placeholder="e.g. The iPhone Air"
          />
        </div>

        <!-- Slug (URL filename) -->
        <div class="form-group">
          <label class="form-label">
            <span>URL Slug</span>
            <span class="form-hint">Filename: {{ slug ? `${slug}.md` : 'untitled.md' }}</span>
          </label>
          <div class="input-with-prefix">
            <span class="input-prefix">/posts/</span>
            <input
              type="text"
              class="form-input prefixed"
              :value="slug"
              @input="handleSlugChange"
              placeholder="my-post-slug"
            />
          </div>
        </div>

        <!-- Publish Date -->
        <div class="form-group">
          <div class="label-row">
            <label class="form-label">Publish Date & Time</label>
            <button type="button" class="btn-text" @click="setDateNow">Set to Now</button>
          </div>
          <input
            type="datetime-local"
            class="form-input"
            :value="dateInputValue"
            @input="handleDateInput"
          />
        </div>

        <!-- Description / Excerpt -->
        <div class="form-group">
          <label class="form-label">Description (Excerpt for index page & SEO)</label>
          <textarea
            class="form-textarea"
            rows="3"
            :value="frontmatter.description || ''"
            @input="updateField('description', $event.target.value)"
            placeholder="Short teaser or overview of your post..."
          ></textarea>
        </div>

        <!-- Tags -->
        <div class="form-group">
          <label class="form-label">Tags</label>
          <div class="tag-input-row">
            <input
              type="text"
              class="form-input"
              v-model="newTagInput"
              @keydown.enter.prevent="addTag"
              placeholder="Add tag and press Enter"
            />
            <button type="button" class="btn-secondary" @click="addTag">Add</button>
          </div>

          <!-- Active tags -->
          <div v-if="frontmatter.tags && frontmatter.tags.length" class="tag-chips">
            <span v-for="tag in frontmatter.tags" :key="tag" class="tag-chip">
              #{{ tag }}
              <button type="button" class="chip-remove" @click="removeTag(tag)">&times;</button>
            </span>
          </div>

          <!-- Suggested tags from blog -->
          <div v-if="knownTags && knownTags.length" class="suggested-tags">
            <span class="suggest-label">Suggestions:</span>
            <button
              v-for="sTag in knownTags.slice(0, 10)"
              :key="sTag"
              type="button"
              class="suggest-chip"
              :class="{ active: frontmatter.tags?.includes(sTag) }"
              @click="selectSuggestedTag(sTag)"
            >
              +{{ sTag }}
            </button>
          </div>
        </div>

        <!-- Hero Image -->
        <div class="form-group">
          <div class="label-row">
            <label class="form-label">Hero / Cover Image</label>
            <button type="button" class="btn-text" @click="emit('openImageUploader')">
              📷 Upload Image
            </button>
          </div>
          <input
            type="text"
            class="form-input"
            :value="frontmatter.heroImage || ''"
            @input="updateField('heroImage', $event.target.value)"
            placeholder="/content/images/2026/10/example.jpg"
          />

          <!-- Preview image if present -->
          <div v-if="frontmatter.heroImage" class="hero-preview">
            <img
              :src="frontmatter.heroImage.startsWith('http') ? frontmatter.heroImage : `https://alvalog.net${frontmatter.heroImage}`"
              alt="Hero Preview"
              @error="$event.target.style.display='none'"
            />
          </div>
        </div>

        <!-- Featured Switch -->
        <div class="form-group toggle-group">
          <div>
            <label class="form-label mb-0">Feature this post</label>
            <div class="form-hint">Display prominently at the top of your homepage</div>
          </div>
          <label class="switch">
            <input
              type="checkbox"
              :checked="frontmatter.featured === true"
              @change="updateField('featured', $event.target.checked)"
            />
            <span class="slider"></span>
          </label>
        </div>
      </div>

      <div class="drawer-footer">
        <button class="btn-primary w-full" @click="emit('close')">
          Done
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.drawer-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  z-index: 50;
  display: flex;
  justify-content: flex-end;
}

.drawer-panel {
  width: 100%;
  max-width: 440px;
  height: 100%;
  background: var(--bg-surface);
  border-left: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.3);
  animation: slideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes slideIn {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}

.drawer-header {
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.drawer-title {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.drawer-icon {
  width: 20px;
  height: 20px;
  color: var(--accent);
}

.drawer-title h3 {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text-heading);
  margin: 0;
}

.drawer-content {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.drawer-footer {
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--border);
  background: var(--bg-surface);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.form-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-heading);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.form-hint {
  font-size: 0.75rem;
  color: var(--text-muted);
  font-weight: normal;
}

.form-input, .form-textarea {
  width: 100%;
  padding: 0.65rem 0.85rem;
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text-main);
  font-size: 0.95rem;
  outline: none;
  transition: border-color 0.15s ease;
}

.form-input:focus, .form-textarea:focus {
  border-color: var(--accent);
}

.input-with-prefix {
  display: flex;
  align-items: center;
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
}

.input-prefix {
  padding: 0.65rem 0 0.65rem 0.85rem;
  color: var(--text-muted);
  font-size: 0.85rem;
  font-family: 'JetBrains Mono', monospace;
  user-select: none;
}

.form-input.prefixed {
  border: none;
  background: transparent;
  padding-left: 0.25rem;
}

.tag-input-row {
  display: flex;
  gap: 0.5rem;
}

.tag-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-top: 0.4rem;
}

.tag-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  background: var(--chip-bg);
  color: var(--text-main);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 0.25rem 0.6rem;
  font-size: 0.8rem;
  font-weight: 500;
}

.chip-remove {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 0;
  font-size: 1rem;
  line-height: 1;
}

.chip-remove:hover {
  color: #ef4444;
}

.suggested-tags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem;
  margin-top: 0.5rem;
}

.suggest-label {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.suggest-chip {
  background: transparent;
  border: 1px dashed var(--border);
  color: var(--text-muted);
  border-radius: 4px;
  padding: 0.15rem 0.45rem;
  font-size: 0.75rem;
  cursor: pointer;
}

.suggest-chip:hover, .suggest-chip.active {
  border-color: var(--accent);
  color: var(--accent);
}

.hero-preview {
  margin-top: 0.5rem;
  border-radius: 8px;
  overflow: hidden;
  max-height: 140px;
  border: 1px solid var(--border);
  background: #000;
}

.hero-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.toggle-group {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 0;
}

.mb-0 { margin-bottom: 0; }

.switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  inset: 0;
  background-color: var(--border);
  transition: 0.2s;
  border-radius: 24px;
}

.slider:before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: 0.2s;
  border-radius: 50%;
}

input:checked + .slider {
  background-color: var(--accent);
}

input:checked + .slider:before {
  transform: translateX(20px);
}

.btn-text {
  background: none;
  border: none;
  color: var(--accent);
  font-size: 0.8rem;
  cursor: pointer;
  padding: 0;
}

.btn-secondary {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  color: var(--text-main);
  border-radius: 8px;
  padding: 0.5rem 1rem;
  font-size: 0.85rem;
  cursor: pointer;
}

.btn-primary {
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 0.75rem 1rem;
  font-weight: 600;
  font-size: 0.95rem;
  cursor: pointer;
}

.btn-icon {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.4rem;
  border-radius: 6px;
}

.btn-icon svg {
  width: 18px;
  height: 18px;
}

.w-full { width: 100%; }
</style>
