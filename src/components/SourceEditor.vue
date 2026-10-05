<script setup>
import { ref, watch, onMounted, nextTick } from 'vue';

const props = defineProps({
  modelValue: { type: String, default: '' },
});

const emit = defineEmits(['update:modelValue']);
const textareaRef = ref(null);

function onInput(e) {
  emit('update:modelValue', e.target.value);
  adjustHeight();
  handleTypewriterScroll();
}

function adjustHeight() {
  if (textareaRef.value) {
    textareaRef.value.style.height = 'auto';
    textareaRef.value.style.height = `${Math.max(textareaRef.value.scrollHeight, 400)}px`;
  }
}

function handleTypewriterScroll() {
  const textarea = textareaRef.value;
  if (!textarea) return;

  const caretPos = textarea.selectionStart;
  const textBefore = textarea.value.substring(0, caretPos);
  const lineIndex = textBefore.split('\n').length;
  const lineHeight = 28; // approx line height in px
  const caretOffsetTop = lineIndex * lineHeight;

  const rect = textarea.getBoundingClientRect();
  const caretScreenY = rect.top + caretOffsetTop;

  const viewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
  const comfortBottom = viewportHeight * 0.52;

  if (caretScreenY > comfortBottom) {
    window.scrollBy({
      top: caretScreenY - comfortBottom,
      behavior: 'smooth'
    });
  }
}

function handleKeyDown(e) {
  // Support Tab key for indentation
  if (e.key === 'Tab') {
    e.preventDefault();
    const start = textareaRef.value.selectionStart;
    const end = textareaRef.value.selectionEnd;
    const value = textareaRef.value.value;

    textareaRef.value.value = value.substring(0, start) + '  ' + value.substring(end);
    textareaRef.value.selectionStart = textareaRef.value.selectionEnd = start + 2;
    emit('update:modelValue', textareaRef.value.value);
  }
}

watch(() => props.modelValue, () => {
  nextTick(() => adjustHeight());
});

onMounted(() => {
  adjustHeight();
});
</script>

<template>
  <div class="source-editor-container">
    <textarea
      ref="textareaRef"
      class="source-textarea"
      :value="modelValue"
      @input="onInput"
      @keydown="handleKeyDown"
      @keyup="handleTypewriterScroll"
      placeholder="Write your markdown here..."
      spellcheck="false"
    ></textarea>
  </div>
</template>

<style scoped>
.source-editor-container {
  width: 100%;
  min-height: calc(100vh - 220px);
  padding: 1.5rem 0 50vh 0;
}

.source-textarea {
  width: 100%;
  min-height: 450px;
  background: transparent;
  color: var(--text-main);
  border: none;
  outline: none;
  resize: none;
  font-family: 'JetBrains Mono', 'Fira Code', Menlo, Monaco, Consolas, monospace;
  font-size: 1rem;
  line-height: 1.75;
  padding: 0;
}
</style>
