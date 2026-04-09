# Assignment3 High-Score Upgrade Design

## Goal

Upgrade the existing Liverpool hypergraph visualization so it scores better on all three rubric dimensions:

- **Completeness**: add clearer explanation of data, encoding, interaction, and hypergraph value
- **Clarity**: make the story flow easier to present and easier to understand at first glance
- **Creativity**: push the visual identity and interaction quality beyond a conventional football dashboard

The new version should remain a **static web project** inside `Assignment3/` and reuse the current Wyscout-based Liverpool match pipeline.

## Current Baseline

The current system already has:

- a static single-page interface
- hypergraph / graph / both view switching
- chapter-based storytelling
- timeline selection
- basic player focus and phase filters
- a Python preprocessing script and a small unit test file

The current weaknesses are:

- the “why hypergraph” explanation is still mostly textual
- the overview area does not yet feel like a polished presentation-grade experience
- the story chapters lack visual callouts on the pitch itself
- the summary analytics are thin compared with the available data
- the aesthetic direction is clean, but not yet memorable or dramatic enough

## Upgrade Direction

This upgrade follows the previously approved **balanced high-score version**, with an added emphasis on visual impact.

### 1. Presentation-Ready Story Mode

Story mode will become more guided and more cinematic:

- add an explicit **presentation mode** with previous/next controls and autoplay
- show **phase annotations directly on the pitch** for the selected story chapter
- surface a short tactical takeaway for each key move
- make chapter transitions feel intentional instead of purely navigational

The main idea is that a presenter should be able to open the page and talk through the story without needing to improvise the explanation.

### 2. Stronger Hypergraph-vs-Graph Explanation

The current graph/hypergraph toggle works, but it does not yet prove the argument strongly enough. The new version should add:

- a dedicated comparison panel
- compact metrics for the selected phase, such as player count, pairwise edges, and a simple higher-order delta
- plain-language explanation of what the graph misses

This turns the page from “a nice interactive visualization” into “an argument for why hypergraph matters here.”

### 3. Richer Match Analytics

The overview should expose more structure from the dataset:

- lane distribution across phases
- pattern distribution across phases
- top connectors and recurring groups
- a clearer summary of goal-ending phases versus non-goal phases

These additions improve completeness and make the report easier to write, because the visual system will already expose the major findings.

### 4. More Distinctive Visual Language

The upgraded page should feel bolder and more memorable while staying readable:

- stronger Liverpool-inspired hero treatment
- more dramatic contrast between paper UI and pitch canvas
- subtle motion for chapter changes, phase emphasis, and autoplay
- richer marker and callout styling on the pitch
- more expressive card hierarchy and analytics components

The aesthetic target is “presentation-ready data story” rather than “generic analytics panel.”

## Data Changes

The Python preprocessing layer will be extended to export:

- chapter-specific annotations for key moves
- richer overview summaries
- distribution counts by lane, pattern, and outcome
- selected comparison metrics for each phase

These fields should stay lightweight so the frontend remains a static client-side app.

## UI Changes

The web page will be reorganized around four experience layers:

1. **Hero + control bar**  
   Stronger first impression, quick access to story mode and autoplay

2. **Main pitch stage**  
   Annotated hypergraph canvas with better overlays and selected-phase emphasis

3. **Comparison + insights layer**  
   Clear explanation of graph versus hypergraph for the current move

4. **Analytics + details layer**  
   Distribution views, player involvement, and ordered event explanation

## Testing and Verification

The upgrade should extend the current test coverage at the dataset layer. Specifically, tests should verify:

- distribution summary generation
- comparison metrics for a phase
- chapter annotation structure

Frontend verification will include:

- JavaScript syntax check
- dataset regeneration
- local static server smoke check

## Scope Guardrails

To keep risk controlled, this upgrade will **not** add:

- external frameworks
- backend services
- live online APIs at runtime
- multi-match expansion
- heavy animation libraries

The upgrade remains a self-contained static deliverable under `Assignment3/`.
