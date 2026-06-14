# research

Reusable baseline instructions for AI coding agents.

This repository is intended to be a small personal source of truth for `AGENTS.md` files. Copy the baseline into each project, then customize the project-specific sections.

## Files

- `AGENTS.md`: Default baseline for most repositories.
- `templates/project-AGENTS.md`: Same baseline with explicit placeholders for project-specific notes.
- `scripts/install-agents.ps1`: Copies a template into a target project.

## Usage

Copy the default baseline manually:

```powershell
Copy-Item .\AGENTS.md C:\path\to\project\AGENTS.md
```

Or use the installer:

```powershell
.\scripts\install-agents.ps1 -ProjectPath C:\path\to\project
```

Use the customizable template instead:

```powershell
.\scripts\install-agents.ps1 -ProjectPath C:\path\to\project -Template .\templates\project-AGENTS.md
```

## Customization Checklist

For each project, update:

- project overview
- repository structure
- common commands
- framework-specific rules
- security or deployment notes

Keep the shared baseline conservative. Put unusual rules in the target project's own `AGENTS.md`.


## HTML Archive Framework

This repository includes the encrypted static HTML archive framework adapted from `Lukael/research`.

Typical report flow:

```powershell
$env:REPORT_PASSWORD="<local secret>"
node scripts/build-markdown-report.js --slug example-report --input path\to\report.md --title "Example Report"
```

The command creates `projects/<slug>/index.html` and, when `REPORT_PASSWORD` is set, `projects/<slug>/report.enc`. The transient plaintext HTML is written under `build/` and should not be committed.

Markdown reports render LaTeX math through the local KaTeX bundle under `scripts/vendor/katex/`. Use `$...$` or `\(...\)` for inline math and `$$...$$` or `\[...\]` for display math. Fenced code blocks remain literal and are not math-rendered.
