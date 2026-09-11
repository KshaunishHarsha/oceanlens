"""Depth-profile interpolation.

Mirrors src/domain/stats.ts's interpolateProfile exactly: linear between
bracketing levels, and NEVER extrapolates beyond the measured range — a depth
outside [shallowest, deepest] returns None rather than a guessed value.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Level:
    depth_m: float
    value: float


def interpolate_profile(
    profile: list[Level], target_depths: list[float]
) -> list[float | None]:
    """`profile` must be sorted shallow-to-deep. Duplicate depths tolerated
    (the first wins, matching the TypeScript implementation)."""
    if not profile:
        return [None for _ in target_depths]

    shallowest = profile[0].depth_m
    deepest = profile[-1].depth_m

    out: list[float | None] = []
    for z in target_depths:
        if z < shallowest or z > deepest:
            out.append(None)
            continue
        value: float | None = None
        for i in range(len(profile) - 1):
            a, b = profile[i], profile[i + 1]
            if z == a.depth_m:
                value = a.value
                break
            if a.depth_m < z <= b.depth_m:
                span = b.depth_m - a.depth_m
                if span == 0:
                    value = a.value
                else:
                    f = (z - a.depth_m) / span
                    value = a.value + f * (b.value - a.value)
                break
        if value is None:
            value = profile[-1].value
        out.append(value)
    return out
