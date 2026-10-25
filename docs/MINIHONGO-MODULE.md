# MiniHongo as an optional module

Study Desk **does not require** MiniHongo to learn Japanese. JP content currently comes from **OpenJLPT** seeds in-repo.

Revive [miNihongo](https://github.com/LLLVPN4423/miNihongo) only when you need:

- a **.NET MAUI** mobile client, and/or
- a richer **C# API** for vocab/kanji beyond static OpenJLPT JSON

## Suggested contract (later)

```
GET /api/v1/vocab?level=N5&limit=100
GET /api/v1/kanji?level=N5
GET /api/v1/vocab/{id}
```

Study Desk would:

1. Map remote ids → local `sourceId`
2. Refresh gloss/readings from API
3. **Keep local FSRS / review state** on Study Desk (or shared user account later)

## When not to build it

If the product stays **web-only** with OpenJLPT + CEFR-J, skip MiniHongo and invest in Neon auth, export/import (already in Settings), and Phase 3 culture/rooms instead.
