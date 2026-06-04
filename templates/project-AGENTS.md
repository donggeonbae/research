# AGENTS.md

## Purpose

This file defines the working rules for AI coding agents contributing to this repository. It extends the shared baseline with project-specific details.

## Project Overview

TODO: Describe what this project does, who uses it, and what kind of system it is.

## Project Orientation

Before making changes:

1. Read the relevant README, package/config files, and nearby source files.
2. Identify the project's framework, language, test setup, and existing conventions.
3. Prefer existing patterns over introducing new architecture.
4. Keep changes scoped to the requested task.

## Repository Structure

TODO: Replace these examples with the actual project structure.

- `src/`: Application or library source code.
- `tests/`: Test files.
- `docs/`: Documentation.
- `scripts/`: Utility scripts.
- `public/` or `assets/`: Static assets.
- `config files`: Build, lint, format, and tooling configuration.

## Common Commands

TODO: Replace these examples with commands that actually exist in this project.

```sh
npm test
npm run lint
npm run build
```

## Working Principles

- Make the smallest useful change that fully solves the task.
- Preserve existing behavior unless the task explicitly requires changing it.
- Do not perform broad refactors unless they are necessary.
- Avoid adding dependencies unless there is a clear benefit.
- Prefer readable, maintainable code over cleverness.
- Keep naming consistent with the surrounding code.
- Do not remove comments, tests, or safeguards unless they are incorrect or obsolete.

## Code Style

Follow the repository's existing style. If formatters or linters are configured, use them.

General defaults:

- Use clear names for variables, functions, components, and files.
- Keep functions focused and reasonably small.
- Add comments only when they clarify non-obvious logic.
- Avoid dead code, unused exports, and unnecessary abstraction.
- Do not reformat unrelated files.

## Testing and Verification

After changes, run the most relevant available checks. Only run commands that exist for the project. If checks cannot be run, explain why.

## Git and Changes

- Do not overwrite user changes.
- Do not use destructive Git commands unless explicitly requested.
- Keep commits focused when commits are requested.
- Do not commit generated files unless the project normally tracks them.
- Avoid unrelated cleanup.

## Secrets and Security

- Never commit secrets, tokens, passwords, private keys, or `.env` files.
- Do not print secrets in logs or responses.
- Treat credentials, production URLs, customer data, and private configuration as sensitive.
- If a change touches authentication, authorization, payments, data deletion, or privacy-sensitive logic, be extra conservative and verify carefully.

## Dependencies

Before adding a dependency:

1. Check whether the project already has a suitable utility or package.
2. Prefer standard library or existing dependencies when reasonable.
3. Add a new dependency only when it meaningfully improves correctness, maintainability, or user experience.
4. Update lockfiles consistently.

## Documentation

Update documentation when behavior, setup, commands, environment variables, or public APIs change.

Good places to update:

- README
- docs files
- inline usage examples
- configuration comments
- changelog, if the project uses one

## Frontend Guidelines

When working on UI:

- Match the existing design system and component patterns.
- Preserve responsive behavior.
- Avoid layout shifts and text overflow.
- Use accessible labels, semantic HTML, and keyboard-friendly interactions.
- Prefer existing components over custom one-off UI.
- Verify important views in a browser when possible.

## Backend Guidelines

When working on backend code:

- Validate inputs at boundaries.
- Handle errors explicitly.
- Preserve API compatibility unless instructed otherwise.
- Keep database migrations reversible when the project expects that.
- Avoid leaking internal errors or sensitive data.
- Consider concurrency, idempotency, and transaction boundaries where relevant.

## Performance

Do not optimize prematurely, but avoid obviously inefficient changes.

Pay attention to:

- repeated database queries
- unnecessary network calls
- large bundle additions
- blocking synchronous work
- unbounded loops or memory growth

## Agent Behavior

When acting as an AI coding agent:

- Be proactive, but stay within the requested scope.
- Ask questions only when needed to avoid a risky assumption.
- Explain important tradeoffs briefly.
- Report what changed and how it was verified.
- If blocked, describe the blocker and the next best step.
