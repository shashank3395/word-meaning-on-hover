(function () {
  "use strict";

  if (window.__wordMeaningHoverLoaded) {
    return;
  }
  window.__wordMeaningHoverLoaded = true;

  const DEBOUNCE_MS = 1000;
  const CACHE_TTL_MS = 30000;
  const API_URL = "https://api.dictionaryapi.dev/api/v2/entries/en/";
  const WORD_REGEX = /[a-zA-Z'-]+/g;

  const cache = new Map();
  let tooltip = null;
  let debounceTimer = null;
  let lastMouseX = 0;
  let lastMouseY = 0;
  let hoveredWord = null;
  let activeRequestId = 0;

  function createTooltip() {
    if (tooltip) {
      return tooltip;
    }
    const root = document.body || document.documentElement;
    if (!root) {
      return null;
    }
    tooltip = document.createElement("div");
    tooltip.id = "word-meaning-tooltip";
    tooltip.setAttribute("role", "tooltip");
    root.appendChild(tooltip);
    return tooltip;
  }

  function clearDebounce() {
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
  }

  function hideTooltip() {
    clearDebounce();
    hoveredWord = null;
    if (tooltip) {
      tooltip.classList.remove("visible");
      tooltip.replaceChildren();
    }
  }

  function getRangeAtPointInRoot(root, x, y) {
    if (root.caretRangeFromPoint) {
      return root.caretRangeFromPoint(x, y);
    }
    if (root.caretPositionFromPoint) {
      const position = root.caretPositionFromPoint(x, y);
      if (!position) {
        return null;
      }
      const range = document.createRange();
      range.setStart(position.offsetNode, position.offset);
      range.collapse(true);
      return range;
    }
    return null;
  }

  function collectElementsAtPoint(x, y) {
    const elements = [];
    const seen = new Set();
    const roots = [document];

    while (roots.length > 0) {
      const root = roots.pop();
      const stack = [root];

      while (stack.length > 0) {
        const current = stack.pop();
        const el = current.elementFromPoint(x, y);
        if (!el || seen.has(el)) {
          continue;
        }
        seen.add(el);
        elements.push(el);
        if (el.shadowRoot) {
          roots.push(el.shadowRoot);
        }
      }
    }

    return elements;
  }

  function wordFromTextNode(text, offset) {
    let match;
    WORD_REGEX.lastIndex = 0;
    while ((match = WORD_REGEX.exec(text)) !== null) {
      const start = match.index;
      const end = start + match[0].length;
      if (offset >= start && offset <= end) {
        const word = stripWord(match[0]);
        if (word.length < 2) {
          return null;
        }
        return word.toLowerCase();
      }
    }
    return null;
  }

  function wordFromElementText(text) {
    const trimmed = text.trim();
    if (!trimmed) {
      return null;
    }

    const direct = stripWord(trimmed);
    if (/^[a-zA-Z'-]+$/.test(direct) && direct.length >= 2) {
      return direct.toLowerCase();
    }

    WORD_REGEX.lastIndex = 0;
    const match = WORD_REGEX.exec(trimmed);
    if (!match) {
      return null;
    }
    const word = stripWord(match[0]);
    return word.length >= 2 ? word.toLowerCase() : null;
  }

  function stripWord(word) {
    return word.replace(/^['-]+|['-]+$/g, "");
  }

  function getWordAtPoint(x, y) {
    const roots = [document];
    const visitedRoots = new Set();

    while (roots.length > 0) {
      const root = roots.pop();
      if (visitedRoots.has(root)) {
        continue;
      }
      visitedRoots.add(root);

      const range = getRangeAtPointInRoot(root, x, y);
      if (range?.startContainer.nodeType === Node.TEXT_NODE) {
        const word = wordFromTextNode(range.startContainer.textContent, range.startOffset);
        if (word) {
          return word;
        }
      }

      const el = root.elementFromPoint?.(x, y);
      if (el?.shadowRoot) {
        roots.push(el.shadowRoot);
      }
    }

    for (const el of collectElementsAtPoint(x, y)) {
      const word = wordFromElementText(el.textContent || "");
      if (word) {
        return word;
      }
    }

    return null;
  }

  function positionTooltip(x, y) {
    if (!tooltip) {
      return;
    }

    const margin = 12;
    const offset = 14;
    tooltip.classList.add("visible");

    const rect = tooltip.getBoundingClientRect();
    let left = x + offset;
    let top = y + offset;

    if (left + rect.width > window.innerWidth - margin) {
      left = x - rect.width - offset;
    }
    if (left < margin) {
      left = margin;
    }

    if (top + rect.height > window.innerHeight - margin) {
      top = y - rect.height - offset;
    }
    if (top < margin) {
      top = margin;
    }

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  }

  function setTooltipStatus(message, isError) {
    const el = createTooltip();
    el.replaceChildren();

    const status = document.createElement("div");
    status.className = isError ? "wm-status wm-error" : "wm-status";
    status.textContent = message;
    el.appendChild(status);

    positionTooltip(lastMouseX, lastMouseY);
  }

  function parseDefinitions(entries) {
    const result = [];
    if (!Array.isArray(entries)) {
      return result;
    }

    for (const entry of entries) {
      const phonetic = entry.phonetic || entry.phonetics?.find((p) => p.text)?.text || "";
      const meanings = entry.meanings || [];

      for (const meaning of meanings) {
        const partOfSpeech = meaning.partOfSpeech || "";
        const definitions = meaning.definitions || [];

        for (const def of definitions) {
          if (def.definition) {
            result.push({ partOfSpeech, definition: def.definition, phonetic });
          }
          if (result.length >= 2) {
            return result;
          }
        }
      }

      if (result.length > 0 && result[0].phonetic === "" && phonetic) {
        result[0].phonetic = phonetic;
      }
    }

    return result;
  }

  function renderDefinition(word, definitions, phonetic) {
    const el = createTooltip();
    el.replaceChildren();

    const wordEl = document.createElement("div");
    wordEl.className = "wm-word";
    wordEl.textContent = word;
    el.appendChild(wordEl);

    const displayPhonetic = phonetic || definitions[0]?.phonetic || "";
    if (displayPhonetic) {
      const phoneticEl = document.createElement("div");
      phoneticEl.className = "wm-phonetic";
      phoneticEl.textContent = displayPhonetic;
      el.appendChild(phoneticEl);
    }

    let lastPos = null;
    for (const item of definitions) {
      if (item.partOfSpeech && item.partOfSpeech !== lastPos) {
        const posEl = document.createElement("div");
        posEl.className = "wm-pos";
        posEl.textContent = item.partOfSpeech;
        el.appendChild(posEl);
        lastPos = item.partOfSpeech;
      }

      const defEl = document.createElement("p");
      defEl.className = "wm-definition";
      defEl.textContent = item.definition;
      el.appendChild(defEl);
    }

    positionTooltip(lastMouseX, lastMouseY);
  }

  function getCached(word) {
    const entry = cache.get(word);
    if (!entry) {
      return null;
    }
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
      cache.delete(word);
      return null;
    }
    return entry;
  }

  function setCache(word, payload) {
    cache.set(word, { ...payload, timestamp: Date.now() });
  }

  function fetchViaBackground(word) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: "lookup", word }, (response) => {
        if (chrome.runtime.lastError) {
          resolve({ ok: false, error: "fetch_failed" });
          return;
        }
        resolve(response || { ok: false, error: "fetch_failed" });
      });
    });
  }

  async function fetchDefinition(word) {
    try {
      const response = await fetch(`${API_URL}${encodeURIComponent(word)}`);
      if (response.status === 404) {
        return { ok: false, error: "not_found" };
      }
      if (!response.ok) {
        throw new Error("fetch failed");
      }
      const data = await response.json();
      return { ok: true, data };
    } catch {
      return fetchViaBackground(word);
    }
  }

  function scheduleLookup(word) {
    hoveredWord = word;
    clearDebounce();

    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      if (hoveredWord === word) {
        lookupWord(word);
      }
    }, DEBOUNCE_MS);
  }

  function tryLookupAtCursor() {
    const word = getWordAtPoint(lastMouseX, lastMouseY);
    if (!word) {
      return;
    }

    if (word === hoveredWord && (debounceTimer !== null || tooltip?.classList.contains("visible"))) {
      return;
    }

    scheduleLookup(word);
  }

  async function lookupWord(word) {
    const requestId = ++activeRequestId;

    const cached = getCached(word);
    if (cached) {
      if (cached.error) {
        if (hoveredWord === word) {
          setTooltipStatus(
            cached.error === "not_found" ? "No definition found" : "Could not fetch definition",
            true
          );
        }
        return;
      }

      const definitions = parseDefinitions(cached.data);
      if (hoveredWord === word) {
        if (definitions.length === 0) {
          setTooltipStatus("No definition found", true);
        } else {
          const phonetic = cached.data[0]?.phonetic || cached.data[0]?.phonetics?.find((p) => p.text)?.text || "";
          renderDefinition(word, definitions, phonetic);
        }
      }
      return;
    }

    if (hoveredWord === word) {
      setTooltipStatus("Looking up…", false);
    }

    const result = await fetchDefinition(word);
    if (requestId !== activeRequestId || hoveredWord !== word) {
      return;
    }

    if (!result.ok) {
      setCache(word, { error: result.error });
      setTooltipStatus(
        result.error === "not_found" ? "No definition found" : "Could not fetch definition",
        true
      );
      return;
    }

    setCache(word, { data: result.data });
    const definitions = parseDefinitions(result.data);

    if (definitions.length === 0) {
      setCache(word, { error: "not_found" });
      setTooltipStatus("No definition found", true);
      return;
    }

    const phonetic = result.data[0]?.phonetic || result.data[0]?.phonetics?.find((p) => p.text)?.text || "";
    renderDefinition(word, definitions, phonetic);
  }

  function onMouseMove(event) {
    if (event.target.closest("#word-meaning-tooltip")) {
      return;
    }

    lastMouseX = event.clientX;
    lastMouseY = event.clientY;

    if (!event.altKey) {
      if (hoveredWord !== null || debounceTimer !== null) {
        hideTooltip();
      }
      return;
    }

    const word = getWordAtPoint(event.clientX, event.clientY);

    if (!word) {
      if (hoveredWord !== null) {
        hideTooltip();
      }
      return;
    }

    if (word === hoveredWord) {
      return;
    }

    scheduleLookup(word);
  }

  function onKeyDown(event) {
    if (event.key !== "Alt" || event.repeat) {
      return;
    }
    tryLookupAtCursor();
  }

  function onKeyUp(event) {
    if (event.key !== "Alt") {
      return;
    }
    activeRequestId++;
    hideTooltip();
  }

  function onMouseLeave() {
    hideTooltip();
  }

  function onWindowBlur() {
    activeRequestId++;
    hideTooltip();
  }

  document.addEventListener("mousemove", onMouseMove, true);
  document.addEventListener("mouseleave", onMouseLeave, true);
  document.addEventListener("keydown", onKeyDown, true);
  document.addEventListener("keyup", onKeyUp, true);
  window.addEventListener("blur", onWindowBlur);
})();
