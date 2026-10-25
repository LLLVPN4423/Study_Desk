/**
 * Sao chép pdf.js worker + fonts/cmaps vào public/pdfjs (Inkbar dùng local, không CDN).
 * Chạy sau npm install — không cần commit thư mục public/pdfjs.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcRoot = path.join(root, "node_modules", "pdfjs-dist");
const destRoot = path.join(root, "public", "pdfjs");

function copyFile(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

function copyDir(from, to) {
  if (!fs.existsSync(from)) return;
  fs.mkdirSync(to, { recursive: true });
  for (const name of fs.readdirSync(from)) {
    const a = path.join(from, name);
    const b = path.join(to, name);
    if (fs.statSync(a).isDirectory()) copyDir(a, b);
    else copyFile(a, b);
  }
}

if (!fs.existsSync(srcRoot)) {
  console.warn("[copy-pdfjs] pdfjs-dist chưa có — bỏ qua.");
  process.exit(0);
}

fs.mkdirSync(destRoot, { recursive: true });
copyFile(
  path.join(srcRoot, "build", "pdf.worker.min.mjs"),
  path.join(destRoot, "pdf.worker.min.mjs"),
);
copyDir(path.join(srcRoot, "cmaps"), path.join(destRoot, "cmaps"));
copyDir(path.join(srcRoot, "standard_fonts"), path.join(destRoot, "standard_fonts"));
copyDir(path.join(srcRoot, "wasm"), path.join(destRoot, "wasm"));
copyDir(path.join(srcRoot, "iccs"), path.join(destRoot, "iccs"));
console.log("[copy-pdfjs] Đã cập nhật public/pdfjs");
