(function () {
  const MODE_STORAGE_KEY = 'karutaSelectedMode';
  const MODE_CONFIGS = {
    hiscore: {
      script: 'game.js',
      title: '日本十進分類カルタ',
      description: 'NDCを素早く見抜いてカードを取る、日本十進分類カルタ。',
      ogDescription: '分類コードを読み解き、最速で札を取れ。',
      status: '10 ROUNDS / 15 SEC',
      label: '日本十進分類カルタ',
      rules: [
        ['1. 数字を読む', '上に出る3桁のNDCを見て、対応する分類カードを選びます。'],
        ['2. 早く取る', '6秒以内の正解で決まり字ボーナス。連続成功でコンボが伸びます。'],
        ['3. 全10ラウンド', '1ラウンド15秒。不正解は-500pt、パーフェクトなら最後にスコア2倍。']
      ]
    },
    cpu: {
      script: 'cpu_game.js',
      title: '日本十進分類カルタ VS CPU',
      description: 'NDCを素早く見抜いてカードを取る、日本十進分類カルタ CPU対戦モード。',
      ogDescription: '分類コードを読み解き、CPUより速く札を取れ。',
      status: 'VS CPU / 10 ROUNDS / 15 SEC',
      label: '日本十進分類カルタ CPU対戦',
      rules: [
        ['1. CPUより速く取る', '3桁のNDCが順に表示されます。対応する分類カードをCPUより先に選びます。'],
        ['2. 決まり字を狙う', '6秒以内の正解でKIMARIJI BONUS。連続成功でコンボが伸びます。'],
        ['3. 全10ラウンド', '誤答は-500pt。ラウンド終了後、あなたとCPUの合計スコアで勝敗が決まります。']
      ]
    },
    endless: {
      script: 'endless_game.js',
      title: '日本十進分類カルタ ENDLESS',
      description: 'NDCを素早く見抜いてカードを取り続ける、日本十進分類カルタ エンドレスモード。',
      ogDescription: '分類コードを読み解き、ライフが尽きるまで札を取り続けろ。',
      status: 'ENDLESS / 10 ROUNDS PER WAVE / LIFE 3',
      label: '日本十進分類カルタ',
      rules: [
        ['1. 数字を読む', '上に出る3桁のNDCを見て、対応する分類カードを選びます。'],
        ['2. 早く取る', '6秒以内の正解で決まり字ボーナス。連続成功でコンボが伸びます。'],
        ['3. WAVEを突破する', '10ラウンドで1wave。ライフが0になるまでwaveを突破し続けます。']
      ]
    }
  };

  function normalizeMode(value) {
    if (!value) return null;
    const mode = String(value).trim().toLowerCase();
    if (mode === 'hi-score' || mode === 'highscore' || mode === 'score') return 'hiscore';
    if (mode === 'vs-cpu' || mode === 'vscpu') return 'cpu';
    return MODE_CONFIGS[mode] ? mode : null;
  }

  function getLegacyModeFromPath() {
    const path = window.location.pathname.toLowerCase();
    if (path.endsWith('/karuta_cpu.html')) return 'cpu';
    if (path.endsWith('/karuta_endless.html')) return 'endless';
    return null;
  }

  function trackPageView(mode) {
    if (typeof window.gtag !== 'function') return;
    const config = MODE_CONFIGS[mode];
    if (!config) return;

    const pageUrl = new URL(window.location.href);
    pageUrl.hash = '';
    pageUrl.search = '';
    pageUrl.searchParams.set('mode', mode);

    window.gtag('event', 'page_view', {
      page_title: config.title,
      page_location: pageUrl.href,
      page_path: `${window.location.pathname}?mode=${mode}`,
      game_mode: mode
    });
  }

  function setMeta(selector, attr, value) {
    const el = document.querySelector(selector);
    if (el) el.setAttribute(attr, value);
  }

  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function showNativeModal(modal) {
    if (!modal) return;
    if (typeof modal.showModal === 'function') {
      if (!modal.open) modal.showModal();
    } else {
      modal.setAttribute('open', '');
    }
  }

  function closeNativeModal(modal) {
    if (!modal) return;
    if (typeof modal.close === 'function') modal.close();
    else modal.removeAttribute('open');
  }

  const params = new URLSearchParams(window.location.search);
  const queryMode = normalizeMode(params.get('mode'));
  const legacyMode = getLegacyModeFromPath();
  let storedMode = null;
  try {
    storedMode = normalizeMode(sessionStorage.getItem(MODE_STORAGE_KEY));
  } catch (e) {}

  let selectedMode = queryMode || legacyMode || storedMode || 'hiscore';

  if ((queryMode || legacyMode) && window.history && typeof window.history.replaceState === 'function') {
    window.history.replaceState(null, '', 'index.html');
  }

  function getSelectedApi() {
    return window.karutaModes && window.karutaModes[selectedMode];
  }

  function saveSelectedMode() {
    try {
      sessionStorage.setItem(MODE_STORAGE_KEY, selectedMode);
    } catch (e) {}
  }

  function applyMode(mode, options = {}) {
    const normalized = normalizeMode(mode) || 'hiscore';
    selectedMode = normalized;
    saveSelectedMode();

    const config = MODE_CONFIGS[selectedMode];
    document.body.dataset.mode = selectedMode;
    document.documentElement.dataset.theme = 'light';
    try { localStorage.setItem('karutaTheme', 'light'); } catch (e) {}

    document.title = config.title;
    setMeta('meta[name="description"]', 'content', config.description);
    setMeta('meta[property="og:title"]', 'content', config.title);
    setMeta('meta[property="og:description"]', 'content', config.ogDescription);

    const shell = document.querySelector('.game-shell');
    if (shell) {
      shell.classList.toggle('cpu-shell', selectedMode === 'cpu');
      shell.setAttribute('aria-label', config.label);
    }

    const statusChip = document.querySelector('.status-chip');
    if (statusChip) statusChip.textContent = config.status;

    document.querySelectorAll('[data-mode-target]').forEach(button => {
      const buttonMode = normalizeMode(button.dataset.modeTarget);
      button.href = 'index.html';
      button.classList.toggle('active', buttonMode === selectedMode);
    });

    config.rules.forEach(([title, text], index) => {
      const number = index + 1;
      setText(`ruleTitle${number}`, title);
      setText(`ruleText${number}`, text);
    });

    if (options.closeModals) {
      ['rankingModal', 'howToModal', 'resultModal'].forEach(id => closeNativeModal(document.getElementById(id)));
    }

    if (options.trackPageView !== false) {
      trackPageView(selectedMode);
    }
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `${src}?v=audiofix3`;
      script.async = false;
      script.addEventListener('load', resolve, { once: true });
      script.addEventListener('error', reject, { once: true });
      document.head.appendChild(script);
    });
  }

  const modesReady = Promise
    .all(Object.values(MODE_CONFIGS).map(config => loadScript(config.script)))
    .then(() => window.karutaModes || {});

  function runSelected(actionName, fallback) {
    modesReady.then(() => {
      const api = getSelectedApi();
      if (api && typeof api[actionName] === 'function') {
        api[actionName]();
      } else if (typeof fallback === 'function') {
        fallback();
      }
    }).catch(error => {
      console.error('[mode_loader] mode script load failed:', error);
    });
  }

  document.querySelectorAll('[data-mode-target]').forEach(button => {
    button.addEventListener('click', event => {
      event.preventDefault();
      const nextMode = normalizeMode(button.dataset.modeTarget);
      if (!nextMode || nextMode === selectedMode) return;
      applyMode(nextMode, { closeModals: true });
    });
  });

  document.getElementById('rankingButton')?.addEventListener('click', () => runSelected('openRankingModal'));
  document.getElementById('startButton')?.addEventListener('click', () => runSelected('startGame'));
  document.getElementById('howToButton')?.addEventListener('click', () => runSelected('showHowTo', () => showNativeModal(document.getElementById('howToModal'))));
  document.getElementById('quitButton')?.addEventListener('click', () => runSelected('quitGame'));
  document.getElementById('restartButton')?.addEventListener('click', () => runSelected('resetGame'));
  document.getElementById('postButton')?.addEventListener('click', () => runSelected('postToX'));

  document.getElementById('highScoreForm')?.addEventListener('submit', event => {
    event.preventDefault();
    modesReady.then(() => {
      const api = getSelectedApi();
      if (api && typeof api.handleHighScoreSubmit === 'function') {
        api.handleHighScoreSubmit(event);
      }
    });
  });

  document.querySelectorAll('[data-close-modal]').forEach(button => {
    button.addEventListener('click', () => {
      closeNativeModal(document.getElementById(button.dataset.closeModal));
    });
  });

  window.rankTabClick = function(targetId, period) {
    const api = getSelectedApi();
    if (api && typeof api.rankTabClick === 'function') api.rankTabClick(targetId, period);
  };

  applyMode(selectedMode);
})();
