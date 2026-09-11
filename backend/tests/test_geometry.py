"""Unit tests for the shared nearest_timestamp_index() helper — the fix for
the /model-column "silently falls back to the first cached timestamp" bug
(see CLAUDE.md's backend hardening entry)."""

from app.science.geometry import nearest_timestamp_index

TIMESTAMPS = [
    "2023-09-25T00:00:00Z",
    "2023-09-26T00:00:00Z",
    "2023-09-27T00:00:00Z",
    "2023-09-28T00:00:00Z",
    "2023-09-29T00:00:00Z",
    "2023-09-30T00:00:00Z",
    "2023-10-01T00:00:00Z",
    "2023-10-02T00:00:00Z",
    "2023-10-03T00:00:00Z",
    "2023-10-04T00:00:00Z",
    "2023-10-05T00:00:00Z",
]


def test_exact_match_returns_its_own_index():
    assert nearest_timestamp_index(TIMESTAMPS, "2023-09-28T00:00:00Z") == 3


def test_snaps_to_nearest_when_inexact_and_close_to_start():
    # 2023-09-25T11:00 is closer to 09-25 than 09-26
    assert nearest_timestamp_index(TIMESTAMPS, "2023-09-25T11:00:00Z") == 0


def test_snaps_to_nearest_when_far_from_the_first_timestamp():
    # The old bug: any inexact match fell back to index 0 (09-25), no matter
    # how far away the target actually was. 2023-10-04T23:00 must snap to
    # the LAST timestamp (index 10), not the first.
    idx = nearest_timestamp_index(TIMESTAMPS, "2023-10-04T23:00:00Z")
    assert idx == 10
    assert TIMESTAMPS[idx] == "2023-10-05T00:00:00Z"


def test_snaps_to_nearest_mid_range():
    # 2023-09-28T11:00 is 11h after 09-28 and 13h before 09-29 -> 09-28 wins
    idx = nearest_timestamp_index(TIMESTAMPS, "2023-09-28T11:00:00Z")
    assert TIMESTAMPS[idx] == "2023-09-28T00:00:00Z"


def test_tie_prefers_the_earlier_index():
    # Exactly midway between 09-28 and 09-29 (12h each way).
    idx = nearest_timestamp_index(TIMESTAMPS, "2023-09-28T12:00:00Z")
    assert TIMESTAMPS[idx] == "2023-09-28T00:00:00Z"


def test_empty_list_returns_negative_one_never_a_fabricated_index():
    assert nearest_timestamp_index([], "2023-09-28T00:00:00Z") == -1


def test_single_element_list_always_returns_it():
    assert nearest_timestamp_index(["2023-09-28T00:00:00Z"], "2099-01-01T00:00:00Z") == 0
