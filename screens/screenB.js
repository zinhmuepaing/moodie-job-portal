// screens/screenB.js — Search results table.

import { renderShell, urlParams, escapeHtml } from '../app.js';
import { getDb, query, mountLoaderOverlay } from '../db/loader.js';

let allRows = [];
let viewRows = [];
let sortKey = null;
let sortDir = 1;

async function runSearch({ q, sector, track }) {
  const where = [];
  const params = [];
  if (q) { where.push('Job_Role LIKE ?'); params.push('%' + q + '%'); }
  if (sector) { where.push('Sector = ?'); params.push(sector); }
  if (track) { where.push('Track = ?'); params.push(track); }
  const sql = `SELECT Job_Role_ID, Job_Role, Sector, Track FROM Job_Roles
               ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
               ORDER BY Job_Role`;
  return query(sql, params);
}

function applyFilterSort(keyword) {
  const k = (keyword || '').toLowerCase();
  viewRows = allRows.filter(r =>
    !k || r.Job_Role.toLowerCase().includes(k) ||
    String(r.Sector).toLowerCase().includes(k) ||
    String(r.Track).toLowerCase().includes(k)
  );
  if (sortKey) {
    viewRows.sort((a, b) => String(a[sortKey] ?? '').localeCompare(String(b[sortKey] ?? '')) * sortDir);
  }
  renderTableBody();
}

function renderTableBody() {
  const tbody = document.getElementById('results-tbody');
  if (!viewRows.length) {
    tbody.innerHTML = `<tr><td colspan="3" style="color:#6B7280;text-align:center;padding:32px;">No results.</td></tr>`;
    return;
  }
  tbody.innerHTML = viewRows.map(r => `
    <tr class="clickable" data-id="${r.Job_Role_ID}">
      <td style="font-weight:500;">${escapeHtml(r.Job_Role)}</td>
      <td>${escapeHtml(r.Sector)}</td>
      <td>${escapeHtml(r.Track)}</td>
    </tr>
  `).join('');
  document.getElementById('result-count').textContent = `${viewRows.length} result${viewRows.length === 1 ? '' : 's'}`;
}

async function initScreenB() {
  renderShell({ active: 'index.html', title: 'Search Results' });
  mountLoaderOverlay();
  const root = document.getElementById('page-root');
  const params = urlParams();

  root.innerHTML = `
    <div class="card">
      <div style="display:flex;align-items:center;gap:12px;justify-content:space-between;margin-bottom:16px;">
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
          ${params.q ? `<span class="pill">Search: ${escapeHtml(params.q)}</span>` : ''}
          ${params.sector ? `<span class="pill">Sector: ${escapeHtml(params.sector)}</span>` : ''}
          ${params.track ? `<span class="pill">Track: ${escapeHtml(params.track)}</span>` : ''}
        </div>
        <a href="index.html" class="btn-ghost">New Search</a>
      </div>
      <input id="filter-input" class="input" placeholder="Filter results…" style="margin-bottom:16px;" />
      <div id="result-count" style="font-size:12px;color:#6B7280;margin-bottom:8px;"></div>
      <table class="app-table">
        <thead>
          <tr>
            <th data-sort="Job_Role">Job Role</th>
            <th data-sort="Sector">Sector</th>
            <th data-sort="Track">Track</th>
          </tr>
        </thead>
        <tbody id="results-tbody"></tbody>
      </table>
    </div>
  `;

  await getDb();
  allRows = await runSearch(params);
  viewRows = allRows.slice();
  renderTableBody();

  document.getElementById('filter-input').addEventListener('input', e => {
    applyFilterSort(e.target.value);
  });
  document.querySelectorAll('th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const k = th.dataset.sort;
      sortDir = sortKey === k ? -sortDir : 1;
      sortKey = k;
      applyFilterSort(document.getElementById('filter-input').value);
    });
  });
  document.getElementById('results-tbody').addEventListener('click', e => {
    const tr = e.target.closest('tr[data-id]');
    if (!tr) return;
    location.href = `role-details.html?roleId=${tr.dataset.id}`;
  });
}

initScreenB().catch(err => {
  console.error(err);
  document.getElementById('page-root').innerHTML =
    `<div class="card">Failed to search: ${escapeHtml(err.message)}</div>`;
});
