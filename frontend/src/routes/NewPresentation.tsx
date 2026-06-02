import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../store";
import { PresentationConfig } from "../types";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const DEFAULT_CONFIG: PresentationConfig = {
  audience: "",
  tone: "formal",
  depth: 3,
  length: 20,
  compactness: 3,
  scope: "",
  style: "minimal",
  resource_filters: { videos: true, articles: true, papers: true, courses: true },
  resource_priority: ["video", "paper", "course", "article"],
};

const API = "http://localhost:8000";

function PriorityPill({ id, label }: { id: string; label: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        padding: "4px 12px",
        background: isDragging ? "#dbeafe" : "#f3f4f6",
        border: "1px solid #e5e7eb",
        borderRadius: 20,
        fontSize: 13,
        cursor: "grab",
        userSelect: "none",
        opacity: isDragging ? 0.6 : 1,
      }}
    >
      {label}
    </div>
  );
}

export default function NewPresentation() {
  const [topic, setTopic] = useState("");
  const [config, setConfig] = useState<PresentationConfig>(DEFAULT_CONFIG);
  const { isConfigOpen, toggleConfig, isGenerating, setGenerating, pushVersion, setPresentation } =
    useStore();
  const navigate = useNavigate();
  const abortRef = useRef<AbortController | null>(null);

  const updateConfig = <K extends keyof PresentationConfig>(key: K, value: PresentationConfig[K]) =>
    setConfig((c) => ({ ...c, [key]: value }));

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handlePriorityDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldOrder = config.resource_priority;
      const oldIdx = oldOrder.indexOf(active.id as string);
      const newIdx = oldOrder.indexOf(over.id as string);
      updateConfig("resource_priority", arrayMove(oldOrder, oldIdx, newIdx));
    }
  }

  const handleCancel = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setGenerating(false);
  };

  const handleGenerate = async () => {
    if (!topic.trim()) return;

    if (isGenerating) {
      handleCancel();
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setGenerating(true);

    try {
      const body = {
        topic,
        config: isConfigOpen ? config : null,
      };
      const res = await fetch(`${API}/presentations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const version = await res.json();
      pushVersion(version);
      setPresentation(version.presentation_id, topic, isConfigOpen ? config : null);
      navigate(`/outline/${version.presentation_id}`);
    } catch (err) {
      if ((err as Error).name !== "AbortError") throw err;
      // AbortError means user cancelled — stay on page, do nothing
    } finally {
      abortRef.current = null;
      setGenerating(false);
    }
  };

  return (
    <div style={{ maxWidth: 640, margin: "80px auto", padding: "0 16px" }}>
      <h1 style={{ marginBottom: 24 }}>New Presentation</h1>

      <input
        type="text"
        placeholder="What is your presentation about?"
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
        style={{ width: "100%", fontSize: 18, padding: "12px 16px", boxSizing: "border-box", borderRadius: 6, border: "1px solid #ccc" }}
      />

      <div style={{ marginTop: 16 }}>
        <button onClick={toggleConfig} style={{ background: "none", border: "none", cursor: "pointer", color: "#555", fontSize: 14 }}>
          {isConfigOpen ? "▾ Hide advanced options" : "▸ Advanced options"}
        </button>
      </div>

      {isConfigOpen && (
        <div style={{ marginTop: 16, padding: 16, border: "1px solid #ddd", borderRadius: 6, display: "grid", gap: 12 }}>
          <label>
            Audience
            <input
              type="text"
              value={config.audience}
              onChange={(e) => updateConfig("audience", e.target.value)}
              style={{ display: "block", width: "100%", marginTop: 4, padding: "6px 8px", boxSizing: "border-box" }}
            />
          </label>

          <label>
            Tone
            <select
              value={config.tone}
              onChange={(e) => updateConfig("tone", e.target.value as PresentationConfig["tone"])}
              style={{ display: "block", marginTop: 4, padding: "6px 8px" }}
            >
              <option value="formal">Formal</option>
              <option value="casual">Casual</option>
              <option value="technical">Technical</option>
            </select>
          </label>

          <label>
            Depth: {config.depth}
            <input
              type="range"
              min={1}
              max={5}
              value={config.depth}
              onChange={(e) => updateConfig("depth", Number(e.target.value))}
              style={{ display: "block", width: "100%", marginTop: 4 }}
            />
          </label>

          <label>
            Length: {config.length} min
            <input
              type="range"
              min={5}
              max={60}
              step={5}
              value={config.length}
              onChange={(e) => updateConfig("length", Number(e.target.value))}
              style={{ display: "block", width: "100%", marginTop: 4 }}
            />
          </label>

          <label>
            Compactness: {config.compactness}
            <input
              type="range"
              min={1}
              max={5}
              value={config.compactness}
              onChange={(e) => updateConfig("compactness", Number(e.target.value))}
              style={{ display: "block", width: "100%", marginTop: 4 }}
            />
          </label>

          <label>
            Scope
            <input
              type="text"
              value={config.scope}
              onChange={(e) => updateConfig("scope", e.target.value)}
              style={{ display: "block", width: "100%", marginTop: 4, padding: "6px 8px", boxSizing: "border-box" }}
            />
          </label>

          <label>
            Style
            <select
              value={config.style}
              onChange={(e) => updateConfig("style", e.target.value as PresentationConfig["style"])}
              style={{ display: "block", marginTop: 4, padding: "6px 8px" }}
            >
              <option value="minimal">Minimal</option>
              <option value="detailed">Detailed</option>
              <option value="visual">Visual</option>
            </select>
          </label>

          <div>
            <label style={{ display: "block", marginBottom: 8, fontWeight: 500 }}>
              Resources to include
            </label>
            {[
              { key: "videos", label: "Videos" },
              { key: "papers", label: "Academic papers" },
              { key: "courses", label: "Online courses" },
              { key: "articles", label: "Articles & websites" },
            ].map(({ key, label }) => (
              <label key={key} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, fontSize: 14, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={config.resource_filters[key as keyof typeof config.resource_filters]}
                  onChange={(e) =>
                    updateConfig("resource_filters", {
                      ...config.resource_filters,
                      [key]: e.target.checked,
                    })
                  }
                  style={{ accentColor: "#16a34a", width: 15, height: 15 }}
                />
                {label}
              </label>
            ))}
          </div>

          <div>
            <label style={{ display: "block", marginBottom: 8, fontWeight: 500, fontSize: 14 }}>
              Prioritize by
            </label>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handlePriorityDragEnd}>
              <SortableContext items={config.resource_priority} strategy={horizontalListSortingStrategy}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {config.resource_priority.map((type) => {
                    const labels: Record<string, string> = {
                      video: "Videos",
                      paper: "Papers",
                      course: "Courses",
                      article: "Articles",
                    };
                    return <PriorityPill key={type} id={type} label={labels[type] ?? type} />;
                  })}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <button
        onClick={handleGenerate}
        disabled={!topic.trim()}
        style={{
          marginTop: 24,
          padding: "12px 32px",
          fontSize: 16,
          background: isGenerating ? "#dc2626" : "#2563eb",
          color: "#fff",
          border: "none",
          borderRadius: 6,
          cursor: topic.trim() ? "pointer" : "not-allowed",
          opacity: !topic.trim() ? 0.5 : 1,
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          transition: "background 200ms ease",
        }}
      >
        {isGenerating && (
          <span style={{
            width: 16,
            height: 16,
            border: "2px solid rgba(255,255,255,0.35)",
            borderTopColor: "#fff",
            borderRadius: "50%",
            display: "inline-block",
            animation: "spin 0.7s linear infinite",
            flexShrink: 0,
          }} />
        )}
        {isGenerating ? "Cancel" : "Generate"}
      </button>

      {isGenerating && (
        <p style={{ marginTop: 12, fontSize: 13, color: "#888" }}>
          Building your outline and slides — usually takes 15–30 seconds.
        </p>
      )}
    </div>
  );
}
