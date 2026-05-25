(function () {
  'use strict';

  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  const EFFECT_SOURCES = {
    correct: 'correct.mp3',
    ng: 'ng.mp3',
    start: 'start.mp3',
    result: 'result.mp3'
  };
  const DIGIT_SOURCES = Array.from({ length: 10 }, (_, digit) => [`digit${digit}`, `${digit}.mp3`])
    .reduce((map, [key, src]) => {
      map[key] = src;
      return map;
    }, {});
  const SOURCES = { ...EFFECT_SOURCES, ...DIGIT_SOURCES };
  const EFFECT_ELEMENT_IDS = {
    correct: 'correctSound',
    ng: 'ngSound',
    start: 'startSound',
    result: 'resultSound'
  };

  let audioContext = null;
  let enabled = true;
  let preparePromise = null;
  const buffers = new Map();
  const loading = new Map();
  const fallbackAudios = new Map();

  function getToggleEnabled() {
    const toggle = document.getElementById('soundToggle');
    return !toggle || toggle.checked;
  }

  function isEnabled() {
    return enabled && getToggleEnabled();
  }

  function getAudioContext() {
    if (!AudioContextCtor) return null;
    if (!audioContext) {
      try {
        audioContext = new AudioContextCtor();
      } catch (e) {
        return null;
      }
    }
    return audioContext;
  }

  async function resumeAudioContext() {
    const context = getAudioContext();
    if (!context) return null;
    if (context.state === 'suspended') {
      await context.resume();
    }
    return context;
  }

  function decodeAudioData(context, arrayBuffer) {
    return new Promise((resolve, reject) => {
      const result = context.decodeAudioData(arrayBuffer, resolve, reject);
      if (result && typeof result.then === 'function') result.then(resolve, reject);
    });
  }

  async function loadBuffer(key) {
    if (buffers.has(key)) return buffers.get(key);
    if (loading.has(key)) return loading.get(key);

    const src = SOURCES[key];
    const context = getAudioContext();
    if (!src || !context) return null;

    const request = fetch(src, { cache: 'force-cache' })
      .then(response => {
        if (!response.ok) throw new Error(`audio load failed: ${src}`);
        return response.arrayBuffer();
      })
      .then(arrayBuffer => decodeAudioData(context, arrayBuffer))
      .then(buffer => {
        buffers.set(key, buffer);
        return buffer;
      })
      .finally(() => {
        loading.delete(key);
      });

    loading.set(key, request);
    return request;
  }

  function warmHtmlAudioElements() {
    Object.entries(EFFECT_ELEMENT_IDS).forEach(([key, id]) => {
      const audio = document.getElementById(id);
      if (!audio) return;
      const src = EFFECT_SOURCES[key];
      if (src && !audio.currentSrc && !audio.getAttribute('src')) {
        audio.src = src;
      }
      audio.preload = 'auto';
      try { audio.load(); } catch (e) {}
    });
  }

  function prepare(keys = Object.keys(SOURCES)) {
    preparePromise = (async () => {
      if (!isEnabled()) return false;
      try {
        await resumeAudioContext();
      } catch (e) {
        getAudioContext();
      }
      warmHtmlAudioElements();
      await Promise.allSettled(keys.map(key => loadBuffer(key)));
      return true;
    })();
    return preparePromise;
  }

  function getFallbackAudio(key) {
    const effectId = EFFECT_ELEMENT_IDS[key];
    if (effectId) {
      const element = document.getElementById(effectId);
      if (element) return element;
    }

    if (!fallbackAudios.has(key)) {
      const src = SOURCES[key];
      if (!src) return null;
      const audio = new Audio(src);
      audio.preload = 'auto';
      fallbackAudios.set(key, audio);
    }
    return fallbackAudios.get(key);
  }

  function playFallback(key, playbackRate = 1) {
    const audio = getFallbackAudio(key);
    if (!audio) return false;
    try {
      audio.pause();
      audio.currentTime = 0;
      audio.playbackRate = playbackRate;
      audio.play().catch(() => {});
      return true;
    } catch (e) {
      return false;
    }
  }

  function playBuffer(key, options = {}) {
    if (!isEnabled()) return false;

    const playbackRate = options.playbackRate || 1;
    const delaySeconds = options.delaySeconds || 0;
    const volume = options.volume || 1;
    const context = getAudioContext();
    const buffer = buffers.get(key);

    if (!context || !buffer) {
      loadBuffer(key).catch(() => {});
      return playFallback(key, playbackRate);
    }

    if (context.state === 'suspended') {
      context.resume().catch(() => {});
    }

    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = buffer;
    source.playbackRate.value = playbackRate;
    gain.gain.value = volume;
    source.connect(gain).connect(context.destination);
    source.start(context.currentTime + delaySeconds);
    return true;
  }

  function playEffect(name, options = {}) {
    return playBuffer(name, options);
  }

  function playDigit(digit, options = {}) {
    const normalized = Number(digit);
    if (!Number.isInteger(normalized) || normalized < 0 || normalized > 9) return false;
    return playBuffer(`digit${normalized}`, options);
  }

  function setEnabled(value) {
    enabled = !!value;
    if (enabled) prepare().catch(() => {});
  }

  function registerAudioCacheWorker() {
    if (!('serviceWorker' in navigator)) return;
    if (location.protocol === 'file:') return;
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }

  document.getElementById('soundToggle')?.addEventListener('change', event => {
    setEnabled(event.target.checked);
  });

  window.karutaAudio = {
    prepare,
    playEffect,
    playDigit,
    setEnabled,
    isEnabled,
    get ready() {
      return preparePromise;
    }
  };
  document.documentElement.dataset.audioManager = 'ready';

  preparePromise = prepare(['digit0', 'digit1', 'digit2', 'digit3', 'digit4', 'digit5', 'digit6', 'digit7', 'digit8', 'digit9'])
    .catch(() => false);
  registerAudioCacheWorker();
})();
