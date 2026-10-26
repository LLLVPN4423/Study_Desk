/** Regenerate only grammar-en.json from import-curriculum buildEnGrammar. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcPath = path.join(__dirname, "import-curriculum.mjs");
const src = fs.readFileSync(srcPath, "utf8");
const start = src.indexOf("function buildEnGrammar");
const end = src.indexOf("\nfunction existsRaw");
if (start < 0 || end < 0) throw new Error("buildEnGrammar not found");
const fnBody = src.slice(start, end);
const outFile = path.join(__dirname, "_regen-grammar-run.mjs");
fs.writeFileSync(
  outFile,
  `import fs from "node:fs";\nimport path from "node:path";\nimport { fileURLToPath } from "node:url";\nconst __dirname = path.dirname(fileURLToPath(import.meta.url));\n${fnBody}\nconst g = buildEnGrammar();\nfs.writeFileSync(path.join(__dirname, "../src/data/grammar-en.json"), JSON.stringify(g, null, 2) + "\\n");\nconsole.log("grammar-en", g.length, "byLevel", Object.fromEntries(["A1","A2","B1","B2","C1","C2"].map(L => [L, g.filter(x => x.level===L).length])));\n`,
);
await import(pathToFileURL(outFile).href);
fs.unlinkSync(outFile);
