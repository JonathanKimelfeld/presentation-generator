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
import { PresentationMode } from "../store/presentationSlice";
import { API_BASE as API } from "../config";

// ─── Constants ────────────────────────────────────────────────────────────────

const STUDY_LEVELS = [
  { label: "Complete beginner", depth: 2 },
  { label: "Some familiarity",  depth: 3 },
  { label: "Intermediate",      depth: 4 },
  { label: "Advanced",          depth: 5 },
] as const;

// Module-level bridge: ModeSelection writes these before transitioning to Step 2,
// so TopicStep can initialize config without store changes.
let _bridgeAudience = "";
let _bridgeStudyLevelIdx = 0;

// ─── Config builder ───────────────────────────────────────────────────────────

function buildConfig(mode: PresentationMode, audience: string, depth: number): PresentationConfig {
  const shared = {
    length: 20,
    scope: "",
    style: "minimal" as const,
    resource_filters: { videos: true, articles: true, papers: true, courses: true },
    resource_priority: ["video", "paper", "course", "article"] as string[],
  };

  if (mode === "presenting") {
    return {
      ...shared,
      audience,
      tone: "formal",
      depth: 3,
      compactness: 4,
      content_mode: "minimal",
      include_visuals: false,
    };
  }

  return {
    ...shared,
    audience: "",
    tone: "casual",
    depth,
    compactness: 2,
    content_mode: "verbose",
    include_visuals: true,
  };
}

// ─── PriorityPill ─────────────────────────────────────────────────────────────

function PriorityPill({ id, label }: { id: string; label: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "px-3 py-1 rounded-full text-small border border-border bg-secondary cursor-grab select-none",
        isDragging && "bg-primary/10 border-primary opacity-60"
      )}
    >
      {label}
    </div>
  );
}

// ─── Step 1: Mode selection ───────────────────────────────────────────────────

function ModeSelection() {
  const { setMode, setStep } = useStore();
  const [selected, setSelected] = useState<PresentationMode | null>(null);
  const [audience, setAudience] = useState("");
  const [levelIdx, setLevelIdx] = useState(0);

  function handleContinue() {
    if (!selected) return;
    // Write bridge values before transitioning so TopicStep reads them on mount
    _bridgeAudience = selected === "presenting" ? audience : "";
    _bridgeStudyLevelIdx = levelIdx;
    setMode(selected);
    setStep(2);
  }

  return (
    <div className="max-w-[600px] mx-auto px-6" style={{ paddingTop: 80, paddingBottom: 80 }}>
      {/* Header */}
      <div className="text-subheading mb-3">AI Presentation Generator</div>
      <h1 className="text-display" style={{ marginTop: 12 }}>How will this be used?</h1>
      <p className="text-small mt-2" style={{ color: "var(--muted-foreground)" }}>
        This helps us tailor the content and structure to the right purpose.
      </p>

      {/* Cards */}
      <div style={{ marginTop: 40, display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Presenting card */}
        <Card
          onClick={() => setSelected("presenting")}
          style={{
            padding: "28px 32px",
            cursor: "pointer",
            border: selected === "presenting"
              ? "2.5px solid var(--primary)"
              : "1.5px solid var(--border)",
            background: selected === "presenting"
              ? "oklch(0.600 0.173 151 / 0.04)"
              : "var(--card)",
            transition: "all 150ms ease",
            boxShadow: selected === "presenting" ? "0 4px 12px rgba(0,0,0,0.08)" : undefined,
          }}
        >
          <CardContent className="p-0">
            <span style={{
              fontSize: 36,
              display: "block",
              marginBottom: 12,
              transform: selected === "presenting" ? "scale(1.05)" : "scale(1)",
              transition: "transform 150ms ease",
            }}>
              🎤
            </span>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
              I'm presenting to an audience
            </div>
            <div className="text-small" style={{ color: "var(--muted-foreground)", lineHeight: 1.6 }}>
              You'll be standing in front of people — students, colleagues, clients, or a crowd.
              Slides are concise, speaker-notes driven, and structured for you to speak to.
            </div>

            <div
              style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid hsl(var(--border))" }}
              onClick={(e) => e.stopPropagation()}
            >
              <label className="text-small font-medium block mb-1.5">
                Who is your audience?
              </label>
              <Input
                placeholder="e.g. university students, marketing team, conference attendees"
                value={audience}
                onChange={(e) => {
                  setAudience(e.target.value);
                  setSelected("presenting");
                }}
                onFocus={() => setSelected("presenting")}
              />
            </div>
          </CardContent>
        </Card>

        {/* Studying card */}
        <Card
          onClick={() => setSelected("studying")}
          style={{
            padding: "28px 32px",
            cursor: "pointer",
            border: selected === "studying"
              ? "2.5px solid var(--primary)"
              : "1.5px solid var(--border)",
            background: selected === "studying"
              ? "oklch(0.600 0.173 151 / 0.04)"
              : "var(--card)",
            transition: "all 150ms ease",
            boxShadow: selected === "studying" ? "0 4px 12px rgba(0,0,0,0.08)" : undefined,
          }}
        >
          <CardContent className="p-0">
            <span style={{
              fontSize: 36,
              display: "block",
              marginBottom: 12,
              transform: selected === "studying" ? "scale(1.05)" : "scale(1)",
              transition: "transform 150ms ease",
            }}>
              📖
            </span>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
              I'm studying this myself
            </div>
            <div className="text-small" style={{ color: "var(--muted-foreground)", lineHeight: 1.6 }}>
              You want to deeply understand a topic. Content is verbose, explanation-first, with
              analogies and real-world examples written for someone learning from scratch.
            </div>

            <div
              style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid hsl(var(--border))" }}
              onClick={(e) => e.stopPropagation()}
            >
              <label className="text-small font-medium block mb-3">
                What's your current level on this topic?
              </label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {STUDY_LEVELS.map((lvl, i) => {
                  const active = selected === "studying" && levelIdx === i;
                  return (
                    <button
                      key={lvl.label}
                      onClick={() => { setLevelIdx(i); setSelected("studying"); }}
                      style={{
                        fontSize: 13,
                        padding: "6px 14px",
                        borderRadius: 9999,
                        border: `2px solid ${active ? "var(--primary)" : "var(--border)"}`,
                        background: active ? "var(--primary)" : "transparent",
                        color: active ? "var(--primary-foreground)" : "var(--foreground)",
                        cursor: "pointer",
                        transition: "all 150ms ease",
                      }}
                    >
                      {lvl.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Continue */}
      <Button
        size="lg"
        disabled={!selected}
        onClick={handleContinue}
        className="w-full mt-6 h-13 text-base font-semibold"
      >
        Continue →
      </Button>
    </div>
  );
}

// ─── Step 2: Topic input + config ─────────────────────────────────────────────

type NormalizationResult = {
  normalized: string;
  corrections: string | null;
};

function TopicStep({ mode }: { mode: PresentationMode }) {
  const { setStep, isConfigOpen, toggleConfig, isGenerating, setGenerating, pushVersion, setPresentation } =
    useStore();
  const navigate = useNavigate();
  const abortRef = useRef<AbortController | null>(null);

  const [topic, setTopic] = useState("");
  const [config, setConfig] = useState<PresentationConfig>(() =>
    buildConfig(mode, _bridgeAudience, STUDY_LEVELS[_bridgeStudyLevelIdx].depth)
  );
  const [normalization, setNormalization] = useState<NormalizationResult | null>(null);
  const [isNormalizing, setIsNormalizing] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const updateConfig = <K extends keyof PresentationConfig>(key: K, value: PresentationConfig[K]) =>
    setConfig((c) => ({ ...c, [key]: value }));

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handlePriorityDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const old = config.resource_priority;
      updateConfig("resource_priority", arrayMove(old, old.indexOf(active.id as string), old.indexOf(over.id as string)));
    }
  }

  function handleBack() {
    setStep(1);
  }

  const handleCancel = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setGenerating(false);
  };

  const runGenerate = async (topicToUse: string) => {
    const controller = new AbortController();
    abortRef.current = controller;
    setGenerating(true);
    setGenerateError(null);

    try {
      const res = await fetch(`${API}/presentations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topicToUse, config }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setGenerateError(
          (err as { detail?: string }).detail || "Generation failed. Try rephrasing your topic."
        );
        return;
      }
      const version = await res.json();
      pushVersion(version);
      setPresentation(version.presentation_id, topicToUse, config);
      navigate(`/outline/${version.presentation_id}`);
    } catch (err) {
      if ((err as Error).name !== "AbortError") throw err;
    } finally {
      abortRef.current = null;
      setGenerating(false);
    }
  };

  const handleGenerate = async () => {
    if (!topic.trim()) return;
    if (isGenerating) { handleCancel(); return; }

    // Skip normalization for very short inputs
    if (topic.trim().length < 3) {
      await runGenerate(topic);
      return;
    }

    setIsNormalizing(true);
    try {
      const res = await fetch(`${API}/presentations/normalize-topic`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic }),
      });
      const data = await res.json();
      if (!data.changed) {
        await runGenerate(topic);
      } else {
        setNormalization({ normalized: data.normalized, corrections: data.corrections });
      }
    } catch {
      // Normalization failed — proceed with original
      await runGenerate(topic);
    } finally {
      setIsNormalizing(false);
    }
  };

  const isPresenting = mode === "presenting";
  const audienceLabel = config.audience || "your audience";

  return (
    <div className="max-w-[560px] mx-auto px-6" style={{ paddingTop: 80, paddingBottom: 80 }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Back link */}
      <button
        onClick={handleBack}
        className="text-small bg-transparent border-0 p-0 cursor-pointer mb-6"
        style={{ color: "var(--muted-foreground)" }}
      >
        ← Change mode
      </button>

      {/* Header */}
      <div className="text-subheading mb-3">AI Presentation Generator</div>
      <h1 className="text-display" style={{ marginTop: 12 }}>
        {isPresenting ? "What's the presentation about?" : "What do you want to learn?"}
      </h1>
      <p className="text-small mt-2" style={{ color: "var(--muted-foreground)" }}>
        {isPresenting
          ? `We'll build slides you can present to ${audienceLabel}.`
          : "We'll build a step-by-step explanation you can learn from at your own pace."}
      </p>

      {/* Topic input with normalizing spinner overlay */}
      <div className="relative mt-8">
        <Input
          type="text"
          placeholder="e.g. The Central Limit Theorem, Chess openings..."
          value={topic}
          onChange={(e) => {
            setTopic(e.target.value);
            if (normalization) setNormalization(null);
            if (generateError) setGenerateError(null);
          }}
          onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
          className="h-13 text-base pr-10"
          autoFocus
        />
        {isNormalizing && (
          <span style={{
            position: "absolute",
            right: 12,
            top: "50%",
            transform: "translateY(-50%)",
            width: 16,
            height: 16,
            border: "2px solid var(--border)",
            borderTopColor: "var(--primary)",
            borderRadius: "50%",
            display: "inline-block",
            animation: "spin 0.7s linear infinite",
            flexShrink: 0,
          }} />
        )}
      </div>

      {/* Normalization banner */}
      {normalization && (
        <div style={{
          marginTop: 12,
          padding: "14px 16px",
          background: "#f0fdf4",
          border: "1px solid #bbf7d0",
          borderRadius: 8,
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>✎</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="text-small" style={{ color: "#166534", marginBottom: 4 }}>
                We cleaned up your topic:
              </div>
              <div style={{ fontSize: 16, fontWeight: 600, color: "#14532d", marginBottom: normalization.corrections ? 4 : 0 }}>
                {normalization.normalized}
              </div>
              {normalization.corrections && (
                <div className="text-small" style={{ color: "#16a34a" }}>
                  {normalization.corrections}
                </div>
              )}
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button
                  onClick={() => {
                    setTopic(normalization.normalized);
                    setNormalization(null);
                    runGenerate(normalization.normalized);
                  }}
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    padding: "6px 14px",
                    borderRadius: 6,
                    border: "none",
                    background: "#16a34a",
                    color: "#fff",
                    cursor: "pointer",
                  }}
                >
                  Use this →
                </button>
                <button
                  onClick={() => {
                    setNormalization(null);
                    runGenerate(topic);
                  }}
                  style={{
                    fontSize: 13,
                    padding: "6px 14px",
                    borderRadius: 6,
                    border: "1px solid #bbf7d0",
                    background: "transparent",
                    color: "#166534",
                    cursor: "pointer",
                  }}
                >
                  Keep original
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Generate button */}
      <Button
        size="lg"
        onClick={handleGenerate}
        disabled={!topic.trim() || isNormalizing || !!normalization}
        className={cn(
          "w-full mt-4 h-13 text-base font-semibold",
          isGenerating
            ? "bg-red-600 hover:bg-red-700 text-white"
            : "bg-primary hover:bg-primary/90 text-primary-foreground"
        )}
      >
        {(isGenerating || isNormalizing) && (
          <span style={{
            width: 16, height: 16,
            border: "2px solid rgba(255,255,255,0.35)",
            borderTopColor: "#fff",
            borderRadius: "50%",
            display: "inline-block",
            animation: "spin 0.7s linear infinite",
            flexShrink: 0,
            marginRight: 8,
          }} />
        )}
        {isGenerating ? "Generating…" : isNormalizing ? "Checking…" : "Generate Presentation"}
      </Button>

      {isGenerating && (
        <p className="text-small mt-3" style={{ color: "var(--muted-foreground)" }}>
          Building your presentation — this may take a minute
        </p>
      )}

      {generateError && (
        <p style={{ color: "#dc2626", fontSize: 13, marginTop: 8 }}>
          {generateError}
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

            <div>
              <label className="text-small font-medium">Audience</label>
              <Input value={config.audience} onChange={(e) => updateConfig("audience", e.target.value)} className="mt-1.5" />
            </div>

            <Separator className="my-1" />

            <div>
              <label className="text-small font-medium">Tone</label>
              <Select value={config.tone} onValueChange={(v) => updateConfig("tone", v as PresentationConfig["tone"])}>
                <SelectTrigger className="mt-1.5 w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="formal">Formal</SelectItem>
                  <SelectItem value="casual">Casual</SelectItem>
                  <SelectItem value="technical">Technical</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator className="my-1" />

            <div>
              <div className="flex justify-between text-small">
                <label>Depth</label>
                <span style={{ color: "var(--muted-foreground)" }}>{config.depth}/5</span>
              </div>
              <Slider min={1} max={5} step={1} value={[config.depth]}
                onValueChange={(v) => updateConfig("depth", (v as number[])[0])} className="mt-2" />
            </div>

            <div>
              <div className="flex justify-between text-small">
                <label>Length</label>
                <span style={{ color: "var(--muted-foreground)" }}>{config.length} min</span>
              </div>
              <Slider min={5} max={60} step={5} value={[config.length]}
                onValueChange={(v) => updateConfig("length", (v as number[])[0])} className="mt-2" />
            </div>

            <div>
              <div className="flex justify-between text-small">
                <label>Compactness</label>
                <span style={{ color: "var(--muted-foreground)" }}>{config.compactness}/5</span>
              </div>
              <Slider min={1} max={5} step={1} value={[config.compactness]}
                onValueChange={(v) => updateConfig("compactness", (v as number[])[0])} className="mt-2" />
            </div>

            <Separator className="my-1" />

            <div>
              <label className="text-small font-medium">Scope</label>
              <Input value={config.scope} onChange={(e) => updateConfig("scope", e.target.value)} className="mt-1.5" />
            </div>

            <div>
              <label className="text-small font-medium">Style</label>
              <Select value={config.style} onValueChange={(v) => updateConfig("style", v as PresentationConfig["style"])}>
                <SelectTrigger className="mt-1.5 w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="minimal">Minimal</SelectItem>
                  <SelectItem value="detailed">Detailed</SelectItem>
                  <SelectItem value="visual">Visual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator className="my-1" />

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
                      config.content_mode === value ? "border-primary bg-primary/5" : "border hover:bg-muted/50"
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

            <label className="flex items-center gap-2.5 text-small cursor-pointer">
              <input type="checkbox" checked={config.include_visuals}
                onChange={(e) => updateConfig("include_visuals", e.target.checked)}
                className="accent-primary w-4 h-4" />
              Include visual slides (one image per topic)
            </label>

            <div>
              <label className="text-small font-medium block mb-2">Resources to include</label>
              {[
                { key: "videos", label: "Videos" },
                { key: "papers", label: "Academic papers" },
                { key: "courses", label: "Online courses" },
                { key: "articles", label: "Articles & websites" },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2.5 text-small cursor-pointer mb-1.5">
                  <input type="checkbox"
                    checked={config.resource_filters[key as keyof typeof config.resource_filters]}
                    onChange={(e) => updateConfig("resource_filters", { ...config.resource_filters, [key]: e.target.checked })}
                    className="accent-primary w-4 h-4" />
                  {label}
                </label>
              ))}
            </div>

            <Separator className="my-1" />

            <div>
              <label className="text-small font-medium block mb-2">Prioritize by</label>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handlePriorityDragEnd}>
                <SortableContext items={config.resource_priority} strategy={horizontalListSortingStrategy}>
                  <div className="flex gap-2 flex-wrap">
                    {config.resource_priority.map((type) => {
                      const labels: Record<string, string> = { video: "Videos", paper: "Papers", course: "Courses", article: "Articles" };
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

// ─── Root component ───────────────────────────────────────────────────────────

export default function NewPresentation() {
  const { mode, step } = useStore();

  if (step === 1 || !mode) return <ModeSelection />;
  return <TopicStep mode={mode} />;
}
