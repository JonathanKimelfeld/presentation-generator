# Presentation Generator

An AI-powered presentation generator that turns a topic into a fully structured, editable, versioned presentation. 
It's built for two use cases, or two distinct types of users: 
A: a **teacher or presenter** who needs concise, bullet-driven slides they can present to an audience;
B: a **self-directed learner** who wants full prose explanations, analogies, and speaker notes they can read at their own pace (or read out to them);
One `content_mode` toggle switches between them — the same pipeline but different content generation outcomes


## What it does

1. You enter a topic (and optionally: audience, tone, depth, length, style, content mode)
2. The AI generates a weighted outline: topics ranked by importance, with slide counts, time estimates, and confidence scores
3. Resources (videos, papers, courses, articles) are fetched from Tavily before slides are generated, so the LLM can cite real sources inline
4. You review, reorder, and refine the outline before committing
5. Slides are generated with layout variety (narrative, mixed, bullets, visual, embed, quote, two-col, title) and inline source references `[N]`
6. Every edit — inline, AI patch, or full regen — is saved as an immutable version you can undo and redo
7. Present the deck in a full-screen viewer, or download as PPTX if you want to save it locally

---

## Tech stack

Backend: Python, FastAPI, SQLAlchemy, SQLite
Frontend: React, TypeScript, Vite, Zustand, shadcn/ui, Tailwind CSS
AI: Anthropic Claude + api calling
Resources: Tavily Search API
Images: Wikipedia REST API (primary), Tavily (fallback)
Export: python-pptx
Drag & drop: @dnd-kit


## Prerequisites

- Python 3.11+
- Node.js 18+
- pip and npm
- An [Anthropic API key](https://console.anthropic.com/) 
- A [Tavily API key](https://tavily.com/) (free tier)


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
source .venv/bin/activate
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

### Visual slides

If **Include visual slides** is enabled, one image slide is generated per topic. Images are fetched at generation time:

1. Wikipedia REST API is queried with the slide's `image_query` field
2. If Wikipedia returns no thumbnail, Tavily image search is used as a fallback
3. If both fail, the visual slide still renders but shows the description text without an image

Image fetching can fail silently for obscure topics — this is expected behavior, not an error.

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

