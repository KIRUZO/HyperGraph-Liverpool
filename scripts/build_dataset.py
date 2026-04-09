#!/usr/bin/env python3
from __future__ import annotations

import json
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path
from statistics import mean
from typing import Iterable
from urllib.error import URLError
from urllib.request import urlopen

MATCH_ID = 2499743
TEAM_ID = 1612
MATCH_URL = (
    "https://raw.githubusercontent.com/koenvo/"
    "wyscout-soccer-match-event-dataset/main/processed/files/2499743.json"
)
OUTPUT_PATH = Path(__file__).resolve().parents[1] / "data" / "liverpool_hypergraph_story.json"
OUTPUT_JS_PATH = Path(__file__).resolve().parents[1] / "data" / "liverpool_hypergraph_story.js"
RAW_CACHE_PATH = Path(__file__).resolve().parents[1] / "data" / "wyscout_2499743_raw.json"
MATCH_META = {
    "id": MATCH_ID,
    "title": "Liverpool 4-0 Arsenal",
    "season": "Premier League 2017/18",
    "date": "2017-08-27",
    "venue": "Anfield",
    "score": "4-0",
    "focusTeam": "Liverpool",
    "opponent": "Arsenal",
    "dataSource": "Wyscout open event data (processed by koenvo/wyscout-soccer-match-event-dataset)",
}


@dataclass
class PlayerInfo:
    player_id: int
    name: str
    role: str


def decode_text(value: str) -> str:
    return value.encode("utf-8").decode("unicode_escape") if "\\u" in value else value


def load_match_data(url: str = MATCH_URL, cache_path: Path = RAW_CACHE_PATH) -> dict:
    try:
        with urlopen(url) as response:
            payload = response.read().decode("utf-8")
        cache_path.parent.mkdir(parents=True, exist_ok=True)
        cache_path.write_text(payload, encoding="utf-8")
        return json.loads(payload)
    except Exception as error:
        if cache_path.exists():
            return json.loads(cache_path.read_text(encoding="utf-8"))
        raise URLError(error)


def build_player_lookup(match_data: dict) -> dict[int, PlayerInfo]:
    lookup: dict[int, PlayerInfo] = {}
    for team_players in match_data["players"].values():
        for item in team_players:
            player = item["player"]
            lookup[item["playerId"]] = PlayerInfo(
                player_id=item["playerId"],
                name=decode_text(player["shortName"]),
                role=decode_text(player["role"]["name"]),
            )
    return lookup


def player_name(player_lookup: dict, player_id: int) -> str:
    player = player_lookup[player_id]
    return player.name if hasattr(player, "name") else str(player)


def player_role(player_lookup: dict, player_id: int) -> str:
    player = player_lookup[player_id]
    return player.role if hasattr(player, "role") else "Unknown"


def absolute_seconds(event: dict) -> float:
    return float(event["eventSec"]) + (0.0 if event["matchPeriod"] == "1H" else 45.0 * 60.0)


def minute_number(event: dict) -> int:
    return int(absolute_seconds(event) // 60)


def minute_label(event: dict) -> str:
    return f"{minute_number(event)}'"


def is_goal(event: dict) -> bool:
    return any(tag["id"] == 101 for tag in event.get("tags", []))


def is_shot(event: dict) -> bool:
    return event.get("eventName") == "Shot" or "Shot" in event.get("subEventName", "")


def is_pass(event: dict) -> bool:
    return event.get("eventName") == "Pass"


def filtered_team_events(match_data: dict, team_id: int) -> list[dict]:
    return [
        event
        for event in match_data["events"]
        if event["teamId"] == team_id and event["eventName"] not in {"Interruption", "Offside"}
    ]


def build_phase_window(
    team_events: list[dict],
    end_index: int,
    *,
    max_gap: float = 12.0,
    max_events: int = 9,
    max_span: float = 26.0,
) -> list[dict]:
    phase = [team_events[end_index]]
    end_event = team_events[end_index]
    cursor = end_index - 1

    while cursor >= 0:
        candidate = team_events[cursor]
        next_event = phase[0]
        if candidate["matchPeriod"] != end_event["matchPeriod"]:
            break
        if next_event["eventSec"] - candidate["eventSec"] > max_gap:
            break
        phase.insert(0, candidate)
        if len(phase) >= max_events:
            break
        if end_event["eventSec"] - candidate["eventSec"] > max_span:
            break
        cursor -= 1

    return phase


def build_pass_links(phase_events: list[dict]) -> list[dict]:
    links: list[dict] = []
    for index, event in enumerate(phase_events[:-1]):
        if not is_pass(event):
            continue
        next_event = phase_events[index + 1]
        if next_event["playerId"] == event["playerId"]:
            continue
        links.append(
            {
                "source": event["playerId"],
                "target": next_event["playerId"],
                "kind": "pass",
                "subEventName": event["subEventName"],
            }
        )
    return links


def phase_players(phase_events: list[dict]) -> list[int]:
    ordered: list[int] = []
    seen: set[int] = set()
    for event in phase_events:
        player_id = event["playerId"]
        if player_id and player_id not in seen:
            ordered.append(player_id)
            seen.add(player_id)
    return ordered


def classify_lane(phase_events: list[dict]) -> str:
    attacking_lanes: list[float] = []
    for event in phase_events:
        end_position = event["positions"][-1]
        if end_position["x"] >= 70:
            attacking_lanes.append(float(end_position["y"]))
    if not attacking_lanes:
        attacking_lanes = [float(phase_events[-1]["positions"][0]["y"])]

    lane_value = mean(attacking_lanes)
    if lane_value <= 40:
        return "left"
    if lane_value >= 60:
        return "right"
    return "center"


def classify_pattern(phase_events: list[dict], unique_player_count: int) -> str:
    sub_events = {event["subEventName"] for event in phase_events}
    if unique_player_count <= 2:
        return "direct break"
    if "Cross" in sub_events:
        return "wide delivery"
    if "Smart pass" in sub_events:
        return "through-ball move"
    if any(event["subEventName"] == "Acceleration" for event in phase_events):
        return "vertical burst"
    if len(phase_events) >= 7:
        return "layered buildup"
    return "combination play"


def format_label(end_event: dict, player_lookup: dict[int, PlayerInfo]) -> str:
    scorer = player_name(player_lookup, end_event["playerId"])
    return f"{end_event['matchPeriod']} {minute_label(end_event)} {scorer} finishes the move"


def event_summary(event: dict, player_lookup: dict[int, PlayerInfo]) -> dict:
    start = event["positions"][0]
    end = event["positions"][-1]
    return {
        "absoluteSecond": round(absolute_seconds(event), 2),
        "second": round(float(event["eventSec"]), 2),
        "minute": minute_label(event),
        "period": event["matchPeriod"],
        "playerId": event["playerId"],
        "playerName": player_name(player_lookup, event["playerId"]),
        "eventName": event["eventName"],
        "subEventName": event["subEventName"],
        "start": {"x": start["x"], "y": start["y"]},
        "end": {"x": end["x"], "y": end["y"]},
        "isShot": is_shot(event),
        "isGoal": is_goal(event),
    }


def summarise_phase(
    phase_id: str,
    phase_events: list[dict],
    player_lookup: dict[int, PlayerInfo],
) -> dict:
    end_event = phase_events[-1]
    players = phase_players(phase_events)
    links = build_pass_links(phase_events)
    unique_player_count = len(players)
    progression = round(end_event["positions"][0]["x"] - phase_events[0]["positions"][0]["x"], 2)
    outcome = "goal" if is_goal(end_event) else "shot"
    lane = classify_lane(phase_events)
    impact_score = (
        (40 if outcome == "goal" else 0)
        + unique_player_count * 4
        + len(phase_events)
        + max(0.0, progression)
    )

    return {
        "id": phase_id,
        "label": format_label(end_event, player_lookup),
        "minute": minute_label(end_event),
        "absoluteSecond": round(absolute_seconds(end_event), 2),
        "period": end_event["matchPeriod"],
        "startSecond": round(absolute_seconds(phase_events[0]), 2),
        "duration": round(absolute_seconds(end_event) - absolute_seconds(phase_events[0]), 2),
        "outcome": outcome,
        "lane": lane,
        "pattern": classify_pattern(phase_events, unique_player_count),
        "shotPlayerId": end_event["playerId"],
        "shotPlayerName": player_name(player_lookup, end_event["playerId"]),
        "players": players,
        "uniquePlayerCount": unique_player_count,
        "eventCount": len(phase_events),
        "progression": progression,
        "impactScore": round(impact_score, 2),
        "links": links,
        "events": [event_summary(event, player_lookup) for event in phase_events],
    }


def build_phase_comparison_metrics(phase: dict) -> dict:
    hyperedge_order = len(phase["players"])
    graph_edge_count = len(phase["links"])
    potential_pair_count = max(0, hyperedge_order * (hyperedge_order - 1) // 2)
    higher_order_delta = max(0, potential_pair_count - graph_edge_count)
    connectivity_ratio = round(graph_edge_count / potential_pair_count, 2) if potential_pair_count else 1.0
    return {
        "hyperedgeOrder": hyperedge_order,
        "graphEdgeCount": graph_edge_count,
        "potentialPairCount": potential_pair_count,
        "higherOrderDelta": higher_order_delta,
        "connectivityRatio": connectivity_ratio,
        "progression": phase.get("progression", 0),
        "duration": phase.get("duration", 0),
    }


def build_distribution_summary(phases: list[dict]) -> dict:
    outcomes = Counter(phase["outcome"] for phase in phases)
    lanes = Counter(phase["lane"] for phase in phases)
    patterns = Counter(phase["pattern"] for phase in phases)
    return {
        "outcomes": dict(outcomes),
        "lanes": dict(lanes),
        "patterns": dict(patterns),
        "phaseSizeAverage": round(mean(len(phase["players"]) for phase in phases), 2) if phases else 0.0,
    }


def deduplicate_phases(phases: list[dict], min_gap: float = 10.0) -> list[dict]:
    kept: list[dict] = []
    for phase in phases:
        if not kept:
            kept.append(phase)
            continue
        previous = kept[-1]
        same_period = phase["period"] == previous["period"]
        close_in_time = phase["absoluteSecond"] - previous["absoluteSecond"] <= min_gap
        if same_period and close_in_time:
            better = phase if phase["impactScore"] >= previous["impactScore"] else previous
            kept[-1] = better
        else:
            kept.append(phase)
    return kept


def build_player_nodes(phases: list[dict], player_lookup: dict[int, PlayerInfo]) -> list[dict]:
    positions: dict[int, list[tuple[float, float]]] = defaultdict(list)
    involvement = Counter()

    for phase in phases:
        for event in phase["events"]:
            positions[event["playerId"]].append((event["start"]["x"], event["start"]["y"]))
        for player_id in phase["players"]:
            involvement[player_id] += 1

    nodes = []
    for player_id, coords in sorted(
        positions.items(),
        key=lambda item: (-involvement[item[0]], player_lookup[item[0]].name),
    ):
        avg_x = round(mean(x for x, _ in coords), 2)
        avg_y = round(mean(y for _, y in coords), 2)
        nodes.append(
            {
                "id": player_id,
                "name": player_name(player_lookup, player_id),
                "role": player_role(player_lookup, player_id),
                "avgX": avg_x,
                "avgY": avg_y,
                "phaseCount": involvement[player_id],
            }
        )
    return nodes


def summarise_network(phases: list[dict], player_lookup: dict[int, PlayerInfo]) -> dict:
    player_counter = Counter()
    edge_counter = Counter()
    group_signatures = Counter()

    for phase in phases:
        player_counter.update(phase["players"])
        edge_counter.update((link["source"], link["target"]) for link in phase["links"])
        group_signatures.update([tuple(phase["players"])])

    top_players = [
        {
            "playerId": player_id,
            "name": player_name(player_lookup, player_id),
            "phaseCount": count,
        }
        for player_id, count in player_counter.most_common(6)
    ]
    top_edges = [
        {
            "source": source,
            "sourceName": player_name(player_lookup, source),
            "target": target,
            "targetName": player_name(player_lookup, target),
            "count": count,
        }
        for (source, target), count in edge_counter.most_common(6)
    ]
    top_groups = [
        {
            "players": list(group),
            "playerNames": [player_name(player_lookup, player_id) for player_id in group],
            "count": count,
        }
        for group, count in group_signatures.most_common(4)
    ]

    return {
        "selectedPhaseCount": len(phases),
        "goalPhaseCount": sum(1 for phase in phases if phase["outcome"] == "goal"),
        "highestOrder": max(len(phase["players"]) for phase in phases),
        "averagePhaseSize": round(mean(len(phase["players"]) for phase in phases), 2),
        "topPlayers": top_players,
        "topEdges": top_edges,
        "topGroups": top_groups,
    }


def chapter_for_phase(phase: dict) -> str | None:
    if phase["outcome"] == "goal" and phase["shotPlayerName"] == "Roberto Firmino":
        return "firmino-opener"
    if phase["outcome"] == "goal" and phase["shotPlayerName"] == "S. Mané":
        return "mane-overload"
    if phase["outcome"] == "goal" and phase["shotPlayerName"] == "Mohamed Salah":
        return "salah-transition"
    if phase["outcome"] == "goal" and phase["shotPlayerName"] == "D. Sturridge":
        return "sturridge-finish"
    return None


def build_chapter_annotations(chapter_id: str, phase: dict) -> list[dict]:
    events = phase.get("events", [])
    annotations: list[dict] = []
    if not events:
        return annotations

    if chapter_id == "firmino-opener":
        first = events[0]
        last = events[-1]
        annotations.append(
            {
                "playerId": first["playerId"],
                "title": "Gomez supplies the width",
                "body": "Liverpool keep the overload alive through a repeat wide involvement before the final delivery.",
                "kind": "build",
            }
        )
        annotations.append(
            {
                "playerId": last["playerId"],
                "title": "Firmino attacks the final gap",
                "body": "The finish completes a four-player action that is clearer as one coordinated hyperedge than as isolated pass links.",
                "kind": "finish",
            }
        )
    elif chapter_id == "mane-overload":
        annotations.append(
            {
                "playerId": events[0]["playerId"],
                "title": "The move starts deep and climbs in layers",
                "body": "Liverpool advance through successive supporting touches before Mane receives the final attacking advantage.",
                "kind": "build",
            }
        )
        annotations.append(
            {
                "playerId": events[-1]["playerId"],
                "title": "Mane attacks the inside-left channel",
                "body": "This chapter works well as a higher-order relation because the danger comes from the group shape, not only the final shot.",
                "kind": "finish",
            }
        )
    elif chapter_id == "salah-transition":
        annotations.append(
            {
                "playerId": events[-1]["playerId"],
                "title": "Transition becomes almost pairwise",
                "body": "This phase is intentionally sparse, which makes it useful for contrasting graph and hypergraph views.",
                "kind": "compare",
            }
        )
    elif chapter_id == "sturridge-finish":
        annotations.append(
            {
                "playerId": events[-2]["playerId"],
                "title": "Salah creates the final delivery",
                "body": "The cross is only one step in a multi-role sequence that spans buildup, burst, delivery, and finish.",
                "kind": "build",
            }
        )
        annotations.append(
            {
                "playerId": events[-1]["playerId"],
                "title": "Sturridge finishes the hyperedge",
                "body": "The final shot closes a dense, high-order action that feels more complete as one group relation.",
                "kind": "finish",
            }
        )
    return annotations


def build_chapters(phases: list[dict]) -> list[dict]:
    overview_ids = [phase["id"] for phase in sorted(phases, key=lambda item: -item["impactScore"])[:8]]
    phase_lookup = {phase["id"]: phase for phase in phases}
    chapters = [
        {
            "id": "overview",
            "title": "Match Overview",
            "mode": "story",
            "phaseIds": overview_ids,
            "summary": "Liverpool's strongest attacking moves usually involve four to six players before the shot. In hypergraph mode, those group actions stay visible as one coordinated relation instead of being flattened into isolated pass links.",
            "annotations": [],
        }
    ]

    chapter_meta = {
        "firmino-opener": (
            "Firmino Opener",
            "The opening goal emerges from a right-side overload: Gomez steps up, Salah keeps the ball alive, Can recycles the attack, and Firmino finishes the cross.",
        ),
        "mane-overload": (
            "Mane Through the Left Half-Space",
            "Liverpool move the ball through Gomez, Wijnaldum, Can, and Firmino before Mane attacks the inside-left lane. This is a clean five-player hyperedge.",
        ),
        "salah-transition": (
            "Salah in Transition",
            "This move is intentionally sparse. Hypergraph mode collapses almost to a graph, showing how a direct transition differs from Liverpool's multi-player buildup patterns.",
        ),
        "sturridge-finish": (
            "Late Cross, Late Finish",
            "The fourth goal combines Firmino's layoff, Can's acceleration, Salah's cross, and Sturridge's finish. It is a textbook higher-order action group built from multiple roles.",
        ),
    }

    for phase in phases:
        chapter_id = chapter_for_phase(phase)
        if chapter_id and chapter_id in chapter_meta:
            title, summary = chapter_meta[chapter_id]
            chapters.append(
                {
                    "id": chapter_id,
                    "title": title,
                    "mode": "story",
                    "phaseIds": [phase["id"]],
                    "summary": summary,
                    "annotations": build_chapter_annotations(chapter_id, phase),
                }
            )

    chapters.append(
        {
            "id": "explore",
            "title": "Free Explore",
            "mode": "explore",
            "phaseIds": [phase["id"] for phase in phases],
            "summary": "Switch filters, compare graph versus hypergraph views, and inspect how the player group changes from one Liverpool attacking phase to the next.",
            "annotations": [],
        }
    )
    return chapters


def build_story_dataset(match_data: dict) -> dict:
    player_lookup = build_player_lookup(match_data)
    team_events = filtered_team_events(match_data, TEAM_ID)
    candidate_phases = []

    for index, event in enumerate(team_events):
        if not is_shot(event):
            continue
        phase_events = build_phase_window(team_events, index)
        phase = summarise_phase(
            phase_id=f"phase-{len(candidate_phases) + 1:02d}",
            phase_events=phase_events,
            player_lookup=player_lookup,
        )
        candidate_phases.append(phase)

    deduped = deduplicate_phases(candidate_phases)
    selected = [
        phase
        for phase in deduped
        if phase["uniquePlayerCount"] >= 3 or phase["outcome"] == "goal"
    ]

    reindexed = []
    for index, phase in enumerate(selected, start=1):
        phase = dict(phase)
        phase["id"] = f"phase-{index:02d}"
        phase["comparison"] = build_phase_comparison_metrics(phase)
        reindexed.append(phase)

    nodes = build_player_nodes(reindexed, player_lookup)
    summary = summarise_network(reindexed, player_lookup)
    summary_breakdown = build_distribution_summary(reindexed)
    chapters = build_chapters(reindexed)

    return {
        "match": MATCH_META,
        "legend": {
            "hypergraph": "Each translucent shape is one coordinated Liverpool attacking phase.",
            "graph": "Pairwise links only show the pass-to-pass skeleton of the same move.",
        },
        "players": nodes,
        "phases": reindexed,
        "chapters": chapters,
        "summary": summary,
        "summaryBreakdown": summary_breakdown,
        "presentation": {
            "autoplayOrder": ["overview", "firmino-opener", "mane-overload", "salah-transition", "sturridge-finish"],
            "defaultSpeedMs": 3200,
        },
    }


def main(output_path: Path = OUTPUT_PATH, output_js_path: Path = OUTPUT_JS_PATH) -> None:
    dataset = build_story_dataset(load_match_data())
    output_path.parent.mkdir(parents=True, exist_ok=True)
    serialized = json.dumps(dataset, ensure_ascii=False, indent=2)
    output_path.write_text(serialized, encoding="utf-8")
    output_js_path.write_text(
        f"window.LIVERPOOL_HYPERGRAPH_DATA = {serialized};\n",
        encoding="utf-8",
    )
    print(f"Wrote dataset to {output_path}")
    print(f"Wrote browser bundle to {output_js_path}")


if __name__ == "__main__":
    main()
