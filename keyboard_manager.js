(function () {
  'use strict';

  const DEFAULT_KEYS = ['q', 'w', 'e', 'r', 't', 'y', 'a', 's', 'd', 'f', 'g'];
  const STORAGE_KEY = 'karutaKeyConfig';
  const LABEL_STORAGE_KEY = 'karutaShowKeyLabels';
  const keyConfigGrid = document.getElementById('keyConfigGrid');
  const keyConfigStatus = document.getElementById('keyConfigStatus');
  const resetButton = document.getElementById('resetKeyConfig');
  const showKeyLabelsToggle = document.getElementById('showKeyLabelsToggle');
  const cardGrid = document.getElementById('cardGrid');
  let keys = loadKeys();
  let showKeyLabels = loadShowKeyLabels();

  function normalizeKey(value) {
    const key = String(value || '').trim().toLowerCase();
    if (key.length !== 1) return '';
    return key;
  }

  function normalizeEventKey(event) {
    if (!event || event.metaKey || event.ctrlKey || event.altKey) return '';
    if (event.key && event.key.length === 1) return event.key.toLowerCase();
    return '';
  }

  function hasUniqueKeys(nextKeys) {
    return new Set(nextKeys).size === DEFAULT_KEYS.length;
  }

  function loadKeys() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (Array.isArray(parsed) && parsed.length === DEFAULT_KEYS.length) {
        const normalized = parsed.map(normalizeKey);
        if (normalized.every(Boolean) && hasUniqueKeys(normalized)) return normalized;
      }
    } catch (e) {}
    return DEFAULT_KEYS.slice();
  }

  function loadShowKeyLabels() {
    try {
      return localStorage.getItem(LABEL_STORAGE_KEY) !== 'false';
    } catch (e) {
      return true;
    }
  }

  function saveShowKeyLabels() {
    try { localStorage.setItem(LABEL_STORAGE_KEY, showKeyLabels ? 'true' : 'false'); } catch (e) {}
  }

  function saveKeys() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(keys)); } catch (e) {}
  }

  function isTypingTarget(target) {
    if (!target) return false;
    const tagName = target.tagName ? target.tagName.toLowerCase() : '';
    return tagName === 'input' || tagName === 'textarea' || tagName === 'select' || target.isContentEditable;
  }

  function isModalOpen() {
    return !!document.querySelector('dialog[open]');
  }

  function canUseKeyboardForCards(event) {
    if (!document.body.classList.contains('game-playing')) return false;
    if (isModalOpen()) return false;
    if (isTypingTarget(event.target)) return false;
    return true;
  }

  function getCardByKey(key) {
    const index = keys.indexOf(key);
    if (index < 0) return null;
    return cardGrid?.querySelector(`.card[data-index="${index}"]`) || null;
  }

  function isPlayableCard(card) {
    if (!card) return false;
    const style = window.getComputedStyle(card);
    return style.display !== 'none' && style.visibility !== 'hidden' && style.pointerEvents !== 'none';
  }

  function setStatus(text = '') {
    if (keyConfigStatus) keyConfigStatus.textContent = text;
  }

  function syncInputs() {
    keyConfigGrid?.querySelectorAll('[data-key-index]').forEach(input => {
      const index = Number(input.dataset.keyIndex);
      input.value = (keys[index] || '').toUpperCase();
    });
    if (showKeyLabelsToggle) showKeyLabelsToggle.checked = showKeyLabels;
    document.documentElement.dataset.keyLabels = showKeyLabels ? 'visible' : 'hidden';
    annotateCards();
  }

  function setKey(index, nextKey) {
    const key = normalizeKey(nextKey);
    if (!key || index < 0 || index >= DEFAULT_KEYS.length) return;
    const previousKey = keys[index];
    const duplicateIndex = keys.indexOf(key);
    if (duplicateIndex !== -1 && duplicateIndex !== index) {
      keys[duplicateIndex] = previousKey;
    }
    keys[index] = key;
    saveKeys();
    syncInputs();
    setStatus('SAVED');
    window.setTimeout(() => setStatus(''), 900);
  }

  function resetKeys() {
    keys = DEFAULT_KEYS.slice();
    saveKeys();
    syncInputs();
    setStatus('RESET');
    window.setTimeout(() => setStatus(''), 900);
  }

  function renderConfig() {
    if (!keyConfigGrid) return;
    keyConfigGrid.innerHTML = '';
    DEFAULT_KEYS.forEach((_, index) => {
      const label = document.createElement('label');
      label.className = 'key-config-item';
      label.textContent = String(index + 1);

      const input = document.createElement('input');
      input.type = 'text';
      input.inputMode = 'none';
      input.maxLength = 1;
      input.readOnly = true;
      input.dataset.keyIndex = String(index);
      input.setAttribute('aria-label', `CARD ${index + 1}`);
      input.addEventListener('keydown', event => {
        event.preventDefault();
        if (event.key === 'Backspace' || event.key === 'Delete') {
          setKey(index, DEFAULT_KEYS[index]);
          return;
        }
        const key = normalizeEventKey(event);
        if (key) setKey(index, key);
      });

      label.appendChild(input);
      keyConfigGrid.appendChild(label);
    });
    syncInputs();
  }

  function annotateCards() {
    if (!cardGrid) return;
    cardGrid.querySelectorAll('.card').forEach(card => {
      const index = Number(card.dataset.index);
      let badge = card.querySelector('.key-badge');
      if (!showKeyLabels || !Number.isInteger(index) || !keys[index]) {
        if (badge) badge.remove();
        return;
      }
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'key-badge';
        badge.setAttribute('aria-hidden', 'true');
        card.appendChild(badge);
      }
      badge.textContent = keys[index].toUpperCase();
    });
  }

  function setShowKeyLabels(value) {
    showKeyLabels = !!value;
    saveShowKeyLabels();
    syncInputs();
    setStatus(showKeyLabels ? 'LABELS ON' : 'LABELS OFF');
    window.setTimeout(() => setStatus(''), 900);
  }

  document.addEventListener('keydown', event => {
    if (!canUseKeyboardForCards(event)) return;
    const key = normalizeEventKey(event);
    const card = getCardByKey(key);
    if (!isPlayableCard(card)) return;
    event.preventDefault();
    card.click();
  });

  resetButton?.addEventListener('click', resetKeys);
  showKeyLabelsToggle?.addEventListener('change', event => setShowKeyLabels(event.target.checked));
  renderConfig();
  if (cardGrid) {
    new MutationObserver(annotateCards).observe(cardGrid, { childList: true });
  }
  document.documentElement.dataset.keyboardManager = 'ready';
})();
