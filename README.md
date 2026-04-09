# Liverpool Hyperedge Storyboard

An interactive visualization project for the Data Visualization mid-term assignment.  
Theme: **use hypergraph to explain team coordination in one Premier League match**.

This project focuses on **Liverpool 4-0 Arsenal (Premier League 2017/18, Anfield)** and turns Liverpool's attacking phases into **hyperedges**. Instead of reducing every move to only pairwise pass links, the visualization treats one coordinated attacking phase as a higher-order relation among all involved players.

## 1. Project Idea

The assignment asks for an interactive visualization centered on **hypergraph**, not a traditional graph.  
To satisfy that requirement, this project uses the following mapping:

- **Vertex**: one Liverpool player
- **Hyperedge**: one attacking phase that ends with a Liverpool shot
- **Hyperedge size**: the number of unique players involved in that phase
- **Graph baseline**: inferred pairwise pass links inside the same phase

This gives the project a clear comparison:

- In **graph mode**, users only see the pairwise passing skeleton.
- In **hypergraph mode**, users see the whole coordinated action as one group relation.
- In **both mode**, users can compare what is lost when a higher-order move is flattened into a normal graph.

## 2. Why This Match

I selected **Liverpool 4-0 Arsenal** because it contains several different kinds of attacking patterns:

- right-side overloads
- layered combination play
- direct transition attacks
- cross-and-finish sequences

That variety makes the hypergraph framing much clearer. Some phases involve **4 to 6 players**, which are naturally suitable for hyperedges; others collapse into nearly pairwise actions, which creates a useful contrast between graph and hypergraph views.

## 3. Interaction Design

The visualization follows a **hybrid design**: guided storytelling first, open exploration second.

### Guided Story

The story mode contains:

- **Match Overview**: shows several important Liverpool attacking hyperedges together
- **Firmino Opener**: a right-side overload ending in Firmino's goal
- **Mane Overload**: a multi-player move through the inside-left channel
- **Salah Transition**: a direct transition where graph and hypergraph become more similar
- **Sturridge Finish**: a late cross-and-finish sequence with clear role separation
- **Presentation Mode**: previous / autoplay / next controls for classroom demonstration
- **On-pitch annotations**: tactical callouts appear directly on the pitch for key story chapters

### Free Explore

Users can then switch to exploration mode and interact with:

- **Outcome filter**: all / goal / shot
- **Lane filter**: left / center / right
- **Pattern filter**: wide delivery / layered buildup / direct break / combination play / through-ball move
- **Player focus**: click a player to emphasize the phases they participate in
- **Phase timeline**: click any attacking phase to inspect it in detail
- **Keyboard shortcuts**:
  - `←` `→`: switch selected phase
  - `G`: graph mode
  - `H`: hypergraph mode
  - `B`: both mode

## 4. High-Score Upgrade Highlights

Compared with the first implementation, the upgraded version adds several rubric-oriented improvements:

- **Presentation-ready story flow**: autoplay and guided stepping make the page easier to present in class
- **Annotated storytelling**: important story chapters now include on-pitch tactical callouts and sidebar explanation cards
- **Stronger graph vs hypergraph argument**: each selected phase exposes compact comparison metrics, including higher-order delta
- **Richer overview analytics**: lane distribution, outcome distribution, and pattern distribution are visible directly in the interface
- **More expressive visual design**: stronger hero treatment, deeper pitch contrast, spotlight cards, and animated shot emphasis

## 5. Visual Encoding

### Main Canvas

- A stylized football pitch is used as the main spatial frame.
- Player nodes are placed by **average event positions** across selected attacking phases.
- Node labels keep the players legible while preserving the football context.

### Hypergraph Encoding

- Each attacking phase is drawn as a **translucent filled hull** connecting all players involved.
- The selected phase becomes more opaque and visually prominent.
- When multiple phases are shown together, the overlap reveals recurring tactical regions.
- Story chapters may also add **annotation pins** and **callout labels** directly on the pitch.

### Graph Encoding

- Pairwise pass links inside the same phase are drawn as curved teal arcs.
- This creates a direct comparison baseline for the hypergraph representation.
- The comparison metric panel explains what information is lost when only pairwise links are shown.

### Detail Panel

The right-side panel shows:

- minute and result of the selected phase
- number of players, actions, pass links, and spatial progression
- ordered player list
- action sequence inside the phase
- presentation takeaway text for the current chapter
- phase-level hypergraph vs graph metrics

### Analytics Panel

The lower section now also contains compact summary views for:

- shot phases vs goal phases
- left / center / right lane usage
- recurring tactical patterns

## 6. Data Source

The project uses the public **Wyscout open event dataset**, specifically the processed files from:

- Repository: `koenvo/wyscout-soccer-match-event-dataset`
- Match file: `processed/files/2499743.json`
- Match: `Liverpool - Arsenal, 4 - 0`

The processed dataset is based on the public Wyscout event collection described in:

- Pappalardo et al., *A public data set of spatio-temporal match events in soccer competitions*, Scientific Data, 2019.

## 7. Data Processing Logic

The raw event stream is transformed into interactive hypergraph data by `scripts/build_dataset.py`.

### Core heuristic

For Liverpool only:

1. Scan the match event stream.
2. Use each **shot-ending attacking sequence** as a candidate phase.
3. Build a phase window by looking backward from the shot while enforcing:
   - same half
   - no large time gap between team events
   - bounded time span
   - bounded number of actions
4. Convert that phase into:
   - player set
   - inferred pass links
   - progression
   - lane
   - pattern type
   - narrative label
   - graph vs hypergraph comparison metrics
   - chapter annotations for the guided story mode
   - overview distribution summaries for mini analytics

### Why this heuristic works

This assignment is about visual explanation, not event-model perfection.  
The chosen heuristic produces attacking groups that are:

- easy to interpret
- visually clean
- faithful to the idea of coordinated action
- suitable for hypergraph storytelling
- strong enough to support both report writing and oral presentation

### Additional exported fields

The processed dataset now includes:

- `summaryBreakdown`: outcome / lane / pattern distributions
- `comparison`: per-phase graph-vs-hypergraph metrics
- `chapters[].annotations`: story callouts for the key moves
- `presentation`: autoplay order and timing defaults

## 8. Folder Structure

```text
Assignment3/
├── README.md
├── index.html
├── styles.css
├── app.js
├── data/
│   ├── liverpool_hypergraph_story.json
│   └── liverpool_hypergraph_story.js
├── scripts/
│   └── build_dataset.py
└── tests/
    └── test_build_dataset.py
```

## 9. How To Run

### Recommended

Run a local static server in `Assignment3`:

```bash
cd Assignment3
python3 -m http.server 8765
```

Then open:

```text
http://127.0.0.1:8765
```

### Alternative

You can also directly open `index.html` in many browsers because the dataset is also exported as a browser-ready JavaScript file:

- `data/liverpool_hypergraph_story.js`

However, the local server approach is more reliable and is recommended for presentation.

## 10. How To Rebuild The Dataset

If you want to regenerate the processed data from the public Wyscout match file:

```bash
cd Assignment3
python3 scripts/build_dataset.py
```

This command writes:

- `data/liverpool_hypergraph_story.json`
- `data/liverpool_hypergraph_story.js`

## 11. Verification

The core preprocessing logic is covered by a small unit test file:

```bash
cd Assignment3
python3 -m unittest tests/test_build_dataset.py
```

The test checks:

- phase window extraction
- pairwise pass-link inference
- phase summary generation
- distribution summary generation
- comparison metric generation
- chapter annotation generation

## 12. Submission Notes

For the appendix folder, the most important files are:

- `index.html`
- `styles.css`
- `app.js`
- `data/liverpool_hypergraph_story.json`
- `data/liverpool_hypergraph_story.js`
- `scripts/build_dataset.py`
- `README.md`

If needed for class presentation, you can describe the project in one sentence as:

> We model each Liverpool shot-ending attacking phase as a hyperedge so that users can compare higher-order coordination with ordinary pairwise pass graphs.

## 13. External Resources Declaration

This project uses the following external resources:

- **Dataset**: Wyscout open soccer event data, processed by the public repository `koenvo/wyscout-soccer-match-event-dataset`
- **LLM assistance**: OpenAI GPT-5/Codex was used to help with idea refinement, implementation, code organization, and README writing
