import os
#!/usr/bin/env python3
"""
Fetch complete NBA player rosters, jersey names, jersey numbers, injury status,
seasonal minutes/games (2009-10 through 2026-27), and 2026-27 game-by-game boxscores.
"""
import json, time, unicodedata, urllib.request
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed

t0 = time.time()

EGEM_MAP = {
    'A':1,'B':2,'C':20,'D':4,'E':5,'F':80,'G':3,'H':8,'I':10,'J':10,
    'K':20,'L':30,'M':40,'N':50,'O':70,'P':80,'Q':100,'R':200,'S':60,
    'T':400,'U':6,'V':6,'W':6,'X':70,'Y':10,'Z':7
}

LETTER_EL = {}
for ch in "EIJYOSUVW": LETTER_EL[ch] = 0 # Fire
for ch in "DGLQZ":     LETTER_EL[ch] = 1 # Air
for ch in "ACKFPMNX":  LETTER_EL[ch] = 2 # Water
for ch in "BHRT":      LETTER_EL[ch] = 3 # Earth

def clean_ascii(s):
    s = unicodedata.normalize("NFKD", str(s or ""))
    return "".join(ch for ch in s if not unicodedata.combining(ch)).strip()

def egem(s):
    return sum(EGEM_MAP.get(ch, 0) for ch in clean_ascii(s).upper())

def word_fawe(s):
    out = [0, 0, 0, 0]
    for ch in clean_ascii(s).upper():
        if ch in LETTER_EL:
            out[LETTER_EL[ch]] += 1
    return out

ESPN_ABBR_TO_CANON = {
    "ATL": ("Atlanta Hawks", "ATL"),
    "BOS": ("Boston Celtics", "BOS"),
    "BKN": ("Brooklyn Nets", "BKN"),
    "NJ":  ("Brooklyn Nets", "BKN"),
    "NJN": ("Brooklyn Nets", "BKN"),
    "CHA": ("Charlotte Hornets", "CHA"),
    "CHB": ("Charlotte Hornets", "CHA"),
    "CHI": ("Chicago Bulls", "CHI"),
    "CLE": ("Cleveland Cavaliers", "CLE"),
    "DAL": ("Dallas Mavericks", "DAL"),
    "DEN": ("Denver Nuggets", "DEN"),
    "DET": ("Detroit Pistons", "DET"),
    "GS":  ("Golden State Warriors", "GSW"),
    "GSW": ("Golden State Warriors", "GSW"),
    "HOU": ("Houston Rockets", "HOU"),
    "IND": ("Indiana Pacers", "IND"),
    "LAC": ("Los Angeles Clippers", "LAC"),
    "LAL": ("Los Angeles Lakers", "LAL"),
    "MEM": ("Memphis Grizzlies", "MEM"),
    "MIA": ("Miami Heat", "MIA"),
    "MIL": ("Milwaukee Bucks", "MIL"),
    "MIN": ("Minnesota Timberwolves", "MIN"),
    "NO":  ("New Orleans Pelicans", "NOP"),
    "NOP": ("New Orleans Pelicans", "NOP"),
    "NOH": ("New Orleans Pelicans", "NOP"),
    "NY":  ("New York Knicks", "NYK"),
    "NYK": ("New York Knicks", "NYK"),
    "OKC": ("Oklahoma City Thunder", "OKC"),
    "ORL": ("Orlando Magic", "ORL"),
    "PHI": ("Philadelphia 76ers", "PHI"),
    "PHX": ("Phoenix Suns", "PHX"),
    "POR": ("Portland Trail Blazers", "POR"),
    "SAC": ("Sacramento Kings", "SAC"),
    "SA":  ("San Antonio Spurs", "SAS"),
    "SAS": ("San Antonio Spurs", "SAS"),
    "TOR": ("Toronto Raptors", "TOR"),
    "UTAH":("Utah Jazz", "UTA"),
    "UTA": ("Utah Jazz", "UTA"),
    "WSH": ("Washington Wizards", "WAS"),
    "WAS": ("Washington Wizards", "WAS"),
}

HIST_TEAM_NORM = {
    "LA Clippers": "Los Angeles Clippers",
    "New Jersey Nets": "Brooklyn Nets",
    "Charlotte Bobcats": "Charlotte Hornets",
    "New Orleans Hornets": "New Orleans Pelicans",
}

def norm_team(name):
    s = str(name or "").strip()
    return HIST_TEAM_NORM.get(s, s)

def fetch_json(url, retries=2):
    for attempt in range(retries + 1):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            raw = urllib.request.urlopen(req, timeout=12).read().decode("utf-8")
            return json.loads(raw)
        except Exception:
            if attempt == retries:
                return None
            time.sleep(0.25 * (attempt + 1))
    return None

# 1. Fetch all 30 live team rosters (exact current jersey numbers + injury status)
teams_meta = fetch_json("https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams")
espn_teams = [t["team"] for t in teams_meta["sports"][0]["leagues"][0]["teams"]]
print(f"[1/4] Fetching 30 live NBA rosters...")

live_rosters = {}      # canon_team -> list of player dicts
player_master = {}     # pid -> master dict (full_name, jersey_name, jersey, pos, injury_status)

def fetch_one_roster(tm_obj):
    tid = tm_obj["id"]
    abbr = tm_obj["abbreviation"].upper()
    canon_name, canon_code = ESPN_ABBR_TO_CANON.get(abbr, (norm_team(tm_obj["displayName"]), abbr))
    d = fetch_json(f"https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/{tid}/roster")
    out = []
    for a in (d or {}).get("athletes", []):
        pid = str(a.get("id", ""))
        if not pid:
            continue
        full_name = clean_ascii(a.get("fullName") or a.get("displayName") or "")
        last_name = clean_ascii(a.get("lastName") or "")
        if not last_name and full_name:
            last_name = full_name.split()[-1]
        jersey_str = str(a.get("jersey") or "").strip()
        pos = (a.get("position") or {}).get("abbreviation", "")
        injs = a.get("injuries") or []
        inj_status = str(injs[0].get("status", "Healthy")) if injs else "Healthy"
        inj_detail = str((injs[0].get("details") or {}).get("type", "")) if injs else ""
        rec = {
            "pid": pid,
            "full_name": full_name,
            "jersey_name": last_name,
            "jersey": jersey_str,
            "pos": pos,
            "team": canon_name,
            "team_code": canon_code,
            "status": inj_status,
            "injury_detail": inj_detail,
        }
        out.append(rec)
    return canon_name, out

with ThreadPoolExecutor(max_workers=15) as ex:
    for cname, plist in ex.map(fetch_one_roster, espn_teams):
        live_rosters[cname] = plist
        for p in plist:
            player_master[p["pid"]] = p.copy()

print(f"  Live rosters loaded: {len(live_rosters)} teams, {len(player_master)} active players ({time.time()-t0:.1f}s)")

# 2. Fetch seasonal athlete stats for ESPN seasons 2010..2027 (corresponding to 2009-10 .. 2026-27)
print("[2/4] Fetching seasonal player stats 2009-10..2026-27 (seasons 2010..2027)...")

def season_label_from_espn_yr(yr):
    return f"{yr-1}-{str(yr)[-2:]}"

def fetch_season_stats(yr):
    s_lbl = season_label_from_espn_yr(yr)
    base_u = f"https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/statistics/byathlete?region=us&lang=en&contentorigin=espn&isqualified=false&limit=100&season={yr}&seasontype=2"
    d1 = fetch_json(base_u + "&page=1")
    if not d1:
        return s_lbl, []
    pages = int((d1.get("pagination") or {}).get("pages", 1))
    all_aths = list(d1.get("athletes") or [])
    for pg in range(2, pages + 1):
        dp = fetch_json(base_u + f"&page={pg}")
        if dp and dp.get("athletes"):
            all_aths.extend(dp["athletes"])
    parsed = []
    for item in all_aths:
        ath = item.get("athlete") or {}
        pid = str(ath.get("id", ""))
        if not pid:
            continue
        full_name = clean_ascii(ath.get("displayName") or ath.get("fullName") or "")
        last_name = clean_ascii(ath.get("lastName") or "")
        if not last_name and full_name:
            last_name = full_name.split()[-1]
        pos = (ath.get("position") or {}).get("abbreviation", "")
        gp, mpg, tot_min, ppg = 0, 0.0, 0.0, 0.0
        for cat in (item.get("categories") or []):
            vals = cat.get("values") or []
            if cat.get("name") == "general" and len(vals) >= 9:
                gp = int(round(vals[0]))
                mpg = round(float(vals[1]), 2)
                tot_min = round(float(vals[8]), 1)
            elif cat.get("name") == "offensive" and len(vals) >= 1:
                ppg = round(float(vals[0]), 2)
        teams_arr = ath.get("teams") or []
        t_codes = []
        for t_obj in teams_arr:
            ab = str(t_obj.get("abbreviation") or "").upper()
            if ab in ESPN_ABBR_TO_CANON:
                t_codes.append(ESPN_ABBR_TO_CANON[ab])
        if not t_codes:
            ab = str(ath.get("teamShortName") or "").upper()
            if ab in ESPN_ABBR_TO_CANON:
                t_codes.append(ESPN_ABBR_TO_CANON[ab])
        for cname, ccode in t_codes:
            parsed.append({
                "pid": pid,
                "season": s_lbl,
                "team": cname,
                "team_code": ccode,
                "full_name": full_name,
                "jersey_name": last_name,
                "pos": pos,
                "gp": gp,
                "mpg": mpg,
                "tot_min": tot_min / max(1, len(t_codes)),
                "ppg": ppg,
            })
    return s_lbl, parsed

season_team_players = defaultdict(list)  # (season, team) -> sorted list of players
all_season_rows = []

with ThreadPoolExecutor(max_workers=9) as ex:
    for s_lbl, rows in ex.map(fetch_season_stats, range(2010, 2028)):
        all_season_rows.extend(rows)
        for r in rows:
            season_team_players[(r["season"], r["team"])].append(r)

# Sort each (season, team) by total minutes + mpg descending and keep top 10 rotation players for jersey lookup
need_jersey_pids = set()
for key, lst in season_team_players.items():
    lst.sort(key=lambda x: (x["tot_min"], x["mpg"], x["ppg"]), reverse=True)
    for r in lst[:10]:
        pid = r["pid"]
        if pid not in player_master:
            player_master[pid] = {
                "pid": pid,
                "full_name": r["full_name"],
                "jersey_name": r["jersey_name"],
                "jersey": "",
                "pos": r["pos"],
                "team": r["team"],
                "team_code": r["team_code"],
                "status": "Historical",
                "injury_detail": "",
            }
        if not player_master[pid].get("jersey"):
            need_jersey_pids.add(pid)

print(f"  Seasonal rows: {len(all_season_rows)} across {len(season_team_players)} team-seasons. Missing jersey PIDs to fetch: {len(need_jersey_pids)} ({time.time()-t0:.1f}s)")

# 3. Fetch jersey numbers for historical rotation players via ESPN common/v3/athletes/{pid}
print(f"[3/4] Fetching jersey numbers for {len(need_jersey_pids)} historical rotation players...")
def fetch_ath_jersey(pid):
    d = fetch_json(f"https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/athletes/{pid}", retries=1)
    ath = (d or {}).get("athlete") or {}
    j = str(ath.get("jersey") or "").strip()
    fn = clean_ascii(ath.get("fullName") or ath.get("displayName") or "")
    ln = clean_ascii(ath.get("lastName") or "")
    return pid, j, fn, ln

with ThreadPoolExecutor(max_workers=32) as ex:
    for pid, j, fn, ln in ex.map(fetch_ath_jersey, sorted(need_jersey_pids)):
        if j:
            player_master[pid]["jersey"] = j
        if fn and len(fn) > len(player_master[pid]["full_name"]):
            player_master[pid]["full_name"] = fn
        if ln and not player_master[pid]["jersey_name"]:
            player_master[pid]["jersey_name"] = ln

missing_j = sum(1 for pid in need_jersey_pids if not player_master[pid].get("jersey"))
print(f"  Historical jerseys resolved! Remaining without jersey: {missing_j}/{len(need_jersey_pids)} ({time.time()-t0:.1f}s)")

# 4. Fetch 2026-27 live season scoreboards + boxscores (2026-10-20 through 2026-11-16)
print("[4/4] Fetching 2026-27 game scoreboards & player boxscores...")
import datetime
start_d = datetime.date(2026, 10, 20)
end_d = datetime.date(2026, 11, 16)
dates_2627 = [(start_d + datetime.timedelta(days=i)) for i in range((end_d - start_d).days + 1)]

def fetch_sb_day(dt_obj):
    ymd = dt_obj.strftime("%Y%m%d")
    d_iso = dt_obj.isoformat()
    d = fetch_json(f"https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates={ymd}")
    evts = []
    for ev in (d or {}).get("events", []):
        eid = str(ev.get("id", ""))
        st_type = (ev.get("status") or {}).get("type") or {}
        completed = bool(st_type.get("completed"))
        comps = (ev.get("competitions") or [{}])[0]
        competitors = comps.get("competitors") or []
        hc = next((c for c in competitors if c.get("homeAway") == "home"), None)
        ac = next((c for c in competitors if c.get("homeAway") == "away"), None)
        if not hc or not ac:
            continue
        hab = str((hc.get("team") or {}).get("abbreviation", "")).upper()
        aab = str((ac.get("team") or {}).get("abbreviation", "")).upper()
        h_name = ESPN_ABBR_TO_CANON.get(hab, (norm_team((hc.get("team") or {}).get("displayName", "")), hab))[0]
        a_name = ESPN_ABBR_TO_CANON.get(aab, (norm_team((ac.get("team") or {}).get("displayName", "")), aab))[0]
        hp = int(hc.get("score") or 0) if completed else 0
        ap = int(ac.get("score") or 0) if completed else 0
        evts.append({
            "eid": eid, "d": d_iso, "completed": completed,
            "h": h_name, "a": a_name, "hp": hp, "ap": ap
        })
    return evts

events_2627 = []
with ThreadPoolExecutor(max_workers=14) as ex:
    for ev_list in ex.map(fetch_sb_day, dates_2627):
        events_2627.extend(ev_list)

completed_evts = [e for e in events_2627 if e["completed"]]
print(f"  Found {len(events_2627)} events in 2026-10-20..11-16 ({len(completed_evts)} completed). Fetching boxscores...")

def fetch_box(ev):
    eid = ev["eid"]
    d = fetch_json(f"https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event={eid}")
    bx_teams = ((d or {}).get("boxscore") or {}).get("players") or []
    team_players = {}
    for bt in bx_teams:
        ab = str((bt.get("team") or {}).get("abbreviation", "")).upper()
        tname = ESPN_ABBR_TO_CANON.get(ab, (norm_team((bt.get("team") or {}).get("displayName", "")), ab))[0]
        stats_arr = bt.get("statistics") or []
        if not stats_arr:
            continue
        labels = stats_arr[0].get("labels") or []
        min_idx = labels.index("MIN") if "MIN" in labels else 0
        pts_idx = labels.index("PTS") if "PTS" in labels else 1
        plist = []
        for row in (stats_arr[0].get("athletes") or []):
            if row.get("didNotPlay"):
                continue
            ath = row.get("athlete") or {}
            pid = str(ath.get("id", ""))
            st_vals = row.get("stats") or []
            if not pid or not st_vals:
                continue
            m_raw = str(st_vals[min_idx] if min_idx < len(st_vals) else "0")
            try:
                mins = float(m_raw.split(":")[0]) if ":" in m_raw else float(m_raw)
            except Exception:
                mins = 0.0
            if mins <= 0:
                continue
            try:
                pts = int(st_vals[pts_idx]) if pts_idx < len(st_vals) else 0
            except Exception:
                pts = 0
            fn = clean_ascii(ath.get("displayName") or ath.get("fullName") or "")
            ln = clean_ascii(ath.get("lastName") or "")
            if not ln and fn:
                ln = fn.split()[-1]
            j = str(ath.get("jersey") or "").strip()
            if pid not in player_master:
                player_master[pid] = {
                    "pid": pid, "full_name": fn, "jersey_name": ln, "jersey": j,
                    "pos": "", "team": tname, "team_code": ab, "status": "Healthy", "injury_detail": ""
                }
            elif j and not player_master[pid].get("jersey"):
                player_master[pid]["jersey"] = j
            plist.append({
                "pid": pid, "starter": bool(row.get("starter")),
                "min": mins, "pts": pts, "jersey": j or player_master[pid].get("jersey", "")
            })
        plist.sort(key=lambda x: (x["starter"], x["min"]), reverse=True)
        team_players[tname] = plist
    return eid, {"d": ev["d"], "h": ev["h"], "a": ev["a"], "hp": ev["hp"], "ap": ev["ap"], "box": team_players}

boxscores_2627 = {}
with ThreadPoolExecutor(max_workers=24) as ex:
    for eid, bobj in ex.map(fetch_box, completed_evts):
        boxscores_2627[eid] = bobj

# Attach resolved jersey numbers onto season_team_players
serializable_stp = {}
for (s_lbl, tname), lst in season_team_players.items():
    enriched = []
    for r in lst[:12]:
        pm = player_master.get(r["pid"], {})
        r2 = dict(r)
        r2["jersey"] = pm.get("jersey", "")
        r2["full_name"] = pm.get("full_name") or r["full_name"]
        r2["jersey_name"] = pm.get("jersey_name") or r["jersey_name"]
        enriched.append(r2)
    serializable_stp[f"{s_lbl}||{tname}"] = enriched

out_bundle = {
    "player_master": player_master,
    "live_rosters": live_rosters,
    "season_team_players": serializable_stp,
    "events_2627": events_2627,
    "boxscores_2627": boxscores_2627,
}
open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "nba_players_2010_2027.json"), "w").write(json.dumps(out_bundle, ensure_ascii=False))
print(f"DONE in {time.time()-t0:.1f}s! Saved nba_players_2010_2027.json: {len(player_master)} master players, {len(boxscores_2627)} 2026-27 boxscores.")
