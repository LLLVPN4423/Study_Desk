"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import {
  isTourDone,
  requestStartTour,
  setTourDone,
  TOUR_EVENT,
  tourSteps,
} from "@/lib/help-content";
import { useI18n } from "@/lib/i18n";

export function ProductTour() {
  const { lang } = useI18n();
  const router = useRouter();
  const steps = tourSteps(lang);
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    function onStart() {
      setIndex(0);
      setOpen(true);
    }
    window.addEventListener(TOUR_EVENT, onStart);
    // First visit after auth
    if (!isTourDone()) {
      const t = window.setTimeout(() => setOpen(true), 600);
      return () => {
        window.clearTimeout(t);
        window.removeEventListener(TOUR_EVENT, onStart);
      };
    }
    return () => window.removeEventListener(TOUR_EVENT, onStart);
  }, []);

  useEffect(() => {
    if (!open) {
      document.querySelectorAll("[data-tour].tour-hl").forEach((el) => {
        el.classList.remove("tour-hl");
      });
      return;
    }
    const step = steps[index];
    document.querySelectorAll("[data-tour].tour-hl").forEach((el) => {
      el.classList.remove("tour-hl");
    });
    if (step?.target) {
      document.querySelector(`[data-tour="${step.target}"]`)?.classList.add("tour-hl");
    }
  }, [open, index, steps]);

  if (!open) return null;

  const step = steps[index];
  const last = index >= steps.length - 1;

  function finish() {
    setTourDone(true);
    setOpen(false);
  }

  function next() {
    if (last) {
      finish();
      return;
    }
    const n = index + 1;
    setIndex(n);
    const href = steps[n]?.href;
    if (href && typeof window !== "undefined" && !window.location.pathname.startsWith(href)) {
      // Stay on current page for tour UX; only suggest via button
    }
  }

  return (
    <div className="product-tour" role="dialog" aria-modal="true" aria-label={step.title}>
      <div className="product-tour-backdrop" onClick={finish} />
      <div className="product-tour-card">
        <p className="eyebrow">
          {index + 1} / {steps.length}
        </p>
        <h2>{step.title}</h2>
        <p>{step.body}</p>
        <div className="product-tour-actions">
          <button type="button" className="text-button" onClick={finish}>
            {lang === "en" ? "Skip" : "Bỏ qua"}
          </button>
          <div className="product-tour-nav">
            {step.href ? (
              <Button
                variant="secondary"
                onClick={() => {
                  router.push(step.href!);
                }}
              >
                {lang === "en" ? "Open" : "Mở trang"}
              </Button>
            ) : null}
            <Button onClick={next}>
              {last ? (lang === "en" ? "Done" : "Xong") : lang === "en" ? "Next" : "Tiếp"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export { requestStartTour };
