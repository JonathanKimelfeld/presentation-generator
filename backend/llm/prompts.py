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


def slides_prompt(topic: str, config: PresentationConfig, outline: Outline, resources_by_topic: dict | None = None) -> tuple[str, str]:
    resources_by_topic = resources_by_topic or {}
    content_mode = getattr(config, "content_mode", "verbose") or "verbose"
    include_visuals = getattr(config, "include_visuals", True)

    layout_union = "bullets|quote|two-col|title|embed|narrative|mixed"
    visual_shape = ""
    visual_rules = ""
    if include_visuals:
        layout_union += "|visual"
        visual_shape = '- visual:    {{ "image_url": "", "image_query": "<specific search query to find a relevant image>", "image_alt": "<descriptive alt text for accessibility>", "caption": "<caption shown below the image>", "description": "<1-2 sentences explaining what this visual shows and why it matters>", "source_refs": [<int>, ...] }}'
        visual_rules = """
### Visual slides (only when include_visuals is true)

Use layout "visual" for exactly ONE slide per topic — the topic opener OR a key concept slide.
- image_query: be specific and visual (e.g. "neural network diagram", "DNA double helix structure") — NOT generic terms
- image_alt: describe what is in the image for accessibility
- caption: 1 short sentence identifying the image
- description: 1-2 sentences explaining relevance to the topic
- image_url: always leave as empty string "" — it will be filled automatically
- Do NOT use visual for title slides or summary slides
- Do NOT use visual more than once per topic"""

    user = f"""\
Generate a complete, self-contained learning presentation.

Topic: "{topic}"
Content mode: {content_mode}
Include visuals: {include_visuals}

Config:
  audience: {config.audience or "general — assume no prior knowledge"}
  tone: {config.tone or "conversational and clear"}
  depth: {config.depth or 3}/5
  compactness: {config.compactness or 3}/5

Available resources per topic:
{json.dumps(resources_by_topic, indent=2)}

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
      "layout": "<{layout_union}>",
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
- bullets:   {{ "subtitle": "string", "bullets": ["string", ...], "source_refs": [<int>, ...] }}
- narrative: {{ "subtitle": "string", "paragraphs": ["string", ...], "source_refs": [<int>, ...] }}
- mixed:     {{ "subtitle": "string", "intro": "string", "bullets": ["string", ...], "source_refs": [<int>, ...] }}
- title:     {{ "heading": "string", "subheading": "string" }}
- quote:     {{ "quote": "string", "attribution": "string" }}
- two-col:   {{ "left": ["string", ...], "right": ["string", ...] }}
- embed:     {{ "url": "string", "caption": "string" }}
{visual_shape}

{visual_rules}

## CONTENT MODE RULES

### If content_mode is "verbose" (default):

Use layout "narrative" or "mixed" for most slides.
Use "bullets" only for summary or checklist slides.
Use "title" ONLY for the very first slide of the entire presentation — never for topic section openers.

COMBINING RULE — CRITICAL:
Never create a standalone title slide for a topic section.
The first slide of each topic must combine the section heading WITH content.
Use layout "mixed" for every topic opener:
  subtitle = the topic name as a question or statement
  intro = 2-3 sentence context paragraph — why this topic matters and what the reader will understand by the end
  bullets = 3-4 key points covered in this section
  source_refs = most relevant resource index for this topic

Narrative slide rules:
  subtitle: a specific insight or question for this slide
  paragraphs: 2-4 full prose paragraphs per slide
    Each paragraph: 3-6 sentences
    First paragraph: establishes context and why this matters
    Middle paragraphs: explanation, examples, analogies
    Last paragraph: connects to next slide or summarizes
  source_refs: indices of resources that support this content

Mixed slide rules:
  subtitle: specific heading for this slide
  intro: 1-2 sentence prose that frames the bullets
  bullets: 3-5 full-sentence supporting points
  source_refs: indices of relevant resources

Prose writing rules for verbose mode:
  - Write like a knowledgeable friend explaining out loud
  - Every abstract concept needs a concrete analogy
  - Every formula needs a plain English equivalent
  - Use "Think of it this way:", "Here's the key insight:", "A common mistake is:" to guide the reader
  - Vary sentence length for readability
  - Connect each idea explicitly to the previous one
  - Never use bullet-style fragments inside paragraphs

### If content_mode is "minimal":

Use layout "bullets" for all content slides.
Use "title" for the very first slide AND for each topic section opener.
Bullets are concise — label + brief explanation, not long sentences.
No prose paragraphs.
Source refs still included where relevant.
Speaker notes remain full explanations regardless.

Bullets subtitle rule (both modes):
Every bullets slide MUST include a subtitle field — a short, specific statement or question that frames the bullets.
Bad:  "subtitle": "Key points"
Good: "subtitle": "Why the central limit theorem works in practice"

## SOURCE REFERENCE RULES (apply to both modes)

Each topic has numbered resources (index 1, 2, 3...) from "Available resources per topic" above.
Reference them inline in content where relevant.

In narrative paragraphs:
  End the relevant sentence with [N] where N is the resource index.
  Example: "The central limit theorem has been verified across thousands of empirical studies [2]."

In bullets:
  End the bullet with [N].
  Example: "Averaging independent samples always converges to normal distribution regardless of original shape [1]"

In source_refs array:
  List all resource indices referenced in this slide.
  Example: "source_refs": [1, 3]

Only reference resources that are genuinely relevant to the slide content.
Do not force references. Do not reference more than 3 sources per slide.
If no resources are available for a topic, omit source_refs or use [].

## SLIDE STRUCTURE RULES

First slide of entire presentation:
  layout: "title"
  heading: the topic as a compelling question or statement
  subheading: "Prerequisites: X, Y, Z" or "Prerequisites: none — start from zero"

First slide of each topic (verbose mode):
  layout: "mixed"  ← NOT "title" — combine heading with content
  subtitle: topic name as question or insight statement
  intro: 2-3 sentences of context
  bullets: 3-4 key things covered in this section
  source_refs: most relevant resource for this topic

First slide of each topic (minimal mode):
  layout: "title"
  heading: topic name
  subheading: what this section covers in one sentence

Middle slides of each topic (verbose mode):
  layout: "narrative" (preferred) or "mixed"
  One focused concept explained fully per slide.

Last slide of each topic (both modes):
  layout: "mixed" or "bullets"
  subtitle: "What you should now understand"
  Summary of key takeaways. One forward-looking sentence connecting to next topic.

Last slide of entire presentation:
  layout: "mixed"
  subtitle: "What you've learned"
  Complete summary + next steps for the learner

## CONTENT QUALITY RULES

### Write for someone who knows nothing
Every slide must be self-explanatory. Define every term inline when first introduced.
Bad:  "• Finite variance: σ² < ∞ is essential"
Good: "• Finite variance is required — this means the spread of the data must not be infinite. In practice, almost all real-world data satisfies this. The notation σ² < ∞ simply means the variance is a finite number."

### Bullets must be sentences, not labels
Every bullet point must be a complete sentence that explains something.
Bad:  "• Berry-Esseen theorem"
Good: "• The Berry-Esseen theorem tells us exactly how fast the CLT kicks in: the approximation error shrinks at rate 1/√n."

### Use analogies and concrete examples
For every abstract concept, include a real-world analogy or concrete numeric example.

### Speaker notes are the full explanation
Speaker notes are NOT presenter reminders — they are the complete explanation a self-study learner reads.
Minimum 100 words per slide. Write in full sentences.
Use phrases like "Think of it this way:", "The key insight here is:", "A common mistake is:"

### depth controls technicality
depth 1 = pure intuition, no formulas, analogies only
depth 3 = mix of intuition and formal notation, every formula explained in plain English
depth 5 = full technical detail, proofs, edge cases

### Structural rules
- Generate exactly the slide_count specified per topic in the outline
- topic_id must match exactly — never invent new topic ids
- position strings must be unique and lexicographically ordered starting at 'aa'
- First slide of whole presentation must use layout "title"
- confidence.score should reflect content reliability"""

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


def normalize_prompt(topic: str) -> tuple[str, str]:
    system = """\
You are a text normalization assistant.
You return only valid JSON. No prose, no markdown."""

    user = f"""\
Clean up this presentation topic submitted by a user.

Topic: "{topic}"

Apply these corrections if needed:
1. Fix spelling and typos
2. Fix capitalization (title case for proper nouns)
3. Fix grammar
4. Remove excessive punctuation or symbols
5. Expand obvious abbreviations if unambiguous

Do NOT:
- Change the meaning or intent of the topic
- Add or remove words that change the scope
- Translate to another language
- Make it more formal if it's clearly casual
- Change names, brands, or technical terms that are intentionally spelled that way

Return this exact JSON:
{{
  "normalized": "<cleaned topic>",
  "changed": <true if anything was changed>,
  "corrections": "<one sentence describing what was fixed, or null if nothing changed>"
}}

Examples:
"quantom computng" →
  {{"normalized": "Quantum Computing", "changed": true, "corrections": "Fixed spelling: quantom→quantum, computng→computing"}}

"the romn empir" →
  {{"normalized": "The Roman Empire", "changed": true, "corrections": "Fixed spelling: romn→Roman, empir→Empire"}}

"Machine Learning" →
  {{"normalized": "Machine Learning", "changed": false, "corrections": null}}

"WW2" →
  {{"normalized": "World War II", "changed": true, "corrections": "Expanded abbreviation WW2 to World War II"}}"""

    return system, user


def validation_prompt(
    user_prompt: str,
    presentation_topic: str,
    slide_context: list[dict],
    mode: str,
    config: dict,
) -> tuple[str, str]:
    import json as _json
    system = """\
You are a strict guardrail classifier for an AI presentation editor. \
Your job is to evaluate whether a user's instruction is appropriate \
to apply to a presentation.

You return only valid JSON. No prose, no markdown.
No explanation outside the JSON structure."""

    content_mode = config.get("content_mode", "verbose")
    audience = config.get("audience") or "general"

    user = f"""\
Evaluate this instruction for a presentation editor.

Presentation topic: "{presentation_topic}"
Content mode: {content_mode}
Audience: {audience}

Current slide context (sample):
{_json.dumps(slide_context, indent=2)}

User instruction: "{user_prompt}"
Instruction type: {mode}
  (patch = modify specific slides,
   general = apply to whole presentation,
   regen = regenerate everything)

Evaluate the instruction against these rules:

## RULE 1 — RELEVANCE
The instruction must relate to the presentation topic
or its content. Instructions about completely unrelated
topics should be rejected.

Relevant examples:
  Topic: "Chess" → "explain the knight's movement more clearly" ✓
  Topic: "Chess" → "add a section about openings" ✓
  Topic: "Chess" → "mention how chess relates to military strategy" ✓ (plausible connection)

Irrelevant examples:
  Topic: "Chess" → "write me a poem about my cat" ✗
  Topic: "Chess" → "add a recipe for pasta" ✗

## RULE 2 — FACTUAL INTEGRITY
The instruction must not ask the LLM to state something
demonstrably false or misleading.

Reject if the instruction asks to:
  - State known misinformation as fact
  - Contradict established scientific consensus
  - Make false historical claims
  - Attribute fake quotes to real people

Examples:
  "say the earth is flat" ✗
  "claim Einstein failed math" ✗
  "make it sound like vaccines cause autism" ✗

## RULE 3 — SCOPE APPROPRIATENESS
The instruction must be something an editor can reasonably do.
It should relate to content, structure, tone, depth, or presentation style.

Reject if:
  - Asking to do something outside a slide editor's capabilities
    (generate images from scratch, play music, etc.)
  - Completely nonsensical input

## RULE 4 — REFRAME BEFORE REJECTING
Before rejecting, try to reframe the instruction into something
relevant and actionable.

Example:
  User: "make it funnier"
  Topic: "Quantum Physics"
  Reframe: "Add accessible analogies and lighten the tone to make complex concepts more engaging"
  → action: "reframe"

Example:
  User: "add more about trains"
  Topic: "The Roman Empire"
  Reframe: "Add content about Roman transportation infrastructure and road networks"
  → action: "reframe"

Only reject when reframing is genuinely impossible.

## RULE 5 — TRUST THE USER
Do not be overly restrictive. The user knows their presentation.
If there is any reasonable interpretation of the instruction that
fits the topic, allow it. Err on the side of proceeding.

Return this exact JSON:
{{
  "valid": <true if action is proceed or reframe>,
  "action": "<proceed|reframe|reject>",
  "reframed_prompt": "<reframed instruction if action is reframe, null otherwise>",
  "reason": "<explanation for reframe or rejection, null if proceeding>",
  "confidence": <0.0-1.0, how confident you are in this assessment>
}}

Action rules:
  proceed  → instruction is fine as-is, use it directly
  reframe  → instruction needs adjustment, use reframed_prompt instead
  reject   → instruction cannot be made relevant or is factually harmful"""

    return system, user
