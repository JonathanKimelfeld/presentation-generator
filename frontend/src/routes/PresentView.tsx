import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Slide, Outline } from "../types";

const API = "http://localhost:8000";

// ── Inline ref renderer (plain superscripts — no tooltip in present mode) ─────

type Part = { type: "text"; text: string } | { type: "ref"; index: number };

function parseRefs(text: string): Part[] {
  const parts: Part[] = [];
  const re = /\[(\d+)\]/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push({ type: "text", text: text.slice(last, m.index) });
    parts.push({ type: "ref", index: parseInt(m[1], 10) });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ type: "text", text: text.slice(last) });
  return parts;
}

function Refs({ text }: { text: string }) {
  return (
    <>
      {parseRefs(text).map((p, i) =>
        p.type === "ref"
          ? <sup key={i} style={{ color: "#16a34a", fontSize: 11, fontWeight: 600 }}>[{p.index}]</sup>
          : <span key={i}>{p.text}</span>
      )}
    </>
  );
}

// ── Layout content renderers ──────────────────────────────────────────────────

function TitleContent({ content }: { content: Record<string, unknown> }) {
  const heading = (content.heading as string | undefined) ?? "";
  const sub = content.subheading as string | undefined;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, textAlign: "center", minHeight: 300 }}>
      <div style={{ fontSize: 48, fontWeight: 800, color: "#111827", lineHeight: 1.2 }}>{heading}</div>
      {sub && <div style={{ fontSize: 20, color: "#6b7280", marginTop: 16 }}>{sub}</div>}
    </div>
  );
}

function BulletsContent({ content }: { content: Record<string, unknown> }) {
  const subtitle = content.subtitle as string | undefined;
  const bullets = (content.bullets as string[] | undefined) ?? [];
  return (
    <div>
      {subtitle && (
        <div style={{ fontSize: 18, fontWeight: 600, borderLeft: "3px solid #16a34a", paddingLeft: 12, marginBottom: 20, color: "#374151" }}>
          {subtitle}
        </div>
      )}
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {bullets.map((b, i) => (
          <li key={i} style={{ fontSize: 20, lineHeight: 1.6, color: "#1f2937", padding: "10px 0", borderBottom: "1px solid #f9fafb", display: "flex", gap: 12, alignItems: "flex-start" }}>
            <span style={{ color: "#16a34a", flexShrink: 0, marginTop: 3 }}>→</span>
            <span><Refs text={b} /></span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function NarrativeContent({ content }: { content: Record<string, unknown> }) {
  const subtitle = content.subtitle as string | undefined;
  const paragraphs = (content.paragraphs as string[] | undefined) ?? [];
  return (
    <div>
      {subtitle && (
        <div style={{ fontSize: 18, fontWeight: 600, borderLeft: "3px solid #16a34a", paddingLeft: 12, marginBottom: 20, color: "#374151" }}>
          {subtitle}
        </div>
      )}
      {paragraphs.map((p, i) => (
        <p key={i} style={{ fontSize: 18, lineHeight: 1.8, color: "#1f2937", marginBottom: 16, margin: "0 0 16px" }}>
          <Refs text={p} />
        </p>
      ))}
    </div>
  );
}

function MixedContent({ content }: { content: Record<string, unknown> }) {
  const subtitle = content.subtitle as string | undefined;
  const intro = content.intro as string | undefined;
  const bullets = (content.bullets as string[] | undefined) ?? [];
  return (
    <div>
      {subtitle && (
        <div style={{ fontSize: 18, fontWeight: 600, borderLeft: "3px solid #16a34a", paddingLeft: 12, marginBottom: 16, color: "#374151" }}>
          {subtitle}
        </div>
      )}
      {intro && (
        <p style={{ fontSize: 17, fontStyle: "italic", color: "#4b5563", marginBottom: 16, lineHeight: 1.7, margin: "0 0 16px" }}>
          <Refs text={intro} />
        </p>
      )}
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {bullets.map((b, i) => (
          <li key={i} style={{ fontSize: 18, lineHeight: 1.6, color: "#1f2937", padding: "8px 0", borderBottom: "1px solid #f9fafb", display: "flex", gap: 12, alignItems: "flex-start" }}>
            <span style={{ color: "#16a34a", flexShrink: 0, marginTop: 2 }}>→</span>
            <span><Refs text={b} /></span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function QuoteContent({ content }: { content: Record<string, unknown> }) {
  const quote = (content.quote as string | undefined) ?? "";
  const attribution = content.attribution as string | undefined;
  return (
    <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", flex: 1 }}>
      <blockquote style={{ fontSize: 28, fontStyle: "italic", borderLeft: "4px solid #16a34a", paddingLeft: 24, color: "#111827", margin: 0, lineHeight: 1.5 }}>
        {quote}
      </blockquote>
      {attribution && (
        <div style={{ fontSize: 16, color: "#6b7280", marginTop: 16, paddingLeft: 28 }}>— {attribution}</div>
      )}
    </div>
  );
}

function TwoColContent({ content }: { content: Record<string, unknown> }) {
  const left = (content.left as string[] | undefined) ?? [];
  const right = (content.right as string[] | undefined) ?? [];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {left.map((item, i) => (
          <li key={i} style={{ fontSize: 18, padding: "8px 0", borderBottom: "1px solid #f9fafb" }}>{item}</li>
        ))}
      </ul>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {right.map((item, i) => (
          <li key={i} style={{ fontSize: 18, padding: "8px 0", borderBottom: "1px solid #f9fafb" }}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function VisualContent({ content }: { content: Record<string, unknown> }) {
  const imageUrl = content.image_url as string | undefined;
  const imageAlt = content.image_alt as string | undefined;
  const caption = content.caption as string | undefined;
  const description = content.description as string | undefined;
  return (
    <div>
      {imageUrl && (
        <img
          src={imageUrl}
          alt={imageAlt || caption || "Visual"}
          style={{ maxHeight: 320, objectFit: "contain", width: "100%", borderRadius: 8, display: "block" }}
        />
      )}
      {caption && (
        <div style={{ fontSize: 13, color: "#6b7280", fontStyle: "italic", marginTop: 8 }}>{caption}</div>
      )}
      {description && (
        <p style={{ fontSize: 17, lineHeight: 1.7, color: "#374151", marginTop: 12, margin: "12px 0 0" }}>
          <Refs text={description} />
        </p>
      )}
    </div>
  );
}

function EmbedContent({ content }: { content: Record<string, unknown> }) {
  const url = (content.url as string | undefined) ?? "";
  const caption = content.caption as string | undefined;
  const isYoutube = url.includes("youtube.com") || url.includes("youtu.be");
  if (isYoutube) {
    let videoId = "";
    try {
      videoId = url.includes("youtu.be")
        ? url.split("youtu.be/")[1]?.split("?")[0] ?? ""
        : new URL(url).searchParams.get("v") ?? "";
    } catch { /* bad URL */ }
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
      <a href={url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 16, color: "#2563eb", wordBreak: "break-all" }}>{url}</a>
      {caption && <div style={{ fontSize: 13, color: "#6b7280", marginTop: 8, fontStyle: "italic" }}>{caption}</div>}
    </div>
  );
}

function SlideContent({ slide }: { slide: Slide }) {
  const c = slide.content;
  switch (slide.layout) {
    case "title":    return <TitleContent content={c} />;
    case "bullets":  return <BulletsContent content={c} />;
    case "narrative":return <NarrativeContent content={c} />;
    case "mixed":    return <MixedContent content={c} />;
    case "quote":    return <QuoteContent content={c} />;
    case "two-col":  return <TwoColContent content={c} />;
    case "visual":   return <VisualContent content={c} />;
    case "embed":    return <EmbedContent content={c} />;
    default:         return <pre style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>{JSON.stringify(c, null, 2)}</pre>;
  }
}

function confColor(score: number) {
  if (score >= 0.9) return "#16a34a";
  if (score >= 0.7) return "#ca8a04";
  if (score >= 0.5) return "#ea580c";
  return "#dc2626";
}

// ── PresentView ───────────────────────────────────────────────────────────────

export default function PresentView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [slides, setSlides] = useState<Slide[]>([]);
  const [outline, setOutline] = useState<Outline | null>(null);
  const [topic, setTopic] = useState(searchParams.get("topic") ?? "");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showNotes, setShowNotes] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const exit = useCallback(() => {
    window.close();
    navigate(`/editor/${id}`);
  }, [id, navigate]);

  useEffect(() => {
    if (!id) return;
    fetch(`${API}/presentations/${id}/versions`)
      .then((r) => r.json())
      .then(async (summaries: { id: string }[]) => {
        if (!summaries.length) throw new Error("no versions");
        const last = summaries[summaries.length - 1];
        const v = await fetch(`${API}/presentations/${id}/versions/${last.id}`).then((r) => r.json());
        const sorted = [...(v.slides as Slide[])].sort((a, b) =>
          a.position < b.position ? -1 : a.position > b.position ? 1 : 0
        );
        setSlides(sorted);
        setOutline(v.outline ?? null);
        // Derive topic from title slide heading if not passed via URL
        if (!searchParams.get("topic")) {
          const titleSlide = sorted.find((s) => s.layout === "title");
          const heading = titleSlide ? (titleSlide.content as { heading?: string }).heading : null;
          if (heading) setTopic(heading);
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        setCurrentIndex((i) => Math.min(i + 1, slides.length - 1));
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setCurrentIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Escape") {
        exit();
      } else if (e.key === "f" || e.key === "F") {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen().catch(() => {});
        }
      } else if (e.key === "n" || e.key === "N") {
        setShowNotes((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [slides.length, exit]);

  if (loading) {
    return (
      <div style={{ height: "100vh", background: "#0f0f0f", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, fontFamily: "sans-serif" }}>
        <style>{`@keyframes _pv-spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ width: 36, height: 36, border: "3px solid rgba(255,255,255,0.1)", borderTopColor: "rgba(255,255,255,0.6)", borderRadius: "50%", animation: "_pv-spin 0.8s linear infinite" }} />
        <div style={{ fontSize: 14, color: "rgba(255,255,255,0.6)" }}>Loading presentation…</div>
      </div>
    );
  }

  if (error || !slides.length) {
    return (
      <div style={{ height: "100vh", background: "#0f0f0f", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, fontFamily: "sans-serif" }}>
        <div style={{ fontSize: 20, color: "rgba(255,255,255,0.7)" }}>Could not load presentation.</div>
        <button
          onClick={() => navigate(`/editor/${id}`)}
          style={{ padding: "8px 16px", background: "none", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 6, cursor: "pointer", fontSize: 14 }}
        >
          ← Back to editor
        </button>
      </div>
    );
  }

  const slide = slides[currentIndex];
  const topicName = outline?.topics.find((t) => t.id === slide.topic_id)?.title ?? "";
  const total = slides.length;

  return (
    <div style={{ height: "100vh", background: "#0f0f0f", display: "flex", flexDirection: "column", fontFamily: "sans-serif", overflow: "hidden", position: "relative" }}>
      <style>{`
        @keyframes _pv-spin { to { transform: rotate(360deg); } }
        @keyframes _pv-in { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
      `}</style>

      {/* ── TopBar ── */}
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, height: 48, zIndex: 40,
        background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)",
        display: "flex", alignItems: "center", padding: "0 24px", gap: 16,
      }}>
        <div style={{ flex: 1, fontSize: 14, fontWeight: 500, color: "rgba(255,255,255,0.7)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {topic}
        </div>
        <div style={{ flex: 1, fontSize: 13, color: "rgba(255,255,255,0.5)", textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {topicName}
        </div>
        <div style={{ flex: 1, display: "flex", justifyContent: "flex-end" }}>
          <button
            onClick={exit}
            style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", background: "none", border: "none", cursor: "pointer", padding: "4px 8px" }}
          >
            ✕ Exit
          </button>
        </div>
      </div>

      {/* ── SlideCanvas ── */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "96px 64px 112px", overflow: "hidden" }}>
        <div
          key={currentIndex}
          style={{
            maxWidth: 960,
            width: "100%",
            background: "white",
            borderRadius: 16,
            padding: "56px 64px",
            boxShadow: "0 32px 80px rgba(0,0,0,0.5)",
            minHeight: 480,
            display: "flex",
            flexDirection: "column",
            animation: "_pv-in 250ms ease",
            boxSizing: "border-box",
          }}
        >
          {/* Topic label — shown on all non-title slides */}
          {topicName && slide.layout !== "title" && (
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#16a34a", marginBottom: 10 }}>
              {topicName}
            </div>
          )}

          {/* Slide title — shown on all non-title layout slides */}
          {slide.layout !== "title" && (
            <div style={{ fontSize: 38, fontWeight: 700, color: "#111827", lineHeight: 1.2, marginBottom: 28 }}>
              {slide.title}
            </div>
          )}

          {/* Content */}
          <div style={{ flex: 1 }}>
            <SlideContent slide={slide} />
          </div>

          {/* Footer */}
          <div style={{ marginTop: "auto", paddingTop: 24, borderTop: "1px solid #f3f4f6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "#9ca3af" }}>~{slide.estimated_minutes} min</span>
            <span style={{ fontSize: 12, color: confColor(slide.confidence.score) }}>
              {Math.round(slide.confidence.score * 100)}% confident
            </span>
          </div>
        </div>
      </div>

      {/* ── BottomBar ── */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, height: 64, zIndex: 40,
        background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)",
        display: "flex", alignItems: "center", padding: "0 24px", gap: 24,
      }}>
        {/* Counter */}
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", minWidth: 52 }}>
          {currentIndex + 1} / {total}
        </div>

        {/* Nav controls */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 24 }}>
          <button
            onClick={() => setCurrentIndex((i) => Math.max(i - 1, 0))}
            disabled={currentIndex === 0}
            style={{
              fontSize: 20, background: "none", border: "none",
              cursor: currentIndex === 0 ? "not-allowed" : "pointer",
              color: currentIndex === 0 ? "rgba(255,255,255,0.2)" : "white",
              lineHeight: 1,
            }}
          >←</button>

          <div style={{ width: 200, height: 3, background: "rgba(255,255,255,0.15)", borderRadius: 2, overflow: "hidden" }}>
            <div style={{
              height: "100%",
              background: "white",
              width: `${((currentIndex + 1) / total) * 100}%`,
              transition: "width 300ms ease",
              borderRadius: 2,
            }} />
          </div>

          <button
            onClick={() => setCurrentIndex((i) => Math.min(i + 1, total - 1))}
            disabled={currentIndex === total - 1}
            style={{
              fontSize: 20, background: "none", border: "none",
              cursor: currentIndex === total - 1 ? "not-allowed" : "pointer",
              color: currentIndex === total - 1 ? "rgba(255,255,255,0.2)" : "white",
              lineHeight: 1,
            }}
          >→</button>
        </div>

        {/* Notes toggle */}
        <button
          onClick={() => setShowNotes((v) => !v)}
          style={{
            fontSize: 13,
            color: showNotes ? "white" : "rgba(255,255,255,0.6)",
            background: showNotes ? "rgba(255,255,255,0.1)" : "none",
            border: "none", cursor: "pointer",
            padding: "4px 10px", borderRadius: 4,
          }}
        >
          📝 Notes
        </button>
      </div>

      {/* ── Speaker Notes Panel ── */}
      {showNotes && (
        <div style={{
          position: "fixed", bottom: 64, right: 0,
          width: 320, maxHeight: "40vh",
          background: "rgba(15,15,15,0.95)",
          borderLeft: "1px solid rgba(255,255,255,0.1)",
          borderTop: "1px solid rgba(255,255,255,0.1)",
          padding: 20, overflowY: "auto", zIndex: 39,
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>
            Speaker Notes
          </div>
          {slide.speaker_notes ? (
            <div style={{ fontSize: 14, lineHeight: 1.7, color: "rgba(255,255,255,0.8)" }}>
              {slide.speaker_notes}
            </div>
          ) : (
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.3)", fontStyle: "italic" }}>
              No notes for this slide.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
