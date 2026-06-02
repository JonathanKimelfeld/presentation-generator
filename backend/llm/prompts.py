import json
from schemas.presentation import PresentationConfig
from schemas.domain import Outline, Slide

_JSON_SYSTEM = """\
You are a presentation structure expert.
You return only valid JSON. No prose, no markdown fences,
no explanation. If you cannot produce valid JSON, return {}.

Constraints from config must be treated as hard rules:
- length (minutes) is a hard ceiling on total estimated_minutes
- depth (1-5) controls how much detail per topic
- compactness (1-5) controls bullets per slide (1=many, 5=few)
- tone and audience shape language, not structure
- scope defines the boundaries of what to include"""


def outline_prompt(topic: str, config: PresentationConfig) -> tuple[str, str]:
    user = f"""\
Generate a presentation outline for the topic: "{topic}"

Config:
  audience: {config.audience or "general"}
  tone: {config.tone or "neutral"}
  depth: {config.depth or 3}/5
  length: {config.length or 10} minutes total
  compactness: {config.compactness or 3}/5
  scope: {config.scope or "standard overview"}
  style: {config.style or "balanced"}

Return this exact JSON shape and nothing else:
{{
  "topics": [
    {{
      "id": "<uuid>",
      "title": "<topic title>",
      "weight": <1-5 integer>,
      "slide_count": <integer>,
      "estimated_minutes": <integer>,
      "rationale": "<1-2 sentence summary of what this topic covers and why it is included, written for the learner or presenter to understand the scope of this section at a glance>",
      "slide_ids": [],
      "confidence": {{
        "score": <0.0-1.0>,
        "flags": [
          {{
            "type": "<scarce_source|ambiguous_scope|depth_mismatch|time_estimate_weak>",
            "detail": "<explanation>",
            "affected_slide_ids": []
          }}
        ]
      }}
    }}
  ]
}}

Rules:
- Total estimated_minutes across all topics must not exceed {config.length or 10}
- slide_count per topic must be proportional to weight
- weight 1 = 1 slide, weight 5 = 5+ slides
- confidence.score reflects how well-documented this topic is
- Only include flags when genuinely uncertain
- slide_ids should be empty at this stage"""
    return _JSON_SYSTEM, user


def slides_prompt(topic: str, config: PresentationConfig, outline: Outline) -> tuple[str, str]:
    user = f"""\
Generate a complete, self-contained learning presentation.

Topic: "{topic}"

Config:
  audience: {config.audience or "general — assume no prior knowledge"}
  tone: {config.tone or "conversational and clear"}
  depth: {config.depth or 3}/5
  compactness: {config.compactness or 3}/5
  style: {config.style or "educational"}

Approved outline:
{json.dumps(outline.model_dump(), indent=2)}

Return this exact JSON shape and nothing else:
{{
  "slides": [
    {{
      "id": "<uuid>",
      "topic_id": "<must match a topic id from the outline>",
      "position": "<fractional index string, start at 'aa', increment lexicographically>",
      "title": "<slide title>",
      "layout": "<bullets|quote|two-col|title|embed>",
      "content": <layout-specific object>,
      "speaker_notes": "<full explanation for self-study>",
      "estimated_minutes": <integer>,
      "confidence": {{
        "score": <0.0-1.0>,
        "flags": []
      }}
    }}
  ]
}}

Layout content shapes:
- bullets: {{ "bullets": ["string", ...] }}
- quote:   {{ "quote": "string", "attribution": "string" }}
- two-col: {{ "left": ["string", ...], "right": ["string", ...] }}
- title:   {{ "heading": "string", "subheading": "string" }}
- embed:   {{ "url": "string", "caption": "string" }}

## CONTENT RULES — READ THESE CAREFULLY

### Rule 1: Write for someone who knows nothing

Every slide must be self-explanatory to a smart person encountering this topic for the first time.
Never assume the reader already understands any term you use. If you introduce a term, define it inline.

Bad:  "• Finite variance: σ² < ∞ is essential"
Good: "• Finite variance is required — this means the spread of the data must not be infinite. \
In practice, almost all real-world data satisfies this condition. \
The notation σ² < ∞ simply means the variance is a finite number."

### Rule 2: Tell the story before the detail

Each slide must open with 1–2 sentences of context that explain WHY this slide matters and WHERE it fits \
in the bigger picture. Then go into the detail.

Bad:  title: "Conditions and Assumptions", bullets: ["Independence required", "Finite variance"]
Good: title: "What needs to be true for CLT to work?", first bullet: "The CLT is powerful but not \
unconditional — it only applies when three things are true about your data. Here is each one explained."

### Rule 3: Use analogies and concrete examples

For every abstract concept, include a real-world analogy or concrete numeric example.

Bad:  "• CLT: as n → ∞, sample mean converges to N(μ, σ²/n)"
Good: "• Imagine measuring the height of 5 random people — the average could be anywhere. \
Now measure 1000 people: that average will nearly always be close to the true population mean, \
and its distribution will form a bell curve regardless of how heights are distributed."

### Rule 4: Bullets must be sentences, not labels

Every bullet point must be a complete sentence that explains something. No label-only bullets.

Bad:  "• Berry-Esseen theorem"
Good: "• The Berry-Esseen theorem tells us exactly how fast the CLT kicks in: the approximation \
error shrinks at rate 1/√n, so quadrupling your sample size halves the error."

### Rule 5: Build understanding step by step

Slides within each topic must form a logical sequence where each builds on the previous one.
Never introduce a concept before its prerequisites.
The first slide of each topic must establish context.
The last slide of each topic must summarize what was learned.

### Rule 6: Speaker notes are the full explanation

Speaker notes are NOT presenter reminders — they are the complete explanation a self-study learner reads.
Write speaker notes as if explaining to a friend:
- Full sentences and paragraphs
- Include the intuition behind the concept
- Include what to remember and why it matters
- Minimum 100 words per slide for non-trivial topics
- Use phrases like "Think of it this way:", "The key insight here is:", "A common mistake is:"

### Rule 7: Title as a question or insight

Slide titles should be questions or insight statements, not category labels.

Bad:  "Applications of CLT"
Good: "Where does CLT actually show up in the real world?"

Bad:  "Conditions and Assumptions"
Good: "Three things that must be true for CLT to work"

### Rule 8: First slide of presentation = prerequisites

The very first slide (layout: "title") must include a subheading listing what the reader should already know:
"Prerequisites: basic probability, mean and variance"
If no prerequisites: "Prerequisites: none — start from zero"

### Rule 9: Compactness controls depth, not information density

compactness 1 = long explanations, many bullets (8–10 full sentences each)
compactness 3 = balanced explanations (5–6 bullets, 1–3 sentences each)
compactness 5 = concise but never a label — still full explanatory sentences (3–4 bullets)

At ANY compactness level, bullets must still be complete explanatory sentences.
Compactness only controls how many bullets and how long each one is.

### Rule 10: depth controls technicality

depth 1 = pure intuition, no formulas, analogies only
depth 3 = mix of intuition and formal notation, every formula explained in plain English
depth 5 = full technical detail, proofs, edge cases

At depth 1–2: replace every formula with a plain English equivalent.
Never show notation without immediately explaining it in words.

## LAYOUT USAGE RULES

"title"   → first slide of each topic section only
            heading = topic name as a question or insight statement
            subheading = what this section will explain in one sentence

"bullets" → most slides; 4–8 full-sentence bullets

"two-col" → comparisons, before/after, pros/cons
            each column gets 3–5 full-sentence bullets

"quote"   → a memorable insight, surprising fact, or key theorem stated plainly
            use sparingly: max 1 per topic

"embed"   → a YouTube explainer for this specific concept, only when a video would genuinely help

## STRUCTURAL RULES

- Generate exactly the slide_count specified per topic in the outline
- topic_id must match exactly — never invent new topic ids
- position strings must be unique and lexicographically ordered starting at 'aa'
- First slide of the whole presentation must use layout "title"
- confidence.score should reflect content reliability

## FINAL CHECK BEFORE RETURNING JSON

Before returning, verify each slide:
□ Does the first bullet provide context or story?
□ Is every bullet a complete sentence (12+ words)?
□ Would a smart 16-year-old understand this slide cold?
□ Does it connect to the previous slide?
□ Are all terms defined when first introduced?

If any slide fails these checks, rewrite it before returning the JSON."""
    return _JSON_SYSTEM, user


def refine_outline_prompt(topic: str, config: PresentationConfig, current_outline: dict, user_note: str) -> tuple[str, str]:
    user = f"""\
You are refining a presentation outline based on user feedback.

Topic: "{topic}"
Config:
  audience: {config.audience or "general"}
  tone: {config.tone or "neutral"}
  depth: {config.depth or 3}/5
  length: {config.length or 10} minutes total
  compactness: {config.compactness or 3}/5
  scope: {config.scope or "standard overview"}
  style: {config.style or "balanced"}

Current outline:
{json.dumps(current_outline, indent=2)}

User feedback: "{user_note}"

Apply the feedback to the outline structure only.
You may add, remove, reorder, or reweight topics.
Return the complete updated outline in the same JSON shape.
Do not generate slides.

Return this exact JSON shape and nothing else:
{{
  "topics": [
    {{
      "id": "<keep existing id if topic is unchanged, new uuid4 if topic is new>",
      "title": "...",
      "weight": <1-5 integer>,
      "slide_count": <integer>,
      "estimated_minutes": <integer>,
      "rationale": "<1-2 sentence summary of what this topic covers and why it is included, written for the learner or presenter to understand the scope of this section at a glance>",
      "slide_ids": [],
      "confidence": {{
        "score": <0.0-1.0>,
        "flags": []
      }}
    }}
  ]
}}

Rules:
- Preserve topic ids where the topic is unchanged
- Total estimated_minutes must not exceed {config.length or 10}
- slide_count per topic must be proportional to weight
- Only include flags when genuinely uncertain
- slide_ids must be empty (slides are assigned at generation time)"""
    return _JSON_SYSTEM, user


def patch_prompt(slides: list[Slide], user_note: str, config: PresentationConfig) -> tuple[str, str]:
    user = f"""\
You are applying a surgical edit to specific presentation slides.

Current slide content:
{json.dumps([s.model_dump() for s in slides], indent=2)}

User instruction: "{user_note}"

Config constraints (must be respected):
  tone: {config.tone or "neutral"}
  depth: {config.depth or 3}/5
  compactness: {config.compactness or 3}/5

Return this exact JSON shape and nothing else:
{{
  "patches": [
    {{
      "slide_id": "<must match an id from the slides above>",
      "fields": {{
        "title": "<optional, only if changed>",
        "content": "<optional, only if changed>",
        "speaker_notes": "<optional, only if changed>",
        "estimated_minutes": "<optional, only if changed>",
        "confidence": "<optional, only if changed>"
      }}
    }}
  ]
}}

Rules:
- Only include slides that actually need changes
- Only include fields that actually change
- Never invent slide_ids not present in the input
- Respect tone, depth, compactness from config
- If the instruction cannot be applied surgically, \
return {{ "patches": [], "requires_regen": true }}

When rewriting slide content, apply the same storytelling rules as the original generation:
- Write full sentence bullets — no label-only bullets
- Open each slide with a context-setting sentence that explains why this slide matters
- Define all terms inline when first introduced
- Include analogies or concrete examples for abstract concepts
- Keep the same narrative flow and logical sequence as the surrounding slides"""
    return _JSON_SYSTEM, user
