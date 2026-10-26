"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/Button";
import { DigitalFocusClock } from "@/components/DigitalFocusClock";
import { Icon } from "@/components/Icon";
import { DeskMusicDock } from "@/components/DeskMusicDock";
import { DeskSchedule } from "@/components/DeskSchedule";
import { SaveLeaveDialog } from "@/components/SaveLeaveDialog";
import type { StudioRichHandle } from "@/components/StudioRichEditor";
import type { StudioPdfHandle } from "@/components/StudioPdfViewer";
import type { DeskMusicApi } from "@/hooks/useDeskMusic";
import {
  detectDeskKind,
  extractDocContent,
  formatToolkitHint,
  kindIconName,
  kindLabel,
  readAsDataUrl,
  replaceAcceptFor,
  textEditFormatOf,
} from "@/lib/desk-formats";
import {
  FOCUS_PRESETS_MIN,
  canUpload,
  deleteFile,
  byteLengthOfText,
  downloadDeskFile,
  formatBytes,
  patchFile,
  persistFileBlobs,
  pushFileOutput,
  removeFileOutput,
  type DeskFile,
  type DeskFileKind,
  type DeskState,
  type DeskTask,
} from "@/lib/desk-store";
import {
  blobFromEditedDeskFile,
  hasFileHandle,
  writeBlobToDisk,
} from "@/lib/file-handles";
import { addManualCard, loadLearn, type TrackId } from "@/lib/learn-store";
import { canListen, listenOnce } from "@/lib/speech";

const StudioRichEditor = dynamic(
  () => import("@/components/StudioRichEditor").then((m) => m.StudioRichEditor),
  {
    ssr: false,
    loading: () => <div className="studio-rich-loading">Đang mở bộ soạn thảo…</div>,
  },
);

const StudioPdfViewer = dynamic(
  () => import("@/components/StudioPdfViewer").then((m) => m.StudioPdfViewer),
  {
    ssr: false,
    loading: () => <div className="studio-rich-loading">Đang mở PDF…</div>,
  },
);

type Props = {
  desk: DeskState;
  activeId: string;
  userName: string;
  seconds: number;
  running: boolean;
  onSeconds: (n: number) => void;
  onRunning: (v: boolean) => void;
  onUpdate: (next: DeskState) => void;
  onSelect: (id: string) => void;
  onClose: () => void;
  /** Mở từ máy (có quyền ghi) — Ctrl+S ghi đè thẳng. */
  onOpenFromDisk: () => void;
  onUploadMusic: () => void;
  onCreateNote: () => void;
  music: DeskMusicApi;
};

type SideTab = "learn" | "out" | "focus";
type SourceFilter = "all" | DeskFileKind;

function fileIconClass(kind: DeskFileKind) {
  if (kind === "audio") return "audio";
  if (kind === "note") return "note";
  if (kind === "image") return "image";
  if (kind === "doc") return "doc";
  return "file";
}

export function DeskStudio({
  desk,
  activeId,
  userName,
  seconds,
  running,
  onSeconds,
  onRunning,
  onUpdate,
  onSelect,
  onClose,
  onOpenFromDisk,
  onUploadMusic,
  onCreateNote,
  music,
}: Props) {
  const file = desk.files.find((f) => f.id === activeId) || null;
  const [linkedToDisk, setLinkedToDisk] = useState(false);
  const [content, setContent] = useState(file?.content || "");
  const [notes, setNotes] = useState(file?.notes || "");
  const [snippet, setSnippet] = useState("");
  const [meaning, setMeaning] = useState("");
  const [track, setTrack] = useState<TrackId>("jp");
  const [msg, setMsg] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "dirty" | "saving" | "saved">("idle");
  const [imgZoom, setImgZoom] = useState(100);
  const [imgRotate, setImgRotate] = useState(0);
  const [sideTab, setSideTab] = useState<SideTab>("learn");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [sourceQuery, setSourceQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const sourceToolbarRef = useRef<HTMLDivElement>(null);
  const replaceRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<StudioPdfHandle | null>(null);
  const richRef = useRef<StudioRichHandle | null>(null);
  const saveTimer = useRef<number | null>(null);
  const deskLive = useRef(desk);
  const pending = useRef<{
    fileId: string;
    content?: string;
    notes?: string;
    pdfAnnotations?: unknown[];
  } | null>(null);
  const savedFlashTimer = useRef<number | null>(null);
  /** Đã sửa sau lần ghi ra máy gần nhất (hoặc sau khi mở) — hỏi lưu khi đổi file. */
  const editDirtyRef = useRef(false);
  const [leavePrompt, setLeavePrompt] = useState<null | { kind: "close" } | { kind: "select"; id: string }>(
    null,
  );
  /** Tăng sau bake PDF → remount viewer với bytes đã ghi (thấy sửa ngay, không cần tải về). */
  const [pdfEpoch, setPdfEpoch] = useState(0);

  deskLive.current = desk;
  const { listeningId, play, stop } = music;
  function persist(next: DeskState) {
    deskLive.current = next;
    onUpdate(next);
    setSaveState("saved");
    if (savedFlashTimer.current) window.clearTimeout(savedFlashTimer.current);
    savedFlashTimer.current = window.setTimeout(() => setSaveState("idle"), 1600);
  }

  function flushPending() {
    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    const draft = pending.current;
    if (!draft) return;
    pending.current = null;
    setSaveState("saving");
    let next = deskLive.current;
    const patch: Partial<DeskFile> = {};
    if (draft.content !== undefined) patch.content = draft.content;
    if (draft.notes !== undefined) patch.notes = draft.notes;
    if (draft.pdfAnnotations !== undefined) patch.pdfAnnotations = draft.pdfAnnotations;
    if (Object.keys(patch).length === 0) return;
    next = patchFile(next, draft.fileId, patch);
    persist(next);
  }

  function markEdited() {
    editDirtyRef.current = true;
  }

  function clearEdited() {
    editDirtyRef.current = false;
  }

  function annsEqual(a: unknown[] | undefined, b: unknown[] | undefined) {
    try {
      return JSON.stringify(a || []) === JSON.stringify(b || []);
    } catch {
      return false;
    }
  }

  function schedule(field: "content" | "notes", value: string, fileId = file?.id) {
    if (!fileId) return;
    const saved = deskLive.current.files.find((f) => f.id === fileId);
    const prev = field === "content" ? saved?.content || "" : saved?.notes || "";
    if (field === "content") setContent(value);
    else setNotes(value);
    if (value !== prev) markEdited();
    setSaveState("dirty");
    pending.current = {
      ...(pending.current?.fileId === fileId ? pending.current : { fileId }),
      fileId,
      [field]: value,
    };
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => flushPending(), 400);
  }

  function applyPatch(patch: Partial<DeskFile>, fileId = file?.id) {
    if (!fileId) return;
    // Immediate patches (rename / replace) — flush text drafts for same file first
    if (pending.current?.fileId === fileId) flushPending();
    setSaveState("saving");
    persist(patchFile(deskLive.current, fileId, patch));
  }

  function scheduleAnnotations(next: unknown[], fileId = file?.id) {
    if (!fileId) return;
    const saved = deskLive.current.files.find((f) => f.id === fileId)?.pdfAnnotations;
    if (!annsEqual(next, saved as unknown[] | undefined)) markEdited();
    setSaveState("dirty");
    pending.current = {
      ...(pending.current?.fileId === fileId ? pending.current : { fileId }),
      fileId,
      pdfAnnotations: next,
    };
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => flushPending(), 400);
  }

  function liveEditorContent() {
    if (!file) return content;
    if (file.kind === "note" || file.kind === "doc") {
      return richRef.current?.flush() ?? content;
    }
    return content;
  }

  function sizeFromDataUrl(dataUrl: string) {
    const b64 = dataUrl.includes(",") ? dataUrl.split(",")[1]! : dataUrl;
    return Math.floor((b64.length * 3) / 4);
  }

  /** Gộp sửa vào bytes gốc (PDF bake / DOCX từ HTML). */
  async function commitBinaryEdits(): Promise<DeskFile | null> {
    if (!file) return null;

    if (file.kind === "pdf" && file.dataUrl) {
      const anns = pdfRef.current?.flush() ?? (file.pdfAnnotations as unknown[]) ?? [];
      if (saveTimer.current) {
        window.clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
      const notesDraft =
        pending.current?.fileId === file.id && pending.current.notes !== undefined
          ? pending.current.notes
          : notes;
      pending.current = null;

      if (anns.length > 0) {
        setSaveState("saving");
        setMsg("Đang ghi chú thích vào PDF trên bàn học…");
        try {
          const { bakePdfAnnotations } = await import("@/lib/pdf-bake");
          const { dataUrl, baked } = await bakePdfAnnotations(file.dataUrl, anns);
          if (baked > 0) {
            const next = patchFile(deskLive.current, file.id, {
              dataUrl,
              pdfAnnotations: [],
              notes: notesDraft,
              sourceDataUrl: file.sourceDataUrl || file.dataUrl,
              size: sizeFromDataUrl(dataUrl),
            });
            const latest = next.files.find((f) => f.id === file.id)!;
            persist(next);
            await persistFileBlobs(latest);
            setPdfEpoch((n) => n + 1);
            setMsg(
              `Đã cập nhật PDF trên bàn (${baked} chú thích). Mở lại file này vẫn còn — chỉ Tải khi cần bản trên máy.`,
            );
            return latest;
          }
        } catch (err) {
          setMsg(err instanceof Error ? err.message : "Ghi PDF thất bại");
          setSaveState("dirty");
          return null;
        }
      }
      const next = patchFile(deskLive.current, file.id, { notes: notesDraft });
      persist(next);
      return next.files.find((f) => f.id === file.id) || null;
    }

    if (file.kind === "doc") {
      const liveContent = liveEditorContent();
      setContent(liveContent);
      if (saveTimer.current) {
        window.clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
      pending.current = null;
      setSaveState("saving");
      setMsg("Đang ghi lại .docx…");
      try {
        const { ensureDocxName, htmlToDocxDataUrl } = await import("@/lib/html-to-docx");
        const dataUrl = await htmlToDocxDataUrl(liveContent, file.name);
        const name = ensureDocxName(file.name);
        const next = patchFile(deskLive.current, file.id, {
          content: liveContent,
          dataUrl,
          name,
          notes,
          sourceDataUrl: file.sourceDataUrl || file.dataUrl,
          size: sizeFromDataUrl(dataUrl),
        });
        const latest = next.files.find((f) => f.id === file.id)!;
        persist(next);
        await persistFileBlobs(latest);
        setMsg("Đã cập nhật .docx trên bàn học — mở lại vẫn còn.");
        return latest;
      } catch (err) {
        setMsg(err instanceof Error ? err.message : "Ghi .docx thất bại");
        setSaveState("dirty");
        return null;
      }
    }

    if (file.kind === "note") {
      const liveContent = liveEditorContent();
      setContent(liveContent);
      pending.current = {
        fileId: file.id,
        content: liveContent,
        notes:
          pending.current?.fileId === file.id && pending.current.notes !== undefined
            ? pending.current.notes
            : notes,
      };
      flushPending();
      return deskLive.current.files.find((f) => f.id === file.id) || null;
    }

    flushPending();
    return deskLive.current.files.find((f) => f.id === file.id) || file;
  }

  /** Ctrl+S: luôn lưu bàn; chỉ ghi máy nếu đã «Mở từ máy» (không hỏi Save As). */
  async function syncDiskIfLinked(latest: DeskFile) {
    const blob = blobFromEditedDeskFile(latest);
    if (!blob) {
      clearEdited();
      setMsg("Đã lưu trên bàn học.");
      return;
    }
    const result = await writeBlobToDisk(latest.id, latest.name, latest.kind, blob);
    if (result.ok) {
      setLinkedToDisk(true);
      clearEdited();
      setMsg("Đã lưu trên bàn và ghi đè file trên máy.");
    } else if (result.reason === "no-handle") {
      setLinkedToDisk(false);
      clearEdited();
      setMsg("Đã lưu trên bàn học.");
    } else if (result.reason === "denied") {
      setMsg("Đã lưu trên bàn. Trình duyệt từ chối ghi file — thử «Ghi ra máy».");
    } else if (result.reason !== "cancelled") {
      clearEdited();
      setMsg(`Đã lưu trên bàn học. (${result.reason})`);
    } else {
      clearEdited();
      setMsg("Đã lưu trên bàn học.");
    }
  }

  /** Nút riêng: gắn/ghi ra máy (có thể hiện hộp chọn file). */
  async function writeOutToDisk() {
    if (!file) return;
    setSaveState("saving");
    let latest: DeskFile | null = null;
    if (file.kind === "pdf" || file.kind === "doc") {
      latest = await commitBinaryEdits();
    } else {
      const liveContent = liveEditorContent();
      setContent(liveContent);
      const next = patchFile(deskLive.current, file.id, {
        content: liveContent,
        notes,
        size: byteLengthOfText(liveContent),
      });
      latest = next.files.find((f) => f.id === file.id) || null;
      if (latest) {
        persist(next);
        await persistFileBlobs(latest);
      }
    }
    if (!latest) return;
    const blob = blobFromEditedDeskFile(latest);
    if (!blob) {
      setMsg("Không tạo được nội dung để ghi ra máy.");
      return;
    }
    const result = await writeBlobToDisk(latest.id, latest.name, latest.kind, blob, {
      forcePicker: true,
    });
    if (result.ok) {
      setLinkedToDisk(true);
      clearEdited();
      setMsg(
        result.mode === "overwrite"
          ? "Đã ghi đè file trên máy."
          : "Đã gắn và ghi ra máy — lần sau Ctrl+S sẽ ghi đè thẳng.",
      );
    } else if (result.reason === "cancelled") {
      setMsg("Đã hủy ghi ra máy. Bản trên bàn vẫn còn.");
    } else if (result.reason === "unsupported") {
      setMsg("Trình duyệt không hỗ trợ ghi đè — dùng Chrome/Edge hoặc Tải sửa.");
    } else {
      setMsg(`Ghi ra máy lỗi: ${result.reason}`);
    }
  }

  async function saveNow() {
    if (!file) return;
    setSaveState("saving");
    let latest: DeskFile | null = null;

    if (file.kind === "pdf" || file.kind === "doc") {
      latest = await commitBinaryEdits();
    } else {
      const liveContent = liveEditorContent();
      setContent(liveContent);
      if (saveTimer.current) {
        window.clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
      pending.current = null;
      const next = patchFile(deskLive.current, file.id, {
        content: liveContent,
        notes,
        size: byteLengthOfText(liveContent),
      });
      latest = next.files.find((f) => f.id === file.id) || null;
      if (latest) {
        persist(next);
        await persistFileBlobs(latest);
      }
    }

    if (latest) await syncDiskIfLinked(latest);
    else setSaveState("idle");
  }

  async function downloadEdited() {
    if (!file) return;
    if (file.kind === "pdf" || file.kind === "doc" || file.kind === "note") {
      const latest = await commitBinaryEdits();
      if (latest) downloadDeskFile(latest);
      return;
    }
    flushPending();
    const latest = deskLive.current.files.find((f) => f.id === file.id) || file;
    downloadDeskFile(latest);
  }

  function executeLeave(action: { kind: "close" } | { kind: "select"; id: string }) {
    setLeavePrompt(null);
    if (action.kind === "close") onClose();
    else onSelect(action.id);
  }

  function requestLeave(action: { kind: "close" } | { kind: "select"; id: string }) {
    if (!file) {
      executeLeave(action);
      return;
    }

    let liveDirty = false;
    const draft: {
      fileId: string;
      content?: string;
      notes?: string;
      pdfAnnotations?: unknown[];
    } = {
      ...(pending.current?.fileId === file.id ? pending.current : { fileId: file.id }),
      fileId: file.id,
    };

    if (file.kind === "note" || file.kind === "doc") {
      const live = richRef.current?.getContent() ?? content;
      if (live !== (file.content || "")) {
        liveDirty = true;
        setContent(live);
        draft.content = live;
      }
    }

    if (file.kind === "pdf") {
      // Không flush→schedule (tránh luôn dirty); chỉ đọc và so sánh
      const liveAnns = (pdfRef.current?.getAnnotations() ??
        file.pdfAnnotations ??
        []) as unknown[];
      if (!annsEqual(liveAnns, file.pdfAnnotations as unknown[] | undefined)) {
        liveDirty = true;
        draft.pdfAnnotations = liveAnns;
      }
    }

    if (notes !== (file.notes || "")) {
      liveDirty = true;
      draft.notes = notes;
    }

    // Đã sửa trong phiên (autosave bàn có thể xong rồi) → vẫn hỏi, để Lưu ghi máy / xác nhận
    const sessionDirty = editDirtyRef.current;
    const dirty =
      liveDirty ||
      sessionDirty ||
      saveState === "dirty" ||
      Boolean(pending.current);

    if (!dirty) {
      executeLeave(action);
      return;
    }

    if (liveDirty || draft.content !== undefined || draft.pdfAnnotations !== undefined || draft.notes !== undefined) {
      pending.current = draft;
    }
    setLeavePrompt(action);
  }

  function confirmSaveAndLeave() {
    if (!leavePrompt) return;
    const action = leavePrompt;
    void (async () => {
      await saveNow();
      clearEdited();
      executeLeave(action);
    })();
  }

  function confirmDiscardAndLeave() {
    if (!leavePrompt) return;
    pending.current = null;
    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    clearEdited();
    setSaveState("idle");
    executeLeave(leavePrompt);
  }

  useEffect(() => {
    pdfRef.current?.flush();
    flushPending();
    setContent(file?.content || "");
    setNotes(file?.notes || "");
    setMsg(null);
    setSaveState("idle");
    clearEdited();
    setImgZoom(100);
    setImgRotate(0);
    setTrack(loadLearn().preferredTrack);
    setLinkedToDisk(false);
    if (file?.id) {
      void hasFileHandle(file.id).then(setLinkedToDisk);
    }
    if (file?.kind === "audio" && file.dataUrl) {
      play(file.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- activeId drives file switch only
  }, [activeId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        e.stopPropagation();
        void saveNow();
      }
    }
    function onLeave(e: BeforeUnloadEvent) {
      pdfRef.current?.flush();
      flushPending();
      if (saveState === "dirty" || pending.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("beforeunload", onLeave);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("beforeunload", onLeave);
      pdfRef.current?.flush();
      flushPending();
      if (savedFlashTimer.current) window.clearTimeout(savedFlashTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount/unmount
  }, []);

  const visibleSources = useMemo(() => {
    const q = sourceQuery.trim().toLowerCase();
    return desk.files.filter((f) => {
      if (sourceFilter !== "all" && f.kind !== sourceFilter) return false;
      if (q && !f.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [desk.files, sourceFilter, sourceQuery]);

  useEffect(() => {
    if (!filterMenuOpen) return;
    function onDoc(e: MouseEvent) {
      if (!sourceToolbarRef.current?.contains(e.target as Node)) {
        setFilterMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [filterMenuOpen]);

  const sourceFilterLabel =
    (
      {
        all: "All",
        pdf: "PDF",
        doc: "DOC",
        note: "Text",
        audio: "Audio",
        image: "Ảnh",
      } as const
    )[sourceFilter];

  function addStudioTask() {
    const title = window.prompt("Việc cần làm");
    if (!title?.trim()) return;
    const task: DeskTask = {
      id: crypto.randomUUID(),
      title: title.trim(),
      due: "Hôm nay",
      done: false,
    };
    onUpdate({ ...desk, tasks: [task, ...desk.tasks] });
  }

  function removeStudioTask(id: string) {
    onUpdate({ ...desk, tasks: desk.tasks.filter((t) => t.id !== id) });
  }

  function editStudioTask(id: string, current: string) {
    const title = window.prompt("Sửa việc cần làm", current);
    if (!title?.trim()) return;
    onUpdate({
      ...desk,
      tasks: desk.tasks.map((t) => (t.id === id ? { ...t, title: title.trim() } : t)),
    });
  }

  function commitNotesToOutput() {
    const body = notes.trim();
    if (!body || !file) {
      setMsg("Chưa có ghi chú để đẩy.");
      return;
    }
    flushPending();
    const next = patchFile(deskLive.current, file.id, { notes });
    persist(
      pushFileOutput(next, file.id, { kind: "note", title: "Ghi chú học", body }),
    );
    setSideTab("out");
    setMsg("Đã đẩy sang Output.");
  }

  function makeCard() {
    if (!file) return;
    const word = snippet.trim();
    if (!word) {
      setMsg("Nhập cụm từ trước.");
      return;
    }
    const gloss = meaning.trim() || "Từ ghi chú desk";
    const result = addManualCard({ track, word, meanings: [gloss] });
    if (!result.ok) {
      setMsg(result.reason);
      return;
    }
    flushPending();
    persist(
      pushFileOutput(deskLive.current, file.id, {
        kind: "card",
        title: `SRS · ${track.toUpperCase()}`,
        body: `${word} — ${gloss}`,
      }),
    );
    setSnippet("");
    setMeaning("");
    setSideTab("out");
    setMsg("Đã thêm thẻ SRS.");
  }

  async function replaceBinary(list: FileList | null) {
    if (!file || !list?.[0]) return;
    const incoming = list[0];
    const detected = detectDeskKind(incoming);
    if (detected !== file.kind) {
      setMsg(`Chỉ thay bằng cùng loại (${kindLabel(file.kind)}).`);
      return;
    }
    const others = desk.files.filter((f) => f.id !== file.id);
    const check = canUpload(others, incoming.size);
    if (!check.ok) {
      setMsg(check.reason);
      return;
    }
    if (file.kind === "doc") {
      const [dataUrl, text] = await Promise.all([
        readAsDataUrl(incoming),
        extractDocContent(incoming),
      ]);
      applyPatch({
        dataUrl,
        sourceDataUrl: dataUrl,
        content: text,
        size: incoming.size,
        name: incoming.name,
      });
    } else if (file.kind === "pdf") {
      const dataUrl = await readAsDataUrl(incoming);
      applyPatch({
        dataUrl,
        sourceDataUrl: dataUrl,
        size: incoming.size,
        name: incoming.name,
        pdfAnnotations: [],
      });
    } else {
      const dataUrl = await readAsDataUrl(incoming);
      applyPatch({ dataUrl, size: incoming.size, name: incoming.name });
    }
    if (file.kind === "audio") play(file.id);
    setMsg("Đã thay nội dung file.");
  }

  function removeActive() {
    if (!file) return;
    if (!window.confirm(`Xóa “${file.name}”?`)) return;
    if (listeningId === file.id) stop();
    const next = deleteFile(desk, file.id);
    onUpdate(next);
    const fallback = next.files.find((f) => f.kind !== "audio")?.id || next.files[0]?.id;
    if (fallback) onSelect(fallback);
    else onClose();
  }

  const timerLabel = `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
  const outputs = file?.outputs || [];
  const textFormat = file ? textEditFormatOf(file.name, file.kind) : "html";
  return (
    <div className="desk-studio">
      <header className="desk-studio-bar">
        <button type="button" className="text-button" onClick={() => requestLeave({ kind: "close" })}>
          ← Tổng quan
        </button>
        <div className="desk-studio-bar-title">
          <span className="eyebrow">Studio</span>
          <strong>{file?.name || "—"}</strong>
          {saveState === "dirty" ? (
            <span className="save-pill dirty">Chưa lưu</span>
          ) : saveState === "saving" ? (
            <span className="save-pill saving">Đang lưu…</span>
          ) : saveState === "saved" ? (
            <span className="save-pill">Đã lưu</span>
          ) : null}
        </div>
        <div className="desk-studio-bar-utils">
          <DeskMusicDock music={music} variant="chip" onUploadMusic={onUploadMusic} />
          <DeskSchedule
            variant="chip"
            title={desk.scheduleTitle || "Lịch trình môn học"}
            events={desk.schedule || []}
            onChange={({ scheduleTitle, schedule }) =>
              onUpdate({ ...desk, scheduleTitle, schedule })
            }
          />
          <div className="desk-studio-bar-focus">
            <span className={`studio-focus-dot ${running ? "on" : ""}`} />
            <span className="studio-focus-time">{timerLabel}</span>
            <button type="button" className="chip map-chip" onClick={() => onRunning(!running)}>
              {running ? "Pause" : "Start"}
            </button>
          </div>
        </div>
      </header>

      <div className="desk-studio-grid">
        <aside className="studio-pane studio-sources">
          <div className="studio-pane-head">
            <h2>Nguồn</h2>
            <div className="file-toolbar">
              <button type="button" className="icon-ghost" title="Ghi chú mới" onClick={onCreateNote}>
                <Icon name="plus" size={16} />
              </button>
              <button
                type="button"
                className="icon-ghost"
                title="Mở từ máy (Ctrl+S ghi đè)"
                onClick={onOpenFromDisk}
              >
                <Icon name="upload" size={16} />
              </button>
            </div>
          </div>
          <div className="studio-source-toolbar" ref={sourceToolbarRef}>
            <button
              type="button"
              className="studio-search-toggle"
              title="Tìm theo tên"
              aria-expanded={searchOpen}
              onClick={() => {
                setSearchOpen((v) => {
                  if (v) setSourceQuery("");
                  return !v;
                });
              }}
            >
              <Icon name="search" size={14} />
            </button>
            {searchOpen ? (
              <div className="studio-source-search">
                <input
                  autoFocus
                  type="search"
                  placeholder="Tìm file…"
                  value={sourceQuery}
                  onChange={(e) => setSourceQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setSourceQuery("");
                      setSearchOpen(false);
                    }
                  }}
                />
              </div>
            ) : null}
            <button
              type="button"
              className="studio-filter-btn"
              aria-expanded={filterMenuOpen}
              onClick={() => setFilterMenuOpen((v) => !v)}
            >
              {sourceFilterLabel}
              <Icon name="arrow" size={12} />
            </button>
            {filterMenuOpen ? (
              <div className="studio-filter-menu" role="menu">
                {(
                  [
                    ["all", "All"],
                    ["pdf", "PDF"],
                    ["doc", "DOC"],
                    ["note", "Text"],
                    ["audio", "Audio"],
                    ["image", "Ảnh"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    role="menuitem"
                    className={sourceFilter === id ? "active" : ""}
                    onClick={() => {
                      setSourceFilter(id);
                      setFilterMenuOpen(false);
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <div className="studio-source-list">
            {visibleSources.length === 0 ? (
              <p className="empty-hint">Không có file loại này</p>
            ) : (
              visibleSources.map((f) => (
                <div
                  key={f.id}
                  className={`studio-source ${f.id === activeId ? "active" : ""}`}
                >
                  <button
                    type="button"
                    className="studio-source-main"
                    onClick={() => {
                      if (f.id === activeId) return;
                      requestLeave({ kind: "select", id: f.id });
                    }}
                  >
                    <span className={`file-icon ${fileIconClass(f.kind)}`}>
                      <Icon name={kindIconName(f.kind)} size={16} />
                    </span>
                    <span className="studio-source-meta">
                      <strong>{f.name}</strong>
                      <small>
                        {kindLabel(f.kind)} · {formatBytes(f.size)}
                        {listeningId === f.id ? " · ▶ nền" : ""}
                      </small>
                    </span>
                  </button>
                  {f.kind === "audio" && f.dataUrl ? (
                    <button
                      type="button"
                      className={`studio-source-play ${listeningId === f.id ? "on" : ""}`}
                      title="Phát nền (học / làm việc kèm nhạc)"
                      onClick={() => {
                        play(f.id);
                        setMsg("Nhạc nền — đổi tài liệu khác vẫn nghe (engine gắn bàn học).");
                      }}
                    >
                      ▶
                    </button>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </aside>

        <section className="studio-pane studio-work">
          {!file ? (
            <div className="studio-empty">
              <h2>Chọn nguồn bên trái</h2>
              <p>PDF · Word · TXT/MD · ảnh · nhạc (player nghe ở giữa).</p>
            </div>
          ) : (
            <>
              <div className="studio-work-toolbar">
                <div className="file-meta-row">
                  <span className="chip">{file.tag}</span>
                  <span className="chip">{kindLabel(file.kind)}</span>
                  <span className="chip">{formatBytes(file.size)}</span>
                </div>
                <div className="studio-doc-tools">
                  {file.kind === "image" ? (
                    <>
                      <button
                        type="button"
                        className="chip map-chip"
                        onClick={() => setImgZoom((z) => Math.max(40, z - 10))}
                      >
                        −
                      </button>
                      <span className="studio-zoom-label">{imgZoom}%</span>
                      <button
                        type="button"
                        className="chip map-chip"
                        onClick={() => setImgZoom((z) => Math.min(300, z + 10))}
                      >
                        +
                      </button>
                      <button
                        type="button"
                        className="chip map-chip"
                        onClick={() => setImgRotate((r) => (r + 90) % 360)}
                      >
                        Xoay
                      </button>
                      <button
                        type="button"
                        className="chip map-chip"
                        onClick={() => file.dataUrl && window.open(file.dataUrl, "_blank")}
                      >
                        Tab mới
                      </button>
                    </>
                  ) : null}
                  {file.kind === "audio" && file.dataUrl ? (
                    <button
                      type="button"
                      className="chip map-chip active"
                      onClick={() => play(file.id)}
                    >
                      ▶ Nghe
                    </button>
                  ) : null}
                  <Button
                    variant={saveState === "dirty" ? "primary" : "secondary"}
                    onClick={() => void saveNow()}
                    disabled={saveState === "saving"}
                  >
                    {saveState === "saving"
                      ? "Đang lưu…"
                      : saveState === "dirty"
                        ? "Lưu"
                        : linkedToDisk
                          ? "Đã lưu · máy"
                          : "Đã lưu"}
                  </Button>
                  {!linkedToDisk &&
                  (file.kind === "pdf" ||
                    file.kind === "doc" ||
                    file.kind === "note") ? (
                    <Button
                      variant="ghost"
                      onClick={() => void writeOutToDisk()}
                      disabled={saveState === "saving"}
                    >
                      Ghi ra máy
                    </Button>
                  ) : null}
                  <Button
                    variant="secondary"
                    icon="edit"
                    onClick={() => {
                      const next = window.prompt("Đổi tên", file.name);
                      if (!next?.trim()) return;
                      applyPatch({ name: next.trim() });
                    }}
                  >
                    Đổi tên
                  </Button>
                  <Button
                    variant="secondary"
                    icon="download"
                    onClick={() => void downloadEdited()}
                  >
                    {file.kind === "pdf" || file.kind === "doc" || file.kind === "note"
                      ? "Tải sửa"
                      : "Tải"}
                  </Button>
                  {(file.sourceDataUrl || file.dataUrl) &&
                  (file.kind === "doc" || file.kind === "pdf") ? (
                    <Button
                      variant="ghost"
                      onClick={() => {
                        downloadDeskFile(file, { original: true });
                      }}
                    >
                      Gốc
                    </Button>
                  ) : null}
                  {file.kind !== "note" ? (
                    <Button variant="secondary" icon="upload" onClick={() => replaceRef.current?.click()}>
                      Thay
                    </Button>
                  ) : null}
                  <Button variant="danger" icon="trash" onClick={removeActive}>
                    Xóa
                  </Button>
                  <input
                    ref={replaceRef}
                    type="file"
                    hidden
                    accept={replaceAcceptFor(file.kind)}
                    onChange={(e) => replaceBinary(e.target.files)}
                  />
                </div>
              </div>

              <div className="studio-work-body">
                {file.kind === "note" || file.kind === "doc" ? (
                  <StudioRichEditor
                    key={`${file.id}-${textFormat}`}
                    ref={richRef}
                    value={content}
                    format={textFormat}
                    onChange={(next) => schedule("content", next)}
                    onSave={() => void saveNow()}
                    placeholder={
                      file.kind === "doc"
                        ? "Chỉnh sửa nội dung Word (đã import) — Ctrl+S hoặc tự lưu…"
                        : textFormat === "markdown"
                          ? "Soạn Markdown — Ctrl+S / tự lưu…"
                          : textFormat === "plain"
                            ? "Văn bản thuần — Ctrl+S / tự lưu…"
                            : "Soạn thảo rich text — Ctrl+S / tự lưu…"
                    }
                    hint={formatToolkitHint(textFormat, file.kind)}
                  />
                ) : file.kind === "pdf" ? (
                  file.dataUrl ? (
                    <StudioPdfViewer
                      key={`${file.id}-e${pdfEpoch}`}
                      ref={pdfRef}
                      fileId={file.id}
                      dataUrl={file.dataUrl}
                      title={file.name}
                      annotations={(file.pdfAnnotations as import("@inkbar/core").Annotation[]) || []}
                      onAnnotationsChange={(next) => scheduleAnnotations(next)}
                      pageNotes={notes}
                      onPageNotes={(text) => schedule("notes", text)}
                    />
                  ) : (
                    <div className="studio-empty">
                      <h2>PDF chưa có dữ liệu</h2>
                      <Button variant="secondary" onClick={() => replaceRef.current?.click()}>
                        Tải PDF
                      </Button>
                    </div>
                  )
                ) : file.kind === "image" ? (
                  file.dataUrl ? (
                    <div className="studio-image-work">
                      <div className="studio-image-tools">
                        <button
                          type="button"
                          className="chip map-chip"
                          onClick={() => setImgZoom((z) => Math.max(25, z - 10))}
                        >
                          Zoom −
                        </button>
                        <span className="studio-zoom-label">{imgZoom}%</span>
                        <button
                          type="button"
                          className="chip map-chip"
                          onClick={() => setImgZoom((z) => Math.min(400, z + 10))}
                        >
                          Zoom +
                        </button>
                        <button
                          type="button"
                          className="chip map-chip"
                          onClick={() => setImgZoom(100)}
                        >
                          100%
                        </button>
                        <button
                          type="button"
                          className="chip map-chip"
                          onClick={() => setImgZoom(Math.round((280 / 600) * 100))}
                        >
                          Vừa khung
                        </button>
                        <button
                          type="button"
                          className="chip map-chip"
                          onClick={() => setImgRotate((r) => (r + 90) % 360)}
                        >
                          Xoay 90°
                        </button>
                        <button
                          type="button"
                          className="chip map-chip"
                          onClick={() => {
                            setImgZoom(100);
                            setImgRotate(0);
                          }}
                        >
                          Reset
                        </button>
                        <button
                          type="button"
                          className="chip map-chip"
                          onClick={() => window.open(file.dataUrl, "_blank")}
                        >
                          Tab mới
                        </button>
                        <button
                          type="button"
                          className="chip map-chip"
                          onClick={() => downloadDeskFile(file)}
                        >
                          Tải ảnh
                        </button>
                      </div>
                      <div className="studio-image-frame">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={file.dataUrl}
                          alt={file.name}
                          className="studio-image"
                          style={{
                            transform: `scale(${imgZoom / 100}) rotate(${imgRotate}deg)`,
                          }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="studio-empty">
                      <h2>Ảnh chưa có dữ liệu</h2>
                      <Button variant="secondary" onClick={() => replaceRef.current?.click()}>
                        Tải ảnh
                      </Button>
                    </div>
                  )
                ) : file.kind === "audio" ? (
                  file.dataUrl ? (
                    <div className="studio-audio-focus">
                      <div className="studio-audio-focus-row">
                        <span className="file-icon audio" aria-hidden>
                          <Icon name="audio" size={18} />
                        </span>
                        <div className="studio-audio-focus-meta">
                          <strong title={file.name}>{file.name}</strong>
                          <small>
                            {listeningId === file.id
                              ? "Đang phát ở thanh dưới · mở file khác vẫn nghe"
                              : "Bấm phát nền rồi làm việc kèm nhạc"}
                          </small>
                        </div>
                        <Button icon="play" onClick={() => play(file.id)}>
                          {listeningId === file.id ? "Đang phát nền" : "Phát nền"}
                        </Button>
                        {listeningId === file.id ? (
                          <Button variant="ghost" onClick={() => stop()}>
                            Dừng
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <div className="studio-empty">
                      <h2>Audio chưa có dữ liệu</h2>
                      <p>
                        {userName} — file có thể đã mất vì bộ nhớ trình duyệt cũ. Tải lại
                        MP3/WAV/M4A…
                      </p>
                      <Button variant="secondary" onClick={() => replaceRef.current?.click()}>
                        Thay audio
                      </Button>
                    </div>
                  )
                ) : (
                  <div className="studio-empty">
                    <h2>Không mở được file</h2>
                  </div>
                )}
              </div>
            </>
          )}
        </section>

        <aside className="studio-pane studio-out">
          <div className="studio-side-tabs" role="tablist">
            {(
              [
                ["learn", "Học"],
                ["out", `Out (${outputs.length})`],
                ["focus", "Focus"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={sideTab === id}
                className={sideTab === id ? "active" : ""}
                onClick={() => setSideTab(id)}
              >
                {label}
              </button>
            ))}
          </div>

          {sideTab === "learn" ? (
            <div className="studio-side-tools">
              <div className="studio-tool-block">
                <div className="section-head">
                  <h3>Ghi chú</h3>
                  <span>Tự lưu</span>
                </div>
                <textarea
                  className="note-textarea short"
                  value={notes}
                  onChange={(e) => schedule("notes", e.target.value)}
                  rows={5}
                  placeholder="Tóm tắt, từ khó…"
                />
                <div className="studio-tool-actions">
                  <Button variant="secondary" onClick={commitNotesToOutput}>
                    Đẩy Out →
                  </Button>
                  {canListen() ? (
                    <Button
                      variant="ghost"
                      onClick={() =>
                        listenOnce(
                          track === "jp" ? "ja-JP" : "en-US",
                          (text) => schedule("notes", `${notes}${notes ? "\n" : ""}${text}`),
                          (err) => setMsg(err),
                        )
                      }
                    >
                      Dictate
                    </Button>
                  ) : null}
                </div>
              </div>
              <div className="studio-tool-block">
                <div className="section-head">
                  <h3>→ SRS</h3>
                </div>
                <div className="segmented" style={{ marginBottom: 8 }}>
                  <button
                    type="button"
                    className={track === "jp" ? "active" : ""}
                    onClick={() => setTrack("jp")}
                  >
                    JP
                  </button>
                  <button
                    type="button"
                    className={track === "en" ? "active" : ""}
                    onClick={() => setTrack("en")}
                  >
                    EN
                  </button>
                </div>
                <label>
                  Cụm từ
                  <input value={snippet} onChange={(e) => setSnippet(e.target.value)} placeholder="Dán…" />
                </label>
                <label>
                  Nghĩa
                  <input value={meaning} onChange={(e) => setMeaning(e.target.value)} placeholder="Tùy chọn" />
                </label>
                <Button onClick={makeCard}>Thêm thẻ</Button>
              </div>
              {file?.kind === "audio" ? (
                <div className="studio-tool-block">
                  <div className="section-head">
                    <h3>Listening</h3>
                  </div>
                  <p className="empty-hint" style={{ margin: 0 }}>
                    Player ở giữa · tốc độ 0.75×–1.5× · dock giữ nhạc khi đổi file khác.
                  </p>
                  {file.dataUrl ? (
                    <Button variant="secondary" onClick={() => play(file.id)}>
                      ▶ Phát nền
                    </Button>
                  ) : null}
                </div>
              ) : null}
              {msg ? <p className="studio-msg">{msg}</p> : null}
            </div>
          ) : null}

          {sideTab === "out" ? (
            <div className="studio-out-scroll grow">
              {outputs.length === 0 ? (
                <p className="empty-hint">Chưa có output — đẩy ghi chú / thẻ từ tab Học.</p>
              ) : (
                outputs.map((o) => (
                  <article key={o.id} className={`studio-out-card kind-${o.kind}`}>
                    <div className="studio-out-card-head">
                      <span className="chip">{o.kind === "card" ? "SRS" : "Note"}</span>
                      <button
                        type="button"
                        className="icon-ghost"
                        onClick={() => file && persist(removeFileOutput(desk, file.id, o.id))}
                      >
                        <Icon name="trash" size={14} />
                      </button>
                    </div>
                    <strong>{o.title}</strong>
                    <p>{o.body}</p>
                    <small>{new Date(o.createdAt).toLocaleString("vi-VN")}</small>
                  </article>
                ))
              )}
            </div>
          ) : null}

          {sideTab === "focus" ? (
            <div className="studio-util grow-pad">
              <div className="section-head">
                <h3>Focus</h3>
                <span>{timerLabel}</span>
              </div>
              <div className="focus-presets">
                {FOCUS_PRESETS_MIN.map((m) => (
                  <button
                    key={m}
                    type="button"
                    className={
                      !running && Math.floor(seconds / 60) === m && seconds % 60 === 0
                        ? "chip map-chip active"
                        : "chip map-chip"
                    }
                    disabled={running}
                    onClick={() => onSeconds(m * 60)}
                  >
                    {m}p
                  </button>
                ))}
              </div>
              <DigitalFocusClock totalSeconds={seconds} running={running} onChange={onSeconds} />
              <div className="timer-actions">
                <Button icon="play" onClick={() => onRunning(!running)}>
                  {running ? "Pause" : "Start"}
                </Button>
                <Button
                  variant="ghost"
                  icon="reset"
                  onClick={() => {
                    onRunning(false);
                    onSeconds(desk.focusSeconds);
                  }}
                >
                  Reset
                </Button>
              </div>
              <div className="tasks-mini" style={{ marginTop: 14 }}>
                <div className="section-head">
                  <h3>Tasks</h3>
                  <button type="button" className="text-button" onClick={addStudioTask}>
                    + Thêm
                  </button>
                </div>
                {desk.tasks.length === 0 ? (
                  <p className="empty-hint">Chưa có việc · bấm + Thêm</p>
                ) : (
                  desk.tasks.map((t: DeskTask) => (
                    <div className="task-row-wrap" key={t.id}>
                      <label className="task-row">
                        <input
                          type="checkbox"
                          checked={t.done}
                          onChange={() =>
                            onUpdate({
                              ...desk,
                              tasks: desk.tasks.map((x) =>
                                x.id === t.id ? { ...x, done: !x.done } : x,
                              ),
                            })
                          }
                        />
                        <span>
                          <strong
                            style={{ textDecoration: t.done ? "line-through" : "none" }}
                            onDoubleClick={() => editStudioTask(t.id, t.title)}
                            title="Double-click để sửa"
                          >
                            {t.title}
                          </strong>
                          <small>{t.due}</small>
                        </span>
                      </label>
                      <button
                        type="button"
                        className="icon-ghost"
                        title="Xóa task"
                        onClick={() => removeStudioTask(t.id)}
                      >
                        <Icon name="trash" size={14} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : null}
        </aside>
      </div>

      <SaveLeaveDialog
        open={Boolean(leavePrompt)}
        fileName={file?.name}
        onSave={confirmSaveAndLeave}
        onDiscard={confirmDiscardAndLeave}
        onCancel={() => setLeavePrompt(null)}
      />
    </div>
  );
}
