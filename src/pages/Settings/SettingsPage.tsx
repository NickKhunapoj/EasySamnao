import { Button, Input, Select, Slider } from "@fluentui/react-components";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import { createId } from "../../utils/ids";
import { sanitizeSvg } from "../../signatures/sanitizeSvg";
import { rasterizeSignatureSvg } from "../../signatures/rasterizeSignature";
import {
  listSignatures,
  readSignatureSvg,
  removeSignature,
  renameSignature,
  saveSignature,
  setDefaultSignature,
} from "../../signatures/signatureStorage";
import { useSettingsStore } from "../../state/settingsStore";
import type { SignatureMetadata } from "../../types";
import { text } from "../../i18n/localization";
import { CertificateManager } from "../../components/CertificateManager";

interface ListedSignature extends SignatureMetadata {
  svg?: string;
  previewUrl?: string;
}
interface FontValidation {
  name: string;
  supportsThai: boolean;
}

export function SettingsPage() {
  const { settings, setSettings } = useSettingsStore();
  const t = text(settings.language);
  const [signatures, setSignatures] = useState<ListedSignature[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fontStatus, setFontStatus] = useState<FontValidation | null>(null);
  const refresh = async () => {
    const metadata = await listSignatures();
    const listed = await Promise.all(
      metadata.map(async (item) => {
        const svg = await readSignatureSvg(item.id).catch(() => undefined);
        const previewUrl = svg
          ? await rasterizeSignatureSvg(svg, undefined, 360)
              .then((canvas) => canvas.toDataURL("image/png"))
              .catch(() => undefined)
          : undefined;
        return { ...item, svg, previewUrl };
      }),
    );
    setSignatures(listed);
  };
  useEffect(() => {
    refresh().catch((reason: Error) => setError(reason.message));
  }, []);
  useEffect(() => {
    if (settings.fontPath)
      invoke<FontValidation>("validate_font_path", { path: settings.fontPath })
        .then(setFontStatus)
        .catch(() => setFontStatus(null));
  }, [settings.fontPath]);

  const addSignature = async () => {
    try {
      const path = await open({
        multiple: false,
        filters: [{ name: "SVG signature", extensions: ["svg"] }],
      });
      if (typeof path !== "string") return;
      const input = await invoke<string>("read_text_file", { path });
      const svg = sanitizeSvg(input);
      const suggested =
        path
          .split(/[\\/]/)
          .pop()
          ?.replace(/\.svg$/i, "") || "Signature";
      const name = window.prompt("Name this signature", suggested)?.trim();
      if (!name) return;
      await saveSignature(createId("signature"), name, svg);
      await refresh();
      setMessage(t.savedSignature);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Unable to import the SVG.",
      );
    }
  };
  const chooseFont = async () => {
    try {
      const path = await open({
        multiple: false,
        filters: [{ name: "Fonts", extensions: ["ttf", "otf"] }],
      });
      if (typeof path !== "string") return;
      const result = await invoke<FontValidation>("validate_font_path", {
        path,
      });
      if (!result.supportsThai)
        throw new Error(
          "This font does not contain the required Thai glyphs. Choose a Thai-capable font.",
        );
      await setSettings({ fontPath: path, fontName: result.name });
      setFontStatus(result);
      setMessage(t.selectedFont);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Unable to use this font.",
      );
    }
  };
  return (
    <main className="settings page">
      <div className="settings-content">
        <div className="settings-header">
          <div>
            <h1>{t.settings}</h1>
            <div className="document-meta">{t.settingsDescription}</div>
          </div>
        </div>
        {error && <p className="error-banner">{error}</p>}
        {message && <p className="notice">{message}</p>}
        <div className="settings-grid">
          <section className="settings-card">
            <h2>{t.signatureLibrary}</h2>
            <Button appearance="primary" onClick={addSignature}>
              {t.addSignature}
            </Button>
            <div className="signature-list" style={{ marginTop: 14 }}>
              {!signatures.length && (
                <p className="empty-copy">{t.noSignatures}</p>
              )}
              {signatures.map((signature) => (
                <div className="signature-item" key={signature.id}>
                  {signature.previewUrl ? (
                    <img
                      className="signature-preview"
                      src={signature.previewUrl}
                      alt={`Preview of ${signature.name}`}
                    />
                  ) : (
                    <div className="signature-preview" />
                  )}
                  <div>
                    <strong>{signature.name}</strong>
                    {signature.isDefault && (
                      <span className="status"> · {t.default}</span>
                    )}
                    <div className="signature-actions">
                      <Button
                        size="small"
                        onClick={async () => {
                          const name = window
                            .prompt(t.rename, signature.name)
                            ?.trim();
                          if (name) {
                            await renameSignature(signature.id, name);
                            await refresh();
                          }
                        }}
                      >
                        {t.rename}
                      </Button>
                      {!signature.isDefault && (
                        <Button
                          size="small"
                          onClick={async () => {
                            await setDefaultSignature(signature.id);
                            await refresh();
                          }}
                        >
                          {t.setDefault}
                        </Button>
                      )}
                      <Button
                        size="small"
                        onClick={async () => {
                          if (
                            window.confirm(`${t.delete} ${signature.name}?`)
                          ) {
                            await removeSignature(signature.id);
                            await refresh();
                          }
                        }}
                      >
                        {t.delete}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
          <CertificateManager signatures={signatures} />
          <section className="settings-card">
            <h2>{t.defaults}</h2>
            <div className="field">
              <label>{t.language}</label>
              <Select
                value={settings.language}
                onChange={(_, data) =>
                  setSettings({
                    language: data.value as typeof settings.language,
                  })
                }
              >
                <option value="en">English</option>
                <option value="th">ไทย</option>
              </Select>
            </div>
            <div className="field">
              <label>{t.theme}</label>
              <Select
                value={settings.theme}
                onChange={(_, data) =>
                  setSettings({ theme: data.value as typeof settings.theme })
                }
              >
                <option value="light">{t.light}</option>
                <option value="dark">{t.dark}</option>
                <option value="system">{t.system}</option>
              </Select>
            </div>
            <div className="field">
              <label>{t.defaultTemplate}</label>
              <Select
                value={settings.defaultTemplate}
                onChange={(_, data) =>
                  setSettings({
                    defaultTemplate:
                      data.value as typeof settings.defaultTemplate,
                  })
                }
              >
                <option value="classic-horizontal">
                  {t.classicHorizontal}
                </option>
                <option value="compact">{t.compact}</option>
                <option value="minimal-diagonal">{t.minimalDiagonal}</option>
              </Select>
            </div>
            <div className="field-row">
              <div className="field">
                <label>{t.textColor}</label>
                <Input
                  value={settings.defaultTextColor}
                  onChange={(_, data) =>
                    setSettings({ defaultTextColor: data.value })
                  }
                />
              </div>
              <input
                aria-label={t.textColor}
                type="color"
                value={settings.defaultTextColor}
                onChange={(event) =>
                  setSettings({ defaultTextColor: event.target.value })
                }
              />
            </div>
            <div className="field-row">
              <div className="field">
                <label>{t.lineColor}</label>
                <Input
                  value={settings.defaultLineColor}
                  onChange={(_, data) =>
                    setSettings({ defaultLineColor: data.value })
                  }
                />
              </div>
              <input
                aria-label={t.lineColor}
                type="color"
                value={settings.defaultLineColor}
                onChange={(event) =>
                  setSettings({ defaultLineColor: event.target.value })
                }
              />
            </div>
            <div className="field">
              <label>
                {t.defaultOpacity} ({Math.round(settings.defaultOpacity * 100)}
                %)
              </label>
              <Slider
                min={0.1}
                max={1}
                step={0.01}
                value={settings.defaultOpacity}
                onChange={(_, data) =>
                  setSettings({ defaultOpacity: data.value })
                }
              />
            </div>
            <div className="field">
              <label>{t.defaultRotation}</label>
              <Input
                type="number"
                value={String(settings.defaultRotation)}
                onChange={(_, data) =>
                  setSettings({ defaultRotation: Number(data.value) || 0 })
                }
              />
            </div>
            <div className="field">
              <label>{t.defaultDateFormat}</label>
              <Select
                value={settings.defaultDateFormat}
                onChange={(_, data) =>
                  setSettings({
                    defaultDateFormat:
                      data.value as typeof settings.defaultDateFormat,
                  })
                }
              >
                <option value="thai-long">10 สิงหาคม 2569</option>
                <option value="thai-numeric">10/08/2569</option>
                <option value="english-long">10 August 2026</option>
                <option value="iso">2026-08-10</option>
              </Select>
            </div>
          </section>
          <section className="settings-card">
            <h2>{t.thaiFont}</h2>
            <p className="empty-copy">{t.bundledFont}</p>
            <div className="field">
              <label>{t.currentFont}</label>
              <Input value={settings.fontName ?? t.embedded} readOnly />
            </div>
            <Button onClick={chooseFont}>{t.overrideFont}</Button>
            {fontStatus && (
              <p
                className={fontStatus.supportsThai ? "notice" : "error-banner"}
              >
                {fontStatus.name}:{" "}
                {fontStatus.supportsThai
                  ? "Thai glyphs supported"
                  : "Thai glyphs missing"}
              </p>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
