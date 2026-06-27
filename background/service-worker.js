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
