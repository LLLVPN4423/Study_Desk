# Study Desk

Personal study workspace for documents and audio, plus placement-driven **Japanese** (JLPT-oriented) and **English** (IELTS/CEFR-oriented, Phase 2) learning paths with FSRS reviews.

**Unofficial practice — not affiliated with JLPT/IELTS.**

- **Local app:** `D:\download\study-desk`
- **GitHub:** https://github.com/LLLVPN4423/Study_Desk.git
- **UI reference:** Figma Make export in [`docs/figma`](docs/figma)

## Stack choice (Phase 1)

**Next.js only** (App Router). No ASP.NET in Phase 1.

| Layer | Choice | Cost |
|-------|--------|------|
| Web | Next.js 16 + TypeScript + Tailwind 4 | Free |
| Session / desk / SRS | Browser `localStorage` (Phase 1) | Free |
| SRS algorithm | `src/lib/fsrs-lite.ts` (swap to `ts-fsrs` when installed) | Free |
| JP vocab | OpenJLPT seed JSON (CC BY-SA 4.0) | Free |
| Audio | `howler.js` | Free |
| Host (optional) | Vercel Hobby | Free |
| DB later | Neon Free `DATABASE_URL` | Free tier |

Cloud Postgres + Better Auth can replace local session later without changing the UI.

## Quick start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

1. **Start free** → create a local session  
2. **Desk** → upload PDF/MP3, folders/tags, tasks, Pomodoro, themes, Meet/Zoom link, highlight→card  
3. **Learn JP** → placement → roadmap → SRS (OpenJLPT) → grammar → timed mock  
4. **Learn EN** → placement → roadmap → SRS (CEFR-J A1/A2) → grammar → timed mock  
5. Free = **1 active path**; Settings → enable **Pro flag** to keep JP+EN and extra mocks

## Env

Copy [`.env.example`](.env.example). Phase 1 runs without secrets. Optional later:

```
DATABASE_URL=postgresql://...
BETTER_AUTH_SECRET=generate-me
```

## Freemium (Free flags)

- 1 desk, ~50MB / 20 files  
- 1 active JP path  
- 20 SRS reviews / day  
- 30 dictionary lookups / day  

## Data attribution

See [ATTRIBUTION.md](ATTRIBUTION.md). OpenJLPT is CC BY-SA 4.0.

## Phase status

- **P1 done:** desk basics + JP path MVP  
- **Shipped:** JP N5–N1 vocab seeds, kanji N5–N2, EN CEFR-J + VI gloss, grammar, vocab+listening mocks (TTS), `ts-fsrs`, UI VI/EN toggle, culture, rooms (Meet/Zoom + LiveKit optional), backup  
- **$0 default:** `npm run dev` trên máy — không cần host/cloud  

## Hosting hợp lý (khi muốn share link — vẫn free)

| Mục tiêu | Gợi ý | Tiền |
|----------|--------|------|
| Chỉ tự học trên PC | `npm run dev` / `npm run build && npm start` local | 0đ |
| Demo online cho portfolio | **Vercel Hobby** (free) deploy Next.js | 0đ |
| Auth/DB nhiều máy sau này | Neon Free + Better Auth | 0đ (free tier) |
| Phòng học video | Meet/Zoom link (đã có) hoặc LiveKit Cloud free tier sau | 0đ |
| **Không cần ngay** | SePay, R2 trả phí, AI trả phí | tránh |

**Khuyến nghị hiện tại:** giữ local + backup JSON. Deploy Vercel chỉ khi cần URL công khai.

## MiniHongo

**Not required** for the web app. Optional mobile/API module — see [docs/MINIHONGO-MODULE.md](docs/MINIHONGO-MODULE.md).  


## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | ESLint |

Do not commit `.env`, `uploads/`, or large user files.
