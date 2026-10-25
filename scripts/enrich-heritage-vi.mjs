import fs from "fs";

const items = JSON.parse(fs.readFileSync("src/data/japan-heritage-seed.json", "utf8"));

const prefVi = {
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

/** Curated Vietnamese titles + short blurbs for offline Culture UI. */
const curated = {
  1: {
    t: "Di sản giáo dục thời cận đại",
    d: "Nhóm di sản gắn tinh thần học tập và lễ nghĩa thời Edo–Meiji tại Ibaraki, Tochigi, Okayama và Oita — nền tảng văn hóa học đường Nhật.",
  },
  2: {
    t: "Kakaa tenka — chuyện tơ lụa Gunma",
    d: "Câu chuyện phụ nữ Gunma và ngành tơ lụa: lao động, gia đình và bản sắc địa phương vùng Kanto phía tây bắc.",
  },
  3: {
    t: "Văn hóa thị dân Takaoka (Toyama)",
    d: "Takaoka gắn dòng họ Maeda xứ Kaga: nghề thủ công, tinh thần thị dân và triết lý người–nghề–tâm.",
  },
  4: {
    t: "Bán đảo Noto — lễ hội Kiriko",
    d: "Noto (Ishikawa) nổi tiếng lễ hội đèn Kiriko: văn hóa biển, lễ hội cộng đồng và bản sắc bán đảo.",
  },
  5: {
    t: "Wakasa và đường cá thu",
    d: "Di sản giao thương nối biển Wakasa (Fukui) với kinh đô: xứ thực phẩm và con đường cá thu lịch sử.",
  },
  6: {
    t: "Thành thị Gifu thời Nobunaga",
    d: "Phố thành Gifu gợi nhớ thời Sengoku và văn hóa tiếp đãi của Oda Nobunaga.",
  },
  7: {
    t: "Saiku — kinh đô nữ tư tế",
    d: "Di tích Saiku (Mie) gắn nữ tư tế Ise (Saio): nghi lễ cung đình và hành trình tâm linh cổ.",
  },
  8: {
    t: "Hồ Biwa và cảnh quan nước",
    d: "Hồ Biwa (Shiga) — di sản nước, cầu nguyện và đời sống ven hồ gắn lịch sử Kansai.",
  },
  9: {
    t: "800 năm lịch sử trà Nhật",
    d: "Hành trình văn hóa trà tại Kyoto: từ thiền viện đến nghi thức uống trà.",
  },
  10: {
    t: "Điệu dân ca Dekansho (Hyogo)",
    d: "Dân ca Tanba Sasayama lưu ký ức quê hương qua giai điệu Dekansho.",
  },
  11: {
    t: "Thời khai quốc — phụ nữ Asuka",
    d: "Vùng Asuka (Nara) và vai trò phụ nữ buổi đầu nhà nước Nhật cổ.",
  },
  12: {
    t: "Daisen — thanh tịnh lục căn",
    d: "Núi Daisen (Tottori): hành hương chữa lành lục căn / lục cảm — tín ngưỡng núi và sức khỏe tâm linh.",
  },
  13: {
    t: "Tsuwano xưa và nay",
    d: "Thị trấn thành Tsuwano (Shimane): phố cổ, văn hóa học thuật và cảnh quan núi thung.",
  },
  14: {
    t: "Onomichi — đô thị hộp cát ven kênh",
    d: "Onomichi (Hiroshima): đô thị trung cổ ven đường thủy, đền chùa và lối sống tầng tầng.",
  },
  15: {
    t: "Hành hương Shikoku (Henro)",
    d: "Hành trình 88 ngôi chùa quanh bốn tỉnh Shikoku — tín ngưỡng Kobo Daishi và văn hóa hành hương.",
  },
  16: {
    t: "Kinh đô phía Tây thời cổ",
    d: "Dazaifu và vùng Fukuoka–Saga: “kinh đô phía tây” của Nhật cổ, cửa ngõ ngoại giao lục địa.",
  },
  17: {
    t: "Đảo biên giới Iki · Tsushima · Goto",
    d: "Các đảo Nagasaki trên biên giới biển: giao thương, phòng thủ và bản sắc đảo.",
  },
  18: {
    t: "700 năm dòng họ Sagara",
    d: "Hitoyoshi–Kuma (Kumamoto): văn hóa bảo thủ lẫn đổi mới dưới dòng họ Sagara bảy thế kỷ.",
  },
  19: {
    t: "Văn hóa Date của Masamune",
    d: "Sendai / Miyagi: di sản Date Masamune — “Date” vừa nghĩa phong cách vừa nghĩa dòng họ.",
  },
  20: {
    t: "Hành trình tái sinh Dewa Sanzan",
    d: "Ba ngọn núi Dewa (Yamagata): hành hương shugendo — tin ngưỡng và thiên nhiên gắn “sinh lại”.",
  },
  21: {
    t: "Ba mươi ba Quan Âm Aizu",
    d: "Hành hương 33 ngôi Quan Âm vùng Aizu (Fukushima) — tín ngưỡng dân gian và cảnh quan núi.",
  },
  22: {
    t: "Một con kênh mở tương lai",
    d: "Công trình thủy lợi Asaka (Fukushima): kênh dẫn nước biến đất hoang thành cánh đồng lúa.",
  },
  23: {
    t: "Bốn phố Hokusō mang hồn Edo",
    d: "Phố cổ phía bắc Chiba gợi không khí Edo: kiến trúc, thương mại và đời sống thị dân.",
  },
  24: {
    t: "Tín ngưỡng & dạo chơi dân Edo",
    d: "Kanagawa: nơi dân Edo hành hương và vui chơi — đền chùa, núi và văn hóa cuối tuần thời xưa.",
  },
  25: {
    t: "Iza, Kamakura!",
    d: "Kamakura (Kanagawa): kinh đô samurai, đền chùa và hành trình lịch sử trung cổ.",
  },
  26: {
    t: "Đồ gốm ngọn lửa sông Shinano",
    d: "Niigata: đồ gốm hình ngọn lửa lưu vực Shinano và văn hóa xứ tuyết.",
  },
  27: {
    t: "Komatsu — câu chuyện ngọc",
    d: "Komatsu (Ishikawa): lịch sử chế tác đá quý / ngọc và nghề thủ công địa phương.",
  },
  28: {
    t: "Đường Kiso giữa núi",
    d: "Kisoji (Nagano–Gifu): hành trình núi Nakasendo — trạm phố, rừng và đời sống đường cái.",
  },
  29: {
    t: "Tay nghề & tâm Hida",
    d: "Thợ mộc Hida (Gifu): kỹ thuật gỗ và tinh thần nghề truyền qua nhiều thế hệ.",
  },
  30: {
    t: "Awaji — đảo khai sinh quốc gia",
    d: "Đảo Awaji (Hyogo) trong Kojiki: thần thoại “khai sinh đất nước” và cảnh quan nội hải.",
  },
  31: {
    t: "Sống cùng rừng (Nara)",
    d: "Cộng đồng rừng Nara: nuôi rừng và được rừng nuôi — lối sống gắn cây cối và tâm thức.",
  },
  32: {
    t: "Sống cùng cá voi",
    d: "Wakayama: văn hóa đánh bắt và kính trọng cá voi — nghi lễ, ẩm thực và ký ức biển.",
  },
  33: {
    t: "Chợ bò ngựa Daisen",
    d: "Tottori: tín ngưỡng Jizo nuôi dưỡng chợ bò ngựa lớn nhất Nhật quanh núi Daisen.",
  },
  34: {
    t: "Fudoki lò thép Tatara Izumo",
    d: "Shimane: nghề thép tatara truyền thống xứ Izumo — sắt, lửa và thần thoại địa phương.",
  },
  35: {
    t: "Bốn căn cứ hải quân Meiji",
    d: "Yokosuka · Kure · Sasebo · Maizuru: di sản căn cứ hải quân thời hiện đại hóa Meiji.",
  },
  36: {
    t: "Quần đảo Geiyo — căn cứ “hải tặc”",
    d: "Quần đảo Geiyo (Hiroshima–Ehime): lịch sử hải thương / “wokou nội địa” và cảnh quan Seto.",
  },
  37: {
    t: "Hizen — quê hương sứ Nhật",
    d: "Saga–Nagasaki: lò sứ Hizen (Arita, Imari…) — khởi nguồn sứ Nhật xuất khẩu.",
  },
  38: {
    t: "Esashi tháng Năm — không kém Edo",
    d: "Esashi (Hokkaido): thịnh vượng nghề cá trích; câu tục ngữ ca ngợi mùa lễ hội tháng Năm.",
  },
  39: {
    t: "Giấc mơ vượt sóng Kitamaebune",
    d: "Thuyền buôn Kitamaebune nối Hokkaido với Honshu phía biển Nhật: thương mại, phố cảng và văn hóa hàng hải.",
  },
  40: {
    t: "Tơ lụa gắn samurai",
    d: "Yamagata: ngành tơ lụa gắn dòng họ / văn hóa võ sĩ địa phương.",
  },
  41: {
    t: "Gyoda — phố kho tất tabi",
    d: "Gyoda (Saitama): thành phố kho tabi nâng đỡ văn hóa kimono từ dưới chân.",
  },
  42: {
    t: "Làng ninja Iga · Koka",
    d: "Mie–Shiga: quê hương ninjutsu Iga và Koka — kỹ năng, địa hình và truyền thuyết.",
  },
  43: {
    t: "Hành lang chirimen Tango",
    d: "Kyoto phía bắc: 300 năm lụa chirimen Tango — nghề dệt và cảnh quan ven biển.",
  },
  44: {
    t: "Quốc lộ cổ nhất Nhật",
    d: "Osaka–Nara: con đường quốc gia ~1400 năm — hành trình lịch sử nối kinh đô cổ.",
  },
  45: {
    t: "Đường xe ngựa bạc Bantan",
    d: "Hyogo: tuyến vận khoáng / bạc xuyên vùng Bantan — công nghiệp và cảnh quan đường núi.",
  },
  46: {
    t: "Wakanoura — kho tuyệt cảnh",
    d: "Wakayama: vịnh Wakanoura trong thơ waka — cảnh biển, đền và văn học cổ.",
  },
  47: {
    t: "Yuasa — cái nôi nước tương",
    d: "Yuasa (Wakayama): nơi khởi nguồn nghề ủ shoyu — “giọt đầu tiên” của ẩm thực Nhật.",
  },
  48: {
    t: "Izumo — thánh địa nơi mặt trời lặn",
    d: "Shimane / Izumo: tín ngưỡng thần đạo, nơi mặt trời lặn và thần thoại quốc gia.",
  },
  49: {
    t: "Kurashiki — chuyện từ một bông bông",
    d: "Kurashiki (Okayama): từ bông vải đến phố thương nhân — kiến trúc kho và công nghiệp dệt.",
  },
  50: {
    t: "Sáu lò cổ — dễ “phải lòng”",
    d: "Roku koyo: sáu lò gốm cổ trải nhiều tỉnh — Seto, Tokoname, Shigaraki, Bizen, Tamba, Echizen…",
  },
  51: {
    t: "Từ đường rừng đến lộ yuzu",
    d: "Kochi: từ đường sắt lâm nghiệp đến “lộ yuzu” nổi tiếng — rừng, trái cây và du lịch nông thôn.",
  },
  52: {
    t: "Eo biển Kanmon hoài cổ",
    d: "Yamaguchi–Fukuoka: eo Kanmon nối Honshu–Kyushu — cảng, phà và không khí thời hiện đại hóa.",
  },
  53: {
    t: "Hai nghìn năm trồng lúa",
    d: "Kumamoto: ký ức đất đai hai thiên niên kỷ trồng lúa — thủy lợi, làng và nghi lễ nông nghiệp.",
  },
  54: {
    t: "Du lãm Yabakei",
    d: "Oita: thắng cảnh Yabakei — đá, sông và văn hóa dạo chơi danh thắng thời Edo–Meiji.",
  },
  55: {
    t: "Ainu Kamikawa sống cùng Kamuy",
    d: "Hokkaido thượng nguồn: văn hóa Ainu Kamikawa — sống cùng thần linh Kamuy và thiên nhiên.",
  },
  56: {
    t: "Chùa núi và văn hóa hoa safflower",
    d: "Yamagata: chùa núi nâng đỡ văn hóa trồng safflower (benibana) — màu nhuộm và thương mại.",
  },
  57: {
    t: "Mê cung dưới lòng đất",
    d: "Tochigi: hành trình khám phá hệ thống hầm / đá ngầm — lịch sử khai thác và không gian dưới đất.",
  },
  58: {
    t: "Tương lai do quý tộc Meiji vẽ",
    d: "Tochigi: biệt thự / quy hoạch gắn tầng lớp quý tộc thời Meiji — hiện đại hóa và phong cách sống.",
  },
  59: {
    t: "Inami — bảo tàng điêu khắc gỗ",
    d: "Inami (Toyama): từ một cây đục của thợ chùa đến phố điêu khắc gỗ nổi tiếng.",
  },
  60: {
    t: "Cảnh quan đồi nho",
    d: "Yamanashi: đồi nho dệt nên cảnh quan — rượu vang Nhật và nông nghiệp vùng núi.",
  },
};

function fallback(it) {
  const prefs = String(it.areas)
    .split(/[,、]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const where = prefs.map((p) => prefVi[p] || p).join(", ");
  const sub = (it.subname || "").replace(/[─－～〜\-]+/g, " ").trim();
  return {
    t: `Di sản văn hóa — ${where}`,
    d: `${sub ? sub + ". " : ""}Câu chuyện Japan Heritage tại ${where}. Mở link chính thức để đọc sâu về lịch sử, lễ hội và đời sống địa phương.`,
  };
}

const out = items.map((it) => {
  const c = curated[it.id] || fallback(it);
  return { ...it, titleVi: c.t, descVi: c.d };
});

fs.writeFileSync("src/data/japan-heritage-seed.json", JSON.stringify(out, null, 2));
console.log("enriched", out.length);
