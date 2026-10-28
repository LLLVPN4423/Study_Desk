"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import Image from "@tiptap/extension-image";
import { Table, TableRow, TableHeader, TableCell } from "@tiptap/extension-table";
import { Markdown } from "@tiptap/markdown";
import type { TextEditFormat } from "@/lib/desk-formats";
import { sanitizeEditorHtml } from "@/lib/sanitize-editor-html";

export type StudioRichHandle = {
  /** Nội dung đang hiện trong editor (ưu tiên hơn state cha). */
  getContent: () => string;
  /** Đẩy nội dung editor ra onChange + trả về chuỗi. */
  flush: () => string;
  /** Plain text of the current selection (empty if none). */
  getSelectedText: () => string;
  /**
   * Best-effort: find first occurrence of quote and select it.
   * Returns false if not found / unsupported mode — does not invent a position.
   */
  findAndSelect: (quote: string) => boolean;
};

type Props = {
  value: string;
  onChange: (next: string) => void;
  onSave?: () => void;
  format: TextEditFormat;
  placeholder?: string;
  hint?: string;
};

function looksLikeHtml(s: string) {
  return /<\/?[a-z][\s\S]*>/i.test(s.trim());
}

function toEditorHtml(raw: string) {
  const t = raw || "";
  if (!t.trim()) return "<p></p>";
  if (looksLikeHtml(t)) return sanitizeEditorHtml(t);
  return sanitizeEditorHtml(
    t
      .split(/\n{2,}/)
      .map((block) => {
        const lines = block
          .split("\n")
          .map((l) => l.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"))
          .join("<br>");
        return `<p>${lines || "<br>"}</p>`;
      })
      .join(""),
  );
}

export const StudioRichEditor = forwardRef<StudioRichHandle, Props>(
  function StudioRichEditor({ value, onChange, onSave, format, placeholder, hint }, ref) {
    const [mode, setMode] = useState<"visual" | "source">("visual");
    const [sourceDraft, setSourceDraft] = useState(value);
    const [loadError, setLoadError] = useState<string | null>(null);
    const onChangeRef = useRef(onChange);
    const onSaveRef = useRef(onSave);
    const formatRef = useRef(format);
    const valueRef = useRef(value);
    /** Bản gõ mới nhất (plain) — tránh Ctrl+S lấy value React bị trễ 1 nhịp. */
    const plainDraftRef = useRef(value);
    const plainTaRef = useRef<HTMLTextAreaElement | null>(null);

    useEffect(() => {
      onChangeRef.current = onChange;
    }, [onChange]);
    useEffect(() => {
      onSaveRef.current = onSave;
    }, [onSave]);
    useEffect(() => {
      formatRef.current = format;
    }, [format]);
    useEffect(() => {
      valueRef.current = value;
      plainDraftRef.current = value;
    }, [value]);

    function selectionFromPlain(): string {
      const el = plainTaRef.current;
      if (!el) return "";
      const a = el.selectionStart ?? 0;
      const b = el.selectionEnd ?? 0;
      if (a === b) return "";
      return (el.value || "").slice(Math.min(a, b), Math.max(a, b));
    }

    function findAndSelectInPlain(quote: string): boolean {
      const el = plainTaRef.current;
      const q = quote.trim();
      if (!el || !q) return false;
      const idx = el.value.indexOf(q);
      if (idx < 0) return false;
      el.focus();
      el.setSelectionRange(idx, idx + q.length);
      return true;
    }

    function selectionFromEditor(): string {
      if (!editor) return "";
      const { from, to, empty } = editor.state.selection;
      if (empty || from === to) return "";
      return editor.state.doc.textBetween(from, to, " ").replace(/\s+/g, " ").trim();
    }

    function findAndSelectInEditor(quote: string): boolean {
      if (!editor) return false;
      const q = quote.trim();
      if (!q) return false;
      let foundFrom = -1;
      let foundTo = -1;
      editor.state.doc.descendants((node, pos) => {
        if (foundFrom >= 0 || !node.isText || !node.text) return true;
        const i = node.text.indexOf(q);
        if (i >= 0) {
          foundFrom = pos + i;
          foundTo = foundFrom + q.length;
          return false;
        }
        return true;
      });
      if (foundFrom < 0) return false;
      editor.chain().focus().setTextSelection({ from: foundFrom, to: foundTo }).run();
      return true;
    }

    // Ctrl+S do DeskStudio bắt (tránh double-save / double Save As)

    const extensions = useMemo(() => {
      const base = [
        StarterKit.configure({
          heading: { levels: [1, 2, 3] },
        }),
        Underline,
        TextAlign.configure({ types: ["heading", "paragraph"] }),
        Link.configure({
          openOnClick: false,
          HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
        }),
        Image.configure({
          allowBase64: true,
          inline: false,
        }),
        Table.configure({ resizable: false }),
        TableRow,
        TableHeader,
        TableCell,
        Placeholder.configure({
          placeholder: placeholder || "Soạn thảo…",
        }),
      ];
      if (format === "markdown") {
        return [...base, Markdown];
      }
      return base;
    }, [format, placeholder]);

    const editor = useEditor(
      {
        extensions,
        // Load in onCreate — Word HTML có thể làm TipTap crash nếu parse lúc khởi tạo.
        content: format === "markdown" ? value || "" : "<p></p>",
        contentType: format === "markdown" ? "markdown" : undefined,
        immediatelyRender: false,
        editorProps: {
          attributes: {
            class: "studio-rich-prose",
            spellCheck: "true",
          },
        },
        onCreate: ({ editor: ed }) => {
          setLoadError(null);
          const raw = valueRef.current || "";
          try {
            if (formatRef.current === "markdown") {
              ed.commands.setContent(raw, { emitUpdate: false, contentType: "markdown" });
            } else {
              const safe = toEditorHtml(raw);
              const ok = ed.commands.setContent(safe, { emitUpdate: false });
              if (!ok) throw new Error("TipTap từ chối HTML này");
            }
          } catch (err) {
            setLoadError(err instanceof Error ? err.message : "Không parse được nội dung");
            setMode("source");
            setSourceDraft(raw);
            try {
              ed.commands.setContent(
                "<p><em>(Nội dung phức tạp — đang mở ở chế độ nguồn HTML.)</em></p>",
                { emitUpdate: false },
              );
            } catch {
              /* ignore */
            }
          }
        },
        onUpdate: ({ editor: ed }) => {
          const fmt = formatRef.current;
          if (fmt === "markdown") {
            const md = ed as typeof ed & { getMarkdown?: () => string };
            onChangeRef.current(
              typeof md.getMarkdown === "function" ? md.getMarkdown() : ed.getHTML(),
            );
          } else {
            onChangeRef.current(ed.getHTML());
          }
        },
      },
      [format],
    );

    useImperativeHandle(
      ref,
      () => ({
        getContent: () => {
          if (formatRef.current === "plain") return plainDraftRef.current || "";
          if (mode === "source") return sourceDraft;
          if (!editor) return valueRef.current || "";
          if (formatRef.current === "markdown") {
            const md = editor as typeof editor & { getMarkdown?: () => string };
            return typeof md.getMarkdown === "function" ? md.getMarkdown() : editor.getHTML();
          }
          return editor.getHTML();
        },
        flush: () => {
          let next = valueRef.current || "";
          if (formatRef.current === "plain") {
            next = plainDraftRef.current || "";
          } else if (mode === "source") {
            next = sourceDraft;
          } else if (editor) {
            if (formatRef.current === "markdown") {
              const md = editor as typeof editor & { getMarkdown?: () => string };
              next =
                typeof md.getMarkdown === "function" ? md.getMarkdown() : editor.getHTML();
            } else {
              next = editor.getHTML();
            }
          }
          valueRef.current = next;
          plainDraftRef.current = next;
          onChangeRef.current(next);
          return next;
        },
        getSelectedText: () => {
          if (formatRef.current === "plain") return selectionFromPlain();
          if (mode === "source") {
            // source textarea selection not tracked — fall back to window
            const sel = typeof window !== "undefined" ? window.getSelection()?.toString() : "";
            return (sel || "").replace(/\s+/g, " ").trim();
          }
          return selectionFromEditor();
        },
        findAndSelect: (quote: string) => {
          if (formatRef.current === "plain") return findAndSelectInPlain(quote);
          if (mode === "source") return false;
          return findAndSelectInEditor(quote);
        },
      }),
      // editor/mode/sourceDraft intentionally read via refs/closures at call time
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [editor, mode, sourceDraft],
    );

    if (format === "plain") {
      return (
        <div className="studio-rich">
          {hint ? <p className="studio-doc-hint">{hint}</p> : null}
          <div className="studio-rich-toolbar" role="toolbar" aria-label="Công cụ văn bản thuần">
            <span className="studio-rich-format-pill">TXT / plain</span>
            {onSave ? (
              <button type="button" className="active" onClick={() => onSave()} title="Ctrl+S">
                Lưu
              </button>
            ) : null}
          </div>
          <textarea
            ref={plainTaRef}
            className="studio-plain-editor"
            value={value}
            onChange={(e) => {
              plainDraftRef.current = e.target.value;
              onChange(e.target.value);
            }}
            placeholder={placeholder || "Văn bản thuần…"}
            spellCheck
          />
        </div>
      );
    }

    if (!editor) {
      return <div className="studio-rich-loading">Đang mở bộ soạn thảo…</div>;
    }

    function applySource() {
      const raw = sourceDraft;
      try {
        if (format === "markdown") {
          editor!.commands.setContent(raw, { contentType: "markdown" });
          onChange(raw);
        } else {
          const safe = toEditorHtml(raw);
          editor!.commands.setContent(safe);
          onChange(editor!.getHTML());
        }
        setLoadError(null);
        setMode("visual");
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : "Áp dụng nguồn thất bại");
      }
    }

    return (
      <div className="studio-rich">
        {hint ? <p className="studio-doc-hint">{hint}</p> : null}
        {loadError ? (
          <p className="studio-msg" style={{ margin: "8px 12px" }}>
            Lỗi mở nội dung: {loadError}. Đang dùng chế độ nguồn — sửa HTML rồi «Áp dụng nguồn».
          </p>
        ) : null}
        <div className="studio-rich-toolbar" role="toolbar" aria-label="Công cụ văn bản">
          <span className="studio-rich-format-pill">
            {format === "markdown" ? "Markdown" : "HTML / Word"}
          </span>
          <button
            type="button"
            className={mode === "visual" ? "active" : ""}
            onClick={() => {
              if (mode === "source") applySource();
              else setMode("visual");
            }}
          >
            Visual
          </button>
          <button
            type="button"
            className={mode === "source" ? "active" : ""}
            onClick={() => {
              const md = editor as typeof editor & { getMarkdown?: () => string };
              setSourceDraft(
                format === "markdown"
                  ? typeof md.getMarkdown === "function"
                    ? md.getMarkdown()
                    : value
                  : editor.getHTML(),
              );
              setMode("source");
            }}
          >
            {format === "markdown" ? "Nguồn MD" : "Nguồn HTML"}
          </button>
          <span className="studio-rich-sep" />

          {mode === "visual" ? (
            <>
              <button
                type="button"
                className={editor.isActive("bold") ? "active" : ""}
                onClick={() => editor.chain().focus().toggleBold().run()}
              >
                B
              </button>
              <button
                type="button"
                className={editor.isActive("italic") ? "active" : ""}
                onClick={() => editor.chain().focus().toggleItalic().run()}
              >
                I
              </button>
              <button
                type="button"
                className={editor.isActive("underline") ? "active" : ""}
                onClick={() => editor.chain().focus().toggleUnderline().run()}
              >
                U
              </button>
              <button
                type="button"
                className={editor.isActive("strike") ? "active" : ""}
                onClick={() => editor.chain().focus().toggleStrike().run()}
              >
                S
              </button>
              <span className="studio-rich-sep" />
              <button
                type="button"
                className={editor.isActive("heading", { level: 1 }) ? "active" : ""}
                onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              >
                H1
              </button>
              <button
                type="button"
                className={editor.isActive("heading", { level: 2 }) ? "active" : ""}
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              >
                H2
              </button>
              <button
                type="button"
                className={editor.isActive("heading", { level: 3 }) ? "active" : ""}
                onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
              >
                H3
              </button>
              <span className="studio-rich-sep" />
              <button
                type="button"
                className={editor.isActive("bulletList") ? "active" : ""}
                onClick={() => editor.chain().focus().toggleBulletList().run()}
              >
                • List
              </button>
              <button
                type="button"
                className={editor.isActive("orderedList") ? "active" : ""}
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
              >
                1. List
              </button>
              <button
                type="button"
                onClick={() =>
                  editor
                    .chain()
                    .focus()
                    .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                    .run()
                }
                title="Chèn bảng"
              >
                ▦
              </button>
              <button
                type="button"
                className={editor.isActive("blockquote") ? "active" : ""}
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
              >
                “ ”
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().setHorizontalRule().run()}
              >
                ―
              </button>
              <span className="studio-rich-sep" />
              <button
                type="button"
                className={editor.isActive({ textAlign: "left" }) ? "active" : ""}
                onClick={() => editor.chain().focus().setTextAlign("left").run()}
              >
                ⫷
              </button>
              <button
                type="button"
                className={editor.isActive({ textAlign: "center" }) ? "active" : ""}
                onClick={() => editor.chain().focus().setTextAlign("center").run()}
              >
                ≡
              </button>
              <button
                type="button"
                className={editor.isActive({ textAlign: "right" }) ? "active" : ""}
                onClick={() => editor.chain().focus().setTextAlign("right").run()}
              >
                ⫸
              </button>
              <span className="studio-rich-sep" />
              <button type="button" onClick={() => editor.chain().focus().undo().run()}>
                Undo
              </button>
              <button type="button" onClick={() => editor.chain().focus().redo().run()}>
                Redo
              </button>
              {onSave ? (
                <>
                  <span className="studio-rich-sep" />
                  <button type="button" className="active" onClick={() => onSave()} title="Ctrl+S">
                    Lưu
                  </button>
                </>
              ) : null}
            </>
          ) : (
            <button type="button" className="active" onClick={applySource}>
              Áp dụng nguồn →
            </button>
          )}
        </div>
        {mode === "source" ? (
          <textarea
            className="studio-plain-editor"
            value={sourceDraft}
            onChange={(e) => setSourceDraft(e.target.value)}
            spellCheck={false}
          />
        ) : (
          <EditorContent editor={editor} className="studio-rich-body" />
        )}
      </div>
    );
  },
);
