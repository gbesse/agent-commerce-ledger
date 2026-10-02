"""Exercise the Hermes extension without requiring a running Hermes gateway."""

import importlib.util
import json
import sys
from pathlib import Path
from types import SimpleNamespace


plugin_dir = Path(__file__).resolve().parents[1] / "hermes-commerce-ledger"
spec = importlib.util.spec_from_file_location(
    "commerce_ledger_hermes", plugin_dir / "__init__.py", submodule_search_locations=[str(plugin_dir)]
)
module = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = module
spec.loader.exec_module(module)

directory = Path(sys.argv[1])
sample = {
    "kind": "inbound",
    "channel": "whatsapp",
    "account": "account-1",
    "partyId": "person-1",
    "messageId": "message-1",
}
duplicate = module.record_receipt(directory, sample)


class Context:
    def __init__(self):
        self.hooks = {}
        self.skill = None

    def get_config(self, key, default=None):
        return {
            "allowed_platforms": ["whatsapp"],
            "allowed_senders": ["person-1"],
            "protected_tools": ["incwo.create_invoice"],
            "data_dir": str(directory),
        }.get(key, default)

    def register_hook(self, name, callback):
        self.hooks[name] = callback

    def register_skill(self, name, path):
        assert name == "commerce-workflow"
        assert path.is_file()
        self.skill = path


ctx = Context()
module.register(ctx)
assert ctx.skill is not None
event = SimpleNamespace(
    source=SimpleNamespace(platform="whatsapp", user_id="person-1", account_id="account-1"),
    message_id="message-2",
    text="PRIVATE USER CONTENT",
)
ctx.hooks["pre_gateway_dispatch"](event)
ctx.hooks["pre_gateway_dispatch"](event)
ctx.hooks["pre_gateway_dispatch"](
    SimpleNamespace(
        source=SimpleNamespace(platform="whatsapp", user_id="unlisted", account_id="account-1"),
        message_id="message-3",
        text="PRIVATE USER CONTENT",
    )
)
approval = ctx.hooks["pre_tool_call"](
    tool_name="incwo.create_invoice",
    args={"amount": 42, "customer": "PRIVATE CUSTOMER"},
    tool_call_id="call-1",
)
assert approval["action"] == "approve"
ctx.hooks["post_approval_response"](choice="once", tool_call_id="call-1")
ctx.hooks["post_tool_call"](
    tool_name="incwo.create_invoice",
    args={"amount": 42, "customer": "PRIVATE CUSTOMER"},
    tool_call_id="call-1",
)
approval_files = list((directory / "approvals").glob("*.json"))
assert len(approval_files) == 3
assert len({json.loads(path.read_text())["argsRef"] for path in approval_files}) == 1
assert all("PRIVATE CUSTOMER" not in path.read_text() for path in approval_files)
assert {json.loads(path.read_text())["status"] for path in approval_files} == {"requested", "once", "returned"}
print(json.dumps({"duplicate": duplicate, "files": len(list((directory / "events").glob("*.json")))}))
