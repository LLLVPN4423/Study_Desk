"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import heritage from "@/data/japan-heritage-seed.json";

type Item = {
  id: number;
  name: string;
  subname: string;
  areas: string;
  url: string;
};

export default function CulturePage() {
  return (
    <RequireAuth>
      {(user) => (
        <AppShell userName={user.name}>
          <CultureContent />
        </AppShell>
      )}
    </RequireAuth>
  );
}

function CultureContent() {
  const items = heritage as Item[];
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter(
      (i) =>
        i.name.toLowerCase().includes(s) ||
        i.subname.toLowerCase().includes(s) ||
        i.areas.toLowerCase().includes(s),
    );
  }, [items, q]);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">Japan culture</p>
          <h1>Heritage stories</h1>
          <p>Open data list — browse locally, open official pages when online.</p>
        </div>
        <div className="quota">
          Free · offline seed
          <br />
          <strong>{items.length} stories</strong>
        </div>
      </div>
      <label>
        Filter by name or prefecture
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="e.g. 京都, 絹, 城…"
        />
      </label>
      <div className="culture-grid">
        {filtered.map((i) => (
          <article key={i.id} className="culture-card">
            <p className="eyebrow">#{i.id}</p>
            <h3>{i.name}</h3>
            {i.subname ? <p className="culture-sub">{i.subname}</p> : null}
            <small>{i.areas}</small>
            <a href={i.url} target="_blank" rel="noreferrer" className="text-button">
              Official story →
            </a>
          </article>
        ))}
      </div>
      <p style={{ marginTop: 28, fontSize: 11, color: "var(--muted)", maxWidth: 560 }}>
        Dataset from code4fukui/japan-heritage (MIT). Not affiliated with the Agency for Cultural
        Affairs. Study Desk keeps a static subset for zero-cost offline browsing.
      </p>
      <p style={{ marginTop: 8 }}>
        <Link href="/learn" className="text-button">
          ← Back to learn
        </Link>
      </p>
    </div>
  );
}
