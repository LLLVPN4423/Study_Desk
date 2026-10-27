/** Shared quality checks for Vietnamese gloss overlays. */

export const VI_DIACRITIC =
  /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđĐ]/;

export function hasVi(text) {
  return VI_DIACRITIC.test(String(text || ""));
}

function stripOuterParens(t) {
  const s = String(t || "").trim();
  const m = s.match(/^[(（]([^)）]+)[)）]\s*$/);
  return m ? m[1].trim() : s;
}

function looksLikeEnglishPhrase(t) {
  const s = String(t || "").trim();
  if (!s) return false;
  if (hasVi(s)) return false;
  if (!/^[A-Za-z0-9][A-Za-z0-9\s,',./;:!?\-()]+$/.test(s)) return false;
  const words = s.split(/\s+/).filter(Boolean);
  // Single short token may be VI without diacritics (mua, cao…)
  if (words.length === 1 && words[0].length <= 8) return false;
  return /[A-Za-z]{3}/.test(s);
}

/**
 * JP vocab: only reject empty / garbage / untranslated English leftovers.
 * Do NOT require diacritics — "con trai", "bao quanh" are valid VI.
 */
export function isBadJpVocab(vi, seed) {
  const t = String(vi || "").trim();
  if (!t) return true;
  if (/&#x|&#\d|MYMEMORY WARNING|QUERY LENGTH/i.test(t)) return true;

  const m = String((seed?.meanings && seed.meanings[0]) || "").trim();
  const mLow = m.toLowerCase();
  const tLow = t.toLowerCase();

  // Exact English copy (MT no-op) — allow tagged loanwords
  if (/từ mượn|từ quốc tế/i.test(t)) return false;
  if (m && tLow === mLow) {
    const isKana = /^[\u30A0-\u30FFー]+$/.test(String(seed?.word || ""));
    const loan = /^[A-Za-z][A-Za-z0-9\-']{0,24}$/.test(m);
    if (
      loan &&
      (isKana ||
        /^(kimono|judo|sushi|karaoke|tsunami|anime|manga|samurai|katakana|kana|spa|nylon|vitamin|lava|fax|whisky|whiskey|mike|cocktail|encore)$/i.test(
          m,
        ))
    ) {
      return false;
    }
    return true;
  }

  // Entire gloss is "(english meaning)"
  if (/^[(（].+[)）]$/.test(t)) {
    const inner = stripOuterParens(t);
    if (m && inner.toLowerCase() === mLow) return true;
    if (!hasVi(inner) && looksLikeEnglishPhrase(inner)) return true;
    // "(greeting)" style single English noun
    if (!hasVi(inner) && /^[A-Za-z][A-Za-z\s\-']+$/.test(inner)) return true;
  }

  return false;
}

const EN_POS_NOTES =
  /^(danh từ|động từ|tính từ|trạng từ|đại từ|giới từ|liên từ|thán từ|mạo từ|hạn định từ|trợ động từ|động từ khuyết thiếu|số từ|trợ từ|động từ to be|be-verb|noun|verb|adjective|adverb|pronoun|preposition|conjunction)$/i;

/** EN vocab: headword kept as "meaning" or "word (POS)" is NOT a real gloss. */
export function isBadEnVocab(vi, seed) {
  const t = String(vi || "").trim();
  if (!t) return true;
  if (/MYMEMORY WARNING|&#x|&#\d/i.test(t)) return true;
  const w = String(seed?.word || "").trim();
  const w0 = w.split("/")[0].trim();
  if (!w) return false;
  if (t.toLowerCase() === w.toLowerCase() || t.toLowerCase() === w0.toLowerCase()) {
    return true;
  }

  const m = t.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  if (m) {
    const head = m[1].trim().toLowerCase();
    const note = (m[2] || "").trim();
    if (head === w.toLowerCase() || head === w0.toLowerCase()) {
      // Only allow intentional loanword tag — NOT POS labels
      if (/^(từ quốc tế|từ mượn)$/i.test(note)) return false;
      if (EN_POS_NOTES.test(note)) return true;
      // "abandon (động từ)" etc.
      return true;
    }
  }

  // Gloss is basically the English headword + trailing junk, no real VI definition
  const first = (t.split(/[\s(/]/)[0] || "").toLowerCase();
  if (
    (first === w.toLowerCase() || first === w0.toLowerCase()) &&
    !hasVi(t.replace(EN_POS_NOTES, ""))
  ) {
    return true;
  }

  return false;
}

export function isBadGrammar(vi, seed) {
  const t = String(vi || "").trim();
  if (!t) return true;
  if (/MYMEMORY WARNING/i.test(t)) return true;
  const meaning = String(seed?.meaning || "").trim();
  const pattern = String(seed?.pattern || "").trim();
  // Unchanged English meaning/pattern
  if (meaning && t.toLowerCase() === meaning.toLowerCase()) return true;
  if (pattern && t.toLowerCase() === pattern.toLowerCase()) return true;
  if (hasVi(t)) return false;
  if (looksLikeEnglishPhrase(t)) return true;
  if (/\b(the|and|of|to|when|while|for|with|that|this|marks|topic|have been|past|present|cleft)\b/i.test(t)) {
    return true;
  }
  // Multi-word or long Latin leftover without VI (e.g. "go → went", "cleft sentence")
  // Keep short tokens like "theo", "như" — valid VI without diacritics
  const words = t.split(/\s+/).filter(Boolean);
  if (
    !hasVi(t) &&
    /^[A-Za-z]/.test(t) &&
    (words.length >= 2 || t.length > 10 || /→|->|\+/.test(t))
  ) {
    return true;
  }
  return false;
}

export function isBadKanji(vi, seed) {
  const t = String(vi || "").trim();
  if (!t) return true;
  if (/MYMEMORY|&#x|&#\d/i.test(t)) return true;
  const meanings = (seed?.meanings || []).map((x) => String(x).trim().toLowerCase());
  const m0 = meanings[0] || "";
  const tLow = t.toLowerCase();
  // Exact copy of any English meaning seed
  if (meanings.some((m) => m && tLow === m)) return true;
  // Exact join of EN meanings ("day; sun; Japan")
  if (meanings.length && tLow === meanings.join("; ")) return true;
  if (/^[(（].+[)）]$/.test(t)) {
    const inner = stripOuterParens(t);
    if (!hasVi(inner) && meanings.includes(inner.toLowerCase())) return true;
    if (!hasVi(inner) && /^[A-Za-z][A-Za-z\s;,\-']+$/.test(inner)) return true;
  }
  // Differ from EN → accept (includes VI without diacritics: "hoa sen", "mang thai")
  return false;
}
