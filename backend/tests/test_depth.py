from app.science.depth import pressure_to_depth_m


def test_surface_pressure_is_near_zero_depth():
    d = pressure_to_depth_m(0.0, 13.0)
    assert abs(d) < 0.01


def test_matches_a_hand_checked_real_value():
    # Real Argo level from WMO 1902594 (Phase-0 audit): 3.5 dbar at 9.11N.
    d = pressure_to_depth_m(3.5, 9.11)
    assert 3.3 < d < 3.6


def test_depth_increases_with_pressure():
    shallow = pressure_to_depth_m(100.0, 15.0)
    deep = pressure_to_depth_m(1000.0, 15.0)
    assert deep > shallow


def test_latitude_dependence_is_small_but_present():
    equator = pressure_to_depth_m(2000.0, 0.0)
    pole = pressure_to_depth_m(2000.0, 60.0)
    assert equator != pole
    assert abs(equator - pole) < 15  # gravity correction is a small effect
