#!/usr/bin/env python3
import os, sys, json
HERE = os.path.dirname(os.path.abspath(__file__))
PUB = "/home/runner/workspace/artifacts/calc-dashboard/public"
sys.path.insert(0, HERE)

# 1. Build history_2010_2026_base.json from Replit's nba_history_pack_2010_2026.json
hp = json.load(open(os.path.join(PUB, "nba_history_pack_2010_2026.json"), "r", encoding="utf-8"))
hist_rows = [["SEASON","DAY","DATE","ARENA","HOME","AWAY","HP","AP","MARGIN"]]
for i, r in enumerate(hp):
    hist_rows.append([str(r[2]), str(r[1]), str(r[0]), "", str(r[3]), str(r[4]), r[5], r[6], r[7]])
json.dump({"values": hist_rows}, open(os.path.join(HERE, "history_2010_2026_base.json"), "w"), ensure_ascii=False)
print("Bootstrapped history_2010_2026_base.json:", len(hist_rows)-1, "rows")

# 2. Pull NBA_SCHEDULE_2025_2027 directly from our live Google Sheet NBA-PLAYERS-GEOMANTIC-INPUT!
from _lib.sheets import open_sheet
sh = open_sheet(os.environ.get("TENNIS_PLAYERS_INPUT_SHEET_ID", ""))
ws = sh.worksheet("NBA_SCHEDULE_2025_2027")
vals = ws.get_all_values()
json.dump({"values": vals}, open(os.path.join(HERE, "schedule_2025_2027.json"), "w"), ensure_ascii=False)
print("Fetched NBA_SCHEDULE_2025_2027 from Google Sheets:", len(vals)-1, "rows")
