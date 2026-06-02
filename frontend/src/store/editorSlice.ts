export interface EditorSlice {
  activeSlideId: string | null;
  selectedSlideIds: string[];
  chatInput: string;
  isSidebarOpen: boolean;
  isConfigOpen: boolean;
  isGenerating: boolean;
  setActiveSlide: (id: string) => void;
  toggleSlideSelection: (id: string) => void;
  clearSlideSelection: () => void;
  setChatInput: (text: string) => void;
  toggleSidebar: () => void;
  toggleConfig: () => void;
  setGenerating: (val: boolean) => void;
}

export const createEditorSlice = (
  set: (fn: (s: EditorSlice) => Partial<EditorSlice>) => void,
): EditorSlice => ({
  activeSlideId: null,
  selectedSlideIds: [],
  chatInput: "",
  isSidebarOpen: false,
  isConfigOpen: false,
  isGenerating: false,

  setActiveSlide: (id) => set(() => ({ activeSlideId: id })),

  toggleSlideSelection: (id) =>
    set((s) => ({
      selectedSlideIds: s.selectedSlideIds.includes(id)
        ? s.selectedSlideIds.filter((x) => x !== id)
        : [...s.selectedSlideIds, id],
    })),

  clearSlideSelection: () => set(() => ({ selectedSlideIds: [] })),

  setChatInput: (text) => set(() => ({ chatInput: text })),

  toggleSidebar: () => set((s) => ({ isSidebarOpen: !s.isSidebarOpen })),

  toggleConfig: () => set((s) => ({ isConfigOpen: !s.isConfigOpen })),

  setGenerating: (val) => set(() => ({ isGenerating: val })),
});
