"""Request IDs and one structured access-log line per request.

The log line carries only the route template, method, status, and duration —
never query strings, bodies, tokens, or user identifiers.
"""

import json
import logging
import re
import time
from contextvars import ContextVar
from uuid import uuid4

from starlette.types import ASGIApp, Message, Receive, Scope, Send

REQUEST_ID_HEADER = "x-request-id"
_VALID_REQUEST_ID = re.compile(r"^[A-Za-z0-9._-]{8,64}$")

request_id_var: ContextVar[str | None] = ContextVar("request_id", default=None)
access_logger = logging.getLogger("careeros_api.access")


def current_request_id() -> str | None:
    return request_id_var.get()


class RequestContextMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        incoming = (
            dict(scope.get("headers") or []).get(REQUEST_ID_HEADER.encode(), b"").decode("latin-1")
        )
        request_id = incoming if _VALID_REQUEST_ID.match(incoming) else uuid4().hex
        token = request_id_var.set(request_id)
        started = time.perf_counter()
        status_code = 500

        async def send_with_id(message: Message) -> None:
            nonlocal status_code
            if message["type"] == "http.response.start":
                status_code = message["status"]
                headers = list(message.get("headers", []))
                headers.append((REQUEST_ID_HEADER.encode(), request_id.encode()))
                message["headers"] = headers
            await send(message)

        try:
            await self.app(scope, receive, send_with_id)
        finally:
            route = scope.get("route")
            access_logger.info(
                json.dumps(
                    {
                        "event": "request",
                        "request_id": request_id,
                        "method": scope.get("method"),
                        "route": getattr(route, "path", "unmatched"),
                        "status": status_code,
                        "duration_ms": round((time.perf_counter() - started) * 1000, 1),
                    }
                )
            )
            request_id_var.reset(token)
