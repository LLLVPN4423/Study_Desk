"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { RequireAuth } from "@/components/RequireAuth";
import { downloadBackup, restoreBackup } from "@/lib/backup";
import { clearSession, loadSession, saveSession, type SessionUser } from "@/lib/session";

export default function SettingsPage() {
  return (
    <RequireAuth>
      {(user) => (
        <AppShell userName={user.name}>
          <SettingsContent user={user} />
        </AppShell>
      )}
    </RequireAuth>
  );
}

function SettingsContent({ user }: { user: SessionUser }) {
  const router = useRouter();
  const [plan, setPlan] = useState(user.plan);
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function togglePro() {
    const session = loadSession();
    if (!session) return;
    const next = session.plan === "pro" ? "free" : "pro";
    saveSession({ ...session, plan: next });
    setPlan(next);
  }

  async function onImport(file: File | null) {
    if (!file) return;
    setMsg(null);
    try {
      const text = await file.text();
      restoreBackup(text);
      setMsg("Backup restored. Reloading…");
      window.setTimeout(() => window.location.assign("/desk"), 600);
    } catch {
      setMsg("Could not restore backup. Check the JSON file.");
    }
  }

  return (
    <div className="page">
      <p className="eyebrow">Settings</p>
      <h1>Account</h1>
      <p style={{ color: "var(--muted)", margin: "12px 0 28px" }}>
        {user.email} · {plan === "pro" ? "Pro" : "Free"} plan · 1 desk
      </p>
      <div className="actions">
        <Button variant="secondary" onClick={togglePro}>
          {plan === "pro" ? "Switch to Free flag" : "Enable Pro flag (dev)"}
        </Button>
        <Button
          variant="danger"
          onClick={() => {
            clearSession();
            router.push("/");
          }}
        >
          Sign out
        </Button>
        <Link href="/learn" className="button ghost">
          Back to learn
        </Link>
      </div>

      <section style={{ marginTop: 40, maxWidth: 520 }}>
        <h2 style={{ fontSize: 24, marginBottom: 10 }}>Backup</h2>
        <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 16 }}>
          Data lives in this browser. Export JSON regularly; import on another device/browser.
        </p>
        <div className="actions">
          <Button onClick={() => downloadBackup()}>Export backup</Button>
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>
            Import backup
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => onImport(e.target.files?.[0] ?? null)}
          />
        </div>
        {msg && <p style={{ marginTop: 12, fontSize: 13, color: "var(--accent)" }}>{msg}</p>}
      </section>

      <p style={{ marginTop: 40, fontSize: 12, color: "var(--muted)", maxWidth: 520 }}>
        MiniHongo is optional (see docs/MINIHONGO-MODULE.md). Pro flag unlocks dual JP+EN paths —
        no payment gateway yet. Unofficial practice — not affiliated with JLPT/IELTS.
      </p>
    </div>
  );
}
