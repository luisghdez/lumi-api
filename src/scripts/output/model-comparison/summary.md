# Model Comparison — AP Chemistry · Unit 1: Atomic Structure and Properties

Generated: 2026-06-20T19:11:50.078Z

## Per-Request Results

| Model | Time (s) | Input tokens | Output tokens | Cost for this unit |
|---|---|---|---|---|
| gpt-4.1-mini (baseline) | 13.4 | 1,432 | 2,200 | $0.0041 |
| gpt-5.4-mini | 9.1 | 1,428 | 2,571 | $0.0126 |
| gpt-4.1 | 10.2 | 1,432 | 2,102 | $0.0197 |
| gpt-5.4 | 16.4 | 1,428 | 2,955 | $0.0479 |
| gpt-5.5 (flagship) | 76.1 | 1,443 | 3,596 | $0.1151 |

## Projected Cost — Full Catalog (38 courses, ~323 units)

*Based on actual token usage from this unit scaled to the full catalog.*

| Model | Est. total cost | Est. time (4× concurrency) |
|---|---|---|
| gpt-4.1-mini (baseline) | **$1.32** | ~18 min |
| gpt-5.4-mini | **$4.08** | ~12 min |
| gpt-4.1 | **$6.36** | ~14 min |
| gpt-5.4 | **$15.47** | ~22 min |
| gpt-5.5 (flagship) | **$37.18** | ~103 min |

## Output Quality — Inspect the files below

Each model's outputs are saved next to this file:

- `gpt-4.1-mini/lessons.json` — flashcards, MCQ, fill-in-the-blank
- `gpt-4.1-mini/note.md` — unit study guide (tables, Mermaid, LaTeX)
- `gpt-5.4-mini/lessons.json` — flashcards, MCQ, fill-in-the-blank
- `gpt-5.4-mini/note.md` — unit study guide (tables, Mermaid, LaTeX)
- `gpt-4.1/lessons.json` — flashcards, MCQ, fill-in-the-blank
- `gpt-4.1/note.md` — unit study guide (tables, Mermaid, LaTeX)
- `gpt-5.4/lessons.json` — flashcards, MCQ, fill-in-the-blank
- `gpt-5.4/note.md` — unit study guide (tables, Mermaid, LaTeX)
- `gpt-5.5/lessons.json` — flashcards, MCQ, fill-in-the-blank
- `gpt-5.5/note.md` — unit study guide (tables, Mermaid, LaTeX)

## Quick Content Metrics

| Model | Note length (chars) | Has Mermaid | Has LaTeX | Has table | Has checklist |
|---|---|---|---|---|---|
| gpt-4.1-mini (baseline) | 6,446 | ✅ | ✅ | ❌ | ✅ |
| gpt-5.4-mini | 6,378 | ✅ | ✅ | ✅ | ✅ |
| gpt-4.1 | 6,029 | ✅ | ✅ | ❌ | ✅ |
| gpt-5.4 | 7,958 | ✅ | ✅ | ✅ | ✅ |
| gpt-5.5 (flagship) | 8,465 | ✅ | ✅ | ✅ | ✅ |

## Recommendation

Review the note.md and lessons.json files in each model folder, then run generation with your chosen model:

```bash
npx ts-node src/scripts/generateAPContent.ts --model gpt-4.1 --force
```