<script setup>
import { ref, onMounted } from 'vue';
import { getGithubConfig, saveGithubConfig, testConnection, DEFAULT_DRAFTS_REPO } from '../services/github.js';
import {
  isSecuritySetup,
  isBiometricEnabled,
  isBiometricsSupported,
  registerBiometrics,
  disableBiometrics,
  removePasscode,
  setupPasscode
} from '../services/auth.js';

const props = defineProps({
  isOpen: { type: Boolean, default: false }
});

const emit = defineEmits(['close', 'configSaved', 'securityUpdated']);

const token = ref('');
const repo = ref('techuisite/techuisite.github.io');
const draftsRepo = ref(DEFAULT_DRAFTS_REPO);
const branch = ref('main');
const showToken = ref(false);

const isTesting = ref(false);
const testResult = ref(null);
const testError = ref('');

// Security state
const hasPin = ref(isSecuritySetup());
const bioEnabled = ref(isBiometricEnabled());
const bioSupported = ref(false);
const showChangePin = ref(false);
const newPin = ref('');
const securityFeedback = ref('');

onMounted(async () => {
  loadConfig();
  hasPin.value = isSecuritySetup();
  bioEnabled.value = isBiometricEnabled();
  bioSupported.value = await isBiometricsSupported();
});

function loadConfig() {
  const cfg = getGithubConfig();
  token.value = cfg.token;
  repo.value = cfg.repo;
  draftsRepo.value = cfg.draftsRepo || DEFAULT_DRAFTS_REPO;
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
      draftsRepo: draftsRepo.value,
      branch: branch.value
    });
    testResult.value = res;

    // Automatically persist settings immediately on test success
    saveGithubConfig({
      token: token.value,
      repo: repo.value,
      draftsRepo: draftsRepo.value,
      branch: branch.value
    });
    emit('configSaved');
  } catch (err) {
    testError.value = err.message || 'Connection test failed.';
  } finally {
    isTesting.value = false;
  }
}

async function handleUpdatePin() {
  securityFeedback.value = '';
  if (!newPin.value || newPin.value.length < 4) {
    securityFeedback.value = 'Passcode must be at least 4 digits.';
    return;
  }
  await setupPasscode(newPin.value);
  hasPin.value = true;
  newPin.value = '';
  showChangePin.value = false;
  securityFeedback.value = 'Passcode successfully updated!';
  emit('securityUpdated');
}

async function handleToggleBiometrics() {
  securityFeedback.value = '';
  if (bioEnabled.value) {
    disableBiometrics();
    bioEnabled.value = false;
    securityFeedback.value = 'Biometrics disabled.';
  } else {
    try {
      const ok = await registerBiometrics();
      if (ok) {
        bioEnabled.value = true;
        securityFeedback.value = 'Biometric unlock enabled!';
      }
    } catch (e) {
      securityFeedback.value = e.message || 'Could not register biometrics.';
    }
  }
}

function handleRemovePasscode() {
  if (window.confirm('Remove passcode protection from this device?')) {
    removePasscode();
    hasPin.value = false;
    bioEnabled.value = false;
    showChangePin.value = false;
    securityFeedback.value = 'Passcode removed.';
    emit('securityUpdated');
  }
}

function handleSave() {
  saveGithubConfig({
    token: token.value,
    repo: repo.value,
    draftsRepo: draftsRepo.value,
    branch: branch.value
  });
  emit('configSaved');
  emit('close');
}

function handleClearCache() {
  if (window.__clearCMSCacheAndReload) {
    window.__clearCMSCacheAndReload();
  } else {
    window.location.reload();
  }
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
        <div class="header-right-actions">
          <button class="btn-primary sm" @click="handleSave" :disabled="!token">
            Save
          </button>
          <button class="btn-icon" @click="emit('close')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
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
            Required permissions: <strong>Contents (Read and Write)</strong> for both <code>techuisite/techuisite.github.io</code> and <code>techuisite/alvalog-drafts</code>.
          </div>
        </div>

        <!-- Repo & Branch -->
        <div class="form-row">
          <div class="form-group flex-1">
            <label class="form-label">Published Blog Repository</label>
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

        <!-- Private Drafts Repository -->
        <div class="form-group">
          <label class="form-label">
            <span>Private Drafts Repository (Cloud Sync)</span>
          </label>
          <input
            type="text"
            class="form-input"
            v-model="draftsRepo"
            placeholder="techuisite/alvalog-drafts"
          />
          <div class="token-help">
            Private repository used exclusively for your unpublished drafts. Never visible to the public and never triggers website rebuilds.
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

          <div v-if="testResult" class="test-success-card">
            <div class="test-card-top">
              <img :src="testResult.user.avatar_url" class="avatar-img" />
              <div class="test-card-meta">
                <div class="user-name">
                  Connected as <strong>@{{ testResult.user.login }}</strong>
                  <span class="saved-pill">✓ Saved</span>
                </div>
                <div class="repo-check">Blog: {{ testResult.repo.full_name }}</div>
                <div v-if="testResult.draftsRepo" class="repo-check text-cyan">
                  🔒 Private Drafts: {{ testResult.draftsRepo.full_name }}
                </div>
              </div>
              <button class="btn-secondary sm btn-done" @click="emit('close')">
                Done
              </button>
            </div>

            <div v-if="testResult.draftsRepoError" class="drafts-warning-box">
              <div class="warning-title">⚠️ Action needed for Private Drafts:</div>
              <div class="warning-msg">
                Your token is connected to your blog, but needs access to <strong>{{ draftsRepo }}</strong> to load private drafts.
              </div>
              <a
                href="https://github.com/settings/tokens"
                target="_blank"
                class="warning-link"
              >
                Add {{ draftsRepo }} to token permissions on GitHub ↗
              </a>
            </div>
          </div>

          <div v-if="testError" class="test-error">
            {{ testError }}
          </div>
        </div>

        <!-- Security & Passcode Section -->
        <div class="security-section">
          <div class="security-section-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
            <h4>App Security & Passcode</h4>
          </div>

          <div class="security-row">
            <div>
              <div class="security-status-text">
                Status: <strong>{{ hasPin ? '🔒 Passcode Protected' : '🔓 Unlocked' }}</strong>
              </div>
              <div class="security-hint">Requires a passcode or biometrics to open CMS</div>
            </div>

            <button
              v-if="!showChangePin"
              type="button"
              class="btn-secondary sm"
              @click="showChangePin = true"
            >
              {{ hasPin ? 'Change PIN' : 'Set PIN' }}
            </button>
          </div>

          <!-- Set / Change PIN Form -->
          <div v-if="showChangePin" class="pin-change-box">
            <div class="pin-input-group">
              <input
                type="password"
                v-model="newPin"
                class="form-input"
                inputmode="numeric"
                maxlength="8"
                placeholder="Enter 4-8 digit PIN"
              />
              <button type="button" class="btn-primary sm" @click="handleUpdatePin">Save PIN</button>
              <button type="button" class="btn-secondary sm" @click="showChangePin = false">Cancel</button>
            </div>
          </div>

          <!-- Biometric Toggle (FaceID / Fingerprint) -->
          <div v-if="hasPin && bioSupported" class="security-row mt-2">
            <div>
              <div class="security-status-text">Biometric Unlock</div>
              <div class="security-hint">Unlock instantly with FaceID / TouchID / Fingerprint</div>
            </div>
            <button
              type="button"
              class="btn-secondary sm"
              :class="{ 'btn-active-bio': bioEnabled }"
              @click="handleToggleBiometrics"
            >
              {{ bioEnabled ? '✓ Enabled' : 'Enable' }}
            </button>
          </div>

          <!-- Remove Passcode -->
          <div v-if="hasPin" class="security-row mt-2">
            <span class="security-hint">Turn off passcode lock on this device</span>
            <button type="button" class="btn-text-danger" @click="handleRemovePasscode">
              Remove Lock
            </button>
          </div>

          <div v-if="securityFeedback" class="security-feedback">
            {{ securityFeedback }}
          </div>
        </div>

        <!-- App Updates & PWA Cache Management -->
        <div class="form-group security-card">
          <div class="security-card-header">
            <span class="security-card-title">PWA Version & Cache</span>
            <span class="version-badge">v1.4.0</span>
          </div>
          <p class="security-desc">
            If updates to the CMS don't immediately appear on your iPad or PC due to browser service worker caching, tap below to clear cache and load the latest build.
          </p>
          <button type="button" class="btn-secondary btn-full" @click="handleClearCache">
            Force Update & Clear App Cache
          </button>
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
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  z-index: 70;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 1rem 0.75rem;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.modal-panel {
  width: 100%;
  max-width: 520px;
  max-height: min(88vh, 580px);
  min-height: 0;
  margin: auto;
  display: flex;
  flex-direction: column;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
  flex-shrink: 0;
}

.modal-header {
  flex: 0 0 auto;
  padding: 0.85rem 1.25rem;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--bg-surface);
  z-index: 2;
}

.header-right-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
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
  padding: 1.15rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
  overflow-y: auto;
  flex: 1 1 auto;
  min-height: 0;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
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

.test-success-card {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  background: rgba(34, 197, 94, 0.1);
  border: 1px solid rgba(34, 197, 94, 0.25);
  padding: 0.65rem 0.85rem;
  border-radius: 8px;
}

.test-card-top {
  display: flex;
  align-items: center;
  gap: 0.65rem;
}

.test-card-meta {
  flex: 1;
  min-width: 0;
}

.avatar-img {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  flex-shrink: 0;
}

.user-name {
  font-weight: 600;
  font-size: 0.85rem;
  color: var(--text-heading);
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.saved-pill {
  font-size: 0.68rem;
  font-weight: 700;
  color: #22c55e;
  background: rgba(34, 197, 94, 0.2);
  padding: 0.05rem 0.35rem;
  border-radius: 4px;
}

.repo-check {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-top: 0.15rem;
}

.text-cyan {
  color: #38bdf8 !important;
}

.btn-done {
  white-space: nowrap;
  font-size: 0.8rem;
  padding: 0.3rem 0.65rem;
  flex-shrink: 0;
}

.drafts-warning-box {
  background: rgba(245, 158, 11, 0.12);
  border: 1px solid rgba(245, 158, 11, 0.25);
  border-radius: 6px;
  padding: 0.5rem 0.65rem;
  font-size: 0.76rem;
  line-height: 1.4;
  color: #f59e0b;
}

.warning-title {
  font-weight: 600;
  margin-bottom: 0.15rem;
}

.warning-msg {
  color: var(--text-heading);
}

.warning-link {
  display: inline-block;
  margin-top: 0.35rem;
  color: var(--accent);
  text-decoration: underline;
  font-weight: 600;
}

.test-error {
  background: rgba(239, 68, 68, 0.12);
  border: 1px solid rgba(239, 68, 68, 0.25);
  padding: 0.65rem 0.85rem;
  border-radius: 8px;
  color: #ef4444;
  font-size: 0.85rem;
}

.security-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border);
}

.security-section-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--text-heading);
}

.security-section-title svg {
  width: 16px;
  height: 16px;
  color: var(--accent);
}

.security-section-title h4 {
  font-size: 0.95rem;
  font-weight: 600;
  margin: 0;
}

.security-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.security-status-text {
  font-size: 0.85rem;
  color: var(--text-heading);
}

.security-hint {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.pin-change-box {
  background: var(--bg-input);
  padding: 0.75rem;
  border-radius: 8px;
  border: 1px solid var(--border);
}

.pin-input-group {
  display: flex;
  gap: 0.5rem;
}

.btn-secondary.sm, .btn-primary.sm {
  padding: 0.35rem 0.65rem;
  font-size: 0.8rem;
  border-radius: 6px;
  white-space: nowrap;
}

.btn-active-bio {
  border-color: #22c55e;
  color: #22c55e;
}

.btn-text-danger {
  background: none;
  border: none;
  color: #ef4444;
  font-size: 0.75rem;
  cursor: pointer;
  text-decoration: underline;
}

.security-feedback {
  font-size: 0.8rem;
  color: var(--accent);
  padding: 0.25rem 0;
}

.mt-2 { margin-top: 0.5rem; }

.btn-full {
  width: 100%;
  margin-top: 0.75rem;
  justify-content: center;
}

.version-badge {
  font-size: 0.72rem;
  font-weight: 700;
  padding: 0.1rem 0.45rem;
  border-radius: 4px;
  background: rgba(59, 130, 246, 0.15);
  color: var(--accent);
  letter-spacing: 0.05em;
}

.modal-footer {
  flex-shrink: 0;
  padding: 0.85rem 1.5rem;
  border-top: 1px solid var(--border);
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  background: var(--bg-surface);
}
</style>
