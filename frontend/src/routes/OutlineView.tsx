import { useEffect, useRef, useState } from "react";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

function confidenceColor(score: number): string {
  if (score >= 0.9) return "#16a34a";
  if (score >= 0.7) return "#ca8a04";
  if (score >= 0.5) return "#ea580c";
  return "#dc2626";
}

// ─── CompactResourceRow ──────────────────────────────────────────────────────

const SOURCE_ICONS: Record<string, string> = {
  video: "▶",
  paper: "📄",
  course: "🎓",
  article: "🔗",
};

function CompactResourceRow({
  resource,
  isLast,
}: {
  resource: TopicResource;
  isLast: boolean;
}) {
  const domain = (() => {
    try {
      return new URL(resource.url).hostname.replace("www.", "");
    } catch {
      return "";
    }
  })();

  const truncatedTitle =
    resource.title.length > 50 ? resource.title.slice(0, 50) + "…" : resource.title;

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-1.5",
        !isLast && "border-b border-border/50"
      )}
      style={{ minHeight: 40 }}
    >
      <span className="text-small flex-shrink-0 w-4 text-center">
        {SOURCE_ICONS[resource.source_type] ?? "🔗"}
      </span>
      <div className="flex-1 min-w-0">
        <a
          href={resource.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-small font-medium block truncate hover:underline"
          style={{ color: "#111827" }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.color = "#16a34a";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.color = "#111827";
          }}
        >
          {truncatedTitle}
        </a>
        <span className="text-micro block" style={{ color: "var(--muted-foreground)" }}>
          {domain}
        </span>
      </div>
      <span className="text-micro flex-shrink-0" style={{ color: "var(--muted-foreground)" }}>
        {Math.round(resource.relevance_score * 100)}%
      </span>
    </div>
  );
}

// ─── ResourcesSection ────────────────────────────────────────────────────────

interface ResourcesSectionProps {
  resources: TopicResource[];
  isLoading: boolean;
  onCollapse: () => void;
  onRetry: () => void;
}

function ResourcesSection({ resources, isLoading, onCollapse, onRetry }: ResourcesSectionProps) {
  const visible = resources.slice(0, 8);
  return (
    <div
      className="border border-border rounded-lg mt-2 overflow-hidden"
      style={{ maxHeight: 220, overflowY: "auto", background: "var(--muted)" }}
    >
      {/* Header */}
      <div
        className="flex justify-between items-center px-3 py-1.5 border-b border-border sticky top-0"
        style={{ background: "var(--muted)" }}
      >
        <span className="text-small font-semibold">
          Resources ({resources.length})
        </span>
        <span
          onClick={onCollapse}
          className="text-small cursor-pointer font-medium"
          style={{ color: "#16a34a" }}
        >
          ↑ Collapse
        </span>
      </div>

      {/* Loading: shimmer rows */}
      {isLoading && [0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            height: 32,
            margin: "4px 12px",
            borderRadius: 4,
            background: "linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%)",
            backgroundSize: "200% 100%",
            animation: "_shimmer 1.4s infinite",
          }}
        />
      ))}

      {/* Empty state */}
      {!isLoading && resources.length === 0 && (
        <div className="text-center py-5 px-3">
          <div className="text-small mb-1.5" style={{ color: "var(--muted-foreground)" }}>
            No resources found
          </div>
          <span
            onClick={onRetry}
            className="text-small cursor-pointer font-medium"
            style={{ color: "#16a34a" }}
          >
            Retry
          </span>
        </div>
      )}

      {/* Resource rows */}
      {!isLoading && visible.length > 0 && visible.map((r, idx) => (
        <CompactResourceRow key={r.id} resource={r} isLast={idx === visible.length - 1} />
      ))}
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
  onRetryFetch,
}: TopicCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: topic.id });

  const [isResourcesOpen, setIsResourcesOpen] = useState(false);
  const [hasFetchedResources, setHasFetchedResources] = useState(false);
  const [isNoteExpanded, setIsNoteExpanded] = useState(false);
  const [rationaleOverflows, setRationaleOverflows] = useState(false);
  const rationaleRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const el = rationaleRef.current;
    if (el) setRationaleOverflows(el.scrollHeight > el.clientHeight + 1);
  }, [topic.rationale]);

  function handleOpenResources() {
    setIsResourcesOpen(true);
    if (!hasFetchedResources && resources.length === 0 && !isLoadingResources) {
      onRetryFetch();
      setHasFetchedResources(true);
    }
  }

  const score = topic.confidence.score;
  const fillColor = confidenceColor(score);

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition: transition ?? "transform 150ms ease",
        opacity: isDragging ? 0.5 : 1,
      }}
      {...attributes}
    >
      <Card
        className={cn(
          "mb-2 transition-all cursor-default",
          isDragging ? "shadow-lg" : "hover:border-primary/40 hover:shadow-sm"
        )}
      >
        <CardContent className="px-5 py-4">
          {/* Row 1: drag handle + number + title */}
          <div className="flex items-start gap-3">
            <div
              {...listeners}
              className="text-xl leading-none flex-shrink-0 pt-0.5 select-none"
              style={{
                color: "var(--muted-foreground)",
                cursor: isDragging ? "grabbing" : "grab",
              }}
              title="Drag to reorder"
            >
              ⠿
            </div>
            <div className="flex-1 min-w-0">
              {/* Title row */}
              <div className="flex items-baseline gap-2">
                <span
                  className="text-micro font-bold flex-shrink-0"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <strong className="text-body font-semibold" style={{ color: "var(--foreground)" }}>
                  {topic.title}
                </strong>
              </div>

              {/* Row 2: rationale */}
              {topic.rationale && (
                <>
                  <p
                    ref={rationaleRef}
                    className="text-small mt-1"
                    style={{
                      color: "var(--muted-foreground)",
                      lineHeight: 1.4,
                      ...(isNoteExpanded
                        ? {}
                        : {
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical" as const,
                            overflow: "hidden",
                          }),
                    }}
                  >
                    {topic.rationale}
                  </p>
                  {rationaleOverflows && (
                    <span
                      onClick={() => setIsNoteExpanded((v) => !v)}
                      className="text-small font-medium cursor-pointer inline-block mt-0.5"
                      style={{ color: "#16a34a" }}
                    >
                      {isNoteExpanded ? "less" : "... more"}
                    </span>
                  )}
                </>
              )}

              {/* Row 3: badges */}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {/* Weight dots */}
                <span className="text-small" style={{ color: "#16a34a", letterSpacing: 1 }}>
                  {"●".repeat(topic.weight)}
                  <span style={{ color: "var(--border)" }}>{"●".repeat(5 - topic.weight)}</span>
                </span>

                <Badge variant="secondary" className="text-micro">
                  {topic.slide_count} slides
                </Badge>
                <Badge variant="secondary" className="text-micro">
                  {topic.estimated_minutes} min
                </Badge>
              </div>

              {/* Confidence bar */}
              <div
                className="mt-2 h-1 rounded-full"
                style={{ background: "var(--border)" }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${score * 100}%`,
                    background: fillColor,
                    transition: "width 300ms ease",
                  }}
                />
              </div>

              {/* Resources toggle / panel */}
              {isResourcesOpen ? (
                <ResourcesSection
                  resources={resources}
                  isLoading={isLoadingResources}
                  onCollapse={() => setIsResourcesOpen(false)}
                  onRetry={() => {
                    onRetryFetch();
                    setHasFetchedResources(true);
                  }}
                />
              ) : (
                <div
                  onClick={handleOpenResources}
                  className="text-small font-medium cursor-pointer mt-2"
                  style={{ color: "#16a34a" }}
                >
                  📎 View resources →
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
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
    <div className="relative">
      {toast && (
        <div
          className="fixed top-5 right-5 z-50 px-4 py-2.5 rounded-lg text-small font-medium text-white shadow-lg"
          style={{
            background: toast.type === "success" ? "#16a34a" : "#dc2626",
            transition: "opacity 150ms ease",
            pointerEvents: "none",
          }}
        >
          {toast.type === "success" ? "✓ " : "✕ "}{toast.msg}
        </div>
      )}

      <Card className="p-3">
        <div className="flex gap-2">
          <Input
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
            className="flex-1"
          />
          <Button
            onClick={handleSend}
            disabled={!canSend}
            className={cn(
              "whitespace-nowrap",
              canSend
                ? "bg-primary hover:bg-primary/90 text-primary-foreground"
                : "bg-secondary text-muted-foreground"
            )}
          >
            {isSubmitting && (
              <span
                style={{
                  width: 14,
                  height: 14,
                  border: "2px solid rgba(0,0,0,0.15)",
                  borderTopColor: "#6b7280",
                  borderRadius: "50%",
                  display: "inline-block",
                  animation: "_outline-spin 0.7s linear infinite",
                  flexShrink: 0,
                  marginRight: 6,
                }}
              />
            )}
            {isSubmitting ? "Refining…" : "Send"}
          </Button>
        </div>
      </Card>
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

  // ── Loading / empty states ──
  if (loading) {
    return (
      <div className="p-10 text-center text-small" style={{ color: "var(--muted-foreground)" }}>
        Loading outline…
      </div>
    );
  }

  if (!version) {
    return (
      <div className="p-10">
        <p className="text-small mb-4" style={{ color: "var(--muted-foreground)" }}>
          No outline found.
        </p>
        <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
          ← Go back
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--background)" }}>
      <style>{`
        @keyframes _outline-spin { to { transform: rotate(360deg); } }
        @keyframes _shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>

      {/* ── Header ── */}
      <div
        className="sticky top-0 bg-background border-b border-border z-10 flex items-center justify-between px-6"
        style={{ height: 56 }}
      >
        <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
          ← Back
        </Button>
        <div
          className="text-heading flex-1 mx-4 truncate text-center"
          style={{ color: "var(--foreground)" }}
        >
          {topic || "Presentation"}
        </div>
        <Badge
          variant="secondary"
          style={{
            background: overallColor + "18",
            color: overallColor,
            border: `1px solid ${overallColor}40`,
          }}
        >
          {overallPct}% confident
        </Badge>
      </div>

      {/* ── Gate banners ── */}
      {gateBlocked && (
        <Card className="border-l-4 border-l-destructive p-4 mb-4 mx-6 mt-4 bg-red-50/50 rounded-lg">
          <span className="text-small text-red-800">
            ⚠ Confidence is below 50%. Please refine the topic or add context in the chat before generating slides.
          </span>
        </Card>
      )}
      {gateWarning && (
        <Card className="border-l-4 border-l-yellow-500 p-4 mb-4 mx-6 mt-4 bg-yellow-50/50 rounded-lg">
          <span className="text-small text-yellow-800">
            Content confidence is moderate. You can proceed or refine further.
          </span>
        </Card>
      )}

      {/* ── Main content ── */}
      <div className="max-w-5xl mx-auto px-6 w-full flex-1 py-6 flex gap-6 box-border pb-24">

        {/* Left column: topic list */}
        <div style={{ flex: "0 0 60%", minWidth: 0 }}>
          <div className="text-subheading mb-3">Topics</div>

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
        <div style={{ flex: "0 0 40%", minWidth: 0 }} className="flex flex-col gap-4">

          {/* Stats card */}
          <Card>
            <CardContent className="p-4">
              <div className="text-body font-semibold mb-3" style={{ color: "var(--foreground)" }}>
                Total: {totalSlides} slides · {totalMinutes} minutes
              </div>
              <div className="flex flex-col gap-2.5">
                {topics.map((t) => (
                  <div key={t.id}>
                    <div className="flex justify-between mb-1">
                      <span
                        className="text-small truncate"
                        style={{ color: "var(--foreground)", maxWidth: "80%" }}
                      >
                        {t.title}
                      </span>
                      <span
                        className="text-small flex-shrink-0 ml-2"
                        style={{ color: "var(--muted-foreground)" }}
                      >
                        {t.estimated_minutes}m
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full" style={{ background: "var(--border)" }}>
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(t.estimated_minutes / maxMinutes) * 100}%`,
                          background: "#16a34a",
                          transition: "width 300ms ease",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Chat bar */}
          <div>
            <p className="text-subheading mb-2">Refine outline</p>
            <OutlineChatBar
              presentationId={presentationId || routeId || ""}
              onNewVersion={handleNewVersion}
            />
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <div
        className="sticky bottom-0 bg-background border-t border-border px-6 flex items-center justify-between z-10"
        style={{ height: 60 }}
      >
        <span className="text-small" style={{ color: "var(--muted-foreground)" }}>
          Generated with confidence: {overallPct}%
        </span>
        <Button
          size="lg"
          onClick={handleApprove}
          disabled={gateBlocked}
          className={cn(
            "h-12 font-semibold",
            gateBlocked
              ? "bg-secondary text-muted-foreground cursor-not-allowed"
              : gateWarning
              ? "bg-orange-500 hover:bg-orange-600 text-white"
              : "bg-primary hover:bg-primary/90 text-primary-foreground"
          )}
        >
          {approveLabel}
        </Button>
      </div>
    </div>
  );
}
