/**
 * Phase 4 S0 — pure desk/blob integrity helpers.
 * Run: npm run smoke:integrity
 */
import {
  classifyRestoreBlobKeys,
  findBrokenDeskProvenance,
  findMissingReferencedBlobs,
  findMissingRequiredPrimaryBlobs,
  findOrphanBlobKeys,
  planOrphanGc,
  planRestoreBlobRollback,
  referencedBlobKeysFromDesk,
  requiredPrimaryKeysFromDesk,
} from "../src/lib/desk-integrity.ts";

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error("FAIL:", msg);
  } else {
    console.log("ok:", msg);
  }
}

const desk = {
  wallpaper: "custom",
  files: [
    { id: "pdf1", kind: "pdf" },
    { id: "note1", kind: "note", content: "hello" },
  ],
};

{
  const refs = referencedBlobKeysFromDesk(desk);
  assert(refs.has("pdf1"), "refs primary pdf");
  assert(refs.has("source:pdf1") && refs.has("content:pdf1") && refs.has("ann:pdf1"), "refs side keys");
  assert(refs.has("note1") && refs.has("content:note1"), "refs note keys");
  assert(refs.has("wallpaper:custom"), "refs custom wallpaper");
  assert(requiredPrimaryKeysFromDesk(desk).join(",") === "pdf1", "required primary only binary");
}

{
  const refs = referencedBlobKeysFromDesk(desk);
  const orphans = findOrphanBlobKeys(
    ["pdf1", "ghost", "content:pdf1", "wallpaper:custom", "stale:x"],
    refs,
  );
  assert(orphans.join(",") === "ghost,stale:x", "orphan keys detected");
  const planned = planOrphanGc(
    ["pdf1", "ghost", "content:pdf1", "wallpaper:custom", "stale:x"],
    desk,
  );
  assert(planned.join(",") === "ghost,stale:x", "planOrphanGc matches");
  const afterDelete = planOrphanGc(
    ["pdf1", "source:pdf1", "content:pdf1", "ann:pdf1", "note1", "content:note1", "orphan-old"],
    { files: [{ id: "note1", kind: "note" }], wallpaper: "none" },
  );
  assert(
    afterDelete.includes("pdf1") &&
      afterDelete.includes("orphan-old") &&
      !afterDelete.includes("note1"),
    "GC after file remove keeps remaining file keys",
  );
}

{
  const blobs = { pdf1: "data:application/pdf;base64,AAA" };
  assert(findMissingRequiredPrimaryBlobs(desk, blobs).length === 0, "required present");
  assert(
    findMissingRequiredPrimaryBlobs(desk, {}).join(",") === "pdf1",
    "required missing",
  );
  const refs = referencedBlobKeysFromDesk({ files: [{ id: "pdf1", kind: "pdf" }] });
  const miss = findMissingReferencedBlobs(refs, { pdf1: "x" });
  assert(miss.includes("source:pdf1") && miss.includes("content:pdf1"), "optional side keys may be missing");
}

{
  const c = classifyRestoreBlobKeys(["a", "b", "c"], ["a", "z"]);
  assert(c.overwriteKeys.join(",") === "a", "overwrite classified");
  assert(c.novelKeys.join(",") === "b,c", "novel classified");
}

{
  const plan = planRestoreBlobRollback({
    writtenKeys: ["a", "b", "c"],
    previousSnapshots: { a: "OLD_A" },
    novelKeys: ["b", "c"],
  });
  assert(plan.restorePuts.a === "OLD_A", "rollback restores overwritten");
  assert(plan.deleteKeys.join(",") === "b,c", "rollback deletes only novel written");
  assert(!("z" in plan.restorePuts), "no delete of untouched old keys");
}

{
  // Overwritten key written but snapshot missing → cannot invent delete of old key
  const plan = planRestoreBlobRollback({
    writtenKeys: ["a"],
    previousSnapshots: {},
    novelKeys: [],
  });
  assert(Object.keys(plan.restorePuts).length === 0, "no snapshot → no put");
  assert(plan.deleteKeys.length === 0, "overwrite without snapshot is not deleted");
}

{
  // S2: partial write — restore old A, delete novel B, leave untouched Z alone
  const c = classifyRestoreBlobKeys(["a", "b"], ["a", "z"]);
  const plan = planRestoreBlobRollback({
    writtenKeys: ["a", "b"],
    previousSnapshots: { a: "PREV_A" },
    novelKeys: c.novelKeys,
  });
  assert(plan.restorePuts.a === "PREV_A" && !plan.restorePuts.z, "S2 restore only overwrite");
  assert(plan.deleteKeys.join(",") === "b", "S2 delete only novel written");
}

{
  const broken = findBrokenDeskProvenance(
    [
      { sourceId: "manual-1", origin: "desk", sourceFileId: "gone" },
      { sourceId: "manual-2", origin: "desk" },
      { sourceId: "manual-3", origin: "manual", sourceFileId: "ok" },
      { sourceId: "manual-4", origin: "culture", cultureItemId: 1 },
    ],
    ["ok"],
  );
  assert(
    broken.some((b) => b.sourceId === "manual-1" && b.issue === "file_missing"),
    "desk card file_missing",
  );
  assert(
    broken.some((b) => b.sourceId === "manual-2" && b.issue === "missing_file_id"),
    "desk card missing_file_id",
  );
  assert(!broken.some((b) => b.sourceId === "manual-3"), "ok file not broken");
  assert(!broken.some((b) => b.sourceId === "manual-4"), "culture without file id ok");
}

if (failed) {
  console.error(`\n${failed} integrity smoke failure(s)`);
  process.exit(1);
}
console.log("\nsmoke-integrity: all ok");
