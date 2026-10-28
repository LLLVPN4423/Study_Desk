/**
 * Slice 2B–2D provenance helpers.
 * Run: npm run smoke:provenance
 */
import {
  isDuplicateCultureCard,
  isDuplicateDeskCard,
  normalizeSourceAnchor,
  pickProvenanceFields,
  resolveCardSourceLink,
} from "../src/lib/card-provenance.ts";

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error("FAIL:", msg);
  } else console.log("ok:", msg);
}

assert(normalizeSourceAnchor(null) === undefined, "null anchor rejected");
assert(normalizeSourceAnchor({ kind: "selection" }) === undefined, "anchor without quote/page rejected");
assert(
  normalizeSourceAnchor({ kind: "selection", quote: "  hello  world  " })?.quote === "hello world",
  "quote normalized",
);
assert(
  normalizeSourceAnchor({ kind: "pdf-page", page: 2, quote: "x" })?.page === 2,
  "pdf page kept",
);

const p = pickProvenanceFields({
  origin: "desk",
  sourceFileId: " file-1 ",
  sourceAnchor: { kind: "selection", quote: "abc" },
});
assert(p.sourceFileId === "file-1" && p.origin === "desk", "provenance pick");

assert(
  isDuplicateDeskCard(
    [{ sourceId: "manual-1", word: "Hello", sourceFileId: "f1" }],
    "hello",
    "f1",
  ),
  "duplicate detected",
);
assert(
  !isDuplicateDeskCard(
    [{ sourceId: "manual-1", word: "Hello", sourceFileId: "f1" }],
    "hello",
    "f2",
  ),
  "different file not duplicate",
);
assert(
  !isDuplicateDeskCard([{ sourceId: "seed-1", word: "Hello", sourceFileId: "f1" }], "hello", "f1"),
  "curriculum id not treated as desk duplicate",
);

const ok = resolveCardSourceLink(
  { sourceFileId: "f1", sourceAnchor: { kind: "selection", quote: "quote text" } },
  [{ id: "f1", name: "note.md" }],
);
assert(ok.ok && ok.href.includes("open=f1") && ok.href.includes("highlight="), "resolve href");

const miss = resolveCardSourceLink(
  { sourceFileId: "gone", sourceAnchor: { kind: "selection", quote: "old" } },
  [{ id: "f1", name: "note.md" }],
);
assert(!miss.ok && miss.reason === "file_missing", "missing file");

const none = resolveCardSourceLink({ word: "x" }, []);
assert(!none.ok && none.reason === "missing_provenance", "no provenance");

// Legacy card without fields still "valid" for pick
assert(Object.keys(pickProvenanceFields({})).length === 0, "legacy empty provenance");

// Phase 5 culture provenance
{
  const cult = pickProvenanceFields({
    origin: "culture",
    cultureItemId: 3,
    sourceFileId: "should-not-keep",
    sourceAnchor: { kind: "notes", quote: "Takaoka" },
  });
  assert(cult.origin === "culture" && cult.cultureItemId === 3, "culture provenance pick");
  assert(cult.sourceFileId === undefined, "culture must not keep sourceFileId");
  const link = resolveCardSourceLink(cult, []);
  assert(
    link.ok && link.kind === "culture" && link.href.includes("item=3"),
    "culture source href",
  );
  assert(
    isDuplicateCultureCard(
      [{ sourceId: "manual-1", word: "加賀", origin: "culture", cultureItemId: 3 }],
      "加賀",
      3,
    ),
    "culture duplicate",
  );
  assert(
    !isDuplicateCultureCard(
      [{ sourceId: "manual-1", word: "加賀", origin: "culture", cultureItemId: 3 }],
      "加賀",
      4,
    ),
    "different culture id not duplicate",
  );
}

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log("\nsmoke-provenance: all assertions passed");
