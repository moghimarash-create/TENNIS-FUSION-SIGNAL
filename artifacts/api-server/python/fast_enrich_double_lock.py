#!/usr/bin/env python3
"""
Fast 0.4s enrichment of /home/runner/workspace/artifacts/calc-dashboard/public/fusion_nba_master.json
with `geo1xxx.all_win` and 6th mode `double_pwr_lock` (BOTH Σ(1xxx) and Σ(8) favor Pick).
"""
import os, json, time
t0 = time.time()
PUB = "/home/runner/workspace/artifacts/calc-dashboard/public"
mpath = os.path.join(PUB, "fusion_nba_master.json")
doc = json.load(open(mpath, "r", encoding="utf-8"))
games = doc["games"]

def norm(s):
    t = str(s or "").strip()
    return "Los Angeles Clippers" if t == "LA Clippers" else t

for g in games:
    fm = g["fusion_meta"]
    g1 = fm["geo1xxx"]
    h, a = norm(g["h"]), norm(g["a"])
    all_win = h if g1["h_all"] < g1["a_all"] else (a if g1["a_all"] < g1["h_all"] else "")
    g1["all_win"] = all_win
    dp_m = fm["modes"]["dual_pillar"]
    vp_m = fm["modes"]["vip_cross"]
    pk_dp = norm(dp_m["pick"])
    pk_vp = norm(vp_m["pick"])
    fm["modes"]["double_pwr_lock"] = {
        "sig": bool(dp_m["sig"] and g1["win"] == pk_dp and all_win == pk_dp),
        "vip": bool(vp_m["sig"] and g1["win"] == pk_vp and all_win == pk_vp),
        "pick": pk_dp,
    }

g2772 = next(g for g in games if g["n"] == 2772)
assert g2772["fusion_meta"]["modes"]["double_pwr_lock"]["sig"] is True
g2847 = next(g for g in games if g["n"] == 2847)
assert g2847["fusion_meta"]["modes"]["double_pwr_lock"]["sig"] is False
assert g2847["fusion_meta"]["geo1xxx"]["all_win"] == "New York Knicks"

json.dump(doc, open(mpath, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print(f"FAST_ENRICH_V3_OK: {len(games)} games in {time.time()-t0:.2f}s!")
