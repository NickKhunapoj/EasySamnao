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

export type WatermarkPatch = Omit<
  Partial<WatermarkInstance>,
  "style" | "transform"
> & {
  style?: Partial<WatermarkStyle>;
  transform?: Partial<WatermarkTransform>;
};

export interface SignatureMetadata {
  id: string;
  name: string;
  createdAt: string;
  isDefault: boolean;
}

export type CertificateStatus =
  | "active"
  | "expiring"
  | "expired"
  | "retired"
  | "compromised"
  | "revoked"
  | "missing-private-key";
export type CertificateTrust =
  "self-signed" | "trusted" | "untrusted" | "unknown";

export interface BoundSignature {
  svgId: string;
  svgSha256: string;
  boundAt: string;
}

/** Non-secret profile information. Private keys always remain in Windows key storage. */
export interface CertificateProfile {
  id: string;
  displayName: string;
  source: "generated" | "pkcs12" | "windows-store";
  certificateFingerprint: string;
  subject: string;
  issuer: string;
  serialNumber: string;
  validFrom: string;
  validUntil: string;
  trust: CertificateTrust;
  status: CertificateStatus;
  privateKeyReference?: string | null;
  boundSignature?: BoundSignature | null;
  predecessorCertificateId?: string | null;
  successorCertificateId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CertificateBindingState {
  state: "valid" | "unbound" | "changed" | "missing";
  svgId?: string | null;
  expectedSha256?: string | null;
  actualSha256?: string | null;
}

export interface PdfSignatureVerification {
  integrityValid: boolean;
  documentChangedAfterSigning: boolean;
  signer?: string | null;
  certificateFingerprint?: string | null;
  trust: CertificateTrust;
  certificateStatus: CertificateStatus;
  message: string;
}

export interface CreateCertificateRequest {
  id: string;
  displayName: string;
  subjectName: string;
  email?: string;
  organization?: string;
  validityYears: number;
  bindSvgId?: string;
  predecessorCertificateId?: string;
}

export interface DigitalSigningOptions {
  certificateId: string;
  signerName: string;
  reason: string;
  location: string;
  pageIndex: number;
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
