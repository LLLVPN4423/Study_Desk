# Study Desk — Feature Audit (Phase 0)

**Date:** 2026-10-28  
**Repo:** https://github.com/LLLVPN4423/Study_Desk  
**Live:** https://study-desk-livid.vercel.app/learn  

**Scope:** Product audit only — no product code changes in this phase.  
**Certainty:** Items marked **confirmed** are backed by source paths. Items marked **needs-manual-verify** require browser checks.

---

## Product areas overview

| Area | Routes / entry | Persistence | Maturity |
|------|----------------|-------------|----------|
| Home | `src/app/page.tsx` | — | Navigation hub |
| Desk | `src/app/desk/page.tsx`, `DeskStudio` | LS + IDB blobs + FS handles | Strong editor; recovery/search gaps |
| Learn | `src/app/learn/*` | `studydesk.learn` LS | Curriculum loop solid; Desk→SRS incomplete |
| Culture | `src/app/culture/page.tsx` | Static seed JSON | Browse-only enrichment |
| Rooms | `src/app/rooms/page.tsx` | `studyRoomUrl` on desk | Meet URL only; no LiveKit |
| Auth | `src/app/auth/page.tsx` | `studydesk.session` LS | Local session, no password verify |
| Settings | `src/app/settings/page.tsx` | Backup JSON | Metadata backup incomplete for files |

---

## Core product loop status

```
Import/create → read/understand → extract → flashcards/quizzes → review → mastery → next action
```

| Stage | Status | Notes |
|-------|--------|--------|
| Import/create | Partial | Chromium FS API strong; Safari/Firefox primary open path weak |
| Read/understand | Strong | TipTap notes/docs; PDF.js + Inkbar annotate |
| Extract knowledge | Weak | Paste-only SRS panel; no stable selection→card |
| Flashcards/quizzes | Strong for curriculum | Path/lessons/mocks; desk cards poorly queued |
| Review (FSRS) | Strong | `ts-fsrs` via `src/lib/fsrs.ts` |
| Track mastery | Strong | Evidence gates in `path-evidence.ts` |
| Recommend next | Partial | Path advice + today plan; Culture not wired |

---

## Findings

### Desk

#### D-P0-1 — Backup export omits IndexedDB file blobs
- **Evidence:** `src/lib/backup.ts` (`buildBackup` → `loadDesk()` only); `src/lib/desk-store.ts` strips `dataUrl`/`sourceDataUrl` from LS; bytes in `src/lib/desk-blobs.ts` (`study-desk-blobs`).
- **Current:** Export/import restores file list metadata; PDF/audio/image bodies missing → Studio “chưa có dữ liệu”.
- **User problem:** False sense of full backup; data loss after device change.
- **Recommendation:** Include IDB blobs (or ZIP sidecar) in export; restore writes IDB then LS. Document size limits.
- **Priority:** P0 | **Complexity:** L | **confirmed**
- **AC:** Export → clear site data → import → open PDF/audio/image without re-upload.
- **Tests:** Settings backup round-trip with one PDF + one note.

#### D-P0-2 — Silent IndexedDB write failures
- **Evidence:** `desk-store.ts` `putDeskBlob(...).catch(() => {})` during save.
- **Current:** UI can show saved while blob put failed.
- **Recommendation:** Await critical blob persists; surface errors in studio/upload message.
- **Priority:** P0 | **Complexity:** M | **confirmed**
- **AC:** Forced IDB failure shows error; no false “Đã lưu” for blob kinds.

#### D-P0-3 — Non-Chromium cannot use primary “Mở từ máy”
- **Evidence:** `file-handles.ts` `showOpenFilePicker`; `desk/page.tsx` `onOpenFromDisk`; no hidden `<input>` fallback for study files on overview.
- **Recommendation:** File-input ingest fallback (read-only); keep FS API for overwrite when available.
- **Priority:** P0 | **Complexity:** M | **confirmed**
- **AC:** Firefox/Safari can add a PDF via overview and open it in Studio.

#### D-P1-1 — Custom wallpaper blob not in backup
- **Evidence:** IDB key `wallpaper:custom` (`storage-keys.ts`); backup stores wallpaper id only.
- **Priority:** P1 | **Complexity:** S | **confirmed**

#### D-P1-2 — File System handles not restorable
- **Evidence:** `file-handles.ts` IDB `study-desk-handles`; absent from `backup.ts`.
- **Recommendation:** Document expectation; optional re-link wizard (handles not serializable across browsers).
- **Priority:** P1 | **Complexity:** S (docs) / M (wizard) | **confirmed**

#### D-P1-3 — Drag-drop success shows write warning as error
- **Evidence:** `desk/page.tsx` sets `uploadError` when drop has no handles after successful ingest.
- **Priority:** P1 | **Complexity:** S | **confirmed**

#### D-P1-4 — Search is file-name only; no note/body search
- **Evidence:** `DeskStudio.tsx` `sourceQuery` filters `f.name`; overview has folders only; TipTap has no find; PDF has InkFindBar.
- **Priority:** P1 | **Complexity:** M | **confirmed**

#### D-P1-5 — Side-panel notes vs PDF disk export semantics unclear
- **Evidence:** `DeskFile.notes`; `blobFromEditedDeskFile` does not embed side notes into PDF bytes.
- **Priority:** P1 | **Complexity:** M | **confirmed**

#### D-P1-6 — `beforeunload` may use stale dirty state
- **Evidence:** `DeskStudio.tsx` `beforeunload` closes over mount-time `saveState`.
- **Priority:** P1 | **Complexity:** S | **confirmed** (code); **needs-manual-verify** (tab close UX)

#### D-P1-7 — PDF bake coverage / fidelity
- **Evidence:** `pdf-bake.ts` + Inkbar tools in `StudioPdfViewer.tsx`.
- **Priority:** P1 | **Complexity:** L | **needs-manual-verify**

#### D-P2-* — Lower priority Desk items
| ID | Summary | Priority | Complexity | Status |
|----|---------|----------|------------|--------|
| D-P2-1 | Audio excluded from unified open picker | P2 | S | confirmed |
| D-P2-2 | No TipTap highlight mark (PDF-only markup) | P2 | M | confirmed |
| D-P2-3 | `.doc` placeholder only | P2 | S | confirmed |
| D-P2-4 | Invalid `?open=` empty studio | P2 | S | needs-manual-verify |
| D-P2-5 | Image view-only (notes in side panel) | P2 | L | confirmed |

### Learn

#### L-P0-1 — Manual desk cards often never enter `studyQueue`
- **Evidence:** `learn-store.ts` `studyQueue` prefers day `vocabSourceIds`; `addManualCard` uses `manual-*` ids (`learn-store-core.ts`).
- **Current:** Card saved in LS but not reviewed with lesson-day queue.
- **Recommendation:** Include manual cards in due/new outside lesson filter, or attach to a “Desk” lesson bucket.
- **Priority:** P0 | **Complexity:** M | **confirmed**
- **AC:** Create card from Desk → appears in `/learn/review` same day → grade persists.

#### L-P0-2 — No document selection → flashcard (Document-to-Learning gap)
- **Evidence:** `DeskStudio.tsx` paste fields only; PDF highlight is Inkbar annotation, not card pipeline. README still mentions highlight→card.
- **Priority:** P0 (product loop) | **Complexity:** L | **confirmed**
- **Note:** Pack Phase 2; depends on stable selection + L-P0-1.

#### L-P1-1 — Empty storage auto-seeds full N5+A1 paths
- **Evidence:** `loadLearn` → `seedBeginnerZeroPaths` + `addAllBandLessons`; placement copy suggests gradual add.
- **Priority:** P1 | **Complexity:** M | **confirmed**

#### L-P1-2 — `LEARN_PATHS_EPOCH` wipe + re-seed
- **Evidence:** `learn-store.ts` / `learn-store-core.ts` epoch check.
- **Priority:** P1 | **Complexity:** S | **confirmed** (intentional but destructive)

#### L-P1-3 — `addManualCard` requires `pathActive`
- **Evidence:** `learn-store-core.ts`.
- **Priority:** P1 | **Complexity:** S | **confirmed**

#### L-P1-4 — Desk output “card” has no deep link to review
- **Evidence:** `pushFileOutput` kind `card` in DeskStudio.
- **Priority:** P1 | **Complexity:** S | **confirmed**

#### L-P2-* 
| ID | Summary | Priority | Complexity |
|----|---------|----------|------------|
| L-P2-1 | README still says fsrs-lite; runtime is ts-fsrs | P2 | S |
| L-P2-2 | `lessons.ts` static-imports large JSON | P2 | M |
| L-P2-3 | Freemium disabled but docs describe caps | P2 | S |
| L-P2-4 | No error notebook / structured mistake log | P2 | M |
| L-P2-5 | Culture not linked into Learn items | P2 | M |

### Culture / Rooms / Auth / Settings

| ID | Finding | Priority | Complexity | Status |
|----|---------|----------|------------|--------|
| C-P2-1 | Culture browse works; no vocab/grammar bridge | P2 | M | confirmed |
| R-P1-1 | Rooms = Meet URL only; LiveKit stub | P1 | L | confirmed |
| A-OK | Local auth by design Phase 1 | — | — | confirmed |
| S-P0 | Same as D-P0-1 (backup) | P0 | L | confirmed |

---

## What already works well (reuse first)

- **Desk split storage:** LS metadata + IDB blobs (`desk-store` + `desk-blobs`).
- **Studio 3-pane:** sources / work / Learn-Out-Focus; TipTap + PDF.js + Inkbar already in `package.json`.
- **Disk overwrite when linked:** File System Access + leave dialog (browser vs disk).
- **Learn curriculum loop:** placement → lessons → FSRS review → evidence-gated roadmap.
- **Lazy vocab/gloss:** `vocab-seeds.ts`, `gloss-vi.ts`, `LearnSeedsGate`.
- **Vietnamese gloss coverage** for EN B1–C2 (post-fix pipeline).
- **Culture** heritage browse + map; **Settings** theme/pro/backup entry points.

---

## Candidate libraries (evaluate later — do not install in Phase 0)

| Candidate | Already in project? | Notes |
|-----------|---------------------|--------|
| TipTap | Yes | Prefer extend (highlight/search) over new editor |
| PDF.js / pdfjs-dist | Yes | Keep; assets via `copy-pdfjs.mjs` |
| ts-fsrs | Yes | Do not replace for novelty |
| Playwright / axe-core | No | Phase 6 candidates |
| JMdict / Tatoeba / etc. | No | Phase 3 — license matrix first |

---

## Recommended first vertical slice

See [IMPLEMENTATION_ROADMAP.md](./IMPLEMENTATION_ROADMAP.md): **Desk Recovery & Open Fallback** (P0 data safety + browser reach), then Document-to-Learning once cards queue correctly.
