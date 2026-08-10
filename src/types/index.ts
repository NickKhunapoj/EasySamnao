export type DocumentKind = "pdf" | "png";

export interface PageInfo {
  index: number;
  width: number;
  height: number;
  rotation: number;
}

export interface ImportedDocument {
  path: string;
  filename: string;
  kind: DocumentKind;
  bytes: Uint8Array;
  pages: PageInfo[];
}

export type TemplateId = "classic-horizontal" | "compact" | "minimal-diagonal";
export type DateFormat = "thai-numeric" | "thai-long" | "english-long" | "iso";
export type AppLanguage = "en" | "th";
export type ThemeMode = "light" | "dark" | "system";
export type SignatureColorMode = "original" | "custom";

export interface WatermarkStyle {
  textColor: string;
  lineColor: string;
  signatureColor: string;
  signatureColorMode: SignatureColorMode;
  opacity: number;
}

/** All values except rotation are fractions of the active page. x/y represent the group centre. */
export interface WatermarkTransform {
  x: number;
  y: number;
  width: number;
  rotation: number;
}

export interface WatermarkInstance {
  templateId: TemplateId;
  purpose: string;
  certificationText: string;
  signatureId: string | null;
  signerName: string;
  showSignerName: boolean;
  date: string;
  showDate: boolean;
  dateFormat: DateFormat;
  style: WatermarkStyle;
  transform: WatermarkTransform;
}

export type WatermarkPatch = Omit<Partial<WatermarkInstance>, "style" | "transform"> & {
  style?: Partial<WatermarkStyle>;
  transform?: Partial<WatermarkTransform>;
};

export interface SignatureMetadata {
  id: string;
  name: string;
  createdAt: string;
  isDefault: boolean;
}

export interface AppSettings {
  defaultTemplate: TemplateId;
  defaultTextColor: string;
  defaultLineColor: string;
  defaultSignatureColor: string;
  defaultOpacity: number;
  defaultRotation: number;
  defaultDateFormat: DateFormat;
  fontPath: string | null;
  fontName: string | null;
  language: AppLanguage;
  theme: ThemeMode;
}

export interface ExportOptions {
  pngDpi: 150 | 300 | 600;
  pageMode: "current" | "selected" | "all";
}

export interface StoredSignaturePayload {
  metadata: SignatureMetadata;
  svg: string;
}
