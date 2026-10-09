<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import {
  isDevicePaired,
  isSecuritySetup,
  verifyPasscode,
  setupPasscode,
  isBiometricEnabled,
  verifyBiometrics,
  unpairDevice
} from '../services/auth.js';
import { testConnection, saveGithubConfig } from '../services/github.js';

const emit = defineEmits(['unlocked', 'paired']);

const isPaired = ref(isDevicePaired());
const hasPin = ref(isSecuritySetup());

// Determines the screen mode:
// - 'authorize': Device is not paired with a verified GitHub token
// - 'set_pin': Device was verified, needs to set device PIN
// - 'unlock': Device is paired and PIN is set, ready for PIN/Biometric unlock
const screenMode = ref(!isPaired.value ? 'authorize' : (!hasPin.value ? 'set_pin' : 'unlock'));

// State for Authorize mode
const tokenInput = ref('');
const isVerifyingToken = ref(false);
const verifiedUser = ref(null);
const showToken = ref(false);

// State for PIN / Unlock mode
const pin = ref('');
const confirmPin = ref('');
const errorMsg = ref('');
const isShaking = ref(false);
const hasBiometrics = ref(isBiometricEnabled());
const isBiometricBusy = ref(false);

// Rate limiting & Brute force protection
const failedAttempts = ref(0);
const lockoutRemaining = ref(0);
let lockoutTimer = null;

const isLockedOut = computed(() => lockoutRemaining.value > 0);

onMounted(() => {
  // If paired and biometric is enabled on this device, auto-prompt for instant unlock
  if (screenMode.value === 'unlock' && hasBiometrics.value && !isLockedOut.value) {
    handleBiometricUnlock();
  }
});

onBeforeUnmount(() => {
  if (lockoutTimer) clearInterval(lockoutTimer);
});

async function handleAuthorize() {
  errorMsg.value = '';
  const token = tokenInput.value.trim();
  if (!token) {
    triggerError('Please enter your GitHub Personal Access Token.');
    return;
  }

  isVerifyingToken.value = true;
  try {
    const res = await testConnection({ token });
    // Token is verified! Save it to device storage
    saveGithubConfig({ token });
    verifiedUser.value = res.user;
    isPaired.value = true;
    errorMsg.value = '';
    // Advance to set device PIN
    screenMode.value = 'set_pin';
    emit('paired');
  } catch (err) {
    triggerError(err.message || 'Authorization failed. Token is invalid or lacks access to this blog.');
  } finally {
    isVerifyingToken.value = false;
  }
}

async function handleSetupPin() {
  errorMsg.value = '';
  if (!pin.value || pin.value.length < 4) {
    triggerError('Passcode must be at least 4 digits.');
    return;
  }
  if (pin.value !== confirmPin.value) {
    triggerError('Passcodes do not match.');
    return;
  }

  await setupPasscode(pin.value);
  hasPin.value = true;
  screenMode.value = 'unlock';
  emit('unlocked');
}

async function handleUnlock() {
  if (isLockedOut.value) return;
  errorMsg.value = '';
  if (!pin.value) return;

  const valid = await verifyPasscode(pin.value);
  if (valid) {
    failedAttempts.value = 0;
    emit('unlocked');
  } else {
    failedAttempts.value++;
    if (failedAttempts.value >= 5) {
      const waitSec = failedAttempts.value >= 8 ? 300 : 60;
      startLockout(waitSec);
      triggerError(`Too many failed attempts. Locked out for ${waitSec}s.`);
    } else {
      const remaining = 5 - failedAttempts.value;
      triggerError(`Incorrect passcode. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`);
    }
  }
}

function startLockout(seconds) {
  lockoutRemaining.value = seconds;
  pin.value = '';
  if (lockoutTimer) clearInterval(lockoutTimer);
  lockoutTimer = setInterval(() => {
    lockoutRemaining.value--;
    if (lockoutRemaining.value <= 0) {
      clearInterval(lockoutTimer);
      lockoutTimer = null;
    }
  }, 1000);
}

async function handleBiometricUnlock() {
  if (isLockedOut.value) return;
  isBiometricBusy.value = true;
  errorMsg.value = '';
  try {
    const success = await verifyBiometrics();
    if (success) {
      failedAttempts.value = 0;
      emit('unlocked');
    }
  } catch (err) {
    console.log('Biometric unlock bypassed or canceled:', err);
  } finally {
    isBiometricBusy.value = false;
  }
}

function handleUnpair() {
  if (window.confirm('Unpair this device?\n\nThis will remove your stored GitHub token and passcode from this device.')) {
    unpairDevice();
    isPaired.value = false;
    hasPin.value = false;
    tokenInput.value = '';
    pin.value = '';
    confirmPin.value = '';
    screenMode.value = 'authorize';
  }
}

function triggerError(msg) {
  errorMsg.value = msg;
  pin.value = '';
  confirmPin.value = '';
  isShaking.value = true;
  setTimeout(() => {
    isShaking.value = false;
  }, 450);
}
</script>

<template>
  <div class="lock-screen-backdrop">
    <div class="lock-panel" :class="{ shake: isShaking }">
      <!-- Brand & Icon -->
      <div class="lock-header">
        <div class="lock-icon-wrapper">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
        </div>
        <h2 class="lock-title">Alvalog<span class="dot">.</span> CMS</h2>
      </div>

      <!-- Mode 1: Daily Unlock Screen (Device is Paired & PIN is Set) -->
      <form v-if="screenMode === 'unlock'" @submit.prevent="handleUnlock" class="lock-form">
        <p class="lock-subtitle">Enter your passcode to unlock</p>

        <div class="pin-display">
          <input
            type="password"
            v-model="pin"
            inputmode="numeric"
            pattern="[0-9]*"
            class="pin-input"
            placeholder="••••"
            maxlength="8"
            :disabled="isLockedOut"
            autofocus
          />
        </div>

        <div v-if="lockoutRemaining > 0" class="lock-countdown">
          ⚠️ Too many failed attempts. Try again in <strong>{{ lockoutRemaining }}s</strong>
        </div>
        <div v-else-if="errorMsg" class="lock-error">{{ errorMsg }}</div>

        <button
          type="submit"
          class="btn-primary w-full unlock-btn"
          :disabled="isLockedOut || !pin"
        >
          Unlock
        </button>

        <!-- Biometric Button (FaceID / TouchID / Fingerprint) -->
        <button
          v-if="hasBiometrics && !isLockedOut"
          type="button"
          class="btn-biometric w-full"
          :disabled="isBiometricBusy"
          @click="handleBiometricUnlock"
        >
          <svg class="bio-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2a10 10 0 0 0-10 10c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2z"></path>
          </svg>
          Unlock with FaceID / TouchID
        </button>

        <div class="lock-footer-links">
          <button type="button" class="btn-text-muted" @click="handleUnpair">
            Unpair this device
          </button>
        </div>
      </form>

      <!-- Mode 2: Set PIN on Verified Device -->
      <form v-else-if="screenMode === 'set_pin'" @submit.prevent="handleSetupPin" class="lock-form">
        <div v-if="verifiedUser" class="verified-pill">
          ✓ Verified as <strong>@{{ verifiedUser.login }}</strong>
        </div>
        <p class="lock-subtitle">
          Create a 4-8 digit passcode for quick access on this device.
        </p>

        <div class="form-group w-full">
          <label class="form-label">Create Passcode</label>
          <input
            type="password"
            v-model="pin"
            inputmode="numeric"
            class="form-input text-center"
            placeholder="••••"
            maxlength="8"
            autofocus
          />
        </div>

        <div class="form-group w-full mt-2">
          <label class="form-label">Confirm Passcode</label>
          <input
            type="password"
            v-model="confirmPin"
            inputmode="numeric"
            class="form-input text-center"
            placeholder="••••"
            maxlength="8"
          />
        </div>

        <div v-if="errorMsg" class="lock-error">{{ errorMsg }}</div>

        <button type="submit" class="btn-primary w-full mt-3">
          Save Passcode & Start Writing
        </button>
      </form>

      <!-- Mode 3: Device Authorization Required (New Browser / Stranger) -->
      <form v-else @submit.prevent="handleAuthorize" class="lock-form">
        <div class="auth-gate-badge">
          <span>🔒 Private Console</span>
        </div>
        <p class="lock-auth-desc">
          This CMS is private. Enter your GitHub Personal Access Token to authorize this device.
        </p>

        <div class="form-group w-full">
          <label class="form-label">
            <span>GitHub Personal Access Token</span>
            <a
              href="https://github.com/settings/tokens?type=beta"
              target="_blank"
              class="token-link"
            >
              Generate ↗
            </a>
          </label>
          <div class="token-input-wrapper">
            <input
              :type="showToken ? 'text' : 'password'"
              v-model="tokenInput"
              class="form-input"
              placeholder="github_pat_..."
              autofocus
              autocomplete="off"
            />
            <button
              type="button"
              class="btn-token-toggle"
              @click="showToken = !showToken"
            >
              {{ showToken ? 'Hide' : 'Show' }}
            </button>
          </div>
          <div class="token-hint">
            Must have <strong>Contents</strong> permission for <code>techuisite/techuisite.github.io</code>.
          </div>
        </div>

        <div v-if="errorMsg" class="lock-error">{{ errorMsg }}</div>

        <button
          type="submit"
          class="btn-primary w-full mt-2"
          :disabled="isVerifyingToken || !tokenInput.trim()"
        >
          {{ isVerifyingToken ? 'Verifying with GitHub...' : 'Authorize Device' }}
        </button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.lock-screen-backdrop {
  position: fixed;
  inset: 0;
  background: var(--bg-base);
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
}

.lock-panel {
  width: 100%;
  max-width: 380px;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 2.25rem 1.75rem;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.4);
  display: flex;
  flex-direction: column;
  align-items: center;
}

.lock-header {
  text-align: center;
  margin-bottom: 1.25rem;
}

.lock-icon-wrapper {
  width: 52px;
  height: 52px;
  background: rgba(59, 130, 246, 0.12);
  border: 1px solid rgba(59, 130, 246, 0.25);
  color: var(--accent);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 0.85rem auto;
}

.lock-icon-wrapper svg {
  width: 24px;
  height: 24px;
}

.lock-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-heading);
  letter-spacing: -0.02em;
  margin: 0;
}

.lock-title .dot {
  color: var(--accent);
}

.lock-subtitle {
  font-size: 0.85rem;
  color: var(--text-muted);
  margin-top: 0.35rem;
  text-align: center;
}

.lock-auth-desc {
  font-size: 0.82rem;
  color: var(--text-muted);
  line-height: 1.45;
  text-align: center;
  margin: 0.5rem 0 0.85rem 0;
}

.auth-gate-badge {
  background: rgba(245, 158, 11, 0.12);
  border: 1px solid rgba(245, 158, 11, 0.25);
  color: #f59e0b;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.2rem 0.65rem;
  border-radius: 20px;
}

.verified-pill {
  background: rgba(34, 197, 94, 0.12);
  border: 1px solid rgba(34, 197, 94, 0.25);
  color: #22c55e;
  font-size: 0.8rem;
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  margin-bottom: 0.5rem;
}

.token-link {
  color: var(--accent);
  font-size: 0.8rem;
  text-decoration: none;
}

.token-input-wrapper {
  display: flex;
  gap: 0.4rem;
}

.btn-token-toggle {
  background: var(--bg-input);
  border: 1px solid var(--border);
  color: var(--text-muted);
  border-radius: 8px;
  padding: 0 0.65rem;
  font-size: 0.75rem;
  cursor: pointer;
}

.btn-token-toggle:hover {
  color: var(--text-heading);
}

.token-hint {
  font-size: 0.72rem;
  color: var(--text-muted);
  margin-top: 0.35rem;
  line-height: 1.4;
}

.token-hint strong {
  color: var(--text-main);
}

.token-hint code {
  background: var(--code-bg);
  padding: 0.1rem 0.3rem;
  border-radius: 4px;
}

.lock-form {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.pin-display {
  width: 100%;
  display: flex;
  justify-content: center;
}

.pin-input {
  width: 100%;
  max-width: 200px;
  text-align: center;
  font-size: 1.75rem;
  letter-spacing: 0.4em;
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: 10px;
  color: var(--text-heading);
  padding: 0.65rem 0.5rem;
  outline: none;
  transition: border-color 0.15s ease;
}

.pin-input:focus {
  border-color: var(--accent);
}

.pin-input:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.unlock-btn {
  padding: 0.75rem;
  font-size: 1rem;
  font-weight: 600;
}

.btn-biometric {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-main);
  border-radius: 8px;
  padding: 0.65rem;
  font-size: 0.85rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  transition: background 0.15s;
}

.btn-biometric:hover {
  background: var(--chip-bg);
}

.bio-icon {
  width: 18px;
  height: 18px;
  color: var(--accent);
}

.lock-error {
  color: #ef4444;
  font-size: 0.8rem;
  text-align: center;
  line-height: 1.4;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  padding: 0.4rem 0.75rem;
  border-radius: 6px;
  width: 100%;
}

.lock-countdown {
  color: #f59e0b;
  font-size: 0.82rem;
  text-align: center;
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.2);
  padding: 0.4rem 0.75rem;
  border-radius: 6px;
  width: 100%;
}

.lock-footer-links {
  margin-top: 0.5rem;
  display: flex;
  justify-content: center;
}

.btn-text-muted {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 0.75rem;
  cursor: pointer;
  text-decoration: underline;
  transition: color 0.15s;
}

.btn-text-muted:hover {
  color: #ef4444;
}

.text-center {
  text-align: center;
}

.mt-2 { margin-top: 0.5rem; }
.mt-3 { margin-top: 0.75rem; }
.w-full { width: 100%; }

.shake {
  animation: shake 0.4s ease-in-out;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20%, 60% { transform: translateX(-8px); }
  40%, 80% { transform: translateX(8px); }
}
</style>
