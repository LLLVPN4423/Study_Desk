"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { useI18n } from "@/lib/i18n";
import { loadSession } from "@/lib/session";

export default function LandingPage() {
  const { t, lang, setLang } = useI18n();
  const router = useRouter();

  useEffect(() => {
    if (loadSession()) router.replace("/desk");
  }, [router]);

  return (
    <div className="landing">
      <header className="landing-nav">
        <div className="wordmark small">
          Study Desk<span>.</span>
        </div>
        <div>
          <button
            type="button"
            className="text-button"
            onClick={() => setLang(lang === "vi" ? "en" : "vi")}
          >
            {lang === "vi" ? "EN" : "VI"}
          </button>
          <Link href="/auth" className="text-button">
            {t("signIn")}
          </Link>
          <Link href="/auth?mode=signup" className="button primary">
            {t("startFree")}
          </Link>
        </div>
      </header>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">{t("landingEyebrow")}</p>
          <h1 className="wordmark">
            Study
            <br />
            Desk<span>.</span>
          </h1>
          <h2>{t("landingHeadline")}</h2>
          <p>{t("landingBody")}</p>
          <div className="actions">
            <Link href="/auth?mode=signup" className="button primary">
              {t("startFree")} <Icon name="arrow" />
            </Link>
            <Link href="/auth" className="button secondary">
              {t("signIn")}
            </Link>
          </div>
        </div>
        <div
          className="hero-image"
          role="img"
          aria-label="A quiet study desk with a notebook and plant"
        >
          <div className="image-note">
            <span>今日の焦点</span>
            <strong>
              Small steps,
              <br />
              kept daily.
            </strong>
            <div className="rule" />
          </div>
          <div className="photo-credit">Photo by Chris Vasquez · Unsplash</div>
        </div>
      </section>
      <footer>{t("unofficial")}</footer>
    </div>
  );
}
