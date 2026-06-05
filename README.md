# Presentation Generator

An AI-powered presentation generator that turns a topic into a fully structured, editable, versioned presentation. Built for two use cases: a **teacher or presenter** who needs concise, bullet-driven slides they can present to an audience, and a **self-directed learner** who wants full prose explanations, analogies, and speaker notes they can read at their own pace. One `content_mode` toggle switches between them — the same pipeline, the same outline, two completely different content shapes.

---

## What it does

1. You enter a topic (and optionally: audience, tone, depth, length, style, content mode)
2. The AI generates a weighted outline — topics ranked by importance, with slide counts, time estimates, and confidence scores
3. Resources (videos, papers, courses, articles) are fetched from Tavily before slides are generated, so the LLM can cite real sources inline
4. You review, reorder, and refine the outline before committing
5. Slides are generated with layout variety (narrative, mixed, bullets, visual, embed, quote, two-col, title) and inline source references `[N]`
6. Every edit — inline, AI patch, or full regen — is saved as an immutable version you can undo and redo
7. Present the deck in a full-screen viewer, or download as PPTX

---

## Tech stack

| Layer | Technology |
|---|---|
| Backend | Python, FastAPI, SQLAlchemy, SQLite |
| Frontend | React, TypeScript, Vite, Zustand, shadcn/ui, Tailwind CSS |
| AI | Anthropic Claude (claude-sonnet-4-20250514) |
| Resources | Tavily Search API |
| Images | Wikipedia REST API (primary), Tavily (fallback) |
| Export | python-pptx |
| Drag & drop | @dnd-kit |

---

## Prerequisites

- Python 3.11+
- Node.js 18+
- pip and npm
- An [Anthropic API key](https://console.anthropic.com/) — sign up and create a key under API Keys
- A [Tavily API key](https://tavily.com/) — free tier is sufficient (1,000 searches/month)

---

## Setup

### 1. Clone the repo

```bash
git clone https://github.com/JonathanKimelfeld/presentation-generator
cd presentation-generator
```

### 2. Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

Create a `.env` file in `backend/`:

```env
ANTHROPIC_API_KEY=sk-ant-...
TAVILY_API_KEY=tvly-...
MODEL=claude-sonnet-4-20250514
```

- `ANTHROPIC_API_KEY` — from [console.anthropic.com](https://console.anthropic.com/)
- `TAVILY_API_KEY` — from [app.tavily.com](https://app.tavily.com/); free tier works
- `MODEL` — Claude model ID; the value above is the recommended default

Start the server:

```bash
uvicorn main:app --reload
```

Backend runs at `http://localhost:8000`.  
API docs at `http://localhost:8000/docs`.

### 3. Frontend

Open a new terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:5173`.

---

## Quick start

1. Open `http://localhost:5173`
2. Type any topic — "Central Limit Theorem", "The Roman Empire", "How GPS works"
3. Click **Generate** — defaults are applied silently (verbose mode, 20 min, depth 3)
4. **Wait 45–90 seconds** — the LLM generates an outline, fetches resources, then generates all slides in one pass
5. Review the outline; drag topics to reorder; refine via the chat bar at the bottom
6. Click **Approve** to enter the editor
7. Edit slides inline, patch specific slides via AI, or click **▶ Present** to open the full-screen viewer
8. Click **Download PPTX** to export

---

## How to use

### Content modes

Set **Slide content style** in Advanced options before generating:

| Mode | Layout | Best for |
|---|---|---|
| **Verbose** (default) | Narrative prose, mixed bullet+intro, full analogies | Self-study, asynchronous learning, reading at own pace |
| **Minimal** | Concise bullets only | Live presentation to an audience, minimal on-screen text |

In verbose mode the speaker notes become a full standalone explanation — you could read the deck alone and understand everything. In minimal mode the speaker notes still contain the full explanation, but slides show only short bullets.

### Advanced options

Click **⚙ Advanced options** on the home screen:

| Setting | What it controls |
|---|---|
| Audience | Who the content is written for — shapes vocabulary and assumed prior knowledge |
| Tone | Formal / casual / technical |
| Depth (1–5) | 1 = intuition only; 3 = intuition + notation explained; 5 = full technical detail with proofs |
| Length | Total presentation time in minutes (hard ceiling on generated content) |
| Compactness (1–5) | How many bullets per slide |
| Slide content style | Verbose (self-study) vs Minimal (presenting) |
| Include visual slides | One image slide per topic, fetched from Wikipedia / Tavily |
| Resources to include | Which source types Tavily should search for |
| Prioritize by | Drag resource types to set fetch priority order |

### Outline view

After generation, the outline view shows each topic with:
- **Slide count and time estimate**
- **Rationale** — why this topic is included (expand to read)
- **Confidence score** — the LLM's self-assessed confidence in the content (0.0–1.0). Low scores indicate topics where sources are scarce or scope is ambiguous. Flag details explain why.
- **Resources** — up to 8 curated resources per topic, fetched via Tavily. Click the resource count badge to expand. Toggle, remove, or reorder resources. Selections persist per version.

**Drag topics** to reorder the outline. Use the **chat bar** at the bottom to refine the outline via AI (add topics, remove topics, reweight) — this goes through a dedicated endpoint that rewrites the outline without touching slides.

Click **Approve outline** when satisfied. Slide generation begins immediately.

### Editor

- **Inline edit** — click **✎ Edit** on any slide card. All fields become editable. Click **Save** to commit (creates a new version) or **Cancel** to discard.
- **AI patch (selected slides)** — check the boxes on slides you want to change, then type an instruction in the chat bar and click **Patch N slides**. Only the selected slides are sent to the LLM. Fast and cost-effective.
- **General AI patch (no selection)** — type an instruction without selecting slides. The LLM decides which slides to update. Click **Apply to presentation**.
- **Full regeneration** — click **Regen** in the chat bar to replace all slides entirely. Requires confirmation. Use when the patch approach isn't enough.
- **▶ Present** — opens the presenter in a new browser tab.
- **Download PPTX** — exports the current version as a PowerPoint file.

### Version history

Every change — inline edit, AI patch, reorder, regen — saves an immutable snapshot. Navigate history using:

- **← →** arrows in the top bar
- The **History** sidebar — lists all versions with source badges and timestamps; click any version to jump to it

| Badge | What created it |
|---|---|
| `generated` | Initial AI generation |
| `ai_patch` | Surgical AI edit on specific slides |
| `ai_regen` | Full regeneration |
| `direct_edit` | Manual inline edit |
| `reorder` | Slide drag-and-drop reorder |
| `outline_refined` | Outline-level AI refinement |

### Presenter

Click **▶ Present** in the editor to open the full-screen viewer.

**Keyboard shortcuts:**

| Key | Action |
|---|---|
| `→` or `Space` | Next slide |
| `←` | Previous slide |
| `N` | Toggle speaker notes panel |
| `F` | Toggle fullscreen |
| `Esc` | Exit presenter |

The top bar shows: topic (left) · current section name (center) · ✕ exit (right).  
The bottom bar shows: slide counter (left) · progress bar (center) · Notes button (right).  
The speaker notes panel slides in from the right and shows the full explanation for self-study.

### Visual slides

If **Include visual slides** is enabled, one image slide is generated per topic. Images are fetched at generation time:

1. Wikipedia REST API is queried with the slide's `image_query` field
2. If Wikipedia returns no thumbnail, Tavily image search is used as a fallback
3. If both fail, the visual slide still renders but shows the description text without an image

Image fetching can fail silently for obscure topics — this is expected behavior, not an error.

---

## Project structure

```
presentation-generator/
├── backend/
│   ├── main.py                  # FastAPI app entry point, CORS, router registration
│   ├── database.py              # SQLAlchemy engine, Base, models, get_db dependency
│   ├── requirements.txt
│   ├── routers/
│   │   ├── presentations.py     # POST /presentations, outline approval, slide generation
│   │   └── versions.py          # Version history, patch, regen endpoints
│   ├── llm/
│   │   ├── client.py            # Anthropic client singleton
│   │   ├── prompts.py           # All prompt templates (outline, slides, patch, regen, refine)
│   │   ├── parser.py            # JSON extraction from LLM responses + Pydantic validation
│   │   └── calls.py             # generate_outline, generate_slides, patch_slides, regen_slides
│   ├── resources/
│   │   ├── tavily_client.py     # Tavily search wrapper, domain-based source type detection
│   │   ├── fetcher.py           # Per-topic resource fetch + filter logic
│   │   └── router.py            # Resource CRUD endpoints (toggle, reorder, delete)
│   ├── images/
│   │   ├── fetcher.py           # Wikipedia-first image fetch, Tavily fallback
│   │   └── router.py            # GET /presentations/:id/slides/:sid/image (with in-memory cache)
│   ├── export/
│   │   ├── pptx_builder.py      # PPTX generation via python-pptx (all 8 layout types)
│   │   └── router.py            # GET /presentations/:id/export/pptx
│   ├── models/
│   │   ├── presentation.py      # Presentation ORM model
│   │   ├── outline.py           # Outline ORM model
│   │   ├── slide.py             # Slide ORM model
│   │   ├── version.py           # Version ORM model (immutable snapshots)
│   │   └── topic_resource.py    # Resource ORM model (Tavily results per topic)
│   └── schemas/                 # Pydantic request/response schemas
│       ├── presentation.py      # PresentationConfig (content_mode, include_visuals, etc.)
│       ├── domain.py            # Outline, Topic, Slide domain models
│       ├── slide.py             # Slide patch schemas
│       └── version.py           # Version response schemas
├── frontend/
│   ├── src/
│   │   ├── App.tsx              # Routes: /, /outline/:id, /editor/:id, /present/:id
│   │   ├── globals.css          # Tailwind directives, warm oklch palette, typography scale
│   │   ├── routes/
│   │   │   ├── NewPresentation.tsx   # Home: topic input + Advanced options panel
│   │   │   ├── OutlineView.tsx       # Outline review, topic reorder, resource expand, approve
│   │   │   ├── EditorView.tsx        # Slide editor, patch/regen, version history sidebar
│   │   │   └── PresentView.tsx       # Full-screen presenter, keyboard nav, speaker notes
│   │   ├── store/
│   │   │   ├── presentationSlice.ts  # Presentation metadata (id, topic, config)
│   │   │   ├── versionSlice.ts       # Version list, current version pointer
│   │   │   └── editorSlice.ts        # UI state (config panel open, generating flag)
│   │   ├── components/ui/            # shadcn/ui components (Button, Card, Slider, etc.)
│   │   ├── lib/utils.ts              # cn() helper for Tailwind class merging
│   │   ├── utils/
│   │   │   └── fractionalIndex.ts    # Fractional index string generation for slide ordering
│   │   └── types/index.ts            # TypeScript types (Slide, Version, PresentationConfig, etc.)
│   ├── tailwind.config.js
│   ├── vite.config.ts
│   └── package.json
└── README.md
```

---

## API reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/presentations` | Create presentation, generate outline, fetch resources, generate slides |
| `GET` | `/presentations/:id/versions` | List all versions |
| `GET` | `/presentations/:id/versions/:vid` | Get a specific version with all slides |
| `POST` | `/presentations/:id/refine-outline` | Refine outline via AI without touching slides |
| `POST` | `/presentations/:id/patch` | Surgical AI patch on specific slides |
| `POST` | `/presentations/:id/regen` | Full slide regeneration |
| `PATCH` | `/presentations/:id/slides/:sid` | Direct slide edit or reorder |
| `GET` | `/presentations/:id/export/pptx` | Download current version as PPTX |
| `GET` | `/presentations/:id/resources` | Get resources for current version |
| `POST` | `/presentations/:id/resources/fetch` | Trigger Tavily resource fetch |
| `PATCH` | `/presentations/:id/resources/:rid` | Toggle enabled/disabled or update sort order |
| `DELETE` | `/presentations/:id/resources/:rid` | Remove a resource |
| `GET` | `/presentations/:id/slides/:sid/image` | Fetch image URL for a visual slide |

---

## Design decisions

### Decision: slides over video
**What:** The output format is slides (web + PPTX), not generated video.  
**Why:** Video generation requires a render pipeline (TTS + timing + ffmpeg) that consumes most engineering budget while producing output the user cannot edit. Slides are editable, versionable, and iterative — which serves both use cases better and keeps the feedback loop short.  
**Tradeoff:** No narration audio; the learner reads rather than watches.  
**At scale:** TTS per slide (ElevenLabs or OpenAI TTS) could be layered on without changing the slide data model.

### Decision: one pipeline, two content modes
**What:** A single `content_mode` field on `PresentationConfig` switches between `"verbose"` (self-study) and `"minimal"` (presenting).  
**Why:** The two use cases — self-directed learner and live presenter — have opposite needs for on-screen density. Building two separate products would duplicate the entire pipeline. Instead, the same outline, the same resources, and the same prompt system produce either full prose narratives or concise bullet lists depending on a single toggle. The LLM prompt uses `content_mode` to force layout choices: `narrative`/`mixed` for verbose, `bullets`/`title` for minimal.  
**Tradeoff:** A single pipeline can't be optimized separately for each use case's extremes.  
**At scale:** Additional modes (e.g. `"executive"` for C-suite summaries) add one branch to the prompt without touching the rest of the system.

### Decision: immutable version snapshots
**What:** Every mutation (edit, patch, regen, reorder) creates a new `Version` row in the database. The presentation stores a `current_version_id` pointer.  
**Why:** Undo/redo becomes trivial — move the pointer, fetch the snapshot. There is no reconstruction logic, no conflict resolution, no diff application. The tradeoff is storage: each version stores the full slides JSON blob.  
**Tradeoff:** Storage grows linearly with edit frequency.  
**At scale:** Replace full snapshots with RFC 6902 JSON Patch deltas; reconstruct any version by replaying patches forward from the base.

### Decision: surgical patch as the default edit path
**What:** Slide edits are sent to the LLM as a list of target slide IDs plus an instruction. Only those slides are rewritten.  
**Why:** Sending the full presentation on every edit is expensive (more tokens, higher latency) and unpredictable (the LLM may rewrite slides the user didn't ask to change). Surgical patches are fast, cheap, and scoped. Full regen is always available but requires explicit confirmation.  
**Tradeoff:** A patch instruction that implicitly requires structural changes (e.g. "add a new slide before slide 3") may fail or require regen.  
**At scale:** No change — patch cost scales with selected slides, not presentation size.

### Decision: fractional index strings for slide order
**What:** Slide position is stored as a short lexicographic string (e.g. `aa`, `aba`, `ac`) rather than an integer sequence number.  
**Why:** Integer sequences require renumbering all slides after any insertion, which means N writes per reorder. Fractional index strings allow insertion between any two slides with a single write: inserting between `aa` and `ac` produces `ab`. Rebalancing only triggers when strings grow beyond ~20 characters — in normal use, never.  
**Tradeoff:** Strings are less human-readable in the database than integers.  
**At scale:** No change — this pattern is already used in production tools (Linear, Figma). The rebalancing logic is O(n) and amortized rare.

### Decision: dedicated `/refine-outline` endpoint
**What:** Outline changes use a purpose-built endpoint with its own prompt, separate from `/patch`.  
**Why:** Early tests routing outline changes through `/patch` with empty `target_slide_ids` caused the LLM to escalate to full regen every time — the prompt had no surgical target and defaulted to "rewrite everything." A dedicated prompt that shows only the outline JSON and the user instruction produces clean, scoped outline edits every time.  
**Tradeoff:** One more endpoint to maintain.  
**At scale:** No change — the separation makes the intent explicit and keeps prompts focused.

### Decision: resources fetched before slide generation
**What:** Tavily resources are fetched and stored in the database before the slide-generation LLM call, and passed into the slides prompt.  
**Why:** If resources are fetched after slides, the LLM generates content without knowing what sources exist, and source references have to be retrofitted (or faked). Fetching first means the LLM receives real resource titles, URLs, and descriptions and can write `[N]` inline citations that reference actual content the user can click.  
**Tradeoff:** Generation is sequential (outline → resources → slides), adding ~5–10 seconds. Parallelizing outline and resource fetch requires pre-generating IDs before the DB row exists — which we do (UUIDs generated before the INSERT).  
**At scale:** Resource fetching is already I/O-bound and suitable for async. Move to `asyncio.gather` or a worker queue with no model changes.

### Decision: confidence scoring with known weakness
**What:** Each topic and slide carries a confidence score (0.0–1.0) and flags explaining uncertainty.  
**Why:** The score gives users a signal about where to verify content manually — obscure topics, ambiguous scope, or weak time estimates get lower scores and explanatory flags. This is especially useful for self-study use cases where the user may not know what they don't know.  
**Tradeoff:** The score is self-reported — the same model that generates the content also assigns the confidence. This is a known weakness: the model can be confidently wrong. A critic agent (a second LLM call that independently evaluates the output) would make scores more reliable, but doubles generation cost.  
**At scale:** Add a critic agent pass as an optional post-generation step, gated behind a config flag.

### Scalability seams

The current architecture is intentionally simple. Each seam below is one well-defined change:

| Current | At scale | Why |
|---|---|---|
| SQLite | PostgreSQL | SQLite doesn't support concurrent writes; Postgres adds connection pooling and row-level locking |
| Synchronous LLM calls | Celery + Redis job queue | Current architecture holds the HTTP connection open for 45–90 seconds; async jobs return immediately with a job ID |
| Full version snapshots | RFC 6902 JSON Patch deltas | Storage grows linearly with edits; deltas compress this to near-zero for small changes |
| JSON blob for slides | Normalized `slides` table rows | Blob makes per-slide queries expensive; rows enable efficient filtering and analytics |
| Local disk (SQLite file) | S3 + StorageBackend abstraction | Single-server assumption; S3 makes DB portable across instances |
| Single user | `workspace_id` multi-tenancy | Add `workspace_id` FK to all tables + JWT auth middleware; no data model redesign needed |

---

## Known limitations

- **Confidence scores are self-reported** — the same model that generates content also scores its own confidence. A separate critic agent pass would make scores more reliable. This is the most significant architectural gap.
- **LLM calls are synchronous** — generation holds the HTTP connection open for 45–90 seconds. At scale, these become Celery tasks with WebSocket progress notifications.
- **Full snapshots per version** — storage grows linearly with edit frequency. RFC 6902 delta patches are the right fix at scale.
- **No authentication** — the app is single-user. Adding `workspace_id` to all tables plus JWT middleware is the path to multi-tenancy.
- **No PDF export** — PPTX export is implemented; PDF requires a headless browser (Playwright) or LibreOffice conversion.
- **Image fetching can fail silently** — Wikipedia and Tavily are not guaranteed to return a relevant image for every topic. Visual slides degrade gracefully (description text shown instead) but the image may simply not appear for obscure topics.
- **LLM quality depends on topic popularity** — well-documented topics (central limit theorem, Roman Empire) produce high-confidence, detailed content. Obscure or niche topics may produce lower-quality slides with lower confidence scores. This is a fundamental LLM limitation, not a prompt issue.
- **No streaming** — slides for all topics are generated in one LLM call. Streaming topic-by-topic would improve perceived performance.

---

## AI tooling

This project was built using AI tools throughout — both as the development environment and as the product itself. Here is an honest account of what helped, what didn't, and what that reveals.

### What was used

- **Claude (claude.ai chat)** — used for planning the full 10-phase build sequence before writing any code: what to build in what order, what to defer, where the hard design decisions were. This produced a phase-by-phase spec that became the scaffolding for all implementation.
- **Claude Code (CLI)** — used for all implementation phases. Each phase was handed a detailed prompt spec; Claude Code wrote the code, diagnosed environment errors, and iterated on failures.
- **Anthropic API (Claude Sonnet)** — the model powering the app itself: outline generation, slide generation, patch, regen, and refine-outline calls.
- **Tavily Search API** — resource discovery per topic (videos, papers, courses, articles) and image search fallback.
- **Wikipedia REST API** — primary image source for visual slides (no API key required, no rate limits for this volume).

### Where AI helped

- **Build planning** — generating a sequenced, dependency-aware 10-phase plan in a single session saved several hours of upfront design thinking
- **Boilerplate at speed** — FastAPI router scaffolding, SQLAlchemy model definitions, Pydantic schema design, Zustand slice setup: all generated in seconds and correct on first pass
- **Prompt engineering** — iterating on the slides prompt (content mode rules, source ref format, layout shapes, visual slide rules) was done collaboratively; Claude suggested the `content_mode` layout-forcing approach
- **Environment debugging** — diagnosing the `NODE_ENV=production` issue that caused npm to silently skip devDependencies took one diagnostic step with Claude Code rather than extended manual investigation
- **shadcn/ui integration** — the warm oklch palette, typography scale, and component wiring across three route files were written by Claude Code from a design spec in a single pass

### Where AI didn't help (the honest version)

- **Vague prompts produced vague code** — every phase that produced good output required a precise, detailed spec. Prompts like "build the editor" returned generic implementations. The engineering work shifted from coding to prompt specification — still real work.
- **Product decisions required human judgment** — which features to build, what to cut, what the two use cases actually need, how verbose mode and minimal mode differ in practice: these were human calls. The AI executed well but could not make these choices.
- **Output verification was required at every phase** — Claude Code cannot validate that generated code works correctly at the system level. Each phase required human checkpoint: run the app, test the flow, read the diff carefully. Two subtle bugs were introduced by the AI (a missing `include=dev` flag that silently dropped devDependencies; an incorrect version spec in package.json) and required careful reading to find.
- **The AI did not understand the codebase as a whole** — within a session it had strong context; across sessions or when context was compressed, it needed to re-read files before making changes. This is a real limitation for long-running multi-session projects.

### The meta-observation

The AI tooling story is itself a demonstration of the product's thesis: AI works best as a collaborative tool with human judgment at each step, not as a replacement for thinking. The presentation generator uses the same pattern — AI produces a structured draft, the human reviews, refines, and approves before committing.

---

## What I'd add with more time

- **Critic agent** — a second LLM pass that independently evaluates the generated content and produces more reliable confidence scores
- **Async generation** — Celery + Redis job queue with WebSocket progress notifications, so the UI doesn't hold a connection open
- **Streaming slides** — generate and display topics one at a time as they complete, rather than waiting for the full batch
- **TTS audio per slide** — ElevenLabs or OpenAI TTS to add narration for self-study mode
- **PDF export** — Playwright headless browser rendering of the presenter view to PDF
- **Delta versioning** — RFC 6902 JSON Patch deltas to replace full snapshots
- **Auth + multi-tenancy** — JWT middleware + `workspace_id` FK on all tables
- **Art style selector** — minimal / corporate / academic / playful visual themes
