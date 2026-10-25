/**
 * HTML TipTap đơn giản → .docx (lossy). Đủ mở–sửa–tải lại đuôi .docx.
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  ImageRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  type ParagraphChild,
} from "docx";

function dataUrlToUint8(dataUrl: string): Uint8Array | null {
  try {
    const raw = dataUrl.includes(",") ? dataUrl.split(",")[1]! : dataUrl;
    const binary = atob(raw);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

function alignOf(el: Element) {
  const a = (el.getAttribute("style") || "").match(/text-align:\s*(left|right|center|justify)/i);
  const v = (a?.[1] || "").toLowerCase();
  if (v === "center") return AlignmentType.CENTER;
  if (v === "right") return AlignmentType.RIGHT;
  if (v === "justify") return AlignmentType.BOTH;
  return AlignmentType.LEFT;
}

function runsFromNode(node: Node, marks: { bold?: boolean; italics?: boolean; underline?: boolean } = {}): ParagraphChild[] {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent || "";
    if (!text) return [];
    return [
      new TextRun({
        text,
        bold: marks.bold,
        italics: marks.italics,
        underline: marks.underline ? {} : undefined,
      }),
    ];
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return [];
  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();
  if (tag === "br") return [new TextRun({ break: 1 })];
  if (tag === "img") {
    const src = el.getAttribute("src") || "";
    const bytes = src.startsWith("data:") ? dataUrlToUint8(src) : null;
    if (bytes && bytes.length < 2_000_000) {
      const isJpg = /^data:image\/jpe?g/i.test(src);
      try {
        return [
          new ImageRun({
            type: isJpg ? "jpg" : "png",
            data: bytes,
            transformation: { width: 320, height: 240 },
          }),
        ];
      } catch {
        return [new TextRun({ text: "[ảnh]" })];
      }
    }
    return [new TextRun({ text: "[ảnh]" })];
  }
  const next = {
    bold: marks.bold || tag === "strong" || tag === "b",
    italics: marks.italics || tag === "em" || tag === "i",
    underline: marks.underline || tag === "u",
  };
  const out: ParagraphChild[] = [];
  el.childNodes.forEach((child) => {
    out.push(...runsFromNode(child, next));
  });
  return out;
}

function blockToParagraphs(el: Element): Array<Paragraph | Table> {
  const tag = el.tagName.toLowerCase();
  if (tag === "table") {
    const rows = [...el.querySelectorAll(":scope > tbody > tr, :scope > tr")].map((tr) => {
      const cells = [...tr.querySelectorAll(":scope > th, :scope > td")].map(
        (td) =>
          new TableCell({
            width: { size: 2400, type: WidthType.DXA },
            children: [
              new Paragraph({
                children: runsFromNode(td),
              }),
            ],
          }),
      );
      return new TableRow({ children: cells.length ? cells : [new TableCell({ children: [new Paragraph({})] })] });
    });
    if (!rows.length) return [];
    return [new Table({ rows, width: { size: 9000, type: WidthType.DXA } })];
  }

  if (tag === "ul" || tag === "ol") {
    return [...el.children].flatMap((li, i) => {
      if (li.tagName.toLowerCase() !== "li") return [];
      const bullet = tag === "ol" ? `${i + 1}. ` : "• ";
      return [
        new Paragraph({
          children: [new TextRun({ text: bullet }), ...runsFromNode(li)],
          spacing: { after: 80 },
        }),
      ];
    });
  }

  if (/^h[1-3]$/.test(tag)) {
    const level =
      tag === "h1" ? HeadingLevel.HEADING_1 : tag === "h2" ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3;
    return [
      new Paragraph({
        heading: level,
        alignment: alignOf(el),
        children: runsFromNode(el),
      }),
    ];
  }

  if (tag === "blockquote") {
    return [
      new Paragraph({
        alignment: alignOf(el),
        indent: { left: 420 },
        children: runsFromNode(el),
        spacing: { after: 120 },
      }),
    ];
  }

  if (tag === "p" || tag === "div") {
    const children = runsFromNode(el);
    return [
      new Paragraph({
        alignment: alignOf(el),
        children: children.length ? children : [new TextRun({ text: "" })],
        spacing: { after: 120 },
      }),
    ];
  }

  // fallback unwrap
  return [...el.children].flatMap((child) => blockToParagraphs(child));
}

export async function htmlToDocxDataUrl(html: string, title = "document"): Promise<string> {
  if (typeof window === "undefined") {
    throw new Error("htmlToDocxDataUrl chỉ chạy trên browser");
  }
  const doc = new DOMParser().parseFromString(
    html?.trim() ? html : "<p></p>",
    "text/html",
  );
  const blocks = [...doc.body.children].flatMap((el) => blockToParagraphs(el));
  const children = blocks.length
    ? blocks
    : [new Paragraph({ children: [new TextRun({ text: doc.body.textContent || "" })] })];

  const document = new Document({
    creator: "Study Desk",
    title,
    sections: [{ children }],
  });
  const blob = await Packer.toBlob(document);
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("docx read failed"));
    reader.readAsDataURL(blob);
  });
}

export function ensureDocxName(name: string) {
  const base = name.replace(/\.(docx?|html?|txt|md)$/i, "") || "document";
  return `${base}.docx`;
}
