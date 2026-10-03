<script setup>
import { Milkdown, useEditor } from '@milkdown/vue';
import { Editor, rootCtx, defaultValueCtx } from '@milkdown/core';
import { commonmark } from '@milkdown/preset-commonmark';
import { history } from '@milkdown/plugin-history';
import { listener, listenerCtx } from '@milkdown/plugin-listener';
import { replaceAll } from '@milkdown/utils';

const props = defineProps({
  initialContent: { type: String, default: '' },
});

const emit = defineEmits(['update']);

const { get } = useEditor((root) =>
  Editor.make()
    .config((ctx) => {
      ctx.set(rootCtx, root);
      ctx.set(defaultValueCtx, props.initialContent);
    })
    .use(commonmark)
    .use(history)
    .use(listener)
    .config((ctx) => {
      ctx.get(listenerCtx).markdownUpdated((_, markdown) => {
        // Clean unescaped brackets and parens
        const unescaped = markdown
          .replace(/\\\[/g, '[')
          .replace(/\\\]/g, ']')
          .replace(/\\\(/g, '(')
          .replace(/\\\)/g, ')');
        emit('update', unescaped);
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
  <div class="milkdown-wrapper">
    <Milkdown />
  </div>
</template>

<style>
.milkdown-wrapper {
  width: 100%;
  height: 100%;
}

.milkdown-wrapper .milkdown {
  min-height: calc(100vh - 220px);
  padding: 1.5rem 0 8rem 0;
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

.milkdown-wrapper .milkdown a {
  color: var(--accent);
  text-decoration: underline;
  text-underline-offset: 3px;
}

.milkdown-wrapper .milkdown hr {
  border: none;
  border-top: 1px solid var(--border);
  margin: 2.5rem 0;
}
</style>
