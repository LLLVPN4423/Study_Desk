"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { JapanRegionMap } from "@/components/JapanRegionMap";
import { RequireAuth } from "@/components/RequireAuth";
import heritage from "@/data/japan-heritage-seed.json";
import {
  PREF_VI,
  REGIONS,
  itemInRegion,
  prefsToVi,
  type RegionId,
} from "@/data/japan-regions";
import { useI18n } from "@/lib/i18n";
import { addManualCard, loadLearn } from "@/lib/learn-store";

type Item = {
  id: number;
  name: string;
  subname: string;
  areas: string;
  url: string;
  titleVi?: string;
  descVi?: string;
};

export default function CulturePage() {
  return (
    <RequireAuth>
      {(user) => (
        <AppShell userName={user.name}>
          <Suspense fallback={<p className="page">…</p>}>
            <CultureContent />
          </Suspense>
        </AppShell>
      )}
    </RequireAuth>
  );
}

function CultureCard({
  i,
  highlight,
  onAdded,
}: {
  i: Item;
  highlight?: boolean;
  onAdded?: (msg: string) => void;
}) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);

  function addVocabCard() {
    setBusy(true);
    try {
      const learn = loadLearn();
      const track = learn.preferredTrack === "en" ? "en" : "jp";
      const meanings = [i.titleVi, i.descVi, i.subname]
        .map((s) => (typeof s === "string" ? s.trim() : ""))
        .filter(Boolean);
      const uniqueMeanings = [...new Set(meanings)];
      if (!uniqueMeanings.length) {
        onAdded?.(t("cultureCardNeedMeaning"));
        return;
      }
      const result = addManualCard({
        track,
        word: i.name,
        meanings: uniqueMeanings.slice(0, 3),
        origin: "culture",
        cultureItemId: i.id,
        sourceAnchor: {
          kind: "notes",
          quote: (i.titleVi || i.name).slice(0, 200),
        },
        rejectDuplicate: true,
      });
      if (!result.ok) {
        onAdded?.(result.reason);
        return;
      }
      onAdded?.(t("cultureCardAdded"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <article
      className={`culture-card${highlight ? " is-focus-item" : ""}`}
      id={`culture-item-${i.id}`}
      data-culture-id={i.id}
    >
      <p className="eyebrow">#{i.id}</p>
      <h3>{i.titleVi || i.name}</h3>
      <p className="culture-ja" lang="ja">
        {i.name}
      </p>
      {i.descVi ? <p className="culture-desc">{i.descVi}</p> : null}
      {i.subname ? <p className="culture-sub">{i.subname}</p> : null}
      <small>
        {prefsToVi(i.areas)}
        <span className="culture-areas-ja" lang="ja">
          {" "}
          · {i.areas}
        </span>
      </small>
      <div className="culture-card-actions">
        <a href={i.url} target="_blank" rel="noreferrer" className="text-button">
          {t("officialPage")}
        </a>
        <button type="button" className="text-button" disabled={busy} onClick={addVocabCard}>
          {t("cultureAddCard")}
        </button>
      </div>
    </article>
  );
}

function CultureContent() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const items = heritage as Item[];
  const [q, setQ] = useState("");
  const [region, setRegion] = useState<RegionId | "all">("all");
  const [banner, setBanner] = useState<string | null>(null);
  const focused = region !== "all";
  const focusItemId = Number(searchParams.get("item") || "");

  useEffect(() => {
    if (!Number.isFinite(focusItemId) || focusItemId < 1) return;
    const el = document.getElementById(`culture-item-${focusItemId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [focusItemId, region, q]);

  const counts = useMemo(() => {
    const c: Partial<Record<RegionId, number>> = {};
    for (const r of REGIONS) {
      c[r.id] = items.filter((i) => itemInRegion(i.areas, r.id)).length;
    }
    return c;
  }, [items]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return items.filter((i) => {
      if (region !== "all" && !itemInRegion(i.areas, region)) return false;
      if (!s) return true;
      const hay = [
        i.name,
        i.subname,
        i.areas,
        i.titleVi || "",
        i.descVi || "",
        prefsToVi(i.areas),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(s);
    });
  }, [items, q, region]);

  const active = focused ? REGIONS.find((r) => r.id === region) : null;
  const regionLabel = active?.nameVi || "Toàn quốc";

  const search = (
    <label className="culture-search">
      Tìm theo tên VI / JP hoặc tỉnh
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="vd. trà, Kamakura, Kyoto, tơ lụa…"
      />
    </label>
  );

  const filterStatus = (
    <p className="culture-filter-status">
      Đang xem: <strong>{regionLabel}</strong>
      {q.trim() ? (
        <>
          {" "}
          · lọc “{q.trim()}”
        </>
      ) : null}
      {" · "}
      {filtered.length} câu chuyện
    </p>
  );

  const cards = (
    <>
      <div className="culture-grid">
        {filtered.map((i) => (
          <CultureCard
            key={i.id}
            i={i}
            highlight={i.id === focusItemId}
            onAdded={(msg) => setBanner(msg)}
          />
        ))}
      </div>
      {filtered.length === 0 ? (
        <p className="culture-empty">
          Không có câu chuyện nào khớp bộ lọc. Thử vùng khác hoặc xóa ô tìm.
        </p>
      ) : null}
    </>
  );

  return (
    <div className={`page culture-page ${focused ? "is-focused" : ""}`}>
      <div className="page-head">
        <div>
          <p className="eyebrow">{t("cultureEyebrow")}</p>
          <h1>{t("cultureTitle")}</h1>
          <p>{t("cultureSub")}</p>
        </div>
        <div className="quota">
          {t("cultureFree")}
          <br />
          <strong>
            {filtered.length}/{items.length} {t("cultureStories")}
          </strong>
        </div>
      </div>

      {banner ? (
        <p className="culture-banner" role="status">
          {banner}{" "}
          <Link href="/learn/review" className="text-button">
            {t("cultureOpenReview")}
          </Link>
        </p>
      ) : null}

      <div className={`culture-stage ${focused ? "focused" : "overview"}`}>
        <div className="culture-map-pane">
          <JapanRegionMap
            selected={region}
            onSelect={setRegion}
            counts={counts}
            compact={focused}
          />
        </div>

        {focused && active ? (
          <aside className="culture-side-pane">
            <div className="culture-region-hero">
              <p className="eyebrow" lang="ja">
                {active.nameJa}
              </p>
              <h2>{active.nameVi}</h2>
              <p>{active.blurbVi}</p>
              <span className="culture-region-meta">
                {counts[active.id] ?? 0} di sản · {active.prefectures.length} tỉnh/thành
              </span>
              <div className="culture-pref-chips">
                {active.prefectures.map((p) => (
                  <span key={p}>{PREF_VI[p] || p}</span>
                ))}
              </div>
              <button type="button" className="text-button" onClick={() => setRegion("all")}>
                ← Về toàn quốc
              </button>
            </div>
            <div className="culture-side-tools">
              {search}
              {filterStatus}
            </div>
            <div className="culture-side-scroll">{cards}</div>
          </aside>
        ) : null}
      </div>

      {!focused ? (
        <div className="culture-below">
          {search}
          {filterStatus}
          {cards}
        </div>
      ) : null}

      <p className="culture-attrib">
        Dataset từ code4fukui/japan-heritage (MIT). Không liên kết với Cục Văn hóa Nhật. Study Desk
        giữ bản tĩnh để duyệt offline không tốn phí.
      </p>
      <p style={{ marginTop: 8 }}>
        <Link href="/learn" className="text-button">
          ← Về học tập
        </Link>
      </p>
    </div>
  );
}
