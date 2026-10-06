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
  nextTick(() => {
    if (markdownContent.value) {
      editorRef.value?.setContent(markdownContent.value);
    }
  });
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

// Header Visibility State (Focus Canvas Mode)
const isHeaderHidden = ref(localStorage.getItem('alvalog_header_hidden') === 'true');

function toggleHeader() {
  isHeaderHidden.value = !isHeaderHidden.value;
  try {
    localStorage.setItem('alvalog_header_hidden', isHeaderHidden.value ? 'true' : 'false');
  } catch (e) {}
}

// Modals & Drawers
const showFrontmatterDrawer = ref(false);
const showPostsModal = ref(false);
const showImageModal = ref(false);
const showSettingsModal = ref(false);

// Drafts & Metrics
const { isDirty, lastSavedAt, saveLocalDraft, getLocalDraft, clearLocalDraft, calculateWordCount, calculateReadingTime } = useDrafts();

// Synchronously restore saved local draft immediately on startup
const initialDraft = getLocalDraft();
const frontmatter = ref(initialDraft?.frontmatter || {
  title: '',
  description: '',
  pubDate: new Date().toISOString(),
  updatedDate: '',
  heroImage: '',
  tags: [],
  featured: false
});
const slug = ref(initialDraft?.slug || '');
const markdownContent = ref(initialDraft?.markdown || '');
const currentSha = ref(initialDraft?.currentSha || null);
const currentFilename = ref(initialDraft?.currentFilename || null);
const currentType = ref(initialDraft?.currentType || (initialDraft?.currentSha ? 'published' : 'new'));

if (initialDraft && (initialDraft.markdown || initialDraft.frontmatter?.title)) {
  isDirty.value = true;
}

const restoredDraftBanner = ref(initialDraft && (initialDraft.markdown || initialDraft.frontmatter?.title) ? {
  filename: initialDraft.currentFilename,
  title: initialDraft.frontmatter?.title || 'Untitled',
  savedAt: initialDraft.savedAt ? new Date(initialDraft.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null,
  isPublished: initialDraft.currentType === 'published',
  isDraft: initialDraft.currentType === 'draft'
} : null);

const isDraft = computed(() => currentType.value === 'draft');
const isPublished = computed(() => currentType.value === 'published');

// Posts & Drafts Repository Cache
const publishedPosts = ref([]);
const draftPosts = ref([]);
const draftsError = ref('');
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
  restoredDraftBanner.value = null;
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
    const { sha, rawText, name } = await fetchPostContent(item.path, type === 'draft');
    const parsed = parsePost(rawText);

    frontmatter.value = parsed.frontmatter;
    slug.value = name.replace(/\.md$/, '');
    markdownContent.value = parsed.content;
    currentSha.value = sha;
    currentFilename.value = name;
    currentType.value = type;
    isDirty.value = false;
    restoredDraftBanner.value = null;

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

// ── Frontmatter SHA Cache for Instant Post Loading ──────────
const FRONTMATTER_CACHE_KEY = 'alvalog_frontmatter_cache';

function getFrontmatterCache() {
  try {
    return JSON.parse(localStorage.getItem(FRONTMATTER_CACHE_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveFrontmatterCache(cache) {
  try {
    localStorage.setItem(FRONTMATTER_CACHE_KEY, JSON.stringify(cache));
  } catch (e) {
    console.warn('Could not save frontmatter cache:', e);
  }
}

function formatSlugToTitle(filename) {
  return filename
    .replace(/\.md$/, '')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

// ── Refresh Posts & Drafts Lists from GitHub ──────────────
async function refreshPostsList() {
  if (!hasToken.value) {
    isLoadingPosts.value = false;
    return;
  }

  isLoadingPosts.value = true;
  draftsError.value = '';

  const tagSet = new Set();
  const cache = getFrontmatterCache();

  // Run published posts and drafts independently in parallel
  await Promise.allSettled([
    // 1. Fetch & parse published posts
    (async () => {
      try {
        const postFiles = await fetchPostFilesList();

        // Immediate responsive display: map with cache or formatted slug
        const list = postFiles.map(file => {
          const cached = cache[file.sha];
          if (cached) {
            (cached.tags || []).forEach(t => tagSet.add(t));
            return {
              ...file,
              frontmatter: cached,
              sha: file.sha
            };
          }
          return {
            ...file,
            frontmatter: {
              title: formatSlugToTitle(file.name),
              pubDate: '',
              tags: []
            },
            sha: file.sha,
            _needsFetch: true
          };
        });

        // Show all posts in modal immediately without blocking
        publishedPosts.value = [...list].sort((a, b) => {
          const dateA = new Date(a.frontmatter?.pubDate || 0).getTime();
          const dateB = new Date(b.frontmatter?.pubDate || 0).getTime();
          return dateB - dateA;
        });

        // Fetch uncached posts in gentle batches of 6 (avoids rate limits)
        const uncached = list.filter(f => f._needsFetch);
        if (uncached.length > 0) {
          const BATCH_SIZE = 6;
          for (let i = 0; i < uncached.length; i += BATCH_SIZE) {
            const batch = uncached.slice(i, i + BATCH_SIZE);
            await Promise.allSettled(batch.map(async file => {
              try {
                const contentData = await fetchPostContent(file.path);
                const parsed = parsePost(contentData.rawText);
                cache[contentData.sha] = parsed.frontmatter;
                (parsed.frontmatter.tags || []).forEach(t => tagSet.add(t));

                const idx = publishedPosts.value.findIndex(p => p.sha === file.sha || p.name === file.name);
                if (idx !== -1) {
                  publishedPosts.value[idx].frontmatter = parsed.frontmatter;
                }
              } catch (e) {
                console.warn(`Could not load frontmatter for ${file.name}:`, e);
              }
            }));
          }
          saveFrontmatterCache(cache);

          // Re-sort with accurate frontmatter dates
          publishedPosts.value = [...publishedPosts.value].sort((a, b) => {
            const dateA = new Date(a.frontmatter?.pubDate || 0).getTime();
            const dateB = new Date(b.frontmatter?.pubDate || 0).getTime();
            return dateB - dateA;
          });
        }
      } catch (err) {
        console.warn('Could not refresh published posts:', err);
      }
    })(),

    // 2. Fetch & parse private cloud drafts
    (async () => {
      try {
        const draftFiles = await fetchDraftFilesList();
        const parsedDrafts = await Promise.all(
          draftFiles.map(async (file) => {
            try {
              const contentData = await fetchPostContent(file.path, true);
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
                frontmatter: {
                  title: formatSlugToTitle(file.name),
                  pubDate: '',
                  updatedDate: '',
                  tags: []
                },
                sha: file.sha
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
      } catch (draftErr) {
        console.warn('Could not refresh drafts:', draftErr);
        draftsError.value = draftErr.message || 'Could not load private drafts.';
      }
    })()
  ]);

  knownTags.value = Array.from(tagSet);
  isLoadingPosts.value = false;
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
  // Lock CMS shortcut: Win+Shift+L, Ctrl+Shift+L, Alt+Shift+L, or Cmd+Shift+L
  if (
    (e.metaKey || e.ctrlKey || e.altKey) && e.shiftKey && (e.key.toLowerCase() === 'l' || e.code === 'KeyL')
  ) {
    e.preventDefault();
    handleLockApp();
  }
  // Toggle Header / Focus Canvas: Ctrl+\, Cmd+\, or Escape (when header is hidden)
  if ((e.ctrlKey || e.metaKey) && e.key === '\\') {
    e.preventDefault();
    toggleHeader();
  }
  if (e.key === 'Escape' && isHeaderHidden.value) {
    toggleHeader();
  }
}

onMounted(() => {
  document.body.className = isDark.value ? 'dark' : 'light';
  window.addEventListener('keydown', handleGlobalKeydown);

  // Synchronize editor content if draft was present
  if (markdownContent.value) {
    nextTick(() => {
      editorRef.value?.setContent(markdownContent.value);
    });
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
    <!-- Floating Reveal Button when Top Bar is hidden -->
    <transition name="fade">
      <button
        v-if="isHeaderHidden"
        class="floating-header-reveal"
        @click="toggleHeader"
        title="Show Top Bar (Ctrl+\ or Esc)"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
        <span>Show Menu</span>
      </button>
    </transition>

    <!-- Top App Navigation -->
    <HeaderNav
      :class="{ 'header-hidden': isHeaderHidden }"
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
      @hideHeader="toggleHeader"
    />

    <!-- Main Content / Writing Canvas -->
    <main class="main-writing-area" @click="handleMainAreaClick">
      <!-- Restored Draft Banner -->
      <div v-if="restoredDraftBanner" class="restored-draft-banner">
        <div class="banner-info">
          <span class="banner-badge">
            {{ restoredDraftBanner.isPublished ? 'Live Post Session' : (restoredDraftBanner.isDraft ? 'Cloud Draft Session' : 'Unsaved Local Draft') }}
          </span>
          <span class="banner-text">
            Restored from {{ restoredDraftBanner.savedAt ? restoredDraftBanner.savedAt : 'previous session' }}
            <span v-if="restoredDraftBanner.filename" class="banner-filename">({{ restoredDraftBanner.filename }})</span>
          </span>
        </div>
        <div class="banner-actions">
          <button class="banner-btn banner-btn-new" @click="createNewPost(true)" title="Discard this session and start fresh">
            New Post
          </button>
          <button class="banner-btn banner-btn-dismiss" @click="restoredDraftBanner = null" title="Dismiss notice">
            ✕
          </button>
        </div>
      </div>

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
        <span v-if="currentFilename" class="active-file-indicator">
          📄 {{ currentFilename }}
        </span>
        <span v-else-if="slug" class="hide-mobile">Slug: /posts/{{ slug }}</span>
      </div>
      <div class="status-right">
        <span>{{ isSourceMode ? 'Markdown Source Mode' : 'WYSIWYG Mode' }}</span>
        <span class="version-tag">v1.4.0</span>
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
      :draftsError="draftsError"
      :isLoading="isLoadingPosts"
      :currentFilename="currentFilename || ''"
      :currentType="currentType"
      @close="showPostsModal = false"
      @selectPost="loadPost"
      @deleteDraft="handleDeleteDraft"
      @createNew="createNewPost"
      @refreshPosts="refreshPostsList"
      @openSettings="showSettingsModal = true; showPostsModal = false"
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
