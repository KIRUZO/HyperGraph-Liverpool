from __future__ import annotations

import sys
import tempfile
from pathlib import Path
import unittest
from unittest.mock import patch
from urllib.error import URLError

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from build_dataset import (
    build_chapters,
    build_distribution_summary,
    build_pass_links,
    build_phase_comparison_metrics,
    build_phase_window,
    load_match_data,
    summarise_phase,
)


class BuildDatasetTests(unittest.TestCase):
    def setUp(self) -> None:
        self.players = {
            1: "Joe Gomez",
            2: "Mohamed Salah",
            3: "Emre Can",
            4: "Roberto Firmino",
            5: "Sadio Mane",
        }

    def event(
        self,
        sec: float,
        player_id: int,
        event_name: str,
        sub_event_name: str,
        start_x: float,
        start_y: float,
        end_x: float | None = None,
        end_y: float | None = None,
        *,
        tags: list[int] | None = None,
        period: str = "1H",
    ) -> dict:
        return {
            "eventId": 8,
            "eventName": event_name,
            "subEventName": sub_event_name,
            "playerId": player_id,
            "teamId": 1612,
            "matchPeriod": period,
            "eventSec": sec,
            "tags": [{"id": tag} for tag in (tags or [1801])],
            "positions": [
                {"x": start_x, "y": start_y},
                {"x": end_x if end_x is not None else start_x, "y": end_y if end_y is not None else start_y},
            ],
        }

    def test_build_phase_window_stops_at_large_gap(self) -> None:
        events = [
            self.event(100.0, 1, "Pass", "Simple pass", 20, 80, 30, 75),
            self.event(104.0, 2, "Pass", "Simple pass", 30, 75, 40, 70),
            self.event(109.0, 3, "Pass", "Cross", 40, 70, 82, 30),
            self.event(110.0, 4, "Shot", "Shot", 88, 50, tags=[101, 1801]),
            self.event(130.5, 5, "Pass", "Simple pass", 10, 10, 20, 20),
        ]

        phase = build_phase_window(events, 3, max_gap=12.0, max_events=9, max_span=26.0)

        self.assertEqual([event["playerId"] for event in phase], [1, 2, 3, 4])

    def test_build_pass_links_infers_receivers_from_next_team_action(self) -> None:
        phase_events = [
            self.event(100.0, 1, "Pass", "Simple pass", 20, 80, 30, 75),
            self.event(102.0, 2, "Pass", "Simple pass", 30, 75, 40, 70),
            self.event(104.0, 3, "Pass", "Cross", 40, 70, 82, 30),
            self.event(105.0, 4, "Shot", "Shot", 88, 50, tags=[101, 1801]),
        ]

        links = build_pass_links(phase_events)

        self.assertEqual(
            [(link["source"], link["target"], link["kind"]) for link in links],
            [(1, 2, "pass"), (2, 3, "pass"), (3, 4, "pass")],
        )

    def test_summarise_phase_captures_goal_and_players(self) -> None:
        phase_events = [
            self.event(100.0, 1, "Pass", "Simple pass", 18, 82, 28, 74),
            self.event(102.0, 2, "Pass", "Simple pass", 28, 74, 44, 66),
            self.event(104.0, 3, "Pass", "Cross", 44, 66, 86, 28),
            self.event(105.0, 4, "Shot", "Shot", 92, 48, tags=[101, 1801]),
        ]

        phase = summarise_phase(
            phase_id="phase-1",
            phase_events=phase_events,
            player_lookup=self.players,
        )

        self.assertEqual(phase["outcome"], "goal")
        self.assertEqual(phase["uniquePlayerCount"], 4)
        self.assertEqual(phase["lane"], "left")
        self.assertEqual(phase["label"], "1H 1' Roberto Firmino finishes the move")
        self.assertEqual(phase["players"], [1, 2, 3, 4])

    def test_build_distribution_summary_counts_patterns_and_lanes(self) -> None:
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
        self.assertEqual(summary["phaseSizeAverage"], 3.5)

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
        self.assertEqual(metrics["progression"], 48)

    def test_build_chapters_attaches_story_annotations(self) -> None:
        phases = [
            {
                "id": "phase-1",
                "outcome": "goal",
                "shotPlayerName": "Roberto Firmino",
                "players": [1, 2, 3, 4],
                "events": [
                    {"playerId": 1, "playerName": "Joe Gomez", "subEventName": "Cross"},
                    {"playerId": 4, "playerName": "Roberto Firmino", "subEventName": "Shot"},
                ],
                "impactScore": 90,
            }
        ]

        chapters = build_chapters(phases)
        firmino = next(chapter for chapter in chapters if chapter["id"] == "firmino-opener")

        self.assertIn("annotations", firmino)
        self.assertGreaterEqual(len(firmino["annotations"]), 1)
        self.assertIn("title", firmino["annotations"][0])

    def test_load_match_data_uses_local_cache_when_remote_fetch_fails(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            cache_path = Path(temp_dir) / "match.json"
            cache_path.write_text('{"events": [], "teams": {}, "players": {}}', encoding="utf-8")

            with patch("build_dataset.urlopen", side_effect=URLError("network down")):
                data = load_match_data(url="https://example.invalid/match.json", cache_path=cache_path)

        self.assertEqual(data["events"], [])


if __name__ == "__main__":
    unittest.main()
