"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { RequireAuth } from "@/components/RequireAuth";
import { downloadBackup, restoreBackup } from "@/lib/backup";
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
      setMsg(t("backupRestored"));
      window.setTimeout(() => window.location.assign("/desk"), 600);
    } catch {
      setMsg(t("backupFailed"));
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

      <section style={{ marginTop: 40, maxWidth: 520 }}>
        <h2 style={{ fontSize: 24, marginBottom: 10 }}>{t("backupTitle")}</h2>
        <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 16 }}>{t("backupBody")}</p>
        <div className="actions">
          <Button onClick={() => downloadBackup()}>{t("exportBackup")}</Button>
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>
            {t("importBackup")}
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
        {t("settingsFoot")}
      </p>
    </div>
  );
}
