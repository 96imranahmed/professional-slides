# Distribution and public submission

The repository README is the canonical getting-started guide and the owner of all user flow examples. The npm package and local plugin include it unchanged. The public submission builder uses the same README, removing only its developer packaging section so the upload does not link to omitted evaluation tools.

Run `npm run package:plugin` for a local plugin, `npm pack` for npm, and `npm run package:submission` for the separate skills-only upload. All three use the same source version and root policy documents. The root file and npm glob contracts live in `distribution.json`; evaluation tools, generated output, logs and dependencies remain outside the runtime package.

Public submission still validates manifests, file hashes and archive integrity and rejects app/server bindings. The submission includes the public CLI, its runtime dependencies, `PRIVACY.md`, `TERMS.md` and `LICENSE`. It does not require a rewritten skill prompt or a repository checkout at runtime.

Packaging is not publication. An npm tarball is tested with `npm exec --package /absolute/path/to/professional-slides-0.0.2.tgz -- professional-slides setup --agent codex`; a public release additionally requires registry authentication and publication. Plugin-directory submission remains its own publisher workflow.
