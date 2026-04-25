// screens/screenC.js — Role details (Screen C) + handoff to Screen C.1.

import { renderShell, urlParams, escapeHtml, setSelectedRole } from '../app.js';
import { getDb, query, mountLoaderOverlay } from '../db/loader.js';
import { initSelection } from './screenC1.js';

async function loadRole(roleId) {
  const [role] = await query(
    `SELECT Job_Role_ID, Sector, Track, Job_Role, Job_Role_Description, Performance_Expectation
     FROM Job_Roles WHERE Job_Role_ID = ?`,
    [roleId]
  );
  if (!role) return null;

  const cwfRows = await query(
    `SELECT cwf.CWF_ID, cwf.Critical_Work_Function, kt.Key_Tasks
     FROM Critical_Work_Functions cwf
     LEFT JOIN Key_Tasks kt ON kt.CWF_ID = cwf.CWF_ID
     WHERE cwf.Job_Role_ID = ?
     ORDER BY cwf.CWF_ID, kt.Task_ID`,
    [roleId]
  );

  const skillRows = await query(
    `SELECT m.TSC_CCS_Code, m.TSC_CCS_Title, m.TSC_CCS_Type, m.TSC_CCS_Category,
            s.Proficiency_Level, d.Level_Description
     FROM Job_Role_Skills s
     JOIN TSC_CCS_Master m ON s.TSC_CCS_Code = m.TSC_CCS_Code
     LEFT JOIN Proficiency_Descriptions d
       ON d.TSC_CCS_Code = s.TSC_CCS_Code AND d.Proficiency_Level = s.Proficiency_Level
     WHERE s.Job_Role_ID = ?
     ORDER BY m.TSC_CCS_Type DESC, m.TSC_CCS_Title`,
    [roleId]
  );

  const tscRows = skillRows.filter(r => String(r.TSC_CCS_Type).toLowerCase() === 'tsc');
  const ccsRows = skillRows.filter(r => String(r.TSC_CCS_Type).toLowerCase() === 'ccs');
  return { role, cwfRows, tscRows, ccsRows };
}

function renderHeader(role) {
  return `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:16px;">
      <div>
        <button class="btn-ghost" onclick="history.back()" style="margin-bottom:12px;">← Back</button>
        <h1 style="margin:0 0 8px 0;font-size:24px;">${escapeHtml(role.Job_Role)}</h1>
        <div>
          <span class="pill">${escapeHtml(role.Sector)}</span>
          <span class="pill">${escapeHtml(role.Track)}</span>
        </div>
      </div>
      <div style="position:relative;">
        <button id="download-btn" class="btn-primary" disabled
                data-tooltip="Select at least one skill to enable download.">
          ⬇ Download Selected Skills
        </button>
      </div>
    </div>`;
}

function renderDescription(role) {
  return `
    <div class="card" style="margin-bottom:16px;">
      <h2 style="margin:0 0 8px 0;font-size:16px;">Description</h2>
      <p style="margin:0;line-height:1.6;color:#374151;">${escapeHtml(role.Job_Role_Description || '')}</p>
      ${role.Performance_Expectation ? `
        <h3 style="margin:16px 0 4px 0;font-size:14px;color:#6B7280;">Performance Expectation</h3>
        <p style="margin:0;line-height:1.6;color:#374151;">${escapeHtml(role.Performance_Expectation)}</p>
      ` : ''}
    </div>`;
}

function renderCwfTable(rows) {
  // Group key tasks under each critical work function.
  const groups = new Map();
  for (const r of rows) {
    if (!groups.has(r.CWF_ID)) {
      groups.set(r.CWF_ID, { cwf: r.Critical_Work_Function, tasks: [] });
    }
    if (r.Key_Tasks) groups.get(r.CWF_ID).tasks.push(r.Key_Tasks);
  }
  const body = [...groups.values()].map(g => `
    <tr>
      <td style="vertical-align:top;width:38%;font-weight:500;">${escapeHtml(g.cwf)}</td>
      <td>
        <ul style="margin:0;padding-left:18px;">
          ${g.tasks.map(t => `<li style="margin-bottom:4px;">${escapeHtml(t)}</li>`).join('')}
        </ul>
      </td>
    </tr>`).join('');
  return `
    <div class="card" style="margin-bottom:16px;">
      <h2 style="margin:0 0 12px 0;font-size:16px;">Critical Work Functions & Key Tasks</h2>
      <table class="app-table">
        <thead><tr><th>Critical Work Function</th><th>Key Tasks</th></tr></thead>
        <tbody>${body || '<tr><td colspan="2" style="color:#6B7280;">None listed.</td></tr>'}</tbody>
      </table>
    </div>`;
}

function renderSkillsTable(rows, kind) {
  const label = kind === 'tsc' ? 'Technical Skills & Competencies (TSC)' : 'Critical Core Skills (CCS)';
  const body = rows.map(r => `
    <tr data-tsc-code="${escapeHtml(r.TSC_CCS_Code)}">
      <td style="width:32px;">
        <input type="checkbox" class="skill-check"
               data-code="${escapeHtml(r.TSC_CCS_Code)}"
               data-level="${escapeHtml(r.Proficiency_Level)}"
               data-kind="${kind}" />
      </td>
      <td style="font-weight:500;">${escapeHtml(r.TSC_CCS_Title)}</td>
      <td style="width:120px;">${escapeHtml(r.Proficiency_Level)}</td>
      <td style="color:#374151;">${escapeHtml(r.Level_Description || '—')}</td>
    </tr>`).join('');
  return `
    <div class="card" style="margin-bottom:16px;">
      <h2 style="margin:0 0 12px 0;font-size:16px;">${label}</h2>
      <table class="app-table">
        <thead><tr>
          <th></th>
          <th>Skill Title</th>
          <th>Proficiency Level</th>
          <th>Proficiency Description</th>
        </tr></thead>
        <tbody>${body || `<tr><td colspan="4" style="color:#6B7280;">No ${kind.toUpperCase()} skills listed.</td></tr>`}</tbody>
      </table>
    </div>`;
}

async function initScreenC() {
  renderShell({ active: 'index.html', title: 'Job Role Details' });
  mountLoaderOverlay();
  const { roleId } = urlParams();
  const id = Number(roleId);
  const root = document.getElementById('page-root');
  if (!id) {
    root.innerHTML = `<div class="card">No role selected. <a href="index.html">Return to portal</a>.</div>`;
    return;
  }
  await getDb();
  const data = await loadRole(id);
  if (!data) {
    root.innerHTML = `<div class="card">Role not found. <a href="index.html">Return to portal</a>.</div>`;
    return;
  }
  setSelectedRole(id);
  root.innerHTML =
    renderHeader(data.role) +
    renderDescription(data.role) +
    renderCwfTable(data.cwfRows) +
    renderSkillsTable(data.tscRows, 'tsc') +
    renderSkillsTable(data.ccsRows, 'ccs');
  initSelection({
    buttonEl: document.getElementById('download-btn'),
    role: data.role,
    cwfRows: data.cwfRows,
    tscRows: data.tscRows,
    ccsRows: data.ccsRows,
  });
}

initScreenC().catch(err => {
  console.error(err);
  document.getElementById('page-root').innerHTML =
    `<div class="card">Failed to load role: ${escapeHtml(err.message)}</div>`;
});
