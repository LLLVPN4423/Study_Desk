# Study Desk — Implementation Roadmap (Phase 0)

**Date:** 2026-10-28  
**Input:** Feature audit + data model map + upgrade prompt pack phases 1–6.

**Rule:** No product implementation in Phase 0. This document ranks work and names **one** first vertical slice for approval.

---

## Ranking criteria

1. User value (learning loop / data safety)  
2. Effort (S/M/L)  
3. Regression risk  
4. Contribution to **document → learn** workflow  

---

## Map pack phases → real gaps

| Pack phase | Theme | Top gaps in this repo | Priority cluster |
|------------|--------|----------------------|------------------|
| **1** Desk Reading Studio | Notes, search, recovery, open UX | Backup missing blobs; silent IDB fails; non-Chromium open; name-only search | **P0–P1** |
| **2** Document-to-Learning | Selection → card/quiz + source link | Paste-only; manual cards skipped by `studyQueue`; no fileId on cards | **P0** loop |
| **3** Data pipeline | License + sample import | EN A1/A2 gloss quality residual; no license matrix | P1–P2 |
| **4** Learn daily / errors | Due review, error notebook | Review exists; no error notebook entity | P1–P2 |
| **5** Culture bridge | Article → vocab/quiz | Culture isolated | P2 |
| **6** UX / a11y / QA | Playwright, axe, dead controls | Lint debt; no e2e suite | P1–P2 |

---

## Recommended first vertical slice (approve before coding)

### Slice name: **Desk Recovery & Open Fallback**

**Why first (not Phase 2 Doc→Learn yet):**
- Pack Phase 1 prioritizes Desk recovery/search.
- Backup without blobs is a **false safety** story on Settings (P0) — users sharing Vercel demos who export/import will lose files.
- Silent IDB failures corrupt trust in “Đã lưu”.
- File-input fallback expands who can even start the Desk loop (Safari/Firefox).
- Unblocks later Doc→Learn: without reliable file persistence, source links are meaningless.

**In scope (smallest complete user-visible slice):**
1. Backup export/import includes Desk IDB blobs (and document size/limit messaging).  
2. Critical blob writes await + surface errors (no silent swallow on PDF/audio/image save).  
3. Overview: `<input type=file>` fallback for study ingest when `showOpenFilePicker` missing.  
4. Soften drag-drop “no write handle” message (hint, not hard error).  
5. Minimal Settings/help copy: what backup includes / Chromium disk overwrite limits.

**Out of scope for this slice:** TipTap highlight→card, Culture bridge, Rooms LiveKit, JMdict import, Playwright suite, error notebook.

**Planned files (when approved):**
- `src/lib/backup.ts`, `src/lib/desk-blobs.ts`, `src/lib/desk-store.ts`
- `src/app/desk/page.tsx`, `src/app/settings/page.tsx`
- Possibly `src/lib/i18n.tsx` / `help-content.ts` for copy
- `docs/TESTING_CHECKLIST.md` update with executed results

**Acceptance criteria:**
- [ ] Create PDF on Desk → Export backup → clear site data → Import → open same PDF content.  
- [ ] Simulate/force blob write failure → user-visible error; no false success.  
- [ ] Browser without FS API can add a PDF via file input and open Studio.  
- [ ] Existing Chrome “Mở từ máy” + Ctrl+S overwrite still works.  
- [ ] `tsc` / targeted smoke still pass for touched areas.

**Complexity:** M–L | **Risk:** Medium (backup format → bump to `version: 2` with forward-compatible restore).

---

## Second slice (after Recovery)

### **Document selection → flashcard that appears in Review**

1. Fix `studyQueue` so `manual-*` cards are reviewable when due/new.  
2. TipTap (and optionally PDF text extract selection) → prefill Create Flashcard → save with optional `sourceFileId`.  
3. Deep link from Desk output / card back to file when present.

Maps to pack **Phase 2**. Depends on Recovery for durable sources.

---

## Later phases (ordered)

| Order | Work | Pack | Notes |
|-------|------|------|--------|
| 3 | Desk search (names + note snippets) | Phase 1 remainder | After recovery |
| 4 | Error notebook + due-today clarity | Phase 4 | Reuse FSRS |
| 5 | EN A1/A2 gloss quality pass | Phase 3 light | Smoke shows residual bad A1/A2 |
| 6 | DATA_SOURCE_LICENSE_MATRIX + sample import | Phase 3 | No bulk import until approved |
| 7 | Culture → vocab/quiz bridge | Phase 5 | Reuse Phase 2 pipeline |
| 8 | UX/a11y + Playwright | Phase 6 | After core loop solid |
| 9 | Rooms real-time | — | Only with approved backend |

---

## Dependency / tooling stance

| Already present — prefer extend | Candidate later |
|--------------------------------|-----------------|
| TipTap, PDF.js, Inkbar, ts-fsrs, mammoth, docx, pdf-lib | Playwright, axe-core, JMdict/Tatoeba (license first) |

Do **not** replace TipTap/PDF.js/ts-fsrs without a proven gap.

---

## Phase 1 status — Desk Recovery & Open Fallback

**Approved and implemented (2026-10-28).** See `docs/BACKUP_FORMAT.md` and updated `docs/TESTING_CHECKLIST.md`.

| Acceptance | Status |
|------------|--------|
| Backup includes IDB PDF/audio blobs (v2) | Code complete — run Settings export + smoke |
| IDB failures surfaced; no false save | `saveDeskAsync` + Studio persist await |
| File input fallback when FS API missing | `pickDeskFilesFromDisk` → `<input type=file>` |
| Chrome FS path preserved | Still preferred when available |
| Doc→Learn | **Out of scope** — next slice |

**Stop gate for Phase 2:** Do not start Document-to-Learning until Phase 1 manual browser checks (T2–T3, T7–T8) are signed off.

---

## Phase 4–5 status (program integrity + Culture bridge)

**Phase 4 (data ownership / RI / backup / blobs)** — slices S0–S6: integrity helpers, orphan GC, restore rollback with overwrite snapshots, async delete, export reject on missing required blobs, `saveDeskMetadata` for sync metadata paths, docs.

**Phase 5 (Culture → vocab)** — slice S7: flashcards with `origin: "culture"` + `cultureItemId` (no fake Desk `sourceFileId`). Quiz / error notebook / due-today / Desk search remain **out of scope**.

---

## Phase 6 status — UX / a11y / QA

**Implemented (2026-10-30):** Playwright critical-path e2e + axe serious/critical scans; Rooms hides LiveKit room-name input when `NEXT_PUBLIC_LIVEKIT_URL` is unset.

| Acceptance | Status |
|------------|--------|
| `npm run test:e2e` (build + Playwright) | **PASS** (2026-10-30) — 7 tests |
| Axe serious/critical = 0 on `/`, `/auth`, `/desk`, `/settings` | **PASS** (`e2e/a11y.spec.ts`) |
| Rooms no dead LiveKit room-name affordance without env | **PASS** (`rooms/page.tsx`) |
| Full ESLint zero | **Out of scope** — baseline debt remains |
| LiveKit realtime / tutor / error notebook | **Out of scope** |

**Commands:** `npm run test:e2e` · `npm run test:e2e:ui`
