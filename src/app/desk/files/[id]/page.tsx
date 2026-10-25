"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { RequireAuth } from "@/components/RequireAuth";
import { loadDesk, saveDesk, type DeskFile } from "@/lib/desk-store";
import { addManualCard, loadLearn, type TrackId } from "@/lib/learn-store";
import { canListen, listenOnce } from "@/lib/speech";

function FileDetail({ userName }: { userName: string }) {
  const params = useParams<{ id: string }>();
  const [file, setFile] = useState<DeskFile | null | undefined>(undefined);
  const [playing, setPlaying] = useState(false);
  const [snippet, setSnippet] = useState("");
  const [meaning, setMeaning] = useState("");
  const [track, setTrack] = useState<TrackId>("jp");
  const [msg, setMsg] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const desk = loadDesk();
    setFile(desk.files.find((f) => f.id === params.id) ?? null);
    const learn = loadLearn();
    setTrack(learn.preferredTrack);
  }, [params.id]);

  const waves = useMemo(
    () => Array.from({ length: 50 }).map((_, i) => 10 + ((i * 13) % 34)),
    [],
  );

  function toggleAudio() {
    if (!file?.dataUrl || file.kind !== "mp3") return;
    if (!audioRef.current) {
      audioRef.current = new Audio(file.dataUrl);
      audioRef.current.onended = () => setPlaying(false);
    }
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      void audioRef.current.play();
      setPlaying(true);
    }
  }

  function saveNotes(notes: string) {
    if (!file) return;
    const desk = loadDesk();
    const files = desk.files.map((f) => (f.id === file.id ? { ...f, notes } : f));
    saveDesk({ ...desk, files });
    setFile({ ...file, notes });
  }

  function makeCard() {
    setMsg(null);
    const word = snippet.trim();
    if (!word) {
      setMsg("Select or type a phrase first.");
      return;
    }
    const result = addManualCard({
      track,
      word,
      meanings: [meaning.trim() || "From desk note"],
    });
    if (!result.ok) {
      setMsg(result.reason);
      return;
    }
    setMsg(`Added to ${track.toUpperCase()} SRS deck.`);
    setSnippet("");
    setMeaning("");
  }

  if (file === undefined) {
    return (
      <div className="page">
        <h1>Loading…</h1>
      </div>
    );
  }

  if (!file) {
    return (
      <div className="page file-page">
        <Link href="/desk" className="back">
          ← Back to desk
        </Link>
        <h1>File not found</h1>
      </div>
    );
  }

  return (
    <div className="page file-page">
      <Link href="/desk" className="back">
        ← Back to desk
      </Link>
      <div className="page-head compact">
        <div>
          <h1>{file.name}</h1>
          <div>
            <span className="chip">{file.tag}</span>{" "}
            <span className="chip">{file.kind.toUpperCase()}</span>
          </div>
        </div>
      </div>
      {file.kind === "pdf" ? (
        <div className="viewer">
          <div className="viewer-bar">
            <span>PDF viewer</span>
            <div>Study Desk</div>
          </div>
          {file.dataUrl ? (
            <iframe
              title={file.name}
              src={file.dataUrl}
              style={{ width: "100%", height: 620, border: 0, background: "#fff" }}
            />
          ) : (
            <div className="paper">
              <small>No preview</small>
              <h2>PDF unavailable</h2>
            </div>
          )}
        </div>
      ) : (
        <div className="audio-player">
          <div className="record">
            <div />
            <Icon name="audio" size={34} />
          </div>
          <p className="eyebrow">Listening practice</p>
          <h2>{file.name}</h2>
          <div className="waveform">
            {waves.map((h, i) => (
              <i key={i} style={{ height: `${h}px` }} />
            ))}
          </div>
          <div className="player-controls">
            <span>{userName}</span>
            <button type="button" onClick={toggleAudio} aria-label={playing ? "Pause" : "Play"}>
              <Icon name={playing ? "reset" : "play"} size={24} />
            </button>
            <span>MP3</span>
          </div>
        </div>
      )}

      <section style={{ marginTop: 28 }}>
        <div className="section-head">
          <h2>Highlight → flashcard</h2>
        </div>
        <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 12 }}>
          Copy a phrase from your PDF/notes, paste below, and send it to your active SRS path.
        </p>
        <div className="segmented" style={{ marginBottom: 12 }}>
          <button
            type="button"
            className={track === "jp" ? "active" : ""}
            onClick={() => setTrack("jp")}
          >
            JP deck
          </button>
          <button
            type="button"
            className={track === "en" ? "active" : ""}
            onClick={() => setTrack("en")}
          >
            EN deck
          </button>
        </div>
        <label>
          Phrase
          <input value={snippet} onChange={(e) => setSnippet(e.target.value)} placeholder="Paste selection…" />
        </label>
        <label>
          Meaning / gloss
          <input
            value={meaning}
            onChange={(e) => setMeaning(e.target.value)}
            placeholder="Optional gloss"
          />
        </label>
        <div style={{ marginTop: 8 }}>
          <Button onClick={makeCard}>Add to SRS</Button>
        </div>
        {msg && <p style={{ marginTop: 10, fontSize: 13, color: "var(--accent)" }}>{msg}</p>}
      </section>

      <section style={{ marginTop: 28 }}>
        <div className="section-head">
          <h2>Notes</h2>
        </div>
        <label>
          Desk notes
          <textarea
            value={file.notes || ""}
            onChange={(e) => saveNotes(e.target.value)}
            rows={5}
            style={{
              width: "100%",
              marginTop: 7,
              padding: 12,
              borderRadius: 8,
              border: "1px solid var(--line)",
              background: "var(--paper)",
              font: "inherit",
            }}
          />
        </label>
        {canListen() && (
          <div style={{ marginTop: 10 }}>
            <Button
              variant="secondary"
              onClick={() =>
                listenOnce(
                  track === "jp" ? "ja-JP" : "en-US",
                  (text) => saveNotes(`${file.notes || ""}${file.notes ? "\n" : ""}${text}`),
                  (err) => setMsg(err),
                )
              }
            >
              Dictate note (free browser STT)
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}

export default function FilePage() {
  return (
    <RequireAuth>
      {(user) => (
        <AppShell userName={user.name}>
          <FileDetail userName={user.name} />
        </AppShell>
      )}
    </RequireAuth>
  );
}
