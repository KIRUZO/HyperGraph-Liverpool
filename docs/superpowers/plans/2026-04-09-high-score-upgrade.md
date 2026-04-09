# Assignment3 High-Score Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the Liverpool hypergraph storyboard into a more presentation-ready, analytically complete, and visually memorable assignment submission.

**Architecture:** Keep the current static-web architecture, but extend the preprocessing script to export richer summaries and story annotations, then expand the single-page UI to consume those fields for annotated storytelling, comparison metrics, and mini analytics views. Preserve the no-framework setup so the deliverable stays easy to run and submit.

**Tech Stack:** Python 3, unittest, static HTML/CSS/JavaScript, local `http.server`

---

### Task 1: Extend dataset tests first

**Files:**
- Modify: `Assignment3/tests/test_build_dataset.py`
- Test: `Assignment3/tests/test_build_dataset.py`

- [ ] **Step 1: Write the failing tests for richer summaries and annotations**

Add tests that assert:

```python
    def test_build_summary_counts_patterns_and_lanes(self) -> None:
        phases = [
            {
                "id": "phase-1",
                "outcome": "goal",
                "lane": "left",
                "pattern": "wide delivery",
                "players": [1, 2, 3, 4],
                "links": [{"source": 1, "target": 2}, {"source": 2, "target": 3}],
            },
            {
                "id": "phase-2",
                "outcome": "shot",
                "lane": "center",
                "pattern": "combination play",
                "players": [2, 3, 5],
                "links": [{"source": 2, "target": 3}],
            },
        ]
        summary = build_distribution_summary(phases)
        self.assertEqual(summary["outcomes"]["goal"], 1)
        self.assertEqual(summary["lanes"]["left"], 1)
        self.assertEqual(summary["patterns"]["wide delivery"], 1)

    def test_build_phase_comparison_metrics_exposes_higher_order_gap(self) -> None:
        phase = {
            "players": [1, 2, 3, 4],
            "links": [{"source": 1, "target": 2}, {"source": 2, "target": 3}, {"source": 3, "target": 4}],
            "progression": 48,
            "duration": 9.5,
        }
        metrics = build_phase_comparison_metrics(phase)
        self.assertEqual(metrics["hyperedgeOrder"], 4)
        self.assertEqual(metrics["graphEdgeCount"], 3)
        self.assertGreater(metrics["higherOrderDelta"], 0)

    def test_build_chapters_attaches_story_annotations(self) -> None:
        phases = [
            {
                "id": "phase-1",
                "outcome": "goal",
                "shotPlayerName": "Roberto Firmino",
                "events": [
                    {"playerId": 1, "playerName": "Joe Gomez", "subEventName": "Cross"},
                    {"playerId": 4, "playerName": "Roberto Firmino", "subEventName": "Shot"},
                ],
            }
        ]
        chapters = build_chapters(phases)
        firmino = next(chapter for chapter in chapters if chapter["id"] == "firmino-opener")
        self.assertIn("annotations", firmino)
        self.assertGreaterEqual(len(firmino["annotations"]), 1)
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd /Users/jky/WorkSpace/课程/博一下/数据可视化/Assignment3
python3 -m unittest tests/test_build_dataset.py
```

Expected: FAIL because the new dataset helper functions do not exist yet.

- [ ] **Step 3: Implement the minimal data helpers**

Add helper functions in `scripts/build_dataset.py`:

```python
def build_distribution_summary(phases: list[dict]) -> dict:
    ...

def build_phase_comparison_metrics(phase: dict) -> dict:
    ...
```

and extend chapter generation so story chapters include:

```python
"annotations": [
    {
        "playerId": 257899,
        "title": "Gomez supplies the width",
        "body": "The move stays alive because Gomez appears twice before the finish.",
        "kind": "build"
    }
]
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
cd /Users/jky/WorkSpace/课程/博一下/数据可视化/Assignment3
python3 -m unittest tests/test_build_dataset.py
```

Expected: PASS

### Task 2: Export richer dataset fields

**Files:**
- Modify: `Assignment3/scripts/build_dataset.py`
- Test: `Assignment3/tests/test_build_dataset.py`

- [ ] **Step 1: Extend the dataset schema**

Update the exported dataset to include:

```python
"summaryBreakdown": build_distribution_summary(reindexed),
"presentation": {
    "autoplayOrder": ["overview", "firmino-opener", "mane-overload", "salah-transition", "sturridge-finish"],
    "defaultSpeedMs": 3200,
},
```

and add per-phase metrics:

```python
phase["comparison"] = build_phase_comparison_metrics(phase)
```

- [ ] **Step 2: Regenerate the dataset**

Run:

```bash
cd /Users/jky/WorkSpace/课程/博一下/数据可视化/Assignment3
python3 scripts/build_dataset.py
```

Expected: writes updated `json` and `js` dataset artifacts successfully.

- [ ] **Step 3: Spot-check generated content**

Run:

```bash
python3 - <<'PY'
import json
from pathlib import Path
data = json.loads(Path('/Users/jky/WorkSpace/课程/博一下/数据可视化/Assignment3/data/liverpool_hypergraph_story.json').read_text())
print(data['summaryBreakdown'].keys())
print(data['phases'][0]['comparison'].keys())
print(data['chapters'][1]['annotations'][0]['title'])
PY
```

Expected: output includes breakdown keys, comparison keys, and a chapter annotation title.

### Task 3: Upgrade the page structure

**Files:**
- Modify: `Assignment3/index.html`

- [ ] **Step 1: Add new UI regions**

Expand the page structure to include:

```html
<section class="viz-card spotlight">...</section>
<section class="viz-card analytics-panel">...</section>
<section class="viz-card presentation-panel">...</section>
<section class="viz-card mini-charts">...</section>
```

The new layout should support:

- presentation controls
- annotated story notes
- comparison metrics
- lane/pattern distribution views

- [ ] **Step 2: Keep the existing controls stable**

Preserve IDs already used by JavaScript, while adding new ones such as:

```html
<div id="presentation-controls"></div>
<div id="annotation-list"></div>
<div id="comparison-metrics"></div>
<div id="mini-analytics"></div>
```

- [ ] **Step 3: Verify the HTML structure still loads**

Run:

```bash
cd /Users/jky/WorkSpace/课程/博一下/数据可视化/Assignment3
python3 -m http.server 8765
```

Expected: `GET /` returns `200 OK` and the page source includes the new region IDs.

### Task 4: Implement upgraded frontend behavior

**Files:**
- Modify: `Assignment3/app.js`

- [ ] **Step 1: Add presentation-mode state**

Add state fields:

```javascript
  isAutoplay: false,
  autoplayTimer: null,
  presentationSpeed: DATA.presentation.defaultSpeedMs,
```

and implement:

```javascript
function startAutoplay() { ... }
function stopAutoplay() { ... }
function nextChapter() { ... }
function previousChapter() { ... }
```

- [ ] **Step 2: Render comparison metrics and annotations**

Add renderers:

```javascript
function renderComparisonMetrics() { ... }
function renderAnnotations() { ... }
function renderMiniAnalytics() { ... }
```

These should consume:

- `phase.comparison`
- `chapter.annotations`
- `DATA.summaryBreakdown`

- [ ] **Step 3: Add richer pitch overlays**

Extend the SVG rendering pipeline to draw:

- annotation callout points for highlighted players
- event path highlights for the selected phase
- a stronger shot marker / finishing marker

- [ ] **Step 4: Re-run syntax verification**

Run:

```bash
node --check /Users/jky/WorkSpace/课程/博一下/数据可视化/Assignment3/app.js
```

Expected: PASS

### Task 5: Upgrade visual styling

**Files:**
- Modify: `Assignment3/styles.css`

- [ ] **Step 1: Push the visual identity further**

Add:

- a more dramatic hero gradient treatment
- stronger card hierarchy
- spotlight panels for annotations and metrics
- motion for chapter changes and autoplay emphasis

- [ ] **Step 2: Style the new analytics blocks**

Create styles for:

```css
.spotlight
.presentation-panel
.annotation-card
.metric-stack
.metric-tile
.mini-chart
.distribution-bar
```

- [ ] **Step 3: Preserve responsiveness**

Ensure the upgraded layout still works on smaller widths by updating the existing media queries.

### Task 6: Update documentation and verify everything

**Files:**
- Modify: `Assignment3/README.md`
- Test: `Assignment3/tests/test_build_dataset.py`

- [ ] **Step 1: Update the README**

Document:

- the new presentation mode
- the new analytics panels
- the upgraded story annotations
- the stronger explanation of hypergraph vs graph

- [ ] **Step 2: Run the full verification sequence**

Run:

```bash
cd /Users/jky/WorkSpace/课程/博一下/数据可视化/Assignment3
python3 -m unittest tests/test_build_dataset.py
python3 scripts/build_dataset.py
node --check app.js
python3 -m http.server 8765
```

Expected:

- tests pass
- dataset rebuild succeeds
- JS syntax check passes
- local server serves the page correctly

- [ ] **Step 3: Close the verification server after the smoke test**

Stop the local `http.server` process so the workspace remains clean.
