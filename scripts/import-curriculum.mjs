/**
 * Import OpenJLPT vocab/grammar/kanji + CEFR-J / Octanove EN vocab into src/data.
 * Sources: scripts/_raw/ (downloaded separately).
 * Licenses: OpenJLPT CC BY-SA 4.0 · CEFR-J Wordlist (TUFS) · Octanove C1/C2 profile.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAW = path.join(__dirname, "_raw");
const OUT = path.join(__dirname, "..", "src", "data");

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(RAW, name), "utf8"));
}

function writeJson(name, data) {
  const file = path.join(OUT, name);
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n", "utf8");
  console.log("wrote", name, Array.isArray(data) ? data.length : typeof data);
}

function slimVocab(entries) {
  return entries.map((w) => {
    const ex = w.examples?.[0];
    const pos = Array.isArray(w.pos) ? w.pos.filter(Boolean).join(",") : w.pos || "";
    return {
      id: w.id,
      word: w.word,
      reading: w.reading,
      romaji: w.romaji,
      meanings: (w.meanings || []).slice(0, 4),
      level: w.level,
      pos,
      examples: ex ? [{ ja: ex.ja, en: ex.en }] : [],
    };
  });
}

/** Distinctive JP fragment from a grammar pattern for blanks / distractors. */
function patternCore(pattern) {
  let s = String(pattern || "")
    .replace(/[〜～…\.．]/g, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/\s+/g, "")
    .trim();
  // Prefer longest kana/kanji run
  const runs = s.match(/[\u3040-\u30ff\u3400-\u9fffー]+/g) || [];
  if (!runs.length) return s.slice(0, 12) || "〜";
  return runs.sort((a, b) => b.length - a.length)[0];
}

function blankSentence(ja, core) {
  if (!ja) return `____ （${core}）`;
  if (core && ja.includes(core)) {
    return ja.replace(core, "____");
  }
  // Try shorter cores (particles often 1–2 chars at end of pattern)
  for (let n = core.length - 1; n >= 1; n--) {
    const sub = core.slice(-n);
    if (sub.length >= 1 && ja.includes(sub)) {
      return ja.replace(sub, "____");
    }
  }
  return `${ja}\n→ điền dạng: ____`;
}

function seededRand(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return () => {
    h = (h * 1664525 + 1013904223) >>> 0;
    return h / 4294967296;
  };
}

function uniqueChoices(correct, pool, seed, n = 4) {
  const rnd = seededRand(seed);
  const choices = [correct];
  const shuffledPool = [...pool].sort(() => rnd() - 0.5);
  for (const c of shuffledPool) {
    if (choices.length >= n) break;
    if (c && !choices.includes(c)) choices.push(c);
  }
  const pads = ["です", "ます", "ない", "た", "て", "が", "を", "に", "で", "と", "から", "まで"];
  for (const p of pads) {
    if (choices.length >= n) break;
    if (!choices.includes(p)) choices.push(p);
  }
  const out = choices.slice(0, n);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return { choices: out, answer: Math.max(0, out.indexOf(correct)) };
}

function convertGrammar(entries, levelCores) {
  return entries.map((g) => {
    const core = patternCore(g.pattern);
    const ex = g.examples?.[0];
    const prompt = blankSentence(ex?.ja || g.formation || g.pattern, core);
    const distractors = levelCores.filter((c) => c !== core);
    const { choices, answer } = uniqueChoices(core, distractors, g.id);
    const tags = Array.isArray(g.tags) ? g.tags.filter(Boolean) : [];
    return {
      id: `oj-${g.id}`,
      level: g.level,
      pattern: g.pattern,
      prompt,
      meaning: g.meaning,
      choices,
      answer,
      tags,
      note: [g.formation, g.notes, ex?.en].filter(Boolean).join(" · ").slice(0, 280),
    };
  });
}

const POS_VI = {
  noun: "danh từ",
  verb: "động từ",
  adjective: "tính từ",
  adverb: "trạng từ",
  preposition: "giới từ",
  pronoun: "đại từ",
  conjunction: "liên từ",
  determiner: "hạn định từ",
  interjection: "thán từ",
  number: "số từ",
  "modal verb": "động từ tình thái",
  "auxiliary verb": "trợ động từ",
  "indefinite pronoun": "đại từ bất định",
  "relative pronoun": "đại từ quan hệ",
  "definite article": "mạo từ xác định",
  "indefinite article": "mạo từ không xác định",
  article: "mạo từ",
  quantifier: "lượng từ",
  exclamation: "thán từ",
};

function parseCsvLine(line) {
  const cols = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      q = !q;
      continue;
    }
    if (ch === "," && !q) {
      cols.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  cols.push(cur);
  return cols;
}

const CEFR_ORDER = ["A1", "A2", "B1", "B2", "C1", "C2"];
const CEFR_ALLOWED = new Set(CEFR_ORDER);

function importCefrjFile(fileName, sourceLabel) {
  const file = path.join(RAW, fileName);
  if (!fs.existsSync(file)) {
    console.warn("skip missing", fileName);
    return [];
  }
  const text = fs.readFileSync(file, "utf8");
  const lines = text.trim().split(/\r?\n/).slice(1);
  const seen = new Set();
  const out = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const [headword, pos, cefr] = parseCsvLine(line);
    if (!headword || !cefr || !CEFR_ALLOWED.has(cefr)) continue;
    const key = `${headword.toLowerCase()}|${(pos || "").toLowerCase()}|${cefr}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const id = "cefrj-" + crypto.createHash("sha1").update(key).digest("hex").slice(0, 10);
    const posKey = (pos || "").toLowerCase();
    const posVi = POS_VI[posKey] || pos || "từ";
    out.push({
      id,
      word: headword,
      pos: pos || "",
      level: cefr,
      meanings: [posVi, `EN · ${sourceLabel} ${cefr}`, headword],
    });
  }
  return out;
}

function importCefrj() {
  // Prefer new downloads; fall back to legacy cefrj.csv (A1–A2 only).
  const primary = fs.existsSync(path.join(RAW, "cefrj-en.csv"))
    ? importCefrjFile("cefrj-en.csv", "CEFR-J")
    : importCefrjFile("cefrj.csv", "CEFR-J");
  const advanced = importCefrjFile("cefrj-c1c2.csv", "Octanove");
  const byKey = new Map();
  for (const row of [...primary, ...advanced]) {
    const key = `${row.word.toLowerCase()}|${(row.pos || "").toLowerCase()}|${row.level}`;
    if (!byKey.has(key)) byKey.set(key, row);
  }
  const out = [...byKey.values()];
  out.sort(
    (a, b) =>
      CEFR_ORDER.indexOf(a.level) - CEFR_ORDER.indexOf(b.level) ||
      a.word.localeCompare(b.word),
  );
  return out;
}

function slimKanji(entries) {
  return entries.map((k) => ({
    character: k.character,
    level: k.level,
    meanings: (k.meanings || []).slice(0, 6),
    onyomi: k.onyomi || [],
    kunyomi: k.kunyomi || [],
    strokes: k.strokes,
    words: (k.words || []).slice(0, 8),
  }));
}

/** Hand-expanded EN grammar drills (A1–B2) — CEFR-style, unofficial. */
function buildEnGrammar() {
  const items = [
    // A1
    ["A1", "be (am/is/are)", "I ___ a student.", "Copula present", ["am", "is", "are", "be"], 0, "I + am"],
    ["A1", "be (am/is/are)", "She ___ my friend.", "Copula present", ["am", "is", "are", "be"], 1, "She/he/it + is"],
    ["A1", "be (am/is/are)", "They ___ at home.", "Copula present", ["am", "is", "are", "be"], 2, "They/we/you + are"],
    ["A1", "a / an", "I have ___ apple.", "Indefinite article", ["a", "an", "the", "some"], 1, "an + vowel sound"],
    ["A1", "a / an", "This is ___ book.", "Indefinite article", ["a", "an", "the", "-"], 0, "a + consonant"],
    ["A1", "the", "___ sun is hot.", "Definite article", ["A", "An", "The", "-"], 2, "unique things: the"],
    ["A1", "This / That", "___ is my bag (near me).", "Demonstrative", ["This", "That", "These", "Those"], 0, "this = near"],
    ["A1", "These / Those", "___ are my keys (near).", "Demonstrative plural", ["This", "That", "These", "Those"], 2, "these = near plural"],
    ["A1", "Possessive adjectives", "This is ___ pen (I).", "my/your/his…", ["my", "me", "I", "mine"], 0, "adjective form: my"],
    ["A1", "Possessive adjectives", "Is this ___ book (you)?", "my/your/his…", ["you", "your", "yours", "you're"], 1, "your + noun"],
    ["A1", "There is / are", "There ___ a cat on the sofa.", "Existence", ["is", "are", "have", "has"], 0, "singular → is"],
    ["A1", "There is / are", "There ___ three books here.", "Existence", ["is", "are", "have", "has"], 1, "plural → are"],
    ["A1", "Present simple", "I ___ English every day.", "Habit", ["study", "studies", "studying", "studied"], 0, "I/you/we/they + base"],
    ["A1", "Present simple", "He ___ TV at night.", "Habit 3rd person", ["watch", "watches", "watching", "watched"], 1, "he/she/it + -s"],
    ["A1", "Present simple negative", "I ___ like coffee.", "don't / doesn't", ["don't", "doesn't", "not", "no"], 0, "I/you/we/they + don't"],
    ["A1", "Present simple negative", "She ___ eat meat.", "don't / doesn't", ["don't", "doesn't", "isn't", "aren't"], 1, "he/she/it + doesn't"],
    ["A1", "Yes/No questions", "___ you like pizza?", "Do/Does", ["Do", "Does", "Are", "Is"], 0, "Do + you"],
    ["A1", "Yes/No questions", "___ she work here?", "Do/Does", ["Do", "Does", "Are", "Is"], 1, "Does + he/she/it"],
    ["A1", "Wh- questions", "___ is your name?", "Question words", ["What", "Where", "When", "Who"], 0, "What for things"],
    ["A1", "Wh- questions", "___ do you live?", "Question words", ["What", "Where", "When", "Who"], 1, "Where for place"],
    ["A1", "can (ability)", "I ___ swim.", "Ability", ["can", "cans", "could", "must"], 0, "can + base verb"],
    ["A1", "can (ability)", "___ you help me?", "Ability question", ["Can", "Do", "Are", "Must"], 0, "Can + subject"],
    ["A1", "like + noun/-ing", "I like ___ music.", "Preferences", ["listen", "listening", "listened", "listens"], 1, "like + -ing / noun"],
    ["A1", "Prepositions of place", "The book is ___ the table.", "in/on/under", ["in", "on", "at", "to"], 1, "on a surface"],
    ["A1", "Prepositions of place", "She is ___ school.", "in/on/at", ["in", "on", "at", "to"], 2, "at school/work"],
    ["A1", "and / but / or", "I like tea ___ coffee.", "Linking", ["and", "but", "or", "so"], 2, "choice → or"],
    ["A1", "Object pronouns", "Please call ___.", "me/him/her…", ["I", "me", "my", "mine"], 1, "object: me"],
    ["A1", "have / has", "She ___ two brothers.", "Possession", ["have", "has", "having", "had"], 1, "he/she/it + has"],
    ["A1", "Imperatives", "___ the door, please.", "Commands", ["Open", "Opens", "Opening", "Opened"], 0, "base form"],
    ["A1", "Adverbs of frequency", "I ___ drink tea.", "always/usually…", ["always", "yesterday", "ago", "yet"], 0, "before main verb"],

    // A2
    ["A2", "Present continuous", "She ___ coffee now.", "happening now", ["drink", "drinks", "is drinking", "drank"], 2, "be + -ing"],
    ["A2", "Present continuous", "___ you working today?", "Question", ["Do", "Does", "Are", "Is"], 2, "Are + you + -ing"],
    ["A2", "Past simple (be)", "I ___ tired yesterday.", "was/were", ["am", "was", "were", "be"], 1, "I/he/she/it + was"],
    ["A2", "Past simple (be)", "They ___ at home last night.", "was/were", ["was", "were", "are", "been"], 1, "you/we/they + were"],
    ["A2", "Past simple regular", "We ___ football yesterday.", "ed past", ["play", "played", "playing", "plays"], 1, "verb + -ed"],
    ["A2", "Past simple irregular", "I ___ a good book last week.", "irregular past", ["read", "reads", "reading", "readed"], 0, "read → read /rɛd/"],
    ["A2", "Past simple irregular", "She ___ to Paris in 2020.", "go → went", ["go", "goes", "went", "gone"], 2, "went"],
    ["A2", "Past simple negative", "I ___ go out yesterday.", "didn't", ["don't", "doesn't", "didn't", "wasn't"], 2, "didn't + base"],
    ["A2", "Past simple questions", "___ you see the film?", "Did", ["Do", "Does", "Did", "Are"], 2, "Did + subject + base"],
    ["A2", "going to (future)", "I ___ visit my aunt tomorrow.", "plans", ["am going to", "will to", "go to", "going"], 0, "be going to + verb"],
    ["A2", "will (future)", "I think it ___ rain.", "prediction", ["will", "going", "is", "does"], 0, "will + base"],
    ["A2", "Comparatives", "This bag is ___ than that one.", "-er / more", ["big", "bigger", "biggest", "more big"], 1, "short adj + -er"],
    ["A2", "Comparatives", "English is ___ interesting than I thought.", "more + adj", ["more", "most", "-er", "as"], 0, "long adj: more"],
    ["A2", "Superlatives", "This is the ___ café in town.", "-est / most", ["good", "better", "best", "well"], 2, "good → best"],
    ["A2", "Countable / uncountable", "I need ___ information.", "some/any/much", ["a", "an", "some", "many"], 2, "uncountable: some"],
    ["A2", "much / many", "How ___ apples do you want?", "quantity", ["much", "many", "a little", "bit"], 1, "many + plural"],
    ["A2", "much / many", "There isn't ___ milk left.", "quantity", ["much", "many", "a few", "several"], 0, "much + uncountable"],
    ["A2", "some / any", "Do you have ___ questions?", "some/any", ["some", "any", "a", "much"], 1, "any in questions"],
    ["A2", "should (advice)", "You ___ sleep more.", "advice", ["should", "must to", "can to", "will"], 0, "should + base"],
    ["A2", "have to", "I ___ wear a uniform at work.", "obligation", ["have to", "has to", "must to", "should to"], 0, "I/you/we/they have to"],
    ["A2", "Present perfect", "I have ___ finished my homework.", "just/already/yet", ["just", "ago", "yesterday", "last"], 0, "just + present perfect"],
    ["A2", "Present perfect", "Have you ___ been to Japan?", "ever/never", ["ever", "ago", "yet", "still"], 0, "ever in questions"],
    ["A2", "Present perfect vs past", "I ___ her yesterday.", "saw / have seen", ["see", "saw", "have seen", "seen"], 1, "finished time → past simple"],
    ["A2", "First conditional", "If it rains, we ___ stay home.", "real future", ["will", "would", "would have", "are"], 0, "if + present, will"],
    ["A2", "because / so", "I stayed home ___ I was ill.", "reason", ["so", "because", "but", "or"], 1, "because + reason"],
    ["A2", "too / enough", "This box is ___ heavy.", "too + adj", ["too", "enough", "very enough", "so enough"], 0, "too + adjective"],
    ["A2", "too / enough", "He isn't old ___ to drive.", "adj + enough", ["too", "enough", "so", "very"], 1, "adj + enough"],
    ["A2", "adverbs of manner", "She speaks English ___.", "-ly", ["good", "well", "nice", "bad"], 1, "well (irregular)"],
    ["A2", "Prepositions of time", "I was born ___ 1999.", "in/on/at", ["in", "on", "at", "to"], 0, "in + year"],
    ["A2", "Prepositions of time", "See you ___ Monday.", "in/on/at", ["in", "on", "at", "to"], 1, "on + day"],
    ["A2", "used to", "I ___ play tennis when I was a child.", "past habit", ["used to", "use to", "am used to", "using to"], 0, "used to + base"],

    // B1
    ["B1", "Present perfect continuous", "I ___ for two hours.", "have been + -ing", ["study", "studied", "have been studying", "am studying"], 2, "duration to now"],
    ["B1", "Past continuous", "I ___ when you called.", "was/were + -ing", ["slept", "was sleeping", "have slept", "sleep"], 1, "interrupted past"],
    ["B1", "Past perfect", "She ___ left before I arrived.", "had + PP", ["has", "had", "have", "was"], 1, "earlier past: had"],
    ["B1", "Second conditional", "If I ___ rich, I would travel.", "unreal present", ["am", "was", "were", "be"], 2, "If I were…"],
    ["B1", "Second conditional", "If she studied more, she ___ pass.", "would + base", ["will", "would", "would have", "can"], 1, "would + verb"],
    ["B1", "Passive present", "English ___ around the world.", "is + PP", ["speaks", "is spoken", "spoke", "speaking"], 1, "is/are + past participle"],
    ["B1", "Passive past", "The window ___ yesterday.", "was + PP", ["broke", "was broken", "is broken", "breaking"], 1, "was/were + PP"],
    ["B1", "Reported speech", "He said he ___ tired.", "backshift", ["is", "was", "be", "were being"], 1, "present → past"],
    ["B1", "Relative clauses", "The man ___ lives next door is a doctor.", "who/which/that", ["who", "which", "where", "whose"], 0, "who for people"],
    ["B1", "Relative clauses", "This is the book ___ I bought.", "who/which/that", ["who", "which", "where", "whose"], 1, "which/that for things"],
    ["B1", "Modals of deduction", "He ___ be at home — the lights are on.", "must/might/can't", ["must", "can't", "mustn't", "should to"], 0, "must = strong certainty"],
    ["B1", "Modals of deduction", "She ___ be French — she doesn't speak French.", "must/might/can't", ["must", "might", "can't", "should"], 2, "can't = impossible"],
    ["B1", "Gerunds / infinitives", "I enjoy ___ films.", "-ing after enjoy", ["watch", "to watch", "watching", "watched"], 2, "enjoy + -ing"],
    ["B1", "Gerunds / infinitives", "I decided ___ early.", "to + verb", ["leave", "to leave", "leaving", "left"], 1, "decide + to"],
    ["B1", "wish (present)", "I wish I ___ more time.", "unreal present", ["have", "had", "will have", "am having"], 1, "wish + past"],
    ["B1", "although / despite", "___ it was raining, we went out.", "contrast", ["Although", "Despite", "Because", "So"], 0, "Although + clause"],
    ["B1", "so / such", "It was ___ a good film.", "so/such", ["so", "such", "too", "enough"], 1, "such + a + adj + noun"],
    ["B1", "Question tags", "You're tired, ___?", "tags", ["are you", "aren't you", "do you", "don't you"], 1, "positive → negative tag"],
    ["B1", "Present perfect for / since", "I have lived here ___ 2019.", "for/since", ["for", "since", "during", "ago"], 1, "since + point in time"],
    ["B1", "Present perfect for / since", "We have studied ___ three years.", "for/since", ["for", "since", "during", "ago"], 0, "for + period"],

    // B2
    ["B2", "Third conditional", "If I had studied, I ___ passed.", "unreal past", ["will have", "would", "would have", "had"], 2, "would have + PP"],
    ["B2", "Mixed conditional", "If I had taken that job, I ___ in London now.", "past→present", ["will be", "would be", "would have been", "am"], 1, "would + present"],
    ["B2", "wish (past)", "I wish I ___ harder at school.", "regret", ["study", "studied", "had studied", "have studied"], 2, "wish + past perfect"],
    ["B2", "Passive causative", "I ___ my hair cut yesterday.", "have/get something done", ["had", "have", "made", "did"], 0, "had + object + PP"],
    ["B2", "Future perfect", "By next year I ___ graduated.", "will have + PP", ["will", "will have", "have", "am"], 1, "will have + past participle"],
    ["B2", "Future continuous", "This time tomorrow I ___ on a plane.", "will be + -ing", ["will sit", "will be sitting", "sit", "am sitting"], 1, "will be + -ing"],
    ["B2", "Inversion (rarely)", "Rarely ___ such a view.", "inversion", ["I see", "do I see", "I saw", "have I"], 1, "negative adverb + aux + subject"],
    ["B2", "Cleft sentences", "___ I need is more time.", "What/It cleft", ["What", "That", "Which", "Who"], 0, "What … is …"],
    ["B2", "Participle clauses", "___ the news, she started crying.", "-ing clause", ["Hearing", "Heard", "Hear", "To hear"], 0, "-ing = same time / cause"],
    ["B2", "Advanced modals", "You ___ have told me earlier!", "criticism", ["should", "must", "can", "will"], 0, "should have + PP"],

    // Extra A1
    ["A1", "Numbers", "There are ___ students in the class.", "cardinals", ["twelve", "twelfth", "twelves", "dozen of"], 0, "cardinal for count"],
    ["A1", "Days / months", "My birthday is in ___.", "months", ["Monday", "July", "morning", "o'clock"], 1, "in + month"],
    ["A1", "Telling the time", "It's half ___ six.", "time", ["to", "past", "at", "of"], 1, "half past"],
    ["A1", "want / need", "I ___ a new phone.", "want/need", ["want", "wants", "wanting", "wanted"], 0, "I + want"],
    ["A1", "would like", "I ___ like a coffee, please.", "polite request", ["will", "would", "do", "am"], 1, "would like"],
    ["A1", "Let's", "___ go to the park.", "suggestion", ["Let's", "Let", "Lets", "Letting"], 0, "Let's + base"],
    ["A1", "How much / many", "___ is this shirt?", "price", ["How many", "How much", "How long", "How often"], 1, "How much for price"],
    ["A1", "Subject pronouns", "___ is a teacher (she).", "pronouns", ["He", "She", "They", "We"], 1, "she"],
    ["A1", "Plural nouns", "I have two ___.", "regular plural", ["box", "boxes", "boxs", "boxies"], 1, "x → es"],
    ["A1", "Present simple frequency", "She ___ goes to the gym.", "adverbs", ["usual", "usually", "use", "used"], 1, "usually before verb"],

    // Extra A2
    ["A2", "somebody / anybody", "Is ___ at home?", "indefinite", ["somebody", "anybody", "nobody", "everybody"], 1, "any in questions"],
    ["A2", "something / anything", "I didn't buy ___.", "indefinite", ["something", "anything", "everything", "nothing"], 1, "any in negatives"],
    ["A2", "could (past ability)", "When I was five I ___ swim.", "past ability", ["can", "could", "must", "should"], 1, "could = past can"],
    ["A2", "might (possibility)", "It ___ rain later.", "possibility", ["might", "must to", "can to", "shall"], 0, "might + base"],
    ["A2", "must (obligation)", "You ___ wear a seatbelt.", "obligation", ["must", "must to", "can", "might"], 0, "must + base"],
    ["A2", "as … as", "This test is ___ hard as the last one.", "equality", ["as", "so", "too", "more"], 0, "as + adj + as"],
    ["A2", "both / neither", "___ of them like coffee.", "quantifiers", ["Both", "Neither", "Either", "All"], 0, "both = two affirmative"],
    ["A2", "still / yet / already", "Have you finished ___?", "aspect adverbs", ["still", "yet", "already", "just ago"], 1, "yet in questions/negatives"],
    ["A2", "still / yet / already", "I've ___ seen that film.", "aspect adverbs", ["still", "yet", "already", "ago"], 2, "already = sooner than expected"],
    ["A2", "Infinitive of purpose", "I went to the shop ___ milk.", "to + verb", ["buy", "to buy", "buying", "bought"], 1, "to + purpose"],
    ["A2", "look / feel / seem", "You ___ tired today.", "linking verbs", ["look", "looks", "looking", "looked"], 0, "you look + adj"],
    ["A2", "Present continuous future", "I ___ meeting her at 6.", "arranged future", ["am", "will", "do", "have"], 0, "be + -ing for plans"],
    ["A2", "Whose", "___ bag is this?", "possession question", ["Who", "Whose", "Which", "Whom"], 1, "Whose + noun"],
    ["A2", "each / every", "___ student has a book.", "distributives", ["Each", "Every of", "All of them", "Both"], 0, "each + singular"],

    // Extra B1
    ["B1", "used to vs be used to", "I'm ___ getting up early now.", "be used to", ["used to", "use to", "used to be", "being used"], 0, "be used to + -ing"],
    ["B1", "make / let / allow", "My parents won't ___ me go out late.", "causatives", ["make", "let", "allow", "permit to"], 1, "let + object + base"],
    ["B1", "have something done", "We're ___ the house painted next week.", "causative", ["having", "making", "doing", "letting"], 0, "have + object + PP"],
    ["B1", "Defining relative", "That's the woman ___ I told you about.", "that/who/whom", ["which", "where", "that", "whose"], 2, "that for people/things"],
    ["B1", "Non-defining relative", "Paris, ___ is in France, is beautiful.", "which", ["who", "which", "that", "where"], 1, "which + comma clause"],
    ["B1", "able to / managed to", "I finally ___ open the door.", "success", ["could", "managed to", "can", "may"], 1, "managed to = succeeded"],
    ["B1", "in case", "Take an umbrella ___ it rains.", "precaution", ["if", "in case", "unless", "when"], 1, "in case = precaution"],
    ["B1", "unless", "I won't go ___ you come with me.", "condition", ["if", "unless", "when", "while"], 1, "unless = if not"],
    ["B1", "by the time", "___ the time we arrived, the film had started.", "time clause", ["By", "Until", "During", "While"], 0, "by the time"],
    ["B1", "while / during / for", "I slept ___ the flight.", "time prepositions", ["while", "during", "for", "since"], 1, "during + noun"],
    ["B1", "Reported questions", "She asked me where I ___.", "reported speech", ["live", "lived", "do live", "am living"], 1, "backshift in reports"],
    ["B1", "advise / suggest", "I suggested ___ a break.", "verb patterns", ["take", "to take", "taking", "took"], 2, "suggest + -ing"],
    ["B1", "prefer / would rather", "I'd rather ___ home tonight.", "preference", ["stay", "to stay", "staying", "stayed"], 0, "would rather + base"],
    ["B1", "enough / too with nouns", "There isn't ___ time.", "quantity", ["enough", "too", "too many", "enough of"], 0, "enough + noun"],
    ["B1", "Purpose: so that", "I spoke slowly ___ everyone could understand.", "purpose", ["so that", "in order", "for", "because of"], 0, "so that + clause"],

    // Extra B2
    ["B2", "as if / as though", "He talks ___ he knew everything.", "comparison", ["as if", "even if", "as", "like if"], 0, "as if + unreal past"],
    ["B2", "It's time", "It's time we ___ home.", "subjunctive-ish", ["go", "went", "going", "to go"], 1, "It's time + past"],
    ["B2", "I'd rather + past", "I'd rather you ___ smoke here.", "preference about others", ["don't", "didn't", "not", "won't"], 1, "I'd rather + past"],
    ["B2", "Not only … but also", "Not only ___ late, but he also forgot the files.", "inversion", ["he was", "was he", "he is", "did he"], 1, "Not only + aux + subject"],
    ["B2", "Hardly … when", "Hardly ___ sat down when the phone rang.", "inversion", ["I had", "had I", "I have", "have I"], 1, "Hardly had + subject"],
    ["B2", "Despite / in spite of", "___ the rain, we went hiking.", "contrast", ["Despite", "Although", "Because", "However"], 0, "Despite + noun"],
    ["B2", "Nevertheless / however", "It was expensive; ___, we bought it.", "contrast linkers", ["nevertheless", "because", "so", "unless"], 0, "nevertheless = contrast"],
    ["B2", "Be supposed to", "You're ___ to wear a helmet.", "expectation", ["supposed", "suppose", "supposing", "allegedly"], 0, "be supposed to"],
    ["B2", "Needn't have", "You ___ have brought food — there's plenty.", "unnecessary past", ["needn't", "mustn't", "can't", "shouldn't to"], 0, "needn't have + PP"],
    ["B2", "Passive with reporting", "It ___ that the mayor will resign.", "impersonal passive", ["is said", "says", "said", "is saying"], 0, "It is said that"],
    ["B2", "Reduced relative", "The man ___ by the door is my uncle.", "participle relative", ["standing", "stood", "stands", "to stand"], 0, "-ing relative"],
    ["B2", "Emphatic do", "I ___ want to help, honestly.", "emphasis", ["do", "does", "did to", "am"], 0, "do + base for emphasis"],
    ["B2", "Whatever / whenever", "Call me ___ you need help.", "wh-ever", ["whatever", "whenever", "wherever", "whichever"], 1, "whenever = any time"],
    ["B2", "On + -ing", "___ arriving, she called her boss.", "time participle", ["On", "In", "At", "By"], 0, "On + -ing"],

    // C1
    ["C1", "Inversion after negative adverbials", "Under no circumstances ___ you open this door.", "formal inversion", ["should", "you should", "should you", "you"], 2, "neg. adverbial + aux + subject"],
    ["C1", "Cleft: It was … that", "___ was the manager that approved the deal.", "cleft", ["It", "What", "There", "This"], 0, "It was X that…"],
    ["C1", "Nominalisation", "The ___ of the project surprised everyone.", "noun from verb", ["cancel", "cancellation", "cancelled", "cancelling"], 1, "prefer noun forms in formal EN"],
    ["C1", "Hedging", "It ___ be argued that remote work boosts focus.", "academic hedging", ["can", "must", "will", "shall"], 0, "can/could/might be argued"],
    ["C1", "Subjunctive (formal)", "The board insisted that he ___ present.", "present subjunctive", ["be", "is", "was", "being"], 0, "insist that + base"],
    ["C1", "Fronting", "___ the proposal, the committee approved it.", "fronted object/clause", ["Impressed by", "Impressing", "To impress", "Impressed"], 0, "fronted participle clause"],
    ["C1", "Discourse markers", "The plan failed; ___, funding was cut.", "consequence", ["consequently", "meanwhile", "whereas", "lest"], 0, "consequently = result"],
    ["C1", "Mixed conditionals advanced", "If she ___ more carefully, she wouldn't be in trouble now.", "past→present", ["drove", "had driven", "drives", "would drive"], 1, "past perfect + would"],
    ["C1", "Ellipsis / substitution", "I asked her to help, and she ___.", "substitution", ["did", "helped to", "does", "was"], 0, "did = substituted verb"],
    ["C1", "Complex relative with preposition", "The issue ___ which we disagreed remains open.", "prep + which", ["on", "about", "for", "to"], 0, "disagree on"],
    ["C1", "Binomials / fixed pairs", "The contract is null and ___.", "fixed pairs", ["void", "empty", "invalidly", "none"], 0, "null and void"],
    ["C1", "Register shift", "Customers are ___ to wait outside.", "formal passive", ["requested", "told casually", "gonna ask", "wanting"], 0, "are requested to"],
    ["C1", "Concessive inversion", "Difficult ___ it may seem, the task is doable.", "as/though inversion", ["though", "as", "so", "if"], 1, "adj + as/though + clause"],
    ["C1", "Future in the past", "She said she ___ call later.", "reported future", ["will", "would", "is going", "calls"], 1, "would for future-in-past"],
    ["C1", "Advanced participle", "___ carefully, the report reveals several gaps.", "viewed/read", ["Read", "Reading", "To read", "Having read"], 0, "past participle = passive sense"],

    // C2 (small unofficial set)
    ["C2", "Much as / Much though", "___ it may seem odd, the rule stands.", "formal concessive", ["Much as", "Much than", "As much", "So much"], 0, "Much as = although"],
    ["C2", "Irrevocable / formal lexis", "The board's decision was ___.", "advanced adjective", ["irrevocable", "irrelevant", "irregular", "irritable"], 0, "cannot be reversed"],
    ["C2", "Circumvent", "They tried to ___ the regulation.", "advanced verb", ["circumvent", "circulate", "circumstance", "circuit"], 0, "find a way around"],
    ["C2", "Opaque", "His remarks were somewhat ___ to newcomers.", "advanced adjective", ["opaque", "open", "obvious", "oral"], 0, "hard to understand"],
    ["C2", "Perspicacious", "A ___ reader spotted the inconsistency.", "advanced adjective", ["perspicacious", "persuasive", "pervasive", "perfunctory"], 0, "keen insight"],
    ["C2", "Empty rhetoric", "The speech was full of empty ___.", "advanced noun", ["rhetoric", "rhythm", "routine", "residue"], 0, "pretentious language"],
    ["C2", "Lest", "Speak softly ___ you wake the baby.", "formal conjunction", ["lest", "unless", "until", "whilst"], 0, "lest = for fear that"],
    ["C2", "Were it not for", "___ her help, we would have failed.", "inverted conditional", ["Were it not for", "Was it not for", "If it were not", "Had it not"], 0, "Were it not for + noun"],
    ["C2", "Insofar as", "The plan works ___ funding continues.", "formal linker", ["insofar as", "in as far", "as so far", "so insofar"], 0, "to the extent that"],
    ["C2", "Be that as it may", "___, we must still decide today.", "discourse marker", ["Be that as it may", "Be it may", "That be may", "May that be"], 0, "nevertheless"],
    ["C2", "Qua", "She spoke ___ expert, not as a friend.", "formal as", ["qua", "quasi", "quit", "quite"], 0, "qua = in the capacity of"],
    ["C2", "Suffice it to say", "___, the meeting did not go well.", "formal hedge", ["Suffice it to say", "Suffice to saying", "Sufficient say", "It suffices saying"], 0, "enough to say that"],
    ["C2", "Notwithstanding", "___ the risks, they proceeded.", "formal preposition", ["Notwithstanding", "Nevertheless the", "Although of", "Despite of"], 0, "despite"],
    ["C2", "Whereby", "A system ___ users share keys was proposed.", "relative", ["whereby", "wherein", "whereas", "whereof"], 0, "by which"],
    ["C2", "Albeit", "The result was positive, ___ modest.", "concessive", ["albeit", "although it", "all be it", "howbeit that"], 0, "albeit = although"],

    // Extra B2–C2 depth
    ["B2", "Would rather + past perfect", "I'd rather you ___ told me earlier.", "preference past", ["have", "had", "has", "did"], 1, "I'd rather + past perfect"],
    ["B2", "As if / as though + past", "He talks as if he ___ the boss.", "unreal comparison", ["is", "were", "be", "was being"], 1, "as if + past"],
    ["B2", "By the time + past perfect", "By the time we arrived, the film ___.", "earlier past", ["started", "had started", "has started", "starts"], 1, "by the time + past perfect"],
    ["B2", "In case vs if", "Take an umbrella ___ it rains.", "precaution", ["in case", "if only", "unless", "whether"], 0, "in case = precaution"],
    ["B2", "Used to vs be used to", "I'm ___ getting up early now.", "habit now", ["used to", "use to", "used", "being used"], 0, "be used to + -ing"],
    ["B2", "Have something done", "I ___ my car repaired yesterday.", "causative", ["had", "have", "made", "let"], 0, "have/get + object + PP"],
    ["B2", "Wish + would", "I wish you ___ stop smoking.", "annoyance", ["will", "would", "can", "may"], 1, "wish + would"],
    ["B2", "Prefer … to …", "I prefer tea ___ coffee.", "preference", ["to", "than", "from", "over than"], 0, "prefer X to Y"],
    ["B2", "So / such that", "It was ___ a difficult exam that many failed.", "result", ["so", "such", "too", "very"], 1, "such a + adj + noun"],
    ["B2", "Neither … nor", "Neither the manager ___ the staff knew.", "correlative", ["or", "nor", "and", "but"], 1, "neither … nor"],
    ["B2", "No sooner … than", "No sooner ___ we left than it rained.", "inversion", ["had", "have", "did", "were"], 0, "No sooner had … than"],
    ["B2", "Participle clauses", "___ the news, she smiled.", "time participle", ["Hearing", "Heard", "To hear", "Hears"], 0, "-ing clause"],
    ["C1", "Inversion: Little did", "Little ___ we know what would happen.", "formal inversion", ["did", "do", "had", "have"], 0, "Little did + subject"],
    ["C1", "What cleft", "___ I need is more time.", "cleft", ["What", "That", "Which", "How"], 0, "What … is …"],
    ["C1", "Should you …", "___ you need help, call me.", "formal conditional", ["Should", "Would", "Might", "Could you"], 0, "Should you = if you"],
    ["C1", "Be + to-infinitive", "You ___ to report by Friday.", "formal obligation", ["are", "is", "be", "were"], 0, "be to + infinitive"],
    ["C1", "Given that", "___ that budgets are tight, we delayed hiring.", "formal reason", ["Given", "Giving", "Gave", "Give"], 0, "Given that"],
    ["C1", "Insofar / inasmuch", "The claim holds ___ as the data are accurate.", "extent", ["insofar", "insomuch", "in so", "as far so"], 0, "insofar as"],
    ["C1", "Participle: having + PP", "___ finished, she left.", "perfect participle", ["Having", "Have", "Had", "To have"], 0, "Having + PP"],
    ["C1", "Rather than + bare/ -ing", "Rather than ___, we waited.", "preference", ["complain", "complaining", "to complain", "complained"], 0, "rather than + bare verb"],
    ["C1", "Were to", "If she ___ to resign, who would replace her?", "hypothetical", ["were", "was", "is", "be"], 0, "if … were to"],
    ["C1", "Double comparative", "The ___ you practice, the better you get.", "correlation", ["more", "most", "much", "many"], 0, "The more … the …"],
    ["C2", "Come what may", "___, we will finish on time.", "formal resolve", ["Come what may", "Come may what", "What come may", "May come what"], 0, "come what may"],
    ["C2", "Suffice to say (variant)", "___ that negotiations failed.", "hedge", ["Suffice it to say", "Suffice saying", "It suffices say", "Sufficient it say"], 0, "suffice it to say"],
    ["C2", "Be that as it may (use)", "The plan is risky; ___, we proceed.", "discourse", ["be that as it may", "be it may", "that be as may", "may that be"], 0, "nevertheless"],
    ["C2", "To wit", "One issue, ___ funding, blocked progress.", "formal namely", ["to wit", "to wet", "to with", "twit"], 0, "to wit = namely"],
    ["C2", "Per se", "The idea isn't bad ___.", "in itself", ["per se", "per say", "as se", "pro se"], 0, "per se"],
    ["C2", "Vis-à-vis", "Our position ___ competitors is strong.", "formal relative to", ["vis-à-vis", "vice versa", "versus to", "via"], 0, "vis-à-vis"],
    ["C2", "Ipso facto", "He signed; ___, he agreed.", "formal thus", ["ipso facto", "ipso fact", "facto ipso", "de facto only"], 0, "ipso facto"],
    ["C2", "Notwithstanding (clause)", "___ objections, the motion passed.", "formal despite", ["Notwithstanding", "Nevertheless of", "Although of", "Despite of"], 0, "notwithstanding + noun"],
    ["C2", "Whereby (system)", "A protocol ___ keys rotate weekly was adopted.", "relative", ["whereby", "wherein", "whereas", "whereof"], 0, "whereby"],
    ["C2", "In as much as", "Liable ___ as they ignored warnings.", "formal extent", ["inasmuch", "in as much", "insomuch only", "as much in"], 0, "inasmuch as"],
    ["C2", "Were it not (clause)", "___ for the delay, we would have won.", "inversion", ["Were it not", "Was it not", "Had it not been only", "If not were"], 0, "Were it not for"],
    ["C2", "Lest anyone", "Lock the door ___ anyone enter.", "formal fear", ["lest", "unless", "until", "so that not"], 0, "lest + subjunctive"],
    ["C2", "Far be it from me", "___ to criticize, but…", "formal hedge", ["Far be it from me", "Far it be from me", "Be far from me", "Far from be it"], 0, "far be it from me"],
  ];

  return items.map((row, i) => {
    const [level, pattern, prompt, meaning, choices, answer, note] = row;
    return {
      id: `g-en-${i + 1}`,
      level,
      pattern,
      prompt,
      meaning,
      choices,
      answer,
      note: `Unofficial CEFR-style · ${note}`,
    };
  });
}

function existsRaw(name) {
  return fs.existsSync(path.join(RAW, name));
}

// —— run ——
const levels = ["n5", "n4", "n3", "n2", "n1"];

if (levels.every((lv) => existsRaw(`vocab-${lv}.json`))) {
  for (const lv of levels) {
    const raw = readJson(`vocab-${lv}.json`);
    writeJson(`openjlpt-${lv}-seed.json`, slimVocab(raw));
  }
} else {
  console.log("skip JP vocab (raw vocab-*.json missing)");
}

if (levels.every((lv) => existsRaw(`grammar-${lv}.json`))) {
  const allGrammar = [];
  for (const lv of levels) {
    allGrammar.push(...readJson(`grammar-${lv}.json`));
  }
  const byLevel = Object.fromEntries(
    ["N5", "N4", "N3", "N2", "N1"].map((L) => [
      L,
      allGrammar.filter((g) => g.level === L).map((g) => patternCore(g.pattern)),
    ]),
  );
  const grammarJp = allGrammar.map((g) => {
    const converted = convertGrammar([g], byLevel[g.level] || [])[0];
    return converted;
  });
  writeJson("grammar-jp.json", grammarJp);
} else {
  console.log("skip JP grammar (raw grammar-*.json missing)");
}

for (const lv of levels) {
  const name = `kanji-${lv}.json`;
  if (!existsRaw(name)) continue;
  writeJson(`openjlpt-kanji-${lv}.json`, slimKanji(readJson(name)));
}

const cefrj = importCefrj();
writeJson("cefrj-vocab-seed.json", cefrj);
if (fs.existsSync(path.join(OUT, "cefrj-a1a2-seed.json"))) {
  fs.unlinkSync(path.join(OUT, "cefrj-a1a2-seed.json"));
  console.log("removed legacy cefrj-a1a2-seed.json");
}

const grammarEn = buildEnGrammar();
writeJson("grammar-en.json", grammarEn);

const byLv = Object.fromEntries(CEFR_ORDER.map((L) => [L, cefrj.filter((w) => w.level === L).length]));
console.log("EN vocab by level", byLv);
console.log("EN grammar", grammarEn.length);
console.log("done");
