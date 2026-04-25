# Moodie.ai Job Skill Portal

Client-side web app that sits between Stage 1 (login) and Stage 2 (pitch
simulation) in Moodie.ai. Users browse SkillsFuture job roles, drill into
a role's skills, tick the ones they care about, and download a PDF — all
in the browser, no backend.

## Stack
- HTML + vanilla JS (ES modules) + a hand-rolled brand stylesheet
- [SheetJS](https://sheetjs.com/) — parses the source XLSX on first load
- [sql.js](https://sql.js.org/) — SQLite via WebAssembly for real SQL joins
- [IndexedDB](https://developer.mozilla.org/docs/Web/API/IndexedDB_API) — caches the parsed DB across sessions
- [jsPDF](https://github.com/parallax/jsPDF) + [jspdf-autotable](https://github.com/simonbengtsson/jsPDF-AutoTable) — PDF output

All third-party libs are loaded from a CDN — no `npm install` required to
run the app.

## Run it locally
sql.js needs to fetch its WASM, and SheetJS needs to fetch the XLSX —
both blocked under `file://`. Serve over HTTP:

```bash
npx http-server -p 8090 .
```

Then open **<http://127.0.0.1:8090/index.html>**.

First load parses the XLSX (~150k rows total) and writes the SQLite blob
to IndexedDB; expect a brief progress overlay. Subsequent loads are
instant. The **↻ Refresh data** button on Screen A re-parses the XLSX if
the source file changes.

## Project layout
```
moodie-job-portal/
├── index.html            Screen A — portal entry
├── results.html          Screen B — search results
├── role-details.html     Screen C — role details + Screen C.1 selective download
├── app.js                Shared shell (sidebar, topbar), URL + sessionStorage helpers
├── styles.css            Brand tokens + components (cards, pills, table, loader)
├── db/
│   └── loader.js         XLSX → sql.js → IndexedDB; getDb / refreshDb / query
├── screens/
│   ├── screenA.js        Tabs, autocomplete, Sector/Track filters
│   ├── screenB.js        Sortable + filterable results table
│   ├── screenC.js        Role header, description, CWF, TSC/CCS tables
│   └── screenC1.js       Selection store + button-state contract
├── pdf/
│   └── generator.js      Selective-skill PDF (matches assets/pdf-reference/)
├── data/                 SkillsFuture XLSX (gitignored)
└── assets/
    ├── images/           Moodie logo
    ├── ui-reference/     UI screenshots (gitignored)
    └── pdf-reference/    Sample PDF for layout fidelity (gitignored)
```

## Data model
Tables loaded from the XLSX into sql.js (one table per sheet):

| Table | Key columns |
|---|---|
| `Job_Roles` | `Job_Role_ID`, `Sector`, `Track`, `Job_Role`, `Job_Role_Description`, `Performance_Expectation` |
| `Critical_Work_Functions` | `CWF_ID`, `Job_Role_ID`, `Critical_Work_Function` |
| `Key_Tasks` | `Task_ID`, `CWF_ID`, `Key_Tasks` |
| `TSC_CCS_Master` | `TSC_CCS_Code`, `TSC_CCS_Title`, `TSC_CCS_Category`, `TSC_CCS_Type` (`tsc`/`ccs`), … |
| `Job_Role_Skills` | `Job_Role_ID`, `TSC_CCS_Code`, `Proficiency_Level` |
| `Proficiency_Descriptions` | `TSC_CCS_Code`, `Proficiency_Level`, `Level_Description` |
| `Knowledge_Abilities` | `KA_ID`, `TSC_CCS_Code`, `Knowledge_Ability_Classification` (`knowledge`/`ability`), `Knowledge_Ability_Items` |

The headline join (Screen C skills tables):
```sql
SELECT m.TSC_CCS_Code, m.TSC_CCS_Title, m.TSC_CCS_Type, m.TSC_CCS_Category,
       s.Proficiency_Level, d.Level_Description
FROM Job_Role_Skills s
JOIN TSC_CCS_Master m ON s.TSC_CCS_Code = m.TSC_CCS_Code
LEFT JOIN Proficiency_Descriptions d
  ON d.TSC_CCS_Code = s.TSC_CCS_Code
 AND d.Proficiency_Level = s.Proficiency_Level
WHERE s.Job_Role_ID = ?;
```

## Selective-PDF contract
Visual structure matches `assets/pdf-reference/Job_Role_Details_sample.pdf`:
- Centered running header **"Jobs-Skills Portal Skills Framework"** and footer **"Page X of Y"**
- Page 1: **Job Role Details** heading + 4-row info table (Job Role / Sector / Track / Description)
- Page 2+: **TSC (Technical Skills and Competencies)** then **CCS (Critical Core Skills)** sections; each ticked skill rendered as a per-skill table (Category + Code header row, then Proficiency, Proficiency Description, Knowledge bullets, Ability bullets)

## Stage 2 integration
On Screen C the selected `Job_Role_ID` is written to `sessionStorage`
under `moodie.selectedRoleId`. Stage 2 reads that key. (The "Continue to
Stage 2" button itself ships in Phase 2.)

## Conventions
- ES modules only — no bundler. Each page loads exactly one entry script.
- All DOM strings go through `escapeHtml` from `app.js`.
- All SQL is parametrised via prepared statements; no string concatenation
  with user input.
- New brand colours / spacings live in `styles.css` as CSS custom properties.

## Roadmap
See `TASKS.md` for the live status. Phase 1 (Must have) is done; Phase 2
covers the full-role PDF/XLSX downloads and the Stage 2 hand-off.
