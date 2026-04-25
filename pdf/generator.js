// pdf/generator.js — selective-skill PDF.
// Layout matches assets/pdf-reference/Job_Role_Details_sample.pdf:
//   - Centered running header "Jobs-Skills Portal Skills Framework"
//   - Centered running footer "Page X of Y"
//   - Page 1: "Job Role Details" H1 + role info table
//             (Job Role / Sector / Track / Description)
//   - Then  : "TSC (Technical Skills and Competencies)" H1
//             For each ticked TSC: skill-title H2 + 5-row table
//             (Category+Code / Proficiency / Proficiency Description / Knowledge / Ability)
//   - Then  : "CCS (Critical Core Skills)" H1 + same structure for ticked CCS

const PAGE_MARGIN = { top: 64, right: 56, bottom: 56, left: 56 };
const HEADER_TEXT = 'Jobs-Skills Portal Skills Framework';
const LABEL_BG = [240, 240, 240];
const BORDER = [200, 200, 200];
const TEXT = [33, 37, 41];
const LABEL_W = 140; // points — left "label" column width

function newDoc() {
  const { jsPDF } = window.jspdf;
  return new jsPDF({ unit: 'pt', format: 'a4' });
}

function pageWidth(doc) { return doc.internal.pageSize.getWidth(); }
function pageHeight(doc) { return doc.internal.pageSize.getHeight(); }

function bullets(items) {
  if (!items || !items.length) return '—';
  return items.map(s => '• ' + s).join('\n');
}

function drawHeading(doc, text, y, size = 18) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(size);
  doc.setTextColor(...TEXT);
  doc.text(text, PAGE_MARGIN.left, y);
}

function infoTable(doc, startY, rows) {
  doc.autoTable({
    startY,
    margin: { left: PAGE_MARGIN.left, right: PAGE_MARGIN.right },
    body: rows,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 10,
      cellPadding: 8,
      textColor: TEXT,
      lineColor: BORDER,
      lineWidth: 0.5,
      valign: 'top',
    },
    columnStyles: {
      0: { cellWidth: LABEL_W, fontStyle: 'bold', fillColor: LABEL_BG },
    },
  });
  return doc.lastAutoTable.finalY;
}

function skillTable(doc, startY, skill) {
  // Row 1 spans 4 columns: Category | <cat> | Code | <code>
  // Subsequent rows are 2-column (label / value) but spanned to the full table width.
  const head = [];
  const body = [
    [
      { content: 'Category', styles: { fontStyle: 'bold', fillColor: LABEL_BG, cellWidth: LABEL_W / 1.6 } },
      { content: skill.category || '—' },
      { content: 'Code', styles: { fontStyle: 'bold', fillColor: LABEL_BG, cellWidth: LABEL_W / 1.6 } },
      { content: skill.code },
    ],
    [
      { content: 'Proficiency', styles: { fontStyle: 'bold', fillColor: LABEL_BG } },
      { content: String(skill.level ?? ''), colSpan: 3 },
    ],
    [
      { content: 'Proficiency\nDescription', styles: { fontStyle: 'bold', fillColor: LABEL_BG } },
      { content: skill.levelDescription || '—', colSpan: 3 },
    ],
    [
      { content: 'Knowledge', styles: { fontStyle: 'bold', fillColor: LABEL_BG } },
      { content: bullets(skill.knowledge), colSpan: 3 },
    ],
    [
      { content: 'Ability', styles: { fontStyle: 'bold', fillColor: LABEL_BG } },
      { content: bullets(skill.ability), colSpan: 3 },
    ],
  ];

  doc.autoTable({
    startY,
    margin: { left: PAGE_MARGIN.left, right: PAGE_MARGIN.right },
    head,
    body,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 10,
      cellPadding: 8,
      textColor: TEXT,
      lineColor: BORDER,
      lineWidth: 0.5,
      valign: 'top',
    },
  });
  return doc.lastAutoTable.finalY;
}

function ensureSpace(doc, y, needed) {
  if (y + needed > pageHeight(doc) - PAGE_MARGIN.bottom) {
    doc.addPage();
    return PAGE_MARGIN.top;
  }
  return y;
}

function renderSkillSection(doc, startY, sectionTitle, skills) {
  if (!skills.length) return startY;
  let y = ensureSpace(doc, startY, 60);
  drawHeading(doc, sectionTitle, y, 16);
  y += 16;

  for (const s of skills) {
    y = ensureSpace(doc, y + 12, 80);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...TEXT);
    doc.text(s.title, PAGE_MARGIN.left, y);
    y += 6;
    y = skillTable(doc, y + 4, s);
  }
  return y;
}

function paintHeaderFooter(doc) {
  const total = doc.internal.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    const w = pageWidth(doc);
    const h = pageHeight(doc);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    doc.text(HEADER_TEXT, w / 2, 32, { align: 'center' });
    doc.text(`Page ${p} of ${total}`, w / 2, h - 28, { align: 'center' });
  }
}

export function generateSelectivePdf({ role, selectedSkills }) {
  const doc = newDoc();

  // ---- Page 1: Job Role Details ----
  drawHeading(doc, 'Job Role Details', PAGE_MARGIN.top, 18);
  let y = PAGE_MARGIN.top + 12;
  y = infoTable(doc, y + 8, [
    [{ content: 'Job Role', styles: { fontStyle: 'bold', fillColor: LABEL_BG } }, role.Job_Role || ''],
    [{ content: 'Sector', styles: { fontStyle: 'bold', fillColor: LABEL_BG } }, role.Sector || ''],
    [{ content: 'Track', styles: { fontStyle: 'bold', fillColor: LABEL_BG } }, role.Track || ''],
    [{ content: 'Description', styles: { fontStyle: 'bold', fillColor: LABEL_BG } }, role.Job_Role_Description || ''],
  ]);

  // ---- Skill sections (TSC then CCS) ----
  const tsc = selectedSkills.filter(s => s.kind === 'tsc');
  const ccs = selectedSkills.filter(s => s.kind === 'ccs');

  if (tsc.length) {
    doc.addPage();
    y = PAGE_MARGIN.top;
    y = renderSkillSection(doc, y, 'TSC (Technical Skills and Competencies)', tsc);
  }
  if (ccs.length) {
    doc.addPage();
    y = PAGE_MARGIN.top;
    y = renderSkillSection(doc, y, 'CCS (Critical Core Skills)', ccs);
  }

  paintHeaderFooter(doc);

  const safe = String(role.Job_Role).replace(/[^a-z0-9]+/gi, '_').slice(0, 60);
  doc.save(`Moodie_${safe}_selected_skills.pdf`);
}
