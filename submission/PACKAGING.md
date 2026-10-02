# Skills-only public upload

`plugin.json` is the source-controlled portable submission manifest. The Codex
compatibility listing is synchronized; all manifests retain version `0.0.1`.
`publication.release_notes` and verified website/support links are included.
Published privacy/terms links and confirmed publisher, country targeting and
commerce declarations still need input. Unknown values stay absent. A prepared
archive is not ready for submission until these required facts are resolved.

From the repository root:

```bash
python3 evals/scripts/package_submission.py --output /tmp/professional-slides-submission
python3 -c "import sys; from pathlib import Path; sys.path.insert(0, 'evals/scripts'); from package_submission import verify; assert not verify(Path('/tmp/professional-slides-submission/professional-slides'))"
python3 -m unittest discover -s evals/tests -p test_submission_package.py
```

The generator uses the distribution allowlist, stages a separate copy, replaces
its development README with `submission/README-DISTRIBUTION.md`, adjusts the
dependency-install command for the skill directory, rejects app/server bindings,
checks listing lengths and manifest parity, regenerates the file-hash inventory,
and inspects the ZIP. It writes generated files only under the output directory.
The original source and private bindings are preserved. ZIPs and generated
inventories are build outputs; do not commit them.

Retain the skill's executable runtime, requirements, references, examples and
assets: skills-only means no hosted server or connected app, not instructions
without their local tools. No MCP review cases, demo recording or credentials
are required. JSON-schema and portal validation are separate from these local
checks; a successful package build does not certify complete deck behavior or
review approval.

## Source versus prepared Library archive

This commit packages the committed runtime. The previously delivered Library
archive used the newer, uncommitted working-tree runtime; its exact contents
cannot be regenerated from this commit alone. Those runtime revisions remain
local and are outside this manifest PR. The committed listing and distribution
README retain the committed workflow, without claiming its newer environment
checker, explicit existing-deck importer, competitive-position template or blind
confirmation review. Version remains 0.0.1 under the existing fixed-version
instruction. No public published release was established during preparation.
