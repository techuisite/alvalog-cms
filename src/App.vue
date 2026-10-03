<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import HeaderNav from './components/HeaderNav.vue';
import MarkdownEditor from './components/MarkdownEditor.vue';
import SourceEditor from './components/SourceEditor.vue';
import FrontmatterDrawer from './components/FrontmatterDrawer.vue';
import PostListModal from './components/PostListModal.vue';
import ImageUploadModal from './components/ImageUploadModal.vue';
import SettingsModal from './components/SettingsModal.vue';

import {
  getGithubConfig,
  fetchPostFilesList,
  fetchPostContent,
  savePostToGithub,
  testConnection
} from './services/github.js';
import { parsePost, serializePost, slugify } from './utils/frontmatter.js';
import { useDrafts } from './composables/useDrafts.js';

// State
const editorRef = ref(null);
const isSourceMode = ref(false);
const isDark = ref(localStorage.getItem('alvalog_theme') !== 'light');
const isSaving = ref(false);

// Modals & Drawers
const showFrontmatterDrawer = ref(false);
const showPostsModal = ref(false);
const showImageModal = ref(false);
const showSettingsModal = ref(false);

// Drafts & Metrics
const { isDirty, lastSavedAt, saveLocalDraft, getLocalDraft, clearLocalDraft, calculateWordCount, calculateReadingTime } = useDrafts();

// Current Document
const frontmatter = ref({
  title: '',
  description: '',
  pubDate: new Date().toISOString(),
  updatedDate: '',
  heroImage: '',
  tags: [],
  featured: false
});
const slug = ref('');
const markdownContent = ref('');
const currentSha = ref(null);
const currentFilename = ref(null);
const isPublished = computed(() => !!currentSha.value);

// Posts Repository Cache
const posts = ref([]);
const isLoadingPosts = ref(false);
const knownTags = ref([]);
const githubConfig = ref(getGithubConfig());
const hasToken = computed(() => !!githubConfig.value.token);

// Synchronize Title & Slug
function onMainTitleChange(e) {
  const val = e.target.value;
  frontmatter.value.title = val;
  if (!currentSha.value && (!slug.value || slug.value === slugify(frontmatter.value.title.slice(0, -1)))) {
    slug.value = slugify(val);
  }
  markAsDirty();
}

function onContentUpdate(newMarkdown) {
  markdownContent.value = newMarkdown;
  markAsDirty();
}

function markAsDirty() {
  isDirty.value = true;
  saveLocalDraft({
    frontmatter: frontmatter.value,
    slug: slug.value,
    markdown: markdownContent.value,
    currentSha: currentSha.value,
    currentFilename: currentFilename.value
  });
}

// ── New Post ───────────────────────────────────────────────
function createNewPost(confirmIfDirty = true) {
  if (confirmIfDirty && isDirty.value) {
    if (!window.confirm('You have unsaved changes. Discard and start a new post?')) {
      return;
    }
  }

  frontmatter.value = {
    title: '',
    description: '',
    pubDate: new Date().toISOString(),
    updatedDate: '',
    heroImage: '',
    tags: [],
    featured: false
  };
  slug.value = '';
  markdownContent.value = '';
  currentSha.value = null;
  currentFilename.value = null;
  isDirty.value = false;
  clearLocalDraft();

  editorRef.value?.setContent('');
  showPostsModal.value = false;
}

// ── Load Existing Post from GitHub ────────────────────────
async function loadPost(postItem) {
  try {
    isLoadingPosts.value = true;
    const { sha, rawText, name } = await fetchPostContent(postItem.path);
    const parsed = parsePost(rawText);

    frontmatter.value = parsed.frontmatter;
    slug.value = name.replace(/\.md$/, '');
    markdownContent.value = parsed.content;
    currentSha.value = sha;
    currentFilename.value = name;
    isDirty.value = false;

    // Load content into editor
    editorRef.value?.setContent(parsed.content);
    showPostsModal.value = false;

    // Clear draft of previous post
    clearLocalDraft();
  } catch (err) {
    alert(`Error loading post: ${err.message}`);
  } finally {
    isLoadingPosts.value = false;
  }
}

// ── Refresh Posts List ─────────────────────────────────────
async function refreshPostsList() {
  if (!hasToken.value) return;
  isLoadingPosts.value = true;

  try {
    const files = await fetchPostFilesList();
    const tagSet = new Set();

    // Fetch and parse each post's metadata
    const parsedPosts = await Promise.all(
      files.map(async (file) => {
        try {
          const contentData = await fetchPostContent(file.path);
          const parsed = parsePost(contentData.rawText);
          (parsed.frontmatter.tags || []).forEach(t => tagSet.add(t));
          return {
            ...file,
            frontmatter: parsed.frontmatter,
            sha: contentData.sha
          };
        } catch {
          return {
            ...file,
            frontmatter: { title: file.name, pubDate: '', tags: [] }
          };
        }
      })
    );

    // Sort by publication date descending
    parsedPosts.sort((a, b) => {
      const dateA = new Date(a.frontmatter?.pubDate || 0).getTime();
      const dateB = new Date(b.frontmatter?.pubDate || 0).getTime();
      return dateB - dateA;
    });

    posts.value = parsedPosts;
    knownTags.value = Array.from(tagSet);
  } catch (err) {
    console.warn('Could not refresh posts:', err);
  } finally {
    isLoadingPosts.value = false;
  }
}

// ── Publish / Save Post to GitHub ─────────────────────────
async function publishPost() {
  if (!hasToken.value) {
    showSettingsModal.value = true;
    return;
  }

  const title = frontmatter.value.title.trim();
  if (!title) {
    alert('Please enter a post title before publishing.');
    return;
  }

  const postSlug = (slug.value.trim() || slugify(title)) || 'untitled';
  const filename = `${postSlug}.md`;

  isSaving.value = true;

  try {
    // If it's a published post and filename changed, warn or use new
    const finalContent = serializePost(frontmatter.value, markdownContent.value);
    const commitMsg = currentSha.value
      ? `Update post: ${title}`
      : `Publish: ${title}`;

    const res = await savePostToGithub({
      filename,
      contentString: finalContent,
      sha: currentSha.value,
      commitMessage: commitMsg
    });

    currentSha.value = res.sha;
    currentFilename.value = filename;
    slug.value = postSlug;
    isDirty.value = false;
    clearLocalDraft();

    alert(`🎉 Successfully published to GitHub!\nGitHub Actions will deploy your post live to alvalog.net.`);
    refreshPostsList();
  } catch (err) {
    alert(`Failed to publish: ${err.message}`);
  } finally {
    isSaving.value = false;
  }
}

// ── Image Handling ─────────────────────────────────────────
function onInsertImage(markdownTag) {
  markdownContent.value += markdownTag;
  if (!isSourceMode.value) {
    editorRef.value?.setContent(markdownContent.value);
  }
  markAsDirty();
}

function onSetHeroImage(imageUrl) {
  frontmatter.value.heroImage = imageUrl;
  markAsDirty();
}

// ── Dark / Light Theme ─────────────────────────────────────
function toggleTheme() {
  isDark.value = !isDark.value;
  localStorage.setItem('alvalog_theme', isDark.value ? 'dark' : 'light');
  document.body.className = isDark.value ? 'dark' : 'light';
}

function onConfigSaved() {
  githubConfig.value = getGithubConfig();
  refreshPostsList();
}

// ── Keyboard Shortcuts ────────────────────────────────────
function handleGlobalKeydown(e) {
  // Save shortcut: Ctrl+S or Cmd+S
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
    e.preventDefault();
    publishPost();
  }
  // Source mode shortcut: Ctrl+/ or Cmd+/ (MarkText standard!)
  if ((e.ctrlKey || e.metaKey) && e.key === '/') {
    e.preventDefault();
    isSourceMode.value = !isSourceMode.value;
  }
}

onMounted(() => {
  document.body.className = isDark.value ? 'dark' : 'light';
  window.addEventListener('keydown', handleGlobalKeydown);

  // Restore local draft if exists
  const draft = getLocalDraft();
  if (draft && draft.markdown) {
    frontmatter.value = draft.frontmatter || frontmatter.value;
    slug.value = draft.slug || '';
    markdownContent.value = draft.markdown;
    currentSha.value = draft.currentSha || null;
    currentFilename.value = draft.currentFilename || null;
    isDirty.value = true;
  }

  // Load posts if token is present
  if (hasToken.value) {
    refreshPostsList();
  } else {
    // Open settings on first launch to guide user
    showSettingsModal.value = true;
  }
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleGlobalKeydown);
});

// Sync changes between Visual & Source mode
watch(isSourceMode, (newVal) => {
  if (!newVal) {
    // Returning to Visual mode: update Milkdown
    setTimeout(() => {
      editorRef.value?.setContent(markdownContent.value);
    }, 50);
  }
});
</script>

<template>
  <div class="app-layout">
    <!-- Top App Navigation -->
    <HeaderNav
      :postTitle="frontmatter.title"
      :isPublished="isPublished"
      :isDirty="isDirty"
      :isSaving="isSaving"
      :isSourceMode="isSourceMode"
      :isDark="isDark"
      :hasToken="hasToken"
      @togglePosts="showPostsModal = true"
      @toggleFrontmatter="showFrontmatterDrawer = true"
      @toggleSourceMode="isSourceMode = !isSourceMode"
      @toggleTheme="toggleTheme"
      @openSettings="showSettingsModal = true"
      @openImageUpload="showImageModal = true"
      @publishPost="publishPost"
      @newPost="createNewPost"
    />

    <!-- Main Content / Writing Canvas -->
    <main class="main-writing-area">
      <!-- Title Input (styled directly as document H1) -->
      <input
        type="text"
        class="post-main-title"
        :value="frontmatter.title"
        @input="onMainTitleChange"
        placeholder="Post Title..."
      />

      <!-- Quick Meta Strip -->
      <div class="post-meta-strip">
        <span class="meta-item" @click="showFrontmatterDrawer = true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
          {{ new Date(frontmatter.pubDate || Date.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }}
        </span>

        <span class="meta-dot">&bull;</span>

        <span class="meta-item" @click="showFrontmatterDrawer = true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
            <line x1="7" y1="7" x2="7.01" y2="7"></line>
          </svg>
          {{ frontmatter.tags?.length ? frontmatter.tags.join(', ') : 'Add tags' }}
        </span>

        <span class="meta-dot">&bull;</span>

        <span class="meta-item" @click="showFrontmatterDrawer = true">
          {{ calculateReadingTime(markdownContent) }}
        </span>

        <span v-if="frontmatter.heroImage" class="meta-dot">&bull;</span>
        <span v-if="frontmatter.heroImage" class="meta-item" @click="showFrontmatterDrawer = true">
          📷 Cover image set
        </span>
      </div>

      <!-- Editor Canvas: Visual (Milkdown) or Source (Raw Markdown) -->
      <SourceEditor
        v-if="isSourceMode"
        v-model="markdownContent"
        @update:modelValue="onContentUpdate"
      />
      <MarkdownEditor
        v-else
        ref="editorRef"
        :initialContent="markdownContent"
        @update="onContentUpdate"
      />
    </main>

    <!-- Bottom Status Bar -->
    <footer class="bottom-status-bar">
      <div class="status-left">
        <span>Words: {{ calculateWordCount(markdownContent) }}</span>
        <span>{{ calculateReadingTime(markdownContent) }}</span>
        <span v-if="slug" class="hide-mobile">Slug: /posts/{{ slug }}</span>
      </div>
      <div class="status-right">
        <span>{{ isSourceMode ? 'Markdown Source Mode' : 'WYSIWYG Mode' }}</span>
        <span class="hide-mobile">Ctrl+/ to switch</span>
      </div>
    </footer>

    <!-- Drawers & Modals -->
    <FrontmatterDrawer
      :isOpen="showFrontmatterDrawer"
      :frontmatter="frontmatter"
      :slug="slug"
      :knownTags="knownTags"
      @close="showFrontmatterDrawer = false"
      @update:frontmatter="frontmatter = $event; markAsDirty()"
      @update:slug="slug = $event; markAsDirty()"
      @openImageUploader="showImageModal = true"
    />

    <PostListModal
      :isOpen="showPostsModal"
      :posts="posts"
      :isLoading="isLoadingPosts"
      :currentFilename="currentFilename || ''"
      @close="showPostsModal = false"
      @selectPost="loadPost"
      @createNew="createNewPost"
      @refreshPosts="refreshPostsList"
    />

    <ImageUploadModal
      :isOpen="showImageModal"
      @close="showImageModal = false"
      @insertImage="onInsertImage"
      @setHeroImage="onSetHeroImage"
    />

    <SettingsModal
      :isOpen="showSettingsModal"
      @close="showSettingsModal = false"
      @configSaved="onConfigSaved"
    />
  </div>
</template>

<style scoped>
@media (max-width: 600px) {
  .hide-mobile {
    display: none;
  }
  .post-main-title {
    font-size: 1.85rem;
  }
}
</style>
