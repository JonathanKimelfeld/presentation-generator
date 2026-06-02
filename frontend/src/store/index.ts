import { create } from "zustand";
import { createPresentationSlice, PresentationSlice } from "./presentationSlice";
import { createVersionSlice, VersionSlice } from "./versionSlice";
import { createEditorSlice, EditorSlice } from "./editorSlice";
import { Version } from "../types";

type StoreState = PresentationSlice & VersionSlice & EditorSlice;

export const useStore = create<StoreState>()((set, get) => ({
  ...createPresentationSlice((fn) => set((s) => ({ ...s, ...fn(s) }))),
  ...createVersionSlice(
    (fn) => set((s) => ({ ...s, ...fn(s) })),
    () => get() as VersionSlice,
  ),
  ...createEditorSlice((fn) => set((s) => ({ ...s, ...fn(s) }))),
}));

export const currentVersion = (state: StoreState): Version | null =>
  state.versions[state.currentVersionIndex] ?? null;
