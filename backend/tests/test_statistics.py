import math

from app.science.geometry import GeoPoint, haversine_km, nearest_index
from app.science.interpolation import Level, interpolate_profile
from app.science.statistics import (
    BandDefinition,
    build_scientific_interpretation,
    calculate_band_agreement,
    calculate_mean_bias,
    calculate_rmse,
    calculate_time_offset_hours,
    pair_finite,
)


def test_rmse_matches_hand_computed_value():
    # deltas (model-obs): +1, -1, +2 -> sqrt((1+1+4)/3) = sqrt(2)
    assert math.isclose(calculate_rmse([10, 20, 30], [11, 19, 32]), math.sqrt(2), rel_tol=1e-12)


def test_rmse_zero_for_identical_series():
    assert calculate_rmse([1, 2, 3], [1, 2, 3]) == 0


def test_rmse_ignores_missing_levels():
    assert calculate_rmse([10, 20, 30], [11, None, 31]) == 1


def test_rmse_nan_when_nothing_overlaps():
    assert math.isnan(calculate_rmse([], []))
    assert math.isnan(calculate_rmse([1, 2], [None, None]))


def test_mean_bias_matches_hand_computed_value():
    assert math.isclose(calculate_mean_bias([10, 20, 30], [11, 19, 32]), 2 / 3, rel_tol=1e-12)


def test_mean_bias_signs_correctly():
    assert calculate_mean_bias([20, 20], [19, 19]) == -1


def test_interpolate_profile_exact_at_nodes():
    profile = [Level(0, 30), Level(100, 20), Level(200, 14)]
    assert interpolate_profile(profile, [0, 100, 200]) == [30, 20, 14]


def test_interpolate_profile_linear_between_nodes():
    profile = [Level(0, 30), Level(100, 20), Level(200, 14)]
    assert math.isclose(interpolate_profile(profile, [50])[0], 25, rel_tol=1e-12)
    assert math.isclose(interpolate_profile(profile, [150])[0], 17, rel_tol=1e-12)


def test_interpolate_profile_never_extrapolates():
    profile = [Level(0, 30), Level(100, 20), Level(200, 14)]
    assert interpolate_profile(profile, [-10, 250]) == [None, None]


def test_interpolate_profile_empty():
    assert interpolate_profile([], [0, 50]) == [None, None]


def test_pair_finite_keeps_only_fully_finite_levels():
    pairs = pair_finite([0, 50, 100, 150], [30, None, 20, 18], [29, 25, float("nan"), 17.5])
    assert [(p.depth_m, p.observed, p.modeled) for p in pairs] == [(0, 30, 29), (150, 18, 17.5)]


def test_haversine_matches_real_bay_of_bengal_pair():
    # Real Argo positions, 2023-09-29: floats 5907082 and 5907083.
    d = haversine_km(GeoPoint(13.3167, 83.7167), GeoPoint(13.2, 86.7167))
    assert 320 < d < 330


def test_haversine_zero_for_coincident_points():
    p = GeoPoint(16.82, 88.31)
    assert haversine_km(p, p) < 1e-9


def test_nearest_index():
    axis = [0, 10, 20, 50, 100]
    assert nearest_index(axis, 12) == 1
    assert nearest_index(axis, 16) == 2
    assert nearest_index(axis, -5) == 0
    assert nearest_index(axis, 999) == 4


def test_time_offset_signed_hours():
    assert math.isclose(
        calculate_time_offset_hours("2023-09-29T14:05:00Z", "2023-09-29T00:00:00Z"),
        14.0833,
        abs_tol=1e-3,
    )
    assert calculate_time_offset_hours("2023-09-28T22:00:00Z", "2023-09-29T00:00:00Z") == -2


def test_band_agreement_verdicts():
    pairs = pair_finite(
        [10, 40, 120, 180, 400],
        [29, 28, 20, 16, 10],
        [29.1, 28.2, 22, 17.6, 10.1],
    )
    bands = calculate_band_agreement(
        pairs, [BandDefinition(0, 50), BandDefinition(100, 200), BandDefinition(300, 500)], 1.0
    )
    assert bands[0].verdict == "High"
    assert bands[1].verdict == "Low"
    assert bands[2].verdict == "High"
    assert bands[1].sample_count == 2


def test_interpretation_is_deterministic():
    kwargs = dict(
        unit="°C",
        bias_words=("warmer", "cooler"),
        structure_name="thermocline",
        overall_rmse=0.72,
        overall_bias=0.31,
        sample_count=68,
        bands=calculate_band_agreement(
            pair_finite([10, 250], [29, 15], [29.1, 15.9]),
            [BandDefinition(0, 100), BandDefinition(100, 300)],
            0.3,
        ),
    )
    assert build_scientific_interpretation(**kwargs) == build_scientific_interpretation(**kwargs)


def test_interpretation_empty_overlap():
    s = build_scientific_interpretation(
        unit="°C",
        bias_words=("warmer", "cooler"),
        structure_name="thermocline",
        overall_rmse=float("nan"),
        overall_bias=float("nan"),
        bands=[],
        sample_count=0,
    )
    assert "no comparison can be made" in s.lower()
