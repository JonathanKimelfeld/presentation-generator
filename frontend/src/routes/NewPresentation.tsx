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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const DEFAULT_CONFIG: PresentationConfig = {
  audience: "",
  tone: "formal",
  depth: 3,
  length: 20,
  compactness: 3,
  scope: "",
  style: "minimal",
  content_mode: "verbose" as const,
  include_visuals: true,
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
      }}
      className={cn(
        "px-3 py-1 rounded-full text-small border border-border bg-secondary cursor-grab select-none",
        isDragging && "bg-primary/10 border-primary opacity-60"
      )}
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
    <div className="max-w-[560px] mx-auto px-6" style={{ paddingTop: 80, paddingBottom: 80 }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* Header */}
      <div className="text-subheading mb-3">AI Presentation Generator</div>
      <h1 className="text-display">What do you want to learn about?</h1>
      <p className="text-small mt-2" style={{ color: "var(--muted-foreground)" }}>
        Enter a topic and we'll build a full presentation.
      </p>

      {/* Topic input */}
      <Input
        type="text"
        placeholder="e.g. The Central Limit Theorem, Chess openings..."
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
        className="h-13 text-base mt-8"
      />

      {/* Generate button */}
      <Button
        size="lg"
        onClick={handleGenerate}
        disabled={!topic.trim()}
        className={cn(
          "w-full mt-4 h-13 text-base font-semibold",
          isGenerating
            ? "bg-red-600 hover:bg-red-700 text-white"
            : "bg-primary hover:bg-primary/90 text-primary-foreground"
        )}
      >
        {isGenerating && (
          <span
            style={{
              width: 16,
              height: 16,
              border: "2px solid rgba(255,255,255,0.35)",
              borderTopColor: "#fff",
              borderRadius: "50%",
              display: "inline-block",
              animation: "spin 0.7s linear infinite",
              flexShrink: 0,
              marginRight: 8,
            }}
          />
        )}
        {isGenerating ? "Generating…" : "Generate Presentation"}
      </Button>

      {isGenerating && (
        <p className="text-small mt-3" style={{ color: "var(--muted-foreground)" }}>
          Building your presentation — this may take a minute
        </p>
      )}

      {/* Advanced toggle */}
      <button
        onClick={toggleConfig}
        className="text-small mt-4 cursor-pointer bg-transparent border-0 p-0"
        style={{ color: "var(--muted-foreground)" }}
      >
        ⚙ {isConfigOpen ? "Hide options" : "Advanced options"}
      </button>

      {/* Config panel */}
      {isConfigOpen && (
        <Card className="mt-4 border border-border">
          <CardContent className="p-6 grid gap-5">

            {/* Audience */}
            <div>
              <label className="text-small font-medium">Audience</label>
              <Input
                value={config.audience}
                onChange={(e) => updateConfig("audience", e.target.value)}
                className="mt-1.5"
              />
            </div>

            <Separator className="my-1" />

            {/* Tone */}
            <div>
              <label className="text-small font-medium">Tone</label>
              <Select
                value={config.tone}
                onValueChange={(v) => updateConfig("tone", v as PresentationConfig["tone"])}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="formal">Formal</SelectItem>
                  <SelectItem value="casual">Casual</SelectItem>
                  <SelectItem value="technical">Technical</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator className="my-1" />

            {/* Depth slider */}
            <div>
              <div className="flex justify-between text-small">
                <label>Depth</label>
                <span style={{ color: "var(--muted-foreground)" }}>{config.depth}/5</span>
              </div>
              <Slider
                min={1}
                max={5}
                step={1}
                value={[config.depth]}
                onValueChange={(v) => { const arr = v as number[]; updateConfig("depth", arr[0]); }}
                className="mt-2"
              />
            </div>

            {/* Length slider */}
            <div>
              <div className="flex justify-between text-small">
                <label>Length</label>
                <span style={{ color: "var(--muted-foreground)" }}>{config.length} min</span>
              </div>
              <Slider
                min={5}
                max={60}
                step={5}
                value={[config.length]}
                onValueChange={(v) => { const arr = v as number[]; updateConfig("length", arr[0]); }}
                className="mt-2"
              />
            </div>

            {/* Compactness slider */}
            <div>
              <div className="flex justify-between text-small">
                <label>Compactness</label>
                <span style={{ color: "var(--muted-foreground)" }}>{config.compactness}/5</span>
              </div>
              <Slider
                min={1}
                max={5}
                step={1}
                value={[config.compactness]}
                onValueChange={(v) => { const arr = v as number[]; updateConfig("compactness", arr[0]); }}
                className="mt-2"
              />
            </div>

            <Separator className="my-1" />

            {/* Scope */}
            <div>
              <label className="text-small font-medium">Scope</label>
              <Input
                value={config.scope}
                onChange={(e) => updateConfig("scope", e.target.value)}
                className="mt-1.5"
              />
            </div>

            {/* Style */}
            <div>
              <label className="text-small font-medium">Style</label>
              <Select
                value={config.style}
                onValueChange={(v) => updateConfig("style", v as PresentationConfig["style"])}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="minimal">Minimal</SelectItem>
                  <SelectItem value="detailed">Detailed</SelectItem>
                  <SelectItem value="visual">Visual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator className="my-1" />

            {/* Content mode */}
            <div>
              <label className="text-small font-medium block mb-2">Slide content style</label>
              <div className="flex gap-3">
                {(
                  [
                    { value: "verbose", label: "Verbose", subtext: "Best for learning and self-study" },
                    { value: "minimal", label: "Minimal", subtext: "Best for presenting to an audience" },
                  ] as { value: "verbose" | "minimal"; label: string; subtext: string }[]
                ).map(({ value, label, subtext }) => (
                  <Card
                    key={value}
                    onClick={() => updateConfig("content_mode", value)}
                    className={cn(
                      "flex-1 cursor-pointer transition-colors",
                      config.content_mode === value
                        ? "border-primary bg-primary/5"
                        : "border hover:bg-muted/50"
                    )}
                  >
                    <CardContent className="p-3">
                      <div className="text-small font-semibold">
                        {config.content_mode === value ? "● " : "○ "}{label}
                      </div>
                      <div className="text-micro mt-1" style={{ color: "var(--muted-foreground)" }}>
                        {subtext}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            <Separator className="my-1" />

            {/* Include visuals checkbox */}
            <label className="flex items-center gap-2.5 text-small cursor-pointer">
              <input
                type="checkbox"
                checked={config.include_visuals}
                onChange={(e) => updateConfig("include_visuals", e.target.checked)}
                className="accent-primary w-4 h-4"
              />
              Include visual slides (one image per topic)
            </label>

            {/* Resources to include */}
            <div>
              <label className="text-small font-medium block mb-2">Resources to include</label>
              {[
                { key: "videos", label: "Videos" },
                { key: "papers", label: "Academic papers" },
                { key: "courses", label: "Online courses" },
                { key: "articles", label: "Articles & websites" },
              ].map(({ key, label }) => (
                <label
                  key={key}
                  className="flex items-center gap-2.5 text-small cursor-pointer mb-1.5"
                >
                  <input
                    type="checkbox"
                    checked={config.resource_filters[key as keyof typeof config.resource_filters]}
                    onChange={(e) =>
                      updateConfig("resource_filters", {
                        ...config.resource_filters,
                        [key]: e.target.checked,
                      })
                    }
                    className="accent-primary w-4 h-4"
                  />
                  {label}
                </label>
              ))}
            </div>

            <Separator className="my-1" />

            {/* Priority pills (DnD) */}
            <div>
              <label className="text-small font-medium block mb-2">Prioritize by</label>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handlePriorityDragEnd}
              >
                <SortableContext
                  items={config.resource_priority}
                  strategy={horizontalListSortingStrategy}
                >
                  <div className="flex gap-2 flex-wrap">
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

          </CardContent>
        </Card>
      )}
    </div>
  );
}
