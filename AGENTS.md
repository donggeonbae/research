# AGENTS.md

## Purpose

This repository is the shared research hub for the donggeonbae research system. Use it to collect source material, organize research questions, maintain reusable notes, and preserve evidence that can later support paper reviews or manuscript writing.

Related repositories:

- `donggeonbae/research`: shared research materials, source maps, reading queues, datasets, and reusable notes.
- `donggeonbae/review`: structured paper reviews, evidence extraction, critique, and comparison.
- `donggeonbae/figure`: paper figures, diagrams, visual explanations, Figma assets, and image-generation workflows.
- `donggeonbae/writing`: LaTeX manuscript drafting, venue templates, citation integration, strict review loops, and submission preparation.
- `donggeonbae/presentation`: meeting decks, literature review decks, conference talks, posters, and speaker scripts.

## Repository Role

Use this repository for:

- literature maps
- source bibliographies
- topic briefs
- dataset notes
- method notes
- reusable definitions
- research question tracking
- links to reviews and manuscripts in sibling repositories

Do not use this repository as the final home for polished paper reviews, figure assets, manuscript drafts, or presentation decks. Put those in `donggeonbae/review`, `donggeonbae/figure`, `donggeonbae/writing`, and `donggeonbae/presentation`.

## Project Orientation

Before making changes:

1. Identify the research topic, question, or source set being touched.
2. Check whether related work already exists in `donggeonbae/review` or `donggeonbae/writing`.
3. Preserve source traceability: every claim, summary, or extracted fact should point back to a source.
4. Prefer structured notes over loose prose when information will be reused.

## Recommended Structure

- `topics/`: Topic-level research maps and open questions.
- `sources/`: Source metadata, bibliographies, and reading queues.
- `notes/`: Reusable concept notes, method notes, and evidence summaries.
- `datasets/`: Dataset descriptions, provenance notes, and usage constraints.
- `docs/`: Cross-repository workflow and repository documentation.
- `templates/`: Reusable note templates.
- `scripts/`: Small maintenance or export scripts.

Update this structure if the repository develops a more specific convention.

## Source and Evidence Rules

- Do not present unsupported claims as established facts.
- Keep bibliographic information close to the note that depends on it.
- Record DOI, arXiv ID, URL, venue, year, and access date when available.
- Mark uncertainty explicitly with labels such as `unclear`, `needs verification`, or `inference`.
- When summarizing a paper, distinguish the authors' claim from your interpretation.
- Avoid long verbatim excerpts. Use short quotes only when the exact wording matters.

## Cross-Repository Interaction

Use stable research IDs to connect materials across repositories.

Recommended ID format:

```text
topic-slug/YYYY/source-slug
```

Examples:

```text
diffusion-policy/2023/chi-diffusion-policy
clinical-ai/2024/foundation-models-ehr
```

When a research note supports a review, link to the review file in `donggeonbae/review`. When a note supports a figure, link to the figure spec in `donggeonbae/figure`. When a note supports a manuscript, link to the writing file in `donggeonbae/writing`. When a note supports a deck, talk, or poster, link to `donggeonbae/presentation`.

Prefer relative links when repositories are checked out under the same parent directory:

```md
Related review: ../review/reviews/topic-slug/source-slug.md
Related figure: ../figure/figures/project-slug/figure-id/spec.md
Related manuscript: ../writing/manuscripts/project-slug/draft.md
Related presentation: ../presentation/conference-talk/project-slug/talk.md
```

## Writing Style

- Be precise, compact, and source-grounded.
- Prefer bullets, tables, and structured sections for reusable research notes.
- Keep speculation separate from evidence.
- Use English for repository content unless a source or target publication requires another language.

## Quality Checklist

Before finishing research work, verify:

- the core source metadata is present
- claims are linked to sources
- uncertainty is labeled
- related review or writing artifacts are linked when relevant
- filenames are stable, lowercase, and descriptive

## Static HTML Archive Framework

This repository follows the source-derived encrypted static HTML archive pattern adapted from `Lukael/research`.

Framework files:

- `index.html`: public archive index.
- `styles/site.css`: shared dark archive styling.
- `scripts/site.js`: discovers `projects/<slug>/` folders through the GitHub Contents API or local directory listing.
- `scripts/decrypt-report.js`: unlocks `projects/<slug>/report.enc` in the browser using Web Crypto.
- `scripts/encrypt-report.js`: encrypts plaintext HTML into `report.enc` using `REPORT_PASSWORD`.
- `scripts/build-markdown-report.js`: builds a project unlock shell and optional encrypted report from Markdown.
- `scripts/build-3dgs-ri-report.js`: source-derived example builder kept for reference; prefer `build-markdown-report.js` for new work.
- `templates/unlock-template.html`: public password unlock shell.
- `templates/report-template.html`: dark two-column encrypted report body template.
- `projects/<slug>/`: public unlock shell plus encrypted payload for each protected report.

Do not commit plaintext protected report bodies under `projects/`. Use `build/` for transient plaintext output and keep encrypted payloads in `projects/<slug>/report.enc` when a report should be published.
## Agent Behavior

When acting as an AI research agent:

- Gather context before organizing or rewriting notes.
- Preserve source fidelity over stylistic polish.
- Ask for clarification only when the research target is ambiguous enough to change the output.
- Report what was added, what remains uncertain, and what should be reviewed next.



