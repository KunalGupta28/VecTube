// ============================================================================
// VecTube Chrome Extension - Background Service Worker
// Manages extension lifecycle, side panel activation, and messaging.
// ============================================================================

// Open Side Panel when user clicks the VecTube button in YouTube or Chat in popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'OPEN_SIDE_PANEL') {
    // sender.tab exists when the message comes from a content script,
    // but is undefined when it comes from the popup. In that case,
    // query the active tab to get a valid tabId for sidePanel.open().
    const openPanel = (tabId) => {
      chrome.sidePanel
        .open({ tabId })
        .then(() => {
          // After the panel is open, forward the video info to the side panel
          setTimeout(() => {
            chrome.runtime.sendMessage({
              type: 'VIDEO_INFO',
              payload: message.payload,
            });
          }, 500);
          sendResponse({ success: true });
        })
        .catch((err) => {
          console.error('[VecTube] Failed to open side panel:', err);
          sendResponse({ success: false, error: err.message });
        });
    };

    if (sender.tab && sender.tab.id) {
      // Message from a content script – we already have the tab ID
      openPanel(sender.tab.id);
    } else {
      // Message from popup or other extension page – find the active tab
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs && tabs[0]) {
          openPanel(tabs[0].id);
        } else {
          console.error('[VecTube] No active tab found to open side panel');
          sendResponse({ success: false, error: 'No active tab' });
        }
      });
    }
    return true; // Keep message channel open for async sendResponse
  }

  if (message.type === 'GET_CURRENT_TAB_VIDEO') {
    // The sidepanel asks for the current tab's video info
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'REQUEST_VIDEO_INFO' }, (response) => {
          sendResponse(response);
        });
      } else {
        sendResponse(null);
      }
    });
    return true; // Keep the message channel open for async response
  }
});

// Set side panel behavior - open on action click
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: false })
  .catch((error) => console.error('[VecTube] Side panel error:', error));

// When the extension is installed, set default settings
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.storage.sync.set({
      apiUrl: 'http://localhost:8000',
      defaultChatProvider: 'gemini',
      defaultChatModel: 'gemini-1.5-flash',
      defaultAnalysisProvider: 'gemini',
    });
    console.log('[VecTube] Extension installed, defaults set.');
  }
});
