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
}

function adjustHeight() {
  if (textareaRef.value) {
    textareaRef.value.style.height = 'auto';
    textareaRef.value.style.height = `${Math.max(textareaRef.value.scrollHeight, 400)}px`;
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
      placeholder="Write your markdown here..."
      spellcheck="false"
    ></textarea>
  </div>
</template>

<style scoped>
.source-editor-container {
  width: 100%;
  min-height: calc(100vh - 220px);
  padding: 1.5rem 0 8rem 0;
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
