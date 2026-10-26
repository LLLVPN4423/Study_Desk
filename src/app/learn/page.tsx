"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { Icon, type IconName } from "@/components/Icon";
import { LearnStats } from "@/components/LearnStats";
import { PathTimeline } from "@/components/PathTimeline";
import { RequireAuth } from "@/components/RequireAuth";
import {
  actionCredit,
  activityLast7Days,
  appendBandVocab,
  appendFullPrimaryVocab,
  canPromoteBand,
  ensureRoadmap,
  addSuggestedPath,
  extendPath,
  getDailyStudyProgress,
  getLevelCover,
  getLevelMastery,
  getPathPace,
  getTodayPlan,
  isActionComplete,
  loadLearn,
  minutesToday,
  pathBuildStats,
  pathOverallProgress,
  pathWeekIndex,
  promoteBand,
  resetLanguagePaths,
  setPreferredTrack,
  studyQueue,
  studyStreak,
  weekProgress,
  type LearnState,
  type PathExtendMode,
  type TrackId,
} from "@/lib/learn-store";
import { freemiumUnlocked } from "@/lib/freemium";
import { goalsLabel } from "@/lib/path-goals";
import { useI18n } from "@/lib/i18n";

export default function LearnPage() {
  return (
    <RequireAuth>
      {(user) => (
        <AppShell userName={user.name}>
          <Suspense
            fallback={
              <div className="page">
                <h1>Loading…</h1>
              </div>
            }
          >
            <LearnContent plan={user.plan} />
          </Suspense>
        </AppShell>
      )}
    </RequireAuth>
  );
}

function LearnContent({ plan }: { plan: "free" | "pro" }) {
  const { t, lang } = useI18n();
  const params = useSearchParams();
  const [state, setState] = useState<LearnState | null>(null);

  useEffect(() => {
    const qTrack = params.get("track");
    if (qTrack === "jp" || qTrack === "en") setPreferredTrack(qTrack);

    function reload() {
      // loadLearn() hard-wipes JP/EN when LEARN_PATHS_EPOCH bumps
      const s = loadLearn();
      setState(
        s.jp.placementDone || s.en.placementDone
          ? ensureRoadmap(s.preferredTrack)
          : s,
      );
    }
    reload();
    const onVis = () => {
      if (document.visibilityState === "visible") reload();
    };
    window.addEventListener("focus", reload);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("focus", reload);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [params]);

  const track = state?.preferredTrack || "jp";
  const active = state ? (track === "jp" ? state.jp : state.en) : null;
  const due = state ? studyQueue(track, state).length : 0;
  const progress = state ? pathOverallProgress(track, state) : 0;
  const weekIdx = state ? pathWeekIndex(track, state) : 0;
  const inv = active?.roadmap?.inventory;
  const hasPath = Boolean(active?.roadmap && active.pathActive);
  const buildStats = state ? pathBuildStats(track, state) : null;
  const cover = state ? getLevelCover(track, state) : null;
  const mastery = state ? getLevelMastery(track, state) : null;
  const pace = state ? getPathPace(track, state) : null;
  const todayPlan = state ? getTodayPlan(track, state) : null;
  const daily = state ? getDailyStudyProgress(track, state) : null;
  const promote = state ? canPromoteBand(track, state) : { ok: false, next: null, reason: "" };
  const trackLabel = track === "jp" ? t("trackJp") : t("trackEn");
  const otherLabel = track === "jp" ? t("trackEn") : t("trackJp");

  const weekPercents = useMemo(() => {
    if (!state || !active?.roadmap) return [];
    return active.roadmap.weeks.map((w) => ({
      week: w.week,
      title: w.title,
      pct: weekProgress(track, w.week, state),
    }));
  }, [state, active?.roadmap, track]);

  const doneActionIds = useMemo(() => {
    const ids = new Set<string>();
    if (!active?.roadmap || !state) return ids;
    for (const w of active.roadmap.weeks) {
      for (const a of w.actions) {
        if (isActionComplete(active, a, state.reviewsToday)) ids.add(a.id);
      }
    }
    return ids;
  }, [active, state]);

  const actionCredits = useMemo(() => {
    const map: Record<string, number> = {};
    if (!active?.roadmap) return map;
    for (const w of active.roadmap.weeks) {
      for (const a of w.actions) {
        map[a.id] = actionCredit(active, a);
      }
    }
    return map;
  }, [active]);

  if (!state || !active) {
    return (
      <div className="page">
        <h1>{t("loading")}</h1>
      </div>
    );
  }

  function switchTrack(next: TrackId) {
    setPreferredTrack(next);
    setState(ensureRoadmap(next));
  }

  function addToPath(mode: PathExtendMode) {
    const res = extendPath(track, mode);
    setState(ensureRoadmap(track));
    window.alert(res.message);
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
      name: lang === "en" ? "Lessons" : "Bài học",
      desc: active.band
        ? lang === "en"
          ? `Library ~${active.band} · browse & add to path`
          : `Thư viện ~${active.band} · học lẻ / thêm path`
        : lang === "en"
          ? "Packaged vocab · grammar · kanji · mocks"
          : "Gói từ · ngữ pháp · kanji · mock",
      icon: "book",
      href: `/learn/lessons?track=${track}${active.band ? `&band=${active.band}` : ""}`,
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
            ? "CEFR-style drills A1–C2"
            : "CEFR-style drills A1–C2",
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
      href: `/learn/mocks?track=${track}${active.band ? `&band=${encodeURIComponent(active.band)}` : ""}`,
    },
  ];

  const streak = studyStreak(state);
  const todayMins = minutesToday(state);
  const last7 = activityLast7Days(state);

  return (
    <div className="page learn-page">
      <div className="page-head">
        <div>
          <p className="eyebrow">{t("learnEyebrow")}</p>
          <h1>{t("learnTitle")}</h1>
          <p>{t("learnSub")}</p>
        </div>
        <div className="quota">
          {freemiumUnlocked() ? "Dev" : plan === "pro" ? "Pro" : "Free"}
          <br />
          <strong>{freemiumUnlocked() || plan === "pro" ? "JP + EN" : t("onePath")}</strong>
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
              ? active.pathActive
                ? `${t("pathRoadmapApprox")} ~${active.band}`
                : lang === "en"
                  ? `Band ~${active.band} · add lessons when ready`
                  : `Band ~${active.band} · thêm bài khi sẵn sàng`
              : t("pathBeginPlacement")}
          </h2>
          <p>
            {active.roadmap
              ? active.roadmap.summary
              : active.placementDone
                ? lang === "en"
                  ? "Placement saved. Build your path gradually — one lesson, a chapter, or the full level."
                  : "Đã lưu band. Xây lộ trình từ từ — thêm 1 bài, một chương, hoặc cả cấp."
                : t("pathBeginHint")}
          </p>
          <small>
            {t("pathUnofficial")} {track === "jp" ? "JLPT" : "IELTS/CEFR"}
            {inv
              ? ` · ${inv.vocab} · ${inv.grammar}${inv.kanji ? ` · ${inv.kanji} kanji` : ""}`
              : ""}
            {active.pathGoals ? ` · ${goalsLabel(active.pathGoals, track)}` : ""}
          </small>
        </div>
        <div className="path-progress">
          <strong>{active.pathActive ? `${progress}%` : "0%"}</strong>
          <span>
            <i style={{ width: active.pathActive ? `${progress}%` : "0%" }} />
          </span>
          <small>
            {due} {t("reviewsDue")} · streak {streak}d
            {daily
              ? ` · ${daily.touched}/${daily.total} đã mở · mới hôm nay ${daily.newDoneToday}/${daily.newCap}`
              : ""}
          </small>
          {daily ? (
            <small style={{ display: "block", marginTop: 4 }}>{daily.summary}</small>
          ) : null}
          {active.pathActive && active.band ? (
            <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
              {cover ? (
                <small>
                  {lang === "en" ? "Cover" : "Cover"} {cover.primary}:{" "}
                  <strong>{cover.pct}%</strong> ({cover.have}/{cover.total})
                  {lang === "en" ? " · deck full ≠ learned" : " · nạp đủ ≠ đã học"}
                </small>
              ) : null}
              {mastery ? (
                <small>
                  Mastery <strong>{mastery.masteryPct}%</strong> ({mastery.touched}/{mastery.total})
                  {" · "}
                  Stable <strong>{mastery.stablePct}%</strong>
                </small>
              ) : null}
              {active.roadmap?.etaWeeks != null ? (
                <small>
                  ETA mềm ~{active.roadmap.etaWeeks} {lang === "en" ? "wk" : "tuần"}
                  {pace ? ` · ${pace.label}` : ""}
                  {lang === "en"
                    ? " · lessons unlock in sequence (no hard day lock)"
                    : " · bài nối tiếp (không khóa hết ngày)"}
                </small>
              ) : null}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                <Button
                  variant="secondary"
                  onClick={() => {
                    const n = appendBandVocab(track);
                    setState(loadLearn());
                    window.alert(
                      n
                        ? lang === "en"
                          ? `Added ${n} bridge/band cards.`
                          : `Đã nạp thêm ${n} thẻ bridge/band.`
                        : lang === "en"
                          ? "No more unused bridge words."
                          : "Hết từ bridge chưa nạp.",
                    );
                  }}
                >
                  {lang === "en" ? "Add bridge vocab" : "Nạp từ cầu"}
                </Button>
                {cover && cover.missing > 0 ? (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      const res = appendFullPrimaryVocab(track);
                      setState(loadLearn());
                      window.alert(
                        lang === "en"
                          ? `Added ${res.added} primary cards.`
                          : `Đã nạp ${res.added} thẻ primary.`,
                      );
                    }}
                  >
                    {lang === "en" ? "Backfill primary" : "Bù đủ primary"}
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {active.placementDone && buildStats && buildStats.remainingLessons > 0 && buildStats.pathLessonCount === 0 ? (
        <section className="active-path" style={{ marginTop: 12 }}>
          <div>
            <p className="eyebrow">
              {lang === "en" ? "Build path" : "Xây lộ trình"}
            </p>
            <h2>
              {lang === "en"
                ? `${buildStats.remainingLessons} lessons ready · start your path`
                : `${buildStats.remainingLessons} bài sẵn sàng · bắt đầu lộ trình`}
            </h2>
            <p>
              {lang === "en"
                ? "Suggestion covers the whole band (vocab + grammar + skills), interleaved. Each path day = one lesson; pass needs ≥70% Good/Easy."
                : "Gợi ý phủ cả cấp (từ + ngữ pháp + skill), xen kẽ. Mỗi ngày = một bài; pass cần ≥70% Good/Easy."}
            </p>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignSelf: "center" }}>
            <Button
              onClick={() => {
                const res = addSuggestedPath(track);
                setState(ensureRoadmap(track));
                window.alert(res.message);
              }}
            >
              {lang === "en" ? "Use suggestion" : "Dùng gợi ý"}
            </Button>
            <Link href={`/learn/lessons?track=${track}&band=${active.band || ""}`}>
              <Button variant="secondary">
                {lang === "en" ? "Browse lessons" : "Thư viện bài"}
              </Button>
            </Link>
            <Button variant="ghost" onClick={() => addToPath("full")}>
              {lang === "en" ? "Full level" : "Cả cấp"}
            </Button>
          </div>
        </section>
      ) : null}

      {active.placementDone &&
      buildStats &&
      buildStats.pathLessonCount > 0 &&
      buildStats.remainingLessons > 0 ? (
        <p
          style={{
            marginTop: 10,
            marginBottom: 0,
            fontSize: 13,
            color: "var(--muted)",
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            alignItems: "center",
          }}
        >
          <span>
            {lang === "en"
              ? `${buildStats.pathLessonCount} on path · ${buildStats.remainingLessons} left in library`
              : `${buildStats.pathLessonCount} bài trên path · còn ${buildStats.remainingLessons} trong thư viện`}
          </span>
          <Link href={`/learn/lessons?track=${track}&band=${active.band || ""}`}>
            {lang === "en" ? "Add more" : "Thêm bài"}
          </Link>
          <button
            type="button"
            className="text-button"
            onClick={() => addToPath("lesson")}
          >
            {lang === "en" ? "+1 vocab" : "+1 bài từ"}
          </button>
        </p>
      ) : null}

      {promote.ok && promote.next ? (
        <section
          className="active-path"
          style={{ marginTop: 12, borderColor: "var(--accent)" }}
        >
          <div>
            <p className="eyebrow">{lang === "en" ? "Level up" : "Nâng cấp"}</p>
            <h2>
              {lang === "en" ? `Ready for ~${promote.next}` : `Sẵn sàng lên ~${promote.next}`}
            </h2>
            <p>{promote.reason}</p>
          </div>
          <Button
            onClick={() => {
              const res = promoteBand(track);
              setState(ensureRoadmap(track));
              window.alert(res.message);
            }}
          >
            {lang === "en" ? `Promote to ${promote.next}` : `Nâng band → ${promote.next}`}
          </Button>
        </section>
      ) : null}

      {hasPath ? (
        <LearnStats
          last7={last7}
          weekPercents={weekPercents}
          streak={streak}
          minutesToday={todayMins}
        />
      ) : null}

      {hasPath && active.roadmap ? (
        <PathTimeline
          plan={active.roadmap}
          track={track}
          progress={progress}
          weekIndex={weekIdx}
          weekPercents={weekPercents.map((w) => w.pct)}
          doneActionIds={doneActionIds}
          actionCredits={actionCredits}
          todayPlan={todayPlan}
        />
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
            {freemiumUnlocked()
              ? " JP + EN đều mở (gói Free/Pro tạm tắt)."
              : plan === "free"
                ? t("pathFreeOne")
                : t("pathProBoth")}
          </p>
        </div>
        <button type="button" onClick={() => switchTrack(track === "jp" ? "en" : "jp")}>
          {t("pathSwitch")}
        </button>
      </section>

      {(state.jp.pathActive || state.en.pathActive || state.jp.placementDone || state.en.placementDone) ? (
        <p style={{ marginTop: 24 }}>
          <Button
            variant="ghost"
            onClick={() => {
              if (
                !window.confirm(
                  lang === "en"
                    ? "Delete JP and EN paths (cards, roadmap, evidence)?"
                    : "Xóa hết lộ trình JP và EN (thẻ, roadmap, evidence)?",
                )
              ) {
                return;
              }
              setState(resetLanguagePaths());
            }}
          >
            {lang === "en" ? "Delete JP + EN paths" : "Xóa lộ trình JP + EN"}
          </Button>
        </p>
      ) : null}
    </div>
  );
}
