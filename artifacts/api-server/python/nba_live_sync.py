#!/usr/bin/env python3
"""
Live ESPN Tennis (ATP & WTA) Score Sync for TENNIS-SIGNAL-DASHBORD & TENNIS-FUSION-SIGNAL.
100% isolated from NBA/NHL endpoints and Google Sheets (TENNIS_SHEETS_WRITE_ENABLED=0).
"""
from __future__ import annotations

import argparse
import glob
import json
import os
import re
import unicodedata
import urllib.request
from datetime import datetime, timedelta, timezone


def clean_name(raw: str) -> str:
    s = unicodedata.normalize("NFKD", str(raw or ""))
    s = "".join(ch for ch in s if not unicodedata.combining(ch))
    return re.sub(r"\s+", " ", s).strip()


def format_score_p1_p2(score_wl: str, p1_won: bool) -> str:
    tokens = [t for t in str(score_wl or "").strip().split() if t]
    if p1_won:
        return " ".join(tokens)
    flipped: list[str] = []
    for tok in tokens:
        m_br = re.match(r"^\[(\d+)-(\d+)\]$", tok)
        if m_br:
            flipped.append(f"[{m_br.group(2)}-{m_br.group(1)}]")
            continue
        m_set = re.match(r"^(\d+)-(\d+)(\(\d+\))?$", tok)
        if m_set:
            tb = m_set.group(3) or ""
            flipped.append(f"{m_set.group(2)}-{m_set.group(1)}{tb}")
            continue
        flipped.append(tok)
    return " ".join(flipped)


def fetch_espn_tennis_date(tour: str, d_iso: str) -> dict[tuple[str, str], tuple[str, int, int, str]]:
    ds = d_iso.replace("-", "")
    tlc = tour.lower()
    want_slug = "mens-singles" if tlc == "atp" else "womens-singles"
    url = f"https://site.api.espn.com/apis/site/v2/sports/tennis/{tlc}/scoreboard?dates={ds}"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    data = json.loads(urllib.request.urlopen(req, timeout=12).read().decode("utf-8"))
    finals: dict[tuple[str, str], tuple[str, int, int, str]] = {}
    for ev in data.get("events", []):
        ename = str(ev.get("name") or "").strip()
        if any(bad in ename for bad in ("Davis Cup", "Billie Jean", "BJK", "Challenger", "125")):
            continue
        for grp in ev.get("groupings", []):
            if ((grp.get("grouping") or {}).get("slug") or "") != want_slug:
                continue
            for comp in grp.get("competitions", []):
                r_disp = str(((comp.get("round") or {}).get("displayName")) or "").strip()
                if "qualif" in r_disp.lower():
                    continue
                if str(comp.get("date") or "")[:10] != d_iso:
                    continue
                st_type = ((comp.get("status") or {}).get("type") or {})
                if not st_type.get("completed"):
                    continue
                st_name = str(st_type.get("name") or "").upper()
                st_desc = str(st_type.get("description") or "").upper()
                if any(x in st_desc or x in st_name for x in ("WALKOVER", "W/O", "CANCELED", "CANCELLED", "ABANDONED", "POSTPONED")):
                    continue
                is_ret = any(x in st_desc or x in st_name for x in ("RETIRED", "RET", "DEFAULT", "DEF"))
                cs = comp.get("competitors") or []
                if len(cs) != 2:
                    continue
                w_c = next((x for x in cs if x.get("winner") is True), None)
                l_c = next((x for x in cs if x is not w_c), None)
                if not w_c or not l_c:
                    continue
                wn = clean_name(((w_c.get("athlete") or {}).get("displayName")) or "")
                ln = clean_name(((l_c.get("athlete") or {}).get("displayName")) or "")
                w_raw = [s for s in (w_c.get("linescores") or []) if s.get("value") is not None]
                l_raw = [s for s in (l_c.get("linescores") or []) if s.get("value") is not None]
                if not wn or not ln or not w_raw or not l_raw or len(w_raw) != len(l_raw):
                    continue
                w_ls = [int(round(float(s.get("value", 0)))) for s in w_raw]
                l_ls = [int(round(float(s.get("value", 0)))) for s in l_raw]
                if sum(w_ls) + sum(l_ls) == 0:
                    continue
                sw = sum(1 for wg, lg in zip(w_ls, l_ls) if wg > lg)
                sl = sum(1 for wg, lg in zip(w_ls, l_ls) if lg > wg)
                if not is_ret and sw <= sl:
                    # Guard: if final set is incomplete on ESPN without STATUS_RETIRED, mark RET; otherwise skip corrupt record
                    lx, ly = w_ls[-1], l_ls[-1]
                    if max(lx, ly) < 6 and "NEXT GEN" not in ename.upper():
                        is_ret = True
                    else:
                        continue
                set_toks: list[str] = []
                for ws_obj, ls_obj, wg, lg in zip(w_raw, l_raw, w_ls, l_ls):
                    wtb = ws_obj.get("tiebreak")
                    ltb = ls_obj.get("tiebreak")
                    if wg > lg and ltb is not None:
                        set_toks.append(f"{wg}-{lg}({int(round(float(ltb)))})")
                    elif lg > wg and wtb is not None:
                        set_toks.append(f"{wg}-{lg}({int(round(float(wtb)))})")
                    else:
                        set_toks.append(f"{wg}-{lg}")
                if is_ret:
                    set_toks.append("RET")
                sc_str = " ".join(set_toks)
                w_ck = " ".join(sorted(wn.lower().replace("-", " ").split()))
                l_ck = " ".join(sorted(ln.lower().replace("-", " ").split()))
                finals[(w_ck, l_ck)] = (w_ck, sum(w_ls), sum(l_ls), sc_str)
                finals[(l_ck, w_ck)] = (w_ck, sum(w_ls), sum(l_ls), sc_str)
    return finals


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--start-date", default="")
    ap.add_argument("--end-date", default="")
    ap.add_argument("--target-date", default="")
    args = ap.parse_args()

    here = os.path.dirname(os.path.abspath(__file__))
    pub_candidates = [
        os.path.abspath(os.path.join(here, "..", "..", "calc-dashboard", "public")),
        "/home/runner/workspace/artifacts/calc-dashboard/public",
    ]
    pub_dir = next((p for p in pub_candidates if os.path.isdir(p)), pub_candidates[0])

    today_iso = datetime.now(timezone.utc).date().isoformat()
    target_d = args.target_date if len(args.target_date) == 10 else today_iso
    date_set = {target_d, today_iso}
    if len(args.start_date) == 10 and len(args.end_date) == 10 and args.start_date <= args.end_date:
        try:
            cur = datetime.fromisoformat(args.start_date).date()
            end = datetime.fromisoformat(args.end_date).date()
            while cur <= end and len(date_set) < 21:
                date_set.add(cur.isoformat())
                cur += timedelta(days=1)
        except Exception:
            pass
    dates_to_check = sorted(date_set)

    finals_by_tour: dict[str, dict[tuple[str, str], tuple[str, int, int, str]]] = {"ATP": {}, "WTA": {}}
    for tour in ("ATP", "WTA"):
        for d_iso in dates_to_check:
            try:
                finals_by_tour[tour].update(fetch_espn_tennis_date(tour, d_iso))
            except Exception:
                continue

    updated_scores = 0
    total_done = 0
    pack_files = sorted(glob.glob(os.path.join(pub_dir, "fusion_*_opt*.json")) + glob.glob(os.path.join(pub_dir, "tennis_dashbord_*_opt*.json")))
    for pf in pack_files:
        doc = json.load(open(pf, "r", encoding="utf-8"))
        games = doc.get("games") or []
        changed = False
        for g in games:
            if str(g.get("d") or "") in date_set:
                tour = str(g.get("tour") or "ATP").upper()
                h_ck = " ".join(sorted(clean_name(str(g.get("h") or "")).lower().replace("-", " ").split()))
                a_ck = " ".join(sorted(clean_name(str(g.get("a") or "")).lower().replace("-", " ").split()))
                hit = finals_by_tour.get(tour, {}).get((h_ck, a_ck))
                if hit:
                    w_ck, wg, lg, sc_s = hit
                    p1_won = bool(w_ck == h_ck)
                    resolved_winner = g["h"] if p1_won else g["a"]
                    hp = wg if p1_won else lg
                    ap_g = lg if p1_won else wg
                    sc_p1_p2 = format_score_p1_p2(sc_s, p1_won)
                    new_sc = f"{sc_p1_p2} ({hp}-{ap_g})"
                    if (not g.get("done")) or g.get("sc") != new_sc or g.get("aw") != resolved_winner:
                        g["hp"], g["ap"] = hp, ap_g
                        g["aw"] = resolved_winner
                        g["sc"] = new_sc
                        g["done"] = True
                        g["hw"] = p1_won
                        g["st"] = "WIN" if g.get("sys_win") == resolved_winner else "LOSS"
                        if g.get("f1_wtp"):
                            g["fst"] = g["st"]
                        changed = True
                        updated_scores += 1
            if g.get("done"):
                total_done += 1
        if changed:
            json.dump(doc, open(pf, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))

    payload = {
        "ok": True,
        "updatedScores": updated_scores,
        "checkedDates": dates_to_check,
        "sheetSynced": False,
        "totalDone": total_done,
        "oosF1": {"w": 0, "n": 0, "pct": 0.0},
        "s2627": {"w": 0, "n": 0, "pct": 0.0},
    }
    print("__NBA_SYNC__ " + json.dumps(payload, ensure_ascii=False))


if __name__ == "__main__":
    main()
