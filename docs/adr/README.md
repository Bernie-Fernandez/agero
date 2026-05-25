# Agero ERP — Architecture Decision Records

This folder contains the architectural decision records (ADRs) for the Agero ERP build. Each ADR documents a significant decision that affects the shape of the system, the cost of future changes, or the boundaries with external systems.

ADRs are durable. They explain **why** the system is the way it is. Future Claude Code sessions, future contributors, and future-Bernie can read them to reconstruct the reasoning behind any structural choice.

When making a new architectural decision: read the relevant existing ADRs first. Then either align with them, or write a new ADR superseding the old one with explicit reasoning.

---

## Index

| # | Title | Status | Date |
|---|---|---|---|
| [0001](./ADR-0001-erp-as-analytical-layer.md) | ERP as Analytical Layer on Top of CAT Cloud and Xero | Accepted | 2026-05-25 |

---

## Status legend

- **Proposed** — drafted but not yet committed to. Bernie has not approved.
- **Accepted** — committed to. The decision is in force.
- **Deprecated** — no longer in force, but no replacement has been recorded.
- **Superseded by ADR-XXXX** — replaced by a newer decision. Cross-link.

ADRs are never deleted. Superseded ones remain in the index as history.

---

## How to write a new ADR

Use the format in any existing ADR. Sections required:

1. **Context** — what problem this addresses, what forces are at play
2. **Decision** — what we decided
3. **Alternatives Considered** — what else was on the table and why rejected
4. **Consequences** — positive, negative, and what would force a revisit
5. **Related ADRs** — cross-links

File naming: `ADR-NNNN-short-kebab-title.md`. Increment N from the last ADR in the index.

Always update this README index when adding a new ADR.
