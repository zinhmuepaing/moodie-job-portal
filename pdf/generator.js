// pdf/generator.js — selective-skill PDF (text-first, jsPDF only).

const MARGIN = 48;
const PAGE_W = 595; // A4 portrait pt
const PAGE_H = 842;
const LINE = 14;

function newDoc() {
  const { jsPDF } = window.jspdf;
  return new jsPDF({ unit: 'pt', format: 'a4' });
}

class Cursor {
  constructor(doc) { this.doc = doc; this.y = MARGIN; }
  ensure(space) {
    if (this.y + space > PAGE_H - MARGIN) { this.doc.addPage(); this.y = MARGIN; }
  }
  text(str, opts = {}) {
    const { size = 11, bold = false, color = [31, 41, 55], indent = 0, gap = LINE } = opts;
    this.doc.setFont('helvetica', bold ? 'bold' : 'normal');
    this.doc.setFontSize(size);
    this.doc.setTextColor(...color);
    const maxW = PAGE_W - MARGIN * 2 - indent;
    const lines = this.doc.splitTextToSize(String(str ?? ''), maxW);
    for (const line of lines) {
      this.ensure(gap);
      this.doc.text(line, MARGIN + indent, this.y);
      this.y += gap;
    }
  }
  gap(h = 8) { this.y += h; }
  rule() {
    this.ensure(8);
    this.doc.setDrawColor(229, 231, 235);
    this.doc.line(MARGIN, this.y, PAGE_W - MARGIN, this.y);
    this.y += 8;
  }
}

function groupCwf(cwfRows) {
  const groups = new Map();
  for (const r of cwfRows) {
    if (!groups.has(r.CWF_ID)) groups.set(r.CWF_ID, { cwf: r.Critical_Work_Function, tasks: [] });
    if (r.Key_Tasks) groups.get(r.CWF_ID).tasks.push(r.Key_Tasks);
  }
  return [...groups.values()];
}

export function generateSelectivePdf({ role, cwfRows, selectedSkills }) {
  const doc = newDoc();
  const c = new Cursor(doc);

  c.text(role.Job_Role, { size: 18, bold: true });
  c.text(`${role.Sector}  •  ${role.Track}`, { size: 11, color: [107, 114, 128] });
  c.gap(6); c.rule();

  c.text('Description', { size: 13, bold: true });
  c.text(role.Job_Role_Description || '—', { size: 10 });
  if (role.Performance_Expectation) {
    c.gap(4);
    c.text('Performance Expectation', { size: 11, bold: true });
    c.text(role.Performance_Expectation, { size: 10 });
  }
  c.gap(6); c.rule();

  c.text('Critical Work Functions & Key Tasks', { size: 13, bold: true });
  for (const g of groupCwf(cwfRows)) {
    c.text(g.cwf, { size: 11, bold: true });
    for (const t of g.tasks) c.text('• ' + t, { size: 10, indent: 12 });
    c.gap(4);
  }
  c.rule();

  c.text(`Selected Skills (${selectedSkills.length})`, { size: 13, bold: true });
  for (const s of selectedSkills) {
    c.gap(4);
    c.text(`${s.title}  [${s.kind.toUpperCase()}]`, { size: 12, bold: true });
    c.text(`Proficiency Level ${s.level}`, { size: 10, color: [107, 114, 128] });
    c.text(s.levelDescription || '—', { size: 10 });
    if (s.knowledge.length) {
      c.gap(2);
      c.text('Knowledge', { size: 10, bold: true });
      for (const k of s.knowledge) c.text('• ' + k, { size: 10, indent: 12 });
    }
    if (s.ability.length) {
      c.gap(2);
      c.text('Ability', { size: 10, bold: true });
      for (const a of s.ability) c.text('• ' + a, { size: 10, indent: 12 });
    }
  }

  const safe = String(role.Job_Role).replace(/[^a-z0-9]+/gi, '_').slice(0, 60);
  doc.save(`Moodie_${safe}_selected_skills.pdf`);
}
