# Study Desk — Testing Checklist

**Updated:** 2026-10-29 (Phase 4 integrity + Phase 5 culture cards in progress)  
**Rule:** Only mark pass if the command/journey was actually run.

---

## Automated commands

| Command | Purpose | Result | Date | Runner |
|---------|---------|--------|------|--------|
| `npm run smoke:study-queue` | Queue / DESK_NEW_SOFT_CAP | **PASS** | 2026-10-29 | agent |
| `npm run smoke:backup` | Backup format v1/v2 + S4 export gate | **PASS** | 2026-10-29 | agent |
| `npm run smoke:provenance` | Provenance helpers | **PASS** | 2026-10-29 | agent |
| `npm run smoke:phase3` | Epoch preserve / week pass / Map polyfill | **PASS** (after Phase 3 impl) | 2026-10-29 | agent |
| `npm run smoke:precommit` | Pre-commit gates F5/F1–F4/F6/polyfill | **PASS** | 2026-10-29 | agent |
| `npm run smoke:integrity` | Orphan GC plan / restore rollback classify | **PASS** | 2026-10-29 | agent |
| `npm run smoke:restore-rollback` | V2 mid-fail restore + snapshot abort (memory store) | **PASS** | 2026-10-29 | agent |
| `npx tsc --noEmit` | Typecheck | **PASS** | 2026-10-29 | agent |
| `npm run build` | Production build | **PASS** | 2026-10-29 | agent |
| `npm run lint` | ESLint | **FAIL (baseline)** — pre-existing debt; not Phase 2/3 scope | | |
| Playwright / axe | e2e / a11y | **NOT RUN** — not in package.json | | |

---

## Phase 2 — Document-to-Learning acceptance

### Logic smoke

| ID | Case | Result |
|----|------|--------|
| P2-U1…U5 | `smoke:study-queue` | **PASS** |
| P2-B | `smoke:backup` | **PASS** |
| P2-P | `smoke:provenance` | **PASS** |

### Browser UI (agent CDP / Cursor browser, 2026-10-28…29)

| ID | Journey | Result | Notes |
|----|---------|--------|-------|
| P2-B1 | TipTap selection → card → review → **Mở nguồn** + highlight | **PASS** | Provenance `selection` + note file |
| P2-B2 | Real PDF (`tmp/selection-fixture.pdf`) selection → card → review → source | **PASS** | `pdf-quote`; Inkbar needed Map polyfill on Chrome&lt;145 / Cursor Electron 144 |
| P2-B3 | Backup export → wipe → Settings import → provenance + PDF blob | **PASS** | UI: xuất v2 + khôi phục 4 blob |
| P2-B4 | Long flashcard layout (VI paragraph, unbroken, desktop + 390px) | **PASS** | CDP metrics; not character-column collapse |

### Phase 2 limitations (documented, non-blocking)

1. **Inkbar `getOrInsertComputed`:** Required by Inkbar on engines without Chrome 145+ / Safari 26.2+ / Firefox 144+. **Fix:** scoped polyfill in `StudioPdfViewer` via `map-polyfill.ts` (not global app boot).  
2. Phase 1 manual items T7–T8 (Safari/Firefox open, Chrome Ctrl+S) remain **NOT RUN** in this session.  
3. Fixtures retained for replay (see below).

### Phase 2 acceptance

**ACCEPTED** for core Document-to-Learning loop (selection → card → review → source, PDF path, backup/restore with provenance, long-card layout), with Inkbar polyfill limitation above.

---

## Fixtures (`tmp/` / `public/tmp/`)

| Path | Purpose | Disposable? |
|------|---------|-------------|
| `tmp/selection-fixture.pdf` | Real selectable-text PDF for Phase 2E browser tests | Keep for regression replay |
| `tmp/selection-fixture.b64.txt` | Base64 of same PDF for CDP inject | Keep |
| `public/tmp/selection-fixture.pdf` | Served at `/tmp/selection-fixture.pdf` during browser fetch inject | Keep while retesting PDF flow |

Do **not** delete without confirming no pending PDF E2E. Not product runtime assets for production deploy (optional to `.gitignore` later).

---

## Phase 1 matrix (unchanged summary)

See prior entries: T1 smoke **PASS**; T2–T3/T7–T10 largely manual **NOT RUN** / partial. Recovery code remains in tree.

---

## Phase 3 — Learning correctness

| ID | Fix | Test | Result |
|----|-----|------|--------|
| F5 | Epoch mismatch preserves cards; restore bumps epoch + warning | `smoke:phase3` + restore path | **PASS** (logic) |
| F1 | `weekVocabMastery` uses lesson-pass quality | `smoke:phase3` | **PASS** (logic) |
| F2 | PathTimeline uses `vocabDone` | code + smoke mirror | **PASS** (logic) |
| F3 | Removed review unmount auto-tick of week actions | code review | **PASS** (logic) |
| F4 | `lessonId` review progress uses forced lesson ids | code review | **PASS** (logic); browser **NOT RUN** this session |
| F6 | `ensureLessonCards` on forced-lesson review refresh | code review | **PASS** (logic); browser **NOT RUN** |
| Inkbar | Scoped Map polyfill | `smoke:phase3` | **PASS** |

Browser re-validation of full Learn path after Phase 3: **NOT RUN** in finalization session (prior Phase 2 browser evidence stands for Doc→Learn).

---

## Phase 4 — Data integrity (logic)

| ID | Case | Result |
|----|------|--------|
| S0 | `smoke:integrity` helpers | **PASS** |
| S1 | Orphan GC plans only unreferenced keys | **PASS** (logic); browser GC **NOT RUN** |
| S2 | Restore rollback restores overwrite / deletes novel only | **PASS** (logic); browser mid-fail restore **NOT RUN** |
| S3 | `deleteFileAsync` awaited from Desk UI | **PASS** (code); browser delete **NOT RUN** |
| S4 | Export fails when required primary blob missing | **PASS** (`smoke:backup` gate + `downloadBackup` code) |
| S5 | Metadata-only saves use `saveDeskMetadata` | **PASS** (code review) |

## Phase 5 — Culture → vocab card

| ID | Case | Result |
|----|------|--------|
| S7 | Culture card `origin: "culture"` + `cultureItemId`; no fake `sourceFileId` | **PASS** (`smoke:provenance`) |
| S7-B | Culture → Review appears; source nav to `/culture` | browser **NOT RUN** |

## Regression watchlist

1. Chrome FS open + overwrite.  
2. TipTap autosave + leave dialog.  
3. `loadLearn` after backup with older `pathsEpoch` must keep cards.  
4. Week % / PathTimeline agree with ≥70% Good day pass.  
5. Review no longer ticks week actions solely from “3 grades then leave”.  
6. Failed restore keeps prior Learn/desk LS and restores overwritten blobs.  
7. Incomplete Desk (missing PDF blob) cannot export “successfully”.
