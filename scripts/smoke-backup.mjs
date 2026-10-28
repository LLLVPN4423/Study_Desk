/**
 * Smoke tests for backup-format pure helpers (no browser / IndexedDB).
 * Run: node --experimental-strip-types scripts/smoke-backup.mjs
 * (imports ../src/lib/backup-format.ts)
 */

import {
  BACKUP_VERSION_CURRENT,
  findMissingRequiredBlobs,
  parseBackupJson,
  stripDeskInlineBlobs,
  validateBackupPayload,
  buildBlobMetaFromFiles,
} from "../src/lib/backup-format.ts";

let failed = 0;

function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error("FAIL:", msg);
  } else {
    console.log("ok:", msg);
  }
}

// 1) reject empty / bad JSON
{
  const a = parseBackupJson("");
  assert(!a.ok && a.error.code === "empty", "empty backup rejected");
  const b = parseBackupJson("{not json");
  assert(!b.ok && b.error.code === "parse", "invalid JSON rejected");
}

// 2) reject unsupported version
{
  const v = validateBackupPayload({ version: 99, desk: { files: [] }, learn: {} });
  assert(!v.ok && v.error.code === "version", "unsupported version rejected");
}

// 3) accept legacy v1 (metadata only)
{
  const v = validateBackupPayload({
    version: 1,
    exportedAt: "2026-01-01T00:00:00.000Z",
    session: null,
    desk: { files: [{ id: "a", name: "n.txt", kind: "note" }] },
    learn: { version: 1 },
  });
  assert(v.ok && v.payload.version === 1, "legacy v1 accepted");
}

// 4) reject v2 without deskBlobs
{
  const v = validateBackupPayload({
    version: 2,
    desk: { files: [] },
    learn: {},
  });
  assert(!v.ok && v.error.code === "shape", "v2 without deskBlobs rejected");
}

// 5) reject duplicate ids
{
  const v = validateBackupPayload({
    version: 2,
    desk: {
      files: [
        { id: "x", kind: "pdf", name: "a.pdf" },
        { id: "x", kind: "pdf", name: "b.pdf" },
      ],
    },
    learn: {},
    deskBlobs: { x: "data:application/pdf;base64,AAA" },
  });
  assert(!v.ok && v.error.code === "duplicate_ids", "duplicate ids rejected");
}

// 6) reject empty blob values
{
  const v = validateBackupPayload({
    version: 2,
    desk: { files: [{ id: "p1", kind: "pdf", name: "a.pdf" }] },
    learn: {},
    deskBlobs: { p1: "" },
  });
  assert(!v.ok && v.error.code === "invalid_blob", "empty blob value rejected");
}

// 7) v2 with PDF + audio blobs present
{
  const pdf = "data:application/pdf;base64,JVBERi0x";
  const audio = "data:audio/mpeg;base64,SUQz";
  const payload = {
    version: BACKUP_VERSION_CURRENT,
    exportedAt: "2026-10-28T00:00:00.000Z",
    session: null,
    desk: {
      files: [
        { id: "pdf1", kind: "pdf", name: "study.pdf", size: 12 },
        { id: "aud1", kind: "audio", name: "listen.mp3", size: 8 },
        { id: "note1", kind: "note", name: "memo.txt", content: "hi" },
      ],
    },
    learn: { cards: [] },
    deskBlobs: {
      pdf1: pdf,
      aud1: audio,
      "content:note1": "hi",
    },
  };
  const v = validateBackupPayload(payload);
  assert(v.ok && v.payload.version === 2, "v2 pdf+audio accepted");
  const missing = findMissingRequiredBlobs(payload.desk, payload.deskBlobs);
  assert(missing.length === 0, "required primary blobs present");
  const meta = buildBlobMetaFromFiles(payload.desk.files, payload.deskBlobs);
  assert(meta.pdf1?.role === "primary" && meta.pdf1.mime === "application/pdf", "blob meta mime");
  assert(meta.aud1?.mime === "audio/mpeg", "audio mime in meta");
}

// 8) missing required blob detected
{
  const missing = findMissingRequiredBlobs(
    { files: [{ id: "pdf1", kind: "pdf", name: "a.pdf" }] },
    {},
  );
  assert(missing.includes("pdf1"), "missing pdf blob detected");
}

// 9) strip inline blobs
{
  const stripped = stripDeskInlineBlobs({
    files: [
      {
        id: "1",
        kind: "pdf",
        name: "a.pdf",
        dataUrl: "data:application/pdf;base64,AAA",
        sourceDataUrl: "data:application/pdf;base64,BBB",
        notes: "x",
      },
    ],
  });
  assert(!("dataUrl" in stripped.files[0]), "dataUrl stripped");
  assert(!("sourceDataUrl" in stripped.files[0]), "sourceDataUrl stripped");
  assert(stripped.files[0].notes === "x", "notes preserved");
}

// 10) malformed root
{
  const v = validateBackupPayload(null);
  assert(!v.ok, "null root rejected");
}

if (failed) {
  console.error(`\n${failed} smoke assertion(s) failed`);
  process.exit(1);
}
console.log("\nsmoke-backup: all assertions passed");
