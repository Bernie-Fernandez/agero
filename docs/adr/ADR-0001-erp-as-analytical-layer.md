# ADR-0001 — ERP as Analytical Layer on Top of CAT Cloud and Xero

**Status:** Accepted
**Date:** 2026-05-25
**Deciders:** Bernie Fernandez (Director)
**Workstream:** ERP (Cross-cutting — affects every future sprint)

---

## Context

The Agero ERP build began with an implicit assumption that it would eventually replace CAT Cloud (the project control software) and integrate tightly with Xero (the general ledger). Sprints 1 through A.3 have built foundational capability: CRM, Finance reporting, Estimating module, User Management, HubSpot sync, Module Visibility.

After completing Hemank's bookkeeper SOP (24 May 2026), it became clear that CAT Cloud's role in Agero is more extensive and more deeply embedded than a feature-by-feature replacement strategy can accommodate quickly. CAT Cloud holds:

- Project foundations (contract value, retention terms, attached documents, assigned team)
- Subcontract setup and contract management
- Two-step approval (Approval A + Approval B) workflow for subcontractor and supplier invoices
- Progress claims (subcontractor side and client side)
- Purchase orders with attached PDFs
- Retention tracking on both client and subcontractor sides
- Committed cost schedule and project budget at cost-code level
- Project team timesheets
- Project Financial Combined reporting
- Subcontractor insurance certificate storage
- Practical Completion and Defects Liability Period events

Replacing all of this is at minimum a multi-year project. Meanwhile, Hemank's monthly close process and the management report depend on CAT Cloud being current and accurate. Bernie's stated goal (25 May 2026) is to make the management report *perfect* — and the management report's inputs come from CAT Cloud and Xero, both of which remain operationally healthy.

Forces at play:

- The current management report works (with manual effort) but takes Hemank's full attention monthly
- CAT Cloud is paid for, operational, and the project team is fluent in it
- Xero is the source of truth for the general ledger and is not going anywhere
- The ERP's highest-value early wins are in analytical / forecasting work that *neither* CAT Cloud nor Xero do well: cash flow forecasting, probability-weighted unsecured pipeline, automated management report assembly, WIP journal calculation
- Trying to replicate CAT Cloud's features in the ERP before they are needed for cutover risks building unused infrastructure and slowing down higher-value work

Constraints:

- Hemank is the bookkeeper today. Anything that disrupts his close process is high-cost.
- Bernie is the sole maintainer of the ERP. Sprint capacity is finite.
- Sprints already in flight (CRM, Finance reporting) must continue to work.
- A future CAT Cloud cutover will happen, but probably 12–18 months out at the earliest.

## Decision

For the foreseeable future (no earlier than 12–18 months from this ADR date), the Agero ERP is positioned as an **analytical and reporting layer on top of CAT Cloud and Xero**, not as a replacement for either system.

The ERP's responsibilities are:

1. **Ingest data** from CAT Cloud (via CSV upload from Project Financial Combined and other exports) and from Xero (via OAuth API).
2. **Perform calculations and analytical work** that neither source system does: WIP journal calculation, awarded/backlogged categorisation, contract value reconciliation, variance analysis, full-year forecasting.
3. **Own forecasting** that neither source system provides: probability-weighted unsecured pipeline, cash flow forecast (receivables timing, payables timing, wages, ATO, bills to approve), business outlook.
4. **Produce the management report** as the primary monthly output, replacing Hemank's Excel-and-PDF workflow.
5. **Push to Xero** only for the specific operations Hemank already pushes to Xero manually (most notably the monthly WIP adjustment journal). All other Xero data flows are read-only from Xero into the ERP.
6. **Reflect CAT Cloud state** in read-only views where it adds value (project status, retention positions, insurance expiry) — but never own this data, never modify it.

CAT Cloud remains the source of truth for project operations until a planned and deliberate cutover sprint.

## Alternatives Considered

- **Option A — Replace CAT Cloud feature-by-feature, immediately.** Build subcontract management, two-step approval, retention model, purchase orders, timesheets, and so on within the ERP, then progressively wind down CAT Cloud. **Rejected because:** the work to replace CAT Cloud's full functional surface is multi-year, the disruption risk to Hemank's process is high, and it deprioritises the analytical work that delivers near-term value. It also assumes a CAT Cloud replacement should be the priority, which Bernie has explicitly de-prioritised.

- **Option B — Fully duplicate CAT Cloud in the ERP as a parallel system, then cut over later.** Build the ERP's project control module in parallel with CAT Cloud being used, then switch when ready. **Rejected because:** double data entry is unsustainable, and the parallel system is built without the daily operational pressure that surfaces edge cases. Likely results in a feature-complete but operationally broken system at cutover.

- **Option C (chosen) — ERP as analytical layer on top.** Treat CAT Cloud and Xero as durable, accepted systems. Build the ERP to consume their outputs and produce higher-order analytical and reporting work that neither system does. Defer CAT Cloud replacement to a deliberate future cutover sprint. This is the chosen path.

- **Option D — Cut over to a cheaper or different project control system (not CAT Cloud, not ERP).** Move project operations to Procore, Buildxact, or another vendor. **Rejected because:** CAT Cloud is working, the team is fluent, switching is expensive, and the ERP build is already underway. The choice of project control system is orthogonal to the ERP's analytical role.

## Consequences

### Positive

- Sprint scope narrows dramatically. Many features that were on the "must build" list (two-step approval, retention model, purchase orders, timesheets, subcontract management) are deferred. Remaining scope is achievable for a sole maintainer.
- The ERP delivers value monthly through the management report, not on a multi-year horizon dependent on a cutover.
- Hemank's process is not disrupted. He continues to use the systems he's fluent in. The ERP augments his work, doesn't replace him during the build.
- The analytical and forecasting work (cash flow, unsecured probability weighting, management report assembly) becomes the priority, which matches where the ERP has comparative advantage.
- The eventual CAT Cloud replacement is planned deliberately, with the benefit of having spent 12+ months understanding CAT Cloud's role through the ERP's read-only integration with it.
- Reduced risk: the ERP doesn't try to be operationally critical for project workflows during its early life. Outage of the ERP affects reporting, not project operations.

### Negative / Accepted trade-offs

- Two source-of-truth systems (CAT Cloud and Xero) means the ERP must handle data reconciliation. When CAT Cloud and Xero disagree, the ERP must surface that, not silently choose.
- Manual import steps from CAT Cloud (CSV upload) remain part of Hemank's monthly close. The ERP cannot fully automate the close until CAT Cloud cutover happens (or until CAT Cloud exposes an API that the ERP can consume directly).
- Some features the SOP identifies as valuable (insurance expiry alerts on subcontractors, Practical Completion as a formal event, monthly close calendar enforcement) are not buildable in the ERP until either CAT Cloud cutover or a read-only ingest from CAT Cloud is built for that data domain.
- When a problem is found in CAT Cloud data (e.g. contract value error per SOP E7), it must be fixed in CAT Cloud and re-imported into the ERP. The ERP does not "improve" or "patch" CAT Cloud data unilaterally.
- The CAT Cloud cutover, when it does happen, will be a substantial project — possibly larger than any single sprint to date. It is deferred, but not avoided.

### What would force a revisit

- **If CAT Cloud raises its pricing significantly or its terms become unfavourable**, revisit because the cost-benefit of staying on CAT Cloud changes.
- **If CAT Cloud's vendor changes ownership or product direction in a way that affects reliability**, revisit because the source-of-truth status becomes risky.
- **If the management report's quality plateaus due to CAT Cloud data limitations** (e.g. CAT Cloud doesn't expose a needed field, or the CSV export is consistently late or wrong), revisit because the ERP's analytical work depends on usable inputs.
- **If a CAT Cloud-equivalent module within the ERP becomes incidentally complete** (e.g. through the Marketing module needing deal pipeline functionality, the ERP ends up with most of CAT Cloud's deal management already), revisit because the cutover threshold becomes lower.
- **If Agero scales to multiple business units, multiple subsidiaries, or a SaaS multi-tenant product**, revisit because CAT Cloud may not scale and the ERP's analytical surface may have grown to where a project control module is the gap.
- **If Hemank leaves or a new bookkeeper joins**, revisit because the operating context for the SOP changes.

## Related ADRs

- (None yet — this is the first ADR in the Agero repo.)
- Future ADRs likely to relate: Model C finance approach, the CAT Cloud cutover ADR (when it happens), Xero sync direction details for Phase 4 integration.

---

*This ADR is the foundational architectural decision for the Agero ERP build. Every future sprint design must be checked against the principle stated here: is this work additive to CAT Cloud and Xero, or duplicative? If duplicative, defer until cutover.*
