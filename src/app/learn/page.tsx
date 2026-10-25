"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Icon, type IconName } from "@/components/Icon";
import { PathTimeline } from "@/components/PathTimeline";
import { RequireAuth } from "@/components/RequireAuth";
import {
  dueCards,
  ensureRoadmap,
  loadLearn,
  pathProgress,
  setPreferredTrack,
  type LearnState,
  type TrackId,
} from "@/lib/learn-store";
import { useI18n } from "@/lib/i18n";

export default function LearnPage() {
  return (
    <RequireAuth>
      {(user) => (
        <AppShell userName={user.name}>
          <LearnContent plan={user.plan} />
        </AppShell>
      )}
    </RequireAuth>
  );
}

function LearnContent({ plan }: { plan: "free" | "pro" }) {
  const { t, lang } = useI18n();
  const [state, setState] = useState<LearnState | null>(null);

  useEffect(() => {
    const s = loadLearn();
    setState(ensureRoadmap(s.preferredTrack));
  }, []);

  if (!state) {
    return (
      <div className="page">
        <h1>{t("loading")}</h1>
      </div>
    );
  }

  const track = state.preferredTrack;
  const active = track === "jp" ? state.jp : state.en;
  const due = dueCards(track, state).length;
  const progress = pathProgress(track, state);
  const inv = active.roadmap?.inventory;
  const hasPath = Boolean(active.roadmap && active.pathActive);
  const trackLabel = track === "jp" ? t("trackJp") : t("trackEn");
  const otherLabel = track === "jp" ? t("trackEn") : t("trackJp");

  function switchTrack(next: TrackId) {
    setPreferredTrack(next);
    setState(ensureRoadmap(next));
  }

  const starterActions: { name: string; desc: string; icon: IconName; href: string }[] = [
    {
      name: t("placement"),
      desc: active.placementDone
        ? `~${active.band} · ${t("placementDone")}`
        : t("placementTodo"),
      icon: "layers",
      href: `/learn/placement?track=${track}`,
    },
    {
      name: t("roadmap"),
      desc: active.roadmap
        ? `${active.roadmap.weeks.length} ${t("weeks")} · ${active.roadmap.inventory.vocab} ${t("vocabSrs")}`
        : t("roadmapAfter"),
      icon: "road",
      href: `/learn/roadmap?track=${track}`,
    },
    {
      name: t("reviews"),
      desc: active.pathActive
        ? `${due} ${t("dueCards")} · ${active.cards.length} ${t("inDeck")}`
        : t("reviewsEmpty"),
      icon: "book",
      href: `/learn/review?track=${track}`,
    },
  ];

  const catalogActions: { name: string; desc: string; icon: IconName; href: string }[] = [
    {
      name: t("catalogVocab"),
      desc:
        track === "jp"
          ? lang === "en"
            ? "Full OpenJLPT · ~7.8k words N5–N1"
            : "OpenJLPT đầy đủ · ~7.8k từ N5–N1"
          : lang === "en"
            ? "CEFR-J + Octanove · ~9.9k entries A1–C2"
            : "CEFR-J + Octanove · ~9.9k mục A1–C2",
      icon: "book",
      href: `/learn/vocab?track=${track}${active.band ? `&level=${active.band}` : ""}`,
    },
    {
      name: t("catalogGrammar"),
      desc:
        track === "jp"
          ? lang === "en"
            ? "OpenJLPT ~526 patterns + drills N5–N1"
            : "OpenJLPT ~526 mẫu + drills N5–N1"
          : lang === "en"
            ? "CEFR-style drills A1–C1"
            : "CEFR-style drills A1–C1",
      icon: "layers",
      href: `/learn/grammar?track=${track}&view=list${active.band ? `&level=${active.band}` : ""}`,
    },
    ...(track === "jp"
      ? [
          {
            name: t("catalogKanji"),
            desc: lang === "en" ? "List + flash N5–N1" : "Danh sách + flash N5–N1",
            icon: "book" as IconName,
            href: `/learn/kanji?view=list&level=${active.band || "N5"}`,
          },
        ]
      : []),
    {
      name: t("catalogDict"),
      desc:
        track === "jp"
          ? lang === "en"
            ? "Look up OpenJLPT N5–N1"
            : "Tra cứu OpenJLPT N5–N1"
          : lang === "en"
            ? "Look up CEFR A1–C2"
            : "Tra cứu CEFR A1–C2",
      icon: "search",
      href: `/learn/dictionary?track=${track}`,
    },
    {
      name: t("catalogMocks"),
      desc: lang === "en" ? "Timed vocab / listening" : "Vocab / nghe có đồng hồ",
      icon: "road",
      href: `/learn/mocks?track=${track}`,
    },
  ];

  return (
    <div className="page learn-page">
      <div className="page-head">
        <div>
          <p className="eyebrow">{t("learnEyebrow")}</p>
          <h1>{t("learnTitle")}</h1>
          <p>{t("learnSub")}</p>
        </div>
        <div className="quota">
          {plan === "pro" ? "Pro" : "Free"}
          <br />
          <strong>{plan === "pro" ? "JP + EN" : t("onePath")}</strong>
        </div>
      </div>

      <div className="segmented" style={{ marginBottom: 24 }}>
        <button
          type="button"
          className={track === "jp" ? "active" : ""}
          onClick={() => switchTrack("jp")}
        >
          {t("trackJp")}
        </button>
        <button
          type="button"
          className={track === "en" ? "active" : ""}
          onClick={() => switchTrack("en")}
        >
          {t("trackEn")}
        </button>
      </div>

      <section className="active-path">
        <div>
          <span className="language-mark">{track === "jp" ? "日" : "EN"}</span>
          <p className="eyebrow">
            {active.pathActive ? t("pathActive") : t("pathIdle")} · {trackLabel}
          </p>
          <h2>
            {active.placementDone
              ? `${t("pathRoadmapApprox")} ~${active.band}`
              : t("pathBeginPlacement")}
          </h2>
          <p>{active.roadmap ? active.roadmap.summary : t("pathBeginHint")}</p>
          <small>
            {t("pathUnofficial")} {track === "jp" ? "JLPT" : "IELTS/CEFR"}
            {inv
              ? ` · ${inv.vocab} · ${inv.grammar}${inv.kanji ? ` · ${inv.kanji} kanji` : ""}`
              : ""}
          </small>
        </div>
        <div className="path-progress">
          <strong>{active.pathActive ? `${progress}%` : "0%"}</strong>
          <span>
            <i style={{ width: active.pathActive ? `${progress}%` : "0%" }} />
          </span>
          <small>
            {due} {t("reviewsDue")}
          </small>
        </div>
      </section>

      {hasPath && active.roadmap ? (
        <PathTimeline plan={active.roadmap} progress={progress} />
      ) : null}

      <h3 className="learn-section-title">{hasPath ? t("pathTools") : t("pathStart")}</h3>
      <div className="action-grid">
        {starterActions.map((a) => (
          <Link key={a.name} href={a.href}>
            <Icon name={a.icon} />
            <span>
              <strong>{a.name}</strong>
              <small>{a.desc}</small>
            </span>
            <Icon name="arrow" />
          </Link>
        ))}
      </div>

      <h3 className="learn-section-title">{t("pathLibrary")}</h3>
      <div className="action-grid catalog-grid">
        {catalogActions.map((a) => (
          <Link key={a.name} href={a.href}>
            <Icon name={a.icon} />
            <span>
              <strong>{a.name}</strong>
              <small>{a.desc}</small>
            </span>
            <Icon name="arrow" />
          </Link>
        ))}
      </div>

      <section className="coming">
        <span className="language-mark muted">{track === "jp" ? "EN" : "日"}</span>
        <div>
          <p className="eyebrow">{otherLabel}</p>
          <h3>
            {track === "jp"
              ? state.en.pathActive
                ? `~${state.en.band}`
                : t("pathOtherAlso")
              : state.jp.pathActive
                ? `~${state.jp.band}`
                : t("pathOtherAlso")}
          </h3>
          <p>
            {t("pathSwitchHint")}
            {plan === "free" ? t("pathFreeOne") : t("pathProBoth")}
          </p>
        </div>
        <button type="button" onClick={() => switchTrack(track === "jp" ? "en" : "jp")}>
          {t("pathSwitch")}
        </button>
      </section>
    </div>
  );
}
