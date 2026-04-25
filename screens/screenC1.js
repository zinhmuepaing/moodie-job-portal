// screens/screenC1.js — selection store + download button state contract.

import { query } from '../db/loader.js';
import { generateSelectivePdf } from '../pdf/generator.js';

const selection = new Map(); // key: TSC_CCS_Code -> { code, level, kind }

function tooltipFor(n) {
  if (n === 0) return 'Select at least one skill to enable download.';
  if (n === 1) return 'Download 1 selected skill as PDF';
  return `Download ${n} selected skills as PDF`;
}

function syncButton(buttonEl) {
  const n = selection.size;
  buttonEl.disabled = n === 0;
  buttonEl.setAttribute('data-tooltip', tooltipFor(n));
  buttonEl.textContent = n === 0
    ? '⬇ Download Selected Skills'
    : `⬇ Download ${n} Selected Skill${n === 1 ? '' : 's'}`;
}

async function fetchKnowledgeAbilities(codes) {
  if (!codes.length) return new Map();
  const placeholders = codes.map(() => '?').join(',');
  const rows = await query(
    `SELECT TSC_CCS_Code, Knowledge_Ability_Classification, Knowledge_Ability_Items
     FROM Knowledge_Abilities WHERE TSC_CCS_Code IN (${placeholders})
     ORDER BY KA_ID`,
    codes
  );
  const byCode = new Map();
  for (const r of rows) {
    if (!byCode.has(r.TSC_CCS_Code)) byCode.set(r.TSC_CCS_Code, { knowledge: [], ability: [] });
    const bucket = byCode.get(r.TSC_CCS_Code);
    const kind = String(r.Knowledge_Ability_Classification).toLowerCase();
    if (kind === 'knowledge') bucket.knowledge.push(r.Knowledge_Ability_Items);
    else if (kind === 'ability') bucket.ability.push(r.Knowledge_Ability_Items);
  }
  return byCode;
}

export function initSelection({ buttonEl, role, cwfRows, tscRows, ccsRows }) {
  selection.clear();
  syncButton(buttonEl);

  document.addEventListener('change', (e) => {
    const cb = e.target;
    if (!(cb instanceof HTMLInputElement) || !cb.classList.contains('skill-check')) return;
    const code = cb.dataset.code;
    if (cb.checked) {
      selection.set(code, { code, level: cb.dataset.level, kind: cb.dataset.kind });
    } else {
      selection.delete(code);
    }
    syncButton(buttonEl);
  });

  buttonEl.addEventListener('click', async () => {
    if (selection.size === 0) return;
    const allSkills = [...tscRows, ...ccsRows];
    const codes = [...selection.keys()];
    const ka = await fetchKnowledgeAbilities(codes);
    const selectedSkills = codes.map(code => {
      const skill = allSkills.find(r => r.TSC_CCS_Code === code);
      const buckets = ka.get(code) || { knowledge: [], ability: [] };
      return {
        code,
        title: skill?.TSC_CCS_Title ?? code,
        kind: selection.get(code).kind,
        level: skill?.Proficiency_Level ?? '',
        levelDescription: skill?.Level_Description ?? '',
        knowledge: buckets.knowledge,
        ability: buckets.ability,
      };
    });
    generateSelectivePdf({ role, cwfRows, selectedSkills });
  });
}
