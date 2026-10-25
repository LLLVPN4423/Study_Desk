"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import {
  MAX_SCHEDULE_EVENTS,
  type DeskScheduleEvent,
} from "@/lib/desk-store";
import { useI18n } from "@/lib/i18n";

type Props = {
  title: string;
  events: DeskScheduleEvent[];
  onChange: (next: { scheduleTitle: string; schedule: DeskScheduleEvent[] }) => void;
  /** chip = nút nhỏ + popup (Studio); panel = widget đầy đủ (Desk overview) */
  variant?: "panel" | "chip";
};

function pad2(n: number) {
  return n.toString().padStart(2, "0");
}

function formatRow(ev: DeskScheduleEvent) {
  const [, m, d] = (ev.date || "").split("-");
  const dateLabel = d && m ? `${d}/${m}` : "--/--";
  const time = ev.time || "--:--";
  return { when: `${dateLabel} - ${time}`, text: ev.title || ev.label || "—" };
}

function blankEvent(label: string): DeskScheduleEvent {
  const now = new Date();
  return {
    id: crypto.randomUUID(),
    label,
    title: "",
    date: `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`,
    time: "08:00",
  };
}

export function DeskSchedule({ title, events, onChange, variant = "panel" }: Props) {
  const { t } = useI18n();
  const [popOpen, setPopOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState(title);
  const [draft, setDraft] = useState<DeskScheduleEvent[]>(events);
  const wrapRef = useRef<HTMLDivElement>(null);

  const sorted = useMemo(() => {
    return [...events].sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
  }, [events]);

  useEffect(() => {
    if (!popOpen) return;
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setPopOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [popOpen]);

  function openSettings() {
    setDraftTitle(title);
    setDraft(events.map((e) => ({ ...e })));
    setSettingsOpen(true);
  }

  function save() {
    const fallback = t("scheduleEvent");
    const cleaned = draft
      .map((e) => ({
        ...e,
        label: e.label.trim() || e.title.trim() || fallback,
        title: e.title.trim() || e.label.trim() || fallback,
        time: e.time || "08:00",
        date: e.date || blankEvent(t("scheduleNewEvent")).date,
      }))
      .slice(0, MAX_SCHEDULE_EVENTS);
    onChange({
      scheduleTitle: draftTitle.trim() || t("scheduleDefaultTitle"),
      schedule: cleaned,
    });
    setSettingsOpen(false);
  }

  const settingsModal = settingsOpen ? (
    <div className="schedule-modal-backdrop" role="presentation" onClick={() => setSettingsOpen(false)}>
      <div
        className="schedule-modal"
        role="dialog"
        aria-label={t("scheduleSettings")}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="schedule-modal-head">
          <strong>{t("scheduleSettings")}</strong>
          <span>
            {draft.length}/{MAX_SCHEDULE_EVENTS}
          </span>
          <button type="button" className="music-box-x" onClick={() => setSettingsOpen(false)}>
            ×
          </button>
        </header>
        <label className="schedule-modal-title">
          {t("scheduleTitleLabel")}
          <input
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            placeholder={t("scheduleTitlePlaceholder")}
          />
        </label>
        <div className="schedule-modal-list">
          {draft.map((ev, i) => (
            <article key={ev.id} className="schedule-event-edit">
              <div className="schedule-event-edit-head">
                <input
                  className="schedule-event-label"
                  value={ev.label}
                  onChange={(e) =>
                    setDraft((rows) =>
                      rows.map((r, idx) => (idx === i ? { ...r, label: e.target.value } : r)),
                    )
                  }
                  placeholder={t("scheduleLabel")}
                />
                <button
                  type="button"
                  className="icon-ghost danger"
                  title={t("delete")}
                  onClick={() => setDraft((rows) => rows.filter((_, idx) => idx !== i))}
                >
                  <Icon name="trash" size={14} />
                </button>
              </div>
              <div className="schedule-event-fields">
                <label>
                  {t("scheduleTime")}
                  <input
                    type="time"
                    value={ev.time}
                    onChange={(e) =>
                      setDraft((rows) =>
                        rows.map((r, idx) => (idx === i ? { ...r, time: e.target.value } : r)),
                      )
                    }
                  />
                </label>
                <label>
                  {t("scheduleDate")}
                  <input
                    type="date"
                    value={ev.date}
                    onChange={(e) =>
                      setDraft((rows) =>
                        rows.map((r, idx) => (idx === i ? { ...r, date: e.target.value } : r)),
                      )
                    }
                  />
                </label>
                <label className="grow">
                  {t("scheduleContent")}
                  <input
                    value={ev.title}
                    onChange={(e) =>
                      setDraft((rows) =>
                        rows.map((r, idx) => (idx === i ? { ...r, title: e.target.value } : r)),
                      )
                    }
                    placeholder={t("scheduleContentPlaceholder")}
                  />
                </label>
              </div>
            </article>
          ))}
        </div>
        <div className="schedule-modal-foot">
          <button
            type="button"
            className="schedule-add"
            disabled={draft.length >= MAX_SCHEDULE_EVENTS}
            onClick={() => setDraft((rows) => [...rows, blankEvent(t("scheduleNewEvent"))])}
          >
            + {t("scheduleAdd")} ({draft.length}/{MAX_SCHEDULE_EVENTS})
          </button>
          <Button onClick={save}>{t("scheduleSave")}</Button>
        </div>
      </div>
    </div>
  ) : null;

  const listBody = (
    <>
      <div className="schedule-box-sub">
        <strong>{title || t("scheduleDefaultTitle")}</strong>
        <button type="button" className="icon-ghost" title={t("edit")} onClick={openSettings}>
          <Icon name="edit" size={14} />
        </button>
      </div>
      {sorted.length === 0 ? (
        <p className="schedule-empty">{t("scheduleEmpty")}</p>
      ) : (
        <ul className="schedule-list">
          {sorted.map((ev) => {
            const row = formatRow(ev);
            return (
              <li key={ev.id}>
                <span className="schedule-when">{row.when}</span>
                <span className="schedule-text">{row.text}</span>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );

  if (variant === "chip") {
    return (
      <div className="studio-util-wrap" ref={wrapRef}>
        <button
          type="button"
          className={`studio-util-chip ${popOpen ? "active" : ""} ${events.length ? "has-data" : ""}`}
          title={t("schedule")}
          aria-expanded={popOpen}
          onClick={() => setPopOpen((v) => !v)}
        >
          <Icon name="layers" size={16} />
          {events.length ? <i className="studio-util-badge">{events.length}</i> : null}
        </button>
        {popOpen ? (
          <div className="studio-util-pop schedule-box schedule-pop">
            <header className="schedule-box-head">
              <span>{t("schedule")}</span>
              <button type="button" className="music-box-x" onClick={() => setPopOpen(false)}>
                ×
              </button>
            </header>
            <div className="schedule-box-body">{listBody}</div>
          </div>
        ) : null}
        {settingsModal}
      </div>
    );
  }

  return (
    <>
      <section className="schedule-box">
        <header className="schedule-box-head">
          <span>{t("schedule")}</span>
          <div className="schedule-box-actions">
            <button type="button" className="icon-ghost" title={t("scheduleSettings")} onClick={openSettings}>
              <Icon name="layers" size={16} />
            </button>
          </div>
        </header>
        <div className="schedule-box-body">{listBody}</div>
      </section>
      {settingsModal}
    </>
  );
}
