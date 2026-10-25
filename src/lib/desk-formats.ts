/** Detect / label desk file formats (documents + audio + images). */

import type { DeskFileKind } from "./desk-store";

/** Study materials — audio goes through MUSIC_ACCEPT so playlist không remount Studio. */
export const DESK_ACCEPT =
  [
    ".pdf,application/pdf",
    ".txt,.md,.markdown,.csv,.json,.html,.htm,.rtf,text/plain,text/markdown,text/csv,application/json,text/html,text/rtf",
    ".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".png,.jpg,.jpeg,.webp,.gif,.svg,.bmp,image/*",
  ].join(",");

export const MUSIC_ACCEPT =
  ".mp3,.wav,.ogg,.oga,.m4a,.aac,.flac,.webm,.opus,audio/*";

export const DESK_ACCEPT_HINT =
  "PDF · Word · TXT/MD/HTML · ảnh — Ctrl+S ghi đè file đã mở";

export const MUSIC_ACCEPT_HINT = "MP3 · WAV · M4A · OGG · FLAC · AAC…";

const AUDIO_EXT = new Set([
  "mp3",
  "wav",
  "ogg",
  "oga",
  "m4a",
  "aac",
  "flac",
  "webm",
  "opus",
]);
const IMAGE_EXT = new Set(["png", "jpg", "jpeg", "webp", "gif", "svg", "bmp"]);
const NOTE_EXT = new Set([
  "txt",
  "md",
  "markdown",
  "csv",
  "json",
  "html",
  "htm",
  "rtf",
]);
const DOC_EXT = new Set(["doc", "docx"]);

export function extOf(name: string) {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

/** How Studio should edit a text-like file. */
export type TextEditFormat = "html" | "markdown" | "plain";

export function textEditFormatOf(name: string, kind?: DeskFileKind): TextEditFormat {
  const ext = extOf(name);
  if (kind === "doc") return "html";
  if (ext === "md" || ext === "markdown") return "markdown";
  if (ext === "html" || ext === "htm") return "html";
  if (
    ext === "txt" ||
    ext === "csv" ||
    ext === "json" ||
    ext === "rtf" ||
    ext === "log"
  ) {
    return "plain";
  }
  // New notes default to html rich text
  if (!ext || kind === "note") return "html";
  return "html";
}

export function formatToolkitHint(format: TextEditFormat, kind?: DeskFileKind) {
  if (kind === "doc") {
    return "Word · Ctrl+S ghi đè file đã mở · layout phức tạp có thể giản lược.";
  }
  switch (format) {
    case "markdown":
      return "Markdown · Ctrl+S ghi đè file đã mở từ máy.";
    case "plain":
      return "TXT · Ctrl+S ghi đè file đã mở từ máy.";
    default:
      return "Rich text · Ctrl+S lưu trên bàn / ghi đè nếu đã mở từ máy.";
  }
}

export function normalizeKind(kind: string | undefined | null): DeskFileKind {
  if (kind === "mp3") return "audio";
  if (kind === "pdf" || kind === "note" || kind === "audio" || kind === "image" || kind === "doc") {
    return kind;
  }
  return "note";
}

export function detectDeskKind(file: File): DeskFileKind | null {
  const lower = file.name.toLowerCase();
  const ext = extOf(lower);
  const type = file.type || "";

  if (type === "application/pdf" || ext === "pdf") return "pdf";
  if (
    type.startsWith("audio/") ||
    AUDIO_EXT.has(ext) ||
    lower.endsWith(".mp3")
  ) {
    return "audio";
  }
  if (type.startsWith("image/") || IMAGE_EXT.has(ext)) return "image";
  if (
    ext === "docx" ||
    type.includes("wordprocessingml") ||
    type === "application/msword" ||
    ext === "doc"
  ) {
    return "doc";
  }
  if (
    NOTE_EXT.has(ext) ||
    type.startsWith("text/") ||
    type === "application/json" ||
    type === "text/markdown"
  ) {
    return "note";
  }
  return null;
}

export function kindLabel(kind: DeskFileKind) {
  switch (kind) {
    case "pdf":
      return "PDF";
    case "note":
      return "TEXT";
    case "audio":
      return "AUDIO";
    case "image":
      return "IMAGE";
    case "doc":
      return "DOC";
    default:
      return "FILE";
  }
}

export function kindTag(kind: DeskFileKind) {
  switch (kind) {
    case "pdf":
      return "Notes";
    case "note":
      return "Note";
    case "audio":
      return "Listening";
    case "image":
      return "Image";
    case "doc":
      return "Document";
    default:
      return "File";
  }
}

export function kindIconName(kind: DeskFileKind): "file" | "edit" | "audio" | "layers" {
  if (kind === "audio") return "audio";
  if (kind === "note") return "edit";
  if (kind === "image") return "layers";
  return "file";
}

export function replaceAcceptFor(kind: DeskFileKind) {
  switch (kind) {
    case "pdf":
      return ".pdf,application/pdf";
    case "audio":
      return ".mp3,.wav,.ogg,.m4a,.aac,.flac,.webm,.opus,audio/*";
    case "image":
      return ".png,.jpg,.jpeg,.webp,.gif,.svg,.bmp,image/*";
    case "doc":
      return ".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "note":
      return ".txt,.md,.markdown,.csv,.json,.html,.htm,.rtf,text/plain,text/markdown,text/csv,application/json,text/html";
    default:
      return DESK_ACCEPT;
  }
}

export function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export async function extractDocContent(file: File): Promise<string> {
  const ext = extOf(file.name);
  if (ext === "docx" || file.type.includes("wordprocessingml")) {
    try {
      const mammoth = await import("mammoth");
      const { sanitizeEditorHtml } = await import("./sanitize-editor-html");
      const buf = await file.arrayBuffer();
      const result = await mammoth.convertToHtml(
        { arrayBuffer: buf },
        {
          convertImage: mammoth.images.imgElement((image) =>
            image.read("base64").then((imageBuffer) => ({
              src: `data:${image.contentType};base64,${imageBuffer}`,
            })),
          ),
        },
      );
      const html = sanitizeEditorHtml((result.value || "").trim());
      return html || "<p>(Không trích được nội dung từ Word.)</p>";
    } catch (err) {
      const msg = err instanceof Error ? err.message : "lỗi không rõ";
      return (
        `<p><strong>Không mở được nội dung .docx</strong> (${msg}).</p>` +
        `<p>Vẫn giữ file gốc — dùng nút <em>Gốc</em> để tải .docx, hoặc Thay bằng bản khác.</p>`
      );
    }
  }
  if (ext === "doc") {
    return (
      "<p><strong>File .doc (Word 97–2003)</strong> — trình duyệt không đọc layout được.</p>" +
      "<p>Hãy lưu lại thành <strong>.docx</strong> trong Word rồi tải lên, hoặc ghi chú ở panel phải.</p>"
    );
  }
  return "";
}
