# Tasks

## Done (Phase 1 — Must have)
- Project scaffolded (`index.html`, `results.html`, `role-details.html`, shared shell in `app.js`, brand tokens in `styles.css`)
- Data loader: XLSX → sql.js → IndexedDB with progress overlay, hot-path indexes, `Refresh data` button (`db/loader.js`)
- Screen A: tabbed entry, debounced job-role autocomplete, Sector + Track filters with cascading tracks (`screens/screenA.js`)
- Screen B: sortable results table, in-results keyword filter, row → role-details (`screens/screenB.js`)
- Screen C: role header, description, CWF + Key Tasks (grouped), TSC and CCS tables with hidden code column and per-row checkbox (`screens/screenC.js`)
- Screen C.1: selection store, button enable/disable + tooltip per the contract (`screens/screenC1.js`)
- Selective PDF: layout matching `assets/pdf-reference/Job_Role_Details_sample.pdf` — running header/footer, Job Role Details table on page 1, TSC and CCS sections with Category/Code/Proficiency/Knowledge/Ability tables (`pdf/generator.js`)
- README added with run instructions and architecture map

## In Progress
- _none_

## Up Next (Phase 2 — Should have)
- Full-role PDF download (always-available, all sections + all skills)
- Full-role XLSX download via SheetJS
- Stage 2 hand-off: "Continue to Stage 2" button on Screen C, write `Job_Role_ID` to `sessionStorage`
- Stage 2 intro copy reads selected role name

## Backlog (Phase 3 — Could have)
- Offline-first caching with `Last Updated` label next to Refresh button
- Recently viewed roles list on Screen A
- Side-by-side role comparison
- Extend checkbox selection to CCS skills (currently parity exists; revisit if separate UX is wanted)

## Won't have (this release)
- Cross-device favourites
- Personalised role recommendations

## Known Issues / Follow-ups
- CLAUDE.md spec for the **selective PDF** still lists "Critical Work Functions and Key Tasks" as a section; the reference PDF (`assets/pdf-reference/Job_Role_Details_sample.pdf`) does not include CWF. Generator currently follows the sample. Decide which is canonical and reconcile.
- Filename mismatch: CLAUDE.md says `SkillsFuture_Interactive_Query_Modified.xlsx`; on disk it is `SkillsFuture_Interactive_Query(Modified).xlsx` (parens). Loader handles it via `encodeURIComponent`; rename one of the two for cleanliness.
- `DECISIONS.md` referenced in CLAUDE.md does not exist yet — create when first non-trivial trade-off needs recording.

## Verification (manual)
1. `npx http-server -p 8090 .` from project root.
2. Open `http://127.0.0.1:8090/index.html` — first load shows progress overlay.
3. Reload — instant load from IndexedDB.
4. Tab 1: type → autocomplete → pick a role → role page renders.
5. Tab 2: Sector → Track cascades → Search → results page.
6. Sort columns and filter within results.
7. Open a role → tick TSC/CCS skills → button enables with correct count → click → PDF saved.
8. Spot-check the PDF against `assets/pdf-reference/Job_Role_Details_sample.pdf`.
