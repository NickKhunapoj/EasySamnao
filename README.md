![EasySamnao icon](src/assets/easysamnao-icon.png)

# EasySamnao

English | [ไทย](README.th.md)

EasySamnao is a local-only Windows desktop utility for applying editable Thai document-certification overlays to PDF and PNG documents. It is designed for sensitive identity documents: there is no backend, cloud sync, analytics, telemetry, CDN, or runtime network dependency.

## Screenshots

<img width="2560" height="1392" alt="Screenshot 2026-08-11 110224" src="https://github.com/user-attachments/assets/9925bff4-0e29-45f6-9b04-b20473804474" />

## Features

- Imports PDFs and PNGs through native file dialogs or drag and drop.
- Displays PDF pages with PDF.js and only lazily renders page thumbnails.
- Includes Classic Horizontal, Compact, and Minimal Diagonal editable templates.
- Uses a normalized position, width, and rotation model shared by preview and export.
- Supports drag, proportional resize, rotation, centre snapping/guides, keyboard nudging, and undo/redo.
- Supports distinct watermark layouts per page and copying a layout to selected/all pages.
- Supports Thai Buddhist Era dates: `10/08/2569` and `10 สิงหาคม 2569`, plus English and ISO formats.
- Imports, sanitizes, previews, renames, and locally stores SVG signatures.
- Exports PDFs without rasterizing the original PDF content; text/lines are drawn as PDF vectors and only SVG signatures may be rasterized.
- Exports one PNG per page at 150, 300, or 600 DPI-equivalent resolution.
- Embeds a user-selected Thai TTF/OTF into PDF output with `pdf-lib` and `fontkit`.

## Architecture

The desktop shell is Tauri 2 + Rust; the UI is React, TypeScript, Vite, Fluent UI, Zustand, PDF.js, and React Konva. Tauri was chosen for its small native footprint, Rust-side Windows APIs, and a local-only architecture without an Electron/Node backend.

Core folders:

| Folder | Responsibility |
| --- | --- |
| `src/pages` | Create Copy and Settings screens |
| `src/state` | Zustand settings, document, watermark history/state |
| `src/templates` | Template definitions and platform-neutral element plans |
| `src/editor` | Konva transformable group editor |
| `src/documents` | Native import and PDF.js render logic |
| `src/export` | Vector PDF and high-DPI PNG output |
| `src/signatures` | Browser-side SVG sanitation/storage bridge |
| `src-tauri/src` | Local commands, font inspection, DPAPI storage |

The template plan is a list of editable lines, text items, and a signature box. It is rendered by Konva for preview, Canvas for PNG export, and pdf-lib for PDF export; it is never stored as a flattened watermark image.

## Preview and coordinate model

The document preview pipeline is:

`original PDF → PDF.js canvas → transparent React Konva overlay`

`WatermarkTransform` uses fractions of the page (`x`, `y`, and `width`) with an editor rotation. `x`/`y` identify the group centre. The explicit conversion in `src/utils/coordinates.ts` flips browser top-left Y to PDF bottom-left Y and reverses rotation direction. Therefore zoom, device pixel ratio, source resolution, and PNG DPI do not alter final placement.

## PDF and PNG export

For a source PDF, `pdf-lib` loads the original bytes and appends drawing commands to each page—there is no page screenshot or document rasterization. A selected Thai font is embedded with `fontkit`; text and horizontal rules remain vectors. Sanitized SVGs are source data; the implementation rasterizes only a signature to a transparent, high-resolution PNG for PDF compatibility.

PNG export renders the original PDF page with PDF.js at the requested DPI and composites the same template plan. Multiple pages are saved as `filename-easysamnao-page-001.png`, etc.; a multi-page PNG is never invented.

## Signatures, fonts, and privacy

SVG imports pass through a graphics-only sanitizer. It retains safe shape tags/attributes and removes scripts, event handlers, `foreignObject`, images, external resources, JavaScript/file URLs, `<use>`, and all unknown elements. Sanitized payloads are encrypted using Windows DPAPI before being written below the standard per-user Tauri application-data directory. Metadata and settings remain ordinary local JSON. Signature bytes are decrypted only into process memory when previewing/exporting.

The app checks a selected TTF/OTF for the Thai glyphs needed by the template. It searches `C:\Windows\Fonts` for TH Sarabun New on first launch; if unavailable, select another Thai-capable local font in Settings. Font files are never downloaded at runtime.

The application UI bundles Manrope and Noto Sans Thai under the SIL Open Font License 1.1; their license notices are included at `src/assets/Manrope-OFL.txt` and `src/assets/NotoSansThai-OFL.txt`.

The capability file grants only core window, native dialog, and explicit opener permissions. File reads/writes are implemented in Rust commands that accept only the expected document/font/signature extensions. The CSP denies `connect-src`, so the UI cannot make network requests.

## License

EasySamnao is source-available, not OSI open source, under the [PolyForm Noncommercial License 1.0.0](LICENSE). Use is governed by the official [LICENSE.md](LICENSE.md), also available from the [PolyForm Project](https://polyformproject.org/licenses/noncommercial/1.0.0). Commercial use is not licensed, and no separate commercial license is currently offered. See [Commercial Use Information](COMMERCIAL-USE.md).

## Development setup

Prerequisites on Windows:

- Node.js 20+ (the project was authored with Node 22)
- Rust stable with the MSVC toolchain (`rustup toolchain install stable-x86_64-pc-windows-msvc`)
- Microsoft C++ Build Tools and WebView2 Runtime, as required by Tauri

```powershell
npm install
npm run dev
```

For the desktop application:

```powershell
npm run tauri dev
```

## Testing

```powershell
npm run test
cargo test --manifest-path src-tauri/Cargo.toml
```

The Vitest suite covers coordinate/rotation conversion, Thai dates, template composition/defaults, wrapping, colour parsing, page-specific layout copying, undo/redo, SVG sanitizer rules, and programmatic vector PDF output. Rust tests cover safe storage identifiers, expected file extensions, and DPAPI encryption/decryption on Windows.

## Production installer

```powershell
npm run tauri build
```

Tauri outputs installers below `src-tauri\target\release\bundle\nsis\` and `src-tauri\target\release\bundle\msi\` (Wix/MSI), depending on which Windows bundle tools are installed. The NSIS target is configured for per-user installation and does not require administrator privileges.

## Known limitations

- A Thai-capable local TTF/OTF is required before PDF export; this prevents invalid Thai output from a non-Thai built-in PDF font.
- SVGs are deliberately limited to safe primitive graphics. Complex filters, fonts, embedded images, and external references are removed.
- PDF page annotation/form preservation is delegated to pdf-lib and may be limited for unusual encrypted, malformed, or heavily interactive source PDFs; password-protected PDFs are rejected with a clear error.
