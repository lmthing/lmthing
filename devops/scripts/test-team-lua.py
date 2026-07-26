#!/usr/bin/env python3
"""Exercise the lmthing.team Envoy routing Lua against a stubbed request handle.

The Lua in devops/argocd/envoy/team-policies.yaml is the boundary that decides
which pod a caller reaches and whether they reach one at all — and it cannot be
tested until it is deployed to a cluster. This runs it in-process instead, so a
regression in the routing or the fail-closed checks is caught before deploy.

    pip install lupa pyyaml
    python3 devops/scripts/test-team-lua.py

Exits non-zero on failure.
"""

import sys
from pathlib import Path

try:
    import lupa
    import yaml
except ImportError:
    print("needs: pip install lupa pyyaml", file=sys.stderr)
    sys.exit(2)

POLICY = Path(__file__).resolve().parents[1] / "argocd/envoy/team-policies.yaml"

# A stub of the parts of Envoy's request_handle the script touches.
HARNESS = """
function make_handle(hdrs)
  local H, resp, md = {}, {}, {}
  local h = {
    get = function(_, k) return hdrs[k] end,
    replace = function(_, k, v) hdrs[k] = v end,
    remove = function(_, k) hdrs[k] = nil end,
  }
  H.headers = function() return h end
  H.respond = function(_, s, body) resp.status = s[":status"]; resp.body = body end
  H.streamInfo = function() return { dynamicMetadata = function()
     return { set = function(_, ns, k, v) md[ns .. "." .. k] = v end,
              get = function(_, ns) return md end } end } end
  return H, hdrs, resp, md
end
"""

POD = "lmthing.team-abc-123.svc.cluster.local:8080"

# (name, request headers, expected upstream, expected rejection status)
CASES = [
    ("a personal token carries no team claim and is rejected",
     {":path": "/api/sessions", "authorization": "Bearer tok"}, None, "401"),
    ("a team token routes to that team's pod",
     {":path": "/api/sessions", "x-team-id": "abc-123", "x-user-id": "u1",
      "x-lmthing-role": "viewer", "authorization": "Bearer tok"}, POD, None),
    ("an editor reaches the same pod",
     {":path": "/api/sessions", "x-team-id": "abc-123", "x-lmthing-role": "editor"}, POD, None),
    ("a missing role fails closed",
     {":path": "/api/sessions", "x-team-id": "abc-123"}, None, "401"),
    ("an unknown role fails closed",
     {":path": "/api/sessions", "x-team-id": "abc-123", "x-lmthing-role": "admin"}, None, "401"),
    ("a team id that could escape the DNS name is rejected",
     {":path": "/api/sessions", "x-team-id": "abc/../../etc", "x-lmthing-role": "editor"}, None, "400"),
    ("a client-supplied upstream header is discarded",
     {":path": "/api/sessions", "x-team-id": "abc-123", "x-lmthing-role": "viewer",
      "x-dynamic-host-header": "evil.attacker:8080"}, POD, None),
]


def main() -> int:
    policy = next(
        d for d in yaml.safe_load_all(POLICY.read_text())
        if d and d.get("kind") == "EnvoyExtensionPolicy"
    )
    lua = lupa.LuaRuntime(unpack_returned_tuples=True)
    lua.execute(policy["spec"]["lua"][0]["inline"])
    lua.execute(HARNESS)
    g = lua.globals()

    failures = 0
    for name, headers, want_upstream, want_status in CASES:
        handle, hdrs, resp, _ = g.make_handle(lua.table_from(headers))
        g.envoy_on_request(handle)
        upstream = dict(hdrs).get("x-dynamic-host-header")
        status = resp["status"] or None
        if upstream == want_upstream and status == want_status:
            print(f"  PASS  {name}")
        else:
            failures += 1
            print(f"  FAIL  {name}")
            print(f"        upstream={upstream!r} status={status!r}")
            print(f"        wanted   upstream={want_upstream!r} status={want_status!r}")

    print(f"\n{len(CASES) - failures}/{len(CASES)} passed")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
