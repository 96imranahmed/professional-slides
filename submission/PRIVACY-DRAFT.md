# Professional Slides privacy policy — draft for publisher review

**Status:** Draft. Confirm the publisher name and data flows before publishing this as the policy URL.

**Publisher:** [Verified publisher name]

**Effective date:** [Date of publication]

Professional Slides is a skill and local runtime for planning, building, and reviewing slide decks. This policy describes data handled by the plugin's own code. The AI service and any tools used to run the skill have their own privacy terms.

## Data the plugin handles

- Deck briefs, source files, slide plans, generated PowerPoint files, rendered pages, and build logs are read or written in the working directory selected for the task. The publisher does not operate a server that receives these files.
- Design preferences can be saved in `preferences.json` under `$PROFESSIONAL_SLIDES_HOME`, `$XDG_CONFIG_HOME/professional-slides`, or `~/.professional-slides`. A reference deck is represented in that file by a hash of its path rather than a copy of its content.
- The plugin code does not include publisher-run analytics or telemetry. The host AI service may process your prompts, files, and tool output under its own terms.

## External requests

When public material is requested and fetching is enabled, the runtime may send names, search descriptions, country codes, or indicator identifiers to Wikipedia, Wikimedia Commons, the World Bank, and Our World in Data. A map import utility can fetch pinned public Natural Earth data from GitHub. These requests may reveal the query and ordinary network metadata to those services. Their privacy policies govern their handling of that information. Use the build's `--no-fetch` option and provide local assets to avoid build-time public lookups.

An independent review can run through a locally installed Codex or Claude command-line tool. When that route is used, review prompts and deck material go to the tool's provider under that provider's terms. A local review packet is available when no reviewer CLI is used.

## Sharing, retention, and controls

The publisher does not receive or retain deck content or design preferences through the plugin's own code and does not sell that data. Local files remain until you delete them. You can inspect or clear saved preferences using `runtime/preferences.mjs`; delete deck files and logs from their working directory when no longer needed. External services and the host AI service have their own retention and deletion controls.

## Contact and changes

Privacy questions: [public support URL]. Material changes will be dated in the published policy.
