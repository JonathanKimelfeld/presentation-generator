import { PresentationConfig, TopicResource } from "../types";

export type PresentationMode = "presenting" | "studying";

export interface PresentationSlice {
  presentationId: string | null;
  topic: string | null;
  config: PresentationConfig | null;
  resources: Record<string, TopicResource[]>;
  mode: PresentationMode | null;
  step: 1 | 2;
  setPresentation: (id: string, topic: string, config: PresentationConfig | null) => void;
  setConfig: (config: PresentationConfig) => void;
  setResources: (grouped: Record<string, TopicResource[]>) => void;
  updateResource: (resource: TopicResource) => void;
  removeResource: (resourceId: string) => void;
  setMode: (mode: PresentationMode) => void;
  setStep: (step: 1 | 2) => void;
}

export const createPresentationSlice = (
  set: (fn: (s: PresentationSlice) => Partial<PresentationSlice>) => void,
): PresentationSlice => ({
  presentationId: null,
  topic: null,
  config: null,
  resources: {},
  mode: null,
  step: 1,

  setPresentation: (id, topic, config) =>
    set(() => ({ presentationId: id, topic, config })),

  setConfig: (config) => set(() => ({ config })),

  setMode: (mode) => set(() => ({ mode })),

  setStep: (step) => set(() => ({ step })),

  setResources: (grouped) => set(() => ({ resources: grouped })),

  updateResource: (resource) =>
    set((s) => {
      const updated: Record<string, TopicResource[]> = {};
      for (const [tid, list] of Object.entries(s.resources)) {
        const idx = list.findIndex((r) => r.id === resource.id);
        if (idx !== -1) {
          updated[tid] = [...list];
          updated[tid][idx] = resource;
        } else {
          updated[tid] = list;
        }
      }
      return { resources: updated };
    }),

  removeResource: (resourceId) =>
    set((s) => {
      const updated: Record<string, TopicResource[]> = {};
      for (const [tid, list] of Object.entries(s.resources)) {
        updated[tid] = list.filter((r) => r.id !== resourceId);
      }
      return { resources: updated };
    }),
});
