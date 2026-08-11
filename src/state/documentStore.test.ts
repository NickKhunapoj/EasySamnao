import { beforeEach, describe, expect, it } from "vitest";
import { useDocumentStore } from "./documentStore";
import { defaultSettings } from "./settingsStore";
import type { ImportedDocument } from "../types";

const document: ImportedDocument = { path: "", filename: "test.pdf", kind: "pdf", bytes: new Uint8Array(), pages: [{ index: 0, width: 600, height: 800, rotation: 0 }, { index: 1, width: 600, height: 800, rotation: 0 }] };

describe("page-specific watermark state and history", () => {
  beforeEach(() => useDocumentStore.getState().setDocument(document, defaultSettings));
  it("keeps watermark layouts independent by page", () => {
    const store = useDocumentStore.getState();
    store.updateTransform({ x: 0.24 }); store.setActivePage(1); store.updateTransform({ x: 0.76 });
    expect(useDocumentStore.getState().watermarks[0].transform.x).toBe(0.24);
    expect(useDocumentStore.getState().watermarks[1].transform.x).toBe(0.76);
  });
  it("undoes and redoes property changes", () => {
    const store = useDocumentStore.getState();
    store.updateTransform({ rotation: -12 }); store.undo();
    expect(useDocumentStore.getState().watermarks[0].transform.rotation).toBe(-30);
    store.redo(); expect(useDocumentStore.getState().watermarks[0].transform.rotation).toBe(-12);
  });
  it("copies the active watermark only when explicitly applied to watermarked pages", () => {
    const store = useDocumentStore.getState();
    store.updateTransform({ x: 0.24 }); store.toggleWatermarkedPage(1); store.applyActiveWatermarkToWatermarked();
    expect(useDocumentStore.getState().watermarks[1].transform.x).toBe(0.24);
  });
  it("keeps export and watermark inclusion independent", () => {
    const store = useDocumentStore.getState();
    store.toggleExportPage(1);
    expect(useDocumentStore.getState()).toMatchObject({ exportPages: [0, 1], watermarkedPages: [0] });
    store.toggleWatermarkedPage(1);
    expect(useDocumentStore.getState()).toMatchObject({ exportPages: [0, 1], watermarkedPages: [0, 1] });
  });
  it("clears the document and all in-progress editor state", () => {
    const store = useDocumentStore.getState();
    store.updateTransform({ x: 0.24 }); store.setActivePage(1); store.toggleExportPage(1); store.toggleWatermarkedPage(1);
    store.clearDocument();
    expect(useDocumentStore.getState()).toMatchObject({ document: null, activePage: 0, exportPages: [0], watermarkedPages: [0], watermarks: {}, history: { past: [], future: [] } });
  });
});
