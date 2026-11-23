import os
#!/usr/bin/env python3
"""
Live ESPN Score + Dedicated Google Sheets Sync for App #3: NBA-FUSION-SIGNAL v4
Updates /home/runner/workspace/artifacts/calc-dashboard/public/fusion_nba_master.json
and syncs dedicated Google Sheet NBA-FUSION-INPUT (TENNIS_ISOLATED_FUSION_INPUT).
Leaves NBA-SIGNAL-DASHBORD and NBA-PLAYER-SIGNAL 100% untouched.
"""
import argparse, json, os, sys, urllib.request
from datetime import datetime, timezone, timedelta

INPUT_SHEET_ID = os.environ.get("TENNIS_FUSION_INPUT_SHEET_ID", "")
CALC_SHEET_ID  = os.environ.get("TENNIS_FUSION_CALC_SHEET_ID", "")

def norm_team(s):
    t = str(s or "").strip()
    return "Los Angeles Clippers" if t == "LA Clippers" else t

def fetch_espn_date(d_iso):
    ds = d_iso.replace("-", "")
    url = f"https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates={ds}"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    data = json.loads(urllib.request.urlopen(req, timeout=12).read().decode("utf-8"))
    finals = {}
    for ev in data.get("events", []):
        if not ev.get("status", {}).get("type", {}).get("completed"):
            continue
        comps = ev.get("competitions", [{}])[0].get("competitors", [])
        hc = next((c for c in comps if c.get("homeAway") == "home"), None)
        ac = next((c for c in comps if c.get("homeAway") == "away"), None)
        if not hc or not ac:
            continue
        h = norm_team(hc.get("team", {}).get("displayName", ""))
        a = norm_team(ac.get("team", {}).get("displayName", ""))
        try:
            hp = int(hc.get("score", 0)); ap = int(ac.get("score", 0))
        except Exception:
            continue
        if hp > 0 and ap > 0 and hp != ap:
            finals[(h, a)] = (hp, ap)
    return finals

def sync_fusion_sheets(games, target_iso):
    if os.environ.get("TENNIS_SHEETS_WRITE_ENABLED", "0") != "1" or not os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON"):
        return False
    try:
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        from _lib.sheets import open_sheet
        sh_in = open_sheet(INPUT_SHEET_ID)
        ws1 = sh_in.sheet1
        today_games = [g for g in games if g["d"] == target_iso]
        if today_games:
            rows = [[
                "DATE", "WEEKDAY", "DEG1_FIXED", "HOME_TEAM", "AWAY_TEAM",
                "ARENA", "TIPOFF_LOCAL", "FUSION_TIER", "FUSION_PICK",
                "HOME_1XXX_SUM", "AWAY_1XXX_SUM", "GEO_1XXX_WIN",
                "HOME_ALL8_SUM", "AWAY_ALL8_SUM", "EARTH_LOCK_OK", "NEG_ANCHOR_OK", "POS_INV_WIN", "SAFE_DL_WIN"
            ]]
            for g in today_games:
                fm = g.get("fusion_meta") or {}
                g1 = fm.get("geo1xxx") or {}
                gd = g1.get("guards") or {}
                pi = g1.get("pos_inv") or {}
                m12 = (fm.get("modes") or {}).get("tri_gf_ultralock") or {}
                m9 = (fm.get("modes") or {}).get("pos_inv_lock") or {}
                rows.append([
                    g["d"], g["day"], (47 if str(g.get("tour", "ATP")).upper() == "WTA" else 121), g["h"], g["a"],
                    g.get("venue", ""), "19:30:00", fm.get("tier_fa", ""), m12.get("pick") or m9.get("pick") or g.get("sys_win", ""),
                    g1.get("h_sum", 0.0), g1.get("a_sum", 0.0), g1.get("win", ""),
                    g1.get("h_all", 0.0), g1.get("a_all", 0.0),
                    "PASS" if gd.get("earth_ok") else "BLOCKED_EARTH",
                    "PASS" if gd.get("neg_anchor_ok") else ("POS_INV_TRAP" if gd.get("pos_inv_trap") else "NO_NEG_ANCHOR"),
                    pi.get("win", ""),
                    g1.get("safe_dl_win", ""),
                ])
            ws1.clear()
            ws1.update(values=rows, range_name="A1", value_input_option="RAW")
        return True
    except Exception:
        return False

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--start-date", default="")
    ap.add_argument("--end-date", default="")
    ap.add_argument("--target-date", default="")
    args = ap.parse_args()

    pub_dir = "/home/runner/workspace/artifacts/calc-dashboard/public"
    m_path = os.path.join(pub_dir, "fusion_nba_master.json")
    doc = json.load(open(m_path, "r", encoding="utf-8"))
    games = doc["games"]

    today_utc = datetime.now(timezone.utc).date()
    max_check_iso = (today_utc + timedelta(days=1)).isoformat()
    min_recent_iso = (today_utc - timedelta(days=4)).isoformat()

    dates_to_check = set()
    for g in games:
        d_iso = g["d"]
        if d_iso <= max_check_iso and (not g.get("done") or g.get("aw") in (None, "", "PENDING") or d_iso >= min_recent_iso):
            if d_iso >= "2026-10-15":
                dates_to_check.add(d_iso)
    if args.target_date and len(args.target_date) == 10 and args.target_date <= max_check_iso:
        dates_to_check.add(args.target_date)
    if args.start_date and args.end_date:
        for g in games:
            if args.start_date <= g["d"] <= args.end_date:
                dates_to_check.add(g["d"])

    sorted_dates = sorted(dates_to_check)[-20:]
    updated_scores = 0

    for d_iso in sorted_dates:
        try:
            finals = fetch_espn_date(d_iso)
        except Exception:
            continue
        if not finals:
            continue
        for g in games:
            if g["d"] != d_iso:
                continue
            h_norm, a_norm = norm_team(g["h"]), norm_team(g["a"])
            if (h_norm, a_norm) not in finals:
                continue
            hp, ap_pts = finals[(h_norm, a_norm)]
            aw = h_norm if hp > ap_pts else a_norm
            new_sc = f"{hp}-{ap_pts}"
            was_done = bool(g.get("done") and g.get("sc") == new_sc and g.get("aw") == aw)
            g["hp"], g["ap"] = hp, ap_pts
            g["sc"] = new_sc
            g["aw"] = aw
            g["done"] = True
            g["hw"] = bool(hp > ap_pts)
            g["st"] = "WIN" if norm_team(g.get("sys_win")) == aw else "LOSS"
            if g.get("f1_wtp"):
                g["fst"] = g["st"]
            if not was_done:
                updated_scores += 1

    if updated_scores > 0:
        json.dump(doc, open(m_path, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))

    sheet_synced = sync_fusion_sheets(games, args.target_date or today_utc.isoformat())

    done_auth = [g for g in games if g.get("done") and (g.get("fusion_meta") or {}).get("in_auth_overlap")]
    oos = [g for g in done_auth if (g.get("fusion_meta") or {}).get("modes", {}).get("tri_gf_ultralock", {}).get("sig")]
    oos_w = sum(1 for g in oos if norm_team(g["fusion_meta"]["modes"]["tri_gf_ultralock"]["pick"]) == norm_team(g["aw"]))
    s26 = [g for g in oos if g.get("s") == "2026-27"]
    s26_w = sum(1 for g in s26 if norm_team(g["fusion_meta"]["modes"]["tri_gf_ultralock"]["pick"]) == norm_team(g["aw"]))

    payload = {
        "ok": True,
        "updatedScores": updated_scores,
        "checkedDates": sorted_dates,
        "sheetSynced": sheet_synced,
        "totalDone": len(done_auth),
        "oosF1": {"w": oos_w, "n": len(oos), "pct": round(100.0 * oos_w / max(1, len(oos)), 1)},
        "s2627": {"w": s26_w, "n": len(s26), "pct": round(100.0 * s26_w / max(1, len(s26)), 1)},
    }
    print("__NBA_SYNC__ " + json.dumps(payload, ensure_ascii=False))

if __name__ == "__main__":
    main()
