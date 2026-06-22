/* Little Alchemy Read-Aloud
 * - Speaks element names on hover, drag, and when a new element is created.
 * - Voice command: press the mic button (or hold Space) and say an element
 *   name to drop it on the play area.
 */

(() => {
  const DEFAULTS = {
    enabled: true,
    speakOnHover: true,
    speakOnDrag: true,
    speakOnCreate: true,
    rate: 0.9,
    pitch: 1.1,
    volume: 1.0,
    lang: 'en-US'
  };

  let settings = { ...DEFAULTS };
  let lastSpoken = { text: '', at: 0 };

  chrome.storage.sync.get(DEFAULTS, (stored) => {
    settings = { ...DEFAULTS, ...stored };
  });
  chrome.storage.onChanged.addListener((changes) => {
    for (const k of Object.keys(changes)) settings[k] = changes[k].newValue;
  });

  // ---------- Text-to-speech ----------
  function speak(text) {
    if (!settings.enabled || !text) return;
    const clean = String(text).trim();
    if (!clean) return;
    const now = Date.now();
    if (clean === lastSpoken.text && now - lastSpoken.at < 700) return;
    lastSpoken = { text: clean, at: now };

    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(clean);
      u.rate = settings.rate;
      u.pitch = settings.pitch;
      u.volume = settings.volume;
      u.lang = settings.lang;
      window.speechSynthesis.speak(u);
    } catch (e) {
      // ignore
    }
  }

  // ---------- Find element nodes & their names ----------
  // Little Alchemy uses different DOM in v1 vs v2. We try several selectors and
  // fall back to text content / data attributes.
  const ELEMENT_SELECTORS = [
    '[data-name]',
    '[data-element]',
    '[data-key]',
    '[data-id].element',
    '.element',
    '.item',
    '.instance',
    '.library__element',
    '.workspace__element',
    '.playboard__element',
    '.mix'
  ];

  // Containers that hold "instances" of created elements on the play area.
  // We watch these specifically so we can speak newly-created items.
  const WORKSPACE_SELECTORS = [
    '.workspace',
    '.workspace__inner',
    '.workspace__instances',
    '.instances',
    '.playboard',
    '.play-area',
    '#workspace',
    '.game__workspace'
  ];

  function isElementNode(node) {
    if (!(node instanceof Element)) return false;
    return ELEMENT_SELECTORS.some((s) => node.matches?.(s));
  }

  function nameOf(node) {
    if (!(node instanceof Element)) return '';
    const attr =
      node.getAttribute('data-name') ||
      node.getAttribute('data-element') ||
      node.getAttribute('aria-label') ||
      node.getAttribute('title');
    if (attr) return attr;
    // Look for child label (Little Alchemy 2 uses .item__text / .instance__text)
    const label = node.querySelector?.(
      '.item__text, .instance__text, .element__text, .label, .name, span, p'
    );
    const text = (label?.textContent || node.textContent || '').trim();
    // Skip if it looks like a number / count
    if (/^\d+$/.test(text)) return '';
    if (text.length > 40) return '';
    return text;
  }

  function closestElementNode(target) {
    if (!(target instanceof Element)) return null;
    for (const s of ELEMENT_SELECTORS) {
      const hit = target.closest?.(s);
      if (hit) return hit;
    }
    return null;
  }

  // ---------- Hover & drag listeners ----------
  let hoverTimer = null;
  document.addEventListener(
    'mouseover',
    (e) => {
      if (!settings.enabled || !settings.speakOnHover) return;
      const node = closestElementNode(e.target);
      if (!node) return;
      const name = nameOf(node);
      if (!name) return;
      clearTimeout(hoverTimer);
      hoverTimer = setTimeout(() => speak(name), 120);
    },
    true
  );

  document.addEventListener(
    'mousedown',
    (e) => {
      if (!settings.enabled || !settings.speakOnDrag) return;
      const node = closestElementNode(e.target);
      if (!node) return;
      const name = nameOf(node);
      if (name) speak(name);
    },
    true
  );

  document.addEventListener(
    'click',
    (e) => {
      if (!settings.enabled || !settings.speakOnDrag) return;
      const node = closestElementNode(e.target);
      if (!node) return;
      const name = nameOf(node);
      if (name) speak(name);
    },
    true
  );

  document.addEventListener(
    'dragstart',
    (e) => {
      if (!settings.enabled || !settings.speakOnDrag) return;
      const node = closestElementNode(e.target);
      if (!node) return;
      const name = nameOf(node);
      if (name) speak(name);
    },
    true
  );

  // Touch support
  document.addEventListener(
    'touchstart',
    (e) => {
      if (!settings.enabled || !settings.speakOnDrag) return;
      const t = e.touches?.[0];
      const node = closestElementNode(
        t && document.elementFromPoint(t.clientX, t.clientY)
      );
      if (!node) return;
      const name = nameOf(node);
      if (name) speak(name);
    },
    true
  );

  // ---------- New element creation ----------
  // We treat anything added inside the workspace (or matching the instance/
  // element selectors) as a "new element" to read aloud. We also watch for
  // text changes on existing instances in case Little Alchemy 2 reuses a
  // node and swaps its label after a successful combination.
  const seenInBoard = new WeakSet();
  const seenLabel = new WeakMap();

  function isInWorkspace(node) {
    if (!(node instanceof Element)) return false;
    for (const s of WORKSPACE_SELECTORS) {
      if (node.closest?.(s)) return true;
    }
    return false;
  }

  function handlePossibleNewInstance(node) {
    if (!(node instanceof Element)) return;
    // Only announce things that are actually in the play area.
    if (!isInWorkspace(node)) return;
    if (seenInBoard.has(node)) return;
    seenInBoard.add(node);
    const name = nameOf(node);
    if (!name) return;
    seenLabel.set(node, name);
    speak(name);
  }

  const boardObserver = new MutationObserver((muts) => {
    if (!settings.enabled || !settings.speakOnCreate) return;
    for (const m of muts) {
      // Newly added nodes (the common case for a created element)
      for (const n of m.addedNodes) {
        if (!(n instanceof Element)) continue;
        if (isElementNode(n)) handlePossibleNewInstance(n);
        const inner = n.querySelectorAll?.(ELEMENT_SELECTORS.join(','));
        if (inner) for (const node of inner) handlePossibleNewInstance(node);
      }
      // Label/text changes on an existing instance
      if (m.type === 'characterData' || m.type === 'attributes') {
        const node =
          m.target instanceof Element
            ? closestElementNode(m.target)
            : closestElementNode(m.target.parentElement);
        if (node && isInWorkspace(node)) {
          const name = nameOf(node);
          if (name && seenLabel.get(node) !== name) {
            seenLabel.set(node, name);
            speak(name);
          }
        }
      }
    }
  });
  boardObserver.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['data-name', 'data-element', 'data-key', 'title', 'aria-label']
  });

  // ---------- Voice → drop on canvas ----------
  // Prefer library items (sidebar) over instances already on the canvas, so
  // saying "fire" picks the source tile instead of an existing fire instance.
  const LIBRARY_SELECTORS = [
    '.library .item',
    '.library__element',
    '.elements .item',
    '.sidebar .item',
    '.menu .item',
    '.items .item'
  ];

  function isInLibrary(el) {
    if (!(el instanceof Element)) return false;
    return LIBRARY_SELECTORS.some((s) => el.matches?.(s) || el.closest?.(s));
  }

  function findElementByName(spoken) {
    const q = spoken.toLowerCase().trim();
    if (!q) return null;
    const candidates = document.querySelectorAll(ELEMENT_SELECTORS.join(','));
    let best = null;
    let bestScore = 0;
    for (const c of candidates) {
      const name = nameOf(c).toLowerCase();
      if (!name) continue;
      let score = 0;
      if (name === q) score = 100;
      else if (name.split(/\s+/).includes(q)) score = 80;
      else if (name.startsWith(q)) score = 60;
      else if (name.includes(q)) score = 40;
      if (!score) continue;
      // Boost library items so we drag a fresh copy onto the canvas.
      if (isInLibrary(c)) score += 50;
      // Penalize items inside the workspace (existing instances).
      if (isInWorkspace(c)) score -= 30;
      if (score > bestScore) {
        best = c;
        bestScore = score;
      }
    }
    return best;
  }

  function findCanvas() {
    for (const s of WORKSPACE_SELECTORS) {
      const el = document.querySelector(s);
      if (el) return el;
    }
    return document.querySelector('canvas') || document.body;
  }

  // Dispatches a sequence of pointer + mouse + drag events to simulate a
  // user dragging `sourceEl` and dropping it at the center of `targetEl`.
  // Little Alchemy 2 uses pointer events, so we fire those first; mouse and
  // HTML5 drag-and-drop events follow as a fallback for v1.
  function simulateDrop(sourceEl, targetEl) {
    const s = sourceEl.getBoundingClientRect();
    const t = targetEl.getBoundingClientRect();
    const from = { x: s.left + s.width / 2, y: s.top + s.height / 2 };
    const to = {
      x: t.left + t.width / 2 + (Math.random() - 0.5) * Math.min(200, t.width * 0.5),
      y: t.top + t.height / 2 + (Math.random() - 0.5) * Math.min(200, t.height * 0.5)
    };

    const pointerOpts = (x, y, type) => ({
      bubbles: true,
      cancelable: true,
      composed: true,
      view: window,
      clientX: x,
      clientY: y,
      screenX: x,
      screenY: y,
      button: 0,
      buttons: type === 'pointerup' || type === 'mouseup' ? 0 : 1,
      pointerId: 1,
      pointerType: 'mouse',
      isPrimary: true,
      width: 1,
      height: 1,
      pressure: type === 'pointerup' ? 0 : 0.5
    });

    const firePointer = (type, x, y, target) => {
      const Ctor = window.PointerEvent || MouseEvent;
      const ev = new Ctor(type, pointerOpts(x, y, type));
      target.dispatchEvent(ev);
    };
    const fireMouse = (type, x, y, target) => {
      const ev = new MouseEvent(type, pointerOpts(x, y, type));
      target.dispatchEvent(ev);
    };
    const fireDrag = (type, x, y, target, dt) => {
      let ev;
      try {
        ev = new DragEvent(type, {
          bubbles: true,
          cancelable: true,
          composed: true,
          view: window,
          clientX: x,
          clientY: y,
          dataTransfer: dt
        });
      } catch {
        ev = new MouseEvent(type, pointerOpts(x, y, type));
      }
      target.dispatchEvent(ev);
    };

    // Step through several intermediate points so games that ignore tiny
    // movements still register a real drag.
    const steps = 6;
    const path = [];
    for (let i = 1; i <= steps; i++) {
      path.push({
        x: from.x + (to.x - from.x) * (i / steps),
        y: from.y + (to.y - from.y) * (i / steps)
      });
    }

    // Pointer + mouse sequence
    firePointer('pointerover', from.x, from.y, sourceEl);
    firePointer('pointerenter', from.x, from.y, sourceEl);
    fireMouse('mouseover', from.x, from.y, sourceEl);
    fireMouse('mouseenter', from.x, from.y, sourceEl);
    firePointer('pointerdown', from.x, from.y, sourceEl);
    fireMouse('mousedown', from.x, from.y, sourceEl);

    for (const p of path) {
      const under = document.elementFromPoint(p.x, p.y) || targetEl;
      firePointer('pointermove', p.x, p.y, under);
      fireMouse('mousemove', p.x, p.y, under);
    }

    const finalUnder = document.elementFromPoint(to.x, to.y) || targetEl;
    firePointer('pointerup', to.x, to.y, finalUnder);
    fireMouse('mouseup', to.x, to.y, finalUnder);

    // HTML5 drag-and-drop fallback (used by Little Alchemy v1)
    let dt = null;
    try { dt = new DataTransfer(); } catch {}
    fireDrag('dragstart', from.x, from.y, sourceEl, dt);
    for (const p of path) {
      const under = document.elementFromPoint(p.x, p.y) || targetEl;
      fireDrag('dragover', p.x, p.y, under, dt);
    }
    fireDrag('drop', to.x, to.y, finalUnder, dt);
    fireDrag('dragend', to.x, to.y, sourceEl, dt);
  }

  function flashHighlight(el) {
    el.classList.add('la-readaloud-flash');
    setTimeout(() => el.classList.remove('la-readaloud-flash'), 900);
  }

  function dropByName(spoken) {
    const el = findElementByName(spoken);
    if (!el) {
      speak(`I can't find ${spoken}`);
      return false;
    }
    el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    flashHighlight(el);
    const canvas = findCanvas();
    speak(nameOf(el));
    // Give scrollIntoView a moment so the source rect is in view before we
    // start dispatching pointer events.
    setTimeout(() => simulateDrop(el, canvas), 200);
    return true;
  }

  // ---------- Mic button + speech recognition ----------
  const SR =
    window.SpeechRecognition || window.webkitSpeechRecognition || null;

  const btn = document.createElement('button');
  btn.id = 'la-readaloud-mic';
  btn.type = 'button';
  btn.setAttribute('aria-label', 'Say an element to add it');
  btn.innerHTML = '<span class="la-mic-icon">🎤</span><span class="la-mic-text">Say an element</span>';
  btn.addEventListener('click', () => startListening());
  document.documentElement.appendChild(btn);

  let recog = null;
  let listening = false;

  function startListening() {
    if (!SR) {
      speak('Voice input is not supported in this browser');
      btn.classList.add('la-mic-error');
      btn.querySelector('.la-mic-text').textContent = 'Voice not supported';
      return;
    }
    if (listening) {
      try { recog?.stop(); } catch {}
      return;
    }
    recog = new SR();
    recog.lang = settings.lang;
    recog.interimResults = false;
    recog.maxAlternatives = 5;
    recog.continuous = false;

    recog.onstart = () => {
      listening = true;
      btn.classList.add('la-mic-listening');
      btn.querySelector('.la-mic-text').textContent = 'Listening…';
    };
    recog.onerror = () => {
      listening = false;
      btn.classList.remove('la-mic-listening');
      btn.querySelector('.la-mic-text').textContent = 'Say an element';
    };
    recog.onend = () => {
      listening = false;
      btn.classList.remove('la-mic-listening');
      btn.querySelector('.la-mic-text').textContent = 'Say an element';
    };
    recog.onresult = (ev) => {
      const alts = Array.from(ev.results[0] || []).map((a) => a.transcript);
      for (const phrase of alts) {
        if (dropByName(phrase)) return;
        // Try individual words too
        for (const w of phrase.split(/\s+/)) {
          if (w.length >= 3 && dropByName(w)) return;
        }
      }
      speak(`I can't find ${alts[0] || 'that'}`);
    };

    try { recog.start(); } catch {}
  }

  // Hold-space to talk
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !e.repeat && !isTypingTarget(e.target)) {
      if (!listening) startListening();
    }
  });

  function isTypingTarget(t) {
    if (!(t instanceof Element)) return false;
    const tag = t.tagName;
    return (
      tag === 'INPUT' ||
      tag === 'TEXTAREA' ||
      t.isContentEditable
    );
  }
})();
