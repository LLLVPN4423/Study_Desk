"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { Icon } from "./Icon";
import { ProductTour } from "./ProductTour";
import { hydrateBgAppearance, loadDesk } from "@/lib/desk-store";
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
  const initial = userName.trim().charAt(0).toUpperCase() || "Y";

  useEffect(() => {
    void hydrateBgAppearance(loadDesk());
  }, []);

  const items = [
    {
      href: "/desk",
      label: t("navDesk"),
      icon: "desk" as const,
      tour: "desk",
      active: pathname.startsWith("/desk"),
    },
    {
      href: "/learn",
      label: t("navLearn"),
      icon: "learn" as const,
      tour: "learn",
      active: pathname.startsWith("/learn"),
    },
    {
      href: "/culture",
      label: t("navCulture"),
      icon: "layers" as const,
      tour: "culture",
      active: pathname.startsWith("/culture"),
    },
    {
      href: "/rooms",
      label: t("navRooms"),
      icon: "audio" as const,
      tour: "rooms",
      active: pathname.startsWith("/rooms"),
    },
    {
      href: "/help",
      label: t("navHelp"),
      icon: "book" as const,
      tour: "help",
      active: pathname.startsWith("/help"),
    },
    {
      href: "/settings",
      label: t("navSettings"),
      icon: "settings" as const,
      tour: "settings",
      active: pathname.startsWith("/settings"),
    },
  ];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/desk" className="mini-brand" title="Study Desk">
          SD<span>.</span>
        </Link>
        <nav aria-label="Main">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={item.active ? "active" : ""}
              data-tour={item.tour}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button
            type="button"
            className="lang-toggle"
            onClick={() => setLang(lang === "vi" ? "en" : "vi")}
            title="Language"
          >
            {lang === "vi" ? "VI" : "EN"}
          </button>
          <div className="avatar" aria-hidden>
            {initial}
          </div>
          <span className="sidebar-name">{userName.split(" ")[0]}</span>
        </div>
      </aside>
      <main className="workspace">{children}</main>
      <ProductTour />
    </div>
  );
}
