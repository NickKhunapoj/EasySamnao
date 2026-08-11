# EasySamnao architecture

## Import and preview

```mermaid
flowchart LR
  A["User-selected PDF or PNG"] --> B["Tauri Rust file command"]
  B --> C{"Document type"}
  C -->|PDF| D["PDF.js"]
  C -->|PNG| E["Browser image canvas"]
  D --> F["Rendered page canvas"]
  E --> F
  F --> G["React Konva transparent overlay"]
  H["Zustand normalized watermark instance"] --> G
```

The imported bytes remain in memory only. The app does not copy source documents into application data or persist them on shutdown.

## Template and editor model

```mermaid
flowchart TD
  A["WatermarkInstance"] --> B["Template planner"]
  B --> C["Text / line / signature element plan"]
  C --> D["Konva preview"]
  C --> E["PDF staging renderer"]
  C --> F["Canvas PNG renderer"]
  A --> G["Normalized transform: x/y/width/rotation"]
  G --> D
  G --> E
  G --> F
```

The planner has no React or PDF dependency. This keeps visual composition consistent while allowing each output medium to use its own renderer.

## Export

```mermaid
flowchart LR
  A["Original PDF"] --> D["pdf-lib"]
  B["Watermark model"] --> D
  C["Embedded Thai font + decrypted safe signature"] --> D
  D --> E["EasySamnao PDF"]
```

PDF export preserves pages without watermarks. Unsigned watermarked pages are staged with their watermark, rendered at 300 DPI, and embedded as one image in the final PDF. Digitally signed exports keep their watermark vector-based and sign it after all visual edits complete, which provides tamper evidence without rasterizing the page. Exports open without a password. PNG output deliberately renders the page at the chosen resolution, then overlays the plan.

## Local security boundary

```mermaid
flowchart LR
  A["Imported SVG"] --> B["Browser SVG sanitizer"]
  B --> C["Rust DPAPI encrypt"]
  C --> D["Per-user app-data signature payload"]
  D --> E["Rust DPAPI decrypt to memory"]
  E --> F["Preview / export only"]
```

Metadata/settings are local JSON. Raw signature content is not stored as plaintext. CSP blocks network connections, and no backend or telemetry code is present.
