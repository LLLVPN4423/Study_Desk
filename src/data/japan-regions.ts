/** Vùng địa lý Nhật + tên tiếng Việt (offline, free). */

export type RegionId =
  | "hokkaido"
  | "tohoku"
  | "kanto"
  | "chubu"
  | "kinki"
  | "chugoku"
  | "shikoku"
  | "kyushu";

export type Region = {
  id: RegionId;
  nameJa: string;
  nameVi: string;
  /** Short label for map pins */
  nameShort: string;
  blurbVi: string;
  /** Satellite-style terrain tint */
  terrain: string;
  prefectures: string[];
};

export const REGIONS: Region[] = [
  {
    id: "hokkaido",
    nameJa: "北海道",
    nameVi: "Hokkaido",
    nameShort: "Hokkaido",
    blurbVi:
      "Đảo lớn phía bắc: văn hóa Ainu, biển cá, tuyết và hành trình Kitamaebune nối Honshu.",
    terrain: "#4a7a5c",
    prefectures: ["北海道"],
  },
  {
    id: "tohoku",
    nameJa: "東北",
    nameVi: "Tohoku (Đông Bắc)",
    nameShort: "Tohoku",
    blurbVi:
      "Đông Bắc Honshu: núi Dewa, văn hóa Date, hành hương Aizu và cánh đồng lúa Asaka.",
    terrain: "#5d7a52",
    prefectures: ["青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県"],
  },
  {
    id: "kanto",
    nameJa: "関東",
    nameVi: "Kanto",
    nameShort: "Kanto",
    blurbVi:
      "Đồng bằng quanh Tokyo: Kamakura samurai, tơ lụa Gunma, phố Edo và hành hương Kanagawa.",
    terrain: "#6b8f5a",
    prefectures: ["茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県"],
  },
  {
    id: "chubu",
    nameJa: "中部",
    nameVi: "Chubu (Trung bộ)",
    nameShort: "Chubu",
    blurbVi:
      "Trung Honshu: đường núi Nakasendo, thợ mộc Hida, Noto Kiriko và nghề thủ công Kaga.",
    terrain: "#7a8a4e",
    prefectures: [
      "新潟県",
      "富山県",
      "石川県",
      "福井県",
      "山梨県",
      "長野県",
      "岐阜県",
      "静岡県",
      "愛知県",
    ],
  },
  {
    id: "kinki",
    nameJa: "近畿",
    nameVi: "Kinki / Kansai",
    nameShort: "Kansai",
    blurbVi:
      "Kansai cổ kính: trà Kyoto, Asuka–Nara, hồ Biwa, Osaka và thần thoại đảo Awaji.",
    terrain: "#5a8a62",
    prefectures: ["三重県", "滋賀県", "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県"],
  },
  {
    id: "chugoku",
    nameJa: "中国",
    nameVi: "Chugoku (Tây Honshu)",
    nameShort: "Chugoku",
    blurbVi:
      "Tây Honshu: núi Daisen, Izumo, phố Onomichi, thép tatara và căn cứ hải quân Meiji.",
    terrain: "#4e7d6a",
    prefectures: ["鳥取県", "島根県", "岡山県", "広島県", "山口県"],
  },
  {
    id: "shikoku",
    nameJa: "四国",
    nameVi: "Shikoku",
    nameShort: "Shikoku",
    blurbVi:
      "Bốn tỉnh đảo: hành hương 88 chùa Kobo Daishi, yuzu Kochi và cảnh quan ven Seto.",
    terrain: "#4f8a72",
    prefectures: ["徳島県", "香川県", "愛媛県", "高知県"],
  },
  {
    id: "kyushu",
    nameJa: "九州・沖縄",
    nameVi: "Kyushu & Okinawa",
    nameShort: "Kyushu",
    blurbVi:
      "Kyushu–Okinawa: cửa ngõ Dazaifu, sứ Hizen, đảo Nagasaki và cảnh đá / núi lửa.",
    terrain: "#5c7a48",
    prefectures: [
      "福岡県",
      "佐賀県",
      "長崎県",
      "熊本県",
      "大分県",
      "宮崎県",
      "鹿児島県",
      "沖縄県",
    ],
  },
];

export const PREF_VI: Record<string, string> = {
  北海道: "Hokkaido",
  青森県: "Aomori",
  岩手県: "Iwate",
  宮城県: "Miyagi",
  秋田県: "Akita",
  山形県: "Yamagata",
  福島県: "Fukushima",
  茨城県: "Ibaraki",
  栃木県: "Tochigi",
  群馬県: "Gunma",
  埼玉県: "Saitama",
  千葉県: "Chiba",
  東京都: "Tokyo",
  神奈川県: "Kanagawa",
  新潟県: "Niigata",
  富山県: "Toyama",
  石川県: "Ishikawa",
  福井県: "Fukui",
  山梨県: "Yamanashi",
  長野県: "Nagano",
  岐阜県: "Gifu",
  静岡県: "Shizuoka",
  愛知県: "Aichi",
  三重県: "Mie",
  滋賀県: "Shiga",
  京都府: "Kyoto",
  大阪府: "Osaka",
  兵庫県: "Hyogo",
  奈良県: "Nara",
  和歌山県: "Wakayama",
  鳥取県: "Tottori",
  島根県: "Shimane",
  岡山県: "Okayama",
  広島県: "Hiroshima",
  山口県: "Yamaguchi",
  徳島県: "Tokushima",
  香川県: "Kagawa",
  愛媛県: "Ehime",
  高知県: "Kochi",
  福岡県: "Fukuoka",
  佐賀県: "Saga",
  長崎県: "Nagasaki",
  熊本県: "Kumamoto",
  大分県: "Oita",
  宮崎県: "Miyazaki",
  鹿児島県: "Kagoshima",
  沖縄県: "Okinawa",
};

export function parsePrefs(areas: string): string[] {
  return String(areas)
    .split(/[,、]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function prefsToVi(areas: string): string {
  return parsePrefs(areas)
    .map((p) => PREF_VI[p] || p)
    .join(", ");
}

export function regionForPref(pref: string): RegionId | null {
  for (const r of REGIONS) {
    if (r.prefectures.includes(pref)) return r.id;
  }
  return null;
}

export function itemInRegion(areas: string, regionId: RegionId): boolean {
  const region = REGIONS.find((r) => r.id === regionId);
  if (!region) return false;
  return parsePrefs(areas).some((p) => region.prefectures.includes(p));
}
