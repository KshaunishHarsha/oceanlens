"""Scientific statistics. Mirrors src/domain/stats.ts exactly.

Every function here is pure and operates on the arrays the API returns.
Nothing may report an RMSE, bias, distance, offset or agreement figure that
was not produced by one of these functions from real cached data.

Bias convention throughout: `model - observation`.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True)
class Pair:
    depth_m: float
    observed: float
    modeled: float


def pair_finite(
    depths_m: list[float],
    observed: list[float | None],
    modeled: list[float | None],
) -> list[Pair]:
    """Keep only levels where both series have a finite value."""
    out: list[Pair] = []
    n = min(len(depths_m), len(observed), len(modeled))
    for i in range(n):
        d, o, m = depths_m[i], observed[i], modeled[i]
        if (
            d is not None
            and o is not None
            and m is not None
            and math.isfinite(d)
            and math.isfinite(o)
            and math.isfinite(m)
        ):
            out.append(Pair(depth_m=d, observed=o, modeled=m))
    return out


def calculate_rmse(observed: list[float | None], modeled: list[float | None]) -> float:
    n = min(len(observed), len(modeled))
    if n == 0:
        return float("nan")
    sum_sq = 0.0
    count = 0
    for i in range(n):
        o, m = observed[i], modeled[i]
        if o is None or m is None or not math.isfinite(o) or not math.isfinite(m):
            continue
        d = m - o
        sum_sq += d * d
        count += 1
    return math.sqrt(sum_sq / count) if count else float("nan")


def calculate_mean_bias(observed: list[float | None], modeled: list[float | None]) -> float:
    n = min(len(observed), len(modeled))
    if n == 0:
        return float("nan")
    total = 0.0
    count = 0
    for i in range(n):
        o, m = observed[i], modeled[i]
        if o is None or m is None or not math.isfinite(o) or not math.isfinite(m):
            continue
        total += m - o
        count += 1
    return total / count if count else float("nan")


def calculate_time_offset_hours(observation_iso: str, model_iso: str) -> float:
    """Signed difference in hours: observation time minus model time."""
    from app.errors import InvalidDateError

    try:
        obs = datetime.fromisoformat(observation_iso.replace("Z", "+00:00"))
        mod = datetime.fromisoformat(model_iso.replace("Z", "+00:00"))
    except (ValueError, TypeError, AttributeError) as e:
        raise InvalidDateError(
            f"invalid date format: '{observation_iso}' / '{model_iso}'. "
            "Expected ISO 8601 strings (e.g. 2023-09-25T00:00:00Z)"
        ) from e
    return (obs - mod).total_seconds() / 3600.0


@dataclass(frozen=True)
class BandDefinition:
    from_m: float
    to_m: float


@dataclass(frozen=True)
class BandAgreement:
    from_m: float
    to_m: float
    mean_delta: float
    rmse: float
    sample_count: int
    verdict: str  # "High" | "Fair" | "Moderate" | "Low"


def calculate_band_agreement(
    pairs: list[Pair], bands: list[BandDefinition], tolerance: float
) -> list[BandAgreement]:
    out: list[BandAgreement] = []
    for band in bands:
        in_band = [p for p in pairs if band.from_m <= p.depth_m <= band.to_m]
        obs = [p.observed for p in in_band]
        mod = [p.modeled for p in in_band]
        rmse = calculate_rmse(obs, mod)
        mean_delta = calculate_mean_bias(obs, mod)
        rel = rmse / tolerance if (math.isfinite(rmse) and tolerance > 0) else math.inf
        if rel < 0.4:
            verdict = "High"
        elif rel < 0.8:
            verdict = "Fair"
        elif rel < 1.4:
            verdict = "Moderate"
        else:
            verdict = "Low"
        out.append(
            BandAgreement(
                from_m=band.from_m,
                to_m=band.to_m,
                mean_delta=mean_delta,
                rmse=rmse,
                sample_count=len(in_band),
                verdict=verdict,
            )
        )
    return out


def build_scientific_interpretation(
    *,
    unit: str,
    bias_words: tuple[str, str],
    structure_name: str,
    overall_rmse: float,
    overall_bias: float,
    bands: list[BandAgreement],
    sample_count: int,
) -> str:
    """Deterministic plain-language reading of a comparison. Same input, same
    sentence. No hedging beyond what the numbers support."""
    if sample_count == 0:
        return (
            "No quality-controlled levels overlap between this profile and the "
            "model column, so no comparison can be made."
        )

    agree_bands = [b for b in bands if b.verdict in ("High", "Fair")]
    poor_bands = [b for b in bands if b.verdict in ("Moderate", "Low")]

    parts: list[str] = []
    if agree_bands:
        deepest_agree = max(b.to_m for b in agree_bands)
        parts.append(
            f"Observed and modelled profiles agree through {deepest_agree:g} m "
            f"(overall RMSE {overall_rmse:.2f} {unit})."
        )
    else:
        parts.append(
            f"Observed and modelled profiles disagree at all depths "
            f"(overall RMSE {overall_rmse:.2f} {unit})."
        )

    if poor_bands:
        worst = max(poor_bands, key=lambda b: abs(b.mean_delta))
        direction = bias_words[0] if worst.mean_delta >= 0 else bias_words[1]
        parts.append(
            f"A {direction} model bias of {abs(worst.mean_delta):.2f} {unit} emerges over "
            f"{worst.from_m:g}–{worst.to_m:g} m, near the {structure_name}."
        )

    dir_overall = bias_words[0] if overall_bias >= 0 else bias_words[1]
    sign = "+" if overall_bias >= 0 else "−"
    parts.append(
        f"Mean bias {sign}{abs(overall_bias):.2f} {unit} (model {dir_overall} than observed), "
        f"n = {sample_count} levels."
    )
    return " ".join(parts)
