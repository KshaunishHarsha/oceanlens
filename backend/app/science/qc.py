"""Argo quality-control vocabulary.

Mirrors src/domain/quality.ts exactly. The mapping is not invented — it is the
Argo real-time QC flag scale, verified against real GDAC files during the
original data-harvest phase.
"""

from __future__ import annotations

QualityFlag = str  # Literal["GOOD", "PROBABLY_GOOD", "SUSPECT", "BAD"]

_FLAG_ORDER = ["GOOD", "PROBABLY_GOOD", "SUSPECT", "BAD"]

_ARGO_QC_MAP: dict[str, QualityFlag] = {
    "1": "GOOD",
    "2": "PROBABLY_GOOD",
    "3": "SUSPECT",
    "4": "BAD",
}

_PROFILE_LETTER_MAP: dict[str, QualityFlag] = {
    "A": "GOOD",
    "B": "PROBABLY_GOOD",
    "C": "SUSPECT",
    "D": "BAD",
    "E": "BAD",
    "F": "BAD",
}


def argo_qc_to_flag(ch: str) -> QualityFlag | None:
    """Map one Argo per-level QC character to our flag.

    Returns None for values that carry no quality judgement we display:
    '5' changed, '8' interpolated, '9' missing, ' ' not assessed.
    """
    return _ARGO_QC_MAP.get((ch or "").strip())


def profile_letter_to_flag(letter: str) -> QualityFlag | None:
    """Argo's PROFILE_<PARAM>_QC summary letter (A best .. F worst)."""
    return _PROFILE_LETTER_MAP.get((letter or "").strip().upper())


def worst_flag(flags: list[QualityFlag | None]) -> QualityFlag | None:
    """The most severe flag present, or None if every input is None."""
    present = [f for f in flags if f is not None]
    if not present:
        return None
    return max(present, key=_FLAG_ORDER.index)


def passes_good_only(flag: QualityFlag | None) -> bool:
    return flag in ("GOOD", "PROBABLY_GOOD")
