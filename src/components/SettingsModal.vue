<script setup>
import { ref, onMounted } from 'vue';
import { getGithubConfig, saveGithubConfig, testConnection } from '../services/github.js';

const props = defineProps({
  isOpen: { type: Boolean, default: false }
});

const emit = defineEmits(['close', 'configSaved']);

const token = ref('');
const repo = ref('techuisite/techuisite.github.io');
const branch = ref('main');
const showToken = ref(false);

const isTesting = ref(false);
const testResult = ref(null);
const testError = ref('');

onMounted(() => {
  loadConfig();
});

function loadConfig() {
  const cfg = getGithubConfig();
  token.value = cfg.token;
  repo.value = cfg.repo;
  branch.value = cfg.branch;
  testResult.value = null;
  testError.value = '';
}

async function handleTest() {
  isTesting.value = true;
  testError.value = '';
  testResult.value = null;

  try {
    const res = await testConnection({
      token: token.value,
      repo: repo.value,
      branch: branch.value
    });
    testResult.value = res;
  } catch (err) {
    testError.value = err.message || 'Connection test failed.';
  } finally {
    isTesting.value = false;
  }
}

function handleSave() {
  saveGithubConfig({
    token: token.value,
    repo: repo.value,
    branch: branch.value
  });
  emit('configSaved');
  emit('close');
}
</script>

<template>
  <div v-if="isOpen" class="modal-backdrop" @click="emit('close')">
    <div class="modal-panel" @click.stop>
      <div class="modal-header">
        <div class="header-title">
          <svg class="header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
          <h3>GitHub Settings</h3>
        </div>
        <button class="btn-icon" @click="emit('close')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <div class="modal-body">
        <p class="settings-intro">
          Connect directly to your blog's GitHub repository. Your token is stored securely in this device's private browser storage and is never sent to any server.
        </p>

        <!-- Token Input -->
        <div class="form-group">
          <label class="form-label">
            <span>GitHub Personal Access Token (PAT)</span>
            <a
              href="https://github.com/settings/tokens?type=beta"
              target="_blank"
              class="token-link"
            >
              Generate Token ↗
            </a>
          </label>
          <div class="token-input-row">
            <input
              :type="showToken ? 'text' : 'password'"
              class="form-input"
              v-model="token"
              placeholder="github_pat_..."
            />
            <button type="button" class="btn-secondary" @click="showToken = !showToken">
              {{ showToken ? 'Hide' : 'Show' }}
            </button>
          </div>
          <div class="token-help">
            Required permissions: <strong>Contents (Read and Write)</strong> for <code>techuisite/techuisite.github.io</code>.
          </div>
        </div>

        <!-- Repo & Branch -->
        <div class="form-row">
          <div class="form-group flex-1">
            <label class="form-label">Repository</label>
            <input
              type="text"
              class="form-input"
              v-model="repo"
              placeholder="techuisite/techuisite.github.io"
            />
          </div>
          <div class="form-group w-32">
            <label class="form-label">Branch</label>
            <input
              type="text"
              class="form-input"
              v-model="branch"
              placeholder="main"
            />
          </div>
        </div>

        <!-- Test Connection Button & Status -->
        <div class="test-connection-section">
          <button
            type="button"
            class="btn-secondary"
            :disabled="!token || isTesting"
            @click="handleTest"
          >
            {{ isTesting ? 'Testing...' : 'Test Connection' }}
          </button>

          <div v-if="testResult" class="test-success">
            <img :src="testResult.user.avatar_url" class="avatar-img" />
            <div>
              <div class="user-name">Connected as <strong>@{{ testResult.user.login }}</strong></div>
              <div class="repo-check">Access verified to {{ testResult.repo.full_name }}</div>
            </div>
          </div>

          <div v-if="testError" class="test-error">
            {{ testError }}
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn-secondary" @click="emit('close')">Cancel</button>
        <button class="btn-primary" @click="handleSave">Save Settings</button>
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
  max-width: 520px;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.4);
}

.modal-header {
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
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.settings-intro {
  font-size: 0.85rem;
  color: var(--text-muted);
  line-height: 1.5;
  margin: 0;
}

.token-link {
  color: var(--accent);
  font-size: 0.8rem;
  text-decoration: none;
}

.token-input-row {
  display: flex;
  gap: 0.5rem;
}

.token-help {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-top: 0.35rem;
}

.token-help strong {
  color: var(--text-main);
}

.form-row {
  display: flex;
  gap: 0.75rem;
}

.flex-1 { flex: 1; }
.w-32 { width: 120px; }

.test-connection-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--border);
}

.test-success {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: rgba(34, 197, 94, 0.12);
  border: 1px solid rgba(34, 197, 94, 0.25);
  padding: 0.65rem 0.85rem;
  border-radius: 8px;
  color: #22c55e;
  font-size: 0.85rem;
}

.avatar-img {
  width: 32px;
  height: 32px;
  border-radius: 50%;
}

.user-name {
  font-weight: 500;
}

.repo-check {
  font-size: 0.75rem;
  opacity: 0.85;
}

.test-error {
  background: rgba(239, 68, 68, 0.12);
  border: 1px solid rgba(239, 68, 68, 0.25);
  padding: 0.65rem 0.85rem;
  border-radius: 8px;
  color: #ef4444;
  font-size: 0.85rem;
}

.modal-footer {
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--border);
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}
</style>
