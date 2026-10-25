"use client";

import Link from "next/link";
import type { RoadmapPlan } from "@/lib/roadmap";

type Props = {
  plan: RoadmapPlan;
  progress: number;
};

export function PathTimeline({ plan, progress }: Props) {
  const weeks = plan.weeks;
  const activeIdx = Math.min(
    weeks.length - 1,
    Math.max(0, Math.floor((progress / 100) * weeks.length)),
  );

  return (
    <section className="path-timeline" aria-label="Bản đồ lộ trình học">
      <div className="path-timeline-head">
        <div>
          <p className="eyebrow">Lộ trình học</p>
          <h3>Tiến trình {plan.band}</h3>
        </div>
        <div className="path-timeline-meta">
          <strong>
            Tuần {activeIdx + 1}/{weeks.length}
          </strong>
          <span>{progress}% SRS đã chạm</span>
        </div>
      </div>

      <ol className="path-steps">
        {weeks.map((w, i) => {
          const done = i < activeIdx;
          const current = i === activeIdx;
          const primary = w.actions[0];
          return (
            <li
              key={w.week}
              className={`path-step ${done ? "done" : ""} ${current ? "current" : ""}`}
            >
              <div className="path-step-rail" aria-hidden>
                <span className="path-dot">{done ? "✓" : w.week}</span>
              </div>
              <div className="path-step-body">
                <div className="path-step-top">
                  <small>Tuần {w.week}</small>
                  {current ? <span className="pill-live">Đang học</span> : null}
                  {done ? <span className="pill-done">Đã qua</span> : null}
                </div>
                <strong>{w.title}</strong>
                <p>{w.goal}</p>
                {w.samples.length > 0 ? (
                  <p className="path-samples">{w.samples.slice(0, 5).join(" · ")}</p>
                ) : null}
                <div className="path-step-actions">
                  {w.actions.slice(0, 3).map((a) => (
                    <Link key={a.id} href={a.href} className="path-action-link">
                      {a.title}
                      {typeof a.count === "number" ? ` · ${a.count}` : ""}
                    </Link>
                  ))}
                  {primary && current ? (
                    <Link href={primary.href} className="button primary path-cta">
                      Tiếp tục tuần này
                    </Link>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
