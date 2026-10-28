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
    navHelp: "Hướng dẫn",
    landingEyebrow: "Không gian học tập bình tĩnh",
    landingHeadline: "Một bàn học. Lộ trình rõ. Tiếng Nhật & Anh đi cùng bạn.",
    landingBody:
      "Giữ file, task, focus và luyện ngôn ngữ trong một chỗ — từ thẻ kanji đầu tiên đến mọi path phía trước.",
    startFree: "Bắt đầu miễn phí",
    signIn: "Đăng nhập",
    unofficial: "Luyện không chính thức — không liên kết JLPT/IELTS",
    learnTitle: "Lộ trình ngôn ngữ",
    learnSub: "Placement → lộ trình thật từ dữ liệu trong app → theo dõi từng tuần.",
    learnEyebrow: "Học tập",
    freePlan: "Gói Free",
    onePath: "1 path đang học trên Free",
    pathTools: "Công cụ học",
    pathStart: "Bắt đầu",
    pathLibrary: "Thư viện theo cấp độ",
    pathActive: "Path đang học",
    pathIdle: "Path",
    pathBeginPlacement: "Bắt đầu bằng placement",
    pathBeginHint:
      "Làm placement để ước band — rồi chọn bài từ thư viện (từ/ngữ pháp/kanji/mock) để dựng lộ trình dần.",
    pathUnofficial: "Không phải chứng chỉ",
    pathOtherAlso: "Cũng có trong app",
    pathSwitchHint: "Đổi tab phía trên để học track kia.",
    pathFreeOne: " Free giữ một path active.",
    pathProBoth: " Pro giữ cả hai.",
    pathSwitch: "Đổi",
    reviewsDue: "reviews đến hạn",
    pathRoadmapApprox: "Lộ trình",
    deskGreeting: "Chào bạn",
    files: "Tệp",
    tasks: "Việc cần làm",
    focus: "Tập trung",
    theme: "Giao diện bàn",
    exportBackup: "Xuất bản sao",
    importBackup: "Nhập bản sao",
    hearWord: "Nghe từ (TTS miễn phí)",
    cultureTitle: "Di sản theo vùng",
    cultureSub:
      "Bản đồ vệ tinh 8 miền + ghim định vị. Chọn vùng để focus bản đồ và xem di sản bên phải.",
    cultureEyebrow: "Văn hóa Nhật",
    cultureFree: "Miễn phí · seed offline",
    cultureStories: "câu chuyện",
    roomsTitle: "Phòng học",
    roomsSub: "LiveKit (tuỳ chọn, free tier) hoặc dán link Meet/Zoom — không bắt buộc trả phí.",
    // Desk
    deskIntro:
      "«Mở từ máy» rồi Ctrl+S ghi đè như editor thường · Studio 3 cột (nguồn · học · output).",
    newNote: "Ghi chú mới",
    upload: "Mở từ máy",
    newFolder: "Thư mục",
    noFiles: "Chưa có file · Mở từ máy hoặc tạo ghi chú / tải nhạc",
    noTasks: "Chưa có việc · bấm + Thêm",
    addTask: "+ Thêm",
    start: "Bắt đầu",
    pause: "Tạm dừng",
    reset: "Đặt lại",
    loading: "Đang tải…",
    // Schedule
    schedule: "Lịch",
    scheduleDefaultTitle: "Lịch trình môn học",
    scheduleEmpty: "Chưa có sự kiện · bấm sửa để thêm",
    scheduleSettings: "Cài đặt lịch",
    scheduleTitleLabel: "Tiêu đề lịch",
    scheduleTitlePlaceholder: "Lịch trình môn học",
    scheduleLabel: "Nhãn",
    scheduleTime: "Giờ",
    scheduleDate: "Ngày",
    scheduleContent: "Nội dung",
    scheduleContentPlaceholder: "Môn / việc cần làm",
    scheduleAdd: "Thêm sự kiện",
    scheduleSave: "Lưu",
    scheduleNewEvent: "Sự kiện mới",
    scheduleEvent: "Sự kiện",
    edit: "Sửa",
    delete: "Xóa",
    // Learn hub
    placement: "Placement",
    placementDone: "làm lại bất cứ lúc nào",
    placementTodo: "Ước lượng cấp độ — thêm bài sau",
    roadmap: "Roadmap",
    roadmapAfter: "Xuất hiện khi bạn thêm bài",
    reviews: "Reviews",
    reviewsEmpty: "Nạp thẻ sau placement",
    dueCards: "đến hạn",
    inDeck: "trong deck",
    weeks: "tuần",
    vocabSrs: "từ SRS",
    catalogVocab: "Từ vựng theo cấp",
    catalogGrammar: "Ngữ pháp theo cấp",
    catalogKanji: "Kanji theo cấp",
    catalogDict: "Dictionary",
    catalogMocks: "Mocks",
    trackJp: "Tiếng Nhật",
    trackEn: "Tiếng Anh",
    // Settings
    settingsEyebrow: "Cài đặt",
    settingsTitle: "Tài khoản",
    settingsPlan: "gói",
    settingsOneDesk: "1 bàn học",
    switchFree: "Chuyển sang Free (dev)",
    enablePro: "Bật Pro (dev)",
    signOut: "Đăng xuất",
    backToLearn: "Về trang Học",
    backupTitle: "Sao lưu",
    backupBody:
      "Dữ liệu nằm trong trình duyệt này. Bản sao v2 gồm metadata Learn/Desk và nội dung PDF/audio/ảnh trong IndexedDB (JSON + data URL). Nhập sẽ ghi đè desk/learn hiện tại. Ctrl+S ghi đè file trên máy chỉ có trên Chrome/Edge.",
    backupRestored: "Đang tải lại…",
    backupFailed: "Không khôi phục được.",
    settingsFoot:
      "MiniHongo là tuỳ chọn. Cờ Pro mở path JP+EN — chưa có cổng thanh toán. Luyện không chính thức — không liên kết JLPT/IELTS.",
    // Culture
    officialPage: "Trang chính thức →",
    cultureSearch: "Tìm di sản…",
    cultureAll: "Tất cả",
    // Rooms
    meetZoomTitle: "Meet / Zoom (miễn phí)",
    roomUrl: "URL phòng học",
    roomUrlPlaceholder: "https://meet.google.com/… hoặc Zoom",
    saveLink: "Lưu link",
    openRoom: "Mở phòng",
    livekitTitle: "LiveKit (tuỳ chọn)",
    livekitReady: "Đã thấy NEXT_PUBLIC_LIVEKIT_URL — có thể tích hợp token server sau.",
    livekitMissing:
      "Chưa cấu hình LiveKit. Giữ Meet/Zoom là đủ và không tốn tiền. Khi muốn: tạo dự án LiveKit Cloud free tier, thêm URL vào .env.local (không commit secret).",
    roomNameLabel: "Tên phòng (cho lần tích hợp sau)",
    // Learn / SRS
    srsAgain: "Lại",
    srsHard: "Khó",
    srsGood: "Ổn",
    srsEasy: "Dễ",
    srsAgainHint: "~1 phút",
    srsHardHint: "~10 phút",
    srsGoodHint: "~1 ngày",
    srsEasyHint: "~2 ngày",
    srsFlipFirst: "Lật thẻ trước khi chấm Lại / Khó / Ổn / Dễ",
    srsGradeBeforeNext: "Hãy chấm Lại / Khó / Ổn / Dễ trước khi sang từ khác.",
    dictTitle: "Từ điển",
    dictSearch: "Tìm",
    dictPlaceholderJp: "kanji, kana, romaji, hoặc nghĩa VI",
    dictPlaceholderEn: "từ tiếng Anh hoặc nghĩa VI",
    dictBack: "← Về Học",
    dictLocal: "Tra cứu seed local",
    dictLookupsToday: "lượt tra hôm nay",
    grammarAllTags: "Tất cả nhãn",
  },
  en: {
    navDesk: "Desk",
    navLearn: "Learn",
    navCulture: "Culture",
    navSettings: "Settings",
    navRooms: "Rooms",
    navHelp: "Guide",
    landingEyebrow: "A calm place for serious study",
    landingHeadline: "One desk. Clear paths. Language study that stays with you.",
    landingBody:
      "Keep files, tasks, focus sessions, and language practice together—from your first review onward.",
    startFree: "Start free",
    signIn: "Sign in",
    unofficial: "Unofficial practice — not affiliated with JLPT/IELTS",
    learnTitle: "Your language path",
    learnSub: "Placement → a real path from in-app data → week-by-week follow-through.",
    learnEyebrow: "Learning",
    freePlan: "Free plan",
    onePath: "1 active path on Free",
    pathTools: "Study tools",
    pathStart: "Get started",
    pathLibrary: "Library by level",
    pathActive: "Active path",
    pathIdle: "Path",
    pathBeginPlacement: "Start with placement",
    pathBeginHint:
      "Take placement to estimate your band — then pick lessons from the library (vocab/grammar/kanji/mocks) to build your path.",
    pathUnofficial: "Not an official",
    pathOtherAlso: "Also in the app",
    pathSwitchHint: "Use the tab above to study the other track.",
    pathFreeOne: " Free keeps one active path.",
    pathProBoth: " Pro keeps both.",
    pathSwitch: "Switch",
    reviewsDue: "reviews due",
    pathRoadmapApprox: "Path",
    deskGreeting: "Hello",
    files: "Files",
    tasks: "Tasks",
    focus: "Focus",
    theme: "Desk theme",
    exportBackup: "Export backup",
    importBackup: "Import backup",
    hearWord: "Hear word (free TTS)",
    cultureTitle: "Heritage by region",
    cultureSub:
      "Satellite map of 8 regions with pins. Pick a region to focus the map and browse heritage on the side.",
    cultureEyebrow: "Japanese culture",
    cultureFree: "Free · offline seed",
    cultureStories: "stories",
    roomsTitle: "Study rooms",
    roomsSub: "Optional LiveKit (free tier) or paste a Meet/Zoom link — no paid plan required.",
    // Desk
    deskIntro:
      "«Open from disk» then Ctrl+S overwrites like a normal editor · 3-column Studio.",
    newNote: "New note",
    upload: "Open from disk",
    newFolder: "Folder",
    noFiles: "No files yet · Open from disk, create a note, or add music",
    noTasks: "No tasks · tap + Add",
    addTask: "+ Add",
    start: "Start",
    pause: "Pause",
    reset: "Reset",
    loading: "Loading…",
    // Schedule
    schedule: "Schedule",
    scheduleDefaultTitle: "Class timetable",
    scheduleEmpty: "No events yet · tap edit to add",
    scheduleSettings: "Schedule settings",
    scheduleTitleLabel: "Schedule title",
    scheduleTitlePlaceholder: "Class timetable",
    scheduleLabel: "Label",
    scheduleTime: "Time",
    scheduleDate: "Date",
    scheduleContent: "Details",
    scheduleContentPlaceholder: "Subject / to-do",
    scheduleAdd: "Add event",
    scheduleSave: "Save",
    scheduleNewEvent: "New event",
    scheduleEvent: "Event",
    edit: "Edit",
    delete: "Delete",
    // Learn hub
    placement: "Placement",
    placementDone: "retake anytime",
    placementTodo: "Estimate level — add lessons later",
    roadmap: "Roadmap",
    roadmapAfter: "Appears when you add lessons",
    reviews: "Reviews",
    reviewsEmpty: "Cards load after placement",
    dueCards: "due",
    inDeck: "in deck",
    weeks: "weeks",
    vocabSrs: "SRS words",
    catalogVocab: "Vocab by level",
    catalogGrammar: "Grammar by level",
    catalogKanji: "Kanji by level",
    catalogDict: "Dictionary",
    catalogMocks: "Mocks",
    trackJp: "Japanese",
    trackEn: "English",
    // Settings
    settingsEyebrow: "Settings",
    settingsTitle: "Account",
    settingsPlan: "plan",
    settingsOneDesk: "1 desk",
    switchFree: "Switch to Free flag",
    enablePro: "Enable Pro flag (dev)",
    signOut: "Sign out",
    backToLearn: "Back to learn",
    backupTitle: "Backup",
    backupBody:
      "Data lives in this browser. Backup v2 includes Learn/Desk metadata plus PDF/audio/image bytes from IndexedDB (JSON + data URLs). Import overwrites current desk/learn. Disk overwrite via Ctrl+S needs Chrome/Edge.",
    backupRestored: "Reloading…",
    backupFailed: "Could not restore backup.",
    settingsFoot:
      "MiniHongo is optional. Pro flag unlocks dual JP+EN paths — no payment gateway yet. Unofficial practice — not affiliated with JLPT/IELTS.",
    // Culture
    officialPage: "Official page →",
    cultureSearch: "Search heritage…",
    cultureAll: "All",
    // Rooms
    meetZoomTitle: "Meet / Zoom (free)",
    roomUrl: "Room URL",
    roomUrlPlaceholder: "https://meet.google.com/… or Zoom",
    saveLink: "Save link",
    openRoom: "Open room",
    livekitTitle: "LiveKit (optional)",
    livekitReady: "NEXT_PUBLIC_LIVEKIT_URL detected — token server can be wired later.",
    livekitMissing:
      "LiveKit not configured. Meet/Zoom is enough and costs $0. Later: create a LiveKit Cloud free project and add the URL to .env.local (never commit secrets).",
    roomNameLabel: "Room name (for later integration)",
    // Learn / SRS
    srsAgain: "Again",
    srsHard: "Hard",
    srsGood: "Good",
    srsEasy: "Easy",
    srsAgainHint: "~1 min",
    srsHardHint: "~10 min",
    srsGoodHint: "~1 day",
    srsEasyHint: "~2 days",
    srsFlipFirst: "Flip the card before rating Again / Hard / Good / Easy",
    srsGradeBeforeNext: "Rate Again / Hard / Good / Easy before the next word.",
    dictTitle: "Dictionary",
    dictSearch: "Search",
    dictPlaceholderJp: "kanji, kana, romaji, or VI meaning",
    dictPlaceholderEn: "English headword or VI meaning",
    dictBack: "← Back to learn",
    dictLocal: "Local seed search",
    dictLookupsToday: "lookups today",
    grammarAllTags: "All tags",
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
