/**
 * Build unofficial per-band vocab + listening mock packs from curriculum seeds.
 * Output: src/data/mocks-by-band.json
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dirname, "..", "src", "data");

function read(name) {
  return JSON.parse(fs.readFileSync(path.join(DATA, name), "utf8"));
}

function seeded(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return () => {
    h = (h * 1664525 + 1013904223) >>> 0;
    return h / 4294967296;
  };
}

function shuffle(arr, rnd) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickN(list, n, rnd) {
  return shuffle(list, rnd).slice(0, Math.min(n, list.length));
}

function uniqChoices(correct, pool, rnd, n = 4) {
  const out = [correct];
  for (const c of shuffle(pool, rnd)) {
    if (out.length >= n) break;
    if (c && !out.includes(c)) out.push(c);
  }
  while (out.length < n) out.push(`—${out.length}`);
  const mixed = shuffle(out, rnd);
  return { choices: mixed, answer: mixed.indexOf(correct) };
}

const JP_BANDS = ["N5", "N4", "N3", "N2", "N1"];
const EN_BANDS = ["A1", "A2", "B1", "B2", "C1", "C2"];

const jpAll = [
  ...read("openjlpt-n5-seed.json"),
  ...read("openjlpt-n4-seed.json"),
  ...read("openjlpt-n3-seed.json"),
  ...read("openjlpt-n2-seed.json"),
  ...read("openjlpt-n1-seed.json"),
];
const enAll = read("cefrj-vocab-seed.json");
const grammarJp = read("grammar-jp.json");
const grammarEn = read("grammar-en.json");

function jpVocabQuestions(band, count = 8) {
  const rnd = seeded(`jp-v-${band}`);
  const pool = jpAll.filter((w) => w.level === band && w.meanings?.[0]);
  const picks = pickN(pool, count, rnd);
  const meaningPool = pool.map((w) => w.meanings[0]).filter(Boolean);
  return picks.map((w, i) => {
    const correct = w.meanings[0];
    const { choices, answer } = uniqChoices(correct, meaningPool, rnd);
    return {
      id: `jp-${band}-v${i + 1}`,
      prompt: `「${w.word}」${w.reading ? `（${w.reading}）` : ""} means:`,
      choices,
      answer,
    };
  });
}

function enVocabQuestions(band, count = 8) {
  const rnd = seeded(`en-v-${band}`);
  const pool = enAll.filter((w) => w.level === band && w.word);
  const picks = pickN(pool, count, rnd);
  const wordPool = pool.map((w) => w.word);
  return picks.map((w, i) => {
    const correct = w.word;
    const { choices, answer } = uniqChoices(correct, wordPool, rnd);
    const gloss = (w.meanings || []).find((m) => !m.startsWith("EN ·") && m !== w.word) || w.pos || band;
    return {
      id: `en-${band}-v${i + 1}`,
      prompt: `Choose the ${band} word for: ${gloss}`,
      choices,
      answer,
    };
  });
}

function grammarQuestions(track, band, count = 4) {
  const rnd = seeded(`${track}-g-${band}`);
  const bank = (track === "jp" ? grammarJp : grammarEn).filter((g) => g.level === band);
  const picks = pickN(bank, count, rnd);
  return picks.map((g, i) => ({
    id: `${track}-${band}-g${i + 1}`,
    prompt: g.prompt || g.pattern,
    choices: g.choices,
    answer: g.answer,
  }));
}

const LISTEN_JP = {
  N5: [
    { speak: "明日、学校に行きます。", prompt: "Họ sẽ làm gì ngày mai?", choices: ["Đi làm", "Đi học", "Ở nhà", "Đi du lịch"], answer: 1 },
    { speak: "水をください。", prompt: "Họ muốn gì?", choices: ["Cơm", "Nước", "Trà", "Bánh"], answer: 1 },
    { speak: "この本は面白いです。", prompt: "Họ nghĩ gì về cuốn sách?", choices: ["Buồn", "Khó", "Thú vị", "Đắt"], answer: 2 },
    { speak: "駅はどこですか。", prompt: "Họ hỏi về gì?", choices: ["Nhà ga", "Bệnh viện", "Trường", "Công viên"], answer: 0 },
    { speak: "今日は雨です。", prompt: "Thời tiết thế nào?", choices: ["Nắng", "Tuyết", "Mưa", "Gió"], answer: 2 },
    { speak: "すみません、トイレはどこですか。", prompt: "Họ tìm gì?", choices: ["Nhà vệ sinh", "Cửa hàng", "Thư viện", "Bến xe"], answer: 0 },
  ],
  N4: [
    { speak: "約束を忘れないでください。", prompt: "Họ nhắc gì?", choices: ["Đừng quên hẹn", "Đến sớm", "Mang tiền", "Gọi điện"], answer: 0 },
    { speak: "この料理は辛すぎます。", prompt: "Món ăn như thế nào?", choices: ["Ngọt quá", "Cay quá", "Mặn quá", "Đắng"], answer: 1 },
    { speak: "電車が遅れています。", prompt: "Tình trạng gì?", choices: ["Tàu đến sớm", "Tàu trễ", "Tàu hủy", "Tàu đầy"], answer: 1 },
    { speak: "宿題を出してください。", prompt: "Yêu cầu gì?", choices: ["Nộp bài tập", "Mở sách", "Ngồi xuống", "Im lặng"], answer: 0 },
    { speak: "風邪をひいたので休みます。", prompt: "Lý do nghỉ?", choices: ["Bận việc", "Cảm lạnh", "Du lịch", "Thi"], answer: 1 },
    { speak: "図書館で本を借りました。", prompt: "Họ đã làm gì?", choices: ["Mua sách", "Mượn sách", "Trả sách", "Đọc báo"], answer: 1 },
  ],
  N3: [
    { speak: "計画を延期することにしました。", prompt: "Quyết định gì?", choices: ["Hủy kế hoạch", "Hoãn kế hoạch", "Đẩy nhanh", "Giữ nguyên"], answer: 1 },
    { speak: "彼の話は信じがたいです。", prompt: "Họ nghĩ sao về câu chuyện?", choices: ["Dễ tin", "Khó tin", "Buồn cười", "Thú vị"], answer: 1 },
    { speak: "説明書を読んだうえで組み立ててください。", prompt: "Làm gì trước?", choices: ["Đọc hướng dẫn", "Gọi hỗ trợ", "Tháo máy", "Bỏ qua"], answer: 0 },
    { speak: "意見を交換しましょう。", prompt: "Đề xuất gì?", choices: ["Im lặng", "Trao đổi ý kiến", "Bỏ phiếu", "Kết thúc"], answer: 1 },
    { speak: "交通が混雑しています。", prompt: "Tình hình giao thông?", choices: ["Thông thoáng", "Đông đúc", "Tai nạn", "Cấm đường"], answer: 1 },
    { speak: "経験を積むことが大切です。", prompt: "Điều quan trọng?", choices: ["Tiền bạc", "Tích lũy kinh nghiệm", "May mắn", "Ngoại hình"], answer: 1 },
  ],
  N2: [
    { speak: "結果に応じて対応を変えます。", prompt: "Họ sẽ làm gì?", choices: ["Bỏ qua kết quả", "Đổi cách xử lý theo kết quả", "Giữ nguyên", "Từ chối"], answer: 1 },
    { speak: "議論が過熱してきました。", prompt: "Cuộc thảo luận?", choices: ["Lạnh nhạt", "Nóng lên", "Kết thúc", "Bắt đầu"], answer: 1 },
    { speak: "努力したあげく、合格できませんでした。", prompt: "Kết cục?", choices: ["Đậu", "Không đậu dù đã cố", "Bỏ cuộc sớm", "Thi lại ngay"], answer: 1 },
    { speak: "方針を改正する必要があります。", prompt: "Cần gì?", choices: ["Sửa đổi chính sách", "Giữ nguyên", "Công bố", "Bỏ phiếu"], answer: 0 },
    { speak: "彼は医者であるのみならず、作家でもあります。", prompt: "Anh ấy là gì?", choices: ["Chỉ là bác sĩ", "Bác sĩ và cả nhà văn", "Chỉ nhà văn", "Sinh viên"], answer: 1 },
    { speak: "この問題は複雑で一筋縄ではいきません。", prompt: "Vấn đề thế nào?", choices: ["Đơn giản", "Phức tạp, khó xử lý nhanh", "Đã giải xong", "Không quan trọng"], answer: 1 },
  ],
  N1: [
    { speak: "いかなる困難であれ、諦めません。", prompt: "Thái độ?", choices: ["Bỏ cuộc khi khó", "Không bỏ cuộc dù khó", "Chờ may mắn", "Nhờ người khác"], answer: 1 },
    { speak: "成功は努力にほかなりません。", prompt: "Ý chính?", choices: ["May mắn thôi", "Chính là nhờ nỗ lực", "Không liên quan", "Do người khác"], answer: 1 },
    { speak: "議論が膠着状態に陥りました。", prompt: "Thảo luận?", choices: ["Suôn sẻ", "Bế tắc", "Vui vẻ", "Kết thúc sớm"], answer: 1 },
    { speak: "彼の提案は斬新で示唆に富んでいます。", prompt: "Đề xuất?", choices: ["Cũ rích", "Mới mẻ, nhiều gợi ý", "Không rõ", "Phản đối"], answer: 1 },
    { speak: "問題を助長するような発言は避けてください。", prompt: "Lời khuyên?", choices: ["Nói nhiều hơn", "Tránh lời làm trầm trọng vấn đề", "Im lặng tuyệt đối", "Đổi chủ đề vui"], answer: 1 },
    { speak: "この解釈は穿ちすぎかもしれません。", prompt: "Họ nghi ngờ gì?", choices: ["Diễn giải quá sâu/gượng", "Thiếu dữ liệu", "Sai chính tả", "Quá ngắn"], answer: 0 },
  ],
};

const LISTEN_EN = {
  A1: [
    { speak: "I am a student.", prompt: "Who is speaking?", choices: ["A teacher", "A student", "A doctor", "A driver"], answer: 1 },
    { speak: "This is an apple.", prompt: "What is it?", choices: ["An orange", "An apple", "A book", "A pen"], answer: 1 },
    { speak: "She goes to school every day.", prompt: "Where does she go?", choices: ["Work", "School", "Home", "Park"], answer: 1 },
    { speak: "Can you help me?", prompt: "What do they want?", choices: ["Food", "Help", "Money", "Time"], answer: 1 },
    { speak: "I like tea.", prompt: "What do they like?", choices: ["Coffee", "Tea", "Water", "Juice"], answer: 1 },
    { speak: "The book is on the table.", prompt: "Where is the book?", choices: ["Under the chair", "On the table", "In the bag", "Outside"], answer: 1 },
  ],
  A2: [
    { speak: "I was tired yesterday.", prompt: "When were they tired?", choices: ["Today", "Yesterday", "Tomorrow", "Now"], answer: 1 },
    { speak: "We played football yesterday.", prompt: "What did they do?", choices: ["Studied", "Played football", "Cooked", "Slept"], answer: 1 },
    { speak: "I am going to visit my aunt tomorrow.", prompt: "Plan?", choices: ["Stay home", "Visit aunt", "Go to work", "Travel abroad"], answer: 1 },
    { speak: "This bag is bigger than that one.", prompt: "Comparison?", choices: ["Same size", "This bag is bigger", "That bag is bigger", "No bags"], answer: 1 },
    { speak: "You should sleep more.", prompt: "Advice?", choices: ["Eat more", "Sleep more", "Work more", "Talk less"], answer: 1 },
    { speak: "Have you ever been to Japan?", prompt: "Question about?", choices: ["Food", "Travel experience", "Money", "Weather"], answer: 1 },
  ],
  B1: [
    { speak: "I have been studying for two hours.", prompt: "Duration?", choices: ["Just started", "Two hours so far", "Finished yesterday", "Not studying"], answer: 1 },
    { speak: "If I were rich, I would travel.", prompt: "Condition type?", choices: ["Real present", "Unreal present", "Past fact", "Order"], answer: 1 },
    { speak: "English is spoken around the world.", prompt: "Voice?", choices: ["Active only", "Passive", "Future", "Question"], answer: 1 },
    { speak: "The man who lives next door is a doctor.", prompt: "Relative clause refers to?", choices: ["The door", "The man", "A doctor only", "Next week"], answer: 1 },
    { speak: "I wish I had more time.", prompt: "Feeling?", choices: ["Happy with time", "Want more time", "No wishes", "Busy tomorrow"], answer: 1 },
    { speak: "You're tired, aren't you?", prompt: "Tag question expects?", choices: ["Confirmation", "New topic", "Apology", "Order"], answer: 0 },
  ],
  B2: [
    { speak: "The report was written by the team yesterday.", prompt: "Who wrote it?", choices: ["One person", "The team", "Nobody", "A machine"], answer: 1 },
    { speak: "Not only did he arrive late, but he forgot the files.", prompt: "Problems?", choices: ["Only late", "Late and forgot files", "Only forgot", "On time"], answer: 1 },
    { speak: "Had I known, I would have helped.", prompt: "Meaning?", choices: ["Will help now", "Would have helped if known", "Did help", "Refused"], answer: 1 },
    { speak: "Her argument was convincing and hard to challenge.", prompt: "Argument quality?", choices: ["Weak", "Convincing", "Funny", "Short"], answer: 1 },
    { speak: "The author implies that change is inevitable.", prompt: "Implication?", choices: ["Optional", "Inevitable", "Impossible", "Delayed"], answer: 1 },
    { speak: "Despite scarce resources, the project continued.", prompt: "Outcome?", choices: ["Stopped", "Continued", "Never started", "Succeeded easily"], answer: 1 },
  ],
  C1: [
    { speak: "The findings undermine previous assumptions.", prompt: "Effect on assumptions?", choices: ["Support", "Undermine", "Ignore", "Repeat"], answer: 1 },
    { speak: "A nuanced analysis considers multiple factors.", prompt: "Analysis type?", choices: ["Simple", "Nuanced", "Random", "Brief"], answer: 1 },
    { speak: "Her critique was trenchant but fair.", prompt: "Critique style?", choices: ["Soft", "Sharp but fair", "Unfair", "Silent"], answer: 1 },
    { speak: "Scarce though resources were, work went on.", prompt: "Tone?", choices: ["Casual chat", "Formal concessive", "Joke", "Question"], answer: 1 },
    { speak: "Customers are requested to wait outside.", prompt: "Register?", choices: ["Slang", "Formal request", "Angry shout", "Song"], answer: 1 },
    { speak: "She said she would call later.", prompt: "Reported speech?", choices: ["Will call", "Would call", "Called already", "Never call"], answer: 1 },
  ],
  C2: [
    { speak: "The speech was full of empty rhetoric.", prompt: "Speech content?", choices: ["Solid facts", "Empty rhetoric", "Silence", "Poetry only"], answer: 1 },
    { speak: "Much as it may seem paradoxical, both claims can hold.", prompt: "Stance?", choices: ["Reject both", "Accept paradox possibility", "Change topic", "Joke"], answer: 1 },
    { speak: "A perspicacious observer noticed the subtle shift.", prompt: "Observer quality?", choices: ["Careless", "Keen", "Absent", "Noisy"], answer: 1 },
    { speak: "The committee's decision was irrevocable.", prompt: "Decision?", choices: ["Temporary", "Cannot be reversed", "Funny", "Secret only"], answer: 1 },
    { speak: "His remarks were somewhat opaque to newcomers.", prompt: "Remarks?", choices: ["Crystal clear", "Hard to understand", "Too short", "Loud"], answer: 1 },
    { speak: "They tried to circumvent the regulation.", prompt: "Action?", choices: ["Follow strictly", "Find a way around", "Write a new law", "Celebrate"], answer: 1 },
  ],
};

function packVocab(track, band) {
  const g = grammarQuestions(track, band, 3);
  const v =
    track === "jp" ? jpVocabQuestions(band, 7) : enVocabQuestions(band, 7);
  const questions = [...v.slice(0, 5), ...g, ...v.slice(5)].slice(0, 10);
  return {
    id: `mock-${track}-${band}-vocab`,
    title: `${track.toUpperCase()} ${band} vocab mock`,
    track,
    band,
    mode: "vocab",
    minutes: 8,
    disclaimer: "Unofficial practice — not an official exam section.",
    questions,
  };
}

function packListen(track, band) {
  const src = track === "jp" ? LISTEN_JP[band] : LISTEN_EN[band];
  const questions = (src || []).map((q, i) => ({
    id: `${track}-${band}-l${i + 1}`,
    speak: q.speak,
    prompt: q.prompt,
    choices: q.choices,
    answer: q.answer,
  }));
  return {
    id: `mock-${track}-${band}-listen`,
    title: `${track.toUpperCase()} ${band} listening mini-mock (TTS)`,
    track,
    band,
    mode: "listening",
    minutes: 6,
    disclaimer: "Unofficial practice — browser TTS, not official exam audio.",
    questions,
  };
}

const packs = [];
for (const band of JP_BANDS) {
  packs.push(packVocab("jp", band));
  packs.push(packListen("jp", band));
}
for (const band of EN_BANDS) {
  packs.push(packVocab("en", band));
  packs.push(packListen("en", band));
}

const out = { version: 1, packs };
fs.writeFileSync(path.join(DATA, "mocks-by-band.json"), JSON.stringify(out, null, 2) + "\n");
console.log("wrote mocks-by-band.json packs", packs.length);
