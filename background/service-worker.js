const PDF_VIEWER_ID = "mhjfbmdgcfjbbpaeojofohoefgiehjai";
const PDF_VIEWER_PREFIX = `chrome-extension://${PDF_VIEWER_ID}/`;

function isPdfTabUrl(url) {
  if (!url) {
    return false;
  }
  if (url.startsWith(PDF_VIEWER_PREFIX)) {
    return true;
  }
  if (url.startsWith("file://") && url.toLowerCase().includes(".pdf")) {
    return true;
  }
  return /\.pdf(?:$|[?#])/i.test(url);
}

async function injectIntoPdfTab(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      files: ["content/content.js"],
    });
    await chrome.scripting.insertCSS({
      target: { tabId, allFrames: true },
      files: ["content/content.css"],
    });
  } catch {
    // Tab may not be injectable yet, or content_scripts already ran.
  }
}

// activeTab lets us inject into Chrome's PDF viewer when the user clicks the icon.
chrome.action.onClicked.addListener((tab) => {
  if (!tab?.id || !isPdfTabUrl(tab.url)) {
    return;
  }
  injectIntoPdfTab(tab.id);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete" || !tab.url?.startsWith("file://")) {
    return;
  }
  if (!tab.url.toLowerCase().includes(".pdf")) {
    return;
  }
  injectIntoPdfTab(tabId);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== "lookup") {
    return false;
  }

  const word = message.word;
  if (!word || typeof word !== "string") {
    sendResponse({ ok: false, error: "invalid_word" });
    return false;
  }

  fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`)
    .then(async (response) => {
      if (response.status === 404) {
        sendResponse({ ok: false, error: "not_found" });
        return;
      }
      if (!response.ok) {
        sendResponse({ ok: false, error: "fetch_failed" });
        return;
      }
      const data = await response.json();
      sendResponse({ ok: true, data });
    })
    .catch(() => {
      sendResponse({ ok: false, error: "fetch_failed" });
    });

  return true;
});
