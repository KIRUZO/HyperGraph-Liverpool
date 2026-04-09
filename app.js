const DATA = window.LIVERPOOL_HYPERGRAPH_DATA;

const PHASE_MAP = new Map(DATA.phases.map((phase) => [phase.id, phase]));
const PLAYER_MAP = new Map(DATA.players.map((player) => [player.id, player]));
const CHAPTER_MAP = new Map(DATA.chapters.map((chapter) => [chapter.id, chapter]));
const PHASE_INDEX = new Map(DATA.phases.map((phase, index) => [phase.id, index]));
const AUTOPLAY_ORDER = DATA.presentation?.autoplayOrder ?? DATA.chapters.filter((chapter) => chapter.id !== "explore").map((chapter) => chapter.id);
const PALETTE = ["#b3202a", "#f4a259", "#127475", "#6d597a", "#3a86ff", "#ff7f51", "#ef476f", "#2a9d8f"];

const state = {
  mode: "story",
  view: "both",
  activeChapterId: "overview",
  selectedPhaseId: DATA.chapters[0].phaseIds[0],
  activePlayerId: null,
  isAutoplay: false,
  autoplayTimer: null,
  presentationSpeed: DATA.presentation?.defaultSpeedMs ?? 3200,
  filters: {
    outcome: "all",
    lane: "all",
    pattern: "all",
  },
};

const elements = {};

document.addEventListener("DOMContentLoaded", () => {
  cacheElements();
  renderStaticMeta();
  bindKeyboard();
  renderAll();
});

function cacheElements() {
  elements.modeSwitch = document.getElementById("mode-switch");
  elements.presentationControls = document.getElementById("presentation-controls");
  elements.summaryStrip = document.getElementById("summary-strip");
  elements.viewSwitch = document.getElementById("view-switch");
  elements.chapterList = document.getElementById("chapter-list");
  elements.outcomeFilters = document.getElementById("outcome-filters");
  elements.laneFilters = document.getElementById("lane-filters");
  elements.patternFilters = document.getElementById("pattern-filters");
  elements.phaseDetail = document.getElementById("phase-detail");
  elements.timeline = document.getElementById("timeline");
  elements.playerList = document.getElementById("player-list");
  elements.pitch = document.getElementById("pitch-svg");
  elements.chapterSummary = document.getElementById("chapter-summary");
  elements.comparisonBox = document.getElementById("comparison-box");
  elements.comparisonMetrics = document.getElementById("comparison-metrics");
  elements.annotationList = document.getElementById("annotation-list");
  elements.miniAnalytics = document.getElementById("mini-analytics");
  elements.takeawayBox = document.getElementById("takeaway-box");
}

function renderStaticMeta() {
  document.getElementById("match-title").textContent = DATA.match.title;
  document.getElementById("match-meta").textContent = `${DATA.match.season} · ${DATA.match.venue} · ${DATA.match.date}`;
}

function renderAll() {
  syncSelection();
  renderModeSwitch();
  renderPresentationControls();
  renderSummaryStrip();
  renderViewSwitch();
  renderChapterList();
  renderFilters();
  renderPhaseDetail();
  renderTimeline();
  renderPlayerList();
  renderMiniAnalytics();
  renderTakeawayBox();
  renderPitch();
  renderNarrativeCopy();
  renderComparisonMetrics();
  renderAnnotations();
}

function currentChapter() {
  return CHAPTER_MAP.get(state.activeChapterId) ?? DATA.chapters[0];
}

function currentPhase() {
  return PHASE_MAP.get(state.selectedPhaseId) ?? null;
}

function setMode(mode) {
  state.mode = mode;
  if (mode === "story") {
    state.activeChapterId = state.activeChapterId === "explore" ? "overview" : state.activeChapterId;
  } else {
    state.activeChapterId = "explore";
    stopAutoplay();
  }
}

function setChapter(chapterId) {
  state.activeChapterId = chapterId;
  setMode(chapterId === "explore" ? "explore" : "story");
  const chapter = currentChapter();
  if (!chapter.phaseIds.includes(state.selectedPhaseId)) {
    state.selectedPhaseId = chapter.phaseIds[0] ?? state.selectedPhaseId;
  }
}

function allFilteredPhases() {
  return DATA.phases.filter((phase) => {
    if (state.filters.outcome !== "all" && phase.outcome !== state.filters.outcome) {
      return false;
    }
    if (state.filters.lane !== "all" && phase.lane !== state.filters.lane) {
      return false;
    }
    if (state.filters.pattern !== "all" && phase.pattern !== state.filters.pattern) {
      return false;
    }
    if (state.mode === "explore" && state.activePlayerId && !phase.players.includes(state.activePlayerId)) {
      return false;
    }
    return true;
  });
}

function visiblePhases() {
  if (state.mode === "story") {
    return currentChapter()
      .phaseIds.map((phaseId) => PHASE_MAP.get(phaseId))
      .filter(Boolean);
  }
  return allFilteredPhases();
}

function syncSelection() {
  const visibleIds = new Set(visiblePhases().map((phase) => phase.id));
  if (!visibleIds.has(state.selectedPhaseId)) {
    state.selectedPhaseId = visiblePhases()[0]?.id ?? null;
  }
}

function renderModeSwitch() {
  const modes = [
    { id: "story", title: "Guided Story", note: "Narrated chapters for class presentation" },
    { id: "explore", title: "Free Explore", note: "Open filters, player focus, comparison" },
  ];
  elements.modeSwitch.innerHTML = "";
  modes.forEach((mode) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `mode-button${state.mode === mode.id ? " active" : ""}`;
    button.innerHTML = `<strong>${mode.title}</strong><small>${mode.note}</small>`;
    button.addEventListener("click", () => {
      setMode(mode.id);
      state.activePlayerId = null;
      renderAll();
    });
    elements.modeSwitch.appendChild(button);
  });
}

function renderPresentationControls() {
  elements.presentationControls.innerHTML = "";
  const controls = [
    { id: "prev", label: "Previous", note: "Step back a chapter" },
    { id: "play", label: state.isAutoplay ? "Pause Story" : "Auto-Play", note: `${Math.round(state.presentationSpeed / 1000)}s pacing` },
    { id: "next", label: "Next", note: "Advance the story" },
  ];

  controls.forEach((control) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `mode-button presentation-button${control.id === "play" && state.isAutoplay ? " active" : ""}`;
    button.innerHTML = `<strong>${control.label}</strong><small>${control.note}</small>`;
    button.addEventListener("click", () => {
      if (control.id === "prev") {
        stopAutoplay();
        advanceChapter(-1);
      } else if (control.id === "next") {
        stopAutoplay();
        advanceChapter(1);
      } else if (state.isAutoplay) {
        stopAutoplay();
      } else {
        startAutoplay();
      }
      renderAll();
    });
    elements.presentationControls.appendChild(button);
  });
}

function startAutoplay() {
  setMode("story");
  if (!AUTOPLAY_ORDER.includes(state.activeChapterId)) {
    state.activeChapterId = AUTOPLAY_ORDER[0];
  }
  state.isAutoplay = true;
  queueAutoplayStep();
}

function stopAutoplay() {
  state.isAutoplay = false;
  if (state.autoplayTimer) {
    window.clearTimeout(state.autoplayTimer);
    state.autoplayTimer = null;
  }
}

function queueAutoplayStep() {
  stopAutoplay();
  state.isAutoplay = true;
  state.autoplayTimer = window.setTimeout(() => {
    const currentIndex = AUTOPLAY_ORDER.indexOf(state.activeChapterId);
    if (currentIndex === AUTOPLAY_ORDER.length - 1) {
      stopAutoplay();
      renderAll();
      return;
    }
    advanceChapter(1);
    renderAll();
    if (state.isAutoplay) {
      queueAutoplayStep();
    }
  }, state.presentationSpeed);
}

function advanceChapter(direction) {
  if (state.mode !== "story") {
    setMode("story");
  }
  const currentIndex = Math.max(0, AUTOPLAY_ORDER.indexOf(state.activeChapterId));
  const nextIndex = Math.max(0, Math.min(AUTOPLAY_ORDER.length - 1, currentIndex + direction));
  state.activeChapterId = AUTOPLAY_ORDER[nextIndex];
  syncSelection();
}

function renderSummaryStrip() {
  const laneLeader = Object.entries(DATA.summaryBreakdown.lanes)
    .sort((left, right) => right[1] - left[1])[0]?.[0] ?? "center";
  const patternLeader = Object.entries(DATA.summaryBreakdown.patterns)
    .sort((left, right) => right[1] - left[1])[0]?.[0] ?? "combination play";
  const stats = [
    { label: "Hyperedges", value: DATA.summary.selectedPhaseCount },
    { label: "Goal-ending phases", value: DATA.summary.goalPhaseCount },
    { label: "Dominant lane", value: laneLeader },
    { label: "Main pattern", value: patternLeader },
  ];

  elements.summaryStrip.innerHTML = "";
  stats.forEach((stat) => {
    const pill = document.createElement("div");
    pill.className = "stat-pill";
    pill.innerHTML = `<span>${stat.label}</span><strong>${stat.value}</strong>`;
    elements.summaryStrip.appendChild(pill);
  });
}

function renderViewSwitch() {
  const views = [
    { id: "hypergraph", title: "Hypergraph", note: "See the full coordinated group" },
    { id: "graph", title: "Graph", note: "Reduce the move to pairwise edges" },
    { id: "both", title: "Both", note: "Compare abstraction and loss together" },
  ];

  elements.viewSwitch.innerHTML = "";
  views.forEach((view) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = state.view === view.id ? "active" : "";
    button.innerHTML = `<strong>${view.title}</strong><small>${view.note}</small>`;
    button.addEventListener("click", () => {
      state.view = view.id;
      renderAll();
    });
    elements.viewSwitch.appendChild(button);
  });
}

function renderChapterList() {
  elements.chapterList.innerHTML = "";
  DATA.chapters.forEach((chapter) => {
    if (chapter.id === "explore" && state.mode === "story") {
      return;
    }
    if (chapter.id !== "explore" && state.mode === "explore") {
      return;
    }
    const button = document.createElement("button");
    button.type = "button";
    button.className = `chapter-button${state.activeChapterId === chapter.id ? " active" : ""}`;
    button.innerHTML = `<strong>${chapter.title}</strong><span>${chapter.summary}</span>`;
    button.addEventListener("click", () => {
      stopAutoplay();
      setChapter(chapter.id);
      state.activePlayerId = null;
      renderAll();
    });
    elements.chapterList.appendChild(button);
  });
}

function renderFilters() {
  renderFilterRow(elements.outcomeFilters, ["all", "goal", "shot"], state.filters.outcome, (value) => {
    setMode("explore");
    state.filters.outcome = value;
    renderAll();
  });
  renderFilterRow(elements.laneFilters, ["all", "left", "center", "right"], state.filters.lane, (value) => {
    setMode("explore");
    state.filters.lane = value;
    renderAll();
  });
  const patterns = ["all", ...new Set(DATA.phases.map((phase) => phase.pattern))];
  renderFilterRow(elements.patternFilters, patterns, state.filters.pattern, (value) => {
    setMode("explore");
    state.filters.pattern = value;
    renderAll();
  });
}

function renderFilterRow(container, values, activeValue, onClick) {
  container.innerHTML = "";
  values.forEach((value) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = `chip${activeValue === value ? " active" : ""}`;
    chip.textContent = value === "all" ? "All" : value;
    chip.addEventListener("click", () => onClick(value));
    container.appendChild(chip);
  });
}

function renderPhaseDetail() {
  const phase = currentPhase();
  if (!phase) {
    elements.phaseDetail.innerHTML = `<div class="empty-state">No phases match the current filters.</div>`;
    return;
  }

  const summary = [
    `${phase.uniquePlayerCount}-player hyperedge`,
    `${phase.eventCount} actions`,
    `${phase.links.length} pairwise links`,
    `${phase.progression >= 0 ? "+" : ""}${phase.progression} x progression`,
  ].join(" · ");

  const playerButtons = phase.players
    .map((playerId) => {
      const player = PLAYER_MAP.get(playerId);
      const active = state.activePlayerId === playerId ? " active" : "";
      return `<button type="button" class="player-token${active}" data-player="${playerId}">${player.name}</button>`;
    })
    .join("");

  const eventLines = phase.events
    .map(
      (event) => `
        <div class="event-line">
          <div>${formatPhaseTime(event.second)}</div>
          <div>
            <strong>${event.playerName}</strong>
            <span>${event.subEventName}${event.isGoal ? " · Goal" : event.isShot ? " · Shot" : ""}</span>
          </div>
        </div>
      `,
    )
    .join("");

  elements.phaseDetail.innerHTML = `
    <div class="detail-head">
      <div>
        <p class="mini-label">${phase.minute} · ${phase.period}</p>
        <h3>${phase.shotPlayerName}</h3>
      </div>
      <div class="meta-badge ${phase.outcome === "goal" ? "goal" : ""}">${phase.outcome}</div>
    </div>
    <p>${summary}</p>
    <div class="phase-meta">
      <div class="meta-badge">${phase.pattern}</div>
      <div class="meta-badge">${phase.lane} lane</div>
      <div class="meta-badge">${phase.duration.toFixed(1)} seconds</div>
      <div class="meta-badge">${phase.comparison.higherOrderDelta} missed pair relations</div>
    </div>
    <div class="player-token-row">${playerButtons}</div>
    <div class="phase-events">${eventLines}</div>
  `;

  elements.phaseDetail.querySelectorAll("[data-player]").forEach((button) => {
    button.addEventListener("click", () => {
      const playerId = Number(button.dataset.player);
      state.activePlayerId = state.activePlayerId === playerId ? null : playerId;
      renderAll();
    });
  });
}

function renderTimeline() {
  const phases = visiblePhases();
  elements.timeline.innerHTML = "";
  if (!phases.length) {
    elements.timeline.innerHTML = `<div class="empty-state">No attacking phase passes the current filters.</div>`;
    return;
  }

  phases.forEach((phase) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `timeline-card${state.selectedPhaseId === phase.id ? " active" : ""}`;
    button.innerHTML = `<strong>${phase.minute} · ${phase.shotPlayerName}</strong><span>${phase.uniquePlayerCount} players · ${phase.pattern}</span>`;
    button.addEventListener("click", () => {
      state.selectedPhaseId = phase.id;
      renderAll();
    });
    elements.timeline.appendChild(button);
  });
}

function renderPlayerList() {
  const phases = visiblePhases();
  const counter = new Map();
  phases.forEach((phase) => {
    phase.players.forEach((playerId) => {
      counter.set(playerId, (counter.get(playerId) ?? 0) + 1);
    });
  });

  const players = [...counter.entries()]
    .sort((left, right) => right[1] - left[1] || PLAYER_MAP.get(left[0]).name.localeCompare(PLAYER_MAP.get(right[0]).name))
    .map(([playerId, count]) => ({ player: PLAYER_MAP.get(playerId), count }));

  elements.playerList.innerHTML = "";
  players.forEach(({ player, count }) => {
    const wrapper = document.createElement("div");
    wrapper.className = "player-item";
    const button = document.createElement("button");
    button.type = "button";
    button.className = state.activePlayerId === player.id ? "active" : "";
    button.innerHTML = `<strong>${player.name}</strong><span>${player.role} · ${count} visible phases · avg position ${Math.round(player.avgX)}, ${Math.round(player.avgY)}</span>`;
    button.addEventListener("click", () => {
      state.activePlayerId = state.activePlayerId === player.id ? null : player.id;
      if (state.mode === "explore") {
        state.activeChapterId = "explore";
      }
      renderAll();
    });
    wrapper.appendChild(button);
    elements.playerList.appendChild(wrapper);
  });
}

function renderNarrativeCopy() {
  const chapter = currentChapter();
  const phase = currentPhase();
  if (!phase) {
    elements.chapterSummary.textContent = "No visible phase is currently selected.";
    elements.comparisonBox.textContent = "Adjust the filters to recover at least one attacking phase.";
    return;
  }

  elements.chapterSummary.textContent = chapter.summary;

  const metrics = phase.comparison;
  const directness =
    metrics.higherOrderDelta <= 1
      ? "This move is structurally close to a normal pass graph, which is why the two views feel similar."
      : `The graph only exposes ${metrics.graphEdgeCount} visible links, while the hypergraph preserves a ${metrics.hyperedgeOrder}-player action group and keeps ${metrics.higherOrderDelta} hidden pair possibilities in view.`;
  const playerFocus =
    state.activePlayerId && phase.players.includes(state.activePlayerId)
      ? ` The current focus highlights ${PLAYER_MAP.get(state.activePlayerId).name}'s role inside the same coordinated action.`
      : "";

  elements.comparisonBox.textContent = `${directness}${playerFocus}`;
}

function renderComparisonMetrics() {
  const phase = currentPhase();
  if (!phase) {
    elements.comparisonMetrics.innerHTML = "";
    return;
  }

  const metrics = phase.comparison;
  const tiles = [
    { label: "Hyperedge order", value: metrics.hyperedgeOrder, accent: "hyper" },
    { label: "Graph edges", value: metrics.graphEdgeCount, accent: "graph" },
    { label: "Higher-order delta", value: metrics.higherOrderDelta, accent: "amber" },
    { label: "Connectivity ratio", value: metrics.connectivityRatio, accent: "graph" },
  ];

  elements.comparisonMetrics.innerHTML = "";
  tiles.forEach((tile) => {
    const item = document.createElement("div");
    item.className = `metric-tile ${tile.accent}`;
    item.innerHTML = `<span>${tile.label}</span><strong>${tile.value}</strong>`;
    elements.comparisonMetrics.appendChild(item);
  });
}

function currentAnnotations() {
  const chapter = currentChapter();
  return chapter.annotations ?? [];
}

function renderAnnotations() {
  const annotations = currentAnnotations();
  if (!annotations.length) {
    elements.annotationList.innerHTML = `<div class="empty-state">This view is exploratory, so there are no fixed story callouts. Use the filters to build your own explanation.</div>`;
    return;
  }

  elements.annotationList.innerHTML = "";
  annotations.forEach((annotation, index) => {
    const card = document.createElement("div");
    card.className = `annotation-card kind-${annotation.kind ?? "build"}`;
    card.innerHTML = `
      <div class="annotation-number">${index + 1}</div>
      <div>
        <strong>${annotation.title}</strong>
        <p>${annotation.body}</p>
      </div>
    `;
    card.addEventListener("click", () => {
      state.activePlayerId = state.activePlayerId === annotation.playerId ? null : annotation.playerId;
      renderAll();
    });
    elements.annotationList.appendChild(card);
  });
}

function renderMiniAnalytics() {
  const sections = [
    { title: "Outcomes", data: DATA.summaryBreakdown.outcomes, keys: ["goal", "shot"] },
    { title: "Lanes", data: DATA.summaryBreakdown.lanes, keys: ["left", "center", "right"] },
    {
      title: "Patterns",
      data: DATA.summaryBreakdown.patterns,
      keys: Object.keys(DATA.summaryBreakdown.patterns).sort((left, right) => DATA.summaryBreakdown.patterns[right] - DATA.summaryBreakdown.patterns[left]),
    },
  ];

  elements.miniAnalytics.innerHTML = "";
  sections.forEach((section) => {
    const maxValue = Math.max(...section.keys.map((key) => section.data[key] ?? 0), 1);
    const block = document.createElement("div");
    block.className = "mini-chart";
    block.innerHTML = `<h3>${section.title}</h3>`;
    section.keys.forEach((key) => {
      const value = section.data[key] ?? 0;
      const row = document.createElement("div");
      row.className = "distribution-row";
      row.innerHTML = `
        <span class="distribution-label">${key}</span>
        <div class="distribution-track"><div class="distribution-bar" style="width:${(value / maxValue) * 100}%"></div></div>
        <strong>${value}</strong>
      `;
      block.appendChild(row);
    });
    elements.miniAnalytics.appendChild(block);
  });
}

function renderTakeawayBox() {
  const phase = currentPhase();
  if (!phase) {
    elements.takeawayBox.textContent = "No phase selected.";
    return;
  }

  const takeaway =
    state.mode === "story"
      ? `Selected chapter: ${currentChapter().title}. This phase uses ${phase.uniquePlayerCount} players over ${phase.eventCount} actions and ends in a ${phase.outcome}.`
      : `Explore mode is live. The current phase travels through the ${phase.lane} lane and is tagged as ${phase.pattern}.`;
  elements.takeawayBox.textContent = takeaway;
}

function renderPitch() {
  const svg = elements.pitch;
  svg.innerHTML = "";
  const phases = visiblePhases();
  if (!phases.length) {
    const message = svgElement("text", {
      x: 480,
      y: 310,
      "text-anchor": "middle",
      fill: "rgba(255,255,255,0.9)",
      "font-size": 22,
      "font-family": "Avenir Next, Segoe UI, sans-serif",
    });
    message.textContent = "No visible hyperedges for the current selection";
    svg.appendChild(message);
    return;
  }

  drawPitchFrame(svg);

  const visiblePlayerIds = new Set(phases.flatMap((phase) => phase.players));
  const visiblePlayers = DATA.players.filter((player) => visiblePlayerIds.has(player.id));
  const positions = new Map(visiblePlayers.map((player) => [player.id, pitchPoint(player)]));

  if (state.view !== "graph") {
    phases.forEach((phase) => drawHyperedge(svg, phase, positions));
  }
  if (state.view !== "hypergraph") {
    phases.forEach((phase) => drawGraphEdges(svg, phase, positions));
  }

  drawSelectedPhaseRoute(svg);
  drawShotMarker(svg);
  drawAnnotationPins(svg, positions);
  visiblePlayers.forEach((player) => drawNode(svg, player, phases, positions.get(player.id)));
}

function drawPitchFrame(svg) {
  const stripeGroup = svgElement("g");
  for (let index = 0; index < 6; index += 1) {
    stripeGroup.appendChild(
      svgElement("rect", {
        x: 60 + index * 140,
        y: 44,
        width: 70,
        height: 532,
        fill: index % 2 === 0 ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.01)",
      }),
    );
  }
  svg.appendChild(stripeGroup);

  const markings = [
    ["rect", { x: 60, y: 44, width: 840, height: 532, rx: 24, class: "pitch-line" }],
    ["line", { x1: 480, y1: 44, x2: 480, y2: 576, class: "pitch-line" }],
    ["circle", { cx: 480, cy: 310, r: 72, class: "pitch-line" }],
    ["circle", { cx: 480, cy: 310, r: 2.5, fill: "rgba(236,248,238,0.92)" }],
    ["rect", { x: 60, y: 166, width: 120, height: 288, class: "pitch-line" }],
    ["rect", { x: 60, y: 228, width: 46, height: 164, class: "pitch-line" }],
    ["rect", { x: 780, y: 166, width: 120, height: 288, class: "pitch-line" }],
    ["rect", { x: 854, y: 228, width: 46, height: 164, class: "pitch-line" }],
    ["circle", { cx: 156, cy: 310, r: 2.5, fill: "rgba(236,248,238,0.92)" }],
    ["circle", { cx: 804, cy: 310, r: 2.5, fill: "rgba(236,248,238,0.92)" }],
  ];
  markings.forEach(([tag, attrs]) => svg.appendChild(svgElement(tag, attrs)));
}

function drawHyperedge(svg, phase, positions) {
  const coords = phase.players.map((playerId) => positions.get(playerId)).filter(Boolean);
  const pathData = buildHyperedgePath(coords);
  if (!pathData) {
    return;
  }
  const path = svgElement("path", {
    d: pathData,
    class: "hyperedge-path",
    fill: phaseColor(phase.id, hyperedgeAlpha(phase)),
    stroke: phaseColor(phase.id, 0.84),
  });
  svg.appendChild(path);
}

function drawGraphEdges(svg, phase, positions) {
  phase.links.forEach((link) => {
    const source = positions.get(link.source);
    const target = positions.get(link.target);
    if (!source || !target) {
      return;
    }
    const path = svgElement("path", {
      d: edgeCurve(source, target),
      class: "edge-path",
      stroke: `rgba(18, 116, 117, ${graphAlpha(phase)})`,
      "stroke-width": state.selectedPhaseId === phase.id ? 4.2 : 2.4,
    });
    svg.appendChild(path);
  });
}

function drawSelectedPhaseRoute(svg) {
  const phase = currentPhase();
  if (!phase) {
    return;
  }

  phase.events.forEach((event, index) => {
    const start = eventPoint(event.start);
    const end = eventPoint(event.end);
    const glow = svgElement("line", {
      x1: start.x,
      y1: start.y,
      x2: end.x,
      y2: end.y,
      class: "route-glow",
    });
    svg.appendChild(glow);

    if (index < phase.events.length - 1) {
      const marker = svgElement("circle", {
        cx: end.x,
        cy: end.y,
        r: 4 + (index === phase.events.length - 2 ? 2 : 0),
        class: "route-node",
      });
      svg.appendChild(marker);
    }
  });
}

function drawShotMarker(svg) {
  const phase = currentPhase();
  if (!phase) {
    return;
  }
  const lastEvent = phase.events[phase.events.length - 1];
  const point = eventPoint(lastEvent.start);
  svg.appendChild(svgElement("circle", { cx: point.x, cy: point.y, r: 28, class: "shot-pulse" }));
  svg.appendChild(svgElement("circle", { cx: point.x, cy: point.y, r: 10, class: "shot-core" }));
}

function drawAnnotationPins(svg, positions) {
  const phase = currentPhase();
  const annotations = currentAnnotations();
  if (!phase || !annotations.length) {
    return;
  }

  annotations.forEach((annotation, index) => {
    const point = positions.get(annotation.playerId);
    if (!point) {
      return;
    }
    const offsetX = index % 2 === 0 ? 94 : -214;
    const offsetY = -90 + index * 78;
    const calloutX = clamp(point.x + offsetX, 90, 700);
    const calloutY = clamp(point.y + offsetY, 70, 520);
    const labelWidth = Math.min(220, Math.max(138, annotation.title.length * 7.1 + 26));

    svg.appendChild(
      svgElement("line", {
        x1: point.x,
        y1: point.y,
        x2: calloutX,
        y2: calloutY + 24,
        class: "annotation-line",
      }),
    );
    svg.appendChild(
      svgElement("circle", {
        cx: point.x,
        cy: point.y,
        r: 8,
        class: "annotation-anchor",
      }),
    );
    svg.appendChild(
      svgElement("rect", {
        x: calloutX,
        y: calloutY,
        rx: 14,
        width: labelWidth,
        height: 48,
        class: "annotation-pill",
      }),
    );
    const number = svgElement("text", {
      x: calloutX + 18,
      y: calloutY + 21,
      class: "annotation-index",
    });
    number.textContent = `${index + 1}`;
    svg.appendChild(number);

    const label = svgElement("text", {
      x: calloutX + 38,
      y: calloutY + 29,
      class: "annotation-label",
    });
    label.textContent = annotation.title;
    svg.appendChild(label);
  });
}

function drawNode(svg, player, phases, point) {
  if (!point) {
    return;
  }
  const group = svgElement("g", {
    class: `node-group${nodeDimmed(player.id, phases) ? " is-dimmed" : ""}`,
    tabindex: 0,
    role: "button",
    "aria-label": player.name,
  });
  const selected = state.activePlayerId === player.id;
  const inSelectedPhase = currentPhase()?.players.includes(player.id);
  const radius = inSelectedPhase ? 16 : 12 + Math.min(player.phaseCount, 6) * 0.75;

  group.appendChild(svgElement("circle", { cx: point.x, cy: point.y, r: radius + 10, class: "node-ring" }));
  group.appendChild(
    svgElement("circle", {
      cx: point.x,
      cy: point.y,
      r: radius,
      class: "node-core",
      fill: selected || inSelectedPhase ? "rgba(244, 162, 89, 0.98)" : "rgba(255,250,241,0.96)",
      stroke: selected ? "rgba(18,116,117,0.85)" : "rgba(255,255,255,0.78)",
      "stroke-width": selected ? 3.2 : 2.2,
    }),
  );

  const label = svgElement("text", {
    x: point.x,
    y: point.y - radius - 14,
    "text-anchor": "middle",
    class: "node-label",
  });
  label.textContent = player.name.replace("Roberto ", "Firmino ");
  group.appendChild(label);

  group.addEventListener("click", () => {
    state.activePlayerId = state.activePlayerId === player.id ? null : player.id;
    renderAll();
  });
  group.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      state.activePlayerId = state.activePlayerId === player.id ? null : player.id;
      renderAll();
    }
  });

  svg.appendChild(group);
}

function nodeDimmed(playerId, phases) {
  if (!state.activePlayerId) {
    return false;
  }
  if (playerId === state.activePlayerId) {
    return false;
  }
  return !phases.some((phase) => phase.players.includes(state.activePlayerId) && phase.players.includes(playerId));
}

function hyperedgeAlpha(phase) {
  if (state.selectedPhaseId === phase.id) {
    return 0.36;
  }
  if (state.activePlayerId && !phase.players.includes(state.activePlayerId)) {
    return 0.06;
  }
  return visiblePhases().length === 1 ? 0.28 : 0.15;
}

function graphAlpha(phase) {
  if (state.selectedPhaseId === phase.id) {
    return 0.92;
  }
  if (state.activePlayerId && !phase.players.includes(state.activePlayerId)) {
    return 0.1;
  }
  return visiblePhases().length === 1 ? 0.76 : 0.4;
}

function phaseColor(phaseId, alpha) {
  const color = PALETTE[PHASE_INDEX.get(phaseId) % PALETTE.length];
  return hexToRgba(color, alpha);
}

function pitchPoint(player) {
  const inner = { x: 88, y: 72, width: 784, height: 476 };
  return {
    x: inner.x + (player.avgX / 100) * inner.width,
    y: inner.y + (player.avgY / 100) * inner.height,
  };
}

function eventPoint(position) {
  const inner = { x: 88, y: 72, width: 784, height: 476 };
  return {
    x: inner.x + (position.x / 100) * inner.width,
    y: inner.y + (position.y / 100) * inner.height,
  };
}

function buildHyperedgePath(points) {
  if (!points.length) {
    return "";
  }
  if (points.length === 1) {
    return circlePath(points[0], 28);
  }
  if (points.length === 2) {
    return capsulePath(points[0], points[1], 28);
  }
  const hull = convexHull(points);
  if (!hull.length) {
    return "";
  }
  const centroid = {
    x: hull.reduce((sum, point) => sum + point.x, 0) / hull.length,
    y: hull.reduce((sum, point) => sum + point.y, 0) / hull.length,
  };
  const inflated = hull.map((point) => {
    const dx = point.x - centroid.x;
    const dy = point.y - centroid.y;
    const length = Math.hypot(dx, dy) || 1;
    const padding = 24;
    return {
      x: point.x + (dx / length) * padding,
      y: point.y + (dy / length) * padding,
    };
  });
  return smoothClosedPath(inflated);
}

function smoothClosedPath(points) {
  const midpoints = points.map((point, index) => midpoint(point, points[(index + 1) % points.length]));
  let path = `M ${midpoints[0].x.toFixed(2)} ${midpoints[0].y.toFixed(2)}`;
  for (let index = 0; index < points.length; index += 1) {
    const control = points[index];
    const nextMid = midpoints[(index + 1) % points.length];
    path += ` Q ${control.x.toFixed(2)} ${control.y.toFixed(2)} ${nextMid.x.toFixed(2)} ${nextMid.y.toFixed(2)}`;
  }
  return `${path} Z`;
}

function capsulePath(a, b, radius) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy) || 1;
  const ux = dx / length;
  const uy = dy / length;
  const px = -uy * radius;
  const py = ux * radius;
  const startTop = { x: a.x + px, y: a.y + py };
  const startBottom = { x: a.x - px, y: a.y - py };
  const endTop = { x: b.x + px, y: b.y + py };
  const endBottom = { x: b.x - px, y: b.y - py };
  return [
    `M ${startTop.x} ${startTop.y}`,
    `L ${endTop.x} ${endTop.y}`,
    `A ${radius} ${radius} 0 0 1 ${endBottom.x} ${endBottom.y}`,
    `L ${startBottom.x} ${startBottom.y}`,
    `A ${radius} ${radius} 0 0 1 ${startTop.x} ${startTop.y}`,
    "Z",
  ].join(" ");
}

function circlePath(center, radius) {
  return [
    `M ${center.x - radius} ${center.y}`,
    `A ${radius} ${radius} 0 1 0 ${center.x + radius} ${center.y}`,
    `A ${radius} ${radius} 0 1 0 ${center.x - radius} ${center.y}`,
    "Z",
  ].join(" ");
}

function edgeCurve(source, target) {
  const mx = (source.x + target.x) / 2;
  const my = (source.y + target.y) / 2;
  const curveHeight = Math.max(18, Math.min(72, Math.abs(source.x - target.x) * 0.18));
  return `M ${source.x} ${source.y} Q ${mx} ${my - curveHeight} ${target.x} ${target.y}`;
}

function midpoint(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function convexHull(points) {
  const unique = [...new Map(points.map((point) => [`${point.x}-${point.y}`, point])).values()].sort((left, right) =>
    left.x === right.x ? left.y - right.y : left.x - right.x,
  );
  if (unique.length <= 1) {
    return unique;
  }
  const cross = (origin, a, b) => (a.x - origin.x) * (b.y - origin.y) - (a.y - origin.y) * (b.x - origin.x);
  const lower = [];
  unique.forEach((point) => {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) {
      lower.pop();
    }
    lower.push(point);
  });
  const upper = [];
  [...unique].reverse().forEach((point) => {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) {
      upper.pop();
    }
    upper.push(point);
  });
  upper.pop();
  lower.pop();
  return lower.concat(upper);
}

function bindKeyboard() {
  document.addEventListener("keydown", (event) => {
    if (event.target && /input|textarea|select/i.test(event.target.tagName)) {
      return;
    }
    if (event.key === "ArrowRight") {
      cyclePhase(1);
    }
    if (event.key === "ArrowLeft") {
      cyclePhase(-1);
    }
    if (event.key.toLowerCase() === "g") {
      state.view = "graph";
      renderAll();
    }
    if (event.key.toLowerCase() === "h") {
      state.view = "hypergraph";
      renderAll();
    }
    if (event.key.toLowerCase() === "b") {
      state.view = "both";
      renderAll();
    }
  });
}

function cyclePhase(direction) {
  const phases = visiblePhases();
  if (!phases.length) {
    return;
  }
  const currentIndex = phases.findIndex((phase) => phase.id === state.selectedPhaseId);
  const nextIndex = currentIndex === -1 ? 0 : (currentIndex + direction + phases.length) % phases.length;
  state.selectedPhaseId = phases[nextIndex].id;
  renderAll();
}

function formatPhaseTime(second) {
  const whole = Math.max(0, Math.round(second));
  const minute = Math.floor(whole / 60);
  const remaining = `${whole % 60}`.padStart(2, "0");
  return `${minute}:${remaining}`;
}

function svgElement(tag, attributes = {}) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value));
  return node;
}

function hexToRgba(hex, alpha) {
  const clean = hex.replace("#", "");
  const value = clean.length === 3 ? clean.split("").map((digit) => digit + digit).join("") : clean;
  const channel = parseInt(value, 16);
  const red = (channel >> 16) & 255;
  const green = (channel >> 8) & 255;
  const blue = channel & 255;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
