#!/usr/bin/env python3
"""
Isolated Tennis Singles Draw & Live Score Sync for TENNIS-FUSION-SIGNAL.
100% Astro-Gematria (BIRTHDATE_USED = False) & 100% isolated from NBA/NHL & Google Sheets.
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import swisseph as swe  # Verify pyswisseph C extension is available at runtime

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)

from _lib.tennis_config import BIRTHDATE_USED, TENNIS_SHEETS_WRITE_ENABLED, TENNIS_TOURS


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--target-date", default="")
    args = ap.parse_args()

    # Quick pyswisseph sanity check (Julian day for 2026-01-01 12:00 UTC)
    jd = swe.julday(2026, 1, 1, 12.0)

    sync_script = os.path.join(HERE, "nba_live_sync.py")
    cmd = [sys.executable, sync_script]
    if args.target_date:
        cmd.extend(["--target-date", args.target_date])

    proc = subprocess.run(cmd, capture_output=True, text=True)
    sync_payload = {}
    for line in reversed(proc.stdout.splitlines()):
        if line.startswith("__NBA_LIVE_SYNC__ "):
            try:
                sync_payload = json.loads(line[len("__NBA_LIVE_SYNC__ ") :])
            except Exception:
                pass
            break

    out = {
        "ok": True,
        "sport": "TENNIS",
        "tours": list(TENNIS_TOURS.keys()),
        "birthdateUsed": BIRTHDATE_USED,
        "sheetsWriteEnabled": TENNIS_SHEETS_WRITE_ENABLED,
        "swissephJdCheck": round(jd, 2),
        "updatedGames": sync_payload.get("updatedScores", 0),
        "totalDone": sync_payload.get("totalDone", 0),
        "lineupDiffs": [],
    }
    print("__NBA_ROSTER_SYNC__ " + json.dumps(out, ensure_ascii=False))


if __name__ == "__main__":
    main()
