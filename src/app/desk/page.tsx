"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { RequireAuth } from "@/components/RequireAuth";
import {
  applyTheme,
  canAddFolder,
  canUpload,
  formatBytes,
  loadDesk,
  saveDesk,
  type DeskFile,
  type DeskState,
  type DeskTask,
} from "@/lib/desk-store";
import { FREE_LIMITS } from "@/lib/freemium";
import type { ThemeId } from "@/lib/storage-keys";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function dateLabel() {
  return new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function DeskContent({ userName }: { userName: string }) {
  const [desk, setDesk] = useState<DeskState | null>(null);
  const [seconds, setSeconds] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [folderFilter, setFolderFilter] = useState<string | "all">("all");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const state = loadDesk();
    setDesk(state);
    applyTheme(state.theme);
  }, []);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          setRunning(false);
          return 0;
        }
        return s - 1;
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

  function update(next: DeskState) {
    setDesk(next);
    saveDesk(next);
  }

  async function onFiles(fileList: FileList | null) {
    if (!desk || !fileList?.length) return;
    setUploadError(null);
    const nextFiles = [...desk.files];
    for (const file of Array.from(fileList)) {
      const kind =
        file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
          ? "pdf"
          : file.type.startsWith("audio/") || file.name.toLowerCase().endsWith(".mp3")
            ? "mp3"
            : null;
      if (!kind) {
        setUploadError("PDF + MP3 only.");
        continue;
      }
      const check = canUpload(nextFiles, file.size);
      if (!check.ok) {
        setUploadError(check.reason);
        break;
      }
      const dataUrl = await readAsDataUrl(file);
      const entry: DeskFile = {
        id: crypto.randomUUID(),
        name: file.name,
        kind,
        size: file.size,
        tag: kind === "pdf" ? "Notes" : "Listening",
        folderId: folderFilter === "all" ? null : folderFilter,
        createdAt: new Date().toISOString(),
        dataUrl,
      };
      nextFiles.unshift(entry);
    }
    update({ ...desk, files: nextFiles });
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
    const title = window.prompt("Task title");
    if (!title?.trim()) return;
    const task: DeskTask = {
      id: crypto.randomUUID(),
      title: title.trim(),
      due: "Today",
      done: false,
    };
    update({ ...desk, tasks: [task, ...desk.tasks] });
  }

  function addFolder() {
    if (!desk) return;
    const check = canAddFolder(desk.folders);
    if (!check.ok) {
      setUploadError(check.reason);
      return;
    }
    const name = window.prompt("Folder name");
    if (!name?.trim()) return;
    update({
      ...desk,
      folders: [...desk.folders, { id: crypto.randomUUID(), name: name.trim() }],
    });
  }

  function setTheme(theme: ThemeId) {
    if (!desk) return;
    applyTheme(theme);
    update({ ...desk, theme });
  }

  if (!desk) {
    return (
      <div className="page">
        <h1>Loading desk…</h1>
      </div>
    );
  }

  const visibleFiles =
    folderFilter === "all"
      ? desk.files
      : desk.files.filter((f) => f.folderId === folderFilter);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">{dateLabel()}</p>
          <h1>
            {greeting()}, {userName.split(" ")[0]}.
          </h1>
          <p>Everything you need, within reach.</p>
        </div>
        <div className="quota">
          Free plan
          <br />
          <strong>1 desk · storage limited</strong>
        </div>
      </div>
      <div className="desk-grid">
        <section className="files-section">
          <div className="section-head">
            <div>
              <h2>Files</h2>
              <span>
                {desk.files.length} of {FREE_LIMITS.maxFiles}
              </span>
            </div>
            <Button variant="secondary" icon="upload" onClick={() => inputRef.current?.click()}>
              Upload PDF or MP3
            </Button>
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.mp3,application/pdf,audio/mpeg"
              multiple
              hidden
              onChange={(e) => onFiles(e.target.files)}
            />
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
            <button
              type="button"
              className={`chip ${folderFilter === "all" ? "" : ""}`}
              style={{
                border: folderFilter === "all" ? "1px solid var(--accent)" : "1px solid transparent",
                cursor: "pointer",
              }}
              onClick={() => setFolderFilter("all")}
            >
              All
            </button>
            {desk.folders.map((f) => (
              <button
                key={f.id}
                type="button"
                className="chip"
                style={{
                  border: folderFilter === f.id ? "1px solid var(--accent)" : "1px solid transparent",
                  cursor: "pointer",
                }}
                onClick={() => setFolderFilter(f.id)}
              >
                {f.name}
              </button>
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
              onFiles(e.dataTransfer.files);
            }}
            onClick={() => inputRef.current?.click()}
          >
            <Icon name="upload" />
            <span>Drop study files here</span>
            <small>PDF + MP3 only</small>
          </div>
          {uploadError && (
            <p style={{ color: "var(--danger)", fontSize: 12, marginBottom: 12 }}>{uploadError}</p>
          )}
          <div className="file-list">
            {visibleFiles.length === 0 ? (
              <p style={{ padding: "18px 8px", color: "var(--muted)", fontSize: 13 }}>
                No files yet · Add your first PDF
              </p>
            ) : (
              visibleFiles.map((f) => (
                <Link key={f.id} href={`/desk/files/${f.id}`} className="file-row">
                  <span className={`file-icon ${f.kind === "mp3" ? "audio" : "file"}`}>
                    <Icon name={f.kind === "mp3" ? "audio" : "file"} />
                  </span>
                  <span className="file-info">
                    <strong>{f.name}</strong>
                    <small>
                      {f.kind.toUpperCase()} · {formatBytes(f.size)} ·{" "}
                      {new Date(f.createdAt).toLocaleDateString()}
                    </small>
                  </span>
                  <span className="chip">{f.tag}</span>
                  <Icon name="arrow" size={16} />
                </Link>
              ))
            )}
          </div>
        </section>
        <div className="right-stack">
          <section>
            <div className="section-head">
              <h2>Tasks</h2>
              <button className="text-button" type="button" onClick={addTask}>
                + Add
              </button>
            </div>
            <div className="task-list">
              {desk.tasks.map((t) => (
                <label className="task-row" key={t.id}>
                  <input type="checkbox" checked={t.done} onChange={() => toggleTask(t.id)} />
                  <span>
                    <strong style={{ textDecoration: t.done ? "line-through" : "none" }}>
                      {t.title}
                    </strong>
                    <small>{t.due}</small>
                  </span>
                </label>
              ))}
            </div>
          </section>
          <section className="focus">
            <div className="section-head">
              <h2>Focus</h2>
              <span>Pomodoro</span>
            </div>
            <div className="timer">
              <strong>{timerLabel}</strong>
              <small>{running ? "Focus in progress" : "Ready when you are"}</small>
            </div>
            <div className="timer-actions">
              <Button icon="play" onClick={() => setRunning((v) => !v)}>
                {running ? "Pause" : "Start"}
              </Button>
              <Button
                variant="ghost"
                icon="reset"
                onClick={() => {
                  setRunning(false);
                  setSeconds(25 * 60);
                }}
              >
                Reset
              </Button>
            </div>
          </section>
          <section>
            <div className="section-head">
              <h2>Study room link</h2>
            </div>
            <label>
              Meet / Zoom URL
              <input
                value={desk.studyRoomUrl}
                onChange={(e) => update({ ...desk, studyRoomUrl: e.target.value })}
                placeholder="https://meet.google.com/…"
              />
            </label>
            {desk.studyRoomUrl && (
              <a
                href={desk.studyRoomUrl}
                target="_blank"
                rel="noreferrer"
                className="button secondary"
                style={{ marginTop: 10, display: "inline-flex" }}
              >
                Open room
              </a>
            )}
          </section>
          <section>
            <div className="section-head">
              <h2>Desk theme</h2>
            </div>
            <div className="themes">
              {(
                [
                  ["paper", "Paper", ""],
                  ["moss", "Moss", "moss"],
                  ["night", "Midnight-light", "night"],
                ] as const
              ).map(([id, label, cls]) => (
                <button
                  key={id}
                  type="button"
                  className={`theme ${cls} ${desk.theme === id ? "active" : ""}`}
                  onClick={() => setTheme(id)}
                >
                  <i />
                  {label}
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function DeskPage() {
  return (
    <RequireAuth>
      {(user) => (
        <AppShell userName={user.name}>
          <DeskContent userName={user.name} />
        </AppShell>
      )}
    </RequireAuth>
  );
}
