# Professional Slides

`professional-slides` is a portable agent skill for building executive-grade, answer-first consulting decks in PowerPoint and Google Slides. It combines storylining, design systems, slide archetypes, chart standards, reusable components, platform implementation guidance, and rendered quality gates.

The project works with Codex and other `SKILL.md`-compatible coding agents, including Claude Code. It is independent and is not affiliated with or endorsed by McKinsey & Company. “McKinsey-style” describes concise, evidence-led executive consulting communication.

## Repository structure

```text
.
|-- SKILL.md
|-- src/
|-- evals/
|-- scripts/
`-- tests/
```

`SKILL.md` is the agent entrypoint. [`src/index.md`](src/index.md) explains the content ownership and reading order, including the deck-type blueprints under `src/templates/`. `evals/` owns deck review and effectiveness testing; `scripts/` and `tests/` contain deterministic repository utilities and checks.

## Use with Codex or Claude Code

Installing the skill means placing the complete `professional-slides` folder where the agent looks for skills. You do not run or compile this repository. Keep the folder intact because `SKILL.md` routes the agent to the supporting guidance under `src/` and `evals/`.

### 1. Find the repository path

Open Terminal on macOS or Linux, or PowerShell on Windows, move into the downloaded repository, and print its full path:

```bash
cd /path/to/professional-slides
pwd
```

```powershell
Set-Location "C:\path\to\professional-slides"
(Get-Location).Path
```

The result should end in `professional-slides`. Confirm that `SKILL.md` is directly inside it.

### 2. Choose where the skill should be available

Use a personal installation if you want the skill in every local project. Use a project installation if it should be visible only inside one project.

| Scope | Codex destination | Claude Code destination |
| --- | --- | --- |
| Personal | `$HOME/.agents/skills/professional-slides/` | `$HOME/.claude/skills/professional-slides/` |
| Project | `<project>/.agents/skills/professional-slides/` | `<project>/.claude/skills/professional-slides/` |

`$HOME` is your user folder. `<project>` is the root of the project in which you want to use the skill, not this repository.

### 3. Link the skill folder

A symbolic link or Windows junction keeps the installed skill connected to this repository, so local edits become available without copying the folder again.

On macOS or Linux, set `AGENT_SKILLS_DIR` to the destination for the agent and scope you selected above, then run:

```bash
SLIDES_SKILL="/absolute/path/to/professional-slides"
AGENT_SKILLS_DIR="$HOME/.agents/skills" # Codex personal installation
# AGENT_SKILLS_DIR="$HOME/.claude/skills" # Claude Code personal installation
mkdir -p "$AGENT_SKILLS_DIR"
ln -s "$SLIDES_SKILL" "$AGENT_SKILLS_DIR/professional-slides"
test -f "$AGENT_SKILLS_DIR/professional-slides/SKILL.md" && echo "Skill installed"
```

For a project installation, set `AGENT_SKILLS_DIR` to `<project>/.agents/skills` for Codex or `<project>/.claude/skills` for Claude Code.

On Windows PowerShell, set `$AgentSkillsDir` to the selected destination, then run:

```powershell
$SlidesSkill = "C:\absolute\path\to\professional-slides"
$AgentSkillsDir = "$HOME\.agents\skills" # Codex personal installation
# $AgentSkillsDir = "$HOME\.claude\skills" # Claude Code personal installation
New-Item -ItemType Directory -Force -Path $AgentSkillsDir | Out-Null
New-Item -ItemType Junction -Path "$AgentSkillsDir\professional-slides" -Target $SlidesSkill
Test-Path "$AgentSkillsDir\professional-slides\SKILL.md"
```

For a project installation, set `$AgentSkillsDir` to `<project>\.agents\skills` for Codex or `<project>\.claude\skills` for Claude Code.

If the destination already exists, inspect it instead of overwriting it. You may copy the complete repository instead of linking it, but a copied installation must be replaced manually when this repository changes. Avoid a nested path such as `professional-slides/professional-slides/SKILL.md`.

### 4. Verify discovery

Start the agent from the project where you want to work.

- In Codex, run `/skills` or type `$` in the prompt and confirm that `professional-slides` appears.
- In Claude Code, run `/skills` and confirm that `professional-slides` appears.

Restart the agent once if you created its top-level skills directory while it was already running.

### 5. Test the skill

Use an explicit invocation on the first run:

```text
$professional-slides Explain which parts of this skill you would use to plan a 10-slide market-entry deck. Do not create files yet.
```

In Claude Code, replace `$professional-slides` with `/professional-slides`. A successful response should route through storylining, design, relevant slide types and charts, components, the requested platform tools, and final rendered QA.

### 6. Request a deck

State the audience, decision, evidence constraints, delivery context, output format, and any authorized reference deck. For example:

```text
$professional-slides Create a due-diligence deck evaluating whether Company A should acquire Company B.

Audience: investment committee
Decision: proceed, pause, or reject the acquisition
Evidence: use only the attached materials and clearly label unresolved diligence questions
Delivery context: executive pre-read
Output: editable PowerPoint and native Google Slides, each rendered and checked separately
Reference: use the attached deck as visual evidence while preserving authorized assets only
```

Use `/professional-slides` instead of `$professional-slides` in Claude Code. Attach source files in the agent interface or provide readable local paths. Reference decks remain external and read-only unless inclusion is explicitly authorized.

### 7. Understand rendering and verification

`professional-slides` is an instruction skill, not a rendering plugin. Installing it makes the guide discoverable; the active agent still uses its own PowerPoint or Google Slides authoring and rendering tools to create the deck. Verify the output from the produced evidence, not from the skill merely appearing in `/skills`.

A complete deck request should produce:

- an editable `.pptx`, a native Google Slides URL, or both, according to the brief;
- a full render of every slide made from the final editable artifact;
- a montage for reviewing story and visual rhythm;
- a slide-by-slide inspection or QA ledger that records and repairs major defects;
- a concise note describing any platform, font, image, or editability limitation.

Ask the agent to open representative full-size renders and confirm title alignment, text wrapping, chart labels, sources, trackers, colours, and recommendation components. For dual-format work, require separate PowerPoint and native Google Slides renders because one platform's preview does not prove the other is correct.

The HTML examples inside the guide are structural specimens only. They help the model understand layout geometry and component state; they are not inserted into the deck, rendered as screenshots, or shown as PNG previews in Markdown.

## Troubleshooting

- If the skill is missing, verify that the installed path ends exactly in `professional-slides/SKILL.md`, then restart the agent once.
- If edits do not appear, confirm that the installation is a link; copied installations do not update automatically.
- If a link or junction already exists, inspect it instead of repeatedly creating or overwriting it.
- If the agent cannot read a reference deck, attach it in the interface or provide a local path the agent can access.
