<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { Milkdown, useEditor } from '@milkdown/vue';
import { Editor, rootCtx, defaultValueCtx } from '@milkdown/core';
import { commonmark, linkSchema } from '@milkdown/preset-commonmark';
import { history } from '@milkdown/plugin-history';
import { listener, listenerCtx } from '@milkdown/plugin-listener';
import { replaceAll, $inputRule } from '@milkdown/utils';
import { InputRule } from '@milkdown/prose/inputrules';

const props = defineProps({
  initialContent: { type: String, default: '' },
});

const emit = defineEmits(['update']);

// Input rule: Auto-format [text](url) to styled link mark
const inlineLinkInputRule = $inputRule((ctx) => {
  return new InputRule(
    /(?:^|[^[])\[([^\]]+)\]\(([^)]+)\)$/,
    (state, match, start, end) => {
      const [fullMatch, text, href] = match;
      const markType = linkSchema.type(ctx);
      const linkMark = markType.create({ href });

      const tr = state.tr;
      const mOffset = match[0].indexOf('[');
      const linkStart = start + mOffset;

      tr.replaceWith(linkStart, end, state.schema.text(text, [linkMark]));
      tr.removeStoredMark(markType);
      return tr;
    }
  );
});

// Input rule: Auto-format bare URLs followed by space to styled link mark
const autoLinkInputRule = $inputRule((ctx) => {
  return new InputRule(
    /(?:^|\s)(https?:\/\/[^\s]+)\s$/,
    (state, match, start, end) => {
      const url = match[1];
      const markType = linkSchema.type(ctx);
      const linkMark = markType.create({ href: url });

      const tr = state.tr;
      const mOffset = match[0].indexOf(url);
      const linkStart = start + mOffset;
      const linkEnd = linkStart + url.length;

      tr.addMark(linkStart, linkEnd, linkMark);
      tr.removeStoredMark(markType);
      return tr;
    }
  );
});

// Typewriter / Bottom-screen scrolling
function handleTypewriterScroll() {
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount) return;
  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();

  if (!rect || (rect.top === 0 && rect.bottom === 0)) return;

  const viewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
  const comfortBottom = viewportHeight * 0.52; // Keep in comfortable upper-middle

  if (rect.bottom > comfortBottom) {
    const scrollAmount = rect.bottom - comfortBottom;
    window.scrollBy({
      top: scrollAmount,
      behavior: 'smooth'
    });
  }
}

// Active link popover state
const activeLink = ref({
  visible: false,
  href: '',
  dom: null,
  top: 0,
  left: 0,
});

function handleEditorClick(e) {
  const linkEl = e.target.closest('a');
  if (linkEl && linkEl.closest('.milkdown')) {
    e.preventDefault();
    const rect = linkEl.getBoundingClientRect();
    const wrapper = e.currentTarget.getBoundingClientRect();
    activeLink.value = {
      visible: true,
      href: linkEl.getAttribute('href') || '',
      dom: linkEl,
      top: rect.bottom - wrapper.top + 6,
      left: Math.max(10, rect.left - wrapper.left),
    };
  } else {
    activeLink.value.visible = false;
  }
}

function editActiveLink() {
  const newUrl = window.prompt('Edit URL:', activeLink.value.href);
  if (newUrl !== null && newUrl.trim()) {
    activeLink.value.dom.setAttribute('href', newUrl.trim());
    activeLink.value.href = newUrl.trim();
    activeLink.value.dom.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

function removeActiveLink() {
  const el = activeLink.value.dom;
  if (el && el.parentNode) {
    const parent = el.parentNode;
    while (el.firstChild) parent.insertBefore(el.firstChild, el);
    parent.removeChild(el);
    activeLink.value.visible = false;
    parent.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

function onWindowClick(e) {
  if (activeLink.value.visible && !e.target.closest('.link-tooltip') && !e.target.closest('a')) {
    activeLink.value.visible = false;
  }
}

onMounted(() => {
  window.addEventListener('click', onWindowClick);
});

onBeforeUnmount(() => {
  window.removeEventListener('click', onWindowClick);
});

const { get } = useEditor((root) =>
  Editor.make()
    .config((ctx) => {
      ctx.set(rootCtx, root);
      ctx.set(defaultValueCtx, props.initialContent);
    })
    .use(commonmark)
    .use(inlineLinkInputRule)
    .use(autoLinkInputRule)
    .use(history)
    .use(listener)
    .config((ctx) => {
      ctx.get(listenerCtx).markdownUpdated((_, markdown) => {
        const unescaped = markdown
          .replace(/\\\[/g, '[')
          .replace(/\\\]/g, ']')
          .replace(/\\\(/g, '(')
          .replace(/\\\)/g, ')');
        emit('update', unescaped);
        handleTypewriterScroll();
      });
    })
);

function setContent(markdown) {
  try {
    get()?.action(replaceAll(markdown));
  } catch (e) {
    console.warn('Error updating Milkdown content:', e);
  }
}

defineExpose({ setContent });
</script>

<template>
  <div class="milkdown-wrapper" @click="handleEditorClick" @keyup="handleTypewriterScroll">
    <Milkdown />

    <!-- Interactive Floating Link Tooltip -->
    <div
      v-if="activeLink.visible"
      class="link-tooltip"
      :style="{ top: `${activeLink.top}px`, left: `${activeLink.left}px` }"
      @click.stop
    >
      <span class="link-url-text" :title="activeLink.href">{{ activeLink.href }}</span>
      <div class="link-actions">
        <a :href="activeLink.href" target="_blank" rel="noopener noreferrer" class="link-action-btn" title="Open link in new tab">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
            <polyline points="15 3 21 3 21 9"></polyline>
            <line x1="10" y1="14" x2="21" y2="3"></line>
          </svg>
        </a>
        <button class="link-action-btn" @click="editActiveLink" title="Edit URL">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
        </button>
        <button class="link-action-btn link-remove-btn" @click="removeActiveLink" title="Remove link">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<style>
.milkdown-wrapper {
  width: 100%;
  height: 100%;
  position: relative;
}

.milkdown-wrapper .milkdown {
  min-height: calc(100vh - 220px);
  padding: 1.5rem 0 50vh 0; /* 50vh bottom padding so last line can always scroll to middle */
  outline: none;
}

.milkdown-wrapper .milkdown .editor {
  outline: none;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 1.125rem;
  line-height: 1.85;
  color: var(--text-main);
}

.milkdown-wrapper .milkdown h1 {
  font-size: 2.25rem;
  font-weight: 700;
  line-height: 1.25;
  margin-top: 2rem;
  margin-bottom: 1rem;
  color: var(--text-heading);
}

.milkdown-wrapper .milkdown h2 {
  font-size: 1.75rem;
  font-weight: 600;
  line-height: 1.3;
  margin-top: 1.75rem;
  margin-bottom: 0.75rem;
  color: var(--text-heading);
}

.milkdown-wrapper .milkdown h3 {
  font-size: 1.35rem;
  font-weight: 600;
  margin-top: 1.5rem;
  margin-bottom: 0.5rem;
  color: var(--text-heading);
}

.milkdown-wrapper .milkdown p {
  margin-bottom: 1.25rem;
}

.milkdown-wrapper .milkdown blockquote {
  border-left: 3px solid var(--accent);
  padding-left: 1.25rem;
  margin: 1.5rem 0;
  font-style: italic;
  color: var(--text-muted);
}

.milkdown-wrapper .milkdown code {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.9em;
  background-color: var(--code-bg);
  padding: 0.2em 0.4em;
  border-radius: 4px;
}

.milkdown-wrapper .milkdown pre {
  background-color: var(--code-bg);
  padding: 1rem;
  border-radius: 8px;
  overflow-x: auto;
  margin: 1.5rem 0;
}

.milkdown-wrapper .milkdown pre code {
  background-color: transparent;
  padding: 0;
}

.milkdown-wrapper .milkdown img {
  max-width: 100%;
  height: auto;
  border-radius: 8px;
  margin: 1.5rem 0;
}

.milkdown-wrapper .milkdown ul, 
.milkdown-wrapper .milkdown ol {
  padding-left: 1.5rem;
  margin-bottom: 1.25rem;
}

.milkdown-wrapper .milkdown li {
  margin-bottom: 0.35rem;
}

/* Beautiful Linked URL formatting */
.milkdown-wrapper .milkdown a {
  color: var(--accent);
  text-decoration: underline;
  text-decoration-thickness: 1.5px;
  text-underline-offset: 3px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  padding: 0.05rem 0.2rem;
  border-radius: 4px;
}

.milkdown-wrapper .milkdown a:hover {
  background: rgba(59, 130, 246, 0.15);
  color: var(--accent-hover);
}

/* Interactive Floating Link Tooltip */
.link-tooltip {
  position: absolute;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
  padding: 0.35rem 0.6rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  z-index: 30;
  max-width: 380px;
  animation: fadeIn 0.12s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}

.link-url-text {
  font-size: 0.8rem;
  font-family: 'JetBrains Mono', monospace;
  color: var(--text-muted);
  max-width: 200px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.link-actions {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.link-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  background: transparent;
  border: none;
  border-radius: 4px;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.15s ease;
}

.link-action-btn:hover {
  background: var(--chip-bg);
  color: var(--text-heading);
}

.link-action-btn svg {
  width: 14px;
  height: 14px;
}

.link-remove-btn:hover {
  color: #ef4444;
}

.milkdown-wrapper .milkdown hr {
  border: none;
  border-top: 1px solid var(--border);
  margin: 2.5rem 0;
}
</style>
