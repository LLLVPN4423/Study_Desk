/**
 * Chuẩn hoá HTML từ Mammoth (Word) trước khi đưa vào TipTap,
 * tránh RangeError khi gặp thẻ/layout Word TipTap chưa hiểu.
 */
export function sanitizeEditorHtml(raw: string): string {
  const input = (raw || "").trim();
  if (!input) return "<p></p>";

  if (typeof window === "undefined") {
    return input.startsWith("<") ? input : `<p>${escapeText(input)}</p>`;
  }

  try {
    const doc = new DOMParser().parseFromString(
      looksLikeHtml(input) ? input : `<p>${escapeText(input)}</p>`,
      "text/html",
    );
    doc.querySelectorAll("script,style,meta,link,iframe,object,embed").forEach((n) => n.remove());

    // Thẻ Word / Office namespace
    doc.querySelectorAll("o\\:p, w\\:sdt, w\\:sdtcontent").forEach((n) => {
      const parent = n.parentNode;
      if (!parent) {
        n.remove();
        return;
      }
      while (n.firstChild) parent.insertBefore(n.firstChild, n);
      n.remove();
    });

    // Word hay nhét v:*, o:* — bỏ hết
    doc.querySelectorAll("*").forEach((el) => {
      [...el.attributes].forEach((attr) => {
        const name = attr.name.toLowerCase();
        if (
          name.startsWith("on") ||
          name === "xmlns" ||
          name.startsWith("xmlns:") ||
          name.startsWith("v:") ||
          name.startsWith("o:") ||
          name.startsWith("w:") ||
          name === "class" ||
          name === "style" ||
          name === "lang" ||
          name.startsWith("data-")
        ) {
          // Giữ style tối thiểu cho ảnh căn lề — còn lại bỏ để TipTap ổn định
          if (name === "style" && el.tagName === "IMG") return;
          el.removeAttribute(attr.name);
        }
      });
    });

    // span/font → unwrap text
    doc.querySelectorAll("span, font").forEach((el) => {
      const parent = el.parentNode;
      if (!parent) {
        el.remove();
        return;
      }
      while (el.firstChild) parent.insertBefore(el.firstChild, el);
      el.remove();
    });

    // div không có block con → đổi thành p
    doc.querySelectorAll("div").forEach((div) => {
      const hasBlock = [...div.children].some((c) =>
        /^(P|H[1-6]|UL|OL|TABLE|BLOCKQUOTE|PRE|DIV|HR)$/i.test(c.tagName),
      );
      if (!hasBlock) {
        const p = doc.createElement("p");
        while (div.firstChild) p.appendChild(div.firstChild);
        div.replaceWith(p);
      } else {
        const parent = div.parentNode;
        if (!parent) return;
        while (div.firstChild) parent.insertBefore(div.firstChild, div);
        div.remove();
      }
    });

    // Ảnh: giữ src data/http, bỏ kích thước cực lớn gây đơ
    doc.querySelectorAll("img").forEach((img) => {
      const src = img.getAttribute("src") || "";
      if (!src || src.startsWith("file:")) {
        img.replaceWith(doc.createTextNode("[ảnh]"));
        return;
      }
      img.removeAttribute("srcset");
      if (src.length > 1_500_000) {
        img.replaceWith(doc.createTextNode("[ảnh quá lớn — đã bỏ để mở được file]"));
      }
    });

    // Bảng thiếu tbody — TipTap Table ổn hơn với cấu trúc chuẩn
    doc.querySelectorAll("table").forEach((table) => {
      if (!table.querySelector("tbody") && table.querySelector("tr")) {
        const tbody = doc.createElement("tbody");
        [...table.children].forEach((child) => {
          if (child.tagName === "TR") tbody.appendChild(child);
        });
        if (tbody.childNodes.length) table.appendChild(tbody);
      }
    });

    let html = doc.body.innerHTML.trim();
    if (!html) html = "<p></p>";
    // TipTap cần block root
    if (!/^\s*</.test(html)) html = `<p>${html}</p>`;
    return html;
  } catch {
    return `<p>${escapeText(input.slice(0, 20000))}</p>`;
  }
}

function looksLikeHtml(s: string) {
  return /<\/?[a-z][\s\S]*>/i.test(s.trim());
}

function escapeText(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
}
