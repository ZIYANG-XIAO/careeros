import json
import logging
from uuid import uuid4

import pytest
from conftest import make_integration_client, make_test_settings
from fastapi.testclient import TestClient
from test_application_memory import FakeJobParser, job_payload

from careeros_api.main import create_app
from careeros_api.rate_limit import WINDOW_SECONDS, SlidingWindowLimiter, ai_limiter


def test_request_id_is_echoed_or_generated_and_logged(caplog: pytest.LogCaptureFixture) -> None:
    client = TestClient(create_app(make_test_settings()))
    with caplog.at_level(logging.INFO, logger="careeros_api.access"):
        given = client.get("/me", headers={"X-Request-ID": "trace-abc-123"})
        generated = client.get(
            "/no-such-route?secret=do-not-log", headers={"X-Request-ID": "bad id!"}
        )
    assert given.headers["x-request-id"] == "trace-abc-123"
    assert len(generated.headers["x-request-id"]) == 32
    lines = [
        json.loads(record.getMessage())
        for record in caplog.records
        if record.name == "careeros_api.access"
    ]
    assert lines[0]["request_id"] == "trace-abc-123"
    assert lines[0]["route"] == "/me"
    assert lines[0]["status"] == 401
    assert lines[1]["route"] == "unmatched"
    assert lines[0]["method"] == "GET"
    assert "status" in lines[0] and "duration_ms" in lines[0]
    assert "do-not-log" not in json.dumps(lines)


def test_sliding_window_limiter() -> None:
    limiter = SlidingWindowLimiter()
    key = uuid4()
    assert limiter.check(key, 2, now=0.0) is None
    assert limiter.check(key, 2, now=1.0) is None
    wait = limiter.check(key, 2, now=2.0)
    assert wait == pytest.approx(WINDOW_SECONDS - 2.0)
    assert limiter.check(key, 2, now=WINDOW_SECONDS + 0.5) is None
    assert limiter.check(uuid4(), 2, now=2.0) is None


@pytest.mark.integration
@pytest.mark.asyncio
async def test_ai_endpoints_return_429_per_user() -> None:
    ai_limiter.reset()
    async with make_integration_client(
        job_parser=FakeJobParser(), ai_requests_per_minute=1
    ) as client:
        assert (await client.post("/jobs", json=job_payload())).status_code == 201
        limited = await client.post("/jobs", json=job_payload())
        assert limited.status_code == 429
        assert limited.json()["detail"]["code"] == "RATE_LIMITED"
        assert int(limited.headers["retry-after"]) >= 1
        # Non-AI endpoints are unaffected.
        assert (await client.get("/jobs")).status_code == 200
    ai_limiter.reset()
