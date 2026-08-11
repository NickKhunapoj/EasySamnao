# Contributing to EasySamnao

Contributions are welcome. EasySamnao is a source-available Windows desktop application for applying editable Thai document-certification overlays to PDF and PNG files. Please keep contributions practical, focused, and mindful of the project's privacy-sensitive use case.

## Before You Start

- Read the [README](README.md) and [architecture notes](docs/ARCHITECTURE.md).
- Review the project's [PolyForm Noncommercial License 1.0.0](LICENSE.md) and [Commercial Use Information](COMMERCIAL-USE.md). The license file is the governing text.
- Submit only code, dependencies, fonts, icons, images, documents, and other assets that you have permission to contribute.

## Development Setup

EasySamnao is a Tauri 2 application with a React, TypeScript, and Vite frontend and a Rust backend. The documented development environment is Windows with:

- Node.js 20 or later (the project and CI use Node.js 22);
- Rust stable with the MSVC toolchain (`rustup toolchain install stable-x86_64-pc-windows-msvc`); and
- Microsoft C++ Build Tools and WebView2 Runtime, as required by Tauri.

After cloning your fork, install dependencies:

```powershell
npm install
```

Start the frontend development server with:

```powershell
npm run dev
```

Start the desktop application with:

```powershell
npm run tauri dev
```

No project-specific environment configuration is documented in this repository.

## Contribution Workflow

1. Fork the repository and clone your fork.
2. Create a focused branch. No branch-naming policy is documented; use a simple descriptive name.
3. Make the change and keep it limited to the task at hand.
4. Run the validation appropriate to the files you changed.
5. Commit and push the branch to your fork.
6. Open a pull request against `main`, the branch targeted by the repository's pull-request workflow.

## What Makes a Good Contribution

- Keep changes small and reviewable; avoid unrelated refactors.
- Preserve existing behavior unless the change intentionally alters it, and explain that change in the pull request.
- Follow the existing TypeScript/React and Rust structure. In particular, keep the shared watermark plan independent of React and PDF rendering as described in the architecture notes.
- Update documentation when behavior, setup, or user-visible functionality changes.
- Add or update tests when they cover the change.
- Do not commit secrets, credentials, generated build artifacts, local configuration, or unrelated files.

## Testing and Validation

Choose checks that match your change:

```powershell
# Frontend unit tests
npm run test

# Type checking and production frontend build
npm run build

# Rust tests
cargo test --manifest-path src-tauri/Cargo.toml
```

For changes affecting the desktop application or native behavior, also exercise the affected flow with `npm run tauri dev`. For installer or packaging changes, the documented production build command is:

```powershell
npm run tauri build
```

The GitHub Actions pull-request workflow currently installs dependencies with `npm ci` and runs `npm run build`. The repository provides `npm run format`, which runs Prettier with `--write`; no read-only formatting or lint command is configured.

## Pull Requests

Use a clear title and include a short summary, the reason for the change, and the validation you performed. Include screenshots for UI changes when useful, and call out known limitations or follow-up work. Small, focused pull requests are easier to review.

## Issues and Bug Reports

Describe what happened, what you expected, and the steps to reproduce the problem. Include relevant Windows, Node.js, Rust, and application-version details, plus screenshots or logs when useful. Do not include secrets, real signatures, or personal documents. No issue templates are currently configured.

## Licensing of Contributions

By submitting a contribution, you confirm that you have the right to submit it. Accepted contributions become part of EasySamnao and are distributed as part of the project under the project's applicable licensing terms. Review [LICENSE.md](LICENSE.md) before submitting code, and do not introduce material whose license conflicts with the project's licensing model.

## Third-Party Dependencies and Assets

Avoid introducing dependencies, fonts, icons, images, code, or other assets without verified permission for their inclusion and distribution with EasySamnao. Clearly identify unusual or restrictive licenses. Take particular care with bundled fonts, SVGs, icons, sample documents, and signature-related assets; existing bundled fonts include their license notices in `src/assets`.

## Security and Privacy

Never commit real signatures, personal documents, secrets, credentials, or locally stored application data. Use synthetic documents and test data for examples and tests. For security-sensitive issues, avoid publishing exploitable details in a normal public issue; the repository does not document a separate security contact.
