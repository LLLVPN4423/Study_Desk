"use client";

/** Browser-only Web Speech — free, no API keys. */

export function canSpeak() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function canListen() {
  return (
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window)
  );
}

export function speak(text: string, lang = "ja-JP") {
  if (!canSpeak() || !text.trim()) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  u.rate = 0.95;
  window.speechSynthesis.speak(u);
}

export function stopSpeaking() {
  if (canSpeak()) window.speechSynthesis.cancel();
}

type Recog = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((ev: { results: { [i: number]: { [j: number]: { transcript: string } } } }) => void) | null;
  onerror: ((ev: { error: string }) => void) | null;
  onend: (() => void) | null;
};

export function listenOnce(
  lang: "ja-JP" | "en-US",
  onText: (text: string) => void,
  onError?: (msg: string) => void,
) {
  if (!canListen()) {
    onError?.("Speech recognition not supported in this browser.");
    return () => undefined;
  }
  const SR =
    (window as unknown as { SpeechRecognition?: new () => Recog }).SpeechRecognition ||
    (window as unknown as { webkitSpeechRecognition?: new () => Recog }).webkitSpeechRecognition;
  if (!SR) {
    onError?.("Speech recognition unavailable.");
    return () => undefined;
  }
  const recog = new SR();
  recog.lang = lang;
  recog.interimResults = false;
  recog.continuous = false;
  recog.onresult = (ev) => {
    const t = ev.results[0]?.[0]?.transcript || "";
    onText(t);
  };
  recog.onerror = (ev) => onError?.(ev.error || "recognition error");
  recog.onend = () => undefined;
  recog.start();
  return () => recog.stop();
}
