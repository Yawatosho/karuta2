(function () {
const ROUND_TIME_MS = 15000;
const EARLY_WINDOW_MS = 6000;
const CPU_CLICK_ANIM_MS = 230;
const NDC_JSON_URL = 'https://raw.githubusercontent.com/Yawatosho/karuta/refs/heads/main/ndc.json';
const NDC_CACHE_KEY = 'ndc_json_cache_v1';
const THEME_KEY = 'karutaTheme';

let soundEnabled = true;
let debugMode = false;
let cards = [];
let currentReadingCard = null;
let round = 0;
let playerScore = 0;
let cpuScore = 0;
let roundStartTime = 0;
let roundActive = false;
let answered = false;
let perfectGame = true;
let earlyEligiblePlayer = true;
let earlyEligibleCPU = true;
let earlyComboPlayer = 0;
let earlyComboCPU = 0;
let lastComboOwner = null;
let cpuLevel = 'normal';
let gameRunId = 0;
let roundId = 0;
let roundTimer = null;
let roundResultTimeout = null;
let timeDisplayInterval = null;
let readingTimeouts = [];
let countdownTimeouts = [];
let cpuActionScheduled = false;
let cpuActionTimer = null;
let cpuClickTimer = null;
let cpuPlannedAt = 0;
let cpuPlannedWait = 0;

const CPU_PRESETS = {
  beginner: { label: '風の目録使い', correctRate: 0.80, reactionMinMs: 4000, reactionMaxMs: 6000 },
  normal: { label: '分類の魔術師', correctRate: 0.90, reactionMinMs: 2000, reactionMaxMs: 4000 },
  expert: { label: 'デジタルライブラリアン', correctRate: 0.95, reactionMinMs: 600, reactionMaxMs: 2000 },
  god: { label: '至高の司書', correctRate: 0.985, reactionMinMs: 500, reactionMaxMs: 1500 }
};

const CPU_LINES = {
  win: {
    beginner: ['やった！ぼく、がんばりました！', '次も負けませんよ！'],
    normal: ['分類の妙、見せられたかな？', 'ふふ、今日は私の勝ちみたいです。'],
    expert: ['トウゼン デス、アルゴリズム ガ チガイマスカラ', 'サイテキカ シュウリョウ、ワタシ ノ ショウリ デス'],
    god: ['至高の整理学、ここに極まれり', '分類は宇宙、我はその地図を持つ者']
  },
  lose: {
    beginner: ['うう…でも次は勝ちます！', 'すごい！あなた強いですね！'],
    normal: ['見事です。あなたの勝利。', '完敗です。次は攻略法を練ってきます。'],
    expert: ['データ サンプル ブソク、ツギハ カチマス', 'ハイスペック デスネ、ソンケイ シマス'],
    god: ['佳き一戦であった。知の座標、今ひとつ先へ。', '然り、汝に軍配。だが学理はなお深く、光は遠く。']
  },
  draw: {
    beginner: ['引き分け！楽しかったです！'],
    normal: ['互角でしたね。次で決めましょう。'],
    expert: ['拮抗。次は最適化の余地ありです。'],
    god: ['均衡か。悪くない。次は揺らすとしよう。']
  }
};

const bonusTable = [
  { ndc: '417', bonusPoints: 4170 },
  { ndc: '777', bonusPoints: 10000 },
  { ndc: '913', bonusPoints: 10000 },
  { ndc: '111', bonusPoints: 10000 },
  { ndc: '222', bonusPoints: 10000 },
  { ndc: '333', bonusPoints: 10000 },
  { ndc: '444', bonusPoints: 10000 },
  { ndc: '555', bonusPoints: 10000 },
  { ndc: '666', bonusPoints: 10000 },
  { ndc: '888', bonusPoints: 10000 },
  { ndc: '999', bonusPoints: 10000 },
  { ndc: '000', bonusPoints: 10000 },
  { ndc: '012', bonusPoints: 10000 },
  { ndc: '123', bonusPoints: 10000 },
  { ndc: '234', bonusPoints: 10000 },
  { ndc: '345', bonusPoints: 10000 },
  { ndc: '456', bonusPoints: 10000 },
  { ndc: '567', bonusPoints: 10000 },
  { ndc: '678', bonusPoints: 10000 },
  { ndc: '789', bonusPoints: 10000 },
  { ndc: '100', bonusPoints: 10000 },
  { ndc: '200', bonusPoints: 10000 },
  { ndc: '300', bonusPoints: 10000 },
  { ndc: '400', bonusPoints: 10000 },
  { ndc: '500', bonusPoints: 10000 },
  { ndc: '600', bonusPoints: 10000 },
  { ndc: '700', bonusPoints: 10000 },
  { ndc: '800', bonusPoints: 10000 },
  { ndc: '900', bonusPoints: 10000 },
  { ndc: '007', bonusPoints: 10000 },
  { ndc: '010', bonusPoints: 10000 }
];

const soundToggle = document.getElementById('soundToggle');
const correctSound = document.getElementById('correctSound');
const ngSound = document.getElementById('ngSound');
const startSound = document.getElementById('startSound');
const resultSound = document.getElementById('resultSound');
const startButton = document.getElementById('startButton');
const quitButton = document.getElementById('quitButton');
const restartButton = document.getElementById('restartButton');
const postButton = document.getElementById('postButton');
const howToButton = document.getElementById('howToButton');
const rankingButton = document.getElementById('rankingButton');
const hiscoreButton = document.getElementById('hiscoreButton');
const cpuButton = document.getElementById('cpuButton');
const endlessButton = document.getElementById('endlessButton');
const cpuLevelSelect = document.getElementById('cpuLevel');
const cpuLevelPanel = document.querySelector('.cpu-level-panel');
const messageEl = document.getElementById('message');
const scoreElPlayer = document.getElementById('scoreDisplayPlayer');
const scoreElCPU = document.getElementById('scoreDisplayCPU');
const comboEl = document.getElementById('comboDisplay');
const timeEl = document.getElementById('timeDisplay');
const cardGrid = document.getElementById('cardGrid');
const readerPanel = document.querySelector('.reader-panel');
const readingEl = document.getElementById('reading');
const countdownEl = document.getElementById('countdownDisplay');
const fxLayer = document.getElementById('fxLayer');
const cpuCursorEl = document.getElementById('cpuCursor');
const rankingModal = document.getElementById('rankingModal');
const howToModal = document.getElementById('howToModal');
const resultModal = document.getElementById('resultModal');

function showReaderPanel() {
  if (readerPanel) readerPanel.classList.remove('is-hidden');
}

function hideGameArea() {
  if (readerPanel) readerPanel.classList.add('is-hidden');
  cardGrid.style.display = 'none';
}
const resultDisplayEl = document.getElementById('resultDisplay');
const battleResultEl = document.getElementById('battleResult');
const digit1Num = document.querySelector('#digit1 .num');
const digit2Num = document.querySelector('#digit2 .num');
const digit3Num = document.querySelector('#digit3 .num');

const CORRECT_SOUND_BASE_RATE = 1;
const CORRECT_SOUND_RATE_STEP = 0.08;
const CORRECT_SOUND_MAX_RATE = 1.6;
const digitSounds = Array.from({ length: 10 }, (_, digit) => {
  const audio = new Audio(`${digit}.mp3`);
  audio.preload = 'auto';
  return audio;
});

function applyTheme() {
  document.documentElement.dataset.theme = 'light';
  try { localStorage.setItem(THEME_KEY, 'light'); } catch (e) {}
}

try {
  applyTheme();
} catch (e) {
  document.documentElement.dataset.theme = 'light';
}

if (soundToggle) soundToggle.addEventListener('change', e => { soundEnabled = e.target.checked; });
if (cpuLevelSelect) cpuLevelSelect.addEventListener('change', e => { cpuLevel = e.target.value; });

function esc(s) {
  return String(s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

function pad3(str) { return String(str).trim().padStart(3, '0'); }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function getBonusForNdc(ndc) { return bonusTable.find(item => item.ndc === ndc) || null; }

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function pickUniqueByPrefix(list, desiredCount = 11, prefixLen = 2) {
  const picked = [];
  const used = new Set();
  for (const card of list) {
    const prefix = card.ndc.substring(0, prefixLen);
    if (!used.has(prefix)) {
      picked.push(card);
      used.add(prefix);
      if (picked.length >= desiredCount) break;
    }
  }
  if (picked.length < desiredCount) {
    for (const card of list) {
      if (!picked.includes(card)) {
        picked.push(card);
        if (picked.length >= desiredCount) break;
      }
    }
  }
  return picked;
}

async function fetchAllCardsCached() {
  const cached = sessionStorage.getItem(NDC_CACHE_KEY);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {}
  }
  const res = await fetch(NDC_JSON_URL, { cache: 'no-store' });
  if (!res.ok) throw new Error(`ndc.json fetch failed: HTTP ${res.status}`);
  const raw = await res.json();
  const allCards = (Array.isArray(raw) ? raw : [])
    .filter(d => d && typeof d.ndc !== 'undefined' && typeof d.subject === 'string')
    .map((d, i) => ({ ndc: pad3(d.ndc), subject: d.subject.trim(), used: false, index: i }));
  sessionStorage.setItem(NDC_CACHE_KEY, JSON.stringify(allCards));
  return allCards;
}

async function fetchCards() {
  const allCards = await fetchAllCardsCached();
  const pool = allCards.slice();
  shuffle(pool);
  const selected = pickUniqueByPrefix(pool, 11, 2);
  selected.forEach((card, index) => { card.used = false; card.index = index; });
  return selected;
}

function showModal(modal) {
  if (!modal) return;
  if (typeof modal.showModal === 'function') {
    if (!modal.open) modal.showModal();
  } else {
    modal.setAttribute('open', '');
  }
}

function closeModal(modal) {
  if (!modal) return;
  if (typeof modal.close === 'function') modal.close();
  else modal.removeAttribute('open');
}

function resetCorrectSoundRate() {
  correctSound.playbackRate = CORRECT_SOUND_BASE_RATE;
}

function playCorrectSoundForCombo(comboCount) {
  if (!soundEnabled) return;
  const comboBoost = Math.max(0, comboCount - 1) * CORRECT_SOUND_RATE_STEP;
  correctSound.playbackRate = Math.min(CORRECT_SOUND_BASE_RATE + comboBoost, CORRECT_SOUND_MAX_RATE);
  correctSound.currentTime = 0;
  correctSound.play();
}

function playDigitSound(digit) {
  if (!soundEnabled) return;
  const audio = digitSounds[Number(digit)];
  if (!audio) return;
  audio.currentTime = 0;
  audio.play().catch(() => {});
}

function pulseBody(className, duration = 420) {
  document.body.classList.remove(className);
  void document.body.offsetWidth;
  document.body.classList.add(className);
  setTimeout(() => document.body.classList.remove(className), duration);
}

function burstFromElement(el, color = '#2f6f7b', count = 18) {
  if (!el || !fxLayer) return;
  const rect = el.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;

  for (let i = 0; i < count; i++) {
    const spark = document.createElement('span');
    const angle = (Math.PI * 2 * i) / count;
    const distance = 42 + Math.random() * 74;
    spark.className = 'spark';
    spark.style.left = `${x}px`;
    spark.style.top = `${y}px`;
    spark.style.color = color;
    spark.style.setProperty('--tx', `${Math.cos(angle) * distance}px`);
    spark.style.setProperty('--ty', `${Math.sin(angle) * distance}px`);
    fxLayer.appendChild(spark);
    setTimeout(() => spark.remove(), 760);
  }
}

function popText(text, el, color = '#2f6f7b') {
  if (!el || !fxLayer) return;
  const rect = el.getBoundingClientRect();
  const label = document.createElement('span');
  label.className = 'pop-text';
  label.textContent = text;
  label.style.left = `${rect.left + rect.width / 2 - 44}px`;
  label.style.top = `${rect.top + 4}px`;
  label.style.color = color;
  fxLayer.appendChild(label);
  setTimeout(() => label.remove(), 920);
}

function setMessage(kind, main = '', sub = '') {
  messageEl.className = kind ? `msg-${kind}` : '';
  if (!main && !sub) {
    messageEl.innerHTML = '';
    return;
  }
  const mainHtml = main ? `<span class="msg-main">${esc(main)}</span>` : '';
  const subHtml = sub ? `<span class="msg-sub">${esc(sub)}</span>` : '';
  messageEl.innerHTML = `${mainHtml}${subHtml}`;
}

function updateScoreDisplays() {
  scoreElPlayer.innerText = `YOU: ${playerScore.toLocaleString()}pt`;
  scoreElCPU.innerText = `CPU: ${cpuScore.toLocaleString()}pt`;
}

function updateTimeDisplay(remainingSeconds, totalSeconds = ROUND_TIME_MS / 1000) {
  const remaining = Math.max(0, remainingSeconds);
  const progress = Math.max(0, Math.min(100, (remaining / totalSeconds) * 100));
  timeEl.textContent = `TIME: ${remaining.toFixed(1)} sec`;
  timeEl.style.setProperty('--time-progress', `${progress}%`);
  timeEl.classList.toggle('danger', remaining <= 5);
}

function resetTimeDisplay() {
  updateTimeDisplay(ROUND_TIME_MS / 1000);
}

function updateComboDisplay() {
  const owner = lastComboOwner;
  const count = owner === 'player' ? earlyComboPlayer : owner === 'cpu' ? earlyComboCPU : 0;
  if (count >= 2) {
    let extraMsg = '';
    if (count === 2) extraMsg = 'AWESOME!';
    else if (count === 3) extraMsg = 'AMAZING!!';
    else if (count === 4) extraMsg = 'INCREDIBLE!!!';
    else if (count === 5) extraMsg = 'UNBELIEVABLE!!!!';
    else if (count >= 6) extraMsg = 'LEGENDARY!!!!!';
    const label = owner === 'cpu' ? 'CPU' : 'YOU';
    comboEl.innerHTML = `<span>${label} ${count} COMBO!! ${extraMsg}</span>`;
    requestAnimationFrame(() => {
      const span = comboEl.querySelector('span');
      if (span) span.classList.add('active');
    });
  } else {
    comboEl.innerHTML = '<span></span>';
  }
}

function disableCardClicks() {
  document.querySelectorAll('.card').forEach(card => { card.style.pointerEvents = 'none'; });
}

function enableCardClicks() {
  document.querySelectorAll('.card').forEach(card => {
    if (card.style.visibility !== 'hidden') card.style.pointerEvents = 'auto';
  });
}

function clearCpuTimers() {
  if (cpuActionTimer) clearTimeout(cpuActionTimer);
  if (cpuClickTimer) clearTimeout(cpuClickTimer);
  cpuActionTimer = null;
  cpuClickTimer = null;
  cpuActionScheduled = false;
  cpuPlannedAt = 0;
  cpuPlannedWait = 0;
}

function clearRoundTimers() {
  clearTimeout(roundTimer);
  clearTimeout(roundResultTimeout);
  clearInterval(timeDisplayInterval);
  cancelReadingTimeouts();
  clearCpuTimers();
}

function resetDigits() {
  [digit1Num, digit2Num, digit3Num].forEach(num => {
    num.textContent = '';
    num.style.transform = 'translateY(100%)';
    num.style.opacity = 0;
  });
}

function setOpeningControls() {
  document.body.classList.remove('game-playing');
  hideGameArea();
  startButton.style.display = 'inline-block';
  hiscoreButton.style.display = 'inline-block';
  if (cpuButton) cpuButton.style.display = 'inline-block';
  if (endlessButton) endlessButton.style.display = 'inline-block';
  if (rankingButton) rankingButton.style.display = 'inline-block';
  howToButton.style.display = 'inline-block';
  if (cpuLevelPanel) cpuLevelPanel.style.display = 'flex';
  if (cpuLevelSelect) cpuLevelSelect.disabled = false;
  quitButton.style.display = 'none';
  restartButton.style.display = 'none';
  postButton.style.display = 'none';
}

function setPlayingControls() {
  document.body.classList.add('game-playing');
  showReaderPanel();
  startButton.style.display = 'none';
  hiscoreButton.style.display = 'none';
  if (cpuButton) cpuButton.style.display = 'none';
  if (endlessButton) endlessButton.style.display = 'none';
  if (rankingButton) rankingButton.style.display = 'none';
  howToButton.style.display = 'none';
  if (cpuLevelPanel) cpuLevelPanel.style.display = 'none';
  if (cpuLevelSelect) cpuLevelSelect.disabled = true;
  quitButton.style.display = 'block';
  restartButton.style.display = 'none';
  postButton.style.display = 'none';
}

function setFinishedControls() {
  document.body.classList.remove('game-playing');
  hideGameArea();
  startButton.style.display = 'inline-block';
  hiscoreButton.style.display = 'inline-block';
  if (cpuButton) cpuButton.style.display = 'inline-block';
  if (endlessButton) endlessButton.style.display = 'inline-block';
  if (rankingButton) rankingButton.style.display = 'inline-block';
  howToButton.style.display = 'inline-block';
  if (cpuLevelPanel) cpuLevelPanel.style.display = 'flex';
  if (cpuLevelSelect) cpuLevelSelect.disabled = false;
  quitButton.style.display = 'none';
  restartButton.style.display = 'none';
  postButton.style.display = 'block';
}

function startGame() {
  closeModal(howToModal);
  closeModal(resultModal);
  const runId = ++gameRunId;
  resetCorrectSoundRate();
  if (cpuLevelSelect) cpuLevel = cpuLevelSelect.value;
  if (soundEnabled) {
    startSound.currentTime = 0;
    startSound.play();
  }
  setPlayingControls();
  setMessage('ready', 'LOADOUT', '');
  fetchCards()
    .then(fetchedCards => {
      if (runId !== gameRunId) return;
      initGame(fetchedCards, runId);
    })
    .catch(err => {
      if (runId !== gameRunId) return;
      setMessage('warning', 'LOAD FAILED', '');
      setOpeningControls();
      console.error(err);
    });
}

function initGame(fetchedCards, runId = gameRunId) {
  cards = fetchedCards;
  cards.forEach((card, index) => { card.index = index; card.used = false; });
  cardGrid.innerHTML = '';
  cardGrid.style.display = 'flex';

  cards.forEach((card, index) => {
    const div = document.createElement('div');
    div.className = 'card';
    div.dataset.index = index;
    div.dataset.ndc = card.ndc;
    div.innerText = card.subject;
    div.setAttribute('role', 'button');
    div.tabIndex = 0;
    div.addEventListener('click', selectCard);
    div.addEventListener('keydown', ev => {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        selectCard({ currentTarget: div });
      }
    });
    cardGrid.appendChild(div);
  });

  round = 0;
  playerScore = 0;
  cpuScore = 0;
  roundStartTime = 0;
  roundActive = false;
  answered = false;
  perfectGame = true;
  earlyComboPlayer = 0;
  earlyComboCPU = 0;
  lastComboOwner = null;
  earlyEligiblePlayer = true;
  earlyEligibleCPU = true;
  updateScoreDisplays();
  updateComboDisplay();
  resetTimeDisplay();
  readingEl.style.display = 'none';
  resultDisplayEl.style.display = 'none';
  battleResultEl.innerHTML = '';
  resetDigits();
  disableCardClicks();
  hideCpuCursor();
  setMessage('ready', 'STAND BY', '');
  startCountdown(runId);
}

function resetGame() {
  if (soundEnabled) {
    startSound.currentTime = 0;
    startSound.play();
  }
  closeModal(resultModal);
  quitGame(false);
  startGame();
}

function quitGame(playResetSound = false) {
  if (playResetSound && soundEnabled) {
    startSound.currentTime = 0;
    startSound.play();
  }
  gameRunId++;
  resetCorrectSoundRate();
  clearRoundTimers();
  cancelCountdown();
  cards = [];
  currentReadingCard = null;
  round = 0;
  playerScore = 0;
  cpuScore = 0;
  roundActive = false;
  answered = false;
  earlyComboPlayer = 0;
  earlyComboCPU = 0;
  lastComboOwner = null;
  updateScoreDisplays();
  updateComboDisplay();
  resetDigits();
  readingEl.style.display = 'none';
  cardGrid.innerHTML = '';
  cardGrid.style.display = 'flex';
  resetTimeDisplay();
  resultDisplayEl.style.display = 'none';
  battleResultEl.innerHTML = '';
  setMessage('', '', '');
  hideCpuCursor();
  setOpeningControls();
}

function startCountdown(runId) {
  cancelCountdown();
  readingEl.style.display = 'none';
  countdownEl.classList.add('active');
  countdownEl.textContent = '3';
  setMessage('ready', 'GET READY', '');

  const steps = [
    { delay: 1000, label: '2' },
    { delay: 2000, label: '1' },
    { delay: 3000, label: 'GO!' },
    { delay: 3450, done: true }
  ];

  steps.forEach(step => {
    countdownTimeouts.push(setTimeout(() => {
      if (runId !== gameRunId) return;
      if (step.done) {
        hideCountdown();
        nextRound();
        return;
      }
      countdownEl.classList.remove('active');
      void countdownEl.offsetWidth;
      countdownEl.textContent = step.label;
      countdownEl.classList.add('active');
    }, step.delay));
  });
}

function hideCountdown() {
  countdownEl.classList.remove('active');
  countdownEl.textContent = '';
}

function cancelCountdown() {
  countdownTimeouts.forEach(t => clearTimeout(t));
  countdownTimeouts = [];
  hideCountdown();
}

function nextRound() {
  if (round >= 10) {
    endGame();
    return;
  }

  clearRoundTimers();
  hideCountdown();
  resetDigits();
  round++;
  roundId++;
  roundActive = true;
  answered = false;
  earlyEligiblePlayer = true;
  earlyEligibleCPU = true;
  if (cpuCursorEl && cpuCursorEl.dataset) delete cpuCursorEl.dataset.initialVis;
  readingEl.style.display = 'flex';
  enableCardClicks();
  setMessage('round', `ROUND ${round}`, '');

  const available = cards.filter(card => !card.used);
  currentReadingCard = available[Math.floor(Math.random() * available.length)];
  currentReadingCard.used = true;

  if (debugMode) {
    const correctCardEl = document.querySelector(`.card[data-index="${currentReadingCard.index}"]`);
    if (correctCardEl) correctCardEl.style.borderColor = 'red';
  }

  roundStartTime = Date.now();
  roundTimer = setTimeout(roundTimeout, ROUND_TIME_MS);
  timeDisplayInterval = setInterval(() => {
    const elapsed = (Date.now() - roundStartTime) / 1000;
    const remaining = Math.max(0, (ROUND_TIME_MS / 1000) - elapsed);
    updateTimeDisplay(remaining);
  }, 100);

  readingTimeouts.push(setTimeout(() => readDigits(currentReadingCard.ndc.toString()), 1000));
}

function roundTimeout() {
  clearCpuTimers();
  if (!answered && roundActive) {
    perfectGame = false;
    roundActive = false;
    clearInterval(timeDisplayInterval);
    updateTimeDisplay(0);
    setMessage('warning', 'TIME OUT', '');
    roundResultTimeout = setTimeout(nextRound, 2000);
  }
}

function readDigits(ndc) {
  cancelReadingTimeouts();
  const digits = ndc.split('');
  readingTimeouts.push(setTimeout(() => {
    digit1Num.textContent = digits[0];
    digit1Num.style.transform = 'translateY(0)';
    digit1Num.style.opacity = 1;
    playDigitSound(digits[0]);
    maybeTriggerCpu(1);
  }, 0));
  readingTimeouts.push(setTimeout(() => {
    digit2Num.textContent = digits[1];
    digit2Num.style.transform = 'translateY(0)';
    digit2Num.style.opacity = 1;
    playDigitSound(digits[1]);
    maybeTriggerCpu(2);
  }, 2000));
  readingTimeouts.push(setTimeout(() => {
    digit3Num.textContent = digits[2];
    digit3Num.style.transform = 'translateY(0)';
    digit3Num.style.opacity = 1;
    playDigitSound(digits[2]);
    maybeTriggerCpu(3);
  }, 4000));
}

function cancelReadingTimeouts() {
  readingTimeouts.forEach(t => clearTimeout(t));
  readingTimeouts = [];
}

function selectCard(e) {
  if (!roundActive || answered) return;
  const isCPU = !!(e && e.isCPU);
  const hitCardEl = isCPU ? e.currentTarget : (getCardFromPointerEvent(e) || e.currentTarget);
  if (!hitCardEl || hitCardEl.style.visibility === 'hidden') return;
  answered = true;

  const index = hitCardEl.dataset.index;
  const selectedCard = cards[index];
  const t = Date.now() - roundStartTime;
  const isEarly = t < EARLY_WINDOW_MS;
  const canEarly = isCPU ? earlyEligibleCPU : earlyEligiblePlayer;
  const isEarlyEffective = isEarly && canEarly;

  if (selectedCard.ndc === currentReadingCard.ndc) {
    handleCorrect(hitCardEl, isCPU, t, isEarlyEffective);
  } else {
    handleMiss(hitCardEl, isCPU);
  }
}

function handleCorrect(cardEl, isCPU, t, isEarlyEffective) {
  clearCpuTimers();

  if (isCPU) {
    earlyComboPlayer = 0;
    if (isEarlyEffective) {
      earlyComboCPU = lastComboOwner === 'cpu' ? earlyComboCPU + 1 : 1;
      lastComboOwner = 'cpu';
    } else {
      earlyComboCPU = 0;
      lastComboOwner = null;
    }
  } else {
    earlyComboCPU = 0;
    if (isEarlyEffective) {
      earlyComboPlayer = lastComboOwner === 'player' ? earlyComboPlayer + 1 : 1;
      lastComboOwner = 'player';
    } else {
      earlyComboPlayer = 0;
      lastComboOwner = null;
    }
  }
  updateComboDisplay();

  const comboCount = isCPU ? earlyComboCPU : earlyComboPlayer;
  playCorrectSoundForCombo(comboCount);
  pulseBody(isCPU ? 'cpu-hit-flash' : 'hit-flash');
  roundActive = false;
  disableCardClicks();
  clearTimeout(roundTimer);
  cancelReadingTimeouts();
  clearInterval(timeDisplayInterval);
  timeEl.classList.remove('danger');

  let kimarijiBonus = 0;
  if (isEarlyEffective) {
    const earlyBonus = 1000 * Math.pow((EARLY_WINDOW_MS - t) / EARLY_WINDOW_MS, 2);
    let comboBonus = 0;
    if (comboCount >= 2) comboBonus = 500 * Math.pow(comboCount, 2) * ((EARLY_WINDOW_MS - t) / EARLY_WINDOW_MS);
    kimarijiBonus = Math.floor(earlyBonus + comboBonus);
  }

  const elapsedSec = Math.floor(t / 1000);
  const baseScore = Math.max(0, 1000 - (elapsedSec * 50));
  let specialBonusPoints = 0;
  const bonusInfo = getBonusForNdc(currentReadingCard.ndc.toString());
  if (bonusInfo) specialBonusPoints = bonusInfo.bonusPoints;
  const roundScore = baseScore + kimarijiBonus + specialBonusPoints;

  if (isCPU) cpuScore += roundScore;
  else playerScore += roundScore;
  updateScoreDisplays();

  burstFromElement(cardEl, '#2f6f7b', kimarijiBonus > 0 ? 28 : 18);
  popText(isCPU ? 'CPU GET!' : 'GET!', cardEl, '#2f6f7b');
  cardEl.classList.add('correct');
  setTimeout(() => {
    cardEl.style.visibility = 'hidden';
    cardEl.style.pointerEvents = 'none';
    if (isCPU) hideCpuCursor();
  }, 600);

  let sub = `SCORE +${roundScore.toLocaleString()}pt`;
  if (kimarijiBonus > 0) sub += ` / KIMARIJI BONUS +${kimarijiBonus.toLocaleString()}pt`;
  if (specialBonusPoints > 0) sub += ` / BONUS +${specialBonusPoints.toLocaleString()}pt`;
  setMessage('success', isCPU ? 'CPU HIT' : 'HIT', sub);

  roundResultTimeout = setTimeout(nextRound, 2000);
}

function handleMiss(cardEl, isCPU) {
  if (soundEnabled) {
    ngSound.currentTime = 0;
    ngSound.play();
  }
  resetCorrectSoundRate();
  clearCpuTimers();
  pulseBody('miss-flash');
  perfectGame = false;

  if (isCPU) {
    cpuScore = Math.max(0, cpuScore - 500);
    earlyEligibleCPU = false;
    earlyComboCPU = 0;
    lastComboOwner = earlyComboPlayer > 0 ? 'player' : null;
  } else {
    playerScore = Math.max(0, playerScore - 500);
    earlyEligiblePlayer = false;
    earlyComboPlayer = 0;
    lastComboOwner = earlyComboCPU > 0 ? 'cpu' : null;
  }
  updateScoreDisplays();
  updateComboDisplay();

  setMessage('', '', '');
  setTimeout(() => {
    setMessage('warning', isCPU ? 'CPU MISS' : 'MISS', 'SCORE -500pt');
  }, 160);

  burstFromElement(cardEl, '#9d4f58', 10);
  popText(isCPU ? 'CPU MISS' : 'MISS', cardEl, '#9d4f58');
  cardEl.classList.remove('shake');
  void cardEl.offsetWidth;
  cardEl.classList.add('shake');
  setTimeout(() => { cardEl.classList.remove('shake'); }, 300);
  if (isCPU) setTimeout(hideCpuCursor, 520);
  setTimeout(() => {
    answered = false;
    maybeTriggerCpu(getCurrentPrefixLength());
  }, 220);
}

function getCardFromPointerEvent(e) {
  if (!e || typeof e.clientX !== 'number' || typeof e.clientY !== 'number') return null;
  const hit = document.elementFromPoint(e.clientX, e.clientY);
  const card = hit && hit.closest ? hit.closest('.card') : null;
  return card && cardGrid.contains(card) ? card : null;
}

function getUniqueCandidateByPrefix(prefix) {
  const candidates = Array.from(document.querySelectorAll('.card'))
    .filter(card => card.style.visibility !== 'hidden' && String(card.dataset.ndc || '').startsWith(prefix));
  return candidates.length === 1 ? candidates[0] : null;
}

function calcSpeedFactor() {
  const visible = Array.from(document.querySelectorAll('.card')).filter(card => card.style.visibility !== 'hidden').length;
  let total = Number(cpuCursorEl.dataset.initialVis || 0);
  if (!total || total < visible) {
    total = visible;
    cpuCursorEl.dataset.initialVis = String(total);
  }
  const denom = Math.max(1, total - 1);
  const progress = Math.max(0, Math.min(1, (visible - 1) / denom));
  return 0.1 + 0.9 * progress;
}

function scheduleCpuActionToTarget(targetEl) {
  if (!targetEl || targetEl.style.visibility === 'hidden') return;
  const thisRound = roundId;
  const preset = CPU_PRESETS[cpuLevel] || CPU_PRESETS.normal;
  let wait = Math.floor(randInt(preset.reactionMinMs, preset.reactionMaxMs) * calcSpeedFactor());
  const remaining = Array.from(document.querySelectorAll('.card')).filter(card => card.style.visibility !== 'hidden').length;
  if (remaining <= 3) wait = Math.floor(wait * 0.8);

  const now = Date.now();
  if (cpuActionScheduled) {
    const remainingPrev = Math.max(0, cpuPlannedWait - (now - cpuPlannedAt));
    if (wait >= remainingPrev) return;
    if (cpuActionTimer) clearTimeout(cpuActionTimer);
    if (cpuClickTimer) clearTimeout(cpuClickTimer);
  }

  cpuActionScheduled = true;
  cpuPlannedAt = now;
  cpuPlannedWait = wait;
  cpuActionTimer = setTimeout(() => {
    if (thisRound !== roundId || !roundActive || answered) return;
    let target = targetEl;
    const activePreset = CPU_PRESETS[cpuLevel] || CPU_PRESETS.normal;
    if (Math.random() > activePreset.correctRate) {
      const others = Array.from(document.querySelectorAll('.card'))
        .filter(card => card.style.visibility !== 'hidden' && card !== targetEl);
      if (others.length) target = others[Math.floor(Math.random() * others.length)];
    }
    if (!target || target.style.visibility === 'hidden') return;
    moveCpuCursorTo(target);
    cpuClickTimer = setTimeout(() => {
      if (thisRound !== roundId || !roundActive || answered) return;
      if (!target || target.style.visibility === 'hidden') return;
      cpuClick(target);
    }, CPU_CLICK_ANIM_MS);
  }, wait);
}

function maybeTriggerCpu(prefixLen) {
  if (!roundActive || answered) return;
  let prefix = '';
  if (prefixLen >= 1 && digit1Num.textContent) prefix += digit1Num.textContent;
  if (prefixLen >= 2 && digit2Num.textContent) prefix += digit2Num.textContent;
  if (prefixLen >= 3 && digit3Num.textContent) prefix += digit3Num.textContent;
  if (!prefix) return;
  const targetEl = getUniqueCandidateByPrefix(prefix);
  if (targetEl) scheduleCpuActionToTarget(targetEl);
}

function getCurrentPrefixLength() {
  if (digit3Num.textContent) return 3;
  if (digit2Num.textContent) return 2;
  if (digit1Num.textContent) return 1;
  return 0;
}

function placeCpuCursorAt(el) {
  if (!el || !cpuCursorEl) return;
  const base = document.getElementById('karuta').getBoundingClientRect();
  const rect = el.getBoundingClientRect();
  cpuCursorEl.style.left = `${rect.left + rect.width / 2 - base.left}px`;
  cpuCursorEl.style.top = `${rect.top + rect.height / 2 - base.top}px`;
}

function moveCpuCursorTo(el) {
  if (!el || !cpuCursorEl) return;
  cpuCursorEl.style.display = 'block';
  requestAnimationFrame(() => placeCpuCursorAt(el));
}

function hideCpuCursor() {
  if (!cpuCursorEl) return;
  cpuCursorEl.style.display = 'none';
  cpuCursorEl.classList.remove('pulse');
  if (cpuCursorEl.dataset) delete cpuCursorEl.dataset.initialVis;
}

function cpuClick(el) {
  if (!el || el.style.visibility === 'hidden') return;
  if (!roundActive || answered) return;
  cpuCursorEl.classList.remove('pulse');
  void cpuCursorEl.offsetWidth;
  cpuCursorEl.classList.add('pulse');
  selectCard({ currentTarget: el, isCPU: true });
}

function pickCpuLine(outcome, level) {
  const table = CPU_LINES[outcome] && CPU_LINES[outcome][level] ? CPU_LINES[outcome][level] : null;
  if (!table || !table.length) {
    if (outcome === 'win') return '勝ちは譲れないのだよ。';
    if (outcome === 'lose') return 'ふむ、完敗だ。';
    return '次で決めよう。';
  }
  return table[Math.floor(Math.random() * table.length)];
}

function displayUsedCards() {
  const resultCards = document.getElementById('resultCards');
  const sortedCards = cards.slice().sort((a, b) => Number(a.ndc) - Number(b.ndc));
  let html = '<h2 class="resultheading">CARDS of THIS GAME</h2><ul class="cards2col">';
  sortedCards.forEach(card => {
    html += `<li><div class="highscore-entry">${esc(card.ndc)} - ${esc(card.subject)}</div></li>`;
  });
  html += '</ul>';
  resultCards.innerHTML = html;
}

function endGame() {
  clearRoundTimers();
  cancelCountdown();
  hideCpuCursor();
  if (soundEnabled) {
    resultSound.currentTime = 0;
    resultSound.play();
  }
  pulseBody('finish-flash', 900);
  roundActive = false;
  readingEl.style.display = 'none';
  cardGrid.style.display = 'none';
  timeEl.classList.remove('danger');
  setFinishedControls();

  const outcomeForPlayer = playerScore > cpuScore ? 'win' : playerScore < cpuScore ? 'lose' : 'draw';
  const outcomeForCPU = playerScore > cpuScore ? 'lose' : playerScore < cpuScore ? 'win' : 'draw';
  const resultMain = outcomeForPlayer === 'win' ? 'YOU WIN' : outcomeForPlayer === 'lose' ? 'CPU WINS' : 'DRAW';
  setMessage('finish', resultMain, `YOU ${playerScore.toLocaleString()}pt / CPU ${cpuScore.toLocaleString()}pt`);

  const preset = CPU_PRESETS[cpuLevel] || CPU_PRESETS.normal;
  const line = pickCpuLine(outcomeForCPU, cpuLevel);
  battleResultEl.innerHTML = `
    <section class="battle-summary">
      <h3>${esc(resultMain)}</h3>
      <div class="result-scoreline">
        <span>YOU: ${playerScore.toLocaleString()}pt</span>
        <span>CPU: ${cpuScore.toLocaleString()}pt</span>
      </div>
      <p class="speech ${esc(outcomeForCPU)}"><span class="by">${esc(preset.label)}</span>${esc(line)}</p>
    </section>`;
  resultDisplayEl.style.display = 'flex';
  displayUsedCards();
  showModal(resultModal);
}

function postToX() {
  const preset = CPU_PRESETS[cpuLevel] || CPU_PRESETS.normal;
  let outcomeLine = '';
  if (playerScore > cpuScore) outcomeLine = `${preset.label}に勝利！`;
  else if (playerScore < cpuScore) outcomeLine = `${preset.label}に敗北！`;
  else outcomeLine = `${preset.label}と引き分け！`;
  const scoreLine = ` #日本十進分類カルタ - YOU:${playerScore.toLocaleString()}pt / CPU:${cpuScore.toLocaleString()}pt`;
  const postText = `${outcomeLine}\n${scoreLine}\n${window.location.href}`;
  window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(postText)}`, '_blank');
}

window.karutaModes = window.karutaModes || {};
window.karutaModes.cpu = {
  startGame,
  quitGame: () => quitGame(false),
  resetGame,
  postToX,
  openRankingModal: () => showModal(rankingModal),
  showHowTo: () => showModal(howToModal),
  refreshLanding: setOpeningControls
};
})();
