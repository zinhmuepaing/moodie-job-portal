// screens/screenA.js — Portal entry: tabs, autocomplete, sector/track filters.

import { renderShell, escapeHtml } from '../app.js';
import { getDb, query, refreshDb, mountLoaderOverlay } from '../db/loader.js';

let activeTab = 'role';

function pageHtml() {
  return `
    <div class="card">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px;">
        <button class="tab-pill ${activeTab === 'role' ? 'active' : ''}" data-tab="role">
          Explore Skills by Job Role
        </button>
        <button class="tab-pill ${activeTab === 'filter' ? 'active' : ''}" data-tab="filter">
          View Skill Details
        </button>
      </div>
      <div id="tab-panel"></div>
    </div>
  `;
}

function rolePanel() {
  return `
    <p style="color:#6B7280;margin:0 0 12px 0;">
      Type a job role to see matching positions across the SkillsFuture framework.
    </p>
    <div style="position:relative;max-width:540px;">
      <input id="role-input" class="input" autocomplete="off"
             placeholder="e.g. Audit Associate, Data Engineer…" />
      <div id="role-suggest" class="dropdown-list" style="display:none;"></div>
    </div>
    <div style="margin-top:16px;">
      <button id="role-search" class="btn-primary">Search</button>
    </div>
  `;
}

function filterPanel() {
  return `
    <p style="color:#6B7280;margin:0 0 12px 0;">
      Browse roles by sector and track.
    </p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;max-width:720px;">
      <div>
        <label style="font-size:12px;color:#6B7280;">Sector</label>
        <select id="sector-select" class="input"><option value="">All sectors</option></select>
      </div>
      <div>
        <label style="font-size:12px;color:#6B7280;">Track</label>
        <select id="track-select" class="input"><option value="">All tracks</option></select>
      </div>
    </div>
    <div style="margin-top:16px;">
      <button id="filter-search" class="btn-primary">Search</button>
    </div>
  `;
}

function debounce(fn, ms) {
  let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

async function attachAutocomplete() {
  const input = document.getElementById('role-input');
  const list = document.getElementById('role-suggest');
  const search = debounce(async (q) => {
    if (!q || q.length < 2) { list.style.display = 'none'; return; }
    const rows = await query(
      `SELECT Job_Role_ID, Job_Role FROM Job_Roles
       WHERE Job_Role LIKE ? ORDER BY Job_Role LIMIT 10`,
      ['%' + q + '%']
    );
    if (!rows.length) { list.style.display = 'none'; return; }
    list.innerHTML = rows.map(r => `
      <div class="item" data-id="${r.Job_Role_ID}">${escapeHtml(r.Job_Role)}</div>
    `).join('');
    list.style.display = 'block';
  }, 150);
  input.addEventListener('input', e => search(e.target.value));
  input.addEventListener('blur', () => setTimeout(() => list.style.display = 'none', 150));
  list.addEventListener('click', e => {
    const item = e.target.closest('.item');
    if (!item) return;
    location.href = `role-details.html?roleId=${item.dataset.id}`;
  });
  document.getElementById('role-search').addEventListener('click', () => {
    const q = input.value.trim();
    if (q) location.href = `results.html?q=${encodeURIComponent(q)}`;
  });
}

async function attachFilters() {
  const sectors = await query(`SELECT DISTINCT Sector FROM Job_Roles WHERE Sector IS NOT NULL ORDER BY Sector`);
  const sectorSel = document.getElementById('sector-select');
  for (const r of sectors) {
    const o = document.createElement('option');
    o.value = r.Sector; o.textContent = r.Sector; sectorSel.appendChild(o);
  }
  const trackSel = document.getElementById('track-select');
  async function reloadTracks() {
    trackSel.innerHTML = '<option value="">All tracks</option>';
    const conds = ['Track IS NOT NULL'];
    const params = [];
    if (sectorSel.value) { conds.push('Sector = ?'); params.push(sectorSel.value); }
    const tracks = await query(
      `SELECT DISTINCT Track FROM Job_Roles WHERE ${conds.join(' AND ')} ORDER BY Track`,
      params
    );
    for (const r of tracks) {
      const o = document.createElement('option');
      o.value = r.Track; o.textContent = r.Track; trackSel.appendChild(o);
    }
  }
  await reloadTracks();
  sectorSel.addEventListener('change', reloadTracks);
  document.getElementById('filter-search').addEventListener('click', () => {
    const params = new URLSearchParams();
    if (sectorSel.value) params.set('sector', sectorSel.value);
    if (trackSel.value) params.set('track', trackSel.value);
    location.href = 'results.html?' + params.toString();
  });
}

async function mountTab() {
  const panel = document.getElementById('tab-panel');
  panel.innerHTML = activeTab === 'role' ? rolePanel() : filterPanel();
  if (activeTab === 'role') await attachAutocomplete();
  else await attachFilters();
}

async function initScreenA() {
  renderShell({
    active: 'index.html',
    title: 'Job Skill Portal',
    topRight: `<button id="refresh-btn" class="btn-ghost" title="Re-import dataset from XLSX">↻ Refresh data</button>`,
  });
  mountLoaderOverlay();
  document.getElementById('page-root').innerHTML = pageHtml();

  await getDb();
  await mountTab();

  document.querySelectorAll('.tab-pill').forEach(b => {
    b.addEventListener('click', async () => {
      activeTab = b.dataset.tab;
      document.querySelectorAll('.tab-pill').forEach(x =>
        x.classList.toggle('active', x.dataset.tab === activeTab));
      await mountTab();
    });
  });
  document.getElementById('refresh-btn').addEventListener('click', async () => {
    if (!confirm('Re-parse the SkillsFuture XLSX? This may take a moment.')) return;
    await refreshDb();
    await mountTab();
  });
}

initScreenA().catch(err => {
  console.error(err);
  document.getElementById('page-root').innerHTML =
    `<div class="card">Failed to load portal: ${escapeHtml(err.message)}</div>`;
});
