#!/usr/bin/env python3
"""
Build & Benchmark All 3 NBA Player Astrological/Elemental Modes (2010-2027, Zero Lookahead):
  - mode_a: DEG1=53, DEG2=egem(Full_Name)%360, DEG3=egem(Jersey_Name)%360
  - mode_b: DEG1=53, DEG2=egem(Full_Name)%360, DEG3=(egem(Jersey_Name)+JerseyNoEff)%360
  - mode_c: DEG1=53, DEG2=egem(Full_Name)%360, DEG3=JerseyNoEff%360
"""
import sys, os, json, math, time, datetime, bisect
from collections import defaultdict
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
PUB_DIR = "/home/runner/workspace/artifacts/calc-dashboard/public"
sys.path.insert(0, HERE)
import parity_check as pc

t0 = time.time()

# 1. Load player bundle, historical games (2010..2026), and schedule (2025..2027)
pb = json.load(open(os.path.join(HERE, "nba_players_2010_2027.json")))
player_master = pb["player_master"]
live_rosters = pb["live_rosters"]
season_team_players = pb["season_team_players"]
events_2627 = pb["events_2627"]
boxscores_2627 = pb["boxscores_2627"]

teams_gem_raw = json.load(open(os.path.join(HERE, "nba_gem_sheet.json")))["values"]
team_tz_map = {}
team_arena_map = {}
team_code_map = {}
for r in teams_gem_raw[1:]:
    if not r or not str(r[0]).strip():
        continue
    tname = str(r[0]).strip()
    team_arena_map[tname] = str(r[7]).strip()
    team_code_map[tname] = str(r[17]).strip()
    team_tz_map[tname] = str(r[23]).strip() or "America/New_York"

HIST_TEAM_NORM = {
    "LA Clippers": "Los Angeles Clippers",
    "New Jersey Nets": "Brooklyn Nets",
    "Charlotte Bobcats": "Charlotte Hornets",
    "New Orleans Hornets": "New Orleans Pelicans",
}
def norm_team(s):
    t = str(s or "").strip()
    return HIST_TEAM_NORM.get(t, t)

def season_of_date(d_iso):
    if "2019-10-01" <= d_iso <= "2020-10-15": return "2019-20"
    if "2020-10-15" < d_iso <= "2021-08-15": return "2020-21"
    if "2011-12-01" <= d_iso <= "2012-07-01": return "2011-12"
    y, m, _ = map(int, d_iso.split("-"))
    return f"{y}-{(y+1)%100:02d}" if m >= 10 else f"{y-1}-{y%100:02d}"

# Merge all games 2010-01-01 .. 2027-04-11
games_by_key = {}

hist_vals = json.load(open(os.path.join(HERE, "history_2010_2026_base.json")))["values"]
for r in hist_vals[1:]:
    if len(r) < 9:
        continue
    d_iso = str(r[2]).strip()
    h = norm_team(r[4])
    a = norm_team(r[5])
    if h not in team_tz_map or a not in team_tz_map:
        continue
    hp, ap = int(float(r[6] or 0)), int(float(r[7] or 0))
    if hp == ap or (hp == 0 and ap == 0):
        continue
    dt = datetime.date(*map(int, d_iso.split("-")))
    games_by_key[(d_iso, h, a)] = {
        "d": d_iso, "day": dt.strftime("%A").upper(), "s": season_of_date(d_iso),
        "h": h, "a": a, "hp": hp, "ap": ap, "done": True,
        "arena": team_arena_map.get(h, ""), "tz": team_tz_map.get(h, "America/New_York")
    }

sched_vals = json.load(open(os.path.join(HERE, "schedule_2025_2027.json")))["values"]
for r in sched_vals[1:]:
    if len(r) < 5:
        continue
    raw_d = str(r[0]).strip()
    parts = raw_d.split("/")
    if len(parts) == 3:
        d_iso = f"{int(parts[2]):04d}-{int(parts[0]):02d}-{int(parts[1]):02d}"
    else:
        d_iso = raw_d
    h = norm_team(r[3])
    a = norm_team(r[4])
    if h not in team_tz_map or a not in team_tz_map:
        continue
    pch = str(r[1] or "")
    hp, ap, done = 0, 0, False
    import re
    m_sc = re.search(r"(\d+)\s*-\s*(\d+)", pch)
    if m_sc and "WIN:" in pch:
        hp, ap = int(m_sc.group(1)), int(m_sc.group(2))
        done = (hp > 0 and ap > 0 and hp != ap)
    key = (d_iso, h, a)
    dt = datetime.date(*map(int, d_iso.split("-")))
    if key not in games_by_key:
        games_by_key[key] = {
            "d": d_iso, "day": dt.strftime("%A").upper(), "s": season_of_date(d_iso),
            "h": h, "a": a, "hp": hp, "ap": ap, "done": done,
            "arena": str(r[9]).strip() if len(r) > 9 and r[9] else team_arena_map.get(h, ""),
            "tz": team_tz_map.get(h, "America/New_York")
        }
    elif done and not games_by_key[key]["done"]:
        games_by_key[key].update({"hp": hp, "ap": ap, "done": True})

# Apply fresh 2026-27 ESPN scores up through today (2026-11-15)
for ev in events_2627:
    key = (ev["d"], ev["h"], ev["a"])
    dt = datetime.date(*map(int, ev["d"].split("-")))
    if ev["completed"] and ev["hp"] != ev["ap"] and ev["hp"] > 0:
        if key not in games_by_key:
            games_by_key[key] = {
                "d": ev["d"], "day": dt.strftime("%A").upper(), "s": "2026-27",
                "h": ev["h"], "a": ev["a"], "hp": ev["hp"], "ap": ev["ap"], "done": True,
                "arena": team_arena_map.get(ev["h"], ""), "tz": team_tz_map.get(ev["h"], "America/New_York")
            }
        else:
            games_by_key[key].update({"hp": ev["hp"], "ap": ev["ap"], "done": True})
    elif key not in games_by_key:
        games_by_key[key] = {
            "d": ev["d"], "day": dt.strftime("%A").upper(), "s": "2026-27",
            "h": ev["h"], "a": ev["a"], "hp": 0, "ap": 0, "done": False,
            "arena": team_arena_map.get(ev["h"], ""), "tz": team_tz_map.get(ev["h"], "America/New_York")
        }

all_games = sorted(games_by_key.values(), key=lambda g: (g["d"], g["h"], g["a"]))
print(f"Unified game universe: {len(all_games)} games ({sum(1 for g in all_games if g['done'])} completed, {sum(1 for g in all_games if not g['done'])} pending)")

# 2. Precompute per-player static metadata (deg2, deg3_a, deg3_b, deg3_c, nam_fawe)
p_static = {}
for pid, pm in player_master.items():
    fn = pc.clean_ascii(pm.get("full_name") or "")
    jn = pc.clean_ascii(pm.get("jersey_name") or (fn.split()[-1] if fn else ""))
    j_str = str(pm.get("jersey") or "").strip()
    deg2 = pc.egem(fn) % 360
    gem_jn = pc.egem(jn)
    j_eff = pc.jersey_eff_num(j_str, zero_rule=True)
    deg3_a = gem_jn % 360
    deg3_b = (gem_jn + j_eff) % 360
    deg3_c = j_eff % 360
    nam_fawe = tuple(pc.s4.word_element_fawe(fn))
    p_static[pid] = {
        "pid": pid,
        "fn": fn,
        "jn": jn,
        "j_str": j_str if j_str != "" else "0",
        "j_eff": j_eff,
        "pos": pm.get("pos", ""),
        "status": pm.get("status", "Healthy"),
        "inj": pm.get("injury_detail", ""),
        "deg2": deg2,
        "deg3": {"mode_a": deg3_a, "mode_b": deg3_b, "mode_c": deg3_c},
        "nam_fawe": nam_fawe,
    }

# Index 2026-27 boxscores chronologically per team for strict pre-game rolling rotation (b.d < g.d)
team_box_2627 = defaultdict(list)
for eid, bobj in boxscores_2627.items():
    d_b = bobj["d"]
    for tname, plist in bobj["box"].items():
        team_box_2627[tname].append((d_b, plist))
for tname in team_box_2627:
    team_box_2627[tname].sort(key=lambda x: x[0])

live_roster_pids = {
    tname: {p["pid"]: p for p in plist}
    for tname, plist in live_rosters.items()
}

def get_pregame_lineup(tname, s_lbl, d_iso, is_pending=False, top_k=8):
    """
    Strictly pre-game active player lineup with minute weights (NO lookahead!).
    """
    if s_lbl == "2026-27":
        prior_games = [plist for (db, plist) in team_box_2627.get(tname, []) if db < d_iso]
        cur_roster = live_roster_pids.get(tname, {})
        # Baseline prior MPG from 2025-26 or 2026-27 seasonal table
        base_mpg = {}
        for ps in season_team_players.get(f"2025-26||{tname}", []):
            base_mpg[ps["pid"]] = float(ps.get("mpg", 15.0))
        if prior_games:
            min_sums = defaultdict(float)
            gp_cnts = defaultdict(int)
            st_cnts = defaultdict(int)
            # Use last 10 prior games for crisp current rotation
            recent = prior_games[-10:]
            for plist in recent:
                for pr in plist:
                    min_sums[pr["pid"]] += pr["min"]
                    gp_cnts[pr["pid"]] += 1
                    if pr["starter"]:
                        st_cnts[pr["pid"]] += 1
            cands = []
            all_pids = set(min_sums.keys()) | (set(cur_roster.keys()) if is_pending else set())
            for pid in all_pids:
                if pid not in p_static:
                    continue
                if is_pending:
                    if cur_roster and pid not in cur_roster:
                        continue
                    st_lbl = str(cur_roster.get(pid, {}).get("status", "Healthy"))
                    if st_lbl.lower() == "out":
                        continue
                g_c = gp_cnts.get(pid, 0)
                obs_m = (min_sums[pid] / g_c) if g_c > 0 else 0.0
                prior_m = base_mpg.get(pid, 12.0)
                # Empirical Bayes blend so 1st/2nd game of season is stable
                blend_mpg = (g_c * obs_m + 2.0 * prior_m) / (g_c + 2.0) if g_c > 0 else (prior_m * 0.4)
                if blend_mpg >= 6.0:
                    cands.append((pid, round(blend_mpg, 1), st_cnts.get(pid, 0) >= max(1, g_c // 2)))
            cands.sort(key=lambda x: (x[2], x[1]), reverse=True)
            if len(cands) >= 5:
                return cands[:top_k]

    # Historical seasons (2009-10..2025-26) or Opening Night fallback
    raw_list = season_team_players.get(f"{s_lbl}||{tname}", [])
    if not raw_list:
        # fallback to adjacent season
        y0 = int(s_lbl[:4])
        raw_list = season_team_players.get(f"{y0-1}-{str(y0)[-2:]}||{tname}", [])
    out = []
    cur_roster = live_roster_pids.get(tname, {})
    for idx_p, r in enumerate(raw_list):
        pid = r["pid"]
        if pid not in p_static:
            continue
        if is_pending and cur_roster:
            if pid not in cur_roster:
                continue
            if str(cur_roster[pid].get("status", "")).lower() == "out":
                continue
        mpg = max(8.0, float(r.get("mpg") or 15.0))
        out.append((pid, round(mpg, 1), idx_p < 5))
        if len(out) >= top_k:
            break
    return out

# Precompute lineups once across all games!
game_lineups = []
for g in all_games:
    is_pend = not g["done"]
    hl = get_pregame_lineup(g["h"], g["s"], g["d"], is_pend, top_k=8)
    al = get_pregame_lineup(g["a"], g["s"], g["d"], is_pend, top_k=8)
    game_lineups.append((hl, al))

print(f"Precomputed strictly pre-game Top-8 lineups for {len(all_games)} games in {time.time()-t0:.1f}s")

# Entity memoization cache: (d_iso, is_local_tz, pid, mode_key) -> (ele_p, ele_fin, ele_dyn, m_dict)
def eval_team_lineup(d_ctx, lineup, mode_key, tbl):
    """
    Minute-weighted aggregation of active players preserving exact Step 4 integer lattice & algebraic laws:
      ele_fin = ele_p + ele_date_sum
      ele_dyn = ele_p + ele_fin
    """
    if not lineup:
        lineup = []
    tot_w = sum(w for _, w, _ in lineup) or 1.0
    ep_acc = [0.0, 0.0, 0.0, 0.0]
    nam_acc = [0.0, 0.0, 0.0, 0.0]
    m_keys = ["qdeg", "qfin", "qdec", "qdecf", "qtot", "qp2", "gd", "rul", "qnam"]
    m_acc = {k: [0.0, 0.0] for k in m_keys}
    player_cards = []

    for pid, mpg, is_st in lineup:
        ps = p_static[pid]
        w = mpg / tot_w
        d2 = ps["deg2"]
        d3 = ps["deg3"][mode_key]
        ep, ef, ed, md = pc.fast_eval_entity(d_ctx, 53, d2, d3, ps["nam_fawe"], tbl)
        for j in range(4):
            ep_acc[j] += w * ep[j]
            nam_acc[j] += w * ps["nam_fawe"][j]
        for k in m_keys:
            m_acc[k][0] += w * md[k][0]
            m_acc[k][1] += w * md[k][1]
        # Individual player nightly power score (astrological dryness + decan magnitude + dynamic fire/air balance)
        pwr = round(
            (-md["qfin"][1]) * 1.5
            + (abs(md["qdec"][0]) + abs(md["qdec"][1])) * 0.08
            + (ed[0] + ed[1] - ed[2] - ed[3]) * 1.2,
            1
        )
        player_cards.append({
            "pid": pid,
            "fn": ps["fn"],
            "jn": ps["jn"],
            "no": ps["j_str"],
            "pos": ps["pos"],
            "st": is_st,
            "mpg": mpg,
            "d2": d2,
            "d3": d3,
            "ep": f"{ep[0]}-{ep[1]}-{ep[2]}-{ep[3]}",
            "ef": f"{ef[0]}-{ef[1]}-{ef[2]}-{ef[3]}",
            "qf": f"{pc.s4.fmt_hc(md['qfin'][0], False)}/{pc.s4.fmt_md(md['qfin'][1], False)}",
            "dec": md["decan_lbl"],
            "pwr": pwr,
        })

    # Exact integer composite ele_p in 0..4 -> exact Step 4 ele_fin and ele_dyn!
    ele_date_sum = d_ctx[7]
    ep_tm = tuple(min(4, max(0, int(round(ep_acc[j])))) for j in range(4))
    ef_tm = tuple(ep_tm[j] + ele_date_sum[j] for j in range(4))
    ed_tm = tuple(ep_tm[j] + ef_tm[j] for j in range(4))

    c12 = [
        f"{ed_tm[0]} FIRE", f"{ed_tm[1]} AIR", f"{ed_tm[2]} WATER", f"{ed_tm[3]} EARTH",
        f"{ef_tm[0]} FIRE", f"{ef_tm[1]} AIR", f"{ef_tm[2]} WATER", f"{ef_tm[3]} EARTH",
        f"{ep_tm[0]} FIRE", f"{ep_tm[1]} AIR", f"{ep_tm[2]} WATER", f"{ep_tm[3]} EARTH",
    ]
    geo_fin = "".join("1" if (x % 2 == 1) else "0" for x in ef_tm)
    geo_dyn = "".join("1" if (x % 2 == 1) else "0" for x in ed_tm)
    m_tm = {k: (int(round(v[0])), int(round(v[1]))) for k, v in m_acc.items()}
    return c12, geo_fin, geo_dyn, m_tm, player_cards

# Helper: 5-Method Fusion breakdown on composite player m_dicts (UTC + Local Tip-Off)
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
    va, vb, vc, vd, ve = sA(mh_u,ma_u), sB(mh_u,ma_u), sC(mh_l,ma_l), sD(mh_u,ma_u), sE(mh_l,ma_l)
    mv = [va, vb, vc, vd, ve]
    f30 = sum(mv)
    ag5 = sum(1 for v in mv if (v > 0 if f30 >= 0 else v < 0))
    return mv, f30, ag5

# Import nba_live_sync helpers for Weekly/Daily Pythagorean + Log5 snapshots & 4-Channel Twin Engine!
sys.path.insert(0, "/home/user/workspace/player_app_src/artifacts/api-server/python")
import nba_live_sync as nls

# Precompute Weekly & Daily Standings Snapshots across 2010..2027 (purely outcome-based, shared across modes)
done_base_hist = [
    {"d": g["d"], "day": g["day"], "s": g["s"], "h": g["h"], "a": g["a"], "hp": g["hp"], "ap": g["ap"], "mg": g["hp"] - g["ap"]}
    for g in all_games if g["done"]
]
cut_pairs = set()
sched_set = set()
for g in all_games:
    sched_set.add((g["d"], g["h"]))
    sched_set.add((g["d"], g["a"]))
    cut_pairs.add((g["d"], g["s"]))
    if g["d"] >= "2024-10-01":
        dt = datetime.date(*map(int, g["d"].split("-")))
        mon = (dt - datetime.timedelta(days=dt.weekday())).isoformat()
        cut_pairs.add((mon, g["s"]))

all_snaps = nls.build_all_snapshots(done_base_hist, cut_pairs)
print(f"Built {len(all_snaps)} zero-lookahead standings snapshots in {time.time()-t0:.1f}s")

# Fast numpy twin search matching nba_live_sync.auto_filter 100%
def fast_auto_filter_np(D, lim, t_vec, t_geo, g_key, geo_first, min_gf):
    idx = np.arange(lim, dtype=np.int32)
    m_mat = D["m12"]
    g_arr = D[g_key]
    used_geo = False
    if geo_first and t_geo > 0:
        nxt = idx[g_arr[idx] == t_geo]
        if len(nxt) >= min_gf:
            idx = nxt
            used_geo = True
    used = 0
    while len(idx) > 7:
        bc, bcnt, bnxt = -1, -1, None
        sub = m_mat[idx]
        for c in range(12):
            if (used >> c) & 1:
                continue
            tv = t_vec[c]
            if tv == 0:
                continue
            mask = (sub[:, c] == tv)
            cnt = int(mask.sum())
            if 5 <= cnt < len(idx) and cnt > bcnt:
                bc, bcnt, bnxt = c, cnt, idx[mask]
        if bc < 0:
            break
        used |= (1 << bc)
        idx = bnxt
        if 5 <= len(idx) <= 7:
            break
    if (not geo_first) and (not used_geo) and t_geo > 0 and len(idx) > 7:
        nxt = idx[g_arr[idx] == t_geo]
        if 5 <= len(nxt) <= 7:
            idx = nxt
    nat = (5 <= len(idx) <= 7)
    chosen = idx if len(idx) <= 7 else idx[-7:]
    pool_rows = [D["rows"][int(i)] for i in chosen]
    hw, aw, d_raw, s_delta, eff = nls.pool_idx_ds(pool_rows)
    tot = max(1, hw + aw)
    pct = round(max(hw, aw) * 100.0 / tot, 1)
    return {
        "pool": pool_rows, "hw": hw, "aw": aw, "pct": pct, "mv": abs(hw - aw),
        "nat": nat, "ds": eff, "d_raw": d_raw, "s_delta": s_delta
    }

summary_comparison = {}

for mode_key, mode_label in [
    ("mode_a", "A: فقط نام روی پیراهن (DEG3 = Jersey Name)"),
    ("mode_b", "B: جمع نام و شماره پیراهن (DEG3 = Jersey Name + No)"),
    ("mode_c", "C: جایگزینی کامل با شماره پیراهن (DEG3 = Jersey No)"),
]:
    tm_m = time.time()
    vocab = {}
    def vid(s):
        if not s:
            return 0
        v = vocab.get(s)
        if v is None:
            v = len(vocab) + 1
            vocab[s] = v
        return v

    mode_rows = []
    for idx_g, g in enumerate(all_games):
        d_ctx = pc.get_date_ctx(g["d"])
        hl, al = game_lineups[idx_g]
        tbl_u = d_ctx[8]
        need_target = (g["d"] >= "2024-10-01")
        h12, h_fin, h_dyn, mh_u, h_pcards = eval_team_lineup(d_ctx, hl, mode_key, tbl_u)
        a12, a_fin, a_dyn, ma_u, a_pcards = eval_team_lineup(d_ctx, al, mode_key, tbl_u)

        snap_dy = all_snaps[(g["d"], g["s"])]
        h_tab, a_tab = nls.geo_tab_pair(snap_dy, g["h"], g["a"])

        mv, f30, ag5 = [0,0,0,0,0], 0, 3
        if need_target:
            y, m, d = map(int, g["d"].split("-"))
            jd_l = pc.get_jd_local(y, m, d, g["tz"], 19, 30)
            tbl_l = pc.get_deg_table(jd_l)
            _, _, _, mh_l, _ = eval_team_lineup(d_ctx, hl, mode_key, tbl_l)
            _, _, _, ma_l, _ = eval_team_lineup(d_ctx, al, mode_key, tbl_l)
            mv, f30, ag5 = score_5_player_fusion(mh_u, ma_u, mh_l, ma_l)

        mode_rows.append({
            "g": g,
            "h12": h12, "a12": a12,
            "h_fin": h_fin, "h_dyn": h_dyn, "h_tab": h_tab,
            "a_fin": a_fin, "a_dyn": a_dyn, "a_tab": a_tab,
            "v_h12": [vid(x) for x in h12],
            "v_hfin": vid(h_fin), "v_hdyn": vid(h_dyn), "v_htab": vid(h_tab),
            "mv": mv, "f30": f30, "ag5": ag5,
            "mh_u": mh_u,
            "h_pcards": h_pcards if g["d"] >= "2026-10-01" else None,
            "a_pcards": a_pcards if g["d"] >= "2026-10-01" else None,
        })

    # Build weekday numpy indices for completed games
    by_day = defaultdict(list)
    hist_pack_out = []
    for mr in mode_rows:
        g = mr["g"]
        if g["done"]:
            mg = g["hp"] - g["ap"]
            rec_h = {
                "d": g["d"], "day": g["day"], "s": g["s"],
                "h": g["h"], "a": g["a"], "hp": g["hp"], "ap": g["ap"], "mg": mg,
                "h12": mr["h12"], "h_fin": mr["h_fin"], "h_dyn": mr["h_dyn"], "h_tab": mr["h_tab"],
                "v_h12": mr["v_h12"], "v_hfin": mr["v_hfin"], "v_hdyn": mr["v_hdyn"], "v_htab": mr["v_htab"],
            }
            by_day[g["day"]].append(rec_h)
            hist_pack_out.append([
                g["d"], g["day"], g["s"], g["h"], g["a"], g["hp"], g["ap"], mg,
                mr["h12"], mr["h_dyn"], mr["a12"], mr["a_dyn"],
                mr["f30"], "", mr["h_tab"], mr["a_tab"]
            ])

    day_np = {}
    for wd_k, lst in by_day.items():
        day_np[wd_k] = {
            "dates": [x["d"] for x in lst],
            "rows": lst,
            "m12": np.array([x["v_h12"] for x in lst], dtype=np.int32),
            "fin": np.array([x["v_hfin"] for x in lst], dtype=np.int32),
            "dyn": np.array([x["v_hdyn"] for x in lst], dtype=np.int32),
            "tab": np.array([x["v_htab"] for x in lst], dtype=np.int32),
        }

    # Evaluate 2024-10-01..2027-04-11 games (exact NBA-SIGNAL-DASHBORD schema!)
    preds_out = []
    game_num = 0
    for mr in mode_rows:
        g = mr["g"]
        if g["d"] < "2024-10-01":
            continue
        game_num += 1
        D = day_np[g["day"]]
        lim = bisect.bisect_left(D["dates"], g["d"])

        sd  = fast_auto_filter_np(D, lim, mr["v_h12"], mr["v_hdyn"], "dyn", False, 3)
        gd3 = fast_auto_filter_np(D, lim, mr["v_h12"], mr["v_hdyn"], "dyn", True,  3)
        f30 = mr["f30"]
        ag5 = mr["ag5"]
        sa = (sd["hw"] >= sd["aw"]) == (f30 >= 0)
        ga = (gd3["hw"] >= gd3["aw"]) == (f30 >= 0)
        pick_geo = (
            False if (sd["pct"] < 60 or (sa and not ga and sd["pct"] >= 55))
            else True if (not sa and ga and gd3["pct"] >= 55)
            else (gd3["pct"] > sd["pct"] or (gd3["pct"] == sd["pct"] and gd3["mv"] > sd["mv"]))
        )
        ch = gd3 if pick_geo else sd
        hw, aw, nat = ch["hw"], ch["aw"], ch["nat"]
        tot = hw + aw
        pct_int = round(max(hw, aw) * 100 / tot) if tot else 50
        hfav = True if hw > aw else (False if aw > hw else f30 >= 0)
        sgn = 1 if hfav else -1
        pred = g["h"] if hfav else g["a"]
        opp  = g["a"] if hfav else g["h"]
        f30_o = f30 * sgn
        agree = (hfav and f30 > 0) or (not hfav and f30 < 0)
        both100 = sd["pct"] == 100.0 and gd3["pct"] == 100.0 and ((sd["hw"] > 0) == (gd3["hw"] > 0))
        v71 = 5 <= tot <= 7 and pct_int >= 71 and abs(hw - aw) >= 3
        bcombo = v71 and (agree or both100)

        c1 = fast_auto_filter_np(D, lim, mr["v_h12"], mr["v_hfin"], "fin", False, 5)
        c2 = fast_auto_filter_np(D, lim, mr["v_h12"], mr["v_hfin"], "fin", True,  5)
        c3 = fast_auto_filter_np(D, lim, mr["v_h12"], mr["v_hdyn"], "dyn", True,  5)
        c4 = fast_auto_filter_np(D, lim, mr["v_h12"], mr["v_htab"], "tab", True,  5)

        ds4 = [c1["ds"], c2["ds"], c3["ds"], c4["ds"]]
        ds4_o = [v * sgn for v in ds4]
        ds3_o = ds4_o[:3]
        vh4 = sum(1 for v in ds4 if v > 0); va4 = sum(1 for v in ds4 if v < 0)
        nat4 = sum(1 for cx in (c1, c2, c3, c4) if cx["nat"])
        fav_v4 = vh4 if hfav else va4; opp_v4 = va4 if hfav else vh4
        fav_v3 = sum(1 for v in ds3_o if v > 0); opp_v3 = sum(1 for v in ds3_o if v < 0)
        min_o4 = min(ds4_o); min_o3 = min(ds3_o)

        y, m, d = map(int, g["d"].split("-"))
        dt = datetime.date(y, m, d)
        mon = (dt - datetime.timedelta(days=dt.weekday())).isoformat()
        yest = (dt - datetime.timedelta(days=1)).isoformat()
        pb2b = (yest, pred) in sched_set and (yest, opp) not in sched_set
        ob2b = (yest, opp) in sched_set and (yest, pred) not in sched_set
        is_playoff = (g["d"][5:10] >= "04-15" and m <= 6)
        c4_vote_opp = ((c4["hw"] - c4["aw"]) * sgn < 0)

        t1 = (not hfav) and (f30_o < 10 or (fav_v3 < 2 and fav_v4 < 3))
        t2 = (opp_v3 >= 2 and f30_o < 8) or (opp_v4 >= 2 and f30_o < 10)
        t3 = pb2b and f30_o < 12 and ((not hfav) or (not nat))
        t4 = (not nat) and fav_v3 < 3 and fav_v4 < 3 and f30_o < 12
        t5 = (fav_v4 == 0) or (c4_vote_opp and f30_o < 12) or (is_playoff and (ag5 < 4 or not nat))
        htrap = t1 or t2 or t3 or t4 or t5
        trap_tag = (
            "تله میهمان ضعیف" if t1
            else "مخالفت شاخص ۴ کاناله Δ+S" if t2
            else "تله خستگی B2B" if t3
            else "تله CAP7 بدون پشتوانه" if t4
            else "مخالفت شکل رمل جدول روزانه (GEO-TAB)" if (c4_vote_opp and f30_o < 12)
            else "تله پلی‌آف غیرطبیعی" if (is_playoff and (ag5 < 4 or not nat))
            else "تساوی/مخالفت شاخص Δ+S" if t5
            else ""
        )
        g4 = bool(bcombo and not htrap)
        c4_hfav = c4["hw"] > c4["aw"]
        c4_resc = (
            (not bcombo)
            and 5 <= (c4["hw"] + c4["aw"]) <= 7
            and c4["nat"] and c4["pct"] >= 83
            and c4_hfav == hfav and f30_o >= 10 and c4["ds"] * sgn >= 2
            and not is_playoff and not pb2b
        )
        resc = bool(((not bcombo) and v71 and fav_v4 >= 3 and min_o3 >= 1 and not htrap) or c4_resc)

        snap_wk = all_snaps[(mon, g["s"])]
        snap_dy = all_snaps[(g["d"], g["s"])]
        wtp_wk = nls.make_wtp_obj(snap_wk, mon, g["h"], g["a"], hfav)
        wtp_dy = nls.make_wtp_obj(snap_dy, yest, g["h"], g["a"], hfav)
        wtrap_wk = (wtp_wk["mel"] == "EARTH")
        wtrap_dy = (wtp_dy["mel"] == "EARTH")

        f1_wtp = bool(g4 and not wtrap_wk)
        vip_idx3 = bool(g4 and not wtrap_wk and (wtp_wk["mel"] == "FIRE" or (nat and fav_v4 == 4 and min_o4 >= 2)))
        f1_union = bool((g4 or resc) and not wtrap_wk)

        f1_wtp_day = bool(g4 and not wtrap_dy)
        vip_idx3_day = bool(g4 and not wtrap_dy and (wtp_dy["mel"] == "FIRE" or (nat and fav_v4 == 4 and min_o4 >= 2)))
        f1_union_day = bool((g4 or resc) and not wtrap_dy)

        aw_team = (g["h"] if g["hp"] > g["ap"] else g["a"]) if g["done"] else "PENDING"
        st_lbl = ("WIN" if pred == aw_team else "LOSS") if g["done"] else "PENDING"
        sc_lbl = f"{g['hp']}-{g['ap']}" if g["done"] else "PENDING"

        # Margins for TP1/TP2/TP3
        dir_mgs = sorted([abs(x["mg"]) for x in ch["pool"] if (x["mg"] > 0) == hfav])
        if dir_mgs:
            tp_arr = [
                int(dir_mgs[max(0, len(dir_mgs)//4)]),
                int(dir_mgs[len(dir_mgs)//2]),
                int(dir_mgs[min(len(dir_mgs)-1, (3*len(dir_mgs))//4)])
            ]
        else:
            tp_arr = [4, 8, 12]

        # Injured OUT players on live roster for pending / 2026-27 games
        h_out, a_out = [], []
        if g["d"] >= "2026-11-10":
            h_out = [f"{p['full_name']} (#{p['jersey']})" for p in live_rosters.get(g["h"], []) if str(p.get("status","")).lower() == "out"]
            a_out = [f"{p['full_name']} (#{p['jersey']})" for p in live_rosters.get(g["a"], []) if str(p.get("status","")).lower() == "out"]

        pred_obj = {
            "n": game_num,
            "day": g["day"], "d": g["d"], "ym": g["d"][:7], "s": g["s"],
            "h": g["h"], "a": g["a"],
            "hc": team_code_map.get(g["h"], ""), "ac": team_code_map.get(g["a"], ""),
            "venue": g["arena"],
            "hp": g["hp"], "ap": g["ap"],
            "sc": sc_lbl, "pw": pred, "fpw": pred, "sys_win": pred, "twWin": pred,
            "aw": aw_team, "st": st_lbl, "fst": st_lbl,
            "done": g["done"], "hw": (g["hp"] > g["ap"]) if g["done"] else None,
            "ph": hfav, "vm6": f30, "f30": f30, "a25": f30, "ag5": ag5, "mv": mv,
            "v": mv, "nd": abs(f30),
            "b137": False, "n80": False, "e80": False, "q80": False, "g83": False,
            "tier": "VIP" if vip_idx3 else ("QUALIFIED" if f1_wtp else "FILTERED"),
            "twMode": "GEO" if pick_geo else "STEP",
            "twVotes": f"{hw}H-{aw}A", "twPct": f"{pct_int}%",
            "tp": tp_arr, "twAgree": agree,
            "twins": [[x["d"], x["h"], x["a"], x["hp"], x["ap"], x["mg"]] for x in ch["pool"]],
            "twPeers": [f"{x['d']} | {x['h']} {x['hp']}-{x['ap']} {x['a']}" for x in ch["pool"]],
            "h_12": mr["h12"], "h_geo": mr["h_fin"], "h_geo_dyn": mr["h_dyn"], "h_geo_tab": mr["h_tab"],
            "a_12": mr["a12"], "a_geo": mr["a_fin"], "a_geo_dyn": mr["a_dyn"], "a_geo_tab": mr["a_tab"],
            "b2b_tag": "B2B_PICK" if pb2b else ("B2B_OPP" if ob2b else ""),
            "is_nat": bool(nat),
            "trap_tag": trap_tag,
            "f1": bool(bcombo),
            "f1_idx": bool(bcombo and (ch["ds"] * sgn > 0)),
            "f1_guard": g4,
            "idx_rescue": resc,
            "f1_wtp": f1_wtp, "vip_idx3": vip_idx3, "f1_union": f1_union,
            "f1_wtp_day": f1_wtp_day, "vip_idx3_day": vip_idx3_day, "f1_union_day": f1_union_day,
            "idx3": {
                "st": [c1["hw"], c1["aw"], c1["ds"]],
                "gf": [c2["hw"], c2["aw"], c2["ds"]],
                "gd": [c3["hw"], c3["aw"], c3["ds"]],
                "gt": [c4["hw"], c4["aw"], c4["ds"]],
                "tw": [hw, aw, ch["ds"]],
                "vh": vh4, "va": va4, "nat": nat4, "minD": min_o4,
            },
            "wtp": wtp_wk,
            "wtp_day": wtp_dy,
            "p_mode": mode_key,
            "h_players": mr["h_pcards"],
            "a_players": mr["a_pcards"],
            "h_out": h_out,
            "a_out": a_out,
        }
        preds_out.append(pred_obj)

    # Calculate zero-lookahead evaluation stats across 2024-27, 2024-25, 2025-26, 2026-27, last 50
    done_p = [x for x in preds_out if x["done"]]
    def calc_metric(sub, flag_k):
        sel = [x for x in sub if x.get(flag_k)]
        w = sum(1 for x in sel if x["sys_win"] == x["aw"])
        n = len(sel)
        return {"w": w, "n": n, "pct": round(100.0 * w / max(1, n), 1)}

    sel_all = [x for x in done_p if x["f1_wtp"]]
    last50 = sel_all[-50:]
    l50_w = sum(1 for x in last50 if x["sys_win"] == x["aw"])

    stats_obj = {
        "mode": mode_key,
        "label": mode_label,
        "total_2427": calc_metric(done_p, "f1_wtp"),
        "vip_2427": calc_metric(done_p, "vip_idx3"),
        "union_2427": calc_metric(done_p, "f1_union"),
        "guard_only": calc_metric(done_p, "f1_guard"),
        "s2425": calc_metric([x for x in done_p if x["s"] == "2024-25"], "f1_wtp"),
        "s2526": calc_metric([x for x in done_p if x["s"] == "2025-26"], "f1_wtp"),
        "s2627": calc_metric([x for x in done_p if x["s"] == "2026-27"], "f1_wtp"),
        "last50": {"w": l50_w, "n": len(last50), "pct": round(100.0 * l50_w / max(1, len(last50)), 1)},
    }
    summary_comparison[mode_key] = stats_obj
    print(f"\n=== {mode_label} ({time.time()-tm_m:.1f}s) ===")
    print("  2024-27 Final (f1_wtp):", stats_obj["total_2427"])
    print("  2024-27 VIP           :", stats_obj["vip_2427"])
    print("  2024-25 Season        :", stats_obj["s2425"])
    print("  2025-26 Season        :", stats_obj["s2526"])
    print("  2026-27 Live Season   :", stats_obj["s2627"])
    print("  Recent 50 Signals     :", stats_obj["last50"])


    SHAMSI_MONTHS = ["", "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"]
    def _g2j(gy, gm, gd):
        g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]
        gy2 = gy + 1 if gm > 2 else gy
        days = 355666 + (365 * gy) + ((gy2 + 3) // 4) - ((gy2 + 99) // 100) + ((gy2 + 399) // 400) + gd + g_d_m[gm - 1]
        jy = -1595 + (33 * (days // 12053)); days %= 12053
        jy += 4 * (days // 1461); days %= 1461
        if days > 365: jy += (days - 1) // 365; days = (days - 1) % 365
        if days < 186: jm = 1 + (days // 31); jd = 1 + (days % 31)
        else: jm = 7 + ((days - 186) // 30); jd = 1 + ((days - 186) % 30)
        return jy, jm, jd
    for _g in preds_out:
        _y, _m, _d = map(int, _g["d"].split("-"))
        _jy, _jm, _jd = _g2j(_y, _m, _d)
        _g["sh_d"] = f"{_jy}/{_jm:02d}/{_jd:02d}"
        _g["sh_m"] = f"{_jy}-{_jm:02d} ({SHAMSI_MONTHS[_jm]})"
        _hp = _g.get("h_players") or []
        _ap = _g.get("a_players") or []
        _hd2 = _hp[0]["d2"] if _hp else 53
        _hd3 = _hp[0]["d3"] if _hp else 0
        _ad2 = _ap[0]["d2"] if _ap else 53
        _ad3 = _ap[0]["d3"] if _ap else 0
        _g["deg"] = [53, _hd2, _hd3, _ad2, _ad3, _hd2, _ad2, _hd3]

    # Save predictions & history pack for this mode
    json.dump(
        {"games": preds_out, "modeStats": stats_obj},
        open(os.path.join(PUB_DIR, f"player_nba_preds_{mode_key}.json"), "w"),
        ensure_ascii=False, separators=(",", ":")
    )
    json.dump(
        hist_pack_out,
        open(os.path.join(PUB_DIR, f"player_nba_hist_{mode_key}.json"), "w"),
        ensure_ascii=False, separators=(",", ":")
    )

json.dump(summary_comparison, open(os.path.join(PUB_DIR, "player_modes_comparison.json"), "w"), ensure_ascii=False, indent=2)
print(f"\nALL 3 MODES BUILT & SAVED in {time.time()-t0:.1f}s!")
