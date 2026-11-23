import os
#!/usr/bin/env python3
"""
Live Pre-Game ESPN Injury, Boxscore & 8-Player Lineup + 12-Mode Recalculation Engine
for Standalone App #3: NBA-FUSION-SIGNAL (v68).
Leaves App #1 (NBA-SIGNAL-DASHBORD) and App #2 (NBA-PLAYER-SIGNAL) and their 6 Google Sheets 100% untouched.
"""
import argparse, datetime, json, math, os, sys, urllib.request
from collections import defaultdict

PY_DIR = os.path.dirname(os.path.abspath(__file__))
if PY_DIR not in sys.path:
    sys.path.insert(0, PY_DIR)

import fusion_player_eval as pc

NBA_TEAMS_30 = [
    "Atlanta Hawks", "Boston Celtics", "Brooklyn Nets", "Charlotte Hornets", "Chicago Bulls",
    "Cleveland Cavaliers", "Dallas Mavericks", "Denver Nuggets", "Detroit Pistons", "Golden State Warriors",
    "Houston Rockets", "Indiana Pacers", "Los Angeles Clippers", "Los Angeles Lakers", "Memphis Grizzlies",
    "Miami Heat", "Milwaukee Bucks", "Minnesota Timberwolves", "New Orleans Pelicans", "New York Knicks",
    "Oklahoma City Thunder", "Orlando Magic", "Philadelphia 76ers", "Phoenix Suns", "Portland Trail Blazers",
    "Sacramento Kings", "San Antonio Spurs", "Toronto Raptors", "Utah Jazz", "Washington Wizards",
]

def _pyth_morey(pf, pa, exp=13.91):
    if pf <= 0 or pa <= 0:
        return 0.5
    r = pa / pf
    try:
        return 1.0 / (1.0 + (r ** exp))
    except OverflowError:
        return 0.0 if r > 1 else 1.0

def _log5_prob(p_h, p_a, ha=0.50):
    p_h = min(0.92, max(0.08, p_h))
    p_a = min(0.92, max(0.08, p_a))
    num = p_h * (1.0 - p_a) * ha
    den = num + (1.0 - p_h) * p_a * (1.0 - ha)
    return num / den if den > 0 else 0.5

def _team_elem(p_tm):
    if p_tm >= 0.58:
        return "FIRE"
    if p_tm >= 0.50:
        return "AIR"
    if p_tm >= 0.42:
        return "WATER"
    return "EARTH"

class _NLSCompat:
    @staticmethod
    def season_of_date(d_iso):
        if "2019-10-01" <= d_iso <= "2020-10-15":
            return "2019-20"
        if "2020-10-15" < d_iso <= "2021-08-15":
            return "2020-21"
        y, m, _ = map(int, d_iso.split("-"))
        return f"{y}-{(y+1)%100:02d}" if m >= 10 else f"{y-1}-{y%100:02d}"

    @staticmethod
    def build_all_snapshots(hist, cut_pairs):
        out = {}
        th = {tm: [] for tm in NBA_TEAMS_30}
        ptr = 0
        n = len(hist)
        for cut_iso, s_cur in sorted(set(cut_pairs)):
            while ptr < n and hist[ptr]["d"] < cut_iso:
                r = hist[ptr]
                if r["mg"] != 0:
                    th.setdefault(r["h"], []).append((r["s"], r["mg"] > 0, r["mg"], r["hp"], r["ap"]))
                    th.setdefault(r["a"], []).append((r["s"], r["mg"] < 0, -r["mg"], r["ap"], r["hp"]))
                ptr += 1
            tp, wl, pstr = {}, {}, {}
            for tm, arr in th.items():
                sp = [x for x in arr if x[0] == s_cur]
                l20 = arr[-20:]
                gp = len(sp)
                w = sum(1 for x in sp if x[1])
                pds = sum(x[2] for x in sp)
                pf = sum(x[3] for x in sp)
                pa = sum(x[4] for x in sp)
                l20_wp = sum(1 for x in l20 if x[1]) / len(l20) if l20 else 0.5
                l20_pd = sum(x[2] for x in l20) / len(l20) if l20 else 0.0
                b_wp = (w + 10.0 * l20_wp) / (gp + 10.0)
                b_pd = (pds + 10.0 * l20_pd) / (gp + 10.0)
                tp[tm] = round(50.0 + 60.0 * (b_wp - 0.5) + 1.5 * b_pd, 1)
                wl[tm] = f"{w}-{gp - w}"
                prior_p = (0.5 * (0.4 * l20_wp + 0.6 * _pyth_morey(sum(x[3] for x in l20), sum(x[4] for x in l20))) + 0.25) if l20 else 0.5
                p_wl = (w + 10.0 * prior_p) / (gp + 10.0)
                p_py = (gp * (_pyth_morey(pf, pa) if gp > 0 else prior_p) + 10.0 * prior_p) / (gp + 10.0)
                pstr[tm] = 0.35 * p_wl + 0.65 * p_py
            ranked = sorted(pstr.keys(), key=lambda t: pstr[t], reverse=True)
            rk = {t: i + 1 for i, t in enumerate(ranked)}
            out[(cut_iso, s_cur)] = {"tp": tp, "rk": rk, "wl": wl, "p": pstr}
        return out

    @staticmethod
    def geo_tab_pair(snap, h_tm, a_tm):
        hrk = snap["rk"].get(h_tm, 15)
        ark = snap["rk"].get(a_tm, 15)
        h_tab = f"{int(hrk<=10)}{int(hrk<=20)}{int(ark<=10)}{int(ark<=20)}"
        a_tab = f"{int(ark<=10)}{int(ark<=20)}{int(hrk<=10)}{int(hrk<=20)}"
        return h_tab, a_tab

    @staticmethod
    def matchup_elem(p_pick_pct):
        if p_pick_pct >= 58.0:
            return "FIRE"
        if p_pick_pct >= 51.0:
            return "AIR"
        if p_pick_pct >= 44.0:
            return "WATER"
        return "EARTH"

    @staticmethod
    def pool_idx_ds(pool):
        ch = [min(5, max(1, math.ceil(abs(x["mg"]) / 4))) for x in pool if x["mg"] > 0]
        ca = [min(5, max(1, math.ceil(abs(x["mg"]) / 4))) for x in pool if x["mg"] < 0]
        hw, aw = len(ch), len(ca)
        ih = 0 if not ch else (ch[0] if hw == 1 else max(ch) + min(ch))
        ia = 0 if not ca else (ca[0] if aw == 1 else max(ca) + min(ca))
        d = ih - ia
        s_delta = (2 * hw + ih) - (2 * aw + ia)
        if d > 0 and s_delta > 0:
            eff = d
        elif d < 0 and s_delta < 0:
            eff = d
        elif d == 0 and abs(s_delta) >= 2:
            eff = 1 if s_delta > 0 else -1
        else:
            eff = 0
        return hw, aw, d, s_delta, eff

    @staticmethod
    def make_wtp_obj(snap, label_date, h_tm, a_tm, hfav):
        htp = snap["tp"].get(h_tm, 50.0)
        atp = snap["tp"].get(a_tm, 50.0)
        dtp = round((htp - atp) if hfav else (atp - htp), 1)
        ph = snap["p"].get(h_tm, 0.5)
        pa = snap["p"].get(a_tm, 0.5)
        l5h = round(_log5_prob(ph, pa, 0.50) * 100.0, 1)
        l5pick = l5h if hfav else round(100.0 - l5h, 1)
        mel = _NLSCompat.matchup_elem(l5pick)
        pfair_h = _log5_prob(ph, pa, 0.545)
        hodds = round(1.0 / max(0.05, pfair_h), 2)
        aodds = round(1.0 / max(0.05, 1.0 - pfair_h), 2)
        return {
            "mon": label_date,
            "htp": htp, "atp": atp, "dtp": dtp,
            "hrk": snap["rk"].get(h_tm, 15),
            "ark": snap["rk"].get(a_tm, 15),
            "hwl": snap["wl"].get(h_tm, "0-0"),
            "awl": snap["wl"].get(a_tm, "0-0"),
            "hpct": round(ph * 100.0, 1),
            "apct": round(pa * 100.0, 1),
            "hel": _team_elem(ph),
            "ael": _team_elem(pa),
            "l5h": l5h,
            "hodds": hodds,
            "aodds": aodds,
            "mel": mel,
        }

nls = _NLSCompat()

INPUT_SHEET_ID = os.environ.get("TENNIS_FUSION_INPUT_SHEET_ID", "")
BLOCKED_STATUSES = {"out", "suspension", "suspended", "doubtful"}

HIST_TEAM_NORM = {
    "LA Clippers": "Los Angeles Clippers",
    "New Jersey Nets": "Brooklyn Nets",
    "Charlotte Bobcats": "Charlotte Hornets",
    "New Orleans Hornets": "New Orleans Pelicans",
}

def norm_team(s):
    t = str(s or "").strip()
    return HIST_TEAM_NORM.get(t, t)

def geo_code_from_ef_str(ef_str):
    parts = [int(x) for x in str(ef_str).split("-")]
    return "".join("1" if abs(v) % 2 == 1 else "0" for v in parts)

TEAM_META_30 = {
    "Boston Celtics": {"deg2": 117, "deg3": 307, "tz": "America/New_York", "fawe": [6, 1, 3, 3]},
    "Brooklyn Nets": {"deg2": 247, "deg3": 284, "tz": "America/New_York", "fawe": [5, 1, 3, 3]},
    "New York Knicks": {"deg2": 181, "deg3": 150, "tz": "America/New_York", "fawe": [6, 0, 6, 1]},
    "Philadelphia 76ers": {"deg2": 172, "deg3": 324, "tz": "America/New_York", "fawe": [5, 3, 4, 3]},
    "Toronto Raptors": {"deg2": 111, "deg3": 171, "tz": "America/Toronto", "fawe": [5, 0, 3, 6]},
    "Chicago Bulls": {"deg2": 260, "deg3": 75, "tz": "America/Chicago", "fawe": [4, 3, 3, 2]},
    "Cleveland Cavaliers": {"deg2": 124, "deg3": 252, "tz": "America/New_York", "fawe": [7, 4, 6, 1]},
    "Detroit Pistons": {"deg2": 19, "deg3": 39, "tz": "America/Detroit", "fawe": [7, 1, 2, 4]},
    "Indiana Pacers": {"deg2": 132, "deg3": 206, "tz": "America/Indiana/Indianapolis", "fawe": [4, 1, 7, 1]},
    "Milwaukee Bucks": {"deg2": 231, "deg3": 37, "tz": "America/Chicago", "fawe": [7, 1, 5, 1]},
    "Atlanta Hawks": {"deg2": 258, "deg3": 4, "tz": "America/New_York", "fawe": [2, 1, 6, 3]},
    "Charlotte Hornets": {"deg2": 127, "deg3": 51, "tz": "America/New_York", "fawe": [5, 1, 3, 7]},
    "Miami Heat": {"deg2": 155, "deg3": 57, "tz": "America/New_York", "fawe": [3, 0, 4, 2]},
    "Orlando Magic": {"deg2": 139, "deg3": 351, "tz": "America/New_York", "fawe": [3, 3, 5, 1]},
    "Washington Wizards": {"deg2": 226, "deg3": 204, "tz": "America/New_York", "fawe": [7, 3, 4, 3]},
    "Denver Nuggets": {"deg2": 77, "deg3": 320, "tz": "America/Denver", "fawe": [6, 3, 2, 2]},
    "Minnesota Timberwolves": {"deg2": 80, "deg3": 249, "tz": "America/Chicago", "fawe": [11, 1, 5, 4]},
    "Oklahoma City Thunder": {"deg2": 273, "deg3": 181, "tz": "America/Chicago", "fawe": [6, 2, 6, 5]},
    "Portland Trail Blazers": {"deg2": 341, "deg3": 75, "tz": "America/Los_Angeles", "fawe": [4, 5, 5, 6]},
    "Utah Jazz": {"deg2": 80, "deg3": 40, "tz": "America/Denver", "fawe": [2, 2, 2, 2]},
    "Golden State Warriors": {"deg2": 335, "deg3": 54, "tz": "America/Los_Angeles", "fawe": [8, 3, 3, 5]},
    "Los Angeles Clippers": {"deg2": 79, "deg3": 275, "tz": "America/Los_Angeles", "fawe": [8, 4, 5, 1]},
    "Los Angeles Lakers": {"deg2": 270, "deg3": 87, "tz": "America/Los_Angeles", "fawe": [7, 4, 4, 1]},
    "Phoenix Suns": {"deg2": 109, "deg3": 157, "tz": "America/Phoenix", "fawe": [6, 0, 4, 1]},
    "Sacramento Kings": {"deg2": 270, "deg3": 122, "tz": "America/Los_Angeles", "fawe": [5, 1, 7, 2]},
    "Dallas Mavericks": {"deg2": 128, "deg3": 293, "tz": "America/Chicago", "fawe": [5, 3, 6, 1]},
    "Houston Rockets": {"deg2": 359, "deg3": 191, "tz": "America/Chicago", "fawe": [7, 0, 3, 4]},
    "Memphis Grizzlies": {"deg2": 215, "deg3": 200, "tz": "America/Chicago", "fawe": [7, 4, 3, 2]},
    "New Orleans Pelicans": {"deg2": 13, "deg3": 346, "tz": "America/Chicago", "fawe": [8, 2, 7, 1]},
    "San Antonio Spurs": {"deg2": 88, "deg3": 123, "tz": "America/Chicago", "fawe": [7, 0, 6, 2]},
}

def compute_total_elem_12_block(d_ctx, tbl, h_tm, a_tm, hl12, al12, p_static, include_players=True):
    hn = norm_team(h_tm); an = norm_team(a_tm)
    tm_h = TEAM_META_30.get(hn); tm_a = TEAM_META_30.get(an)
    if not tm_h or not tm_a or not hl12 or not al12:
        return None
    ds = d_ctx[7]

    def _gff_of(ef_vec):
        gf_s = "".join("1" if abs(v) % 2 == 1 else "0" for v in ef_vec)
        b = [int(c) for c in gf_s]
        val = round((8 * (2 * b[0] - 1) * ef_vec[0] + 4 * (2 * b[1] - 1) * ef_vec[1] + 2 * (2 * b[2] - 1) * ef_vec[2] + (2 * b[3] - 1) * ef_vec[3]) / 10.0, 1)
        return gf_s, val

    def _eval_one(deg2, deg3, fawe):
        ep, ef, ed, md = pc.fast_eval_entity(d_ctx, 53, deg2, deg3, tuple(fawe), tbl)
        gf_s, gff_v = _gff_of(ef)
        pwr_v = round(
            (-md["qfin"][1]) * 1.5
            + (abs(md["qdec"][0]) + abs(md["qdec"][1])) * 0.08
            + (ed[0] + ed[1] - ed[2] - ed[3]) * 1.2,
            1,
        )
        return list(ep), list(ef), gf_s, gff_v, pwr_v

    def _side(lineup, tm_obj):
        ep_t, ef_t, gf_t, gff_t, pwr_t = _eval_one(tm_obj["deg2"], tm_obj["deg3"], tm_obj["fawe"])
        ep_s = [0, 0, 0, 0]
        nam_s = [0, 0, 0, 0]
        prows = []
        ents_13 = []

        for pid, mpg, is_st in lineup:
            ps = p_static.get(str(pid))
            if not ps:
                continue
            d2, d3 = int(ps["deg2"]), int(ps["deg3"])
            nf = tuple(ps["nam_fawe"])
            ep, ef, gf_s, gff_v, pwr_v = _eval_one(d2, d3, nf)
            for j in range(4):
                ep_s[j] += ep[j]
                nam_s[j] += nf[j]
            ents_13.append((gf_s, gff_v, pwr_v))
            if include_players:
                prows.append({
                    "fn": ps["fn"],
                    "no": ps.get("j_str", "0"),
                    "pos": ps.get("pos", ""),
                    "st": bool(is_st),
                    "mpg": round(float(mpg), 1),
                    "ep": f"{ep[0]}-{ep[1]}-{ep[2]}-{ep[3]}",
                    "ef": f"{ef[0]}-{ef[1]}-{ef[2]}-{ef[3]}",
                    "gf": gf_s,
                    "gff": gff_v,
                    "pwr": pwr_v,
                })

        ents_13.append((gf_t, gff_t, pwr_t))
        tm_ent = {
            "ep": f"{ep_t[0]}-{ep_t[1]}-{ep_t[2]}-{ep_t[3]}",
            "ef": f"{ef_t[0]}-{ef_t[1]}-{ef_t[2]}-{ef_t[3]}",
            "gf": gf_t,
            "gff": gff_t,
            "pwr": pwr_t,
        }

        cnt1 = sum(1 for gfs, _, _ in ents_13 if gfs[:1] == "1")
        cnt0 = sum(1 for gfs, _, _ in ents_13 if gfs[:1] == "0")
        cnt0011 = sum(1 for gfs, _, _ in ents_13 if gfs == "0011")
        w_gff = round(sum(gv for gfs, gv, _ in ents_13 if gfs[:1] == "1"), 1)
        c_gff = round(sum(gv for gfs, gv, _ in ents_13 if gfs[:1] == "0"), 1)
        c0011_gff = round(sum(gv for gfs, gv, _ in ents_13 if gfs == "0011"), 1)
        s_gff = round(w_gff + c_gff, 1)
        d_gff = round(w_gff - c_gff, 1)

        w_pwr = round(sum(pv for gfs, _, pv in ents_13 if gfs[:1] == "1"), 1)
        c_pwr = round(sum(pv for gfs, _, pv in ents_13 if gfs[:1] == "0"), 1)
        s_pwr = round(w_pwr + c_pwr, 1)
        d_pwr = round(w_pwr - c_pwr, 1)

        def _calc(ep_v, nam_v):
            ef_v = [ep_v[j] + ds[j] for j in range(4)]
            ed_v = [ep_v[j] + ef_v[j] for j in range(4)]
            tot_v = [ed_v[j] + nam_v[j] for j in range(4)]
            gf_v, gff_v = _gff_of(ef_v)
            qtot_v = (tot_v[0] + tot_v[1]) - (tot_v[2] + tot_v[3])
            return ep_v, ef_v, gf_v, gff_v, qtot_v

        _, _, gf_p12, gff_p12, _ = _calc(ep_s, nam_s)
        ep_tot, ef_tot, gf_tot, gff_tot, qtot_tot = _calc(
            [ep_s[j] + ep_t[j] for j in range(4)],
            [nam_s[j] + tm_obj["fawe"][j] for j in range(4)],
        )
        return {
            "cnt": len(prows) if include_players else len(lineup),
            "cnt1": cnt1, "cnt0": cnt0, "cnt0011": cnt0011,
            "w_gff": w_gff, "c_gff": c_gff, "c0011_gff": c0011_gff, "s_gff": s_gff, "d_gff": d_gff,
            "w_pwr": w_pwr, "c_pwr": c_pwr, "s_pwr": s_pwr, "d_pwr": d_pwr,
            "ep_p12": ep_s,
            "ep_tm": ep_t,
            "ep_tot": ep_tot,
            "ef_tot": ef_tot,
            "gf_p12": gf_p12,
            "gff_p12": gff_p12,
            "gf_tot": gf_tot,
            "gff_tot": gff_tot,
            "qtot": qtot_tot,
            "tm_ent": tm_ent,
            "players": prows,
        }

    hs = _side(hl12, tm_h)
    as_ = _side(al12, tm_a)
    out = {
        "h_cnt12": len(hl12), "a_cnt12": len(al12),
        "h_cnt1": hs["cnt1"], "a_cnt1": as_["cnt1"],
        "h_cnt0": hs["cnt0"], "a_cnt0": as_["cnt0"],
        "h_cnt0011": hs["cnt0011"], "a_cnt0011": as_["cnt0011"],
        "h_w_gff": hs["w_gff"], "a_w_gff": as_["w_gff"],
        "h_c_gff": hs["c_gff"], "a_c_gff": as_["c_gff"],
        "h_c0011_gff": hs["c0011_gff"], "a_c0011_gff": as_["c0011_gff"],
        "h_s_gff": hs["s_gff"], "a_s_gff": as_["s_gff"],
        "h_d_gff": hs["d_gff"], "a_d_gff": as_["d_gff"],
        "h_w_pwr": hs["w_pwr"], "a_w_pwr": as_["w_pwr"],
        "h_c_pwr": hs["c_pwr"], "a_c_pwr": as_["c_pwr"],
        "h_s_pwr": hs["s_pwr"], "a_s_pwr": as_["s_pwr"],
        "h_d_pwr": hs["d_pwr"], "a_d_pwr": as_["d_pwr"],
        "h_ep_p12": hs["ep_p12"], "a_ep_p12": as_["ep_p12"],
        "h_ep_tm": hs["ep_tm"], "a_ep_tm": as_["ep_tm"],
        "h_ep_tot": hs["ep_tot"], "a_ep_tot": as_["ep_tot"],
        "h_ef_tot": hs["ef_tot"], "a_ef_tot": as_["ef_tot"],
        "h_gf_p12": hs["gf_p12"], "a_gf_p12": as_["gf_p12"],
        "h_gff_p12": hs["gff_p12"], "a_gff_p12": as_["gff_p12"],
        "h_gf_tot": hs["gf_tot"], "a_gf_tot": as_["gf_tot"],
        "h_gff_tot": hs["gff_tot"], "a_gff_tot": as_["gff_tot"],
        "h_qtot": hs["qtot"], "a_qtot": as_["qtot"],
        "h_tm_ent": hs["tm_ent"], "a_tm_ent": as_["tm_ent"],
    }
    if include_players:
        out["h_p12"] = hs["players"]
        out["a_p12"] = as_["players"]
    return out

def eval_mode14_total_elem_12(g, t12):
    h = norm_team(g["h"]); a = norm_team(g["a"])
    if not t12 or "h_w_gff" not in t12:
        pk = norm_team(g.get("sys_win") or h)
        return False, False, pk, "TOT12_HOLD", "داده دوقطبی ۱۲ بازیکن + تیم در دسترس نیست", False

    hw = float(t12["h_w_gff"]); aw = float(t12["a_w_gff"])
    hc_v = float(t12["h_c_gff"]); ac_v = float(t12["a_c_gff"])
    hd = float(t12["h_d_gff"]); ad = float(t12["a_d_gff"])
    hs = float(t12["h_s_gff"]); as_v = float(t12["a_s_gff"])
    ht = float(t12["h_gff_tot"]); at = float(t12["a_gff_tot"])

    vw = h if hw < aw else (a if aw < hw else "")
    vc = h if hc_v < ac_v else (a if ac_v < hc_v else "")
    vd = h if hd < ad else (a if ad < hd else "")
    vt = h if ht < at else (a if at < ht else "")
    vs_all = h if hs < as_v else (a if as_v < hs else "")

    votes4 = [vw, vc, vd, vt]
    h_cnt = sum(1 for v in votes4 if v == h)
    a_cnt = sum(1 for v in votes4 if v == a)
    p = h if h_cnt > a_cnt else (a if a_cnt > h_cnt else (vt or vd or vw or h))
    o = a if p == h else h

    wtp = g.get("wtp") or {}
    l5h = float(wtp.get("l5h", 50.0))
    hel = str(wtp.get("hel") or "AIR"); ael = str(wtp.get("ael") or "AIR")
    pel = hel if p == h else ael
    oel = hel if o == h else ael
    pl5 = round(l5h if p == h else (100.0 - l5h), 1)
    ol5 = round(100.0 - pl5, 1)

    if pel == "EARTH" and oel == "EARTH":
        return False, False, p, "TOT12_DUAL_EARTH_HOLD", "توقف ایمنی موتور ۱۴: تقابل دو تیم EARTH (ورود ممنوع)", False

    if pel == "EARTH" and oel != "EARTH" and ol5 >= 75.0 and (vt == o or vw == o or vc == o):
        is_vip = bool(ol5 >= 80.0 or (vw == o and vc == o))
        return True, is_vip, o, "TOT12_EARTH_FLIP", f"معکوس تله EARTH در قطبیت المنت کل → برد حریف {oel} ({ol5:.1f}%)", True

    if vw and vw == vd and vw == vt:
        w_el = hel if vw == h else ael
        w_l5 = round(l5h if vw == h else (100.0 - l5h), 1)
        if w_el != "EARTH" and ((vc == vw and w_l5 >= 62.0) or w_l5 >= 70.0):
            is_vip = bool((vc == vw and w_l5 >= 70.0) or w_l5 >= 76.0)
            tag_4 = "۴/۴ کامل" if vc == vw else "۳/۳ قطب گرم + تفاضل + المنت کل"
            return True, is_vip, vw, "TOT12_POLARITY_LOCK", f"قفل قطبیت کامل ({tag_4}) + {w_el} ({w_l5:.1f}%)", False

    if vw and vw == vc:
        b_el = hel if vw == h else ael
        b_l5 = round(l5h if vw == h else (100.0 - l5h), 1)
        if b_el != "EARTH" and ((vt == vw and b_l5 >= 68.0) or b_l5 >= 75.0):
            is_vip = bool((vt == vw and b_l5 >= 74.0) or b_l5 >= 80.0)
            return True, is_vip, vw, "TOT12_BIPOLAR_HARMONY", f"هم‌جهتی دوقطبی Σ(1xxx) و Σ(0xxx) در ۱۳ موجودیت + {b_el} ({b_l5:.1f}%)", False

    if vc and vc == vs_all and vc == vt:
        c_el = hel if vc == h else ael
        c_l5 = round(l5h if vc == h else (100.0 - l5h), 1)
        if c_el != "EARTH" and c_l5 >= 74.0:
            is_vip = bool(c_l5 >= 78.0)
            return True, is_vip, vc, "TOT12_COLD_TOTAL", f"قفل قطب سرد Σ(0xxx) + جمع کل ۱۳ موجودیت + {c_el} ({c_l5:.1f}%)", False

    def_pk = o if (pel == "EARTH" and oel != "EARTH") else p
    return False, False, def_pk, "TOT12_HOLD", f"مسیر پایه دوقطبی موتور ۱۴ (بدون احراز قفل ورود • {pel} {pl5:.1f}%)", bool(def_pk != p)

def eval_team_lineup_exact(d_ctx, lineup, tbl, p_static):
    tot_w = sum(w for _, w, _ in lineup) or 1.0
    ep_acc = [0.0, 0.0, 0.0, 0.0]
    m_keys = ["qdeg", "qfin", "qdec", "qdecf", "qtot", "qp2", "gd", "rul", "qnam"]
    m_acc = {k: [0.0, 0.0] for k in m_keys}
    cards = []
    for pid, mpg, is_st in lineup:
        ps = p_static[pid]
        w = mpg / tot_w
        d2, d3 = int(ps["deg2"]), int(ps["deg3"])
        ep, ef, ed, md = pc.fast_eval_entity(d_ctx, 53, d2, d3, tuple(ps["nam_fawe"]), tbl)
        for j in range(4):
            ep_acc[j] += w * ep[j]
        for k in m_keys:
            m_acc[k][0] += w * md[k][0]
            m_acc[k][1] += w * md[k][1]
        pwr = round(
            (-md["qfin"][1]) * 1.5
            + (abs(md["qdec"][0]) + abs(md["qdec"][1])) * 0.08
            + (ed[0] + ed[1] - ed[2] - ed[3]) * 1.2,
            1
        )
        ef_s = f"{ef[0]}-{ef[1]}-{ef[2]}-{ef[3]}"
        cards.append({
            "pid": pid, "fn": ps["fn"], "jn": ps["jn"], "no": ps["j_str"], "pos": ps["pos"],
            "st": is_st, "mpg": mpg, "d2": d2, "d3": d3,
            "ep": f"{ep[0]}-{ep[1]}-{ep[2]}-{ep[3]}",
            "ef": ef_s,
            "gf": geo_code_from_ef_str(ef_s),
            "qf": f"{pc.s4.fmt_hc(md['qfin'][0], False)}/{pc.s4.fmt_md(md['qfin'][1], False)}",
            "dec": md["decan_lbl"],
            "pwr": pwr,
        })
    ele_date_sum = d_ctx[7]
    ep_tm = tuple(min(4, max(0, int(round(ep_acc[j])))) for j in range(4))
    ef_tm = tuple(ep_tm[j] + ele_date_sum[j] for j in range(4))
    ed_tm = tuple(ep_tm[j] + ef_tm[j] for j in range(4))
    c12 = [f"{ed_tm[j]} {['FIRE','AIR','WATER','EARTH'][j]}" for j in range(4)] + \
          [f"{ef_tm[j]} {['FIRE','AIR','WATER','EARTH'][j]}" for j in range(4)] + \
          [f"{ep_tm[j]} {['FIRE','AIR','WATER','EARTH'][j]}" for j in range(4)]
    g_fin = "".join("1" if abs(ef_tm[j]) % 2 == 1 else "0" for j in range(4))
    g_dyn = "".join("1" if abs(ed_tm[j]) % 2 == 1 else "0" for j in range(4))
    return c12, g_fin, g_dyn, m_acc, cards

def score_5_player_fusion(mh_u, ma_u, mh_l, ma_l):
    def sA(hm, am):
        return (1 if hm["qfin"][1]<am["qfin"][1] else (-1 if hm["qfin"][1]>am["qfin"][1] else 0)) + \
               (1 if abs(hm["qdec"][0])+abs(hm["qdec"][1])>abs(am["qdec"][0])+abs(am["qdec"][1]) else (-1 if abs(hm["qdec"][0])+abs(hm["qdec"][1])<abs(am["qdec"][0])+abs(am["qdec"][1]) else 0)) + \
               (1 if hm["qtot"][1]<am["qtot"][1] else (-1 if hm["qtot"][1]>am["qtot"][1] else 0)) + \
               (1 if abs(hm["gd"][1])>abs(am["gd"][1]) else (-1 if abs(hm["gd"][1])<abs(am["gd"][1]) else 0)) + \
               (1 if hm["qp2"][0]<am["qp2"][0] else (-1 if hm["qp2"][0]>am["qp2"][0] else 0)) + \
               (1 if abs(hm["qnam"][0])+abs(hm["qnam"][1])>abs(am["qnam"][0])+abs(am["qnam"][1]) else (-1 if abs(hm["qnam"][0])+abs(hm["qnam"][1])<abs(am["qnam"][0])+abs(am["qnam"][1]) else 0))
    def sB(hm, am):
        return (1 if hm["qfin"][1]<am["qfin"][1] else (-1 if hm["qfin"][1]>am["qfin"][1] else 0)) + \
               (1 if hm["qtot"][1]<am["qtot"][1] else (-1 if hm["qtot"][1]>am["qtot"][1] else 0)) + \
               (1 if hm["qp2"][1]<am["qp2"][1] else (-1 if hm["qp2"][1]>am["qp2"][1] else 0)) + \
               (1 if hm["qdecf"][0]<am["qdecf"][0] else (-1 if hm["qdecf"][0]>am["qdecf"][0] else 0)) + \
               (1 if hm["rul"][0]<am["rul"][0] else (-1 if hm["rul"][0]>am["rul"][0] else 0)) + \
               (1 if abs(hm["qnam"][0])+abs(hm["qnam"][1])>abs(am["qnam"][0])+abs(am["qnam"][1]) else (-1 if abs(hm["qnam"][0])+abs(hm["qnam"][1])<abs(am["qnam"][0])+abs(am["qnam"][1]) else 0))
    def sC(hm, am):
        return (1 if hm["qdeg"][0]>am["qdeg"][0] else (-1 if hm["qdeg"][0]<am["qdeg"][0] else 0)) + \
               (1 if abs(hm["qfin"][0])+abs(hm["qfin"][1])<abs(am["qfin"][0])+abs(am["qfin"][1]) else (-1 if abs(hm["qfin"][0])+abs(hm["qfin"][1])>abs(am["qfin"][0])+abs(am["qfin"][1]) else 0)) + \
               (1 if abs(hm["qdec"][0])+abs(hm["qdec"][1])<abs(am["qdec"][0])+abs(am["qdec"][1]) else (-1 if abs(hm["qdec"][0])+abs(hm["qdec"][1])>abs(am["qdec"][0])+abs(am["qdec"][1]) else 0)) + \
               (1 if hm["qtot"][1]<am["qtot"][1] else (-1 if hm["qtot"][1]>am["qtot"][1] else 0)) + \
               (1 if abs(hm["rul"][1])<abs(am["rul"][1]) else (-1 if abs(hm["rul"][1])>abs(am["rul"][1]) else 0)) + \
               (1 if abs(hm["qnam"][0])+abs(hm["qnam"][1])>abs(am["qnam"][0])+abs(am["qnam"][1]) else (-1 if abs(hm["qnam"][0])+abs(hm["qnam"][1])<abs(am["qnam"][0])+abs(am["qnam"][1]) else 0))
    def sD(hm, am):
        return (1 if hm["qfin"][1]<am["qfin"][1] else (-1 if hm["qfin"][1]>am["qfin"][1] else 0)) + \
               (1 if abs(hm["qdec"][0])+abs(hm["qdec"][1])>abs(am["qdec"][0])+abs(am["qdec"][1]) else (-1 if abs(hm["qdec"][0])+abs(hm["qdec"][1])<abs(am["qdec"][0])+abs(am["qdec"][1]) else 0)) + \
               (1 if hm["qtot"][1]<am["qtot"][1] else (-1 if hm["qtot"][1]>am["qtot"][1] else 0)) + \
               (1 if hm["qp2"][1]<am["qp2"][1] else (-1 if hm["qp2"][1]>am["qp2"][1] else 0)) + \
               (1 if abs(hm["qdecf"][0])<abs(am["qdecf"][0]) else (-1 if abs(hm["qdecf"][0])>abs(am["qdecf"][0]) else 0)) + \
               (1 if abs(hm["qnam"][0])+abs(hm["qnam"][1])>abs(am["qnam"][0])+abs(am["qnam"][1]) else (-1 if abs(hm["qnam"][0])+abs(hm["qnam"][1])<abs(am["qnam"][0])+abs(am["qnam"][1]) else 0))
    def sE(hm, am):
        return (1 if abs(hm["qdec"][1])<abs(am["qdec"][1]) else (-1 if abs(hm["qdec"][1])>abs(am["qdec"][1]) else 0)) + \
               (1 if hm["gd"][1]<am["gd"][1] else (-1 if hm["gd"][1]>am["gd"][1] else 0)) + \
               (1 if abs(hm["qdecf"][0])<abs(am["qdecf"][0]) else (-1 if abs(hm["qdecf"][0])>abs(am["qdecf"][0]) else 0)) + \
               (1 if abs(hm["qfin"][0])+abs(hm["qfin"][1])<abs(am["qfin"][0])+abs(am["qfin"][1]) else (-1 if abs(hm["qfin"][0])+abs(hm["qfin"][1])>abs(am["qfin"][0])+abs(am["qfin"][1]) else 0)) + \
               (1 if hm["qtot"][1]<am["qtot"][1] else (-1 if hm["qtot"][1]>am["qtot"][1] else 0)) + \
               (1 if abs(hm["qnam"][0])+abs(hm["qnam"][1])>abs(am["qnam"][0])+abs(am["qnam"][1]) else (-1 if abs(hm["qnam"][0])+abs(hm["qnam"][1])<abs(am["qnam"][0])+abs(am["qnam"][1]) else 0))
    mv = [sA(mh_u,ma_u), sB(mh_u,ma_u), sC(mh_l,ma_l), sD(mh_u,ma_u), sE(mh_l,ma_l)]
    f30 = sum(mv)
    ag5 = sum(1 for v in mv if (v > 0 if f30 >= 0 else v < 0))
    return mv, f30, ag5

def auto_filter_exact(h12, tgeo, dpool, geo_first=False, gk="h_dyn", target_min=3):
    pool = list(dpool); used = set(); used_geo = False
    if geo_first and tgeo:
        nxt = [x for x in pool if x[gk] == tgeo]
        if len(nxt) >= target_min:
            pool = nxt; used_geo = True
    while len(pool) > 7:
        bc, bnxt, bcnt = None, None, -1
        for c in range(12):
            if c in used: continue
            tv = h12[c]
            if not tv: continue
            nxt = [x for x in pool if x["h12"][c] == tv]
            if 5 <= len(nxt) < len(pool) and len(nxt) > bcnt:
                bc, bnxt, bcnt = c, nxt, len(nxt)
        if bc is None: break
        used.add(bc); pool = bnxt
        if 5 <= len(pool) <= 7: break
    if (not geo_first) and (not used_geo) and tgeo and len(pool) > 7:
        nxt = [x for x in pool if x[gk] == tgeo]
        if 5 <= len(nxt) <= 7: pool = nxt
    nat = 5 <= len(pool) <= 7
    chosen = pool if len(pool) <= 7 else pool[-7:]
    hw, aw, d_raw, s_delta, eff = nls.pool_idx_ds(chosen)
    tot = max(1, hw + aw); pct = round(max(hw, aw) * 100.0 / tot, 1)
    return {"pool": chosen, "hw": hw, "aw": aw, "pct": pct, "mv": abs(hw - aw), "nat": nat, "ds": eff}

def recompute_all_fusion_modes(g):
    h = norm_team(g["h"]); a = norm_team(g["a"])
    hp_list = g.get("h_players") or []
    ap_list = g.get("a_players") or []
    def _calc_p_gf_fin(p_obj):
        ef_parts = [int(x) for x in str(p_obj.get("ef", "0-0-0-0")).split("-")[:4]]
        while len(ef_parts) < 4:
            ef_parts.append(0)
        f1v, f2v, f3v, f4v = ef_parts
        gf_s = str(p_obj.get("gf", ""))
        if len(gf_s) != 4:
            gf_s = "".join("1" if abs(v) % 2 == 1 else "0" for v in ef_parts)
            p_obj["gf"] = gf_s
        b1v, b2v, b3v, b4v = [int(ch) for ch in gf_s]
        sv1 = (2 * b1v - 1) * f1v
        sv2 = (2 * b2v - 1) * f2v
        sv3 = (2 * b3v - 1) * f3v
        sv4 = (2 * b4v - 1) * f4v
        val = round((8 * sv1 + 4 * sv2 + 2 * sv3 + 1 * sv4) / 10.0, 1)
        p_obj["gf_fin"] = val
        return val

    h_gf = round(sum(_calc_p_gf_fin(p) for p in hp_list), 1)
    a_gf = round(sum(_calc_p_gf_fin(p) for p in ap_list), 1)
    gf_diff = round(h_gf - a_gf, 1)
    gf_abs_diff = round(abs(gf_diff), 1)
    gf_win = h if h_gf < a_gf else (a if a_gf < h_gf else "")

    h_1xxx = [float(p["pwr"]) for p in hp_list if str(p.get("gf", ""))[:1] == "1"]
    a_1xxx = [float(p["pwr"]) for p in ap_list if str(p.get("gf", ""))[:1] == "1"]
    h_0xxx_arr = [float(p["pwr"]) for p in hp_list if str(p.get("gf", ""))[:1] == "0"]
    a_0xxx_arr = [float(p["pwr"]) for p in ap_list if str(p.get("gf", ""))[:1] == "0"]
    h_0011_arr = [float(p["pwr"]) for p in hp_list if str(p.get("gf", "")) == "0011"]
    a_0011_arr = [float(p["pwr"]) for p in ap_list if str(p.get("gf", "")) == "0011"]
    h_sum = round(sum(h_1xxx), 1); a_sum = round(sum(a_1xxx), 1)
    h_cnt = len(h_1xxx); a_cnt = len(a_1xxx)
    h_0xxx = round(sum(h_0xxx_arr), 1); a_0xxx = round(sum(a_0xxx_arr), 1)
    h_0cnt = len(h_0xxx_arr); a_0cnt = len(a_0xxx_arr)
    h_0011 = round(sum(h_0011_arr), 1); a_0011 = round(sum(a_0011_arr), 1)
    h_0011_cnt = len(h_0011_arr); a_0011_cnt = len(a_0011_arr)
    h_all = round(sum(float(p["pwr"]) for p in hp_list), 1)
    a_all = round(sum(float(p["pwr"]) for p in ap_list), 1)
    g1_win = h if h_sum < a_sum else (a if a_sum < h_sum else "")
    cold0_win = h if h_0xxx < a_0xxx else (a if a_0xxx < h_0xxx else "")
    cold0_diff = round(h_0xxx - a_0xxx, 1)
    c0011_win = h if h_0011 < a_0011 else (a if a_0011 < h_0011 else "")
    bipolar_win = (
        h if (h_sum < a_sum and h_sum < 0.0 and h_0xxx < a_0xxx and h_0xxx < 0.0)
        else a if (a_sum < h_sum and a_sum < 0.0 and a_0xxx < h_0xxx and a_0xxx < 0.0)
        else ""
    )
    triple_pole_win = (
        h if (bipolar_win == h and h_0011 < a_0011 and h_0011 < 0.0)
        else a if (bipolar_win == a and a_0011 < h_0011 and a_0011 < 0.0)
        else ""
    )
    pole_clash = bool(g1_win and cold0_win and g1_win != cold0_win)
    all_win = h if h_all < a_all else (a if a_all < h_all else "")
    dl_win = g1_win if (g1_win and g1_win == all_win) else ""
    votes_3 = [w for w in (g1_win, all_win, gf_win) if w]
    h_v3 = sum(1 for w in votes_3 if w == h)
    a_v3 = sum(1 for w in votes_3 if w == a)
    maj23_win = h if h_v3 >= 2 else (a if a_v3 >= 2 else "")
    triple3_win = h if h_v3 == 3 else (a if a_v3 == 3 else "")

    w_wk = g.get("wtp") or {}
    w_dy = g.get("wtp_day") or w_wk

    both_pos = bool(h_sum > 0.0 and a_sum > 0.0 and h_sum != a_sum)
    pos_inv_triggered = False; pos_inv_win = ""; pos_inv_case = ""
    pos_inv_dc = 0; pos_inv_d1 = round(abs(h_sum - a_sum), 1); pos_inv_l5_big = 50.0; pos_inv_reason_fa = ""
    case1_earth = False; case2_cnt3 = False

    if both_pos:
        big_team = h if h_sum > a_sum else a
        big_is_h = (big_team == h)
        c_big = h_cnt if big_is_h else a_cnt
        c_sml = a_cnt if big_is_h else h_cnt
        pos_inv_dc = c_big - c_sml
        el_sml_wk = str(w_wk.get("ael" if big_is_h else "hel", ""))
        el_big_wk = str(w_wk.get("hel" if big_is_h else "ael", ""))
        pos_inv_l5_big = round(float(w_wk.get("l5h", 50.0)) if big_is_h else (100.0 - float(w_wk.get("l5h", 50.0))), 1)
        case1_earth = bool(el_sml_wk == "EARTH" and el_big_wk != "EARTH" and pos_inv_l5_big >= 55.0 and pos_inv_d1 >= 4.0)
        case2_cnt3  = bool(pos_inv_dc >= 3 and pos_inv_d1 >= 6.0)
        pos_inv_triggered = bool(case1_earth or case2_cnt3)
        if pos_inv_triggered:
            pos_inv_win = big_team
            if case1_earth and case2_cnt3:
                pos_inv_case = "BOTH"
                pos_inv_reason_fa = f"معکوس دو-مثبت (+,+): برد مثبتِ بزرگ‌تر (کوچک‌تر EARTH + Δتعداد ۱xxx={pos_inv_dc})"
            elif case1_earth:
                pos_inv_case = "SMALL_EARTH"
                pos_inv_reason_fa = f"معکوس دو-مثبت (+,+): برد مثبتِ بزرگ‌تر (تیم کوچک‌تر EARTH • L5:{pos_inv_l5_big}%)"
            else:
                pos_inv_case = "CNT_GAP_3"
                pos_inv_reason_fa = f"معکوس دو-مثبت (+,+): برد مثبتِ بزرگ‌تر (Δتعداد ۱xxx={pos_inv_dc} ≥ ۳ • Δ1={pos_inv_d1})"
        else:
            pos_inv_case = "KEEP_SMALL"
            pos_inv_reason_fa = "دو-مثبت متعادل: حفظ مثبتِ کوچک‌تر"

    fm = g["fusion_meta"]
    dp_m = fm["modes"]["dual_pillar"]
    vp_m = fm["modes"]["vip_cross"]
    pk_dp = norm_team(dp_m["pick"])
    pk_vp = norm_team(vp_m["pick"])

    fm["modes"]["geo_1xxx_lock"] = {
        "sig": bool(dp_m["sig"] and g1_win == pk_dp),
        "vip": bool(vp_m["sig"] and g1_win == pk_vp),
        "pick": pk_dp if (dp_m["sig"] and g1_win == pk_dp) else (g1_win or pk_dp),
    }
    fm["modes"]["double_pwr_lock"] = {
        "sig": bool(dp_m["sig"] and dl_win == pk_dp),
        "vip": bool(vp_m["sig"] and dl_win == pk_vp),
        "pick": pk_dp if (dp_m["sig"] and dl_win == pk_dp) else (dl_win or g1_win or pk_dp),
    }

    def eval_team_locks(cand):
        if not cand:
            return {
                "team": "", "el_wk": "", "el_dy": "", "opp_el_wk": "", "opp_el_dy": "",
                "l5_wk": 50.0, "l5_dy": 50.0, "earth_ok": False, "has_neg": False,
                "margin_ok": False, "neg_anchor_ok": False, "pos_inv_trap": False,
                "d1": 0.0, "d8": 0.0, "s1": 0.0, "s8": 0.0, "safe_ok": False, "reason_fa": "بدون قفل دوگانه"
            }
        ish = (cand == h)
        el_wk = str(w_wk.get("hel" if ish else "ael", ""))
        el_dy = str(w_dy.get("hel" if ish else "ael", ""))
        opp_el_wk = str(w_wk.get("ael" if ish else "hel", ""))
        opp_el_dy = str(w_dy.get("ael" if ish else "hel", ""))
        l5_wk = round(float(w_wk.get("l5h", 50.0)) if ish else (100.0 - float(w_wk.get("l5h", 50.0))), 1)
        l5_dy = round(float(w_dy.get("l5h", 50.0)) if ish else (100.0 - float(w_dy.get("l5h", 50.0))), 1)
        earth_trap = (el_wk == "EARTH" and opp_el_wk != "EARTH") or (el_dy == "EARTH" and opp_el_dy != "EARTH" and el_wk == "EARTH")
        earth_ok = not earth_trap
        s1 = h_sum if ish else a_sum; o1 = a_sum if ish else h_sum
        s8 = h_all if ish else a_all; o8 = a_all if ish else h_all
        c_cand = h_cnt if ish else a_cnt; c_opp = a_cnt if ish else h_cnt
        d1 = round(o1 - s1, 1); d8 = round(o8 - s8, 1)
        pos_inv_trap = bool(both_pos and ((pos_inv_triggered and cand != pos_inv_win) or (c_opp - c_cand) >= 3))
        plist_c = hp_list if ish else ap_list
        neg_1xxx_cnt = sum(1 for p in plist_c if str(p.get("gf", ""))[:1] == "1" and float(p.get("pwr", 0)) < 0)
        dry_fire_dom = (s8 > 0 and o8 > 0 and el_wk == "FIRE" and l5_wk >= 70.0 and neg_1xxx_cnt >= 1 and d1 >= 4.0)
        has_neg = (not pos_inv_trap) and ((s1 <= 0.0 or s8 < 0.0) or (d1 >= 4.0 and d8 >= 3.0) or dry_fire_dom)
        margin_ok = not (d1 < 1.0 or (d8 < 1.2 and not dry_fire_dom))
        neg_anchor_ok = bool(has_neg and margin_ok and not pos_inv_trap)
        dl_match = (dl_win == cand)
        safe_ok = bool(dl_match and earth_ok and neg_anchor_ok)
        reasons = []
        if not dl_match: reasons.append("واگرایی 1xxx و Σ(8)")
        if not earth_ok: reasons.append(f"رد قفل EARTH ({el_wk or el_dy} برابر {opp_el_wk or opp_el_dy})")
        if pos_inv_trap: reasons.append(f"رد تله دو-مثبت (برگشت به مثبتِ بزرگ‌تر • Δتعداد={c_opp - c_cand})")
        elif not has_neg: reasons.append("فاقد لنگر منفی (هر دو مثبت ضعیف)")
        elif dl_match and not margin_ok: reasons.append(f"فاصله مرزی ناچیز (Δ1={d1}, ΔΣ8={d8})")
        reason_fa = " • ".join(reasons) if reasons else "قفل ایمن تایید شد"
        return {
            "team": cand, "el_wk": el_wk, "el_dy": el_dy, "opp_el_wk": opp_el_wk, "opp_el_dy": opp_el_dy,
            "l5_wk": l5_wk, "l5_dy": l5_dy, "earth_ok": earth_ok, "has_neg": has_neg, "margin_ok": margin_ok,
            "neg_anchor_ok": neg_anchor_ok, "pos_inv_trap": pos_inv_trap, "d1": d1, "d8": d8,
            "s1": s1, "s8": s8, "safe_ok": safe_ok, "reason_fa": reason_fa,
        }

    eval_target = dl_win if dl_win else pk_dp
    gd_info = eval_team_locks(eval_target)
    dp_locks = eval_team_locks(pk_dp)
    safe_dl_team = dl_win if gd_info["safe_ok"] else ""

    is_div_1_8 = bool(g1_win and all_win and g1_win != all_win and not both_pos)
    dp_cnt_1xxx = h_cnt if pk_dp == h else a_cnt
    gf_div_dp_ok = bool(
        is_div_1_8 and dp_m["sig"] and gf_win and gf_win == pk_dp and dp_cnt_1xxx >= 1
        and gf_abs_diff >= 6.0 and (gf_win == g1_win or gf_win == all_win)
        and dp_locks["earth_ok"] and (dp_locks["s1"] <= 0.0 or dp_locks["s8"] < 0.0)
    )
    gf_div_core_ok = False
    if is_div_1_8 and gf_win and gf_abs_diff >= 6.0 and (gf_win == g1_win or gf_win == all_win):
        gf_cnt_1xxx = h_cnt if gf_win == h else a_cnt
        gf_locks = eval_team_locks(gf_win)
        tpk_g = norm_team(fm["team"]["pick"])
        ppk_g = norm_team(fm["player"]["pick"])
        b2b_g = str(g.get("b2b_tag") or "")
        gf_div_core_ok = bool(
            gf_div_dp_ok or (
                gf_cnt_1xxx >= 1 and gf_locks["earth_ok"] and gf_locks["l5_wk"] >= 60.0
                and gf_locks["s1"] < 0.0 and gf_locks["s8"] < 0.0
                and tpk_g == gf_win and ppk_g == gf_win and b2b_g != "B2B_AGAINST"
            )
        )

    m7_base = bool(fm["modes"]["double_pwr_lock"]["sig"] and dp_locks["safe_ok"])
    m7_sig = bool(m7_base or gf_div_dp_ok)
    m7_vip = bool((fm["modes"]["double_pwr_lock"]["vip"] and dp_locks["safe_ok"]) or (gf_div_dp_ok and vp_m["sig"] and pk_vp == gf_win))
    fm["modes"]["earth_neg_lock"] = {
        "sig": m7_sig, "vip": m7_vip,
        "pick": pk_dp if m7_sig else (safe_dl_team or maj23_win or dl_win or pk_dp),
    }

    m8_sig = bool(m7_sig or gf_div_core_ok)
    m8_vip = m7_vip
    m8_pick = pk_dp if m7_sig else gf_win if gf_div_core_ok else (safe_dl_team or maj23_win or dl_win or pk_dp)
    vip_safedl_rescue = False
    if dl_win:
        dl_locks = eval_team_locks(dl_win)
        tpk_c = norm_team(fm["team"]["pick"])
        ppk_c = norm_team(fm["player"]["pick"])
        t_vip_c = bool(fm["team"]["vip"])
        p_vip_c = bool(fm["player"]["vip"])
        sgn_dl = 1 if dl_win == h else -1
        f30_t_ok = (int(fm["team"]["f30"]) * sgn_dl > 0)
        f30_p_ok = (int(fm["player"]["f30"]) * sgn_dl > 0)
        trap_s = str(g.get("trap_tag") or "")
        b2b_s = str(g.get("b2b_tag") or "")
        no_hard_trap = ("CAP7" not in trap_s) and (b2b_s != "B2B_PICK")
        vip_safedl_rescue = bool(
            dl_locks["safe_ok"] and dl_locks["l5_wk"] >= 65.0 and no_hard_trap
            and ((p_vip_c and ppk_c == dl_win) or (t_vip_c and tpk_c == dl_win))
        )
        if not m8_sig and (
            vip_safedl_rescue or (
                dl_locks["safe_ok"] and dl_locks["l5_wk"] >= 60.0 and dl_locks["l5_dy"] >= 60.0
                and tpk_c == dl_win and ppk_c == dl_win and (f30_t_ok or f30_p_ok) and no_hard_trap
            )
        ):
            m8_sig = True
            m8_vip = bool(vip_safedl_rescue or (dl_locks["el_wk"] == "FIRE" and dl_locks["s1"] < 0 and dl_locks["s8"] < 0))
            m8_pick = dl_win
    fm["modes"]["safe_dl_core"] = {"sig": m8_sig, "vip": m8_vip, "pick": m8_pick}

    m9_sig = bool(m7_sig or vip_safedl_rescue or pos_inv_triggered)
    m9_pick = pk_dp if m7_sig else dl_win if vip_safedl_rescue else pos_inv_win if pos_inv_triggered else (safe_dl_team or maj23_win or dl_win or pk_dp)
    m9_vip = bool(m7_vip or vip_safedl_rescue or (pos_inv_triggered and case1_earth and pos_inv_l5_big >= 65.0))
    fm["modes"]["pos_inv_lock"] = {"sig": m9_sig, "vip": m9_vip, "pick": m9_pick}

    m10_sig = bool(gf_win)
    m10_pick = gf_win if gf_win else h
    m10_vip = bool(gf_win and gf_abs_diff >= 10.0)
    fm["modes"]["gf_fin_pure"] = {"sig": m10_sig, "vip": m10_vip, "pick": m10_pick}

    gap3_h = round((a_sum - h_sum) + (a_all - h_all) + 1.5 * (a_gf - h_gf), 1)
    h_s3 = round(h_sum + h_all + h_gf, 1)
    a_s3 = round(a_sum + a_all + a_gf, 1)
    s3_diff = round(h_s3 - a_s3, 1)
    s3_abs_diff = round(abs(s3_diff), 1)
    s3_win = h if h_s3 < a_s3 else (a if a_s3 < h_s3 else "")

    l5h_wk_v = float(w_wk.get("l5h", 50.0))
    l5h_dy_v = float(w_dy.get("l5h", 50.0))
    hel_wk_v = str(w_wk.get("hel", ""))
    ael_wk_v = str(w_wk.get("ael", ""))

    s3_sign_split = bool((not both_pos) and ((h_s3 < 0.0 and a_s3 > 0.0) or (a_s3 < 0.0 and h_s3 > 0.0)))
    s3_split_team = h if (s3_sign_split and h_s3 < 0.0) else (a if (s3_sign_split and a_s3 < 0.0) else "")
    s3_split_m11_ok = False; s3_split_m12_ok = False; s3_split_l5 = 50.0; s3_split_el = ""
    if s3_split_team:
        s3_ish = (s3_split_team == h)
        s3_split_el = hel_wk_v if s3_ish else ael_wk_v
        s3_opp_el = ael_wk_v if s3_ish else hel_wk_v
        s3_split_l5 = round(l5h_wk_v if s3_ish else (100.0 - l5h_wk_v), 1)
        s3_cnt = h_cnt if s3_ish else a_cnt
        s3_earth_ok = not (s3_split_el == "EARTH" and s3_opp_el != "EARTH")
        s3_cnt_ok = (s3_cnt >= 1 or s3_opp_el == "EARTH")
        s3_split_m11_ok = bool(s3_earth_ok and s3_cnt_ok and s3_split_l5 >= 58.0)
        s3_split_m12_ok = bool(s3_earth_ok and s3_cnt_ok and s3_split_l5 >= 55.0 and dp_m["sig"] and pk_dp == s3_split_team)

    one_zero_1xxx = (h_cnt == 0) != (a_cnt == 0)
    zero_1xxx_team = h if (one_zero_1xxx and h_cnt == 0) else (a if (one_zero_1xxx and a_cnt == 0) else "")
    zero_1xxx_opp  = a if zero_1xxx_team == h else (h if zero_1xxx_team == a else "")
    zero_opp_strong = False; zero_opp_route = False; zero_opp_l5 = 50.0; zero_opp_el = ""
    if zero_1xxx_team:
        z_is_h = (zero_1xxx_team == h)
        z_el = hel_wk_v if z_is_h else ael_wk_v
        zero_opp_el = ael_wk_v if z_is_h else hel_wk_v
        zero_opp_l5 = round((100.0 - l5h_wk_v) if z_is_h else l5h_wk_v, 1)
        opp_c_1xxx = a_cnt if z_is_h else h_cnt
        opp_s1_val = a_sum if z_is_h else h_sum
        zero_opp_strong = bool(zero_opp_el != "EARTH" and (z_el == "EARTH" or zero_opp_l5 >= 62.0 or (zero_opp_l5 >= 58.0 and opp_c_1xxx >= 2)))
        zero_opp_route = bool(opp_s1_val < 0.0 or zero_opp_strong or (zero_opp_el != "EARTH" and (z_el == "EARTH" or zero_opp_l5 >= 55.0)))

    cold_tame_pi = False; cold_tame_win = ""; cold_tame_s0 = 0.0; cold_tame_b0 = 0.0
    if pos_inv_triggered and pos_inv_case == "CNT_GAP_3":
        big_pi_t = norm_team(pos_inv_win)
        sml_pi_t = a if big_pi_t == h else h
        b0_pi = h_0xxx if big_pi_t == h else a_0xxx
        s0_pi = a_0xxx if big_pi_t == h else h_0xxx
        el_sml_pi = hel_wk_v if sml_pi_t == h else ael_wk_v
        if el_sml_pi != "EARTH" and s0_pi <= -4.0 and b0_pi >= 0.0:
            cold_tame_pi = True; cold_tame_win = sml_pi_t; cold_tame_s0 = s0_pi; cold_tame_b0 = b0_pi

    tpk_fb = norm_team(fm["team"]["pick"])
    ppk_fb = norm_team(fm["player"]["pick"])
    if cold_tame_pi:
        routed_default_pk = cold_tame_win
        routed_default_fa = f"مهار دو-مثبت با لنگر قطب سرد Σ(0xxx) ({cold_tame_s0:+.1f} برابر {cold_tame_b0:+.1f}) → برد {cold_tame_win}"
    elif pos_inv_triggered:
        routed_default_pk = pos_inv_win
        routed_default_fa = f"معکوس دو-مثبت (+,+) → برد {pos_inv_win}"
    elif zero_opp_route:
        routed_default_pk = zero_1xxx_opp
        routed_default_fa = f"الگوی ۱xxx=0.0 (حبس کامل ۰xxx در {zero_1xxx_team}) → برد حریف {zero_1xxx_opp}"
    elif both_pos and not pos_inv_triggered:
        sml_bp = h if h_sum < a_sum else (a if a_sum < h_sum else (s3_win or maj23_win or h))
        ish_bp = (sml_bp == h); opp_bp = a if ish_bp else h
        el_s_bp = hel_wk_v if ish_bp else ael_wk_v; el_o_bp = ael_wk_v if ish_bp else hel_wk_v
        full_sweep_bp = (all_win == sml_bp and s3_win == sml_bp and tpk_fb == sml_bp and ppk_fb == sml_bp)
        if el_s_bp == "EARTH" and el_o_bp != "EARTH" and not full_sweep_bp:
            routed_default_pk = opp_bp; routed_default_fa = f"معکوس تله EARTH در دو-مثبت → مسیر برنده: {opp_bp}"
        else:
            routed_default_pk = sml_bp; routed_default_fa = f"دو-مثبت متعادل (+,+) + برتری Σ(3) → مسیر برنده: {sml_bp}"
    else:
        cand_s3_fb = s3_win or maj23_win or g1_win or h
        ish_fb = (cand_s3_fb == h); opp_fb = a if ish_fb else h
        el_c_fb = hel_wk_v if ish_fb else ael_wk_v; el_o_fb = ael_wk_v if ish_fb else hel_wk_v
        l5_c_fb = l5h_wk_v if ish_fb else (100.0 - l5h_wk_v); l5_o_fb = 100.0 - l5_c_fb
        s1_c_fb = h_sum if ish_fb else a_sum; s8_c_fb = h_all if ish_fb else a_all; gf_c_fb = h_gf if ish_fb else a_gf
        if el_c_fb == "EARTH" and el_o_fb != "EARTH":
            routed_default_pk = opp_fb; routed_default_fa = f"معکوس تله EARTH → مسیر برنده موتور جدید: {opp_fb}"
        elif el_c_fb == "EARTH" and el_o_fb == "EARTH" and l5_o_fb >= 65.0:
            routed_default_pk = opp_fb; routed_default_fa = f"نبرد دو EARTH با برتری جدول ({round(l5_o_fb, 1)}%) → مسیر برنده: {opp_fb}"
        elif s1_c_fb >= 3.0 and s8_c_fb < 0.0 and gf_c_fb < 0.0 and el_o_fb != "EARTH" and l5_o_fb >= 60.0:
            routed_default_pk = opp_fb; routed_default_fa = f"معکوس تله تضاد علامت (+,-,-) → مسیر برنده: {opp_fb}"
        else:
            routed_default_pk = cand_s3_fb; routed_default_fa = f"موتور ۳ عددی + Σ(3) (منفی‌تر/کوچک‌تر) → مسیر برنده: {cand_s3_fb}"

    m11_sig = False; m11_vip = False; m11_pick = routed_default_pk
    m11_code = "ROUTED_FALLBACK"; m11_fa = routed_default_fa; m11_flipped = False
    if cold_tame_pi:
        m11_sig = True; m11_pick = cold_tame_win
        l5_ct11 = l5h_wk_v if m11_pick == h else (100.0 - l5h_wk_v)
        m11_vip = bool(l5_ct11 >= 68.0); m11_code = "COLD_ANCHOR_KEEP"
        m11_fa = f"مهار دو-مثبت (+,+) با لنگر منفی قطب سرد Σ(0xxx)={cold_tame_s0:+.1f} → حفظ {cold_tame_win}"
    elif pos_inv_triggered:
        m11_sig = True; m11_pick = pos_inv_win
        l5_p11 = l5h_wk_v if m11_pick == h else (100.0 - l5h_wk_v)
        el_p11 = hel_wk_v if m11_pick == h else ael_wk_v
        m11_vip = bool(l5_p11 >= 68.0 and el_p11 != "EARTH"); m11_code = "POS_INV_FLIP"
        m11_fa = pos_inv_reason_fa; m11_flipped = True
    elif zero_opp_strong:
        m11_sig = True; m11_pick = zero_1xxx_opp
        m11_vip = bool(zero_opp_l5 >= 70.0 and zero_opp_el == "FIRE"); m11_code = "ZERO_1XXX_OPP"
        m11_fa = f"الگوی ۱xxx=0.0 (حبس کامل ۰xxx در {zero_1xxx_team}) → برد حریف {zero_opp_el} ({zero_opp_l5}%)"
        m11_flipped = bool(maj23_win == zero_1xxx_team)
    elif both_pos and not pos_inv_triggered:
        sml_11 = h if h_sum < a_sum else a
        ish_s11 = (sml_11 == h); el_s11 = hel_wk_v if ish_s11 else ael_wk_v; l5_s11 = l5h_wk_v if ish_s11 else (100.0 - l5h_wk_v)
        if el_s11 != "EARTH" and l5_s11 >= 60.0:
            m11_sig = True; m11_vip = bool(l5_s11 >= 72.0); m11_pick = sml_11
            m11_code = "POS_BAL_KEEP"; m11_fa = "دو-مثبت متعادل (+,+): حفظ مثبتِ کوچک‌تر با سپر جدول"
    if not m11_sig and maj23_win:
        ish_11 = (maj23_win == h); opp_11 = a if ish_11 else h
        el_c11 = hel_wk_v if ish_11 else ael_wk_v; el_o11 = ael_wk_v if ish_11 else hel_wk_v
        l5_c11 = l5h_wk_v if ish_11 else (100.0 - l5h_wk_v); l5_o11 = 100.0 - l5_c11
        l5_o11_dy = (100.0 - l5h_dy_v) if ish_11 else l5h_dy_v
        s1_c11 = h_sum if ish_11 else a_sum; o1_c11 = a_sum if ish_11 else h_sum
        cnt_c11 = h_cnt if ish_11 else a_cnt; s8_c11 = h_all if ish_11 else a_all; gf_c11 = h_gf if ish_11 else a_gf
        v_c11 = h_v3 if ish_11 else a_v3; gap_c11 = gap3_h if ish_11 else round(-gap3_h, 1)
        if el_c11 == "EARTH" and el_o11 != "EARTH" and l5_o11 >= 66.0 and l5_o11_dy >= 60.0:
            m11_sig = True; m11_vip = bool(l5_o11 >= 75.0 and el_o11 == "FIRE"); m11_pick = opp_11
            m11_code = "EARTH_TRAP_FLIP"; m11_fa = f"معکوس تله EARTH (ضدحذف): انتقال برد به حریف {el_o11} ({round(l5_o11, 1)}%)"; m11_flipped = True
        elif s1_c11 >= 3.0 and s8_c11 < 0.0 and gf_c11 < 0.0 and el_o11 != "EARTH" and l5_o11 >= 64.0:
            m11_sig = True; m11_vip = bool(l5_o11 >= 74.0); m11_pick = opp_11
            m11_code = "SIGN_TRAP_FLIP"; m11_fa = "معکوس تله تضاد علامت (+,-,-) در ۰xxx → برد حریف"; m11_flipped = True
        elif not both_pos and cnt_c11 >= 1 and v_c11 == 3 and s1_c11 < 0.0 and s8_c11 < 0.0 and gap_c11 >= 40.0 and el_c11 != "EARTH" and l5_c11 >= 60.0:
            m11_sig = True; m11_vip = bool(l5_c11 >= 70.0 or gap_c11 >= 55.0); m11_pick = maj23_win
            m11_code = "TRI_3OF3_LOCK"; m11_fa = f"قفل مستقیم ۳/۳ قطب منفی (Gap3={gap_c11})"
        elif not both_pos and (cnt_c11 >= 1 or o1_c11 > 0.0) and v_c11 >= 2 and (s1_c11 <= 0.0 or s8_c11 < 0.0) and el_c11 != "EARTH" and (
            (el_o11 == "EARTH" and l5_c11 >= 66.0)
            or (cnt_c11 >= 1 and s1_c11 < 0.0 and s8_c11 < 0.0 and gap_c11 >= 25.0 and el_c11 == "FIRE" and l5_c11 >= 66.0)
        ):
            m11_sig = True; m11_vip = bool(l5_c11 >= 75.0 and s1_c11 < 0.0 and s8_c11 < 0.0); m11_pick = maj23_win
            m11_code = "TRI_2OF3_DOM"; m11_fa = f"برتری ۲/۳ اعداد + سپر جدول ({el_c11} {round(l5_c11, 1)}%)"
        elif el_c11 == "EARTH" and el_o11 == "EARTH" and cnt_c11 >= 1 and v_c11 >= 2 and s1_c11 < 0.0 and s8_c11 < 0.0 and l5_c11 >= 65.0 and gap_c11 >= 15.0:
            m11_sig = True; m11_vip = False; m11_pick = maj23_win
            m11_code = "BOTH_EARTH_DOM"; m11_fa = f"نبرد دو تیم EARTH: برتری ۲/۳ منفی + جدول ({round(l5_c11, 1)}%)"

    if not m11_sig and s3_split_m11_ok:
        m11_sig = True; m11_vip = bool(s3_split_l5 >= 70.0 and s3_split_el == "FIRE" and s3_abs_diff >= 15.0)
        m11_pick = s3_split_team; m11_code = "S3_SIGN_SPLIT"
        s3_neg_v = h_s3 if s3_split_team == h else a_s3; s3_pos_v = a_s3 if s3_split_team == h else h_s3
        m11_fa = f"تضاد علامت Σ(3) ({s3_neg_v:+.1f} برابر {s3_pos_v:+.1f}) + سپر جدول ({s3_split_el} {s3_split_l5}%)"
        m11_flipped = bool(maj23_win and maj23_win != s3_split_team)

    fm["modes"]["tri_gf_routed"] = {"sig": m11_sig, "vip": m11_vip, "pick": m11_pick}

    # Mode 12 (`tri_gf_ultralock` v68 with Dual Structural Safety Guards)
    m12_sig = False; m12_vip = False; m12_pick = m11_pick
    m12_code = "ULTRA_FALLBACK"; m12_fa = m11_fa; m12_flipped = m11_flipped
    tpk_12 = norm_team(fm["team"]["pick"]); ppk_12 = norm_team(fm["player"]["pick"])

    if m9_sig:
        pk12 = norm_team(m9_pick); vp12 = bool(m9_vip)
        if not pos_inv_triggered:
            ish_12 = (pk12 == h)
            gf_pk12 = h_gf if ish_12 else a_gf; gf_op12 = a_gf if ish_12 else h_gf
            l5_pk12 = l5h_wk_v if ish_12 else (100.0 - l5h_wk_v)
            if (gf_pk12 - gf_op12) >= 8.0:
                if l5_pk12 >= 73.0:
                    m12_sig = True; m12_vip = vp12; m12_pick = pk12
                    m12_code = "ULTRA_FIRE_KEEP"; m12_fa = f"حفظ ابرقفل FIRE ({round(l5_pk12, 1)}%) بدون حذف بازی"; m12_flipped = False
                else:
                    opp_12 = a if ish_12 else h; el_op12 = ael_wk_v if ish_12 else hel_wk_v
                    if l5_pk12 <= 55.0 and el_op12 != "EARTH":
                        m12_sig = True; m12_vip = False; m12_pick = opp_12
                        m12_code = "ULTRA_GF_FLIP"; m12_fa = "معکوس مخالفت سنگین GF-FIN (ضدحذف) → برد حریف"; m12_flipped = True
                    else:
                        m12_sig = False; m12_code = "ULTRA_GF_HOLD"; m12_fa = f"تضاد GF-FIN • مسیر پیشنهادی: {m11_pick}"
            else:
                m12_sig = True; m12_vip = vp12; m12_pick = pk12
                m12_code = "ULTRA_LOCK"; m12_fa = "ابرقفل ۳ عددی تلفیقی تایید شد"; m12_flipped = False
        else:
            if cold_tame_pi:
                m12_sig = True
                l5_ct12 = l5h_wk_v if cold_tame_win == h else (100.0 - l5h_wk_v)
                m12_vip = bool(l5_ct12 >= 68.0); m12_pick = cold_tame_win
                m12_code = "ULTRA_COLD_ANCHOR_KEEP"
                m12_fa = f"مهار دو-مثبت (+,+) با لنگر منفی قطب سرد Σ(0xxx)={cold_tame_s0:+.1f} → حفظ {cold_tame_win}"
                m12_flipped = False
            else:
                m12_sig = True; m12_vip = vp12; m12_pick = pk12
                m12_code = "ULTRA_POS_INV"; m12_fa = pos_inv_reason_fa; m12_flipped = True

    if not m12_sig and zero_opp_strong:
        if (dp_m["sig"] and pk_dp == zero_1xxx_opp) or (tpk_12 == zero_1xxx_opp and ppk_12 == zero_1xxx_opp and zero_opp_l5 >= 62.0):
            m12_sig = True; m12_vip = bool(zero_opp_l5 >= 70.0); m12_pick = zero_1xxx_opp
            m12_code = "ULTRA_ZERO_1XXX_OPP"
            m12_fa = f"الگوی ۱xxx=0.0 (حبس ۰xxx حریف) + تایید همزاد → برد {zero_1xxx_opp}"
            m12_flipped = bool(maj23_win == zero_1xxx_team)

    if not m12_sig and both_pos and not pos_inv_triggered:
        sml_12 = h if h_sum < a_sum else a
        ish_s12 = (sml_12 == h); el_s12 = hel_wk_v if ish_s12 else ael_wk_v; l5_s12 = l5h_wk_v if ish_s12 else (100.0 - l5h_wk_v)
        if el_s12 != "EARTH" and l5_s12 >= 52.0 and ((dp_m["sig"] and pk_dp == sml_12) or (tpk_12 == sml_12 and ppk_12 == sml_12 and l5_s12 >= 65.0)):
            m12_sig = True; m12_vip = bool(l5_s12 >= 68.0); m12_pick = sml_12
            m12_code = "ULTRA_POS_BAL"; m12_fa = "دو-مثبت متعادل (+,+) با تایید موتور همزاد"; m12_flipped = False

    m12_hold_locked = False
    both_earth_wk = (hel_wk_v == "EARTH" and ael_wk_v == "EARTH")

    if not m12_sig and maj23_win:
        ish_u = (maj23_win == h); opp_u = a if ish_u else h
        el_cu = hel_wk_v if ish_u else ael_wk_v; el_ou = ael_wk_v if ish_u else hel_wk_v
        l5_cu = l5h_wk_v if ish_u else (100.0 - l5h_wk_v); l5_ou = 100.0 - l5_cu
        gap_cu = gap3_h if ish_u else round(-gap3_h, 1)
        if el_cu == "EARTH" and el_ou != "EARTH" and dp_m["sig"] and pk_dp == opp_u and l5_ou >= 65.0:
            m12_sig = True; m12_vip = bool(l5_ou >= 75.0); m12_pick = opp_u
            m12_code = "ULTRA_EARTH_FLIP"; m12_fa = f"معکوس تلفیقی تله EARTH + تایید همزاد ({opp_u})"; m12_flipped = True
        elif el_cu != "EARTH" and el_ou != "EARTH" and 32.0 <= l5_cu < 55.0 and gap_cu >= 35.0 and dp_m["sig"]:
            if triple3_win and norm_team(triple3_win) != pk_dp:
                m12_sig = False; m12_vip = False; m12_pick = norm_team(triple3_win)
                m12_code = "ULTRA_3OF3_CLASH_HOLD"
                m12_fa = f"مهار چرخش همزاد برابر توافق ۳/۳ اعداد ({triple3_win})"
                m12_flipped = False; m12_hold_locked = True
            else:
                m12_sig = True; m12_vip = bool(vp_m["sig"]); m12_pick = pk_dp
                m12_code = "ULTRA_TWIN_TIEBREAK"; m12_fa = "داوری موتور همزاد در نبرد دو تیم غیر EARTH (ضدحذف)"
                m12_flipped = (pk_dp != maj23_win)

    if not m12_sig and not m12_hold_locked and not both_pos:
        if h_v3 == 3 and h_sum < 0.0 and h_all < 0.0 and gap3_h >= 40.0 and hel_wk_v != "EARTH" and l5h_wk_v >= 64.0 and tpk_12 == h and ppk_12 == h:
            m12_sig = True; m12_vip = bool(l5h_wk_v >= 72.0); m12_pick = h
            m12_code = "ULTRA_3OF3_TWIN"; m12_fa = f"توافق کامل ۳/۳ منفی + هر دو موتور همزاد (Gap3={gap3_h})"; m12_flipped = False
        elif a_v3 == 3 and a_sum < 0.0 and a_all < 0.0 and (-gap3_h) >= 40.0 and ael_wk_v != "EARTH" and (100.0 - l5h_wk_v) >= 64.0 and tpk_12 == a and ppk_12 == a:
            m12_sig = True; m12_vip = bool((100.0 - l5h_wk_v) >= 72.0); m12_pick = a
            m12_code = "ULTRA_3OF3_TWIN"; m12_fa = f"توافق کامل ۳/۳ منفی + هر دو موتور همزاد (Gap3={round(-gap3_h, 1)})"; m12_flipped = False

    if not m12_sig and not m12_hold_locked and s3_split_m12_ok:
        m12_sig = True; m12_vip = bool(vp_m["sig"] and pk_vp == s3_split_team); m12_pick = s3_split_team
        m12_code = "ULTRA_S3_SPLIT"
        s3_neg_u = h_s3 if s3_split_team == h else a_s3; s3_pos_u = a_s3 if s3_split_team == h else h_s3
        m12_fa = f"تضاد علامت Σ(3) ({s3_neg_u:+.1f} برابر {s3_pos_u:+.1f}) + تایید موتور همزاد"
        m12_flipped = bool(maj23_win and maj23_win != s3_split_team)

    if not m12_sig and not m12_hold_locked and triple_pole_win:
        ish_tp = (triple_pole_win == h)
        el_tp = hel_wk_v if ish_tp else ael_wk_v; el_otp = ael_wk_v if ish_tp else hel_wk_v
        l5_tp = l5h_wk_v if ish_tp else (100.0 - l5h_wk_v)
        if not (el_tp == "EARTH" and el_otp != "EARTH") and (
            (dp_m["sig"] and pk_dp == triple_pole_win)
            or (tpk_12 == triple_pole_win and ppk_12 == triple_pole_win and l5_tp >= 60.0)
        ):
            m12_sig = True
            m12_vip = bool((vp_m["sig"] and pk_vp == triple_pole_win) or l5_tp >= 70.0)
            m12_pick = triple_pole_win; m12_code = "ULTRA_BIPOLAR_0011"
            tp_0011_v = h_0011 if ish_tp else a_0011; tp_0xxx_v = h_0xxx if ish_tp else a_0xxx
            m12_fa = f"قفل هم‌جهت دو قطب گرم 1xxx و سرد 0xxx ({tp_0xxx_v:+.1f} • 0011:{tp_0011_v:+.1f})"
            m12_flipped = False

    if m12_sig and both_earth_wk and m12_code != "ULTRA_S3_SPLIT":
        m12_sig = False; m12_vip = False
        m12_code = "ULTRA_DUAL_EARTH_HOLD"
        m12_fa = f"رد قفل تقابل دو تیم EARTH • مسیر پیشنهادی: {m12_pick}"

    fm["modes"]["tri_gf_ultralock"] = {"sig": m12_sig, "vip": m12_vip, "pick": m12_pick}

    # Mode 13 (`anti_nobet_smart` v70: Mode 12 Core + Group 1 Direct Release + Group 2 Opposite Flip)
    m13_opp = a if m12_pick == h else h
    m13_pel = hel_wk_v if m12_pick == h else ael_wk_v
    m13_oel = ael_wk_v if m12_pick == h else hel_wk_v
    m13_pl5 = l5h_wk_v if m12_pick == h else round(100.0 - l5h_wk_v, 1)
    m13_ol5 = round(100.0 - m13_pl5, 1)
    m13_is_3of3_p = (g1_win == m12_pick and all_win == m12_pick and gf_win == m12_pick)
    m13_o0 = h_0xxx if m13_opp == h else a_0xxx
    m13_cold_o = (cold0_win == m13_opp and m13_o0 < 0)
    m13_dp_o = bool(dp_m["sig"] and pk_dp == m13_opp)
    m13_raw_fb = m12_fa.startswith("موتور ۳ عددی")
    if m12_sig:
        m13_sig, m13_vip, m13_pick, m13_kind = True, m12_vip, m12_pick, "M12_CORE"
        m13_fa = "سیگنال اصلی حالت ۱۲"
    elif m13_pel == "EARTH" and m13_oel == "EARTH":
        m13_sig, m13_vip, m13_pick, m13_kind = False, False, m12_pick, "HOLD_DUAL_EARTH"
        m13_fa = "توقف ایمنی: تقابل پرنوسان دو تیم EARTH"
    elif m12_code == "ULTRA_3OF3_CLASH_HOLD":
        m13_sig, m13_vip, m13_pick, m13_kind = False, False, m12_pick, "HOLD_3OF3_CLASH"
        m13_fa = "توقف ایمنی: تضاد همزاد با اجماع ۳/۳ اعداد"
    elif m11_sig and m11_pick == m12_pick and m13_pel != "EARTH" and m13_pl5 >= 75.0:
        m13_sig, m13_vip, m13_pick, m13_kind = True, (m13_pl5 >= 80.0), m12_pick, "DIRECT_RELEASE"
        m13_fa = f"آزادسازی مستقیم (گروه ۱): قفل حالت ۱۱ فعال + {m13_pel} ({m13_pl5:.1f}%)"
    elif (not m11_sig) and m13_oel != "EARTH" and (not m13_is_3of3_p) and ((m13_dp_o and m13_ol5 >= 52.0) or (m13_raw_fb and m13_ol5 >= 60.0)):
        m13_sig, m13_vip, m13_pick, m13_kind = True, False, m13_opp, "OPPOSITE_FLIP"
        if m13_dp_o and m13_ol5 >= 52.0:
            m13_fa = f"چرخش به تیم عکس (گروه ۲): تایید همزاد خلاف مسیر خام ({m13_ol5:.1f}%)"
        elif m13_cold_o:
            m13_fa = f"چرخش به تیم عکس (گروه ۲): قطب سرد ۰xxx منفی + برتری جدول ({m13_ol5:.1f}%)"
        else:
            m13_fa = f"چرخش به تیم عکس (گروه ۲): رد مسیر خام ضعیف به سود تیم قوی جدول ({m13_ol5:.1f}%)"
    else:
        m13_sig, m13_vip, m13_pick, m13_kind = False, False, m12_pick, "HOLD_NEUTRAL"
        m13_fa = "توقف خنثی: بدون برتری مستقیم یا معکوس"
    fm["modes"]["anti_nobet_smart"] = {"sig": m13_sig, "vip": m13_vip, "pick": m13_pick, "kind": m13_kind, "reason_fa": m13_fa}

    t12_blk = fm.get("total_elem_12")
    m14_sig, m14_vip, m14_pick, m14_code, m14_fa, m14_flipped = eval_mode14_total_elem_12(g, t12_blk)
    fm["modes"]["total_elem_12"] = {"sig": m14_sig, "vip": m14_vip, "pick": m14_pick}
    if t12_blk:
        t12_blk["code"] = m14_code
        t12_blk["reason_fa"] = m14_fa
        t12_blk["flipped"] = m14_flipped

    in_ov_flag = bool(fm.get("in_auth_overlap", True))
    g["sys_win"] = m12_pick
    g["pw"] = m12_pick
    g["fpw"] = m12_pick if (m12_sig and in_ov_flag) else ""
    if g.get("done") and g.get("aw") and g.get("aw") != "PENDING":
        aw_norm = norm_team(g["aw"])
        g["st"] = "WIN" if norm_team(m12_pick) == aw_norm else "LOSS"
        g["fst"] = g["st"] if (m12_sig and in_ov_flag) else ""
    else:
        g["st"] = "PENDING"
        g["fst"] = ""

    fm["geo1xxx"] = {
        "h_sum": h_sum, "a_sum": a_sum, "h_cnt": h_cnt, "a_cnt": a_cnt,
        "h_0xxx": h_0xxx, "a_0xxx": a_0xxx, "h_0cnt": h_0cnt, "a_0cnt": a_0cnt,
        "cold0_diff": cold0_diff, "cold0_win": cold0_win,
        "h_0011": h_0011, "a_0011": a_0011, "h_0011_cnt": h_0011_cnt, "a_0011_cnt": a_0011_cnt, "c0011_win": c0011_win,
        "bipolar_win": bipolar_win, "triple_pole_win": triple_pole_win, "pole_clash": pole_clash,
        "cold_tame_pi": cold_tame_pi, "cold_tame_win": cold_tame_win,
        "h_all": h_all, "a_all": a_all,
        "h_gf": h_gf, "a_gf": a_gf, "gf_diff": gf_diff, "gf_win": gf_win,
        "h_s3": h_s3, "a_s3": a_s3, "s3_diff": s3_diff, "s3_win": s3_win,
        "s3_sign_split": s3_sign_split, "s3_split_win": s3_split_team if (s3_split_m11_ok or s3_split_m12_ok) else "",
        "maj23_win": maj23_win, "triple3_win": triple3_win,
        "gf_rescued": bool(gf_div_dp_ok or gf_div_core_ok), "gap3_h": gap3_h,
        "m11_route": {"code": m11_code, "reason_fa": m11_fa, "flipped": m11_flipped},
        "m12_route": {"code": m12_code, "reason_fa": m12_fa, "flipped": m12_flipped},
        "diff": round(h_sum - a_sum, 1), "win": g1_win, "all_win": all_win,
        "dl_win": dl_win, "safe_dl_win": dl_win if gd_info["safe_ok"] else "",
        "pos_inv": {
            "both_pos": both_pos, "triggered": pos_inv_triggered, "win": pos_inv_win,
            "case_code": pos_inv_case, "dc": pos_inv_dc, "d1": pos_inv_d1,
            "l5_big": pos_inv_l5_big, "reason_fa": pos_inv_reason_fa,
        },
        "guards": {
            "eval_team": eval_target, "el_wk": gd_info["el_wk"], "el_dy": gd_info["el_dy"],
            "opp_el_wk": gd_info["opp_el_wk"], "opp_el_dy": gd_info["opp_el_dy"],
            "l5_wk": gd_info["l5_wk"], "l5_dy": gd_info["l5_dy"],
            "earth_ok": gd_info["earth_ok"], "has_neg": gd_info["has_neg"],
            "margin_ok": gd_info["margin_ok"], "neg_anchor_ok": gd_info["neg_anchor_ok"],
            "pos_inv_trap": gd_info["pos_inv_trap"], "d1": gd_info["d1"], "d8": gd_info["d8"],
            "safe_ok": gd_info["safe_ok"], "reason_fa": gd_info["reason_fa"],
        },
    }

def recompute_summary(games):
    done_auth = [g for g in games if g.get("done") and (g.get("fusion_meta") or {}).get("in_auth_overlap") and g.get("aw")]
    MODE_DEFS = [
        ("total_elem_12",    "حالت ۱۴ (موتور قطبیت کامل المنت کل: ۱۲ بازیکن لباس‌پوشیده + تیم)"),
        ("anti_nobet_smart", "حالت ۱۳ (ضد NO-BET هوشمند: حالت ۱۲ + آزادسازی مستقیم + چرخش عکس)"),
        ("tri_gf_ultralock", "حالت ۱۲ (ابرقفل ۳ عددی تلفیقی + ضدحذف): پیش‌فرض جدید"),
        ("tri_gf_routed",    "حالت ۱۱ (موتور مستقل ۳ عددی + مسیریاب ضدحذف): بدون همزادیاب"),
        ("gf_fin_pure",      "حالت ۱۰ (موتور خالص GF-FIN): عدد کمتر یا منفی‌تر برنده — بدون هیچ قفل و شرط"),
        ("pos_inv_lock",     "حالت ۹ (قفل جامع v5 + داور GF-FIN): حالت ۷ + معکوس دو-مثبت (+,+)"),
        ("earth_neg_lock",   "حالت ۷ (قفل ایمن خالص): ضد EARTH + لنگر منفی + ضد تله دو-مثبت"),
        ("safe_dl_core",     "حالت ۸ (قفل دوگانه مستقل ایمن): ضد EARTH + لنگر منفی + هم‌جهتی"),
        ("double_pwr_lock",  "حالت ۶ (قفل دوگانه ۱xxx + Σ8): بدون فیلتر لنگر منفی"),
        ("geo_1xxx_lock",    "حالت ۵ (فیلتر رمل ۱xxx): تلفیق دو-ستونی + برتری منفی ۱xxx"),
        ("dual_pillar",      "حالت ۱ (جامع): تلفیق دو-ستونی تیم + بازیکن"),
        ("vip_cross",        "حالت ۲ (شکارچی طلایی): VIP با تأیید متقابل دو موتور"),
        ("astro_lock",       "حالت ۳ (قفل متقابل نجومی): سیگنال یک موتور + F30 مثبت موتور دوم"),
        ("diamond",          "حالت ۴ (قفل الماس T ∩ P): توافق هم‌زمان سیگنال نهایی دو موتور"),
    ]
    out = {}
    for mk, label in MODE_DEFS:
        def sub_metric(arr, use_vip=False):
            sel = [g for g in arr if g["fusion_meta"]["modes"][mk]["vip" if use_vip else "sig"]]
            w = sum(1 for g in sel if norm_team(g["fusion_meta"]["modes"][mk]["pick"]) == norm_team(g["aw"]))
            n = len(sel)
            l5_sum = 0.0
            for g in sel:
                pk = norm_team(g["fusion_meta"]["modes"][mk]["pick"])
                l5h = float((g.get("wtp") or {}).get("l5h", 50.0))
                l5_sum += (l5h if pk == norm_team(g["h"]) else (100.0 - l5h))
            avg_l5 = l5_sum / max(1, n)
            pct = round(100.0 * w / max(1, n), 1)
            return {"w": w, "n": n, "pct": pct, "edge": round(pct - avg_l5, 1)}
        hold = [g for g in done_auth if g["s"] in ("2025-26", "2026-27")]
        sel_hold = [g for g in hold if g["fusion_meta"]["modes"][mk]["sig"]]
        l50 = sel_hold[-50:]
        l50_w = sum(1 for g in l50 if norm_team(g["fusion_meta"]["modes"][mk]["pick"]) == norm_team(g["aw"]))
        out[mk] = {
            "mode": mk, "label": label,
            "all_overlap": sub_metric(done_auth, False),
            "vip_overlap": sub_metric(done_auth, True),
            "s2425": sub_metric([g for g in done_auth if g["s"] == "2024-25"], False),
            "s2526": sub_metric([g for g in done_auth if g["s"] == "2025-26"], False),
            "s2627": sub_metric([g for g in done_auth if g["s"] == "2026-27"], False),
            "holdout_2527": sub_metric(hold, False),
            "last50": {"w": l50_w, "n": len(l50), "pct": round(100.0 * l50_w / max(1, len(l50)), 1)},
        }
    return out

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--target-date", default="")
    ap.add_argument("--master-path", default="/home/runner/workspace/artifacts/calc-dashboard/public/fusion_nba_master.json")
    ap.add_argument("--runtime-path", default="/home/runner/workspace/artifacts/api-server/python/fusion_roster_runtime.json")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    doc = json.load(open(args.master_path, "r", encoding="utf-8"))
    rt = json.load(open(args.runtime_path, "r", encoding="utf-8"))
    games = doc["games"]

    team_tz_map = rt["team_tz_map"]
    live_rosters = {norm_team(k): [dict(x) for x in v] for k, v in rt["live_rosters"].items()}
    base_mpg_2526 = {norm_team(k): dict(v) for k, v in rt["base_mpg_2526"].items()}
    team_box_2627 = defaultdict(list)
    seen_box_dates = set()
    for tn, arr in rt["team_box_2627"].items():
        ntn = norm_team(tn)
        for d_b, plist in arr:
            team_box_2627[ntn].append((d_b, plist))
            seen_box_dates.add((ntn, d_b))
    p_static = dict(rt["player_static"])
    p_by_day = defaultdict(list)
    if "p_by_day" in rt:
        for dy, rows in rt["p_by_day"].items():
            for d_r, mg_r, h12_r, hfin_r, hdyn_r, htab_r in rows:
                p_by_day[dy].append({
                    "d": d_r, "mg": int(mg_r), "hw": 1 if int(mg_r) > 0 else 0,
                    "h12": h12_r, "h_fin": hfin_r, "h_dyn": hdyn_r, "h_tab": htab_r,
                })
    else:
        hist_cand = os.path.join(os.path.dirname(args.master_path), "player_nba_hist_mode_c.json")
        if not os.path.exists(hist_cand):
            hist_cand = "/home/user/workspace/data/player_nba_hist_mode_c.json"
        if os.path.exists(hist_cand):
            for r in json.load(open(hist_cand, "r", encoding="utf-8")):
                d_r, dy_r = str(r[0]), str(r[1])
                mg_r = int(r[7]); h12_r = r[8]; hdyn_r = str(r[9])
                hfin_r = "".join("1" if abs(int(str(x).split()[0])) % 2 == 1 else "0" for x in h12_r[4:8])
                htab_r = str(r[14] or "0101") if len(r) > 14 else "0101"
                p_by_day[dy_r].append({
                    "d": d_r, "mg": mg_r, "hw": 1 if mg_r > 0 else 0,
                    "h12": h12_r, "h_fin": hfin_r, "h_dyn": hdyn_r, "h_tab": htab_r,
                })
        for dy, rows in (rt.get("extra_p_by_day") or {}).items():
            for d_r, mg_r, h12_r, hfin_r, hdyn_r, htab_r in rows:
                p_by_day[dy].append({
                    "d": d_r, "mg": int(mg_r), "hw": 1 if int(mg_r) > 0 else 0,
                    "h12": h12_r, "h_fin": hfin_r, "h_dyn": hdyn_r, "h_tab": htab_r,
                })
        for dy in p_by_day:
            p_by_day[dy].sort(key=lambda x: x["d"])

    def ensure_p_static(pid, fn, jn, jer, pos):
        spid = str(pid)
        if spid not in p_static and fn:
            jn_eff = jn or (fn.split()[-1] if fn else "")
            j_s = str(jer or "0")
            p_static[spid] = {
                "fn": fn, "jn": jn_eff, "j_str": j_s if j_s != "" else "0", "pos": str(pos or ""),
                "deg2": pc.egem(fn) % 360,
                "deg3": pc.jersey_eff_num(j_s, True) % 360,
                "nam_fawe": list(pc.s4.word_element_fawe(fn)),
            }

    today_utc = datetime.datetime.now(datetime.timezone.utc).date()
    t_iso = args.target_date.strip() if (args.target_date and len(args.target_date.strip()) == 10) else today_utc.isoformat()
    t_dt = datetime.date(*map(int, t_iso.split("-")))

    base_live_rosters = {tn: [dict(x) for x in plist] for tn, plist in live_rosters.items()}
    for tn, b_arr in team_box_2627.items():
        played_ids_b = {str(pr["pid"]) for _, pl_b in b_arr for pr in pl_b}
        for p in base_live_rosters.get(tn, []):
            if str(p.get("pid")) in played_ids_b:
                p["status"] = "Healthy"
        for p in live_rosters.get(tn, []):
            if str(p.get("pid")) in played_ids_b:
                p["status"] = "Healthy"

    live_unavail_by_team = defaultdict(dict)
    try:
        inj_all = json.loads(urllib.request.urlopen(urllib.request.Request(
            "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/injuries",
            headers={"User-Agent": "Mozilla/5.0"}
        ), timeout=12).read().decode("utf-8"))
        for tblk in inj_all.get("injuries", []):
            tn = norm_team(tblk.get("displayName", ""))
            for item in tblk.get("injuries", []):
                st = str(item.get("status", "")).strip()
                a_obj = item.get("athlete", {})
                pid = str(a_obj.get("id", ""))
                fn = str(a_obj.get("displayName", "")).strip()
                jer = str(a_obj.get("jersey", "")).strip()
                if st.lower() in BLOCKED_STATUSES and fn:
                    live_unavail_by_team[tn][pid or fn.lower()] = (fn, jer, st)
    except Exception:
        pass

    # Check recent 2 days for newly finalized scores/boxscores + targetDate & targetDate+1 for game-specific ESPN injuries
    check_dates = sorted({
        (today_utc - datetime.timedelta(days=2)).isoformat(),
        (today_utc - datetime.timedelta(days=1)).isoformat(),
        today_utc.isoformat(),
        t_iso,
        (t_dt + datetime.timedelta(days=1)).isoformat(),
    })

    espn_finals = defaultdict(dict)
    for d_c in check_dates:
        ds = d_c.replace("-", "")
        try:
            sb = json.loads(urllib.request.urlopen(urllib.request.Request(
                f"https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates={ds}",
                headers={"User-Agent": "Mozilla/5.0"}
            ), timeout=10).read().decode("utf-8"))
        except Exception:
            continue
        for ev in sb.get("events", []):
            ev_id = str(ev.get("id", ""))
            is_done = bool(ev.get("status", {}).get("type", {}).get("completed"))
            comps = ev.get("competitions", [{}])[0].get("competitors", [])
            hc_o = next((c for c in comps if c.get("homeAway") == "home"), None)
            ac_o = next((c for c in comps if c.get("homeAway") == "away"), None)
            if is_done and hc_o and ac_o:
                hn = norm_team(hc_o.get("team", {}).get("displayName", ""))
                an = norm_team(ac_o.get("team", {}).get("displayName", ""))
                hp_v = int(hc_o.get("score", 0) or 0)
                ap_v = int(ac_o.get("score", 0) or 0)
                if hp_v > 0 and ap_v > 0 and hp_v != ap_v:
                    espn_finals[d_c][(hn, an)] = (hp_v, ap_v)

            need_summary = (d_c in (t_iso, (t_dt + datetime.timedelta(days=1)).isoformat())) or (
                is_done and hc_o and (norm_team(hc_o.get("team", {}).get("displayName", "")), d_c) not in seen_box_dates
            )
            if not need_summary or not ev_id:
                continue
            try:
                sm = json.loads(urllib.request.urlopen(urllib.request.Request(
                    f"https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event={ev_id}",
                    headers={"User-Agent": "Mozilla/5.0"}
                ), timeout=10).read().decode("utf-8"))
            except Exception:
                continue

            if not is_done:
                for ib in sm.get("injuries", []):
                    tn = norm_team(ib.get("team", {}).get("displayName", ""))
                    for item in ib.get("injuries", []):
                        st = str(item.get("status", "")).strip()
                        a_obj = item.get("athlete", {})
                        pid = str(a_obj.get("id", ""))
                        fn = str(a_obj.get("displayName", "")).strip()
                        jer = str(a_obj.get("jersey", "")).strip()
                        if st.lower() in BLOCKED_STATUSES and fn:
                            live_unavail_by_team[tn][pid or fn.lower()] = (fn, jer, st)
            else:
                for tb in sm.get("boxscore", {}).get("players", []):
                    tn = norm_team(tb.get("team", {}).get("displayName", ""))
                    if (tn, d_c) in seen_box_dates:
                        continue
                    plist = []
                    for sg in tb.get("statistics", []):
                        keys = sg.get("keys", [])
                        m_idx = keys.index("minutes") if "minutes" in keys else 0
                        for ath in sg.get("athletes", []):
                            if ath.get("didNotPlay"):
                                continue
                            a_obj = ath.get("athlete", {})
                            pid = str(a_obj.get("id", ""))
                            fn = str(a_obj.get("displayName", ""))
                            jn = fn.split()[-1] if fn else ""
                            jer = str(a_obj.get("jersey", "0") or "0")
                            pos = str((a_obj.get("position") or {}).get("abbreviation", ""))
                            st_arr = ath.get("stats", [])
                            mn_s = st_arr[m_idx] if m_idx < len(st_arr) else "0"
                            try:
                                mv = float(str(mn_s).split(":")[0])
                            except Exception:
                                mv = 0.0
                            if mv <= 0 or not pid:
                                continue
                            ensure_p_static(pid, fn, jn, jer, pos)
                            for bp in base_live_rosters.get(tn, []):
                                if str(bp.get("pid")) == pid:
                                    bp["status"] = "Healthy"
                            cur_ids = {str(p["pid"]) for p in live_rosters.get(tn, [])}
                            if pid not in cur_ids:
                                new_rec = {
                                    "pid": pid, "full_name": fn, "jersey_name": jn,
                                    "jersey": jer, "pos": pos, "status": "Healthy", "injury_detail": ""
                                }
                                live_rosters.setdefault(tn, []).append(dict(new_rec))
                                base_live_rosters.setdefault(tn, []).append(dict(new_rec))
                            plist.append({"pid": pid, "min": mv, "starter": bool(ath.get("starter"))})
                    if plist:
                        team_box_2627[tn].append((d_c, plist))
                        team_box_2627[tn].sort(key=lambda x: x[0])
                        seen_box_dates.add((tn, d_c))

    for tn, plist in live_rosters.items():
        unmap = live_unavail_by_team.get(tn, {})
        un_names = {v[0].lower(): v for v in unmap.values()}
        for p in plist:
            pid = str(p.get("pid", ""))
            fn = str(p.get("full_name", ""))
            ensure_p_static(pid, fn, p.get("jersey_name", ""), p.get("jersey", "0"), p.get("pos", ""))
            if pid in unmap:
                p["status"] = unmap[pid][2]
            elif fn.lower() in un_names:
                p["status"] = un_names[fn.lower()][2]

    # Apply any newly finalized scores without modifying their pre-tipoff rosters
    updated_scores = 0
    for g in games:
        if g["d"] in espn_finals:
            hk = (norm_team(g["h"]), norm_team(g["a"]))
            if hk in espn_finals[g["d"]]:
                hp_v, ap_v = espn_finals[g["d"]][hk]
                aw_v = hk[0] if hp_v > ap_v else hk[1]
                new_sc = f"{hp_v}-{ap_v}"
                was_done = bool(g.get("done") and g.get("sc") == new_sc and norm_team(g.get("aw")) == aw_v)
                g["hp"], g["ap"] = hp_v, ap_v
                g["sc"] = new_sc
                g["aw"] = aw_v
                g["done"] = True
                g["hw"] = bool(hp_v > ap_v)
                recompute_all_fusion_modes(g)
                if not was_done:
                    updated_scores += 1
                    hp_saved = g.get("h_players") or []
                    if len(hp_saved) >= 5 and all(str(p.get("pid", "")) in p_static for p in hp_saved):
                        d_ctx_h = pc.get_date_ctx(g["d"])
                        hl_saved = [(str(p["pid"]), float(p.get("mpg", 15.0)), bool(p.get("st"))) for p in hp_saved]
                        c12_h, gfin_h, gdyn_h, _, _ = eval_team_lineup_exact(d_ctx_h, hl_saved, d_ctx_h[8], p_static)
                        p_by_day[g["day"]].append({
                            "d": g["d"], "mg": hp_v - ap_v, "hw": 1 if hp_v > ap_v else 0,
                            "h12": c12_h, "h_fin": gfin_h, "h_dyn": gdyn_h, "h_tab": str(g.get("h_geo_tab") or "0101"),
                        })
                        p_by_day[g["day"]].sort(key=lambda x: x["d"])

    live_roster_pids = {
        tname: {str(p["pid"]): p for p in plist}
        for tname, plist in live_rosters.items()
    }

    def is_player_blocked(tname, pid, fn):
        cur_r = live_roster_pids.get(tname, {})
        st_lbl = str(cur_r.get(str(pid), {}).get("status", "Healthy")).strip().lower()
        if st_lbl in BLOCKED_STATUSES:
            return True
        unmap = live_unavail_by_team.get(tname, {})
        if str(pid) in unmap:
            return True
        for ufn, _, _ in unmap.values():
            if ufn.lower() == str(fn).lower():
                return True
        return False

    def get_pending_lineup_8(tname, d_iso):
        prior_games = [plist for (db, plist) in team_box_2627.get(tname, []) if db < d_iso]
        cur_roster = live_roster_pids.get(tname, {})
        base_mpg = base_mpg_2526.get(tname, {})
        if prior_games:
            min_sums = defaultdict(float); gp_cnts = defaultdict(int); st_cnts = defaultdict(int)
            for plist in prior_games[-10:]:
                for pr in plist:
                    pid = str(pr["pid"])
                    min_sums[pid] += float(pr["min"])
                    gp_cnts[pid] += 1
                    if pr.get("starter"):
                        st_cnts[pid] += 1
            cands = []
            all_pids = set(min_sums.keys()) | set(cur_roster.keys())
            for pid in all_pids:
                if pid not in p_static:
                    continue
                if cur_roster and pid not in cur_roster:
                    continue
                if is_player_blocked(tname, pid, p_static[pid]["fn"]):
                    continue
                g_c = gp_cnts.get(pid, 0)
                obs_m = (min_sums[pid] / g_c) if g_c > 0 else 0.0
                prior_m = float(base_mpg.get(pid, 12.0))
                blend_mpg = (g_c * obs_m + 2.0 * prior_m) / (g_c + 2.0) if g_c > 0 else (prior_m * 0.4)
                if blend_mpg >= 6.0:
                    cands.append((pid, round(blend_mpg, 1), st_cnts.get(pid, 0) >= max(1, g_c // 2)))
            cands.sort(key=lambda x: (x[2], x[1], x[0]), reverse=True)
            if len(cands) >= 5:
                return cands[:8]
        return []

    def get_pending_lineup_12(tname, d_iso):
        prior_games = [plist for (db, plist) in team_box_2627.get(tname, []) if db < d_iso]
        cur_roster = live_roster_pids.get(tname, {})
        base_mpg = base_mpg_2526.get(tname, {})
        min_sums = defaultdict(float); gp_cnts = defaultdict(int); st_cnts = defaultdict(int)
        for plist in prior_games[-10:]:
            for pr in plist:
                pid = str(pr["pid"])
                min_sums[pid] += float(pr["min"])
                gp_cnts[pid] += 1
                if pr.get("starter"):
                    st_cnts[pid] += 1
        cands = []; seen = set()
        all_pids = set(min_sums.keys()) | set(cur_roster.keys())
        for pid in all_pids:
            if pid not in p_static:
                continue
            if cur_roster and pid not in cur_roster:
                continue
            if is_player_blocked(tname, pid, p_static[pid]["fn"]):
                continue
            seen.add(pid)
            g_c = gp_cnts.get(pid, 0)
            obs_m = (min_sums[pid] / g_c) if g_c > 0 else 0.0
            prior_m = float(base_mpg.get(pid, 10.0))
            blend_mpg = (g_c * obs_m + 2.0 * prior_m) / (g_c + 2.0) if g_c > 0 else (prior_m * 0.4)
            cands.append((pid, round(blend_mpg, 1), st_cnts.get(pid, 0) >= max(1, g_c // 2)))
        for pid, pri_v in sorted(base_mpg.items(), key=lambda x: x[1], reverse=True):
            if len(cands) >= 12:
                break
            if pid in seen or pid not in p_static:
                continue
            if cur_roster and pid not in cur_roster:
                continue
            if is_player_blocked(tname, pid, p_static[pid]["fn"]):
                continue
            seen.add(pid)
            cands.append((pid, round(float(pri_v) * 0.4, 1), False))
        cands.sort(key=lambda x: (x[2], x[1], x[0]), reverse=True)
        return cands[:12]

    def get_out_list_formatted(tname):
        seen = set(); items = []
        for fn, jer, st in sorted(live_unavail_by_team.get(tname, {}).values()):
            key = fn.lower()
            if key in seen: continue
            seen.add(key)
            tag = f" • {st.upper()}" if st.lower() != "out" else ""
            items.append(f"{fn} (#{jer}{tag})" if jer else f"{fn}{tag}")
        for p in live_rosters.get(tname, []):
            st = str(p.get("status", "")).strip()
            fn = str(p.get("full_name", "")).strip()
            jer = str(p.get("jersey", "")).strip()
            if st.lower() in BLOCKED_STATUSES and fn and fn.lower() not in seen:
                seen.add(fn.lower())
                tag = f" • {st.upper()}" if st.lower() != "out" else ""
                items.append(f"{fn} (#{jer}{tag})" if jer else f"{fn}{tag}")
        return sorted(items)

    # Standings snapshots if needed for pending window
    min_pend_iso = min(today_utc.isoformat(), t_iso)
    max_pend_iso = max((today_utc + datetime.timedelta(days=2)).isoformat(), (t_dt + datetime.timedelta(days=2)).isoformat())

    snap_hist = []
    for g in games:
        if g.get("done") and g.get("hp") and g.get("ap") and g["hp"] != g["ap"]:
            snap_hist.append({
                "d": g["d"], "s": g.get("s") or nls.season_of_date(g["d"]),
                "h": norm_team(g["h"]), "a": norm_team(g["a"]),
                "hp": int(g["hp"]), "ap": int(g["ap"]), "mg": int(g["hp"]) - int(g["ap"]),
            })
    snap_hist.sort(key=lambda x: x["d"])

    sched_all = set()
    cut_pairs = set()
    for g in games:
        sched_all.add((g["d"], norm_team(g["h"])))
        sched_all.add((g["d"], norm_team(g["a"])))
        if not g.get("done") and min_pend_iso <= g["d"] <= max_pend_iso:
            yg, mg_i, dg = map(int, g["d"].split("-"))
            dt_g = datetime.date(yg, mg_i, dg)
            mon_g = (dt_g - datetime.timedelta(days=dt_g.weekday())).isoformat()
            s_g = g.get("s") or nls.season_of_date(g["d"])
            cut_pairs.add((mon_g, s_g))
            cut_pairs.add((g["d"], s_g))

    all_snaps = nls.build_all_snapshots(snap_hist, cut_pairs) if cut_pairs else {}

    checked_games = 0
    changed_lineups = 0
    changed_signals = 0
    lineup_diffs = []

    for g in games:
        if g.get("done") or not (min_pend_iso <= g["d"] <= max_pend_iso):
            continue
        checked_games += 1
        h = norm_team(g["h"]); a = norm_team(g["a"])
        old_hp = [str(p.get("fn", "")) for p in (g.get("h_players") or [])]
        old_ap = [str(p.get("fn", "")) for p in (g.get("a_players") or [])]
        old_m12 = dict((g.get("fusion_meta") or {}).get("modes", {}).get("tri_gf_ultralock") or {})

        y, m, d = map(int, g["d"].split("-"))
        dt_obj = datetime.date(y, m, d)
        mon_iso = (dt_obj - datetime.timedelta(days=dt_obj.weekday())).isoformat()
        yest = (dt_obj - datetime.timedelta(days=1)).isoformat()
        s_g = g.get("s") or nls.season_of_date(g["d"])

        if (g["d"], s_g) in all_snaps and (mon_iso, s_g) in all_snaps:
            snap_dy = all_snaps[(g["d"], s_g)]
            snap_wk = all_snaps[(mon_iso, s_g)]
            h_tab_dy, a_tab_dy = nls.geo_tab_pair(snap_dy, h, a)
            g["h_geo_tab"] = h_tab_dy; g["a_geo_tab"] = a_tab_dy
            hfav_tm_cur = (norm_team(g["fusion_meta"]["team"]["pick"]) == h)
            g["wtp"] = nls.make_wtp_obj(snap_wk, mon_iso, h, a, hfav_tm_cur)
            g["wtp_day"] = nls.make_wtp_obj(snap_dy, yest, h, a, hfav_tm_cur)
        else:
            snap_dy = None; snap_wk = None

        tpk_chk = norm_team(g["fusion_meta"]["team"]["pick"])
        topp_chk = a if tpk_chk == h else h
        pb2b_t = (yest, tpk_chk) in sched_all and (yest, topp_chk) not in sched_all
        ob2b_t = (yest, topp_chk) in sched_all and (yest, tpk_chk) not in sched_all
        g["b2b_tag"] = "B2B_PICK" if pb2b_t else ("B2B_OPP" if ob2b_t else "")

        hl8 = get_pending_lineup_8(h, g["d"])
        al8 = get_pending_lineup_8(a, g["d"])
        if len(hl8) >= 5 and len(al8) >= 5:
            d_ctx = pc.get_date_ctx(g["d"])
            tbl_u = d_ctx[8]
            tz_s = team_tz_map.get(h, "America/New_York")
            tbl_l = pc.get_deg_table(pc.get_jd_local(y, m, d, tz_s, 19, 30))

            h12_p, hfin_p, hdyn_p, mh_u, hp_cards = eval_team_lineup_exact(d_ctx, hl8, tbl_u, p_static)
            _, _, _, ma_u, ap_cards = eval_team_lineup_exact(d_ctx, al8, tbl_u, p_static)
            _, _, _, mh_l, _ = eval_team_lineup_exact(d_ctx, hl8, tbl_l, p_static)
            _, _, _, ma_l, _ = eval_team_lineup_exact(d_ctx, al8, tbl_l, p_static)
            mv_p, f30_p, ag5_p = score_5_player_fusion(mh_u, ma_u, mh_l, ma_l)

            g["h_players"] = hp_cards
            g["a_players"] = ap_cards
            g["h_out"] = get_out_list_formatted(h)
            g["a_out"] = get_out_list_formatted(a)

            arr_p = p_by_day.get(g["day"], [])
            lo, hi = 0, len(arr_p)
            while lo < hi:
                mid = (lo + hi) // 2
                if arr_p[mid]["d"] < g["d"]: lo = mid + 1
                else: hi = mid
            dpool = arr_p[:lo]
            htab_p = str(g.get("h_geo_tab") or "0101")
            sd = auto_filter_exact(h12_p, hdyn_p, dpool, False, "h_dyn", 3)
            gd3 = auto_filter_exact(h12_p, hdyn_p, dpool, True, "h_dyn", 3)
            sa = (sd["hw"] >= sd["aw"]) == (f30_p >= 0); ga = (gd3["hw"] >= gd3["aw"]) == (f30_p >= 0)
            pick_geo = (
                False if (sd["pct"] < 60 or (sa and not ga and sd["pct"] >= 55))
                else True if (not sa and ga and gd3["pct"] >= 55)
                else (gd3["pct"] > sd["pct"] or (gd3["pct"] == sd["pct"] and gd3["mv"] > sd["mv"]))
            )
            ch = gd3 if pick_geo else sd
            hw, aw_v, nat = ch["hw"], ch["aw"], ch["nat"]
            tot = hw + aw_v
            pct_int = round(max(hw, aw_v) * 100 / tot) if tot else 50
            hfav = True if hw > aw_v else (False if aw_v > hw else f30_p >= 0)
            sgn = 1 if hfav else -1
            ppk = h if hfav else a; popp = a if hfav else h
            f30_o = f30_p * sgn
            agree = (hfav and f30_p > 0) or (not hfav and f30_p < 0)
            both100 = sd["pct"] == 100.0 and gd3["pct"] == 100.0 and ((sd["hw"] > 0) == (gd3["hw"] > 0))
            v71 = 5 <= tot <= 7 and pct_int >= 71 and abs(hw - aw_v) >= 3
            bcombo = v71 and (agree or both100)
            c1 = auto_filter_exact(h12_p, hfin_p, dpool, False, "h_fin", 5)
            c2 = auto_filter_exact(h12_p, hfin_p, dpool, True, "h_fin", 5)
            c3 = auto_filter_exact(h12_p, hdyn_p, dpool, True, "h_dyn", 5)
            c4 = auto_filter_exact(h12_p, htab_p, dpool, True, "h_tab", 5)
            ds4 = [c1["ds"], c2["ds"], c3["ds"], c4["ds"]]
            ds4_o = [v * sgn for v in ds4]
            vh4 = sum(1 for v in ds4 if v > 0); va4 = sum(1 for v in ds4 if v < 0)
            fav_v4 = vh4 if hfav else va4; opp_v4 = va4 if hfav else vh4
            fav_v3 = sum(1 for v in ds4_o[:3] if v > 0); opp_v3 = sum(1 for v in ds4_o[:3] if v < 0)
            min_o4 = min(ds4_o)
            pb2b = (yest, ppk) in sched_all and (yest, popp) not in sched_all
            is_playoff = (g["d"][5:10] >= "04-15" and m <= 6)
            c4_vote_opp = ((c4["hw"] - c4["aw"]) * sgn < 0)
            t1 = (not hfav) and (f30_o < 10 or (fav_v3 < 2 and fav_v4 < 3))
            t2 = (opp_v3 >= 2 and f30_o < 8) or (opp_v4 >= 2 and f30_o < 10)
            t3 = pb2b and f30_o < 12 and ((not hfav) or (not nat))
            t4 = (not nat) and fav_v3 < 3 and fav_v4 < 3 and f30_o < 12
            t5 = (fav_v4 == 0) or (c4_vote_opp and f30_o < 12) or (is_playoff and (ag5_p < 4 or not nat))
            p_guard = bool(bcombo and not (t1 or t2 or t3 or t4 or t5))
            l5h_val = float((g.get("wtp") or {}).get("l5h", 50.0))
            l5_p_pct = l5h_val if hfav else (100.0 - l5h_val)
            mel = nls.matchup_elem(l5_p_pct)
            p_sig = bool(p_guard and mel != "EARTH")
            p_vip = bool(p_sig and (mel == "FIRE" or (nat and fav_v4 == 4 and min_o4 >= 2)))

            fm = g["fusion_meta"]
            fm["player"] = {
                "pick": ppk, "votes": f"{hw}H-{aw_v}A", "pct": f"{pct_int}%",
                "f30": f30_p, "ch": f"{vh4}H-{va4}A", "sig": p_sig, "vip": p_vip
            }
            tm_obj = fm["team"]
            tpk = norm_team(tm_obj["pick"])
            f30_t = int(tm_obj["f30"])
            t_sig = bool(tm_obj["sig"]); t_vip = bool(tm_obj["vip"])
            sgn_t = 1 if tpk == h else -1; sgn_p = 1 if ppk == h else -1
            p_supports_t = (ppk == tpk) or (f30_p * sgn_t > 0)
            t_supports_p = (tpk == ppk) or (f30_t * sgn_p > 0)
            p_astro_t = (f30_p * sgn_t > 0); t_astro_p = (f30_t * sgn_p > 0)
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
            fm["tier"] = tier_code; fm["tier_fa"] = tier_fa; fm["driver"] = driver; fm["vetoed"] = is_vetoed
            fm["modes"]["dual_pillar"] = {"sig": is_dual_pillar, "vip": is_vip_cross, "pick": pk_dp}
            fm["modes"]["vip_cross"]   = {"sig": is_vip_cross,   "vip": is_diamond,   "pick": pk_vip}
            fm["modes"]["astro_lock"]  = {"sig": is_astro_lock,  "vip": bool(is_astro_lock and is_vip_cross), "pick": pk_ast}
            fm["modes"]["diamond"]     = {"sig": is_diamond,     "vip": is_diamond,   "pick": pk_dia}
            g["twWin"] = pk_dp
            g["f30"] = int(f30_t + f30_p); g["vm6"] = int(f30_t + f30_p)
            if snap_wk is not None and snap_dy is not None:
                hfav_dp = (pk_dp == h)
                g["wtp"] = nls.make_wtp_obj(snap_wk, mon_iso, h, a, hfav_dp)
                g["wtp_day"] = nls.make_wtp_obj(snap_dy, yest, h, a, hfav_dp)

            hl12 = get_pending_lineup_12(h, g["d"])
            al12 = get_pending_lineup_12(a, g["d"])
            if len(hl12) >= 5 and len(al12) >= 5:
                tbl_t12 = pc.get_deg_table(pc.get_jd_local(y, m, d, (TEAM_META_30.get(h) or {}).get("tz", tz_s), 19, 30))
                t12_blk = compute_total_elem_12_block(d_ctx, tbl_t12, h, a, hl12, al12, p_static, include_players=True)
                if t12_blk:
                    fm["total_elem_12"] = t12_blk

            recompute_all_fusion_modes(g)

            new_hp = [str(p.get("fn", "")) for p in (g.get("h_players") or [])]
            new_ap = [str(p.get("fn", "")) for p in (g.get("a_players") or [])]
            new_m12 = dict((g.get("fusion_meta") or {}).get("modes", {}).get("tri_gf_ultralock") or {})

            if set(old_hp) != set(new_hp) or set(old_ap) != set(new_ap):
                changed_lineups += 1
                if g["d"] == t_iso and len(lineup_diffs) < 8:
                    rem = [x for x in (old_hp + old_ap) if x not in (new_hp + new_ap)]
                    add = [x for x in (new_hp + new_ap) if x not in (old_hp + old_ap)]
                    if rem or add:
                        lineup_diffs.append({
                            "n": g["n"], "matchup": f"{g['ac']} @ {g['hc']}",
                            "removed": rem, "added": add,
                        })
            if old_m12.get("sig") != new_m12.get("sig") or old_m12.get("pick") != new_m12.get("pick"):
                changed_signals += 1

    if updated_scores > 0:
        doc["summary"] = recompute_summary(games)

    if not args.dry_run:
        tmp_m = args.master_path + ".tmp"
        json.dump(doc, open(tmp_m, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
        os.replace(tmp_m, args.master_path)

        extra_out = {}
        for dy, arr in p_by_day.items():
            ex = [[x["d"], x["mg"], x["h12"], x["h_fin"], x["h_dyn"], x["h_tab"]] for x in arr if x["d"] >= "2026-11-15"]
            if ex:
                extra_out[dy] = ex
        rt_out = {
            "team_tz_map": team_tz_map,
            "live_rosters": base_live_rosters,
            "base_mpg_2526": base_mpg_2526,
            "team_box_2627": {tn: arr[-15:] for tn, arr in team_box_2627.items()},
            "player_static": p_static,
            "extra_p_by_day": extra_out,
        }
        tmp_rt = args.runtime_path + ".tmp"
        json.dump(rt_out, open(tmp_rt, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
        os.replace(tmp_rt, args.runtime_path)

    active_m12 = [
        {"n": g["n"], "pick": g["fusion_meta"]["modes"]["tri_gf_ultralock"]["pick"], "vip": g["fusion_meta"]["modes"]["tri_gf_ultralock"]["vip"]}
        for g in games if g["d"] == t_iso and not g.get("done") and g["fusion_meta"]["modes"]["tri_gf_ultralock"]["sig"]
    ]
    total_blocked = sum(len(v) for v in live_unavail_by_team.values())

    payload = {
        "ok": True,
        "targetDate": t_iso,
        "checkedGames": checked_games,
        "updatedScores": updated_scores,
        "changedLineups": changed_lineups,
        "changedSignals": changed_signals,
        "totalBlockedPlayers": total_blocked,
        "lineupDiffs": lineup_diffs,
        "activeM12": active_m12,
        "s2627": doc["summary"]["tri_gf_ultralock"]["s2627"],
        "holdout": doc["summary"]["tri_gf_ultralock"]["holdout_2527"],
    }
    print("__NBA_ROSTER_SYNC__ " + json.dumps(payload, ensure_ascii=False))

if __name__ == "__main__":
    main()
