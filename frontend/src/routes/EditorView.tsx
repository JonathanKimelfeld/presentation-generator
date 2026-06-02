import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useStore, currentVersion } from "../store";
import { Slide, TopicResource, VersionSummary } from "../types";

const API = "http://localhost:8000";

function confidenceColor(score: number): string {
  if (score >= 0.9) return "#16a34a";
  if (score >= 0.7) return "#ca8a04";
  if (score >= 0.5) return "#ea580c";
  return "#dc2626";
}

// ─── Inline ref parsing ───────────────────────────────────────────────────────

type InlinePart = { type: "text"; text: string } | { type: "ref"; index: number };

function parseInlineRefs(text: string): InlinePart[] {
  const parts: InlinePart[] = [];
  const regex = /\[(\d+)\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push({ type: "text", text: text.slice(lastIndex, match.index) });
    parts.push({ type: "ref", index: parseInt(match[1], 10) });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) parts.push({ type: "text", text: text.slice(lastIndex) });
  return parts;
}

// ─── ResourceTooltip ─────────────────────────────────────────────────────────

function ResourceTooltip({ resource }: { resource: TopicResource }) {
  const icons: Record<string, string> = { video: "▶", paper: "📄", course: "🎓", article: "🔗" };
  const typeLabels: Record<string, string> = { video: "Video", paper: "Paper", course: "Course", article: "Article" };
  const domain = (() => { try { return new URL(resource.url).hostname.replace("www.", ""); } catch { return ""; } })();
  return (
    <div style={{
      position: "absolute",
      zIndex: 200,
      background: "#ffffff",
      border: "1px solid #e5e7eb",
      borderRadius: 8,
      padding: "10px 14px",
      boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
      maxWidth: 280,
      bottom: "calc(100% + 4px)",
      left: "50%",
      transform: "translateX(-50%)",
      whiteSpace: "normal",
      textAlign: "left",
      pointerEvents: "none",
    }}>
      <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>
        {icons[resource.source_type] ?? "🔗"} {typeLabels[resource.source_type] ?? resource.source_type}
      </div>
      <div style={{ fontWeight: 600, fontSize: 13, color: "#111827", marginBottom: 4 }}>
        {resource.title.length > 60 ? resource.title.slice(0, 60) + "…" : resource.title}
      </div>
      <div style={{ fontSize: 11, color: "#16a34a", marginBottom: 6 }}>{domain}</div>
      <a href={resource.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "#2563eb", pointerEvents: "auto" }}>
        Open →
      </a>
    </div>
  );
}

// ─── InlineRefText ────────────────────────────────────────────────────────────

function InlineRefText({ text, topicResources }: { text: string; topicResources: TopicResource[] }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const parts = parseInlineRefs(text);
  return (
    <>
      {parts.map((part, i) => {
        if (part.type === "text") return <span key={i}>{part.text}</span>;
        const resource = topicResources[part.index - 1] as TopicResource | undefined;
        return (
          <span key={i} style={{ position: "relative", display: "inline" }}>
            <sup
              onClick={() => resource && window.open(resource.url, "_blank")}
              onMouseEnter={() => setHovered(part.index)}
              onMouseLeave={() => setHovered(null)}
              style={{ color: "#16a34a", fontSize: 11, cursor: resource ? "pointer" : "default", fontWeight: 600 }}
            >
              [{part.index}]
            </sup>
            {hovered === part.index && resource && <ResourceTooltip resource={resource} />}
          </span>
        );
      })}
    </>
  );
}

// ─── SourceChipsBar ───────────────────────────────────────────────────────────

const SRC_ICONS: Record<string, string> = { video: "▶", paper: "📄", course: "🎓", article: "🔗" };

function SourceChipsBar({ sourceRefs, topicResources }: { sourceRefs: number[]; topicResources: TopicResource[] }) {
  if (!sourceRefs || sourceRefs.length === 0) return null;
  const chips = sourceRefs.map((ref) => ({ ref, resource: topicResources[ref - 1] as TopicResource | undefined })).filter((c) => c.resource);
  if (chips.length === 0) return null;
  return (
    <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid #e5e7eb" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {chips.map(({ ref, resource }) => {
          const domain = (() => { try { return new URL(resource!.url).hostname.replace("www.", ""); } catch { return ""; } })();
          const title = resource!.title;
          return (
            <a
              key={ref}
              href={resource!.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: 12,
                color: "#16a34a",
                border: "1px solid #d1fae5",
                borderRadius: 4,
                padding: "2px 8px",
                textDecoration: "none",
                cursor: "pointer",
              }}
            >
              {SRC_ICONS[resource!.source_type] ?? "🔗"} [{ref}] {title.length > 30 ? title.slice(0, 30) + "…" : title} · {domain}
            </a>
          );
        })}
      </div>
    </div>
  );
}

// ─── NarrativeRenderer ───────────────────────────────────────────────────────

function NarrativeRenderer({ content, topicResources }: { content: Record<string, unknown>; topicResources: TopicResource[] }) {
  const subtitle = content.subtitle as string | undefined;
  const paragraphs = (content.paragraphs as string[] | undefined) ?? [];
  const sourceRefs = (content.source_refs as number[] | undefined) ?? [];
  return (
    <div>
      {subtitle && (
        <div style={{ fontSize: 18, fontWeight: 600, color: "#374151", borderLeft: "3px solid #16a34a", paddingLeft: 12, marginBottom: 16 }}>
          {subtitle}
        </div>
      )}
      {paragraphs.map((para, i) => (
        <p key={i} style={{ fontSize: 16, lineHeight: 1.75, color: "#1f2937", margin: "0 0 14px" }}>
          <InlineRefText text={para} topicResources={topicResources} />
        </p>
      ))}
      <SourceChipsBar sourceRefs={sourceRefs} topicResources={topicResources} />
    </div>
  );
}

// ─── MixedRenderer ───────────────────────────────────────────────────────────

function MixedRenderer({ content, topicResources }: { content: Record<string, unknown>; topicResources: TopicResource[] }) {
  const subtitle = content.subtitle as string | undefined;
  const intro = content.intro as string | undefined;
  const bullets = (content.bullets as string[] | undefined) ?? [];
  const sourceRefs = (content.source_refs as number[] | undefined) ?? [];
  return (
    <div>
      {subtitle && (
        <div style={{ fontSize: 18, fontWeight: 600, color: "#374151", borderLeft: "3px solid #16a34a", paddingLeft: 12, marginBottom: 16 }}>
          {subtitle}
        </div>
      )}
      {intro && (
        <p style={{ fontSize: 15, color: "#4b5563", lineHeight: 1.7, fontStyle: "italic", margin: "0 0 14px" }}>
          <InlineRefText text={intro} topicResources={topicResources} />
        </p>
      )}
      <ul style={{ paddingLeft: 20, margin: "0 0 0" }}>
        {bullets.map((b, i) => (
          <li key={i} style={{ marginBottom: 6, fontSize: 15, lineHeight: 1.6 }}>
            <InlineRefText text={b} topicResources={topicResources} />
          </li>
        ))}
      </ul>
      <SourceChipsBar sourceRefs={sourceRefs} topicResources={topicResources} />
    </div>
  );
}

// ─── VisualRenderer ──────────────────────────────────────────────────────────

function VisualRenderer({ content, topicResources }: { content: Record<string, unknown>; topicResources: TopicResource[] }) {
  const imageUrl = content.image_url as string | undefined;
  const imageAlt = content.image_alt as string | undefined;
  const caption = content.caption as string | undefined;
  const description = content.description as string | undefined;
  const sourceRefs = (content.source_refs as number[] | undefined) ?? [];
  const [imgStatus, setImgStatus] = useState<"loading" | "loaded" | "error">(imageUrl ? "loading" : "error");

  return (
    <div>
      <div style={{
        position: "relative",
        width: "100%",
        borderRadius: 8,
        overflow: "hidden",
        background: "#f3f4f6",
        marginBottom: 12,
        minHeight: 220,
      }}>
        {imgStatus === "loading" && (
          <div style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(90deg, #e5e7eb 25%, #f3f4f6 50%, #e5e7eb 75%)",
            backgroundSize: "200% 100%",
            animation: "_shimmer 1.4s infinite",
          }} />
        )}
        {imageUrl && imgStatus !== "error" ? (
          <img
            src={imageUrl}
            alt={imageAlt || caption || "Visual"}
            onLoad={() => setImgStatus("loaded")}
            onError={() => setImgStatus("error")}
            style={{
              width: "100%",
              maxHeight: 340,
              objectFit: "cover",
              display: imgStatus === "loaded" ? "block" : "none",
            }}
          />
        ) : null}
        {imgStatus === "error" && (
          <div style={{ padding: 32, textAlign: "center", color: "#9ca3af", fontSize: 14 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🖼</div>
            <div>No image available</div>
            <div style={{ fontSize: 12, marginTop: 4, color: "#d1d5db" }}>Edit this slide to set an image URL</div>
          </div>
        )}
      </div>
      {caption && (
        <div style={{ fontSize: 13, color: "#6b7280", fontStyle: "italic", textAlign: "center", marginBottom: 10 }}>{caption}</div>
      )}
      {description && (
        <p style={{ fontSize: 15, lineHeight: 1.7, color: "#374151", margin: "0 0 8px" }}>
          <InlineRefText text={description} topicResources={topicResources} />
        </p>
      )}
      <SourceChipsBar sourceRefs={sourceRefs} topicResources={topicResources} />
    </div>
  );
}

// ─── SlideViewer ─────────────────────────────────────────────────────────────

function SlideViewer({ slide, topicResources }: { slide: Slide; topicResources: TopicResource[] }) {
  if (slide.layout === "title") {
    const h = (slide.content as { heading?: string }).heading ?? slide.title;
    const sub = (slide.content as { subheading?: string }).subheading;
    return (
      <div>
        <h1 style={{ fontSize: 28, margin: "0 0 12px" }}>{h}</h1>
        {sub && <p style={{ fontSize: 16, color: "#6b7280", margin: 0 }}>{sub}</p>}
      </div>
    );
  }
  if (slide.layout === "narrative") return <NarrativeRenderer content={slide.content} topicResources={topicResources} />;
  if (slide.layout === "mixed") return <MixedRenderer content={slide.content} topicResources={topicResources} />;
  if (slide.layout === "visual") return <VisualRenderer content={slide.content} topicResources={topicResources} />;
  if (slide.layout === "bullets") {
    const bullets = (slide.content as { bullets?: string[] }).bullets ?? [];
    const sourceRefs = (slide.content as { source_refs?: number[] }).source_refs ?? [];
    return (
      <div>
        <ul style={{ paddingLeft: 20, margin: 0 }}>
          {bullets.map((b, i) => (
            <li key={i} style={{ marginBottom: 6 }}>
              <InlineRefText text={b} topicResources={topicResources} />
            </li>
          ))}
        </ul>
        <SourceChipsBar sourceRefs={sourceRefs} topicResources={topicResources} />
      </div>
    );
  }
  if (slide.layout === "quote") {
    const q = (slide.content as { quote?: string }).quote ?? "";
    const attr = (slide.content as { attribution?: string }).attribution;
    return (
      <div>
        <blockquote style={{ borderLeft: "4px solid #ccc", paddingLeft: 16, fontStyle: "italic", fontSize: 18, margin: 0 }}>{q}</blockquote>
        {attr && <div style={{ fontSize: 13, color: "#6b7280", marginTop: 8, paddingLeft: 20 }}>— {attr}</div>}
      </div>
    );
  }
  if (slide.layout === "two-col") {
    const left = (slide.content as { left?: string[] }).left ?? [];
    const right = (slide.content as { right?: string[] }).right ?? [];
    return (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <ul style={{ paddingLeft: 20, margin: 0 }}>{left.map((b, i) => <li key={i} style={{ marginBottom: 6 }}>{b}</li>)}</ul>
        <ul style={{ paddingLeft: 20, margin: 0 }}>{right.map((b, i) => <li key={i} style={{ marginBottom: 6 }}>{b}</li>)}</ul>
      </div>
    );
  }
  return <pre style={{ whiteSpace: "pre-wrap", fontSize: 13 }}>{JSON.stringify(slide.content, null, 2)}</pre>;
}

// ─── Slide editors ────────────────────────────────────────────────────────────

function BulletsEditor({ content, onChange }: { content: Record<string, unknown>; onChange: (c: Record<string, unknown>) => void }) {
  const bullets = (content.bullets as string[] | undefined) ?? [];
  return (
    <div>
      {bullets.map((bullet, i) => (
        <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <textarea
            value={bullet}
            onChange={(e) => { const nb = [...bullets]; nb[i] = e.target.value; onChange({ ...content, bullets: nb }); }}
            style={{ flex: 1, padding: 8, fontSize: 14, borderRadius: 4, border: "1px solid #e5e7eb", resize: "vertical" }}
            rows={2}
          />
          {bullets.length > 1 && (
            <button onClick={() => onChange({ ...content, bullets: bullets.filter((_, j) => j !== i) })}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: 18, flexShrink: 0 }}>×</button>
          )}
        </div>
      ))}
      <button onClick={() => onChange({ ...content, bullets: [...bullets, ""] })}
        style={{ fontSize: 13, color: "#16a34a", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
        + Add bullet
      </button>
    </div>
  );
}

function NarrativeEditor({ content, onChange }: { content: Record<string, unknown>; onChange: (c: Record<string, unknown>) => void }) {
  const subtitle = (content.subtitle as string | undefined) ?? "";
  const paragraphs = (content.paragraphs as string[] | undefined) ?? [];
  return (
    <div>
      <input value={subtitle} onChange={(e) => onChange({ ...content, subtitle: e.target.value })}
        placeholder="Subtitle" style={{ width: "100%", padding: 8, fontSize: 14, borderRadius: 4, border: "1px solid #e5e7eb", marginBottom: 12, boxSizing: "border-box" }} />
      {paragraphs.map((para, i) => (
        <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <textarea value={para}
            onChange={(e) => { const np = [...paragraphs]; np[i] = e.target.value; onChange({ ...content, paragraphs: np }); }}
            style={{ flex: 1, padding: 8, fontSize: 14, borderRadius: 4, border: "1px solid #e5e7eb", resize: "vertical" }} rows={4} />
          {paragraphs.length > 1 && (
            <button onClick={() => onChange({ ...content, paragraphs: paragraphs.filter((_, j) => j !== i) })}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: 18, flexShrink: 0 }}>×</button>
          )}
        </div>
      ))}
      <button onClick={() => onChange({ ...content, paragraphs: [...paragraphs, ""] })}
        style={{ fontSize: 13, color: "#16a34a", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
        + Add paragraph
      </button>
    </div>
  );
}

function MixedEditor({ content, onChange }: { content: Record<string, unknown>; onChange: (c: Record<string, unknown>) => void }) {
  const subtitle = (content.subtitle as string | undefined) ?? "";
  const intro = (content.intro as string | undefined) ?? "";
  const bullets = (content.bullets as string[] | undefined) ?? [];
  return (
    <div>
      <input value={subtitle} onChange={(e) => onChange({ ...content, subtitle: e.target.value })}
        placeholder="Subtitle" style={{ width: "100%", padding: 8, fontSize: 14, borderRadius: 4, border: "1px solid #e5e7eb", marginBottom: 8, boxSizing: "border-box" }} />
      <textarea value={intro} onChange={(e) => onChange({ ...content, intro: e.target.value })}
        placeholder="Intro paragraph" rows={3}
        style={{ width: "100%", padding: 8, fontSize: 14, borderRadius: 4, border: "1px solid #e5e7eb", marginBottom: 12, resize: "vertical", boxSizing: "border-box" }} />
      {bullets.map((bullet, i) => (
        <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <textarea value={bullet}
            onChange={(e) => { const nb = [...bullets]; nb[i] = e.target.value; onChange({ ...content, bullets: nb }); }}
            style={{ flex: 1, padding: 8, fontSize: 14, borderRadius: 4, border: "1px solid #e5e7eb", resize: "vertical" }} rows={2} />
          {bullets.length > 1 && (
            <button onClick={() => onChange({ ...content, bullets: bullets.filter((_, j) => j !== i) })}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: 18, flexShrink: 0 }}>×</button>
          )}
        </div>
      ))}
      <button onClick={() => onChange({ ...content, bullets: [...bullets, ""] })}
        style={{ fontSize: 13, color: "#16a34a", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
        + Add bullet
      </button>
    </div>
  );
}

function VisualEditor({ content, onChange, presentationId, slideId }: {
  content: Record<string, unknown>;
  onChange: (c: Record<string, unknown>) => void;
  presentationId: string;
  slideId: string;
}) {
  const imageUrl = (content.image_url as string | undefined) ?? "";
  const imageAlt = (content.image_alt as string | undefined) ?? "";
  const imageQuery = (content.image_query as string | undefined) ?? "";
  const caption = (content.caption as string | undefined) ?? "";
  const description = (content.description as string | undefined) ?? "";
  const [searching, setSearching] = useState(false);

  const handleSearch = async () => {
    if (!imageQuery.trim()) return;
    setSearching(true);
    try {
      const q = encodeURIComponent(imageQuery);
      const res = await fetch(`${API}/presentations/${presentationId}/slides/${slideId}/image?slide_title=${q}&topic=${q}&presentation_topic=${q}`);
      const data = await res.json();
      if (data.url) onChange({ ...content, image_url: data.url });
    } catch (e) {
      console.error("Image search failed:", e);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div>
        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>Image URL</div>
        <input value={imageUrl} onChange={(e) => onChange({ ...content, image_url: e.target.value })}
          placeholder="https://..." style={{ width: "100%", padding: 8, fontSize: 14, borderRadius: 4, border: "1px solid #e5e7eb", boxSizing: "border-box" }} />
      </div>
      <div>
        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>Search query</div>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={imageQuery} onChange={(e) => onChange({ ...content, image_query: e.target.value })}
            placeholder="e.g. neural network diagram" style={{ flex: 1, padding: 8, fontSize: 14, borderRadius: 4, border: "1px solid #e5e7eb" }} />
          <button onClick={handleSearch} disabled={searching || !imageQuery.trim()}
            style={{ padding: "8px 14px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 4, cursor: searching ? "not-allowed" : "pointer", fontSize: 13, opacity: searching ? 0.6 : 1, whiteSpace: "nowrap" }}>
            {searching ? "Searching…" : "Search again"}
          </button>
        </div>
      </div>
      <div>
        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>Alt text</div>
        <input value={imageAlt} onChange={(e) => onChange({ ...content, image_alt: e.target.value })}
          placeholder="Describe the image" style={{ width: "100%", padding: 8, fontSize: 14, borderRadius: 4, border: "1px solid #e5e7eb", boxSizing: "border-box" }} />
      </div>
      <div>
        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>Caption</div>
        <input value={caption} onChange={(e) => onChange({ ...content, caption: e.target.value })}
          placeholder="Short caption below the image" style={{ width: "100%", padding: 8, fontSize: 14, borderRadius: 4, border: "1px solid #e5e7eb", boxSizing: "border-box" }} />
      </div>
      <div>
        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>Description</div>
        <textarea value={description} onChange={(e) => onChange({ ...content, description: e.target.value })}
          placeholder="1-2 sentences explaining what this shows" rows={3}
          style={{ width: "100%", padding: 8, fontSize: 14, borderRadius: 4, border: "1px solid #e5e7eb", resize: "vertical", boxSizing: "border-box" }} />
      </div>
    </div>
  );
}

function SlideEditor({ slide, topicResources, onSave, onCancel, isSaving, presentationId }: {
  slide: Slide;
  topicResources: TopicResource[];
  onSave: (content: Record<string, unknown>) => void;
  onCancel: () => void;
  isSaving: boolean;
  presentationId: string;
}) {
  const [content, setContent] = useState<Record<string, unknown>>(() => JSON.parse(JSON.stringify(slide.content)));
  let editor: React.ReactNode;
  if (slide.layout === "narrative") editor = <NarrativeEditor content={content} onChange={setContent} />;
  else if (slide.layout === "mixed") editor = <MixedEditor content={content} onChange={setContent} />;
  else if (slide.layout === "bullets") editor = <BulletsEditor content={content} onChange={setContent} />;
  else if (slide.layout === "visual") editor = <VisualEditor content={content} onChange={setContent} presentationId={presentationId} slideId={slide.id} />;
  else editor = <pre style={{ fontSize: 13 }}>{JSON.stringify(content, null, 2)}</pre>;
  return (
    <div>
      {editor}
      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <button onClick={() => onSave(content)} disabled={isSaving}
          style={{ padding: "8px 16px", background: "#16a34a", color: "#fff", border: "none", borderRadius: 6, cursor: isSaving ? "not-allowed" : "pointer", fontSize: 14, opacity: isSaving ? 0.6 : 1 }}>
          {isSaving ? "Saving…" : "Save changes"}
        </button>
        <button onClick={onCancel} disabled={isSaving}
          style={{ padding: "8px 16px", background: "none", color: "#6b7280", border: "1px solid #e5e7eb", borderRadius: 6, cursor: "pointer", fontSize: 14 }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── EditorView ───────────────────────────────────────────────────────────────

export default function EditorView() {
  const { id } = useParams<{ id: string }>();
  const {
    versions,
    currentVersionIndex,
    setVersions,
    pushVersion,
    undo,
    redo,
    jumpToVersion,
    activeSlideId,
    setActiveSlide,
    selectedSlideIds,
    toggleSlideSelection,
    chatInput,
    setChatInput,
    isSidebarOpen,
    toggleSidebar,
    isGenerating,
    setGenerating,
    resources,
    setResources,
  } = useStore();

  const version = useStore(currentVersion);
  const [versionSummaries, setVersionSummaries] = useState<VersionSummary[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [patchTooltipVisible, setPatchTooltipVisible] = useState(false);
  const [applyingGeneral, setApplyingGeneral] = useState(false);

  // Reset edit mode when switching slides
  useEffect(() => { setIsEditing(false); }, [activeSlideId]);

  useEffect(() => {
    if (!id) return;
    fetch(`${API}/presentations/${id}/versions`)
      .then((r) => r.json())
      .then((summaries: VersionSummary[]) => {
        setVersionSummaries(summaries);
        return Promise.all(
          summaries.map((s) =>
            fetch(`${API}/presentations/${id}/versions/${s.id}`).then((r) => r.json())
          )
        );
      })
      .then((fullVersions) => {
        setVersions(fullVersions);
        if (fullVersions.length > 0) {
          const last = fullVersions[fullVersions.length - 1];
          if (last.slides.length > 0) setActiveSlide(last.slides[0].id);
          return fetch(`${API}/presentations/${id}/resources?version_id=${last.id}`)
            .then((r) => r.json())
            .then(setResources);
        }
      })
      .catch(console.error);
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeSlide = version?.slides.find((s) => s.id === activeSlideId) ?? null;
  const topicResources: TopicResource[] = activeSlide ? (resources[activeSlide.topic_id] ?? []) : [];

  async function handleSaveEdit(content: Record<string, unknown>) {
    if (!id || !activeSlide) return;
    setIsSaving(true);
    try {
      const res = await fetch(`${API}/presentations/${id}/slides/${activeSlide.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const newVersion = await res.json();
      pushVersion(newVersion);
      setIsEditing(false);
    } catch (err) {
      console.error("Save failed:", err);
    } finally {
      setIsSaving(false);
    }
  }

  const handlePatch = async (targetIds: string[]) => {
    if (!id || !chatInput.trim()) return;
    const isGeneral = targetIds.length === 0;
    if (isGeneral) setApplyingGeneral(true);
    setGenerating(true);
    try {
      const res = await fetch(`${API}/presentations/${id}/patch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: chatInput, target_slide_ids: targetIds }),
      });
      if (res.status === 409) {
        // Backend says regen required — fall through to regen
        await handleRegen();
        return;
      }
      const newVersion = await res.json();
      pushVersion(newVersion);
      setChatInput("");
    } finally {
      setGenerating(false);
      setApplyingGeneral(false);
    }
  };

  const handleRegen = async () => {
    if (!id) return;
    setGenerating(true);
    try {
      const res = await fetch(`${API}/presentations/${id}/regen`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: chatInput || null }),
      });
      const newVersion = await res.json();
      pushVersion(newVersion);
      setChatInput("");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", fontFamily: "sans-serif" }}>
      <style>{`
        @keyframes _editor-spin { to { transform: rotate(360deg); } }
        @keyframes _shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
      `}</style>
      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 16px", borderBottom: "1px solid #ddd", background: "#fafafa" }}>
        <button onClick={undo} disabled={currentVersionIndex <= 0} title="Undo"
          style={{ fontSize: 16, cursor: currentVersionIndex > 0 ? "pointer" : "not-allowed", opacity: currentVersionIndex > 0 ? 1 : 0.4, background: "none", border: "none" }}>←</button>
        <button onClick={redo} disabled={currentVersionIndex >= versions.length - 1} title="Redo"
          style={{ fontSize: 16, cursor: currentVersionIndex < versions.length - 1 ? "pointer" : "not-allowed", opacity: currentVersionIndex < versions.length - 1 ? 1 : 0.4, background: "none", border: "none" }}>→</button>
        <span style={{ fontSize: 13, color: "#555" }}>Version {currentVersionIndex + 1} of {versions.length}</span>
        <div style={{ flex: 1 }} />
        <a href={id ? `${API}/presentations/${id}/export/pptx` : undefined} download
          style={{ fontSize: 13, padding: "4px 12px", background: "#16a34a", color: "#fff", border: "none", borderRadius: 4, textDecoration: "none", cursor: "pointer", pointerEvents: id ? "auto" : "none", opacity: id ? 1 : 0.4 }}>
          Download PPTX
        </a>
        <button onClick={toggleSidebar} style={{ fontSize: 13, cursor: "pointer", background: "none", border: "1px solid #ccc", borderRadius: 4, padding: "4px 10px" }}>
          {isSidebarOpen ? "Hide history" : "History"}
        </button>
      </div>

      {/* Main area */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Left: slide list */}
        <div style={{ width: 200, borderRight: "1px solid #ddd", overflowY: "auto", padding: 8, flexShrink: 0 }}>
          {version?.slides.map((slide) => (
            <div key={slide.id} onClick={() => setActiveSlide(slide.id)}
              style={{ padding: "8px 10px", marginBottom: 4, borderRadius: 4, cursor: "pointer", background: activeSlideId === slide.id ? "#dbeafe" : "transparent", border: selectedSlideIds.includes(slide.id) ? "2px solid #2563eb" : "2px solid transparent", fontSize: 13 }}>
              <input type="checkbox" checked={selectedSlideIds.includes(slide.id)}
                onChange={(e) => { e.stopPropagation(); toggleSlideSelection(slide.id); }} style={{ marginRight: 6 }} />
              {slide.title}
            </div>
          ))}
        </div>

        {/* Center: slide content */}
        <div style={{ flex: 1, padding: 32, overflowY: "auto" }}>
          {activeSlide ? (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h3 style={{ margin: 0, color: "#555", fontSize: 13, textTransform: "uppercase", letterSpacing: 1 }}>
                  {activeSlide.layout}
                </h3>
                {!isEditing && (
                  <button onClick={() => setIsEditing(true)}
                    style={{ fontSize: 13, background: "none", border: "1px solid #e5e7eb", borderRadius: 4, padding: "4px 10px", cursor: "pointer", color: "#374151" }}>
                    ✎ Edit slide
                  </button>
                )}
              </div>
              {isEditing ? (
                <SlideEditor
                  slide={activeSlide}
                  topicResources={topicResources}
                  onSave={handleSaveEdit}
                  onCancel={() => setIsEditing(false)}
                  isSaving={isSaving}
                  presentationId={id ?? ""}
                />
              ) : (
                <SlideViewer slide={activeSlide} topicResources={topicResources} />
              )}
            </>
          ) : (
            <p style={{ color: "#aaa" }}>Select a slide from the left panel.</p>
          )}
        </div>

        {/* Right: speaker notes + meta */}
        <div style={{ width: 240, borderLeft: "1px solid #ddd", padding: 16, overflowY: "auto", flexShrink: 0 }}>
          {activeSlide ? (
            <>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>Speaker notes</div>
                <p style={{ fontSize: 13, color: "#333", margin: 0 }}>
                  {activeSlide.speaker_notes || <em style={{ color: "#aaa" }}>None</em>}
                </p>
              </div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: "#888" }}>Est. duration</div>
                <div style={{ fontSize: 14 }}>{activeSlide.estimated_minutes} min</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>
                  Confidence {(activeSlide.confidence.score * 100).toFixed(0)}%
                </div>
                <div style={{ height: 6, background: "#eee", borderRadius: 3 }}>
                  <div style={{ height: "100%", borderRadius: 3, width: `${activeSlide.confidence.score * 100}%`, background: confidenceColor(activeSlide.confidence.score) }} />
                </div>
                {activeSlide.confidence.flags.map((f, i) => (
                  <div key={i} style={{ marginTop: 6, fontSize: 11, color: "#b45309", background: "#fef3c7", borderRadius: 3, padding: "3px 6px" }}>
                    {f.type}: {f.detail}
                  </div>
                ))}
              </div>
              {(() => {
                const selected = topicResources.filter((r) => r.is_selected).slice(0, 5);
                if (topicResources.length === 0) return null;
                return (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontSize: 12, color: "#888", marginBottom: 8 }}>Resources</div>
                    {selected.length === 0 ? (
                      <p style={{ fontSize: 12, color: "#aaa", margin: 0 }}>No resources selected.</p>
                    ) : (
                      selected.map((r) => {
                        const domain = (() => { try { return new URL(r.url).hostname.replace("www.", ""); } catch { return ""; } })();
                        const icons: Record<string, string> = { video: "▶", paper: "📄", course: "🎓", article: "🔗" };
                        return (
                          <div key={r.id} style={{ marginBottom: 8 }}>
                            <a href={r.url} target="_blank" rel="noopener noreferrer"
                              style={{ fontSize: 12, color: "#2563eb", textDecoration: "none", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {icons[r.source_type]} {r.title.slice(0, 50)}{r.title.length > 50 ? "…" : ""}
                            </a>
                            <span style={{ fontSize: 10, color: "#16a34a" }}>{domain}</span>
                          </div>
                        );
                      })
                    )}
                    {topicResources.filter((r) => r.is_selected).length > 5 && (
                      <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>
                        +{topicResources.filter((r) => r.is_selected).length - 5} more
                      </div>
                    )}
                  </div>
                );
              })()}
            </>
          ) : (
            <p style={{ color: "#aaa", fontSize: 13 }}>No slide selected.</p>
          )}
        </div>

        {/* Version sidebar */}
        {isSidebarOpen && (
          <div style={{ width: 240, borderLeft: "1px solid #ddd", overflowY: "auto", background: "#f9f9f9" }}>
            <div style={{ padding: 12, borderBottom: "1px solid #ddd", fontWeight: 600, fontSize: 13 }}>Version history</div>
            {versions.map((v, i) => (
              <div key={v.id} onClick={() => jumpToVersion(v.id)}
                style={{ padding: "10px 12px", cursor: "pointer", background: i === currentVersionIndex ? "#dbeafe" : "transparent", borderBottom: "1px solid #eee", fontSize: 12 }}>
                <span style={{ display: "inline-block", marginRight: 6, padding: "1px 6px", background: "#e5e7eb", borderRadius: 9999 }}>{v.source}</span>
                <div style={{ marginTop: 2, color: "#666" }}>{new Date(v.created_at).toLocaleTimeString()}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div style={{ borderTop: "1px solid #ddd", padding: "10px 16px", display: "flex", gap: 8, alignItems: "center", background: "#fafafa" }}>
        <input
          type="text"
          placeholder={
            selectedSlideIds.length > 0
              ? `Describe changes for the ${selectedSlideIds.length} selected slide${selectedSlideIds.length === 1 ? "" : "s"}…`
              : "Ask anything about this presentation…"
          }
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !isGenerating && chatInput.trim()) {
              e.preventDefault();
              selectedSlideIds.length > 0 ? handlePatch(selectedSlideIds) : handlePatch([]);
            }
          }}
          style={{ flex: 1, padding: "8px 12px", border: "1px solid #ccc", borderRadius: 6, fontSize: 14 }}
        />

        {/* Mode 1: General query (no slides selected) */}
        {selectedSlideIds.length === 0 && (
          <div style={{ position: "relative" }}
            onMouseEnter={() => setPatchTooltipVisible(true)}
            onMouseLeave={() => setPatchTooltipVisible(false)}
          >
            {patchTooltipVisible && (
              <div style={{
                position: "absolute",
                bottom: "calc(100% + 6px)",
                right: 0,
                background: "#1f2937",
                color: "#ffffff",
                fontSize: 12,
                borderRadius: 6,
                padding: "6px 10px",
                maxWidth: 300,
                whiteSpace: "normal" as const,
                width: 280,
                lineHeight: 1.5,
                pointerEvents: "none",
                zIndex: 100,
              }}>
                Select slides in the left panel to patch specific slides, or use "Apply to presentation" for general changes
              </div>
            )}
            <button
              onClick={() => handlePatch([])}
              disabled={isGenerating || !chatInput.trim()}
              style={{
                padding: "8px 16px",
                background: "#2563eb",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                cursor: isGenerating || !chatInput.trim() ? "not-allowed" : "pointer",
                fontSize: 14,
                opacity: !applyingGeneral && !chatInput.trim() ? 0.5 : 1,
                transition: "opacity 150ms ease",
                whiteSpace: "nowrap",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              {applyingGeneral && (
                <span style={{
                  width: 13,
                  height: 13,
                  border: "2px solid rgba(255,255,255,0.35)",
                  borderTopColor: "#fff",
                  borderRadius: "50%",
                  display: "inline-block",
                  animation: "_editor-spin 0.7s linear infinite",
                  flexShrink: 0,
                }} />
              )}
              {applyingGeneral ? "Applying…" : "Apply to presentation"}
            </button>
          </div>
        )}

        {/* Mode 2: Targeted patch (slides selected) */}
        {selectedSlideIds.length > 0 && (
          <button
            onClick={() => handlePatch(selectedSlideIds)}
            disabled={isGenerating || !chatInput.trim()}
            style={{
              padding: "8px 16px",
              background: "#16a34a",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              cursor: isGenerating || !chatInput.trim() ? "not-allowed" : "pointer",
              fontSize: 14,
              opacity: isGenerating || !chatInput.trim() ? 0.5 : 1,
              transition: "opacity 150ms ease",
              whiteSpace: "nowrap",
            }}
          >
            Patch {selectedSlideIds.length} slide{selectedSlideIds.length === 1 ? "" : "s"}
          </button>
        )}

        {/* Mode 3: Regen (always visible) */}
        <button onClick={handleRegen} disabled={isGenerating}
          style={{ padding: "8px 16px", background: "#7c3aed", color: "#fff", border: "none", borderRadius: 6, cursor: isGenerating ? "not-allowed" : "pointer", fontSize: 14, opacity: isGenerating ? 0.5 : 1, whiteSpace: "nowrap" }}>
          Regenerate
        </button>
      </div>
    </div>
  );
}
