# Security Policy

## Supported versions

| Version | Supported |
| --- | --- |
| latest release | ✅ |
| older releases | ❌ (please update) |

## Reporting a vulnerability

We take security seriously. If you discover a vulnerability in NormaFlow, please
**do not open a public GitHub issue**.

Instead, report it privately via
[GitHub private vulnerability reporting](https://github.com/miskatul-anwar/normaflow/security/advisories/new)
or email **miskatul.anwar.csecu@gmail.com** with:

1. A description of the vulnerability and its impact
2. Step-by-step reproduction instructions or a PoC
3. Affected version(s) and platform(s)
4. Any suggested mitigation

You will receive an acknowledgment within **72 hours**. We aim to triage within a
week and will keep you informed throughout the fix and disclosure process.
Credit is given to reporters unless anonymity is requested.

## Scope notes

NormaFlow processes files entirely locally. Areas of particular interest:

- The Tauri IPC surface (`src-tauri/src/*.rs` commands) — input validation on file contents passed from the WebView
- The Ollama HTTP client — SSRF/URL handling (`OLLAMA_HOST` configuration)
- Workflow state import/export (`*.json` files loaded into the app)
- CSP and capability configuration in `src-tauri/tauri.conf.json`

## Known design boundaries

- The app intentionally talks to `http://localhost:11434` (Ollama). Changing this host via `OLLAMA_HOST` sends data wherever that host points — users should treat non-local endpoints as untrusted.
- CSV parsing is bound-checked, but extremely large/malformed files can exhaust memory; the app is designed for typical tabular datasets rather than adversarial inputs.
