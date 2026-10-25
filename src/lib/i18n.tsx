"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Lang = "vi" | "en";

const STORAGE_KEY = "studydesk.lang";

const dict = {
  vi: {
    navDesk: "Bàn học",
    navLearn: "Học",
    navCulture: "Văn hóa",
    navSettings: "Cài đặt",
    navRooms: "Phòng học",
    landingEyebrow: "Không gian học tập bình tĩnh",
    landingHeadline: "Một bàn học. Lộ trình rõ. Tiếng Nhật & Anh đi cùng bạn.",
    landingBody:
      "Giữ file, task, focus và luyện ngôn ngữ trong một chỗ — từ thẻ kanji đầu tiên đến mọi path phía trước.",
    startFree: "Bắt đầu miễn phí",
    signIn: "Đăng nhập",
    unofficial: "Luyện không chính thức — không liên kết JLPT/IELTS",
    learnTitle: "Lộ trình ngôn ngữ",
    learnSub: "Tiến đều, không ồn ào.",
    freePlan: "Gói Free",
    onePath: "1 path đang học trên Free",
    deskGreeting: "Chào bạn",
    files: "Tệp",
    tasks: "Việc cần làm",
    focus: "Tập trung",
    theme: "Giao diện bàn",
    exportBackup: "Xuất bản sao",
    importBackup: "Nhập bản sao",
    hearWord: "Nghe từ (TTS miễn phí)",
    cultureTitle: "Câu chuyện di sản",
    cultureSub: "Dữ liệu mở — xem offline, mở trang chính thức khi online.",
    roomsTitle: "Phòng học",
    roomsSub: "LiveKit (tuỳ chọn, free tier) hoặc dán link Meet/Zoom — không bắt buộc trả phí.",
  },
  en: {
    navDesk: "Desk",
    navLearn: "Learn",
    navCulture: "Culture",
    navSettings: "Settings",
    navRooms: "Rooms",
    landingEyebrow: "A calm place for serious study",
    landingHeadline: "One desk. Clear paths. Language study that stays with you.",
    landingBody:
      "Keep files, tasks, focus sessions, and language practice together—from your first review onward.",
    startFree: "Start free",
    signIn: "Sign in",
    unofficial: "Unofficial practice — not affiliated with JLPT/IELTS",
    learnTitle: "Your language path",
    learnSub: "Steady progress, without the noise.",
    freePlan: "Free plan",
    onePath: "1 active path on Free",
    deskGreeting: "Hello",
    files: "Files",
    tasks: "Tasks",
    focus: "Focus",
    theme: "Desk theme",
    exportBackup: "Export backup",
    importBackup: "Import backup",
    hearWord: "Hear word (free TTS)",
    cultureTitle: "Heritage stories",
    cultureSub: "Open data — browse locally, open official pages when online.",
    roomsTitle: "Study rooms",
    roomsSub: "Optional LiveKit (free tier) or paste a Meet/Zoom link — no paid plan required.",
  },
} as const;

export type MessageKey = keyof typeof dict.vi;

type I18nValue = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: MessageKey) => string;
};

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("vi");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as Lang | null;
    if (saved === "vi" || saved === "en") setLangState(saved);
  }, []);

  function setLang(l: Lang) {
    setLangState(l);
    localStorage.setItem(STORAGE_KEY, l);
    document.documentElement.lang = l === "vi" ? "vi" : "en";
  }

  const value = useMemo<I18nValue>(
    () => ({
      lang,
      setLang,
      t: (key) => dict[lang][key] || dict.en[key] || key,
    }),
    [lang],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n outside provider");
  return ctx;
}
