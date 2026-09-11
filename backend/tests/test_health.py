def test_health_ok(client):
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["service"] == "oceanlens-backend"
    assert body["cache_loaded"] is True
    assert body["cache_id"]


def test_health_cache_loaded_once(client, cache):
    r = client.get("/health")
    assert r.json()["cache_id"] == cache.cache_id
