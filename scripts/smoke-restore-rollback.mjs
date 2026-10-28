/**
 * Phase 4 closure — deterministic v2 restore failure via in-memory blob store.
 * Exercises restoreBackupV2Core + real putBlobs failure path (fail after 1 success).
 * Run: npm run smoke:restore-rollback
 */
import { findMissingRequiredBlobs } from "../src/lib/backup-format.ts";
import {
  createMemoryBlobStore,
  restoreBackupV2Core,
} from "../src/lib/restore-v2-core.ts";

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error("FAIL:", msg);
  } else {
    console.log("ok:", msg);
  }
}

function makeLocal(initialLearn) {
  let desk = JSON.stringify({ files: [{ id: "note", kind: "note", name: "n" }] });
  let learn = JSON.stringify(initialLearn);
  let session = JSON.stringify({ id: "s1", name: "T", email: "t@t.com", plan: "free" });
  let theme = "paper";
  let gcCalls = 0;
  return {
    gcCalls: () => gcCalls,
    getLearn: () => JSON.parse(learn),
    getDesk: () => JSON.parse(desk),
    api: {
      snapshot: () => ({ desk, learn, session, theme }),
      restoreSnapshot: (snap) => {
        desk = snap.desk;
        learn = snap.learn;
        session = snap.session;
        theme = snap.theme;
      },
      saveDeskMetadata: (d) => {
        desk = JSON.stringify(d);
        return { ok: true };
      },
      saveLearn: (l) => {
        learn = JSON.stringify(l);
      },
      saveSession: (s) => {
        session = JSON.stringify(s);
      },
      setTheme: (t) => {
        theme = t;
      },
      prepareLearn: (l) => ({ learn: { ...l, pathsEpoch: 8 } }),
      gcOrphans: () => {
        gcCalls += 1;
      },
    },
  };
}

const LEARN_MARKER = {
  preferredTrack: "jp",
  pathsEpoch: 8,
  __verifyMarker: "KEEP_ME",
  jp: { cards: [{ sourceId: "c1", word: "hello" }], pathActive: true },
  en: { cards: [], pathActive: false },
};

{
  // Mid-fail: A overwritten then B fails → A=OLD_A, B absent, Z kept, learn unchanged, no GC
  const store = createMemoryBlobStore({
    A: "OLD_A",
    Z: "KEEP_Z",
  });
  store.failAfterSuccessfulPuts = 1;
  const local = makeLocal(LEARN_MARKER);
  const learnBefore = JSON.stringify(local.getLearn());

  // Insertion order A then B matters for fail-after-1
  const deskBlobs = {
    A: "NEW_A",
    B: "NEW_B",
  };

  const result = await restoreBackupV2Core(
    {
      desk: {
        files: [
          { id: "A", kind: "pdf", name: "a.pdf" },
          { id: "B", kind: "pdf", name: "b.pdf" },
        ],
      },
      learn: { preferredTrack: "en", pathsEpoch: 1, jp: { cards: [] }, en: { cards: [] } },
      deskBlobs,
      findMissingRequired: findMissingRequiredBlobs,
      deskForLocalStorage: (desk) => desk,
    },
    store,
    local.api,
  );

  assert(result.ok === false, "mid-fail restore returns ok:false");
  assert(!result.recoveryIncomplete, "rollback completed (not incomplete)");
  assert(store.raw.A === "OLD_A", "A restored to exact OLD_A");
  assert(store.raw.B === undefined, "B does not exist");
  assert(store.raw.Z === "KEEP_Z", "Z untouched");
  assert(JSON.stringify(local.getLearn()) === learnBefore, "LearnState unchanged");
  assert(local.gcCalls() === 0, "orphan GC not called on failure");
  assert(/thất bại|hoàn tác/i.test(result.message), "failure message present");
}

{
  // Snapshot failure: overwrite key listed but unreadable → abort, no mutation
  const store = createMemoryBlobStore({ Z: "KEEP_Z" });
  // Pretend A exists in key list but get fails/missing — simulate by hacking listKeys
  const realList = store.listKeys.bind(store);
  store.listKeys = async () => {
    const keys = await realList();
    return [...keys, "A"].sort();
  };
  const local = makeLocal(LEARN_MARKER);
  const learnBefore = JSON.stringify(local.getLearn());
  const zBefore = store.raw.Z;

  const result = await restoreBackupV2Core(
    {
      desk: { files: [{ id: "A", kind: "pdf", name: "a.pdf" }] },
      learn: { preferredTrack: "en", jp: { cards: [] }, en: { cards: [] } },
      deskBlobs: { A: "NEW_A" },
      findMissingRequired: findMissingRequiredBlobs,
      deskForLocalStorage: (desk) => desk,
    },
    store,
    local.api,
  );

  assert(result.ok === false, "snapshot-miss restore fails");
  assert(store.raw.A === undefined, "A not written when snapshot fails");
  assert(store.raw.Z === zBefore, "Z unchanged on snapshot abort");
  assert(JSON.stringify(local.getLearn()) === learnBefore, "Learn unchanged on snapshot abort");
  assert(local.gcCalls() === 0, "no GC on snapshot abort");
  assert(/sao chép|hủy khôi phục/i.test(result.message), "snapshot abort message");
}

{
  // Rollback incomplete: restorePuts fail → recoveryIncomplete
  const store = createMemoryBlobStore({ A: "OLD_A" });
  store.failAfterSuccessfulPuts = 1;
  const local = makeLocal(LEARN_MARKER);
  // After first put succeeds (NEW_A), B fails. Rollback tries to put OLD_A back —
  // force rollback put to fail by setting failAfterSuccessfulPuts=0 before rollback…
  // Instead: wrap putBlobs so after the restore attempt, further puts fail.
  let phase = "restore";
  const origPut = store.putBlobs.bind(store);
  store.putBlobs = async (blobs) => {
    if (phase === "restore") {
      const r = await origPut(blobs);
      phase = "rollback";
      store.failAfterSuccessfulPuts = 0;
      return r;
    }
    return origPut(blobs);
  };

  const result = await restoreBackupV2Core(
    {
      desk: {
        files: [
          { id: "A", kind: "pdf", name: "a.pdf" },
          { id: "B", kind: "pdf", name: "b.pdf" },
        ],
      },
      learn: { preferredTrack: "en", jp: { cards: [] }, en: { cards: [] } },
      deskBlobs: { A: "NEW_A", B: "NEW_B" },
      findMissingRequired: findMissingRequiredBlobs,
      deskForLocalStorage: (desk) => desk,
    },
    store,
    local.api,
  );

  assert(result.ok === false, "incomplete rollback still ok:false");
  assert(result.recoveryIncomplete === true, "recoveryIncomplete flagged");
  assert(/CẢNH BÁO/i.test(result.message), "incomplete recovery warns explicitly");
  assert(local.getLearn().__verifyMarker === "KEEP_ME", "Learn still restored from snapshot");
}

{
  // Export gate: missing required blob must not be export-ok
  const missing = findMissingRequiredBlobs(
    { files: [{ id: "pdf1", kind: "pdf", name: "x.pdf" }] },
    { note: "text-only" },
  );
  assert(missing.includes("pdf1"), "export gate detects missing required blob");
}

if (failed) {
  console.error(`\n${failed} restore-rollback smoke failure(s)`);
  process.exit(1);
}
console.log("\nsmoke-restore-rollback: all ok");
