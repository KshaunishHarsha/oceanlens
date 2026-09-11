from app.science.qc import (
    argo_qc_to_flag,
    passes_good_only,
    profile_letter_to_flag,
    worst_flag,
)


def test_maps_the_four_judgement_flags():
    assert argo_qc_to_flag("1") == "GOOD"
    assert argo_qc_to_flag("2") == "PROBABLY_GOOD"
    assert argo_qc_to_flag("3") == "SUSPECT"
    assert argo_qc_to_flag("4") == "BAD"


def test_returns_none_for_non_judgement_values():
    for ch in ("5", "8", "9", " ", "", "x"):
        assert argo_qc_to_flag(ch) is None


def test_good_only_filter():
    assert passes_good_only("GOOD") is True
    assert passes_good_only("PROBABLY_GOOD") is True
    assert passes_good_only("SUSPECT") is False
    assert passes_good_only("BAD") is False
    assert passes_good_only(None) is False


def test_profile_letters_including_real_incois_f_case():
    # INCOIS float 4903776 cycle 2 has PROFILE_TEMP_QC = F in the real cache.
    assert profile_letter_to_flag("A") == "GOOD"
    assert profile_letter_to_flag("B") == "PROBABLY_GOOD"
    assert profile_letter_to_flag("C") == "SUSPECT"
    assert profile_letter_to_flag("D") == "BAD"
    assert profile_letter_to_flag("E") == "BAD"
    assert profile_letter_to_flag("F") == "BAD"
    assert profile_letter_to_flag(" ") is None


def test_worst_flag():
    assert worst_flag(["GOOD", "GOOD", "SUSPECT"]) == "SUSPECT"
    assert worst_flag(["GOOD", "PROBABLY_GOOD"]) == "PROBABLY_GOOD"
    assert worst_flag(["BAD", "GOOD"]) == "BAD"
    assert worst_flag([]) is None
    assert worst_flag([None, None]) is None
