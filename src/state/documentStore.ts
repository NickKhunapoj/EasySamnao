import { create } from "zustand";
import type { AppSettings, ImportedDocument, WatermarkInstance, WatermarkPatch } from "../types";
import { todayIsoDate } from "../utils/date";

interface WatermarkHistory { past: Record<number, WatermarkInstance>[]; future: Record<number, WatermarkInstance>[]; }

function clone<T>(value: T): T { return structuredClone(value); }

export function createDefaultWatermark(settings: AppSettings): WatermarkInstance {
  return {
    templateId: settings.defaultTemplate,
    purpose: "",
    certificationText: "สำเนาถูกต้อง",
    signatureId: null,
    signerName: "",
    showSignerName: false,
    date: todayIsoDate(),
    showDate: true,
    dateFormat: settings.defaultDateFormat,
    style: {
      textColor: settings.defaultTextColor,
      lineColor: settings.defaultLineColor,
      signatureColor: settings.defaultSignatureColor,
      signatureColorMode: "original",
      opacity: settings.defaultOpacity
    },
    transform: { x: 0.5, y: 0.55, width: 0.65, rotation: settings.defaultRotation }
  };
}

interface DocumentStore {
  document: ImportedDocument | null;
  activePage: number;
  exportPages: number[];
  watermarkedPages: number[];
  watermarks: Record<number, WatermarkInstance>;
  history: WatermarkHistory;
  setDocument: (document: ImportedDocument, settings: AppSettings) => void;
  clearDocument: () => void;
  setActivePage: (page: number) => void;
  toggleExportPage: (page: number) => void;
  toggleWatermarkedPage: (page: number) => void;
  updateWatermark: (patch: WatermarkPatch) => void;
  updateTransform: (patch: Partial<WatermarkInstance["transform"]>) => void;
  resetTransform: (settings: AppSettings) => void;
  applyActiveWatermarkToWatermarked: () => void;
  undo: () => void;
  redo: () => void;
}

const copyMap = (map: Record<number, WatermarkInstance>) => clone(map);

export const useDocumentStore = create<DocumentStore>((set, get) => {
  const commit = (next: Record<number, WatermarkInstance>) => {
    const current = get().watermarks;
    set((state) => ({ watermarks: next, history: { past: [...state.history.past, current], future: [] } }));
  };
  return {
    document: null,
    activePage: 0,
    exportPages: [0],
    watermarkedPages: [0],
    watermarks: {},
    history: { past: [], future: [] },
    setDocument(document, settings) {
      const defaultWatermark = createDefaultWatermark(settings);
      const watermarks = Object.fromEntries(document.pages.map((page) => [page.index, clone(defaultWatermark)]));
      set({ document, activePage: 0, exportPages: [0], watermarkedPages: [0], watermarks, history: { past: [], future: [] } });
    },
    clearDocument() {
      set({ document: null, activePage: 0, exportPages: [0], watermarkedPages: [0], watermarks: {}, history: { past: [], future: [] } });
    },
    setActivePage(page) { set({ activePage: page }); },
    toggleExportPage(page) {
      set((state) => ({ exportPages: state.exportPages.includes(page) ? state.exportPages.filter((item) => item !== page) : [...state.exportPages, page] }));
    },
    toggleWatermarkedPage(page) {
      set((state) => ({ watermarkedPages: state.watermarkedPages.includes(page) ? state.watermarkedPages.filter((item) => item !== page) : [...state.watermarkedPages, page] }));
    },
    updateWatermark(patch) {
      const state = get();
      const current = state.watermarks[state.activePage];
      if (!current) return;
      const next = copyMap(state.watermarks);
      const stylePatch = patch.style ?? {};
      const transformPatch = patch.transform ?? {};
      next[state.activePage] = {
        ...current,
        ...patch,
        style: { ...current.style, ...stylePatch },
        transform: { ...current.transform, ...transformPatch }
      };
      commit(next);
    },
    updateTransform(patch) { get().updateWatermark({ transform: patch }); },
    resetTransform(settings) {
      get().updateWatermark({ transform: { x: 0.5, y: 0.55, width: 0.65, rotation: settings.defaultRotation } });
    },
    applyActiveWatermarkToWatermarked() {
      const state = get();
      const source = state.watermarks[state.activePage];
      if (!source) return;
      const next = copyMap(state.watermarks);
      for (const page of state.watermarkedPages) next[page] = clone(source);
      commit(next);
    },
    undo() {
      const { past, future } = get().history;
      if (!past.length) return;
      const previous = past[past.length - 1];
      set((state) => ({ watermarks: previous, history: { past: past.slice(0, -1), future: [state.watermarks, ...future] } }));
    },
    redo() {
      const { past, future } = get().history;
      if (!future.length) return;
      const next = future[0];
      set((state) => ({ watermarks: next, history: { past: [...past, state.watermarks], future: future.slice(1) } }));
    }
  };
});
