# Study Desk backup format

**Current export version:** `2`  
**Legacy import:** `version: 1` still accepted (metadata only).

## Serialization choice

Blobs are stored in IndexedDB as **strings** (usually `data:` URLs). Backup v2 embeds the same strings inside a JSON object (`deskBlobs`).

| Approach | Pros | Cons |
|----------|------|------|
| **JSON + data URLs (chosen)** | Matches IDB schema; no new dependency; easy validate/diff | ~33% base64 overhead; large files → large JSON in memory |
| ZIP + binary parts | Smaller; streaming-friendly | Needs zip lib; harder partial validate in Settings |

## Version 2 shape

```json
{
  "version": 2,
  "exportedAt": "ISO-8601",
  "session": { "...": "SessionUser or null" },
  "desk": { "files": [/* metadata; bulky dataUrl/sourceDataUrl stripped */], "...": "..." },
  "learn": { "...": "LearnState" },
  "theme": "paper|moss|night",
  "deskBlobs": {
    "<fileId>": "data:application/pdf;base64,...",
    "source:<fileId>": "data:...",
    "content:<fileId>": "text or HTML",
    "ann:<fileId>": "[/* pdf annotations JSON */]",
    "wallpaper:custom": "data:image/..."
  },
  "blobMeta": {
    "<key>": {
      "role": "primary|source|content|annotations|wallpaper",
      "mime": "application/pdf",
      "originalName": "lecture.pdf",
      "size": 12345,
      "fileId": "<fileId>"
    }
  }
}
```

### IndexedDB mapping

| DB | Store | Key | Value |
|----|-------|-----|-------|
| `study-desk-blobs` | `files` | file id / `source:` / `content:` / `ann:` / `wallpaper:custom` | string |

File System Access handles (`study-desk-handles`) are **not** included — they are origin-specific and not portable.

## Restore rules

1. Validate JSON + version + unique file ids + non-empty blob strings.
2. **v2:** reject if any PDF/audio/image/doc file is missing its primary blob key.
3. Snapshot current `localStorage` desk/learn/session/theme.
4. Write all `deskBlobs` to IndexedDB; on any failure → restore LS snapshot and report failure (do not claim success).
5. Write desk/learn metadata to `localStorage` (import **overwrites** current desk/learn).
6. **v1:** restore metadata only; surface a legacy warning that binaries were not in the file.

## Compatibility

- Export always writes **v2**.
- Import accepts **v1** and **v2**.
- Unknown versions are rejected.
