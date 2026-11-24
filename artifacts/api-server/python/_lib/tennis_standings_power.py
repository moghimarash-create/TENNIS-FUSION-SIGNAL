"""
Zero-Lookahead Season/52-Week Standings, Surface Games Pythagorean (k=3.5),
Standings Quartile Elements (FIRE/AIR/WATER/EARTH), Last-10 Form, Rookie Shrinkage,
Early-Month / Jan 1-7 / ATP-WTA 250 / Finals Protective Shields & Symmetric Neutral-Court
3-Way Power Profiles (c_vol, b_pure, a_elo) for TENNIS-FUSION-SIGNAL.

100% Birthdate-Free (BIRTHDATE_USED = False) & 100% Zero-Lookahead (r.date < match.date).
"""
from __future__ import annotations

import datetime
import re
from collections import defaultdict
from typing import Any

_GD10_RE = re.compile(r"\(([+-]?\d+(?:\.\d+)?)\)")
_L10_W_RE = re.compile(r"^(\d+)-(\d+)")


def parse_gd10_from_l10(s: str) -> float:
    m = _GD10_RE.search(str(s or ""))
    return float(m.group(1)) if m else 0.0


def parse_l10_wins(s: str) -> int:
    m = _L10_W_RE.match(str(s or "").strip())
    return int(m.group(1)) if m else 0


def log5(pa: float, pb: float) -> float:
    pa = min(0.99, max(0.01, float(pa)))
    pb = min(0.99, max(0.01, float(pb)))
    num = pa * (1.0 - pb)
    den = num + pb * (1.0 - pa)
    return num / den if den > 0 else 0.5


def pyth_games(gw: float, gl: float, k: float = 3.5, prior_g: float = 55.0, prior_rate: float = 0.49) -> float:
    w = float(gw) + prior_g * prior_rate
    l = float(gl) + prior_g * (1.0 - prior_rate)
    if w <= 0 and l <= 0:
        return 0.5
    wk = w ** k
    lk = l ** k
    return wk / (wk + lk)


def stretch_prob(p01: float, gamma: float) -> float:
    p01 = min(0.995, max(0.005, float(p01)))
    a = p01 ** gamma
    b = (1.0 - p01) ** gamma
    return a / (a + b)


def matchup_elem(l5_pick_pct: float) -> str:
    if l5_pick_pct >= 64.0:
        return "FIRE"
    if l5_pick_pct >= 54.0:
        return "AIR"
    if l5_pick_pct >= 45.0:
        return "WATER"
    return "EARTH"


def dominant_elem_info(vec: list[int] | tuple[int, ...]) -> tuple[str, int, bool]:
    names = ("FIRE", "AIR", "WATER", "EARTH")
    mx = max(vec) if vec else 0
    if mx <= 0:
        return "—", 0, True
    winners = [names[i] for i in range(4) if vec[i] == mx]
    if len(winners) == 1:
        return winners[0], mx, False
    return f"TIE({'+'.join(w[0] for w in winners)})", mx, True


def classify_tourney_tier(tname: str) -> str:
    u = str(tname or "").upper()
    if any(x in u for x in ("AUSTRALIAN OPEN", "ROLAND GARROS", "FRENCH OPEN", "WIMBLEDON", "US OPEN")):
        return "SLAM"
    if any(x in u for x in ("FINALS", "UNITED CUP", "OLYMPIC")):
        return "FINALS"
    if any(
        x in u
        for x in (
            "INDIAN WELLS", "MIAMI", "MONTE CARLO", "MONTE-CARLO", "MADRID", "ROME", "INTERNAZIONALI",
            "CANADA", "MONTREAL", "TORONTO", "CINCINNATI", "SHANGHAI", "PARIS", "WUHAN", "DOHA", "DUBAI",
            "BEIJING", "GUADALAJARA",
        )
    ):
        return "1000"
    if any(
        x in u
        for x in (
            "ROTTERDAM", "RIO", "ACAPULCO", "BARCELONA", "HALLE", "QUEEN", "HAMBURG", "WASHINGTON",
            "TOKYO", "VIENNA", "BASEL", "LINZ", "STUTTGART", "CHARLESTON", "BERLIN", "EASTBOURNE",
            "SAN DIEGO", "MONTERREY", "SEOUL", "NINGBO", "ZHENGZHOU", "STRASBOURG", "BAD HOMBURG",
            "BRISBANE", "ADELAIDE", "DALLAS", "MUNICH",
        )
    ):
        return "500"
    return "250"


class TennisStandingsTracker:
    """Strictly Zero-Lookahead per-tour Standings, Surface Games Pythagorean & Tournament Context tracker."""

    def __init__(self, tour: str) -> None:
        self.tour = tour.upper()
        # Per-player chronological list of (date_obj, season_str, surface_str, tourney_str, won_bool, g_won, g_lost)
        self.hist_log: dict[str, list[tuple[datetime.date, str, str, str, bool, int, int]]] = defaultdict(list)
        self._cur_date: str | None = None
        self._day_cache: dict[str, dict[str, Any]] = {}
        self._rank_map: dict[str, int] = {}
        self._n_act: int = 0

    def commit_match(
        self,
        d_iso: str,
        season: str,
        surface: str,
        w_name: str,
        l_name: str,
        w_g: int,
        l_g: int,
        tourney: str = "",
    ) -> None:
        dt = datetime.date.fromisoformat(d_iso)
        t_str = str(tourney or "")
        self.hist_log[w_name].append((dt, str(season), str(surface), t_str, True, int(w_g), int(l_g)))
        self.hist_log[l_name].append((dt, str(season), str(surface), t_str, False, int(l_g), int(w_g)))

    def begin_date(self, d_iso: str) -> None:
        if self._cur_date == d_iso:
            return
        self._cur_date = d_iso
        self._day_cache.clear()
        dt = datetime.date.fromisoformat(d_iso)
        cut_365 = dt - datetime.timedelta(days=365)

        standings_scores: dict[str, float] = {}
        for pl, lg in self.hist_log.items():
            if len(lg) >= 6 and lg[-6][0] >= cut_365:
                st = self.get_player_snapshot(pl, d_iso)
                standings_scores[pl] = st["st_sc"]

        s_act = sorted(standings_scores.keys(), key=lambda p: standings_scores[p], reverse=True)
        self._n_act = len(s_act)
        self._rank_map = {p: idx + 1 for idx, p in enumerate(s_act)}

    def get_player_snapshot(self, pl: str, d_iso: str) -> dict[str, Any]:
        if self._cur_date != d_iso:
            self.begin_date(d_iso)
        cached = self._day_cache.get(pl)
        if cached is not None:
            return cached

        dt = datetime.date.fromisoformat(d_iso)
        cut_365 = dt - datetime.timedelta(days=365)
        cut_730 = dt - datetime.timedelta(days=730)
        cur_s = str(dt.year)

        lg = self.hist_log.get(pl, [])
        ytd = [x for x in lg if x[1] == cur_s]
        w365 = [x for x in lg if x[0] >= cut_365]
        w730 = [x for x in lg if x[0] >= cut_730]
        l10 = lg[-10:]

        n_ytd = len(ytd)
        w_ytd = sum(1 for x in ytd if x[4])
        gw_ytd = sum(x[5] for x in ytd)
        gl_ytd = sum(x[6] for x in ytd)

        n_365 = len(w365)
        w_365 = sum(1 for x in w365 if x[4])
        gw_365 = sum(x[5] for x in w365)
        gl_365 = sum(x[6] for x in w365)

        p_ytd = (w_ytd + 6.0 * 0.48) / (n_ytd + 6.0)
        p_365 = (w_365 + 10.0 * 0.47) / (n_365 + 10.0)
        if n_ytd == 0:
            a_ytd = 0.0
        elif n_ytd <= 8:
            a_ytd = 0.50 * (n_ytd / 8.0)
        else:
            a_ytd = min(0.72, 0.55 + 0.17 * min(1.0, (n_ytd - 8.0) / 18.0))

        wl_b = a_ytd * p_ytd + (1.0 - a_ytd) * p_365
        py_all = (
            a_ytd * pyth_games(gw_ytd, gl_ytd, 3.5, 55.0, 0.49)
            + (1.0 - a_ytd) * pyth_games(gw_365, gl_365, 3.5, 80.0, 0.485)
        )

        sf_map: dict[str, float] = {}
        for sf in ("Hard", "Clay", "Grass"):
            s365 = [x for x in w365 if x[2] == sf]
            s730 = [x for x in w730 if x[2] == sf]
            ps1 = pyth_games(sum(x[5] for x in s365), sum(x[6] for x in s365), 3.5, 55.0, 0.49)
            ps2 = pyth_games(sum(x[5] for x in s730), sum(x[6] for x in s730), 3.5, 75.0, 0.49)
            ws = min(0.65, 0.08 * len(s730))
            sf_map[sf] = ws * (0.65 * ps1 + 0.35 * ps2) + (1.0 - ws) * py_all

        n10 = len(l10)
        w10 = sum(1 for x in l10 if x[4])
        gw10 = sum(x[5] for x in l10)
        gl10 = sum(x[6] for x in l10)
        p10_wl = (w10 + 4.0 * 0.48) / (n10 + 4.0)
        p10_py = pyth_games(gw10, gl10, 3.5, 40.0, 0.49)
        p10_c = 0.50 * p10_wl + 0.50 * p10_py
        gdiff10 = round((gw10 - gl10) / max(1, n10), 1)
        last_w = bool(lg[-1][4]) if lg else False
        last_surf = str(lg[-1][2]) if lg else None
        days_rest = (dt - lg[-1][0]).days if lg else 999

        st_sc = 0.55 * wl_b + 0.45 * py_all + 0.03 * min(1.0, n_365 / 25.0) * (wl_b - 0.50)

        snap = {
            "n_ytd": n_ytd,
            "w_ytd": w_ytd,
            "l_ytd": n_ytd - w_ytd,
            "n_365": n_365,
            "w_365": w_365,
            "l_365": n_365 - w_365,
            "wl_b": wl_b,
            "py_all": py_all,
            "sf": sf_map,
            "n10": n10,
            "w10": w10,
            "l10": n10 - w10,
            "p10_c": p10_c,
            "gdiff10": gdiff10,
            "last_w": last_w,
            "last_surf": last_surf,
            "days_rest": days_rest,
            "st_sc": st_sc,
            "recent_ev": lg[-8:],
        }
        self._day_cache[pl] = snap
        return snap

    def get_elem_and_rank(self, pl: str, d_iso: str) -> tuple[str, int, int]:
        if self._cur_date != d_iso:
            self.begin_date(d_iso)
        rk = self._rank_map.get(pl, 0)
        if rk == 0 or self._n_act == 0:
            return "EARTH", 999, self._n_act
        q = (rk - 1) / self._n_act
        el = "FIRE" if q < 0.25 else ("AIR" if q < 0.50 else ("WATER" if q < 0.75 else "EARTH"))
        return el, rk, self._n_act

    def compute_match_fields(
        self,
        d_iso: str,
        surface: str,
        h: str,
        a: str,
        elo_wtp: dict[str, Any],
        tourney: str = "",
        rnd: str = "R32",
    ) -> tuple[dict[str, Any], dict[str, dict[str, Any]]]:
        """Returns compact (st_meta, pwr_p) for match h vs a strictly prior to d_iso."""
        self.begin_date(d_iso)
        sh = self.get_player_snapshot(h, d_iso)
        sa = self.get_player_snapshot(a, d_iso)
        elh, rkh, n_act = self.get_elem_and_rank(h, d_iso)
        ela, rka, _ = self.get_elem_and_rank(a, d_iso)
        sf = surface if surface in ("Hard", "Clay", "Grass") else "Hard"

        return build_st_and_profiles_from_snaps(
            sh, sa, elh, ela, rkh, rka, n_act, sf, elo_wtp, d_iso=d_iso, tourney=tourney, rnd=rnd
        )

    def export_live_snapshot(self, ref_date_iso: str) -> dict[str, Any]:
        """Exports compact latest player standings dictionary for live ESPN sync."""
        self.begin_date(ref_date_iso)
        players_out: dict[str, Any] = {}
        for pl in self.hist_log.keys():
            s = self.get_player_snapshot(pl, ref_date_iso)
            el, rk, _ = self.get_elem_and_rank(pl, ref_date_iso)
            players_out[pl] = {
                "n_ytd": s["n_ytd"], "w_ytd": s["w_ytd"], "l_ytd": s["l_ytd"],
                "n_365": s["n_365"], "w_365": s["w_365"], "l_365": s["l_365"],
                "wl_b": round(s["wl_b"], 4),
                "sf": {k: round(v, 4) for k, v in s["sf"].items()},
                "w10": s["w10"], "l10": s["l10"],
                "p10_c": round(s["p10_c"], 4),
                "gdiff10": s["gdiff10"],
                "last_w": s["last_w"],
                "last_surf": s["last_surf"],
                "days_rest": s["days_rest"],
                "el": el, "rk": rk,
            }
        return {"tour": self.tour, "refDate": ref_date_iso, "nAct": self._n_act, "players": players_out}


def build_st_and_profiles_from_snaps(
    sh: dict[str, Any],
    sa: dict[str, Any],
    elh: str,
    ela: str,
    rkh: int,
    rka: int,
    n_act: int,
    sf: str,
    elo_wtp: dict[str, Any],
    d_iso: str = "",
    tourney: str = "",
    rnd: str = "R32",
) -> tuple[dict[str, Any], dict[str, dict[str, Any]]]:
    mo, dy, yr_s = 6, 15, ""
    dt_cur: datetime.date | None = None
    if len(d_iso) >= 10:
        try:
            dt_cur = datetime.date.fromisoformat(d_iso[:10])
            mo, dy, yr_s = dt_cur.month, dt_cur.day, str(dt_cur.year)
        except Exception:
            pass

    # 1. Rookie / Small-Sample Shrinkage toward neutral tour prior when n_365 < 14
    n365_h = int(sh.get("n_365", 0))
    n365_a = int(sa.get("n_365", 0))
    raw_sf_h = float(sh["sf"][sf])
    raw_sf_a = float(sa["sf"][sf])
    sf_h = raw_sf_h if n365_h >= 14 else ((n365_h / 14.0) * raw_sf_h + (1.0 - n365_h / 14.0) * 0.485)
    sf_a = raw_sf_a if n365_a >= 14 else ((n365_a / 14.0) * raw_sf_a + (1.0 - n365_a / 14.0) * 0.485)
    wl_h = float(sh["wl_b"]) if n365_h >= 14 else ((n365_h / 14.0) * float(sh["wl_b"]) + (1.0 - n365_h / 14.0) * 0.48)
    wl_a = float(sa["wl_b"]) if n365_a >= 14 else ((n365_a / 14.0) * float(sa["wl_b"]) + (1.0 - n365_a / 14.0) * 0.48)

    # 2. Early-January (Jan 1-7) & Off-Season (>30d rest with 0 YTD matches) Cold-Reset Dampener
    rest_h = int(sh.get("days_rest", 14))
    rest_a = int(sa.get("days_rest", 14))
    p10_h = float(sh.get("p10_c", 0.49))
    p10_a = float(sa.get("p10_c", 0.49))
    if (mo == 1 and dy <= 7) or (int(sh.get("n_ytd", 0)) == 0 and rest_h >= 30):
        p10_h = 0.40 * p10_h + 0.60 * 0.49
    if (mo == 1 and dy <= 7) or (int(sa.get("n_ytd", 0)) == 0 and rest_a >= 30):
        p10_a = 0.40 * p10_a + 0.60 * 0.49

    gdiff10_h = float(sh.get("gdiff10", 0.0))
    gdiff10_a = float(sa.get("gdiff10", 0.0))

    # Prior wins & game-diff in the current tournament strictly before d_iso
    ev_wh, ev_wa, ev_gdh, ev_gda = 0, 0, 0, 0
    if dt_cur is not None and tourney:
        for r_ev in sh.get("recent_ev") or ():
            if r_ev[1] == yr_s and r_ev[3] == tourney and (dt_cur - r_ev[0]).days <= 16:
                if r_ev[4]:
                    ev_wh += 1
                ev_gdh += int(r_ev[5]) - int(r_ev[6])
        for r_ev in sa.get("recent_ev") or ():
            if r_ev[1] == yr_s and r_ev[3] == tourney and (dt_cur - r_ev[0]).days <= 16:
                if r_ev[4]:
                    ev_wa += 1
                ev_gda += int(r_ev[5]) - int(r_ev[6])

    # 3. Pure NBA-Style Table + Surface Games Pyth (b_pure: 75% SurfPyth + 15% Standings W-L + 10% L10)
    raw_b_h = 0.75 * sf_h + 0.15 * wl_h + 0.10 * p10_h
    raw_b_a = 0.75 * sf_a + 0.15 * wl_a + 0.10 * p10_a
    hp_b = 100.0 * stretch_prob(raw_b_h, 1.35)
    ap_b = 100.0 * stretch_prob(raw_b_a, 1.35)
    l5_b = 100.0 * log5(hp_b / 100.0, ap_b / 100.0)

    # 4. Calibrated Neutral-Court Hybrid c_vol (Season Standings + Surface Pyth + Smart Shields)
    raw_c_h = 0.70 * sf_h + 0.20 * wl_h + 0.10 * p10_h
    raw_c_a = 0.70 * sf_a + 0.20 * wl_a + 0.10 * p10_a
    pure_p01 = log5(raw_c_h, raw_c_a)
    pure_l5h = 100.0 * pure_p01
    pure_l5a = 100.0 - pure_l5h

    elo_hpct = float(elo_wtp.get("hpct", 50.0))
    elo_apct = float(elo_wtp.get("apct", 50.0))
    elo_l5h = float(elo_wtp.get("l5h", 50.0))
    elo_hel = str(elo_wtp.get("hel", "AIR"))
    elo_ael = str(elo_wtp.get("ael", "AIR"))

    # Neutral-Court P2 Unlock: when P2 genuinely dominates Season Standings + Surface Pyth + L10,
    # remove stale 8-year Career Elo anchor so breakout P2 contenders are evaluated purely on current dominance!
    p2_dom = (pure_l5a >= 62.0 and sf_a >= 0.56 and gdiff10_a >= 0.8 and p10_a > p10_h)
    w_e = 0.0 if p2_dom else 0.40
    hp_c = w_e * elo_hpct + (1.0 - w_e) * (100.0 * stretch_prob(raw_c_h, 1.85))
    ap_c = w_e * elo_apct + (1.0 - w_e) * (100.0 * stretch_prob(raw_c_a, 1.85))
    l5_c = w_e * elo_l5h + (1.0 - w_e) * (100.0 * stretch_prob(pure_p01, 1.85 if p2_dom else 1.70))

    t_tier = classify_tourney_tier(tourney) if tourney else "500"
    rnd_u = str(rnd or "R32").upper()
    last_sf_h = sh.get("last_surf")
    last_sf_a = sa.get("last_surf")
    surf_sw_h = (last_sf_h is not None and last_sf_h != sf)
    surf_sw_a = (last_sf_a is not None and last_sf_a != sf)

    def calc_smart_shield(
        is_p2: bool,
        pure_x: float,
        elo_x: float,
        sfx: float,
        gdx: float,
        gdy: float,
        n365x: int,
        n365y: int,
        last_wx: bool,
        last_wy: bool,
        p10x: float,
        p10y: float,
        restx: int,
        sw_x: bool,
        sw_y: bool,
        ev_wx: int,
        ev_wy: int,
        ev_gdx: int,
        ev_gdy: int,
    ) -> int:
        # Neutral-court P2 picks require verified season + surface dominance (blocks coin-flip P2 noise)
        if is_p2 and not (pure_x >= 60.0 and sfx >= 0.55 and gdx >= 0.5 and p10x > p10y):
            return 2
        # Core Surface Competence, Negative L10 Form & Small-Sample Rookie Shield
        if pure_x < 51.5 or sfx < 0.505:
            return 2
        if gdx < -0.5 and gdy >= 0.0 and pure_x < 62.0:
            return 2
        if n365x < 12 and n365y >= 20 and pure_x < 65.0:
            return 2
        if (elo_x - pure_x) >= 16.0 and (((not last_wx) and last_wy) or p10x < p10y):
            return 2
        # Shield A: Finals / Semifinals Hot-Opponent Guard
        if rnd_u in ("F", "SF"):
            if rnd_u == "F" and (pure_x < 58.0 or sfx < 0.56 or gdx < gdy - 0.5):
                return 2
            if ev_wy >= 3 and ev_gdy >= ev_gdx + 4 and pure_x < 61.0:
                return 2
        # Shield B: ATP/WTA 250 Low-Stakes, Bye-Rust & Surface-Switch Guard
        if t_tier == "250":
            if sfx < 0.538 or pure_x < 55.0 or (gdx < 0.0 and pure_x < 60.0):
                return 2
            if ev_wx == 0 and ((ev_wy >= 1 and pure_x < 60.5) or (sw_x and not sw_y and pure_x < 59.5) or (restx >= 18 and pure_x < 59.5)):
                return 2
        # Shield C: Early-Month (Days 1-7) & Jan 1-7 Season-Opening Cold Guard
        if dy <= 7:
            if mo == 1 and (sfx < 0.565 or gdx < 0.5 or pure_x < 60.0):
                return 2
            if sfx < 0.550 or gdx < 0.2 or pure_x < 56.0:
                return 2
            if ev_wx == 0 and ((ev_wy >= 1 and pure_x < 61.0) or (restx >= 15 and pure_x < 61.0) or (sw_x and not sw_y and pure_x < 60.5) or (gdx < gdy and pure_x < 61.0)):
                return 2
        return 0

    htrap_c = calc_smart_shield(
        False, pure_l5h, elo_l5h, sf_h, gdiff10_h, gdiff10_a, n365_h, n365_a,
        bool(sh.get("last_w")), bool(sa.get("last_w")), p10_h, p10_a, rest_h, surf_sw_h, surf_sw_a,
        ev_wh, ev_wa, ev_gdh, ev_gda,
    )
    atrap_c = calc_smart_shield(
        True, pure_l5a, 100.0 - elo_l5h, sf_a, gdiff10_a, gdiff10_h, n365_a, n365_h,
        bool(sa.get("last_w")), bool(sh.get("last_w")), p10_a, p10_h, rest_a, surf_sw_a, surf_sw_h,
        ev_wa, ev_wh, ev_gda, ev_gdh,
    )

    h_wl_str = f"{sh['w_ytd']}-{sh['l_ytd']}" if int(sh["n_ytd"]) > 0 else f"{sh['w_365']}-{sh['l_365']}"
    a_wl_str = f"{sa['w_ytd']}-{sa['l_ytd']}" if int(sa["n_ytd"]) > 0 else f"{sa['w_365']}-{sa['l_365']}"

    st_meta = {
        "h_wl": h_wl_str,
        "a_wl": a_wl_str,
        "h_rk": int(rkh),
        "a_rk": int(rka),
        "n_act": int(n_act),
        "h_l10": f"{sh['w10']}-{sh['l10']} ({gdiff10_h:+.1f})",
        "a_l10": f"{sa['w10']}-{sa['l10']} ({gdiff10_a:+.1f})",
        "h_pyth": round(100.0 * sf_h, 1),
        "a_pyth": round(100.0 * sf_a, 1),
    }

    pwr_p = {
        "c_vol": {
            "hpct": round(hp_c, 1),
            "apct": round(ap_c, 1),
            "l5h": round(l5_c, 1),
            "hel": elh,
            "ael": ela,
            "htrap": int(htrap_c),
            "atrap": int(atrap_c),
        },
        "b_pure": {
            "hpct": round(hp_b, 1),
            "apct": round(ap_b, 1),
            "l5h": round(l5_b, 1),
            "hel": elh,
            "ael": ela,
            "htrap": int(htrap_c),
            "atrap": int(atrap_c),
        },
        "a_elo": {
            "hpct": round(elo_hpct, 1),
            "apct": round(elo_apct, 1),
            "l5h": round(elo_l5h, 1),
            "hel": elo_hel,
            "ael": elo_ael,
            "htrap": 0,
            "atrap": 0,
        },
    }
    return st_meta, pwr_p


def eval_card_modes_for_profile(card: dict[str, Any], profile_key: str) -> dict[str, dict[str, Any]]:
    """
    Fast, exact scalar evaluator for Modes 1..17 under profile_key ('c_vol' | 'b_pure' | 'a_elo').
    100% bit-for-bit identical to client-side TypeScript applyPowerProfileToGame()!
    """
    fm = card["fusion_meta"]
    if profile_key == "a_elo":
        modes = dict(fm["modes"])
        m13 = modes["anti_nobet_smart"]
        m15 = modes["fusion4_elem"]
        sig17 = bool(m13["sig"] and m15["sig"] and m13["pick"] and m13["pick"] == m15["pick"])
        pk17 = m13["pick"] if sig17 else ""
        in_t12_e = False
        vip_e = False
        if sig17:
            g1_e = fm.get("geo1xxx") or {}
            pp_e = (card.get("pwr_p") or {}).get("a_elo") or card.get("wtp") or {}
            ish_e = (pk17 == card["h"])
            d_elo_e = round(float(pp_e.get("hpct" if ish_e else "apct", 50.0)), 1)
            opp_el_e = str(pp_e.get("ael" if ish_e else "hel", "AIR"))
            p0011_e = float(g1_e.get("h_0011" if ish_e else "a_0011", 0.0))
            p1xxx_e = float(g1_e.get("h_sum" if ish_e else "a_sum", 0.0))
            vip13_e = bool(m13.get("vip"))
            in_t12_e = bool(
                (d_elo_e >= 75.0 and p0011_e < 0 and vip13_e)
                or (p0011_e <= -8.0 and p1xxx_e < 0 and vip13_e)
                or (d_elo_e >= 58.0 and p0011_e <= -8.0 and vip13_e)
            )
            vip_e = bool(
                in_t12_e
                or (d_elo_e >= 75.0 and opp_el_e == "EARTH")
                or (d_elo_e >= 60.0 and p0011_e < 0)
            )
        gr_e = "C" if (sig17 and in_t12_e) else ("B" if (sig17 and vip_e) else ("A" if sig17 else ""))
        modes["mode17"] = {
            "sig": sig17,
            "vip": bool(sig17 and m13["vip"]),
            "pick": pk17,
            "grade": gr_e,
            "sub": "BASE_17" if sig17 else "",
            "orig_pick": pk17,
            "sig_c": gr_e == "C",
            "sig_b": gr_e in ("C", "B"),
            "sig_a": sig17,
        }
        modes["mode17_c"] = {"sig": gr_e == "C", "vip": gr_e == "C", "pick": pk17 if gr_e == "C" else "", "grade": gr_e if gr_e == "C" else ""}
        modes["mode17_b"] = {"sig": gr_e in ("C", "B"), "vip": gr_e == "C", "pick": pk17 if gr_e in ("C", "B") else "", "grade": gr_e if gr_e in ("C", "B") else ""}
        modes["mode17_a"] = {"sig": sig17, "vip": vip_e, "pick": pk17, "grade": gr_e}
        return modes

    pp = card["pwr_p"][profile_key]
    h, a = card["h"], card["a"]
    h_l5 = round(float(pp["l5h"]), 1)
    a_l5 = round(100.0 - h_l5, 1)
    hpct = round(float(pp["hpct"]), 1)
    apct = round(float(pp["apct"]), 1)
    h_el = str(pp["hel"])
    a_el = str(pp["ael"])
    htrap_lv = int(pp.get("htrap", 0))
    atrap_lv = int(pp.get("atrap", 0))

    tm = fm["team"]
    pl = fm["player"]
    tpk = tm["pick"]
    ppk = pl["pick"]
    f30_t = int(tm["f30"])
    f30_p = int(pl["f30"])

    tl5 = h_l5 if tpk == h else a_l5
    pl5 = h_l5 if ppk == h else a_l5
    mel_t = matchup_elem(tl5)
    mel_p = matchup_elem(pl5)

    idx3 = card.get("idx3") or {}
    f1_guard_t = bool(tm.get("guard_sym", tm.get("guard", card.get("f1_guard", False)))) if tl5 >= 56.0 else bool(tm.get("guard", card.get("f1_guard", False)))
    f1_guard_p = bool(pl.get("guard_sym", pl.get("guard", pl.get("sig", False)))) if pl5 >= 56.0 else bool(pl.get("guard", pl.get("sig", False)))

    nat_t = bool(tm.get("nat", card.get("is_nat", False)))
    nat_p = bool(pl.get("nat", False))
    fav_v4_t = int(tm.get("vh", idx3.get("vh", 0)) if tpk == h else tm.get("va", idx3.get("va", 0)))
    fav_v4_p = int(pl.get("vh", 0) if ppk == h else pl.get("va", 0))
    min_o4_t = int(tm.get("minD", idx3.get("minD", 0)))
    min_o4_p = int(pl.get("minD", 0))

    t_sig = bool(f1_guard_t and mel_t != "EARTH")
    t_vip = bool(t_sig and (mel_t == "FIRE" or (nat_t and fav_v4_t == 4 and min_o4_t >= 2)))
    p_sig = bool(f1_guard_p and mel_p != "EARTH")
    p_vip = bool(p_sig and (mel_p == "FIRE" or (nat_p and fav_v4_p == 4 and min_o4_p >= 2)))

    sgn_t = 1 if tpk == h else -1
    sgn_p = 1 if ppk == h else -1
    p_supports_t = (ppk == tpk) or (f30_p * sgn_t > 0)
    t_supports_p = (tpk == ppk) or (f30_t * sgn_p > 0)
    p_astro_t = (f30_p * sgn_t > 0)
    t_astro_p = (f30_t * sgn_p > 0)

    is_diamond = bool(t_sig and p_sig and tpk == ppk)
    is_vip_cross = bool((t_vip and p_supports_t and (not p_vip or tpk == ppk)) or (p_vip and t_supports_p and (not t_vip or tpk == ppk)))
    is_astro_lock = bool((t_sig and p_astro_t and (not p_sig or tpk == ppk)) or (p_sig and t_astro_p and (not t_sig or tpk == ppk)))
    is_dual_pillar = bool((t_sig and p_supports_t and (not p_sig or tpk == ppk)) or (p_sig and t_supports_p and (not t_sig or tpk == ppk)))
    is_vetoed = bool((t_sig or p_sig) and not is_dual_pillar)

    fav_elo = h if h_l5 >= a_l5 else a
    if is_diamond:
        base_pick = tpk
    elif is_vip_cross:
        base_pick = tpk if (t_vip and p_supports_t) else ppk
    elif is_dual_pillar:
        base_pick = tpk if (t_sig and p_supports_t) else ppk
    elif is_vetoed:
        base_pick = tpk if t_sig else ppk
    else:
        base_pick = tpk if abs(f30_t) > abs(f30_p) else (ppk if abs(f30_p) > abs(f30_t) else fav_elo)

    pk_vip = tpk if (t_vip and p_supports_t) else (ppk if (p_vip and t_supports_p) else base_pick)
    pk_ast = tpk if (t_sig and p_astro_t) else (ppk if (p_sig and t_astro_p) else base_pick)
    pk_dp = tpk if (t_sig and p_supports_t) else (ppk if (p_sig and t_supports_p) else base_pick)
    pk_dia = tpk if is_diamond else base_pick

    g1 = fm["geo1xxx"]
    h_sum, a_sum = float(g1["h_sum"]), float(g1["a_sum"])
    h_cnt, a_cnt = int(g1["h_cnt"]), int(g1["a_cnt"])
    h_0sum, a_0sum = float(g1["h_0xxx"]), float(g1["a_0xxx"])
    h_0011_sum, a_0011_sum = float(g1["h_0011"]), float(g1["a_0011"])
    h_gf, a_gf = float(g1["h_gf"]), float(g1["a_gf"])
    h_s3, a_s3 = float(g1["h_s3"]), float(g1["a_s3"])
    g1_win = str(g1["win"])
    cold0_win = str(g1["cold0_win"])
    c0011_win = str(g1["c0011_win"])
    all_win = str(g1["all_win"])
    gf_win = str(g1["gf_win"])
    triple3_win = str(g1["triple3_win"])

    votes_h3 = int(g1_win == h) + int(all_win == h) + int(gf_win == h)
    votes_a3 = int(g1_win == a) + int(all_win == a) + int(gf_win == a)
    maj23_win = h if votes_h3 >= 2 else (a if votes_a3 >= 2 else (gf_win or fav_elo))

    is_m5 = bool(is_dual_pillar and g1_win == pk_dp)
    is_m6 = bool(is_dual_pillar and g1_win == pk_dp and all_win == pk_dp)

    pk_el = h_el if pk_dp == h else a_el
    op_el = a_el if pk_dp == h else h_el
    pk_l5 = h_l5 if pk_dp == h else a_l5
    earth_ok = not (pk_el == "EARTH" and op_el != "EARTH")
    pk_1sum = h_sum if pk_dp == h else a_sum
    pk_1cnt = h_cnt if pk_dp == h else a_cnt
    both_pos_1xxx = (h_cnt > 0 and a_cnt > 0 and h_sum > 0 and a_sum > 0)
    neg_anchor_ok = (pk_1cnt >= 1 and pk_1sum < 0)
    gf_delta = abs(h_gf - a_gf)
    dl_or_ref = (g1_win == pk_dp and all_win == pk_dp) or (pk_1cnt >= 1 and gf_delta >= 4.0 and maj23_win == pk_dp)

    is_m7 = bool(is_dual_pillar and earth_ok and not both_pos_1xxx and neg_anchor_ok and dl_or_ref)
    safe_dl_win = pk_dp if (g1_win == pk_dp and all_win == pk_dp and earth_ok) else ""
    is_m8 = bool(is_m7 or (is_vip_cross and safe_dl_win == pk_vip) or (dl_or_ref and pk_el != "EARTH" and neg_anchor_ok and pk_l5 >= 60.0 and tpk == ppk))
    pk_m8 = pk_vip if (is_vip_cross and safe_dl_win == pk_vip and not is_m7) else pk_dp

    pos_inv_trig = bool(both_pos_1xxx and abs(h_sum - a_sum) >= 2.0)
    pos_inv_win = (h if h_sum > a_sum else a) if pos_inv_trig else ""
    div_ref_ok = bool(g1_win != all_win and gf_delta >= 5.0 and maj23_win in (h, a))
    if is_m7:
        is_m9, pk_m9 = True, pk_dp
    elif is_vip_cross and safe_dl_win == pk_vip:
        is_m9, pk_m9 = True, pk_vip
    elif pos_inv_trig and ((pos_inv_win == h and h_l5 >= 55.0) or (pos_inv_win == a and a_l5 >= 55.0)):
        is_m9, pk_m9 = True, pos_inv_win
    elif is_dual_pillar and div_ref_ok and maj23_win == pk_dp and earth_ok:
        is_m9, pk_m9 = True, pk_dp
    else:
        is_m9, pk_m9 = False, pk_dp

    pk_m10 = h if h_gf < a_gf else (a if a_gf < h_gf else fav_elo)

    s3_sign_split = (h_s3 < 0 < a_s3) or (a_s3 < 0 < h_s3)
    s3_split_win = h if (h_s3 < 0 < a_s3) else (a if (a_s3 < 0 < h_s3) else "")
    pk_m11 = s3_split_win or triple3_win or maj23_win or pk_m10
    m11_l5 = h_l5 if pk_m11 == h else a_l5
    m11_el = h_el if pk_m11 == h else a_el
    m11_0 = h_0sum if pk_m11 == h else a_0sum
    m11_1cnt = h_cnt if pk_m11 == h else a_cnt
    if m11_el == "EARTH" and (h_el != "EARTH" or a_el != "EARTH") and m11_l5 < 52.0:
        pk_m11 = a if pk_m11 == h else h
        is_m11 = True
    elif m11_1cnt == 0 and ((pk_m11 == h and a_l5 >= 58.0) or (pk_m11 == a and h_l5 >= 58.0)):
        pk_m11 = a if pk_m11 == h else h
        is_m11 = True
    elif s3_sign_split and m11_l5 >= 54.0:
        is_m11 = True
    elif triple3_win and m11_l5 >= 52.0:
        is_m11 = True
    elif m11_0 <= -3.0 and cold0_win == pk_m11 and m11_l5 >= 55.0:
        is_m11 = True
    else:
        is_m11 = False

    dual_earth_hold = (h_el == "EARTH" and a_el == "EARTH")
    cand_m12 = pk_m9 if is_m9 else (pk_m11 if is_m11 else (pk_dp if is_dual_pillar else fav_elo))
    clash_3of3_hold = bool(triple3_win and triple3_win != cand_m12)
    cand_l5 = h_l5 if cand_m12 == h else a_l5
    cand_0 = h_0sum if cand_m12 == h else a_0sum
    bipolar_ok = bool(c0011_win == cand_m12 and is_dual_pillar and cand_l5 >= 58.0)

    if dual_earth_hold:
        is_m12, m12_code, raw_fb13 = False, "ULTRA_DUAL_EARTH_HOLD", False
    elif clash_3of3_hold:
        is_m12, m12_code, raw_fb13 = False, "ULTRA_3OF3_CLASH_HOLD", False
    elif is_m9 and cand_l5 >= 56.0:
        is_m12, m12_code, raw_fb13 = True, "ULTRA_M9_CORE", False
    elif cand_0 <= -4.0 and cold0_win == cand_m12 and is_dual_pillar and cand_l5 >= 58.0:
        is_m12, m12_code, raw_fb13 = True, "ULTRA_COLD_ANCHOR", False
    elif bipolar_ok:
        is_m12, m12_code, raw_fb13 = True, "ULTRA_BIPOLAR_0011", False
    elif s3_sign_split and s3_split_win == cand_m12 and is_dual_pillar and cand_l5 >= 60.0:
        is_m12, m12_code, raw_fb13 = True, "ULTRA_S3_SPLIT", False
    else:
        is_m12, m12_code, raw_fb13 = False, "M11_RAW", True
    pk_m12 = cand_m12

    p13 = pk_m12
    o13 = a if p13 == h else h
    p13_el = h_el if p13 == h else a_el
    o13_el = a_el if p13 == h else h_el
    p13_l5 = h_l5 if p13 == h else a_l5
    o13_l5 = a_l5 if p13 == h else h_l5
    is_3of3_p13 = (triple3_win == p13)
    dp_o13 = (is_dual_pillar and pk_dp == o13)

    if is_m12:
        is_m13, vip_m13, pk_m13 = True, bool(is_diamond or p13_l5 >= 75.0), p13
    elif dual_earth_hold or m12_code == "ULTRA_3OF3_CLASH_HOLD":
        is_m13, vip_m13, pk_m13 = False, False, p13
    elif is_m11 and pk_m11 == p13 and p13_el != "EARTH" and p13_l5 >= 75.0:
        is_m13, vip_m13, pk_m13 = True, bool(p13_l5 >= 80.0), p13
    elif (not is_m11) and o13_el != "EARTH" and (not is_3of3_p13) and ((dp_o13 and o13_l5 >= 54.0) or (raw_fb13 and o13_l5 >= 60.0)):
        is_m13, vip_m13, pk_m13 = True, False, o13
    else:
        is_m13, vip_m13, pk_m13 = False, False, p13

    t12 = fm["total_elem_12"]
    h_w_gff, a_w_gff = float(t12["h_w_gff"]), float(t12["a_w_gff"])
    h_c_gff, a_c_gff = float(t12["h_c_gff"]), float(t12["a_c_gff"])
    h_d_gff, a_d_gff = float(t12["h_d_gff"]), float(t12["a_d_gff"])
    h_gff_p12, a_gff_p12 = float(t12["h_gff_p12"]), float(t12["a_gff_p12"])
    h_gff_tot, a_gff_tot = float(t12["h_gff_tot"]), float(t12["a_gff_tot"])
    h_s_pwr, a_s_pwr = float(t12["h_s_pwr"]), float(t12["a_s_pwr"])
    h_ef_tot = [int(x) for x in t12["h_ef_tot"]]
    a_ef_tot = [int(x) for x in t12["a_ef_tot"]]

    h_dom, h_dom_cnt, h_dom_tie = dominant_elem_info(h_ef_tot)
    a_dom, a_dom_cnt, a_dom_tie = dominant_elem_info(a_ef_tot)
    h_lead_cnt = sum(1 for i in range(4) if h_ef_tot[i] > a_ef_tot[i])
    a_lead_cnt = sum(1 for i in range(4) if a_ef_tot[i] > h_ef_tot[i])
    dual_water = (h_dom == "WATER" and a_dom == "WATER")
    dom_split = (not h_dom_tie and not a_dom_tie and h_dom != a_dom)

    base_m14_pick = h if h_gff_tot < a_gff_tot else (a if a_gff_tot < h_gff_tot else fav_elo)
    m14_l5 = h_l5 if base_m14_pick == h else a_l5
    if not dual_water and ((base_m14_pick == h and h_lead_cnt >= 3) or (base_m14_pick == a and a_lead_cnt >= 3)) and m14_l5 >= 55.0:
        base_m14_sig, t12_code = True, "TOT12_LEAD_3OF4"
    elif not dual_water and is_dual_pillar and pk_dp == base_m14_pick and m14_l5 >= 58.0:
        base_m14_sig, t12_code = True, "TOT12_DUAL_HARMONY"
    elif not dual_water and ((base_m14_pick == h and h_w_gff < a_w_gff and h_c_gff < a_c_gff) or (base_m14_pick == a and a_w_gff < h_w_gff and a_c_gff < h_c_gff)):
        base_m14_sig, t12_code = True, "TOT12_BIPOLAR_HARMONY"
    else:
        base_m14_sig, t12_code = False, "TOT12_NEUTRAL"

    p14 = base_m14_pick
    o14 = a if p14 == h else h
    pl5_14 = h_l5 if p14 == h else a_l5
    ol5_14 = a_l5 if p14 == h else h_l5
    p_warm_14 = h_w_gff if p14 == h else a_w_gff
    p12_fav_opp = (h_gff_p12 < a_gff_p12) if o14 == h else (a_gff_p12 < h_gff_p12)
    p12_fav_base = (h_gff_p12 < a_gff_p12) if p14 == h else (a_gff_p12 < h_gff_p12)
    spwr_fav_opp = (h_s_pwr < a_s_pwr) if o14 == h else (a_s_pwr < h_s_pwr)
    m11_dir_opp = (pk_m11 == o14)
    m11_fav_opp = (is_m11 and pk_m11 == o14)
    p_lead_14 = h_lead_cnt if p14 == h else a_lead_cnt
    o_lead_14 = a_lead_cnt if p14 == h else h_lead_cnt

    # Neutral-court symmetric Mode 14 trap (pl5_14 < 50.0 replaces legacy NBA p14 == a away lock!)
    has_trap_14 = bool(
        (base_m14_sig and t12_code == "TOT12_BIPOLAR_HARMONY" and pl5_14 < 75.0)
        or (base_m14_sig and pl5_14 < 50.0 and p_warm_14 < 0)
        or (base_m14_sig and dual_water)
    )
    sm14_kind = "M14_HOLD_NEUTRAL"
    if base_m14_sig:
        if has_trap_14:
            pk_sm14 = o14
            if m11_dir_opp and not dual_water:
                is_sm14, vip_sm14, sm14_kind = True, False, "M14_TRAP_FLIP"
            else:
                is_sm14, vip_sm14, sm14_kind = False, False, "M14_VETO_TRAP"
        else:
            is_sm14, vip_sm14, pk_sm14, sm14_kind = True, bool(p_lead_14 == 3 or dom_split), p14, "M14_CORE_CLEAN"
    elif not dual_water and pl5_14 >= 75.0:
        is_sm14, vip_sm14, pk_sm14, sm14_kind = True, bool(pl5_14 >= 80.0 or p_lead_14 == 3), p14, "M14_DIRECT_RELEASE"
    elif not dual_water and ((m11_fav_opp and spwr_fav_opp and ol5_14 >= 55.0) or (ol5_14 >= 62.0 and (m11_fav_opp or p12_fav_opp))):
        is_sm14, vip_sm14, pk_sm14, sm14_kind = True, bool((m11_fav_opp and spwr_fav_opp) or o_lead_14 == 3), o14, "M14_OPPOSITE_FLIP"
    else:
        is_sm14, vip_sm14, pk_sm14 = False, False, p14

    h_cat = "TIE" if h_dom_tie else h_dom
    a_cat = "TIE" if a_dom_tie else a_dom
    dom_delta = abs(h_dom_cnt - a_dom_cnt)
    air_delta = abs(h_ef_tot[1] - a_ef_tot[1])
    h_ef_sum, a_ef_sum = sum(h_ef_tot), sum(a_ef_tot)
    ef_pick, ef_tier, ef_rule = "", "NEUTRAL", "NEUTRAL"
    if h_cat == "EARTH" and a_cat == "EARTH" and dom_delta >= 10:
        ef_pick, ef_tier, ef_rule = (h if h_dom_cnt < a_dom_cnt else a), "STRONG", "EARTH_SAT10_SMALL"
    elif air_delta >= 8:
        ef_pick, ef_tier, ef_rule = (h if h_ef_tot[1] < a_ef_tot[1] else a), "STRONG", "AIR_SAT8_SMALL"
    elif h_cat == "WATER" and a_cat == "WATER" and 1 <= dom_delta <= 3:
        ef_pick, ef_tier, ef_rule = (h if h_dom_cnt < a_dom_cnt else a), "STRONG", "WATER_1_3_SMALL"
    elif h_cat == "WATER" and a_cat == "WATER" and dom_delta >= 4:
        ef_pick, ef_tier, ef_rule = (h if h_dom_cnt > a_dom_cnt else a), "STRONG", "WATER_4_PLUS_LARGE"
    elif h_dom_tie != a_dom_tie:
        ef_pick, ef_tier, ef_rule = (h if h_dom_tie else a), "STRONG", "TIE_VS_UNIQ"
    elif h_cat == "EARTH" and a_cat == "EARTH" and 4 <= dom_delta <= 9:
        ef_pick, ef_tier, ef_rule = (h if h_dom_cnt > a_dom_cnt else a), "STRONG", "EARTH_4_9_LARGE"
    elif h_lead_cnt == 3 or a_lead_cnt == 3:
        ef_pick, ef_tier, ef_rule = (h if h_lead_cnt == 3 else a), "MEDIUM", "LEAD_3OF4"
    elif h_cat == "EARTH" and a_cat == "EARTH" and 1 <= dom_delta <= 3:
        ef_pick, ef_tier, ef_rule = (h if h_dom_cnt > a_dom_cnt else a), "MEDIUM", "EARTH_1_3_LARGE"
    elif h_ef_sum != a_ef_sum:
        ef_pick, ef_tier, ef_rule = (h if h_ef_sum > a_ef_sum else a), "MEDIUM", "SPLIT_SUM_LARGE"

    sug_pick = pk_sm14
    sug_l5 = h_l5 if sug_pick == h else a_l5
    ep_is_h = bool(ef_pick and ef_pick == h)
    ep_l5 = 0.0 if not ef_pick else (h_l5 if ep_is_h else a_l5)
    ep_p12_ok = False if not ef_pick else (h_gff_p12 < a_gff_p12 if ep_is_h else a_gff_p12 < h_gff_p12)
    ep_sum_ok = False if not ef_pick else (h_ef_sum > a_ef_sum if ep_is_h else a_ef_sum > h_ef_sum)
    ep_m11_dir = bool(ef_pick and pk_m11 == ef_pick)
    ep_m11_sig = bool(ef_pick and is_m11 and pk_m11 == ef_pick)
    sug_team_sig = bool((t_sig and tpk == sug_pick) or (p_sig and ppk == sug_pick))
    agree_boxes = bool(ef_pick and sug_pick == ef_pick)
    clash_boxes = bool(ef_pick and sug_pick != ef_pick)
    sat_trap = ef_rule in ("AIR_SAT8_SMALL", "EARTH_SAT10_SMALL")

    # Neutral-court symmetric Pattern 1 (removed NBA ep_is_h home lock!)
    p1_hit = bool(not dual_water and agree_boxes and ep_m11_dir and (ep_l5 >= 58.0 or (ef_tier == "STRONG" and ep_l5 >= 53.0)))
    p2_hit = bool(not dual_water and agree_boxes and (is_sm14 or (ef_tier == "STRONG" and (ep_m11_sig or sug_team_sig or (ep_p12_ok and ep_sum_ok and ep_l5 >= 60.0)))))
    p3_hit = bool(not dual_water and ef_pick and ef_tier == "STRONG" and ep_p12_ok and ep_l5 >= 62.0 and (agree_boxes or not is_sm14))
    p4_air_trap = bool(clash_boxes and (sug_team_sig or (is_sm14 and sug_l5 >= 75.0)) and sat_trap)
    p4_hit = bool(not dual_water and clash_boxes and not sat_trap and (sug_team_sig or (is_sm14 and sug_l5 >= 75.0)))
    is_m15 = bool(p1_hit or p2_hit or p3_hit or p4_hit)
    pk_m15 = ef_pick if (p1_hit or p2_hit or p3_hit) else sug_pick
    vip_m15 = bool((int(p1_hit) + int(p2_hit) + int(p3_hit) + int(p4_hit)) >= 2)

    # Mode 16: referee6_ranked
    b1_h = int(h_w_gff < a_w_gff) + int(h_c_gff < a_c_gff) + int(h_d_gff < a_d_gff) + int(h_gff_tot < a_gff_tot) + int(not dual_water and (h_lead_cnt == 3 or (dom_split and h_dom in ("WATER", "AIR"))))
    b1_a = int(a_w_gff < h_w_gff) + int(a_c_gff < h_c_gff) + int(a_d_gff < h_d_gff) + int(a_gff_tot < h_gff_tot) + int(not dual_water and (a_lead_cnt == 3 or (dom_split and a_dom in ("WATER", "AIR"))))
    h_is_b, a_is_b = (p14 == h), (p14 == a)
    h_pure_l5 = (h_is_b and base_m14_sig and not has_trap_14) or (h_is_b and h_l5 >= 75.0) or ((not h_is_b) and (h_l5 >= 62.0 or (m11_fav_opp and spwr_fav_opp and h_l5 >= 55.0)))
    a_pure_l5 = (a_is_b and base_m14_sig and not has_trap_14) or (a_is_b and a_l5 >= 75.0) or ((not a_is_b) and (a_l5 >= 62.0 or (m11_fav_opp and spwr_fav_opp and a_l5 >= 55.0)))
    sm_h = (
        int(base_m14_sig and h_is_b and not has_trap_14)
        + int(not dual_water and (h_lead_cnt == 3 or (dom_split and (pk_sm14 == h if is_sm14 else h_dom != "EARTH"))))
        + int(h_pure_l5)
        + int(((is_m11 and pk_m11 == h) or p12_fav_opp or (has_trap_14 and pk_m11 == h)) if not h_is_b else (sm14_kind in ("M14_CORE_CLEAN", "M14_DIRECT_RELEASE") and p12_fav_base))
        + int(is_sm14 and pk_sm14 == h)
    )
    sm_a = (
        int(base_m14_sig and a_is_b and not has_trap_14)
        + int(not dual_water and (a_lead_cnt == 3 or (dom_split and (pk_sm14 == a if is_sm14 else a_dom != "EARTH"))))
        + int(a_pure_l5)
        + int(((is_m11 and pk_m11 == a) or p12_fav_opp or (has_trap_14 and pk_m11 == a)) if not a_is_b else (sm14_kind in ("M14_CORE_CLEAN", "M14_DIRECT_RELEASE") and p12_fav_base))
        + int(is_sm14 and pk_sm14 == a)
    )
    f4_h = int(p1_hit and ef_pick == h) + int(p2_hit and ef_pick == h) + int(p3_hit and ef_pick == h) + int(p4_hit and sug_pick == h)
    f4_a = int(p1_hit and ef_pick == a) + int(p2_hit and ef_pick == a) + int(p3_hit and ef_pick == a) + int(p4_hit and sug_pick == a)
    tot_h_ticks = b1_h + sm_h + int(ef_pick == h) + f4_h
    tot_a_ticks = b1_a + sm_a + int(ef_pick == a) + f4_a

    r82_sat_trap = clash_boxes and sat_trap and not p4_hit
    r82_weak_clash = bool(is_sm14 and clash_boxes and not p4_hit and not vip_sm14)
    f4_cnt = int(p1_hit) + int(p2_hit) + int(p3_hit) + int(p4_hit)
    f4_tick_lead = (tot_h_ticks > tot_a_ticks if pk_m15 == h else tot_a_ticks > tot_h_ticks) if is_m15 else False
    nobet_f4_trap = bool(not is_sm14 and is_m15 and not f4_tick_lead)
    opp_sug = a if sug_pick == h else h
    opp_sug_l5 = h_l5 if opp_sug == h else a_l5
    b1_pick = h if b1_h > b1_a else (a if b1_a > b1_h else "")
    rev_m12 = bool(not dual_water and is_m12 and pk_m12 == opp_sug and (opp_sug_l5 < 50.0 or opp_sug_l5 >= 55.0))
    rev_h_m11 = bool(not dual_water and opp_sug_l5 >= 52.0 and is_m11 and pk_m11 == opp_sug and ef_pick == opp_sug)
    dir_m12 = bool(not dual_water and not is_sm14 and not p4_air_trap and is_m12 and pk_m12 == sug_pick and sug_l5 >= 60.0)
    dir_m11_b1 = bool(not dual_water and not is_sm14 and not p4_air_trap and is_m11 and pk_m11 == sug_pick and b1_pick == sug_pick and sug_l5 >= 65.0)

    pts_h, pts_a, top_hit = 0.0, 0.0, False

    def add_pts(tm_s: str, pts: float) -> None:
        nonlocal pts_h, pts_a
        if pts > 0 and tm_s == h:
            pts_h += pts
        elif pts > 0 and tm_s == a:
            pts_a += pts

    if is_m15:
        solo_p3 = p3_hit and not (p1_hit or p2_hit or p4_hit)
        if f4_cnt >= 2 and (is_sm14 or f4_tick_lead):
            add_pts(pk_m15, 10.0); top_hit = True
        elif (is_sm14 and p4_hit) or ((not is_sm14) and (p1_hit or p2_hit) and f4_tick_lead):
            add_pts(pk_m15, 8.0); top_hit = True
        elif (not is_sm14) and p4_hit and f4_tick_lead:
            add_pts(pk_m15, 7.0); top_hit = True
        elif solo_p3:
            add_pts(pk_m15, 1.0)
        else:
            add_pts(pk_m15, 1.5)
    elif p4_air_trap and ef_pick:
        add_pts(ef_pick, 3.5)

    if is_sm14 and vip_sm14 and not r82_sat_trap:
        add_pts(pk_sm14, 9.0); top_hit = True
    elif is_sm14 and not r82_weak_clash and not r82_sat_trap:
        add_pts(pk_sm14, 7.0); top_hit = True
    elif rev_m12 or rev_h_m11:
        add_pts(opp_sug, 7.0); top_hit = True
    elif not (r82_weak_clash or r82_sat_trap):
        if dir_m12 or dir_m11_b1:
            add_pts(sug_pick, 7.0); top_hit = True
        elif nobet_f4_trap and pk_m15 == sug_pick:
            add_pts(sug_pick, 1.5)
        else:
            add_pts(sug_pick, 5.0 if sug_l5 >= 58.0 else (4.0 if sug_l5 >= 50.0 else 2.5))

    if is_sm14 and not r82_weak_clash and not r82_sat_trap:
        add_pts(pk_sm14, 6.0); top_hit = True
    elif rev_m12 or rev_h_m11:
        add_pts(opp_sug, 5.0)
    elif not (r82_weak_clash or r82_sat_trap):
        if dir_m12 or dir_m11_b1:
            add_pts(sug_pick, 4.5)
        elif sm_h != sm_a:
            add_pts(h if sm_h > sm_a else a, 2.0)

    if ef_pick:
        add_pts(ef_pick, 3.5 if ef_tier == "STRONG" else 2.0)
    if not dual_water and (h_lead_cnt == 3 or a_lead_cnt == 3):
        add_pts(h if h_lead_cnt == 3 else a, 1.5)
    elif dom_split and h_dom_cnt != a_dom_cnt:
        add_pts(h if h_dom_cnt > a_dom_cnt else a, 1.0)
    if b1_pick:
        add_pts(b1_pick, 1.5 if abs(b1_h - b1_a) >= 2 else 1.0)

    delta_pts = round(abs(pts_h - pts_a), 1)
    pk_m16 = h if pts_h > pts_a else (a if pts_a > pts_h else sug_pick)
    ef_strong_m16 = bool(ef_pick and ef_tier == "STRONG" and ef_pick == pk_m16)
    is_m16 = bool((top_hit and delta_pts >= 8.0) or delta_pts >= 5.5 or (delta_pts >= 4.0 and ef_strong_m16))
    vip_m16 = bool(top_hit and delta_pts >= 18.0)

    # Smart Protective Shields (Finals / ATP-WTA 250 / Days 1-7 / Jan 1-7 / Surface Competence / Fame-vs-Form)
    if htrap_lv > 0 or atrap_lv > 0:
        if is_m13:
            tr13 = htrap_lv if pk_m13 == h else atrap_lv
            p0_13 = h_0011_sum if pk_m13 == h else a_0011_sum
            if tr13 >= 2 or (tr13 == 1 and (not is_m12) and p0_13 > -8.0):
                is_m13 = False
                vip_m13 = False
        if is_m15:
            tr15 = htrap_lv if pk_m15 == h else atrap_lv
            p0_15 = h_0011_sum if pk_m15 == h else a_0011_sum
            if tr15 >= 2 or (tr15 == 1 and (not is_m12) and p0_15 > -8.0):
                is_m15 = False
                vip_m15 = False

    # Neutral-Court P2 Astro Confirmation
    if is_m13 and pk_m13 == a and not (a_0011_sum < 0 or triple3_win == a or is_m12):
        is_m13 = False
        vip_m13 = False

    base_sig17 = bool(is_m13 and is_m15 and pk_m13 and pk_m13 == pk_m15)
    base_pk17 = pk_m13 if base_sig17 else ""
    in_t12 = False
    is_t3 = False
    if base_sig17:
        ish17 = (base_pk17 == h)
        d_elo = hpct if ish17 else apct
        opp_el = a_el if ish17 else h_el
        p0011 = h_0011_sum if ish17 else a_0011_sum
        p1xxx = h_sum if ish17 else a_sum
        in_t12 = bool(
            (d_elo >= 75.0 and p0011 < 0 and vip_m13)
            or (p0011 <= -8.0 and p1xxx < 0 and vip_m13)
            or (d_elo >= 58.0 and p0011 <= -8.0 and vip_m13)
        )
        is_t3 = (not in_t12) and bool((d_elo >= 75.0 and opp_el == "EARTH") or (d_elo >= 60.0 and p0011 < 0))
    is_t4 = base_sig17 and (not in_t12) and (not is_t3)
    in_t34 = not in_t12
    vip_m17 = bool(base_sig17 and (in_t12 or is_t3))

    sig17 = base_sig17
    pk_m17 = base_pk17
    m17_sub = "BASE_17" if base_sig17 else ""
    m17_orig_pick = base_pk17
    v20_grade = "C" if (base_sig17 and in_t12) else ("B" if (base_sig17 and is_t3) else ("A" if base_sig17 else ""))
    is_C = v20_grade == "C"
    is_B = v20_grade in ("C", "B")
    is_A = base_sig17

    sm_meta = card.get("st_meta") or {}
    bp_prof = (card.get("pwr_p") or {}).get("b_pure") or {}
    if profile_key == "c_vol" and sm_meta and bp_prof:
        t_tier = classify_tourney_tier(str(card.get("tourney") or ""))
        rnd_u = str(card.get("rnd") or "R32").strip().upper()
        d_str = str(card.get("d") or "")
        day_num = int(d_str[8:10]) if len(d_str) >= 10 and d_str[8:10].isdigit() else 15
        b_hl5 = round(float(bp_prof.get("l5h", 50.0)), 1)
        b_al5 = round(100.0 - b_hl5, 1)
        ap_prof = (card.get("pwr_p") or {}).get("a_elo") or card.get("wtp") or {}
        e_hl5 = round(float(ap_prof.get("l5h", 50.0)), 1)
        e_al5 = round(100.0 - e_hl5, 1)
        hw10 = parse_l10_wins(str(sm_meta.get("h_l10") or ""))
        aw10 = parse_l10_wins(str(sm_meta.get("a_l10") or ""))
        h_gd10 = parse_gd10_from_l10(str(sm_meta.get("h_l10") or ""))
        a_gd10 = parse_gd10_from_l10(str(sm_meta.get("a_l10") or ""))
        h_pyth = float(sm_meta.get("h_pyth", 50.0))
        a_pyth = float(sm_meta.get("a_pyth", 50.0))

        v19_sig = False
        v19_pk = ""
        v19_sub = ""
        if base_sig17 and is_t4:
            ish17 = (base_pk17 == h)
            opp17 = a if ish17 else h
            p_l5 = h_l5 if ish17 else a_l5
            p_bl5 = b_hl5 if ish17 else b_al5
            o_rk = int(sm_meta.get("a_rk" if ish17 else "h_rk", 999))
            p_p12 = h_gff_p12 if ish17 else a_gff_p12
            o_p12 = a_gff_p12 if ish17 else h_gff_p12
            p_gf = h_gf if ish17 else a_gf
            o_gf = a_gf if ish17 else h_gf
            p_1sum = h_sum if ish17 else a_sum
            o_1sum = a_sum if ish17 else h_sum
            if t_tier in ("250", "500") and p_bl5 < 60.0:
                v19_sig = True
                v19_pk = opp17
                v19_sub = "FLIP_A"
            elif t_tier in ("250", "500") and p_l5 < 75.0 and o_rk <= 50 and o_p12 < p_p12:
                v19_sig = False
                v19_pk = ""
                v19_sub = "DROP_FLIP_B"
            elif (
                p_l5 < 65.0
                or (t_tier in ("250", "500") and p_l5 < 75.0)
                or (p_l5 < 75.0 and o_gf < p_gf and o_p12 < p_p12)
                or (rnd_u in ("SF", "F") and t_tier in ("250", "500") and o_1sum < p_1sum and (tpk != ppk))
            ):
                v19_sig = False
                v19_pk = ""
                v19_sub = "DROP_T4"
            else:
                v19_sig = True
                v19_pk = base_pk17
                v19_sub = "BASE_17"
        elif base_sig17:
            v19_sig = True
            v19_pk = base_pk17
            v19_sub = "BASE_17"
        elif (not base_sig17) and (not dual_water):
            maj23_raw = str(g1.get("maj23_win") or maj23_win)
            for cand_pk in (h, a):
                ish_c = (cand_pk == h)
                p_trap_c = htrap_lv if ish_c else atrap_lv
                p_el_c = h_el if ish_c else a_el
                if p_trap_c > 0 or p_el_c == "EARTH":
                    continue
                p_l5 = h_l5 if ish_c else a_l5
                p_bl5 = b_hl5 if ish_c else b_al5
                p_pyth = h_pyth if ish_c else a_pyth
                p_0011 = h_0011_sum if ish_c else a_0011_sum
                o_0011 = a_0011_sum if ish_c else h_0011_sum
                p_gd10 = h_gd10 if ish_c else a_gd10
                o_gd10 = a_gd10 if ish_c else h_gd10
                p_1cnt = h_cnt if ish_c else a_cnt
                p_1sum = h_sum if ish_c else a_sum
                dp_ok = bool(is_dual_pillar and pk_dp == cand_pk)
                maj23_ok = (maj23_raw == cand_pk)
                m12_ok = bool(is_m12 and pk_m12 == cand_pk)
                m15_ok = bool(is_m15 and pk_m15 == cand_pk)
                if p_l5 >= 68.0 and p_bl5 >= 68.0 and dp_ok and maj23_ok:
                    v19_sig = True
                    v19_pk = cand_pk
                    v19_sub = "GEM_1"
                    break
                elif p_l5 >= 82.0 and p_pyth >= 64.0 and p_0011 < 0 and p_0011 < o_0011:
                    v19_sig = True
                    v19_pk = cand_pk
                    v19_sub = "GEM_2"
                    break
                elif p_l5 >= 75.0 and p_bl5 >= 68.0 and m12_ok:
                    v19_sig = True
                    v19_pk = cand_pk
                    v19_sub = "GEM_3"
                    break
                elif m15_ok and p_l5 >= 77.0 and p_pyth >= 66.0 and p_gd10 > o_gd10 and p_1cnt >= 1 and p_1sum < 0:
                    v19_sig = True
                    v19_pk = cand_pk
                    v19_sub = "GEM_4"
                    break

        fav_c = h if (h_l5 > a_l5 or (h_l5 == a_l5 and hpct >= apct)) else a
        dog_c = a if fav_c == h else h
        rawC = False
        rawB = False
        rawA = False
        final_pk = ""
        final_sub = v19_sub
        if v19_sig:
            pk = v19_pk
            ish = (pk == h)
            opp = a if ish else h
            p_l5 = h_l5 if ish else a_l5
            p_pct = hpct if ish else apct
            p_el5 = e_hl5 if ish else e_al5
            p_1cnt = h_cnt if ish else a_cnt
            p_1sum = h_sum if ish else a_sum
            o_1sum = a_sum if ish else h_sum
            dpyth = (h_pyth - a_pyth) if ish else (a_pyth - h_pyth)
            dw10 = (hw10 - aw10) if ish else (aw10 - hw10)
            tp_both_opp = (tpk == opp and ppk == opp)
            m12_pk = bool(is_m12 and pk_m12 == pk)
            if v19_sub in ("FLIP_A", "GEM_1", "GEM_2", "GEM_3"):
                rawC = True
                rawB = True
                rawA = True
                final_pk = pk
                final_sub = v19_sub
            elif v19_sub == "BASE_17":
                drop_b = in_t34 and (
                    (p_1cnt == 0)
                    or (is_t3 and t_tier != "SLAM" and p_l5 < 78.0)
                    or (day_num <= 15 and dw10 <= 1)
                    or (p_l5 < 78.0 and p_pct < 68.0 and o_1sum < p_1sum)
                    or (p_el5 < 55.0)
                )
                drop_c = drop_b or (in_t34 and t_tier != "SLAM" and ((p_pct < 73.0 and not m12_pk) or dpyth < 12.0))
                drop_a = in_t34 and (
                    (p_1cnt == 0 and o_1sum < p_1sum)
                    or (is_t3 and t_tier != "SLAM" and p_l5 < 76.0)
                    or (day_num <= 15 and dw10 <= 1 and dpyth < 14.0)
                    or (p_el5 < 55.0)
                )
                rawC = not drop_c
                rawB = not drop_b
                rawA = not drop_a
                final_pk = pk
                final_sub = "BASE_17" if (rawC or rawB or rawA) else "DROP_BASE17"
            elif v19_sub == "GEM_4":
                rawC = bool(p_pct >= 78.0 and dw10 >= 2 and not tp_both_opp)
                rawB = bool(p_pct >= 78.0 and not tp_both_opp)
                rawA = bool(p_pct >= 74.0 and dw10 >= 1 and not tp_both_opp)
                final_pk = pk
                final_sub = "GEM_4" if (rawC or rawB or rawA) else "DROP_GEM4"
        elif v19_sub != "DROP_FLIP_B":
            ish_f = (fav_c == h)
            f_pyth = h_pyth if ish_f else a_pyth
            d_pyth = a_pyth if ish_f else h_pyth
            f_w10 = hw10 if ish_f else aw10
            d_w10 = aw10 if ish_f else hw10
            f_gd10 = h_gd10 if ish_f else a_gd10
            d_gd10 = a_gd10 if ish_f else h_gd10
            fav_l5 = h_l5 if ish_f else a_l5
            fav_pct = hpct if ish_f else apct
            fav_bl5 = b_hl5 if ish_f else b_al5
            fav_el5 = e_hl5 if ish_f else e_al5
            fav_trap = htrap_lv if ish_f else atrap_lv
            fav_el = h_el if ish_f else a_el
            if (
                (tpk == dog_c and ppk == dog_c)
                and (d_pyth >= f_pyth - 3.0)
                and (d_w10 - f_w10 >= 3)
                and (d_gd10 - f_gd10 >= 2.5)
            ):
                rawC = True
                rawB = True
                rawA = True
                final_pk = dog_c
                final_sub = "GEM_5H"
            elif (not dual_water) and fav_el != "EARTH" and not (tpk == dog_c and ppk == dog_c):
                m13_ok = bool(is_m13 and pk_m13 == fav_c)
                m14_ok = bool(is_sm14 and pk_sm14 == fav_c)
                m16_ok = bool(is_m16 and pk_m16 == fav_c)
                dw_ok = (f_w10 - d_w10 >= 2)
                c_clean = (fav_trap == 0 and dw_ok)
                titan = (fav_trap > 0 and fav_l5 >= 86.0 and fav_pct >= 84.0 and fav_el5 >= 68.0 and dw_ok)
                gem6_cb = (
                    c_clean
                    and (
                        (fav_l5 >= 82.0 and fav_bl5 >= 75.0 and (f_pyth - d_pyth) >= 14.0 and (m14_ok or m16_ok or fav_pct >= 82.0))
                        or (m13_ok and fav_l5 >= 80.0 and fav_bl5 >= 74.0 and fav_el5 >= 62.0)
                    )
                ) or titan
                gem6_a = (
                    c_clean
                    and (
                        (fav_l5 >= 82.0 and fav_bl5 >= 75.0 and (f_pyth - d_pyth) >= 14.0)
                        or (m13_ok and fav_l5 >= 80.0 and fav_bl5 >= 74.0 and fav_el5 >= 62.0)
                    )
                ) or titan
                if gem6_cb:
                    rawC = True
                    rawB = True
                    rawA = True
                    final_pk = fav_c
                    final_sub = "GEM_6"
                elif gem6_a:
                    rawA = True
                    final_pk = fav_c
                    final_sub = "GEM_6"

        is_C = bool(rawC)
        is_B = bool(is_C or rawB)
        is_A = bool(is_B or rawA)
        veto_orig_pk = base_pk17 or fav_c
        if is_A and final_pk:
            ish_v = (final_pk == h)
            opp_v = a if ish_v else h
            p_l5_v = h_l5 if ish_v else a_l5
            dpyth_v = (h_pyth - a_pyth) if ish_v else (a_pyth - h_pyth)
            o_rk_v = int(sm_meta.get("a_rk" if ish_v else "h_rk", 999))
            tp_both_pk_v = (tpk == final_pk and ppk == final_pk)
            g1_opp_v = (g1_win == opp_v)
            m14_vip_pk_v = bool(is_sm14 and vip_sm14 and pk_sm14 == final_pk)
            veto_4 = (final_sub == "FLIP_A") and bool(is_m5 and pk_dp == opp_v)
            veto_1 = (not tp_both_pk_v) and g1_opp_v and (p_l5_v < 78.0)
            veto_3 = (not m14_vip_pk_v) and (dpyth_v < 10.0) and (o_rk_v <= 35)
            if veto_1 or veto_3:
                veto_orig_pk = final_pk
                final_sub = "VETO_4" if veto_4 else ("VETO_1" if veto_1 else "VETO_3")
                final_pk = ""
                is_C = False
                is_B = False
                is_A = False
        v20_grade = "C" if is_C else ("B" if is_B else ("A" if is_A else ""))
        sig17 = is_B
        vip_m17 = is_C
        pk_m17 = final_pk if is_A else ""
        m17_sub = final_sub
        m17_orig_pick = veto_orig_pk

    return {
        "dual_pillar":     {"sig": is_dual_pillar, "vip": is_vip_cross, "pick": pk_dp},
        "vip_cross":       {"sig": is_vip_cross,   "vip": is_diamond,   "pick": pk_vip},
        "astro_lock":      {"sig": is_astro_lock,  "vip": bool(is_astro_lock and is_vip_cross), "pick": pk_ast},
        "diamond":         {"sig": is_diamond,     "vip": is_diamond,   "pick": pk_dia},
        "geo_1xxx_lock":   {"sig": is_m5,          "vip": bool(is_vip_cross and g1_win == pk_vip), "pick": pk_dp},
        "double_pwr_lock": {"sig": is_m6,          "vip": bool(is_vip_cross and g1_win == pk_vip and all_win == pk_vip), "pick": pk_dp},
        "earth_neg_lock":  {"sig": is_m7,          "vip": bool(is_m7 and is_vip_cross), "pick": pk_dp},
        "safe_dl_core":    {"sig": is_m8,          "vip": is_m7,        "pick": pk_m8},
        "pos_inv_lock":    {"sig": is_m9,          "vip": is_m7,        "pick": pk_m9},
        "gf_fin_pure":     {"sig": True,           "vip": bool(abs(h_gf - a_gf) >= 10.0), "pick": pk_m10},
        "tri_gf_routed":   {"sig": is_m11,         "vip": bool(is_m11 and triple3_win == pk_m11), "pick": pk_m11},
        "tri_gf_ultralock":{"sig": is_m12,         "vip": bool(is_m12 and is_m9), "pick": pk_m12},
        "anti_nobet_smart":{"sig": is_m13,         "vip": vip_m13,      "pick": pk_m13},
        "total_elem_12":   {"sig": base_m14_sig,   "vip": bool(base_m14_sig and (h_lead_cnt == 3 or a_lead_cnt == 3)), "pick": base_m14_pick},
        "smart_elem_14":   {"sig": is_sm14,        "vip": vip_sm14,     "pick": pk_sm14},
        "fusion4_elem":    {"sig": is_m15,         "vip": vip_m15,      "pick": pk_m15},
        "referee6_ranked": {"sig": is_m16,         "vip": vip_m16,      "pick": pk_m16},
        "mode17":          {
            "sig": sig17,
            "vip": vip_m17,
            "pick": pk_m17 if (sig17 or profile_key == "c_vol") else "",
            "grade": v20_grade,
            "sub": m17_sub,
            "orig_pick": m17_orig_pick,
            "sig_c": is_C,
            "sig_b": is_B,
            "sig_a": is_A,
        },
        "mode17_c":        {"sig": is_C, "vip": is_C, "pick": pk_m17 if is_C else "", "grade": v20_grade if is_C else "", "sub": m17_sub},
        "mode17_b":        {"sig": is_B, "vip": is_C, "pick": pk_m17 if is_B else "", "grade": v20_grade if is_B else "", "sub": m17_sub},
        "mode17_a":        {"sig": is_A, "vip": is_B, "pick": pk_m17 if is_A else "", "grade": v20_grade if is_A else "", "sub": m17_sub},
    }
