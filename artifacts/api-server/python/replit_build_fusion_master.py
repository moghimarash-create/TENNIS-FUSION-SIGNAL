#!/usr/bin/env python3
"""
Fast builder of fusion_nba_master.json inside NBA-FUSION-SIGNAL on Replit!
Computes:
  - Full 5-mode fusion signals (dual_pillar, vip_cross, astro_lock, diamond, geo_1xxx_lock)
  - Complete 8-player pre-game lineups (h_players, a_players) across ALL 3,852 games (2024-2027)
  - Exact 4-bit GEO-FIN parity code (`gf`, e.g. "1000", "0110") on every player
  - Team `1xxx` Pwr sum & comparison (`fusion_meta.geo1xxx`) matching iNFO.xlsm.xlsx (Sheet8)
"""
import os, sys, json, math, time, datetime
from collections import defaultdict
import swisseph as swe

t0 = time.time()
HERE = os.path.dirname(os.path.abspath(__file__))
PUB = os.environ.get("FUSION_PUB_DIR", "/home/runner/workspace/artifacts/calc-dashboard/public")
sys.path.insert(0, HERE)
import parity_check as pc

def norm_team(s):
    HIST_TEAM_NORM = {
        "LA Clippers": "Los Angeles Clippers",
        "New Jersey Nets": "Brooklyn Nets",
        "Charlotte Bobcats": "Charlotte Hornets",
        "New Orleans Hornets": "New Orleans Pelicans",
    }
    t = str(s or "").strip()
    return HIST_TEAM_NORM.get(t, t)

def parse_votes(g):
    v = str(g.get("twVotes", "0H-0A"))
    try:
        hp, ap = v.replace("A", "").split("H-")
        return int(hp), int(ap)
    except Exception:
        return 0, 0

def elem_fin(el12):
    if not el12 or len(el12) < 8: return ""
    out = []
    for x in el12[4:8]:
        try: n = int(str(x).strip().split()[0])
        except Exception: n = 0
        out.append("1" if abs(n) % 2 == 1 else "0")
    return "".join(out)

def geo_code_from_ef_str(ef_str):
    parts = [int(x) for x in str(ef_str).split("-")]
    return "".join("1" if abs(v) % 2 == 1 else "0" for v in parts)

def prev_season(s):
    y1 = int(s[:4]) - 1
    return f"{y1}-{(y1+1)%100:02d}"

SIGNS_SHORT = ["Ari","Tau","Gem","Can","Leo","Vir","Lib","Sco","Sag","Cap","Aqu","Pis"]
def dec_label(deg):
    d = int(deg) % 360
    return f"{SIGNS_SHORT[d // 30]} D{(d % 30)//10 + 1}"

t_doc = json.load(open(os.path.join(PUB, "nba_predictions_2580.json"), "r", encoding="utf-8"))
pc_doc = json.load(open(os.path.join(PUB, "player_nba_preds_mode_c.json"), "r", encoding="utf-8"))
t_hist_raw = json.load(open(os.path.join(PUB, "nba_history_pack_2010_2026.json"), "r", encoding="utf-8"))
teams_gem_raw = json.load(open(os.path.join(HERE, "nba_gem_sheet.json"), "r", encoding="utf-8"))["values"]
pb = json.load(open(os.path.join(HERE, "nba_players_2010_2027.json"), "r", encoding="utf-8"))
player_master = pb["player_master"]
stp = pb["season_team_players"]

tm_meta = {}
for r in teams_gem_raw[1:]:
    if not r or not str(r[0]).strip(): continue
    name = str(r[0]).strip()
    tm_meta[name] = {
        "deg2": int(float(r[3])) % 360,
        "deg3": int(float(r[13])) % 360,
        "tz": str(r[23]).strip() or "America/New_York",
        "fawe": tuple(pc.s4.word_element_fawe(name)),
    }

p_static = {}
for pid, pm in player_master.items():
    fn = pm.get("full_name", "")
    jn = pm.get("jersey_name", "") or (fn.split()[-1] if fn else "")
    jno = str(pm.get("jersey", ""))
    pos = str(pm.get("pos", ""))
    p_static[pid] = {
        "pid": str(pid),
        "fn": fn,
        "jn": jn,
        "no": jno,
        "pos": pos,
        "d2": pc.egem(fn) % 360,
        "d3": pc.jersey_eff_num(jno, True) % 360,
        "fawe": tuple(pc.s4.word_element_fawe(fn)),
    }

def get_hist_team_players_8(s_lbl, tname):
    cur = stp.get(f"{s_lbl}||{tname}") or []
    prv = stp.get(f"{prev_season(s_lbl)}||{tname}") or []
    prv_map = {r["pid"]: float(r.get("mpg", 15.0)) for r in prv}
    cands = []
    seen = set()
    for r in cur:
        pid = r["pid"]
        if pid in seen or pid not in p_static:
            continue
        seen.add(pid)
        mpg = 0.6 * prv_map[pid] + 0.4 * float(r.get("mpg", 12.0)) if pid in prv_map else float(r.get("mpg", 12.0))
        cands.append((round(mpg, 1), pid))
    cands.sort(reverse=True)
    return cands[:8]

t_map = {(g["d"], norm_team(g["h"]), norm_team(g["a"])): g for g in t_doc["games"]}

team_by_day = defaultdict(list)
sched_all = set()
for row in t_hist_raw:
    d_iso, day = str(row[0]), str(row[1])
    h, a = norm_team(row[3]), norm_team(row[4])
    sched_all.add((d_iso, h)); sched_all.add((d_iso, a))
    h12 = [str(x) for x in (row[8] if isinstance(row[8], list) else [])]
    team_by_day[day].append({
        "d": d_iso, "h": h, "a": a, "hp": int(row[5]), "ap": int(row[6]), "mg": int(row[7]),
        "h12": h12, "h_fin": elem_fin(h12), "h_dyn": str(row[9] or ""),
        "h_tab": str(row[14]) if len(row) > 14 else "0101"
    })
for dy in team_by_day:
    team_by_day[dy].sort(key=lambda x: x["d"])
for g in pc_doc["games"]:
    sched_all.add((g["d"], norm_team(g["h"]))); sched_all.add((g["d"], norm_team(g["a"])))

_p_cache, _d_cache = {}, {}
class LazyTbl:
    def __init__(self, jd): self.jd = jd
    def __getitem__(self, deg):
        rk = round(self.jd, 5)
        p_degs = _p_cache.get(rk)
        if p_degs is None:
            p_degs = [(pn, swe.calc_ut(self.jd, pid, pc.FLAGS)[0][0] % 360.0) for pn, pid in pc.PLANETS_10]
            _p_cache[rk] = p_degs
        deg = int(deg) % 360
        ck = (rk, deg)
        v = _d_cache.get(ck)
        if v is not None: return v
        tot = 0; fd = float(deg)
        for pn, pd in p_degs:
            sym = pc.s2._best_aspect(fd, pd, pn)
            if sym is not None:
                val = pc.s3.zod_aspect_deg(sym)
                if isinstance(val, (int, float)): tot += int(val)
        _d_cache[ck] = tot
        return tot

def pool_idx_ds(pool):
    ch = [min(5, max(1, math.ceil(abs(x["mg"]) / 4))) for x in pool if x["mg"] > 0]
    ca = [min(5, max(1, math.ceil(abs(x["mg"]) / 4))) for x in pool if x["mg"] < 0]
    hw, aw = len(ch), len(ca)
    ih = 0 if not ch else (ch[0] if hw == 1 else max(ch) + min(ch))
    ia = 0 if not ca else (ca[0] if aw == 1 else max(ca) + min(ca))
    d = ih - ia
    s_delta = (2 * hw + ih) - (2 * aw + ia)
    if d > 0 and s_delta > 0: eff = d
    elif d < 0 and s_delta < 0: eff = d
    elif d == 0 and abs(s_delta) >= 2: eff = 1 if s_delta > 0 else -1
    else: eff = 0
    return hw, aw, eff

def auto_filter(t12, tgeo, dpool, geo_first, gk, min_gf):
    pool = list(dpool); used = set(); used_geo = False
    if geo_first and tgeo:
        nxt = [x for x in pool if x[gk] == tgeo]
        if len(nxt) >= min_gf: pool = nxt; used_geo = True
    while len(pool) > 7:
        bc, bcnt, bnxt = None, -1, None
        for c in range(12):
            if c in used: continue
            tv = t12[c]
            nxt = [x for x in pool if len(x["h12"]) > c and x["h12"][c] == tv]
            if 5 <= len(nxt) < len(pool) and len(nxt) > bcnt:
                bc, bcnt, bnxt = c, len(nxt), nxt
        if bc is None: break
        used.add(bc); pool = bnxt
        if 5 <= len(pool) <= 7: break
    if (not geo_first) and (not used_geo) and tgeo and len(pool) > 7:
        nxt = [x for x in pool if x[gk] == tgeo]
        if 5 <= len(nxt) <= 7: pool = nxt
    nat = 5 <= len(pool) <= 7
    if len(pool) > 7: pool = pool[-7:]
    hw, aw, eff = pool_idx_ds(pool)
    tot = max(1, hw + aw); pct = round(max(hw, aw) * 100.0 / tot, 1)
    return {"pool": pool, "hw": hw, "aw": aw, "pct": pct, "mv": abs(hw - aw), "nat": nat, "ds": eff}

def compute_fallback_team(gpc):
    d_iso = gpc["d"]; h = norm_team(gpc["h"]); a = norm_team(gpc["a"])
    ctx = pc.get_date_ctx(d_iso)
    y, m, d = map(int, d_iso.split("-"))
    tbl = LazyTbl(pc.get_jd_local(y, m, d, tm_meta[h]["tz"]))
    ep_h, ef_h, ed_h, mh = pc.fast_eval_entity(ctx, 53, tm_meta[h]["deg2"], tm_meta[h]["deg3"], tm_meta[h]["fawe"], tbl)
    ep_a, ef_a, ed_a, ma = pc.fast_eval_entity(ctx, 53, tm_meta[a]["deg2"], tm_meta[h]["deg3"], tm_meta[a]["fawe"], tbl)
    h12 = [f"{ed_h[j]} {['FIRE','AIR','WATER','EARTH'][j]}" for j in range(4)] + \
          [f"{ef_h[j]} {['FIRE','AIR','WATER','EARTH'][j]}" for j in range(4)] + \
          [f"{ep_h[j]} {['FIRE','AIR','WATER','EARTH'][j]}" for j in range(4)]
    h_fin = "".join("1" if abs(ef_h[j]) % 2 == 1 else "0" for j in range(4))
    h_dyn = "".join("1" if abs(ed_h[j]) % 2 == 1 else "0" for j in range(4))
    h_tab = str(gpc.get("h_geo_tab") or "0101")
    sc = 0
    for k_m in ["qdeg", "qfin", "qdec", "qdecf", "gd", "rul"]:
        vh = mh[k_m][0] + mh[k_m][1]; va = ma[k_m][0] + ma[k_m][1]
        if vh > va: sc += 1
        elif va > vh: sc -= 1
    f30 = sc * 5
    arr = team_by_day.get(gpc["day"], [])
    lo, hi = 0, len(arr)
    while lo < hi:
        mid = (lo + hi) // 2
        if arr[mid]["d"] < d_iso: lo = mid + 1
        else: hi = mid
    dpool = arr[:lo]
    sd = auto_filter(h12, h_dyn, dpool, False, "h_dyn", 3)
    gd3 = auto_filter(h12, h_dyn, dpool, True, "h_dyn", 3)
    sa = (sd["hw"] >= sd["aw"]) == (f30 >= 0); ga = (gd3["hw"] >= gd3["aw"]) == (f30 >= 0)
    pick_geo = (
        False if (sd["pct"] < 60 or (sa and not ga and sd["pct"] >= 55))
        else True if (not sa and ga and gd3["pct"] >= 55)
        else (gd3["pct"] > sd["pct"] or (gd3["pct"] == sd["pct"] and gd3["mv"] > sd["mv"]))
    )
    ch = gd3 if pick_geo else sd
    hw, aw_v, nat = ch["hw"], ch["aw"], ch["nat"]
    tot = hw + aw_v
    pct_int = round(max(hw, aw_v) * 100 / tot) if tot else 50
    hfav = True if hw > aw_v else (False if aw_v > hw else f30 >= 0)
    sgn = 1 if hfav else -1
    pred = h if hfav else a; opp = a if hfav else h
    f30_o = f30 * sgn
    agree = (hfav and f30 > 0) or (not hfav and f30 < 0)
    both100 = sd["pct"] == 100.0 and gd3["pct"] == 100.0 and ((sd["hw"] > 0) == (gd3["hw"] > 0))
    v71 = 5 <= tot <= 7 and pct_int >= 71 and abs(hw - aw_v) >= 3
    bcombo = v71 and (agree or both100)
    c1 = auto_filter(h12, h_fin, dpool, False, "h_fin", 5)
    c2 = auto_filter(h12, h_fin, dpool, True, "h_fin", 5)
    c3 = auto_filter(h12, h_dyn, dpool, True, "h_dyn", 5)
    c4 = auto_filter(h12, h_tab, dpool, True, "h_tab", 5)
    ds4 = [c1["ds"], c2["ds"], c3["ds"], c4["ds"]]
    ds4_o = [v * sgn for v in ds4]
    vh4 = sum(1 for v in ds4 if v > 0); va4 = sum(1 for v in ds4 if v < 0)
    fav_v4 = vh4 if hfav else va4; opp_v4 = va4 if hfav else vh4
    fav_v3 = sum(1 for v in ds4_o[:3] if v > 0); opp_v3 = sum(1 for v in ds4_o[:3] if v < 0)
    min_o4 = min(ds4_o)
    yest = (datetime.date(y, m, d) - datetime.timedelta(days=1)).isoformat()
    pb2b = (yest, pred) in sched_all and (yest, opp) not in sched_all
    is_playoff = (d_iso[5:10] >= "04-15" and m <= 6)
    c4_vote_opp = ((c4["hw"] - c4["aw"]) * sgn < 0)
    t1 = (not hfav) and (f30_o < 10 or (fav_v3 < 2 and fav_v4 < 3))
    t2 = (opp_v3 >= 2 and f30_o < 8) or (opp_v4 >= 2 and f30_o < 10)
    t3 = pb2b and f30_o < 12 and ((not hfav) or (not nat))
    t4 = (not nat) and fav_v3 < 3 and fav_v4 < 3 and f30_o < 12
    t5 = (fav_v4 == 0) or (c4_vote_opp and f30_o < 12) or (is_playoff and not nat)
    f1_guard = bool(bcombo and not (t1 or t2 or t3 or t4 or t5))
    mel = str((gpc.get("wtp") or {}).get("mel", "AIR"))
    f1_wtp = bool(f1_guard and mel != "EARTH")
    vip = bool(f1_wtp and (mel == "FIRE" or (nat and fav_v4 == 4 and min_o4 >= 2)))
    return {
        "sys_win": pred, "twVotes": f"{hw}H-{aw_v}A", "twPct": f"{pct_int}%", "f30": f30,
        "idx3": {"st": [c1["hw"], c1["aw"], c1["ds"]], "gf": [c2["hw"], c2["aw"], c2["ds"]],
                 "gd": [c3["hw"], c3["aw"], c3["ds"]], "gt": [c4["hw"], c4["aw"], c4["ds"]],
                 "tw": [hw, aw_v, ch["ds"]], "vh": vh4, "va": va4, "nat": 4, "minD": min_o4},
        "f1_wtp": f1_wtp, "vip_idx3": vip,
    }

master_games = []
for gpc in pc_doc["games"]:
    h = norm_team(gpc["h"]); a = norm_team(gpc["a"])
    k = (gpc["d"], h, a)
    gt = t_map.get(k)
    in_auth = (gt is not None)
    if gt is None:
        gt = compute_fallback_team(gpc)

    tpk = norm_team(gt.get("sys_win") or gt.get("pw") or h)
    ppk = norm_team(gpc.get("sys_win") or h)
    sgn_t = 1 if tpk == h else -1
    sgn_p = 1 if ppk == h else -1
    f30_t = int(gt.get("f30") if gt.get("f30") is not None else 0)
    f30_p = int(gpc.get("f30") if gpc.get("f30") is not None else 0)
    t_sig = bool(gt.get("f1_wtp")); p_sig = bool(gpc.get("f1_wtp"))
    t_vip = bool(gt.get("vip_idx3")); p_vip = bool(gpc.get("vip_idx3"))

    p_supports_t = (ppk == tpk) or (f30_p * sgn_t > 0)
    t_supports_p = (tpk == ppk) or (f30_t * sgn_p > 0)
    p_astro_t = (f30_p * sgn_t > 0)
    t_astro_p = (f30_t * sgn_p > 0)

    is_diamond = bool(t_sig and p_sig and tpk == ppk)
    is_vip_cross = bool((t_vip and p_supports_t and (not p_vip or tpk == ppk)) or (p_vip and t_supports_p and (not t_vip or tpk == ppk)))
    is_astro_lock = bool((t_sig and p_astro_t and (not p_sig or tpk == ppk)) or (p_sig and t_astro_p and (not t_sig or tpk == ppk)))
    is_dual_pillar = bool((t_sig and p_supports_t and (not p_sig or tpk == ppk)) or (p_sig and t_supports_p and (not t_sig or tpk == ppk)))
    is_vetoed = bool((t_sig or p_sig) and not is_dual_pillar)

    if is_diamond:
        final_pick, driver, tier_code, tier_fa = tpk, "BOTH", "DIAMOND", "سطح ۱: الماس (توافق هم‌زمان دو سیگنال)"
    elif is_vip_cross:
        final_pick = tpk if (t_vip and p_supports_t) else ppk
        driver = "TEAM" if final_pick == tpk else "PLAYER"
        tier_code, tier_fa = "GOLD_VIP", "سطح ۲: طلایی (VIP با تأیید متقابل)"
    elif is_dual_pillar:
        final_pick = tpk if (t_sig and p_supports_t) else ppk
        driver = "TEAM" if final_pick == tpk else "PLAYER"
        tier_code, tier_fa = "SILVER_CORE", "سطح ۳: نقره‌ای (تأیید دو-ستونی)"
    elif is_vetoed:
        final_pick = tpk if t_sig else ppk
        driver = "TEAM" if t_sig else "PLAYER"
        tier_code, tier_fa = "VETOED", "وتوی متقابل (مخالفت همزاد و نجوم موتور مکمل)"
    else:
        final_pick = tpk if abs(f30_t) >= abs(f30_p) else ppk
        driver = "TEAM" if final_pick == tpk else "PLAYER"
        tier_code, tier_fa = "NONE", "بدون سیگنال نهایی"

    pk_vip = tpk if (t_vip and p_supports_t) else (ppk if (p_vip and t_supports_p) else final_pick)
    pk_ast = tpk if (t_sig and p_astro_t) else (ppk if (p_sig and t_astro_p) else final_pick)
    pk_dp  = tpk if (t_sig and p_supports_t) else (ppk if (p_sig and t_supports_p) else final_pick)
    pk_dia = tpk if is_diamond else final_pick

    g_out = dict(gpc)
    # Populate 8-player arrays with exact 4-bit GEO-FIN (`gf`) across ALL 2024-2027 games!
    hp_list = [dict(p) for p in (g_out.get("h_players") or [])]
    ap_list = [dict(p) for p in (g_out.get("a_players") or [])]
    if not hp_list or not ap_list:
        d_iso = g_out["d"]
        ctx = pc.get_date_ctx(d_iso)
        y, m, d = map(int, d_iso.split("-"))
        tbl = LazyTbl(pc.get_jd_local(y, m, d, tm_meta.get(h, {}).get("tz", "America/New_York")))
        hp_list, ap_list = [], []
        for side_tm, out_arr in [(h, hp_list), (a, ap_list)]:
            cands8 = get_hist_team_players_8(g_out["s"], side_tm)
            for idx_i, (mpg_v, pid) in enumerate(cands8):
                ps = p_static[pid]
                ep, ef, ed, m_d = pc.fast_eval_entity(ctx, 53, ps["d2"], ps["d3"], ps["fawe"], tbl)
                pwr = round(
                    0.35 * (m_d["qfin"][0] + m_d["qfin"][1]) +
                    0.35 * (m_d["qdecf"][0] + m_d["qdecf"][1]) +
                    0.15 * (m_d["gd"][0] + m_d["gd"][1]) +
                    0.15 * (m_d["rul"][0] + m_d["rul"][1]),
                    1
                )
                ef_s = f"{ef[0]}-{ef[1]}-{ef[2]}-{ef[3]}"
                gf_s = geo_code_from_ef_str(ef_s)
                hc_v, md_v = m_d["qfin"]
                qf_s = f"{abs(hc_v)}{'HOT' if hc_v>=0 else 'COLD'}/{abs(md_v)}{'MOIST' if md_v>=0 else 'DRY'}"
                out_arr.append({
                    "pid": ps["pid"], "fn": ps["fn"], "jn": ps["jn"], "no": ps["no"], "pos": ps["pos"],
                    "st": idx_i < 5, "mpg": mpg_v, "d2": ps["d2"], "d3": ps["d3"],
                    "ep": f"{ep[0]}-{ep[1]}-{ep[2]}-{ep[3]}", "ef": ef_s, "gf": gf_s,
                    "qf": qf_s, "dec": dec_label(ps["d2"]), "pwr": pwr,
                })
    else:
        for pl in hp_list:
            pl["gf"] = geo_code_from_ef_str(pl["ef"])
        for pl in ap_list:
            pl["gf"] = geo_code_from_ef_str(pl["ef"])

    g_out["h_players"] = hp_list
    g_out["a_players"] = ap_list

    # Compute Sheet8 1xxx metrics
    h_1xxx = [float(p["pwr"]) for p in hp_list if str(p.get("gf", ""))[:1] == "1"]
    a_1xxx = [float(p["pwr"]) for p in ap_list if str(p.get("gf", ""))[:1] == "1"]
    h_sum = round(sum(h_1xxx), 1)
    a_sum = round(sum(a_1xxx), 1)
    h_all = round(sum(float(p["pwr"]) for p in hp_list), 1)
    a_all = round(sum(float(p["pwr"]) for p in ap_list), 1)
    g1_win = h if h_sum < a_sum else (a if a_sum < h_sum else "")
    is_geo_1xxx_lock = bool(is_dual_pillar and g1_win == pk_dp)
    is_geo_1xxx_vip  = bool(is_vip_cross and g1_win == pk_vip)

    base_disp = gt if driver in ("TEAM", "BOTH") else gpc
    g_out["sys_win"] = pk_dp; g_out["pw"] = pk_dp; g_out["fpw"] = pk_dp if is_dual_pillar else ""; g_out["twWin"] = pk_dp
    if is_diamond:
        thw, taw = parse_votes(gt); phw, paw = parse_votes(gpc)
        shw, saw = thw + phw, taw + paw
        g_out["twVotes"] = f"{shw}H-{saw}A"
        g_out["twPct"] = f"{round(100*max(shw,saw)/max(1,shw+saw))}%"
    else:
        g_out["twVotes"] = base_disp.get("twVotes", gpc["twVotes"])
        g_out["twPct"] = base_disp.get("twPct", gpc["twPct"])
    g_out["idx3"] = base_disp.get("idx3") or gpc["idx3"]
    g_out["f30"] = int(f30_t + f30_p); g_out["vm6"] = int(f30_t + f30_p)
    g_out["f1"] = bool(is_dual_pillar or is_vetoed)
    g_out["f1_idx"] = is_dual_pillar; g_out["f1_guard"] = is_dual_pillar; g_out["f1_wtp"] = is_dual_pillar
    g_out["vip_idx3"] = is_vip_cross; g_out["f1_union"] = is_dual_pillar
    if is_vetoed:
        g_out["trap_tag"] = "وتوی متقابل توسط " + ("موتور بازیکنان" if t_sig else "موتور تیم+استادیوم")
    elif is_dual_pillar:
        g_out["trap_tag"] = ""

    if g_out.get("done") and g_out.get("aw"):
        aw_n = norm_team(g_out["aw"])
        g_out["st"] = "WIN" if pk_dp == aw_n else "LOSS"
        g_out["fst"] = g_out["st"] if is_dual_pillar else ""

    t_idx = gt.get("idx3") or {}; p_idx = gpc.get("idx3") or {}
    g_out["fusion_meta"] = {
        "mode": "dual_pillar", "tier": tier_code, "tier_fa": tier_fa, "driver": driver,
        "in_auth_overlap": in_auth, "vetoed": is_vetoed,
        "geo1xxx": {
            "h_sum": h_sum, "a_sum": a_sum,
            "h_cnt": len(h_1xxx), "a_cnt": len(a_1xxx),
            "h_all": h_all, "a_all": a_all,
            "diff": round(h_sum - a_sum, 1),
            "win": g1_win,
        },
        "modes": {
            "dual_pillar":   {"sig": is_dual_pillar,   "vip": is_vip_cross,     "pick": pk_dp},
            "vip_cross":     {"sig": is_vip_cross,     "vip": is_diamond,       "pick": pk_vip},
            "astro_lock":    {"sig": is_astro_lock,    "vip": bool(is_astro_lock and is_vip_cross), "pick": pk_ast},
            "diamond":       {"sig": is_diamond,       "vip": is_diamond,       "pick": pk_dia},
            "geo_1xxx_lock": {"sig": is_geo_1xxx_lock, "vip": is_geo_1xxx_vip,  "pick": pk_dp},
        },
        "team": {"pick": tpk, "votes": gt.get("twVotes", "—"), "pct": gt.get("twPct", "—"), "f30": f30_t,
                 "ch": f"{t_idx.get('vh',0)}H-{t_idx.get('va',0)}A", "sig": t_sig, "vip": t_vip,
                 "deg2": tm_meta.get(h, {}).get("deg2", 0), "deg3": tm_meta.get(h, {}).get("deg3", 0)},
        "player": {"pick": ppk, "votes": gpc.get("twVotes", "—"), "pct": gpc.get("twPct", "—"), "f30": f30_p,
                   "ch": f"{p_idx.get('vh',0)}H-{p_idx.get('va',0)}A", "sig": p_sig, "vip": p_vip},
    }
    master_games.append(g_out)

# Assert exact Sheet8 parity on #2772 (DAL @ SAS, 2026-11-04)
g2772 = next(g for g in master_games if g["n"] == 2772)
assert g2772["fusion_meta"]["geo1xxx"]["h_sum"] == -7.9, f"SAS 1xxx mismatch: {g2772['fusion_meta']['geo1xxx']}"
assert g2772["fusion_meta"]["geo1xxx"]["a_sum"] == 10.8, f"DAL 1xxx mismatch: {g2772['fusion_meta']['geo1xxx']}"
assert g2772["fusion_meta"]["geo1xxx"]["win"] == "San Antonio Spurs"

json.dump({"games": master_games}, open(os.path.join(PUB, "fusion_nba_master.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print(f"FUSION_MASTER_V2_BUILT: {len(master_games)} games (100% Sheet8 1xxx verified) in {time.time()-t0:.1f}s!")
