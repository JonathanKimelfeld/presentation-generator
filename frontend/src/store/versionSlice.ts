import { Version } from "../types";

export interface VersionSlice {
  versions: Version[];
  currentVersionIndex: number;
  pushVersion: (version: Version) => void;
  undo: () => void;
  redo: () => void;
  setVersions: (versions: Version[]) => void;
  jumpToVersion: (id: string) => void;
}

export const createVersionSlice = (
  set: (fn: (s: VersionSlice) => Partial<VersionSlice>) => void,
  get: () => VersionSlice,
): VersionSlice => ({
  versions: [],
  currentVersionIndex: -1,

  pushVersion: (version) =>
    set((s) => {
      const next = [...s.versions, version];
      return { versions: next, currentVersionIndex: next.length - 1 };
    }),

  undo: () =>
    set((s) => ({
      currentVersionIndex: Math.max(0, s.currentVersionIndex - 1),
    })),

  redo: () =>
    set((s) => ({
      currentVersionIndex: Math.min(s.versions.length - 1, s.currentVersionIndex + 1),
    })),

  setVersions: (versions) =>
    set(() => ({
      versions,
      currentVersionIndex: versions.length - 1,
    })),

  jumpToVersion: (id) => {
    const s = get();
    const idx = s.versions.findIndex((v) => v.id === id);
    if (idx !== -1) set(() => ({ currentVersionIndex: idx }));
  },
});
