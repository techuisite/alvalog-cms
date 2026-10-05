<script setup>
import { ref, onMounted } from 'vue';
import {
  isSecuritySetup,
  verifyPasscode,
  setupPasscode,
  isBiometricEnabled,
  verifyBiometrics
} from '../services/auth.js';

const emit = defineEmits(['unlocked']);

const isConfigured = ref(isSecuritySetup());
const pin = ref('');
const confirmPin = ref('');
const errorMsg = ref('');
const isShaking = ref(false);
const hasBiometrics = ref(isBiometricEnabled());
const isBiometricBusy = ref(false);

onMounted(() => {
  // If biometric is enabled on this device, auto-prompt for instant unlock
  if (isConfigured.value && hasBiometrics.value) {
    handleBiometricUnlock();
  }
});

async function handleUnlock() {
  errorMsg.value = '';
  if (!pin.value) return;

  const valid = await verifyPasscode(pin.value);
  if (valid) {
    emit('unlocked');
  } else {
    triggerError('Incorrect passcode. Please try again.');
  }
}

async function handleSetup() {
  errorMsg.value = '';
  if (!pin.value || pin.value.length < 4) {
    errorMsg.value = 'Passcode must be at least 4 digits.';
    return;
  }
  if (pin.value !== confirmPin.value) {
    triggerError('Passcodes do not match.');
    return;
  }

  await setupPasscode(pin.value);
  isConfigured.value = true;
  emit('unlocked');
}

async function handleBiometricUnlock() {
  isBiometricBusy.value = true;
  errorMsg.value = '';
  try {
    const success = await verifyBiometrics();
    if (success) {
      emit('unlocked');
    }
  } catch (err) {
    console.log('Biometric unlock bypassed or canceled:', err);
  } finally {
    isBiometricBusy.value = false;
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

function handleKeypad(num) {
  if (pin.value.length < 8) {
    pin.value += String(num);
    if (isConfigured.value && pin.value.length >= 4) {
      // Auto-submit on 4+ digits if matching
      verifyPasscode(pin.value).then(valid => {
        if (valid) emit('unlocked');
      });
    }
  }
}

function handleBackspace() {
  pin.value = pin.value.slice(0, -1);
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
        <p class="lock-subtitle">
          {{ isConfigured ? 'Enter your passcode to unlock' : 'Create a passcode to secure your CMS' }}
        </p>
      </div>

      <!-- Mode 1: Already Configured - Unlock Screen -->
      <form v-if="isConfigured" @submit.prevent="handleUnlock" class="lock-form">
        <div class="pin-display">
          <input
            type="password"
            v-model="pin"
            inputmode="numeric"
            pattern="[0-9]*"
            class="pin-input"
            placeholder="••••"
            maxlength="8"
            autofocus
          />
        </div>

        <div v-if="errorMsg" class="lock-error">{{ errorMsg }}</div>

        <button type="submit" class="btn-primary w-full unlock-btn">
          Unlock
        </button>

        <!-- Biometric Button (FaceID / Fingerprint) -->
        <button
          v-if="hasBiometrics"
          type="button"
          class="btn-biometric w-full"
          :disabled="isBiometricBusy"
          @click="handleBiometricUnlock"
        >
          <svg class="bio-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2a10 10 0 0 0-10 10c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2z"></path>
          </svg>
          Unlock with FaceID / Fingerprint
        </button>
      </form>

      <!-- Mode 2: First Time Setup -->
      <form v-else @submit.prevent="handleSetup" class="lock-form">
        <div class="form-group">
          <label class="form-label">Create Passcode (4-8 digits)</label>
          <input
            type="password"
            v-model="pin"
            inputmode="numeric"
            class="form-input text-center"
            placeholder="Enter passcode"
            maxlength="8"
            autofocus
          />
        </div>

        <div class="form-group mt-2">
          <label class="form-label">Confirm Passcode</label>
          <input
            type="password"
            v-model="confirmPin"
            inputmode="numeric"
            class="form-input text-center"
            placeholder="Confirm passcode"
            maxlength="8"
          />
        </div>

        <div v-if="errorMsg" class="lock-error">{{ errorMsg }}</div>

        <button type="submit" class="btn-primary w-full mt-3">
          Set Passcode & Start Writing
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
  max-width: 360px;
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
  margin-bottom: 1.75rem;
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
  margin: 0 auto 1rem auto;
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
  margin-top: 0.4rem;
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
