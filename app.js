// app.js — shared shell, sidebar, topbar, sessionStorage helpers.

const NAV = [
  { href: 'index.html', label: 'Job Skill Portal' },
];

export function renderShell({ active = 'index.html', title = '', topRight = '' } = {}) {
  const root = document.getElementById('app-shell');
  if (!root) return;
  root.className = 'app-shell';
  root.innerHTML = `
    <aside class="sidebar">
      <a href="index.html" style="text-decoration:none;color:inherit;">
        <img src="assets/images/Moodie Logo_2024.JPG" alt="Moodie.ai" />
      </a>
      <nav style="display:flex;flex-direction:column;gap:4px;margin-top:8px;">
        ${NAV.map(n => `
          <a class="nav-item ${n.href === active ? 'active' : ''}" href="${n.href}">${n.label}</a>
        `).join('')}
      </nav>
      <div style="margin-top:auto;font-size:12px;color:#6B7280;">
        SkillsFuture Skills Framework
      </div>
    </aside>
    <div>
      <div class="topbar">
        <div style="display:flex;align-items:center;gap:12px;">
          <strong>${title}</strong>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">${topRight}</div>
      </div>
      <main id="page-root" class="page"></main>
    </div>
  `;
}

export function setSelectedRole(roleId) {
  sessionStorage.setItem('moodie.selectedRoleId', String(roleId));
}
export function getSelectedRole() {
  const v = sessionStorage.getItem('moodie.selectedRoleId');
  return v ? Number(v) : null;
}

export function urlParams() {
  return Object.fromEntries(new URLSearchParams(location.search));
}

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
