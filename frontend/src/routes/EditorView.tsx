import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useStore, currentVersion } from "../store";
import { Slide, VersionSummary } from "../types";

const API = "http://localhost:8000";

function confidenceColor(score: number): string {
  if (score >= 0.9) return "#16a34a";
  if (score >= 0.7) return "#ca8a04";
  if (score >= 0.5) return "#ea580c";
  return "#dc2626";
}

function SlideContent({ slide }: { slide: Slide }) {
  if (slide.layout === "title") {
    const h = (slide.content as { heading?: string }).heading ?? slide.title;
    return <h1 style={{ fontSize: 28, margin: 0 }}>{h}</h1>;
  }
  if (slide.layout === "bullets") {
    const bullets = (slide.content as { bullets?: string[] }).bullets ?? [];
    return (
      <ul style={{ paddingLeft: 20, margin: 0 }}>
        {bullets.map((b, i) => <li key={i} style={{ marginBottom: 6 }}>{b}</li>)}
      </ul>
    );
  }
  if (slide.layout === "quote") {
    const q = (slide.content as { quote?: string }).quote ?? "";
    return <blockquote style={{ borderLeft: "4px solid #ccc", paddingLeft: 16, fontStyle: "italic" }}>{q}</blockquote>;
  }
  return <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(slide.content, null, 2)}</pre>;
}

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

  useEffect(() => {
    if (!id) return;
    fetch(`${API}/presentations/${id}/versions`)
      .then((r) => r.json())
      .then((summaries: VersionSummary[]) => {
        setVersionSummaries(summaries);
        // Fetch full versions in order
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
          // Fetch resources for the latest version
          return fetch(`${API}/presentations/${id}/resources?version_id=${last.id}`)
            .then((r) => r.json())
            .then(setResources);
        }
      })
      .catch(console.error);
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeSlide = version?.slides.find((s) => s.id === activeSlideId) ?? null;

  const handlePatch = async () => {
    if (!id || !chatInput.trim() || selectedSlideIds.length === 0) return;
    setGenerating(true);
    try {
      const res = await fetch(`${API}/presentations/${id}/patch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: chatInput, target_slide_ids: selectedSlideIds }),
      });
      const newVersion = await res.json();
      pushVersion(newVersion);
      setChatInput("");
    } finally {
      setGenerating(false);
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
      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 16px", borderBottom: "1px solid #ddd", background: "#fafafa" }}>
        <button
          onClick={undo}
          disabled={currentVersionIndex <= 0}
          title="Undo"
          style={{ fontSize: 16, cursor: currentVersionIndex > 0 ? "pointer" : "not-allowed", opacity: currentVersionIndex > 0 ? 1 : 0.4, background: "none", border: "none" }}
        >
          ←
        </button>
        <button
          onClick={redo}
          disabled={currentVersionIndex >= versions.length - 1}
          title="Redo"
          style={{ fontSize: 16, cursor: currentVersionIndex < versions.length - 1 ? "pointer" : "not-allowed", opacity: currentVersionIndex < versions.length - 1 ? 1 : 0.4, background: "none", border: "none" }}
        >
          →
        </button>
        <span style={{ fontSize: 13, color: "#555" }}>
          Version {currentVersionIndex + 1} of {versions.length}
        </span>
        <div style={{ flex: 1 }} />
        <a
          href={id ? `${API}/presentations/${id}/export/pptx` : undefined}
          download
          style={{
            fontSize: 13,
            padding: "4px 12px",
            background: "#16a34a",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            textDecoration: "none",
            cursor: "pointer",
            pointerEvents: id ? "auto" : "none",
            opacity: id ? 1 : 0.4,
          }}
        >
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
            <div
              key={slide.id}
              onClick={() => setActiveSlide(slide.id)}
              style={{
                padding: "8px 10px",
                marginBottom: 4,
                borderRadius: 4,
                cursor: "pointer",
                background: activeSlideId === slide.id ? "#dbeafe" : "transparent",
                border: selectedSlideIds.includes(slide.id) ? "2px solid #2563eb" : "2px solid transparent",
                fontSize: 13,
              }}
            >
              <input
                type="checkbox"
                checked={selectedSlideIds.includes(slide.id)}
                onChange={(e) => { e.stopPropagation(); toggleSlideSelection(slide.id); }}
                style={{ marginRight: 6 }}
              />
              {slide.title}
            </div>
          ))}
        </div>

        {/* Center: slide content */}
        <div style={{ flex: 1, padding: 32, overflowY: "auto" }}>
          {activeSlide ? (
            <>
              <h3 style={{ margin: "0 0 16px", color: "#555", fontSize: 13, textTransform: "uppercase", letterSpacing: 1 }}>
                {activeSlide.layout}
              </h3>
              <SlideContent slide={activeSlide} />
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
                  <div
                    style={{
                      height: "100%",
                      borderRadius: 3,
                      width: `${activeSlide.confidence.score * 100}%`,
                      background: confidenceColor(activeSlide.confidence.score),
                    }}
                  />
                </div>
                {activeSlide.confidence.flags.map((f, i) => (
                  <div key={i} style={{ marginTop: 6, fontSize: 11, color: "#b45309", background: "#fef3c7", borderRadius: 3, padding: "3px 6px" }}>
                    {f.type}: {f.detail}
                  </div>
                ))}
              </div>

              {/* Resources */}
              {(() => {
                const topicId = activeSlide?.topic_id;
                const topicResources = topicId ? (resources[topicId] ?? []) : [];
                const selected = topicResources.filter((r) => r.is_selected).slice(0, 5);

                if (!topicId) return null;

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
                            <a
                              href={r.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ fontSize: 12, color: "#2563eb", textDecoration: "none", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                            >
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
              <div
                key={v.id}
                onClick={() => jumpToVersion(v.id)}
                style={{
                  padding: "10px 12px",
                  cursor: "pointer",
                  background: i === currentVersionIndex ? "#dbeafe" : "transparent",
                  borderBottom: "1px solid #eee",
                  fontSize: 12,
                }}
              >
                <span style={{ display: "inline-block", marginRight: 6, padding: "1px 6px", background: "#e5e7eb", borderRadius: 9999 }}>
                  {v.source}
                </span>
                <div style={{ marginTop: 2, color: "#666" }}>
                  {new Date(v.created_at).toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div style={{ borderTop: "1px solid #ddd", padding: "10px 16px", display: "flex", gap: 8, alignItems: "center", background: "#fafafa" }}>
        <input
          type="text"
          placeholder="Describe what to change…"
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          style={{ flex: 1, padding: "8px 12px", border: "1px solid #ccc", borderRadius: 6, fontSize: 14 }}
        />
        <button
          onClick={handlePatch}
          disabled={isGenerating || selectedSlideIds.length === 0 || !chatInput.trim()}
          style={{
            padding: "8px 16px",
            background: "#2563eb",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
            fontSize: 14,
            opacity: isGenerating || selectedSlideIds.length === 0 || !chatInput.trim() ? 0.5 : 1,
          }}
        >
          Apply patch
        </button>
        <button
          onClick={handleRegen}
          disabled={isGenerating}
          style={{
            padding: "8px 16px",
            background: "#7c3aed",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
            fontSize: 14,
            opacity: isGenerating ? 0.5 : 1,
          }}
        >
          Regenerate
        </button>
      </div>
    </div>
  );
}
