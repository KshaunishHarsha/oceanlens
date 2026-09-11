"""Pressure-to-depth conversion.

UNESCO 1983 (Saunders & Fofonoff), latitude-dependent. Identical formula to
scripts/lib/netcdf.mjs's pressureToDepthM — kept in one place per language so
a raw-NetCDF ingestion path (Python) and the existing Node prep script agree
bit-for-bit on the same input.
"""

from __future__ import annotations

import math


def pressure_to_depth_m(pressure_dbar: float, latitude_deg: float) -> float:
    x = math.sin(math.radians(latitude_deg)) ** 2
    gravity = 9.780318 * (1.0 + (5.2788e-3 + 2.36e-5 * x) * x) + 1.092e-6 * pressure_dbar
    p = pressure_dbar
    return (
        ((((-1.82e-15 * p + 2.279e-10) * p - 2.2512e-5) * p + 9.72659) * p) / gravity
    )
