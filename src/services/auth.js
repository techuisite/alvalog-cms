/**
 * Security & Authentication Service for Alvalog CMS.
 * Uses browser native Web Crypto API (SHA-256) and WebAuthn (FaceID/Fingerprint).
 */

import { getGithubConfig } from './github.js';

const STORAGE_KEYS = {
  PIN_HASH: 'alvalog_pin_hash',
  PIN_SALT: 'alvalog_pin_salt',
  BIOMETRIC_ID: 'alvalog_biometric_id',
  SESSION_UNLOCKED: 'alvalog_session_unlocked'
};

// Generate random salt
function getSalt() {
  let salt = localStorage.getItem(STORAGE_KEYS.PIN_SALT);
  if (!salt) {
    const array = new Uint8Array(16);
    window.crypto.getRandomValues(array);
    salt = Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
    localStorage.setItem(STORAGE_KEYS.PIN_SALT, salt);
  }
  return salt;
}

// Hash PIN with SHA-256 + salt
async function hashPin(pin) {
  const salt = getSalt();
  const enc = new TextEncoder();
  const data = enc.encode(pin + ':' + salt);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function isDevicePaired() {
  const cfg = getGithubConfig();
  return !!cfg.token;
}

export function isSecuritySetup() {
  return !!localStorage.getItem(STORAGE_KEYS.PIN_HASH);
}

export function isSessionUnlocked() {
  // If device is not paired with a verified GitHub token, it is NEVER unlocked
  if (!isDevicePaired()) return false;
  // If no security set up yet, require setup (so lock/setup screen shows)
  if (!isSecuritySetup()) return false;
  return sessionStorage.getItem(STORAGE_KEYS.SESSION_UNLOCKED) === 'true';
}

export function lockSession() {
  sessionStorage.removeItem(STORAGE_KEYS.SESSION_UNLOCKED);
}

export function unlockSession() {
  sessionStorage.setItem(STORAGE_KEYS.SESSION_UNLOCKED, 'true');
}

export async function setupPasscode(pin) {
  if (!pin || pin.length < 4) {
    throw new Error('Passcode must be at least 4 digits.');
  }
  const hash = await hashPin(pin);
  localStorage.setItem(STORAGE_KEYS.PIN_HASH, hash);
  unlockSession();
  return true;
}

export async function verifyPasscode(pin) {
  const savedHash = localStorage.getItem(STORAGE_KEYS.PIN_HASH);
  if (!savedHash) return true; // not set up

  const computed = await hashPin(pin);
  if (computed === savedHash) {
    unlockSession();
    return true;
  }
  return false;
}

export function removePasscode() {
  localStorage.removeItem(STORAGE_KEYS.PIN_HASH);
  localStorage.removeItem(STORAGE_KEYS.PIN_SALT);
  localStorage.removeItem(STORAGE_KEYS.BIOMETRIC_ID);
  sessionStorage.removeItem(STORAGE_KEYS.SESSION_UNLOCKED);
}

export function unpairDevice() {
  removePasscode();
  localStorage.removeItem('alvalog_gh_token');
  sessionStorage.removeItem(STORAGE_KEYS.SESSION_UNLOCKED);
}

/* ──────────────────────────────────────────────────────────
   WebAuthn Biometrics (FaceID / TouchID / Fingerprint)
────────────────────────────────────────────────────────── */

export async function isBiometricsSupported() {
  if (!window.PublicKeyCredential) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

export function isBiometricEnabled() {
  return !!localStorage.getItem(STORAGE_KEYS.BIOMETRIC_ID);
}

export async function registerBiometrics() {
  const supported = await isBiometricsSupported();
  if (!supported) {
    throw new Error('Biometric authentication is not supported or not enabled on this device.');
  }

  const challenge = new Uint8Array(32);
  window.crypto.getRandomValues(challenge);

  const userId = new Uint8Array(16);
  window.crypto.getRandomValues(userId);

  const publicKeyCredentialCreationOptions = {
    challenge,
    rp: {
      name: 'Alvalog CMS',
      id: window.location.hostname
    },
    user: {
      id: userId,
      name: 'author@alvalog.net',
      displayName: 'Alvalog Author'
    },
    pubKeyCredParams: [
      { alg: -7, type: 'public-key' },  // ES256
      { alg: -257, type: 'public-key' } // RS256
    ],
    authenticatorSelection: {
      authenticatorAttachment: 'platform', // FaceID/TouchID/Windows Hello
      userVerification: 'required'
    },
    timeout: 60000,
    attestation: 'none'
  };

  const credential = await navigator.credentials.create({
    publicKey: publicKeyCredentialCreationOptions
  });

  if (credential) {
    // Store credential ID in base64
    const idBase64 = btoa(String.fromCharCode(...new Uint8Array(credential.rawId)));
    localStorage.setItem(STORAGE_KEYS.BIOMETRIC_ID, idBase64);
    return true;
  }
  return false;
}

export async function verifyBiometrics() {
  const credIdBase64 = localStorage.getItem(STORAGE_KEYS.BIOMETRIC_ID);
  if (!credIdBase64) return false;

  const rawId = Uint8Array.from(atob(credIdBase64), c => c.charCodeAt(0));
  const challenge = new Uint8Array(32);
  window.crypto.getRandomValues(challenge);

  const publicKeyCredentialRequestOptions = {
    challenge,
    allowCredentials: [
      {
        id: rawId,
        type: 'public-key',
        transports: ['internal']
      }
    ],
    userVerification: 'required',
    timeout: 60000
  };

  const assertion = await navigator.credentials.get({
    publicKey: publicKeyCredentialRequestOptions
  });

  if (assertion) {
    unlockSession();
    return true;
  }
  return false;
}

export function disableBiometrics() {
  localStorage.removeItem(STORAGE_KEYS.BIOMETRIC_ID);
}
