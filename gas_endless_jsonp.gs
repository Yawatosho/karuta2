/** ====== 設定 ====== */
const SHEET_ID        = '1lggOy0j_PEfVOJy2Kxp0aWTnP2vn7cM8NRwqtMFtM4k';
const SHEET_NAME      = 'Endless';
const CACHE_TTL_SEC   = 30;
const TZ              = 'Asia/Tokyo';
const DEFAULT_LIMIT   = 10;
const MAX_LIMIT       = 100;
const SCORE_MAX       = 100000000;

const RANK_KEY_COMMON = (id, unique, limit) => 'rank_' + id + '_u' + (unique ? '1' : '0') + '_l' + limit;

/** ===== グローバル参照キャッシュ ===== */
let _ss, _sheet;
function getSheet_() {
  if (_sheet) return _sheet;
  _ss = _ss || SpreadsheetApp.openById(SHEET_ID);
  _sheet = _ss.getSheetByName(SHEET_NAME);
  return _sheet;
}

/** ===== HTMLエスケープ（レスポンス直前で使う） ===== */
function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/** ===== JSTの YYYY-MM-DD 文字列へ正規化 ===== */
function toYmdJst(value) {
  try {
    const d = (value instanceof Date) ? value : new Date(value);
    return Utilities.formatDate(d, TZ, 'yyyy-MM-dd');
  } catch (e) {
    return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
  }
}
function todayYmdJst() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'); }
function todayYmJst()  { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM'); }
function isYmd(s)      { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s); }
function isYm(s)       { return typeof s === 'string' && /^\d{4}-\d{2}$/.test(s); }
function toScore(n)    { var v = Number(n); return Number.isFinite(v) ? v : NaN; }

/** ===== レスポンス共通 ===== */
function isSafeCallback_(callback) {
  return typeof callback === 'string' &&
    /^[A-Za-z_$][0-9A-Za-z_$]*(?:\.[A-Za-z_$][0-9A-Za-z_$]*)*$/.test(callback);
}

function textOutput_(json, callback) {
  if (isSafeCallback_(callback)) {
    return ContentService
      .createTextOutput(callback + '(' + json + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

function respond(payload, callback) {
  return textOutput_(JSON.stringify(payload), callback);
}

/** ===== 同名ベストのみ残す ===== */
function dedupeByNameKeepBest(rows) {
  const map = Object.create(null);
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i], key = r.name;
    if (!map[key] || r.score > map[key].score) map[key] = r;
  }
  const out = [];
  for (const k in map) out.push(map[k]);
  return out;
}

/** ===== 全件取得（シート→正規化） ===== */
function getScoresForAll_() {
  const sheet = getSheet_();
  const lastRow = sheet.getLastRow();
  const rows = [];
  if (lastRow < 2) return rows;

  const values = sheet.getRange(2, 1, lastRow - 1, 3).getValues();
  for (let i = 0; i < values.length; i++) {
    const [nameRaw, scoreRaw, dateCell] = values[i];
    if (!nameRaw) continue;
    const s = toScore(scoreRaw);
    if (!Number.isFinite(s)) continue;
    const ymdRow = (dateCell instanceof Date) ? toYmdJst(dateCell)
                 : (isYmd(dateCell) ? dateCell : toYmdJst(dateCell));
    if (!isYmd(ymdRow)) continue;
    rows.push({ name: String(nameRaw), score: s, date: ymdRow });
  }
  return rows;
}

/** ===== 投稿を反映したキャッシュのライトスルー更新 ===== */
function writeThroughCacheDayTop10_(ymd, justInserted) {
  try {
    const cache = CacheService.getScriptCache();
    const key = RANK_KEY_COMMON('d:' + ymd, true, 10);
    const current = cache.get(key);
    if (!current) return;

    const parsed = JSON.parse(current);
    const rows = (parsed && parsed.highScores)
      ? parsed.highScores.map(a => ({ name: a[0], score: a[1], date: a[2] }))
      : [];
    rows.push(justInserted);

    const after = dedupeByNameKeepBest(rows).sort((a,b) => b.score - a.score).slice(0, 10);
    const payload = {
      highScores: after.map(r => [escapeHtml(r.name), r.score, r.date]),
      result: 'success',
      meta: { period: 'day', date: ymd, uniqueByName: true, limit: 10, cache_hit: true, updated_by_write: true }
    };
    cache.put(key, JSON.stringify(payload), CACHE_TTL_SEC);
  } catch (e) {}
}

/** ===== 本体 ===== */
function doGet(e) {
  const started = Date.now();
  e = e || { parameter: {} };
  const p = e.parameter || {};
  const callback = p.callback;

  if (p.name && p.score) {
    if (!/^\d+$/.test(p.score)) {
      return respond({ error: 'Invalid score' }, callback);
    }
    const score = parseInt(p.score, 10);
    if (score < 0 || score > SCORE_MAX) {
      return respond({ error: 'Out of range score' }, callback);
    }

    let playerName = String(p.name).replace(/[^A-Za-z0-9\u3040-\u30FF\u4E00-\u9FFF]/g, '');
    if (playerName.length > 6) playerName = playerName.substring(0, 6);
    if (!playerName) return respond({ error: 'Invalid name' }, callback);

    const ymd = isYmd(p.date) ? p.date : todayYmdJst();

    const lock = LockService.getScriptLock();
    try {
      lock.waitLock(5000);
      const sheet = getSheet_();
      sheet.appendRow([playerName, score, ymd]);
    } catch (err) {
      return respond({ error: 'Write failed: ' + err }, callback);
    } finally {
      try { lock.releaseLock(); } catch (e2) {}
    }

    try { writeThroughCacheDayTop10_(ymd, { name: playerName, score: score, date: ymd }); } catch(e3) {}

    const processing_ms = Date.now() - started;
    return respond({ result: 'success', meta: { date: ymd, processing_ms } }, callback);
  }

  const period = (p.period || 'day');
  const targetDate = isYmd(p.date) ? p.date : todayYmdJst();
  const ymParam = (p.ym && isYm(p.ym)) ? p.ym : todayYmJst();
  const uniqueFlag = (String(p.uniqueByName || '1') !== '0');
  const limit = Math.max(1, Math.min(MAX_LIMIT, parseInt(p.limit || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT));
  const nocache = String(p.nocache || '0') === '1';

  const cacheKey = (function() {
    if (period === 'day')   return RANK_KEY_COMMON('d:' + targetDate, uniqueFlag, limit);
    if (period === 'month') return RANK_KEY_COMMON('m:' + ymParam, uniqueFlag, limit);
    return RANK_KEY_COMMON('a:all', uniqueFlag, limit);
  })();
  const cache = CacheService.getScriptCache();

  if (!nocache) {
    const hit = cache.get(cacheKey);
    if (hit) return textOutput_(hit, callback);
  }

  let rowsAll = getScoresForAll_();
  let rows;
  if (period === 'day') {
    rows = rowsAll.filter(r => r.date === targetDate);
  } else if (period === 'month') {
    rows = rowsAll.filter(r => r.date.slice(0, 7) === ymParam);
  } else {
    rows = rowsAll;
  }

  if (uniqueFlag) rows = dedupeByNameKeepBest(rows);

  rows.sort((a,b) => b.score - a.score);
  rows = rows.slice(0, limit);

  const payload = {
    highScores: rows.map(r => [escapeHtml(r.name), r.score, r.date]),
    result: 'success',
    meta: {
      period: period,
      date: (period === 'day' ? targetDate : null),
      ym: (period === 'month' ? ymParam : null),
      uniqueByName: uniqueFlag,
      limit: limit
    }
  };
  const json = JSON.stringify(payload);

  if (!nocache) {
    try { cache.put(cacheKey, json, CACHE_TTL_SEC); } catch(e) {}
  }

  return textOutput_(json, callback);
}
