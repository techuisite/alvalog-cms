<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import HeaderNav from './components/HeaderNav.vue';
import { MilkdownProvider } from '@milkdown/vue';
import MarkdownEditor from './components/MarkdownEditor.vue';
import SourceEditor from './components/SourceEditor.vue';
import FrontmatterDrawer from './components/FrontmatterDrawer.vue';
import PostListModal from './components/PostListModal.vue';
import ImageUploadModal from './components/ImageUploadModal.vue';
import SettingsModal from './components/SettingsModal.vue';
import LockScreen from './components/LockScreen.vue';
import { isSessionUnlocked, lockSession, isSecuritySetup } from './services/auth.js';

import {
  getGithubConfig,
  fetchPostFilesList,
  fetchDraftFilesList,
  fetchPostContent,
  savePostToGithub,
  saveDraftToGithub,
  deleteDraftFromGithub,
  testConnection
} from './services/github.js';
import { parsePost, serializePost, slugify } from './utils/frontmatter.js';
import { useDrafts } from './composables/useDrafts.js';

// State
const editorRef = ref(null);
const sourceEditorRef = ref(null);
const subTitleRef = ref(null);
const isSourceMode = ref(false);
const isDark = ref(localStorage.getItem('alvalog_theme') !== 'light');
const isSaving = ref(false);
const isSavingDraft = ref(false);

function focusSubTitle() {
  subTitleRef.value?.focus();
}

function focusBodyEditor() {
  if (isSourceMode.value) {
    sourceEditorRef.value?.focus(true);
  } else {
    editorRef.value?.focus(true);
  }
}

function handleMainAreaClick(e) {
  if (e.target.classList.contains('main-writing-area')) {
    if (isSourceMode.value) {
      sourceEditorRef.value?.focus(false);
    } else {
      editorRef.value?.focus(false);
    }
  }
}

// Security & Lock State
const isUnlocked = ref(isSessionUnlocked());

function handleUnlocked() {
  isUnlocked.value = true;
  if (hasToken.value) {
    refreshPostsList();
  }
}

function handleLockApp() {
  lockSession();
  isUnlocked.value = false;
}

function handleSecurityUpdated() {
  isUnlocked.value = isSessionUnlocked();
}

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
const currentType = ref('new'); // 'new' | 'draft' | 'published'

const isDraft = computed(() => currentType.value === 'draft');
const isPublished = computed(() => currentType.value === 'published');

// Posts & Drafts Repository Cache
const publishedPosts = ref([]);
const draftPosts = ref([]);
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

function onSubTitleChange(e) {
  frontmatter.value.description = e.target.value;
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
    currentFilename: currentFilename.value,
    currentType: currentType.value
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
  currentType.value = 'new';
  isDirty.value = false;
  clearLocalDraft();

  editorRef.value?.setContent('');
  showPostsModal.value = false;
}

// ── Load Existing Post or Draft from GitHub ───────────────
async function loadPost(item, type = 'published') {
  if (isDirty.value) {
    if (!window.confirm('You have unsaved changes in the editor. Discard and load this document?')) {
      return;
    }
  }

  try {
    isLoadingPosts.value = true;
    const { sha, rawText, name } = await fetchPostContent(item.path);
    const parsed = parsePost(rawText);

    frontmatter.value = parsed.frontmatter;
    slug.value = name.replace(/\.md$/, '');
    markdownContent.value = parsed.content;
    currentSha.value = sha;
    currentFilename.value = name;
    currentType.value = type;
    isDirty.value = false;

    // Load content into editor
    editorRef.value?.setContent(parsed.content);
    showPostsModal.value = false;

    // Clear local draft of previous post
    clearLocalDraft();
  } catch (err) {
    alert(`Error loading document: ${err.message}`);
  } finally {
    isLoadingPosts.value = false;
  }
}

// ── Refresh Posts & Drafts Lists from GitHub ──────────────
async function refreshPostsList() {
  if (!hasToken.value) return;
  isLoadingPosts.value = true;

  try {
    const tagSet = new Set();

    // 1. Fetch published posts
    const postFiles = await fetchPostFilesList();
    const parsedPublished = await Promise.all(
      postFiles.map(async (file) => {
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

    parsedPublished.sort((a, b) => {
      const dateA = new Date(a.frontmatter?.pubDate || 0).getTime();
      const dateB = new Date(b.frontmatter?.pubDate || 0).getTime();
      return dateB - dateA;
    });

    publishedPosts.value = parsedPublished;

    // 2. Fetch drafts
    const draftFiles = await fetchDraftFilesList();
    const parsedDrafts = await Promise.all(
      draftFiles.map(async (file) => {
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
            frontmatter: { title: file.name, pubDate: '', updatedDate: '', tags: [] }
          };
        }
      })
    );

    parsedDrafts.sort((a, b) => {
      const dateA = new Date(a.frontmatter?.updatedDate || a.frontmatter?.pubDate || 0).getTime();
      const dateB = new Date(b.frontmatter?.updatedDate || b.frontmatter?.pubDate || 0).getTime();
      return dateB - dateA;
    });

    draftPosts.value = parsedDrafts;
    knownTags.value = Array.from(tagSet);
  } catch (err) {
    console.warn('Could not refresh posts/drafts:', err);
  } finally {
    isLoadingPosts.value = false;
  }
}

// ── Save Draft to GitHub (Does NOT trigger Astro build) ───
async function saveDraft() {
  if (!hasToken.value) {
    showSettingsModal.value = true;
    return;
  }

  const title = frontmatter.value.title.trim() || 'Untitled Draft';
  const postSlug = (slug.value.trim() || slugify(title)) || `draft-${Date.now()}`;
  const filename = `${postSlug}.md`;

  isSavingDraft.value = true;

  try {
    frontmatter.value.updatedDate = new Date().toISOString();
    const finalContent = serializePost(frontmatter.value, markdownContent.value);
    const commitMsg = isDraft.value
      ? `Update draft: ${title}`
      : `Save draft: ${title}`;

    const res = await saveDraftToGithub({
      filename,
      contentString: finalContent,
      sha: isDraft.value ? currentSha.value : null,
      commitMessage: commitMsg
    });

    currentSha.value = res.sha;
    currentFilename.value = filename;
    slug.value = postSlug;
    currentType.value = 'draft';
    isDirty.value = false;

    saveLocalDraft({
      frontmatter: frontmatter.value,
      slug: postSlug,
      markdown: markdownContent.value,
      currentSha: res.sha,
      currentFilename: filename,
      currentType: 'draft'
    });

    refreshPostsList();
    alert('☁️ Draft saved to Cloud!\n\nYour work is synced across your devices and will NOT be published to alvalog.net until you click Publish.');
  } catch (err) {
    alert(`Failed to save draft: ${err.message}`);
  } finally {
    isSavingDraft.value = false;
  }
}

// ── Delete Cloud Draft ─────────────────────────────────────
async function handleDeleteDraft(draftItem) {
  try {
    isLoadingPosts.value = true;
    await deleteDraftFromGithub({
      filename: draftItem.name,
      sha: draftItem.sha
    });

    // If current post was this deleted draft, reset editor
    if (currentFilename.value === draftItem.name && currentType.value === 'draft') {
      createNewPost(false);
    }

    await refreshPostsList();
  } catch (err) {
    alert(`Failed to delete draft: ${err.message}`);
  } finally {
    isLoadingPosts.value = false;
  }
}

// ── Publish Post to GitHub (Triggers live build on alvalog.net) ───
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

  const isPromotingFromDraft = currentType.value === 'draft';
  const confirmMsg = isPublished.value
    ? `Update published post "${title}" on alvalog.net?`
    : `Publish "${title}" live to alvalog.net?${isPromotingFromDraft ? '\n(This will promote your draft and publish it live).' : ''}`;

  if (!window.confirm(confirmMsg)) {
    return;
  }

  isSaving.value = true;

  try {
    const finalContent = serializePost(frontmatter.value, markdownContent.value);
    const commitMsg = isPublished.value
      ? `Update post: ${title}`
      : `Publish: ${title}`;

    const res = await savePostToGithub({
      filename,
      contentString: finalContent,
      sha: isPublished.value ? currentSha.value : null,
      commitMessage: commitMsg
    });

    // If it was a draft in src/content/drafts/, clean it up now
    if (isPromotingFromDraft && currentFilename.value && currentSha.value) {
      try {
        await deleteDraftFromGithub({
          filename: currentFilename.value,
          sha: currentSha.value,
          commitMessage: `Remove draft (promoted to published): ${title}`
        });
      } catch (draftErr) {
        console.warn('Could not clean up draft after publish:', draftErr);
      }
    }

    currentSha.value = res.sha;
    currentFilename.value = filename;
    slug.value = postSlug;
    currentType.value = 'published';
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
    if (currentType.value === 'published') {
      publishPost();
    } else {
      saveDraft();
    }
  }
  // Source mode shortcut: Ctrl+/ or Cmd+/ (MarkText standard!)
  if ((e.ctrlKey || e.metaKey) && e.key === '/') {
    e.preventDefault();
    isSourceMode.value = !isSourceMode.value;
  }
  // Lock CMS shortcut: Win+Shift+L (Windows) or Cmd+Shift+L (iPadOS/macOS)
  if (
    (e.metaKey || e.ctrlKey) && e.shiftKey && (e.key.toLowerCase() === 'l' || e.code === 'KeyL')
  ) {
    e.preventDefault();
    handleLockApp();
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
    currentType.value = draft.currentType || (currentSha.value ? 'published' : 'new');
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
  <!-- Lock Screen Gate -->
  <LockScreen
    v-if="!isUnlocked"
    @unlocked="handleUnlocked"
  />

  <div v-else class="app-layout">
    <!-- Top App Navigation -->
    <HeaderNav
      :postTitle="frontmatter.title"
      :isPublished="isPublished"
      :isDraft="isDraft"
      :isDirty="isDirty"
      :isSaving="isSaving"
      :isSavingDraft="isSavingDraft"
      :isSourceMode="isSourceMode"
      :isDark="isDark"
      :hasToken="hasToken"
      @togglePosts="showPostsModal = true"
      @toggleFrontmatter="showFrontmatterDrawer = true"
      @toggleSourceMode="isSourceMode = !isSourceMode"
      @toggleTheme="toggleTheme"
      @openSettings="showSettingsModal = true"
      @openImageUpload="showImageModal = true"
      @saveDraft="saveDraft"
      @publishPost="publishPost"
      @newPost="createNewPost"
      @lockApp="handleLockApp"
    />

    <!-- Main Content / Writing Canvas -->
    <main class="main-writing-area" @click="handleMainAreaClick">
      <!-- Document Header (H1 Title & H2 Subheader) -->
      <div class="document-header">
        <input
          type="text"
          class="post-main-title"
          :value="frontmatter.title"
          @input="onMainTitleChange"
          @keydown.enter.prevent="focusSubTitle"
          placeholder="Post Title..."
        />
        <input
          ref="subTitleRef"
          type="text"
          class="post-sub-title"
          :value="frontmatter.description || ''"
          @input="onSubTitleChange"
          @keydown.enter.prevent="focusBodyEditor"
          placeholder="Add a subheader or summary..."
        />
      </div>

      <!-- Editor Canvas: Visual (Milkdown) or Source (Raw Markdown) -->
      <SourceEditor
        v-if="isSourceMode"
        ref="sourceEditorRef"
        v-model="markdownContent"
        @update:modelValue="onContentUpdate"
      />
      <MilkdownProvider v-else>
        <MarkdownEditor
          ref="editorRef"
          :initialContent="markdownContent"
          @update="onContentUpdate"
        />
      </MilkdownProvider>
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
      :publishedPosts="publishedPosts"
      :draftPosts="draftPosts"
      :isLoading="isLoadingPosts"
      :currentFilename="currentFilename || ''"
      :currentType="currentType"
      @close="showPostsModal = false"
      @selectPost="loadPost"
      @deleteDraft="handleDeleteDraft"
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
      @securityUpdated="handleSecurityUpdated"
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
