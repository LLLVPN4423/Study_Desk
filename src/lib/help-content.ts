import type { Lang } from "./i18n";
import { STORAGE_KEYS } from "./storage-keys";

export type HelpSection = {
  id: string;
  title: string;
  href?: string;
  paragraphs: string[];
  bullets: string[];
};

export function helpSections(lang: Lang): HelpSection[] {
  if (lang === "en") {
    return [
      {
        id: "overview",
        title: "What is Study Desk?",
        paragraphs: [
          "A calm space for files, focus, and language paths (Japanese & English). Progress stays in your browser (localStorage / IndexedDB) — export a backup from Settings if you change devices.",
        ],
        bullets: [
          "Sidebar: Desk · Learn · Culture · Rooms · Settings · Guide",
          "Switch VI/EN with the language button at the bottom of the sidebar",
        ],
      },
      {
        id: "desk",
        title: "Desk (study table)",
        href: "/desk",
        paragraphs: [
          "Your working surface: folders, files, tasks, focus timer, schedule, and desk look (color / wallpaper).",
        ],
        bullets: [
          "Open from disk (recommended): keeps a write handle so Ctrl+S can overwrite the real file",
          "Studio: edit notes/DOC, annotate PDF, listen to audio in the background",
          "Leave with unsaved edits → save prompt for text/PDF/DOC",
          "Tasks: add on the overview or inside Studio → Focus tab",
          "Sources panel: search by name + type filter dropdown",
          "Theme: background color picker (solid/gradient) + wallpaper presets / your image",
        ],
      },
      {
        id: "learn",
        title: "Learn (language path)",
        href: "/learn",
        paragraphs: [
          "Placement → personalized roadmap → weekly actions. Progress rises only when you really study (rate cards, successful dictionary hits, kanji marked known, grammar correct answers, mock ≥40%). Just opening a page does not count.",
        ],
        bullets: [
          "JP N5–N1 · EN A1–C2 — placement includes listening TTS",
          "Creating a path loads 100% primary vocab (slim cards). Cover ≠ learned — track Mastery / Stable",
          "Level data → sequential lessons (bài); finish one, start the next anytime",
          "Path shows lessons — not a vocab/grammar catalog",
          "Promote when mastery ≥85%, stable ≥50%, and mock ≥60%",
          "Free/Pro gates paused — daily caps unlocked (will return later)",
          "Mocks by band (vocab + listening) — unofficial practice",
        ],
      },
      {
        id: "culture",
        title: "Culture",
        href: "/culture",
        paragraphs: [
          "Explore Japan heritage regions and stories — enrichment alongside your path, not an exam cert.",
        ],
        bullets: ["Open the map, pick a region, read stories", "Use search/filters when available"],
      },
      {
        id: "rooms",
        title: "Rooms",
        href: "/rooms",
        paragraphs: [
          "Optional study-room link (e.g. a shared call/space URL) stored with your desk.",
        ],
        bullets: ["Paste a room URL on Desk or Rooms and open it when you study together"],
      },
      {
        id: "settings",
        title: "Settings",
        href: "/settings",
        paragraphs: ["Account/session, plan hint, backup & restore of local data."],
        bullets: [
          "Export backup JSON regularly",
          "Import only from files you trust",
          "Sign out clears the local session (desk data may remain until you clear site data)",
        ],
      },
    ];
  }

  return [
    {
      id: "overview",
      title: "Study Desk là gì?",
      paragraphs: [
        "Không gian học bình tĩnh: file, focus và lộ trình tiếng Nhật & Anh. Dữ liệu nằm trên máy bạn (localStorage / IndexedDB) — hãy xuất backup ở Cài đặt nếu đổi thiết bị.",
      ],
      bullets: [
        "Thanh bên: Bàn học · Học · Văn hóa · Phòng học · Cài đặt · Hướng dẫn",
        "Đổi VI/EN bằng nút ngôn ngữ dưới sidebar",
      ],
    },
    {
      id: "desk",
      title: "Bàn học",
      href: "/desk",
      paragraphs: [
        "Mặt bàn làm việc: thư mục, file, việc cần làm, đồng hồ focus, lịch, và giao diện (màu / hình nền).",
      ],
      bullets: [
        "Mở từ máy (nên dùng): giữ quyền ghi để Ctrl+S ghi đè file gốc",
        "Studio: sửa ghi chú/DOC, annotate PDF, nghe audio nền",
        "Rời trang khi chưa lưu → hộp thoại lưu (text/PDF/DOC)",
        "Tasks: thêm ở tổng quan hoặc trong Studio → tab Focus",
        "Nguồn: tìm theo tên + lọc loại file",
        "Theme: chọn màu nền (đồng nhất/gradient) + hình nền / ảnh của bạn",
      ],
    },
    {
      id: "learn",
      title: "Học (lộ trình ngôn ngữ)",
      href: "/learn",
      paragraphs: [
        "Placement → lộ trình cá nhân → việc từng tuần. % chỉ tăng khi học thật (chấm thẻ SRS, tra dictionary có kết quả, đánh dấu kanji biết, trả lời đúng grammar, mock ≥40%). Chỉ mở trang không tính.",
      ],
      bullets: [
        "JP N5–N1 · EN A1–C2 — placement có nghe TTS",
        "Tạo path = cover 100% primary (thẻ slim). Cover ≠ đã học — xem Mastery / Stable",
        "Dữ liệu cấp → bài học nối tiếp; xong bài này học bài tiếp ngay",
        "Lộ trình hiện bài học — không phải danh mục từ/ngữ pháp",
        "Nâng band khi mastery ≥85%, stable ≥50%, mock ≥60%",
        "Free/Pro tạm tắt — hạn mức ngày đã mở (sẽ bật lại sau)",
        "Mock theo cấp (vocab + nghe) — không phải đề thi chính thức",
      ],
    },
    {
      id: "culture",
      title: "Văn hóa",
      href: "/culture",
      paragraphs: [
        "Khám phá vùng miền & câu chuyện di sản Nhật — bổ trợ học tập, không phải chứng chỉ thi.",
      ],
      bullets: ["Mở bản đồ, chọn vùng, đọc câu chuyện", "Dùng tìm kiếm/lọc nếu có"],
    },
    {
      id: "rooms",
      title: "Phòng học",
      href: "/rooms",
      paragraphs: ["Link phòng học chung (call/space) lưu cùng bàn học."],
      bullets: ["Dán URL phòng trên Desk hoặc Rooms rồi mở khi học nhóm"],
    },
    {
      id: "settings",
      title: "Cài đặt",
      href: "/settings",
      paragraphs: ["Phiên đăng nhập, gợi ý gói, sao lưu & khôi phục dữ liệu local."],
      bullets: [
        "Xuất backup JSON thường xuyên",
        "Chỉ import file bạn tin cậy",
        "Đăng xuất xóa phiên (dữ liệu desk có thể còn đến khi xóa dữ liệu site)",
      ],
    },
  ];
}

export type TourStep = {
  id: string;
  title: string;
  body: string;
  /** Sidebar data-tour target */
  target?: string;
  href?: string;
};

export function tourSteps(lang: Lang): TourStep[] {
  if (lang === "en") {
    return [
      {
        id: "welcome",
        title: "Welcome to Study Desk",
        body: "A short tour of the main areas. You can reopen it anytime from Guide.",
      },
      {
        id: "desk",
        title: "Desk",
        body: "Files, tasks, focus timer, and studio editing live here.",
        target: "desk",
        href: "/desk",
      },
      {
        id: "learn",
        title: "Learn",
        body: "Placement, roadmap, SRS reviews, grammar, kanji, and mocks.",
        target: "learn",
        href: "/learn",
      },
      {
        id: "culture",
        title: "Culture",
        body: "Heritage map and stories — explore Japan beside your path.",
        target: "culture",
        href: "/culture",
      },
      {
        id: "rooms",
        title: "Rooms",
        body: "Keep a shared study-room link handy.",
        target: "rooms",
        href: "/rooms",
      },
      {
        id: "help",
        title: "Guide",
        body: "Full written help is on this page. Finish the tour when you’re ready.",
        target: "help",
        href: "/help",
      },
    ];
  }
  return [
    {
      id: "welcome",
      title: "Chào mừng đến Study Desk",
      body: "Tour ngắn các khu vực chính. Bạn có thể mở lại bất cứ lúc nào trong Hướng dẫn.",
    },
    {
      id: "desk",
      title: "Bàn học",
      body: "File, việc cần làm, đồng hồ focus và studio chỉnh sửa.",
      target: "desk",
      href: "/desk",
    },
    {
      id: "learn",
      title: "Học",
      body: "Placement, lộ trình, ôn SRS, ngữ pháp, kanji và mock.",
      target: "learn",
      href: "/learn",
    },
    {
      id: "culture",
      title: "Văn hóa",
      body: "Bản đồ di sản và câu chuyện — khám phá Nhật bên cạnh lộ trình.",
      target: "culture",
      href: "/culture",
    },
    {
      id: "rooms",
      title: "Phòng học",
      body: "Giữ link phòng học chung để mở nhanh.",
      target: "rooms",
      href: "/rooms",
    },
    {
      id: "help",
      title: "Hướng dẫn",
      body: "Hướng dẫn viết đầy đủ nằm ở trang này. Kết thúc tour khi bạn sẵn sàng.",
      target: "help",
      href: "/help",
    },
  ];
}

export const TOUR_EVENT = "studydesk:start-tour";

export function requestStartTour() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(TOUR_EVENT));
}

export function isTourDone() {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(STORAGE_KEYS.tourDone) === "1";
  } catch {
    return true;
  }
}

export function setTourDone(done: boolean) {
  try {
    if (done) localStorage.setItem(STORAGE_KEYS.tourDone, "1");
    else localStorage.removeItem(STORAGE_KEYS.tourDone);
  } catch {
    /* ignore */
  }
}
