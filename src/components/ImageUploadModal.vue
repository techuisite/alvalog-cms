<script setup>
import { ref } from 'vue';
import { uploadImageToGithub } from '../services/github.js';

const props = defineProps({
  isOpen: { type: Boolean, default: false }
});

const emit = defineEmits(['close', 'insertImage', 'setHeroImage']);

const selectedFile = ref(null);
const previewUrl = ref(null);
const customFilename = ref('');
const isUploading = ref(false);
const uploadError = ref('');
const uploadedResult = ref(null);
const fileInputRef = ref(null);

function handleFileSelect(e) {
  const file = e.target.files?.[0];
  if (!file) return;

  selectedFile.value = file;
  customFilename.value = file.name.replace(/\s+/g, '-');
  uploadError.value = '';
  uploadedResult.value = null;

  const reader = new FileReader();
  reader.onload = (ev) => {
    previewUrl.value = ev.target.result;
  };
  reader.readAsDataURL(file);
}

async function handleUpload() {
  if (!selectedFile.value) return;

  isUploading.value = true;
  uploadError.value = '';

  try {
    const res = await uploadImageToGithub(selectedFile.value, customFilename.value);
    uploadedResult.value = res;
  } catch (err) {
    uploadError.value = err.message || 'Failed to upload image to GitHub.';
  } finally {
    isUploading.value = false;
  }
}

function insertIntoPost() {
  if (!uploadedResult.value) return;
  const markdownTag = `\n\n![${customFilename.value}](${uploadedResult.value.publicUrl})\n\n`;
  emit('insertImage', markdownTag);
  resetAndClose();
}

function setHero() {
  if (!uploadedResult.value) return;
  emit('setHeroImage', uploadedResult.value.publicUrl);
  resetAndClose();
}

function resetAndClose() {
  selectedFile.value = null;
  previewUrl.value = null;
  customFilename.value = '';
  uploadedResult.value = null;
  uploadError.value = '';
  emit('close');
}
</script>

<template>
  <div v-if="isOpen" class="modal-backdrop" @click="resetAndClose">
    <div class="modal-panel" @click.stop>
      <div class="modal-header">
        <div class="header-title">
          <svg class="header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <circle cx="8.5" cy="8.5" r="1.5"></circle>
            <polyline points="21 15 16 10 5 21"></polyline>
          </svg>
          <h3>Upload Image to Blog</h3>
        </div>
        <button class="btn-icon" @click="resetAndClose">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <div class="modal-body">
        <input
          type="file"
          ref="fileInputRef"
          accept="image/*"
          class="hidden-file-input"
          @change="handleFileSelect"
        />

        <div v-if="!selectedFile" class="upload-dropzone" @click="fileInputRef?.click()">
          <svg class="dropzone-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="17 8 12 3 7 8"></polyline>
            <line x1="12" y1="3" x2="12" y2="15"></line>
          </svg>
          <h4>Choose an image or take a photo</h4>
          <p>Saves directly to <code>public/content/images/YYYY/MM/</code></p>
          <button type="button" class="btn-secondary">Browse Files</button>
        </div>

        <div v-else class="upload-preview-area">
          <div class="preview-img-box">
            <img :src="previewUrl" alt="Preview" />
          </div>

          <div class="form-group mt-3">
            <label class="form-label">Filename in Repository</label>
            <input
              type="text"
              class="form-input"
              v-model="customFilename"
              placeholder="e.g. photo.jpg"
              :disabled="isUploading || uploadedResult"
            />
          </div>

          <div v-if="uploadError" class="error-banner mt-3">
            {{ uploadError }}
          </div>

          <div v-if="uploadedResult" class="success-banner mt-3">
            <svg class="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
            <div>
              <strong>Uploaded to GitHub!</strong>
              <div class="url-text">{{ uploadedResult.publicUrl }}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <div v-if="!uploadedResult" class="footer-buttons">
          <button class="btn-secondary" @click="resetAndClose" :disabled="isUploading">
            Cancel
          </button>
          <button
            class="btn-primary"
            :disabled="!selectedFile || isUploading"
            @click="handleUpload"
          >
            {{ isUploading ? 'Uploading to GitHub...' : 'Upload Image' }}
          </button>
        </div>

        <div v-else class="footer-buttons">
          <button class="btn-secondary" @click="setHero">
            Set as Hero Image
          </button>
          <button class="btn-primary" @click="insertIntoPost">
            Insert Into Post
          </button>
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
  z-index: 70;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.modal-panel {
  width: 100%;
  max-width: 480px;
  max-height: calc(100vh - 2.5rem);
  display: flex;
  flex-direction: column;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.4);
}

.modal-header {
  flex-shrink: 0;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.header-icon {
  width: 20px;
  height: 20px;
  color: var(--accent);
}

.header-title h3 {
  font-size: 1.1rem;
  font-weight: 600;
  margin: 0;
  color: var(--text-heading);
}

.modal-body {
  padding: 1.5rem;
  overflow-y: auto;
  flex: 1;
}

.hidden-file-input {
  display: none;
}

.upload-dropzone {
  border: 2px dashed var(--border);
  border-radius: 12px;
  padding: 2.5rem 1.5rem;
  text-align: center;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  transition: border-color 0.2s;
}

.upload-dropzone:hover {
  border-color: var(--accent);
}

.dropzone-icon {
  width: 40px;
  height: 40px;
  color: var(--text-muted);
  margin-bottom: 0.5rem;
}

.upload-dropzone h4 {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-heading);
  margin: 0;
}

.upload-dropzone p {
  font-size: 0.8rem;
  color: var(--text-muted);
  margin: 0 0 0.5rem 0;
}

.upload-dropzone code {
  background: var(--code-bg);
  padding: 0.1rem 0.3rem;
  border-radius: 4px;
}

.preview-img-box {
  width: 100%;
  max-height: 200px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--border);
  background: #000;
}

.preview-img-box img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}

.mt-3 { margin-top: 1rem; }

.modal-footer {
  flex-shrink: 0;
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--border);
  background: var(--bg-surface);
}

.footer-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}

.error-banner {
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #ef4444;
  padding: 0.75rem;
  border-radius: 8px;
  font-size: 0.85rem;
}

.success-banner {
  background: rgba(34, 197, 94, 0.15);
  border: 1px solid rgba(34, 197, 94, 0.3);
  color: #22c55e;
  padding: 0.75rem;
  border-radius: 8px;
  font-size: 0.85rem;
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.check-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.url-text {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.75rem;
  margin-top: 0.2rem;
  opacity: 0.9;
}
</style>
