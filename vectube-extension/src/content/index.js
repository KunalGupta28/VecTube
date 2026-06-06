// ============================================================================
// VecTube Chrome Extension - Content Script
// Injected into YouTube watch pages. Detects video ID and injects the
// VecTube floating action button.
// ============================================================================

(function () {
  'use strict';

  let currentVideoId = null;
  let vectubeButton = null;

  /**
   * Extract the YouTube video ID from the current page URL.
   */
  function getVideoId() {
    const params = new URLSearchParams(window.location.search);
    return params.get('v');
  }

  /**
   * Get the current video title from the page.
   */
  function getVideoTitle() {
    const titleEl =
      document.querySelector('h1.ytd-watch-metadata yt-formatted-string') ||
      document.querySelector('h1.ytd-video-primary-info-renderer');
    return titleEl ? titleEl.textContent.trim() : '';
  }

  /**
   * Get the video thumbnail URL.
   */
  function getThumbnailUrl(videoId) {
    return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
  }

  /**
   * Create and inject the VecTube floating action button.
   */
  function injectButton() {
    if (vectubeButton) return; // Already injected

    vectubeButton = document.createElement('div');
    vectubeButton.id = 'vectube-fab';
    vectubeButton.innerHTML = `
      <div class="vectube-fab-inner">
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        <span>VecTube</span>
      </div>
    `;

    vectubeButton.addEventListener('click', () => {
      const videoId = getVideoId();
      if (!videoId) return;

      const payload = {
        videoId,
        url: window.location.href,
        title: getVideoTitle(),
        thumbnail: getThumbnailUrl(videoId),
      };

      // Send message to background to open the Side Panel
      chrome.runtime.sendMessage({
        type: 'OPEN_SIDE_PANEL',
        payload,
      });
    });

    document.body.appendChild(vectubeButton);
  }

  /**
   * Remove the button (e.g., when navigating away from a watch page).
   */
  function removeButton() {
    if (vectubeButton) {
      vectubeButton.remove();
      vectubeButton = null;
    }
  }

  /**
   * Handle navigation changes (YouTube is a SPA).
   */
  function handleNavigation() {
    const newVideoId = getVideoId();

    if (newVideoId && newVideoId !== currentVideoId) {
      currentVideoId = newVideoId;
      injectButton();
    } else if (!newVideoId) {
      currentVideoId = null;
      removeButton();
    }
  }

  // Listen for messages from the side panel or background
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'REQUEST_VIDEO_INFO') {
      const videoId = getVideoId();
      sendResponse({
        videoId,
        url: window.location.href,
        title: getVideoTitle(),
        thumbnail: getThumbnailUrl(videoId),
      });
    }
  });

  // YouTube uses the History API for SPA navigation
  // We observe URL changes via yt-navigate-finish events
  window.addEventListener('yt-navigate-finish', handleNavigation);

  // Also watch for popstate (back/forward)
  window.addEventListener('popstate', handleNavigation);

  // Initial check
  handleNavigation();
})();
