"use client";

import type { DayActivity } from "@/lib/learn-store";

type Props = {
  last7: DayActivity[];
  weekPercents: { week: number; title: string; pct: number }[];
  streak: number;
  minutesToday: number;
};

export function LearnStats({ last7, weekPercents, streak, minutesToday }: Props) {
  const maxMin = Math.max(30, ...last7.map((d) => d.minutes));

  return (
    <section className="learn-stats" aria-label="Thống kê học">
      <div className="learn-stats-chips">
        <span className="learn-stat-chip">
          <strong>{streak}</strong> ngày streak
        </span>
        <span className="learn-stat-chip">
          <strong>{minutesToday}</strong> phút hôm nay
        </span>
      </div>

      <div className="learn-stats-grid">
        <div className="learn-stat-card">
          <p className="eyebrow">Phút học · 7 ngày</p>
          <div className="learn-bars" role="img" aria-label="Biểu đồ phút 7 ngày">
            {last7.map((d) => {
              const h = maxMin ? Math.round((d.minutes / maxMin) * 100) : 0;
              const label = d.day.slice(5);
              return (
                <div key={d.day} className="learn-bar">
                  <i style={{ height: `${Math.max(h, d.minutes > 0 ? 8 : 2)}%` }} title={`${d.minutes}p`} />
                  <small>{label}</small>
                </div>
              );
            })}
          </div>
        </div>

        <div className="learn-stat-card">
          <p className="eyebrow">Tiến độ từng chương</p>
          <div className="learn-week-bars">
            {weekPercents.length === 0 ? (
              <p className="empty-hint">Chưa có lộ trình</p>
            ) : (
              weekPercents.map((w) => (
                <div key={w.week} className="learn-week-row">
                  <span>T{w.week}</span>
                  <div className="learn-week-track" title={w.title}>
                    <i style={{ width: `${w.pct}%` }} />
                  </div>
                  <strong>{w.pct}%</strong>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
