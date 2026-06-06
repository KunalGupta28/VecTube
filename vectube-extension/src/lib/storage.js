// ============================================================================
// VecTube Chrome Extension - Chrome Storage Utility
// Wraps chrome.storage.sync for reactive settings management.
// ============================================================================

import { DEFAULT_SETTINGS } from './constants.js';

/**
 * Get all settings from Chrome storage, merged with defaults.
 */
export async function getSettings() {
  try {
    const result = await chrome.storage.sync.get(DEFAULT_SETTINGS);
    return { ...DEFAULT_SETTINGS, ...result };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/**
 * Save a partial settings object to Chrome storage.
 * @param {object} settings - Key-value pairs to save
 */
export async function saveSettings(settings) {
  try {
    await chrome.storage.sync.set(settings);
    return true;
  } catch (err) {
    console.error('[VecTube] Failed to save settings:', err);
    return false;
  }
}

/**
 * Get a single setting value.
 * @param {string} key
 * @param {*} fallback
 */
export async function getSetting(key, fallback = null) {
  try {
    const result = await chrome.storage.sync.get(key);
    return result[key] ?? fallback;
  } catch {
    return fallback;
  }
}
