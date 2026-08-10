import { Button, Input, Select, Slider, Switch } from "@fluentui/react-components";
import type { SignatureMetadata, TemplateId, WatermarkInstance, WatermarkPatch } from "../types";
import { formatCertificationDate } from "../utils/date";
import { templateDefinitions } from "../templates/definitions";
import { useSettingsStore } from "../state/settingsStore";
import { text } from "../i18n/localization";

interface Props {
  watermark: WatermarkInstance | null;
  signatures: SignatureMetadata[];
  onChange: (patch: WatermarkPatch) => void;
  onTransform: (patch: Partial<WatermarkInstance["transform"]>) => void;
  onReset: () => void;
  onApplyToSelected: () => void;
}

export function PropertiesPanel({ watermark, signatures, onChange, onTransform, onReset, onApplyToSelected }: Props) {
  const t = text(useSettingsStore((state) => state.settings.language));
  if (!watermark) return <aside className="properties"><h2>{t.properties}</h2><p className="empty-copy">{t.importDocumentToEdit}</p></aside>;
  const updateStyle = (patch: Partial<WatermarkInstance["style"]>) => onChange({ style: patch });
  return <aside className="properties" aria-label="Watermark properties">
    <h2>{t.properties}</h2>
    <section className="property-section">
      <h3>{t.template}</h3>
      <div className="field"><label htmlFor="template">{t.certificationTemplate}</label><Select id="template" value={watermark.templateId} onChange={(event) => onChange({ templateId: event.target.value as TemplateId })}>
        {templateDefinitions.map((template) => <option key={template.id} value={template.id}>{template.id === "classic-horizontal" ? t.classicHorizontal : template.id === "compact" ? t.compact : t.minimalDiagonal}</option>)}
      </Select></div>
      <div className="field"><label htmlFor="purpose">{t.purpose}</label><Input id="purpose" value={watermark.purpose} onChange={(_, data) => onChange({ purpose: data.value })} placeholder={t.purposeHint} /><span className="status">{t.purposeExact}</span></div>
      <div className="field"><label htmlFor="certification">{t.certificationText}</label><Input id="certification" value={watermark.certificationText} onChange={(_, data) => onChange({ certificationText: data.value })} /></div>
    </section>
    <section className="property-section">
      <h3>{t.signature}</h3>
      <div className="field"><label htmlFor="signature">{t.electronicSignature}</label><Select id="signature" value={watermark.signatureId ?? ""} onChange={(event) => onChange({ signatureId: event.target.value || null })}>
        <option value="">{t.noSignature}</option>{signatures.map((signature) => <option key={signature.id} value={signature.id}>{signature.name}{signature.isDefault ? ` (${t.default})` : ""}</option>)}
      </Select></div>
      <div className="field"><label htmlFor="signer-name">{t.signerName}</label><Input id="signer-name" value={watermark.signerName} onChange={(_, data) => onChange({ signerName: data.value })} /></div>
      <Switch label={t.showSignerName} checked={watermark.showSignerName} onChange={(_, data) => onChange({ showSignerName: data.checked })} />
      <div className="field-row" style={{ marginTop: 10 }}><Switch label={t.showDate} checked={watermark.showDate} onChange={(_, data) => onChange({ showDate: data.checked })} /><span className="status">{formatCertificationDate(watermark.date, watermark.dateFormat)}</span></div>
      <div className="field"><label htmlFor="date">{t.date}</label><Input id="date" type="date" value={watermark.date} onChange={(_, data) => onChange({ date: data.value })} /></div>
      <div className="field"><label htmlFor="date-format">{t.dateFormat}</label><Select id="date-format" value={watermark.dateFormat} onChange={(event) => onChange({ dateFormat: event.target.value as WatermarkInstance["dateFormat"] })}>
        <option value="thai-long">10 สิงหาคม 2569</option><option value="thai-numeric">10/08/2569</option><option value="english-long">10 August 2026</option><option value="iso">2026-08-10</option>
      </Select></div>
    </section>
    <section className="property-section">
      <h3>{t.appearance}</h3>
      <div className="field"><label>{t.textColor}</label><div className="color-row"><Input value={watermark.style.textColor} onChange={(_, data) => updateStyle({ textColor: data.value })} /><input aria-label="Text color picker" type="color" value={watermark.style.textColor} onChange={(event) => updateStyle({ textColor: event.target.value })} /></div></div>
      <div className="field"><label>{t.lineColor}</label><div className="color-row"><Input value={watermark.style.lineColor} onChange={(_, data) => updateStyle({ lineColor: data.value })} /><input aria-label="Line color picker" type="color" value={watermark.style.lineColor} onChange={(event) => updateStyle({ lineColor: event.target.value })} /></div></div>
      <div className="field"><label>{t.opacity} ({Math.round(watermark.style.opacity * 100)}%)</label><Slider min={0.1} max={1} step={0.01} value={watermark.style.opacity} onChange={(_, data) => updateStyle({ opacity: data.value })} /></div>
    </section>
    <section className="property-section">
      <h3>{t.layout}</h3>
      <div className="field-row"><div className="field"><label htmlFor="rotation">{t.rotation}</label><Input id="rotation" type="number" value={String(watermark.transform.rotation)} onChange={(_, data) => onTransform({ rotation: Number(data.value) || 0 })} contentAfter="°" /></div><div className="field"><label htmlFor="scale">{t.width} ({Math.round(watermark.transform.width * 100)}%)</label><Input id="scale" type="number" min="12" max="125" value={String(Math.round(watermark.transform.width * 100))} onChange={(_, data) => onTransform({ width: Math.max(0.12, Math.min(1.25, Number(data.value) / 100 || 0.12)) })} contentAfter="%" /></div></div>
      <div className="field"><label>{t.scale}</label><Slider min={0.12} max={1.25} step={0.01} value={watermark.transform.width} onChange={(_, data) => onTransform({ width: data.value })} /></div>
      <div className="layout-actions"><Button onClick={onReset}>{t.resetLayout}</Button><Button onClick={onApplyToSelected}>{t.applyToIncluded}</Button></div>
    </section>
  </aside>;
}
