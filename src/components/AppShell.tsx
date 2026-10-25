"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./Icon";
import { useI18n } from "@/lib/i18n";

export function AppShell({
  children,
  userName = "You",
}: {
  children: React.ReactNode;
  userName?: string;
}) {
  const pathname = usePathname();
  const { t, lang, setLang } = useI18n();
  const deskActive = pathname.startsWith("/desk");
  const learnActive = pathname.startsWith("/learn");
  const cultureActive = pathname.startsWith("/culture");
  const roomsActive = pathname.startsWith("/rooms");
  const settingsActive = pathname.startsWith("/settings");
  const initial = userName.trim().charAt(0).toUpperCase() || "Y";

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/" className="mini-brand">
          SD<span>.</span>
        </Link>
        <nav>
          <Link href="/desk" className={deskActive ? "active" : ""}>
            <Icon name="desk" />
            <span>{t("navDesk")}</span>
          </Link>
          <Link href="/learn" className={learnActive ? "active" : ""}>
            <Icon name="learn" />
            <span>{t("navLearn")}</span>
          </Link>
          <Link href="/culture" className={cultureActive ? "active" : ""}>
            <Icon name="layers" />
            <span>{t("navCulture")}</span>
          </Link>
          <Link href="/rooms" className={roomsActive ? "active" : ""}>
            <Icon name="audio" />
            <span>{t("navRooms")}</span>
          </Link>
          <Link href="/settings" className={settingsActive ? "active" : ""}>
            <Icon name="settings" />
            <span>{t("navSettings")}</span>
          </Link>
        </nav>
        <div className="sidebar-bottom">
          <button
            type="button"
            className="chip"
            style={{ cursor: "pointer", marginBottom: 8 }}
            onClick={() => setLang(lang === "vi" ? "en" : "vi")}
            title="Language"
          >
            {lang === "vi" ? "VI" : "EN"}
          </button>
          <div className="avatar">{initial}</div>
          <span>{userName.split(" ")[0]}</span>
        </div>
      </aside>
      <main className="workspace">{children}</main>
    </div>
  );
}
