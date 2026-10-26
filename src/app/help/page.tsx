"use client";

import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { requestStartTour } from "@/components/ProductTour";
import { RequireAuth } from "@/components/RequireAuth";
import { helpSections, setTourDone } from "@/lib/help-content";
import { useI18n } from "@/lib/i18n";

export default function HelpPage() {
  return (
    <RequireAuth>
      {(user) => (
        <AppShell userName={user.name}>
          <HelpContent />
        </AppShell>
      )}
    </RequireAuth>
  );
}

function HelpContent() {
  const { lang } = useI18n();
  const sections = helpSections(lang);
  const en = lang === "en";

  return (
    <div className="page help-page">
      <div className="page-head">
        <div>
          <p className="eyebrow">{en ? "Guide" : "Hướng dẫn"}</p>
          <h1>{en ? "How to use Study Desk" : "Cách dùng Study Desk"}</h1>
          <p>
            {en
              ? "Full walkthrough of Desk, Learn, Culture, Rooms, and Settings. Progress tracking runs automatically while you study."
              : "Hướng dẫn đầy đủ Bàn học, Học, Văn hóa, Phòng học và Cài đặt. Theo dõi tiến độ chạy tự động khi bạn học thật."}
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={() => {
            setTourDone(false);
            requestStartTour();
          }}
        >
          {en ? "Replay short tour" : "Xem lại tour ngắn"}
        </Button>
      </div>

      <nav className="help-toc" aria-label={en ? "Contents" : "Mục lục"}>
        {sections.map((s) => (
          <a key={s.id} href={`#${s.id}`}>
            {s.title}
          </a>
        ))}
      </nav>

      <div className="help-sections">
        {sections.map((s) => (
          <article key={s.id} id={s.id} className="help-section">
            <div className="help-section-head">
              <h2>{s.title}</h2>
              {s.href ? (
                <Link href={s.href} className="text-button">
                  {en ? "Open" : "Mở"} →
                </Link>
              ) : null}
            </div>
            {s.paragraphs.map((p) => (
              <p key={p.slice(0, 24)}>{p}</p>
            ))}
            {s.bullets.length > 0 ? (
              <ul>
                {s.bullets.map((b) => (
                  <li key={b.slice(0, 40)}>{b}</li>
                ))}
              </ul>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  );
}
