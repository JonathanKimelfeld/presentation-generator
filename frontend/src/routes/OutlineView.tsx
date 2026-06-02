import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useStore, currentVersion } from "../store";
import { OutlineTopic, TopicResource, Version } from "../types";

function confidenceColor(score: number): string {
  if (score >= 0.9) return "#16a34a";
  if (score >= 0.7) return "#ca8a04";
  if (score >= 0.5) return "#ea580c";
  return "#dc2626";
}

// ─── SortableResourceRow ─────────────────────────────────────────────────────

const SOURCE_ICONS: Record<string, string> = {
  video: "▶",
  paper: "📄",
  course: "🎓",
  article: "🔗",
};

function SortableResourceRow({
  resource,
  onToggle,
  onDelete,
}: {
  resource: TopicResource;
  onToggle: (r: TopicResource) => void;
  onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: resource.id });

  const domain = (() => {
    try {
      return new URL(resource.url).hostname.replace("www.", "");
    } catch {
      return "";
    }
  })();

  const truncatedTitle =
    resource.title.length > 60 ? resource.title.slice(0, 60) + "…" : resource.title;

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : resource.is_selected ? 1 : 0.45,
        display: "flex",
        gap: 8,
        alignItems: "flex-start",
        padding: "8px 0",
        borderBottom: "1px solid #f3f4f6",
      }}
      {...attributes}
    >
      {/* Drag handle */}
      <div
        {...listeners}
        style={{ cursor: "grab", color: "#d1d5db", fontSize: 14, paddingTop: 2, flexShrink: 0 }}
      >
        ⠇
      </div>

      {/* Icon */}
      <span style={{ fontSize: 14, flexShrink: 0, paddingTop: 1 }}>
        {SOURCE_ICONS[resource.source_type] ?? "🔗"}
      </span>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <a
          href={resource.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: "#111827",
            fontWeight: 500,
            fontSize: 13,
            textDecoration: "none",
            display: "block",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          onMouseEnter={(e) => {
            (e.target as HTMLElement).style.textDecoration = "underline";
            (e.target as HTMLElement).style.color = "#16a34a";
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLElement).style.textDecoration = "none";
            (e.target as HTMLElement).style.color = "#111827";
          }}
        >
          {truncatedTitle}
        </a>
        {resource.description && (
          <p style={{
            margin: "2px 0 0",
            fontSize: 11,
            color: "#9ca3af",
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
          }}>
            {resource.description}
          </p>
        )}
        <span style={{ fontSize: 11, color: "#16a34a", marginTop: 2, display: "block" }}>
          {domain}
        </span>
      </div>

      {/* Right controls */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
        <span style={{ fontSize: 11, color: "#9ca3af", fontVariantNumeric: "tabular-nums" }}>
          {Math.round(resource.relevance_score * 100)}%
        </span>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={resource.is_selected}
            onChange={() => onToggle(resource)}
            style={{ accentColor: "#16a34a", width: 13, height: 13, cursor: "pointer" }}
          />
          <button
            onClick={() => onDelete(resource.id)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#d1d5db",
              fontSize: 14,
              padding: 0,
              lineHeight: 1,
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#dc2626"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#d1d5db"; }}
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ResourcesSection ────────────────────────────────────────────────────────

interface ResourcesSectionProps {
  topicId: string;
  resources: TopicResource[];
  isLoading: boolean;
  onRetryFetch: () => void;
  presentationId: string;
  versionId: string;
  resourcesInitialized: boolean;
}

function ResourcesSection({
  resources,
  isLoading,
  onRetryFetch,
  presentationId,
  resourcesInitialized,
}: ResourcesSectionProps) {
  const updateResourceStore = useStore((s) => s.updateResource);
  const removeResourceStore = useStore((s) => s.removeResource);
  const [localResources, setLocalResources] = useState<TopicResource[]>(resources);

  useEffect(() => {
    setLocalResources([...resources].sort((a, b) => a.priority - b.priority));
  }, [resources]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  async function handleToggle(resource: TopicResource) {
    const updated = { ...resource, is_selected: !resource.is_selected };
    updateResourceStore(updated);
    await fetch(
      `http://localhost:8000/presentations/${presentationId}/resources/${resource.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_selected: updated.is_selected }),
      },
    );
  }

  async function handleDelete(resourceId: string) {
    removeResourceStore(resourceId);
    setLocalResources((prev) => prev.filter((r) => r.id !== resourceId));
    await fetch(
      `http://localhost:8000/presentations/${presentationId}/resources/${resourceId}`,
      { method: "DELETE" },
    );
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = localResources.findIndex((r) => r.id === active.id);
    const newIdx = localResources.findIndex((r) => r.id === over.id);
    const reordered = arrayMove(localResources, oldIdx, newIdx);
    setLocalResources(reordered);
    // PATCH priorities
    await Promise.all(
      reordered.map((r, i) =>
        fetch(`http://localhost:8000/presentations/${presentationId}/resources/${r.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ priority: i }),
        }),
      ),
    );
  }

  if (isLoading) {
    return (
      <div style={{ marginTop: 12 }}>
        <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 6 }}>Fetching resources…</div>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              height: 40,
              borderRadius: 4,
              marginBottom: 6,
              background: "linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%)",
              backgroundSize: "200% 100%",
              animation: "_shimmer 1.4s infinite",
            }}
          />
        ))}
      </div>
    );
  }

  if (resourcesInitialized && localResources.length === 0) {
    return (
      <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 12, color: "#9ca3af" }}>No resources found.</span>
        <button
          onClick={onRetryFetch}
          style={{
            fontSize: 11,
            background: "none",
            border: "1px solid #d1d5db",
            borderRadius: 4,
            padding: "2px 8px",
            cursor: "pointer",
            color: "#6b7280",
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 12 }}>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={localResources.map((r) => r.id)} strategy={verticalListSortingStrategy}>
          {localResources.map((resource) => (
            <SortableResourceRow
              key={resource.id}
              resource={resource}
              onToggle={handleToggle}
              onDelete={handleDelete}
            />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
}

// ─── TopicCard ──────────────────────────────────────────────────────────────

interface TopicCardProps {
  topic: OutlineTopic;
  index: number;
  resources: TopicResource[];
  isLoadingResources: boolean;
  resourcesInitialized: boolean;
  onRetryFetch: () => void;
  presentationId: string;
  versionId: string;
}

function TopicCard({
  topic,
  index,
  resources,
  isLoadingResources,
  resourcesInitialized,
  onRetryFetch,
  presentationId,
  versionId,
}: TopicCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: topic.id });

  const cardStyle: React.CSSProperties = {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
    display: "flex",
    gap: 12,
    position: "relative",
    transform: CSS.Transform.toString(transform),
    transition: transition ?? "transform 150ms ease",
    opacity: isDragging ? 0.5 : 1,
    boxShadow: isDragging ? "0 4px 16px rgba(0,0,0,0.12)" : "none",
  };

  return (
    <div ref={setNodeRef} style={cardStyle} {...attributes}>
      {/* Drag handle */}
      <div
        {...listeners}
        style={{
          cursor: isDragging ? "grabbing" : "grab",
          color: "#9ca3af",
          fontSize: 20,
          userSelect: "none",
          flexShrink: 0,
          paddingTop: 1,
          lineHeight: 1,
          transition: "color 150ms ease",
        }}
        title="Drag to reorder"
      >
        {"⠇"}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Top row: number + title + badges */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ color: "#9ca3af", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                {String(index + 1).padStart(2, "0")}
              </span>
              <strong style={{ fontSize: 15, color: "#111827", lineHeight: 1.4 }}>
                {topic.title}
              </strong>
            </div>
            {topic.rationale && (
              <p style={{
                margin: "4px 0 0",
                fontSize: 13,
                color: "#6b7280",
                lineHeight: 1.4,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}>
                {topic.rationale}
              </p>
            )}
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
            {/* Weight dots — driven by topic.weight (1–5 importance), not slide_count */}
            <span style={{ fontSize: 13, letterSpacing: 1, color: "#374151" }}>
              {"●".repeat(topic.weight)}{"○".repeat(5 - topic.weight)}
            </span>
            {/* Slide badge */}
            <span style={{
              background: "#f3f4f6",
              border: "1px solid #e5e7eb",
              borderRadius: 4,
              padding: "2px 8px",
              fontSize: 12,
              color: "#374151",
              whiteSpace: "nowrap",
            }}>
              {topic.slide_count} slides
            </span>
            {/* Time badge */}
            <span style={{
              background: "#f3f4f6",
              border: "1px solid #e5e7eb",
              borderRadius: 4,
              padding: "2px 8px",
              fontSize: 12,
              color: "#374151",
              whiteSpace: "nowrap",
            }}>
              {topic.estimated_minutes} min
            </span>
          </div>
        </div>

        {/* Resources section */}
        <ResourcesSection
          topicId={topic.id}
          resources={resources}
          isLoading={isLoadingResources}
          onRetryFetch={onRetryFetch}
          presentationId={presentationId}
          versionId={versionId}
          resourcesInitialized={resourcesInitialized}
        />
      </div>
    </div>
  );
}

// ─── OutlineChatBar ──────────────────────────────────────────────────────────

interface OutlineChatBarProps {
  presentationId: string;
  onNewVersion: (v: Version) => void;
}

function OutlineChatBar({ presentationId, onNewVersion }: OutlineChatBarProps) {
  const [input, setInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const pushVersion = useStore((s) => s.pushVersion);

  function showToast(msg: string, type: "success" | "error") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  async function handleSend() {
    if (!input.trim() || isSubmitting) return;
    setIsSubmitting(true);

    try {
      const res = await fetch(
        `http://localhost:8000/presentations/${presentationId}/refine-outline`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: input }),
        },
      );

      if (!res.ok) {
        showToast("Couldn't refine outline. Try again.", "error");
        return;
      }

      const newVersion: Version = await res.json();
      pushVersion(newVersion);
      onNewVersion(newVersion);
      setInput("");
      showToast("Outline updated", "success");
    } catch {
      showToast("Couldn't refine outline. Try again.", "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  const canSend = !isSubmitting && input.trim().length > 0;

  return (
    <div style={{ position: "relative" }}>
      {toast && (
        <div style={{
          position: "fixed",
          top: 20,
          right: 20,
          zIndex: 1000,
          padding: "10px 18px",
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 500,
          color: "#ffffff",
          background: toast.type === "success" ? "#16a34a" : "#dc2626",
          boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
          transition: "opacity 150ms ease",
          pointerEvents: "none",
        }}>
          {toast.type === "success" ? "✓ " : "✕ "}{toast.msg}
        </div>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder={isSubmitting ? "Refining outline…" : "Ask to adjust topics, depth, or structure…"}
          disabled={isSubmitting}
          style={{
            flex: 1,
            padding: "10px 14px",
            fontSize: 14,
            border: "1px solid #e5e7eb",
            borderRadius: 6,
            outline: "none",
            background: isSubmitting ? "#f9fafb" : "#ffffff",
            color: "#111827",
            transition: "background 150ms ease",
          }}
        />
        <button
          onClick={handleSend}
          disabled={!canSend}
          style={{
            padding: "10px 18px",
            fontSize: 14,
            background: canSend ? "#2563eb" : "#e5e7eb",
            color: canSend ? "#ffffff" : "#9ca3af",
            border: "none",
            borderRadius: 6,
            cursor: canSend ? "pointer" : "not-allowed",
            transition: "background 150ms ease, color 150ms ease",
            whiteSpace: "nowrap",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          {isSubmitting && (
            <span style={{
              width: 14,
              height: 14,
              border: "2px solid rgba(0,0,0,0.15)",
              borderTopColor: "#6b7280",
              borderRadius: "50%",
              display: "inline-block",
              animation: "_outline-spin 0.7s linear infinite",
              flexShrink: 0,
            }} />
          )}
          {isSubmitting ? "Refining…" : "Send"}
        </button>
      </div>
    </div>
  );
}

// ─── OutlineView (main) ──────────────────────────────────────────────────────

export default function OutlineView() {
  const navigate = useNavigate();
  const { id: routeId } = useParams<{ id: string }>();

  const version = useStore(currentVersion);
  const presentationId = useStore((s) => s.presentationId);
  const topic = useStore((s) => s.topic);
  const setVersions = useStore((s) => s.setVersions);
  const setGenerating = useStore((s) => s.setGenerating);
  const resources = useStore((s) => s.resources);
  const setResources = useStore((s) => s.setResources);

  const [topics, setTopics] = useState<OutlineTopic[]>([]);
  const [loading, setLoading] = useState(false);
  const [resourcesInitialized, setResourcesInitialized] = useState(false);
  const [fetchingTopics, setFetchingTopics] = useState<Record<string, boolean>>({});

  // Sync local topics when version changes (initial load or after chat patch)
  const versionId = version?.id;
  useEffect(() => {
    if (version) {
      setTopics(version.outline.topics);
    }
  }, [versionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch versions from API when store is empty (e.g., hard refresh)
  useEffect(() => {
    if (!version && routeId) {
      setLoading(true);
      fetch(`http://localhost:8000/presentations/${routeId}/versions`)
        .then((r) => r.json())
        .then(async (summaries: { id: string }[]) => {
          if (summaries.length === 0) return;
          const last = summaries[summaries.length - 1];
          const res = await fetch(
            `http://localhost:8000/presentations/${routeId}/versions/${last.id}`,
          );
          const fullVersion: Version = await res.json();
          setVersions([fullVersion]);
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [routeId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch resources when version is available
  useEffect(() => {
    if (!version || !routeId) return;
    setResourcesInitialized(false);
    fetch(`http://localhost:8000/presentations/${routeId}/resources?version_id=${version.id}`)
      .then((r) => r.json())
      .then((grouped: Record<string, TopicResource[]>) => {
        setResources(grouped);
        setResourcesInitialized(true);
      })
      .catch(() => setResourcesInitialized(true));
  }, [version?.id, routeId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── DnD ──
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setTopics((prev) => {
        const oldIdx = prev.findIndex((t) => t.id === active.id);
        const newIdx = prev.findIndex((t) => t.id === over.id);
        return arrayMove(prev, oldIdx, newIdx);
      });
    }
  }

  async function fetchResourcesForTopic(topicId: string) {
    if (!version || !routeId) return;
    setFetchingTopics((prev) => ({ ...prev, [topicId]: true }));
    try {
      const res = await fetch(
        `http://localhost:8000/presentations/${presentationId || routeId}/resources/fetch`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ version_id: version.id, topic_id: topicId }),
        },
      );
      const grouped: Record<string, TopicResource[]> = await res.json();
      setResources({ ...resources, ...grouped });
    } catch {
      // leave empty — ResourcesSection shows retry
    } finally {
      setFetchingTopics((prev) => ({ ...prev, [topicId]: false }));
    }
  }

  // ── Gate logic ──
  const aggregateConfidence =
    topics.length > 0
      ? topics.reduce((sum, t) => sum + t.confidence.score, 0) / topics.length
      : 1;

  const gateBlocked = aggregateConfidence < 0.5;
  const gateWarning = aggregateConfidence >= 0.5 && aggregateConfidence < 0.7;
  const overallPct = Math.round(aggregateConfidence * 100);
  const overallColor = confidenceColor(aggregateConfidence);

  // ── Stats ──
  const totalSlides = topics.reduce((s, t) => s + t.slide_count, 0);
  const totalMinutes = topics.reduce((s, t) => s + t.estimated_minutes, 0);
  const maxMinutes = Math.max(...topics.map((t) => t.estimated_minutes), 1);

  // ── Handlers ──
  function handleApprove() {
    if (gateBlocked) return;
    setGenerating(true);
    navigate(`/editor/${presentationId || routeId}`);
    setGenerating(false);
  }

  function handleNewVersion(v: Version) {
    setTopics(v.outline.topics);
  }

  // ── Approve button ──
  const approveLabel = gateBlocked
    ? "Confidence too low — add more context"
    : gateWarning
    ? "Generate slides (low confidence)"
    : "Generate slides →";

  const approveBg = gateBlocked ? "#e5e7eb" : gateWarning ? "#ea580c" : "#16a34a";
  const approveColor = gateBlocked ? "#9ca3af" : "#ffffff";

  // ── Loading / empty states ──
  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#6b7280", fontSize: 14 }}>
        Loading outline…
      </div>
    );
  }

  if (!version) {
    return (
      <div style={{ padding: 40 }}>
        <p style={{ color: "#6b7280", marginBottom: 16 }}>No outline found.</p>
        <button
          onClick={() => navigate("/")}
          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "#2563eb" }}
        >
          ← Go back
        </button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", display: "flex", flexDirection: "column" }}>
      <style>{`
        @keyframes _outline-spin { to { transform: rotate(360deg); } }
        @keyframes _shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>

      {/* ── Header ── */}
      <div style={{
        position: "sticky",
        top: 0,
        background: "#ffffff",
        borderBottom: "1px solid #e5e7eb",
        zIndex: 10,
        padding: "12px 24px",
        display: "flex",
        alignItems: "center",
        gap: 16,
      }}>
        <button
          onClick={() => navigate("/")}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: 14,
            color: "#6b7280",
            padding: "4px 0",
            flexShrink: 0,
            transition: "color 150ms ease",
          }}
        >
          ← Back
        </button>
        <div style={{
          flex: 1,
          fontWeight: 600,
          fontSize: 16,
          color: "#111827",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}>
          {topic || "Presentation"}
        </div>
        {/* Confidence badge */}
        <div style={{
          background: overallColor + "18",
          color: overallColor,
          border: `1px solid ${overallColor}40`,
          borderRadius: 20,
          padding: "4px 14px",
          fontSize: 13,
          fontWeight: 600,
          flexShrink: 0,
        }}>
          {overallPct}% confident
        </div>
      </div>

      {/* ── Gate banners ── */}
      {gateBlocked && (
        <div style={{
          background: "#fef2f2",
          borderBottom: "1px solid #fecaca",
          borderLeft: "4px solid #dc2626",
          padding: "12px 24px",
          color: "#991b1b",
          fontSize: 13,
        }}>
          ⚠ Confidence is below 50%. Please refine the topic or add context in the chat before generating slides.
        </div>
      )}
      {gateWarning && (
        <div style={{
          background: "#fff7ed",
          borderBottom: "1px solid #fed7aa",
          borderLeft: "4px solid #ea580c",
          padding: "12px 24px",
          color: "#9a3412",
          fontSize: 13,
        }}>
          Content confidence is moderate. You can proceed or refine further.
        </div>
      )}

      {/* ── Main content ── */}
      <div style={{
        flex: 1,
        maxWidth: 900,
        margin: "0 auto",
        width: "100%",
        padding: "24px 24px 100px",
        display: "flex",
        gap: 24,
        boxSizing: "border-box",
      }}>

        {/* Left column: topic list */}
        <div style={{ flex: "0 0 60%", minWidth: 0 }}>
          <h2 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 700, color: "#111827" }}>
            {topic || "Presentation Outline"}
          </h2>
          <p style={{ margin: "0 0 20px", fontSize: 13, color: "#6b7280" }}>
            Drag to reorder topics. Each topic's slide count reflects its importance.
          </p>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={topics.map((t) => t.id)}
              strategy={verticalListSortingStrategy}
            >
              {topics.map((t, i) => (
                <TopicCard
                  key={t.id}
                  topic={t}
                  index={i}
                  resources={resources[t.id] ?? []}
                  isLoadingResources={!resourcesInitialized || !!fetchingTopics[t.id]}
                  resourcesInitialized={resourcesInitialized}
                  onRetryFetch={() => fetchResourcesForTopic(t.id)}
                  presentationId={presentationId || routeId || ""}
                  versionId={version?.id ?? ""}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>

        {/* Right column: stats + chat */}
        <div style={{ flex: "0 0 40%", display: "flex", flexDirection: "column", gap: 0, minWidth: 0 }}>

          {/* Stats card */}
          <div style={{
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            padding: 16,
            marginBottom: 16,
          }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#111827", marginBottom: 14 }}>
              Total: {totalSlides} slides · {totalMinutes} minutes
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {topics.map((t) => (
                <div key={t.id}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{
                      fontSize: 12,
                      color: "#374151",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      maxWidth: "80%",
                    }}>
                      {t.title}
                    </span>
                    <span style={{ fontSize: 12, color: "#6b7280", flexShrink: 0, marginLeft: 8 }}>
                      {t.estimated_minutes}m
                    </span>
                  </div>
                  <div style={{ height: 6, background: "#e5e7eb", borderRadius: 3 }}>
                    <div style={{
                      height: "100%",
                      borderRadius: 3,
                      width: `${(t.estimated_minutes / maxMinutes) * 100}%`,
                      background: "#2563eb",
                      transition: "width 300ms ease",
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Chat bar */}
          <div style={{
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            padding: 16,
          }}>
            <p style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 600, color: "#374151" }}>
              Refine outline
            </p>
            <OutlineChatBar
              presentationId={presentationId || routeId || ""}
              onNewVersion={handleNewVersion}
            />
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <div style={{
        position: "sticky",
        bottom: 0,
        background: "#ffffff",
        borderTop: "1px solid #e5e7eb",
        padding: "12px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        zIndex: 10,
      }}>
        <span style={{ fontSize: 14, color: "#6b7280" }}>
          Generated with confidence: {overallPct}%
        </span>
        <button
          onClick={handleApprove}
          disabled={gateBlocked}
          style={{
            padding: "10px 24px",
            fontSize: 15,
            fontWeight: 600,
            border: "none",
            borderRadius: 6,
            cursor: gateBlocked ? "not-allowed" : "pointer",
            background: approveBg,
            color: approveColor,
            transition: "background 150ms ease",
          }}
        >
          {approveLabel}
        </button>
      </div>
    </div>
  );
}
