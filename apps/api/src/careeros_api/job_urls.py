"""Stable identities for job page URLs."""

from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

# Query parameters that only track referral/campaign origin and never identify
# the posting itself. Anything else is kept because many boards put the job ID
# in the query string (for example Greenhouse's gh_jid).
_TRACKING_QUERY_PARAMS = frozenset(
    {"ref", "source", "src", "referrer", "gh_src", "lever-source", "lever-origin", "trk"}
)


def canonical_clip_url(value: str) -> str | None:
    """Return a stable identity for a clipped page URL, or None if unsupported."""
    try:
        parsed = urlsplit(value)
        if parsed.scheme not in {"http", "https"} or parsed.hostname is None:
            return None
        port = parsed.port
    except ValueError:
        return None
    host = parsed.hostname.casefold()
    default_port = 80 if parsed.scheme == "http" else 443
    port_suffix = f":{port}" if port is not None and port != default_port else ""
    path = parsed.path.rstrip("/") or "/"
    query = urlencode(
        sorted(
            (key, item)
            for key, item in parse_qsl(parsed.query, keep_blank_values=False)
            if key.casefold() not in _TRACKING_QUERY_PARAMS
            and not key.casefold().startswith("utm_")
        )
    )
    return urlunsplit((parsed.scheme.casefold(), f"{host}{port_suffix}", path, query, ""))
