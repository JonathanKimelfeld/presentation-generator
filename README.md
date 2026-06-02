# Presentation Generator

An AI-powered presentation generator that turns a topic into a fully structured, editable, versioned presentation. Built for two use cases: a **teacher or presenter** preparing structured content, and a **self-directed learner** building a step-by-step curriculum.

---

## What it does

1. You enter a topic (and optionally: audience, tone, depth, length, style)
2. The AI generates a weighted outline — topics ranked by importance, with slide counts and time estimates
3. You review, reorder, and refine the outline before committing
4. Slides are generated with full explanations, analogies, and speaker notes written for genuine understanding
5. Every edit — inline, AI patch, or full regen — is saved as an immutable version you can undo and redo
6. Export the presentation as a PPTX file

---

## Tech stack

| Layer | Technology |
|---|---|
| Backend | Python, FastAPI, SQLAlchemy, SQLite |
| Frontend | React, TypeScript, Vite, Zustand |
| AI | Anthropic Claude (claude-sonnet-4-20250514) |
| Resources | Tavily Search API |
| Export | python-pptx |
| Drag & drop | @dnd-kit |

---

## Prerequisites

- Python 3.11+
- Node.js 18+
- An [Anthropic API key](https://console.anthropic.com/)
- A [Tavily API key](https://tavily.com/) (free tier works)

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

Start the server:

```bash
uvicorn main:app --reload
```

Backend runs at `http://localhost:8000`.
API docs available at `http://localhost:8000/docs`.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:5173`.

---

## How to use it

### Quick start (dry mode)

1. Open `http://localhost:5173`
2. Type any topic — "Central Limit Theorem", "The Roman Empire", "How GPS works"
3. Click **Generate** — defaults are applied silently
4. Review the outline, drag topics to reorder, refine via the chat bar
5. Click **Approve** to generate slides
6. Edit slides inline, patch specific slides via AI, or regenerate
7. Click **Export PPTX** to download the presentation

### Advanced mode

Open **Advanced options** before generating to configure:

| Setting | What it controls |
|---|---|
| Audience | Who the content is written for |
| Tone | Formal / casual / technical |
| Depth (1–5) | How technical and detailed the content is |
| Length | Total presentation time in minutes |
| Compactness (1–5) | How many bullets per slide |
| Mode | Presentation vs Self-study |
| Resource filters | Videos / papers / courses / articles |

---

## Editing a presentation

### Inline editing
Click **✎ Edit slide** on any slide to enter edit mode. All fields become editable. Click **Save changes** to commit or **Cancel** to discard.

### AI patch
Select one or more slides using the checkboxes in the left panel. Type an instruction in the chat bar. Click **Apply patch** — only the selected slides are sent to the AI.

### Full regeneration
Click **Regenerate** in the chat bar to replace all slides. Optionally include a new instruction to steer the output.

### Outline refinement
On the outline screen, use the chat bar to add, remove, reorder, or reweight topics without touching the slides.

---

## Version history

Every change — inline edit, AI patch, reorder, regen — saves an immutable version snapshot. Navigate history using:

- **← →** buttons in the TopBar
- The **History** sidebar (lists all versions with source badges and timestamps)
- Clicking any version in the sidebar jumps directly to it

Version sources:
| Badge | Meaning |
|---|---|
| `generated` | Initial AI generation |
| `ai_patch` | Surgical AI edit on specific slides |
| `ai_regen` | Full regeneration |
| `direct_edit` | Manual inline edit |
| `reorder` | Slide drag-and-drop reorder |
| `outline_refined` | Outline-level AI refinement |

---

## Self-study mode

Set **Mode: Self-study** in Advanced options before generating.

In self-study mode:
- Speaker notes become learner notes ("think about this...", "key insight:")
- A prerequisites slide is added at the start
- Knowledge check questions are added per topic
- The presenter shows notes alongside slide content

---

## Resources per topic

After generation, each outline topic shows up to 8 curated resources fetched via Tavily:

- **Videos** from YouTube
- **Academic papers** from arXiv, ResearchGate, IEEE, Nature, Springer
- **Courses** from Coursera, edX, Khan Academy, MIT OpenCourseWare
- **Articles** from high-quality web sources (Wikipedia excluded)

Resources are ranked by relevance. You can toggle, remove, or reorder them. Selections are saved per version.

Configure which source types to include in **Advanced options → Resources to include** before generating.

---

## Project structure

```
presentation-generator/
├── backend/
│   ├── main.py                  # FastAPI app, startup, CORS
│   ├── database.py              # SQLAlchemy models, SQLite setup
│   ├── routers/
│   │   ├── presentations.py     # Core CRUD + generation endpoints
│   │   └── versions.py          # Version history endpoints
│   ├── llm/
│   │   ├── client.py            # Anthropic client singleton
│   │   ├── prompts.py           # All prompt templates
│   │   ├── parser.py            # JSON extraction + Pydantic validation
│   │   └── calls.py             # generate_outline, generate_slides, patch, regen
│   ├── export/
│   │   ├── pptx_builder.py      # PPTX generation via python-pptx
│   │   └── router.py            # Export endpoints
│   ├── models/
│   │   ├── presentation.py      # Presentation ORM model
│   │   ├── outline.py           # Outline ORM model
│   │   ├── slide.py             # Slide ORM model
│   │   ├── version.py           # Version ORM model
│   │   └── topic_resource.py    # Resource ORM model
│   ├── resources/
│   │   ├── tavily_client.py     # Tavily search wrapper
│   │   ├── fetcher.py           # Per-topic resource fetching logic
│   │   └── router.py            # Resource CRUD endpoints
│   ├── schemas/                 # Pydantic request/response schemas
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.tsx              # Routes: /, /outline/:id, /editor/:id
│   │   ├── routes/
│   │   │   ├── NewPresentation.tsx
│   │   │   ├── OutlineView.tsx
│   │   │   └── EditorView.tsx
│   │   ├── store/
│   │   │   ├── presentationSlice.ts
│   │   │   ├── versionSlice.ts
│   │   │   └── editorSlice.ts
│   │   ├── utils/
│   │   │   └── fractionalIndex.ts
│   │   └── types/index.ts
│   └── package.json
└── README.md
```

---

## API reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/presentations` | Create presentation + generate outline and slides |
| `GET` | `/presentations/:id/versions` | List all versions |
| `GET` | `/presentations/:id/versions/:vid` | Get a specific version |
| `POST` | `/presentations/:id/refine-outline` | Refine outline via AI |
| `POST` | `/presentations/:id/patch` | Surgical AI patch on specific slides |
| `POST` | `/presentations/:id/regen` | Full regeneration |
| `PATCH` | `/presentations/:id/slides/:sid` | Direct slide edit or reorder |
| `GET` | `/presentations/:id/export/pptx` | Export presentation as PPTX |
| `GET` | `/presentations/:id/resources` | Get resources by version |
| `POST` | `/presentations/:id/resources/fetch` | Trigger Tavily fetch |
| `PATCH` | `/presentations/:id/resources/:rid` | Toggle or reorder resource |
| `DELETE` | `/presentations/:id/resources/:rid` | Remove resource |

---

## Design decisions

### Why slides instead of video
Video generation requires a render pipeline (TTS + ffmpeg + timing) that consumes most of the engineering budget while producing output the user cannot edit. Slides are editable, versionable, and iterative — which better serves both use cases.

### Why immutable version snapshots
Every mutation produces a new version row. Undo/redo is just moving a pointer — no reconstruction logic, no conflict resolution. Simple and reliable at this scale.

### Why surgical patch as the default
Sending the whole presentation to the LLM on every edit is expensive and unpredictable. Surgical patches send only the targeted slides, keep costs low, and produce more focused output. Full regen is always available but requires explicit user intent.

### Why fractional indexing for slide order
Fractional index strings (e.g. `aa`, `aba`, `ac`) allow reordering without renumbering every slide. Insertion between two slides is a single write. Rebalancing only triggers when strings exceed 20 characters — in practice, never in normal use.

### Why a dedicated `/refine-outline` endpoint
Using `/patch` with empty `target_slide_ids` for outline changes caused the LLM to escalate to full regen every time — it had no surgical target. A dedicated endpoint with a purpose-built prompt resolves this cleanly.

---

## Known limitations

- **Confidence scores are self-reported** — the same model that generates content also scores its own confidence. A separate critic agent pass would make scores more reliable. This is the next architectural improvement.
- **LLM calls are synchronous** — at scale, these should be Celery tasks with WebSocket notifications. The current architecture holds a connection open during generation.
- **Full snapshots per version** — at scale, delta storage (RFC 6902 JSON patches) would replace full snapshots to reduce DB size.
- **Single user** — `workspace_id` columns are present in all tables but auth is not implemented.
- **No PDF export** — PPTX export is implemented; PDF export is not yet available.
- **Spatial presenter not yet implemented** — `backend/impress/` and the frontend presenter route (`PresentView.tsx`) are planned but not yet built.

---

## What I'd add with more time

- Critic agent for independent confidence scoring
- Celery + Redis job queue for async generation
- TTS audio explanation per slide (ElevenLabs or OpenAI TTS)
- PDF export
- Spatial Impress.js presenter (Prezi-like canvas with circular layout)
- Art design style selector (minimal / corporate / playful / academic)
- Audience-aware content (gifs and memes for teen audiences, YouTube embeds)
- Delta versioning to replace full snapshots
- Auth + multi-tenancy (workspace_id already in schema)
- Streaming slide generation (topic by topic as they complete)
