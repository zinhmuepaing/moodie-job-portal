// db/loader.js — XLSX → sql.js → IndexedDB pipeline.
// Public API: getDb(), refreshDb(), query(sql, params), mountLoaderOverlay(parent)

const XLSX_PATH = 'data/' + encodeURIComponent('SkillsFuture_Interactive_Query(Modified).xlsx');
const SQLJS_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/';
const IDB_NAME = 'moodie-portal';
const IDB_STORE = 'db';
const IDB_KEY = 'current';
const SHEETS = [
  'Job_Roles',
  'Critical_Work_Functions',
  'Key_Tasks',
  'TSC_CCS_Master',
  'Job_Role_Skills',
  'Proficiency_Descriptions',
  'Knowledge_Abilities',
];

let _db = null;
let _sqlPromise = null;

function loadSqlJs() {
  if (_sqlPromise) return _sqlPromise;
  _sqlPromise = window.initSqlJs({ locateFile: f => SQLJS_CDN + f });
  return _sqlPromise;
}

function openIdb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function loadFromIdb() {
  const idb = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).get(IDB_KEY);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function saveToIdb(uint8) {
  const idb = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(uint8, IDB_KEY);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

function sqlIdent(name) { return '"' + String(name).replace(/"/g, '""') + '"'; }

function inferType(values) {
  let allNumeric = true, anyNonNull = false;
  for (const v of values) {
    if (v === null || v === undefined || v === '') continue;
    anyNonNull = true;
    if (typeof v !== 'number' && !(typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v))) {
      allNumeric = false; break;
    }
  }
  return anyNonNull && allNumeric ? 'NUMERIC' : 'TEXT';
}

async function parseXlsxToDb(arrayBuffer, onProgress) {
  const SQL = await loadSqlJs();
  onProgress(5, 'Parsing workbook…');
  const wb = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
  const db = new SQL.Database();
  db.run('PRAGMA journal_mode = MEMORY;');

  const totalSheets = SHEETS.length;
  for (let i = 0; i < totalSheets; i++) {
    const sheet = SHEETS[i];
    const ws = wb.Sheets[sheet];
    if (!ws) { console.warn('[loader] missing sheet', sheet); continue; }
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
    if (!rows.length) continue;
    const headers = rows[0].map(h => String(h));
    const dataRows = rows.slice(1).filter(r => r && r.some(v => v !== null && v !== ''));
    const colTypes = headers.map((_, c) => inferType(dataRows.map(r => r[c])));
    const cols = headers.map((h, c) => `${sqlIdent(h)} ${colTypes[c]}`).join(', ');
    db.run(`CREATE TABLE ${sqlIdent(sheet)} (${cols});`);
    const placeholders = headers.map(() => '?').join(', ');
    const insert = db.prepare(
      `INSERT INTO ${sqlIdent(sheet)} VALUES (${placeholders});`
    );
    db.run('BEGIN;');
    for (const r of dataRows) {
      const vals = headers.map((_, c) => {
        const v = r[c];
        return v === undefined ? null : v;
      });
      insert.run(vals);
    }
    db.run('COMMIT;');
    insert.free();
    const pct = 5 + Math.round(((i + 1) / totalSheets) * 90);
    onProgress(pct, `Loaded ${sheet} (${dataRows.length.toLocaleString()} rows)`);
  }

  // Helpful indexes for the joins we know we'll run.
  db.run('CREATE INDEX idx_jrs_role ON Job_Role_Skills(Job_Role_ID);');
  db.run('CREATE INDEX idx_jrs_code ON Job_Role_Skills(TSC_CCS_Code);');
  db.run('CREATE INDEX idx_pd_code_lvl ON Proficiency_Descriptions(TSC_CCS_Code, Proficiency_Level);');
  db.run('CREATE INDEX idx_ka_code ON Knowledge_Abilities(TSC_CCS_Code);');
  db.run('CREATE INDEX idx_cwf_role ON Critical_Work_Functions(Job_Role_ID);');
  db.run('CREATE INDEX idx_kt_cwf ON Key_Tasks(CWF_ID);');
  onProgress(98, 'Saving to local cache…');
  return db;
}

async function fetchXlsx(onProgress) {
  const res = await fetch(XLSX_PATH);
  if (!res.ok) throw new Error(`Failed to fetch XLSX (${res.status}). Are you serving over http://?`);
  const total = Number(res.headers.get('content-length')) || 0;
  if (!res.body || !total) {
    onProgress(2, 'Downloading dataset…');
    return await res.arrayBuffer();
  }
  const reader = res.body.getReader();
  const chunks = [];
  let received = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    onProgress(Math.min(4, Math.round((received / total) * 4)), 'Downloading dataset…');
  }
  const buf = new Uint8Array(received);
  let offset = 0;
  for (const c of chunks) { buf.set(c, offset); offset += c.length; }
  return buf.buffer;
}

export function mountLoaderOverlay(parent = document.body) {
  let el = document.getElementById('loader');
  if (el) return el;
  el = document.createElement('div');
  el.id = 'loader';
  el.className = 'loader-overlay';
  el.style.display = 'none';
  el.innerHTML = `
    <div class="loader-box">
      <div id="loader-label" style="font-weight:600;">Loading…</div>
      <div id="loader-sub" style="color:#6B7280;font-size:13px;margin-top:4px;"></div>
      <div class="loader-bar"><div id="loader-fill"></div></div>
    </div>`;
  parent.appendChild(el);
  return el;
}

function showProgress(pct, label) {
  const el = mountLoaderOverlay();
  el.style.display = 'flex';
  document.getElementById('loader-label').textContent = label || 'Loading…';
  document.getElementById('loader-fill').style.width = `${Math.max(0, Math.min(100, pct))}%`;
  document.getElementById('loader-sub').textContent = `${Math.round(pct)}%`;
}

function hideProgress() {
  const el = document.getElementById('loader');
  if (el) el.style.display = 'none';
}

export async function getDb() {
  if (_db) return _db;
  const SQL = await loadSqlJs();
  const cached = await loadFromIdb();
  if (cached) {
    _db = new SQL.Database(new Uint8Array(cached));
    return _db;
  }
  showProgress(1, 'First-time setup: loading SkillsFuture data…');
  const buf = await fetchXlsx(showProgress);
  _db = await parseXlsxToDb(buf, showProgress);
  await saveToIdb(_db.export());
  hideProgress();
  return _db;
}

export async function refreshDb() {
  _db && _db.close();
  _db = null;
  showProgress(1, 'Refreshing dataset…');
  const buf = await fetchXlsx(showProgress);
  _db = await parseXlsxToDb(buf, showProgress);
  await saveToIdb(_db.export());
  hideProgress();
  return _db;
}

export async function query(sql, params = []) {
  const db = await getDb();
  const stmt = db.prepare(sql);
  try {
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    return rows;
  } finally {
    stmt.free();
  }
}
