"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Icon, type IconName } from "@/components/Icon";
import { RequireAuth } from "@/components/RequireAuth";
import {
  dueCards,
  loadLearn,
  setPreferredTrack,
  type LearnState,
  type TrackId,
} from "@/lib/learn-store";

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
  const [state, setState] = useState<LearnState | null>(null);

  useEffect(() => {
    setState(loadLearn());
  }, []);

  if (!state) {
    return (
      <div className="page">
        <h1>Loading…</h1>
      </div>
    );
  }

  const track = state.preferredTrack;
  const active = track === "jp" ? state.jp : state.en;
  const due = dueCards(track, state).length;

  function switchTrack(next: TrackId) {
    setState(setPreferredTrack(next));
  }

  const actions: { name: string; desc: string; icon: IconName; href: string }[] = [
    {
      name: "Placement",
      desc: active.placementDone
        ? `Approx. ${active.band} (retake anytime)`
        : "Check your approximate level",
      icon: "layers",
      href: `/learn/placement?track=${track}`,
    },
    {
      name: "Roadmap",
      desc: active.placementDone ? "See what comes next" : "Complete placement first",
      icon: "road",
      href: `/learn/roadmap?track=${track}`,
    },
    {
      name: "Reviews",
      desc: active.pathActive ? `${due} cards due` : "Seeded after placement",
      icon: "book",
      href: `/learn/review?track=${track}`,
    },
    {
      name: "Grammar",
      desc: "Unofficial pattern drills",
      icon: "layers",
      href: `/learn/grammar?track=${track}`,
    },
    ...(track === "jp"
      ? [
          {
            name: "Kanji",
            desc: "Kanji N5–N2 (OpenJLPT)",
            icon: "book" as IconName,
            href: "/learn/kanji",
          },
        ]
      : []),
    {
      name: "Dictionary",
      desc: track === "jp" ? "OpenJLPT N5–N1" : "CEFR-J A1/A2 (VI gloss)",
      icon: "search",
      href: `/learn/dictionary?track=${track}`,
    },
    {
      name: "Mocks",
      desc: "Timed section practice",
      icon: "road",
      href: `/learn/mocks?track=${track}`,
    },
  ];

  return (
    <div className="page learn-page">
      <div className="page-head">
        <div>
          <p className="eyebrow">Learn</p>
          <h1>Your language path</h1>
          <p>Steady progress, without the noise.</p>
        </div>
        <div className="quota">
          {plan === "pro" ? "Pro plan" : "Free plan"}
          <br />
          <strong>
            {plan === "pro" ? "JP + EN allowed" : "1 active path on Free"}
          </strong>
        </div>
      </div>

      <div className="segmented" style={{ marginBottom: 24 }}>
        <button
          type="button"
          className={track === "jp" ? "active" : ""}
          onClick={() => switchTrack("jp")}
        >
          Japanese
        </button>
        <button
          type="button"
          className={track === "en" ? "active" : ""}
          onClick={() => switchTrack("en")}
        >
          English
        </button>
      </div>

      <section className="active-path">
        <div>
          <span className="language-mark">{track === "jp" ? "日" : "EN"}</span>
          <p className="eyebrow">
            {active.pathActive ? "Active path" : "Path"} · {track === "jp" ? "Japanese" : "English"}
          </p>
          <h2>
            {active.placementDone
              ? `Approx. ${active.band} path`
              : "Start with placement"}
          </h2>
          <p>
            {active.placementDone
              ? track === "jp"
                ? "Vocab SRS, grammar drills, and unofficial mocks — keep the desk nearby."
                : "CEFR-J vocab SRS, grammar drills, and IELTS-style unofficial practice."
              : "Take a short unofficial placement to generate your roadmap and SRS deck."}
          </p>
          <small>
            Unofficial estimate · not certified {track === "jp" ? "JLPT" : "IELTS/CEFR"}
            {plan === "free" && active.pathActive
              ? " · Activating the other path replaces this one on Free"
              : ""}
          </small>
        </div>
        <div className="path-progress">
          <strong>{active.pathActive ? "34%" : "0%"}</strong>
          <span>
            <i style={{ width: active.pathActive ? "34%" : "0%" }} />
          </span>
          <small>{due} reviews due</small>
        </div>
      </section>

      <div className="action-grid">
        {actions.map((a) => (
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
          <p className="eyebrow">{track === "jp" ? "English path" : "Japanese path"}</p>
          <h3>{track === "jp" ? (state.en.pathActive ? `Approx. ${state.en.band}` : "Also available") : state.jp.pathActive ? `Approx. ${state.jp.band}` : "Also available"}</h3>
          <p>
            Switch tabs above to study the other track.
            {plan === "free" ? " Free keeps one path active at a time." : " Pro can keep both active."}
          </p>
        </div>
        <button type="button" onClick={() => switchTrack(track === "jp" ? "en" : "jp")}>
          Switch
        </button>
      </section>
    </div>
  );
}
