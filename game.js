/* =========================
   NDCかるた — 統合スクリプト（タブ付きランキング対応版）
   ========================= */

// ===== サウンドON/OFF =====
let soundEnabled = true;
const soundToggle = document.getElementById('soundToggle');
soundToggle.addEventListener('change', e => { soundEnabled = e.target.checked; });
const THEME_KEY = 'karutaTheme';

function applyTheme() {
  document.documentElement.dataset.theme = 'dark';
  try { localStorage.setItem(THEME_KEY, 'dark'); } catch(e) {}
}

try {
  applyTheme();
} catch(e) {
  document.documentElement.dataset.theme = 'dark';
}

const correctSound = document.getElementById('correctSound');
const ngSound      = document.getElementById('ngSound');
const startSound   = document.getElementById('startSound');
const resultSound  = document.getElementById('resultSound');
const CORRECT_SOUND_BASE_RATE = 1;
const CORRECT_SOUND_RATE_STEP = 0.08;
const CORRECT_SOUND_MAX_RATE = 1.6;

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

// ===== デバッグ・ボーナス関連 =====
let debugMode = false;
let perfectGame = true;

// ===== GASエンドポイント / データURL =====
const NDC_JSON_URL = "https://raw.githubusercontent.com/Yawatosho/karuta/refs/heads/main/ndc.json";
const RANKING_BASE = "https://script.google.com/macros/s/AKfycbwXzTXXfRNm-PxZiQIRiNFyKIjPQic2picz-qPBnzTLV3abRVqE8AOnPq4gBIPsp5VApw/exec";

// ===== ゲーム状態 =====
let cards = [];
let currentReadingCard = null;
let round = 0;
let score = 0;
let roundStartTime = 0;
let roundActive = false;
let readingComplete = false;
let earlyCombo = 0;
let answered = false;
let bonusEligible = true;
let roundTimer = null;
let gameRunId = 0;

let readingTimeouts = [];
let countdownTimeouts = [];
let timeDisplayInterval = null;

let digit1Num = document.querySelector('#digit1 .num');
let digit2Num = document.querySelector('#digit2 .num');
let digit3Num = document.querySelector('#digit3 .num');

const startButton   = document.getElementById('startButton');
const hiscoreButton = document.getElementById('hiscoreButton');
const cpuButton     = document.getElementById('cpuButton'); // ★追加
const endlessButton = document.getElementById('endlessButton');
const quitButton    = document.getElementById('quitButton');
const restartButton = document.getElementById('restartButton');
const postButton    = document.getElementById('postButton');
const rankingButton = document.getElementById('rankingButton');
const howToButton   = document.getElementById('howToButton');
const messageEl     = document.getElementById('message');
const scoreEl       = document.getElementById('scoreDisplay');
const comboEl       = document.getElementById('comboDisplay');
const timeEl        = document.getElementById('timeDisplay');
const cardGrid      = document.getElementById('cardGrid');
const readingEl     = document.getElementById('reading');
const countdownEl   = document.getElementById('countdownDisplay');
const resultDisplayEl = document.getElementById('resultDisplay');
const fxLayer       = document.getElementById('fxLayer');
const rankingModal  = document.getElementById('rankingModal');
const howToModal    = document.getElementById('howToModal');
const resultModal   = document.getElementById('resultModal');
const resultScoreSummaryEl = document.getElementById('resultScoreSummary');
const highScoreEntryPanel = document.getElementById('highScoreEntryPanel');
const highScoreForm = document.getElementById('highScoreForm');
const highScoreNameInput = document.getElementById('highScoreName');
const highScoreSubmit = document.getElementById('highScoreSubmit');
const highScoreEntryStatus = document.getElementById('highScoreEntryStatus');

// 最後に使ったプレイヤー名
const LAST_PLAYER_NAME_KEY = 'lastPlayerName';

startButton.addEventListener('click', startGame);
quitButton.addEventListener('click', quitGame);
restartButton.addEventListener('click', resetGame);
postButton.addEventListener('click', postToX);
rankingButton.addEventListener('click', openRankingModal);
howToButton.addEventListener('click', () => showModal(howToModal));
if (highScoreForm) highScoreForm.addEventListener('submit', handleHighScoreSubmit);
document.querySelectorAll('[data-close-modal]').forEach(button => {
  button.addEventListener('click', () => {
    closeModal(document.getElementById(button.dataset.closeModal));
  });
});

// ===== 演出 =====
function pulseBody(className, duration = 420) {
  document.body.classList.remove(className);
  void document.body.offsetWidth;
  document.body.classList.add(className);
  setTimeout(() => document.body.classList.remove(className), duration);
}

function burstFromElement(el, color = '#ffd95f', count = 18) {
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

function popText(text, el, color = '#ffd95f') {
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

function openRankingModal() {
  const wrapper = document.getElementById('rankingWrapper');
  if (wrapper) wrapper.style.display = 'flex';
  displayHighScores();
  displayLocalHighScores();
  displayHighScoreTitle();
  showModal(rankingModal);
}

// ===== ユーティリティ =====
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}
function pad3(str) { return String(str).trim().padStart(3, '0'); }
function pickUniqueByPrefix(cards, desiredCount = 11, prefixLen = 2) {
  const picked = [];
  const used = new Set();
  for (const c of cards) {
    const p = c.ndc.substring(0, prefixLen);
    if (!used.has(p)) {
      picked.push(c);
      used.add(p);
      if (picked.length >= desiredCount) break;
    }
  }
  if (picked.length < desiredCount) {
    for (const c of cards) {
      if (!picked.includes(c)) {
        picked.push(c);
        if (picked.length >= desiredCount) break;
      }
    }
  }
  return picked;
}

// ===== JST日付ユーティリティ =====
function getTodayYMDJST() {
  const fmt = new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' });
  const parts = fmt.formatToParts(new Date());
  const y = parts.find(p => p.type === 'year').value;
  const m = parts.find(p => p.type === 'month').value;
  const d = parts.find(p => p.type === 'day').value;
  return `${y}-${m}-${d}`;
}
function getTodayYMJST() {
  const fmt = new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit' });
  const parts = fmt.formatToParts(new Date());
  const y = parts.find(p => p.type === 'year').value;
  const m = parts.find(p => p.type === 'month').value;
  return `${y}-${m}`;
}

// ===== XSS対策 =====
function esc(s){
  return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[m]));
}

// ===== 名前サニタイズ =====
function sanitizePlayerName(raw) {
  if (raw == null) return null;
  let s = String(raw).trim();
  s = s.replace(/[^A-Za-z0-9\u3040-\u30FF\u4E00-\u9FFF]/g, '');
  if (s.length > 6) s = s.substring(0, 6);
  return s.length ? s : null;
}

// ===== ランキング整形 =====
function normalizeHighScores(raw) {
  if (!raw) return [];
  return raw.map(row => {
    if (Array.isArray(row)) {
      return { name: row[0], score: Number(row[1]) || 0, date: row[2] || null };
    }
    return { name: row.name, score: Number(row.score) || 0, date: row.date || null };
  }).filter(r => r.name && Number.isFinite(r.score));
}
function topN(rows, n=10) { return rows.slice().sort((a,b)=>b.score-a.score).slice(0,n); }

// ===== ランキングURL（期間別） =====
function buildRankingURLByPeriod(period='day', ym=null, limit=10, extra={}) {
  const params = {
    action: 'getRanking',
    period,               // 'day' | 'month' | 'all'
    uniqueByName: '1',
    limit: String(limit),
    t: String(Date.now()),
    ...extra
  };
  if (period === 'day') params.date = getTodayYMDJST();
  if (period === 'month') params.ym = ym || getTodayYMJST();
  const qs = new URLSearchParams(params);
  return `${RANKING_BASE}?${qs.toString()}`;
}
// 投稿URL
function buildPostURL(name, score, extraParams = {}) {
  const qs = new URLSearchParams({
    name: name,
    score: String(score),
    date: getTodayYMDJST(),
    t: String(Date.now()),
    ...extraParams
  });
  return `${RANKING_BASE}?${qs.toString()}`;
}

function fetchJSONP(url, timeout = 12000) {
  return new Promise((resolve, reject) => {
    const callbackName = `__karutaJsonp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const separator = url.includes('?') ? '&' : '?';
    const script = document.createElement('script');
    let timer = null;

    function cleanup() {
      if (timer) clearTimeout(timer);
      delete window[callbackName];
      script.remove();
    }

    window[callbackName] = data => {
      cleanup();
      resolve(data);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error('JSONP request failed'));
    };

    timer = setTimeout(() => {
      cleanup();
      reject(new Error('JSONP request timed out'));
    }, timeout);

    script.src = `${url}${separator}callback=${encodeURIComponent(callbackName)}`;
    document.head.appendChild(script);
  });
}

// ===== タブ付きランキング描画 =====
const rankingState = {
  // id: { period: 'day'|'month'|'all', ym: 'YYYY-MM', req: number }
};
const RANK_CACHE_TTL_MS = 30_000;
const rankingMemCache = new Map(); // key -> {ts, rows}
function makeRankKey(period, ym, limit){ return `${period}:${ym || ''}:${limit}`; }

function rankingTabButtonHTML(targetId, label, period, active) {
  const activeClass = active ? ' active' : '';
  return `<button class="tab-btn${activeClass}" onclick="rankTabClick('${targetId}','${period}')">${label}</button>`;
}

// targetId 下部にタブ（Daily / Monthly / All）を配置
function renderRankingWithTabs(targetId, rows, period='day', ym=getTodayYMJST(), options={}) {
  const loading = !!options.loading;
  const el = document.getElementById(targetId);
  if (!el) return;

  let title = 'HI-SCORE RANKING';
  if (period === 'day')   title += ' (TODAY)';
  if (period === 'month') title += `(MONTH)`;
  if (period === 'all')   title += ' (ALL)';

  let listHtml = '';
  if (loading) {
    listHtml = '<p>NOW LOADING…</p>';
  } else if (!rows || rows.length === 0) {
    listHtml = '<p>まだスコアがありません。</p>';
  } else {
    listHtml = '<ol>';
    rows.forEach(r => {
      listHtml += `<li>
        <div class="highscore-entry">
          <span class="highscore-name">${esc(r.name)}</span>
          <span class="highscore-score">${r.score.toLocaleString()}pt</span>
        </div>
      </li>`;
    });
    listHtml += '</ol>';
  }

  const tabBar =
    rankingTabButtonHTML(targetId, 'Daily',   'day',   period==='day') +
    rankingTabButtonHTML(targetId, 'Monthly', 'month', period==='month') +
    rankingTabButtonHTML(targetId, 'All',     'all',   period==='all');

  // タブは下部
  el.innerHTML =
    `<h2 class="resultheading">${esc(title)}</h2>
     ${listHtml}
     <div class="rank-tabs">${tabBar}</div>`;
}

// タブクリック時：即タブを切り替え→NOW LOADING→取得→描画
window.rankTabClick = function(targetId, period) {
  const st = (rankingState[targetId] ||= { period: 'day', ym: getTodayYMDJST(), req: 0 });
  st.period = period;
  if (period === 'month' && (!st.ym || !/^\d{4}-\d{2}$/.test(st.ym))) st.ym = getTodayYMDJST();

  renderRankingWithTabs(targetId, [], st.period, st.ym, { loading: true });

  st.req++;
  fetchAndRenderRanking(targetId, st.period, st.ym, st.req);
};

// 取得関数（silent/nocache対応）
function fetchAndRenderRanking(targetId, period='day', ym=getTodayYMDJST(), reqId=null, options = {}) {
  const silent = !!options.silent;
  const forceNoCache = !!options.nocache;
  const limit = 10;
  const key = makeRankKey(period, ym, limit);
  const now = Date.now();

  const cached = forceNoCache ? null : rankingMemCache.get(key);
  if (cached && (now - cached.ts) < RANK_CACHE_TTL_MS) {
    if (!silent) renderRankingWithTabs(targetId, cached.rows, period, ym);
    return;
  }

  let url = buildRankingURLByPeriod(period, ym, limit);
  if (forceNoCache) {
    const sep = url.includes('?') ? '&' : '?';
    url = `${url}${sep}nocache=1&t=${Date.now()}`;
  }

  fetchJSONP(url)
    .then(data => {
      const st = rankingState[targetId];
      if (!st) return;
      if (reqId !== null && reqId !== st.req) return; // 世代ズレ防止

      const rows = topN(normalizeHighScores(data.highScores), limit);
      rankingMemCache.set(key, { ts: Date.now(), rows });
      if (silent) return;

      renderRankingWithTabs(targetId, rows, period, ym);
    })
    .catch(err => {
      console.error('ランキング取得エラー:', err);
      if (silent) return;
      const st = rankingState[targetId] || { period, ym };
      const el = document.getElementById(targetId);
      if (el) {
        let title = 'HI-SCORE RANKING';
        if (st.period === 'day')   title += ' (TODAY)';
        if (st.period === 'month') title += ` (${st.ym})`;
        if (st.period === 'all')   title += ' (ALL TIME)';
        const tabBar =
          rankingTabButtonHTML(targetId, 'Daily',   'day',   st.period==='day') +
          rankingTabButtonHTML(targetId, 'Monthly', 'month', st.period==='month') +
          rankingTabButtonHTML(targetId, 'All',     'all',   st.period==='all');
        el.innerHTML =
          `<h2 class="resultheading">${esc(title)}</h2>
           <p>ランキングの取得に失敗しました。</p>
           <div class="rank-tabs">${tabBar}</div>`;
      }
    });
}

function prefetchOtherPeriods(targetId){
  const st = rankingState[targetId] || { period: 'day', ym: getTodayYMDJST() };
  const ym = getTodayYMDJST();
  // 描画しない & reqを進めない
  fetchAndRenderRanking(targetId, 'month', ym, null, { silent: true });
  fetchAndRenderRanking(targetId, 'all',   null, null, { silent: true });
}

// 初期表示：Daily を NOW LOADING→取得→描画し、裏で他期間をプリフェッチ
function displayHighScores() {
  const id = 'resultRanking';
  const st = (rankingState[id] ||= { period: 'day', ym: getTodayYMDJST(), req: 0 });
  renderRankingWithTabs(id, [], st.period, st.ym, { loading: true });
  st.req++;
  fetchAndRenderRanking(id, st.period, st.ym, st.req);
  setTimeout(() => prefetchOtherPeriods(id), 0);
}
function updateResultRanking() {
  const id = 'resultRankingContainer2';
  const st = (rankingState[id] ||= { period: 'day', ym: getTodayYMDJST(), req: 0 });
  renderRankingWithTabs(id, [], st.period, st.ym, { loading: true });
  st.req++;
  fetchAndRenderRanking(id, st.period, st.ym, st.req);
  setTimeout(() => prefetchOtherPeriods(id), 0);
}

// 投稿後：表示中のタブは NOW LOADING→強制再取得、他タブはサイレントでnocache取得
function refreshRankingsAfterPost() {
  const TARGET_IDS = ['resultRanking', 'resultRankingContainer2'];
  const PERIODS = ['day','month','all'];

  // ★修正：periodごとに実際に使われうるキーを確実に削除
  function invalidateMemCacheForPeriod(period, st, limit = 10) {
    if (!rankingMemCache || typeof rankingMemCache.delete !== 'function') return;
    try {
      if (period === 'day') {
        // day は実装上、st.ym 付きのキーでキャッシュしている可能性がある
        rankingMemCache.delete(makeRankKey('day', st.ym, limit));
        rankingMemCache.delete(makeRankKey('day', null,  limit)); // 念のため両方消す
      } else if (period === 'month') {
        const ym = st.ym || getTodayYMDJST();
        rankingMemCache.delete(makeRankKey('month', ym, limit));
      } else {
        // all は ym なし
        rankingMemCache.delete(makeRankKey('all', null, limit));
      }
    } catch(e){}
  }

  TARGET_IDS.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;

    const st = (rankingState[id] ||= { period: 'day', ym: getTodayYMDJST(), req: 0 });

    // すぐタブをloadingに
    renderRankingWithTabs(id, [], st.period, st.ym, { loading: true });

    PERIODS.forEach((p) => {
      // ★修正：無効化に state を渡す
      invalidateMemCacheForPeriod(p, st);

      if (p === st.period) {
        st.req++;
        fetchAndRenderRanking(id, p, p === 'month' ? st.ym : null, st.req, { nocache: true });
      } else {
        fetchAndRenderRanking(id, p, p === 'month' ? st.ym : null, null, { nocache: true, silent: true });
      }
    });
  });
}

// ===== スコア投稿 =====
async function postHighScoreViaGET(name, score, options = { autoRefresh: true }) {
  const { autoRefresh } = options;
  const safeName = sanitizePlayerName(name);
  if (!safeName) {
    alert('名前が空か、使用不可の文字でした。別の名前でお試しください。');
    console.warn('[postHighScore] invalid name after sanitize:', name);
    return false;
  }
  const url = buildPostURL(safeName, score);
  try {
    const data = await fetchJSONP(url);
    if (data && data.result === 'success') {
      try { localStorage.setItem(LAST_PLAYER_NAME_KEY, safeName); } catch(e) {}
      if (autoRefresh) {
        // 既存の強制リフレッシュを残したいケース向け
        refreshRankingsAfterPost();
      }
      return true;
    } else if (data && data.error) {
      alert('スコア保存時にエラーが発生しました: ' + data.error);
      return false;
    } else {
      console.warn('[postHighScore] unexpected payload:', data);
      return false;
    }
  } catch (err) {
    console.error('[postHighScore] fetch error:', err);
    return false;
  }
}

// ===== ページロード時 =====
window.addEventListener('load', function() {
  displayHighScores();           // 上部ランキング（デイリーデフォルト）
  displayLocalHighScores();      // ローカルハイスコア
  displayHighScoreTitle();       // 称号
});

// ===== ndc.json セッションキャッシュ =====
const NDC_CACHE_KEY = 'ndc_json_cache_v1';
function invalidateNdcCache() { try { sessionStorage.removeItem(NDC_CACHE_KEY); } catch(e){} }
async function fetchAllCardsCached() {
  const cached = sessionStorage.getItem(NDC_CACHE_KEY);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed)) return parsed;
    } catch(e) { /* fallthrough */ }
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
  selected.forEach((c, i) => { c.used = false; c.index = i; });
  return selected;
}

// ===== ゲーム制御 =====
function resetGame() {
  if(soundEnabled) { startSound.currentTime = 0; startSound.play(); }
  resetCorrectSoundRate();
  closeModal(resultModal);
  gameRunId++;
  document.body.classList.remove('game-playing');

  cards = [];
  currentReadingCard = null;
  round = 0;
  score = 0;
  roundStartTime = 0;
  roundActive = false;
  readingComplete = false;
  earlyCombo = 0;
  answered = false;
  bonusEligible = true;
  perfectGame = true;

  cancelReadingTimeouts();
  cancelCountdown();
  clearTimeout(roundTimer);
  clearTimeout(roundResultTimeout);
  clearInterval(timeDisplayInterval);

  // 読みエリア初期化（DOMは再生成しない）
  digit1Num.textContent = ''; digit1Num.style.transform = 'translateY(100%)'; digit1Num.style.opacity = 0;
  digit2Num.textContent = ''; digit2Num.style.transform = 'translateY(100%)'; digit2Num.style.opacity = 0;
  digit3Num.textContent = ''; digit3Num.style.transform = 'translateY(100%)'; digit3Num.style.opacity = 0;
  readingEl.style.display = 'none';
  hideCountdown();

  cardGrid.innerHTML = '';

  scoreEl.style.display = 'block';
  timeEl.style.display  = 'block';
  comboEl.style.display = 'block';
  setMessage('', '', '');
  scoreEl.innerText     = 'SCORE: 0pt';
  timeEl.innerText      = 'TIME: 15.0 sec';
  timeEl.classList.remove('danger');
  comboEl.innerText     = '';
  cardGrid.style.display = 'flex';
  startButton.style.display = 'inline-block';  // ★GAME START 再表示
  if (hiscoreButton) hiscoreButton.style.display = 'inline-block';
  cpuButton.style.display   = 'inline-block';  // ★VS CPU MODE も同タイミングで表示
  if (endlessButton) endlessButton.style.display = 'inline-block';
  rankingButton.style.display = 'inline-block';
  howToButton.style.display = 'inline-block';
  quitButton.style.display   = 'none';
  restartButton.style.display= 'none';
  postButton.style.display   = 'none';

  // RETRY時はランキングWrapperは表示しない
  document.getElementById('rankingWrapper').style.display = 'none';
}

function quitGame() {
  resetCorrectSoundRate();
  gameRunId++;
  document.body.classList.remove('game-playing');
  cards = [];
  currentReadingCard = null;
  round = 0;
  score = 0;
  roundStartTime = 0;
  roundActive = false;
  readingComplete = false;
  earlyCombo = 0;
  answered = false;
  bonusEligible = true;
  perfectGame = true;

  cancelReadingTimeouts();
  cancelCountdown();
  clearTimeout(roundTimer);
  clearTimeout(roundResultTimeout);
  clearInterval(timeDisplayInterval);

  digit1Num.textContent = ''; digit1Num.style.transform = 'translateY(100%)'; digit1Num.style.opacity = 0;
  digit2Num.textContent = ''; digit2Num.style.transform = 'translateY(100%)'; digit2Num.style.opacity = 0;
  digit3Num.textContent = ''; digit3Num.style.transform = 'translateY(100%)'; digit3Num.style.opacity = 0;
  readingEl.style.display = 'none';
  hideCountdown();

  cardGrid.innerHTML = '';
  cardGrid.style.display = 'flex';
  scoreEl.style.display = 'block';
  timeEl.style.display  = 'block';
  comboEl.style.display = 'block';
  setMessage('', '', '');
  scoreEl.innerText = 'SCORE: 0pt';
  timeEl.innerText = 'TIME: 15.0 sec';
  timeEl.classList.remove('danger');
  comboEl.innerText = '';

  startButton.style.display = 'inline-block';
  if (hiscoreButton) hiscoreButton.style.display = 'inline-block';
  cpuButton.style.display = 'inline-block';
  if (endlessButton) endlessButton.style.display = 'inline-block';
  rankingButton.style.display = 'inline-block';
  howToButton.style.display = 'inline-block';
  quitButton.style.display = 'none';
  restartButton.style.display = 'none';
  postButton.style.display = 'none';
}

function startGame() {
  // ★ゲーム開始時のみ結果エリアを隠す（RETRY時は隠さない）
  if (resultDisplayEl) resultDisplayEl.style.display = 'none';
  closeModal(rankingModal);
  closeModal(howToModal);
  closeModal(resultModal);

  const runId = ++gameRunId;
  document.body.classList.add('game-playing');
  resetCorrectSoundRate();
  if(soundEnabled) { startSound.currentTime = 0; startSound.play(); }
  startButton.style.display = 'none';      // ★GAME START 非表示
  if (hiscoreButton) hiscoreButton.style.display = 'none';
  cpuButton.style.display   = 'none';      // ★VS CPU MODE も同タイミングで非表示
  if (endlessButton) endlessButton.style.display = 'none';
  rankingButton.style.display = 'none';
  howToButton.style.display = 'none';
  quitButton.style.display  = 'block';
  document.getElementById('rankingWrapper').style.display = 'none';
  setMessage('ready', 'LOADOUT', '');
  fetchCards().then(fetchedCards => {
    if (runId !== gameRunId) return;
    initGame(fetchedCards, runId);
  }).catch(err => {
    if (runId !== gameRunId) return;
    setMessage('warning', 'LOAD FAILED', '');
    console.error(err);
  });
}

function initGame(fetchedCards, runId = gameRunId) {
  cards = fetchedCards;
  cards.forEach((card, index) => { card.index = index; });
  cardGrid.innerHTML = '';
  cardGrid.style.display = 'flex';
  cards.forEach((card, index) => {
    const div = document.createElement('div');
    div.className = 'card';
    div.dataset.index = index;
    div.innerText = card.subject;
    div.setAttribute('role','button');
    div.tabIndex = 0;
    div.addEventListener('click', selectCard);
    div.addEventListener('keydown', ev => {
      if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); selectCard({ currentTarget: div }); }
    });
    cardGrid.appendChild(div);
  });
  setMessage('ready', 'STAND BY', '');
  round = 0;
  score = 0;
  updateScoreDisplay();
  earlyCombo = 0;
  updateComboDisplay();
  perfectGame = true;
  readingEl.style.display = 'none';
  disableCardClicks();
  startCountdown(runId);
}

function nextRound() {
  if (round >= 10) { endGame(); return; }
  hideCountdown();
  readingEl.style.display = 'flex';
  cancelReadingTimeouts();
  clearInterval(timeDisplayInterval);

  digit1Num.textContent = ''; digit1Num.style.transform='translateY(100%)'; digit1Num.style.opacity=0;
  digit2Num.textContent = ''; digit2Num.style.transform='translateY(100%)'; digit2Num.style.opacity=0;
  digit3Num.textContent = ''; digit3Num.style.transform='translateY(100%)'; digit3Num.style.opacity=0;

  round++;
  roundActive = true;
  answered = false;
  readingComplete = false;
  bonusEligible = true;
  enableCardClicks();
  setMessage('round', `ROUND ${round}`, '');

  let availableCards = cards.filter(card => !card.used);
  currentReadingCard = availableCards[Math.floor(Math.random() * availableCards.length)];
  currentReadingCard.used = true;

  if (debugMode) {
    let correctCardEl = document.querySelector(`.card[data-index="${currentReadingCard.index}"]`);
    if (correctCardEl) { correctCardEl.style.borderColor = 'red'; }
  }

  roundStartTime = Date.now();
  roundTimer = setTimeout(roundTimeout, 15000);

  timeDisplayInterval = setInterval(() => {
    let elapsed = (Date.now() - roundStartTime) / 1000;
    let remaining = Math.max(0, 15 - elapsed);
    timeEl.innerText = 'TIME: ' + remaining.toFixed(1) + ' sec';
    timeEl.classList.toggle('danger', remaining <= 5);
  }, 100);

  readingTimeouts.push(setTimeout(() => { readDigits(currentReadingCard.ndc.toString()); }, 1000));
}

function roundTimeout() {
  if (!answered && roundActive) {
    perfectGame = false;
    roundActive = false;
    clearInterval(timeDisplayInterval);
    setMessage('warning', 'TIME OUT', '');
    clearTimeout(roundResultTimeout);
    roundResultTimeout = setTimeout(nextRound, 2000);
  }
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
  if (!countdownEl) return;
  countdownEl.classList.remove('active');
  countdownEl.textContent = '';
}

function cancelCountdown() {
  countdownTimeouts.forEach(t => clearTimeout(t));
  countdownTimeouts = [];
  hideCountdown();
}

function readDigits(ndc) {
  readingComplete = false;
  cancelReadingTimeouts();
  const digits = ndc.split('');
  readingTimeouts.push(setTimeout(() => {
    digit1Num.textContent = digits[0];
    digit1Num.style.transform = 'translateY(0)';
    digit1Num.style.opacity = 1;
  }, 0));
  readingTimeouts.push(setTimeout(() => {
    digit2Num.textContent = digits[1];
    digit2Num.style.transform = 'translateY(0)';
    digit2Num.style.opacity = 1;
  }, 2000));
  readingTimeouts.push(setTimeout(() => {
    digit3Num.textContent = digits[2];
    digit3Num.style.transform = 'translateY(0)';
    digit3Num.style.opacity = 1;
    readingComplete = true;
  }, 4000));
}

function cancelReadingTimeouts() {
  readingTimeouts.forEach(t => clearTimeout(t));
  readingTimeouts = [];
}

// ===== 選択処理 =====
let roundResultTimeout = null;
function selectCard(e) {
  if (!roundActive || answered) return;
  answered = true;

  const hitCardEl = getCardFromPointerEvent(e) || e.currentTarget;
  const index = hitCardEl.dataset.index;
  const selectedCard = cards[index];
  const now = Date.now();
  let bonus = 0;
  let t = now - roundStartTime;

  if (bonusEligible && t < 6000) {
    let earlyBonus = 1000 * Math.pow((6000 - t) / 6000, 2);
    earlyCombo++;
    let comboBonus = 0;
    if (earlyCombo >= 2) {
      comboBonus = 500 * Math.pow(earlyCombo, 2) * ((6000 - t) / 6000);
    }
    bonus = earlyBonus + comboBonus;
  } else {
    earlyCombo = 0;
  }
  bonus = Math.floor(bonus);
  updateComboDisplay();

  if (selectedCard.ndc === currentReadingCard.ndc) {
    playCorrectSoundForCombo(earlyCombo);
    pulseBody('hit-flash');
    roundActive = false;
    disableCardClicks();
    clearTimeout(roundTimer);
    cancelReadingTimeouts();
    clearInterval(timeDisplayInterval);

    let elapsedSec = Math.floor(t / 1000);
    let baseScore = Math.max(0, 1000 - (elapsedSec * 50));
    let roundScore = baseScore + bonus;

    let specialBonusPoints = 0;
    if (bonusEligible) {
      const bonusInfo = getBonusForNdc(currentReadingCard.ndc.toString());
      if (bonusInfo) {
        roundScore += bonusInfo.bonusPoints;
        specialBonusPoints = bonusInfo.bonusPoints;
      }
    }

    score += roundScore;
    updateScoreDisplay();

    const cardEl = hitCardEl;
    if (cardEl) {
      burstFromElement(cardEl, bonus > 0 ? '#ffd95f' : '#69ffb3', bonus > 0 ? 28 : 18);
      popText(bonus > 0 ? 'BONUS!' : 'GET!', cardEl, bonus > 0 ? '#ffd95f' : '#69ffb3');
      cardEl.classList.add('correct');
      setTimeout(() => {
        cardEl.style.visibility = 'hidden';
        cardEl.style.pointerEvents = 'none';
      }, 600);
    }
    let resultSub = `SCORE +${roundScore.toLocaleString()}pt`;
    if (bonus > 0) resultSub += ` / KIMARIJI BONUS +${bonus.toLocaleString()}pt`;
    if (specialBonusPoints > 0) resultSub += ` / BONUS +${specialBonusPoints.toLocaleString()}pt`;
    setMessage('success', 'HIT', resultSub);

    clearTimeout(roundResultTimeout);
    roundResultTimeout = setTimeout(nextRound, 2000);

  } else {
    if(soundEnabled) { ngSound.currentTime = 0; ngSound.play(); }
    resetCorrectSoundRate();
    pulseBody('miss-flash');
    perfectGame = false;
    score -= 500;
    if (score < 0) score = 0;
    updateScoreDisplay();

    earlyCombo = 0;
    updateComboDisplay();
    bonusEligible = false;
    readingComplete = true;
    setMessage('', '', '');
    setTimeout(() => { setMessage('warning', 'MISS', 'SCORE -500pt'); }, 200);

    const cardEl = hitCardEl;
    if (cardEl) {
      burstFromElement(cardEl, '#ff4c6a', 10);
      popText('MISS', cardEl, '#ff4c6a');
      cardEl.classList.remove('shake'); void cardEl.offsetWidth;
      cardEl.classList.add('shake');
      setTimeout(() => { cardEl.classList.remove('shake'); }, 300);
    }
    setTimeout(() => { answered = false; }, 200);
  }
}

function getCardFromPointerEvent(e) {
  if (typeof e.clientX !== 'number' || typeof e.clientY !== 'number') return null;
  const hit = document.elementFromPoint(e.clientX, e.clientY);
  const card = hit && hit.closest ? hit.closest('.card') : null;
  return card && cardGrid.contains(card) ? card : null;
}

// ===== ボーナステーブル =====
const bonusTable = [
  { ndc: "417", bonusPoints: 4170, bonusName: "417ボーナス" },
  { ndc: "777", bonusPoints: 10000, bonusName: "ラッキー7" },
  { ndc: "913", bonusPoints: 10000, bonusName: "一番有名な分類？ボーナス" },
  { ndc: "111", bonusPoints: 10000, bonusName: "ゾロ目ボーナス" },
  { ndc: "222", bonusPoints: 10000, bonusName: "ゾロ目ボーナス" },
  { ndc: "333", bonusPoints: 10000, bonusName: "ゾロ目ボーナス" },
  { ndc: "444", bonusPoints: 10000, bonusName: "ゾロ目ボーナス" },
  { ndc: "555", bonusPoints: 10000, bonusName: "ゾロ目ボーナス" },
  { ndc: "666", bonusPoints: 10000, bonusName: "ゾロ目ボーナス" },
  { ndc: "888", bonusPoints: 10000, bonusName: "ゾロ目ボーナス" },
  { ndc: "999", bonusPoints: 10000, bonusName: "ゾロ目ボーナス" },
  { ndc: "000", bonusPoints: 10000, bonusName: "ゾロ目ボーナス" },
　{ ndc: "012", bonusPoints: 10000, bonusName: "連番ボーナス" },
　{ ndc: "123", bonusPoints: 10000, bonusName: "連番ボーナス" },
　{ ndc: "234", bonusPoints: 10000, bonusName: "連番ボーナス" },
　{ ndc: "345", bonusPoints: 10000, bonusName: "連番ボーナス" },
　{ ndc: "456", bonusPoints: 10000, bonusName: "連番ボーナス" },
　{ ndc: "567", bonusPoints: 10000, bonusName: "連番ボーナス" },
　{ ndc: "678", bonusPoints: 10000, bonusName: "連番ボーナス" },
　{ ndc: "789", bonusPoints: 10000, bonusName: "連番ボーナス" },
　{ ndc: "100", bonusPoints: 10000, bonusName: "ジャスト100ボーナス" },
  { ndc: "200", bonusPoints: 10000, bonusName: "ジャスト200ボーナス" },
  { ndc: "300", bonusPoints: 10000, bonusName: "ジャスト300ボーナス" },
  { ndc: "400", bonusPoints: 10000, bonusName: "ジャスト400ボーナス" },
  { ndc: "500", bonusPoints: 10000, bonusName: "ジャスト500ボーナス" },
  { ndc: "600", bonusPoints: 10000, bonusName: "ジャスト600ボーナス" },
  { ndc: "700", bonusPoints: 10000, bonusName: "ジャスト700ボーナス" },
  { ndc: "800", bonusPoints: 10000, bonusName: "ジャスト800ボーナス" },
  { ndc: "900", bonusPoints: 10000, bonusName: "ジャスト900ボーナス" },
  { ndc: "007", bonusPoints: 10000, bonusName: "007ボーナス" },
  { ndc: "010", bonusPoints: 10000, bonusName: "我らが図書館学" }
];
function getBonusForNdc(ndc) { return bonusTable.find(item => item.ndc === ndc); }

// ===== UIユーティリティ =====
function updateScoreDisplay() { scoreEl.innerText = 'SCORE: ' + score.toLocaleString() + 'pt'; }
function updateComboDisplay() {
  if (earlyCombo >= 2) {
    let extraMsg = "";
    if (earlyCombo === 2) extraMsg = "AWESOME!";
    else if (earlyCombo === 3) extraMsg = "AMAZING!!";
    else if (earlyCombo === 4) extraMsg = "INCREDIBLE!!!";
    else if (earlyCombo === 5) extraMsg = "UNBELIEVABLE!!!!";
    else if (earlyCombo >= 6) extraMsg = "LEGENDARY!!!!!";
    comboEl.innerHTML = '<span>' + earlyCombo + ' COMBO!! ' + extraMsg + '</span>';
    requestAnimationFrame(() => { comboEl.querySelector('span').classList.add('active'); });
  } else {
    comboEl.innerHTML = '<span></span>';
  }
}
function disableCardClicks() { document.querySelectorAll('.card').forEach(card => { card.style.pointerEvents = 'none'; }); }
function enableCardClicks() {
  document.querySelectorAll('.card').forEach(card => {
    if (card.style.visibility !== 'hidden') { card.style.pointerEvents = 'auto'; }
  });
}

// ===== ローカルハイスコア =====
const LOCAL_HIGH_SCORES_KEY = 'localHighScores';
function loadLocalHighScores() {
  const scores = localStorage.getItem(LOCAL_HIGH_SCORES_KEY);
  return scores ? JSON.parse(scores) : [];
}
function saveLocalHighScores(scores) {
  localStorage.setItem(LOCAL_HIGH_SCORES_KEY, JSON.stringify(scores));
}
function updateLocalHighScores(newScore) {
  let scores = loadLocalHighScores();
  scores.push({ score: newScore, date: new Date().toISOString() });
  scores.sort((a, b) => b.score - a.score);
  scores = scores.slice(0, 5);
  saveLocalHighScores(scores);
}
function displayLocalHighScores() {
  const scores = loadLocalHighScores();
  let html = '<h2 class="resultheading">YOUR HI-SCORES</h2>';
  if (scores.length === 0) {
    html += '<p>まだハイスコアはありません。</p>';
  } else {
    html += '<ol>';
    scores.forEach(entry => {
      const dateOnly = new Date(entry.date).toLocaleDateString();
      html += `<li><div class="highscore-entry">${entry.score.toLocaleString()}pt - ${dateOnly}</div></li>`;
    });
    html += '</ol>';
  }
  document.getElementById('localHighScoreDisplay').innerHTML = html;
}
function displayLocalHighScores2() {
  const scores = loadLocalHighScores();
  let html = '<h2 class="resultheading">YOUR HI-SCORES</h2>';
  if (scores.length === 0) {
    html += '<p>まだハイスコアはありません。</p>';
  } else {
    html += '<ol>';
    scores.forEach(entry => {
      const dateOnly = new Date(entry.date).toLocaleDateString();
      html += `<li><div class="highscore-entry">${entry.score.toLocaleString()}pt - ${dateOnly}</div></li>`;
    });
    html += '</ol>';
  }
  document.getElementById('localHighScoreDisplay_result').innerHTML = html;
}

// ===== 称号 =====
function getTitleForHighScore() {
  const scores = loadLocalHighScores();
  if (scores.length === 0) return "未挑戦";
  let highest = scores.reduce((max, entry) => Math.max(max, entry.score), 0);
  if (highest >= 250000) return "Grandmaster of Classification";
  else if (highest >= 200000) return "Master of Classification";
  else if (highest >= 150000) return "Expert of Classification";
  else if (highest >= 110000) return "Scholar of Classification";
  else if (highest >= 80000)  return "Adept of Classification";
  else if (highest >= 50000)  return "Practitioner of Classification";
  else if (highest >= 30000)  return "Novice of Classification";
  else if (highest >= 10000)  return "Beginner of Classification";
  else return "Starter of Classification";
}
function displayHighScoreTitle() {
  const title = getTitleForHighScore();
  document.getElementById('highScoreTitleDisplay').innerHTML = `<h5>Rank：${title}</h5>`;
}
function displayHighScoreTitle2() {
  const title = getTitleForHighScore();
  document.getElementById('highScoreTitleDisplay_result').innerHTML = `<h5>Rank：${title}</h5>`;
}

// ===== 結果表示・SNS =====
function displayUsedCards() {
  const resultCards = document.getElementById('resultCards');
  const sortedCards = cards.slice().sort((a, b) => Number(a.ndc) - Number(b.ndc));
  let html = '<h2 class=resultheading>CARDS of THIS GAME</h2><ul>';
  sortedCards.forEach(card => {
    html += `<li><div class="highscore-entry">${esc(card.ndc)} - ${esc(card.subject)}</div></li>`;
  });
  html += '</ul>';
  resultCards.innerHTML = html;
}
function postToX() {
  const gameName = " #日本十進分類カルタ";
  const postText = gameName + " - スコア: " + score.toLocaleString() + "pt\n" + window.location.href;
  const postUrl = "https://twitter.com/intent/tweet?text=" + encodeURIComponent(postText);
  window.open(postUrl, '_blank');
}

function endGame() {
  if(soundEnabled) { resultSound.currentTime = 0; resultSound.play(); }
  pulseBody('finish-flash', 900);
  document.body.classList.remove('game-playing');
  clearTimeout(roundResultTimeout);
  cancelReadingTimeouts();
  clearTimeout(roundTimer);
  clearInterval(timeDisplayInterval);
  readingEl.style.display = 'none';
  cancelCountdown();
  cardGrid.style.display  = 'none';
  scoreEl.style.display   = 'none';
  timeEl.style.display    = 'none';
  comboEl.style.display   = 'none';
  rankingButton.style.display = 'inline-block';
  howToButton.style.display = 'inline-block';
  if (hiscoreButton) hiscoreButton.style.display = 'inline-block';
  cpuButton.style.display = 'inline-block';
  if (endlessButton) endlessButton.style.display = 'inline-block';
  quitButton.style.display = 'none';
  restartButton.style.display = 'block';
  postButton.style.display    = 'block';

  if (perfectGame) {
    score *= 2;
    setMessage('finish', 'PERFECT CLEAR', `SCORE ${score.toLocaleString()}pt / BONUS x2`);
  } else {
    setMessage('finish', 'MISSION COMPLETE', `SCORE ${score.toLocaleString()}pt`);
  }
  renderResultScoreSummary(perfectGame);
  hideHighScoreEntryPanel();

  const resultDisplay = document.getElementById('resultDisplay');
  resultDisplay.style.display = 'flex';
  displayUsedCards();

  // ★右カラムは表示するが、このタイミングでは取得しない（ローディングだけ）
  (function showRankingLoadingSkeleton(){
    const id = 'resultRankingContainer2';
    const st = (rankingState[id] ||= { period: 'day', ym: getTodayYMDJST(), req: 0 });
    renderRankingWithTabs(id, [], st.period, st.ym, { loading: true }); // ←「NOW LOADING…」を表示
  })();

  // ここでは取得しない
  // updateResultRanking(); ←呼ばない

  updateLocalHighScores(score);
  displayLocalHighScores2();
  displayHighScoreTitle2();
  showModal(resultModal);

  // ★A案：rAF×2 で描画完了後に「入賞判定→（未入賞なら即取得／入賞ならモーダル内で名前入力）」
  const runHighScoreFlow = () => {
    checkHighScore(score)
      .then((qualifies) => {
        if (!qualifies) {
          hideHighScoreEntryPanel();
          updateResultRanking();
          displayHighScores();
          return;
        }
        showHighScoreEntryForm();
        updateResultRanking();
        displayHighScores();
      })
      .catch(err => {
        console.error('[runHighScoreFlow] error:', err);
        updateResultRanking();
        displayHighScores();
      });
  };
  requestAnimationFrame(() => requestAnimationFrame(runHighScoreFlow));
}

function renderResultScoreSummary(isPerfectClear) {
  if (!resultScoreSummaryEl) return;
  const note = isPerfectClear ? 'PERFECT CLEAR / BONUS x2' : 'MISSION COMPLETE';
  resultScoreSummaryEl.innerHTML =
    `<div class="result-score-summary">
      <p class="score-label">YOUR SCORE</p>
      <p class="score-value">${score.toLocaleString()}pt</p>
      <p class="score-note">${esc(note)}</p>
    </div>`;
}

function resetHighScoreEntryPanel(status = '') {
  if (!highScoreEntryPanel) return;
  highScoreEntryPanel.hidden = false;
  if (highScoreNameInput) {
    highScoreNameInput.value = '';
    highScoreNameInput.disabled = true;
  }
  if (highScoreSubmit) highScoreSubmit.disabled = true;
  if (highScoreEntryStatus) highScoreEntryStatus.textContent = status;
}

function hideHighScoreEntryPanel() {
  if (!highScoreEntryPanel) return;
  highScoreEntryPanel.hidden = true;
  if (highScoreEntryStatus) highScoreEntryStatus.textContent = '';
}

function showHighScoreEntryForm() {
  if (!highScoreEntryPanel) return;
  highScoreEntryPanel.hidden = false;
  if (highScoreNameInput) {
    highScoreNameInput.disabled = false;
    highScoreNameInput.value = localStorage.getItem(LAST_PLAYER_NAME_KEY) || 'Anonymous';
    highScoreNameInput.focus();
    highScoreNameInput.select();
  }
  if (highScoreSubmit) {
    highScoreSubmit.disabled = false;
    highScoreSubmit.textContent = 'SUBMIT';
  }
  if (highScoreEntryStatus) highScoreEntryStatus.textContent = 'Daily ranking entry. Up to 6 characters.';
}

async function handleHighScoreSubmit(e) {
  e.preventDefault();
  if (!highScoreNameInput || !highScoreSubmit) return;
  const safeName = sanitizePlayerName(highScoreNameInput.value);
  if (!safeName) {
    if (highScoreEntryStatus) highScoreEntryStatus.textContent = 'Use letters, numbers, kana, or kanji. Max 6 characters.';
    highScoreNameInput.focus();
    return;
  }
  highScoreNameInput.value = safeName;
  highScoreNameInput.disabled = true;
  highScoreSubmit.disabled = true;
  highScoreSubmit.textContent = 'SENDING';
  if (highScoreEntryStatus) highScoreEntryStatus.textContent = 'Submitting score...';
  const ok = await postHighScoreViaGET(safeName, score, { autoRefresh: false });
  if (ok) {
    if (highScoreEntryStatus) highScoreEntryStatus.textContent = 'Score recorded.';
    highScoreSubmit.textContent = 'DONE';
    updateResultRanking();
    displayHighScores();
  } else {
    highScoreNameInput.disabled = false;
    highScoreSubmit.disabled = false;
    highScoreSubmit.textContent = 'SUBMIT';
    if (highScoreEntryStatus) highScoreEntryStatus.textContent = 'Submit failed. Please try again.';
  }
}

// ===== 入賞判定（クライアント側・当日だけ） =====
function checkHighScore(currentScore) {
  const url = buildRankingURLByPeriod('day', getTodayYMJST(), 10);
  return fetchJSONP(url)
    .then(data => {
      let rows = topN(normalizeHighScores(data.highScores), 10);
      if (rows.length < 10) return true;
      const lowest = rows[rows.length - 1]?.score ?? 0;
      return currentScore > lowest;
    })
    .catch(err => {
      console.error('[checkHighScore] 判定エラー:', err);
      return false;
    });
}
