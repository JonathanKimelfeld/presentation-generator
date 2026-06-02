export interface ResourceFilter {
  videos: boolean;
  articles: boolean;
  papers: boolean;
  courses: boolean;
}

export interface PresentationConfig {
  audience: string;
  tone: "formal" | "casual" | "technical";
  depth: number;        // 1–5
  length: number;       // minutes
  compactness: number;  // 1–5
  scope: string;
  style: "minimal" | "detailed" | "visual";
  resource_filters: ResourceFilter;
  resource_priority: string[];
}

export interface TopicResource {
  id: string;
  presentation_id: string;
  version_id: string;
  topic_id: string;
  url: string;
  title: string;
  description: string;
  source_type: "video" | "article" | "paper" | "course";
  relevance_score: number;
  priority: number;
  is_selected: boolean;
  created_at: string;
}

export interface ConfidenceFlag {
  type: "scarce_source" | "ambiguous_scope" | "depth_mismatch" | "time_estimate_weak";
  detail: string;
  affected_slide_ids: string[];
}

export interface Confidence {
  score: number;
  flags: ConfidenceFlag[];
}

export interface Slide {
  id: string;
  topic_id: string;
  position: string;
  title: string;
  layout: "bullets" | "quote" | "two-col" | "title" | "embed";
  content: Record<string, unknown>;
  speaker_notes: string;
  estimated_minutes: number;
  confidence: Confidence;
}

export interface OutlineTopic {
  id: string;
  title: string;
  weight: number;
  slide_count: number;
  estimated_minutes: number;
  slide_ids: string[];
  rationale: string;
  confidence: Confidence;
}

export interface Outline {
  topics: OutlineTopic[];
}

export interface Version {
  id: string;
  presentation_id: string;
  parent_id: string | null;
  created_at: string;
  source:
    | "generated"
    | "direct_edit"
    | "ai_patch"
    | "ai_regen"
    | "reorder"
    | "outline_approval"
    | "rebalance"
    | "outline_refined";
  prompt_used: string | null;
  config: PresentationConfig | null;
  outline: Outline;
  slides: Slide[];
  confidence: Confidence;
}

export interface Presentation {
  id: string;
  topic: string;
  config: PresentationConfig;
  created_at: string;
  current_version_id: string;
}

export interface VersionSummary {
  id: string;
  created_at: string;
  source: Version["source"];
  prompt_used: string | null;
  confidence: Confidence;
}
