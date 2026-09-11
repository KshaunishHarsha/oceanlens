from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.data.cache_reader import get_cache
from app.main import app


@pytest.fixture(scope="session")
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture(scope="session")
def cache():
    return get_cache()
