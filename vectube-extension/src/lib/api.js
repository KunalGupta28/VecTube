// ============================================================================
// VecTube Chrome Extension - API Client
// Replaces Nuxt's $fetch with native fetch for Chrome Extension compatibility.
// ============================================================================

const DEFAULT_API_URL = 'http://localhost:8000';

/**
 * Get the configured API base URL from Chrome storage, fallback to default.
 */
async function getApiUrl() {
  try {
    const result = await chrome.storage.sync.get(['apiUrl']);
    return result.apiUrl || DEFAULT_API_URL;
  } catch {
    return DEFAULT_API_URL;
  }
}

/**
 * Make an API request to the VecTube backend server.
 * @param {string} path - The API path (e.g., '/api/videos/1')
 * @param {string} method - HTTP method (GET, POST, DELETE, etc.)
 * @param {object} [body] - Optional request body
 * @returns {Promise<object>} - The parsed JSON response
 */
export async function request(path, method = 'GET', body = undefined) {
  const apiUrl = await getApiUrl();
  const url = path.startsWith('http') ? path : `${apiUrl}${path}`;

  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        status_code: response.status,
        message: errorData.message || response.statusText,
        ...errorData,
      };
    }
    // Handle empty responses (e.g., 204 or DELETE)
    const text = await response.text();
    if (!text) return { status_code: 200, message: 'Success' };
    try {
      return JSON.parse(text);
    } catch {
      // Response is not JSON (e.g., plain text health check)
      return { status_code: response.status, message: text };
    }
  } catch (error) {
    return {
      status_code: 0,
      message: `Server connection failed: ${error.message}`,
      offline: true,
    };
  }
}

/**
 * Check if the backend server is reachable.
 */
export async function checkServerHealth() {
  const result = await request('/api/health');
  return result.status_code !== 0;
}

/**
 * Shorten a string to a max length, appending "..." if truncated.
 */
export function shortenWord(str, maxLen = 80) {
  if (str === null || str === undefined) return str;
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + '...';
}
