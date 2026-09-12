"""Custom domain exceptions for OceanLens backend."""

from __future__ import annotations


class InvalidDateError(ValueError):
    """Raised when a date or timestamp string is not a valid ISO 8601 format."""

    pass
