"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { DeskMusicDock } from "@/components/DeskMusicDock";
import { DeskSchedule } from "@/components/DeskSchedule";
import { Icon } from "@/components/Icon";
import { RequireAuth } from "@/components/RequireAuth";
import { DigitalFocusClock } from "@/components/DigitalFocusClock";
import { useDeskMusic } from "@/hooks/useDeskMusic";

const DeskStudio = dynamic(
  () => import("@/components/DeskStudio").then((m) => m.DeskStudio),
  {
    ssr: false,
    loading: () => (
      <div className="page desk-page desk-studio-page">
        <p className="empty-hint">Đang mở Studio…</p>
      </div>
    ),
  },
);
import { BgColorPicker } from "@/components/BgColorPicker";
import { WallpaperPicker } from "@/components/WallpaperPicker";
import {
  FOCUS_PRESETS_MIN,
  applyBgAppearance,
  canAddFolder,
  canUpload,
  createNoteFile,
  defaultTagForKind,
  deleteFile,
  deleteFolder,
  formatBytes,
  hydrateBgAppearance,
  hydrateDeskBlobs,
  loadDesk,
  patchFile,
  saveCustomWallpaper,
  saveDesk,
  saveDeskAsync,
  usedStorageBytes,
  type DeskFile,
  type DeskState,
  type DeskTask,
  type SaveDeskResult,
} from "@/lib/desk-store";
import {
  DESK_ACCEPT_HINT,
  MUSIC_ACCEPT,
  MUSIC_ACCEPT_HINT,
  detectDeskKind,
  extractDocContent,
  kindIconName,
  kindLabel as formatKindLabel,
  readAsDataUrl,
} from "@/lib/desk-formats";
import { FREE_LIMITS } from "@/lib/freemium";
import { useI18n, type Lang } from "@/lib/i18n";
import type { WallpaperId } from "@/lib/storage-keys";
import { THEME_SOLID } from "@/lib/storage-keys";

function greeting(lang: Lang) {
  const h = new Date().getHours();
  if (lang === "en") {
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  }
  if (h < 12) return "Chào buổi sáng";
  if (h < 18) return "Chào buổi chiều";
  return "Chào buổi tối";
}

function dateLabel(lang: Lang) {
  return new Date().toLocaleDateString(lang === "en" ? "en-US" : "vi-VN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function kindLabel(kind: DeskFile["kind"]) {
  return formatKindLabel(kind);
}

function fileIconClass(kind: DeskFile["kind"]) {
  if (kind === "audio") return "audio";
  if (kind === "note") return "note";
  if (kind === "image") return "image";
  if (kind === "doc") return "doc";
  return "file";
}

function DeskContent({ userName }: { userName: string }) {
  const { t, lang } = useI18n();
  const router = useRouter();
  const search = useSearchParams();
  const [desk, setDesk] = useState<DeskState | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [folderFilter, setFolderFilter] = useState<string | "all">("all");
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const musicInputRef = useRef<HTMLInputElement>(null);
  const deskRef = useRef<DeskState | null>(null);
  const music = useDeskMusic(desk);

  // Load desk once — KHÔNG phụ thuộc ?open= (đổi file trong Studio từng reload LS không có dataUrl → cắt nhạc).
  useEffect(() => {
    let cancelled = false;
    const state = loadDesk();
    setDesk(state);
    deskRef.current = state;
    setSeconds(state.focusSeconds);
    void hydrateBgAppearance(state);
    const openId = search.get("open") || search.get("file");
    if (openId && state.files.some((f) => f.id === openId)) {
      setActiveFileId(openId);
    }
    void hydrateDeskBlobs(state).then((hydrated) => {
      if (cancelled) return;
      // Hydrate chỉ bổ sung blob. Giữ content/notes đã sửa trên RAM — không ghi đè bằng snapshot cũ.
      const live = deskRef.current;
      const merged: DeskState = {
        ...(live || hydrated),
        files: hydrated.files.map((f) => {
          const prev = live?.files.find((x) => x.id === f.id);
          if (!prev) return f;
          const prevNewer =
            Boolean(prev.updatedAt) &&
            Boolean(f.updatedAt) &&
            String(prev.updatedAt) >= String(f.updatedAt);
          return {
            ...f,
            // Bản RAM mới hơn (vừa bake) thắng blob hydrate cũ
            dataUrl: prevNewer ? prev.dataUrl || f.dataUrl : f.dataUrl || prev.dataUrl,
            sourceDataUrl: prev.sourceDataUrl || f.sourceDataUrl,
            content: prev.content ?? f.content,
            notes: prev.notes ?? f.notes,
            pdfAnnotations: prevNewer
              ? prev.pdfAnnotations ?? f.pdfAnnotations
              : prev.pdfAnnotations && prev.pdfAnnotations.length
                ? prev.pdfAnnotations
                : f.pdfAnnotations,
            outputs: prev.outputs ?? f.outputs,
            name: prev.name || f.name,
            tag: prev.tag || f.tag,
            folderId: prev.folderId,
            updatedAt: prevNewer ? prev.updatedAt : f.updatedAt || prev.updatedAt,
          };
        }),
      };
      deskRef.current = merged;
      setDesk(merged);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount only
  }, []);

  // Chỉ đồng bộ file đang mở từ URL — không loadDesk lại.
  useEffect(() => {
    const openId = search.get("open") || search.get("file");
    if (!openId) return;
    const d = deskRef.current;
    if (d?.files.some((f) => f.id === openId)) {
      setActiveFileId(openId);
    }
  }, [search]);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          setRunning(false);
          const d = deskRef.current;
          if (d) {
            const next = { ...d, focusSeconds: d.focusSeconds };
            deskRef.current = next;
            setDesk(next);
            saveDesk(next);
          }
          return 0;
        }
        const nextSec = s - 1;
        // Persist ticker so leaving overview↔studio never “resets” focus length wrongly
        const d = deskRef.current;
        if (d && nextSec % 5 === 0) {
          const next = { ...d, focusSeconds: Math.max(d.focusSeconds, nextSec) };
          // keep configured length; only store remaining in memory via seconds state
          void next;
        }
        return nextSec;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [running]);

  const timerLabel = useMemo(() => {
    const m = Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }, [seconds]);

  function update(next: DeskState): Promise<SaveDeskResult> {
    deskRef.current = next;
    setDesk(next);
    return saveDeskAsync(next).then((result) => {
      if (!result.ok) {
        setUploadError(result.reason || "Không lưu được desk.");
      }
      return result;
    });
  }

  function openStudio(id: string) {
    setActiveFileId(id);
    router.replace(`/desk?open=${id}`, { scroll: false });
  }

  function closeStudio() {
    setActiveFileId(null);
    router.replace("/desk", { scroll: false });
  }

  function setFocusSeconds(next: number) {
    setSeconds(next);
    if (!desk) return;
    update({ ...desk, focusSeconds: next });
  }

  async function ingestFiles(
    files: File[],
    mode: "study" | "music",
    handleByIndex?: Map<number, import("@/lib/file-handles").DeskFileHandle>,
  ): Promise<{ firstStudyId: string | null; firstMusicId: string | null }> {
    if (!desk || !files.length) return { firstStudyId: null, firstMusicId: null };
    setUploadError(null);
    const nextFiles = [...desk.files];
    let firstStudyId: string | null = null;
    let firstMusicId: string | null = null;
    const { setFileHandle } = await import("@/lib/file-handles");
    for (let i = 0; i < files.length; i++) {
      const file = files[i]!;
      const kind = detectDeskKind(file);
      if (!kind) {
        setUploadError(
          mode === "music"
            ? `Không hỗ trợ “${file.name}”. ${MUSIC_ACCEPT_HINT}`
            : `Không hỗ trợ “${file.name}”. ${DESK_ACCEPT_HINT}`,
        );
        continue;
      }
      if (mode === "music" && kind !== "audio") {
        setUploadError(`“${file.name}” không phải audio. ${MUSIC_ACCEPT_HINT}`);
        continue;
      }
      if (mode === "study" && kind === "audio") {
        // Route audio into playlist without opening Studio
      }
      const check = canUpload(nextFiles, file.size);
      if (!check.ok) {
        setUploadError(check.reason);
        break;
      }
      const folderId = folderFilter === "all" ? null : folderFilter;
      let id = crypto.randomUUID();
      if (kind === "note") {
        const text = await file.text();
        const note = createNoteFile({
          name: file.name,
          folderId,
          content: text,
        });
        id = note.id;
        nextFiles.unshift(note);
      } else if (kind === "doc") {
        const [dataUrl, content] = await Promise.all([
          readAsDataUrl(file),
          extractDocContent(file),
        ]);
        nextFiles.unshift({
          id,
          name: file.name,
          kind,
          size: file.size,
          tag: defaultTagForKind(kind),
          folderId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          dataUrl,
          sourceDataUrl: dataUrl,
          content,
          notes: "",
        });
      } else {
        const dataUrl = await readAsDataUrl(file);
        nextFiles.unshift({
          id,
          name: file.name,
          kind,
          size: file.size,
          tag: defaultTagForKind(kind),
          folderId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          dataUrl,
          sourceDataUrl: kind === "pdf" ? dataUrl : undefined,
          notes: "",
        });
      }
      const handle = handleByIndex?.get(i);
      if (handle) {
        await setFileHandle(id, handle).catch(() => {});
      }
      if (kind === "audio") {
        if (!firstMusicId) firstMusicId = id;
      } else if (!firstStudyId) {
        firstStudyId = id;
      }
    }
    await update({ ...desk, files: nextFiles });
    return { firstStudyId, firstMusicId };
  }

  async function onMusicFiles(fileList: FileList | null) {
    const files = fileList ? Array.from(fileList) : [];
    const { firstMusicId } = await ingestFiles(files, "music");
    if (firstMusicId) music.play(firstMusicId);
  }

  /** Mở từ máy + quyền ghi (Chrome/Edge) hoặc file input (Safari/Firefox). */
  async function onOpenFromDisk() {
    const { pickDeskFilesFromDisk } = await import("@/lib/file-handles");
    const picked = await pickDeskFilesFromDisk();
    if (picked === null) {
      setUploadError("Không mở được bộ chọn tệp trong môi trường này.");
      return;
    }
    if (!picked.length) return; // cancelled — not an error
    const handleByIndex = new Map<number, import("@/lib/file-handles").DeskFileHandle>();
    let usedFallback = false;
    picked.forEach((p, i) => {
      if (p.handle) handleByIndex.set(i, p.handle);
      if (p.viaInputFallback) usedFallback = true;
    });
    const files = picked.map((p) => p.file);
    const { firstStudyId, firstMusicId } = await ingestFiles(
      files,
      "study",
      handleByIndex.size ? handleByIndex : undefined,
    );
    if (firstMusicId) music.play(firstMusicId);
    if (firstStudyId) openStudio(firstStudyId);
    if (usedFallback) {
      setUploadError(
        "Đã thêm lên bàn học (chế độ chọn tệp tiêu chuẩn). Ctrl+S ghi đè thẳng ra máy cần Chrome/Edge «Mở từ máy»; trên Safari/Firefox dùng Tải xuống.",
      );
    }
  }

  /** Kéo thả: ưu tiên File System handle (Chrome) để vẫn Ctrl+S ghi đè được. */
  async function onDropFromDisk(dt: DataTransfer) {
    type HandleLike = import("@/lib/file-handles").DeskFileHandle;
    const withHandles: Array<{ file: File; handle?: HandleLike }> = [];
    const items = [...dt.items];
    if (items.length) {
      for (const item of items) {
        if (item.kind !== "file") continue;
        const anyItem = item as DataTransferItem & {
          getAsFileSystemHandle?: () => Promise<{ kind: string } & HandleLike>;
        };
        try {
          if (typeof anyItem.getAsFileSystemHandle === "function") {
            const h = await anyItem.getAsFileSystemHandle();
            if (h && h.kind === "file") {
              try {
                await h.requestPermission({ mode: "readwrite" });
              } catch {
                /* ignore */
              }
              const file = await h.getFile();
              withHandles.push({ file, handle: h });
              continue;
            }
          }
        } catch {
          /* fall through */
        }
        const file = item.getAsFile();
        if (file) withHandles.push({ file });
      }
    } else {
      for (const file of Array.from(dt.files)) withHandles.push({ file });
    }
    if (!withHandles.length) return;
    const handleByIndex = new Map<number, HandleLike>();
    withHandles.forEach((row, i) => {
      if (row.handle) handleByIndex.set(i, row.handle);
    });
    const files = withHandles.map((r) => r.file);
    const { firstStudyId, firstMusicId } = await ingestFiles(
      files,
      "study",
      handleByIndex.size ? handleByIndex : undefined,
    );
    if (firstMusicId) music.play(firstMusicId);
    if (firstStudyId) openStudio(firstStudyId);
    if (!handleByIndex.size) {
      setUploadError(
        "Đã thêm file lên bàn học. Ghi đè thẳng ra máy (Ctrl+S) cần Chrome/Edge «Mở từ máy»; Safari/Firefox: dùng Tải xuống.",
      );
    }
  }

  function createNote() {
    if (!desk) return;
    const check = canUpload(desk.files, 0);
    if (!check.ok) {
      setUploadError(check.reason);
      return;
    }
    const name = window.prompt("Tên ghi chú", "Ghi chú mới");
    if (name === null) return;
    const note = createNoteFile({
      name: name.trim() || "Ghi chú mới",
      folderId: folderFilter === "all" ? null : folderFilter,
      content: `<h1>${name.trim() || "Ghi chú mới"}</h1><p>Viết nội dung học tại đây…</p>`,
    });
    update({ ...desk, files: [note, ...desk.files] });
    openStudio(note.id);
  }

  function renameFile(f: DeskFile) {
    if (!desk) return;
    const next = window.prompt("Đổi tên file", f.name);
    if (!next?.trim() || next.trim() === f.name) return;
    update(patchFile(desk, f.id, { name: next.trim() }));
  }

  function removeFile(f: DeskFile) {
    if (!desk) return;
    if (!window.confirm(`Xóa “${f.name}”? Không hoàn tác được.`)) return;
    update(deleteFile(desk, f.id));
    if (activeFileId === f.id) closeStudio();
  }

  function moveFile(f: DeskFile) {
    if (!desk) return;
    const options = ["(Không thư mục)", ...desk.folders.map((x) => x.name)].join("\n");
    const pick = window.prompt(`Chuyển vào thư mục:\n${options}\n\nGõ tên thư mục hoặc để trống:`, "");
    if (pick === null) return;
    const trimmed = pick.trim();
    const folder =
      !trimmed || trimmed === "(Không thư mục)"
        ? null
        : desk.folders.find((x) => x.name.toLowerCase() === trimmed.toLowerCase()) || null;
    if (trimmed && !folder) {
      setUploadError("Không tìm thấy thư mục đó.");
      return;
    }
    update(patchFile(desk, f.id, { folderId: folder?.id ?? null }));
  }

  function toggleTask(id: string) {
    if (!desk) return;
    update({
      ...desk,
      tasks: desk.tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
    });
  }

  function addTask() {
    if (!desk) return;
    const title = window.prompt("Việc cần làm");
    if (!title?.trim()) return;
    const task: DeskTask = {
      id: crypto.randomUUID(),
      title: title.trim(),
      due: "Hôm nay",
      done: false,
    };
    update({ ...desk, tasks: [task, ...desk.tasks] });
  }

  function removeTask(id: string) {
    if (!desk) return;
    update({ ...desk, tasks: desk.tasks.filter((t) => t.id !== id) });
  }

  function addFolder() {
    if (!desk) return;
    const check = canAddFolder(desk.folders);
    if (!check.ok) {
      setUploadError(check.reason);
      return;
    }
    const name = window.prompt("Tên thư mục");
    if (!name?.trim()) return;
    update({
      ...desk,
      folders: [...desk.folders, { id: crypto.randomUUID(), name: name.trim() }],
    });
  }

  function removeFolder(id: string) {
    if (!desk) return;
    const folder = desk.folders.find((f) => f.id === id);
    if (!folder) return;
    if (!window.confirm(`Xóa thư mục “${folder.name}”? File bên trong sẽ về mục All.`)) return;
    update(deleteFolder(desk, id));
    if (folderFilter === id) setFolderFilter("all");
  }

  function setBgAppearance(
    patch: Partial<Pick<DeskState, "bgMode" | "bgSolid" | "bgGradient" | "wallpaper" | "theme">>,
  ) {
    if (!desk) return;
    const next: DeskState = { ...desk, ...patch };
    if (patch.bgSolid && !patch.theme) {
      const h = patch.bgSolid.toLowerCase();
      next.theme =
        h === THEME_SOLID.moss ? "moss" : h === THEME_SOLID.night ? "night" : "paper";
    }
    applyBgAppearance(next);
    update(next);
  }

  async function setWallpaper(id: WallpaperId) {
    if (!desk) return;
    const next = { ...desk, wallpaper: id };
    // Apply immediately so UI updates even before IDB hydrate finishes
    applyBgAppearance(next);
    await hydrateBgAppearance(next);
    update(next);
  }

  if (!desk) {
    return (
      <div className="page">
        <h1>Đang tải bàn học…</h1>
      </div>
    );
  }

  const visibleFiles =
    folderFilter === "all"
      ? desk.files
      : desk.files.filter((f) => f.folderId === folderFilter);

  if (activeFileId) {
    return (
      <div className="page desk-page desk-studio-page">
        <input
          ref={musicInputRef}
          type="file"
          accept={MUSIC_ACCEPT}
          multiple
          hidden
          onChange={(e) => {
            void onMusicFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <DeskStudio
          desk={desk}
          activeId={activeFileId}
          userName={userName}
          seconds={seconds}
          running={running}
          onSeconds={setFocusSeconds}
          onRunning={setRunning}
          onUpdate={update}
          onSelect={openStudio}
          onClose={closeStudio}
          onOpenFromDisk={() => void onOpenFromDisk()}
          onUploadMusic={() => musicInputRef.current?.click()}
          onCreateNote={createNote}
          music={music}
          highlightQuote={search.get("highlight") || undefined}
        />
        {uploadError ? (
          <p style={{ color: "var(--danger)", fontSize: 12, marginTop: 8 }}>{uploadError}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">{dateLabel(lang)}</p>
          <h1>
            {greeting(lang)}, {userName.split(" ")[0]}.
          </h1>
          <p>{t("deskIntro")}</p>
        </div>
        <div className="quota">
          {t("freePlan")}
          <br />
          <strong>
            {desk.files.length}/{FREE_LIMITS.maxFiles} {lang === "en" ? "files" : "file"}
          </strong>
          <br />
          <span style={{ fontSize: 12, opacity: 0.85 }}>
            {formatBytes(usedStorageBytes(desk.files))} /{" "}
            {formatBytes(FREE_LIMITS.maxStorageBytes)}
          </span>
        </div>
      </div>
      <div className="desk-grid">
        <section className="files-section panel">
          <div className="section-head">
            <div>
              <h2>{t("files")}</h2>
              <span>
                {desk.files.length}/{FREE_LIMITS.maxFiles} ·{" "}
                {formatBytes(usedStorageBytes(desk.files))}
              </span>
            </div>
            <div className="file-toolbar">
              <Button variant="secondary" icon="plus" onClick={createNote}>
                {t("newNote")}
              </Button>
              <Button variant="primary" icon="upload" onClick={() => void onOpenFromDisk()}>
                Mở từ máy
              </Button>
              <Button
                variant="ghost"
                icon="audio"
                onClick={() => musicInputRef.current?.click()}
              >
                Tải nhạc
              </Button>
            </div>
            <input
              ref={musicInputRef}
              type="file"
              accept={MUSIC_ACCEPT}
              multiple
              hidden
              onChange={(e) => {
                void onMusicFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>

          <div className="folder-row">
            <button
              type="button"
              className={folderFilter === "all" ? "chip map-chip active" : "chip map-chip"}
              onClick={() => setFolderFilter("all")}
            >
              All
            </button>
            {desk.folders.map((f) => (
              <span key={f.id} className="folder-chip-wrap">
                <button
                  type="button"
                  className={folderFilter === f.id ? "chip map-chip active" : "chip map-chip"}
                  onClick={() => setFolderFilter(f.id)}
                >
                  {f.name}
                </button>
                <button
                  type="button"
                  className="icon-ghost"
                  title="Xóa thư mục"
                  onClick={() => removeFolder(f.id)}
                >
                  <Icon name="trash" size={14} />
                </button>
              </span>
            ))}
            <button type="button" className="text-button" onClick={addFolder}>
              + Folder
            </button>
          </div>

          <div
            className="drop-zone"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void onDropFromDisk(e.dataTransfer);
            }}
            onClick={() => void onOpenFromDisk()}
          >
            <Icon name="upload" />
            <span>Mở từ máy hoặc thả file vào đây</span>
            <small>{DESK_ACCEPT_HINT}</small>
          </div>
          {uploadError ? (
            <p style={{ color: "var(--danger)", fontSize: 12, marginBottom: 12 }}>{uploadError}</p>
          ) : null}

          <div className="file-list">
            {visibleFiles.length === 0 ? (
              <p className="empty-hint">{t("noFiles")}</p>
            ) : (
              visibleFiles.map((f) => (
                <div key={f.id} className="file-row-wrap">
                  <button type="button" className="file-row" onClick={() => openStudio(f.id)}>
                    <span className={`file-icon ${fileIconClass(f.kind)}`}>
                      <Icon name={kindIconName(f.kind)} />
                    </span>
                    <span className="file-info">
                      <strong>{f.name}</strong>
                      <small>
                        {kindLabel(f.kind)} · {formatBytes(f.size)} ·{" "}
                        {new Date(f.updatedAt || f.createdAt).toLocaleDateString("vi-VN")}
                      </small>
                    </span>
                    <span className="chip">{f.tag}</span>
                  </button>
                  <div className="file-actions" role="group" aria-label={`Công cụ ${f.name}`}>
                    <button type="button" title="Đổi tên" onClick={() => renameFile(f)}>
                      <Icon name="edit" size={15} />
                    </button>
                    <button type="button" title="Chuyển thư mục" onClick={() => moveFile(f)}>
                      <Icon name="layers" size={15} />
                    </button>
                    <button type="button" title="Xóa" onClick={() => removeFile(f)}>
                      <Icon name="trash" size={15} />
                    </button>
                    <button
                      type="button"
                      title="Mở Studio"
                      className="file-action-open"
                      onClick={() => openStudio(f.id)}
                    >
                      <Icon name="arrow" size={15} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <div className="right-stack">
          <DeskMusicDock
            music={music}
            variant="panel"
            onUploadMusic={() => musicInputRef.current?.click()}
          />
          <DeskSchedule
            title={desk.scheduleTitle || t("scheduleDefaultTitle")}
            events={desk.schedule || []}
            onChange={({ scheduleTitle, schedule }) =>
              update({ ...desk, scheduleTitle, schedule })
            }
          />
          <section>
            <div className="section-head">
              <h2>{t("tasks")}</h2>
              <button className="text-button" type="button" onClick={addTask}>
                {t("addTask")}
              </button>
            </div>
            <div className="task-list">
              {desk.tasks.length === 0 ? (
                <p className="empty-hint">{t("noTasks")}</p>
              ) : (
                desk.tasks.map((t) => (
                  <div className="task-row-wrap" key={t.id}>
                    <label className="task-row">
                      <input type="checkbox" checked={t.done} onChange={() => toggleTask(t.id)} />
                      <span>
                        <strong style={{ textDecoration: t.done ? "line-through" : "none" }}>
                          {t.title}
                        </strong>
                        <small>{t.due}</small>
                      </span>
                    </label>
                    <button
                      type="button"
                      className="icon-ghost"
                      title="Xóa task"
                      onClick={() => removeTask(t.id)}
                    >
                      <Icon name="trash" size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>
          <section className="focus">
            <div className="section-head">
              <h2>{t("focus")}</h2>
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
                  onClick={() => setFocusSeconds(m * 60)}
                >
                  {m}p
                </button>
              ))}
            </div>
            <DigitalFocusClock
              totalSeconds={seconds}
              running={running}
              onChange={setFocusSeconds}
            />
            <div className="timer-actions">
              <Button icon="play" onClick={() => setRunning((v) => !v)}>
                {running ? t("pause") : t("start")}
              </Button>
              <Button
                variant="ghost"
                icon="reset"
                onClick={() => {
                  setRunning(false);
                  setSeconds(desk.focusSeconds);
                }}
              >
                {t("reset")}
              </Button>
            </div>
          </section>
          <section>
            <div className="section-head">
              <h2>{t("roomsTitle")}</h2>
            </div>
            <label>
              {t("roomUrl")}
              <input
                value={desk.studyRoomUrl}
                onChange={(e) => update({ ...desk, studyRoomUrl: e.target.value })}
                placeholder="https://meet.google.com/…"
              />
            </label>
            {desk.studyRoomUrl ? (
              <a
                href={desk.studyRoomUrl}
                target="_blank"
                rel="noreferrer"
                className="button secondary"
                style={{ marginTop: 10, display: "inline-flex" }}
              >
                Open room
              </a>
            ) : null}
          </section>
          <section>
            <div className="section-head">
              <h2>Desk theme</h2>
            </div>
            <div className="themes">
              <div className="desk-theme-block">
                <p>Màu nền</p>
                <BgColorPicker
                  mode={desk.bgMode}
                  solid={desk.bgSolid}
                  gradient={desk.bgGradient}
                  onChange={({ mode, solid, gradient }) =>
                    setBgAppearance({ bgMode: mode, bgSolid: solid, bgGradient: gradient })
                  }
                />
              </div>
              <div className="desk-theme-block">
                <p>Hình nền</p>
                <WallpaperPicker
                  wallpaper={desk.wallpaper}
                  onSelect={(id) => void setWallpaper(id)}
                  onUploadCustom={async (dataUrl) => {
                    await saveCustomWallpaper(dataUrl);
                    const next = { ...desk, wallpaper: "custom" as const };
                    applyBgAppearance(next, dataUrl);
                    update(next);
                  }}
                />
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default function DeskPage() {
  return (
    <RequireAuth>
      {(user) => (
        <AppShell userName={user.name}>
          <Suspense
            fallback={
              <div className="page">
                <h1>Đang tải bàn học…</h1>
              </div>
            }
          >
            <DeskContent userName={user.name} />
          </Suspense>
        </AppShell>
      )}
    </RequireAuth>
  );
}
