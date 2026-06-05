import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useStore, currentVersion } from "../store";
import { Slide, TopicResource, VersionSummary } from "../types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

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
    const subtitle = (slide.content as { subtitle?: string }).subtitle;
    const bullets = (slide.content as { bullets?: string[] }).bullets ?? [];
    const sourceRefs = (slide.content as { source_refs?: number[] }).source_refs ?? [];
    return (
      <div>
        {subtitle && (
          <p style={{ fontSize: 14, fontWeight: 600, borderLeft: "3px solid #16a34a", paddingLeft: 10, marginBottom: 12, color: "#374151" }}>
            {subtitle}
          </p>
        )}
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
  if (slide.layout === "embed") {
    const url = (slide.content as { url?: string }).url ?? "";
    const caption = (slide.content as { caption?: string }).caption;
    const isYoutube = url.includes("youtube.com") || url.includes("youtu.be");
    if (isYoutube) {
      const videoId = url.includes("youtu.be")
        ? url.split("youtu.be/")[1]?.split("?")[0]
        : new URL(url).searchParams.get("v") ?? "";
      return (
        <div>
          <iframe
            src={`https://www.youtube.com/embed/${videoId}`}
            width="100%"
            height="320px"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            style={{ borderRadius: 6, display: "block" }}
          />
          {caption && <div style={{ fontSize: 13, color: "#6b7280", marginTop: 8, fontStyle: "italic" }}>{caption}</div>}
        </div>
      );
    }
    return (
      <div>
        <a href={url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 15, color: "#2563eb" }}>{url}</a>
        {caption && <div style={{ fontSize: 13, color: "#6b7280", marginTop: 6, fontStyle: "italic" }}>{caption}</div>}
      </div>
    );
  }
  return <pre style={{ whiteSpace: "pre-wrap", fontSize: 13 }}>{JSON.stringify(slide.content, null, 2)}</pre>;
}

// ─── Slide editors ────────────────────────────────────────────────────────────

function BulletsEditor({ content, onChange }: { content: Record<string, unknown>; onChange: (c: Record<string, unknown>) => void }) {
  const subtitle = (content.subtitle as string | undefined) ?? "";
  const bullets = (content.bullets as string[] | undefined) ?? [];
  return (
    <div>
      <input value={subtitle} onChange={(e) => onChange({ ...content, subtitle: e.target.value })}
        placeholder="Subtitle" style={{ width: "100%", padding: 8, fontSize: 14, borderRadius: 4, border: "1px solid #e5e7eb", marginBottom: 12, boxSizing: "border-box" }} />
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
      <div className="flex gap-2 mt-4">
        <Button
          onClick={() => onSave(content)}
          disabled={isSaving}
          className="bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          {isSaving ? "Saving…" : "Save changes"}
        </Button>
        <Button variant="outline" onClick={onCancel} disabled={isSaving}>
          Cancel
        </Button>
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
    topic,
  } = useStore();

  const version = useStore(currentVersion);
  const [versionSummaries, setVersionSummaries] = useState<VersionSummary[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [patchTooltipVisible, setPatchTooltipVisible] = useState(false);
  const [applyingGeneral, setApplyingGeneral] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

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
    } catch {
      showToast("Could not save changes. Try again.");
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
    } catch {
      showToast("Patch failed. Try again.");
    } finally {
      setGenerating(false);
      setApplyingGeneral(false);
    }
  };

  const handleRegen = async () => {
    if (!id) return;
    if (!confirm("This will replace all slides with a new generation. Continue?")) return;
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
    } catch {
      showToast("Regeneration failed. Try again.");
    } finally {
      setGenerating(false);
    }
  };

  // Source badge color helper
  function sourceBadgeClass(source: string): string {
    switch (source) {
      case "generated": return "bg-blue-100 text-blue-700";
      case "ai_patch": return "bg-purple-100 text-purple-700";
      case "ai_regen": return "bg-orange-100 text-orange-700";
      case "outline_refined": return "bg-teal-100 text-teal-700";
      default: return "bg-gray-100 text-gray-600";
    }
  }

  return (
    <div className="flex flex-col h-screen">
      <style>{`
        @keyframes _editor-spin { to { transform: rotate(360deg); } }
        @keyframes _shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
      `}</style>

      {/* Toast banner */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
          <Card className="border-l-4 border-l-destructive shadow-lg px-4 py-3 flex items-center gap-3">
            <span
              style={{ cursor: "pointer", color: "var(--muted-foreground)" }}
              onClick={() => setToast(null)}
            >
              ✕
            </span>
            <span className="text-small">{toast}</span>
          </Card>
        </div>
      )}

      {/* Top bar */}
      <div
        className="flex items-center gap-2 px-4 border-b border-border bg-card shadow-sm"
        style={{ height: 52, flexShrink: 0 }}
      >
        <Button
          variant="ghost"
          size="icon"
          onClick={undo}
          disabled={currentVersionIndex <= 0}
          title="Undo"
        >
          ←
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={redo}
          disabled={currentVersionIndex >= versions.length - 1}
          title="Redo"
        >
          →
        </Button>
        <span className="text-small" style={{ color: "var(--muted-foreground)" }}>
          Version {currentVersionIndex + 1} of {versions.length}
        </span>

        {/* Confidence badge from active slide */}
        {activeSlide && (
          <Badge
            variant="secondary"
            style={{
              color: confidenceColor(activeSlide.confidence.score),
              background: confidenceColor(activeSlide.confidence.score) + "18",
            }}
          >
            {(activeSlide.confidence.score * 100).toFixed(0)}% confident
          </Badge>
        )}

        <div className="flex-1" />

        <Button
          variant="ghost"
          size="sm"
          onClick={toggleSidebar}
        >
          {isSidebarOpen ? "Hide history" : "History"}
        </Button>

        <Button
          size="sm"
          className="bg-primary text-primary-foreground font-semibold"
          disabled={!id}
          onClick={() => {
            const q = topic ? `?topic=${encodeURIComponent(topic)}` : "";
            window.open(`/present/${id}${q}`, "_blank");
          }}
        >
          ▶ Present
        </Button>

        <a
          href={id ? `${API}/presentations/${id}/export/pptx` : undefined}
          download
          className={cn(
            "text-small px-3 py-1.5 rounded-md border border-border font-medium transition-colors",
            id ? "hover:bg-muted" : "opacity-40 pointer-events-none"
          )}
        >
          Download PPTX
        </a>
      </div>

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left: slide panel (220px) */}
        <div
          className="border-r border-border flex-shrink-0 flex flex-col overflow-hidden"
          style={{ width: 220, background: "var(--muted)" }}
        >
          <div
            className="flex items-center justify-between px-3 border-b border-border"
            style={{ paddingTop: 10, paddingBottom: 10 }}
          >
            <span className="text-subheading">Slides</span>
            <Badge variant="secondary" className="text-micro">
              {version?.slides.length ?? 0}
            </Badge>
          </div>
          <div className="overflow-y-auto flex-1 py-1">
            {version?.slides.map((slide, idx) => (
              <div
                key={slide.id}
                onClick={() => setActiveSlide(slide.id)}
                className={cn(
                  "px-3 py-2.5 cursor-pointer rounded-sm mx-1 my-0.5 transition-colors",
                  activeSlideId === slide.id ? "" : "hover:bg-secondary"
                )}
                style={{
                  borderLeft: activeSlideId === slide.id
                    ? "3px solid #16a34a"
                    : "3px solid transparent",
                  background: activeSlideId === slide.id ? "rgba(22,163,74,0.08)" : undefined,
                }}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedSlideIds.includes(slide.id)}
                    onChange={(e) => { e.stopPropagation(); toggleSlideSelection(slide.id); }}
                  />
                  <span className="text-micro" style={{ color: "var(--muted-foreground)" }}>
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  <span className="text-small font-medium truncate">{slide.title}</span>
                </div>
                <div className="mt-0.5 ml-6">
                  <span
                    className="text-micro px-1.5 py-0.5 rounded"
                    style={{ background: "var(--border)", color: "var(--muted-foreground)" }}
                  >
                    {slide.layout}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Center: slide canvas */}
        <div
          className="flex-1 flex items-start justify-center overflow-y-auto p-8"
          style={{ background: "var(--muted)" }}
        >
          {activeSlide ? (
            <Card
              className={cn(
                "w-full max-w-3xl shadow-lg rounded-2xl",
                isEditing && "border-2 border-primary ring-2 ring-primary/20"
              )}
            >
              <CardContent className="p-12 min-h-96 relative">
                {/* Editing badge */}
                {isEditing && (
                  <div className="absolute top-4 right-4">
                    <Badge className="bg-primary text-primary-foreground">Editing</Badge>
                  </div>
                )}

                {/* Topic label */}
                <div className="text-subheading text-primary mb-2.5">
                  {activeSlide.layout}
                </div>

                {/* Slide title */}
                <div className="text-display mb-6">{activeSlide.title}</div>

                {/* Edit button when not editing */}
                {!isEditing && (
                  <div className="mb-4 flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsEditing(true)}
                    >
                      ✎ Edit slide
                    </Button>
                  </div>
                )}

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
              </CardContent>
            </Card>
          ) : (
            <p className="text-small" style={{ color: "var(--muted-foreground)" }}>
              Select a slide from the left panel.
            </p>
          )}
        </div>

        {/* Right: meta panel (260px) */}
        <div
          className="border-l border-border flex-shrink-0 flex flex-col overflow-hidden"
          style={{ width: 260, background: "var(--muted)" }}
        >
          <ScrollArea className="h-full">
            <div className="p-4">
              {activeSlide ? (
                <>
                  {/* Speaker notes */}
                  <div className="text-subheading mb-2">Speaker notes</div>
                  <p className="text-small" style={{ color: "var(--foreground)" }}>
                    {activeSlide.speaker_notes || (
                      <em style={{ color: "var(--muted-foreground)" }}>None</em>
                    )}
                  </p>

                  <Separator className="my-4" />

                  {/* Duration */}
                  <div className="text-subheading mb-1">Duration</div>
                  <div className="text-body">{activeSlide.estimated_minutes} min</div>

                  <Separator className="my-4" />

                  {/* Confidence */}
                  <div className="text-subheading mb-2">
                    Confidence {(activeSlide.confidence.score * 100).toFixed(0)}%
                  </div>
                  <Progress
                    value={activeSlide.confidence.score * 100}
                    className="h-1.5"
                    style={
                      { "--progress-fill": confidenceColor(activeSlide.confidence.score) } as React.CSSProperties
                    }
                  />
                  <div className="mt-2 flex flex-col gap-1">
                    {activeSlide.confidence.flags.map((f, i) => (
                      <Badge
                        key={i}
                        variant="secondary"
                        className="text-micro bg-yellow-50 text-yellow-800 border border-yellow-200 justify-start"
                      >
                        {f.type}: {f.detail}
                      </Badge>
                    ))}
                  </div>

                  {/* Resources */}
                  {topicResources.length > 0 && (() => {
                    const selected = topicResources.filter((r) => r.is_selected).slice(0, 5);
                    return (
                      <>
                        <Separator className="my-4" />
                        <div className="text-subheading mb-2">Resources</div>
                        {selected.length === 0 ? (
                          <p className="text-small" style={{ color: "var(--muted-foreground)" }}>
                            No resources selected.
                          </p>
                        ) : (
                          selected.map((r) => {
                            const domain = (() => { try { return new URL(r.url).hostname.replace("www.", ""); } catch { return ""; } })();
                            const icons: Record<string, string> = { video: "▶", paper: "📄", course: "🎓", article: "🔗" };
                            return (
                              <div key={r.id} className="mb-2">
                                <a
                                  href={r.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-small text-primary block truncate hover:underline"
                                >
                                  {icons[r.source_type]} {r.title.slice(0, 50)}{r.title.length > 50 ? "…" : ""}
                                </a>
                                <span className="text-micro" style={{ color: "#16a34a" }}>{domain}</span>
                              </div>
                            );
                          })
                        )}
                        {topicResources.filter((r) => r.is_selected).length > 5 && (
                          <div className="text-micro mt-1" style={{ color: "var(--muted-foreground)" }}>
                            +{topicResources.filter((r) => r.is_selected).length - 5} more
                          </div>
                        )}
                      </>
                    );
                  })()}
                </>
              ) : (
                <p className="text-small" style={{ color: "var(--muted-foreground)" }}>
                  No slide selected.
                </p>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Version sidebar (Sheet) */}
      <Sheet open={isSidebarOpen} onOpenChange={toggleSidebar}>
        <SheetContent side="right" className="w-80 p-0">
          <SheetHeader className="px-4 py-3 border-b">
            <SheetTitle className="text-small font-semibold">Version history</SheetTitle>
          </SheetHeader>
          <ScrollArea className="h-full">
            {versions.map((v, i) => (
              <div
                key={v.id}
                onClick={() => jumpToVersion(v.id)}
                className={cn(
                  "px-4 py-3 cursor-pointer border-b border-border/50 hover:bg-muted transition-colors",
                  i === currentVersionIndex && "bg-primary/5"
                )}
              >
                <Badge
                  variant="secondary"
                  className={cn("text-micro", sourceBadgeClass(v.source))}
                >
                  {v.source}
                </Badge>
                <div className="text-micro mt-1.5" style={{ color: "var(--muted-foreground)" }}>
                  {new Date(v.created_at).toLocaleTimeString()}
                </div>
              </div>
            ))}
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Bottom chat bar */}
      <div
        className="border-t border-border px-4 flex items-center gap-2 bg-background"
        style={{
          height: 68,
          flexShrink: 0,
          boxShadow: "0 -2px 8px rgba(0,0,0,0.04)",
        }}
      >
        <Input
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
          className="flex-1"
        />

        {/* Mode 1: General query (no slides selected) */}
        {selectedSlideIds.length === 0 && (
          <div
            className="relative"
            onMouseEnter={() => setPatchTooltipVisible(true)}
            onMouseLeave={() => setPatchTooltipVisible(false)}
          >
            {patchTooltipVisible && (
              <div
                className="absolute bottom-full right-0 mb-1.5 text-small rounded-md px-3 py-2 z-10 w-72"
                style={{
                  background: "#1f2937",
                  color: "#fff",
                  lineHeight: 1.5,
                  pointerEvents: "none",
                }}
              >
                Select slides in the left panel to patch specific slides, or use "Apply to presentation" for general changes
              </div>
            )}
            <Button
              onClick={() => handlePatch([])}
              disabled={isGenerating || !chatInput.trim()}
              className="whitespace-nowrap"
            >
              {applyingGeneral && (
                <span
                  style={{
                    width: 13,
                    height: 13,
                    border: "2px solid rgba(255,255,255,0.35)",
                    borderTopColor: "#fff",
                    borderRadius: "50%",
                    display: "inline-block",
                    animation: "_editor-spin 0.7s linear infinite",
                    flexShrink: 0,
                    marginRight: 6,
                  }}
                />
              )}
              {applyingGeneral ? "Applying…" : "Apply to presentation"}
            </Button>
          </div>
        )}

        {/* Mode 2: Targeted patch (slides selected) */}
        {selectedSlideIds.length > 0 && (
          <Button
            onClick={() => handlePatch(selectedSlideIds)}
            disabled={isGenerating || !chatInput.trim()}
            className="bg-primary hover:bg-primary/90 text-primary-foreground whitespace-nowrap"
          >
            Patch {selectedSlideIds.length} slide{selectedSlideIds.length === 1 ? "" : "s"}
          </Button>
        )}

        {/* Mode 3: Regen */}
        <Button
          variant="outline"
          onClick={handleRegen}
          disabled={isGenerating}
          className="text-orange-600 border-orange-200 hover:bg-orange-50 whitespace-nowrap"
        >
          Regenerate
        </Button>
      </div>
    </div>
  );
}
