#!/usr/bin/env python3
"""Sweep PoH v2 VouchRegistered + HumanityClaimed logs on Gnosis and test the
farm hypothesis: does the Apr-Jul 2026 airdrop cohort share vouchers?"""
import json, time, urllib.request, collections, sys

RPC = "https://rpc.gnosischain.com"
POH = "0xa4AC94C4fa65Bb352eFa30e3408e64F72aC857bc"
DEPLOY = 35846827
T_VOUCH = "0x32d9c9fa0d68d72716d8ce6fb31141216cc8a7059b83f77c3a5c59041029ad76"
T_CLAIM = "0x8f7a3d8342a820e0b4964cc989eda69c533342896a0fa4a8379336dc0904cbe9"

def rpc(method, params, tries=5):
    body = json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params}).encode()
    for a in range(tries):
        try:
            req = urllib.request.Request(RPC, body, {"content-type": "application/json"})
            r = json.load(urllib.request.urlopen(req, timeout=45))
            if "error" in r:
                raise RuntimeError(r["error"])
            return r["result"]
        except Exception as e:
            if a == tries - 1:
                raise
            time.sleep(1.5 * (a + 1))

latest = int(rpc("eth_blockNumber", []), 16)
print(f"latest block {latest}", flush=True)

def sweep(topic0, label):
    out, lo, step = [], DEPLOY, 100_000
    while lo <= latest:
        hi = min(lo + step - 1, latest)
        try:
            logs = rpc("eth_getLogs", [{"address": POH, "fromBlock": hex(lo),
                                        "toBlock": hex(hi), "topics": [topic0]}], tries=3)
        except Exception as e:
            if step > 5_000:
                step //= 2
                continue
            print(f"  skip {lo}-{hi}: {e}", file=sys.stderr, flush=True)
            lo = hi + 1
            continue
        out += logs
        if logs:
            print(f"  {label} {lo}-{hi}: +{len(logs)} (tot {len(out)})", flush=True)
        lo = hi + 1
    return out

vouches = sweep(T_VOUCH, "vouch")
claims = sweep(T_CLAIM, "claim")
json.dump({"vouches": vouches, "claims": claims}, open("poh_logs.json", "w"))
print(f"\nVouchRegistered: {len(vouches)}   HumanityClaimed: {len(claims)}")

# need timestamps -> bucket by month. fetch block ts for the blocks we care about.
blocks = sorted({int(l["blockNumber"], 16) for l in vouches} | {int(l["blockNumber"], 16) for l in claims})
print(f"fetching {len(blocks)} block timestamps...", flush=True)
ts = {}
for i, b in enumerate(blocks):
    ts[b] = int(rpc("eth_getBlockByNumber", [hex(b), False])["timestamp"], 16)
    if i % 200 == 0:
        print(f"  {i}/{len(blocks)}", flush=True)
json.dump(ts, open("poh_block_ts.json", "w"))
print("done")
