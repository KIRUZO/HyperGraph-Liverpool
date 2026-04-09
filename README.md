# Liverpool Hyperedge Storyboard

An interactive visualization project about **Liverpool's attacking coordination** in **Liverpool 4-0 Arsenal (Premier League 2017/18)**.

This project uses **hypergraph** to show how multiple players participate in the same attacking phase, instead of reducing everything to only pairwise pass links.

## Quick Start

All commands below assume this folder is the repo root.

```bash
git clone <your-repo-url>
cd <repo-folder>
python3 -m http.server 8765
```

Then open:

```text
http://127.0.0.1:8765
```

If you want to rebuild the processed data:

```bash
python3 scripts/build_dataset.py
```

If you want a quick check before pushing:

```bash
python3 -m unittest tests/test_build_dataset.py
node --check app.js
```

## Repository Overview

This is a **single-page static visualization** project.

- `index.html`: page structure
- `styles.css`: visual style and layout
- `app.js`: interaction logic and rendering
- `scripts/build_dataset.py`: dataset preprocessing
- `data/liverpool_hypergraph_story.json`: processed dataset
- `tests/test_build_dataset.py`: data pipeline tests

Most teammates only need:

- Python 3
- Node.js
- a modern browser

## Project Introduction

The core idea of the project is:

- **Vertex**: one Liverpool player
- **Hyperedge**: one Liverpool attacking phase ending in a shot
- **Graph baseline**: inferred pairwise pass links from the same phase

The visualization includes two main modes:

- **Story Mode**: guided explanation of several key Liverpool attacking phases
- **Explore Mode**: free interaction with filters, player focus, timeline, and view switching

Main features:

- hypergraph / graph / both comparison
- story chapters with tactical annotations
- player involvement view
- phase timeline
- lane, pattern, and outcome summaries

Data source:

- Wyscout open event dataset
- processed match file: `2499743.json`

In short, this project is trying to answer one question:

> Why is hypergraph better than a normal graph for showing team coordination in football?
