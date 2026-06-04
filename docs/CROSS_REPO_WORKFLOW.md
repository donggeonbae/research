# Cross-Repository Workflow

The donggeonbae research system uses five repositories with distinct roles.

## Repositories

- `donggeonbae/research`: shared source material, research maps, reusable notes, and evidence.
- `donggeonbae/review`: structured paper reviews and comparative critique.
- `donggeonbae/figure`: paper figures, diagrams, visual explanations, Figma assets, and image-generation workflows.
- `donggeonbae/writing`: LaTeX manuscript drafts, venue templates, citation integration, strict review loops, and submission materials.
- `donggeonbae/presentation`: meeting decks, literature review decks, conference talks, posters, and speaker scripts.

## Flow

1. Collect source metadata and reusable notes in `research`.
2. Turn individual sources or clusters into reviews in `review`.
3. Turn visual evidence, conceptual diagrams, and figure plans into assets in `figure`.
4. Promote reviewed evidence and figure outputs into manuscript outlines and drafts in `writing`.
5. Convert manuscript, review, and figure material into talks, posters, or meeting decks in `presentation`.
6. Link backward from `writing` and `presentation` to the supporting reviews, source notes, and figure specs.

## Shared ID Format

Use the same ID across all repositories:

```text
topic-slug/YYYY/source-slug
```

## Link Convention

When the repositories are checked out under the same parent directory:

```md
Source note: ../research/sources/topic-slug/source-slug.md
Review: ../review/reviews/topic-slug/source-slug.md
Figure: ../figure/figures/project-slug/figure-id/spec.md
Manuscript: ../writing/manuscripts/project-slug/draft.md
Presentation: ../presentation/conference-talk/project-slug/talk.md
```

## Promotion Rules

- A source note can be promoted to a review when metadata and key claims are clear.
- A review can be promoted to writing when it contains enough critique, evidence, and relevance notes.
- A figure can be promoted to writing when its source, purpose, caption, and permissions are clear.
- A manuscript claim should link back to a review, source note, internal result, or figure spec.
- A presentation slide should link back to a manuscript section, review, source note, or figure spec when it makes a substantive claim.


