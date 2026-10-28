"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { RequireAuth } from "@/components/RequireAuth";
import { downloadBackup, restoreBackupAsync } from "@/lib/backup";
import { useI18n } from "@/lib/i18n";
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
  const { t } = useI18n();
  const router = useRouter();
  const [plan, setPlan] = useState(user.plan);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function togglePro() {
    const session = loadSession();
    if (!session) return;
    const next = session.plan === "pro" ? "free" : "pro";
    saveSession({ ...session, plan: next });
    setPlan(next);
  }

  async function onExport() {
    setBusy(true);
    setMsg(null);
    try {
      const result = await downloadBackup();
      // Never present a missing-blob / failed export as a quiet success string.
      setMsg(result.ok ? result.message : `${t("backupFailed")} ${result.message}`);
    } catch {
      setMsg(t("backupFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function onImport(file: File | null) {
    if (!file) return;
    setBusy(true);
    setMsg(null);
    try {
      if (!file.size) {
        setMsg(t("backupFailed") + " (empty file)");
        return;
      }
      const text = await file.text();
      const result = await restoreBackupAsync(text);
      if (!result.ok) {
        setMsg(`${t("backupFailed")} ${result.message}`);
        return;
      }
      const legacy = result.legacyWarning ? ` ${result.legacyWarning}` : "";
      setMsg(`${result.message}${legacy} ${t("backupRestored")}`);
      // Full reload so Desk remounts and hydrates IndexedDB blobs after overwrite.
      window.setTimeout(() => {
        router.push("/desk");
        window.setTimeout(() => window.location.reload(), 50);
      }, 800);
    } catch (err) {
      setMsg(
        `${t("backupFailed")} ${err instanceof Error ? err.message : ""}`.trim(),
      );
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="page">
      <p className="eyebrow">{t("settingsEyebrow")}</p>
      <h1>{t("settingsTitle")}</h1>
      <p style={{ color: "var(--muted)", margin: "12px 0 28px" }}>
        {user.email} · {plan === "pro" ? "Pro" : "Free"} {t("settingsPlan")} · {t("settingsOneDesk")}
      </p>
      <div className="actions">
        <Button variant="secondary" onClick={togglePro}>
          {plan === "pro" ? t("switchFree") : t("enablePro")}
        </Button>
        <Button
          variant="danger"
          onClick={() => {
            clearSession();
            router.push("/");
          }}
        >
          {t("signOut")}
        </Button>
        <Link href="/learn" className="button ghost">
          {t("backToLearn")}
        </Link>
      </div>

      <section style={{ marginTop: 40, maxWidth: 560 }}>
        <h2 style={{ fontSize: 24, marginBottom: 10 }}>{t("backupTitle")}</h2>
        <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 16 }}>{t("backupBody")}</p>
        <div className="actions">
          <Button onClick={() => void onExport()} disabled={busy}>
            {t("exportBackup")}
          </Button>
          <Button
            variant="secondary"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
          >
            {t("importBackup")}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => void onImport(e.target.files?.[0] ?? null)}
          />
        </div>
        {msg && (
          <p style={{ marginTop: 12, fontSize: 13, color: "var(--accent)", whiteSpace: "pre-wrap" }}>
            {msg}
          </p>
        )}
      </section>

      <p style={{ marginTop: 40, fontSize: 12, color: "var(--muted)", maxWidth: 560 }}>
        {t("settingsFoot")}
      </p>
    </div>
  );
}
