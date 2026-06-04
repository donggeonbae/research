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
