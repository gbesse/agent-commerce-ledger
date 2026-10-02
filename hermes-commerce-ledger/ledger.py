"""Local receipt storage shared in shape with the OpenClaw extension."""

from __future__ import annotations

import hashlib
import hmac
import json
import os
from datetime import datetime, timezone
from pathlib import Path


def _clean(value):
    return value if isinstance(value, str) and 0 < len(value) <= 512 else None


def _create_if_absent(directory: Path, name: str, data: bytes) -> bool:
    temporary = directory / f".tmp-{os.urandom(16).hex()}"
    fd = os.open(temporary, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    try:
        with os.fdopen(fd, "wb") as stream:
            stream.write(data)
        try:
            os.link(temporary, directory / name)
            return True
        except FileExistsError:
            return False
    finally:
        temporary.unlink(missing_ok=True)


def _secret(directory: Path) -> bytes:
    directory.mkdir(mode=0o700, parents=True, exist_ok=True)
    os.chmod(directory, 0o700)
    path = directory / "secret"
    _create_if_absent(directory, "secret", os.urandom(32))
    os.chmod(path, 0o600)
    secret = path.read_bytes()
    if len(secret) != 32:
        raise ValueError("E_SECRET_INVALID")
    return secret


def record_receipt(directory, input_event):
    kind = _clean(input_event.get("kind"))
    channel = _clean(input_event.get("channel"))
    account = _clean(input_event.get("account")) or "default"
    message_id = _clean(input_event.get("messageId"))
    party_id = _clean(input_event.get("partyId"))
    if kind not in ("inbound", "outbound") or not all((channel, message_id, party_id)):
        return {"recorded": False, "reason": "missing_identity"}

    directory = Path(directory)
    secret = _secret(directory)

    def digest(*parts):
        payload = json.dumps(parts, ensure_ascii=False, separators=(",", ":")).encode()
        return hmac.new(secret, payload, hashlib.sha256).hexdigest()

    status = "received" if kind == "inbound" else "failed" if input_event.get("success") is False else "observed"
    event_id = digest(kind, channel, account, party_id, message_id, status)
    receipt = {
        "schema": "commerce-ledger.v1",
        "id": event_id,
        "kind": kind,
        "channel": channel,
        "accountRef": digest("account", channel, account),
        "partyRef": digest("party", channel, account, party_id),
        "messageRef": digest("message", channel, account, message_id),
        "status": status,
        "observedAt": datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z"),
    }
    events = directory / "events"
    events.mkdir(mode=0o700, parents=True, exist_ok=True)
    os.chmod(events, 0o700)
    recorded = _create_if_absent(
        events,
        f"{event_id}.json",
        (json.dumps(receipt, ensure_ascii=False, separators=(",", ":")) + "\n").encode(),
    )
    if not recorded:
        return {"recorded": False, "reason": "duplicate"}
    return {"recorded": True, "receipt": receipt}


def record_approval(directory, tool, call_id, args, status):
    if not all((_clean(tool), _clean(call_id), _clean(status))):
        return {"recorded": False, "reason": "missing_identity"}
    directory = Path(directory)
    secret = _secret(directory)

    def digest(*parts):
        payload = json.dumps(parts, ensure_ascii=False, separators=(",", ":"), sort_keys=True).encode()
        return hmac.new(secret, payload, hashlib.sha256).hexdigest()

    args_ref = digest("args", tool, args)
    receipt = {
        "schema": "commerce-approval.v1",
        "tool": tool,
        "callRef": digest("call", call_id),
        "argsRef": args_ref,
        "status": status,
        "observedAt": datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z"),
    }
    receipt["id"] = digest("approval", tool, call_id, args_ref, status)
    approvals = directory / "approvals"
    approvals.mkdir(mode=0o700, parents=True, exist_ok=True)
    os.chmod(approvals, 0o700)
    recorded = _create_if_absent(
        approvals,
        f"{receipt['id']}.json",
        (json.dumps(receipt, ensure_ascii=False, separators=(",", ":")) + "\n").encode(),
    )
    return {"recorded": recorded, "receipt": receipt}
