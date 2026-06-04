# AGENTS.md

## Purpose

This repository is the shared research hub for the Ramblue research system. Use it to collect source material, organize research questions, maintain reusable notes, and preserve evidence that can later support paper reviews or manuscript writing.

Related repositories:

- `Ramblue/research`: shared research materials, source maps, reading queues, datasets, and reusable notes.
- `Ramblue/review`: structured paper reviews, evidence extraction, critique, and comparison.
- `Ramblue/figure`: paper figures, diagrams, visual explanations, Figma assets, and image-generation workflows.
- `Ramblue/writing`: LaTeX manuscript drafting, venue templates, citation integration, strict review loops, and submission preparation.
- `Ramblue/presentation`: meeting decks, literature review decks, conference talks, posters, and speaker scripts.

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

Do not use this repository as the final home for polished paper reviews, figure assets, manuscript drafts, or presentation decks. Put those in `Ramblue/review`, `Ramblue/figure`, `Ramblue/writing`, and `Ramblue/presentation`.

## Project Orientation

Before making changes:

1. Identify the research topic, question, or source set being touched.
2. Check whether related work already exists in `Ramblue/review` or `Ramblue/writing`.
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

When a research note supports a review, link to the review file in `Ramblue/review`. When a note supports a figure, link to the figure spec in `Ramblue/figure`. When a note supports a manuscript, link to the writing file in `Ramblue/writing`. When a note supports a deck, talk, or poster, link to `Ramblue/presentation`.

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

## Agent Behavior

When acting as an AI research agent:

- Gather context before organizing or rewriting notes.
- Preserve source fidelity over stylistic polish.
- Ask for clarification only when the research target is ambiguous enough to change the output.
- Report what was added, what remains uncertain, and what should be reviewed next.
