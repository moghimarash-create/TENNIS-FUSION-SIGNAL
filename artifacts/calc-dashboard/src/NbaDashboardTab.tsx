import { useState, useEffect, useCallback, useMemo, useRef, Fragment } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, RefreshCw } from "lucide-react";
import { SHARD_BUILD_VERSION, type PowerProfileKey } from "./tennis-config";

// ---------------------------------------------------------------------------
// NHL 2010-2027 ELEMENTAL TWINS (DEG1 = 88 FIXED), DUAL-GEO + DECAN & KALSHI
// Exact 1-to-1 Visual & Interactive Layout Match of NbaWinnerPredictorPanel
// ---------------------------------------------------------------------------

const NBA_TEAM_KALSHI_MAP: Record<string, string> = {
  "atlanta hawks": "ATL",
  "boston celtics": "BOS",
  "brooklyn nets": "BKN",
  "charlotte hornets": "CHA",
  "chicago bulls": "CHI",
  "cleveland cavaliers": "CLE",
  "dallas mavericks": "DAL",
  "denver nuggets": "DEN",
  "detroit pistons": "DET",
  "golden state warriors": "GSW",
  "houston rockets": "HOU",
  "indiana pacers": "IND",
  "los angeles clippers": "LAC",
  "la clippers": "LAC",
  "los angeles lakers": "LAL",
  "memphis grizzlies": "MEM",
  "miami heat": "MIA",
  "milwaukee bucks": "MIL",
  "minnesota timberwolves": "MIN",
  "new orleans pelicans": "NOP",
  "new york knicks": "NYK",
  "oklahoma city thunder": "OKC",
  "orlando magic": "ORL",
  "philadelphia 76ers": "PHI",
  "phoenix suns": "PHX",
  "portland trail blazers": "POR",
  "sacramento kings": "SAC",
  "san antonio spurs": "SAS",
  "toronto raptors": "TOR",
  "utah jazz": "UTA",
  "washington wizards": "WAS",
};

function elemCodeFromFinal4(el12: string[]): string {
  if (!el12 || el12.length < 8) return "";
  return el12
    .slice(4, 8)
    .map((s) => {
      const n = parseInt(String(s ?? "").trim().split(/\s+/)[0] ?? "0", 10);
      return Number.isFinite(n) && Math.abs(n) % 2 === 1 ? "1" : "0";
    })
    .join("");
}

async function apiRpcFetch(apiPath: string, init?: RequestInit): Promise<Response> {
  const rpcPath = apiPath.startsWith("/api/")
    ? "/fusion-rpc/" + apiPath.slice(5)
    : apiPath;
  const r = await fetch(rpcPath, init);
  const ct = r.headers.get("content-type") ?? "";
  if (r.status === 404 && !ct.includes("application/json") && rpcPath !== apiPath) {
    return fetch(apiPath, init);
  }
  return r;
}

async function apiRpcJson(apiPath: string, init?: RequestInit): Promise<any> {
  try {
    const r = await apiRpcFetch(apiPath, init);
    const txt = await r.text();
    try {
      const parsed = JSON.parse(txt);
      if (!r.ok && parsed && typeof parsed === "object" && parsed.ok === undefined) {
        return { ok: false, error: parsed.error ?? parsed.message ?? `HTTP ${r.status}`, ...parsed };
      }
      return parsed;
    } catch {
      return {
        ok: false,
        error: `خطای ارتباط با سرور Kalshi (HTTP ${r.status}): پاسخ معتبر JSON دریافت نشد.`,
      };
    }
  } catch (err) {
    return {
      ok: false,
      error: `خطای شبکه در ارتباط با سرور Kalshi: ${(err as Error)?.message ?? String(err)}`,
    };
  }
}

type NbaGamePred = {
  n: number;
  day: string;
  d: string;
  ts?: string;
  ym: string;
  s: string;
  h: string;
  a: string;
  sc: string;
  pw: string;
  aw: string;
  st: "WIN" | "LOSS" | "PENDING";
  ph: boolean;
  vm6: number;
  v: number[];
  nd: number;
  b137: boolean;
  n80: boolean;
  e80: boolean;
  q80: boolean;
  g83: boolean;
  tier: string;
  qdeg: [string, string];
  qfin: [string, string];
  qdec: [string, string];
  qdecf: [string, string];
  qtot: [string, string];
  qp2: [string, string];
  gd: [string, string];
  rul: [string, string];
  qnam: [string, string];
  cf: number[];
  // 5-Method Fusion fields:
  mv?: [number, number, number, number, number];
  f30?: number;
  a25?: number;
  ag5?: number;
  fpw?: string;
  fst?: "WIN" | "LOSS" | "PENDING";
  ftier?: string;
  f16?: boolean;
  f14?: boolean;
  f12?: boolean;
  fa14?: boolean;
  astro9?: boolean;
  fa8?: boolean;
  // 2010-2026 Elemental Twins fields (GOLD-FORMULA-PRIORITY engine):
  twMode?: string;
  twVotes?: string;
  twPct?: string;
  twWin?: string;
  f5Full?: string;
  f5Loo?: string;
  tp?: [number, number, number];
  twAgree?: boolean;
  twPath?: string;
  twPeers?: string[];
  twDiamond?: boolean;
  twGolden?: boolean;
  twVip?: boolean;
  twActive?: boolean;
  twF5_5?: boolean;
  twF5_4?: boolean;
  h_12?: string[];
  h_geo?: string;
  h_geo_dyn?: string;
  h_geo_tab?: string;
  a_12?: string[];
  a_geo?: string;
  a_geo_dyn?: string;
  a_geo_tab?: string;
  hc?: string;
  ac?: string;
  tour?: string;
  tourney?: string;
  city?: string;
  surface?: string;
  rnd?: string;
  h_ioc?: string;
  a_ioc?: string;
  deg1?: number;
  hp?: number;
  ap?: number;
  done?: boolean;
  hw?: boolean | null;
  venue?: string;
  sh_d?: string;
  sh_m?: string;
  deg?: number[];
  f1?: boolean;
  s_new?: boolean;
  vip?: boolean;
  s_a1?: boolean;
  a1_veto?: boolean;
  new_veto?: boolean;
  chan?: string;
  twins?: [string, string, string, number, number, number][];
  idx3?: {
    st: number[];
    gf: number[];
    gd: number[];
    gt?: number[];
    tw: number[];
    vh: number;
    va: number;
    nat: number;
    minD: number;
  };
  f1_idx?: boolean;
  f1_guard?: boolean;
  f1_wtp?: boolean;
  vip_idx3?: boolean;
  idx_rescue?: boolean;
  f1_union?: boolean;
  f1_wtp_day?: boolean;
  vip_idx3_day?: boolean;
  f1_union_day?: boolean;
  sys_win?: string;
  b2b_tag?: string;
  is_nat?: boolean;
  trap_tag?: string;
  tier_pct?: number;
  max_buy_c?: number;
  h_players?: {
    pid: string;
    fn: string;
    jn: string;
    no: string;
    pos: string;
    st: boolean;
    mpg: number;
    d2: number;
    d3: number;
    ep: string;
    ef: string;
    gf?: string;
    gf_fin?: number;
    qf: string;
    dec: string;
    pwr: number;
  }[];
  a_players?: {
    pid: string;
    fn: string;
    jn: string;
    no: string;
    pos: string;
    st: boolean;
    mpg: number;
    d2: number;
    d3: number;
    ep: string;
    ef: string;
    gf?: string;
    gf_fin?: number;
    qf: string;
    dec: string;
    pwr: number;
  }[];
  h_out?: string[];
  a_out?: string[];
  fusion_meta?: {
    mode: string;
    tier: "DIAMOND" | "GOLD_VIP" | "SILVER_CORE" | "VETOED" | "NONE";
    tier_fa: string;
    driver: "BOTH" | "TEAM" | "PLAYER";
    in_auth_overlap: boolean;
    vetoed: boolean;
    modes: Record<string, { sig: boolean; vip: boolean; pick: string }>;
    team: { pick: string; votes: string; pct: string; f30: number; ch: string; sig: boolean; vip: boolean; guard?: boolean; guard_sym?: boolean; nat?: boolean; vh?: number; va?: number; minD?: number; deg2: number; deg3: number };
    player: { pick: string; votes: string; pct: string; f30: number; ch: string; sig: boolean; vip: boolean; guard?: boolean; guard_sym?: boolean; nat?: boolean; vh?: number; va?: number; minD?: number };
    geo1xxx?: {
      h_sum: number;
      a_sum: number;
      h_cnt: number;
      a_cnt: number;
      h_0xxx?: number;
      a_0xxx?: number;
      h_0cnt?: number;
      a_0cnt?: number;
      cold0_diff?: number;
      cold0_win?: string;
      h_0011?: number;
      a_0011?: number;
      h_0011_cnt?: number;
      a_0011_cnt?: number;
      c0011_win?: string;
      bipolar_win?: string;
      triple_pole_win?: string;
      pole_clash?: boolean;
      cold_tame_pi?: boolean;
      cold_tame_win?: string;
      h_all: number;
      a_all: number;
      h_gf?: number;
      a_gf?: number;
      gf_diff?: number;
      gf_win?: string;
      h_s3?: number;
      a_s3?: number;
      s3_diff?: number;
      s3_win?: string;
      s3_sign_split?: boolean;
      s3_split_win?: string;
      maj23_win?: string;
      triple3_win?: string;
      gf_rescued?: boolean;
      gap3_h?: number;
      m11_route?: {
        code: string;
        reason_fa: string;
        flipped: boolean;
      };
      m12_route?: {
        code: string;
        reason_fa: string;
        flipped: boolean;
      };
      diff: number;
      win: string;
      all_win?: string;
      dl_win?: string;
      safe_dl_win?: string;
      pos_inv?: {
        both_pos: boolean;
        triggered: boolean;
        win: string;
        case_code: string;
        dc: number;
        d1: number;
        l5_big: number;
        reason_fa: string;
      };
      guards?: {
        eval_team: string;
        el_wk: string;
        el_dy: string;
        opp_el_wk: string;
        opp_el_dy: string;
        l5_wk: number;
        l5_dy: number;
        earth_ok: boolean;
        has_neg: boolean;
        margin_ok: boolean;
        neg_anchor_ok: boolean;
        pos_inv_trap?: boolean;
        d1: number;
        d8: number;
        safe_ok: boolean;
        reason_fa: string;
      };
    };
    total_elem_12?: {
      h_cnt12: number;
      a_cnt12: number;
      h_cnt1?: number;
      a_cnt1?: number;
      h_cnt0?: number;
      a_cnt0?: number;
      h_cnt0011?: number;
      a_cnt0011?: number;
      h_w_gff?: number;
      a_w_gff?: number;
      h_c_gff?: number;
      a_c_gff?: number;
      h_c0011_gff?: number;
      a_c0011_gff?: number;
      h_s_gff?: number;
      a_s_gff?: number;
      h_d_gff?: number;
      a_d_gff?: number;
      h_w_pwr?: number;
      a_w_pwr?: number;
      h_c_pwr?: number;
      a_c_pwr?: number;
      h_s_pwr?: number;
      a_s_pwr?: number;
      h_d_pwr?: number;
      a_d_pwr?: number;
      h_ep_p12: number[];
      a_ep_p12: number[];
      h_ep_tm: number[];
      a_ep_tm: number[];
      h_ep_tot: number[];
      a_ep_tot: number[];
      h_ef_tot: number[];
      a_ef_tot: number[];
      h_gf_p12: string;
      a_gf_p12: string;
      h_gff_p12: number;
      a_gff_p12: number;
      h_gf_tot: string;
      a_gf_tot: string;
      h_gff_tot: number;
      a_gff_tot: number;
      h_qtot: number;
      a_qtot: number;
      code?: string;
      reason_fa?: string;
      flipped?: boolean;
      h_tm_ent?: { ep: string; ef: string; gf: string; gff: number; pwr: number };
      a_tm_ent?: { ep: string; ef: string; gf: string; gff: number; pwr: number };
      h_p12?: { fn: string; no: string; pos: string; st: boolean; mpg: number; ep: string; ef?: string; gf: string; gff?: number; pwr?: number }[];
      a_p12?: { fn: string; no: string; pos: string; st: boolean; mpg: number; ep: string; ef?: string; gf: string; gff?: number; pwr?: number }[];
    };
  };
  wtp?: {
    mon: string;
    htp: number;
    atp: number;
    dtp: number;
    hrk: number;
    ark: number;
    hwl: string;
    awl: string;
    hpct?: number;
    apct?: number;
    hel?: string;
    ael?: string;
    l5h?: number;
    hodds?: number;
    aodds?: number;
    mel?: string;
    htrap?: number;
    atrap?: number;
    profileKey?: PowerProfileKey;
  };
  st_meta?: {
    h_wl: string;
    a_wl: string;
    h_rk: number;
    a_rk: number;
    n_act: number;
    h_l10: string;
    a_l10: string;
    h_pyth: number;
    a_pyth: number;
  };
  pwr_p?: Record<
    PowerProfileKey,
    {
      hpct: number;
      apct: number;
      l5h: number;
      hel: string;
      ael: string;
      htrap?: number;
      atrap?: number;
    }
  >;
  wtp_day?: {
    mon: string;
    htp: number;
    atp: number;
    dtp: number;
    hrk: number;
    ark: number;
    hwl: string;
    awl: string;
    hpct?: number;
    apct?: number;
    hel?: string;
    ael?: string;
    l5h?: number;
    hodds?: number;
    aodds?: number;
    mel?: string;
  };
};

type HistGameRow = {
  d: string;
  day: string;
  s: string;
  h: string;
  a: string;
  hp: number;
  ap: number;
  mg: number;
  h12: string[];
  hGeo: string;
  a12: string[];
  aGeo: string;
  f30: number;
  hGeoDyn?: string;
  aGeoDyn?: string;
  hGeoTab?: string;
  aGeoTab?: string;
};

type ManualFilterState = {
  cols: Record<number, string>; // 0..11 -> selected value or "ALL"
  geo: string;                  // "ALL" or 4-bit code (GEO-FIN / GEO-DYN)
  geoTab?: string;              // "ALL" or 4-bit Daily Standings Geomantic Figure (GEO-TAB)
  geoKind?: "fin" | "dyn";      // per-game GEO-FIN vs GEO-DYN channel
  modeLabel?: string;
  pathLog?: string[];
  stepSummary?: string;
  geoSummary?: string;
};

type PoolNumIndex = {
  hw: number;
  aw: number;
  idxH: number;
  idxA: number;
  delta: number;
  effDelta: number;
  scoreH: number;
  scoreA: number;
  scoreDelta: number;
  formulaH: string;
  formulaA: string;
  cappedH: boolean;
  cappedA: boolean;
  winner: "HOME" | "AWAY" | "TIE";
};

function computePoolNumIndex(rows: HistGameRow[]): PoolNumIndex {
  const rawH = rows.filter((r) => r.mg > 0).map((r) => Math.abs(r.mg));
  const rawA = rows.filter((r) => r.mg < 0).map((r) => Math.abs(r.mg));
  const capH = rawH.map((m) => Math.min(5, Math.max(1, Math.ceil(m / 4))));
  const capA = rawA.map((m) => Math.min(5, Math.max(1, Math.ceil(m / 4))));
  const hw = capH.length;
  const aw = capA.length;
  const cappedH = rawH.some((m) => m > 20);
  const cappedA = rawA.some((m) => m > 20);

  let idxH = 0;
  let formulaH = "0";
  if (hw === 1) {
    idxH = capH[0];
    formulaH = `1×(+${capH[0]})${cappedH ? "[≤5]" : ""}`;
  } else if (hw >= 2) {
    const mn = Math.min(...capH);
    const mx = Math.max(...capH);
    idxH = mx + mn;
    formulaH = `${mn}+${mx}${cappedH ? "[≤5]" : ""}`;
  }

  let idxA = 0;
  let formulaA = "0";
  if (aw === 1) {
    idxA = capA[0];
    formulaA = `1×(-${capA[0]})${cappedA ? "[≤5]" : ""}`;
  } else if (aw >= 2) {
    const mn = Math.min(...capA);
    const mx = Math.max(...capA);
    idxA = mx + mn;
    formulaA = `(-${mx})+(-${mn})${cappedA ? "[≤5]" : ""}`;
  }

  const delta = idxH - idxA;
  const scoreH = 2 * hw + idxH;
  const scoreA = 2 * aw + idxA;
  const scoreDelta = scoreH - scoreA;
  const effDelta =
    delta > 0 && scoreDelta > 0
      ? delta
      : delta < 0 && scoreDelta < 0
        ? delta
        : delta === 0 && Math.abs(scoreDelta) >= 2
          ? scoreDelta > 0
            ? 1
            : -1
          : 0;
  const winner: "HOME" | "AWAY" | "TIE" = effDelta > 0 ? "HOME" : effDelta < 0 ? "AWAY" : "TIE";

  return {
    hw,
    aw,
    idxH,
    idxA,
    delta,
    effDelta,
    scoreH,
    scoreA,
    scoreDelta,
    formulaH,
    formulaA,
    cappedH,
    cappedA,
    winner,
  };
}

const MANUAL_COL_META: { idx: number; key: string; group: string; sub: string }[] = [
  { idx: 0,  key: "PRIM-1",  group: "ELE-DYN (P+FIN)", sub: "FIRE" },
  { idx: 1,  key: "PRIM-2",  group: "ELE-DYN (P+FIN)", sub: "AIR" },
  { idx: 2,  key: "PRIM-3",  group: "ELE-DYN (P+FIN)", sub: "WATER" },
  { idx: 3,  key: "PRIM-4",  group: "ELE-DYN (P+FIN)", sub: "EARTH" },
  { idx: 4,  key: "FINAL-1", group: "ELE-FINAL",       sub: "FIRE" },
  { idx: 5,  key: "FINAL-2", group: "ELE-FINAL",       sub: "AIR" },
  { idx: 6,  key: "FINAL-3", group: "ELE-FINAL",       sub: "WATER" },
  { idx: 7,  key: "FINAL-4", group: "ELE-FINAL",       sub: "EARTH" },
  { idx: 8,  key: "ELE-P-1", group: "ELE-P",           sub: "FIRE" },
  { idx: 9,  key: "ELE-P-2", group: "ELE-P",           sub: "AIR" },
  { idx: 10, key: "ELE-P-3", group: "ELE-P",           sub: "WATER" },
  { idx: 11, key: "ELE-P-4", group: "ELE-P",           sub: "EARTH" },
];

function decodeGeoTabFa(code: string): string {
  if (!code || code.length < 4) return "شکل رمل جدول روزانه";
  const tierFa = (b1: string, b2: string) =>
    b1 === "1" ? "سید برتر" : b2 === "1" ? "میانه رنکینگ" : "پایین‌تر";
  return `بازیکن ۱: ${tierFa(code[0], code[1])} | بازیکن ۲: ${tierFa(code[2], code[3])}`;
}

function computeAutoFilterState(
  targetEl12: string[],
  targetGeo: string,
  dayPool: HistGameRow[],
  persp: "home" | "away",
  geoFirst: boolean,
  geoKind: "fin" | "dyn" | "tab" = "fin"
): {
  state: ManualFilterState;
  pool: HistGameRow[];
  unslicedPool: HistGameRow[];
  isNatural57: boolean;
  hw: number;
  aw: number;
  pct: number;
  mv: number;
  sumStr: string;
} {
  let pool = [...dayPool];
  const cols: Record<number, string> = {};
  let geo = "ALL";
  let geoTab = "ALL";
  const pathLog: string[] = [];

  const getEl12 = (r: HistGameRow) => (persp === "home" ? r.h12 : r.a12);
  const getGeo = (r: HistGameRow) =>
    geoKind === "tab"
      ? persp === "home"
        ? r.hGeoTab ?? ""
        : r.aGeoTab ?? ""
      : persp === "home"
        ? geoKind === "dyn"
          ? r.hGeoDyn ?? r.hGeo
          : r.hGeo
        : geoKind === "dyn"
          ? r.aGeoDyn ?? r.aGeo
          : r.aGeo;

  const geoLabel = geoKind === "tab" ? "GEO-TAB" : geoKind === "dyn" ? "GEO-DYN" : "GEO-FIN";

  if (geoFirst && targetGeo) {
    const nxtGeo = pool.filter((r) => getGeo(r) === targetGeo);
    if (nxtGeo.length >= 5) {
      pool = nxtGeo;
      if (geoKind === "tab") geoTab = targetGeo;
      else geo = targetGeo;
      pathLog.push(`${geoLabel}=${targetGeo} (${pool.length})`);
    }
  }

  // STRICT 5-TO-7 ROWS RULE:
  // Stop immediately when pool has 5 to 7 rows (5 <= pool.length <= 7), and never narrow below 5 rows (cnt >= 5).
  while (pool.length > 7) {
    let bestC: number | null = null;
    let bestCnt = -1;
    let bestNxt: HistGameRow[] = [];

    for (let c = 0; c < 12; c++) {
      if (cols[c] && cols[c] !== "ALL") continue;
      const tVal = targetEl12[c];
      if (!tVal) continue;
      const nxt = pool.filter((r) => getEl12(r)[c] === tVal);
      const cnt = nxt.length;
      if (cnt >= 5 && cnt < pool.length && cnt > bestCnt) {
        bestCnt = cnt;
        bestC = c;
        bestNxt = nxt;
      }
    }

    if (bestC === null) break;
    cols[bestC] = targetEl12[bestC];
    pool = bestNxt;
    pathLog.push(`${MANUAL_COL_META[bestC].key}=${targetEl12[bestC]} (${pool.length})`);
    if (pool.length >= 5 && pool.length <= 7) break;
  }

  if (!geoFirst && geo === "ALL" && geoTab === "ALL" && targetGeo && pool.length > 7) {
    const nxtGeo = pool.filter((r) => getGeo(r) === targetGeo);
    if (nxtGeo.length >= 5 && nxtGeo.length <= 7) {
      pool = nxtGeo;
      if (geoKind === "tab") geoTab = targetGeo;
      else geo = targetGeo;
      pathLog.push(`${geoLabel}=${targetGeo} (${pool.length})`);
    }
  }

  const unslicedPool = [...pool];
  const isNatural57 = unslicedPool.length >= 5 && unslicedPool.length <= 7;

  if (pool.length > 7) {
    pool = pool.slice(-7);
    pathLog.push(`RANK_CAP(7/${unslicedPool.length})`);
  }

  const hw = pool.filter((r) => r.mg > 0).length;
  const aw = pool.filter((r) => r.mg < 0).length;
  const tot = Math.max(1, hw + aw);
  const pct = Math.round((Math.max(hw, aw) / tot) * 1000) / 10;
  const mv = Math.abs(hw - aw);
  const sumStr = `${hw}H-${aw}A (${pct}%)`;

  return {
    state: {
      cols,
      geo,
      geoTab,
      geoKind: geoKind === "tab" ? "fin" : geoKind,
      modeLabel: geoFirst
        ? geoKind === "tab"
          ? "اول شکل رمل جدول روزانه (GEO-TAB)"
          : geoKind === "dyn"
            ? "اول شکل رمل پویا (GEO-DYN)"
            : "اول شکل رمل اصلاحی (GEO-FIN)"
        : "گام‌به‌گام بیشترین تکرار (STEP)",
      pathLog,
    },
    pool,
    unslicedPool,
    isNatural57,
    hw,
    aw,
    pct,
    mv,
    sumStr,
  };
}

function computeThreeChannelIndex(
  t12: string[],
  tGeoFin: string,
  tGeoDyn: string,
  dayPool: HistGameRow[],
  persp: "home" | "away",
  tGeoTab: string = ""
) {
  const step = computeAutoFilterState(t12, tGeoFin, dayPool, persp, false, "fin");
  const geoFin = computeAutoFilterState(t12, tGeoFin, dayPool, persp, true, "fin");
  const geoDyn = computeAutoFilterState(t12, tGeoDyn, dayPool, persp, true, "dyn");
  const geoTab = computeAutoFilterState(t12, tGeoTab, dayPool, persp, true, "tab");

  const idxSt = computePoolNumIndex(step.pool);
  const idxGf = computePoolNumIndex(geoFin.pool);
  const idxGd = computePoolNumIndex(geoDyn.pool);
  const idxGt = computePoolNumIndex(geoTab.pool);

  const chList = [idxSt, idxGf, idxGd, idxGt];
  const votesHome = chList.filter((c) => c.effDelta > 0).length;
  const votesAway = chList.filter((c) => c.effDelta < 0).length;
  const natCount = [step, geoFin, geoDyn, geoTab].filter((c) => c.isNatural57).length;
  const minDelta = Math.min(idxSt.effDelta, idxGf.effDelta, idxGd.effDelta, idxGt.effDelta);
  const maxDelta = Math.max(idxSt.effDelta, idxGf.effDelta, idxGd.effDelta, idxGt.effDelta);
  const totalScoreDelta = idxSt.scoreDelta + idxGf.scoreDelta + idxGd.scoreDelta + idxGt.scoreDelta;
  const consensusWinner: "HOME" | "AWAY" | "TIE" =
    votesHome > votesAway ? "HOME" : votesAway > votesHome ? "AWAY" : "TIE";

  const avgDelta = Math.round(((idxSt.effDelta + idxGf.effDelta + idxGd.effDelta + idxGt.effDelta) / 4) * 10) / 10;
  const unanimous = votesHome === 4 || votesAway === 4;

  return {
    step,
    geoFin,
    geoDyn,
    geoTab,
    idxSt,
    idxGf,
    idxGd,
    idxGt,
    votesHome,
    votesAway,
    homeVotes: votesHome,
    awayVotes: votesAway,
    natCount,
    minDelta,
    maxDelta,
    avgDelta,
    unanimous,
    totalScoreDelta,
    consensusWinner,
    favSide: consensusWinner,
  };
}

type EngineMode = "manual" | "twins" | "fusion" | "single";
type TwinPatternKey =
  | "twVipIdx3"
  | "twF1Wtp"
  | "twF1Guard"
  | "twF1Idx"
  | "twF1Union"
  | "twVipDual"
  | "twF1"
  | "twSNew"
  | "twF1Agree"
  | "twSA1"
  | "tall";
type FusionPatternKey = "f12" | "f8" | "f6" | "fa10" | "fall";
type SinglePatternKey = "s1_vip" | "s1_f1" | "s1_guard" | "all";

const TWIN_PATTERN_DEFS: {
  key: TwinPatternKey;
  titleFa: string;
  titleEn: string;
  formulaFa: string;
}[] = [
  {
    key: "twVipIdx3",
    titleFa: "سطح ویژه VIP موتور تلفیقی فعال (ابرقفل FIRE / تایید دوگانه)",
    titleEn: "Active Fusion Engine — VIP Tier Signals",
    formulaFa: "سیگنال‌های سطح ویژه VIP در معماری موتور تلفیقی انتخاب‌شده در نوار بالا (واکنش آنی به هر ۱۲ حالت تلفیق)",
  },
  {
    key: "twF1Wtp",
    titleFa: "سیگنال‌های نهایی موتور تلفیقی تنیس (ATP / WTA)",
    titleEn: "Active Tennis Fusion Engine — Qualified Final Signals",
    formulaFa: "تمام سیگنال‌های نهایی تاییدشده توسط موتور تلفیقی انتخاب‌شده در نوار بالا (شامل ۱xxx، ΣAll، GF-FIN، Σ3 و قوانین ضدحذف)",
  },
  {
    key: "twF1Guard",
    titleFa: "نگهبان تله‌های درونی بدون فیلتر قدرت پایه هفتگی",
    titleEn: "Tennis Internal Trap Guard Only",
    formulaFa: "حذف تله‌های درونی و مخالفت شاخص ۳ کاناله بدون اعمال فیلتر قدرت پایه هفتگی",
  },
  {
    key: "twF1Idx",
    titleFa: "تلفیق پایه همزاد + شاخص عددی پایه (Idx هم‌جهت)",
    titleEn: "Tennis Base Twin + Numerical Index Filter",
    formulaFa: "واجد شرایط همزاد ۵ تا ۷ ردیف هم‌جهت با Fusion 30 به شرط هم‌جهت بودن شاخص عددی استخر تاریخی تنیس",
  },
  {
    key: "twF1Union",
    titleFa: "اتحاد سیستم نهایی تنیس + نجات شاخص ۳ کاناله (اجماع ۳/۳)",
    titleEn: "Tennis Final System UNION 3-Channel Index Rescue",
    formulaFa: "اتحاد سیستم نهایی تنیس با مسابقات دارای اجماع ۳ از ۳ شاخص عددی مستقل (STEP + GEO-FIN + GEO-DYN)",
  },
  {
    key: "tall",
    titleFa: "۶. کل مسابقات مسیر‌یابی‌شده با موتور فعال (بدون حذف مسابقه)",
    titleEn: "All Routed Tennis Matches Under Active Engine (Zero-Drop)",
    formulaFa: "نمایش برد و باخت تمام مسابقات تنیس بر اساس منتخب مستقیم یا مسیر برنده ضدحذف موتور تلفیقی فعال (۱xxx • ΣAll • GF-FIN • Σ3)",
  },
];

const FUSION_PATTERN_DEFS = TWIN_PATTERN_DEFS as any;
const SINGLE_PATTERN_DEFS = TWIN_PATTERN_DEFS as any;

const DAILY_QUICK_DATES = [
  { label: "All Dates (همه روزها)", date: "ALL" },
  { label: "2026-11-04 (Wed • 14 Games)", date: "2026-11-04" },
  { label: "2026-11-06 (Fri • 9 Games)", date: "2026-11-06" },
  { label: "2026-11-12 (Thu • 4 Games)", date: "2026-11-12" },
  { label: "2026-11-13 (Fri • 9 Games)", date: "2026-11-13" },
  { label: "2026-11-14 (Sat • 5 Games)", date: "2026-11-14" },
  { label: "2026-11-15 (Sun • 9 Games)", date: "2026-11-15" },
  { label: "2026-11-16 (Mon • 8 Games)", date: "2026-11-16" },
];

const KALSHI_MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

function getPlayerLastName(playerName: string): string {
  const clean = (playerName || "").replace(/\s*\(EL:.*$/, "").trim();
  if (!clean) return "";
  const parts = clean.split(/\s+/);
  return parts.length > 1 ? parts.slice(1).join(" ") : parts[0];
}

function getTeam3Code(teamName: string): string {
  const clean = (teamName || "").replace(/\s*\(EL:.*$/, "").trim();
  if (!clean) return "";
  const last = getPlayerLastName(clean);
  const alpha = last.normalize("NFKD").replace(/[^A-Za-z]/g, "");
  if (alpha.length >= 3) return alpha.slice(0, 3).toUpperCase();
  const fullAlpha = clean.normalize("NFKD").replace(/[^A-Za-z]/g, "");
  return (fullAlpha || clean).slice(0, 3).toUpperCase();
}

function buildKalshiNbaTicker(
  dateStr: string,
  awayTeam: string,
  homeTeam: string,
  winnerTeam: string,
  tour: "ATP" | "WTA" = "ATP",
): string {
  const parts = dateStr.split("-");
  if (parts.length !== 3) return "";
  const yy = parts[0].slice(-2);
  const mmIdx = Math.max(0, Math.min(11, parseInt(parts[1], 10) - 1));
  const mmm = KALSHI_MONTHS[mmIdx];
  const dd = parts[2];
  const aCode = getTeam3Code(awayTeam);
  const hCode = getTeam3Code(homeTeam);
  const wCode = getTeam3Code(winnerTeam);
  const series = tour === "WTA" ? "KXWTAMATCH" : "KXATPMATCH";
  return `${series}-${yy}${mmm}${dd}${aCode}${hCode}-${wCode}`;
}

export type FusionModeKey =
  | "mode17"
  | "tri_gf_ultralock"
  | "anti_nobet_smart"
  | "total_elem_12"
  | "fusion4_elem"
  | "referee6_ranked"
  | "tri_gf_routed"
  | "pos_inv_lock"
  | "dual_pillar"
  | "vip_cross"
  | "astro_lock"
  | "diamond"
  | "geo_1xxx_lock"
  | "double_pwr_lock"
  | "earth_neg_lock"
  | "safe_dl_core"
  | "gf_fin_pure";
export type TwinDbKind = "team" | "player";

export type SmartMode14Kind =
  | "M14_CORE_CLEAN"
  | "M14_DIRECT_RELEASE"
  | "M14_OPPOSITE_FLIP"
  | "M14_TRAP_FLIP"
  | "M14_VETO_TRAP"
  | "M14_HOLD_NEUTRAL";

function calcDominantElemVec(vec?: number[]) {
  const names = ["FIRE", "AIR", "WATER", "EARTH"] as const;
  const v = Array.isArray(vec) && vec.length === 4 ? vec.map((x) => Number(x || 0)) : [0, 0, 0, 0];
  const mx = Math.max(...v);
  if (mx <= 0) return { dom: "—", maxCnt: 0, vec: v, isTie: true, vecStr: "0-0-0-0" };
  const winners = names.filter((_, i) => v[i] === mx);
  const dom = winners.length === 1 ? winners[0] : `TIE(${winners.map((w) => w[0]).join("+")})`;
  return {
    dom,
    maxCnt: mx,
    vec: v,
    isTie: winners.length > 1,
    vecStr: `${v[0]}-${v[1]}-${v[2]}-${v[3]}`,
  };
}

export type ElemFollowUpTier = "STRONG" | "MEDIUM" | "NEUTRAL";

function calcElemFollowUpVerdict(
  hDomInfo: ReturnType<typeof calcDominantElemVec>,
  aDomInfo: ReturnType<typeof calcDominantElemVec>,
  hLeadCnt: number,
  aLeadCnt: number,
  hName: string,
  aName: string,
  hL5: number,
  aL5: number
) {
  const hv = hDomInfo.vec;
  const av = aDomInfo.vec;
  const hSum = hv[0] + hv[1] + hv[2] + hv[3];
  const aSum = av[0] + av[1] + av[2] + av[3];
  const hCat = hDomInfo.isTie ? "TIE" : hDomInfo.dom;
  const aCat = aDomInfo.isTie ? "TIE" : aDomInfo.dom;
  const domDelta = Math.abs(hDomInfo.maxCnt - aDomInfo.maxCnt);
  const airDelta = Math.abs(hv[1] - av[1]);

  let pick = "";
  let oppTrapSide = "";
  let tier: ElemFollowUpTier = "NEUTRAL";
  let ruleCode = "NEUTRAL";
  let ruleTitleFa = "توازن کامل المنت‌ها (بدون برتری عددی)";
  let hLabel = `${hDomInfo.dom} (${hDomInfo.maxCnt})`;
  let aLabel = `${aDomInfo.dom} (${aDomInfo.maxCnt})`;

  // 1) EARTH vs EARTH extreme saturation Δ>=10 -> Smaller EARTH wins
  if (hCat === "EARTH" && aCat === "EARTH" && domDelta >= 10) {
    const hWin = hDomInfo.maxCnt < aDomInfo.maxCnt;
    pick = hWin ? hName : aName;
    oppTrapSide = hWin ? aName : hName;
    tier = "STRONG";
    ruleCode = "EARTH_SAT10_SMALL";
    ruleTitleFa = `اشباع EARTH (Δ=${domDelta}≥10 → برد کوچک‌تر)`;
    hLabel = hWin ? `EARTH کوچک (${hDomInfo.maxCnt})` : `اشباع EARTH (${hDomInfo.maxCnt})`;
    aLabel = !hWin ? `EARTH کوچک (${aDomInfo.maxCnt})` : `اشباع EARTH (${aDomInfo.maxCnt})`;
  }
  // 2) AIR extreme saturation Δ>=8 -> Smaller AIR wins
  else if (airDelta >= 8) {
    const hWin = hv[1] < av[1];
    pick = hWin ? hName : aName;
    oppTrapSide = hWin ? aName : hName;
    tier = "STRONG";
    ruleCode = "AIR_SAT8_SMALL";
    ruleTitleFa = `اشباع AIR (Δ=${airDelta}≥8 → برد کوچک‌تر)`;
    hLabel = hWin ? `AIR سالم (${hv[1]})` : `اشباع AIR (${hv[1]})`;
    aLabel = !hWin ? `AIR سالم (${av[1]})` : `اشباع AIR (${av[1]})`;
  }
  // 3) WATER vs WATER small gap Δ=1..3 -> Smaller WATER wins
  else if (hCat === "WATER" && aCat === "WATER" && domDelta >= 1 && domDelta <= 3) {
    const hWin = hDomInfo.maxCnt < aDomInfo.maxCnt;
    pick = hWin ? hName : aName;
    oppTrapSide = hWin ? aName : hName;
    tier = "STRONG";
    ruleCode = "WATER_1_3_SMALL";
    ruleTitleFa = `۲×WATER (Δ=${domDelta} → برد کوچک‌تر)`;
    hLabel = hWin ? `WATER کوچک (${hDomInfo.maxCnt})` : `تله WATER (${hDomInfo.maxCnt})`;
    aLabel = !hWin ? `WATER کوچک (${aDomInfo.maxCnt})` : `تله WATER (${aDomInfo.maxCnt})`;
  }
  // 4) WATER vs WATER gap Δ>=4 -> Larger WATER wins
  else if (hCat === "WATER" && aCat === "WATER" && domDelta >= 4) {
    const hWin = hDomInfo.maxCnt > aDomInfo.maxCnt;
    pick = hWin ? hName : aName;
    oppTrapSide = hWin ? aName : hName;
    tier = "STRONG";
    ruleCode = "WATER_4_PLUS_LARGE";
    ruleTitleFa = `۲×WATER (Δ=${domDelta}≥4 → برد بزرگ‌تر)`;
    hLabel = hWin ? `WATER بزرگ (${hDomInfo.maxCnt})` : `WATER ضعیف (${hDomInfo.maxCnt})`;
    aLabel = !hWin ? `WATER بزرگ (${aDomInfo.maxCnt})` : `WATER ضعیف (${aDomInfo.maxCnt})`;
  }
  // 5) Dual-Element Balance (TIE) vs Single Dominant Element -> TIE wins
  else if ((hDomInfo.isTie && !aDomInfo.isTie) || (aDomInfo.isTie && !hDomInfo.isTie)) {
    const hWin = hDomInfo.isTie;
    pick = hWin ? hName : aName;
    oppTrapSide = hWin ? aName : hName;
    tier = "STRONG";
    ruleCode = "TIE_VS_UNIQ";
    ruleTitleFa = `تعادل ${hWin ? hDomInfo.dom : aDomInfo.dom} برابر تک‌المنت`;
    hLabel = hWin ? `تعادل ${hDomInfo.dom}` : `تک‌المنت (${hDomInfo.maxCnt})`;
    aLabel = !hWin ? `تعادل ${aDomInfo.dom}` : `تک‌المنت (${aDomInfo.maxCnt})`;
  }
  // 6) EARTH vs EARTH medium-large gap Δ=4..9 -> Larger EARTH wins (STRONG)
  else if (hCat === "EARTH" && aCat === "EARTH" && domDelta >= 4 && domDelta <= 9) {
    const hWin = hDomInfo.maxCnt > aDomInfo.maxCnt;
    pick = hWin ? hName : aName;
    oppTrapSide = hWin ? aName : hName;
    tier = "STRONG";
    ruleCode = "EARTH_4_9_LARGE";
    ruleTitleFa = `۲×EARTH (Δ=${domDelta} → برد بزرگ‌تر)`;
    hLabel = hWin ? `EARTH بزرگ (${hDomInfo.maxCnt})` : `ضعف EARTH (${hDomInfo.maxCnt})`;
    aLabel = !hWin ? `EARTH بزرگ (${aDomInfo.maxCnt})` : `ضعف EARTH (${aDomInfo.maxCnt})`;
  }
  // 7) 3 of 4 Elements Lead -> Leading team wins (MEDIUM)
  else if (hLeadCnt === 3 || aLeadCnt === 3) {
    const hWin = hLeadCnt === 3;
    pick = hWin ? hName : aName;
    tier = "MEDIUM";
    ruleCode = "LEAD_3OF4";
    ruleTitleFa = "برتری ۳ از ۴ عنصر بردار کل [F-A-W-E]";
    hLabel = hWin ? "برتری ۳/۴ ★" : `عقب (${hLeadCnt}/4)`;
    aLabel = !hWin ? "برتری ۳/۴ ★" : `عقب (${aLeadCnt}/4)`;
  }
  // 8) EARTH vs EARTH close gap Δ=1..3 -> Larger EARTH wins (85.2% aligned inside Mode 14)
  else if (hCat === "EARTH" && aCat === "EARTH" && domDelta >= 1 && domDelta <= 3) {
    const hWin = hDomInfo.maxCnt > aDomInfo.maxCnt;
    pick = hWin ? hName : aName;
    tier = "MEDIUM";
    ruleCode = "EARTH_1_3_LARGE";
    ruleTitleFa = `۲×EARTH نزدیک (Δ=${domDelta} → برتری بزرگ‌تر)`;
    hLabel = hWin ? `EARTH برتر (${hDomInfo.maxCnt})` : `EARTH کمتر (${hDomInfo.maxCnt})`;
    aLabel = !hWin ? `EARTH برتر (${aDomInfo.maxCnt})` : `EARTH کمتر (${aDomInfo.maxCnt})`;
  }
  // 9) Split Dominant or Equal-Max Tie -> Larger Total Sum Σ[F-A-W-E] (98.7% total coverage!)
  else if (hSum !== aSum) {
    const hWin = hSum > aSum;
    pick = hWin ? hName : aName;
    tier = "MEDIUM";
    ruleCode = "SPLIT_SUM_LARGE";
    ruleTitleFa = hCat !== aCat
      ? `شکاف المنت + مجموع کل بیشتر (Σ=${Math.max(hSum, aSum)})`
      : `تساوی سقف ${hDomInfo.dom}(${hDomInfo.maxCnt}) → مجموع کل بیشتر (Σ=${Math.max(hSum, aSum)})`;
    hLabel = hWin ? `Σ برتر (${hSum})` : `Σ کمتر (${hSum})`;
    aLabel = !hWin ? `Σ برتر (${aSum})` : `Σ کمتر (${aSum})`;
  }

  const hasPick = Boolean(pick);
  const pickL5 = !hasPick ? 50 : pick === hName ? hL5 : aL5;

  return {
    hasPick,
    pick,
    oppTrapSide,
    tier,
    ruleCode,
    ruleTitleFa,
    hLabel,
    aLabel,
    hSum,
    aSum,
    domDelta,
    airDelta,
    pickL5,
  };
}

function evalSmartMode14(g: NbaGamePred) {
  const fm = g.fusion_meta;
  const m14 = fm?.modes?.total_elem_12;
  const m11 = fm?.modes?.tri_gf_routed;
  const t12 = fm?.total_elem_12;
  const wtp: any = g.wtp ?? {};
  const p = m14?.pick || g.sys_win || g.h;
  const o = p === g.h ? g.a : g.h;
  const l5h = Number(wtp.l5h ?? 50);
  const hL5 = Math.round(l5h * 10) / 10;
  const aL5 = Math.round((100 - l5h) * 10) / 10;
  const pl5 = p === g.h ? hL5 : aL5;
  const ol5 = o === g.h ? hL5 : aL5;
  const code = String(t12?.code ?? "");
  const hWarm = Number(t12?.h_w_gff ?? 0);
  const aWarm = Number(t12?.a_w_gff ?? 0);
  const pWarm = p === g.h ? hWarm : aWarm;
  const hP12 = Number(t12?.h_gff_p12 ?? 0);
  const aP12 = Number(t12?.a_gff_p12 ?? 0);
  const p12FavOpp = o === g.h ? hP12 < aP12 : aP12 < hP12;
  const p12FavBase = p === g.h ? hP12 < aP12 : aP12 < hP12;
  const hSPwr = Number(t12?.h_s_pwr ?? 0);
  const aSPwr = Number(t12?.a_s_pwr ?? 0);
  const spwrFavOpp = o === g.h ? hSPwr < aSPwr : aSPwr < hSPwr;
  const m11Sig = Boolean(m11?.sig);
  const m11Pick = m11?.pick || "";
  const m11DirOpp = Boolean(m11Pick === o);
  const m11FavOpp = Boolean(m11Sig && m11Pick === o);
  const m14Sig = Boolean(m14?.sig);

  // Dominant Element from EF_Tot = [Fire, Air, Water, Earth]
  const hDomInfo = calcDominantElemVec(t12?.h_ef_tot);
  const aDomInfo = calcDominantElemVec(t12?.a_ef_tot);
  const pDomInfo = p === g.h ? hDomInfo : aDomInfo;
  const oDomInfo = o === g.h ? hDomInfo : aDomInfo;
  const hLeadCnt = [0, 1, 2, 3].filter((i) => hDomInfo.vec[i] > aDomInfo.vec[i]).length;
  const aLeadCnt = [0, 1, 2, 3].filter((i) => aDomInfo.vec[i] > hDomInfo.vec[i]).length;
  const pLeadCnt = p === g.h ? hLeadCnt : aLeadCnt;
  const oLeadCnt = o === g.h ? hLeadCnt : aLeadCnt;
  const dualWaterTrap = hDomInfo.dom === "WATER" && aDomInfo.dom === "WATER";
  const domSplit = !hDomInfo.isTie && !aDomInfo.isTie && hDomInfo.dom !== aDomInfo.dom;
  const elemFollow = calcElemFollowUpVerdict(hDomInfo, aDomInfo, hLeadCnt, aLeadCnt, g.h, g.a, hL5, aL5);

  // 3 Pure Numeric & Element-Sum Traps (Symmetric Neutral-Court Tennis!)
  const trapBipolarWeak = Boolean(m14Sig && code === "TOT12_BIPOLAR_HARMONY" && pl5 < 75.0);
  const trapAwayNegWarm = Boolean(m14Sig && pl5 < 50.0 && pWarm < 0);
  const trapDualWater = Boolean(m14Sig && dualWaterTrap);
  const hasActiveTrap = trapBipolarWeak || trapAwayNegWarm || trapDualWater;

  let kind: SmartMode14Kind = "M14_HOLD_NEUTRAL";
  let sig = false;
  let vip = false;
  let pick = p;
  let reasonFa = dualWaterTrap
    ? `توقف ایمنی المنت غالب: تله دوقلوی آب (هر دو بازیکن WATER: ${hDomInfo.maxCnt} و ${aDomInfo.maxCnt})`
    : "توقف خنثی: خارج از آستانه مستقیم (Surface Elo≥75%) یا شرایط بازیکن مقابل";

  if (m14Sig) {
    if (hasActiveTrap) {
      // Whenever a trap catches baseM14Pick, NEVER keep baseM14Pick as the winner! Switch pick -> o (Opposite Team)!
      pick = o;
      if (m11DirOpp && !dualWaterTrap) {
        kind = "M14_TRAP_FLIP";
        sig = true;
        vip = false;
        reasonFa = trapBipolarWeak
          ? `تشخیص تله دوقطبی روی سمت بازنده (Elo=${pl5.toFixed(1)}%<75%) + تایید موتور ۳ عددی → چرخش برد به بازیکن مقابل (${o})`
          : `تشخیص تله Warm<0 روی سمت بازنده + تایید موتور ۳ عددی → چرخش برد به بازیکن مقابل (${o})`;
      } else if (trapDualWater) {
        kind = "M14_VETO_TRAP";
        sig = false;
        reasonFa = `مهار تله المنت غالب (۲×WATER: ${pDomInfo.maxCnt} برابر ${oDomInfo.maxCnt}) • حذف سمت تله و چرخش مسیر جایگزین به ${o} (بدون بت)`;
      } else if (trapBipolarWeak) {
        kind = "M14_VETO_TRAP";
        sig = false;
        reasonFa = `مهار تله دوقطبی زیر ۷۵٪ (Elo=${pl5.toFixed(1)}%) • حذف سمت تله و چرخش مسیر جایگزین به ${o} (بدون بت)`;
      } else {
        kind = "M14_VETO_TRAP";
        sig = false;
        reasonFa = `مهار تله Warm<0 (${pWarm.toFixed(1)}) • حذف سمت تله و چرخش مسیر جایگزین به ${o} (بدون بت)`;
      }
    } else {
      kind = "M14_CORE_CLEAN";
      sig = true;
      vip = Boolean(m14?.vip || pLeadCnt === 3 || domSplit);
      pick = p;
      reasonFa =
        pLeadCnt === 3
          ? `سیگنال ویژه VIP حالت ۱۴: قفل سالم + برتری ۳/۴ عناصر بردار کل (${pDomInfo.dom}:${pDomInfo.maxCnt})`
          : domSplit
            ? `سیگنال سالم حالت ۱۴ + شکاف مثبت المنت غالب (${pDomInfo.dom}:${pDomInfo.maxCnt} برابر ${oDomInfo.dom}:${oDomInfo.maxCnt})`
            : `سیگنال اصلی حالت ۱۴ سالم و عاری از هر ۳ تله خطا (المنت غالب: ${pDomInfo.dom}:${pDomInfo.maxCnt})`;
    }
  } else if (!dualWaterTrap && pl5 >= 75.0) {
    kind = "M14_DIRECT_RELEASE";
    sig = true;
    vip = Boolean(pl5 >= 80.0 || pLeadCnt === 3);
    pick = p;
    reasonFa = `آزادسازی مستقیم (قانون ۳): احتمال جدول Log5=${pl5.toFixed(1)}% ≥ 75% • المنت غالب ${pDomInfo.dom}(${pDomInfo.maxCnt})`;
  } else if (
    !dualWaterTrap &&
    ((m11FavOpp && spwrFavOpp && ol5 >= 55.0) || (ol5 >= 62.0 && (m11FavOpp || p12FavOpp)))
  ) {
    kind = "M14_OPPOSITE_FLIP";
    sig = true;
    vip = Boolean((m11FavOpp && spwrFavOpp) || oLeadCnt === 3);
    pick = o;
    if (m11FavOpp && spwrFavOpp) {
      reasonFa = `چرخش طلایی به بازیکن مقابل (قانون ۲A): قفل ۱۱ + توان کل + Surface Elo=${ol5.toFixed(1)}% (${oDomInfo.dom}:${oDomInfo.maxCnt})`;
    } else if (m11FavOpp) {
      reasonFa = `چرخش به بازیکن مقابل (قانون ۲B): قفل حالت ۱۱ سمت بازیکن مقابل + Surface Elo=${ol5.toFixed(1)}%`;
    } else {
      reasonFa = `چرخش به بازیکن مقابل (قانون ۲B): برتری بُعد فردی (GF-FIN) + Surface Elo=${ol5.toFixed(1)}%`;
    }
  }

  // 4-Pattern NO-BET × Dominant-Element Fusion Box (Neutral-Court Symmetric!)
  const teamMeta = fm?.team;
  const playerMeta = fm?.player;
  const isNoBetM14 = !sig;
  const sugPick = pick;
  const ep = elemFollow.pick;
  const epIsH = Boolean(ep && ep === g.h);
  const epL5 = !ep ? 0 : epIsH ? hL5 : aL5;
  const epP12Ok = !ep ? false : epIsH ? hP12 < aP12 : aP12 < hP12;
  const epSumOk = !ep ? false : epIsH ? elemFollow.hSum > elemFollow.aSum : elemFollow.aSum > elemFollow.hSum;
  const epM11Dir = Boolean(ep && m11Pick === ep);
  const epM11Sig = Boolean(ep && m11Sig && m11Pick === ep);
  const sugTeamSig = Boolean((teamMeta?.sig && teamMeta?.pick === sugPick) || (playerMeta?.sig && playerMeta?.pick === sugPick));
  const agreeBoxes = Boolean(elemFollow.hasPick && sugPick === ep);
  const clashBoxes = Boolean(elemFollow.hasPick && sugPick !== ep);

  const sugL5 = sugPick === g.h ? hL5 : aL5;
  const satTrap = elemFollow.ruleCode === "AIR_SAT8_SMALL" || elemFollow.ruleCode === "EARTH_SAT10_SMALL";
  const p1Hit = Boolean(
    !dualWaterTrap &&
      agreeBoxes &&
      epM11Dir &&
      (epL5 >= 58.0 || (elemFollow.tier === "STRONG" && epL5 >= 53.0))
  );
  const p2Hit = Boolean(
    !dualWaterTrap &&
      agreeBoxes &&
      (sig || (elemFollow.tier === "STRONG" && (epM11Sig || sugTeamSig || (epP12Ok && epSumOk && epL5 >= 60.0))))
  );
  const p3Hit = Boolean(
    !dualWaterTrap &&
      elemFollow.hasPick &&
      elemFollow.tier === "STRONG" &&
      epP12Ok &&
      epL5 >= 62.0 &&
      (agreeBoxes || !sig)
  );
  const p4AirTrap = Boolean(clashBoxes && (sugTeamSig || (sig && sugL5 >= 75.0)) && satTrap);
  const p4Hit = Boolean(
    !dualWaterTrap &&
      clashBoxes &&
      !satTrap &&
      (sugTeamSig || (sig && sugL5 >= 75.0))
  );
  const rawF4Active = p1Hit || p2Hit || p3Hit || p4Hit;
  const profM15 = fm?.modes?.fusion4_elem;
  const shieldVetoedM15 = Boolean(
    rawF4Active && profM15 && !profM15.sig && (g.wtp as any)?.profileKey && (g.wtp as any)?.profileKey !== "a_elo"
  );
  const f4Active = rawF4Active && !shieldVetoedM15;
  const f4Pick = p1Hit || p2Hit || p3Hit ? ep : p4Hit ? sugPick : "";
  const f4Tags: string[] = [];
  if (p1Hit) f4Tags.push("پترن ۱");
  if (p2Hit) f4Tags.push("پترن ۲");
  if (p3Hit) f4Tags.push("پترن ۳");
  if (p4Hit) f4Tags.push("پترن ۴");
  const fusion4 = {
    isNoBetM14,
    sugPick,
    agreeBoxes,
    clashBoxes,
    sugTeamSig,
    epP12Ok,
    epSumOk,
    epM11Dir,
    epM11Sig,
    epL5,
    p1Hit,
    p2Hit,
    p3Hit,
    p4Hit,
    p4AirTrap,
    active: f4Active,
    pick: f4Pick,
    tags: f4Tags,
  };

  // 6-Box Final Referee (داوری نهایی ۶ باکس سیگنال • v80):
  // Exact 1-to-1 card tick tally Σ✓ = Box1(5) + Smart14(5) + ElemFollow(1) + Fusion4(4)
  const hCold = Number(t12?.h_c_gff ?? 0);
  const aCold = Number(t12?.a_c_gff ?? 0);
  const hDelta = Number(t12?.h_d_gff ?? 0);
  const aDelta = Number(t12?.a_d_gff ?? 0);
  const hTotGff = Number(t12?.h_gff_tot ?? 0);
  const aTotGff = Number(t12?.a_gff_tot ?? 0);

  const b1HomeTicks =
    Number(hWarm < aWarm) +
    Number(hCold < aCold) +
    Number(hDelta < aDelta) +
    Number(hTotGff < aTotGff) +
    Number(!dualWaterTrap && (hLeadCnt === 3 || (domSplit && (hDomInfo.dom === "WATER" || hDomInfo.dom === "AIR"))));
  const b1AwayTicks =
    Number(aWarm < hWarm) +
    Number(aCold < hCold) +
    Number(aDelta < hDelta) +
    Number(aTotGff < hTotGff) +
    Number(!dualWaterTrap && (aLeadCnt === 3 || (domSplit && (aDomInfo.dom === "WATER" || aDomInfo.dom === "AIR"))));

  const hIsBase = p === g.h;
  const aIsBase = p === g.a;
  const hPureL5Ok =
    (hIsBase && m14Sig && !hasActiveTrap) ||
    (hIsBase && hL5 >= 75) ||
    (!hIsBase && (hL5 >= 62 || (m11FavOpp && spwrFavOpp && hL5 >= 55)));
  const aPureL5Ok =
    (aIsBase && m14Sig && !hasActiveTrap) ||
    (aIsBase && aL5 >= 75) ||
    (!aIsBase && (aL5 >= 62 || (m11FavOpp && spwrFavOpp && aL5 >= 55)));
  const hM11SigTeam = Boolean(m11Sig && m11Pick === g.h);
  const aM11SigTeam = Boolean(m11Sig && m11Pick === g.a);
  const hM11DirTeam = Boolean(m11Pick === g.h);
  const aM11DirTeam = Boolean(m11Pick === g.a);

  const smHomeTicks =
    Number(m14Sig && hIsBase && !hasActiveTrap) +
    Number(!dualWaterTrap && (hLeadCnt === 3 || (domSplit && (sig ? pick === g.h : hDomInfo.dom !== "EARTH")))) +
    Number(hPureL5Ok) +
    Number(!hIsBase ? hM11SigTeam || p12FavOpp || (hasActiveTrap && hM11DirTeam) : (kind === "M14_CORE_CLEAN" || kind === "M14_DIRECT_RELEASE") && p12FavBase) +
    Number(sig && pick === g.h);
  const smAwayTicks =
    Number(m14Sig && aIsBase && !hasActiveTrap) +
    Number(!dualWaterTrap && (aLeadCnt === 3 || (domSplit && (sig ? pick === g.a : aDomInfo.dom !== "EARTH")))) +
    Number(aPureL5Ok) +
    Number(!aIsBase ? aM11SigTeam || p12FavOpp || (hasActiveTrap && aM11DirTeam) : (kind === "M14_CORE_CLEAN" || kind === "M14_DIRECT_RELEASE") && p12FavBase) +
    Number(sig && pick === g.a);

  const efHomeTicks = Number(elemFollow.hasPick && elemFollow.pick === g.h);
  const efAwayTicks = Number(elemFollow.hasPick && elemFollow.pick === g.a);

  const f4HomeTicks =
    Number(p1Hit && ep === g.h) +
    Number(p2Hit && ep === g.h) +
    Number(p3Hit && ep === g.h) +
    Number(p4Hit && sugPick === g.h);
  const f4AwayTicks =
    Number(p1Hit && ep === g.a) +
    Number(p2Hit && ep === g.a) +
    Number(p3Hit && ep === g.a) +
    Number(p4Hit && sugPick === g.a);

  const totHomeTicks = b1HomeTicks + smHomeTicks + efHomeTicks + f4HomeTicks;
  const totAwayTicks = b1AwayTicks + smAwayTicks + efAwayTicks + f4AwayTicks;
  const deltaTicks = Math.abs(totHomeTicks - totAwayTicks);

  type RefTier = "DIAMOND" | "STRONG_SIGNAL" | "RANKED_CONSENSUS" | "RANKED_LEAN";
  type RankedBoxItem = {
    id: string;
    rank: number;
    boxTitleFa: string;
    maxPts: number;
    team: string;
    pts: number;
    tagFa: string;
  };

  // Empirical Ranking of the 6 Signal Boxes:
  // Rank 1: Box 6 (۶. تلفیق ۴ پترن — up to 10 pts)
  // Rank 2: Box 3 (۳. حکم و مسیر نهایی باکس ۲ — up to 9 pts)
  // Rank 3: Box 2 (۲. باکس هوشمند ۱۴ — up to 6 pts)
  // Rank 4: Box 5 (۵. برنده المنت فالوآپ — up to 3.5 pts)
  // Rank 5: Box 4 (۴. المنت غالب [F-A-W-E] — up to 1.5 pts)
  // Rank 6: Box 1 (۱. چک‌لیست شاخص‌ها — up to 1.5 pts)
  const r82SatTrap =
    clashBoxes &&
    (elemFollow.ruleCode === "AIR_SAT8_SMALL" || elemFollow.ruleCode === "EARTH_SAT10_SMALL") &&
    !p4Hit;
  const r82WeakClashTrap = Boolean(sig && clashBoxes && !p4Hit && !vip);
  const r82F4Cnt = Number(p1Hit) + Number(p2Hit) + Number(p3Hit) + Number(p4Hit);
  const r82F4TickLead = f4Active ? (f4Pick === g.h ? totHomeTicks > totAwayTicks : totAwayTicks > totHomeTicks) : false;
  const r82NoBetF4Trap = Boolean(!sig && f4Active && !r82F4TickLead);

  const r82M12 = fm?.modes?.tri_gf_ultralock;
  const r82M12Sig = Boolean(r82M12?.sig);
  const r82M12Pick = r82M12?.pick || "";
  const r82OppSug = sugPick === g.h ? g.a : g.h;
  const r82SugL5 = sugPick === g.h ? hL5 : aL5;
  const r82OppL5 = r82OppSug === g.h ? hL5 : aL5;
  const r82B1Pick = b1HomeTicks > b1AwayTicks ? g.h : b1AwayTicks > b1HomeTicks ? g.a : "";
  const r82B1Diff = Math.abs(b1HomeTicks - b1AwayTicks);
  const r82B4Pick = !dualWaterTrap && hLeadCnt === 3 ? g.h : !dualWaterTrap && aLeadCnt === 3 ? g.a : "";

  const r82RevM12 = Boolean(!dualWaterTrap && r82M12Sig && r82M12Pick === r82OppSug && (r82OppL5 < 50.0 || r82OppL5 >= 55.0));
  const r82RevHomeM11 = Boolean(
    !dualWaterTrap &&
      r82OppL5 >= 52.0 &&
      m11Sig &&
      m11Pick === r82OppSug &&
      elemFollow.hasPick &&
      elemFollow.pick === r82OppSug
  );
  const r82DirM12 = Boolean(!dualWaterTrap && !sig && !p4AirTrap && r82M12Sig && r82M12Pick === sugPick && r82SugL5 >= 60.0);
  const r82DirM11B1 = Boolean(
    !dualWaterTrap && !sig && !p4AirTrap && m11Sig && m11Pick === sugPick && r82B1Pick === sugPick && r82SugL5 >= 65.0
  );

  let ptsHome = 0;
  let ptsAway = 0;
  let topBoxHit = false;
  const rankedBoxes: RankedBoxItem[] = [];

  const pushBox = (id: string, rank: number, boxTitleFa: string, maxPts: number, team: string, pts: number, tagFa: string) => {
    if (pts > 0 && (team === g.h || team === g.a)) {
      if (team === g.h) ptsHome += pts;
      else ptsAway += pts;
      rankedBoxes.push({ id, rank, boxTitleFa, maxPts, team, pts, tagFa });
    } else {
      rankedBoxes.push({ id, rank, boxTitleFa, maxPts, team: "", pts: 0, tagFa });
    }
  };

  // Rank 1: ۶. تلفیق ۴ پترن (max 10 pts)
  if (f4Active) {
    const soloP3 = p3Hit && !(p1Hit || p2Hit || p4Hit);
    if (r82F4Cnt >= 2 && (sig || r82F4TickLead)) {
      pushBox("b6", 1, "۶. تلفیق ۴ پترن", 10, f4Pick, 10.0, `چندپترنه (${f4Tags.join("+").replace(/پترن /g, "P")})`);
      topBoxHit = true;
    } else if ((sig && p4Hit) || (!sig && (p1Hit || p2Hit) && r82F4TickLead)) {
      pushBox("b6", 1, "۶. تلفیق ۴ پترن", 10, f4Pick, 8.0, `هم‌تیک (${f4Tags.join("+").replace(/پترن /g, "P")})`);
      topBoxHit = true;
    } else if (!sig && p4Hit && r82F4TickLead) {
      pushBox("b6", 1, "۶. تلفیق ۴ پترن", 10, f4Pick, 7.0, "پترن ۴ برتر");
      topBoxHit = true;
    } else if (soloP3) {
      pushBox("b6", 1, "۶. تلفیق ۴ پترن", 10, f4Pick, 1.0, "تک‌پترن ۳ (احتیاط)");
    } else {
      pushBox("b6", 1, "۶. تلفیق ۴ پترن", 10, f4Pick, 1.5, "کسری تیک کل");
    }
  } else if (p4AirTrap && elemFollow.hasPick) {
    pushBox("b6", 1, "۶. تلفیق ۴ پترن", 10, elemFollow.pick, 3.5, "ضد اشباع المنت");
  } else {
    pushBox("b6", 1, "۶. تلفیق ۴ پترن", 10, "", 0, "بدون پترن");
  }

  // Rank 2: ۳. حکم و مسیر باکس ۲ (max 9 pts)
  if (sig && vip && !r82SatTrap) {
    pushBox("b3", 2, "۳. حکم باکس ۲", 9, pick, 9.0, "★VIP ویژه");
    topBoxHit = true;
  } else if (sig && !r82WeakClashTrap && !r82SatTrap) {
    pushBox("b3", 2, "۳. حکم باکس ۲", 9, pick, 7.0, "سیگنال تایید ✓");
    topBoxHit = true;
  } else if (r82RevM12 || r82RevHomeM11) {
    pushBox("b3", 2, "۳. حکم باکس ۲", 9, r82OppSug, 7.0, "چرخش معکوس ⇄");
    topBoxHit = true;
  } else if (r82WeakClashTrap || r82SatTrap) {
    pushBox("b3", 2, "۳. حکم باکس ۲", 9, "", 0, "مهار تله تضاد ✕");
  } else if (r82DirM12 || r82DirM11B1) {
    pushBox("b3", 2, "۳. حکم باکس ۲", 9, sugPick, 7.0, "مستقیم تکمیلی ✓");
    topBoxHit = true;
  } else if (r82NoBetF4Trap && f4Pick === sugPick) {
    pushBox("b3", 2, "۳. حکم باکس ۲", 9, sugPick, 1.5, "مسیر کسری‌تیک");
  } else {
    const pts3 = r82SugL5 >= 58.0 ? 5.0 : r82SugL5 >= 50.0 ? 4.0 : 2.5;
    pushBox("b3", 2, "۳. حکم باکس ۲", 9, sugPick, pts3, `مسیر پیشنهادی (${r82SugL5.toFixed(0)}%)`);
  }

  // Rank 3: ۲. باکس هوشمند ۱۴ (max 6 pts)
  if (sig && !r82WeakClashTrap && !r82SatTrap) {
    pushBox("b2", 3, "۲. هوشمند ۱۴", 6, pick, 6.0, `سیگنال ۱۴ (${smHomeTicks}-${smAwayTicks})`);
    topBoxHit = true;
  } else if (r82RevM12 || r82RevHomeM11) {
    pushBox("b2", 3, "۲. هوشمند ۱۴", 6, r82OppSug, 5.0, "قفل معکوس ۱۲/۱۱ ⇄");
  } else if (r82WeakClashTrap || r82SatTrap) {
    pushBox("b2", 3, "۲. هوشمند ۱۴", 6, "", 0, "رد تله تضاد ✕");
  } else if (r82DirM12 || r82DirM11B1) {
    pushBox("b2", 3, "۲. هوشمند ۱۴", 6, sugPick, 4.5, "تایید موتور ۱۲/۱۱");
  } else if (smHomeTicks !== smAwayTicks) {
    const smWin = smHomeTicks > smAwayTicks ? g.h : g.a;
    pushBox("b2", 3, "۲. هوشمند ۱۴", 6, smWin, 2.0, `برتری تیک (${smHomeTicks}-${smAwayTicks})`);
  } else {
    pushBox("b2", 3, "۲. هوشمند ۱۴", 6, "", 0, `مساوی (${smHomeTicks}-${smAwayTicks})`);
  }

  // Rank 4: ۵. برنده المنت فالوآپ (max 3.5 pts)
  if (elemFollow.hasPick) {
    const pts5 = elemFollow.tier === "STRONG" ? 3.5 : 2.0;
    pushBox(
      "b5",
      4,
      "۵. فالوآپ المنت",
      3.5,
      elemFollow.pick,
      pts5,
      elemFollow.tier === "STRONG" ? "فالوآپ قوی ★" : "فالوآپ متوسط ✓"
    );
  } else {
    pushBox("b5", 4, "۵. فالوآپ المنت", 3.5, "", 0, "خنثی");
  }

  // Rank 5: ۴. المنت غالب [F-A-W-E] (max 1.5 pts)
  if (r82B4Pick) {
    pushBox("b4", 5, "۴. المنت غالب", 1.5, r82B4Pick, 1.5, "برتری ★3/4");
  } else if (domSplit && hDomInfo.maxCnt !== aDomInfo.maxCnt) {
    const domWin = hDomInfo.maxCnt > aDomInfo.maxCnt ? g.h : g.a;
    pushBox("b4", 5, "۴. المنت غالب", 1.5, domWin, 1.0, "شکاف المنت");
  } else {
    pushBox("b4", 5, "۴. المنت غالب", 1.5, "", 0, dualWaterTrap ? "۲×WATER" : "هم‌المنت");
  }

  // Rank 6: ۱. چک‌لیست باکس ۱ (max 1.5 pts)
  if (r82B1Pick) {
    const pts1 = r82B1Diff >= 2 ? 1.5 : 1.0;
    pushBox("b1", 6, "۱. چک‌لیست", 1.5, r82B1Pick, pts1, `برتری (${b1HomeTicks}-${b1AwayTicks})`);
  } else {
    pushBox("b1", 6, "۱. چک‌لیست", 1.5, "", 0, `مساوی (${b1HomeTicks}-${b1AwayTicks})`);
  }

  ptsHome = Math.round(ptsHome * 10) / 10;
  ptsAway = Math.round(ptsAway * 10) / 10;
  const deltaPts = Math.round(Math.abs(ptsHome - ptsAway) * 10) / 10;
  const refPick = ptsHome > ptsAway ? g.h : ptsAway > ptsHome ? g.a : sugPick;
  const efStrongMatch = Boolean(elemFollow.hasPick && elemFollow.tier === "STRONG" && elemFollow.pick === refPick);

  let refTier: RefTier = "RANKED_LEAN";
  if (topBoxHit && deltaPts >= 18.0) {
    refTier = "DIAMOND";
  } else if (topBoxHit && deltaPts >= 8.0) {
    refTier = "STRONG_SIGNAL";
  } else if (deltaPts >= 5.5 || (deltaPts >= 4.0 && efStrongMatch)) {
    refTier = "RANKED_CONSENSUS";
  } else {
    refTier = "RANKED_LEAN";
  }

  const refActive = refTier === "DIAMOND" || refTier === "STRONG_SIGNAL" || refTier === "RANKED_CONSENSUS";
  const isTopSignal = refTier === "DIAMOND" || refTier === "STRONG_SIGNAL";
  const isOppositeWin = Boolean(refPick === r82OppSug);
  const boxesForPick = rankedBoxes.filter((b) => b.team === refPick && b.pts > 0).length;
  const boxesAgainstPick = rankedBoxes.filter((b) => b.team !== "" && b.team !== refPick && b.pts > 0).length;
  const winPts = refPick === g.h ? ptsHome : ptsAway;
  const losePts = refPick === g.h ? ptsAway : ptsHome;

  const refReasonFa =
    refTier === "DIAMOND"
      ? `رتبه ۱ الماسی ۶ باکس (${winPts} برابر ${losePts} امتیاز • Δ=${deltaPts}): اجماع سنگین باکس‌های رتبه بالا به سود ${getTeam3Code(refPick)}`
      : refTier === "STRONG_SIGNAL"
        ? isOppositeWin
          ? `رتبه ۲ سیگنال قوی معکوس ⇄ (${winPts} برابر ${losePts} امتیاز • Δ=${deltaPts}): چرخش وزنی ۶ باکس به بازیکن مقابل ${getTeam3Code(refPick)}`
          : `رتبه ۲ سیگنال قوی ۶ باکس (${winPts} برابر ${losePts} امتیاز • Δ=${deltaPts}): برتری قاطع باکس‌های رتبه ۱ تا ۳ به سود ${getTeam3Code(refPick)}`
        : refTier === "RANKED_CONSENSUS"
          ? isOppositeWin
            ? `رتبه ۳ تایید رتبه‌بندی ۶ باکس ⇄ (${winPts} برابر ${losePts} امتیاز • ${boxesForPick} باکس موافق): غلبه فالوآپ و چک‌لیست به سود ${getTeam3Code(refPick)}`
            : `رتبه ۳ تایید رتبه‌بندی ۶ باکس (${winPts} برابر ${losePts} امتیاز • ${boxesForPick} باکس موافق): هم‌جهتی فالوآپ المنت و مسیر باکس‌ها به سود ${getTeam3Code(refPick)}`
          : `رتبه ۴ برتری خفیف امتیازی (${winPts} برابر ${losePts} امتیاز • Δ=${deltaPts}): کفه سبک امتیاز ۶ باکس به سود ${getTeam3Code(refPick)} (کم‌فاصله)`;

  const referee6 = {
    active: refActive,
    isTopSignal,
    isDiamond: refTier === "DIAMOND",
    isOppositeWin,
    isCore: isTopSignal,
    tier: refTier,
    code: refTier,
    pick: refPick,
    sugPick,
    oppSug: r82OppSug,
    vetoSide: r82WeakClashTrap || r82SatTrap ? sugPick : r82NoBetF4Trap ? f4Pick : "",
    reasonFa: refReasonFa,
    ptsHome,
    ptsAway,
    deltaPts,
    boxesForPick,
    boxesAgainstPick,
    rankedBoxes,
    b1HomeTicks,
    b1AwayTicks,
    smHomeTicks,
    smAwayTicks,
    efHomeTicks,
    efAwayTicks,
    f4HomeTicks,
    f4AwayTicks,
    totHomeTicks,
    totAwayTicks,
    deltaTicks,
  };

  return {
    kind,
    sig,
    vip,
    pick,
    baseM14Pick: p,
    oppTeam: o,
    reasonFa,
    code,
    m14Sig,
    trapBipolarWeak,
    trapAwayNegWarm,
    trapDualWater,
    hasActiveTrap,
    dualWaterTrap,
    domSplit,
    elemFollow,
    fusion4,
    referee6,
    hDomInfo,
    aDomInfo,
    hLeadCnt,
    aLeadCnt,
    pLeadCnt,
    oLeadCnt,
    m11Sig,
    m11Pick,
    m11DirOpp,
    m11FavOpp,
    p12FavOpp,
    p12FavBase,
    spwrFavOpp,
    hP12,
    aP12,
    hSPwr,
    aSPwr,
    hWarm,
    aWarm,
    hL5,
    aL5,
    pl5,
    ol5,
  };
}

export type AntiNoBetKind =
  | "M12_CORE"
  | "DIRECT_RELEASE"
  | "OPPOSITE_FLIP"
  | "HOLD_DUAL_EARTH"
  | "HOLD_3OF3_CLASH"
  | "HOLD_NEUTRAL";

function evalSmartAntiNoBet(g: NbaGamePred) {
  const fm = g.fusion_meta;
  const m12 = fm?.modes?.tri_gf_ultralock;
  const m11 = fm?.modes?.tri_gf_routed;
  const dp = fm?.modes?.dual_pillar;
  const g1 = fm?.geo1xxx;
  const wtp: any = g.wtp ?? {};
  const p = m12?.pick || g.sys_win || g.h;
  const o = p === g.h ? g.a : g.h;
  const l5h = Number(wtp.l5h ?? 50);
  const hEl = String(wtp.hel || "AIR");
  const aEl = String(wtp.ael || "AIR");
  const hL5 = Math.round(l5h * 10) / 10;
  const aL5 = Math.round((100 - l5h) * 10) / 10;
  const pel = p === g.h ? hEl : aEl;
  const oel = o === g.h ? hEl : aEl;
  const pl5 = p === g.h ? hL5 : aL5;
  const ol5 = o === g.h ? hL5 : aL5;
  const code = g1?.m12_route?.code ?? "";
  const rfa = g1?.m12_route?.reason_fa ?? "";
  const is3of3P = Boolean(g1 && g1.win === p && g1.all_win === p && g1.gf_win === p);
  const o0 = o === g.h ? Number(g1?.h_0xxx ?? 0) : Number(g1?.a_0xxx ?? 0);
  const coldO = Boolean(g1?.cold0_win === o && o0 < 0);
  const dpSig = Boolean(dp?.sig);
  const dpPick = dp?.pick || "";
  const dpO = Boolean(dpSig && dpPick === o);
  const m11Sig = Boolean(m11?.sig);
  const m11Pick = m11?.pick || "";
  const rawFb = rfa.startsWith("موتور ۳ عددی") || code === "M11_RAW";

  let kind: AntiNoBetKind = "HOLD_NEUTRAL";
  let sig = false;
  let vip = false;
  let pick = p;
  let reasonFa = "توقف خنثی: بدون برتری مستقیم یا معکوس";

  if (m12?.sig) {
    kind = "M12_CORE";
    sig = true;
    vip = Boolean(m12.vip);
    pick = p;
    reasonFa = "سیگنال اصلی حالت ۱۲ تایید شده است";
  } else if (pel === "EARTH" && oel === "EARTH") {
    kind = "HOLD_DUAL_EARTH";
    sig = false;
    pick = p;
    reasonFa = "توقف ایمنی: تقابل پرنوسان دو بازیکن EARTH (ورود ممنوع)";
  } else if (code === "ULTRA_3OF3_CLASH_HOLD") {
    kind = "HOLD_3OF3_CLASH";
    sig = false;
    pick = p;
    reasonFa = "توقف ایمنی: تضاد همزاد با اجماع ۳/۳ اعداد";
  } else if (m11Sig && m11Pick === p && pel !== "EARTH" && pl5 >= 75.0) {
    kind = "DIRECT_RELEASE";
    sig = true;
    vip = pl5 >= 80.0;
    pick = p;
    reasonFa = `آزادسازی مستقیم (گروه ۱): قفل حالت ۱۱ فعال + ${pel} (${pl5.toFixed(1)}%)`;
  } else if (!m11Sig && oel !== "EARTH" && is3of3P && ((dpO && ol5 >= 54.0) || (rawFb && ol5 >= 60.0))) {
    kind = "HOLD_3OF3_CLASH";
    sig = false;
    pick = p;
    reasonFa = "سپر ایمنی ۳/۳: اجماع هر ۳ عدد با بازیکن پایه است (منع چرخش به بازیکن مقابل)";
  } else if (!m11Sig && oel !== "EARTH" && !is3of3P && ((dpO && ol5 >= 54.0) || (rawFb && ol5 >= 60.0))) {
    kind = "OPPOSITE_FLIP";
    sig = true;
    vip = false;
    pick = o;
    if (dpO && ol5 >= 54.0) {
      reasonFa = `چرخش به بازیکن مقابل (گروه ۲): تایید همزاد دو-ستونی خلاف مسیر خام (${ol5.toFixed(1)}%)`;
    } else if (coldO) {
      reasonFa = `چرخش به بازیکن مقابل (گروه ۲): قطب سرد ۰xxx منفی + برتری قدرت پایه (${ol5.toFixed(1)}%)`;
    } else {
      reasonFa = `چرخش به بازیکن مقابل (گروه ۲): رد مسیر خام ضعیف به سود بازیکن قوی‌تر (${ol5.toFixed(1)}%)`;
    }
  }

  const profM13 = g.fusion_meta?.modes?.anti_nobet_smart;
  if (sig && profM13 && !profM13.sig && wtp.profileKey && wtp.profileKey !== "a_elo") {
    kind = "HOLD_NEUTRAL";
    sig = false;
    vip = false;
    reasonFa = "توقف ایمنی سپر هوشمند فصل: مهار تله اول ماه / فینال / ۲۵۰ امتیازی / افت فرم سطح زمین";
  }

  return {
    kind,
    sig,
    vip,
    pick,
    baseM12Pick: p,
    oppTeam: o,
    reasonFa,
    m11Sig,
    m11Pick,
    dpSig,
    dpPick,
    coldO,
    is3of3P,
    hEl,
    aEl,
    hL5,
    aL5,
  };
}

function matchupElemFromPct(l5PickPct: number): string {
  if (l5PickPct >= 64.0) return "FIRE";
  if (l5PickPct >= 54.0) return "AIR";
  if (l5PickPct >= 45.0) return "WATER";
  return "EARTH";
}

function dominantElemInfoVec(vec: number[]): [string, number, boolean] {
  const names = ["FIRE", "AIR", "WATER", "EARTH"];
  const mx = vec.length > 0 ? Math.max(...vec) : 0;
  if (mx <= 0) return ["—", 0, true];
  const winners = names.filter((_, i) => vec[i] === mx);
  if (winners.length === 1) return [winners[0], mx, false];
  return [`TIE(${winners.map((w) => w[0]).join("+")})`, mx, true];
}

export function applyPowerProfileToGame(
  g: NbaGamePred,
  profileKey: PowerProfileKey = "c_vol"
): NbaGamePred {
  if (profileKey === "a_elo") return g;
  const pp = g.pwr_p?.[profileKey];
  const fm = g.fusion_meta;
  const g1 = fm?.geo1xxx;
  const t12 = fm?.total_elem_12;
  if (!pp || !fm || !g1 || !t12) return g;

  const h = g.h;
  const a = g.a;
  const hL5 = Math.round(Number(pp.l5h) * 10) / 10;
  const aL5 = Math.round((100.0 - hL5) * 10) / 10;
  const hpct = Math.round(Number(pp.hpct) * 10) / 10;
  const apct = Math.round(Number(pp.apct) * 10) / 10;
  const hEl = String(pp.hel || "AIR");
  const aEl = String(pp.ael || "AIR");
  const htrapLv = Number(pp.htrap ?? 0);
  const atrapLv = Number(pp.atrap ?? 0);

  const tm = fm.team;
  const pl = fm.player;
  const tpk = tm.pick;
  const ppk = pl.pick;
  const f30T = Number(tm.f30 || 0);
  const f30P = Number(pl.f30 || 0);

  const tl5 = tpk === h ? hL5 : aL5;
  const pl5 = ppk === h ? hL5 : aL5;
  const melT = matchupElemFromPct(tl5);
  const melP = matchupElemFromPct(pl5);

  const idx3 = g.idx3;
  const f1GuardT =
    tl5 >= 56.0
      ? Boolean(tm.guard_sym ?? tm.guard ?? g.f1_guard)
      : Boolean(tm.guard ?? g.f1_guard);
  const f1GuardP =
    pl5 >= 56.0
      ? Boolean(pl.guard_sym ?? pl.guard ?? pl.sig)
      : Boolean(pl.guard ?? pl.sig);

  const natT = Boolean(tm.nat ?? g.is_nat);
  const natP = Boolean(pl.nat ?? false);
  const favV4T = Number(tpk === h ? (tm.vh ?? idx3?.vh ?? 0) : (tm.va ?? idx3?.va ?? 0));
  const favV4P = Number(ppk === h ? (pl.vh ?? 0) : (pl.va ?? 0));
  const minO4T = Number(tm.minD ?? idx3?.minD ?? 0);
  const minO4P = Number(pl.minD ?? 0);

  const tSig = Boolean(f1GuardT && melT !== "EARTH");
  const tVip = Boolean(tSig && (melT === "FIRE" || (natT && favV4T === 4 && minO4T >= 2)));
  const pSig = Boolean(f1GuardP && melP !== "EARTH");
  const pVip = Boolean(pSig && (melP === "FIRE" || (natP && favV4P === 4 && minO4P >= 2)));

  const sgnT = tpk === h ? 1 : -1;
  const sgnP = ppk === h ? 1 : -1;
  const pSupportsT = ppk === tpk || f30P * sgnT > 0;
  const tSupportsP = tpk === ppk || f30T * sgnP > 0;
  const pAstroT = f30P * sgnT > 0;
  const tAstroP = f30T * sgnP > 0;

  const isDiamond = Boolean(tSig && pSig && tpk === ppk);
  const isVipCross = Boolean(
    (tVip && pSupportsT && (!pVip || tpk === ppk)) ||
      (pVip && tSupportsP && (!tVip || tpk === ppk))
  );
  const isAstroLock = Boolean(
    (tSig && pAstroT && (!pSig || tpk === ppk)) ||
      (pSig && tAstroP && (!tSig || tpk === ppk))
  );
  const isDualPillar = Boolean(
    (tSig && pSupportsT && (!pSig || tpk === ppk)) ||
      (pSig && tSupportsP && (!tSig || tpk === ppk))
  );
  const isVetoed = Boolean((tSig || pSig) && !isDualPillar);

  const favElo = hL5 >= aL5 ? h : a;
  let basePick = favElo;
  if (isDiamond) {
    basePick = tpk;
  } else if (isVipCross) {
    basePick = tVip && pSupportsT ? tpk : ppk;
  } else if (isDualPillar) {
    basePick = tSig && pSupportsT ? tpk : ppk;
  } else if (isVetoed) {
    basePick = tSig ? tpk : ppk;
  } else {
    basePick =
      Math.abs(f30T) > Math.abs(f30P)
        ? tpk
        : Math.abs(f30P) > Math.abs(f30T)
          ? ppk
          : favElo;
  }

  const pkVip = tVip && pSupportsT ? tpk : pVip && tSupportsP ? ppk : basePick;
  const pkAst = tSig && pAstroT ? tpk : pSig && tAstroP ? ppk : basePick;
  const pkDp = tSig && pSupportsT ? tpk : pSig && tSupportsP ? ppk : basePick;
  const pkDia = isDiamond ? tpk : basePick;

  const hSum = Number(g1.h_sum ?? 0);
  const aSum = Number(g1.a_sum ?? 0);
  const hCnt = Number(g1.h_cnt ?? 0);
  const aCnt = Number(g1.a_cnt ?? 0);
  const h0Sum = Number(g1.h_0xxx ?? 0);
  const a0Sum = Number(g1.a_0xxx ?? 0);
  const h0011Sum = Number(g1.h_0011 ?? 0);
  const a0011Sum = Number(g1.a_0011 ?? 0);
  const hGf = Number(g1.h_gf ?? 0);
  const aGf = Number(g1.a_gf ?? 0);
  const hS3 = Number(g1.h_s3 ?? 0);
  const aS3 = Number(g1.a_s3 ?? 0);
  const g1Win = String(g1.win ?? "");
  const cold0Win = String(g1.cold0_win ?? "");
  const c0011Win = String(g1.c0011_win ?? "");
  const allWin = String(g1.all_win ?? "");
  const gfWin = String(g1.gf_win ?? "");
  const triple3Win = String(g1.triple3_win ?? "");

  const votesH3 = Number(g1Win === h) + Number(allWin === h) + Number(gfWin === h);
  const votesA3 = Number(g1Win === a) + Number(allWin === a) + Number(gfWin === a);
  const maj23Win = votesH3 >= 2 ? h : votesA3 >= 2 ? a : gfWin || favElo;

  const isM5 = Boolean(isDualPillar && g1Win === pkDp);
  const isM6 = Boolean(isDualPillar && g1Win === pkDp && allWin === pkDp);

  const pkEl = pkDp === h ? hEl : aEl;
  const opEl = pkDp === h ? aEl : hEl;
  const pkL5 = pkDp === h ? hL5 : aL5;
  const earthOk = !(pkEl === "EARTH" && opEl !== "EARTH");
  const pk1Sum = pkDp === h ? hSum : aSum;
  const pk1Cnt = pkDp === h ? hCnt : aCnt;
  const bothPos1xxx = hCnt > 0 && aCnt > 0 && hSum > 0 && aSum > 0;
  const negAnchorOk = pk1Cnt >= 1 && pk1Sum < 0;
  const gfDelta = Math.abs(hGf - aGf);
  const dlOrRef =
    (g1Win === pkDp && allWin === pkDp) ||
    (pk1Cnt >= 1 && gfDelta >= 4.0 && maj23Win === pkDp);

  const isM7 = Boolean(isDualPillar && earthOk && !bothPos1xxx && negAnchorOk && dlOrRef);
  const safeDlWin = g1Win === pkDp && allWin === pkDp && earthOk ? pkDp : "";
  const isM8 = Boolean(
    isM7 ||
      (isVipCross && safeDlWin === pkVip) ||
      (dlOrRef && pkEl !== "EARTH" && negAnchorOk && pkL5 >= 60.0 && tpk === ppk)
  );
  const pkM8 = isVipCross && safeDlWin === pkVip && !isM7 ? pkVip : pkDp;

  const posInvTrig = Boolean(bothPos1xxx && Math.abs(hSum - aSum) >= 2.0);
  const posInvWin = posInvTrig ? (hSum > aSum ? h : a) : "";
  const divRefOk = Boolean(g1Win !== allWin && gfDelta >= 5.0 && (maj23Win === h || maj23Win === a));
  let isM9 = false;
  let pkM9 = pkDp;
  if (isM7) {
    isM9 = true;
    pkM9 = pkDp;
  } else if (isVipCross && safeDlWin === pkVip) {
    isM9 = true;
    pkM9 = pkVip;
  } else if (posInvTrig && ((posInvWin === h && hL5 >= 55.0) || (posInvWin === a && aL5 >= 55.0))) {
    isM9 = true;
    pkM9 = posInvWin;
  } else if (isDualPillar && divRefOk && maj23Win === pkDp && earthOk) {
    isM9 = true;
    pkM9 = pkDp;
  }

  const pkM10 = hGf < aGf ? h : aGf < hGf ? a : favElo;

  const s3SignSplit = (hS3 < 0 && aS3 > 0) || (aS3 < 0 && hS3 > 0);
  const s3SplitWin = hS3 < 0 && aS3 > 0 ? h : aS3 < 0 && hS3 > 0 ? a : "";
  let pkM11 = s3SplitWin || triple3Win || maj23Win || pkM10;
  const m11L5 = pkM11 === h ? hL5 : aL5;
  const m11El = pkM11 === h ? hEl : aEl;
  const m11_0 = pkM11 === h ? h0Sum : a0Sum;
  const m11_1cnt = pkM11 === h ? hCnt : aCnt;
  let isM11 = false;
  if (m11El === "EARTH" && (hEl !== "EARTH" || aEl !== "EARTH") && m11L5 < 52.0) {
    pkM11 = pkM11 === h ? a : h;
    isM11 = true;
  } else if (m11_1cnt === 0 && ((pkM11 === h && aL5 >= 58.0) || (pkM11 === a && hL5 >= 58.0))) {
    pkM11 = pkM11 === h ? a : h;
    isM11 = true;
  } else if (s3SignSplit && m11L5 >= 54.0) {
    isM11 = true;
  } else if (triple3Win && m11L5 >= 52.0) {
    isM11 = true;
  } else if (m11_0 <= -3.0 && cold0Win === pkM11 && m11L5 >= 55.0) {
    isM11 = true;
  }

  const dualEarthHold = hEl === "EARTH" && aEl === "EARTH";
  const candM12 = isM9 ? pkM9 : isM11 ? pkM11 : isDualPillar ? pkDp : favElo;
  const clash3of3Hold = Boolean(triple3Win && triple3Win !== candM12);
  const candL5 = candM12 === h ? hL5 : aL5;
  const cand0 = candM12 === h ? h0Sum : a0Sum;
  const bipolarOk = Boolean(c0011Win === candM12 && isDualPillar && candL5 >= 58.0);

  let isM12 = false;
  let m12Code = "M11_RAW";
  let rawFb13 = true;
  if (dualEarthHold) {
    isM12 = false;
    m12Code = "ULTRA_DUAL_EARTH_HOLD";
    rawFb13 = false;
  } else if (clash3of3Hold) {
    isM12 = false;
    m12Code = "ULTRA_3OF3_CLASH_HOLD";
    rawFb13 = false;
  } else if (isM9 && candL5 >= 56.0) {
    isM12 = true;
    m12Code = "ULTRA_M9_CORE";
    rawFb13 = false;
  } else if (cand0 <= -4.0 && cold0Win === candM12 && isDualPillar && candL5 >= 58.0) {
    isM12 = true;
    m12Code = "ULTRA_COLD_ANCHOR";
    rawFb13 = false;
  } else if (bipolarOk) {
    isM12 = true;
    m12Code = "ULTRA_BIPOLAR_0011";
    rawFb13 = false;
  } else if (s3SignSplit && s3SplitWin === candM12 && isDualPillar && candL5 >= 60.0) {
    isM12 = true;
    m12Code = "ULTRA_S3_SPLIT";
    rawFb13 = false;
  }
  const pkM12 = candM12;

  const p13 = pkM12;
  const o13 = p13 === h ? a : h;
  const p13El = p13 === h ? hEl : aEl;
  const o13El = p13 === h ? aEl : hEl;
  const p13L5 = p13 === h ? hL5 : aL5;
  const o13L5 = p13 === h ? aL5 : hL5;
  const is3of3P13 = triple3Win === p13;
  const dpO13 = isDualPillar && pkDp === o13;

  let isM13 = false;
  let vipM13 = false;
  let pkM13 = p13;
  if (isM12) {
    isM13 = true;
    vipM13 = Boolean(isDiamond || p13L5 >= 75.0);
    pkM13 = p13;
  } else if (dualEarthHold || m12Code === "ULTRA_3OF3_CLASH_HOLD") {
    isM13 = false;
    vipM13 = false;
    pkM13 = p13;
  } else if (isM11 && pkM11 === p13 && p13El !== "EARTH" && p13L5 >= 75.0) {
    isM13 = true;
    vipM13 = p13L5 >= 80.0;
    pkM13 = p13;
  } else if (
    !isM11 &&
    o13El !== "EARTH" &&
    !is3of3P13 &&
    ((dpO13 && o13L5 >= 54.0) || (rawFb13 && o13L5 >= 60.0))
  ) {
    isM13 = true;
    vipM13 = false;
    pkM13 = o13;
  }

  const hWGff = Number(t12.h_w_gff ?? 0);
  const aWGff = Number(t12.a_w_gff ?? 0);
  const hCGff = Number(t12.h_c_gff ?? 0);
  const aCGff = Number(t12.a_c_gff ?? 0);
  const hDGff = Number(t12.h_d_gff ?? 0);
  const aDGff = Number(t12.a_d_gff ?? 0);
  const hGffP12 = Number(t12.h_gff_p12 ?? 0);
  const aGffP12 = Number(t12.a_gff_p12 ?? 0);
  const hGffTot = Number(t12.h_gff_tot ?? 0);
  const aGffTot = Number(t12.a_gff_tot ?? 0);
  const hSPwr = Number(t12.h_s_pwr ?? 0);
  const aSPwr = Number(t12.a_s_pwr ?? 0);
  const hEfTot = (t12.h_ef_tot ?? [0, 0, 0, 0]).map((x) => Number(x));
  const aEfTot = (t12.a_ef_tot ?? [0, 0, 0, 0]).map((x) => Number(x));

  const [hDom, hDomCnt, hDomTie] = dominantElemInfoVec(hEfTot);
  const [aDom, aDomCnt, aDomTie] = dominantElemInfoVec(aEfTot);
  const hLeadCnt = [0, 1, 2, 3].filter((i) => hEfTot[i] > aEfTot[i]).length;
  const aLeadCnt = [0, 1, 2, 3].filter((i) => aEfTot[i] > hEfTot[i]).length;
  const dualWater = hDom === "WATER" && aDom === "WATER";
  const domSplit = !hDomTie && !aDomTie && hDom !== aDom;

  const baseM14Pick = hGffTot < aGffTot ? h : aGffTot < hGffTot ? a : favElo;
  const m14L5 = baseM14Pick === h ? hL5 : aL5;
  let baseM14Sig = false;
  let t12Code = "TOT12_NEUTRAL";
  if (
    !dualWater &&
    ((baseM14Pick === h && hLeadCnt >= 3) || (baseM14Pick === a && aLeadCnt >= 3)) &&
    m14L5 >= 55.0
  ) {
    baseM14Sig = true;
    t12Code = "TOT12_LEAD_3OF4";
  } else if (!dualWater && isDualPillar && pkDp === baseM14Pick && m14L5 >= 58.0) {
    baseM14Sig = true;
    t12Code = "TOT12_DUAL_HARMONY";
  } else if (
    !dualWater &&
    ((baseM14Pick === h && hWGff < aWGff && hCGff < aCGff) ||
      (baseM14Pick === a && aWGff < hWGff && aCGff < hCGff))
  ) {
    baseM14Sig = true;
    t12Code = "TOT12_BIPOLAR_HARMONY";
  }

  const p14 = baseM14Pick;
  const o14 = p14 === h ? a : h;
  const pl5_14 = p14 === h ? hL5 : aL5;
  const ol5_14 = p14 === h ? aL5 : hL5;
  const pWarm14 = p14 === h ? hWGff : aWGff;
  const p12FavOpp = o14 === h ? hGffP12 < aGffP12 : aGffP12 < hGffP12;
  const p12FavBase = p14 === h ? hGffP12 < aGffP12 : aGffP12 < hGffP12;
  const spwrFavOpp = o14 === h ? hSPwr < aSPwr : aSPwr < hSPwr;
  const m11DirOpp = pkM11 === o14;
  const m11FavOpp = isM11 && pkM11 === o14;
  const pLead14 = p14 === h ? hLeadCnt : aLeadCnt;
  const oLead14 = p14 === h ? aLeadCnt : hLeadCnt;

  const hasTrap14 = Boolean(
    (baseM14Sig && t12Code === "TOT12_BIPOLAR_HARMONY" && pl5_14 < 75.0) ||
      (baseM14Sig && pl5_14 < 50.0 && pWarm14 < 0) ||
      (baseM14Sig && dualWater)
  );
  let sm14Kind = "M14_HOLD_NEUTRAL";
  let isSm14 = false;
  let vipSm14 = false;
  let pkSm14 = p14;
  if (baseM14Sig) {
    if (hasTrap14) {
      pkSm14 = o14;
      if (m11DirOpp && !dualWater) {
        isSm14 = true;
        vipSm14 = false;
        sm14Kind = "M14_TRAP_FLIP";
      } else {
        isSm14 = false;
        vipSm14 = false;
        sm14Kind = "M14_VETO_TRAP";
      }
    } else {
      isSm14 = true;
      vipSm14 = Boolean(pLead14 === 3 || domSplit);
      pkSm14 = p14;
      sm14Kind = "M14_CORE_CLEAN";
    }
  } else if (!dualWater && pl5_14 >= 75.0) {
    isSm14 = true;
    vipSm14 = Boolean(pl5_14 >= 80.0 || pLead14 === 3);
    pkSm14 = p14;
    sm14Kind = "M14_DIRECT_RELEASE";
  } else if (
    !dualWater &&
    ((m11FavOpp && spwrFavOpp && ol5_14 >= 55.0) ||
      (ol5_14 >= 62.0 && (m11FavOpp || p12FavOpp)))
  ) {
    isSm14 = true;
    vipSm14 = Boolean((m11FavOpp && spwrFavOpp) || oLead14 === 3);
    pkSm14 = o14;
    sm14Kind = "M14_OPPOSITE_FLIP";
  }

  const hCat = hDomTie ? "TIE" : hDom;
  const aCat = aDomTie ? "TIE" : aDom;
  const domDelta = Math.abs(hDomCnt - aDomCnt);
  const airDelta = Math.abs(hEfTot[1] - aEfTot[1]);
  const hEfSum = hEfTot[0] + hEfTot[1] + hEfTot[2] + hEfTot[3];
  const aEfSum = aEfTot[0] + aEfTot[1] + aEfTot[2] + aEfTot[3];
  let efPick = "";
  let efTier = "NEUTRAL";
  let efRule = "NEUTRAL";
  if (hCat === "EARTH" && aCat === "EARTH" && domDelta >= 10) {
    efPick = hDomCnt < aDomCnt ? h : a;
    efTier = "STRONG";
    efRule = "EARTH_SAT10_SMALL";
  } else if (airDelta >= 8) {
    efPick = hEfTot[1] < aEfTot[1] ? h : a;
    efTier = "STRONG";
    efRule = "AIR_SAT8_SMALL";
  } else if (hCat === "WATER" && aCat === "WATER" && domDelta >= 1 && domDelta <= 3) {
    efPick = hDomCnt < aDomCnt ? h : a;
    efTier = "STRONG";
    efRule = "WATER_1_3_SMALL";
  } else if (hCat === "WATER" && aCat === "WATER" && domDelta >= 4) {
    efPick = hDomCnt > aDomCnt ? h : a;
    efTier = "STRONG";
    efRule = "WATER_4_PLUS_LARGE";
  } else if (hDomTie !== aDomTie) {
    efPick = hDomTie ? h : a;
    efTier = "STRONG";
    efRule = "TIE_VS_UNIQ";
  } else if (hCat === "EARTH" && aCat === "EARTH" && domDelta >= 4 && domDelta <= 9) {
    efPick = hDomCnt > aDomCnt ? h : a;
    efTier = "STRONG";
    efRule = "EARTH_4_9_LARGE";
  } else if (hLeadCnt === 3 || aLeadCnt === 3) {
    efPick = hLeadCnt === 3 ? h : a;
    efTier = "MEDIUM";
    efRule = "LEAD_3OF4";
  } else if (hCat === "EARTH" && aCat === "EARTH" && domDelta >= 1 && domDelta <= 3) {
    efPick = hDomCnt > aDomCnt ? h : a;
    efTier = "MEDIUM";
    efRule = "EARTH_1_3_LARGE";
  } else if (hEfSum !== aEfSum) {
    efPick = hEfSum > aEfSum ? h : a;
    efTier = "MEDIUM";
    efRule = "SPLIT_SUM_LARGE";
  }

  const sugPick = pkSm14;
  const sugL5 = sugPick === h ? hL5 : aL5;
  const epIsH = Boolean(efPick && efPick === h);
  const epL5 = !efPick ? 0.0 : epIsH ? hL5 : aL5;
  const epP12Ok = !efPick ? false : epIsH ? hGffP12 < aGffP12 : aGffP12 < hGffP12;
  const epSumOk = !efPick ? false : epIsH ? hEfSum > aEfSum : aEfSum > hEfSum;
  const epM11Dir = Boolean(efPick && pkM11 === efPick);
  const epM11Sig = Boolean(efPick && isM11 && pkM11 === efPick);
  const sugTeamSig = Boolean((tSig && tpk === sugPick) || (pSig && ppk === sugPick));
  const agreeBoxes = Boolean(efPick && sugPick === efPick);
  const clashBoxes = Boolean(efPick && sugPick !== efPick);
  const satTrap = efRule === "AIR_SAT8_SMALL" || efRule === "EARTH_SAT10_SMALL";

  const p1Hit = Boolean(
    !dualWater &&
      agreeBoxes &&
      epM11Dir &&
      (epL5 >= 58.0 || (efTier === "STRONG" && epL5 >= 53.0))
  );
  const p2Hit = Boolean(
    !dualWater &&
      agreeBoxes &&
      (isSm14 ||
        (efTier === "STRONG" &&
          (epM11Sig || sugTeamSig || (epP12Ok && epSumOk && epL5 >= 60.0))))
  );
  const p3Hit = Boolean(
    !dualWater &&
      efPick &&
      efTier === "STRONG" &&
      epP12Ok &&
      epL5 >= 62.0 &&
      (agreeBoxes || !isSm14)
  );
  const p4AirTrap = Boolean(
    clashBoxes && (sugTeamSig || (isSm14 && sugL5 >= 75.0)) && satTrap
  );
  const p4Hit = Boolean(
    !dualWater && clashBoxes && !satTrap && (sugTeamSig || (isSm14 && sugL5 >= 75.0))
  );
  let isM15 = Boolean(p1Hit || p2Hit || p3Hit || p4Hit);
  const pkM15 = p1Hit || p2Hit || p3Hit ? efPick : sugPick;
  let vipM15 = Number(p1Hit) + Number(p2Hit) + Number(p3Hit) + Number(p4Hit) >= 2;

  const b1H =
    Number(hWGff < aWGff) +
    Number(hCGff < aCGff) +
    Number(hDGff < aDGff) +
    Number(hGffTot < aGffTot) +
    Number(!dualWater && (hLeadCnt === 3 || (domSplit && (hDom === "WATER" || hDom === "AIR"))));
  const b1A =
    Number(aWGff < hWGff) +
    Number(aCGff < hCGff) +
    Number(aDGff < hDGff) +
    Number(aGffTot < hGffTot) +
    Number(!dualWater && (aLeadCnt === 3 || (domSplit && (aDom === "WATER" || aDom === "AIR"))));
  const hIsB = p14 === h;
  const aIsB = p14 === a;
  const hPureL5 =
    (hIsB && baseM14Sig && !hasTrap14) ||
    (hIsB && hL5 >= 75.0) ||
    (!hIsB && (hL5 >= 62.0 || (m11FavOpp && spwrFavOpp && hL5 >= 55.0)));
  const aPureL5 =
    (aIsB && baseM14Sig && !hasTrap14) ||
    (aIsB && aL5 >= 75.0) ||
    (!aIsB && (aL5 >= 62.0 || (m11FavOpp && spwrFavOpp && aL5 >= 55.0)));
  const smH =
    Number(baseM14Sig && hIsB && !hasTrap14) +
    Number(!dualWater && (hLeadCnt === 3 || (domSplit && (isSm14 ? pkSm14 === h : hDom !== "EARTH")))) +
    Number(hPureL5) +
    Number(
      !hIsB
        ? (isM11 && pkM11 === h) || p12FavOpp || (hasTrap14 && pkM11 === h)
        : (sm14Kind === "M14_CORE_CLEAN" || sm14Kind === "M14_DIRECT_RELEASE") && p12FavBase
    ) +
    Number(isSm14 && pkSm14 === h);
  const smA =
    Number(baseM14Sig && aIsB && !hasTrap14) +
    Number(!dualWater && (aLeadCnt === 3 || (domSplit && (isSm14 ? pkSm14 === a : aDom !== "EARTH")))) +
    Number(aPureL5) +
    Number(
      !aIsB
        ? (isM11 && pkM11 === a) || p12FavOpp || (hasTrap14 && pkM11 === a)
        : (sm14Kind === "M14_CORE_CLEAN" || sm14Kind === "M14_DIRECT_RELEASE") && p12FavBase
    ) +
    Number(isSm14 && pkSm14 === a);
  const f4H =
    Number(p1Hit && efPick === h) +
    Number(p2Hit && efPick === h) +
    Number(p3Hit && efPick === h) +
    Number(p4Hit && sugPick === h);
  const f4A =
    Number(p1Hit && efPick === a) +
    Number(p2Hit && efPick === a) +
    Number(p3Hit && efPick === a) +
    Number(p4Hit && sugPick === a);
  const totHTicks = b1H + smH + Number(efPick === h) + f4H;
  const totATicks = b1A + smA + Number(efPick === a) + f4A;

  const r82SatTrap = clashBoxes && satTrap && !p4Hit;
  const r82WeakClash = Boolean(isSm14 && clashBoxes && !p4Hit && !vipSm14);
  const f4Cnt = Number(p1Hit) + Number(p2Hit) + Number(p3Hit) + Number(p4Hit);
  const f4TickLead = isM15 ? (pkM15 === h ? totHTicks > totATicks : totATicks > totHTicks) : false;
  const nobetF4Trap = Boolean(!isSm14 && isM15 && !f4TickLead);
  const oppSug = sugPick === h ? a : h;
  const oppSugL5 = oppSug === h ? hL5 : aL5;
  const b1Pick = b1H > b1A ? h : b1A > b1H ? a : "";
  const revM12 = Boolean(!dualWater && isM12 && pkM12 === oppSug && (oppSugL5 < 50.0 || oppSugL5 >= 55.0));
  const revHM11 = Boolean(!dualWater && oppSugL5 >= 52.0 && isM11 && pkM11 === oppSug && efPick === oppSug);
  const dirM12 = Boolean(!dualWater && !isSm14 && !p4AirTrap && isM12 && pkM12 === sugPick && sugL5 >= 60.0);
  const dirM11B1 = Boolean(
    !dualWater && !isSm14 && !p4AirTrap && isM11 && pkM11 === sugPick && b1Pick === sugPick && sugL5 >= 65.0
  );

  let ptsH = 0.0;
  let ptsA = 0.0;
  let topHit = false;
  const addPts = (tmS: string, pts: number) => {
    if (pts > 0 && tmS === h) ptsH += pts;
    else if (pts > 0 && tmS === a) ptsA += pts;
  };

  if (isM15) {
    const soloP3 = p3Hit && !(p1Hit || p2Hit || p4Hit);
    if (f4Cnt >= 2 && (isSm14 || f4TickLead)) {
      addPts(pkM15, 10.0);
      topHit = true;
    } else if ((isSm14 && p4Hit) || (!isSm14 && (p1Hit || p2Hit) && f4TickLead)) {
      addPts(pkM15, 8.0);
      topHit = true;
    } else if (!isSm14 && p4Hit && f4TickLead) {
      addPts(pkM15, 7.0);
      topHit = true;
    } else if (soloP3) {
      addPts(pkM15, 1.0);
    } else {
      addPts(pkM15, 1.5);
    }
  } else if (p4AirTrap && efPick) {
    addPts(efPick, 3.5);
  }

  if (isSm14 && vipSm14 && !r82SatTrap) {
    addPts(pkSm14, 9.0);
    topHit = true;
  } else if (isSm14 && !r82WeakClash && !r82SatTrap) {
    addPts(pkSm14, 7.0);
    topHit = true;
  } else if (revM12 || revHM11) {
    addPts(oppSug, 7.0);
    topHit = true;
  } else if (!(r82WeakClash || r82SatTrap)) {
    if (dirM12 || dirM11B1) {
      addPts(sugPick, 7.0);
      topHit = true;
    } else if (nobetF4Trap && pkM15 === sugPick) {
      addPts(sugPick, 1.5);
    } else {
      addPts(sugPick, sugL5 >= 58.0 ? 5.0 : sugL5 >= 50.0 ? 4.0 : 2.5);
    }
  }

  if (isSm14 && !r82WeakClash && !r82SatTrap) {
    addPts(pkSm14, 6.0);
    topHit = true;
  } else if (revM12 || revHM11) {
    addPts(oppSug, 5.0);
  } else if (!(r82WeakClash || r82SatTrap)) {
    if (dirM12 || dirM11B1) {
      addPts(sugPick, 4.5);
    } else if (smH !== smA) {
      addPts(smH > smA ? h : a, 2.0);
    }
  }

  if (efPick) addPts(efPick, efTier === "STRONG" ? 3.5 : 2.0);
  if (!dualWater && (hLeadCnt === 3 || aLeadCnt === 3)) {
    addPts(hLeadCnt === 3 ? h : a, 1.5);
  } else if (domSplit && hDomCnt !== aDomCnt) {
    addPts(hDomCnt > aDomCnt ? h : a, 1.0);
  }
  if (b1Pick) addPts(b1Pick, Math.abs(b1H - b1A) >= 2 ? 1.5 : 1.0);

  const deltaPts = Math.round(Math.abs(ptsH - ptsA) * 10) / 10;
  const pkM16 = ptsH > ptsA ? h : ptsA > ptsH ? a : sugPick;
  const efStrongM16 = Boolean(efPick && efTier === "STRONG" && efPick === pkM16);
  const isM16 = Boolean(
    (topHit && deltaPts >= 8.0) || deltaPts >= 5.5 || (deltaPts >= 4.0 && efStrongM16)
  );
  const vipM16 = Boolean(topHit && deltaPts >= 18.0);

  if (htrapLv > 0 || atrapLv > 0) {
    if (isM13) {
      const tr13 = pkM13 === h ? htrapLv : atrapLv;
      const p0_13 = pkM13 === h ? h0011Sum : a0011Sum;
      if (tr13 >= 2 || (tr13 === 1 && !isM12 && p0_13 > -8.0)) {
        isM13 = false;
        vipM13 = false;
      }
    }
    if (isM15) {
      const tr15 = pkM15 === h ? htrapLv : atrapLv;
      const p0_15 = pkM15 === h ? h0011Sum : a0011Sum;
      if (tr15 >= 2 || (tr15 === 1 && !isM12 && p0_15 > -8.0)) {
        isM15 = false;
        vipM15 = false;
      }
    }
  }

  if (isM13 && pkM13 === a && !(a0011Sum < 0 || triple3Win === a || isM12)) {
    isM13 = false;
    vipM13 = false;
  }

  const sig17 = Boolean(isM13 && isM15 && pkM13 && pkM13 === pkM15);
  const pkM17 = sig17 ? pkM13 : "";
  let vipM17 = false;
  if (sig17) {
    const ish17 = pkM17 === h;
    const dElo = ish17 ? hpct : apct;
    const oppEl = ish17 ? aEl : hEl;
    const p0011 = ish17 ? h0011Sum : a0011Sum;
    const p1xxx = ish17 ? hSum : aSum;
    if (
      (dElo >= 75.0 && p0011 < 0 && vipM13) ||
      (p0011 <= -8.0 && p1xxx < 0 && vipM13) ||
      (dElo >= 58.0 && p0011 <= -8.0 && vipM13) ||
      (dElo >= 75.0 && oppEl === "EARTH") ||
      (dElo >= 60.0 && p0011 < 0)
    ) {
      vipM17 = true;
    }
  }

  const nextModes: Record<string, { sig: boolean; vip: boolean; pick: string }> = {
    ...fm.modes,
    dual_pillar: { sig: isDualPillar, vip: isVipCross, pick: pkDp },
    vip_cross: { sig: isVipCross, vip: isDiamond, pick: pkVip },
    astro_lock: { sig: isAstroLock, vip: Boolean(isAstroLock && isVipCross), pick: pkAst },
    diamond: { sig: isDiamond, vip: isDiamond, pick: pkDia },
    geo_1xxx_lock: { sig: isM5, vip: Boolean(isVipCross && g1Win === pkVip), pick: pkDp },
    double_pwr_lock: {
      sig: isM6,
      vip: Boolean(isVipCross && g1Win === pkVip && allWin === pkVip),
      pick: pkDp,
    },
    earth_neg_lock: { sig: isM7, vip: Boolean(isM7 && isVipCross), pick: pkDp },
    safe_dl_core: { sig: isM8, vip: isM7, pick: pkM8 },
    pos_inv_lock: { sig: isM9, vip: isM7, pick: pkM9 },
    gf_fin_pure: { sig: true, vip: Math.abs(hGf - aGf) >= 10.0, pick: pkM10 },
    tri_gf_routed: { sig: isM11, vip: Boolean(isM11 && triple3Win === pkM11), pick: pkM11 },
    tri_gf_ultralock: { sig: isM12, vip: Boolean(isM12 && isM9), pick: pkM12 },
    anti_nobet_smart: { sig: isM13, vip: vipM13, pick: pkM13 },
    total_elem_12: {
      sig: baseM14Sig,
      vip: Boolean(baseM14Sig && (hLeadCnt === 3 || aLeadCnt === 3)),
      pick: baseM14Pick,
    },
    smart_elem_14: { sig: isSm14, vip: vipSm14, pick: pkSm14 },
    fusion4_elem: { sig: isM15, vip: vipM15, pick: pkM15 },
    referee6_ranked: { sig: isM16, vip: vipM16, pick: pkM16 },
    mode17: { sig: sig17, vip: vipM17, pick: pkM17 },
  };

  const pHome01 = Math.min(0.99, Math.max(0.01, hL5 / 100));
  const hodds = Math.round((1 / pHome01) * 100) / 100;
  const aodds = Math.round((1 / (1 - pHome01)) * 100) / 100;
  const sysPick = g.sys_win || h;
  const mel = matchupElemFromPct(sysPick === h ? hL5 : aL5);

  return {
    ...g,
    wtp: {
      ...(g.wtp ?? { mon: "", htp: 0, atp: 0, dtp: 0, hrk: 99, ark: 99, hwl: "", awl: "" }),
      hpct,
      apct,
      l5h: hL5,
      hel: hEl,
      ael: aEl,
      mel,
      hodds,
      aodds,
      htrap: htrapLv,
      atrap: atrapLv,
      profileKey,
    },
    fusion_meta: {
      ...fm,
      vetoed: isVetoed,
      modes: nextModes,
      team: { ...tm, sig: tSig, vip: tVip },
      player: { ...pl, sig: pSig, vip: pVip },
      geo1xxx: {
        ...g1,
        m12_route: {
          ...(g1.m12_route ?? { code: "", reason_fa: "", flipped: false }),
          code: m12Code,
        },
      },
    },
  };
}

export type Mode17Tier = "black_diamond" | "pure_astro" | "daily_gold" | "standard" | "none";
export type Mode17FilterKey = "all17" | "gold_plus" | "sniper_top" | "all_slate";

export function evalMode17Gold(g: NbaGamePred) {
  const fm = g.fusion_meta;
  const inOverlap = fm?.in_auth_overlap !== false;
  const wtp: any = g.wtp ?? {};
  const profKey: PowerProfileKey = (wtp.profileKey as PowerProfileKey) || "a_elo";
  const pwrTag =
    profKey === "c_vol"
      ? "قدرت هیبرید فصل+Pyth"
      : profKey === "b_pure"
        ? "قدرت جدول خالص فصل"
        : "Direct Surface Elo";
  const g1 = fm?.geo1xxx;

  const rawM13 = fm?.modes?.anti_nobet_smart;
  const rawM15 = fm?.modes?.fusion4_elem;
  const fallbackAnb = rawM13 ? null : evalSmartAntiNoBet(g);
  const fallbackSm14 = rawM15 ? null : evalSmartMode14(g);

  const m13Sig = Boolean((rawM13 ? rawM13.sig : fallbackAnb?.sig) && inOverlap);
  const m13Pick = (rawM13 ? rawM13.pick : fallbackAnb?.pick) || "";
  const m13Vip = Boolean(
    rawM13
      ? rawM13.vip
      : fallbackAnb?.kind === "M12_CORE"
        ? Boolean(fm?.modes?.diamond?.sig || (m13Pick === g.h ? Number(wtp.l5h ?? 50) : 100 - Number(wtp.l5h ?? 50)) >= 75.0)
        : fallbackAnb?.vip
  );

  const m15Sig = Boolean((rawM15 ? rawM15.sig : fallbackSm14?.fusion4.active) && inOverlap);
  const m15Pick = (rawM15 ? rawM15.pick : fallbackSm14?.fusion4.pick) || "";

  const agreed = Boolean(m13Sig && m15Sig && m13Pick && m13Pick === m15Pick);
  const pick = agreed
    ? m13Pick
    : (m13Sig && m13Pick) || (m15Sig && m15Pick) || g.sys_win || g.h;
  const isHomePick = pick === g.h;

  const rawDirectElo = Number(isHomePick ? (wtp.hpct ?? 50) : (wtp.apct ?? 50));
  const directElo = Math.round(rawDirectElo * 10) / 10;
  const pickElem = String(isHomePick ? (wtp.hel ?? "AIR") : (wtp.ael ?? "AIR"));
  const oppElem = String(isHomePick ? (wtp.ael ?? "AIR") : (wtp.hel ?? "AIR"));
  const pick0011 = Math.round(Number(isHomePick ? (g1?.h_0011 ?? 0) : (g1?.a_0011 ?? 0)) * 10) / 10;
  const pick1xxx = Math.round(Number(isHomePick ? (g1?.h_sum ?? 0) : (g1?.a_sum ?? 0)) * 10) / 10;
  const fmtVal = (v: number) => (v > 0 ? `+${v.toFixed(1)}` : v === 0 ? "0.0" : v.toFixed(1));

  let tier: Mode17Tier = "none";
  let tierRank = 0;
  let badgeFa = "⛔ NO-BET (مهار قفل عدم توافق ۱۳ و ۱۵)";
  let lockTitleFa = "NO-BET (مهار قفل عدم توافق ۱۳ و ۱۵)";
  let reasonFa = "";
  let calWinPct = 50.0;
  let maxBuyCents = 0;

  if (!agreed) {
    const trapNames = [wtp.htrap ? getTeam3Code(g.h) : "", wtp.atrap ? getTeam3Code(g.a) : ""]
      .filter(Boolean)
      .join(" / ");
    const trapSuffix =
      profKey !== "a_elo" && trapNames
        ? ` • 🛡️ مهار سپر ایمنی فصل/اول‌ماه/۲۵۰ (${trapNames})`
        : "";
    if (m13Sig && m15Sig && m13Pick !== m15Pick) {
      reasonFa = `تضاد جهت دو موتور: حالت ۱۳ روی ${getTeam3Code(m13Pick)} و حالت ۱۵ روی ${getTeam3Code(m15Pick)} حکم داده است (ورود ممنوع)${trapSuffix}`;
    } else if (m13Sig && !m15Sig) {
      reasonFa = `حالت ۱۳ (${getTeam3Code(m13Pick)}) فعال است اما حالت ۱۵ (تلفیق ۴ پترن المنت) سیگنال تایید نداده است${trapSuffix}`;
    } else if (!m13Sig && m15Sig) {
      reasonFa = `حالت ۱۵ (${getTeam3Code(m15Pick)}) فعال است اما حالت ۱۳ (ضد NO-BET هوشمند) سیگنال تایید نداده است${trapSuffix}`;
    } else {
      reasonFa = `هر دو موتور حالت ۱۳ و حالت ۱۵ در این مسابقه خارج از سیگنال هستند${trapSuffix}`;
    }
  } else if (directElo >= 75.0 && pick0011 < 0 && m13Vip) {
    tier = "black_diamond";
    tierRank = 4;
    const bdPctTxt = profKey === "b_pure" ? "۸۹٫۶٪" : profKey === "c_vol" ? "۸۶٫۸٪" : "۸۱٫۳٪";
    badgeFa = `🖤 الماس سیاه • ${bdPctTxt}`;
    lockTitleFa = `سطح ۱ سوپر-الماس (الماس سیاه • ${bdPctTxt}): توافق ۱۳∩۱۵ + ${pwrTag}≥75% + کد 0011<0 + M13 VIP`;
    reasonFa = `${pwrTag}=${directElo.toFixed(1)}% • تک‌کد لنگر سرد 0011=${fmtVal(pick0011)} • تایید مستقیم M13 VIP`;
    calWinPct = profKey === "b_pure" ? 89.6 : profKey === "c_vol" ? 86.8 : 81.3;
    maxBuyCents = profKey === "a_elo" ? 79 : 85;
  } else if (
    (pick0011 <= -8.0 && pick1xxx < 0 && m13Vip) ||
    (directElo >= 58.0 && pick0011 <= -8.0 && m13Vip)
  ) {
    tier = "pure_astro";
    tierRank = 3;
    const paPctTxt = profKey === "b_pure" ? "۹۳٫۵٪" : profKey === "c_vol" ? "۸۹٫۷٪" : "۶۶٫۹٪";
    badgeFa = `⚡ نجومی خالص • ${paPctTxt}`;
    if (pick1xxx < 0 && directElo < 58.0) {
      lockTitleFa = `سطح ۲ تک‌تیرانداز (نجومی خالص • ${paPctTxt}): توافق ۱۳∩۱۵ + کد سرد 0011≤-8 + Σ(1xxx)<0 + M13 VIP`;
    } else if (pick1xxx < 0) {
      lockTitleFa = `سطح ۲ تک‌تیرانداز (نجومی خالص + شکارچی • ${paPctTxt}): 0011≤-8 + Σ(1xxx)<0 + ${pwrTag}≥58% + M13 VIP`;
    } else {
      lockTitleFa = `سطح ۲ تک‌تیرانداز (شکارچی ضریب نجومی • ${paPctTxt}): توافق ۱۳∩۱۵ + ${pwrTag}≥58% + کد سرد 0011≤-8 + M13 VIP`;
    }
    reasonFa = `کد سرد قوی 0011=${fmtVal(pick0011)} • قطب گرم Σ(1xxx)=${fmtVal(pick1xxx)} • ${pwrTag}=${directElo.toFixed(1)}% • M13 VIP`;
    calWinPct = profKey === "b_pure" ? 93.5 : profKey === "c_vol" ? 89.7 : 66.9;
    maxBuyCents = profKey === "a_elo" ? 65 : 86;
  } else if (
    (directElo >= 75.0 && oppElem === "EARTH") ||
    (directElo >= 60.0 && pick0011 < 0)
  ) {
    tier = "daily_gold";
    tierRank = 2;
    badgeFa =
      profKey === "b_pure"
        ? "🥇 طلایی روزانه • ۸۲٫۹٪"
        : profKey === "c_vol"
          ? "🥇 طلایی روزانه • ۸۰٫۳٪"
          : "🥇 طلایی روزانه • ۷۷٫۳٪";
    if (directElo >= 75.0 && oppElem === "EARTH") {
      lockTitleFa = `سطح ۳ طلایی روزانه: توافق ۱۳∩۱۵ + ${pwrTag}≥75% + حریف در تله عنصر EARTH`;
      reasonFa = `${pwrTag}=${directElo.toFixed(1)}% (≥75%) • عنصر حریف=${oppElem} (تله خاک)${pick0011 < 0 ? ` • 0011=${fmtVal(pick0011)}` : ""}`;
      calWinPct = profKey === "a_elo" ? 78.5 : 84.5;
    } else {
      lockTitleFa = `سطح ۳ طلایی روزانه: توافق ۱۳∩۱۵ + ${pwrTag}≥60% + تک‌کد سرد فعال 0011<0`;
      reasonFa = `${pwrTag}=${directElo.toFixed(1)}% (≥60%) • تک‌کد لنگر سرد 0011=${fmtVal(pick0011)} (<0)`;
      calWinPct = profKey === "b_pure" ? 82.9 : profKey === "c_vol" ? 80.3 : 77.3;
    }
    maxBuyCents = profKey === "a_elo" ? 74 : 78;
  } else {
    tier = "standard";
    tierRank = 1;
    const stdPctTxt = profKey === "b_pure" ? "۷۷٫۳٪" : profKey === "c_vol" ? "۷۸٫۰٪" : "۶۷٫۱٪";
    badgeFa = `✅ استاندارد طلایی • ${stdPctTxt}`;
    lockTitleFa = `سطح ۴ استاندارد طلایی (${stdPctTxt}): توافق هم‌جهت حالت ۱۳ (ضد NO-BET) ∩ حالت ۱۵ (تلفیق ۴ پترن)`;
    reasonFa = `هم‌جهتی کامل Pick_13 === Pick_15 روی ${getTeam3Code(pick)} • ${pwrTag}=${directElo.toFixed(1)}%`;
    calWinPct = profKey === "b_pure" ? 77.3 : profKey === "c_vol" ? 78.0 : 67.1;
    maxBuyCents = profKey === "a_elo" ? 65 : 75;
  }

  const vip = tier === "black_diamond" || tier === "pure_astro" || tier === "daily_gold";

  return {
    sig: agreed,
    vip,
    pick,
    tier,
    tierRank,
    badgeFa,
    lockTitleFa,
    reasonFa,
    calWinPct,
    maxBuyCents,
    directElo,
    pick0011,
    pick1xxx,
    pickElem,
    oppElem,
    m13Vip,
    m13Sig,
    m13Pick,
    m15Sig,
    m15Pick,
  };
}

export type ModeBenchSummary = {
  modeNum: number;
  title: string;
  "2024": { w: number; n: number; pct: number; rec: string };
  "2025": { w: number; n: number; pct: number; rec: string };
  "2026": { w: number; n: number; pct: number; rec: string };
  total: { w: number; n: number; pct: number; rec: string };
  last50: { w: number; n: number; pct: number; rec: string };
};

export function computeMode17BenchStats(
  gamesList: NbaGamePred[],
  profileKey: PowerProfileKey = "c_vol"
): ModeBenchSummary {
  const sorted = [...gamesList].sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : a.n - b.n));
  const activeDone: { s: string; won: boolean }[] = [];
  for (const g of sorted) {
    if (!g.done || !g.aw || g.aw === "PENDING") continue;
    const pg = applyPowerProfileToGame(g, profileKey);
    const r = evalMode17Gold(pg);
    if (!r.sig) continue;
    activeDone.push({ s: String(g.s || g.d?.slice(0, 4) || ""), won: r.pick === g.aw });
  }
  const fmtStat = (arr: { won: boolean }[]) => {
    const n = arr.length;
    const w = arr.filter((x) => x.won).length;
    const pct = n > 0 ? Math.round((10000 * w) / n) / 100 : 0;
    return { w, n, pct, rec: `${w}/${n}` };
  };
  return {
    modeNum: 17,
    title: "Mode 17: Golden Intersection (Mode 13 ∩ Mode 15)",
    "2024": fmtStat(activeDone.filter((x) => x.s === "2024")),
    "2025": fmtStat(activeDone.filter((x) => x.s === "2025")),
    "2026": fmtStat(activeDone.filter((x) => x.s === "2026")),
    total: fmtStat(activeDone),
    last50: fmtStat(activeDone.slice(-50)),
  };
}

export default function NbaDashboardTab({
  fusionMode = "mode17",
  twinDbKind = "team",
  tour = "ATP",
  deg3Opt = "opt3",
  powerProfile = "c_vol",
}: {
  fusionMode?: FusionModeKey;
  twinDbKind?: TwinDbKind;
  tour?: "ATP" | "WTA" | "ALL";
  deg3Opt?: "opt1" | "opt2" | "opt3";
  powerProfile?: PowerProfileKey;
}) {
  const [rawGames, setRawGames] = useState<NbaGamePred[]>([]);
  const [mode17TierFilter, setMode17TierFilter] = useState<Mode17FilterKey>("all17");
  type CardBoxKey = "referee6" | "sixboxes" | "box1" | "smart" | "box2" | "dom" | "elem" | "fusion4" | "lineup";
  const [defaultCardBoxes, setDefaultCardBoxes] = useState<Record<CardBoxKey, boolean>>(() => ({
    referee6: false,
    sixboxes: false,
    box1: fusionMode === "mode17",
    smart: false,
    box2: true,
    dom: false,
    elem: false,
    fusion4: false,
    lineup: false,
  }));
  const [cardBoxOverrides, setCardBoxOverrides] = useState<Record<string, boolean>>({});
  useEffect(() => {
    if (fusionMode === "mode17") {
      setDefaultCardBoxes((prev) => ({ ...prev, box1: true, box2: true }));
    }
  }, [fusionMode]);
  const isCardBoxOpen = (gameNo: number, key: CardBoxKey) => {
    const k = `${gameNo}:${key}`;
    return k in cardBoxOverrides ? cardBoxOverrides[k] : defaultCardBoxes[key];
  };
  const toggleCardBox = (gameNo: number, key: CardBoxKey) => {
    setCardBoxOverrides((prev) => {
      const k = `${gameNo}:${key}`;
      const cur = k in prev ? prev[k] : defaultCardBoxes[key];
      return { ...prev, [k]: !cur };
    });
  };
  const toggleGlobalCardBox = (key: CardBoxKey) => {
    const nextOpen = !defaultCardBoxes[key];
    const innerSixKeys: CardBoxKey[] = ["box1", "smart", "box2", "dom", "elem", "fusion4"];
    const autoOpenSix = nextOpen && innerSixKeys.includes(key);
    setDefaultCardBoxes((prev) => ({
      ...prev,
      [key]: nextOpen,
      ...(autoOpenSix ? { sixboxes: true } : {}),
    }));
    setCardBoxOverrides((prev) => {
      const next = { ...prev };
      const suffix = `:${key}`;
      for (const ok of Object.keys(next)) {
        if (ok.endsWith(suffix) || (autoOpenSix && ok.endsWith(":sixboxes"))) delete next[ok];
      }
      return next;
    });
  };
  const setAllCardBoxes = (open: boolean) => {
    setDefaultCardBoxes({
      referee6: open,
      sixboxes: open,
      box1: open,
      smart: open,
      box2: open,
      dom: open,
      elem: open,
      fusion4: open,
      lineup: open,
    });
    setCardBoxOverrides({});
  };
  const didAutoPickDateRef = useRef(false);
  const isPure2EngineMode =
    fusionMode === "dual_pillar" ||
    fusionMode === "vip_cross" ||
    fusionMode === "astro_lock" ||
    fusionMode === "diamond";
  const games = useMemo(() => {
    return rawGames.map((rawG) => {
      const g = applyPowerProfileToGame(rawG, powerProfile);
      const m =
        fusionMode === "mode17"
          ? evalMode17Gold(g)
          : fusionMode === "anti_nobet_smart"
            ? powerProfile === "a_elo"
              ? evalSmartAntiNoBet(g)
              : g.fusion_meta?.modes?.anti_nobet_smart
            : fusionMode === "total_elem_12"
              ? powerProfile === "a_elo"
                ? evalSmartMode14(g)
                : g.fusion_meta?.modes?.smart_elem_14
              : fusionMode === "fusion4_elem"
                ? g.fusion_meta?.modes?.fusion4_elem
                : fusionMode === "referee6_ranked"
                  ? g.fusion_meta?.modes?.referee6_ranked
                  : g.fusion_meta?.modes?.[fusionMode];
      if (!m) return g;
      const inOverlap = g.fusion_meta?.in_auth_overlap !== false;
      const pick = m.pick || g.sys_win || g.h;
      const sig = Boolean(m.sig && inOverlap);
      const vip = Boolean(m.vip && inOverlap);
      const melDy = String((g.wtp_day ?? g.wtp)?.mel ?? "AIR");
      const done = Boolean(g.done && g.aw && g.aw !== "PENDING");
      const hit: "WIN" | "LOSS" = pick === g.aw ? "WIN" : "LOSS";
      const allowMode1VetoHint = isPure2EngineMode && Boolean(g.fusion_meta?.vetoed);
      const bypassDailyEarth =
        fusionMode === "mode17" ||
        fusionMode === "pos_inv_lock" ||
        fusionMode === "gf_fin_pure" ||
        fusionMode === "tri_gf_routed" ||
        fusionMode === "tri_gf_ultralock" ||
        fusionMode === "anti_nobet_smart" ||
        fusionMode === "total_elem_12" ||
        fusionMode === "fusion4_elem" ||
        fusionMode === "referee6_ranked";
      return {
        ...g,
        sys_win: pick,
        pw: pick,
        fpw: sig ? pick : "",
        twWin: pick,
        f1: Boolean(sig || allowMode1VetoHint),
        f1_idx: sig,
        f1_guard: sig,
        f1_wtp: sig,
        vip_idx3: vip,
        idx_rescue: false,
        f1_wtp_day: bypassDailyEarth ? sig : Boolean(sig && melDy !== "EARTH"),
        vip_idx3_day: bypassDailyEarth ? vip : Boolean(vip && melDy !== "EARTH"),
        st: done ? hit : g.st,
        fst: done && sig ? hit : undefined,
      } as NbaGamePred;
    });
  }, [rawGames, fusionMode, isPure2EngineMode, powerProfile]);
  const [histGames, setHistGames] = useState<HistGameRow[]>([]);
  const [histLoading, setHistLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [engineMode, setEngineMode] = useState<EngineMode>("manual");
  const [manualPersp, setManualPersp] = useState<"home" | "away">("home");
  const [manualDayFilter, setManualDayFilter] = useState<string>("ALL");
  const [openDailyCardsSection, setOpenDailyCardsSection] = useState<boolean>(true);
  const [dailyCardDate, setDailyCardDate] = useState<string>("2026-11-18");
  const [manualGeoKind, setManualGeoKind] = useState<"fin" | "dyn">("fin");
  const [monthlyCalendarKind, setMonthlyCalendarKind] = useState<"shamsi" | "greg">("shamsi");
  const [syncBusy, setSyncBusy] = useState<boolean>(false);
  const [rosterSyncBusy, setRosterSyncBusy] = useState<boolean>(false);
  const [syncMsg, setSyncMsg] = useState<string>(() => {
    try {
      const pending = sessionStorage.getItem("nba_sync_toast_v1");
      if (pending) {
        sessionStorage.removeItem("nba_sync_toast_v1");
        return pending;
      }
    } catch {}
    return "";
  });
  const [kalshiMarkets, setKalshiMarkets] = useState<Record<string, any>>({});
  const [kalshiConfigOpen, setKalshiConfigOpen] = useState<boolean>(false);
  const [kalshiHasKey, setKalshiHasKey] = useState<boolean>(false);
  const [kalshiKeyMasked, setKalshiKeyMasked] = useState<string>("");
  const [kalshiKeyIdInput, setKalshiKeyIdInput] = useState<string>("");
  const [kalshiPemInput, setKalshiPemInput] = useState<string>("");
  const [kalshiEnv, setKalshiEnv] = useState<"live" | "demo">("live");
  const [kalshiDefaultStake, setKalshiDefaultStake] = useState<number>(3);
  const [kalshiVipStake, setKalshiVipStake] = useState<number>(6);
  const [kalshiAutoEnabled, setKalshiAutoEnabled] = useState<boolean>(false);
  const [kalshiAutoTimeEt, setKalshiAutoTimeEt] = useState<string>("11:00");
  const [kalshiBalance, setKalshiBalance] = useState<string | null>(null);
  const [kalshiLedger, setKalshiLedger] = useState<Record<string, any>>({});
  const [kalshiCardEnabled, setKalshiCardEnabled] = useState<Record<number, boolean>>({});
  const [kalshiCardStake, setKalshiCardStake] = useState<Record<number, number>>({});
  const [kalshiCardLimit, setKalshiCardLimit] = useState<Record<number, number>>({});
  const [kalshiCardFeedback, setKalshiCardFeedback] = useState<Record<number, { ok: boolean; msg: string }>>({});
  const [kalshiBusy, setKalshiBusy] = useState<boolean>(false);
  const [kalshiExecReport, setKalshiExecReport] = useState<{ mode: string; results: any[]; summary?: any; error?: string } | null>(null);
  const [comboOpen, setComboOpen] = useState<boolean>(false);
  const [comboSelectedByDate, setComboSelectedByDate] = useState<Record<string, number[]>>({});
  const [comboStakeUsd, setComboStakeUsd] = useState<number>(4);
  const [comboCustomLimitCents, setComboCustomLimitCents] = useState<Record<string, number>>({});
  const [comboReport, setComboReport] = useState<any | null>(null);
  const [dailyCardMode, setDailyCardMode] = useState<"nhl_best" | "nhl_vip3" | "nhl_f1_guard" | "nhl_f1_idx_raw" | "nhl_f1" | "nhl_f1_union" | "step" | "geo" | "geo_dyn" | "geo_tab">("nhl_best");
  const [oddsFreqMode, setOddsFreqMode] = useState<"weekly" | "daily">(() => {
    try {
      const s = localStorage.getItem("nba_odds_freq_mode_v1");
      if (s === "daily" || s === "weekly") return s;
    } catch {}
    return "weekly";
  });
  const changeOddsFreqMode = (m: "weekly" | "daily") => {
    setOddsFreqMode(m);
    try {
      localStorage.setItem("nba_odds_freq_mode_v1", m);
    } catch {}
  };
  const activeWtpOf = (g: NbaGamePred) => (oddsFreqMode === "daily" ? (g.wtp_day ?? g.wtp) : g.wtp);
  const activeF1WtpOf = (g: NbaGamePred) =>
    Boolean(oddsFreqMode === "daily" ? (g.f1_wtp_day ?? g.f1_wtp ?? g.f1_guard ?? g.f1_idx) : (g.f1_wtp ?? g.f1_guard ?? g.f1_idx));
  const activeVip3Of = (g: NbaGamePred) =>
    Boolean(oddsFreqMode === "daily" ? (g.vip_idx3_day ?? g.vip_idx3) : g.vip_idx3);
  const activeUnionOf = (g: NbaGamePred) =>
    Boolean(oddsFreqMode === "daily" ? (g.f1_union_day ?? g.f1_union) : g.f1_union);
  const [dailyCardFilter, setDailyCardFilter] = useState<"all" | "qualified" | "anti_nobet" | "referee6" | "ref_top" | "vip3" | "posev" | "win" | "loss" | "pending">("qualified");
  const [filterAutoNote, setFilterAutoNote] = useState<string>("");
  const [cardFlipDir, setCardFlipDir] = useState<Record<number, boolean>>({});
  const [openManualKalshiCards, setOpenManualKalshiCards] = useState<Record<number, boolean>>({});
  const [openKalshiAutoPanel, setOpenKalshiAutoPanel] = useState<boolean>(false);
  const [openAdvancedCardOpts, setOpenAdvancedCardOpts] = useState<boolean>(false);
  const [openStatsSection, setOpenStatsSection] = useState<boolean>(false);
  const [openManualSection, setOpenManualSection] = useState<boolean>(false);
  const [openSummaryTable, setOpenSummaryTable] = useState<boolean>(false);
  const [manualOpenGames, setManualOpenGames] = useState<Record<number, boolean>>({});
  const [manualShowAllRows, setManualShowAllRows] = useState<Record<number, boolean>>({});
  const [copiedGame, setCopiedGame] = useState<number | null>(null);
  const MANUAL_STORAGE_KEY = "nba-manual-filters-ele12-v2";
  const [manualFilters, setManualFilters] = useState<Record<number, ManualFilterState>>(() => {
    try {
      const raw = localStorage.getItem("nba-manual-filters-ele12-v2");
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(MANUAL_STORAGE_KEY, JSON.stringify(manualFilters));
    } catch {
      // ignore storage quota errors
    }
  }, [manualFilters]);
  const [twinPattern, setTwinPattern] = useState<TwinPatternKey>("twF1Wtp");
  const [fusionPattern, setFusionPattern] = useState<FusionPatternKey>("f12");
  const [singlePattern, setSinglePattern] = useState<SinglePatternKey>("s1_f1");
  const [seasonFilter, setSeasonFilter] = useState<string>("ALL");
  const [monthFilter, setMonthFilter] = useState<string>("ALL");
  const [dateFilter, setDateFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [teamQuery, setTeamQuery] = useState<string>("");
  const [expandedGame, setExpandedGame] = useState<number | null>(null);
  const [showMonthlyTable, setShowMonthlyTable] = useState<boolean>(true);
  const [page, setPage] = useState<number>(1);
  const PAGE_SIZE = 30;
  const MASTER_DATA_VERSION = SHARD_BUILD_VERSION;

  const buildFusionShardUrls = (t: string, opt: string, bust?: number) => {
    const tours = t === "ALL" ? ["atp", "wta"] : [t.toLowerCase()];
    const yrs = ["2024", "2025", "2026"];
    const qs = `?v=${SHARD_BUILD_VERSION}${bust ? `&t=${bust}` : ""}`;
    return tours.flatMap((tr) => yrs.map((yr) => `/fusion_${tr}_${opt}_${yr}.json${qs}`));
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const urls = buildFusionShardUrls(tour, deg3Opt);
    Promise.all(urls.map((u) => fetch(u, { cache: "no-store" }).then((r) => (r.ok ? r.json() : { games: [] }))))
      .then((docs: { games?: NbaGamePred[] }[]) => {
        if (!cancelled) {
          const merged = docs.flatMap((d) => d?.games ?? []);
          merged.sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : a.n - b.n));
          setRawGames(merged);
          if (merged.length > 0 && !didAutoPickDateRef.current) {
            didAutoPickDateRef.current = true;
            let bestDate = merged[merged.length - 1].d;
            for (let idx = merged.length - 1; idx >= 0; idx--) {
              if (evalMode17Gold(applyPowerProfileToGame(merged[idx], powerProfile)).sig) {
                bestDate = merged[idx].d;
                break;
              }
            }
            setDailyCardDate(bestDate);
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tour, deg3Opt, MASTER_DATA_VERSION]);

  useEffect(() => {
    let cancelled = false;
    setHistLoading(true);
    const suffix = twinDbKind === "player" ? "p" : deg3Opt;
    const histUrls =
      tour === "ALL"
        ? [`/tennis_hist_atp_${suffix}.json?v=${SHARD_BUILD_VERSION}`, `/tennis_hist_wta_${suffix}.json?v=${SHARD_BUILD_VERSION}`]
        : [`/tennis_hist_${tour.toLowerCase()}_${suffix}.json?v=${SHARD_BUILD_VERSION}`];
    Promise.all(histUrls.map((u) => fetch(u, { cache: "no-store" }).then((r) => (r.ok ? r.json() : []))))
      .then((arrList: any[][]) => {
        const rawRows = arrList.flat();
        if (!cancelled && Array.isArray(rawRows)) {
          const parsed: HistGameRow[] = rawRows.map((arr) => {
            const h12 = Array.isArray(arr[8]) ? arr[8].map(String) : [];
            const a12 = Array.isArray(arr[10]) ? arr[10].map(String) : [];
            return {
              d: String(arr[0]),
              day: String(arr[1]),
              s: String(arr[2]),
              h: String(arr[3]) === "LA Clippers" ? "Los Angeles Clippers" : String(arr[3]),
              a: String(arr[4]) === "LA Clippers" ? "Los Angeles Clippers" : String(arr[4]),
              hp: Number(arr[5]),
              ap: Number(arr[6]),
              mg: Number(arr[7]),
              h12,
              hGeo: elemCodeFromFinal4(h12),
              a12,
              aGeo: elemCodeFromFinal4(a12),
              f30: Number(arr[12] ?? 0),
              hGeoDyn: String(arr[9] ?? ""),
              aGeoDyn: String(arr[11] ?? ""),
              hGeoTab: String(arr[14] ?? ""),
              aGeoTab: String(arr[15] ?? ""),
            };
          });
          setHistGames(parsed);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setHistLoading(false);
      });

    apiRpcFetch("/api/kalshi/markets")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("fallback"))))
      .then((d) => {
        if (!cancelled && d?.markets && Object.keys(d.markets).length > 0) {
          setKalshiMarkets(d.markets);
        } else {
          fetch(`/tennis_atp_predictions.json?v=${SHARD_BUILD_VERSION}`, { cache: "no-store" })
            .then((r2) => (r2.ok ? r2.json() : null))
            .then((d2) => {
              if (!cancelled && d2?.markets) setKalshiMarkets(d2.markets);
            })
            .catch(() => {});
        }
      })
      .catch(() => {});

    apiRpcFetch("/api/kalshi/state")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d?.ok) {
          setKalshiHasKey(Boolean(d.hasKey));
          setKalshiKeyMasked(d.keyIdMasked ?? "");
          if (d.env) setKalshiEnv(d.env);
          if (d.defaultStakeUsd) setKalshiDefaultStake(Number(d.defaultStakeUsd));
          if (d.vipStakeUsd) setKalshiVipStake(Number(d.vipStakeUsd));
          setKalshiAutoEnabled(Boolean(d.autoScheduleEnabled));
          if (d.autoScheduleTimeEt) setKalshiAutoTimeEt(d.autoScheduleTimeEt);
          if (d.ledger) setKalshiLedger(d.ledger);
          if (d.hasKey) {
            apiRpcFetch("/api/kalshi/balance", { method: "POST" })
              .then((rb) => (rb.ok ? rb.json() : null))
              .then((db) => {
                if (!cancelled && db?.ok && db.balanceUsd) setKalshiBalance(db.balanceUsd);
              })
              .catch(() => {});
          }
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [tour, deg3Opt, twinDbKind]);

  const matchTwin = useCallback((g: NbaGamePred, p: TwinPatternKey) => {
    if (p === "twVipIdx3") return Boolean(oddsFreqMode === "daily" ? (g.vip_idx3_day ?? g.vip_idx3) : g.vip_idx3);
    if (p === "twF1Wtp") return Boolean(oddsFreqMode === "daily" ? (g.f1_wtp_day ?? g.f1_wtp ?? g.f1_guard ?? g.f1_idx) : (g.f1_wtp ?? g.f1_guard ?? g.f1_idx));
    if (p === "twF1Guard") return Boolean(g.f1_guard ?? g.f1_idx);
    if (p === "twF1Idx") return Boolean(g.f1_idx);
    if (p === "twF1Union") return Boolean(oddsFreqMode === "daily" ? (g.f1_union_day ?? g.f1_union) : g.f1_union);
    if (p === "twVipDual") return Boolean(g.vip);
    if (p === "twF1") return Boolean(g.f1);
    if (p === "twSNew") return Boolean(g.s_new);
    if (p === "twF1Agree") return Boolean(g.f1 && (g.f30 ?? 0) > 0);
    if (p === "twSA1") return Boolean(g.s_a1);
    return true;
  }, [oddsFreqMode]);

  const matchFusion = useCallback((g: NbaGamePred, p: FusionPatternKey) => {
    const f = g.f30 ?? 0;
    if (p === "f12") return f >= 12;
    if (p === "f8") return f >= 8;
    if (p === "f6") return f >= 6;
    if (p === "fa10") return Math.abs(f) >= 10;
    return true;
  }, []);

  const matchSingle = useCallback((g: NbaGamePred, p: SinglePatternKey) => {
    if (p === "s1_vip") return Boolean(g.vip);
    if (p === "s1_f1") return Boolean(g.f1);
    if (p === "s1_guard") return Boolean(g.s_new && g.a1_veto);
    return true;
  }, []);

  const getGamePredWinner = (g: NbaGamePred) => {
    const base =
      twinPattern === "tall" && engineMode !== "manual"
        ? (g.fpw ?? g.sys_win ?? g.pw ?? g.h)
        : (g.sys_win ?? g.fpw ?? g.pw ?? g.h);
    if (cardFlipDir[g.n]) {
      return base === g.h ? g.a : g.h;
    }
    return base;
  };

  const getGameStatus = (g: NbaGamePred): "WIN" | "LOSS" | "PENDING" => {
    if (!g.done || !g.aw || g.aw === "PENDING") return "PENDING";
    const pw = getGamePredWinner(g);
    return pw === g.aw ? "WIN" : "LOSS";
  };

  const runLiveNhlSync = async () => {
    setSyncBusy(true);
    setSyncMsg("");
    try {
      try {
        sessionStorage.setItem(
          "nba_sync_toast_v1",
          "بروزرسانی زنده نتایج واقعی مسابقات تنیس (ATP / WTA) از ESPN انجام شد ✓"
        );
      } catch {}
      const d = await apiRpcJson("/api/nba/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetDate: dailyCardDate }),
      });
      if (d?.ok) {
        const ts = Date.now();
        const docs = await Promise.all(
          buildFusionShardUrls(tour, deg3Opt, ts).map((u) =>
            fetch(u, { cache: "no-store" }).then((r) => (r.ok ? r.json() : { games: [] }))
          )
        );
        const merged = docs.flatMap((doc: any) => doc?.games ?? []);
        if (merged.length > 0) {
          merged.sort((a: any, b: any) => (a.d < b.d ? -1 : a.d > b.d ? 1 : a.n - b.n));
          setRawGames(merged);
        }
        if ((d.updatedScores ?? 0) > 0) {
          const suffix = twinDbKind === "player" ? "p" : deg3Opt;
          const hUrls =
            tour === "ALL"
              ? [`/tennis_hist_atp_${suffix}.json?t=${ts}`, `/tennis_hist_wta_${suffix}.json?t=${ts}`]
              : [`/tennis_hist_${tour.toLowerCase()}_${suffix}.json?t=${ts}`];
          const rawLists = await Promise.all(hUrls.map((u) => fetch(u).then((r) => (r.ok ? r.json() : []))));
          const rawRows = rawLists.flat();
          if (Array.isArray(rawRows) && rawRows.length > 0) {
            const parsed: HistGameRow[] = rawRows.map((arr: any) => {
              const h12 = Array.isArray(arr[8]) ? arr[8].map(String) : [];
              const a12 = Array.isArray(arr[10]) ? arr[10].map(String) : [];
              return {
                d: String(arr[0]),
                day: String(arr[1]),
                s: String(arr[2]),
                h: String(arr[3]),
                a: String(arr[4]),
                hp: Number(arr[5]),
                ap: Number(arr[6]),
                mg: Number(arr[7]),
                h12,
                hGeo: elemCodeFromFinal4(h12),
                a12,
                aGeo: elemCodeFromFinal4(a12),
                f30: Number(arr[12] ?? 0),
                hGeoDyn: String(arr[9] ?? ""),
                aGeoDyn: String(arr[11] ?? ""),
              };
            });
            setHistGames(parsed);
          }
        }
        const rm = await apiRpcFetch("/api/kalshi/markets");
        if (rm.ok) {
          const dm = await rm.json();
          if (dm?.markets) setKalshiMarkets((prev) => ({ ...prev, ...dm.markets }));
        }
        try { sessionStorage.removeItem('nba_sync_toast_v1'); } catch {}
        setSyncMsg(
          `بروزرسانی زنده نتایج واقعی تنیس (ATP/WTA) از ESPN انجام شد (${d.updatedScores ?? 0} نتیجه جدید ثبت شد • کل بازی‌های انجام‌شده: ${d.totalDone ?? 0})`
        );
      } else {
        setSyncMsg(d?.error ?? "خطا در بروزرسانی نتایج واقعی تنیس");
      }
    } catch (e) {
      try { sessionStorage.removeItem('nba_sync_toast_v1'); } catch {}
      setSyncMsg((e as Error).message);
    } finally {
      setSyncBusy(false);
    }
  };

  const runLiveRosterSync = async () => {
    setRosterSyncBusy(true);
    setSyncMsg("");
    try {
      const d = await apiRpcJson("/api/nba/sync-rosters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetDate: dailyCardDate }),
      });
      if (d?.ok) {
        const ts = Date.now();
        const docs = await Promise.all(
          buildFusionShardUrls(tour, deg3Opt, ts).map((u) =>
            fetch(u, { cache: "no-store" }).then((r) => (r.ok ? r.json() : { games: [] }))
          )
        );
        const merged = docs.flatMap((doc: any) => doc?.games ?? []);
        if (merged.length > 0) {
          merged.sort((a: any, b: any) => (a.d < b.d ? -1 : a.d > b.d ? 1 : a.n - b.n));
          setRawGames(merged);
        }
        try {
          const rm = await apiRpcFetch("/api/kalshi/markets");
          if (rm.ok) {
            const dm = await rm.json();
            if (dm?.markets) setKalshiMarkets((prev) => ({ ...prev, ...dm.markets }));
          }
        } catch {}
        setSyncMsg(
          `بروزرسانی جدول و نتایج زنده تنیس (ATP / WTA) از ESPN انجام شد (${d.updatedGames ?? 0} مسابقه آپدیت شد)`
        );
      } else {
        setSyncMsg(d?.error ?? "خطا در بروزرسانی جدول مسابقات تنیس");
      }
    } catch (e) {
      setSyncMsg((e as Error).message);
    } finally {
      setRosterSyncBusy(false);
    }
  };

  const matchesMode17Filter = useCallback((g: NbaGamePred, f: Mode17FilterKey) => {
    if (f === "all_slate") return true;
    const r = evalMode17Gold(g);
    if (!r.sig) return false;
    if (f === "sniper_top") return r.tier === "black_diamond" || r.tier === "pure_astro";
    if (f === "gold_plus") return r.tier === "black_diamond" || r.tier === "pure_astro" || r.tier === "daily_gold";
    return true;
  }, []);

  const patternGames = games.filter((g) => {
    const baseMatch =
      engineMode === "manual"
        ? (manualDayFilter === "ALL" || g.day === manualDayFilter) && matchTwin(g, twinPattern)
        : engineMode === "twins"
          ? matchTwin(g, twinPattern)
          : engineMode === "fusion"
            ? matchFusion(g, fusionPattern)
            : matchSingle(g, singlePattern);
    if (!baseMatch) return false;
    if (
      fusionMode === "mode17" &&
      (engineMode === "manual" || engineMode === "twins") &&
      twinPattern === "twF1Wtp" &&
      (mode17TierFilter === "gold_plus" || mode17TierFilter === "sniper_top")
    ) {
      return matchesMode17Filter(g, mode17TierFilter);
    }
    return true;
  });
  const patternCompleted = patternGames.filter((g) => {
    const st = getGameStatus(g);
    return st === "WIN" || st === "LOSS";
  });
  const patternWins = patternCompleted.filter((g) => getGameStatus(g) === "WIN").length;
  const patternAcc = patternCompleted.length > 0 ? ((100 * patternWins) / patternCompleted.length).toFixed(2) : "0.00";

  const seasons = ["2024", "2025", "2026"];
  const seasonStats = seasons.map((s) => {
    const sub = patternCompleted.filter((g) => g.s === s);
    const w = sub.filter((g) => getGameStatus(g) === "WIN").length;
    const pend = patternGames.filter((g) => g.s === s && getGameStatus(g) === "PENDING").length;
    return {
      season: s,
      wins: w,
      losses: sub.length - w,
      total: sub.length,
      pending: pend,
      pct: sub.length > 0 ? ((100 * w) / sub.length).toFixed(2) : "—",
    };
  });

  const getMonthBucket = (g: NbaGamePred) => (monthlyCalendarKind === "shamsi" ? (g.sh_m ?? g.ym) : g.ym);
  const months = Array.from(new Set(patternCompleted.map((g) => getMonthBucket(g)))).sort();
  let cumW = 0;
  let cumN = 0;
  const monthlyRows = months.map((ym) => {
    const sub = patternCompleted.filter((g) => getMonthBucket(g) === ym);
    const mw = sub.filter((g) => getGameStatus(g) === "WIN").length;
    const mn = sub.length;
    cumW += mw;
    cumN += mn;
    return {
      ym,
      mw,
      mn,
      mPct: mn > 0 ? ((100 * mw) / mn).toFixed(1) : "0.0",
      cumW,
      cumN,
      cumPct: cumN > 0 ? ((100 * cumW) / cumN).toFixed(2) : "0.00",
    };
  });

  const allMonths = Array.from(new Set(games.map((g) => g.ym))).sort();
  const allGameDates = Array.from(new Set(games.map((g) => g.d))).sort();
  const activeDailyDate = allGameDates.includes(dailyCardDate)
    ? dailyCardDate
    : allGameDates.includes("2026-11-21")
      ? "2026-11-21"
      : allGameDates[allGameDates.length - 1] ?? "2026-11-14";
  const dailyDateIdx = allGameDates.indexOf(activeDailyDate);
  const gamesOnDailyDateRaw = games.filter((g) => g.d === activeDailyDate);
  const gamesOnDailyDate = [...gamesOnDailyDateRaw].sort(
    (a, b) => Math.abs(b.f30 ?? 0) - Math.abs(a.f30 ?? 0)
  );

  const mode17ScopeStats = useMemo(() => {
    const calcBucket = (arr: { won: boolean | null }[]) => {
      const doneArr = arr.filter((x) => x.won !== null);
      const w = doneArr.filter((x) => x.won === true).length;
      const n = doneArr.length;
      const pct = n > 0 ? Math.round((10000 * w) / n) / 100 : 0;
      return { total: arr.length, w, n, pct };
    };
    const q = teamQuery.trim().toLowerCase();
    const scoped = games.filter((g) => {
      if (manualDayFilter !== "ALL" && g.day !== manualDayFilter) return false;
      if (seasonFilter !== "ALL" && g.s !== seasonFilter) return false;
      if (monthFilter !== "ALL" && g.ym !== monthFilter) return false;
      if (q) {
        const hay = [g.h, g.a, g.hc, g.ac, g.city, g.tourney, g.venue, g.surface, g.h_ioc, g.a_ioc]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    const evals = scoped.map((g) => {
      const r = evalMode17Gold(g);
      const isDone = Boolean(g.done && g.aw && g.aw !== "PENDING");
      const won = isDone ? r.pick === g.aw : null;
      return { g, r, won };
    });
    const all17 = evals.filter((e) => e.r.sig);
    const t1 = all17.filter((e) => e.r.tier === "black_diamond");
    const t2 = all17.filter((e) => e.r.tier === "pure_astro");
    const t3 = all17.filter((e) => e.r.tier === "daily_gold");
    const t4 = all17.filter((e) => e.r.tier === "standard");
    const sniper = all17.filter((e) => e.r.tier === "black_diamond" || e.r.tier === "pure_astro");
    const goldPlus = all17.filter(
      (e) => e.r.tier === "black_diamond" || e.r.tier === "pure_astro" || e.r.tier === "daily_gold"
    );
    const atp17 = all17.filter((e) => (e.g.tour ?? "").toUpperCase() === "ATP");
    const wta17 = all17.filter((e) => (e.g.tour ?? "").toUpperCase() === "WTA");
    const l50 = all17.filter((e) => e.won !== null).slice(-50);
    return {
      all17: calcBucket(all17),
      goldPlus: calcBucket(goldPlus),
      sniper: calcBucket(sniper),
      t1: calcBucket(t1),
      t2: calcBucket(t2),
      t3: calcBucket(t3),
      t4: calcBucket(t4),
      atp17: calcBucket(atp17),
      wta17: calcBucket(wta17),
      l50: calcBucket(l50),
      lastDateAll17: all17.length > 0 ? all17[all17.length - 1].g.d : "",
      lastDateGold: goldPlus.length > 0 ? goldPlus[goldPlus.length - 1].g.d : "",
      lastDateSniper: sniper.length > 0 ? sniper[sniper.length - 1].g.d : "",
    };
  }, [games, manualDayFilter, seasonFilter, monthFilter, teamQuery]);

  const mode17DayCounts = useMemo(() => {
    let all17 = 0;
    let goldPlus = 0;
    let sniper = 0;
    for (const g of gamesOnDailyDate) {
      const r = evalMode17Gold(g);
      if (!r.sig) continue;
      all17++;
      if (r.tier === "black_diamond" || r.tier === "pure_astro") {
        sniper++;
        goldPlus++;
      } else if (r.tier === "daily_gold") {
        goldPlus++;
      }
    }
    return { all17, goldPlus, sniper, slate: gamesOnDailyDate.length };
  }, [gamesOnDailyDate]);

  const switchMode17TierChip = (nextKey: Mode17FilterKey) => {
    setMode17TierFilter(nextKey);
    setDailyCardFilter(nextKey === "all_slate" ? "all" : "qualified");
    if (nextKey !== "all_slate") {
      const dayHas = gamesOnDailyDate.some((x) => matchesMode17Filter(x, nextKey));
      if (!dayHas) {
        const targetDate =
          nextKey === "sniper_top"
            ? mode17ScopeStats.lastDateSniper
            : nextKey === "gold_plus"
              ? mode17ScopeStats.lastDateGold
              : mode17ScopeStats.lastDateAll17;
        if (targetDate) {
          setDailyCardDate(targetDate);
        }
      }
    }
  };

  const histByDay = useMemo(() => {
    const map: Record<string, HistGameRow[]> = {};
    for (const r of histGames) {
      if (!map[r.day]) map[r.day] = [];
      map[r.day].push(r);
    }
    return map;
  }, [histGames]);

  const getDayPoolBefore = useCallback(
    (day: string, dateIso: string): HistGameRow[] => {
      const arr = histByDay[day];
      if (!arr || arr.length === 0) return [];
      let lo = 0;
      let hi = arr.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (arr[mid].d < dateIso) lo = mid + 1;
        else hi = mid;
      }
      return arr.slice(0, lo);
    },
    [histByDay]
  );

  const resolveNhlF1Pool = (g: NbaGamePred, dPool: HistGameRow[]): HistGameRow[] | null => {
    if (!g.twins || g.twins.length === 0) return null;
    const matched: HistGameRow[] = [];
    for (const tw of g.twins) {
      const td = String(tw[0]);
      const thc = String(tw[1]);
      const tac = String(tw[2]);
      const found = dPool.find(
        (r) => r.d === td && (getTeam3Code(r.h) === getTeam3Code(thc) || r.h === thc) && (getTeam3Code(r.a) === getTeam3Code(tac) || r.a === tac)
      );
      if (found) matched.push(found);
    }
    return matched.length >= 5 ? matched : null;
  };

  const scopeBeforeStatus = patternGames.filter((g) => {
    if (seasonFilter !== "ALL" && g.s !== seasonFilter) return false;
    if (monthFilter !== "ALL" && g.ym !== monthFilter) return false;
    if (dateFilter !== "ALL" && g.d !== dateFilter) return false;
    if (teamQuery.trim() !== "") {
      const q = teamQuery.trim().toLowerCase();
      const hay = [g.h, g.a, g.hc, g.ac, g.city, g.tourney, g.venue, g.surface, g.h_ioc, g.a_ioc]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const scopeStatusCounts = scopeBeforeStatus.reduce(
    (acc, g) => {
      const st = getGameStatus(g);
      acc[st] = (acc[st] ?? 0) + 1;
      return acc;
    },
    { WIN: 0, LOSS: 0, PENDING: 0 } as Record<"WIN" | "LOSS" | "PENDING", number>
  );

  const filteredGamesRaw = scopeBeforeStatus.filter((g) => {
    if (statusFilter !== "ALL" && getGameStatus(g) !== statusFilter) return false;
    return true;
  });

  const filteredGames =
    dateFilter !== "ALL"
      ? [...filteredGamesRaw].sort((a, b) =>
          engineMode !== "single"
            ? Math.abs(b.f30 ?? 0) - Math.abs(a.f30 ?? 0)
            : Math.abs((b.vm6 ?? b.f30) ?? 0) - Math.abs((a.vm6 ?? a.f30) ?? 0)
        )
      : filteredGamesRaw;

  const totalPages = Math.max(1, Math.ceil(filteredGames.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageGames = filteredGames.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const activeDef =
    engineMode === "manual" || engineMode === "twins"
      ? TWIN_PATTERN_DEFS.find((d) => d.key === twinPattern) ?? TWIN_PATTERN_DEFS[0]
      : engineMode === "fusion"
        ? FUSION_PATTERN_DEFS.find((d: any) => d.key === fusionPattern) ?? FUSION_PATTERN_DEFS[0]
        : SINGLE_PATTERN_DEFS.find((d: any) => d.key === singlePattern) ?? SINGLE_PATTERN_DEFS[0];

  return (
    <Card className="border-sky-200 bg-sky-50/40 shadow-sm mb-6" data-testid="card-nba-new-system">
      <CardContent className="p-4 sm:p-5 flex flex-col gap-4">
        {/* Prominent Top Live Update Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-sky-200/80 pb-3.5" dir="rtl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-1 rounded-md bg-sky-800 text-white text-xs font-extrabold shadow-2xs">
              نوار بروزرسانی زنده داده‌ها
            </span>
            <button
              type="button"
              disabled={syncBusy}
              onClick={runLiveNhlSync}
              data-testid="button-nba-live-sync"
              className="inline-flex items-center gap-1.5 text-xs font-extrabold bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700 disabled:opacity-60 transition-colors shadow-xs"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncBusy ? "animate-spin" : ""}`} />
              {syncBusy ? "در حال دریافت نتایج واقعی تنیس..." : "بروزرسانی زنده مسابقات ATP / WTA (ESPN)"}
            </button>
            <button
              type="button"
              onClick={async () => {
                try {
                  const d = await apiRpcJson("/api/kalshi/markets?force=1");
                  if (d?.markets) setKalshiMarkets((prev) => ({ ...prev, ...d.markets }));
                } catch {}
              }}
              data-testid="button-nba-kalshi-refresh"
              className="inline-flex items-center gap-1.5 text-xs font-extrabold bg-white border border-sky-300 text-sky-950 px-3 py-1.5 rounded-lg hover:bg-sky-100 transition-colors shadow-2xs"
            >
              بروزرسانی قیمت‌های Kalshi تنیس (KXATPMATCH / KXWTAMATCH)
            </button>
          </div>

          <div className="inline-flex items-center rounded-lg border border-sky-300 bg-white p-0.5 shadow-2xs" dir="rtl">
            <span className="px-2 text-[11px] font-bold text-slate-600">ضریب جدول:</span>
            <button
              type="button"
              onClick={() => changeOddsFreqMode("weekly")}
              data-testid="button-nba-odds-freq-weekly-top"
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors ${
                oddsFreqMode === "weekly"
                  ? "bg-sky-700 text-white shadow-2xs"
                  : "text-slate-700 hover:bg-sky-50"
              }`}
            >
              هفتگی (دوشنبه)
            </button>
            <button
              type="button"
              onClick={() => changeOddsFreqMode("daily")}
              data-testid="button-nba-odds-freq-daily-top"
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors ${
                oddsFreqMode === "daily"
                  ? "bg-indigo-600 text-white shadow-2xs"
                  : "text-slate-700 hover:bg-indigo-50"
              }`}
            >
              روزانه (تا شب قبل)
            </button>
          </div>
        </div>

        {/* TOP BAR & DAILY GAME CARDS */}
        <div className="rounded-xl border-2 border-sky-300 bg-sky-50/80 shadow-sm overflow-hidden" dir="rtl">
          {/* Collapsible Top Bar Header */}
          <div
            onClick={() => setOpenDailyCardsSection((v) => !v)}
            className="bg-sky-200/80 hover:bg-sky-200 px-4 py-2.5 border-b border-sky-300 cursor-pointer flex flex-wrap items-center justify-between gap-2.5 transition-colors"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-1 rounded-md bg-sky-700 text-white font-extrabold text-xs shadow-2xs">
                کارت‌های تصمیم‌گیری ۲ باکسی مسابقات روز تنیس (ATP / WTA)
              </span>
              <span className="px-2.5 py-0.5 rounded bg-white text-sky-950 border border-sky-300 text-xs font-extrabold font-mono">
                {activeDailyDate} • {gamesOnDailyDate.length} مسابقه تنیس
              </span>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setOpenDailyCardsSection((v) => !v);
              }}
              className="px-3 py-1 rounded border border-sky-400 bg-white hover:bg-sky-50 text-sky-950 text-xs font-extrabold shadow-2xs"
            >
              {openDailyCardsSection ? "بستن کارت‌های روز ▲" : "باز کردن کارت‌های روز ▼"}
            </button>
          </div>

          {openDailyCardsSection && (
            <div className="p-3.5 space-y-3 bg-sky-50/50">
              {/* Clean Daily Control Bar (Date Selector + Filter + Direct Update Buttons + Collapsible Advanced Options) */}
              <div className="bg-white p-2.5 rounded-lg border border-sky-200 shadow-2xs space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Date Navigation */}
                    <div className="inline-flex items-center gap-1 bg-sky-50 border border-sky-300 rounded-md p-1">
                      <button
                        type="button"
                        data-testid="button-nba-prev-date"
                        disabled={dailyDateIdx <= 0}
                        onClick={() => {
                          if (dailyDateIdx > 0) {
                            const prevD = allGameDates[dailyDateIdx - 1];
                            setDailyCardDate(prevD);
                            setDateFilter(prevD);
                            setMonthFilter("ALL");
                            setSeasonFilter("ALL");
                            if (!games.some((x) => x.d === prevD && Boolean(x.done)) && (statusFilter === "WIN" || statusFilter === "LOSS")) {
                              setStatusFilter("ALL");
                            }
                            setPage(1);
                          }
                        }}
                        className="px-2 py-1 rounded bg-white hover:bg-sky-100 disabled:opacity-40 text-sky-950 border border-sky-200 text-xs font-bold"
                        title="روز قبل"
                      >
                        ◀ روز قبل
                      </button>

                      <select
                        value={activeDailyDate}
                        onChange={(e) => {
                          const dVal = e.target.value;
                          setDailyCardDate(dVal);
                          setDateFilter(dVal);
                          setMonthFilter("ALL");
                          setSeasonFilter("ALL");
                          if (!games.some((x) => x.d === dVal && Boolean(x.done)) && (statusFilter === "WIN" || statusFilter === "LOSS")) {
                            setStatusFilter("ALL");
                          }
                          setPage(1);
                        }}
                        data-testid="select-nba-daily-date"
                        className="h-7 rounded bg-white px-2 text-xs font-mono font-extrabold text-sky-950 border border-sky-200"
                      >
                        {allGameDates.map((dStr) => {
                          const cnt = games.filter((x) => x.d === dStr).length;
                          const dayName = games.find((x) => x.d === dStr)?.day ?? "";
                          return (
                            <option key={dStr} value={dStr}>
                              {dStr} ({dayName} • {cnt} بازی)
                            </option>
                          );
                        })}
                      </select>

                      <button
                        type="button"
                        data-testid="button-nba-next-date"
                        disabled={dailyDateIdx < 0 || dailyDateIdx >= allGameDates.length - 1}
                        onClick={() => {
                          if (dailyDateIdx >= 0 && dailyDateIdx < allGameDates.length - 1) {
                            const nextD = allGameDates[dailyDateIdx + 1];
                            setDailyCardDate(nextD);
                            setDateFilter(nextD);
                            setMonthFilter("ALL");
                            setSeasonFilter("ALL");
                            if (!games.some((x) => x.d === nextD && Boolean(x.done)) && (statusFilter === "WIN" || statusFilter === "LOSS")) {
                              setStatusFilter("ALL");
                            }
                            setPage(1);
                          }
                        }}
                        className="px-2 py-1 rounded bg-white hover:bg-sky-100 disabled:opacity-40 text-sky-950 border border-sky-200 text-xs font-bold"
                        title="روز بعد"
                      >
                        روز بعد ▶
                      </button>
                    </div>

                    {/* Quick Jump Buttons for Recent Slates */}
                    <div className="flex flex-wrap items-center gap-1">
                      {[
                        { d: "2026-11-14", lbl: "11/14" },
                        { d: "2026-11-15", lbl: "11/15" },
                        { d: "2026-11-16", lbl: "11/16" },
                        { d: "2026-11-17", lbl: "11/17" },
                        { d: "2026-11-18", lbl: "11/18" },
                      ].map((q) => (
                        <button
                          key={q.d}
                          type="button"
                          onClick={() => {
                            setDailyCardDate(q.d);
                            setDateFilter(q.d);
                            setMonthFilter("ALL");
                            setSeasonFilter("ALL");
                            if (!games.some((x) => x.d === q.d && Boolean(x.done)) && (statusFilter === "WIN" || statusFilter === "LOSS")) {
                              setStatusFilter("ALL");
                            }
                            setPage(1);
                          }}
                          className={`px-2 py-1 rounded text-[11px] font-mono border transition-colors ${
                            activeDailyDate === q.d
                              ? "bg-sky-700 text-white border-sky-800 font-bold"
                              : "bg-sky-50 hover:bg-sky-100 text-sky-900 border-sky-200"
                          }`}
                        >
                          {q.lbl}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        if (dailyCardFilter === "qualified") {
                          setDailyCardFilter("all");
                          if (fusionMode === "mode17") setMode17TierFilter("all_slate");
                        } else {
                          setDailyCardFilter("qualified");
                          if (fusionMode === "mode17" && mode17TierFilter === "all_slate") {
                            setMode17TierFilter("all17");
                          }
                        }
                      }}
                      className={`h-8 px-2.5 rounded-md border text-xs font-extrabold transition-colors ${
                        dailyCardFilter === "qualified"
                          ? "bg-emerald-700 text-white border-emerald-800 shadow-2xs"
                          : "bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border-emerald-300"
                      }`}
                    >
                      {dailyCardFilter === "qualified"
                        ? `نمایش کل اسلیت روز با NO-BET (${gamesOnDailyDate.length})`
                        : `فقط سیگنال‌های تاییدشده (${gamesOnDailyDate.filter((x) => activeF1WtpOf(x)).length})`}
                    </button>

                    <select
                      value={dailyCardFilter}
                      onChange={(e) => {
                        const nextV = e.target.value as
                          | "all"
                          | "qualified"
                          | "anti_nobet"
                          | "referee6"
                          | "ref_top"
                          | "vip3"
                          | "posev"
                          | "win"
                          | "loss"
                          | "pending";
                        setDailyCardFilter(nextV);
                        if (fusionMode === "mode17") {
                          if (nextV === "all") setMode17TierFilter("all_slate");
                          else if (mode17TierFilter === "all_slate") setMode17TierFilter("all17");
                        }
                      }}
                      data-testid="select-nba-daily-filter"
                      className="h-8 rounded-md border border-sky-300 bg-white px-2 text-xs text-slate-800 font-bold"
                    >
                      <option value="qualified">فقط سیگنال‌های تاییدشده موتور فعال ({gamesOnDailyDate.filter((x) => activeF1WtpOf(x)).length} بازی)</option>
                      <option value="all">کل اسلیت روز شامل NO-BET ({gamesOnDailyDate.length} بازی)</option>
                      <option value="anti_nobet">
                        {fusionMode === "total_elem_12"
                          ? `فقط سیگنال‌های باکس هوشمند حالت ۱۴ (${gamesOnDailyDate.filter((x) => evalSmartMode14(x).sig).length} بازی)`
                          : `فقط سیگنال‌های باکس ضد NO-BET هوشمند (${gamesOnDailyDate.filter((x) => evalSmartAntiNoBet(x).sig).length} بازی)`}
                      </option>
                      {fusionMode === "total_elem_12" && (
                        <>
                          <option value="referee6">تایید رتبه‌بندی ۶ باکس رتبه ۱ تا ۳ ({gamesOnDailyDate.filter((x) => evalSmartMode14(x).referee6.active).length} بازی)</option>
                          <option value="ref_top">فقط سطح قوی ★/★★ داور ۶ باکس ({gamesOnDailyDate.filter((x) => evalSmartMode14(x).referee6.isTopSignal).length} بازی)</option>
                        </>
                      )}
                      <option value="vip3">فقط سطح ویژه VIP ({gamesOnDailyDate.filter((x) => activeVip3Of(x)).length} بازی)</option>
                      <option value="posev">فقط دارای ارزش خرید Kalshi (+EV)</option>
                      <option value="win">فقط بردهای سیگنال فعال (WIN ✓)</option>
                      <option value="loss">فقط باخت‌های سیگنال فعال (LOSS ✕)</option>
                      <option value="pending">فقط در انتظار برگزاری سیگنال فعال (PENDING)</option>
                    </select>



                    <button
                      type="button"
                      disabled={syncBusy}
                      onClick={runLiveNhlSync}
                      data-testid="button-nba-daily-sync"
                      className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-extrabold text-xs shadow-2xs transition-colors"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${syncBusy ? "animate-spin" : ""}`} />
                      {syncBusy ? "دریافت نتایج..." : "آپدیت نتایج مسابقات"}
                    </button>

                    <button
                      type="button"
                      onClick={() => setOpenAdvancedCardOpts((v) => !v)}
                      className="h-8 px-2.5 rounded-md border border-sky-300 bg-sky-50 hover:bg-sky-100 text-sky-950 text-[11px] font-bold"
                    >
                      {openAdvancedCardOpts ? "بستن تنظیمات دستی ▲" : "تنظیمات کانال دستی ▼"}
                    </button>
                  </div>
                </div>

                {openAdvancedCardOpts && (
                  <div className="pt-2 border-t border-sky-100 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={dailyCardMode}
                        onChange={(e) =>
                          setDailyCardMode(
                            e.target.value as "nhl_best" | "nhl_vip3" | "nhl_f1_guard" | "nhl_f1_idx_raw" | "nhl_f1" | "nhl_f1_union" | "step" | "geo" | "geo_dyn" | "geo_tab"
                          )
                        }
                        data-testid="select-nba-daily-card-mode"
                        className="h-8 rounded border border-sky-300 bg-sky-50 px-2 text-xs font-bold text-sky-950"
                      >
                        <option value="nhl_best">سیستم نهایی تنیس (پیش‌فرض موتور تلفیقی)</option>
                        <option value="nhl_vip3">فقط سطح ویژه VIP</option>
                        <option value="step">کانال ۱ دستی: گام‌به‌گام (STEP)</option>
                        <option value="geo">کانال ۲ دستی: شکل رمل اصلاحی (GEO-FIN)</option>
                        <option value="geo_dyn">کانال ۳ دستی: شکل رمل پویا (GEO-DYN)</option>
                        <option value="geo_tab">کانال ۴ دستی: شکل رمل جدول روزانه (GEO-TAB)</option>
                      </select>

                      <div className="inline-flex items-center rounded-md border border-sky-300 bg-sky-50 p-0.5">
                        <button
                          type="button"
                          onClick={() => changeOddsFreqMode("weekly")}
                          data-testid="button-nba-odds-freq-weekly"
                          className={`h-7 px-2.5 rounded text-[11px] font-extrabold transition-colors ${
                            oddsFreqMode === "weekly" ? "bg-sky-700 text-white shadow-2xs" : "text-slate-700 hover:bg-white"
                          }`}
                        >
                          ضریب هفتگی (دوشنبه)
                        </button>
                        <button
                          type="button"
                          onClick={() => changeOddsFreqMode("daily")}
                          data-testid="button-nba-odds-freq-daily"
                          className={`h-7 px-2.5 rounded text-[11px] font-extrabold transition-colors ${
                            oddsFreqMode === "daily" ? "bg-indigo-600 text-white shadow-2xs" : "text-slate-700 hover:bg-white"
                          }`}
                        >
                          ضریب روزانه (تا شب قبل)
                        </button>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const nextMap = { ...manualFilters };
                        gamesOnDailyDate.forEach((g) => {
                          const t12 = (manualPersp === "home" ? g.h_12 : g.a_12) ?? [];
                          const tGeoFin = (manualPersp === "home" ? g.h_geo : g.a_geo) ?? "";
                          const tGeoDyn = (manualPersp === "home" ? (g.h_geo_dyn ?? g.h_geo) : (g.a_geo_dyn ?? g.a_geo)) ?? "";
                          const tGeoTab = (manualPersp === "home" ? g.h_geo_tab : g.a_geo_tab) ?? "";
                          const activeGeoKind: "fin" | "dyn" | "tab" =
                            dailyCardMode === "geo_tab"
                              ? "tab"
                              : dailyCardMode === "geo_dyn" || g.chan === "GEO-DYN"
                                ? "dyn"
                                : manualGeoKind;
                          const tGeo = activeGeoKind === "tab" ? tGeoTab : activeGeoKind === "dyn" ? tGeoDyn : tGeoFin;
                          const dPool = getDayPoolBefore(g.day, g.d);
                          const stepRes = computeAutoFilterState(t12, tGeoFin, dPool, manualPersp, false, "fin");
                          const geoRes = computeAutoFilterState(t12, tGeo, dPool, manualPersp, true, activeGeoKind);
                          const pickGeo = dailyCardMode !== "step";
                          const chosen = pickGeo ? geoRes : stepRes;
                          nextMap[g.n] = {
                            ...chosen.state,
                            modeLabel:
                              dailyCardMode === "geo_tab"
                                ? "کانال ۴: اول شکل جدول GEO-TAB"
                                : dailyCardMode === "geo_dyn"
                                  ? "کانال ۳: اول GEO-DYN"
                                  : dailyCardMode === "step"
                                    ? "کانال ۱: گام‌به‌گام STEP"
                                    : "کانال ۲: اول GEO-FIN",
                            stepSummary: stepRes.sumStr,
                            geoSummary: geoRes.sumStr,
                          };
                        });
                        if (dailyCardMode === "geo_dyn") setManualGeoKind("dyn");
                        else if (dailyCardMode === "geo") setManualGeoKind("fin");
                        setManualFilters(nextMap);
                        setDateFilter(activeDailyDate);
                        setTwinPattern("tall");
                        setOpenManualSection(true);
                      }}
                      className="px-3 py-1.5 rounded-md bg-sky-700 hover:bg-sky-800 text-white font-extrabold text-xs shadow-2xs transition-colors"
                    >
                      قفل و ارسال کارت‌های روز به جدول فیلتر دستی ({gamesOnDailyDate.length} بازی)
                    </button>
                  </div>
                )}
              </div>

              {/* Live Daily Win/Loss Scoreboard Driven by Active Fusion Engine */}
              {(() => {
                const faDigits = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
                const m17TitlePct =
                  mode17ScopeStats.all17.n > 0
                    ? `${mode17ScopeStats.all17.pct.toFixed(1).replace(".", "٫").replace(/\d/g, (d) => faDigits[Number(d)] ?? d)}٪`
                    : powerProfile === "a_elo"
                      ? "۷۱٫۱٪"
                      : "۷۸٫۰٪";
                const modeTitleMap: Record<FusionModeKey, string> = {
                  mode17: `حالت ۱۷ • تقاطع طلایی (۱۳ ∩ ۱۵ — ${m17TitlePct})`,
                  tri_gf_ultralock: "حالت ۱۲ (ابرقفل ۳ عددی + Σ3 + ضدحذف)",
                  anti_nobet_smart: "حالت ۱۳ (ضد NO-BET هوشمند: مستقیم + عکس)",
                  total_elem_12: "حالت ۱۴ (قطبیت کامل المنت کل بازیکن + تورنمنت)",
                  fusion4_elem: "حالت ۱۵ (تلفیق ۴ پترن باکس ۲ + المنت غالب)",
                  referee6_ranked: "حالت ۱۶ (داور رتبه‌بندی و امتیازدهی وزنی ۶ باکس)",
                  tri_gf_routed: "حالت ۱۱ (موتور مستقل ۳ عددی + Σ3 + ضدحذف)",
                  gf_fin_pure: "حالت ۱۰ (موتور خالص GF-FIN)",
                  pos_inv_lock: "حالت ۹ (قفل جامع v5 + داور GF-FIN)",
                  earth_neg_lock: "حالت ۷ (قفل ایمن منفی + داور GF-FIN)",
                  safe_dl_core: "حالت ۸ (قفل مستقل ایمن + داور GF-FIN)",
                  double_pwr_lock: "حالت ۶ (قفل دوگانه ۱xxx + Σ8)",
                  geo_1xxx_lock: "حالت ۵ (فیلتر رمل ۱xxx)",
                  dual_pillar: "حالت ۱ (تلفیق دو-ستونی)",
                  vip_cross: "حالت ۲ (شکارچی VIP)",
                  astro_lock: "حالت ۳ (قفل نجومی)",
                  diamond: "حالت ۴ (قفل الماس T∩P)",
                };
                const evalPick = (x: NbaGamePred) => {
                  const base = x.sys_win || x.h;
                  return cardFlipDir[x.n] ? (base === x.h ? x.a : x.h) : base;
                };
                const isActiveSigCard = (x: NbaGamePred) =>
                  fusionMode === "mode17"
                    ? mode17TierFilter === "all_slate"
                      ? evalMode17Gold(x).sig
                      : matchesMode17Filter(x, mode17TierFilter)
                    : activeF1WtpOf(x);
                const doneCards = gamesOnDailyDate.filter((x) => Boolean(x.done && x.aw && x.aw !== "PENDING"));
                const sigCards = gamesOnDailyDate.filter(isActiveSigCard);
                const sigDone = sigCards.filter((x) => Boolean(x.done && x.aw && x.aw !== "PENDING"));
                const sigPend = sigCards.length - sigDone.length;
                const sigWins = sigDone.filter((x) => evalPick(x) === x.aw).length;
                const sigLosses = sigDone.length - sigWins;
                const sigPct = sigDone.length > 0 ? Math.round((1000 * sigWins) / sigDone.length) / 10 : null;
                const allWins = doneCards.filter((x) => evalPick(x) === x.aw).length;
                const allLosses = doneCards.length - allWins;
                const allPct = doneCards.length > 0 ? Math.round((1000 * allWins) / doneCards.length) / 10 : null;

                const sm14Evals = gamesOnDailyDate.map((x) => ({ g: x, sm: evalSmartMode14(x) }));
                const sm14Active = sm14Evals.filter((e) => e.sm.sig);
                const sm14VetoCnt = sm14Evals.filter((e) => e.sm.kind === "M14_VETO_TRAP").length;
                const sm14CoreCnt = sm14Active.filter((e) => e.sm.kind === "M14_CORE_CLEAN").length;
                const sm14DirCnt = sm14Active.filter((e) => e.sm.kind === "M14_DIRECT_RELEASE").length;
                const sm14OppCnt = sm14Active.filter((e) => e.sm.kind === "M14_OPPOSITE_FLIP" || e.sm.kind === "M14_TRAP_FLIP").length;
                const sm14Done = sm14Active.filter((e) => Boolean(e.g.done && e.g.aw && e.g.aw !== "PENDING"));
                const sm14Wins = sm14Done.filter((e) => e.sm.pick === e.g.aw).length;
                const sm14Losses = sm14Done.length - sm14Wins;
                const sm14Pct = sm14Done.length > 0 ? Math.round((1000 * sm14Wins) / sm14Done.length) / 10 : null;
                const elemActive = sm14Evals.filter((e) => e.sm.elemFollow.hasPick);
                const elemDone = elemActive.filter((e) => Boolean(e.g.done && e.g.aw && e.g.aw !== "PENDING"));
                const elemWins = elemDone.filter((e) => e.sm.elemFollow.pick === e.g.aw).length;
                const elemLosses = elemDone.length - elemWins;
                const elemPct = elemDone.length > 0 ? Math.round((1000 * elemWins) / elemDone.length) / 10 : null;
                const elemAgreeActive = sm14Active.filter((e) => e.sm.elemFollow.hasPick && e.sm.elemFollow.pick === e.sm.pick);
                const elemAgreeDone = elemAgreeActive.filter((e) => Boolean(e.g.done && e.g.aw && e.g.aw !== "PENDING"));
                const elemAgreeWins = elemAgreeDone.filter((e) => e.sm.pick === e.g.aw).length;
                const f4ActiveList = sm14Evals.filter((e) => e.sm.fusion4.active);
                const f4Done = f4ActiveList.filter((e) => Boolean(e.g.done && e.g.aw && e.g.aw !== "PENDING"));
                const f4Wins = f4Done.filter((e) => e.sm.fusion4.pick === e.g.aw).length;
                const f4Losses = f4Done.length - f4Wins;
                const f4Pct = f4Done.length > 0 ? Math.round((1000 * f4Wins) / f4Done.length) / 10 : null;
                const refActiveList = sm14Evals.filter((e) => e.sm.referee6.active);
                const refTopList = sm14Evals.filter((e) => e.sm.referee6.isTopSignal);
                const refDiamondCnt = refActiveList.filter((e) => e.sm.referee6.isDiamond).length;
                const refDone = refActiveList.filter((e) => Boolean(e.g.done && e.g.aw && e.g.aw !== "PENDING"));
                const refWins = refDone.filter((e) => e.sm.referee6.pick === e.g.aw).length;
                const refLosses = refDone.length - refWins;
                const refPct = refDone.length > 0 ? Math.round((1000 * refWins) / refDone.length) / 10 : null;
                const refTopDone = refTopList.filter((e) => Boolean(e.g.done && e.g.aw && e.g.aw !== "PENDING"));
                const refTopWins = refTopDone.filter((e) => e.sm.referee6.pick === e.g.aw).length;
                const refTopLosses = refTopDone.length - refTopWins;
                const refTopPct = refTopDone.length > 0 ? Math.round((1000 * refTopWins) / refTopDone.length) / 10 : null;
                const refAllDone = sm14Evals.filter((e) => Boolean(e.g.done && e.g.aw && e.g.aw !== "PENDING"));
                const refAllWins = refAllDone.filter((e) => e.sm.referee6.pick === e.g.aw).length;
                const refAllLosses = refAllDone.length - refAllWins;
                const refAllPct = refAllDone.length > 0 ? Math.round((1000 * refAllWins) / refAllDone.length) / 10 : null;

                const anbEvals = gamesOnDailyDate.map((x) => ({ g: x, anb: evalSmartAntiNoBet(x) }));
                const anbActive = anbEvals.filter((e) => e.anb.sig);
                const anbCoreCnt = anbActive.filter((e) => e.anb.kind === "M12_CORE").length;
                const anbDirCnt = anbActive.filter((e) => e.anb.kind === "DIRECT_RELEASE").length;
                const anbOppCnt = anbActive.filter((e) => e.anb.kind === "OPPOSITE_FLIP").length;
                const anbDone = anbActive.filter((e) => Boolean(e.g.done && e.g.aw && e.g.aw !== "PENDING"));
                const anbWins = anbDone.filter((e) => e.anb.pick === e.g.aw).length;
                const anbLosses = anbDone.length - anbWins;
                const anbPct = anbDone.length > 0 ? Math.round((1000 * anbWins) / anbDone.length) / 10 : null;
                return (
                  <div
                    data-testid="bar-daily-winloss"
                    dir="rtl"
                    className="bg-white px-3 py-2 rounded-lg border border-sky-300 shadow-2xs flex flex-wrap items-center justify-between gap-2 text-xs"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-extrabold text-sky-950">
                        کارنامه برد و باخت {activeDailyDate} با {modeTitleMap[fusionMode]}:
                      </span>
                      {sigDone.length > 0 ? (
                        <span
                          data-testid="badge-daily-active-wl"
                          className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-950 border border-emerald-400 font-mono font-extrabold"
                        >
                          سیگنال فعال: {sigWins} برد - {sigLosses} باخت ({sigPct}%)
                        </span>
                      ) : (
                        <span
                          data-testid="badge-daily-active-wl"
                          className="px-2 py-0.5 rounded bg-sky-100 text-sky-950 border border-sky-300 font-mono font-bold"
                        >
                          سیگنال فعال روز: {sigCards.length} بازی
                        </span>
                      )}
                      {fusionMode === "tri_gf_ultralock" && (
                        anbDone.length > 0 ? (
                          <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-950 border border-indigo-400 font-mono font-extrabold">
                            باکس ضد NO-BET هوشمند: {anbWins} برد - {anbLosses} باخت ({anbPct}%)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-950 border border-indigo-400 font-mono font-extrabold">
                            ضد NO-BET هوشمند: {anbActive.length} بازی فعال ({anbCoreCnt} اصلی + {anbDirCnt} مستقیم + {anbOppCnt} عکس)
                          </span>
                        )
                      )}
                      {fusionMode === "total_elem_12" && (
                        <>
                          {sm14Done.length > 0 ? (
                            <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-950 border border-indigo-400 font-mono font-extrabold">
                              باکس هوشمند حالت ۱۴: {sm14Wins} برد - {sm14Losses} باخت ({sm14Pct}%){sm14VetoCnt > 0 ? ` • ${sm14VetoCnt} تله مهارشده` : ""}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-950 border border-indigo-400 font-mono font-extrabold">
                              باکس هوشمند ۱۴: {sm14Active.length} فعال ({sm14CoreCnt} سالم + {sm14DirCnt} مستقیم + {sm14OppCnt} بازیکن مقابل){sm14VetoCnt > 0 ? ` • ${sm14VetoCnt} مهار خطا` : ""}
                            </span>
                          )}
                          {elemDone.length > 0 ? (
                            <span
                              data-testid="badge-daily-elem-followup"
                              className="px-2 py-0.5 rounded bg-sky-100 text-sky-950 border border-sky-400 font-mono font-extrabold"
                            >
                              برنده المنت (فالوآپ): {elemWins} برد - {elemLosses} باخت ({elemPct}%){elemAgreeDone.length > 0 ? ` • هم‌جهت ۱۴: ${elemAgreeWins}/${elemAgreeDone.length}` : ""}
                            </span>
                          ) : (
                            <span
                              data-testid="badge-daily-elem-followup"
                              className="px-2 py-0.5 rounded bg-sky-100 text-sky-950 border border-sky-400 font-mono font-extrabold"
                            >
                              برنده المنت (فالوآپ): {elemActive.length} حکم فعال ({elemAgreeActive.length} هم‌جهت با ۱۴)
                            </span>
                          )}
                          {f4Done.length > 0 ? (
                            <span
                              data-testid="badge-daily-fusion4-v77"
                              className="px-2 py-0.5 rounded bg-teal-100 text-teal-950 border border-teal-400 font-mono font-extrabold"
                            >
                              تلفیق ۴ پترن (v82): {f4Wins} برد - {f4Losses} باخت ({f4Pct}%)
                            </span>
                          ) : (
                            <span
                              data-testid="badge-daily-fusion4-v77"
                              className="px-2 py-0.5 rounded bg-teal-50 text-teal-950 border border-teal-300 font-mono font-extrabold"
                            >
                              تلفیق ۴ پترن (v82): {f4ActiveList.length} بازی فعال
                            </span>
                          )}
                          {refDone.length > 0 ? (
                            <span
                              data-testid="badge-daily-referee6-v80"
                              className="px-2.5 py-0.5 rounded-md bg-amber-200/90 text-slate-950 border-2 border-amber-500 font-mono font-extrabold shadow-2xs"
                            >
                              داور رتبه‌بندی ۶ باکس (v82 • رتبه ۱-۳): {refWins} برد - {refLosses} باخت ({refPct}%)
                              {refTopDone.length > 0 ? ` • ویژه ★/★★: ${refTopWins}-${refTopLosses} (${refTopPct}%)` : ""}
                              {refAllDone.length > 0 ? ` • کل امتیاز روز: ${refAllWins}-${refAllLosses} (${refAllPct}%)` : ""}
                            </span>
                          ) : (
                            <span
                              data-testid="badge-daily-referee6-v80"
                              className="px-2.5 py-0.5 rounded-md bg-amber-100 text-amber-950 border-2 border-amber-400 font-mono font-extrabold shadow-2xs"
                            >
                              داور رتبه‌بندی ۶ باکس (v82): {refActiveList.length} تایید رتبه ۱-۳ ({refTopList.length} ویژه ★/★★ • {refDiamondCnt} الماسی)
                            </span>
                          )}
                        </>
                      )}
                      {dailyCardFilter === "all" && doneCards.length > 0 && (
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-300 font-mono font-bold">
                          اسلیت خام روز (شامل NO-BET): {allWins} برد - {allLosses} باخت ({allPct}%)
                        </span>
                      )}
                      {sigPend > 0 && (
                        <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-950 border border-amber-300 font-mono font-bold">
                          در انتظار برگزاری (سیگنال فعال): {sigPend} بازی
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-1 text-[11px] font-bold">
                      <button
                        type="button"
                        data-testid="btn-daily-filter-qualified"
                        onClick={() => {
                          setDailyCardFilter("qualified");
                          if (fusionMode === "mode17" && mode17TierFilter === "all_slate") {
                            setMode17TierFilter("all17");
                          }
                        }}
                        className={`px-2 py-0.5 rounded border ${dailyCardFilter === "qualified" ? "bg-emerald-700 text-white border-emerald-800" : "bg-white text-slate-700 border-sky-200 hover:bg-sky-50"}`}
                      >
                        سیگنال ({sigCards.length})
                      </button>
                      {fusionMode !== "mode17" && (
                        <button
                          type="button"
                          data-testid="btn-filter-anti-nobet"
                          onClick={() => setDailyCardFilter("anti_nobet")}
                          className={`px-2 py-0.5 rounded border ${dailyCardFilter === "anti_nobet" ? "bg-indigo-700 text-white border-indigo-800" : "bg-indigo-50 text-indigo-950 border-indigo-300 hover:bg-indigo-100"}`}
                        >
                          {fusionMode === "total_elem_12" ? `هوشمند ۱۴ (${sm14Active.length})` : `ضد NO-BET (${anbActive.length})`}
                        </button>
                      )}
                      {fusionMode === "total_elem_12" && (
                        <>
                          <button
                            type="button"
                            data-testid="btn-filter-referee6"
                            onClick={() => setDailyCardFilter("referee6")}
                            className={`px-2 py-0.5 rounded border font-extrabold ${dailyCardFilter === "referee6" ? "bg-amber-600 text-white border-amber-700" : "bg-amber-100 text-amber-950 border-amber-400 hover:bg-amber-200/80"}`}
                          >
                            داور ۶ باکس ({refActiveList.length})
                          </button>
                          <button
                            type="button"
                            data-testid="btn-filter-ref-top"
                            onClick={() => setDailyCardFilter("ref_top")}
                            className={`px-2 py-0.5 rounded border font-extrabold ${dailyCardFilter === "ref_top" ? "bg-emerald-700 text-white border-emerald-800" : "bg-emerald-50 text-emerald-950 border-emerald-300 hover:bg-emerald-100"}`}
                          >
                            ویژه ★/★★ ({refTopList.length})
                          </button>
                        </>
                      )}
                      {sigDone.length > 0 && (
                        <>
                          <button
                            type="button"
                            data-testid="btn-daily-filter-win"
                            onClick={() => setDailyCardFilter("win")}
                            className={`px-2 py-0.5 rounded border ${dailyCardFilter === "win" ? "bg-emerald-600 text-white border-emerald-700" : "bg-emerald-50 text-emerald-900 border-emerald-300 hover:bg-emerald-100"}`}
                          >
                            بردها ({sigWins}) ✓
                          </button>
                          <button
                            type="button"
                            data-testid="btn-daily-filter-loss"
                            onClick={() => setDailyCardFilter("loss")}
                            className={`px-2 py-0.5 rounded border ${dailyCardFilter === "loss" ? "bg-rose-600 text-white border-rose-700" : "bg-rose-50 text-rose-900 border-rose-300 hover:bg-rose-100"}`}
                          >
                            باخت‌ها ({sigLosses}) ✕
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        data-testid="btn-daily-filter-all-slate"
                        onClick={() => {
                          setDailyCardFilter("all");
                          if (fusionMode === "mode17") setMode17TierFilter("all_slate");
                        }}
                        className={`px-2 py-0.5 rounded border ${dailyCardFilter === "all" ? "bg-slate-700 text-white border-slate-800" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}
                      >
                        کل اسلیت با NO-BET ({gamesOnDailyDate.length})
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* Global Card-Box Dropdown Controls (Open/Close Individual or All Boxes Across Cards) */}
              <div
                data-testid="bar-card-box-dropdowns"
                className="rounded-lg border border-sky-200 bg-sky-50/90 px-2.5 py-1.5 flex flex-wrap items-center justify-between gap-1.5 text-[10px]"
                dir="rtl"
              >
                <div className="flex flex-wrap items-center gap-1">
                  <span className="font-extrabold text-sky-950 ml-1">
                    دراپ‌داون باکس‌های کارت:
                  </span>
                  {(
                    [
                      { key: "referee6" as CardBoxKey, label: "جدول داور نهایی", show: fusionMode === "total_elem_12" },
                      { key: "sixboxes" as CardBoxKey, label: "مجموعه ۶ باکس", show: fusionMode === "total_elem_12" },
                      { key: "box1" as CardBoxKey, label: "باکس ۱ (چک‌لیست)", show: true },
                      {
                        key: "smart" as CardBoxKey,
                        label: fusionMode === "total_elem_12" ? "باکس هوشمند ۱۴" : "باکس ضد NO-BET",
                        show: fusionMode === "total_elem_12" || fusionMode === "anti_nobet_smart" || fusionMode === "tri_gf_ultralock",
                      },
                      { key: "box2" as CardBoxKey, label: "باکس ۲ (حکم نهایی)", show: true },
                      { key: "dom" as CardBoxKey, label: "المنت غالب [F-A-W-E]", show: fusionMode === "total_elem_12" },
                      { key: "elem" as CardBoxKey, label: "برنده المنت (فالوآپ)", show: fusionMode === "total_elem_12" },
                      { key: "fusion4" as CardBoxKey, label: "تلفیق ۴ پترن", show: fusionMode === "total_elem_12" },

                    ] as const
                  )
                    .filter((item) => item.show)
                    .map((item) => {
                      const active = defaultCardBoxes[item.key];
                      return (
                        <button
                          key={item.key}
                          type="button"
                          data-testid={`btn-global-box-${item.key}`}
                          onClick={() => toggleGlobalCardBox(item.key)}
                          className={`px-2 py-0.5 rounded font-extrabold border transition-colors ${
                            active
                              ? "bg-sky-700 text-white border-sky-800"
                              : "bg-white text-slate-700 border-sky-300 hover:bg-sky-100/70"
                          }`}
                        >
                          {item.label} {active ? "▲" : "▼"}
                        </button>
                      );
                    })}
                </div>
                <div className="inline-flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    data-testid="btn-expand-all-card-boxes"
                    onClick={() => setAllCardBoxes(true)}
                    className="px-2 py-0.5 rounded font-extrabold bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-700 transition-colors"
                  >
                    باز کردن همه باکس‌ها ▼
                  </button>
                  <button
                    type="button"
                    data-testid="btn-collapse-all-card-boxes"
                    onClick={() => setAllCardBoxes(false)}
                    className="px-2 py-0.5 rounded font-extrabold bg-white hover:bg-sky-100 text-sky-950 border border-sky-300 transition-colors"
                  >
                    بستن همه باکس‌ها ▲
                  </button>
                </div>
              </div>

              {syncMsg && (
                <div className="px-3 py-2 rounded-lg border border-emerald-400 bg-emerald-50 text-emerald-950 text-xs font-extrabold flex items-center justify-between gap-2">
                  <span>{syncMsg}</span>
                  <button
                    type="button"
                    onClick={() => setSyncMsg("")}
                    className="text-emerald-800 hover:text-emerald-950 font-bold px-1"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* KALSHI NBA AUTO-BETTING & DRY-RUN CONTROL BAR (KXATPMATCH / KXWTAMATCH Moneyline) */}
              {(() => {
                // Build current day's order list from cards
                const buildDayOrders = () =>
                  gamesOnDailyDate.map((g) => {
                    const t12 = (manualPersp === "home" ? g.h_12 : g.a_12) ?? [];
                    const tGeoFin = (manualPersp === "home" ? g.h_geo : g.a_geo) ?? "";
                    const tGeoDyn = (manualPersp === "home" ? (g.h_geo_dyn ?? g.h_geo) : (g.a_geo_dyn ?? g.a_geo)) ?? "";
                    const activeGeoKind: "fin" | "dyn" = dailyCardMode === "geo_dyn" ? "dyn" : manualGeoKind;
                    const tGeo = activeGeoKind === "dyn" ? tGeoDyn : tGeoFin;
                    const dPool = getDayPoolBefore(g.day, g.d);
                    const savedState = manualFilters[g.n];
                    const rowGeoKind: "fin" | "dyn" = savedState?.geoKind ?? activeGeoKind;
                    const getRowEl12 = (r: HistGameRow) => (manualPersp === "home" ? r.h12 : r.a12);
                    const getRowGeo = (r: HistGameRow) => (manualPersp === "home" ? (rowGeoKind === "dyn" ? (r.hGeoDyn ?? r.hGeo) : r.hGeo) : (rowGeoKind === "dyn" ? (r.aGeoDyn ?? r.aGeo) : r.aGeo));
                    const stepRes = computeAutoFilterState(t12, tGeoFin, dPool, manualPersp, false, "fin");
                    const geoRes = computeAutoFilterState(t12, tGeo, dPool, manualPersp, true, activeGeoKind);
                    const f30Val = g.f30 ?? g.vm6 ?? 0;
                    const stepAgrees = (stepRes.hw >= stepRes.aw) === (f30Val >= 0);
                    const geoAgrees = (geoRes.hw >= geoRes.aw) === (f30Val >= 0);
                    const pickGeo =
                      dailyCardMode === "geo" || dailyCardMode === "geo_dyn"
                        ? true
                        : dailyCardMode === "step"
                          ? false
                          : (stepRes.pct < 60 || (stepAgrees && !geoAgrees && stepRes.pct >= 55))
                            ? false
                            : !stepAgrees && geoAgrees && geoRes.pct >= 55
                              ? true
                              : geoRes.pct > stepRes.pct || (geoRes.pct === stepRes.pct && geoRes.mv > stepRes.mv);
                    const autoChosen = pickGeo ? geoRes : stepRes;
                    const hasManualFilter =
                      savedState &&
                      (Object.values(savedState.cols).some((v) => v && v !== "ALL") ||
                        (savedState.geo && savedState.geo !== "ALL"));
                    const isNhlSysMode =
                      dailyCardMode === "nhl_best" ||
                      dailyCardMode === "nhl_vip3" ||
                      dailyCardMode === "nhl_f1_guard" ||
                      dailyCardMode === "nhl_f1_idx_raw" ||
                      dailyCardMode === "nhl_f1" ||
                      dailyCardMode === "nhl_f1_union";
                    const f1Pool = isNhlSysMode && manualPersp === "home" ? resolveNhlF1Pool(g, dPool) : null;
                    let cardPool = f1Pool ?? autoChosen.pool;
                    let manualOverridden = false;
                    if (hasManualFilter && savedState) {
                      const manualPool = dPool.filter((r) => {
                        const el = getRowEl12(r);
                        for (let c = 0; c < 12; c++) {
                          const sel = savedState.cols[c];
                          if (sel && sel !== "ALL" && el[c] !== sel) return false;
                        }
                        if (savedState.geo && savedState.geo !== "ALL" && getRowGeo(r) !== savedState.geo) {
                          return false;
                        }
                        return true;
                      });
                      if (manualPool.length >= 5 && manualPool.length <= 7) {
                        cardPool = manualPool;
                        manualOverridden = true;
                      }
                    }
                    const cardIdx = computePoolNumIndex(cardPool);
                    const hw = cardPool.filter((r) => r.mg > 0).length;
                    const aw = cardPool.filter((r) => r.mg < 0).length;
                    const twinTot = hw + aw;
                    const twinPct = twinTot > 0 ? Math.round((Math.max(hw, aw) / twinTot) * 100) : 50;
                    const f30 = g.f30 ?? g.vm6;
                    const a25 = g.a25 ?? 0;
                    const sysQual =
                      dailyCardMode === "nhl_vip3"
                        ? activeVip3Of(g)
                        : dailyCardMode === "nhl_best"
                          ? activeF1WtpOf(g)
                          : dailyCardMode === "nhl_f1_guard"
                            ? Boolean(g.f1_guard ?? g.f1_idx)
                            : dailyCardMode === "nhl_f1_idx_raw"
                              ? Boolean(g.f1_idx)
                              : dailyCardMode === "nhl_f1_union"
                                ? activeUnionOf(g)
                                : Boolean(g.f1);
                    const fm = g.fusion_meta;
                    const g1 = fm?.geo1xxx;
                    const gd = g1?.guards;
                    const pi = g1?.pos_inv;
                    const m12 = fm?.modes?.tri_gf_ultralock;
                    const m11 = fm?.modes?.tri_gf_routed;
                    const m9 = fm?.modes?.pos_inv_lock;
                    const m7 = fm?.modes?.earth_neg_lock;
                    const m8 = fm?.modes?.safe_dl_core;
                    const mCur =
                      fusionMode === "mode17"
                        ? evalMode17Gold(g)
                        : fusionMode === "anti_nobet_smart"
                          ? evalSmartAntiNoBet(g)
                          : fusionMode === "total_elem_12"
                            ? evalSmartMode14(g)
                            : fm?.modes?.[fusionMode];
                    const m12Sig = Boolean(m12?.sig);
                    const m11Sig = Boolean(m11?.sig);
                    const m9Sig = Boolean(m9?.sig);
                    const m7Sig = Boolean(m7?.sig);
                    const m8Sig = Boolean(m8?.sig);
                    const curModeSig = Boolean(mCur?.sig);
                    const dlWin = String(g1?.dl_win || "");
                    const safeDlWin = String(g1?.safe_dl_win || "");
                    const posInvWin = String(pi?.triggered && pi?.win ? pi.win : "");
                    const isSafeLockPass = Boolean(safeDlWin);
                    const hasRawDl = Boolean(dlWin);
                    const isEarthBlocked = Boolean(gd && !gd.earth_ok);
                    const usePosInvInCombo = fusionMode !== "earth_neg_lock";
                    const preferredFusionPick =
                      fusionMode === "mode17" || fusionMode === "total_elem_12"
                        ? (curModeSig && mCur?.pick) || mCur?.pick || g.sys_win || ""
                        : (curModeSig && mCur?.pick) ||
                          (usePosInvInCombo && m12Sig && m12?.pick) ||
                          (usePosInvInCombo && m9Sig && m9?.pick) ||
                          (m7Sig && m7?.pick) ||
                          (m8Sig && m8?.pick) ||
                          (usePosInvInCombo && m11Sig && m11?.pick) ||
                          safeDlWin ||
                          (usePosInvInCombo && posInvWin) ||
                          dlWin ||
                          mCur?.pick ||
                          g.sys_win ||
                          "";
                    const baseHomeFav =
                      !manualOverridden && preferredFusionPick
                        ? preferredFusionPick === g.h
                        : isNhlSysMode && !manualOverridden && g.sys_win
                          ? g.sys_win === g.h
                          : hw > aw
                            ? true
                            : aw > hw
                              ? false
                              : (g.f30 ?? 0) >= 0;
                    const finalHomeFav = cardFlipDir[g.n] ? !baseHomeFav : baseHomeFav;
                    const winnerTeam = finalHomeFav ? g.h : g.a;
                    const winnerCode = getTeam3Code(winnerTeam);
                    const ticker = buildKalshiNbaTicker(g.d, g.a, g.h, winnerTeam, ((g as any).tour === "WTA" || tour === "WTA") ? "WTA" : "ATP");
                    const mkt = kalshiMarkets[ticker];
                    const liveAskCents = mkt && mkt.yesAskCents > 0 ? mkt.yesAskCents : 55;
                    const limitCents = kalshiCardLimit[g.n] ?? liveAskCents;
                    const agree = finalHomeFav ? cardIdx.delta > 0 : cardIdx.delta < 0;

                    const pick1xxx = Number((finalHomeFav ? Number(g1?.h_sum ?? 0) : Number(g1?.a_sum ?? 0)).toFixed(1));
                    const pickAll8 = Number((finalHomeFav ? Number(g1?.h_all ?? 0) : Number(g1?.a_all ?? 0)).toFixed(1));
                    const opp1xxx = Number((finalHomeFav ? Number(g1?.a_sum ?? 0) : Number(g1?.h_sum ?? 0)).toFixed(1));
                    const oppAll8 = Number((finalHomeFav ? Number(g1?.a_all ?? 0) : Number(g1?.h_all ?? 0)).toFixed(1));
                    const d1Gap = Number((opp1xxx - pick1xxx).toFixed(1));
                    const d8Gap = Number((oppAll8 - pickAll8).toFixed(1));
                    const wWk = g.wtp;
                    const pickElWk = String((finalHomeFav ? wWk?.hel : wWk?.ael) || gd?.el_wk || "");
                    const oppElWk = String((finalHomeFav ? wWk?.ael : wWk?.hel) || gd?.opp_el_wk || "");
                    const pickL5Wk = Number(
                      (finalHomeFav ? Number(wWk?.l5h ?? 50) : 100 - Number(wWk?.l5h ?? 50)).toFixed(1)
                    );
                    const teamF30Signed = Number(fm?.team?.f30 ?? f30 ?? 0) * (finalHomeFav ? 1 : -1);
                    const pickEarthBlocked =
                      Boolean(pickElWk === "EARTH" && oppElWk && oppElWk !== "EARTH") ||
                      (winnerTeam === gd?.eval_team && isEarthBlocked);
                    const pickPosInvTrap = Boolean(gd?.pos_inv_trap && (!posInvWin || winnerTeam !== posInvWin));
                    const pickNegAnchorFail = Boolean(
                      hasRawDl && dlWin === winnerTeam && gd && gd.earth_ok && !gd.neg_anchor_ok
                    );
                    const pickPosInvOk = Boolean(
                      usePosInvInCombo && !manualOverridden && !cardFlipDir[g.n] && posInvWin && posInvWin === winnerTeam
                    );
                    const pickM17Ok = Boolean(!manualOverridden && !cardFlipDir[g.n] && fusionMode === "mode17" && curModeSig && mCur?.pick === winnerTeam);
                    const pickM12Ok = Boolean(!manualOverridden && !cardFlipDir[g.n] && fusionMode === "tri_gf_ultralock" && m12Sig && m12?.pick === winnerTeam);
                    const pickM14Ok = Boolean(!manualOverridden && !cardFlipDir[g.n] && fusionMode === "total_elem_12" && curModeSig && mCur?.pick === winnerTeam);
                    const pickAnbOk = Boolean(!manualOverridden && !cardFlipDir[g.n] && fusionMode === "anti_nobet_smart" && curModeSig && mCur?.pick === winnerTeam);
                    const pickM11Ok = Boolean(!manualOverridden && !cardFlipDir[g.n] && fusionMode === "tri_gf_routed" && m11Sig && m11?.pick === winnerTeam);
                    const pickM7Ok = Boolean(!manualOverridden && !cardFlipDir[g.n] && m7Sig && m7?.pick === winnerTeam);
                    const pickM8Ok = Boolean(!manualOverridden && !cardFlipDir[g.n] && m8Sig && m8?.pick === winnerTeam);
                    const pickSafeOk = Boolean(
                      !manualOverridden && !cardFlipDir[g.n]
                        ? isSafeLockPass && safeDlWin === winnerTeam
                        : safeDlWin === winnerTeam && !pickEarthBlocked && !pickPosInvTrap
                    );
                    const isUltraOrAnbMode =
                      fusionMode === "mode17" ||
                      fusionMode === "tri_gf_ultralock" ||
                      fusionMode === "anti_nobet_smart" ||
                      fusionMode === "total_elem_12";
                    const pickDualEarthHold = Boolean(
                      !manualOverridden &&
                        !cardFlipDir[g.n] &&
                        isUltraOrAnbMode &&
                        pickElWk === "EARTH" &&
                        oppElWk === "EARTH" &&
                        !curModeSig
                    );
                    const pick3of3ClashHold = Boolean(
                      !manualOverridden &&
                        !cardFlipDir[g.n] &&
                        (fusionMode === "tri_gf_ultralock" || fusionMode === "anti_nobet_smart") &&
                        g1?.m12_route?.code === "ULTRA_3OF3_CLASH_HOLD"
                    );
                    const comboTier: 0 | 1 | 2 | 3 =
                      fusionMode === "mode17"
                        ? pickM17Ok && Boolean(mCur?.vip)
                          ? 3
                          : pickM17Ok
                            ? 2
                            : 0
                        : fusionMode === "total_elem_12"
                          ? pickDualEarthHold
                            ? 0
                            : pickM14Ok && Boolean(mCur?.vip)
                              ? 3
                              : pickM14Ok
                                ? 2
                                : 0
                          : pickDualEarthHold || pick3of3ClashHold
                            ? 0
                            : pickM12Ok || (pickAnbOk && Boolean(mCur?.vip)) || pickM7Ok || pickPosInvOk || (pickM11Ok && Boolean(m11?.vip))
                              ? 3
                              : pickAnbOk || pickM8Ok || pickM11Ok
                                ? 2
                                : pickSafeOk
                                  ? 1
                                  : 0;
                    const lockStatusLabel =
                      fusionMode === "mode17"
                        ? pickM17Ok
                          ? (mCur as ReturnType<typeof evalMode17Gold>).badgeFa
                          : "⛔ NO-BET (عدم توافق ۱۳ و ۱۵)"
                        : pickDualEarthHold
                          ? "⛔ رد تقابل دو EARTH"
                          : fusionMode === "total_elem_12"
                            ? pickM14Ok
                              ? `🧬 حالت ۱۴: ${g.fusion_meta?.total_elem_12?.flipped ? "معکوس ضد EARTH" : "قفل قطبیت المنت کل"}`
                              : "— خارج از سیگنال موتور ۱۴"
                            : pick3of3ClashHold
                            ? "⛔ مهار همزاد برابر ۳/۳"
                            : pickAnbOk
                              ? "🛡️ ضد NO-BET هوشمند"
                            : pickM12Ok
                              ? `🛡️ حالت ۱۲: ${g1?.m12_route?.flipped ? "معکوس ضدحذف" : "ابرقفل ۳ عددی"}`
                        : pickM11Ok
                          ? `🧭 حالت ۱۱: ${g1?.m11_route?.flipped ? "معکوس ضدحذف" : "۳ عددی مستقل"}`
                          : pickPosInvOk
                            ? "🔄 حالت ۹: معکوس دو-مثبت (+,+)"
                            : comboTier === 3
                              ? "✓ حالت ۷/۹ (قفل ایمن)"
                              : comboTier === 2
                                ? "✓ قفل ایمن هم‌جهت"
                                : comboTier === 1
                                  ? "✓ قفل ایمن پایه"
                                  : pickPosInvTrap
                                    ? "⛔ رد تله دو-مثبت"
                                    : pickEarthBlocked
                                      ? "⛔ رد قفل EARTH"
                                      : pickNegAnchorFail
                                        ? "⚠ بدون لنگر منفی"
                                        : "⚠ واگرایی 1xxx/Σ8";

                    const isComboQualified = comboTier >= 2;
                    const gVipActive = pickM7Ok || activeVip3Of(g);
                    const calMaxBuy =
                      comboTier === 3
                        ? 85
                        : comboTier === 2
                          ? 80
                          : comboTier === 1
                            ? teamF30Signed >= 0 && pickL5Wk >= 60
                              ? 70
                              : 58
                            : 0;
                    const calWinPct =
                      comboTier === 3
                        ? 88.7
                        : comboTier === 2
                          ? 83.2
                          : comboTier === 1
                            ? teamF30Signed >= 0 && pickL5Wk >= 60
                              ? 75.5
                              : 64.0
                            : pickEarthBlocked
                              ? 28.0
                              : 48.0;
                    const evEdge = Math.round(calWinPct - liveAskCents);
                    const singleModeQual =
                      !manualOverridden && !cardFlipDir[g.n] && fm
                        ? curModeSig
                        : isComboQualified;
                    const isPositiveEv =
                      comboTier >= 1 &&
                      liveAskCents <= calMaxBuy &&
                      liveAskCents >= 18;
                    const isVip = pickM7Ok || gVipActive;
                    const stakeUsd = kalshiCardStake[g.n] ?? (isVip ? kalshiVipStake : kalshiDefaultStake);
                    const enabled =
                      kalshiCardEnabled[g.n] ??
                      Boolean(singleModeQual && liveAskCents <= Math.max(calMaxBuy, 82) && liveAskCents >= 18);
                    const contracts = Math.max(1, Math.floor((stakeUsd * 100) / Math.max(1, limitCents)));
                    return {
                      gameNo: g.n,
                      date: g.d,
                      homeTeam: g.h,
                      awayTeam: g.a,
                      winnerTeam,
                      winnerCode,
                      ticker,
                      eventTicker: ticker.split("-").slice(0, 2).join("-"),
                      liveAskCents,
                      twinPct,
                      twinTot,
                      hw,
                      aw,
                      f30,
                      a25,
                      agree,
                      evEdge,
                      calWinPct,
                      comboTier,
                      pick1xxx,
                      pickAll8,
                      d1Gap,
                      d8Gap,
                      pickElWk,
                      oppElWk,
                      pickL5Wk,
                      teamF30Signed,
                      pickEarthBlocked,
                      pickNegAnchorFail,
                      pickSafeOk,
                      pickM7Ok,
                      pickM8Ok,
                      lockStatusLabel,
                      isComboQualified,
                      isPositiveEv,
                      enabled,
                      stakeUsd,
                      limitCents,
                      contracts,
                    };
                  });

                const dayOrders = buildDayOrders();
                const enabledOrders = dayOrders.filter((o) => o.enabled);
                const totalPlannedUsd = enabledOrders.reduce(
                  (acc, o) => acc + Number(((o.contracts * o.limitCents) / 100).toFixed(2)),
                  0
                );

                // Rank strictly by Strategy Mode 7 Safe-Lock hierarchy:
                // Tier 3 (Mode 7) > Tier 2 (Mode 8 Safe Consensus) > Tier 1 (Safe Double-Lock) > Tier 0 (Blocked)
                const rankedForCombo = [...dayOrders].sort((a, b) => {
                  if (b.comboTier !== a.comboTier) return b.comboTier - a.comboTier;
                  const aF30Ok = a.teamF30Signed >= 0 ? 1 : 0;
                  const bF30Ok = b.teamF30Signed >= 0 ? 1 : 0;
                  if (bF30Ok !== aF30Ok) return bF30Ok - aF30Ok;
                  const aDualNeg = a.pick1xxx <= 0 && a.pickAll8 < 0 ? 1 : 0;
                  const bDualNeg = b.pick1xxx <= 0 && b.pickAll8 < 0 ? 1 : 0;
                  if (bDualNeg !== aDualNeg) return bDualNeg - aDualNeg;
                  if (b.pickL5Wk !== a.pickL5Wk) return b.pickL5Wk - a.pickL5Wk;
                  if (b.evEdge !== a.evEdge) return b.evEdge - a.evEdge;
                  return b.d8Gap - a.d8Gap;
                });

                const m7ComboOrders = rankedForCombo.filter((o) => o.comboTier === 3);
                const qualifiedComboOrders = rankedForCombo.filter((o) => o.comboTier >= 2);
                const safePoolOrders = rankedForCombo.filter((o) => o.comboTier >= 1);

                const getBestComboGameNos = (cnt: number) => {
                  const want = Math.min(4, Math.max(2, cnt));
                  if (safePoolOrders.length >= 2) {
                    return safePoolOrders.slice(0, Math.min(want, safePoolOrders.length)).map((o) => o.gameNo);
                  }
                  return safePoolOrders.map((o) => o.gameNo);
                };

                const getAutoQualifiedComboGameNos = () => {
                  if (m7ComboOrders.length >= 2) {
                    return m7ComboOrders.slice(0, Math.min(3, m7ComboOrders.length)).map((o) => o.gameNo);
                  }
                  if (qualifiedComboOrders.length >= 2) {
                    return qualifiedComboOrders.slice(0, Math.min(3, qualifiedComboOrders.length)).map((o) => o.gameNo);
                  }
                  if (safePoolOrders.length >= 2) {
                    return safePoolOrders.slice(0, 2).map((o) => o.gameNo);
                  }
                  return safePoolOrders.map((o) => o.gameNo);
                };

                const activeComboGameNos =
                  comboSelectedByDate[activeDailyDate] && comboSelectedByDate[activeDailyDate].length >= 1
                    ? comboSelectedByDate[activeDailyDate]
                    : getAutoQualifiedComboGameNos();

                const toggleGameInCombo = (gameNo: number) => {
                  const cur = [...activeComboGameNos];
                  const idx = cur.indexOf(gameNo);
                  if (idx >= 0) {
                    if (cur.length <= 1) return;
                    cur.splice(idx, 1);
                  } else {
                    if (cur.length >= 4) {
                      cur.pop();
                    }
                    cur.push(gameNo);
                  }
                  setComboSelectedByDate((prev) => ({ ...prev, [activeDailyDate]: cur }));
                };

                const comboLegOrders = activeComboGameNos
                  .map((gn) => dayOrders.find((o) => o.gameNo === gn))
                  .filter((o): o is NonNullable<typeof o> => Boolean(o));

                const comboModelProb = comboLegOrders.reduce(
                  (acc, o) => acc * Math.min(0.95, Math.max(0.15, (o.calWinPct || 50) / 100)),
                  1
                );
                const comboModelProbPct = comboLegOrders.length > 0 ? Math.round(comboModelProb * 100) : 0;

                const comboFairProb = comboLegOrders.reduce(
                  (acc, o) => acc * Math.min(0.98, Math.max(0.02, (o.liveAskCents || 55) / 100)),
                  1
                );
                const comboFairCents = Math.max(1, Math.min(95, Math.round(comboFairProb * 100)));
                const comboKey = `${activeDailyDate}:${activeComboGameNos.join("-")}`;
                const comboLimitCents = comboCustomLimitCents[comboKey] ?? Math.min(95, comboFairCents + 1);
                const comboContracts = Math.max(1, Math.floor((comboStakeUsd * 100) / Math.max(1, comboLimitCents)));
                const comboEstCostUsd = Number(((comboContracts * comboLimitCents) / 100).toFixed(2));
                const comboMaxPayoutUsd = Number(comboContracts.toFixed(2));
                const comboNetProfitUsd = Number((comboMaxPayoutUsd - comboEstCostUsd).toFixed(2));
                const comboMultiplier = Number((100 / Math.max(1, comboLimitCents)).toFixed(2));

                return (
                  <div className="space-y-2">
                    {/* Collapsible Dropdown A: Kalshi Batch & Auto-Betting Panel */}
                    <div className="bg-white border border-sky-300 rounded-lg overflow-hidden shadow-2xs">
                      <div
                        onClick={() => setOpenKalshiAutoPanel((v) => !v)}
                        className="px-3 py-2 bg-sky-100/80 hover:bg-sky-100 cursor-pointer flex flex-wrap items-center justify-between gap-2 transition-colors"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-emerald-700 text-white font-extrabold text-xs">
                            پنل سفارش گروهی و خودکار Kalshi (KXATPMATCH / KXWTAMATCH)
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold border ${
                              kalshiHasKey
                                ? "bg-emerald-100 text-emerald-900 border-emerald-300"
                                : "bg-amber-100 text-amber-900 border-amber-300"
                            }`}
                          >
                            {kalshiHasKey ? `کلید متصل ✓ (${kalshiKeyMasked})` : "پیش‌نمایش Dry-Run"}
                          </span>
                          {kalshiBalance !== null && (
                            <span className="px-2 py-0.5 rounded bg-white text-emerald-800 border border-emerald-300 font-mono text-xs font-extrabold">
                              Balance: ${kalshiBalance}
                            </span>
                          )}
                          <span className="text-[11px] font-mono text-sky-950 bg-white px-2 py-0.5 rounded border border-sky-200">
                            انتخابی: <b>{enabledOrders.length}</b> از {dayOrders.length} • کل: <b>${totalPlannedUsd.toFixed(2)}</b>
                          </span>
                        </div>
                        <button
                          type="button"
                          data-testid="button-toggle-kalshi-auto"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenKalshiAutoPanel((v) => !v);
                          }}
                          className="px-2.5 py-1 rounded border border-sky-300 bg-white hover:bg-sky-50 text-sky-950 text-xs font-extrabold"
                        >
                          {openKalshiAutoPanel ? "بستن پنل Kalshi ▲" : "باز کردن پنل Kalshi ▼"}
                        </button>
                      </div>

                      {openKalshiAutoPanel && (
                        <div className="p-3 space-y-3 bg-sky-50/40 border-t border-sky-200">
                          <div className="flex flex-wrap items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  const d = await apiRpcJson("/api/kalshi/markets?force=1");
                                  if (d?.markets && Object.keys(d.markets).length > 0) {
                                    setKalshiMarkets(d.markets);
                                    return;
                                  }
                                } catch {}
                                try {
                                  const r2 = await fetch("/tennis_atp_predictions.json?t=" + Date.now());
                                  if (r2.ok) {
                                    const d2 = await r2.json();
                                    if (d2?.markets) setKalshiMarkets(d2.markets);
                                  }
                                } catch {}
                              }}
                              className="px-2.5 py-1 rounded bg-white hover:bg-sky-50 text-sky-900 border border-sky-300 text-[11px] font-bold"
                            >
                              بروزرسانی قیمت‌های لحظه‌ای Kalshi ({Object.keys(kalshiMarkets).length} بازار باز)
                            </button>

                            <button
                              type="button"
                              onClick={() => setKalshiConfigOpen((v) => !v)}
                              className="px-2.5 py-1 rounded bg-sky-700 hover:bg-sky-800 text-white text-[11px] font-bold shadow-2xs"
                            >
                              {kalshiConfigOpen ? "بستن تنظیمات Kalshi ▲" : "تنظیم کلید API و زمان‌بند خودکار ▼"}
                            </button>
                          </div>

                    {/* Action Bar for Selecting, Saving, Dry-Running, and Live Executing Daily Cards on Kalshi */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-sky-200/80">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            const next: Record<number, boolean> = { ...kalshiCardEnabled };
                            gamesOnDailyDate.forEach((g) => {
                              next[g.n] = true;
                            });
                            setKalshiCardEnabled(next);
                          }}
                          className="px-2.5 py-1 rounded bg-white hover:bg-sky-50 text-sky-950 border border-sky-300 text-[11px] font-bold"
                        >
                          ✓ انتخاب همه کارت‌های روز ({gamesOnDailyDate.length})
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const next: Record<number, boolean> = { ...kalshiCardEnabled };
                            dayOrders.forEach((o) => {
                              next[o.gameNo] = Boolean(o.isPositiveEv);
                            });
                            setKalshiCardEnabled(next);
                          }}
                          className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-700 text-[11px] font-extrabold shadow-sm"
                        >
                          فقط ارزش مثبت سیستم جدید (+EV) ({dayOrders.filter((o) => o.isPositiveEv).length})
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const next: Record<number, boolean> = { ...kalshiCardEnabled };
                            dayOrders.forEach((o) => {
                              next[o.gameNo] = Boolean(o.isComboQualified);
                            });
                            setKalshiCardEnabled(next);
                          }}
                          className="px-2.5 py-1 rounded bg-white hover:bg-emerald-50 text-emerald-900 border border-emerald-300 text-[11px] font-bold"
                        >
                          فقط تاییدشده سیستم جدید (۶۲٫۵٪ • VIP ۷۲٪) ({dayOrders.filter((o) => o.isComboQualified).length})
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const next: Record<number, boolean> = { ...kalshiCardEnabled };
                            gamesOnDailyDate.forEach((g) => {
                              next[g.n] = false;
                            });
                            setKalshiCardEnabled(next);
                          }}
                          className="px-2.5 py-1 rounded bg-white hover:bg-rose-50 text-rose-800 border border-rose-200 text-[11px] font-bold"
                        >
                          لغو انتخاب همه
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {/* 1. Save Plan to Server */}
                        <button
                          type="button"
                          disabled={kalshiBusy}
                          data-testid="btn-kalshi-save-plan"
                          onClick={async () => {
                            setKalshiBusy(true);
                            try {
                              const d = await apiRpcJson("/api/kalshi/save-plan", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ date: activeDailyDate, orders: dayOrders }),
                              });
                              if (d?.ok) {
                                setKalshiExecReport({
                                  mode: "save",
                                  results: [],
                                  summary: {
                                    message: `برنامه ${d.savedCount ?? enabledOrders.length} کارت تاریخ ${activeDailyDate} با موفقیت روی سرور ذخیره و قفل شد.`,
                                  },
                                });
                              } else {
                                setKalshiExecReport({
                                  mode: "save_err",
                                  results: [],
                                  error: d?.error ?? "خطا در ذخیره برنامه کارت‌ها در سرور",
                                });
                              }
                            } catch (err) {
                              setKalshiExecReport({
                                mode: "save_err",
                                results: [],
                                error: (err as Error)?.message ?? "خطا در ذخیره برنامه کارت‌ها",
                              });
                            } finally {
                              setKalshiBusy(false);
                            }
                          }}
                          className="px-3 py-1.5 rounded-md bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-sm"
                        >
                          💾 ذخیره و قفل برنامه کارت‌ها در سرور
                        </button>

                        {/* 2. Dry-Run Preview on Live Kalshi Orderbook */}
                        <button
                          type="button"
                          disabled={kalshiBusy}
                          data-testid="btn-kalshi-batch-dryrun"
                          onClick={async () => {
                            setKalshiBusy(true);
                            try {
                              let handled = false;
                              try {
                                const d = await apiRpcJson("/api/kalshi/execute", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                    date: activeDailyDate,
                                    orders: dayOrders,
                                    mode: "dry_run",
                                  }),
                                });
                                if (d?.ok) {
                                  setKalshiExecReport(d);
                                  handled = true;
                                }
                              } catch {}
                              if (!handled) {
                                const results = enabledOrders.map((ord) => {
                                  const mkt = kalshiMarkets[ord.ticker];
                                  const estCostUsd = Number(((ord.contracts * ord.limitCents) / 100).toFixed(2));
                                  const potentialProfitUsd = Number(((ord.contracts * (100 - ord.limitCents)) / 100).toFixed(2));
                                  return {
                                    gameNo: ord.gameNo,
                                    ticker: ord.ticker,
                                    winnerTeam: ord.winnerTeam,
                                    contracts: ord.contracts,
                                    limitCents: ord.limitCents,
                                    estCostUsd,
                                    potentialProfitUsd,
                                    message: mkt
                                      ? `آماده ارسال ✓: خرید ${ord.contracts} قرارداد YES @ ${ord.limitCents}¢ (هزینه: $${estCostUsd} • سود خالص برد: +$${potentialProfitUsd})`
                                      : `تخمین @ ${ord.limitCents}¢: خرید ${ord.contracts} قرارداد YES (هزینه: $${estCostUsd} • سود: +$${potentialProfitUsd})`,
                                  };
                                });
                                setKalshiExecReport({
                                  mode: "dry_run",
                                  results,
                                  summary: {
                                    message: `پیش‌نمایش ${results.length} سفارش انتخابی تاریخ ${activeDailyDate} با قیمت‌های زنده اوردربوک Kalshi محاسبه شد.`,
                                  },
                                });
                              }
                            } finally {
                              setKalshiBusy(false);
                            }
                          }}
                          className="px-3 py-1.5 rounded-md bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs shadow-sm"
                        >
                          🧪 تست و پیش‌نمایش سفارش‌ها در Kalshi (Dry-Run)
                        </button>

                        {/* 3. Live Order Submission to Kalshi */}
                        <button
                          type="button"
                          disabled={kalshiBusy || enabledOrders.length === 0}
                          data-testid="btn-kalshi-batch-submit"
                          onClick={async () => {
                            setKalshiBusy(true);
                            try {
                              const d = await apiRpcJson("/api/kalshi/execute", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  date: activeDailyDate,
                                  orders: dayOrders,
                                  mode: "live",
                                }),
                              });
                              setKalshiExecReport(d);
                              const stD = await apiRpcJson("/api/kalshi/state");
                              if (stD?.ledger) setKalshiLedger(stD.ledger);
                              const balD = await apiRpcJson("/api/kalshi/balance", { method: "POST" });
                              if (balD?.ok && balD.balanceUsd) setKalshiBalance(balD.balanceUsd);
                            } catch (err) {
                              setKalshiExecReport({
                                mode: "live",
                                results: [],
                                error: (err as Error)?.message ?? "خطا در ثبت سفارش‌های انتخابی در Kalshi",
                              });
                            } finally {
                              setKalshiBusy(false);
                            }
                          }}
                          className="px-3.5 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold text-xs shadow-sm"
                        >
                          {kalshiBusy
                            ? "⏳ در حال ارسال به Kalshi..."
                            : `🚀 ثبت خودکار سفارش‌های انتخابی در Kalshi (${enabledOrders.length} بازی)`}
                        </button>
                      </div>
                    </div>

                    {/* Collapsible Kalshi API Key & Auto-Scheduler Drawer */}
                    {kalshiConfigOpen && (
                      <div className="bg-white rounded-lg border border-sky-300 p-3.5 space-y-3 text-xs">
                        <div className="font-bold text-sky-950 border-b border-sky-100 pb-1.5">
                          تنظیمات کلید API صرافی Kalshi (امضای RSA-PSS در بک‌اند سرور) و زمان‌بند اجرای خودکار روزانه
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                          <div className="flex flex-col gap-1">
                            <label className="text-[11px] font-semibold text-slate-700">
                              KALSHI API Key ID:
                            </label>
                            <Input
                              value={kalshiKeyIdInput}
                              onChange={(e) => setKalshiKeyIdInput(e.target.value)}
                              placeholder={kalshiKeyMasked || "e.g. a9b8c7d6-..."}
                              className="h-8 text-xs font-mono"
                              dir="ltr"
                            />
                          </div>

                          <div className="flex flex-col gap-1 md:col-span-2">
                            <label className="text-[11px] font-semibold text-slate-700">
                              RSA Private Key (PEM — کلید خصوصی فقط در سرور ذخیره می‌شود):
                            </label>
                            <textarea
                              value={kalshiPemInput}
                              onChange={(e) => setKalshiPemInput(e.target.value)}
                              placeholder="-----BEGIN RSA PRIVATE KEY----- ..."
                              rows={2}
                              className="rounded border border-slate-300 p-1.5 text-[10px] font-mono"
                              dir="ltr"
                            />
                          </div>

                          <div className="flex flex-col gap-1">
                            <label className="text-[11px] font-semibold text-slate-700">
                              محیط صرافی (Environment):
                            </label>
                            <select
                              value={kalshiEnv}
                              onChange={(e) => setKalshiEnv(e.target.value as "live" | "demo")}
                              className="h-8 rounded border border-slate-300 px-2 text-xs font-mono"
                              dir="ltr"
                            >
                              <option value="live">LIVE (api.elections.kalshi.com)</option>
                              <option value="demo">DEMO (demo-api.kalshi.co)</option>
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 items-end pt-1">
                          <div className="flex flex-col gap-1">
                            <label className="text-[11px] font-semibold text-slate-700">
                              مبلغ پیش‌فرض هر کارت عادی ($ USD):
                            </label>
                            <Input
                              type="number"
                              min={1}
                              max={250}
                              value={kalshiDefaultStake}
                              onChange={(e) => setKalshiDefaultStake(Number(e.target.value) || 3)}
                              className="h-8 text-xs font-mono"
                              dir="ltr"
                            />
                          </div>

                          <div className="flex flex-col gap-1">
                            <label className="text-[11px] font-semibold text-slate-700">
                              مبلغ کارت‌های VIP / هم‌جهت ($ USD):
                            </label>
                            <Input
                              type="number"
                              min={1}
                              max={500}
                              value={kalshiVipStake}
                              onChange={(e) => setKalshiVipStake(Number(e.target.value) || 6)}
                              className="h-8 text-xs font-mono"
                              dir="ltr"
                            />
                          </div>

                          <div className="flex items-center gap-2 h-8">
                            <input
                              id="kalshi-auto-sched"
                              type="checkbox"
                              checked={kalshiAutoEnabled}
                              onChange={(e) => setKalshiAutoEnabled(e.target.checked)}
                              className="h-4 w-4"
                            />
                            <label htmlFor="kalshi-auto-sched" className="text-xs font-bold text-sky-950 cursor-pointer">
                              اجرای خودکار روزانه در ساعت (ET):
                            </label>
                            <input
                              type="time"
                              value={kalshiAutoTimeEt}
                              onChange={(e) => setKalshiAutoTimeEt(e.target.value)}
                              className="h-8 rounded border border-slate-300 px-2 text-xs font-mono"
                              dir="ltr"
                            />
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={async () => {
                                const d = await apiRpcJson("/api/kalshi/config", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                    keyId: kalshiKeyIdInput,
                                    privateKeyPem: kalshiPemInput,
                                    env: kalshiEnv,
                                    defaultStakeUsd: kalshiDefaultStake,
                                    vipStakeUsd: kalshiVipStake,
                                    autoScheduleEnabled: kalshiAutoEnabled,
                                    autoScheduleTimeEt: kalshiAutoTimeEt,
                                  }),
                                });
                                if (d?.ok) {
                                  setKalshiHasKey(Boolean(d.hasKey));
                                  setKalshiKeyMasked(d.keyIdMasked ?? "");
                                  setKalshiKeyIdInput("");
                                  setKalshiPemInput("");
                                } else {
                                  setKalshiExecReport({ mode: "config_err", results: [], error: d?.error ?? "خطا در ذخیره تنظیمات Kalshi" });
                                }
                              }}
                              className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
                            >
                              ذخیره تنظیمات در سرور ✓
                            </button>

                            <button
                              type="button"
                              onClick={async () => {
                                const d = await apiRpcJson("/api/kalshi/balance", { method: "POST" });
                                if (d?.ok) setKalshiBalance(d.balanceUsd);
                                else setKalshiExecReport({ mode: "balance_err", results: [], error: d?.error ?? "خطا در دریافت موجودی" });
                              }}
                              className="px-3 py-1.5 rounded bg-sky-100 hover:bg-sky-200 text-sky-950 border border-sky-300 font-bold text-xs"
                            >
                              استعلام موجودی Kalshi
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Execution / Dry-Run Report Box */}
                    {kalshiExecReport && (
                      <div className="bg-white rounded-lg border border-sky-300 p-3 space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-sky-950">
                            {kalshiExecReport.mode === "dry_run"
                              ? "🧪 گزارش پیش‌نمایش و شبیه‌سازی سفارش‌ها در Kalshi (Dry-Run)"
                              : kalshiExecReport.mode === "live"
                                ? "🚀 گزارش ثبت سفارش واقعی در Kalshi"
                                : "ℹ️ پیام سیستم Kalshi"}
                          </span>
                          <button
                            type="button"
                            onClick={() => setKalshiExecReport(null)}
                            className="text-slate-500 hover:text-slate-800 text-[11px]"
                          >
                            بستن ✕
                          </button>
                        </div>

                        {kalshiExecReport.error && (
                          <div className="p-2 rounded bg-rose-50 border border-rose-300 text-rose-900 font-bold">
                            {kalshiExecReport.error}
                          </div>
                        )}

                        {kalshiExecReport.summary?.message && (
                          <div className="p-2 rounded bg-emerald-50 border border-emerald-300 text-emerald-900 font-bold">
                            {kalshiExecReport.summary.message}
                          </div>
                        )}

                        {kalshiExecReport.results && kalshiExecReport.results.length > 0 && (
                          <div className="overflow-x-auto max-h-56" dir="ltr">
                            <table className="w-full text-[11px] font-mono text-left border-collapse">
                              <thead className="bg-sky-50 text-sky-950 border-b border-sky-200">
                                <tr>
                                  <th className="p-1.5">Game</th>
                                  <th className="p-1.5">Kalshi Ticker (KXATPMATCH / KXWTAMATCH)</th>
                                  <th className="p-1.5">Pick (YES)</th>
                                  <th className="p-1.5">Contracts × Limit</th>
                                  <th className="p-1.5">Est. Cost</th>
                                  <th className="p-1.5">Net Profit</th>
                                  <th className="p-1.5">Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {kalshiExecReport.results.map((r, i) => (
                                  <tr key={i} className="border-b border-sky-100">
                                    <td className="p-1.5 font-bold">#{r.gameNo}</td>
                                    <td className="p-1.5 font-bold text-sky-900">{r.ticker}</td>
                                    <td className="p-1.5 text-emerald-800 font-bold">{r.winnerTeam}</td>
                                    <td className="p-1.5">
                                      {r.contracts ? `${r.contracts} × ${r.limitCents}¢` : "—"}
                                    </td>
                                    <td className="p-1.5 font-bold">${r.estCostUsd ?? "—"}</td>
                                    <td className="p-1.5 text-emerald-700 font-bold">
                                      {r.potentialProfitUsd ? `+$${r.potentialProfitUsd}` : "—"}
                                    </td>
                                    <td className="p-1.5">{r.message}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                        </div>
                      )}
                    </div>

                    {/* Collapsible Dropdown B: Kalshi 2-4 Leg Combo / Parlay Builder */}
                    <div className="bg-white border border-indigo-300 rounded-lg overflow-hidden shadow-2xs">
                      <div
                        onClick={() => setComboOpen((v) => !v)}
                        className="px-3 py-2 bg-indigo-50/90 hover:bg-indigo-100/80 cursor-pointer flex flex-wrap items-center justify-between gap-2 transition-colors"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-indigo-700 text-white font-extrabold text-xs">
                            کمبوساز هوشمند و دستی Kalshi (Parlay / میکس ۲ تا ۴ بازی)
                          </span>
                          <span className="px-2 py-0.5 rounded bg-white border border-indigo-200 font-mono text-[11px] text-indigo-950 font-extrabold">
                            سطح اول ایمن: {m7ComboOrders.length} | کمبو فعال: {comboLegOrders.length} بازی ({comboMultiplier}x)
                          </span>
                        </div>
                        <button
                          type="button"
                          data-testid="button-toggle-kalshi-combo"
                          onClick={(e) => {
                            e.stopPropagation();
                            setComboOpen((v) => !v);
                          }}
                          className="px-2.5 py-1 rounded border border-indigo-300 bg-white hover:bg-indigo-50 text-indigo-950 text-xs font-extrabold"
                        >
                          {comboOpen ? "بستن کمبوساز ▲" : "باز کردن کمبوساز ▼"}
                        </button>
                      </div>

                      {comboOpen && (
                        <div className="p-3 space-y-2.5 bg-indigo-50/30 border-t border-indigo-200/80">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-950 border border-emerald-400 text-[11px] font-extrabold">
                              استراتزی کمبو: {fusionMode === "mode17" ? "حالت ۱۷ (تقاطع طلایی ۱۳ ∩ ۱۵)" : fusionMode === "tri_gf_ultralock" ? "حالت ۱۲ (ابرقفل ۳ عددی)" : fusionMode === "anti_nobet_smart" ? "حالت ۱۳ (ضد NO-BET هوشمند)" : fusionMode === "total_elem_12" ? "حالت ۱۴ (المنت کل بازیکن+کورت)" : fusionMode === "tri_gf_routed" ? "حالت ۱۱ (۳ عددی مستقل)" : fusionMode === "earth_neg_lock" ? "حالت ۷ (خالص منفی)" : "حالت ۹ (قفل ایمن)"} • کل قفل ایمن: {safePoolOrders.length} مسابقه
                            </span>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setComboOpen(true);
                                  setComboSelectedByDate((prev) => ({
                                    ...prev,
                                    [activeDailyDate]: getAutoQualifiedComboGameNos(),
                                  }));
                                }}
                                className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-extrabold shadow-2xs"
                              >
                                انتخاب خودکار ایمن ({getAutoQualifiedComboGameNos().length})
                              </button>
                              <button
                                type="button"
                                disabled={safePoolOrders.length < 2}
                                onClick={() => {
                                  setComboOpen(true);
                                  setComboSelectedByDate((prev) => ({
                                    ...prev,
                                    [activeDailyDate]: getBestComboGameNos(2),
                                  }));
                                }}
                                className="px-2 py-1 rounded bg-white hover:bg-indigo-50 disabled:opacity-45 text-indigo-900 border border-indigo-300 text-[11px] font-bold"
                              >
                                بهترین ۲ بازی ایمن
                              </button>
                              <button
                                type="button"
                                disabled={safePoolOrders.length < 3}
                                onClick={() => {
                                  setComboOpen(true);
                                  setComboSelectedByDate((prev) => ({
                                    ...prev,
                                    [activeDailyDate]: getBestComboGameNos(3),
                                  }));
                                }}
                                className="px-2 py-1 rounded bg-white hover:bg-indigo-50 disabled:opacity-45 text-indigo-900 border border-indigo-300 text-[11px] font-bold"
                              >
                                ۳ بازی برتر ایمن
                              </button>
                              <button
                                type="button"
                                disabled={safePoolOrders.length < 4}
                                onClick={() => {
                                  setComboOpen(true);
                                  setComboSelectedByDate((prev) => ({
                                    ...prev,
                                    [activeDailyDate]: getBestComboGameNos(4),
                                  }));
                                }}
                                className="px-2 py-1 rounded bg-white hover:bg-indigo-50 disabled:opacity-45 text-indigo-900 border border-indigo-300 text-[11px] font-bold"
                              >
                                بهترین ۴ بازی ایمن
                              </button>
                            </div>
                          </div>
                          {safePoolOrders.length < 2 && (
                            <div className="px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-300 text-amber-950 text-[11px] font-bold">
                              در این روز تنها {safePoolOrders.length} بازی از قفل‌های ضد EARTH و لنگر منفی عبور کرده است؛ بازی‌های ردشده به صورت خودکار وارد میکس نمی‌شوند (انتخاب دستی با کلیک روی کارت‌ها همچنان فعال است).
                            </div>
                          )}
                          <div>
                            <div className="text-[11px] font-bold text-indigo-950 mb-1.5">
                              رتبه‌بندی بازی‌ها بر اساس استراتزی حالت ۷ (ضد EARTH + لنگر منفی) — بازی‌های دارای قفل EARTH یا واگرایی از انتخاب خودکار حذف شده‌اند:
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                              {rankedForCombo.map((ord) => {
                                const legIdx = activeComboGameNos.indexOf(ord.gameNo);
                                const isSel = legIdx >= 0;
                                const isSafeCard = ord.comboTier >= 1;
                                return (
                                  <button
                                    key={ord.gameNo}
                                    type="button"
                                    onClick={() => toggleGameInCombo(ord.gameNo)}
                                    className={`text-right p-2 rounded-lg border transition-all flex flex-col justify-between ${
                                      isSel
                                        ? "bg-indigo-700 text-white border-indigo-900 shadow-sm ring-2 ring-indigo-300"
                                        : ord.comboTier === 3
                                          ? "bg-emerald-50/95 hover:bg-emerald-100 text-slate-900 border-2 border-emerald-500"
                                          : ord.comboTier === 2
                                            ? "bg-sky-50/95 hover:bg-sky-100 text-slate-900 border border-sky-400"
                                            : isSafeCard
                                              ? "bg-white hover:bg-sky-50 text-slate-800 border border-indigo-300"
                                              : ord.pickEarthBlocked
                                                ? "bg-rose-50/70 hover:bg-rose-100/70 text-slate-700 border border-rose-300 opacity-80"
                                                : "bg-slate-50/80 hover:bg-slate-100 text-slate-600 border border-slate-300 opacity-80"
                                    }`}
                                  >
                                    <div className="flex items-center justify-between gap-1 w-full">
                                      <span className="font-mono text-[10px] font-extrabold">
                                        #{ord.gameNo} {isSel ? `• Leg ${legIdx + 1} ✓` : ""}
                                      </span>
                                      <span
                                        dir="ltr"
                                        className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-extrabold ${
                                          isSel
                                            ? "bg-amber-300 text-slate-950"
                                            : ord.comboTier >= 2
                                              ? "bg-emerald-200 text-emerald-950"
                                              : isSafeCard
                                                ? "bg-sky-100 text-sky-950"
                                                : ord.pickEarthBlocked
                                                  ? "bg-rose-200 text-rose-950"
                                                  : "bg-slate-200 text-slate-700"
                                        }`}
                                      >
                                        {ord.pickElWk || "—"} • 1x:{ord.pick1xxx > 0 ? `+${ord.pick1xxx}` : ord.pick1xxx} | Σ8:{ord.pickAll8 > 0 ? `+${ord.pickAll8}` : ord.pickAll8}
                                      </span>
                                    </div>
                                    <div className="font-extrabold text-xs mt-1 flex items-center justify-between gap-1">
                                      <span className="truncate" dir="ltr">
                                        {ord.winnerTeam}
                                      </span>
                                      <span className={`text-[9.5px] font-mono shrink-0 ${isSel ? "text-amber-200" : "text-slate-500"}`} dir="ltr">
                                        L5:{Math.round(ord.pickL5Wk)}%
                                      </span>
                                    </div>
                                    <div className="flex items-center justify-between gap-1 mt-1.5 text-[9.5px]">
                                      <span className={`font-mono ${isSel ? "text-indigo-100" : "text-slate-600"}`} dir="ltr">
                                        Ask:{ord.liveAskCents}¢ ({ord.evEdge >= 0 ? `+${ord.evEdge}` : ord.evEdge}% EV)
                                      </span>
                                      <span
                                        className={`font-extrabold px-1.5 py-0.5 rounded text-[9px] ${
                                          isSel
                                            ? ord.comboTier >= 1
                                              ? "bg-emerald-500 text-white"
                                              : "bg-rose-500 text-white"
                                            : ord.comboTier === 3
                                              ? "bg-emerald-700 text-white"
                                              : ord.comboTier === 2
                                                ? "bg-teal-700 text-white"
                                                : ord.comboTier === 1
                                                  ? "bg-sky-700 text-white"
                                                  : ord.pickEarthBlocked
                                                    ? "bg-rose-600 text-white"
                                                    : "bg-amber-200 text-amber-950"
                                        }`}
                                      >
                                        {ord.lockStatusLabel}
                                      </span>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <div className="bg-white border border-indigo-200 rounded-lg p-2.5 flex flex-wrap items-center justify-between gap-3">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {comboLegOrders.map((leg, i) => (
                                <Fragment key={leg.gameNo}>
                                  {i > 0 && (
                                    <span className="font-extrabold text-indigo-700 text-sm px-0.5">×</span>
                                  )}
                                  <div
                                    className={`px-2.5 py-1 rounded-md border text-xs ${
                                      leg.comboTier >= 1
                                        ? "bg-indigo-50 border-indigo-300"
                                        : "bg-rose-50 border-rose-400"
                                    }`}
                                  >
                                    <div className="font-extrabold text-indigo-950">
                                      {i + 1}. {leg.winnerTeam}{" "}
                                      <span className="font-mono text-[10px] text-indigo-700">(#{leg.gameNo})</span>
                                    </div>
                                    <div className="text-[10px] font-mono text-slate-700">
                                      قیمت: <b>{leg.liveAskCents}¢</b> • {leg.pickElWk} •{" "}
                                      <span dir="ltr">
                                        1x:{leg.pick1xxx > 0 ? `+${leg.pick1xxx}` : leg.pick1xxx} | Σ8:{leg.pickAll8 > 0 ? `+${leg.pickAll8}` : leg.pickAll8}
                                      </span>{" "}
                                      • <b>{leg.lockStatusLabel}</b>
                                    </div>
                                  </div>
                                </Fragment>
                              ))}
                              <span className="font-extrabold text-indigo-700 text-sm px-1">=</span>
                              <div className="px-3 py-1 rounded-md bg-emerald-50 border border-emerald-400 text-xs">
                                <div className="font-extrabold text-emerald-950">
                                  قیمت منصفانه بازار: <span className="font-mono">{comboFairCents}¢</span> (ضریب: <span className="font-mono">{comboMultiplier}x</span>) • احتمال ترکیبی قفل ایمن: <span className="font-mono">{comboModelProbPct}%</span>
                                </div>
                                <div className="text-[10px] font-mono text-emerald-800">
                                  خرید {comboContracts} قرارداد کمبو @ {comboLimitCents}¢ ➔ هزینه: <b>${comboEstCostUsd}</b> • دریافتی برد: <b>${comboMaxPayoutUsd}</b> (سود خالص: <b>+${comboNetProfitUsd}</b>)
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              <div className="bg-slate-50 border border-slate-300 rounded px-2 py-1">
                                <label className="block text-[9px] text-slate-600 font-bold">مبلغ کل کمبو ($)</label>
                                <input
                                  type="number"
                                  min={1}
                                  max={250}
                                  step={0.5}
                                  value={comboStakeUsd}
                                  onChange={(e) => setComboStakeUsd(Math.max(1, Number(e.target.value) || 4))}
                                  className="w-16 text-xs font-mono font-extrabold text-indigo-950 bg-transparent outline-none"
                                />
                              </div>

                              <div className="bg-slate-50 border border-slate-300 rounded px-2 py-1">
                                <label className="block text-[9px] text-slate-600 font-bold">قیمت لیمیت کمبو (¢)</label>
                                <input
                                  type="number"
                                  min={1}
                                  max={98}
                                  value={comboLimitCents}
                                  onChange={(e) =>
                                    setComboCustomLimitCents((prev) => ({
                                      ...prev,
                                      [comboKey]: Math.min(98, Math.max(1, Number(e.target.value) || comboFairCents)),
                                    }))
                                  }
                                  className="w-14 text-xs font-mono font-extrabold text-indigo-950 bg-transparent outline-none"
                                />
                              </div>

                              <button
                                type="button"
                                disabled={kalshiBusy || comboLegOrders.length < 2}
                                data-testid="btn-kalshi-combo-dryrun"
                                onClick={async () => {
                                  setKalshiBusy(true);
                                  try {
                                    const d = await apiRpcJson("/api/kalshi/combo", {
                                      method: "POST",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({
                                        date: activeDailyDate,
                                        legs: comboLegOrders.map((l) => ({
                                          gameNo: l.gameNo,
                                          eventTicker: l.eventTicker,
                                          marketTicker: l.ticker,
                                          winnerTeam: l.winnerTeam,
                                          yesAskCents: l.liveAskCents,
                                          twinPct: l.twinPct,
                                          agree: l.agree,
                                        })),
                                        stakeUsd: comboStakeUsd,
                                        limitCents: comboLimitCents,
                                        mode: "dry_run",
                                      }),
                                    });
                                    setComboReport(d);
                                  } catch (err) {
                                    setComboReport({
                                      ok: false,
                                      error: (err as Error)?.message ?? "خطا در استعلام کمبو از سرور Kalshi",
                                    });
                                  } finally {
                                    setKalshiBusy(false);
                                  }
                                }}
                                className="px-3 py-1.5 rounded-md bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-extrabold text-xs shadow-sm"
                              >
                                {kalshiBusy
                                  ? "⏳ در حال ارتباط با Kalshi..."
                                  : `🧪 استعلام تیکر و پیش‌نمایش کمبو (${comboLegOrders.length} بازی)`}
                              </button>

                              <button
                                type="button"
                                disabled={kalshiBusy || comboLegOrders.length < 2}
                                data-testid="btn-kalshi-combo-submit"
                                onClick={async () => {
                                  setKalshiBusy(true);
                                  try {
                                    const d = await apiRpcJson("/api/kalshi/combo", {
                                      method: "POST",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({
                                        date: activeDailyDate,
                                        legs: comboLegOrders.map((l) => ({
                                          gameNo: l.gameNo,
                                          eventTicker: l.eventTicker,
                                          marketTicker: l.ticker,
                                          winnerTeam: l.winnerTeam,
                                          yesAskCents: l.liveAskCents,
                                          twinPct: l.twinPct,
                                          agree: l.agree,
                                        })),
                                        stakeUsd: comboStakeUsd,
                                        limitCents: comboLimitCents,
                                        mode: "live",
                                      }),
                                    });
                                    setComboReport(d);
                                    const balD = await apiRpcJson("/api/kalshi/balance", { method: "POST" });
                                    if (balD?.ok && balD.balanceUsd) setKalshiBalance(balD.balanceUsd);
                                    const stD = await apiRpcJson("/api/kalshi/state");
                                    if (stD?.ledger) setKalshiLedger(stD.ledger);
                                  } catch (err) {
                                    setComboReport({
                                      ok: false,
                                      error: (err as Error)?.message ?? "خطا در ثبت سفارش کمبو در Kalshi",
                                    });
                                  } finally {
                                    setKalshiBusy(false);
                                  }
                                }}
                                className="px-3.5 py-1.5 rounded-md bg-indigo-700 hover:bg-indigo-800 disabled:opacity-50 text-white font-extrabold text-xs shadow-sm"
                              >
                                {kalshiBusy
                                  ? "⏳ در حال ثبت سفارش..."
                                  : `🚀 ثبت سفارش کمبو (${comboLegOrders.length} بازی) در Kalshi`}
                              </button>
                            </div>
                          </div>

                          {comboReport && (
                            <div
                              className={`p-2.5 rounded-lg border text-xs font-mono ${
                                comboReport.ok
                                  ? "bg-emerald-50 border-emerald-400 text-emerald-950"
                                  : "bg-rose-50 border-rose-300 text-rose-900"
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-extrabold">
                                  {comboReport.message ?? comboReport.error}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setComboReport(null)}
                                  className="text-[11px] text-slate-600 hover:text-slate-900 font-bold"
                                >
                                  بستن ✕
                                </button>
                              </div>
                              {comboReport.comboTicker && (
                                <div className="mt-1 text-[11px] text-indigo-900">
                                  Combo Ticker: <b>{comboReport.comboTicker}</b>{" "}
                                  {comboReport.orderId ? `• Order ID: ${comboReport.orderId}` : ""}{" "}
                                  {comboReport.rfqId ? `• RFQ ID: ${comboReport.rfqId}` : ""}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Quick Tier Filter Chips Bar for Mode 17 (Golden Intersection 13 ∩ 15) */}
              {fusionMode === "mode17" && (
                <div
                  data-testid="bar-mode17-tier-chips"
                  dir="rtl"
                  className="rounded-xl border-2 border-amber-400/90 bg-gradient-to-l from-amber-50/95 via-white to-emerald-50/90 p-2.5 shadow-xs space-y-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="px-2 py-1 rounded-md bg-slate-900 text-amber-300 text-[11px] font-extrabold shrink-0">
                        فیلتر سریع سطوح حالت ۱۷:
                      </span>
                      <button
                        type="button"
                        data-testid="chip-mode17-all"
                        onClick={() => switchMode17TierChip("all17")}
                        className={`px-2.5 py-1 rounded-lg text-xs font-extrabold border transition-all inline-flex items-center gap-1.5 ${
                          mode17TierFilter === "all17"
                            ? "bg-emerald-700 text-white border-emerald-900 shadow-xs ring-1 ring-emerald-400"
                            : "bg-white text-slate-900 border-emerald-300 hover:bg-emerald-50"
                        }`}
                      >
                        <span>همه سیگنال‌های ۱۷ (۷۱٪+)</span>
                        <span
                          dir="ltr"
                          className={`px-1.5 py-0.5 rounded font-mono text-[10.5px] ${
                            mode17TierFilter === "all17"
                              ? "bg-emerald-900/70 text-emerald-100"
                              : "bg-emerald-100 text-emerald-950"
                          }`}
                        >
                          {mode17ScopeStats.all17.total} ({mode17ScopeStats.all17.pct}%) • امروز:{mode17DayCounts.all17}
                        </span>
                      </button>

                      <button
                        type="button"
                        data-testid="chip-mode17-gold"
                        onClick={() => switchMode17TierChip("gold_plus")}
                        className={`px-2.5 py-1 rounded-lg text-xs font-extrabold border transition-all inline-flex items-center gap-1.5 ${
                          mode17TierFilter === "gold_plus"
                            ? "bg-amber-500 text-slate-950 border-amber-700 shadow-xs ring-1 ring-amber-400"
                            : "bg-white text-slate-900 border-amber-300 hover:bg-amber-50"
                        }`}
                      >
                        <span>🥇 فقط طلایی و الماس (۸۰٪+)</span>
                        <span
                          dir="ltr"
                          className={`px-1.5 py-0.5 rounded font-mono text-[10.5px] ${
                            mode17TierFilter === "gold_plus"
                              ? "bg-slate-950 text-amber-300"
                              : "bg-amber-100 text-amber-950"
                          }`}
                        >
                          {mode17ScopeStats.goldPlus.total} ({mode17ScopeStats.goldPlus.pct}%) • امروز:{mode17DayCounts.goldPlus}
                        </span>
                      </button>

                      <button
                        type="button"
                        data-testid="chip-mode17-sniper"
                        onClick={() => switchMode17TierChip("sniper_top")}
                        className={`px-2.5 py-1 rounded-lg text-xs font-extrabold border transition-all inline-flex items-center gap-1.5 ${
                          mode17TierFilter === "sniper_top"
                            ? "bg-slate-950 text-amber-300 border-amber-500 shadow-xs ring-1 ring-amber-400"
                            : "bg-white text-slate-900 border-violet-300 hover:bg-violet-50"
                        }`}
                      >
                        <span>🖤⚡ فقط الماس سیاه و نجومی خالص (۸۱٪–۸۶٪)</span>
                        <span
                          dir="ltr"
                          className={`px-1.5 py-0.5 rounded font-mono text-[10.5px] ${
                            mode17TierFilter === "sniper_top"
                              ? "bg-amber-400 text-slate-950"
                              : "bg-violet-100 text-violet-950"
                          }`}
                        >
                          {mode17ScopeStats.sniper.total} ({mode17ScopeStats.sniper.pct}%) • امروز:{mode17DayCounts.sniper}
                        </span>
                      </button>

                      <button
                        type="button"
                        data-testid="chip-mode17-slate"
                        onClick={() => switchMode17TierChip("all_slate")}
                        className={`px-2 py-1 rounded-lg text-[11px] font-bold border transition-all ${
                          mode17TierFilter === "all_slate"
                            ? "bg-sky-700 text-white border-sky-900 shadow-2xs"
                            : "bg-white/90 text-slate-700 border-slate-300 hover:bg-slate-100"
                        }`}
                      >
                        کل اسلیت روز با NO-BET ({mode17DayCounts.slate})
                      </button>
                    </div>
                  </div>

                  <div className="pt-1.5 border-t border-amber-200/80 flex flex-wrap items-center justify-between gap-1.5 text-[10.5px]">
                    <div className="flex flex-wrap items-center gap-1.5 font-extrabold">
                      <span
                        data-testid="count-m17-black-diamond"
                        className="px-2 py-0.5 rounded bg-slate-950 text-amber-300 border border-amber-400 font-mono"
                      >
                        🖤 الماس سیاه: {mode17ScopeStats.t1.total} ({mode17ScopeStats.t1.pct}%)
                      </span>
                      <span
                        data-testid="count-m17-pure-astro"
                        className="px-2 py-0.5 rounded bg-violet-700 text-white border border-violet-500 font-mono"
                      >
                        ⚡ نجومی خالص: {mode17ScopeStats.t2.total}
                      </span>
                      <span
                        data-testid="count-m17-daily-gold"
                        className="px-2 py-0.5 rounded bg-amber-300 text-slate-950 border border-amber-500 font-mono"
                      >
                        🥇 طلایی روزانه: {mode17ScopeStats.t3.total} ({mode17ScopeStats.t3.pct}%)
                      </span>
                      <span
                        data-testid="count-m17-standard"
                        className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-950 border border-emerald-300 font-mono"
                      >
                        ✅ استاندارد طلایی: {mode17ScopeStats.t4.total}
                      </span>
                    </div>
                    <span dir="ltr" className="font-mono font-bold text-slate-700 bg-white/90 px-2 py-0.5 rounded border border-slate-200">
                      {tour === "ALL"
                        ? `ATP: ${mode17ScopeStats.atp17.pct}% (${mode17ScopeStats.atp17.w}/${mode17ScopeStats.atp17.n}) • WTA: ${mode17ScopeStats.wta17.pct}% (${mode17ScopeStats.wta17.w}/${mode17ScopeStats.wta17.n}) • Last50: ${mode17ScopeStats.l50.pct}%`
                        : `Active Scope (${seasonFilter}): ${mode17ScopeStats.all17.pct}% (${mode17ScopeStats.all17.w}/${mode17ScopeStats.all17.n}) • Last50: ${mode17ScopeStats.l50.pct}%`}
                    </span>
                  </div>
                </div>
              )}

              {/* Daily Cards Grid (2 to 3 Cards per Row, Exact GOLD-FORMULA-PRIORITY Card Structure in Light Pale-Blue) */}
              {histLoading ? (
                <div className="p-6 text-center text-xs text-sky-800 bg-white rounded-lg border border-sky-200 flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> در حال محاسبه کارت‌های روزانه از ۲۱٬۴۹۸ بازی تاریخی...
                </div>
              ) : fusionMode === "mode17" &&
                dailyCardFilter === "all" &&
                mode17TierFilter !== "all_slate" &&
                !gamesOnDailyDate.some((x) => matchesMode17Filter(x, mode17TierFilter)) ? (
                <div className="p-4 rounded-xl border border-amber-300 bg-white text-center space-y-2.5" dir="rtl">
                  <div className="text-xs font-extrabold text-slate-800">
                    در تاریخ انتخاب‌شده ({activeDailyDate}) سیگنال فعالی در این سطح ثبت نشده است ({gamesOnDailyDate.length} مسابقه این روز در وضعیت NO-BET قرار دارد).
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    {(() => {
                      const jumpDate =
                        mode17TierFilter === "sniper_top"
                          ? mode17ScopeStats.lastDateSniper
                          : mode17TierFilter === "gold_plus"
                            ? mode17ScopeStats.lastDateGold
                            : mode17ScopeStats.lastDateAll17;
                      return jumpDate ? (
                        <button
                          type="button"
                          onClick={() => setDailyCardDate(jumpDate)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-extrabold"
                        >
                          پرش به آخرین تاریخ دارای سیگنال این سطح ({jumpDate})
                        </button>
                      ) : null;
                    })()}
                    <button
                      type="button"
                      onClick={() => setMode17TierFilter("all_slate")}
                      className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 text-xs font-extrabold"
                    >
                      نمایش کارت‌های NO-BET امروز ({gamesOnDailyDate.length})
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
                  {[...gamesOnDailyDate]
                    .map((g) => {
                      const t12 = (manualPersp === "home" ? g.h_12 : g.a_12) ?? [];
                      const tGeoFin = (manualPersp === "home" ? g.h_geo : g.a_geo) ?? "";
                      const tGeoDyn = (manualPersp === "home" ? (g.h_geo_dyn ?? g.h_geo) : (g.a_geo_dyn ?? g.a_geo)) ?? "";
                      const tGeoTab = (manualPersp === "home" ? g.h_geo_tab : g.a_geo_tab) ?? "";
                      const activeGeoKind: "fin" | "dyn" = dailyCardMode === "geo_dyn" ? "dyn" : manualGeoKind;
                      const dPool = getDayPoolBefore(g.day, g.d);
                      const savedState = manualFilters[g.n];
                      const rowGeoKind: "fin" | "dyn" = savedState?.geoKind ?? activeGeoKind;
                      const getRowEl12 = (r: HistGameRow) => (manualPersp === "home" ? r.h12 : r.a12);
                      const getRowGeo = (r: HistGameRow) =>
                        manualPersp === "home"
                          ? rowGeoKind === "dyn"
                            ? r.hGeoDyn ?? r.hGeo
                            : r.hGeo
                          : rowGeoKind === "dyn"
                            ? r.aGeoDyn ?? r.aGeo
                            : r.aGeo;
                      const getRowGeoTab = (r: HistGameRow) =>
                        manualPersp === "home" ? (r.hGeoTab ?? "") : (r.aGeoTab ?? "");

                      const ch3 = computeThreeChannelIndex(t12, tGeoFin, tGeoDyn, dPool, manualPersp, tGeoTab);
                      const autoChosen =
                        dailyCardMode === "geo_tab"
                          ? ch3.geoTab
                          : dailyCardMode === "geo"
                            ? ch3.geoFin
                            : dailyCardMode === "geo_dyn"
                              ? ch3.geoDyn
                              : ch3.step;

                      const hasManualFilter = Boolean(
                        savedState &&
                          (Object.values(savedState.cols).some((v) => v && v !== "ALL") ||
                            (savedState.geo && savedState.geo !== "ALL") ||
                            (savedState.geoTab && savedState.geoTab !== "ALL"))
                      );

                      const isNhlSysMode =
                        dailyCardMode === "nhl_best" ||
                        dailyCardMode === "nhl_vip3" ||
                        dailyCardMode === "nhl_f1_guard" ||
                        dailyCardMode === "nhl_f1_idx_raw" ||
                        dailyCardMode === "nhl_f1" ||
                        dailyCardMode === "nhl_f1_union";

                      const f1Pool = isNhlSysMode && manualPersp === "home" ? resolveNhlF1Pool(g, dPool) : null;
                      let cardPool = f1Pool ?? autoChosen.pool;
                      let manualOverridden = false;

                      if (hasManualFilter && savedState) {
                        const manualPool = dPool.filter((r) => {
                          const el = getRowEl12(r);
                          for (let c = 0; c < 12; c++) {
                            const sel = savedState.cols[c];
                            if (sel && sel !== "ALL" && el[c] !== sel) return false;
                          }
                          if (savedState.geo && savedState.geo !== "ALL" && getRowGeo(r) !== savedState.geo) {
                            return false;
                          }
                          if (savedState.geoTab && savedState.geoTab !== "ALL" && getRowGeoTab(r) !== savedState.geoTab) {
                            return false;
                          }
                          return true;
                        });
                        if (manualPool.length >= 5 && manualPool.length <= 7) {
                          cardPool = manualPool;
                          manualOverridden = true;
                        }
                      }

                      const isNaturalPool = Boolean(f1Pool) || manualOverridden || autoChosen.isNatural57;
                      const cardIdx = computePoolNumIndex(cardPool);
                      const hw = cardPool.filter((r) => r.mg > 0).length;
                      const aw = cardPool.filter((r) => r.mg < 0).length;
                      const tot = hw + aw;
                      const pct = tot > 0 ? Math.round((Math.max(hw, aw) / tot) * 100) : 50;

                      const hpElePCode = "";
                      const apElePCode = "";
                      const nat3Cnt = g.idx3?.nat ?? ch3.natCount;
                      const minD3Val = g.idx3?.minD ?? ch3.minDelta;

                      const baseHomeFav =
                        isNhlSysMode && !manualOverridden && g.sys_win
                          ? g.sys_win === g.h
                          : hw > aw
                            ? true
                            : aw > hw
                              ? false
                              : (g.f30 ?? 0) >= 0;
                      const homeFav = cardFlipDir[g.n] ? !baseHomeFav : baseHomeFav;
                      const predTeam = homeFav ? g.h : g.a;
                      const predRole = homeFav ? "برد بازیکن ۱" : "برد بازیکن ۲";

                      const trapNoNat3 = Boolean(g.trap_tag);
                      const trapEven6 = false;
                      const trapBlind100 = false;
                      const trapPas0000 = false;
                      const hasInternalTrap = Boolean(g.trap_tag);

                      const rawWtp = activeWtpOf(g) ?? {
                        mon: g.d,
                        htp: 50,
                        atp: 50,
                        dtp: 0,
                        hrk: 15,
                        ark: 15,
                        hwl: "0-0",
                        awl: "0-0",
                        hpct: 50,
                        apct: 50,
                        hel: "AIR",
                        ael: "AIR",
                        l5h: 50,
                        hodds: 1.83,
                        aodds: 2.20,
                        mel: "WATER",
                      };
                      const rawL5H = typeof rawWtp.l5h === "number" ? rawWtp.l5h : 50;
                      const l5Pick = Math.round((homeFav ? rawL5H : 100 - rawL5H) * 10) / 10;
                      const matchElem: "FIRE" | "AIR" | "WATER" | "EARTH" =
                        l5Pick >= 58 ? "FIRE" : l5Pick >= 51 ? "AIR" : l5Pick >= 44 ? "WATER" : "EARTH";
                      const elemFaMap: Record<string, string> = {
                        FIRE: "آتش FIRE",
                        AIR: "هوا AIR",
                        WATER: "آب WATER",
                        EARTH: "خاک EARTH",
                      };
                      const wtpObj = {
                        ...rawWtp,
                        dtp: cardFlipDir[g.n] ? -rawWtp.dtp : rawWtp.dtp,
                        l5Pick,
                        matchElem,
                        matchElemFa: elemFaMap[matchElem] || matchElem,
                        hel: rawWtp.hel || "AIR",
                        ael: rawWtp.ael || "AIR",
                        hodds: typeof rawWtp.hodds === "number" ? rawWtp.hodds : 1.83,
                        aodds: typeof rawWtp.aodds === "number" ? rawWtp.aodds : 2.20,
                      };
                      const trapWeeklyMismatch =
                        typeof rawWtp.l5h === "number" ? matchElem === "EARTH" : wtpObj.dtp <= -8.0;

                      const isVip3 = activeVip3Of(g);
                      const isBestGuard = Boolean(g.f1_guard);
                      const isBestWtp = activeF1WtpOf(g);
                      const isRawF1Idx = Boolean(g.f1_idx);
                      const isBaseF1 = Boolean(g.f1);
                      const isUnionSys = activeUnionOf(g);
                      const isFilteredOutByWeekly = Boolean((isBestGuard || g.idx_rescue) && trapWeeklyMismatch);
                      const isFilteredOutByTrap = Boolean(isBaseF1 && hasInternalTrap);
                      const isFilteredOutByIdx = Boolean(isBaseF1 && !isRawF1Idx && !isBestGuard);
                      const isIdxRescueOnly = Boolean(!g.f1 && g.idx_rescue);

                      const manualNaturalQual =
                        tot >= 5 &&
                        tot <= 7 &&
                        pct >= 71 &&
                        Math.abs(hw - aw) >= 3 &&
                        !hasInternalTrap &&
                        !trapWeeklyMismatch;

                      const isQualified =
                        manualOverridden || !isNhlSysMode
                          ? manualNaturalQual
                          : dailyCardMode === "nhl_vip3"
                            ? isVip3
                            : dailyCardMode === "nhl_best"
                              ? isBestWtp
                              : dailyCardMode === "nhl_f1_guard"
                                ? isBestGuard
                                : dailyCardMode === "nhl_f1_idx_raw"
                                  ? isRawF1Idx
                                  : dailyCardMode === "nhl_f1_union"
                                    ? isUnionSys
                                    : isBaseF1;

                      const isBorderlineRescued = Boolean(
                        isQualified && (g.is_nat === false || g.b2b_tag === "B2B_PICK" || isIdxRescueOnly)
                      );
                      const isVipMismatchRescue = false;
                      const m17 = fusionMode === "mode17" ? evalMode17Gold(g) : null;
                      const calibratedWinPct = m17
                        ? isQualified
                          ? m17.calWinPct
                          : 50.0
                        : isQualified && (isVip3 || wtpObj.matchElem === "FIRE")
                          ? 78.5
                          : isQualified && wtpObj.matchElem === "WATER"
                            ? 70.5
                            : isBorderlineRescued
                              ? 71.5
                              : isQualified
                                ? 74.5
                                : 50.0;
                      const maxBuyCents = m17
                        ? isQualified
                          ? m17.maxBuyCents
                          : 0
                        : isQualified && (isVip3 || wtpObj.matchElem === "FIRE")
                          ? 76
                          : isQualified && wtpObj.matchElem === "WATER"
                            ? 68
                            : isBorderlineRescued
                              ? 69
                              : isQualified
                                ? 72
                                : 0;

                      const kalshiTicker = buildKalshiNbaTicker(g.d, g.a, g.h, predTeam, ((g as any).tour === "WTA" || tour === "WTA") ? "WTA" : "ATP");
                      const mktInfo = kalshiMarkets[kalshiTicker];
                      const liveAsk = mktInfo && mktInfo.yesAskCents > 0 ? mktInfo.yesAskCents : 55;
                      const isUnderdogCaution = liveAsk < 45;
                      const evEdge = Math.round(calibratedWinPct - liveAsk);
                      const isPosEv = isQualified && liveAsk <= maxBuyCents && !isUnderdogCaution;

                      const hasFinalScore = Boolean(g.done && g.st !== "PENDING" && g.aw);
                      const cardWon = !hasFinalScore ? null : predTeam === g.aw;
                      const normalizedSc = (() => {
                        const rawSc = String(g.sc ?? "").trim();
                        if (!rawSc || rawSc === "PENDING" || rawSc === "UPCOMING") return "";
                        const p1Won = g.aw ? g.aw === g.h : Boolean(g.hw);
                        if (p1Won) return rawSc;
                        const parMatch = rawSc.match(/\s*\((\d+)-(\d+)\)\s*$/);
                        const core = parMatch ? rawSc.slice(0, parMatch.index).trim() : rawSc;
                        const toks = core.split(/\s+/).filter(Boolean);
                        let sumX = 0;
                        let sumY = 0;
                        let setsX = 0;
                        let setsY = 0;
                        let parsedSets = 0;
                        const hasRet = /\b(RET|DEF|ABD|W\/O)\b/i.test(core);
                        for (const t of toks) {
                          const mb = t.match(/^\[(\d+)-(\d+)\]$/);
                          if (mb) {
                            const x = Number(mb[1]);
                            const y = Number(mb[2]);
                            if (x > y) setsX++;
                            else if (y > x) setsY++;
                            parsedSets++;
                            continue;
                          }
                          const ms = t.match(/^(\d+)-(\d+)(?:\(\d+\))?$/);
                          if (ms) {
                            const x = Number(ms[1]);
                            const y = Number(ms[2]);
                            sumX += x;
                            sumY += y;
                            if (x > y) setsX++;
                            else if (y > x) setsY++;
                            parsedSets++;
                          }
                        }
                        const hpNum = Number(g.hp ?? NaN);
                        const apNum = Number(g.ap ?? NaN);
                        const isInverted =
                          parsedSets > 0 &&
                          ((Number.isFinite(hpNum) &&
                            Number.isFinite(apNum) &&
                            hpNum !== apNum &&
                            sumX === apNum &&
                            sumY === hpNum) ||
                            (hpNum === apNum && !hasRet && setsX > setsY));
                        if (!isInverted) return rawSc;
                        const flipped = toks.map((t) => {
                          const mb = t.match(/^\[(\d+)-(\d+)\]$/);
                          if (mb) return `[${mb[2]}-${mb[1]}]`;
                          const ms = t.match(/^(\d+)-(\d+)(\(\d+\))?$/);
                          if (ms) return `${ms[2]}-${ms[1]}${ms[3] ?? ""}`;
                          return t;
                        });
                        return `${flipped.join(" ")}${parMatch ? ` (${parMatch[1]}-${parMatch[2]})` : ""}`;
                      })();
                      const scoreDisplay = normalizedSc
                        ? `${g.hc} ${normalizedSc} ${g.ac}`
                        : g.hp !== undefined && g.ap !== undefined
                          ? `${g.hc} ${g.hp}-${g.ap} ${g.ac}`
                          : "";

                      return {
                        g,
                        m17,
                        ch3,
                        cardIdx,
                        wtpObj,
                        trapWeeklyMismatch,
                        isVipMismatchRescue,
                        hw,
                        aw,
                        tot,
                        pct,
                        nat3Cnt,
                        minD3Val,
                        trapNoNat3,
                        trapEven6,
                        trapBlind100,
                        trapPas0000,
                        hasInternalTrap,
                        isBorderlineRescued,
                        calibratedWinPct,
                        maxBuyCents,
                        isUnderdogCaution,
                        isVip3,
                        isBestGuard,
                        isBestWtp,
                        isBaseF1,
                        isNaturalPool,
                        isFilteredOutByWeekly,
                        isFilteredOutByTrap,
                        isFilteredOutByIdx,
                        isIdxRescueOnly,
                        isQualified,
                        manualOverridden,
                        isNhlSysMode,
                        homeFav,
                        predTeam,
                        predRole,
                        kalshiTicker,
                        mktInfo,
                        liveAsk,
                        evEdge,
                        isPosEv,
                        hasFinalScore,
                        cardWon,
                        scoreDisplay,
                      };
                    })
                    .filter((item) => {
                      const inActiveSignal =
                        fusionMode === "mode17"
                          ? mode17TierFilter === "all_slate"
                            ? Boolean(item.m17?.sig)
                            : matchesMode17Filter(item.g, mode17TierFilter)
                          : item.isQualified;
                      if (dailyCardFilter === "all") {
                        return fusionMode === "mode17" ? matchesMode17Filter(item.g, mode17TierFilter) : true;
                      }
                      if (dailyCardFilter === "qualified") return inActiveSignal;
                      if (dailyCardFilter === "anti_nobet") return fusionMode === "total_elem_12" ? evalSmartMode14(item.g).sig : evalSmartAntiNoBet(item.g).sig;
                      if (dailyCardFilter === "referee6") return fusionMode === "total_elem_12" ? evalSmartMode14(item.g).referee6.active : item.isQualified;
                      if (dailyCardFilter === "ref_top") return fusionMode === "total_elem_12" ? evalSmartMode14(item.g).referee6.isTopSignal : item.isQualified;
                      if (dailyCardFilter === "vip3") return item.isVip3;
                      if (dailyCardFilter === "posev") return item.isPosEv;
                      if (dailyCardFilter === "win") return inActiveSignal && item.cardWon === true;
                      if (dailyCardFilter === "loss") return inActiveSignal && item.cardWon === false;
                      if (dailyCardFilter === "pending") return inActiveSignal && item.cardWon === null;
                      return true;
                    })
                    .sort((a, b) => {
                      if (a.m17 && b.m17) {
                        if (b.m17.tierRank !== a.m17.tierRank) return b.m17.tierRank - a.m17.tierRank;
                        if (b.m17.directElo !== a.m17.directElo) return b.m17.directElo - a.m17.directElo;
                      }
                      if (Number(b.isVip3) !== Number(a.isVip3)) return Number(b.isVip3) - Number(a.isVip3);
                      if (Number(b.isQualified) !== Number(a.isQualified)) return Number(b.isQualified) - Number(a.isQualified);
                      if (Number(b.isPosEv) !== Number(a.isPosEv)) return Number(b.isPosEv) - Number(a.isPosEv);
                      const aUnan = a.ch3.unanimous && Math.abs(a.ch3.avgDelta) >= 2 ? 1 : 0;
                      const bUnan = b.ch3.unanimous && Math.abs(b.ch3.avgDelta) >= 2 ? 1 : 0;
                      if (bUnan !== aUnan) return bUnan - aUnan;
                      if (b.pct !== a.pct) return b.pct - a.pct;
                      if (Math.abs(b.cardIdx.delta) !== Math.abs(a.cardIdx.delta)) {
                        return Math.abs(b.cardIdx.delta) - Math.abs(a.cardIdx.delta);
                      }
                      return a.g.n - b.g.n;
                    })
                    .map((item) => {
                      const {
                        g,
                        m17,
                        ch3,
                        cardIdx,
                        wtpObj,
                        trapWeeklyMismatch,
                        isVipMismatchRescue,
                        hw,
                        aw,
                        tot,
                        pct,
                        nat3Cnt,
                        minD3Val,
                        trapNoNat3,
                        trapEven6,
                        trapBlind100,
                        hasInternalTrap,
                        isBorderlineRescued,
                        maxBuyCents,
                        isUnderdogCaution,
                        isVip3,
                        isBaseF1,
                        isNaturalPool,
                        isFilteredOutByWeekly,
                        isFilteredOutByTrap,
                        isFilteredOutByIdx,
                        isIdxRescueOnly,
                        isQualified,
                        manualOverridden,
                        isNhlSysMode,
                        homeFav,
                        predTeam,
                        predRole,
                        kalshiTicker,
                        liveAsk,
                        evEdge,
                        isPosEv,
                        hasFinalScore,
                        cardWon,
                        scoreDisplay,
                      } = item;

                      const modeBadgeText = manualOverridden
                        ? "فیلتر دستی فعال"
                        : dailyCardMode === "nhl_vip3"
                          ? "ویژه FIRE / VIP"
                          : dailyCardMode === "nhl_best"
                            ? "نهایی + ضریب Log5"
                            : dailyCardMode === "nhl_f1_guard"
                              ? "بدون جدول ۷۷٫۴٪"
                              : dailyCardMode === "nhl_f1_idx_raw"
                                ? "شاخص پایه ۶۲٫۵٪"
                                : dailyCardMode === "nhl_f1_union"
                                  ? "تلفیق ۱ + نجات"
                                  : dailyCardMode === "nhl_f1"
                                    ? "تلفیق ۱ پایه"
                                    : dailyCardMode === "step"
                                      ? "کانال STEP"
                                      : dailyCardMode === "geo"
                                        ? "کانال GEO-FIN"
                                        : dailyCardMode === "geo_tab"
                                          ? "کانال GEO-TAB"
                                          : "کانال GEO-DYN";

                      const defaultComboList =
                        comboSelectedByDate[activeDailyDate] && comboSelectedByDate[activeDailyDate].length >= 2
                          ? comboSelectedByDate[activeDailyDate]
                          : (() => {
                              const qualNos = [...gamesOnDailyDate]
                                .filter((x) =>
                                  dailyCardMode === "nhl_vip3"
                                    ? activeVip3Of(x)
                                    : dailyCardMode === "nhl_f1_guard"
                                      ? Boolean(x.f1_guard ?? x.f1_idx)
                                      : dailyCardMode === "nhl_f1_idx_raw"
                                        ? Boolean(x.f1_idx)
                                        : dailyCardMode === "nhl_f1_union"
                                          ? activeUnionOf(x)
                                          : dailyCardMode === "nhl_f1"
                                            ? Boolean(x.f1)
                                            : activeF1WtpOf(x)
                                )
                                .map((x) => x.n);
                              if (qualNos.length >= 3) return qualNos.slice(0, 3);
                              if (qualNos.length === 2) return qualNos.slice(0, 2);
                              return gamesOnDailyDate.slice(0, 2).map((x) => x.n);
                            })();

                      const inComboIdx = defaultComboList.indexOf(g.n);
                      const isCardInCombo = inComboIdx >= 0;

                      const toggleThisCardCombo = () => {
                        const cur = [...defaultComboList];
                        const idx = cur.indexOf(g.n);
                        if (idx >= 0) {
                          if (cur.length <= 2) return;
                          cur.splice(idx, 1);
                        } else {
                          if (cur.length >= 4) cur.pop();
                          cur.push(g.n);
                        }
                        setComboSelectedByDate((prev) => ({
                          ...prev,
                          [activeDailyDate]: cur,
                        }));
                      };

                      const cardEnabled = kalshiCardEnabled[g.n] ?? isPosEv;
                      const cardStake =
                        kalshiCardStake[g.n] ?? (isVip3 || isPosEv ? kalshiVipStake : kalshiDefaultStake);
                      const cardLimit = kalshiCardLimit[g.n] ?? liveAsk;
                      const cardContracts = Math.max(
                        1,
                        Math.floor((cardStake * 100) / Math.max(1, cardLimit))
                      );
                      const estCost = ((cardContracts * cardLimit) / 100).toFixed(2);
                      const estNetWin = ((cardContracts * (100 - cardLimit)) / 100).toFixed(2);

                      const showKalshiPanel =
                        isQualified || cardEnabled || Boolean(openManualKalshiCards[g.n]);

                      const showLegacyChannelBoxes = manualOverridden || !isNhlSysMode;
                      const isMode17 = fusionMode === "mode17";
                      const isPureGfFinMode = fusionMode === "gf_fin_pure";
                      const isTriRoutedMode = fusionMode === "tri_gf_routed";
                      const isTriUltraMode = fusionMode === "tri_gf_ultralock";
                      const isAntiNoBetMode = fusionMode === "anti_nobet_smart";
                      const isTotalElem12Mode = fusionMode === "total_elem_12";
                      const isTriUltraFamily = isTriUltraMode || isAntiNoBetMode || isMode17;
                      const isTriAntiDropMode = isTriRoutedMode || isTriUltraFamily || isTotalElem12Mode;
                      const presetShortMap: Record<FusionModeKey, string> = {
                        mode17: "حالت ۱۷ • تقاطع طلایی (۱۳ ∩ ۱۵)",
                        tri_gf_ultralock: "حالت ۱۲ (ابرقفل ۳ عددی + ضدحذف)",
                        anti_nobet_smart: "حالت ۱۳ (ضد NO-BET هوشمند: مستقیم + عکس)",
                        total_elem_12: "حالت ۱۴ (قطبیت المنت کل بازیکن + تورنمنت)",
                        fusion4_elem: "حالت ۱۵ (تلفیق ۴ پترن المنت)",
                        referee6_ranked: "حالت ۱۶ (داور وزنی ۶ باکس)",
                        tri_gf_routed: "حالت ۱۱ (۳ عددی مستقل + ضدحذف)",
                        gf_fin_pure: "حالت ۱۰ (موتور خالص GF-FIN)",
                        pos_inv_lock: "حالت ۹ (قفل جامع v5)",
                        earth_neg_lock: "حالت ۷ (قفل ایمن منفی)",
                        safe_dl_core: "حالت ۸ (قفل دوگانه مستقل)",
                        double_pwr_lock: "حالت ۶ (قفل ۱xxx+Σ8)",
                        geo_1xxx_lock: "حالت ۵ (فیلتر رمل ۱xxx)",
                        dual_pillar: "حالت ۱ (تلفیق دو-ستونی)",
                        vip_cross: "حالت ۲ (شکارچی VIP)",
                        astro_lock: "حالت ۳ (قفل نجومی)",
                        diamond: "حالت ۴ (قفل الماس T∩P)",
                      };
                      const activePresetLabel = presetShortMap[fusionMode] || "موتور تلفیقی";
                      const activeRouteCardObj = isTotalElem12Mode
                        ? g.fusion_meta?.total_elem_12
                        : isTriRoutedMode
                          ? g.fusion_meta?.geo1xxx?.m11_route
                          : isTriUltraFamily
                            ? g.fusion_meta?.geo1xxx?.m12_route
                            : undefined;
                      const posInvTriggeredCard = Boolean(
                        (fusionMode === "pos_inv_lock" && g.fusion_meta?.geo1xxx?.pos_inv?.triggered) ||
                          (isTriAntiDropMode && activeRouteCardObj?.flipped)
                      );
                      const fmtHeroSigned = (v: number) => {
                        const r = Math.round(Number(v || 0) * 10) / 10;
                        return r > 0 ? `+${r.toFixed(1)}` : r === 0 ? "0.0" : r.toFixed(1);
                      };
                      const heroG1 = g.fusion_meta?.geo1xxx;
                      const heroPick1xxx = heroG1 ? (homeFav ? heroG1.h_sum : heroG1.a_sum) : 0;
                      const heroPickCnt = heroG1 ? (homeFav ? heroG1.h_cnt : heroG1.a_cnt) : 0;
                      const heroPickAll8 = heroG1 ? (homeFav ? heroG1.h_all : heroG1.a_all) : 0;
                      const heroHGf = typeof heroG1?.h_gf === "number" ? heroG1.h_gf : 0;
                      const heroAGf = typeof heroG1?.a_gf === "number" ? heroG1.a_gf : 0;
                      const heroPickGf = homeFav ? heroHGf : heroAGf;
                      const heroGfMargin = Math.round(Math.abs(heroHGf - heroAGf) * 10) / 10;
                      const rawGap3H =
                        typeof heroG1?.gap3_h === "number"
                          ? heroG1.gap3_h
                          : heroG1
                            ? Math.round(((heroG1.a_sum - heroG1.h_sum) + (heroG1.a_all - heroG1.h_all) + 1.5 * (heroAGf - heroHGf)) * 10) / 10
                            : 0;
                      const heroPickGap3 = Math.round((homeFav ? rawGap3H : -rawGap3H) * 10) / 10;
                      const heroEngineObj =
                        g.fusion_meta?.driver === "PLAYER"
                          ? g.fusion_meta?.player
                          : g.fusion_meta?.team;

                      const cardBorderCls =
                        isVip3 && isQualified && !isVipMismatchRescue
                          ? "border-2 border-amber-400 ring-2 ring-amber-200/80 bg-white shadow-md"
                          : isQualified && posInvTriggeredCard
                            ? "border-2 border-indigo-500 ring-2 ring-indigo-200/80 bg-white shadow-md"
                            : isQualified
                              ? "border-2 border-emerald-400 ring-1 ring-emerald-200 bg-white shadow-sm"
                              : showLegacyChannelBoxes && (isFilteredOutByWeekly || isFilteredOutByTrap || isFilteredOutByIdx)
                                ? "border border-amber-300 bg-slate-50/95"
                                : "border border-slate-200 bg-slate-50/85";

                      const ribbonCls =
                        isVip3 && isQualified && !isVipMismatchRescue
                          ? "bg-gradient-to-r from-amber-600 via-emerald-700 to-teal-700 text-white"
                          : isQualified && posInvTriggeredCard
                            ? "bg-gradient-to-r from-indigo-700 via-sky-700 to-emerald-700 text-white"
                            : isQualified
                              ? "bg-emerald-700 text-white"
                              : showLegacyChannelBoxes && isIdxRescueOnly
                                ? "bg-sky-100 text-sky-900 border-b border-sky-200"
                                : showLegacyChannelBoxes && (isFilteredOutByWeekly || isFilteredOutByTrap || isFilteredOutByIdx)
                                  ? "bg-amber-100/80 text-amber-950 border-b border-amber-200"
                                  : "bg-slate-100 text-slate-600 border-b border-slate-200";

                      const trapReasonShort = g.trap_tag || "تله درونی/B2B";

                      const ribbonTitle = !showLegacyChannelBoxes
                        ? isPureGfFinMode
                          ? isQualified
                            ? `✓ سیگنال خالص GF-FIN • برنده کمتر/منفی‌تر (ΔGF=${heroGfMargin})`
                            : "تساوی کامل GF-FIN (=)"
                          : isQualified && posInvTriggeredCard
                            ? `🔄 سیگنال فعال ${activePresetLabel} • ${isTriAntiDropMode ? "معکوس تله ضدحذف" : "معکوس دو-مثبت"} (${wtpObj.l5Pick}%)`
                            : isQualified && isVip3
                              ? `⭐ سیگنال VIP ${activePresetLabel} (${wtpObj.matchElem} ${wtpObj.l5Pick}% • ≤${maxBuyCents}¢)`
                              : isQualified
                                ? `✓ سیگنال فعال ${activePresetLabel} (${wtpObj.matchElem} ${wtpObj.l5Pick}% • ≤${maxBuyCents}¢)`
                                : isTriAntiDropMode
                                  ? `🧭 مسیر برنده بدون حذف (${predTeam === g.h ? g.hc : g.ac}) • ${activePresetLabel}`
                                  : `خارج از سیگنال • ${activePresetLabel}`
                        : isVipMismatchRescue
                          ? "نجات VIP جدول (≤۵۲¢)"
                          : isQualified && wtpObj.matchElem === "FIRE"
                            ? `تایید ویژه عنصر آتش FIRE (${wtpObj.l5Pick}% • ≤۷۶¢)`
                            : isVip3 && isQualified
                              ? "VIP طلایی ۳ کاناله + جدول (≤۷۶¢)"
                              : isQualified && manualOverridden
                                ? "تایید فیلتر دستی (≤۷۳¢)"
                                : isQualified && wtpObj.matchElem === "WATER"
                                  ? `تایید عنصر آب WATER (${wtpObj.l5Pick}% • ≤۶۸¢)`
                                  : isBorderlineRescued
                                    ? "عبور مرزی + جدول (≤۶۹¢)"
                                    : isQualified && isIdxRescueOnly
                                      ? "تایید نجات ۳ کاناله (اجماع ۳/۳)"
                                      : isQualified
                                        ? `تایید عنصر هوا AIR (${wtpObj.l5Pick}% • ≤۷۲¢)`
                                        : isFilteredOutByWeekly && !manualOverridden
                                          ? `اخراج عنصر خاک EARTH (Log5 ${wtpObj.l5Pick}%)`
                                          : isFilteredOutByTrap && !manualOverridden
                                            ? `فیلتر تله درونی: ${trapReasonShort}`
                                            : isIdxRescueOnly && !manualOverridden
                                              ? "کاندید نجات شاخص ۳ کاناله"
                                              : isFilteredOutByIdx && !manualOverridden
                                                ? "حذف توسط شاخص عددی جدید"
                                                : "خارج از سیگنال سیستم جدید";

                      const twinRuleOk =
                        isNhlSysMode && !manualOverridden
                          ? isQualified && (isBaseF1 || isIdxRescueOnly)
                          : isNaturalPool && tot >= 5 && tot <= 7 && pct >= 71 && Math.abs(hw - aw) >= 3 && !g.a1_veto;
                      const idxFavOk = isQualified
                        ? true
                        : (homeFav ? cardIdx.delta > 0 : cardIdx.delta < 0) && (!hasInternalTrap || minD3Val >= 2);

                      // Compute clean unified metrics for 2-Box Ticked Card + Game Result Footer + Collapsible Details
                      const fm = g.fusion_meta;
                      const tm = fm?.team ?? { pick: "", votes: "", pct: "", f30: 0, ch: "", sig: false, vip: false };
                      const pm = fm?.player ?? { pick: "", votes: "", pct: "", f30: 0, ch: "", sig: false, vip: false };
                      const dpMode = fm?.modes?.dual_pillar;
                      const hpList = g.h_players ?? [];
                      const apList = g.a_players ?? [];
                      const outCnt = (g.h_out?.length ?? 0) + (g.a_out?.length ?? 0);
                      const isLineupOpen = isCardBoxOpen(g.n, "lineup");
                      const isBox1Open = isCardBoxOpen(g.n, "box1");
                      const isSmartBoxOpen = isCardBoxOpen(g.n, "smart");
                      const isBox2Open = isCardBoxOpen(g.n, "box2");
                      const isDomBoxOpen = isCardBoxOpen(g.n, "dom");
                      const isElemBoxOpen = isCardBoxOpen(g.n, "elem");
                      const isFusion4BoxOpen = isCardBoxOpen(g.n, "fusion4");
                      const isReferee6BoxOpen = isCardBoxOpen(g.n, "referee6");
                      const isSixBoxesOpen = isCardBoxOpen(g.n, "sixboxes");

                      const calcGeoFin = (efStr: string, gf?: string) => {
                        if (gf && gf.length === 4) return gf;
                        const parts = String(efStr || "0-0-0-0").split("-");
                        return parts
                          .slice(0, 4)
                          .map((x) => (Math.abs(parseInt(x, 10) || 0) % 2 === 1 ? "1" : "0"))
                          .join("");
                      };
                      const calcPlayerGfFin = (efStr: string, gf?: string, preVal?: number) => {
                        if (typeof preVal === "number" && !Number.isNaN(preVal)) return preVal;
                        const code = calcGeoFin(efStr, gf);
                        const parts = String(efStr || "0-0-0-0")
                          .split("-")
                          .slice(0, 4)
                          .map((x) => parseInt(x, 10) || 0);
                        while (parts.length < 4) parts.push(0);
                        const wts = [8, 4, 2, 1];
                        let acc = 0;
                        for (let i = 0; i < 4; i++) {
                          const b = code[i] === "1" ? 1 : 0;
                          acc += wts[i] * (2 * b - 1) * parts[i];
                        }
                        return Math.round(acc) / 10;
                      };
                      const fallbackSum1 = (arr: typeof hpList) => {
                        let s = 0, c = 0, s0 = 0, c0 = 0, s11 = 0, c11 = 0, all = 0, gfAcc = 0;
                        for (const p of arr) {
                          const code = calcGeoFin(p.ef, p.gf);
                          const pw = Number(p.pwr || 0);
                          all += pw;
                          gfAcc += calcPlayerGfFin(p.ef, p.gf, p.gf_fin);
                          if (code.startsWith("1")) {
                            s += pw;
                            c += 1;
                          } else {
                            s0 += pw;
                            c0 += 1;
                            if (code === "0011") {
                              s11 += pw;
                              c11 += 1;
                            }
                          }
                        }
                        return {
                          sum1: Math.round(s * 10) / 10,
                          cnt1: c,
                          sum0: Math.round(s0 * 10) / 10,
                          cnt0: c0,
                          sum0011: Math.round(s11 * 10) / 10,
                          cnt0011: c11,
                          sumAll: Math.round(all * 10) / 10,
                          sumGf: Math.round(gfAcc * 10) / 10,
                        };
                      };
                      const fbH = fallbackSum1(hpList);
                      const fbA = fallbackSum1(apList);
                      const g1 = fm?.geo1xxx ?? {
                        h_sum: fbH.sum1,
                        a_sum: fbA.sum1,
                        h_cnt: fbH.cnt1,
                        a_cnt: fbA.cnt1,
                        h_0xxx: fbH.sum0,
                        a_0xxx: fbA.sum0,
                        h_0cnt: fbH.cnt0,
                        a_0cnt: fbA.cnt0,
                        h_0011: fbH.sum0011,
                        a_0011: fbA.sum0011,
                        h_0011_cnt: fbH.cnt0011,
                        a_0011_cnt: fbA.cnt0011,
                        h_all: fbH.sumAll,
                        a_all: fbA.sumAll,
                        h_gf: fbH.sumGf,
                        a_gf: fbA.sumGf,
                        diff: Math.round((fbH.sum1 - fbA.sum1) * 10) / 10,
                        win: fbH.sum1 < fbA.sum1 ? g.h : fbA.sum1 < fbH.sum1 ? g.a : "",
                        all_win: fbH.sumAll < fbA.sumAll ? g.h : fbA.sumAll < fbH.sumAll ? g.a : "",
                      };
                      const fmtSigned = (v: number) => {
                        const r = Math.round(Number(v || 0) * 10) / 10;
                        return r > 0 ? `+${r.toFixed(1)}` : r === 0 ? "0.0" : r.toFixed(1);
                      };
                      const shortCode = (tName: string) => (tName === g.h ? g.hc : tName === g.a ? g.ac : tName);

                      const h0Val = typeof g1.h_0xxx === "number" ? g1.h_0xxx : fbH.sum0;
                      const a0Val = typeof g1.a_0xxx === "number" ? g1.a_0xxx : fbA.sum0;
                      const h0Cnt = typeof g1.h_0cnt === "number" ? g1.h_0cnt : fbH.cnt0;
                      const a0Cnt = typeof g1.a_0cnt === "number" ? g1.a_0cnt : fbA.cnt0;
                      const h0011Val = typeof g1.h_0011 === "number" ? g1.h_0011 : fbH.sum0011;
                      const a0011Val = typeof g1.a_0011 === "number" ? g1.a_0011 : fbA.sum0011;
                      const h0011Cnt = typeof g1.h_0011_cnt === "number" ? g1.h_0011_cnt : fbH.cnt0011;
                      const a0011Cnt = typeof g1.a_0011_cnt === "number" ? g1.a_0011_cnt : fbA.cnt0011;
                      const cold0Win =
                        g1.cold0_win !== undefined
                          ? g1.cold0_win
                          : h0Val < a0Val
                            ? g.h
                            : a0Val < h0Val
                              ? g.a
                              : "";
                      const coldTamePi = Boolean(g1.cold_tame_pi);
                      const coldTameWin = g1.cold_tame_win ?? "";
                      const hGfVal = typeof g1.h_gf === "number" ? g1.h_gf : fbH.sumGf;
                      const aGfVal = typeof g1.a_gf === "number" ? g1.a_gf : fbA.sumGf;
                      const hS3Val =
                        typeof g1.h_s3 === "number"
                          ? g1.h_s3
                          : Math.round((g1.h_sum + g1.h_all + hGfVal) * 10) / 10;
                      const aS3Val =
                        typeof g1.a_s3 === "number"
                          ? g1.a_s3
                          : Math.round((g1.a_sum + g1.a_all + aGfVal) * 10) / 10;
                      const s3Win =
                        g1.s3_win !== undefined
                          ? g1.s3_win
                          : hS3Val < aS3Val
                            ? g.h
                            : aS3Val < hS3Val
                              ? g.a
                              : "";
                      const isS3SignSplit = Boolean((hS3Val < 0 && aS3Val > 0) || (aS3Val < 0 && hS3Val > 0));
                      const gfWin =
                        g1.gf_win !== undefined
                          ? g1.gf_win
                          : hGfVal < aGfVal
                            ? g.h
                            : aGfVal < hGfVal
                              ? g.a
                              : "";
                      const gfAbsDiff = Math.round(Math.abs(hGfVal - aGfVal) * 10) / 10;
                      const all8Win =
                        g1.all_win !== undefined
                          ? g1.all_win
                          : g1.h_all < g1.a_all
                            ? g.h
                            : g1.a_all < g1.h_all
                              ? g.a
                              : "";
                      const dlWin = g1.dl_win !== undefined ? g1.dl_win : g1.win && g1.win === all8Win ? g1.win : "";
                      const votes3 = [g1.win, all8Win, gfWin].filter(Boolean);
                      const hV3 = votes3.filter((w) => w === g.h).length;
                      const aV3 = votes3.filter((w) => w === g.a).length;
                      const maj23Win = g1.maj23_win ?? (hV3 >= 2 ? g.h : aV3 >= 2 ? g.a : "");
                      const triple3Win = g1.triple3_win ?? (hV3 === 3 ? g.h : aV3 === 3 ? g.a : "");

                      const wtpAct: any = oddsFreqMode === "daily" ? (g.wtp_day ?? g.wtp ?? {}) : (g.wtp ?? {});
                      const wtpWk: any = g.wtp ?? {};
                      const wtpDy: any = g.wtp_day ?? wtpWk;
                      const hEl = String(wtpAct.hel || wtpWk.hel || "AIR");
                      const aEl = String(wtpAct.ael || wtpWk.ael || "AIR");
                      const hL5 = Math.round(Number(wtpAct.l5h ?? 50) * 10) / 10;
                      const aL5 = Math.round((100 - Number(wtpAct.l5h ?? 50)) * 10) / 10;

                      const evalTarget = predTeam || dlWin || g.sys_win;
                      const isTargetHome = evalTarget === g.h;
                      const pickElWk = String(isTargetHome ? wtpWk.hel ?? "" : wtpWk.ael ?? "");
                      const pickElDy = String(isTargetHome ? wtpDy.hel ?? "" : wtpDy.ael ?? "");
                      const oppElWk = String(isTargetHome ? wtpWk.ael ?? "" : wtpWk.hel ?? "");
                      const oppElDy = String(isTargetHome ? wtpDy.ael ?? "" : wtpDy.hel ?? "");
                      const tS1 = isTargetHome ? g1.h_sum : g1.a_sum;
                      const oS1 = isTargetHome ? g1.a_sum : g1.h_sum;
                      const tS8 = isTargetHome ? g1.h_all : g1.a_all;
                      const oS8 = isTargetHome ? g1.a_all : g1.h_all;
                      const pickD1 = Math.round((oS1 - tS1) * 10) / 10;
                      const pickD8 = Math.round((oS8 - tS8) * 10) / 10;
                      const pickEarthOk = !((pickElWk === "EARTH" && oppElWk !== "EARTH") || (pickElDy === "EARTH" && oppElDy !== "EARTH"));
                      const pickHasNeg = (tS1 <= 0 || tS8 < 0) || (pickD1 >= 4.0 && pickD8 >= 3.0);
                      const pickMarginOk = pickD8 >= 1.2 || (pickD1 >= 3.5 && pickD8 >= 0.5) || (pickElWk === "FIRE" && pickD8 >= 0.4);
                      const pickNegOk = pickHasNeg && pickMarginOk;
                      const hasRawDl = Boolean(dlWin);
                      const isSafeDl = Boolean(hasRawDl && (g1.guards ? g1.guards.safe_ok : pickEarthOk && pickNegOk));
                      const isGfRescued = Boolean(g1.gf_rescued && isQualified && !hasRawDl);

                      // Build Box 1 Ticked Checklist Rows strictly for the active Fusion Mode
                      type CheckTick = "pass" | "trap" | "none";
                      type CheckRow = {
                        key: string;
                        testId: string;
                        stepTitle: string;
                        stepSub?: string;
                        hText: string;
                        hSub?: string;
                        hTick: CheckTick;
                        aText: string;
                        aSub?: string;
                        aTick: CheckTick;
                      };

                      let warmWin = g1.win || "";
                      let warmSub = "";
                      if (isTriAntiDropMode && coldTamePi && coldTameWin) {
                        warmWin = coldTameWin;
                        warmSub = "مهار (+,+) با ۰xxx";
                      } else if ((fusionMode === "pos_inv_lock" || isTriAntiDropMode) && g1.pos_inv?.triggered && g1.pos_inv?.win) {
                        warmWin = g1.pos_inv.win;
                        warmSub = "معکوس دو-مثبت (+,+)";
                      } else if (isTriAntiDropMode && ((g1.h_cnt === 0) !== (g1.a_cnt === 0))) {
                        warmWin = g1.h_cnt === 0 ? g.a : g.h;
                        warmSub = "قانون حبس 1xxx=0";
                      } else if (g1.pos_inv?.both_pos) {
                        warmSub = "دو-مثبت متعادل (+,+)";
                      }

                      const rowWarm1xxx: CheckRow = {
                        key: "warm1",
                        testId: `row-geo1xxx-${g.n}`,
                        stepTitle: "قطب گرم Σ(1xxx)",
                        stepSub: warmSub || undefined,
                        hText: `${fmtSigned(g1.h_sum)} (${g1.h_cnt})`,
                        hSub: g1.h_cnt === 0 ? "حبس ۰xxx" : undefined,
                        hTick: g1.h_cnt === 0 ? "trap" : warmWin === g.h ? "pass" : "none",
                        aText: `${fmtSigned(g1.a_sum)} (${g1.a_cnt})`,
                        aSub: g1.a_cnt === 0 ? "حبس ۰xxx" : undefined,
                        aTick: g1.a_cnt === 0 ? "trap" : warmWin === g.a ? "pass" : "none",
                      };

                      const rowAll8: CheckRow = {
                        key: "all8",
                        testId: `row-geoall8-${g.n}`,
                        stepTitle: "مجموع ۶ بُعد فردی Σ(All)",
                        hText: fmtSigned(g1.h_all),
                        hTick: all8Win === g.h ? "pass" : "none",
                        aText: fmtSigned(g1.a_all),
                        aTick: all8Win === g.a ? "pass" : "none",
                      };

                      const rowGfAndS3: CheckRow = {
                        key: "gfs3",
                        testId: `row-gffin-${g.n}`,
                        stepTitle: isPureGfFinMode ? "شاخص خالص Σ(GF-FIN)" : isTriAntiDropMode ? "داور GF-FIN و Σ(3)" : "شاخص داور GF-FIN",
                        stepSub: !isPureGfFinMode
                          ? triple3Win
                            ? `اجماع ۳/۳ (${shortCode(triple3Win)})`
                            : maj23Win
                              ? `اکثریت ۲/۳ (${shortCode(maj23Win)})`
                              : isS3SignSplit
                                ? "شکاف علامت Σ3"
                                : undefined
                          : undefined,
                        hText: isTriAntiDropMode ? `GF:${fmtSigned(hGfVal)}` : fmtSigned(hGfVal),
                        hSub: isTriAntiDropMode ? `Σ3:${fmtSigned(hS3Val)}${s3Win === g.h ? " ✓" : ""}` : undefined,
                        hTick: gfWin === g.h ? "pass" : "none",
                        aText: isTriAntiDropMode ? `GF:${fmtSigned(aGfVal)}` : fmtSigned(aGfVal),
                        aSub: isTriAntiDropMode ? `Σ3:${fmtSigned(aS3Val)}${s3Win === g.a ? " ✓" : ""}` : undefined,
                        aTick: gfWin === g.a ? "pass" : "none",
                      };

                      const rowCold0: CheckRow = {
                        key: "cold0",
                        testId: `row-geocold0-${g.n}`,
                        stepTitle: "قطب سرد Σ(0xxx)",
                        stepSub: isMode17 || h0011Cnt > 0 || a0011Cnt > 0 ? "همراه کد سرد 0011" : undefined,
                        hText: `${fmtSigned(h0Val)} (${h0Cnt})`,
                        hSub: isMode17 || h0011Cnt > 0 ? `0011:${fmtSigned(h0011Val)}` : undefined,
                        hTick: cold0Win === g.h ? "pass" : "none",
                        aText: `${fmtSigned(a0Val)} (${a0Cnt})`,
                        aSub: isMode17 || a0011Cnt > 0 ? `0011:${fmtSigned(a0011Val)}` : undefined,
                        aTick: cold0Win === g.a ? "pass" : "none",
                      };

                      const twinActiveWinner = dpMode?.sig
                        ? dpMode.pick
                        : tm.vip && !pm.sig
                          ? tm.pick
                          : pm.vip && !tm.sig
                            ? pm.pick
                            : "";
                      const rowTwinCombined: CheckRow = {
                        key: "twin",
                        testId: `row-twin-${g.n}`,
                        stepTitle: "موتور تلفیقی همزاد (T × P)",
                        stepSub: dpMode?.sig ? "تایید دو-ستونی" : twinActiveWinner ? "تایید VIP تک‌موتور" : "بدون سیگنال همزاد",
                        hText: twinActiveWinner === g.h ? (dpMode?.sig ? "تایید T+P" : "VIP تک‌موتور") : "—",
                        hSub: `${tm.pick === g.h ? "T✓" : "T—"} • ${pm.pick === g.h ? "P✓" : "P—"}`,
                        hTick: twinActiveWinner === g.h ? "pass" : "none",
                        aText: twinActiveWinner === g.a ? (dpMode?.sig ? "تایید T+P" : "VIP تک‌موتور") : "—",
                        aSub: `${tm.pick === g.a ? "T✓" : "T—"} • ${pm.pick === g.a ? "P✓" : "P—"}`,
                        aTick: twinActiveWinner === g.a ? "pass" : "none",
                      };

                      const hDirectElo = Math.round(Number(wtpAct.hpct ?? wtpWk.hpct ?? 50) * 10) / 10;
                      const aDirectElo = Math.round(Number(wtpAct.apct ?? wtpWk.apct ?? 50) * 10) / 10;
                      const stMeta = g.st_meta;
                      const profKeyRow: PowerProfileKey =
                        ((wtpAct as any)?.profileKey as PowerProfileKey) || powerProfile || "c_vol";
                      const hTrapFlag = Boolean((wtpAct as any)?.htrap);
                      const aTrapFlag = Boolean((wtpAct as any)?.atrap);
                      const hRkTxt = stMeta?.h_rk && stMeta.h_rk < 900 ? `#${stMeta.h_rk}` : "";
                      const aRkTxt = stMeta?.a_rk && stMeta.a_rk < 900 ? `#${stMeta.a_rk}` : "";
                      const hL10Short = stMeta?.h_l10 ? stMeta.h_l10.split(" ")[0] : "";
                      const aL10Short = stMeta?.a_l10 ? stMeta.a_l10.split(" ")[0] : "";
                      const hStandingsSub = stMeta
                        ? `فصل ${stMeta.h_wl}${hRkTxt ? ` (${hRkTxt})` : ""} • L10:${hL10Short}`
                        : "";
                      const aStandingsSub = stMeta
                        ? `فصل ${stMeta.a_wl}${aRkTxt ? ` (${aRkTxt})` : ""} • L10:${aL10Short}`
                        : "";
                      const rowStandingsTitle =
                        profKeyRow === "c_vol"
                          ? "جدول فصل و قدرت زمین (هیبرید + Pyth)"
                          : profKeyRow === "b_pure"
                            ? "جدول خالص فصل (NBA-Style Pyth)"
                            : "قدرت پایه کلاسیک (8y Elo + جدول فصل)";
                      const rowStandings: CheckRow = {
                        key: "standings",
                        testId: `row-standings-${g.n}`,
                        stepTitle: rowStandingsTitle,
                        stepSub:
                          hEl === "EARTH" && aEl === "EARTH"
                            ? "تله دو EARTH"
                            : (hTrapFlag || aTrapFlag) && profKeyRow === "c_vol"
                              ? "هشدار واگرایی شهرت/فرم فصل"
                              : stMeta?.n_act
                                ? `جدول زنده (${stMeta.n_act} بازیکن فعال)`
                                : isMode17
                                  ? "Direct Surface Power %"
                                  : undefined,
                        hText: `${hEl === "EARTH" ? "تله EARTH" : hEl}${hRkTxt ? ` ${hRkTxt}` : ""}${hTrapFlag && profKeyRow === "c_vol" ? " ⚠️" : ""}`,
                        hSub: `${hDirectElo}% (L5:${hL5}%)${hStandingsSub ? ` • ${hStandingsSub}` : ""}`,
                        hTick: hEl === "EARTH" || (hTrapFlag && profKeyRow === "c_vol") ? "trap" : "pass",
                        aText: `${aEl === "EARTH" ? "تله EARTH" : aEl}${aRkTxt ? ` ${aRkTxt}` : ""}${aTrapFlag && profKeyRow === "c_vol" ? " ⚠️" : ""}`,
                        aSub: `${aDirectElo}% (L5:${aL5}%)${aStandingsSub ? ` • ${aStandingsSub}` : ""}`,
                        aTick: aEl === "EARTH" || (aTrapFlag && profKeyRow === "c_vol") ? "trap" : "pass",
                      };

                      const rowTeamOnly: CheckRow = {
                        key: "team_eng",
                        testId: `row-team-eng-${g.n}`,
                        stepTitle: "زاویه مکان و تورنمنت (شهر / تورنمنت • T)",
                        hText: tm.pick === g.h ? `${tm.pct} (${tm.votes})` : "—",
                        hSub: tm.pick === g.h ? `F30:${tm.f30 >= 0 ? `+${tm.f30}` : tm.f30}` : undefined,
                        hTick: tm.pick === g.h && tm.sig ? "pass" : "none",
                        aText: tm.pick === g.a ? `${tm.pct} (${tm.votes})` : "—",
                        aSub: tm.pick === g.a ? `F30:${tm.f30 >= 0 ? `+${tm.f30}` : tm.f30}` : undefined,
                        aTick: tm.pick === g.a && tm.sig ? "pass" : "none",
                      };

                      const rowPlayerOnly: CheckRow = {
                        key: "player_eng",
                        testId: `row-player-eng-${g.n}`,
                        stepTitle: "زاویه زمین و کد کشور (Surface + IOC • P)",
                        hText: pm.pick === g.h ? `${pm.pct} (${pm.votes})` : "—",
                        hSub: pm.pick === g.h ? `F30:${pm.f30 >= 0 ? `+${pm.f30}` : pm.f30}` : undefined,
                        hTick: pm.pick === g.h && pm.sig ? "pass" : "none",
                        aText: pm.pick === g.a ? `${pm.pct} (${pm.votes})` : "—",
                        aSub: pm.pick === g.a ? `F30:${pm.f30 >= 0 ? `+${pm.f30}` : pm.f30}` : undefined,
                        aTick: pm.pick === g.a && pm.sig ? "pass" : "none",
                      };

                      const t12 = g.fusion_meta?.total_elem_12;
                      const fmtFawe = (arr?: number[]) =>
                        arr && arr.length === 4 ? arr.join("-") : "—";
                      const t12HWarm = Number(t12?.h_w_gff ?? 0);
                      const t12AWarm = Number(t12?.a_w_gff ?? 0);
                      const t12HCold = Number(t12?.h_c_gff ?? 0);
                      const t12ACold = Number(t12?.a_c_gff ?? 0);
                      const t12HDelta = Number(t12?.h_d_gff ?? 0);
                      const t12ADelta = Number(t12?.a_d_gff ?? 0);
                      const t12HSum13 = Number(t12?.h_s_gff ?? 0);
                      const t12ASum13 = Number(t12?.a_s_gff ?? 0);
                      const t12HCnt1 = Number(t12?.h_cnt1 ?? 0);
                      const t12ACnt1 = Number(t12?.a_cnt1 ?? 0);
                      const t12HCnt0 = Number(t12?.h_cnt0 ?? 0);
                      const t12ACnt0 = Number(t12?.a_cnt0 ?? 0);
                      const t12HCnt0011 = Number(t12?.h_cnt0011 ?? 0);
                      const t12ACnt0011 = Number(t12?.a_cnt0011 ?? 0);
                      const t12WarmWin = t12
                        ? t12HWarm < t12AWarm
                          ? g.h
                          : t12AWarm < t12HWarm
                            ? g.a
                            : ""
                        : "";
                      const t12ColdWin = t12
                        ? t12HCold < t12ACold
                          ? g.h
                          : t12ACold < t12HCold
                            ? g.a
                            : ""
                        : "";
                      const t12DeltaWin = t12
                        ? t12HDelta < t12ADelta
                          ? g.h
                          : t12ADelta < t12HDelta
                            ? g.a
                            : ""
                        : "";
                      const t12GffWin = t12
                        ? t12.h_gff_tot < t12.a_gff_tot
                          ? g.h
                          : t12.a_gff_tot < t12.h_gff_tot
                            ? g.a
                            : ""
                        : "";

                      const rowT12Warm: CheckRow = {
                        key: "t12_warm",
                        testId: `row-t12-warm-${g.n}`,
                        stepTitle: "قطب گرم Σ(1xxx) المنت کل",
                        stepSub: "جمع GF-FIN شکل‌های ۱xxx بردار کل",
                        hText: t12 ? fmtSigned(t12HWarm) : "—",
                        hSub: t12 ? `${t12HCnt1}/13 • Pwr:${fmtSigned(Number(t12.h_w_pwr ?? 0))}` : undefined,
                        hTick: t12WarmWin === g.h ? "pass" : "none",
                        aText: t12 ? fmtSigned(t12AWarm) : "—",
                        aSub: t12 ? `${t12ACnt1}/13 • Pwr:${fmtSigned(Number(t12.a_w_pwr ?? 0))}` : undefined,
                        aTick: t12WarmWin === g.a ? "pass" : "none",
                      };

                      const rowT12Cold: CheckRow = {
                        key: "t12_cold",
                        testId: `row-t12-cold-${g.n}`,
                        stepTitle: "قطب سرد Σ(0xxx) المنت کل",
                        stepSub: "جمع GF-FIN شکل‌های ۰xxx بردار کل",
                        hText: t12 ? fmtSigned(t12HCold) : "—",
                        hSub: t12
                          ? `${t12HCnt0}/13${t12HCnt0011 > 0 ? ` • 0011:${t12HCnt0011}` : ""} • Pwr:${fmtSigned(Number(t12.h_c_pwr ?? 0))}`
                          : undefined,
                        hTick: t12ColdWin === g.h ? "pass" : "none",
                        aText: t12 ? fmtSigned(t12ACold) : "—",
                        aSub: t12
                          ? `${t12ACnt0}/13${t12ACnt0011 > 0 ? ` • 0011:${t12ACnt0011}` : ""} • Pwr:${fmtSigned(Number(t12.a_c_pwr ?? 0))}`
                          : undefined,
                        aTick: t12ColdWin === g.a ? "pass" : "none",
                      };

                      const rowT12Delta: CheckRow = {
                        key: "t12_delta",
                        testId: `row-t12-delta-${g.n}`,
                        stepTitle: "تفاضل دو قطب Δ(1xxx−0xxx)",
                        stepSub:
                          t12WarmWin && t12ColdWin
                            ? t12WarmWin === t12ColdWin
                              ? "قطبیت کامل هم‌جهت"
                              : "تضاد قطب گرم و سرد"
                            : "شاخص قطبیت دوقطبی",
                        hText: t12 ? fmtSigned(t12HDelta) : "—",
                        hSub: t12 ? `ΔPwr:${fmtSigned(Number(t12.h_d_pwr ?? 0))}` : undefined,
                        hTick: t12DeltaWin === g.h ? "pass" : "none",
                        aText: t12 ? fmtSigned(t12ADelta) : "—",
                        aSub: t12 ? `ΔPwr:${fmtSigned(Number(t12.a_d_pwr ?? 0))}` : undefined,
                        aTick: t12DeltaWin === g.a ? "pass" : "none",
                      };

                      const rowT12Sum: CheckRow = {
                        key: "t12_sum",
                        testId: `row-t12-sum-${g.n}`,
                        stepTitle: "جمع المنت کل (بازیکن + تورنمنت/کورت)",
                        stepSub: "GF-FIN بردار کل + Σ",
                        hText: t12 ? fmtSigned(t12.h_gff_tot) : "—",
                        hSub: t12 ? `${t12.h_gf_tot} • Σ13:${fmtSigned(t12HSum13)}` : undefined,
                        hTick: t12GffWin === g.h ? "pass" : "none",
                        aText: t12 ? fmtSigned(t12.a_gff_tot) : "—",
                        aSub: t12 ? `${t12.a_gf_tot} • Σ13:${fmtSigned(t12ASum13)}` : undefined,
                        aTick: t12GffWin === g.a ? "pass" : "none",
                      };

                      const sm14 = evalSmartMode14(g);
                      const rowT12DomElem: CheckRow = {
                        key: "t12_dom_elem",
                        testId: `row-t12-dom-${g.n}`,
                        stepTitle: "المنت غالب مجموع المنت‌ها",
                        stepSub: sm14.dualWaterTrap
                          ? "تله دوقلوی آب (۲×WATER)"
                          : "بیشترین عنصر [F-A-W-E] و برتری ۳/۴",
                        hText: sm14.dualWaterTrap
                          ? `تله WATER (${sm14.hDomInfo.maxCnt})`
                          : `${sm14.hDomInfo.dom} (${sm14.hDomInfo.maxCnt})${sm14.hLeadCnt === 3 ? " ★3/4" : ""}`,
                        hSub: `[${sm14.hDomInfo.vecStr}] • ${sm14.hLeadCnt}/4`,
                        hTick: sm14.dualWaterTrap
                          ? "trap"
                          : sm14.hLeadCnt === 3 || (sm14.domSplit && (sm14.hDomInfo.dom === "WATER" || sm14.hDomInfo.dom === "AIR"))
                            ? "pass"
                            : "none",
                        aText: sm14.dualWaterTrap
                          ? `تله WATER (${sm14.aDomInfo.maxCnt})`
                          : `${sm14.aDomInfo.dom} (${sm14.aDomInfo.maxCnt})${sm14.aLeadCnt === 3 ? " ★3/4" : ""}`,
                        aSub: `[${sm14.aDomInfo.vecStr}] • ${sm14.aLeadCnt}/4`,
                        aTick: sm14.dualWaterTrap
                          ? "trap"
                          : sm14.aLeadCnt === 3 || (sm14.domSplit && (sm14.aDomInfo.dom === "WATER" || sm14.aDomInfo.dom === "AIR"))
                            ? "pass"
                            : "none",
                      };

                      const checklistRows: CheckRow[] = isPureGfFinMode
                        ? [rowGfAndS3]
                        : isTotalElem12Mode
                          ? [rowT12Warm, rowT12Cold, rowT12Delta, rowT12Sum, rowT12DomElem]
                          : isTriUltraFamily
                            ? [rowWarm1xxx, rowAll8, rowGfAndS3, rowCold0, rowTwinCombined, rowStandings]
                            : isTriRoutedMode
                              ? [rowWarm1xxx, rowAll8, rowGfAndS3, rowCold0, rowStandings]
                              : fusionMode === "earth_neg_lock" || fusionMode === "safe_dl_core" || fusionMode === "pos_inv_lock"
                                ? [rowWarm1xxx, rowAll8, rowGfAndS3, rowTwinCombined, rowStandings]
                                : fusionMode === "double_pwr_lock"
                                  ? [rowWarm1xxx, rowAll8, rowTwinCombined]
                                  : fusionMode === "geo_1xxx_lock"
                                    ? [rowWarm1xxx, rowTwinCombined]
                                    : [rowTeamOnly, rowPlayerOnly, rowStandings];

                      const homeTicks = checklistRows.filter((r) => r.hTick === "pass").length;
                      const awayTicks = checklistRows.filter((r) => r.aTick === "pass").length;

                      // Smart Mode 14 Error-Filter, Dominant Element & Opposite-Team Box (v74 - Zero wtp EARTH)
                      const showSmartM14Box = isTotalElem12Mode;
                      const hIsSm14Base = sm14.baseM14Pick === g.h;
                      const aIsSm14Base = sm14.baseM14Pick === g.a;
                      const sm14ShortLock = (sm14.code || "").replace(/^TOT12_/, "").replace("EARTH_FLIP", "POLARITY_FLIP");
                      const sm14Row1Lock: CheckRow = {
                        key: "sm14_lock",
                        testId: `row-sm14-lock-${g.n}`,
                        stepTitle: "سلامت قفل پایه و ۳ تله خطا",
                        stepSub: "رد ۲×WATER، دوقطبی<75% و Warm<0",
                        hText: sm14.m14Sig && hIsSm14Base
                          ? sm14.trapDualWater
                            ? "تله ۲×WATER"
                            : sm14.trapBipolarWeak
                              ? "تله دوقطبی"
                              : sm14.trapAwayNegWarm
                                ? "تله Warm<0"
                                : "قفل سالم"
                          : hIsSm14Base
                            ? "بدون قفل"
                            : "سمت عکس",
                        hSub: sm14.m14Sig && hIsSm14Base
                          ? sm14ShortLock
                          : hIsSm14Base
                            ? `سمت پایه (${homeTicks}✓)`
                            : `فاقد قفل (${homeTicks}✓)`,
                        hTick: sm14.m14Sig && hIsSm14Base
                          ? sm14.hasActiveTrap
                            ? "trap"
                            : "pass"
                          : "none",
                        aText: sm14.m14Sig && aIsSm14Base
                          ? sm14.trapDualWater
                            ? "تله ۲×WATER"
                            : sm14.trapBipolarWeak
                              ? "تله دوقطبی"
                              : sm14.trapAwayNegWarm
                                ? "تله Warm<0"
                                : "قفل سالم"
                          : aIsSm14Base
                            ? "بدون قفل"
                            : "سمت عکس",
                        aSub: sm14.m14Sig && aIsSm14Base
                          ? sm14.trapAwayNegWarm
                            ? `Warm:${fmtSigned(sm14.aWarm)}`
                            : sm14ShortLock
                          : aIsSm14Base
                            ? `سمت پایه (${awayTicks}✓)`
                            : `فاقد قفل (${awayTicks}✓)`,
                        aTick: sm14.m14Sig && aIsSm14Base
                          ? sm14.hasActiveTrap
                            ? "trap"
                            : "pass"
                          : "none",
                      };
                      const sm14Row2Dom: CheckRow = {
                        key: "sm14_dom",
                        testId: `row-sm14-dom-${g.n}`,
                        stepTitle: "المنت غالب و برتری [F-A-W-E]",
                        stepSub: "رد ۲×WATER | تایید ۳/۴ عناصر و شکاف",
                        hText: sm14.dualWaterTrap
                          ? `تله ۲×WATER`
                          : sm14.hLeadCnt === 3
                            ? `${sm14.hDomInfo.dom} ★۳/۴`
                            : `${sm14.hDomInfo.dom} (${sm14.hDomInfo.maxCnt})`,
                        hSub: `[${sm14.hDomInfo.vecStr}] • ${sm14.hLeadCnt}/4`,
                        hTick: sm14.dualWaterTrap
                          ? "trap"
                          : sm14.hLeadCnt === 3 || (sm14.domSplit && (sm14.sig ? sm14.pick === g.h : sm14.hDomInfo.dom !== "EARTH"))
                            ? "pass"
                            : "none",
                        aText: sm14.dualWaterTrap
                          ? `تله ۲×WATER`
                          : sm14.aLeadCnt === 3
                            ? `${sm14.aDomInfo.dom} ★۳/۴`
                            : `${sm14.aDomInfo.dom} (${sm14.aDomInfo.maxCnt})`,
                        aSub: `[${sm14.aDomInfo.vecStr}] • ${sm14.aLeadCnt}/4`,
                        aTick: sm14.dualWaterTrap
                          ? "trap"
                          : sm14.aLeadCnt === 3 || (sm14.domSplit && (sm14.sig ? sm14.pick === g.a : sm14.aDomInfo.dom !== "EARTH"))
                            ? "pass"
                            : "none",
                      };
                      const hPureL5Pass =
                        (hIsSm14Base && sm14.m14Sig && !sm14.hasActiveTrap) ||
                        (hIsSm14Base && hL5 >= 75) ||
                        (!hIsSm14Base && (hL5 >= 62 || (sm14.m11FavOpp && sm14.spwrFavOpp && hL5 >= 55)));
                      const aPureL5Pass =
                        (aIsSm14Base && sm14.m14Sig && !sm14.hasActiveTrap) ||
                        (aIsSm14Base && aL5 >= 75) ||
                        (!aIsSm14Base && (aL5 >= 62 || (sm14.m11FavOpp && sm14.spwrFavOpp && aL5 >= 55)));
                      const sm14Row3Log5: CheckRow = {
                        key: "sm14_log5",
                        testId: `row-sm14-log5-${g.n}`,
                        stepTitle: "قدرت پایه و زمین (Surface Elo %)",
                        stepSub: "مستقیم ≥75% | عکس ≥62% (طلایی ≥55%)",
                        hText: `${hL5}%`,
                        hSub: hL5 >= 75 ? "آستانه مستقیم" : hL5 >= 62 ? "آستانه عکس" : "زیر آستانه",
                        hTick: hPureL5Pass ? "pass" : "none",
                        aText: `${aL5}%`,
                        aSub: aL5 >= 75 ? "آستانه مستقیم" : aL5 >= 62 ? "آستانه عکس" : "زیر آستانه",
                        aTick: aPureL5Pass ? "pass" : "none",
                      };
                      const hM11Team = Boolean(sm14.m11Sig && sm14.m11Pick === g.h);
                      const aM11Team = Boolean(sm14.m11Sig && sm14.m11Pick === g.a);
                      const hM11Dir = Boolean(sm14.m11Pick === g.h);
                      const aM11Dir = Boolean(sm14.m11Pick === g.a);
                      const sm14Row4Opp: CheckRow = {
                        key: "sm14_opp",
                        testId: `row-sm14-opp-${g.n}`,
                        stepTitle: "تایید چرخش به بازیکن مقابل",
                        stepSub: "بُعد فردی / قفل ۱۱ / توان کل",
                        hText: !hIsSm14Base
                          ? hM11Team && sm14.spwrFavOpp
                            ? "طلایی M11+Pwr"
                            : hM11Team
                              ? "قفل حالت ۱۱"
                              : sm14.hasActiveTrap && hM11Dir
                                ? "مسیر ۱۱ ضدتله"
                                : sm14.p12FavOpp
                                  ? "برتری بُعد فردی"
                                  : "بدون تایید"
                          : sm14.p12FavBase
                            ? "هم‌جهت GF"
                            : "واگرا با GF",
                        hSub: `GF:${fmtSigned(sm14.hP12)} • Pwr:${fmtSigned(sm14.hSPwr)}`,
                        hTick: !hIsSm14Base
                          ? hM11Team || sm14.p12FavOpp || (sm14.hasActiveTrap && hM11Dir)
                            ? "pass"
                            : "none"
                          : (sm14.kind === "M14_CORE_CLEAN" || sm14.kind === "M14_DIRECT_RELEASE") && sm14.p12FavBase
                            ? "pass"
                            : "none",
                        aText: !aIsSm14Base
                          ? aM11Team && sm14.spwrFavOpp
                            ? "طلایی M11+Pwr"
                            : aM11Team
                              ? "قفل حالت ۱۱"
                              : sm14.hasActiveTrap && aM11Dir
                                ? "مسیر ۱۱ ضدتله"
                                : sm14.p12FavOpp
                                  ? "برتری بُعد فردی"
                                  : "بدون تایید"
                          : sm14.p12FavBase
                            ? "هم‌جهت GF"
                            : "واگرا با GF",
                        aSub: `GF:${fmtSigned(sm14.aP12)} • Pwr:${fmtSigned(sm14.aSPwr)}`,
                        aTick: !aIsSm14Base
                          ? aM11Team || sm14.p12FavOpp || (sm14.hasActiveTrap && aM11Dir)
                            ? "pass"
                            : "none"
                          : (sm14.kind === "M14_CORE_CLEAN" || sm14.kind === "M14_DIRECT_RELEASE") && sm14.p12FavBase
                            ? "pass"
                            : "none",
                      };
                      const sm14Row5Shield: CheckRow = {
                        key: "sm14_shield",
                        testId: `row-sm14-shield-${g.n}`,
                        stepTitle: "حکم نهایی باکس هوشمند ۱۴",
                        stepSub: "حذف سمت تله بازنده و انتخاب برنده",
                        hText: sm14.hasActiveTrap && hIsSm14Base
                          ? "حذف سمت تله"
                          : sm14.kind === "M14_VETO_TRAP" && !hIsSm14Base
                            ? "مسیر عکس (بدون بت)"
                            : sm14.sig && sm14.pick === g.h
                              ? sm14.kind === "M14_TRAP_FLIP"
                                ? "چرخش ضدتله ✓"
                                : sm14.kind === "M14_OPPOSITE_FLIP"
                                  ? "بازیکن مقابل مجاز"
                                  : sm14.kind === "M14_DIRECT_RELEASE"
                                    ? "مستقیم مجاز"
                                    : sm14.vip
                                      ? "سیگنال VIP ★"
                                      : "سیگنال سالم"
                              : "خنثی",
                        hTick: sm14.hasActiveTrap && hIsSm14Base
                          ? "trap"
                          : sm14.sig && sm14.pick === g.h
                            ? "pass"
                            : "none",
                        aText: sm14.hasActiveTrap && aIsSm14Base
                          ? "حذف سمت تله"
                          : sm14.kind === "M14_VETO_TRAP" && !aIsSm14Base
                            ? "مسیر عکس (بدون بت)"
                            : sm14.sig && sm14.pick === g.a
                              ? sm14.kind === "M14_TRAP_FLIP"
                                ? "چرخش ضدتله ✓"
                                : sm14.kind === "M14_OPPOSITE_FLIP"
                                  ? "بازیکن مقابل مجاز"
                                  : sm14.kind === "M14_DIRECT_RELEASE"
                                    ? "مستقیم مجاز"
                                    : sm14.vip
                                      ? "سیگنال VIP ★"
                                      : "سیگنال سالم"
                              : "خنثی",
                        aTick: sm14.hasActiveTrap && aIsSm14Base
                          ? "trap"
                          : sm14.sig && sm14.pick === g.a
                            ? "pass"
                            : "none",
                      };
                      const sm14Rows: CheckRow[] = [sm14Row1Lock, sm14Row2Dom, sm14Row3Log5, sm14Row4Opp, sm14Row5Shield];
                      const sm14HomeTicks = sm14Rows.filter((r) => r.hTick === "pass").length;
                      const sm14AwayTicks = sm14Rows.filter((r) => r.aTick === "pass").length;
                      const sm14Won = hasFinalScore && sm14.sig ? sm14.pick === g.aw : null;
                      const sm14SavedTrap = hasFinalScore && sm14.kind === "M14_VETO_TRAP" ? sm14.baseM14Pick !== g.aw : null;

                      // Smart Anti-NO-BET Box (Box 1 Style Ticked Checklist)
                      const anb = evalSmartAntiNoBet(g);
                      const showAntiNoBetBox =
                        (isTriUltraMode && anb.kind !== "M12_CORE") || isAntiNoBetMode;
                      const hIsAnbP = anb.baseM12Pick === g.h;
                      const aIsAnbP = anb.baseM12Pick === g.a;
                      const hDpOpp = !hIsAnbP && anb.dpSig && anb.dpPick === g.h;
                      const aDpOpp = !aIsAnbP && anb.dpSig && anb.dpPick === g.a;
                      const hColdNeg = cold0Win === g.h && h0Val < 0;
                      const aColdNeg = cold0Win === g.a && a0Val < 0;

                      const anbRowM11: CheckRow = {
                        key: "anb_m11",
                        testId: `row-anb-m11-${g.n}`,
                        stepTitle: "قفل ۳ عددی مستقل (حالت ۱۱)",
                        stepSub: "شرط گروه ۱ مستقیم",
                        hText:
                          anb.m11Sig && anb.m11Pick === g.h
                            ? "فعال"
                            : anb.m11Pick === g.h
                              ? "بدون قفل"
                              : "—",
                        hSub: hIsAnbP ? "سمت پایه" : "سمت عکس",
                        hTick: anb.m11Sig && anb.m11Pick === g.h ? "pass" : "none",
                        aText:
                          anb.m11Sig && anb.m11Pick === g.a
                            ? "فعال"
                            : anb.m11Pick === g.a
                              ? "بدون قفل"
                              : "—",
                        aSub: aIsAnbP ? "سمت پایه" : "سمت عکس",
                        aTick: anb.m11Sig && anb.m11Pick === g.a ? "pass" : "none",
                      };

                      const hL5Pass =
                        hEl !== "EARTH" &&
                        ((hIsAnbP && hL5 >= 75) ||
                          (!hIsAnbP && hL5 >= 60) ||
                          (!hIsAnbP && hDpOpp && hL5 >= 52));
                      const aL5Pass =
                        aEl !== "EARTH" &&
                        ((aIsAnbP && aL5 >= 75) ||
                          (!aIsAnbP && aL5 >= 60) ||
                          (!aIsAnbP && aDpOpp && aL5 >= 52));

                      const anbRowLog5: CheckRow = {
                        key: "anb_log5",
                        testId: `row-anb-log5-${g.n}`,
                        stepTitle: "قدرت پایه غیر EARTH (Surface Elo)",
                        stepSub: "مستقیم ≥75% | عکس ≥60%",
                        hText: hEl === "EARTH" ? "تله EARTH" : hEl,
                        hSub: `${hL5}%`,
                        hTick: hEl === "EARTH" ? "trap" : hL5Pass ? "pass" : "none",
                        aText: aEl === "EARTH" ? "تله EARTH" : aEl,
                        aSub: `${aL5}%`,
                        aTick: aEl === "EARTH" ? "trap" : aL5Pass ? "pass" : "none",
                      };

                      const anbRowOppPole: CheckRow = {
                        key: "anb_pole",
                        testId: `row-anb-pole-${g.n}`,
                        stepTitle: "قطب سرد ۰xxx و همزاد مخالف",
                        stepSub: "تایید چرخش به بازیکن مقابل",
                        hText:
                          hDpOpp && hColdNeg
                            ? "همزاد + ۰xxx"
                            : hDpOpp
                              ? "همزاد مخالف"
                              : hColdNeg
                                ? "قطب سرد منفی"
                                : "—",
                        hSub: `${fmtSigned(h0Val)}`,
                        hTick: (!hIsAnbP && (hDpOpp || hColdNeg)) ? "pass" : "none",
                        aText:
                          aDpOpp && aColdNeg
                            ? "همزاد + ۰xxx"
                            : aDpOpp
                              ? "همزاد مخالف"
                              : aColdNeg
                                ? "قطب سرد منفی"
                                : "—",
                        aSub: `${fmtSigned(a0Val)}`,
                        aTick: (!aIsAnbP && (aDpOpp || aColdNeg)) ? "pass" : "none",
                      };

                      const anbRowShield: CheckRow = {
                        key: "anb_shield",
                        testId: `row-anb-shield-${g.n}`,
                        stepTitle: "سپر ایمنی (ضد ۲-EARTH و ۳/۳)",
                        stepSub: "فیلتر بازی‌های خنثی",
                        hText:
                          anb.kind === "HOLD_DUAL_EARTH"
                            ? "دو EARTH"
                            : anb.kind === "HOLD_3OF3_CLASH" && !hIsAnbP
                              ? "تضاد ۳/۳"
                              : anb.is3of3P && !hIsAnbP && anb.kind !== "M12_CORE"
                                ? "منع عکس ۳/۳"
                                : anb.sig && anb.pick === g.h
                                  ? "مجاز"
                                  : "سالم",
                        hTick:
                          anb.kind === "HOLD_DUAL_EARTH" ||
                          ((anb.kind === "HOLD_3OF3_CLASH" || anb.is3of3P) && !hIsAnbP && anb.kind !== "M12_CORE")
                            ? "trap"
                            : anb.sig && anb.pick === g.h
                              ? "pass"
                              : "none",
                        aText:
                          anb.kind === "HOLD_DUAL_EARTH"
                            ? "دو EARTH"
                            : anb.kind === "HOLD_3OF3_CLASH" && !aIsAnbP
                              ? "تضاد ۳/۳"
                              : anb.is3of3P && !aIsAnbP && anb.kind !== "M12_CORE"
                                ? "منع عکس ۳/۳"
                                : anb.sig && anb.pick === g.a
                                  ? "مجاز"
                                  : "سالم",
                        aTick:
                          anb.kind === "HOLD_DUAL_EARTH" ||
                          ((anb.kind === "HOLD_3OF3_CLASH" || anb.is3of3P) && !aIsAnbP && anb.kind !== "M12_CORE")
                            ? "trap"
                            : anb.sig && anb.pick === g.a
                              ? "pass"
                              : "none",
                      };

                      const anbRows: CheckRow[] = [anbRowM11, anbRowLog5, anbRowOppPole, anbRowShield];
                      const anbHomeTicks = anbRows.filter((r) => r.hTick === "pass").length;
                      const anbAwayTicks = anbRows.filter((r) => r.aTick === "pass").length;
                      const anbWon =
                        hasFinalScore && anb.sig ? anb.pick === g.aw : null;

                      // Box 2: Exact Lock Name & Verdict Mapping
                      const m12Code = g1.m12_route?.code ?? "";
                      const m11Code = g1.m11_route?.code ?? "";
                      const m12LockTitleMap: Record<string, string> = {
                        ULTRA_LOCK: "ابرقفل پایه ۳ عددی + تایید موتور همزاد",
                        ULTRA_3OF3_TWIN: "قفل توافق کامل ۳ از ۳ عدد منفی + هر دو موتور همزاد",
                        ULTRA_FIRE_KEEP: "قفل حفظ برتری آتشین (FIRE) بدون حذف بازی",
                        ULTRA_EARTH_FLIP: "قفل چرخش ضدتله EARTH به حریف سالم + تایید همزاد",
                        ULTRA_POS_INV: "قفل معکوس دو-مثبت (+,+) به سود مثبت بزرگ‌تر",
                        ULTRA_POS_BAL: "قفل دو-مثبت متعادل (+,+) با تایید موتور همزاد",
                        ULTRA_COLD_ANCHOR_KEEP: "قفل مهار دو-مثبت با لنگر منفی قطب سرد ۰xxx",
                        ULTRA_BIPOLAR_0011: "قفل هم‌جهتی قطب گرم ۱xxx و قطب سرد ۰xxx/0011 + همزاد",
                        ULTRA_ZERO_1XXX_OPP: "قفل حبس ۱xxx=0.0 (انتقال برد به حریف غیر EARTH)",
                        ULTRA_S3_SPLIT: "قفل شکاف علامت Σ(3) منفی برابر مثبت + تایید همزاد",
                        ULTRA_GF_FLIP: "قفل چرخش داور سنگین GF-FIN به سود حریف",
                        ULTRA_TWIN_TIEBREAK: "قفل گره‌گشایی موتور همزاد در نبرد دو بازیکن غیر EARTH",
                        ULTRA_DUAL_EARTH_HOLD: "قفل ایمنی ۱: توقف تقابل پرنوسان دو بازیکن EARTH",
                        ULTRA_3OF3_CLASH_HOLD: "قفل ایمنی ۲ (v68): مهار چرخش همزاد برابر اجماع ۳/۳ اعداد",
                        ULTRA_GF_HOLD: "قفل ایمنی ۳: توقف به علت مخالفت سنگین داور GF-FIN",
                        ULTRA_FALLBACK: "مسیر پایه ۳ عددی (بدون احراز شرایط ابرقفل)",
                      };

                      const anbTitleMap: Record<AntiNoBetKind, string> = {
                        M12_CORE: m12LockTitleMap[m12Code] || "سیگنال اصلی حالت ۱۲ (تایید مستقیم ابرقفل)",
                        DIRECT_RELEASE: "گروه ۱ ضد NO-BET: آزادسازی مستقیم بازی حذف‌شده",
                        OPPOSITE_FLIP: "گروه ۲ ضد NO-BET: چرخش هوشمند به بازیکن مقابل",
                        HOLD_DUAL_EARTH: "سپر ایمنی ضد NO-BET: توقف تقابل دو EARTH",
                        HOLD_3OF3_CLASH: "سپر ایمنی ضد NO-BET: مهار تضاد همزاد برابر ۳/۳",
                        HOLD_NEUTRAL: "توقف خنثی ضد NO-BET (خارج از شرایط مستقیم و عکس)",
                      };

                      const t12Code = t12?.code ?? "";
                      const t12TitleMap: Record<string, string> = {
                        TOT12_POLARITY_LOCK: "قفل قطبیت کامل موتور ۱۴ (قطب گرم + تفاضل دوقطبی + المنت کل)",
                        TOT12_BIPOLAR_HARMONY: "قفل هم‌جهتی دوقطبی Σ(1xxx) و Σ(0xxx) بردار کل",
                        TOT12_COLD_TOTAL: "قفل قطب سرد Σ(0xxx) + جمع کل + المنت کل",
                        TOT12_3OF3: "اجماع ۳/۳ المنت کل (بُعد فردی + مکان/کورت + کیفیت کل)",
                        TOT12_MAJ_CONFIRM: "اکثریت ۲/۳ المنت کل بازیکن + کورت",
                        TOT12_GF_PAIR: "توافق جفت GF-FIN (بُعد فردی و کورت/تورنمنت)",
                        TOT12_EARTH_FLIP: "قفل قطبیت المنت کل موتور ۱۴ + برتری Surface Elo",
                        TOT12_DUAL_EARTH_HOLD: "مسیر پایه موتور ۱۴ (بدون احراز آستانه Surface Elo)",
                        TOT12_HOLD: "مسیر پایه دوقطبی موتور ۱۴ (خارج از شرط قفل ورود)",
                      };

                      const isSafetyHold = Boolean(
                        !isQualified &&
                          (isMode17 ||
                            (isTriUltraFamily && (hEl === "EARTH" && aEl === "EARTH")) ||
                            (isTotalElem12Mode && (sm14.kind === "M14_VETO_TRAP" || sm14.dualWaterTrap)) ||
                            (isTriUltraMode && (m12Code === "ULTRA_DUAL_EARTH_HOLD" || m12Code === "ULTRA_3OF3_CLASH_HOLD" || m12Code === "ULTRA_GF_HOLD")) ||
                            (isAntiNoBetMode && (anb.kind === "HOLD_DUAL_EARTH" || anb.kind === "HOLD_3OF3_CLASH")) ||
                            (!isPureGfFinMode && !isTriAntiDropMode && (!pickEarthOk || !pickNegOk)))
                      );

                      const lockTitleFa = manualOverridden
                        ? "فیلتر دستی کاربر (۱۲ ستون همزاد)"
                        : isMode17 && m17
                          ? m17.lockTitleFa
                          : isTotalElem12Mode
                            ? sm14.kind === "M14_TRAP_FLIP"
                              ? "قانون ۱+۲ حالت ۱۴: تشخیص تله روی سمت بازنده و چرخش برد به بازیکن مقابل"
                              : sm14.kind === "M14_OPPOSITE_FLIP"
                                ? "قانون ۲ حالت ۱۴: چرخش هوشمند به بازیکن مقابل"
                                : sm14.kind === "M14_DIRECT_RELEASE"
                                  ? "قانون ۳ حالت ۱۴: آزادسازی مستقیم با Surface Elo≥75%"
                                  : sm14.kind === "M14_VETO_TRAP"
                                    ? "قانون ۱ حالت ۱۴: مهار تله سمت بازنده (چرخش مسیر جایگزین به بازیکن مقابل • بدون بت)"
                                    : t12TitleMap[t12Code] || "موتور المنت کل بازیکن + تورنمنت/کورت"
                            : isAntiNoBetMode
                              ? anbTitleMap[anb.kind]
                              : isTriUltraMode
                                ? m12LockTitleMap[m12Code] || "ابرقفل ۳ عددی تلفیقی حالت ۱۲"
                                : isTriRoutedMode
                                  ? g1.m11_route?.flipped
                                    ? `چرخش ضدحذف موتور ۳ عددی مستقل (${m11Code || "ROUTED"})`
                                    : isQualified
                                      ? `قفل ۳ عددی مستقل بدون همزاد (${m11Code || "M11"})`
                                      : "مسیر پایه ۳ عددی مستقل (بدون احراز قفل)"
                                  : isPureGfFinMode
                                    ? `موتور خالص GF-FIN (کمتر/منفی‌تر برنده • ΔGF=${gfAbsDiff})`
                                    : fusionMode === "pos_inv_lock" && g1.pos_inv?.triggered
                                      ? "قفل معکوس دو-مثبت (+,+) در حالت ۹"
                                      : isGfRescued
                                        ? `قفل داور ۲ از ۳ شاخص GF-FIN (ΔGF=${gfAbsDiff})`
                                        : isSafeDl
                                          ? "قفل ایمن دوگانه ۱xxx + Σ(All) + ضد EARTH + لنگر منفی"
                                          : !pickEarthOk
                                            ? "توقف قفل ضد EARTH"
                                            : !pickNegOk && !isPure2EngineMode
                                              ? "توقف قفل لنگر منفی"
                                              : activePresetLabel;

                      const lockReasonFa =
                        isMode17 && m17
                          ? m17.reasonFa
                          : isTotalElem12Mode
                            ? sm14.reasonFa
                            : isAntiNoBetMode
                              ? anb.reasonFa
                              : isTriUltraMode && g1.m12_route?.reason_fa
                                ? g1.m12_route.reason_fa
                                : isTriRoutedMode && g1.m11_route?.reason_fa
                                  ? g1.m11_route.reason_fa
                                  : fusionMode === "pos_inv_lock" && g1.pos_inv?.reason_fa
                                    ? g1.pos_inv.reason_fa
                                    : "";

                      const m17BadgeCls =
                        m17?.tier === "black_diamond"
                          ? "bg-slate-950 text-amber-300 border-amber-400 shadow-2xs"
                          : m17?.tier === "pure_astro"
                            ? "bg-violet-700 text-white border-violet-400 shadow-2xs"
                            : m17?.tier === "daily_gold"
                              ? "bg-amber-400 text-slate-950 border-amber-600 shadow-2xs"
                              : m17?.tier === "standard"
                                ? "bg-emerald-600 text-white border-emerald-700"
                                : "bg-rose-600 text-white border-rose-700";

                      const cleanBorderCls =
                        isMode17 && m17
                          ? m17.tier === "black_diamond"
                            ? "border-2 border-slate-900 ring-2 ring-amber-400/90 bg-white shadow-md"
                            : m17.tier === "pure_astro"
                              ? "border-2 border-violet-600 ring-2 ring-violet-200 bg-white shadow-sm"
                              : m17.tier === "daily_gold"
                                ? "border-2 border-amber-400 ring-2 ring-amber-200/80 bg-white shadow-sm"
                                : m17.tier === "standard"
                                  ? "border-2 border-emerald-500 ring-1 ring-emerald-200/80 bg-white shadow-sm"
                                  : "border border-slate-300 bg-slate-50/90"
                          : isQualified && isVip3
                            ? "border-2 border-amber-400 ring-2 ring-amber-200/70 bg-white shadow-sm"
                            : isQualified
                              ? "border-2 border-emerald-500 ring-1 ring-emerald-200/80 bg-white shadow-sm"
                              : isSafetyHold
                                ? "border border-amber-300 bg-white"
                                : "border border-slate-200 bg-slate-50/90";

                      return (
                        <div
                          key={g.n}
                          data-testid={`nba-daily-card-${g.n}`}
                          className={`rounded-xl overflow-hidden flex flex-col justify-between transition-all ${cleanBorderCls}`}
                        >
                          {/* Clean 1v1 Singles Tennis Matchup Header (P1 vs P2 + Tournament + City + Surface + Round) */}
                          <div
                            className={`px-3 py-2 border-b flex items-start justify-between gap-2 ${
                              isMode17 && m17
                                ? m17.tier === "black_diamond"
                                  ? "bg-gradient-to-l from-amber-100/95 via-amber-50/85 to-slate-100 border-amber-400"
                                  : m17.tier === "pure_astro"
                                    ? "bg-violet-50/90 border-violet-300"
                                    : m17.tier === "daily_gold"
                                      ? "bg-amber-50/90 border-amber-300"
                                      : m17.tier === "standard"
                                        ? "bg-emerald-50/90 border-emerald-300"
                                        : "bg-slate-100/80 border-slate-200"
                                : isQualified && isVip3
                                  ? "bg-amber-50/90 border-amber-300"
                                  : isQualified
                                    ? "bg-emerald-50/90 border-emerald-300"
                                    : "bg-sky-100/60 border-sky-200"
                            }`}
                            dir="rtl"
                          >
                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="text-xs font-extrabold text-slate-950 leading-snug break-words" dir="ltr">
                                <span className="px-1 py-0.2 rounded bg-sky-700 text-white text-[9.5px] font-mono mr-1">P1</span>
                                <span className="text-sky-800">{g.h}</span>{" "}
                                <span className="text-[10px] text-slate-500 font-mono">({g.h_ioc || g.hc})</span>{" "}
                                <span className="text-slate-400 mx-0.5">vs</span>{" "}
                                <span className="px-1 py-0.2 rounded bg-indigo-700 text-white text-[9.5px] font-mono mr-1">P2</span>
                                <span className="text-indigo-900">{g.a}</span>{" "}
                                <span className="text-[10px] text-slate-500 font-mono">({g.a_ioc || g.ac})</span>
                              </div>
                              <div className="text-[10px] text-slate-700 font-semibold flex flex-wrap items-center gap-1.5">
                                {isMode17 && m17 && (
                                  <span
                                    data-testid={`badge-m17-tier-${g.n}`}
                                    data-tier={m17.tier}
                                    className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold border ${m17BadgeCls}`}
                                  >
                                    {m17.badgeFa}
                                  </span>
                                )}
                                <span>
                                  بازیکن ۱ (P1): <b dir="ltr">{getPlayerLastName(g.h)} ({g.hc})</b> • بازیکن ۲ (P2): <b dir="ltr">{getPlayerLastName(g.a)} ({g.ac})</b>
                                </span>
                                <span className="px-1.5 py-0.5 rounded bg-white/90 border border-sky-200 text-slate-900 font-bold" dir="ltr">
                                  🎾 {g.tourney || g.venue || "Main Tour"}{g.city ? ` • ${g.city}` : ""}
                                </span>
                                {g.surface && (
                                  <span
                                    dir="ltr"
                                    className={`px-1.5 py-0.5 rounded font-mono font-extrabold text-[9.5px] border ${
                                      g.surface === "Clay"
                                        ? "bg-orange-100 text-orange-950 border-orange-300"
                                        : g.surface === "Grass"
                                          ? "bg-emerald-100 text-emerald-950 border-emerald-300"
                                          : "bg-sky-100 text-sky-950 border-sky-300"
                                    }`}
                                  >
                                    {g.surface}
                                  </span>
                                )}
                                {g.rnd && (
                                  <span dir="ltr" className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-300 font-mono font-bold text-[9.5px]">
                                    Round: {g.rnd}
                                  </span>
                                )}
                                {cardFlipDir[g.n] && (
                                  <span className="px-1.5 py-0.2 rounded bg-amber-200 text-amber-950 font-bold text-[9.5px]">
                                    جهت معکوس دستی
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="text-left shrink-0 font-mono text-[10px] text-slate-600 font-bold" dir="ltr">
                              <div>{g.tour ? `${g.tour} ` : ""}#{g.n}</div>
                              <div>{g.d}{g.ts && g.ts.length >= 16 ? ` • ${g.ts.slice(11, 16)} UTC` : ""}</div>
                            </div>
                          </div>

                          <div className="p-2.5 space-y-2 flex-1 flex flex-col justify-start" dir="rtl">
                            {/* ============================================================ */}
                            {/* HERO 6-BOX FINAL REFEREE: Ranked Weighted 6-Box Scoring Box (v82) */}
                            {/* ============================================================ */}
                            {isTotalElem12Mode && (() => {
                              const r6 = sm14.referee6;
                              const r6Won = hasFinalScore ? r6.pick === g.aw : null;
                              const r6PickIsHome = r6.pick === g.h;

                              const tierPillFa =
                                r6.tier === "DIAMOND"
                                  ? "★★ رتبه ۱ الماسی ۶ باکس"
                                  : r6.tier === "STRONG_SIGNAL"
                                    ? r6.isOppositeWin
                                      ? "★ رتبه ۲ قوی (معکوس ⇄)"
                                      : "★ رتبه ۲ سیگنال قوی ۶ باکس"
                                    : r6.tier === "RANKED_CONSENSUS"
                                      ? r6.isOppositeWin
                                        ? "✓ رتبه ۳ رتبه‌بندی (معکوس ⇄)"
                                        : "✓ رتبه ۳ تایید رتبه‌بندی ۶ باکس"
                                      : "◔ رتبه ۴ برتری خفیف امتیازی";

                              const outerCls =
                                r6.tier === "DIAMOND"
                                  ? "border-2 border-amber-500 bg-gradient-to-b from-amber-100/95 via-amber-50/75 to-emerald-50/60 shadow-sm"
                                  : r6.tier === "STRONG_SIGNAL"
                                    ? r6.isOppositeWin
                                      ? "border-2 border-violet-500 bg-gradient-to-b from-violet-100/95 via-purple-50/75 to-sky-50/70 shadow-sm"
                                      : "border-2 border-emerald-500 bg-gradient-to-b from-emerald-100/90 via-teal-50/65 to-sky-50/70 shadow-sm"
                                    : r6.tier === "RANKED_CONSENSUS"
                                      ? "border-2 border-teal-500 bg-gradient-to-b from-teal-100/90 via-cyan-50/75 to-sky-50/70 shadow-sm"
                                      : "border-2 border-sky-400 bg-gradient-to-b from-sky-100/90 via-sky-50/75 to-white";

                              const headerBarCls =
                                r6.tier === "DIAMOND"
                                  ? "bg-amber-200/85 border-amber-400 text-slate-950"
                                  : r6.tier === "STRONG_SIGNAL"
                                    ? r6.isOppositeWin
                                      ? "bg-violet-200/85 border-violet-400 text-violet-950"
                                      : "bg-emerald-200/80 border-emerald-400 text-emerald-950"
                                    : r6.tier === "RANKED_CONSENSUS"
                                      ? "bg-teal-200/80 border-teal-400 text-teal-950"
                                      : "bg-sky-200/80 border-sky-300 text-sky-950";

                              const tierBadgeCls =
                                r6.tier === "DIAMOND"
                                  ? "bg-amber-500 text-slate-950 border-amber-700"
                                  : r6.tier === "STRONG_SIGNAL"
                                    ? r6.isOppositeWin
                                      ? "bg-violet-700 text-white border-violet-900"
                                      : "bg-emerald-600 text-white border-emerald-800"
                                    : r6.tier === "RANKED_CONSENSUS"
                                      ? "bg-teal-700 text-white border-teal-900"
                                      : "bg-sky-700 text-white border-sky-900";

                              // 6 Ranked Rows sorted strictly by predictive importance (Rank 1 -> Rank 6)
                              const r6Rows: CheckRow[] = r6.rankedBoxes.map((rb) => {
                                const hWinsBox = rb.team === g.h && rb.pts > 0;
                                const aWinsBox = rb.team === g.a && rb.pts > 0;
                                return {
                                  key: `r82_${rb.id}`,
                                  testId: `row-r82-${rb.id}-${g.n}`,
                                  stepTitle: `رتبه ${rb.rank} اهمیت: ${rb.boxTitleFa}`,
                                  stepSub: `حداکثر وزن: ${rb.maxPts} امتیاز • وضعیت: ${rb.tagFa}`,
                                  hText: hWinsBox ? `+${rb.pts} امتیاز ✓` : "۰ امتیاز",
                                  hSub: hWinsBox ? rb.tagFa : undefined,
                                  hTick: hWinsBox ? "pass" : "none",
                                  aText: aWinsBox ? `+${rb.pts} امتیاز ✓` : "۰ امتیاز",
                                  aSub: aWinsBox ? rb.tagFa : undefined,
                                  aTick: aWinsBox ? "pass" : "none",
                                };
                              });

                              return (
                                <div
                                  data-testid={`box-referee6-${g.n}`}
                                  className={`rounded-xl overflow-hidden ${outerCls}`}
                                >
                                  {/* Top Colorful Header Strip */}
                                  <div className={`px-3 py-2 border-b flex flex-wrap items-center justify-between gap-1.5 ${headerBarCls}`}>
                                    <span className="text-[12px] font-extrabold tracking-tight shrink-0">
                                      داور رتبه‌بندی ۶ باکس (v82)
                                    </span>
                                    <div className="flex flex-wrap items-center justify-end gap-1 min-w-0">
                                      <span className={`px-2 py-0.5 rounded-md text-[10.5px] font-extrabold border shadow-2xs whitespace-nowrap ${tierBadgeCls}`}>
                                        {tierPillFa}
                                      </span>
                                      {r6Won !== null && (
                                        <span
                                          data-testid={`referee6-outcome-${g.n}`}
                                          className={`px-2 py-0.5 rounded-md font-extrabold text-[10.5px] border shadow-2xs whitespace-nowrap ${
                                            r6Won
                                              ? "bg-emerald-600 text-white border-emerald-800"
                                              : "bg-rose-600 text-white border-rose-800"
                                          }`}
                                        >
                                          {r6.active
                                            ? r6Won
                                              ? "برد داور ✓"
                                              : "باخت داور ✕"
                                            : r6Won
                                              ? "برتری درست ✓"
                                              : "برتری نادرست ✕"}
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  {/* Large Easy-to-Read Main Verdict Body */}
                                  <div className="p-3 space-y-2.5">
                                    {/* Big Winner & Weighted Scoreboard Callout Box */}
                                    <div
                                      className={`rounded-lg px-3 py-2.5 border flex flex-wrap items-center justify-between gap-2 ${
                                        r6.tier === "DIAMOND"
                                          ? "bg-white/95 border-amber-400"
                                          : r6.isOppositeWin && r6.active
                                            ? "bg-white/95 border-violet-400"
                                            : r6.active
                                              ? "bg-white/95 border-emerald-400"
                                              : "bg-white/95 border-sky-300"
                                      }`}
                                    >
                                      <div className="min-w-0">
                                        <div className="text-[10.5px] font-bold text-slate-600">
                                          {r6.active
                                            ? r6.isOppositeWin
                                              ? "بازیکن برنده رتبه‌بندی ۶ باکس (چرخش به بازیکن مقابل ⇄):"
                                              : "بازیکن برنده رتبه‌بندی ۶ باکس:"
                                            : "بازیکن پیشرو در جمع امتیاز ۶ باکس (برتری سبک):"}
                                        </div>
                                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                                          <span
                                            dir="ltr"
                                            className={`text-[15px] font-extrabold leading-tight ${
                                              r6.tier === "DIAMOND"
                                                ? "text-amber-950"
                                                : r6.isOppositeWin && r6.active
                                                  ? "text-violet-950"
                                                  : r6.active
                                                    ? "text-emerald-950"
                                                    : "text-sky-950"
                                            }`}
                                          >
                                            {r6.pick} ({getTeam3Code(r6.pick)})
                                          </span>
                                          <span className="px-2 py-0.5 rounded-md bg-sky-100 border border-sky-300 text-sky-950 text-[10.5px] font-extrabold">
                                            {r6PickIsHome ? "بازیکن ۱ ✓" : "بازیکن ۲ ✓"}
                                          </span>
                                          {r6.isOppositeWin && (
                                            <span className="px-2 py-0.5 rounded-md bg-violet-100 border border-violet-400 text-violet-950 text-[10px] font-extrabold">
                                              معکوس {getTeam3Code(r6.sugPick)} ⇄
                                            </span>
                                          )}
                                        </div>
                                      </div>

                                      {/* Big Side-by-Side Weighted Points + Raw Ticks Scoreboard */}
                                      <div className="flex items-center gap-1.5 shrink-0" dir="ltr">
                                        <div
                                          className={`px-2.5 py-1 rounded-lg border text-center min-w-[64px] ${
                                            r6.pick === g.h
                                              ? r6.tier === "DIAMOND"
                                                ? "bg-amber-500 text-slate-950 border-amber-700 shadow-2xs"
                                                : r6.isOppositeWin && r6.active
                                                  ? "bg-violet-600 text-white border-violet-800 shadow-2xs"
                                                  : r6.active
                                                    ? "bg-emerald-600 text-white border-emerald-700 shadow-2xs"
                                                    : "bg-sky-600 text-white border-sky-700 shadow-2xs"
                                              : "bg-slate-100 text-slate-800 border-slate-300"
                                          }`}
                                        >
                                          <div className="text-[9.5px] font-bold opacity-90">{g.hc}</div>
                                          <div className="text-[13px] font-mono font-extrabold leading-tight">
                                            {r6.ptsHome}p
                                          </div>
                                          <div className="text-[8.5px] font-mono opacity-85">
                                            ({r6.totHomeTicks}✓)
                                          </div>
                                        </div>
                                        <span className="text-[10px] font-extrabold text-slate-500">Δ{r6.deltaPts}</span>
                                        <div
                                          className={`px-2.5 py-1 rounded-lg border text-center min-w-[64px] ${
                                            r6.pick === g.a
                                              ? r6.tier === "DIAMOND"
                                                ? "bg-amber-500 text-slate-950 border-amber-700 shadow-2xs"
                                                : r6.isOppositeWin && r6.active
                                                  ? "bg-violet-600 text-white border-violet-800 shadow-2xs"
                                                  : r6.active
                                                    ? "bg-emerald-600 text-white border-emerald-700 shadow-2xs"
                                                    : "bg-sky-600 text-white border-sky-700 shadow-2xs"
                                              : "bg-slate-100 text-slate-800 border-slate-300"
                                          }`}
                                        >
                                          <div className="text-[9.5px] font-bold opacity-90">{g.ac}</div>
                                          <div className="text-[13px] font-mono font-extrabold leading-tight">
                                            {r6.ptsAway}p
                                          </div>
                                          <div className="text-[8.5px] font-mono opacity-85">
                                            ({r6.totAwayTicks}✓)
                                          </div>
                                        </div>
                                      </div>
                                    </div>

                                    {/* 6 Ranked Mini-Boxes Ordered from Rank 1 (Most Important) to Rank 6 */}
                                    <div className="grid grid-cols-3 gap-1.5">
                                      {r6.rankedBoxes.map((rb) => {
                                        const hasWin = Boolean(rb.team && rb.pts > 0);
                                        const agreesWithPick = hasWin && rb.team === r6.pick;
                                        const pillCls = !hasWin
                                          ? rb.tagFa.includes("✕")
                                            ? "bg-rose-100 border-rose-300 text-rose-900"
                                            : "bg-white/85 border-slate-200 text-slate-600"
                                          : agreesWithPick
                                            ? rb.pts >= 8
                                              ? "bg-amber-100 border-amber-400 text-amber-950"
                                              : "bg-emerald-100/95 border-emerald-400 text-emerald-950"
                                            : "bg-amber-50 border-amber-300 text-amber-900";
                                        return (
                                          <div
                                            key={rb.id}
                                            className={`rounded-md border px-2 py-1 flex flex-col justify-between leading-tight ${pillCls}`}
                                          >
                                            <div className="flex items-center justify-between gap-1">
                                              <span className="text-[9px] font-extrabold truncate">{rb.boxTitleFa}</span>
                                              <span className="px-1 py-0 rounded bg-black/10 text-[8.5px] font-mono font-extrabold shrink-0">
                                                R{rb.rank}
                                              </span>
                                            </div>
                                            <span dir="ltr" className="text-[10.5px] font-mono font-extrabold truncate mt-0.5">
                                              {hasWin ? `${getTeam3Code(rb.team)} +${rb.pts}` : rb.tagFa}
                                            </span>
                                          </div>
                                        );
                                      })}
                                    </div>

                                    {/* Clear Readable Explanation + Toggle for 6-Box Ranked Breakdown Table */}
                                    <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                                      <p className="text-[11px] font-bold text-slate-800 leading-relaxed flex-1 min-w-[180px]">
                                        {r6.reasonFa}
                                      </p>
                                      <button
                                        type="button"
                                        data-testid={`toggle-referee6-${g.n}`}
                                        onClick={() => toggleCardBox(g.n, "referee6")}
                                        className="px-2.5 py-1 rounded-md bg-white hover:bg-sky-100 border border-sky-300 text-sky-950 font-extrabold text-[10px] shadow-2xs transition-colors shrink-0"
                                      >
                                        {isReferee6BoxOpen ? "بستن جدول رتبه‌بندی ▲" : "جدول رتبه‌بندی ۶ باکس ▼"}
                                      </button>
                                    </div>
                                  </div>

                                  {/* Collapsible 6-Row Ranked Box Weight Table */}
                                  {isReferee6BoxOpen && (
                                    <table className="w-full text-[10.5px] border-collapse bg-white border-t border-sky-200">
                                      <thead>
                                        <tr className="bg-sky-50 border-b border-sky-200 text-slate-800">
                                          <th className="py-1.5 px-2.5 text-right font-extrabold w-[46%]">رتبه اهمیت و وزن باکس</th>
                                          <th className="py-1.5 px-1.5 text-center font-extrabold border-r border-sky-100 w-[27%]">
                                            بازیکن ۱ ({g.hc}: {r6.ptsHome}p)
                                          </th>
                                          <th className="py-1.5 px-1.5 text-center font-extrabold border-r border-sky-100 w-[27%]">
                                            بازیکن ۲ ({g.ac}: {r6.ptsAway}p)
                                          </th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-sky-100">
                                        {r6Rows.map((r) => {
                                          const renderR6Cell = (txt: string, sub: string | undefined, tick: CheckTick) => (
                                            <div className="flex flex-col items-center justify-center leading-tight py-1">
                                              <div className="inline-flex items-center gap-1 font-extrabold text-slate-900">
                                                {tick === "pass" ? (
                                                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-emerald-600 text-white font-sans font-extrabold text-[10px] shrink-0">
                                                    ✓
                                                  </span>
                                                ) : (
                                                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-slate-200 text-slate-600 font-sans font-extrabold text-[10px] shrink-0">
                                                    —
                                                  </span>
                                                )}
                                                <span className={tick === "none" ? "text-slate-500 font-semibold" : ""}>{txt}</span>
                                              </div>
                                              {sub && (
                                                <div className="text-[9px] text-slate-600 font-mono tabular-nums mt-0.5">
                                                  {sub}
                                                </div>
                                              )}
                                            </div>
                                          );
                                          return (
                                            <tr key={r.key} data-testid={r.testId}>
                                              <td className="py-1.5 px-2.5 text-right align-middle">
                                                <div className="font-extrabold text-slate-900 leading-snug">{r.stepTitle}</div>
                                                {r.stepSub && (
                                                  <div className="text-[9px] text-slate-500 leading-tight mt-0.5">{r.stepSub}</div>
                                                )}
                                              </td>
                                              <td
                                                className={`py-1.5 px-1.5 text-center align-middle border-r border-sky-100 ${
                                                  r.hTick === "pass" ? "bg-emerald-50/80" : ""
                                                }`}
                                              >
                                                {renderR6Cell(r.hText, r.hSub, r.hTick)}
                                              </td>
                                              <td
                                                className={`py-1.5 px-1.5 text-center align-middle border-r border-sky-100 ${
                                                  r.aTick === "pass" ? "bg-emerald-50/80" : ""
                                                }`}
                                              >
                                                {renderR6Cell(r.aText, r.aSub, r.aTick)}
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  )}
                                </div>
                              );
                            })()}

                            {/* ============================================================ */}
                            {/* MASTER DROPDOWN FOR ALL 6 SIGNAL BOXES (Mode 14)             */}
                            {/* ============================================================ */}
                            {isTotalElem12Mode && (
                              <button
                                type="button"
                                data-testid={`toggle-sixboxes-${g.n}`}
                                onClick={() => toggleCardBox(g.n, "sixboxes")}
                                className={`w-full rounded-lg border px-3 py-2 flex flex-wrap items-center justify-between gap-1.5 text-[11px] font-extrabold transition-colors shadow-2xs ${
                                  isSixBoxesOpen
                                    ? "bg-sky-700 text-white border-sky-800"
                                    : "bg-sky-100/90 hover:bg-sky-200/80 text-sky-950 border-sky-300"
                                }`}
                              >
                                <span className="shrink-0">
                                  دراپ‌داون مجموعه ۶ باکس سیگنال کارت
                                </span>
                                <div className="flex flex-wrap items-center justify-end gap-1.5 min-w-0">
                                  <span
                                    dir="ltr"
                                    className={`font-mono text-[10px] px-2 py-0.5 rounded border whitespace-nowrap ${
                                      isSixBoxesOpen
                                        ? "bg-sky-800 text-sky-100 border-sky-600"
                                        : "bg-white text-slate-800 border-sky-200"
                                    }`}
                                  >
                                    {g.hc}:{sm14.referee6.ptsHome}p ({sm14.referee6.totHomeTicks}✓) | {g.ac}:{sm14.referee6.ptsAway}p ({sm14.referee6.totAwayTicks}✓)
                                  </span>
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] border whitespace-nowrap ${
                                      isSixBoxesOpen
                                        ? "bg-white text-sky-950 border-white"
                                        : "bg-sky-600 text-white border-sky-700"
                                    }`}
                                  >
                                    {isSixBoxesOpen ? "بستن ۶ باکس ▲" : "باز کردن ۶ باکس ▼"}
                                  </span>
                                </div>
                              </button>
                            )}

                            {(!isTotalElem12Mode || isSixBoxesOpen) && (
                              <div
                                data-testid={`sixboxes-body-${g.n}`}
                                className={
                                  isTotalElem12Mode
                                    ? "space-y-2 rounded-xl border border-sky-300 bg-sky-50/60 p-2"
                                    : "space-y-2"
                                }
                              >
                            {/* ============================================================ */}
                            {/* BOX 1: Collapsible Dropdown — Per-Team Ticked Checklist      */}
                            {/* ============================================================ */}
                            <div
                              data-testid={`box1-checklist-${g.n}`}
                              className="rounded-lg border border-sky-300 bg-white overflow-hidden shadow-2xs"
                            >
                              <button
                                type="button"
                                data-testid={`toggle-box1-${g.n}`}
                                onClick={() => toggleCardBox(g.n, "box1")}
                                className={`w-full px-2.5 py-1.5 bg-sky-100/85 hover:bg-sky-200/70 transition-colors flex flex-wrap items-center justify-between gap-1.5 text-[10px] text-right ${
                                  isBox1Open ? "border-b border-sky-200" : ""
                                }`}
                              >
                                <span className="font-extrabold text-sky-950">
                                  باکس ۱ • چک‌لیست شاخص‌های دو بازیکن
                                </span>
                                <div className="inline-flex items-center gap-1 shrink-0">
                                  <span
                                    dir="ltr"
                                    className="whitespace-nowrap font-mono font-extrabold text-[9.5px] px-1.5 py-0.5 rounded bg-white border border-sky-200 text-slate-800"
                                  >
                                    {g.hc}: {homeTicks}✓ | {g.ac}: {awayTicks}✓
                                  </span>
                                  <span className="px-1.5 py-0.5 rounded bg-white/90 border border-sky-300 text-sky-950 font-extrabold text-[9px]">
                                    {isBox1Open ? "بستن ▲" : "باز کردن ▼"}
                                  </span>
                                </div>
                              </button>

                              {isBox1Open && (
                                <table className="w-full text-[10px] border-collapse">
                                  <thead>
                                    <tr className="bg-slate-50 border-b border-sky-100 text-slate-700">
                                      <th className="py-1 px-2 text-right font-extrabold w-[40%]">شاخص مرحله</th>
                                      <th className="py-1 px-1.5 text-center font-extrabold border-r border-sky-100 w-[30%]">
                                        بازیکن ۱ ({g.hc})
                                      </th>
                                      <th className="py-1 px-1.5 text-center font-extrabold border-r border-sky-100 w-[30%]">
                                        بازیکن ۲ ({g.ac})
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {checklistRows.map((r, idx) => {
                                      const renderCell = (txt: string, sub: string | undefined, tick: CheckTick) => (
                                        <div className="flex flex-col items-center justify-center leading-tight py-0.5">
                                          <div className="inline-flex items-center gap-1 font-mono tabular-nums" dir="ltr">
                                            {tick === "pass" ? (
                                              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-emerald-600 text-white font-sans font-extrabold text-[9.5px] shrink-0">
                                                ✓
                                              </span>
                                            ) : tick === "trap" ? (
                                              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-rose-600 text-white font-sans font-extrabold text-[9.5px] shrink-0">
                                                ✕
                                              </span>
                                            ) : (
                                              <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-slate-100 text-slate-400 font-sans text-[9px] shrink-0">
                                                —
                                              </span>
                                            )}
                                            <span
                                              className={
                                                tick === "pass"
                                                  ? "font-extrabold text-emerald-900"
                                                  : tick === "trap"
                                                    ? "font-extrabold text-rose-800"
                                                    : "text-slate-600 font-medium"
                                              }
                                            >
                                              {txt}
                                            </span>
                                          </div>
                                          {sub && (
                                            <span className="text-[8.5px] font-mono text-slate-500 mt-0.5" dir="ltr">
                                              {sub}
                                            </span>
                                          )}
                                        </div>
                                      );
                                      return (
                                        <tr
                                          key={r.key}
                                          data-testid={r.testId}
                                          className="hover:bg-sky-50/40 transition-colors"
                                        >
                                          <td className="py-1 px-2 align-middle">
                                            <div className="font-bold text-slate-900 leading-snug">
                                              {idx + 1}. {r.stepTitle}
                                            </div>
                                            {r.stepSub && (
                                              <div className="text-[8.5px] font-bold text-indigo-800 leading-tight mt-0.5">
                                                {r.stepSub}
                                              </div>
                                            )}
                                          </td>
                                          <td
                                            className={`py-1 px-1.5 border-r border-slate-100 align-middle ${
                                              r.hTick === "pass"
                                                ? "bg-emerald-50/55"
                                                : r.hTick === "trap"
                                                  ? "bg-rose-50/55"
                                                  : ""
                                            }`}
                                          >
                                            {renderCell(r.hText, r.hSub, r.hTick)}
                                          </td>
                                          <td
                                            className={`py-1 px-1.5 border-r border-slate-100 align-middle ${
                                              r.aTick === "pass"
                                                ? "bg-emerald-50/55"
                                                : r.aTick === "trap"
                                                  ? "bg-rose-50/55"
                                                  : ""
                                            }`}
                                          >
                                            {renderCell(r.aText, r.aSub, r.aTick)}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              )}
                            </div>

                            {/* ============================================================ */}
                            {/* SMART ANTI-NO-BET BOX (Collapsible Dropdown)                 */}
                            {/* ============================================================ */}
                            {showAntiNoBetBox && (
                              <div
                                data-testid={`box-anti-nobet-${g.n}`}
                                className={`rounded-lg border overflow-hidden shadow-2xs ${
                                  anb.kind === "DIRECT_RELEASE" || anb.kind === "M12_CORE"
                                    ? "border-emerald-400 bg-white"
                                    : anb.kind === "OPPOSITE_FLIP"
                                      ? "border-indigo-400 bg-white"
                                      : "border-slate-300 bg-white"
                                }`}
                              >
                                <button
                                  type="button"
                                  data-testid={`toggle-anb-${g.n}`}
                                  onClick={() => toggleCardBox(g.n, "smart")}
                                  className={`w-full px-2.5 py-1.5 flex flex-wrap items-center justify-between gap-1.5 text-[10px] text-right transition-colors ${
                                    anb.kind === "DIRECT_RELEASE" || anb.kind === "M12_CORE"
                                      ? "bg-emerald-100/85 hover:bg-emerald-200/70 border-emerald-200"
                                      : anb.kind === "OPPOSITE_FLIP"
                                        ? "bg-indigo-100/85 hover:bg-indigo-200/70 border-indigo-200"
                                        : "bg-slate-100 hover:bg-slate-200/70 border-slate-200"
                                  } ${isSmartBoxOpen ? "border-b" : ""}`}
                                >
                                  <span className="font-extrabold text-slate-950">
                                    باکس ضد NO-BET هوشمند
                                  </span>
                                  <div className="inline-flex items-center gap-1 shrink-0">
                                    <span
                                      dir="ltr"
                                      className="whitespace-nowrap font-mono font-extrabold text-[9.5px] px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-800"
                                    >
                                      {g.hc}: {anbHomeTicks}✓ | {g.ac}: {anbAwayTicks}✓
                                    </span>
                                    <span
                                      className={`px-1.5 py-0.5 rounded font-extrabold text-[9px] border ${
                                        anb.sig
                                          ? "bg-emerald-600 text-white border-emerald-700"
                                          : "bg-white text-slate-600 border-slate-300"
                                      }`}
                                    >
                                      {anb.sig ? `✓ ${getTeam3Code(anb.pick)}` : "بدون بت"}
                                    </span>
                                    {anbWon !== null && (
                                      <span
                                        className={`px-1.5 py-0.5 rounded font-extrabold text-[9px] border ${
                                          anbWon
                                            ? "bg-emerald-600 text-white border-emerald-700"
                                            : "bg-rose-600 text-white border-rose-700"
                                        }`}
                                      >
                                        {anbWon ? "برد ✓" : "باخت ✕"}
                                      </span>
                                    )}
                                    <span className="px-1.5 py-0.5 rounded bg-white/90 border border-slate-300 text-slate-800 font-extrabold text-[9px]">
                                      {isSmartBoxOpen ? "بستن ▲" : "باز کردن ▼"}
                                    </span>
                                  </div>
                                </button>

                                {isSmartBoxOpen && (
                                  <>
                                    <table className="w-full text-[10px] border-collapse">
                                      <thead>
                                        <tr className="bg-slate-50 border-b border-slate-100 text-slate-700">
                                          <th className="py-1 px-2 text-right font-extrabold w-[40%]">شاخص ضد NO-BET</th>
                                          <th className="py-1 px-1.5 text-center font-extrabold border-r border-slate-100 w-[30%]">
                                            بازیکن ۱ ({g.hc})
                                          </th>
                                          <th className="py-1 px-1.5 text-center font-extrabold border-r border-slate-100 w-[30%]">
                                            بازیکن ۲ ({g.ac})
                                          </th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100">
                                        {anbRows.map((r, idx) => {
                                          const renderAnbCell = (txt: string, sub: string | undefined, tick: CheckTick) => (
                                            <div className="flex flex-col items-center justify-center leading-tight py-0.5">
                                              <div className="inline-flex items-center gap-1 font-mono tabular-nums" dir="ltr">
                                                {tick === "pass" ? (
                                                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-emerald-600 text-white font-sans font-extrabold text-[9.5px] shrink-0">
                                                    ✓
                                                  </span>
                                                ) : tick === "trap" ? (
                                                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-rose-600 text-white font-sans font-extrabold text-[9.5px] shrink-0">
                                                    ✕
                                                  </span>
                                                ) : (
                                                  <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-slate-100 text-slate-400 font-sans text-[9px] shrink-0">
                                                    —
                                                  </span>
                                                )}
                                                <span
                                                  className={
                                                    tick === "pass"
                                                      ? "font-extrabold text-emerald-900"
                                                      : tick === "trap"
                                                        ? "font-extrabold text-rose-800"
                                                        : "text-slate-600 font-medium"
                                                  }
                                                >
                                                  {txt}
                                                </span>
                                              </div>
                                              {sub && (
                                                <span className="text-[8.5px] font-mono text-slate-500 mt-0.5" dir="ltr">
                                                  {sub}
                                                </span>
                                              )}
                                            </div>
                                          );
                                          return (
                                            <tr
                                              key={r.key}
                                              data-testid={r.testId}
                                              className="hover:bg-sky-50/40 transition-colors"
                                            >
                                              <td className="py-1 px-2 align-middle">
                                                <div className="font-bold text-slate-900 leading-snug">
                                                  {idx + 1}. {r.stepTitle}
                                                </div>
                                                {r.stepSub && (
                                                  <div className="text-[8.5px] font-bold text-indigo-800 leading-tight mt-0.5">
                                                    {r.stepSub}
                                                  </div>
                                                )}
                                              </td>
                                              <td
                                                className={`py-1 px-1.5 border-r border-slate-100 align-middle ${
                                                  r.hTick === "pass"
                                                    ? "bg-emerald-50/55"
                                                    : r.hTick === "trap"
                                                      ? "bg-rose-50/55"
                                                      : ""
                                                }`}
                                              >
                                                {renderAnbCell(r.hText, r.hSub, r.hTick)}
                                              </td>
                                              <td
                                                className={`py-1 px-1.5 border-r border-slate-100 align-middle ${
                                                  r.aTick === "pass"
                                                    ? "bg-emerald-50/55"
                                                    : r.aTick === "trap"
                                                      ? "bg-rose-50/55"
                                                      : ""
                                                }`}
                                              >
                                                {renderAnbCell(r.aText, r.aSub, r.aTick)}
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>

                                    <div
                                      data-testid={`anti-nobet-verdict-${g.n}`}
                                      className={`px-2.5 py-1.5 border-t flex items-center justify-between gap-2 text-[10px] ${
                                        anb.kind === "DIRECT_RELEASE" || anb.kind === "M12_CORE"
                                          ? "bg-emerald-50 border-emerald-200 text-emerald-950"
                                          : anb.kind === "OPPOSITE_FLIP"
                                            ? "bg-indigo-50 border-indigo-200 text-indigo-950"
                                            : "bg-slate-50 border-slate-200 text-slate-700"
                                      }`}
                                    >
                                      <div className="min-w-0">
                                        <div className="font-extrabold leading-snug">
                                          {anb.kind === "DIRECT_RELEASE" ? (
                                            <>
                                              ✓ گروه ۱ (مستقیم): برد{" "}
                                              <span dir="ltr" className="inline-block font-mono">
                                                {anb.pick} ({getTeam3Code(anb.pick)})
                                              </span>
                                            </>
                                          ) : anb.kind === "OPPOSITE_FLIP" ? (
                                            <>
                                              ↺ گروه ۲ (بازیکن مقابل): برد{" "}
                                              <span dir="ltr" className="inline-block font-mono">
                                                {anb.pick} ({shortCode(anb.pick)})
                                              </span>{" "}
                                              — مقابلِ{" "}
                                              <span dir="ltr" className="inline-block font-mono">
                                                {shortCode(anb.baseM12Pick)}
                                              </span>
                                            </>
                                          ) : anb.kind === "M12_CORE" ? (
                                            <>
                                              ✓ سیگنال اصلی حالت ۱۲:{" "}
                                              <span dir="ltr" className="inline-block font-mono">
                                                {anb.pick} ({getTeam3Code(anb.pick)})
                                              </span>
                                            </>
                                          ) : (
                                            <>⛔ توقف واقعی ضد NO-BET — بدون بت</>
                                          )}
                                        </div>
                                        <div className="text-[9px] text-slate-600 mt-0.5 leading-snug">
                                          {anb.reasonFa}
                                        </div>
                                      </div>
                                      {anbWon !== null && (
                                        <span
                                          className={`shrink-0 px-2 py-0.5 rounded font-extrabold text-[9.5px] border ${
                                            anbWon
                                              ? "bg-emerald-600 text-white border-emerald-700"
                                              : "bg-rose-600 text-white border-rose-700"
                                          }`}
                                        >
                                          {anbWon ? "برد ✓" : "باخت ✕"}
                                        </span>
                                      )}
                                    </div>
                                  </>
                                )}
                              </div>
                            )}

                            {/* ============================================================ */}
                            {/* SMART MODE 14 BOX (Collapsible Dropdown)                     */}
                            {/* ============================================================ */}
                            {showSmartM14Box && (
                              <div
                                data-testid={`box-smart-m14-${g.n}`}
                                className={`rounded-lg border overflow-hidden shadow-2xs ${
                                  sm14.kind === "M14_CORE_CLEAN" || sm14.kind === "M14_DIRECT_RELEASE"
                                    ? "border-emerald-400 bg-white"
                                    : sm14.kind === "M14_OPPOSITE_FLIP" || sm14.kind === "M14_TRAP_FLIP"
                                      ? "border-indigo-400 bg-white"
                                      : sm14.kind === "M14_VETO_TRAP"
                                        ? "border-rose-400 bg-white"
                                        : "border-slate-300 bg-white"
                                }`}
                              >
                                <button
                                  type="button"
                                  data-testid={`toggle-sm14-${g.n}`}
                                  onClick={() => toggleCardBox(g.n, "smart")}
                                  className={`w-full px-2.5 py-1.5 flex flex-wrap items-center justify-between gap-1.5 text-[10px] text-right transition-colors ${
                                    sm14.kind === "M14_CORE_CLEAN" || sm14.kind === "M14_DIRECT_RELEASE"
                                      ? "bg-emerald-100/85 hover:bg-emerald-200/70 border-emerald-200"
                                      : sm14.kind === "M14_OPPOSITE_FLIP" || sm14.kind === "M14_TRAP_FLIP"
                                        ? "bg-indigo-100/85 hover:bg-indigo-200/70 border-indigo-200"
                                        : sm14.kind === "M14_VETO_TRAP"
                                          ? "bg-rose-100/85 hover:bg-rose-200/70 border-rose-200"
                                          : "bg-slate-100 hover:bg-slate-200/70 border-slate-200"
                                  } ${isSmartBoxOpen ? "border-b" : ""}`}
                                >
                                  <span className="font-extrabold text-slate-950">
                                    باکس هوشمند حالت ۱۴ • اصلاح خطا و بازیکن مقابل
                                  </span>
                                  <div className="inline-flex items-center gap-1 shrink-0">
                                    <span
                                      dir="ltr"
                                      className="whitespace-nowrap font-mono font-extrabold text-[9.5px] px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-800"
                                    >
                                      {g.hc}: {sm14HomeTicks}✓ | {g.ac}: {sm14AwayTicks}✓
                                    </span>
                                    <span
                                      className={`px-1.5 py-0.5 rounded font-extrabold text-[9px] border ${
                                        sm14.sig
                                          ? sm14.kind === "M14_OPPOSITE_FLIP" || sm14.kind === "M14_TRAP_FLIP"
                                            ? "bg-indigo-600 text-white border-indigo-700"
                                            : "bg-emerald-600 text-white border-emerald-700"
                                          : sm14.kind === "M14_VETO_TRAP"
                                            ? "bg-rose-600 text-white border-rose-700"
                                            : "bg-white text-slate-600 border-slate-300"
                                      }`}
                                    >
                                      {sm14.sig
                                        ? `${sm14.kind === "M14_OPPOSITE_FLIP" || sm14.kind === "M14_TRAP_FLIP" ? "↺" : "✓"} ${getTeam3Code(sm14.pick)}`
                                        : sm14.kind === "M14_VETO_TRAP"
                                          ? "✕ مهار تله"
                                          : "بدون بت"}
                                    </span>
                                    {sm14Won !== null && (
                                      <span
                                        className={`px-1.5 py-0.5 rounded font-extrabold text-[9px] border ${
                                          sm14Won
                                            ? "bg-emerald-600 text-white border-emerald-700"
                                            : "bg-rose-600 text-white border-rose-700"
                                        }`}
                                      >
                                        {sm14Won ? "برد ✓" : "باخت ✕"}
                                      </span>
                                    )}
                                    <span className="px-1.5 py-0.5 rounded bg-white/90 border border-slate-300 text-slate-800 font-extrabold text-[9px]">
                                      {isSmartBoxOpen ? "بستن ▲" : "باز کردن ▼"}
                                    </span>
                                  </div>
                                </button>

                                {isSmartBoxOpen && (
                                  <>
                                    <table className="w-full text-[10px] border-collapse">
                                      <thead>
                                        <tr className="bg-slate-50 border-b border-slate-100 text-slate-700">
                                          <th className="py-1 px-2 text-right font-extrabold w-[40%]">شاخص هوشمند ۱۴</th>
                                          <th className="py-1 px-1.5 text-center font-extrabold border-r border-slate-100 w-[30%]">
                                            بازیکن ۱ ({g.hc})
                                          </th>
                                          <th className="py-1 px-1.5 text-center font-extrabold border-r border-slate-100 w-[30%]">
                                            بازیکن ۲ ({g.ac})
                                          </th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100">
                                        {sm14Rows.map((r, idx) => {
                                          const renderSm14Cell = (txt: string, sub: string | undefined, tick: CheckTick) => (
                                            <div className="flex flex-col items-center justify-center leading-tight py-0.5">
                                              <div className="inline-flex items-center gap-1 font-mono tabular-nums" dir="ltr">
                                                {tick === "pass" ? (
                                                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-emerald-600 text-white font-sans font-extrabold text-[9.5px] shrink-0">
                                                    ✓
                                                  </span>
                                                ) : tick === "trap" ? (
                                                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-rose-600 text-white font-sans font-extrabold text-[9.5px] shrink-0">
                                                    ✕
                                                  </span>
                                                ) : (
                                                  <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-slate-100 text-slate-400 font-sans text-[9px] shrink-0">
                                                    —
                                                  </span>
                                                )}
                                                <span
                                                  className={
                                                    tick === "pass"
                                                      ? "font-extrabold text-emerald-900"
                                                      : tick === "trap"
                                                        ? "font-extrabold text-rose-800"
                                                        : "text-slate-600 font-medium"
                                                  }
                                                >
                                                  {txt}
                                                </span>
                                              </div>
                                              {sub && (
                                                <span className="text-[8.5px] font-mono text-slate-500 mt-0.5" dir="ltr">
                                                  {sub}
                                                </span>
                                              )}
                                            </div>
                                          );
                                          return (
                                            <tr
                                              key={r.key}
                                              data-testid={r.testId}
                                              className="hover:bg-sky-50/40 transition-colors"
                                            >
                                              <td className="py-1 px-2 align-middle">
                                                <div className="font-bold text-slate-900 leading-snug">
                                                  {idx + 1}. {r.stepTitle}
                                                </div>
                                                {r.stepSub && (
                                                  <div className="text-[8.5px] font-bold text-indigo-800 leading-tight mt-0.5">
                                                    {r.stepSub}
                                                  </div>
                                                )}
                                              </td>
                                              <td
                                                className={`py-1 px-1.5 border-r border-slate-100 align-middle ${
                                                  r.hTick === "pass"
                                                    ? "bg-emerald-50/55"
                                                    : r.hTick === "trap"
                                                      ? "bg-rose-50/55"
                                                      : ""
                                                }`}
                                              >
                                                {renderSm14Cell(r.hText, r.hSub, r.hTick)}
                                              </td>
                                              <td
                                                className={`py-1 px-1.5 border-r border-slate-100 align-middle ${
                                                  r.aTick === "pass"
                                                    ? "bg-emerald-50/55"
                                                    : r.aTick === "trap"
                                                      ? "bg-rose-50/55"
                                                      : ""
                                                }`}
                                              >
                                                {renderSm14Cell(r.aText, r.aSub, r.aTick)}
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>

                                    <div
                                      data-testid={`smart-m14-verdict-${g.n}`}
                                      className={`px-2.5 py-1.5 border-t flex items-center justify-between gap-2 text-[10px] ${
                                        sm14.kind === "M14_CORE_CLEAN" || sm14.kind === "M14_DIRECT_RELEASE"
                                          ? "bg-emerald-50 border-emerald-200 text-emerald-950"
                                          : sm14.kind === "M14_OPPOSITE_FLIP" || sm14.kind === "M14_TRAP_FLIP"
                                            ? "bg-indigo-50 border-indigo-200 text-indigo-950"
                                            : sm14.kind === "M14_VETO_TRAP"
                                              ? "bg-rose-50 border-rose-200 text-rose-950"
                                              : "bg-slate-50 border-slate-200 text-slate-700"
                                      }`}
                                    >
                                      <div className="min-w-0">
                                        <div className="font-extrabold leading-snug">
                                          {sm14.kind === "M14_CORE_CLEAN" ? (
                                            <>
                                              ✓ سیگنال سالم حالت ۱۴:{" "}
                                              <span dir="ltr" className="inline-block font-mono">
                                                {sm14.pick} ({getTeam3Code(sm14.pick)})
                                              </span>
                                            </>
                                          ) : sm14.kind === "M14_DIRECT_RELEASE" ? (
                                            <>
                                              ✓ قانون ۳ (آزادسازی مستقیم Log5≥75%): برد{" "}
                                              <span dir="ltr" className="inline-block font-mono">
                                                {sm14.pick} ({getTeam3Code(sm14.pick)})
                                              </span>
                                            </>
                                          ) : sm14.kind === "M14_TRAP_FLIP" ? (
                                            <>
                                              ↺ قانون ۱+۲ (حذف تله بازنده → برد بازیکن مقابل):{" "}
                                              <span dir="ltr" className="inline-block font-mono">
                                                {sm14.pick} ({shortCode(sm14.pick)})
                                              </span>{" "}
                                              — ردِ{" "}
                                              <span dir="ltr" className="inline-block font-mono">
                                                {shortCode(sm14.baseM14Pick)}
                                              </span>
                                            </>
                                          ) : sm14.kind === "M14_OPPOSITE_FLIP" ? (
                                            <>
                                              ↺ قانون ۲ (چرخش به بازیکن مقابل): برد{" "}
                                              <span dir="ltr" className="inline-block font-mono">
                                                {sm14.pick} ({shortCode(sm14.pick)})
                                              </span>{" "}
                                              — مقابلِ{" "}
                                              <span dir="ltr" className="inline-block font-mono">
                                                {shortCode(sm14.baseM14Pick)}
                                              </span>
                                            </>
                                          ) : sm14.kind === "M14_VETO_TRAP" ? (
                                            <>
                                              ✕ مهار تله سمت بازنده ({shortCode(sm14.baseM14Pick)}) → مسیر جایگزین بدون بت:{" "}
                                              <span dir="ltr" className="inline-block font-mono">
                                                {sm14.pick} ({shortCode(sm14.pick)})
                                              </span>
                                            </>
                                          ) : (
                                            <>⛔ توقف ایمنی حالت ۱۴ — بدون بت</>
                                          )}
                                        </div>
                                        <div className="text-[9px] text-slate-600 mt-0.5 leading-snug">
                                          {sm14.reasonFa}
                                        </div>
                                      </div>
                                      {sm14Won !== null && (
                                        <span
                                          className={`shrink-0 px-2 py-0.5 rounded font-extrabold text-[9.5px] border ${
                                            sm14Won
                                              ? "bg-emerald-600 text-white border-emerald-700"
                                              : "bg-rose-600 text-white border-rose-700"
                                          }`}
                                        >
                                          {sm14Won ? "برد ✓" : "باخت ✕"}
                                        </span>
                                      )}
                                      {sm14SavedTrap !== null && (
                                        <span
                                          className={`shrink-0 px-2 py-0.5 rounded font-extrabold text-[9.5px] border ${
                                            sm14SavedTrap
                                              ? "bg-emerald-600 text-white border-emerald-700"
                                              : "bg-amber-100 text-amber-950 border-amber-400"
                                          }`}
                                        >
                                          {sm14SavedTrap ? "مهار باخت ✓" : "رد محتاطانه"}
                                        </span>
                                      )}
                                    </div>
                                  </>
                                )}
                              </div>
                            )}

                            {/* ============================================================ */}
                            {/* BOX 2: Collapsible Dropdown — Final Verdict & Mode 14 Boxes  */}
                            {/* ============================================================ */}
                            <div
                              data-testid={`box2-verdict-${g.n}`}
                              className={`rounded-lg border overflow-hidden shadow-2xs ${
                                isMode17 && m17
                                  ? m17.tier === "black_diamond"
                                    ? "border-amber-500 bg-amber-50/45"
                                    : m17.tier === "pure_astro"
                                      ? "border-violet-400 bg-violet-50/40"
                                      : m17.tier === "daily_gold"
                                        ? "border-amber-400 bg-amber-50/40"
                                        : m17.tier === "standard"
                                          ? "border-emerald-400 bg-emerald-50/40"
                                          : "border-slate-300 bg-slate-50/50"
                                  : isQualified && isVip3
                                    ? "border-amber-400 bg-amber-50/40"
                                    : isQualified
                                      ? "border-emerald-400 bg-emerald-50/40"
                                      : isSafetyHold
                                        ? "border-amber-300 bg-amber-50/30"
                                        : "border-slate-300 bg-white"
                              }`}
                            >
                              <button
                                type="button"
                                data-testid={`toggle-box2-${g.n}`}
                                onClick={() => toggleCardBox(g.n, "box2")}
                                className="w-full px-2.5 py-1.5 bg-slate-100/90 hover:bg-slate-200/75 transition-colors border-b border-slate-200 flex flex-wrap items-center justify-between gap-1.5 text-[10px] text-right"
                              >
                                <span className="font-extrabold text-slate-900">
                                  باکس ۲ • حکم نهایی، قفل و پیش‌بینی مسابقه
                                </span>
                                <div className="inline-flex items-center gap-1 shrink-0">
                                  <span
                                    dir="ltr"
                                    className="font-mono font-extrabold text-[9.5px] px-1.5 py-0.5 rounded bg-white border border-slate-300 text-slate-900"
                                  >
                                    {shortCode(predTeam)}
                                  </span>
                                  <span
                                    data-testid={`badge-preset-status-${g.n}`}
                                    className={`px-2 py-0.5 rounded text-[9.5px] font-extrabold border ${
                                      isMode17 && m17
                                        ? m17BadgeCls
                                        : isQualified && isVip3
                                          ? "bg-amber-400 text-slate-950 border-amber-500"
                                          : isQualified
                                            ? "bg-emerald-600 text-white border-emerald-700"
                                            : isSafetyHold
                                              ? "bg-rose-600 text-white border-rose-700"
                                              : "bg-slate-200 text-slate-700 border-slate-300"
                                    }`}
                                  >
                                    {isMode17 && m17
                                      ? m17.badgeFa
                                      : isQualified && isVip3
                                        ? "★ سیگنال ویژه VIP"
                                        : isQualified
                                          ? "✓ سیگنال فعال"
                                          : isSafetyHold
                                            ? "⛔ مهار قفل ایمنی"
                                            : "خارج از سیگنال"}
                                  </span>
                                  <span className="px-1.5 py-0.5 rounded bg-white border border-slate-300 text-slate-800 font-extrabold text-[9px]">
                                    {isBox2Open ? "بستن ▲" : "باز کردن ▼"}
                                  </span>
                                </div>
                              </button>

                              {isBox2Open && (
                                <div className="p-2.5 pb-1.5 space-y-2 text-[10.5px]">
                                  {/* Used Lock Row */}
                                  <div
                                    data-testid={`text-lock-used-${g.n}`}
                                    className="rounded-md bg-white border border-slate-200 px-2.5 py-1.5"
                                  >
                                    <div className="text-[9.5px] text-slate-500 font-bold">
                                      قفل و مرحله استفاده‌شده ({activePresetLabel}):
                                    </div>
                                    <div className="font-extrabold text-slate-900 mt-0.5 leading-snug">
                                      {lockTitleFa}
                                    </div>
                                    {lockReasonFa && lockReasonFa !== lockTitleFa && (
                                      <div className="text-[9.5px] text-sky-900 font-semibold mt-0.5 leading-snug">
                                        {lockReasonFa}
                                      </div>
                                    )}
                                  </div>

                                  {/* Final Prediction Row */}
                                  <div
                                    data-testid={`text-final-pred-${g.n}`}
                                    className={`rounded-md px-2.5 py-1.5 border flex flex-wrap items-center justify-between gap-1.5 ${
                                      isQualified
                                        ? "bg-emerald-100/80 border-emerald-400 text-emerald-950"
                                        : "bg-sky-50/80 border-sky-200 text-slate-800"
                                    }`}
                                  >
                                    <span className="font-bold text-[10px] shrink-0">
                                      {isQualified
                                        ? "پیش‌بینی نهایی سیگنال:"
                                        : isTotalElem12Mode && sm14.kind === "M14_VETO_TRAP"
                                          ? `مسیر جایگزین ضدتله (ردِ ${getTeam3Code(sm14.baseM14Pick)} • بدون بت):`
                                          : "مسیر پیشنهادی (بدون بت):"}
                                    </span>
                                    <span className="inline-flex items-center gap-1.5 font-extrabold text-xs">
                                      <bdi dir="ltr">{predTeam} ({shortCode(predTeam)})</bdi>
                                      <span className="px-1.5 py-0.5 rounded bg-white/90 border border-slate-300 text-[9.5px] font-bold text-slate-800 shrink-0">
                                        {homeFav ? "بازیکن ۱ (P1)" : "بازیکن ۲ (P2)"} {isQualified ? "✓" : ""}
                                      </span>
                                    </span>
                                  </div>
                                </div>
                              )}

                              {isTotalElem12Mode && (
                                <div className="px-2.5 py-2 space-y-2 text-[10px]">
                                  {/* Collapsible Sub-Box 2A: Dominant Element [F-A-W-E] */}
                                  <div
                                    data-testid={`box2-dom-elem-${g.n}`}
                                    className={`rounded-lg border overflow-hidden shadow-2xs ${
                                      sm14.dualWaterTrap
                                        ? "bg-rose-50 border-rose-300 text-rose-950"
                                        : sm14.hLeadCnt === 3 || sm14.aLeadCnt === 3 || sm14.domSplit
                                          ? "bg-indigo-50/80 border-indigo-300 text-indigo-950"
                                          : "bg-sky-50/80 border-sky-300 text-slate-800"
                                    }`}
                                  >
                                    <button
                                      type="button"
                                      data-testid={`toggle-dom-${g.n}`}
                                      onClick={() => toggleCardBox(g.n, "dom")}
                                      className={`w-full px-2.5 py-1.5 flex flex-wrap items-center justify-between gap-1.5 text-right hover:bg-sky-100/60 transition-colors ${
                                        isDomBoxOpen ? "border-b border-sky-200" : ""
                                      }`}
                                    >
                                      <span className="font-extrabold shrink-0">
                                        المنت غالب [F-A-W-E]:
                                      </span>
                                      <div className="flex flex-wrap items-center justify-end gap-1 min-w-0">
                                        <span className="font-mono font-bold tabular-nums bg-white/90 px-1.5 py-0.5 rounded border border-sky-200 text-[9px]" dir="ltr">
                                          {g.hc}: {sm14.hDomInfo.dom}({sm14.hDomInfo.maxCnt}) | {g.ac}: {sm14.aDomInfo.dom}({sm14.aDomInfo.maxCnt})
                                        </span>
                                        <span
                                          className={`px-1.5 py-0.5 rounded font-extrabold text-[9px] border ${
                                            sm14.dualWaterTrap
                                              ? "bg-rose-600 text-white border-rose-700"
                                              : sm14.hLeadCnt === 3 || sm14.aLeadCnt === 3
                                                ? "bg-amber-400 text-slate-950 border-amber-500"
                                                : (sm14.hDomInfo.isTie && !sm14.aDomInfo.isTie) || (sm14.aDomInfo.isTie && !sm14.hDomInfo.isTie)
                                                  ? "bg-teal-600 text-white border-teal-700"
                                                  : sm14.domSplit
                                                    ? "bg-emerald-600 text-white border-emerald-700"
                                                    : "bg-white text-slate-700 border-slate-300"
                                          }`}
                                        >
                                          {sm14.dualWaterTrap
                                            ? "✕ تله ۲×WATER"
                                            : sm14.hLeadCnt === 3
                                              ? `★ برتری ۳/۴ (${g.hc})`
                                              : sm14.aLeadCnt === 3
                                                ? `★ برتری ۳/۴ (${g.ac})`
                                                : sm14.hDomInfo.isTie && !sm14.aDomInfo.isTie
                                                  ? `★ تعادل دوگانه (${g.hc})`
                                                  : sm14.aDomInfo.isTie && !sm14.hDomInfo.isTie
                                                    ? `★ تعادل دوگانه (${g.ac})`
                                                    : sm14.domSplit
                                                      ? "✓ شکاف المنت غالب"
                                                      : "هم‌المنت"}
                                        </span>
                                        <span className="px-1.5 py-0.5 rounded bg-white border border-sky-300 text-sky-950 font-extrabold text-[9px]">
                                          {isDomBoxOpen ? "بستن ▲" : "باز کردن ▼"}
                                        </span>
                                      </div>
                                    </button>

                                    {isDomBoxOpen && (
                                      <table className="w-full text-[9.5px] border-collapse bg-white/95 font-mono" dir="ltr">
                                        <thead>
                                          <tr className="bg-sky-50 border-b border-sky-100 text-slate-700">
                                            <th className="py-1 px-2 text-left font-extrabold">PLAYER</th>
                                            <th className="py-1 px-1 text-center font-extrabold">FIRE</th>
                                            <th className="py-1 px-1 text-center font-extrabold">AIR</th>
                                            <th className="py-1 px-1 text-center font-extrabold">WATER</th>
                                            <th className="py-1 px-1 text-center font-extrabold">EARTH</th>
                                            <th className="py-1 px-1.5 text-center font-extrabold">Σ</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-sky-100 text-slate-900">
                                          <tr>
                                            <td className="py-1 px-2 font-extrabold">{g.hc} (P1)</td>
                                            {[0, 1, 2, 3].map((idx) => (
                                              <td
                                                key={idx}
                                                className={`py-1 px-1 text-center font-bold ${
                                                  sm14.hDomInfo.vec[idx] > sm14.aDomInfo.vec[idx]
                                                    ? "bg-emerald-50 text-emerald-900 font-extrabold"
                                                    : ""
                                                }`}
                                              >
                                                {sm14.hDomInfo.vec[idx]}
                                              </td>
                                            ))}
                                            <td className="py-1 px-1.5 text-center font-extrabold bg-sky-50/70">
                                              {sm14.elemFollow.hSum}
                                            </td>
                                          </tr>
                                          <tr>
                                            <td className="py-1 px-2 font-extrabold">{g.ac} (P2)</td>
                                            {[0, 1, 2, 3].map((idx) => (
                                              <td
                                                key={idx}
                                                className={`py-1 px-1 text-center font-bold ${
                                                  sm14.aDomInfo.vec[idx] > sm14.hDomInfo.vec[idx]
                                                    ? "bg-emerald-50 text-emerald-900 font-extrabold"
                                                    : ""
                                                }`}
                                              >
                                                {sm14.aDomInfo.vec[idx]}
                                              </td>
                                            ))}
                                            <td className="py-1 px-1.5 text-center font-extrabold bg-sky-50/70">
                                              {sm14.elemFollow.aSum}
                                            </td>
                                          </tr>
                                        </tbody>
                                      </table>
                                    )}
                                  </div>

                                  {/* Collapsible Sub-Box 2B: Follow-Up Element Winner */}
                                  {(() => {
                                    const ef = sm14.elemFollow;
                                    const elemAlign =
                                      !ef.hasPick
                                        ? "NEUTRAL"
                                        : isQualified
                                          ? ef.pick === predTeam
                                            ? "AGREE"
                                            : "CLASH"
                                          : ef.pickL5 >= 60
                                            ? "LOG5_ALIGN"
                                            : "SOLO";
                                    const elemWon = hasFinalScore && ef.hasPick ? ef.pick === g.aw : null;
                                    const hTick: CheckTick =
                                      ef.pick === g.h ? "pass" : ef.oppTrapSide === g.h ? "trap" : "none";
                                    const aTick: CheckTick =
                                      ef.pick === g.a ? "pass" : ef.oppTrapSide === g.a ? "trap" : "none";
                                    return (
                                      <div
                                        data-testid={`box2-elem-followup-${g.n}`}
                                        className={`rounded-lg border overflow-hidden shadow-2xs text-[10px] ${
                                          elemAlign === "AGREE"
                                            ? "border-emerald-400 bg-sky-50/70"
                                            : elemAlign === "CLASH"
                                              ? "border-amber-400 bg-amber-50/50"
                                              : "border-sky-300 bg-sky-50/90"
                                        }`}
                                      >
                                        <button
                                          type="button"
                                          data-testid={`toggle-elem-${g.n}`}
                                          onClick={() => toggleCardBox(g.n, "elem")}
                                          className={`w-full px-2.5 py-1.5 flex flex-wrap items-center justify-between gap-1.5 text-right transition-colors ${
                                            elemAlign === "AGREE"
                                              ? "bg-emerald-100/80 hover:bg-emerald-200/70 border-emerald-200 text-emerald-950"
                                              : elemAlign === "CLASH"
                                                ? "bg-amber-100/85 hover:bg-amber-200/70 border-amber-300 text-amber-950"
                                                : "bg-sky-100/85 hover:bg-sky-200/70 border-sky-200 text-sky-950"
                                          } ${isElemBoxOpen ? "border-b" : ""}`}
                                        >
                                          <span className="font-extrabold">
                                            باکس برنده المنت غالب (قوانین فالوآپ):
                                          </span>
                                          <div className="flex flex-wrap items-center justify-end gap-1 min-w-0">
                                            <span
                                              dir="ltr"
                                              className="font-mono font-extrabold text-[9px] px-1.5 py-0.5 rounded bg-white border border-sky-200 text-slate-900"
                                            >
                                              {ef.hasPick ? `${getTeam3Code(ef.pick)} ✓` : "—"}
                                            </span>
                                            <span
                                              className={`px-1.5 py-0.5 rounded font-extrabold text-[9px] border shrink-0 ${
                                                elemAlign === "AGREE"
                                                  ? "bg-emerald-600 text-white border-emerald-700"
                                                  : elemAlign === "CLASH"
                                                    ? "bg-amber-500 text-slate-950 border-amber-600"
                                                    : elemAlign === "LOG5_ALIGN"
                                                      ? "bg-sky-600 text-white border-sky-700"
                                                      : ef.hasPick
                                                        ? "bg-white text-sky-950 border-sky-300"
                                                        : "bg-white text-slate-600 border-slate-300"
                                              }`}
                                            >
                                              {elemAlign === "AGREE"
                                                ? "✓ هم‌جهت با ۱۴"
                                                : elemAlign === "CLASH"
                                                  ? "⚠ تضاد با ۱۴"
                                                  : elemAlign === "LOG5_ALIGN"
                                                    ? "✓ جدول ≥60%"
                                                    : ef.hasPick
                                                      ? "مستقل المنت"
                                                      : "خنثی"}
                                            </span>
                                            {elemWon !== null && (
                                              <span
                                                className={`px-1.5 py-0.5 rounded font-extrabold text-[9px] border shrink-0 ${
                                                  elemWon
                                                    ? "bg-emerald-600 text-white border-emerald-700"
                                                    : "bg-rose-600 text-white border-rose-700"
                                                }`}
                                              >
                                                {elemWon ? "برد ✓" : "باخت ✕"}
                                              </span>
                                            )}
                                            <span className="px-1.5 py-0.5 rounded bg-white/95 border border-sky-300 text-sky-950 font-extrabold text-[9px]">
                                              {isElemBoxOpen ? "بستن ▲" : "باز کردن ▼"}
                                            </span>
                                          </div>
                                        </button>

                                        {isElemBoxOpen && (
                                          <>
                                            <table className="w-full text-[10px] border-collapse bg-white/85">
                                              <tbody>
                                                <tr>
                                                  <td className="py-1.5 px-2 text-right align-middle w-[40%]">
                                                    <div className="font-extrabold text-slate-900 leading-snug">
                                                      {ef.ruleTitleFa}
                                                    </div>
                                                    <div className="text-[9px] text-slate-600 font-mono tabular-nums mt-0.5" dir="ltr">
                                                      Σ[F-A-W-E]: {g.hc}={ef.hSum} | {g.ac}={ef.aSum}
                                                    </div>
                                                  </td>
                                                  <td
                                                    className={`py-1.5 px-1.5 text-center align-middle border-r border-sky-100 w-[30%] ${
                                                      hTick === "pass"
                                                        ? "bg-emerald-50/70"
                                                        : hTick === "trap"
                                                          ? "bg-rose-50/60"
                                                          : ""
                                                    }`}
                                                  >
                                                    <div className="inline-flex items-center gap-1 font-extrabold text-slate-900" dir="ltr">
                                                      {hTick === "pass" ? (
                                                        <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-emerald-600 text-white font-sans font-extrabold text-[9.5px] shrink-0">
                                                          ✓
                                                        </span>
                                                      ) : hTick === "trap" ? (
                                                        <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-rose-600 text-white font-sans font-extrabold text-[9.5px] shrink-0">
                                                          ✕
                                                        </span>
                                                      ) : (
                                                        <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-slate-200 text-slate-600 font-sans font-extrabold text-[9.5px] shrink-0">
                                                          —
                                                        </span>
                                                      )}
                                                      <span>{g.hc}: {ef.hLabel}</span>
                                                    </div>
                                                    <div className="text-[9px] text-slate-600 font-mono tabular-nums mt-0.5" dir="ltr">
                                                      [{sm14.hDomInfo.vecStr}]
                                                    </div>
                                                  </td>
                                                  <td
                                                    className={`py-1.5 px-1.5 text-center align-middle border-r border-sky-100 w-[30%] ${
                                                      aTick === "pass"
                                                        ? "bg-emerald-50/70"
                                                        : aTick === "trap"
                                                          ? "bg-rose-50/60"
                                                          : ""
                                                    }`}
                                                  >
                                                    <div className="inline-flex items-center gap-1 font-extrabold text-slate-900" dir="ltr">
                                                      {aTick === "pass" ? (
                                                        <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-emerald-600 text-white font-sans font-extrabold text-[9.5px] shrink-0">
                                                          ✓
                                                        </span>
                                                      ) : aTick === "trap" ? (
                                                        <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-rose-600 text-white font-sans font-extrabold text-[9.5px] shrink-0">
                                                          ✕
                                                        </span>
                                                      ) : (
                                                        <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-slate-200 text-slate-600 font-sans font-extrabold text-[9.5px] shrink-0">
                                                          —
                                                        </span>
                                                      )}
                                                      <span>{g.ac}: {ef.aLabel}</span>
                                                    </div>
                                                    <div className="text-[9px] text-slate-600 font-mono tabular-nums mt-0.5" dir="ltr">
                                                      [{sm14.aDomInfo.vecStr}]
                                                    </div>
                                                  </td>
                                                </tr>
                                              </tbody>
                                            </table>

                                            <div className="px-2.5 py-1 border-t border-sky-200/80 bg-sky-50/90 flex flex-wrap items-center justify-between gap-1.5">
                                              <span className="font-extrabold text-slate-900">
                                                {ef.hasPick ? (
                                                  <>
                                                    بازیکن برنده المنت غالب:{" "}
                                                    <span dir="ltr" className="inline-block font-mono text-sky-950">
                                                      {ef.pick} ({getTeam3Code(ef.pick)})
                                                    </span>
                                                  </>
                                                ) : (
                                                  "بازیکن برنده المنت غالب: — خنثی (جلوگیری از ورود نویز)"
                                                )}
                                              </span>
                                              {hasFinalScore ? (
                                                ef.hasPick ? (
                                                  <span
                                                    data-testid={`elem-followup-outcome-${g.n}`}
                                                    className={`px-1.5 py-0.5 rounded font-extrabold text-[9.5px] border shrink-0 ${
                                                      elemWon
                                                        ? "bg-emerald-600 text-white border-emerald-700"
                                                        : "bg-rose-600 text-white border-rose-700"
                                                    }`}
                                                  >
                                                    {elemWon ? "درستی پیش‌بینی المنت: برد ✓" : "درستی پیش‌بینی المنت: باخت ✕"}
                                                  </span>
                                                ) : (
                                                  <span
                                                    data-testid={`elem-followup-outcome-${g.n}`}
                                                    className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 border border-slate-300 font-bold text-[9.5px] shrink-0"
                                                  >
                                                    نتیجه المنت: خنثی —
                                                  </span>
                                                )
                                              ) : (
                                                <span className="px-1.5 py-0.5 rounded bg-white text-sky-900 border border-sky-300 font-bold text-[9px] shrink-0">
                                                  {ef.tier === "STRONG" ? "قانون قوی فالوآپ ★" : ef.tier === "MEDIUM" ? "قانون متوسط فالوآپ" : "بدون حکم"}
                                                </span>
                                              )}
                                            </div>
                                          </>
                                        )}
                                      </div>
                                    );
                                  })()}

                                  {/* Collapsible Sub-Box 2C: Ticked 4-Pattern Fusion Box */}
                                  {(() => {
                                    const ef = sm14.elemFollow;
                                    const f4 = sm14.fusion4;
                                    const f4Won = hasFinalScore && f4.active ? f4.pick === g.aw : null;
                                    const f4SavedAir = hasFinalScore && f4.p4AirTrap ? f4.sugPick !== g.aw : null;
                                    const f4Rows: CheckRow[] = [
                                      {
                                        key: "f4_p1",
                                        testId: `row-f4-p1-${g.n}`,
                                        stepTitle: "۱. هم‌جهتی دو باکس + بازیکن ۱ + مسیر ۱۱",
                                        stepSub: "قوی≥52% یا متوسط≥58%",
                                        hText: f4.p1Hit
                                          ? "تایید پترن ۱"
                                          : !ef.hasPick
                                            ? "المنت خنثی"
                                            : ef.pick !== g.h
                                              ? "المنت بازیکن ۲"
                                              : !f4.agreeBoxes
                                                ? "تضاد دو باکس"
                                                : !f4.epM11Dir
                                                  ? "بدون مسیر M11"
                                                  : ef.tier === "STRONG"
                                                    ? `Elo:${sm14.hL5}%<52%`
                                                    : `Elo:${sm14.hL5}%<58%`,
                                        hSub: f4.p1Hit ? `Elo:${sm14.hL5}% • M11✓` : undefined,
                                        hTick: f4.p1Hit ? "pass" : "none",
                                        aText: "ویژه بازیکن ۱",
                                        aTick: "none",
                                      },
                                      {
                                        key: "f4_p2",
                                        testId: `row-f4-p2-${g.n}`,
                                        stepTitle: "۲. هم‌جهتی با سیگنال ۱۴ / زاویه T / قفل ۱۱ / Σ",
                                        stepSub: "تاریخچه ۸۳.۷٪ (فصل ۲۶-۲۷: ۳۱/۳۱ = ۱۰۰٪)",
                                        hText:
                                          f4.p2Hit && ef.pick === g.h
                                            ? "تایید پترن ۲"
                                            : ef.pick === g.h && f4.agreeBoxes
                                              ? ef.tier !== "STRONG"
                                                ? "المنت متوسط"
                                                : "بدون قفل۱۱/Σ"
                                              : "غیرفعال",
                                        hSub:
                                          f4.p2Hit && ef.pick === g.h
                                            ? !f4.isNoBetM14 && f4.epM11Sig
                                              ? "سیگنال ۱۴ + قفل M11"
                                              : !f4.isNoBetM14
                                                ? "هم‌جهت سیگنال ۱۴ ✓"
                                                : f4.epM11Sig
                                                  ? "قفل M11 فعال"
                                                  : f4.sugTeamSig
                                                    ? "سیگنال T + المنت قوی"
                                                    : "GF + Σ + ≥60%"
                                            : undefined,
                                        hTick: f4.p2Hit && ef.pick === g.h ? "pass" : "none",
                                        aText:
                                          f4.p2Hit && ef.pick === g.a
                                            ? "تایید پترن ۲"
                                            : ef.pick === g.a && f4.agreeBoxes
                                              ? ef.tier !== "STRONG"
                                                ? "المنت متوسط"
                                                : "بدون قفل۱۱/Σ"
                                              : "غیرفعال",
                                        aSub:
                                          f4.p2Hit && ef.pick === g.a
                                            ? !f4.isNoBetM14 && f4.epM11Sig
                                              ? "سیگنال ۱۴ + قفل M11"
                                              : !f4.isNoBetM14
                                                ? "هم‌جهت سیگنال ۱۴ ✓"
                                                : f4.epM11Sig
                                                  ? "قفل M11 فعال"
                                                  : f4.sugTeamSig
                                                    ? "سیگنال T + المنت قوی"
                                                    : "GF + Σ + ≥60%"
                                            : undefined,
                                        aTick: f4.p2Hit && ef.pick === g.a ? "pass" : "none",
                                      },
                                      {
                                        key: "f4_p3",
                                        testId: `row-f4-p3-${g.n}`,
                                        stepTitle: "۳. المنت قوی + بُعد فردی + Surface Elo ≥62%",
                                        stepSub: "تاریخچه ۷۸.۱٪ (فصل ۲۵-۲۶: ۸۴.۴٪ • ۲۶-۲۷: ۸۳.۳٪)",
                                        hText:
                                          f4.p3Hit && ef.pick === g.h
                                            ? "تایید پترن ۳"
                                            : ef.pick === g.h
                                              ? ef.tier !== "STRONG"
                                                ? "المنت متوسط"
                                                : !f4.epP12Ok
                                                  ? "بدون برتری فردی"
                                                  : !f4.agreeBoxes && !f4.isNoBetM14
                                                    ? "تضاد سیگنال ۱۴"
                                                    : `L5:${sm14.hL5}%<62%`
                                              : "غیرفعال",
                                        hSub: f4.p3Hit && ef.pick === g.h ? `GF✓ • Elo:${sm14.hL5}%` : undefined,
                                        hTick: f4.p3Hit && ef.pick === g.h ? "pass" : "none",
                                        aText:
                                          f4.p3Hit && ef.pick === g.a
                                            ? "تایید پترن ۳"
                                            : ef.pick === g.a
                                              ? ef.tier !== "STRONG"
                                                ? "المنت متوسط"
                                                : !f4.epP12Ok
                                                  ? "بدون برتری فردی"
                                                  : !f4.agreeBoxes && !f4.isNoBetM14
                                                    ? "تضاد سیگنال ۱۴"
                                                    : `L5:${sm14.aL5}%<62%`
                                              : "غیرفعال",
                                        aSub: f4.p3Hit && ef.pick === g.a ? `GF✓ • Elo:${sm14.aL5}%` : undefined,
                                        aTick: f4.p3Hit && ef.pick === g.a ? "pass" : "none",
                                      },
                                      {
                                        key: "f4_p4",
                                        testId: `row-f4-p4-${g.n}`,
                                        stepTitle: "۴. تضاد دو باکس + سیگنال T یا ۱۴(≥75%)",
                                        stepSub: "بدون اشباع AIR/EARTH • تاریخچه ۷۹.۷٪",
                                        hText:
                                          f4.p4Hit && f4.sugPick === g.h
                                            ? "برد پیشنهادی"
                                            : f4.p4AirTrap && f4.sugPick === g.h
                                              ? "مهار اشباع AIR"
                                              : "غیرفعال",
                                        hSub:
                                          f4.p4Hit && f4.sugPick === g.h
                                            ? f4.sugTeamSig
                                              ? "سیگنال T ✓"
                                              : `سیگنال ۱۴ (${sm14.hL5}%)`
                                            : f4.p4AirTrap && f4.sugPick === g.h
                                              ? "رد تله پترن ۴"
                                              : undefined,
                                        hTick:
                                          f4.p4Hit && f4.sugPick === g.h
                                            ? "pass"
                                            : f4.p4AirTrap && f4.sugPick === g.h
                                              ? "trap"
                                              : "none",
                                        aText:
                                          f4.p4Hit && f4.sugPick === g.a
                                            ? "برد پیشنهادی"
                                            : f4.p4AirTrap && f4.sugPick === g.a
                                              ? "مهار اشباع AIR"
                                              : "غیرفعال",
                                        aSub:
                                          f4.p4Hit && f4.sugPick === g.a
                                            ? f4.sugTeamSig
                                              ? "سیگنال T ✓"
                                              : `سیگنال ۱۴ (${sm14.aL5}%)`
                                            : f4.p4AirTrap && f4.sugPick === g.a
                                              ? "رد تله پترن ۴"
                                              : undefined,
                                        aTick:
                                          f4.p4Hit && f4.sugPick === g.a
                                            ? "pass"
                                            : f4.p4AirTrap && f4.sugPick === g.a
                                              ? "trap"
                                              : "none",
                                      },
                                    ];
                                    const f4HomeTicks = f4Rows.filter((r) => r.hTick === "pass").length;
                                    const f4AwayTicks = f4Rows.filter((r) => r.aTick === "pass").length;

                                    return (
                                      <div
                                        data-testid={`box2-nobet-elem-fusion-${g.n}`}
                                        className={`rounded-lg border overflow-hidden shadow-2xs text-[10px] ${
                                          f4.active
                                            ? "border-teal-400 bg-sky-50/80"
                                            : f4.p4AirTrap
                                              ? "border-rose-300 bg-rose-50/40"
                                              : "border-sky-300 bg-sky-50/85"
                                        }`}
                                      >
                                        <button
                                          type="button"
                                          data-testid={`toggle-fusion4-${g.n}`}
                                          onClick={() => toggleCardBox(g.n, "fusion4")}
                                          className={`w-full px-2.5 py-1.5 flex flex-wrap items-center justify-between gap-1.5 text-right transition-colors ${
                                            f4.active
                                              ? "bg-teal-100/85 hover:bg-teal-200/70 border-teal-300 text-teal-950"
                                              : f4.p4AirTrap
                                                ? "bg-rose-100/80 hover:bg-rose-200/70 border-rose-200 text-rose-950"
                                                : "bg-sky-100/85 hover:bg-sky-200/70 border-sky-200 text-sky-950"
                                          } ${isFusion4BoxOpen ? "border-b" : ""}`}
                                        >
                                          <span className="font-extrabold">
                                            باکس تلفیق ۴ پترن (باکس ۲ + المنت غالب • v82):
                                          </span>
                                          <div className="flex flex-wrap items-center justify-end gap-1 min-w-0">
                                            <span
                                              dir="ltr"
                                              className="font-mono font-extrabold text-[9px] px-1.5 py-0.5 rounded bg-white border border-sky-200 text-slate-800"
                                            >
                                              {g.hc}: {f4HomeTicks}✓ | {g.ac}: {f4AwayTicks}✓
                                            </span>
                                            <span
                                              className={`px-1.5 py-0.5 rounded font-extrabold text-[9px] border ${
                                                f4.active
                                                  ? "bg-teal-600 text-white border-teal-700"
                                                  : f4.p4AirTrap
                                                    ? "bg-rose-600 text-white border-rose-700"
                                                    : "bg-white text-slate-600 border-slate-300"
                                              }`}
                                            >
                                              {f4.active
                                                ? `★ ${getTeam3Code(f4.pick)} (${f4.tags.join("+")})`
                                                : f4.p4AirTrap
                                                  ? "✕ اشباع AIR"
                                                  : "— بدون پترن"}
                                            </span>
                                            {f4Won !== null && (
                                              <span
                                                className={`px-1.5 py-0.5 rounded font-extrabold text-[9px] border ${
                                                  f4Won
                                                    ? "bg-emerald-600 text-white border-emerald-700"
                                                    : "bg-rose-600 text-white border-rose-700"
                                                }`}
                                              >
                                                {f4Won ? "برد ✓" : "باخت ✕"}
                                              </span>
                                            )}
                                            <span className="px-1.5 py-0.5 rounded bg-white/95 border border-sky-300 text-sky-950 font-extrabold text-[9px]">
                                              {isFusion4BoxOpen ? "بستن ▲" : "باز کردن ▼"}
                                            </span>
                                          </div>
                                        </button>

                                        {isFusion4BoxOpen && (
                                          <>
                                            <table className="w-full text-[10px] border-collapse bg-white/90">
                                              <thead>
                                                <tr className="bg-sky-50/70 border-b border-sky-100 text-slate-700">
                                                  <th className="py-1 px-2 text-right font-extrabold w-[44%]">پترن ثابت سه‌فصله</th>
                                                  <th className="py-1 px-1.5 text-center font-extrabold border-r border-sky-100 w-[28%]">
                                                    بازیکن ۱ ({g.hc})
                                                  </th>
                                                  <th className="py-1 px-1.5 text-center font-extrabold border-r border-sky-100 w-[28%]">
                                                    بازیکن ۲ ({g.ac})
                                                  </th>
                                                </tr>
                                              </thead>
                                              <tbody className="divide-y divide-sky-100/80">
                                                {f4Rows.map((r) => {
                                                  const renderF4Cell = (txt: string, sub: string | undefined, tick: CheckTick) => (
                                                    <div className="flex flex-col items-center justify-center leading-tight py-0.5">
                                                      <div className="inline-flex items-center gap-1 font-extrabold text-slate-900">
                                                        {tick === "pass" ? (
                                                          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-emerald-600 text-white font-sans font-extrabold text-[9.5px] shrink-0">
                                                            ✓
                                                          </span>
                                                        ) : tick === "trap" ? (
                                                          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-rose-600 text-white font-sans font-extrabold text-[9.5px] shrink-0">
                                                            ✕
                                                          </span>
                                                        ) : (
                                                          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-slate-200 text-slate-600 font-sans font-extrabold text-[9.5px] shrink-0">
                                                            —
                                                          </span>
                                                        )}
                                                        <span className={tick === "none" ? "text-slate-500 font-semibold" : ""}>{txt}</span>
                                                      </div>
                                                      {sub && (
                                                        <div className="text-[8.5px] text-slate-600 font-mono tabular-nums mt-0.5" dir="ltr">
                                                          {sub}
                                                        </div>
                                                      )}
                                                    </div>
                                                  );
                                                  return (
                                                    <tr key={r.key} data-testid={r.testId}>
                                                      <td className="py-1 px-2 text-right align-middle">
                                                        <div className="font-extrabold text-slate-900 leading-snug">{r.stepTitle}</div>
                                                        {r.stepSub && (
                                                          <div className="text-[8.5px] text-slate-500 leading-tight">{r.stepSub}</div>
                                                        )}
                                                      </td>
                                                      <td
                                                        className={`py-1 px-1 text-center align-middle border-r border-sky-100 ${
                                                          r.hTick === "pass" ? "bg-emerald-50/75" : r.hTick === "trap" ? "bg-rose-50/70" : ""
                                                        }`}
                                                      >
                                                        {renderF4Cell(r.hText, r.hSub, r.hTick)}
                                                      </td>
                                                      <td
                                                        className={`py-1 px-1 text-center align-middle border-r border-sky-100 ${
                                                          r.aTick === "pass" ? "bg-emerald-50/75" : r.aTick === "trap" ? "bg-rose-50/70" : ""
                                                        }`}
                                                      >
                                                        {renderF4Cell(r.aText, r.aSub, r.aTick)}
                                                      </td>
                                                    </tr>
                                                  );
                                                })}
                                              </tbody>
                                            </table>

                                            <div className="px-2.5 py-1 border-t border-sky-200/80 bg-sky-50/90 flex flex-wrap items-center justify-between gap-1.5">
                                              <span className="font-extrabold text-slate-900">
                                                {f4.active ? (
                                                  <>
                                                    نتیجه تلفیق ۴ پترن:{" "}
                                                    <span dir="ltr" className="inline-block font-mono text-teal-950">
                                                      {f4.pick} ({getTeam3Code(f4.pick)})
                                                    </span>
                                                  </>
                                                ) : f4.p4AirTrap ? (
                                                  `مهار خطای اشباع AIR روی ${getTeam3Code(f4.sugPick)} (ورود ممنوع)`
                                                ) : !f4.isNoBetM14 ? (
                                                  f4.clashBoxes
                                                    ? "هشدار: سیگنال ۱۴ فعال اما در تضاد با المنت غالب (فاقد پترن ۴)"
                                                    : "سیگنال اصلی ۱۴ برقرار است (المنت غالب خنثی)"
                                                ) : (
                                                  "نتیجه تلفیق ۴ پترن: — خارج از هر ۴ پترن (بدون بت قطعی)"
                                                )}
                                              </span>
                                              {hasFinalScore && (
                                                f4.active ? (
                                                  <span
                                                    data-testid={`fusion4-outcome-${g.n}`}
                                                    className={`px-1.5 py-0.5 rounded font-extrabold text-[9.5px] border shrink-0 ${
                                                      f4Won
                                                        ? "bg-emerald-600 text-white border-emerald-700"
                                                        : "bg-rose-600 text-white border-rose-700"
                                                    }`}
                                                  >
                                                    {f4Won ? "درستی تلفیق ۴ پترن: برد ✓" : "درستی تلفیق ۴ پترن: باخت ✕"}
                                                  </span>
                                                ) : f4.p4AirTrap ? (
                                                  <span
                                                    data-testid={`fusion4-outcome-${g.n}`}
                                                    className={`px-1.5 py-0.5 rounded font-extrabold text-[9.5px] border shrink-0 ${
                                                      f4SavedAir
                                                        ? "bg-emerald-600 text-white border-emerald-700"
                                                        : "bg-slate-200 text-slate-700 border-slate-300"
                                                    }`}
                                                  >
                                                    {f4SavedAir ? "مهار تله اشباع: موفق ✓" : "توقف اشباع AIR"}
                                                  </span>
                                                ) : (
                                                  <span
                                                    data-testid={`fusion4-outcome-${g.n}`}
                                                    className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 border border-slate-300 font-bold text-[9.5px] shrink-0"
                                                  >
                                                    تلفیق ۴ پترن: خنثی —
                                                  </span>
                                                )
                                              )}
                                            </div>
                                          </>
                                        )}
                                      </div>
                                    );
                                  })()}
                                </div>
                              )}

                            </div>
                              </div>
                            )}

                            {/* Always-Visible Game Result Banner (Visible Even When 6 Boxes Are Collapsed) */}
                            <div
                              data-testid={`card-result-footer-${g.n}`}
                              className={`rounded-lg px-3 py-2 border flex flex-wrap items-center justify-between gap-1.5 text-[11px] font-extrabold shadow-2xs ${
                                !hasFinalScore
                                  ? "bg-sky-100/80 border-sky-200 text-sky-950"
                                  : isTotalElem12Mode
                                    ? sm14.referee6.active && sm14.referee6.pick === g.aw
                                      ? "bg-emerald-600 border-emerald-700 text-white"
                                      : sm14.referee6.active && sm14.referee6.pick !== g.aw
                                        ? "bg-rose-600 border-rose-700 text-white"
                                        : "bg-slate-800 border-slate-900 text-white"
                                    : isQualified && cardWon
                                      ? "bg-emerald-600 border-emerald-700 text-white"
                                      : isQualified && !cardWon
                                        ? "bg-rose-600 border-rose-700 text-white"
                                        : "bg-slate-800 border-slate-900 text-white"
                              }`}
                            >
                              {hasFinalScore ? (
                                <>
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span>نتیجه بازی:</span>
                                    <span className="font-mono px-1.5 py-0.5 rounded bg-black/20 text-white" dir="ltr">
                                      {scoreDisplay}
                                    </span>
                                    <span className="text-[10px] opacity-95">
                                      (برنده: <bdi dir="ltr">{g.aw}</bdi>)
                                    </span>
                                  </div>
                                  <span className="px-2 py-0.5 rounded bg-white/95 text-slate-950 text-[10px] font-extrabold">
                                    {isTotalElem12Mode
                                      ? sm14.referee6.active
                                        ? sm14.referee6.pick === g.aw
                                          ? "برد داور ۶ باکس ✓ (WIN)"
                                          : "باخت داور ۶ باکس ✕ (LOSS)"
                                        : sm14.referee6.pick === g.aw
                                          ? "رتبه ۴ (برتری خفیف): درست ✓"
                                          : "رتبه ۴ (برتری خفیف): نادرست ✕"
                                      : isQualified
                                        ? cardWon
                                          ? "برد سیگنال ✓ (WIN)"
                                          : "باخت سیگنال ✕ (LOSS)"
                                        : isSafetyHold && !cardWon
                                          ? "بدون سیگنال • مهار موفق تله ✓"
                                          : `بدون سیگنال • مسیر: ${cardWon ? "درست ✓" : "نادرست ✕"}`}
                                  </span>
                                </>
                              ) : (
                                <>
                                  <span>نتیجه بازی: در انتظار برگزاری (PENDING)</span>
                                  <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-white text-sky-950 border border-sky-200" dir="ltr">
                                    {g.hc} vs {g.ac}
                                  </span>
                                </>
                              )}
                            </div>

                            {/* Minimal Collapsible 1-Line Kalshi Tennis Order Strip (Zero 8-Player Bloat) */}
                            <div className="mt-auto rounded-lg border border-sky-200 bg-white overflow-hidden">
                              <button
                                type="button"
                                data-testid={`button-kalshi-card-strip-${g.n}`}
                                onClick={() => toggleCardBox(g.n, "lineup")}
                                className="w-full px-2.5 py-1.5 bg-sky-50/80 hover:bg-sky-100/80 text-sky-950 text-[10px] font-extrabold flex items-center justify-between gap-2 transition-colors"
                              >
                                <span className="truncate">
                                  سفارش تکی Kalshi تنیس (<span dir="ltr" className="font-mono">{kalshiTicker}</span> • {liveAsk}¢)
                                </span>
                                <span className="shrink-0 px-1.5 py-0.5 rounded bg-white border border-sky-300 text-sky-950 text-[9px] whitespace-nowrap">
                                  {isLineupOpen ? "بستن ▲" : "پنل Kalshi ▼"}
                                </span>
                              </button>

                              {isLineupOpen && (
                                <div className="p-2 space-y-1.5 border-t border-sky-200 bg-sky-50/30">
                                  <div className="rounded-lg p-2 border border-sky-200 bg-white space-y-1.5">
                                    <div className="flex items-center justify-between gap-1.5">
                                      <label className="inline-flex items-center gap-1.5 cursor-pointer text-[10.5px] font-extrabold text-slate-900">
                                        <input
                                          type="checkbox"
                                          checked={cardEnabled}
                                          onChange={(e) =>
                                            setKalshiCardEnabled((prev) => ({
                                              ...prev,
                                              [g.n]: e.target.checked,
                                            }))
                                          }
                                          className="h-3.5 w-3.5 accent-emerald-600"
                                        />
                                        <span>ثبت در سبد روزانه Kalshi ({liveAsk}¢)</span>
                                      </label>
                                      <span className="text-[9px] font-mono text-slate-500" dir="ltr">
                                        {kalshiTicker}
                                      </span>
                                    </div>

                                    <div className="grid grid-cols-3 gap-1.5 items-center text-[10px]" dir="ltr">
                                      <div className="bg-slate-50 rounded border border-slate-200 px-1.5 py-0.5">
                                        <span className="text-[8.5px] text-slate-500 block">Stake ($)</span>
                                        <input
                                          type="number"
                                          min={1}
                                          max={250}
                                          step={0.5}
                                          value={cardStake}
                                          onChange={(e) =>
                                            setKalshiCardStake((prev) => ({
                                              ...prev,
                                              [g.n]: Math.max(0.5, Number(e.target.value) || 2),
                                            }))
                                          }
                                          className="w-full font-mono font-extrabold text-xs text-slate-900 bg-transparent outline-none"
                                        />
                                      </div>

                                      <div className="bg-slate-50 rounded border border-slate-200 px-1.5 py-0.5">
                                        <span className="text-[8.5px] text-slate-500 block">Limit (¢)</span>
                                        <input
                                          type="number"
                                          min={1}
                                          max={99}
                                          value={cardLimit}
                                          onChange={(e) =>
                                            setKalshiCardLimit((prev) => ({
                                              ...prev,
                                              [g.n]: Math.min(99, Math.max(1, Number(e.target.value) || liveAsk)),
                                            }))
                                          }
                                          className="w-full font-mono font-extrabold text-xs text-slate-900 bg-transparent outline-none"
                                        />
                                      </div>

                                      <div className="bg-emerald-50/70 rounded border border-emerald-200 px-1.5 py-0.5 text-center">
                                        <span className="text-[8.5px] text-slate-600 block">{cardContracts} cnt</span>
                                        <span className="font-mono font-extrabold text-[10px] text-emerald-800">
                                          +${estNetWin}
                                        </span>
                                      </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-1.5">
                                      <button
                                        type="button"
                                        disabled={kalshiBusy}
                                        data-testid={`btn-kalshi-card-buy-${g.n}`}
                                        onClick={async () => {
                                          setKalshiBusy(true);
                                          try {
                                            const singleOrder = {
                                              gameNo: g.n,
                                              date: g.d,
                                              homeTeam: g.h,
                                              awayTeam: g.a,
                                              winnerTeam: predTeam,
                                              ticker: kalshiTicker,
                                              enabled: true,
                                              stakeUsd: cardStake,
                                              limitCents: cardLimit,
                                              contracts: cardContracts,
                                            };
                                            const d = await apiRpcJson("/api/kalshi/execute", {
                                              method: "POST",
                                              headers: { "Content-Type": "application/json" },
                                              body: JSON.stringify({
                                                date: g.d,
                                                orders: [singleOrder],
                                                mode: kalshiHasKey ? "live" : "dry_run",
                                              }),
                                            });
                                            setKalshiExecReport(d);
                                            const firstRes = d?.results?.[0];
                                            const okCard = Boolean(d?.ok) && (!firstRes || !String(firstRes.status ?? "").startsWith("ERROR"));
                                            setKalshiCardFeedback((prev) => ({
                                              ...prev,
                                              [g.n]: {
                                                ok: okCard,
                                                msg: firstRes?.message ?? d?.error ?? d?.summary?.message ?? (okCard ? "انجام شد ✓" : "خطا در ارسال"),
                                              },
                                            }));
                                            if (kalshiHasKey && okCard) {
                                              const stD = await apiRpcJson("/api/kalshi/state");
                                              if (stD?.ledger) setKalshiLedger(stD.ledger);
                                              const balD = await apiRpcJson("/api/kalshi/balance", { method: "POST" });
                                              if (balD?.ok && balD.balanceUsd) setKalshiBalance(balD.balanceUsd);
                                            }
                                          } catch (err) {
                                            setKalshiCardFeedback((prev) => ({
                                              ...prev,
                                              [g.n]: { ok: false, msg: (err as Error)?.message ?? "خطا در ارتباط با Kalshi" },
                                            }));
                                          } finally {
                                            setKalshiBusy(false);
                                          }
                                        }}
                                        className="py-1 px-2 rounded bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold text-[10px] shadow-2xs transition-colors"
                                      >
                                        {kalshiBusy
                                          ? "در حال ارسال..."
                                          : kalshiHasKey
                                            ? `خرید تکی YES ($${estCost})`
                                            : `تست خرید تکی ($${estCost})`}
                                      </button>

                                      <button
                                        type="button"
                                        onClick={toggleThisCardCombo}
                                        className={`py-1 px-2 rounded font-extrabold text-[10px] border transition-colors ${
                                          isCardInCombo
                                            ? "bg-indigo-700 hover:bg-indigo-800 text-white border-indigo-900"
                                            : "bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border-indigo-300"
                                        }`}
                                      >
                                        {isCardInCombo ? `در کمبو (Leg ${inComboIdx + 1}) ✓` : "افزودن به کمبو +"}
                                      </button>
                                    </div>

                                    {kalshiCardFeedback[g.n] && (
                                      <div
                                        className={`mt-1 px-2 py-1 rounded border text-[10px] font-bold flex items-center justify-between ${
                                          kalshiCardFeedback[g.n].ok
                                            ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                                            : "bg-rose-50 border-rose-300 text-rose-900"
                                        }`}
                                      >
                                        <span>{kalshiCardFeedback[g.n].msg}</span>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setKalshiCardFeedback((prev) => {
                                              const cp = { ...prev };
                                              delete cp[g.n];
                                              return cp;
                                            })
                                          }
                                          className="mr-1 opacity-70 hover:opacity-100"
                                        >
                                          ✕
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Collapsible Dropdown 1: Pattern Selector Cards & Season/Monthly Accuracy */}
        <div className="rounded-lg border border-sky-200 bg-sky-50/50 overflow-hidden">
          <div
            onClick={() => setOpenStatsSection((v) => !v)}
            className="px-4 py-2.5 bg-sky-100/80 hover:bg-sky-100 cursor-pointer flex flex-wrap items-center justify-between gap-2 border-b border-sky-200/80 transition-colors"
          >
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-sky-950">
              <span>📊 پترن‌های آماری و جدول دقت فصل‌به‌فصل و ماه‌به‌ماه ({activeDef.titleFa})</span>
              <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 font-mono text-[11px]">
                Win Rate: {patternAcc}% ({patternWins}/{patternCompleted.length})
              </span>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setOpenStatsSection((v) => !v);
              }}
              className="px-3 py-1 rounded border border-sky-300 bg-white hover:bg-sky-50 text-sky-950 text-xs font-bold shadow-sm"
            >
              {openStatsSection ? "بستن جدول آمار ▲" : "باز کردن پترن‌ها و جدول آمار ▼"}
            </button>
          </div>
          {openStatsSection && (
            <div className="p-4 flex flex-col gap-4 bg-white/80">
        {/* Pattern Selector Cards */}
        {engineMode === "manual" || engineMode === "twins" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-2">
            {TWIN_PATTERN_DEFS.map((p) => {
              const sub = games.filter((g) => matchTwin(g, p.key) && Boolean(g.done && g.aw && g.aw !== "PENDING"));
              const w = sub.filter((g) => (g.sys_win ?? g.fpw ?? g.h) === g.aw).length;
              const pct = sub.length > 0 ? ((100 * w) / sub.length).toFixed(2) : "0.00";
              const pend = games.filter((g) => matchTwin(g, p.key) && !g.done).length;
              const active = twinPattern === p.key;
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => {
                    setTwinPattern(p.key);
                    setPage(1);
                  }}
                  className={`text-right p-2.5 rounded-lg border transition-all flex flex-col justify-between gap-2 ${
                    active
                      ? "bg-emerald-600 text-white border-emerald-700 shadow-md"
                      : "bg-white hover:bg-emerald-50 text-slate-800 border-emerald-200"
                  }`}
                >
                  <div>
                    <div className={`text-[10px] font-mono uppercase ${active ? "text-emerald-100" : "text-slate-500"}`}>
                      {p.titleEn}
                    </div>
                    <div className="font-bold text-xs mt-0.5 leading-snug">{p.titleFa}</div>
                  </div>
                  <div className="flex items-baseline justify-between pt-1 border-t border-current/15">
                    <span className="text-base font-extrabold font-mono">{pct}%</span>
                    <span className={`text-[10px] font-mono ${active ? "text-emerald-100" : "text-slate-500"}`}>
                      {w}/{sub.length} (+{pend})
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        ) : engineMode === "fusion" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-2">
            {FUSION_PATTERN_DEFS.map((p: any) => {
              const sub = games.filter((g) => matchFusion(g, p.key) && Boolean(g.done));
              const w = sub.filter((g) => (((g.f30 ?? 0) >= 0 ? g.h : g.a) === g.aw)).length;
              const pct = sub.length > 0 ? ((100 * w) / sub.length).toFixed(2) : "0.00";
              const pend = games.filter((g) => matchFusion(g, p.key) && !g.done).length;
              const active = fusionPattern === p.key;
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => {
                    setFusionPattern(p.key);
                    setPage(1);
                  }}
                  className={`text-right p-2.5 rounded-lg border transition-all flex flex-col justify-between gap-2 ${
                    active
                      ? "bg-sky-600 text-white border-sky-700 shadow-md"
                      : "bg-white hover:bg-sky-50 text-slate-800 border-sky-200"
                  }`}
                >
                  <div>
                    <div className={`text-[10px] font-mono uppercase ${active ? "text-sky-100" : "text-slate-500"}`}>
                      {p.titleEn}
                    </div>
                    <div className="font-bold text-xs mt-0.5 leading-snug">{p.titleFa}</div>
                  </div>
                  <div className="flex items-baseline justify-between pt-1 border-t border-current/15">
                    <span className="text-base font-extrabold font-mono">{pct}%</span>
                    <span className={`text-[10px] font-mono ${active ? "text-sky-100" : "text-slate-500"}`}>
                      {w}/{sub.length} (+{pend})
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
            {SINGLE_PATTERN_DEFS.map((p: any) => {
              const sub = games.filter((g) => matchSingle(g, p.key) && Boolean(g.done));
              const w = sub.filter((g) => (p.key === "s1_guard" ? g.a === g.aw : p.key === "all" ? g.st === "WIN" : g.h === g.aw)).length;
              const pct = sub.length > 0 ? ((100 * w) / sub.length).toFixed(2) : "0.00";
              const pend = games.filter((g) => matchSingle(g, p.key) && !g.done).length;
              const active = singlePattern === p.key;
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => {
                    setSinglePattern(p.key);
                    setPage(1);
                  }}
                  className={`text-right p-3 rounded-lg border transition-all flex flex-col justify-between gap-2 ${
                    active
                      ? "bg-sky-600 text-white border-sky-700 shadow-md"
                      : "bg-white hover:bg-sky-50 text-slate-800 border-sky-200"
                  }`}
                >
                  <div>
                    <div className={`text-[11px] font-mono uppercase ${active ? "text-sky-100" : "text-slate-500"}`}>
                      {p.titleEn}
                    </div>
                    <div className="font-bold text-xs mt-0.5 leading-snug">{p.titleFa}</div>
                  </div>
                  <div className="flex items-baseline justify-between pt-1 border-t border-current/15">
                    <span className="text-lg font-extrabold font-mono">{pct}%</span>
                    <span className={`text-[11px] font-mono ${active ? "text-sky-100" : "text-slate-500"}`}>
                      {w}/{sub.length} (+{pend} آینده)
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Active Pattern Formula Explanation */}
        <div className="bg-white border border-sky-200 rounded-md p-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-700 leading-relaxed">
            <span className="font-bold text-sky-900">فرمول پترن انتخاب‌شده ({activeDef.titleFa}): </span>
            {activeDef.formulaFa}
          </div>
          <div className="text-sm font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded">
            Win Rate: {patternAcc}% ({patternWins} Wins / {patternCompleted.length - patternWins} Losses)
          </div>
        </div>

        {/* Season-by-Season & Monthly Summary Tables */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white border border-sky-200 rounded-md overflow-hidden">
            <div className="bg-sky-100/70 px-3.5 py-2 text-xs font-bold text-sky-950 flex items-center justify-between">
              <span>عملکرد به تفکیک هر فصل (Season-by-Season Accuracy)</span>
              <span className="font-mono text-[11px] text-sky-800">{activeDef.titleEn}</span>
            </div>
            <table className="w-full text-xs font-mono text-left border-collapse">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="p-2">Season (فصل)</th>
                  <th className="p-2">Completed</th>
                  <th className="p-2 text-emerald-700">Wins (برد)</th>
                  <th className="p-2 text-rose-600">Losses (خطا)</th>
                  <th className="p-2 text-amber-700">Upcoming</th>
                  <th className="p-2 font-bold">Win Rate %</th>
                </tr>
              </thead>
              <tbody>
                {seasonStats.map((st) => (
                  <tr key={st.season} className="border-b border-slate-100 hover:bg-sky-50/40">
                    <td className="p-2 font-bold text-slate-800">{st.season}</td>
                    <td className="p-2">{st.total}</td>
                    <td className="p-2 text-emerald-700 font-semibold">{st.wins}</td>
                    <td className="p-2 text-rose-600">{st.losses}</td>
                    <td className="p-2 text-amber-700">{st.pending}</td>
                    <td className="p-2 font-extrabold text-sky-900">{st.pct}%</td>
                  </tr>
                ))}
                <tr className="bg-sky-50/70 font-bold text-slate-900">
                  <td className="p-2">مجموع کل (All 3 Seasons)</td>
                  <td className="p-2">{patternCompleted.length}</td>
                  <td className="p-2 text-emerald-700">{patternWins}</td>
                  <td className="p-2 text-rose-600">{patternCompleted.length - patternWins}</td>
                  <td className="p-2 text-amber-700">{patternGames.length - patternCompleted.length}</td>
                  <td className="p-2 text-sky-950 text-sm">{patternAcc}%</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="bg-white border border-sky-200 rounded-md overflow-hidden flex flex-col">
            <div className="bg-sky-100/70 px-3.5 py-2 text-xs font-bold text-sky-950 flex items-center justify-between gap-2 flex-wrap">
              <span>روند تجمعی ماه‌به‌ماه ({monthlyCalendarKind === "shamsi" ? "برج‌های خورشیدی شمسی" : "ماه‌های میلادی"})</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setMonthlyCalendarKind("shamsi")}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                    monthlyCalendarKind === "shamsi" ? "bg-emerald-600 text-white border-emerald-700" : "bg-white text-slate-700 border-sky-300"
                  }`}
                >
                  خورشیدی شمسی
                </button>
                <button
                  type="button"
                  onClick={() => setMonthlyCalendarKind("greg")}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                    monthlyCalendarKind === "greg" ? "bg-sky-700 text-white border-sky-800" : "bg-white text-slate-700 border-sky-300"
                  }`}
                >
                  میلادی
                </button>
                <button
                  type="button"
                  onClick={() => setShowMonthlyTable((v) => !v)}
                  className="text-[11px] text-sky-800 underline ml-1"
                >
                  {showMonthlyTable ? "Hide" : "Show"}
                </button>
              </div>
            </div>
            {showMonthlyTable && (
              <div className="max-h-48 overflow-y-auto">
                <table className="w-full text-[11px] font-mono text-left border-collapse">
                  <thead className="bg-slate-50 text-slate-600 sticky top-0 border-b border-slate-200">
                    <tr>
                      <th className="p-1.5 pl-3">Month</th>
                      <th className="p-1.5">Month W/N</th>
                      <th className="p-1.5">Month %</th>
                      <th className="p-1.5">Cumulative W/N</th>
                      <th className="p-1.5 font-bold">Cumulative %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyRows.map((m) => (
                      <tr key={m.ym} className="border-b border-slate-100 hover:bg-sky-50/40">
                        <td className="p-1.5 pl-3 font-semibold">{m.ym}</td>
                        <td className="p-1.5">{m.mw}/{m.mn}</td>
                        <td className="p-1.5 text-slate-600">{m.mPct}%</td>
                        <td className="p-1.5 font-medium">{m.cumW}/{m.cumN}</td>
                        <td className="p-1.5 font-bold text-emerald-700">{m.cumPct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

            </div>
          )}
        </div>

        {/* Daily Slate Quick Selector */}
        <div className="bg-white p-3 rounded-md border border-sky-200 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold text-sky-950 ml-1">دسته‌بندی بازی‌های روزانه (Daily Slate):</span>
            {DAILY_QUICK_DATES.map((qd) => (
              <button
                key={qd.date}
                type="button"
                onClick={() => {
                  setDateFilter(qd.date);
                  if (qd.date !== "ALL") setDailyCardDate(qd.date);
                  setPage(1);
                }}
                className={`text-xs px-2.5 py-1 rounded border font-mono transition-colors ${
                  dateFilter === qd.date
                    ? "bg-sky-600 text-white border-sky-700 font-bold"
                    : "bg-slate-50 hover:bg-sky-50 text-slate-700 border-slate-200"
                }`}
              >
                {qd.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <label className="text-[11px] font-medium text-slate-600">تاریخ دلخواه:</label>
            <input
              type="date"
              value={dateFilter === "ALL" ? "" : dateFilter}
              onChange={(e) => {
                const v = e.target.value || "ALL";
                setDateFilter(v);
                if (v !== "ALL") setDailyCardDate(v);
                setPage(1);
              }}
              className="h-8 rounded border border-slate-300 px-2 text-xs font-mono"
            />
          </div>
        </div>

        {/* Interactive Filter Controls */}
        <div className="space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 bg-white p-3 rounded-md border border-sky-200 items-end">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-slate-600">فصل (Season)</label>
              <select
                value={seasonFilter}
                data-testid="select-nba-season-filter"
                onChange={(e) => {
                  const nextS = e.target.value;
                  setSeasonFilter(nextS);
                  setDateFilter("ALL");
                  if (nextS !== "ALL" && monthFilter !== "ALL" && !patternGames.some((g) => g.s === nextS && g.ym === monthFilter)) {
                    setMonthFilter("ALL");
                  }
                  setFilterAutoNote("");
                  setPage(1);
                }}
                className="h-9 rounded-md border border-slate-300 bg-white px-2.5 text-xs font-mono"
              >
                <option value="ALL">All Seasons (همه فصل‌ها)</option>
                <option value="2024">فصل ۲۰۲۴ (ATP / WTA 2024)</option>
                <option value="2025">فصل ۲۰۲۵ (ATP / WTA 2025)</option>
                <option value="2026">فصل ۲۰۲۶ (ATP / WTA 2026)</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-slate-600">ماه (Year-Month)</label>
              <select
                value={monthFilter}
                data-testid="select-nba-month-filter"
                onChange={(e) => {
                  const nextYm = e.target.value;
                  setMonthFilter(nextYm);
                  setDateFilter("ALL");
                  if (nextYm !== "ALL") {
                    const mGames = patternGames.filter((g) => (seasonFilter === "ALL" || g.s === seasonFilter) && g.ym === nextYm);
                    const doneCnt = mGames.filter((g) => Boolean(g.done)).length;
                    const pendCnt = mGames.length - doneCnt;
                    if (doneCnt === 0 && (statusFilter === "WIN" || statusFilter === "LOSS")) {
                      setStatusFilter("ALL");
                      setFilterAutoNote(`ماه ${nextYm} مربوط به آینده است و هنوز نتیجه‌ای ثبت نشده است (${pendCnt} بازی در انتظار PENDING).`);
                    } else if (pendCnt === 0 && statusFilter === "PENDING") {
                      setStatusFilter("ALL");
                      setFilterAutoNote(`تمام ${doneCnt} بازی ماه ${nextYm} برگزار شده است؛ وضعیت روی همه نتایج قرار گرفت.`);
                    } else {
                      setFilterAutoNote("");
                    }
                  } else {
                    setFilterAutoNote("");
                  }
                  setPage(1);
                }}
                className="h-9 rounded-md border border-slate-300 bg-white px-2.5 text-xs font-mono"
              >
                <option value="ALL">All Months (همه ماه‌ها)</option>
                {allMonths.map((ym) => {
                  const mSub = patternGames.filter((g) => (seasonFilter === "ALL" || g.s === seasonFilter) && g.ym === ym);
                  const mDone = mSub.filter((g) => Boolean(g.done)).length;
                  const mPend = mSub.length - mDone;
                  const suffix =
                    mDone > 0 && mPend > 0
                      ? ` (${mDone} انجام‌شده • ${mPend} آینده)`
                      : mDone > 0
                        ? ` (${mDone} انجام‌شده)`
                        : ` (آینده • ${mPend} بازی بدون نتیجه)`;
                  return (
                    <option key={ym} value={ym}>
                      {ym}{suffix}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-slate-600">وضعیت نتیجه (Result Status)</label>
              <select
                value={statusFilter}
                data-testid="select-nba-status-filter"
                onChange={(e) => {
                  const nextSt = e.target.value;
                  setStatusFilter(nextSt);
                  setOpenSummaryTable(true);
                  let clearedNote = "";
                  if (nextSt !== "ALL") {
                    if (dateFilter !== "ALL") {
                      const hasOnDay = patternGames.some((g) => g.d === dateFilter && getGameStatus(g) === nextSt);
                      if (!hasOnDay) {
                        setDateFilter("ALL");
                        clearedNote = `فیلتر تک‌روز (${dateFilter}) برداشته شد تا نتایج ${nextSt} نمایش داده شوند.`;
                      }
                    }
                    if ((nextSt === "WIN" || nextSt === "LOSS") && monthFilter !== "ALL") {
                      const hasDoneInMonth = patternGames.some((g) => g.ym === monthFilter && Boolean(g.done));
                      if (!hasDoneInMonth) {
                        const prevM = monthFilter;
                        setMonthFilter("ALL");
                        clearedNote = `ماه ${prevM} هنوز برگزار نشده است (آینده)؛ نمایش ${nextSt === "WIN" ? "پیش‌بینی‌های درست" : "خطاها"} در کل ماه‌های انجام‌شده فعال شد.`;
                      }
                    } else if (nextSt === "PENDING" && monthFilter !== "ALL") {
                      const hasPendInMonth = patternGames.some((g) => g.ym === monthFilter && !g.done);
                      if (!hasPendInMonth) {
                        const prevM = monthFilter;
                        setMonthFilter("ALL");
                        clearedNote = `ماه ${prevM} بازی آینده ندارد؛ نمایش بازی‌های آینده (PENDING) در کل ماه‌ها فعال شد.`;
                      }
                    }
                  }
                  setFilterAutoNote(clearedNote);
                  setPage(1);
                }}
                className="h-9 rounded-md border border-slate-300 bg-white px-2.5 text-xs font-mono"
              >
                <option value="ALL">All Games ({scopeBeforeStatus.length})</option>
                <option value="WIN">WIN — پیش‌بینی‌های درست ({scopeStatusCounts.WIN})</option>
                <option value="LOSS">LOSS — خطاها ({scopeStatusCounts.LOSS})</option>
                <option value="PENDING">PENDING — بازی‌های آینده ({scopeStatusCounts.PENDING})</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-slate-600" dir="rtl">
                جستجوی نام بازیکن، شهر یا تورنمنت
              </label>
              <Input
                value={teamQuery}
                onChange={(e) => {
                  setTeamQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="جستجوی نام بازیکن، شهر یا تورنمنت (مثلاً Sinner, Sabalenka, Doha, Wimbledon...)"
                className="h-9 text-xs font-sans bg-white"
              />
            </div>

            <div className="flex items-center justify-between gap-2 h-9 px-2 bg-sky-50 rounded border border-sky-200 text-xs font-mono">
              <span className="truncate">
                Showing: <b>{filteredGames.length}</b> matches
                {dateFilter !== "ALL" ? ` (${dateFilter})` : ""}
              </span>
              <button
                type="button"
                onClick={() => {
                  setSeasonFilter("ALL");
                  setMonthFilter("ALL");
                  setDateFilter("ALL");
                  setStatusFilter("ALL");
                  setTeamQuery("");
                  setFilterAutoNote("");
                  setPage(1);
                }}
                className="text-sky-700 hover:underline text-[11px] shrink-0"
              >
                Reset
              </button>
            </div>
          </div>

          {filterAutoNote && (
            <div dir="rtl" className="px-3 py-1.5 rounded border border-amber-300 bg-amber-50 text-amber-950 text-xs font-semibold flex items-center justify-between gap-2">
              <span>{filterAutoNote}</span>
              <button type="button" onClick={() => setFilterAutoNote("")} className="text-[11px] text-amber-900 underline">
                بستن
              </button>
            </div>
          )}
        </div>

        {/* Collapsible Dropdown 2: GOLD-FORMULA-PRIORITY Manual Filter (DAY) System — LIGHT BLUE THEME */}
        <div className="rounded-lg border-2 border-sky-300 bg-sky-50/70 text-slate-900 shadow-sm overflow-hidden" dir="rtl">
          {/* Collapsible Section Header */}
          <div
            onClick={() => setOpenManualSection((v) => !v)}
            className="bg-sky-200/80 hover:bg-sky-200 px-4 py-3 border-b border-sky-300 cursor-pointer flex flex-wrap items-center justify-between gap-3 transition-colors"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-1 rounded bg-sky-700 text-white font-extrabold text-xs shadow-sm">
                🎛️ فیلتر دستی (DAY) — همزادیاب دقیق ELE-P • ELE-FINAL • ELE-DYN
              </span>
              <span className="text-xs text-sky-950 font-mono font-semibold bg-white/90 px-2.5 py-0.5 rounded border border-sky-300">
                دیتابیس تاریخی تنیس: <b className="text-emerald-700">{histGames.length.toLocaleString()}</b> مسابقه
              </span>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setOpenManualSection((v) => !v);
              }}
              className="px-3 py-1 rounded border border-sky-400 bg-white hover:bg-sky-50 text-sky-950 text-xs font-extrabold shadow-sm"
            >
              {openManualSection ? "بستن فیلتر دستی ▲" : "باز کردن فیلتر دستی (DAY) ▼"}
            </button>
          </div>

          {openManualSection && (
            <div>
              {/* Top Toolbar Controls (Light Blue Theme) */}
              <div className="bg-sky-100/80 px-4 py-2.5 border-b border-sky-200 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  {/* Player 1 vs Player 2 Elemental Perspective Toggle */}
                  <div className="inline-flex rounded-md border border-sky-300 bg-white p-0.5 text-[11px] shadow-sm">
                    <button
                      type="button"
                      onClick={() => setManualPersp("home")}
                      className={`px-2.5 py-1 rounded font-bold transition-colors ${
                        manualPersp === "home"
                          ? "bg-sky-600 text-white"
                          : "text-slate-700 hover:bg-sky-50"
                      }`}
                    >
                      🎾 المنت بازیکن ۱ (P1 ELE-P/FINAL/DYN)
                    </button>
                    <button
                      type="button"
                      onClick={() => setManualPersp("away")}
                      className={`px-2.5 py-1 rounded font-bold transition-colors ${
                        manualPersp === "away"
                          ? "bg-indigo-600 text-white"
                          : "text-slate-700 hover:bg-indigo-50"
                      }`}
                    >
                      🎾 المنت بازیکن ۲ (P2 ELE-P/FINAL/DYN)
                    </button>
                  </div>

                <div className="inline-flex rounded-md border border-sky-300 bg-white p-0.5" title="انتخاب نوع شکل رمل در فیلتر دستی تنیس">
                  <button
                    type="button"
                    onClick={() => setManualGeoKind("fin")}
                    className={`px-2.5 py-1 rounded text-xs font-bold transition-colors ${
                      manualGeoKind === "fin" ? "bg-emerald-600 text-white" : "text-slate-700 hover:bg-emerald-50"
                    }`}
                  >
                    GEO-FIN (اصلاح‌شده)
                  </button>
                  <button
                    type="button"
                    onClick={() => setManualGeoKind("dyn")}
                    className={`px-2.5 py-1 rounded text-xs font-bold transition-colors ${
                      manualGeoKind === "dyn" ? "bg-sky-700 text-white" : "text-slate-700 hover:bg-sky-50"
                    }`}
                  >
                    GEO-DYN (پویا)
                  </button>
                </div>

                  {/* Weekday Filter */}
                  <select
                    value={manualDayFilter}
                    onChange={(e) => {
                      setManualDayFilter(e.target.value);
                      setPage(1);
                    }}
                    className="h-8 rounded-md border border-sky-300 bg-white px-2.5 text-xs text-sky-950 font-mono font-bold shadow-sm"
                  >
                    <option value="ALL">همه روزهای هفته (ALL DAYS)</option>
                    <option value="MONDAY">MONDAY (دوشنبه)</option>
                    <option value="TUESDAY">TUESDAY (سه‌شنبه)</option>
                    <option value="WEDNESDAY">WEDNESDAY (چهارشنبه)</option>
                    <option value="THURSDAY">THURSDAY (پنج‌شنبه)</option>
                    <option value="FRIDAY">FRIDAY (جمعه)</option>
                    <option value="SATURDAY">SATURDAY (شنبه)</option>
                    <option value="SUNDAY">SUNDAY (یکشنبه)</option>
                  </select>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Batch Smart / Clear on current page */}
                  <button
                    type="button"
                    onClick={() => {
                      const nextMap = { ...manualFilters };
                      const openMap = { ...manualOpenGames };
                      pageGames.forEach((g, idx) => {
                        const t12 = (manualPersp === "home" ? g.h_12 : g.a_12) ?? [];
                        const tGeoFin = (manualPersp === "home" ? g.h_geo : g.a_geo) ?? "";
                        const tGeoDyn = (manualPersp === "home" ? (g.h_geo_dyn ?? g.h_geo) : (g.a_geo_dyn ?? g.a_geo)) ?? "";
                        const tGeo = manualGeoKind === "dyn" ? tGeoDyn : tGeoFin;
                        const dPool = getDayPoolBefore(g.day, g.d);
                        const stepRes = computeAutoFilterState(t12, tGeoFin, dPool, manualPersp, false, "fin");
                        const geoRes = computeAutoFilterState(t12, tGeo, dPool, manualPersp, true, manualGeoKind);
                        const f30Val = g.f30 ?? g.vm6 ?? 0;
                        const stepAgrees = (stepRes.hw >= stepRes.aw) === (f30Val >= 0);
                        const geoAgrees = (geoRes.hw >= geoRes.aw) === (f30Val >= 0);
                        const pickGeo =
                          (stepRes.pct < 60 || (stepAgrees && !geoAgrees && stepRes.pct >= 55))
                            ? false
                            : !stepAgrees && geoAgrees && geoRes.pct >= 55
                              ? true
                              : geoRes.pct > stepRes.pct ||
                                (geoRes.pct === stepRes.pct && geoRes.mv > stepRes.mv);
                        const chosen = pickGeo ? geoRes : stepRes;
                        nextMap[g.n] = {
                          ...chosen.state,
                          modeLabel: `هوشمند خودکار (${pickGeo ? "GEO اول" : "گام‌به‌گام"})`,
                          stepSummary: stepRes.sumStr,
                          geoSummary: geoRes.sumStr,
                        };
                        if (idx < 3) openMap[g.n] = true;
                      });
                      setManualFilters(nextMap);
                      setManualOpenGames(openMap);
                    }}
                    className="px-3 py-1.5 rounded-md bg-purple-600 hover:bg-purple-700 text-white font-bold text-[11px] transition-colors shadow-sm"
                  >
                    ⚡ انتخاب هوشمند خودکار برای همه بازی‌های صفحه
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setManualFilters({});
                      try {
                        localStorage.removeItem(MANUAL_STORAGE_KEY);
                      } catch {}
                    }}
                    className="px-3 py-1.5 rounded-md bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 font-bold text-[11px] transition-colors"
                  >
                    پاک‌کردن همه فیلترها
                  </button>
                </div>
              </div>

              {/* Column Equivalence Legend (Light Blue) */}
              <div className="bg-sky-50 px-4 py-2 border-b border-sky-200 text-[11px] text-slate-700 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-sky-950 font-bold">تطابق دقیق ستون‌ها با شیت محاسبات (Sheet3): </span>
                  <span className="font-mono text-indigo-800 font-semibold mx-1">PRIM 1..4 = ELE-DYN (P+FIN) [FIRE, AIR, WATER, EARTH]</span> •
                  <span className="font-mono text-teal-800 font-semibold mx-1">FINAL 1..4 = ELE-FINAL [FIRE, AIR, WATER, EARTH]</span> •
                  <span className="font-mono text-sky-800 font-semibold mx-1">ELE-P 1..4 = ELE-P [FIRE, AIR, WATER, EARTH]</span> •
                  <span className="font-mono text-amber-800 font-semibold mx-1">GEO-FIG = CODE-DYN</span>
                </div>
                <div className="text-sky-900 font-mono font-semibold">
                  صفحه {safePage} از {totalPages} ({pageGames.length} بازی در این صفحه)
                </div>
              </div>

              {histLoading ? (
                <div className="p-8 text-center text-xs text-sky-800 bg-white flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> در حال بارگذاری ۲۱٬۴۹۸ بازی تاریخی ۲۰۱۰–۲۰۲۶ برای فیلتر دستی...
                </div>
              ) : (
                <div className="divide-y divide-sky-200">
                  {pageGames.map((g, gIdx) => {
                    const isOpen = manualOpenGames[g.n] ?? gIdx === 0;
                    const targetEl12 =
                      (manualPersp === "home" ? g.h_12 : g.a_12) ?? [
                        "0 FIRE", "0 AIR", "0 WATER", "0 EARTH",
                        "0 FIRE", "0 AIR", "0 WATER", "0 EARTH",
                        "0 FIRE", "0 AIR", "0 WATER", "0 EARTH",
                      ];
                    const targetGeoFin =
                      (manualPersp === "home" ? g.h_geo : g.a_geo) ?? "0000";
                    const targetGeoDyn =
                      (manualPersp === "home"
                        ? g.h_geo_dyn ?? g.h_geo
                        : g.a_geo_dyn ?? g.a_geo) ?? "0000";
                    const targetGeoTab =
                      (manualPersp === "home" ? g.h_geo_tab : g.a_geo_tab) ?? "0101";
                    const curState: ManualFilterState = manualFilters[g.n] ?? {
                      cols: {},
                      geo: "ALL",
                      geoTab: "ALL",
                    };
                    const rowGeoKind: "fin" | "dyn" = curState.geoKind ?? manualGeoKind;
                    const targetGeo = rowGeoKind === "dyn" ? targetGeoDyn : targetGeoFin;

                    const dayPool = getDayPoolBefore(g.day, g.d);
                    const getRowEl12 = (r: HistGameRow) => (manualPersp === "home" ? r.h12 : r.a12);
                    const getRowGeo = (r: HistGameRow) =>
                      manualPersp === "home"
                        ? rowGeoKind === "dyn"
                          ? r.hGeoDyn ?? r.hGeo
                          : r.hGeo
                        : rowGeoKind === "dyn"
                          ? r.aGeoDyn ?? r.aGeo
                          : r.aGeo;
                    const getRowGeoTab = (r: HistGameRow) =>
                      manualPersp === "home" ? (r.hGeoTab ?? "") : (r.aGeoTab ?? "");

                    const filteredPool = dayPool.filter((r) => {
                      const el = getRowEl12(r);
                      for (let c = 0; c < 12; c++) {
                        const sel = curState.cols[c];
                        if (sel && sel !== "ALL" && el[c] !== sel) return false;
                      }
                      if (curState.geo && curState.geo !== "ALL" && getRowGeo(r) !== curState.geo) {
                        return false;
                      }
                      if (curState.geoTab && curState.geoTab !== "ALL" && getRowGeoTab(r) !== curState.geoTab) {
                        return false;
                      }
                      return true;
                    });

                    const liveIdx = computePoolNumIndex(filteredPool);
                    const ch3Open =
                      isOpen || manualPersp === "away" || !g.idx3
                        ? computeThreeChannelIndex(targetEl12, targetGeoFin, targetGeoDyn, dayPool, manualPersp, targetGeoTab)
                        : null;
                    const ch3Vh = ch3Open ? ch3Open.votesHome : g.idx3?.vh ?? 0;
                    const ch3Va = ch3Open ? ch3Open.votesAway : g.idx3?.va ?? 0;
                    const ch3MinD = ch3Open ? ch3Open.minDelta : g.idx3?.minD ?? 0;

                    let nextBestCol: number | null = null;
                    let nextBestCnt = -1;
                    if (isOpen && filteredPool.length > 7) {
                      for (let c = 0; c < 12; c++) {
                        if (curState.cols[c] && curState.cols[c] !== "ALL") continue;
                        const tVal = targetEl12[c];
                        if (!tVal) continue;
                        const cnt = filteredPool.filter((r) => getRowEl12(r)[c] === tVal).length;
                        if (cnt >= 5 && cnt < filteredPool.length && cnt > nextBestCnt) {
                          nextBestCnt = cnt;
                          nextBestCol = c;
                        }
                      }
                    }

                    const homeWins = filteredPool.filter((r) => r.mg > 0);
                    const awayWins = filteredPool.filter((r) => r.mg < 0);
                    const hw = homeWins.length;
                    const aw = awayWins.length;
                    const avgHome =
                      hw > 0
                        ? (homeWins.reduce((acc, r) => acc + r.mg, 0) / hw).toFixed(1)
                        : "0.0";
                    const avgAway =
                      aw > 0
                        ? (awayWins.reduce((acc, r) => acc + Math.abs(r.mg), 0) / aw).toFixed(1)
                        : "0.0";
                    const totVotes = Math.max(1, hw + aw);
                    const majPct = ((Math.max(hw, aw) / totVotes) * 100).toFixed(1);
                    const majTeam = hw > aw ? g.h : aw > hw ? g.a : "TIE";

                    const updateGameFilter = (updater: (prev: ManualFilterState) => ManualFilterState) => {
                      setManualFilters((prev) => ({
                        ...prev,
                        [g.n]: updater(prev[g.n] ?? { cols: {}, geo: "ALL" }),
                      }));
                    };

                    const showAll = Boolean(manualShowAllRows[g.n]);
                    const visibleHistRows = showAll ? filteredPool : filteredPool.slice(0, 60);

                    return (
                      <div key={g.n} id={`manual-nba-game-row-${g.n}`} className="bg-white">
                        {/* Accordion Header Bar (Light Pale-Blue Style) */}
                        <div
                          onClick={() =>
                            setManualOpenGames((prev) => ({ ...prev, [g.n]: !isOpen }))
                          }
                          className="px-4 py-2.5 bg-sky-100/75 hover:bg-sky-200/60 cursor-pointer flex flex-wrap items-center justify-between gap-2 border-r-4 border-sky-600 transition-colors"
                        >
                          <div className="flex flex-wrap items-center gap-2.5 font-mono text-xs">
                            <span className="font-extrabold text-sky-950 text-sm">
                              &gt;&gt;&gt; {g.day} {g.d} &lt;&lt;&lt;
                            </span>
                            <span className="text-slate-500 font-bold">#{g.n}</span>
                            <span className="font-bold text-blue-800">{g.h}</span>
                            <span className="text-slate-400">vs</span>
                            <span className="font-bold text-purple-800">{g.a}</span>
                            <span className="px-2 py-0.5 rounded bg-white text-slate-700 border border-sky-200 text-[11px]">
                              {getGameStatus(g) === "PENDING" ? "UPCOMING" : `${g.sc}`}
                            </span>
                            {getGameStatus(g) === "WIN" ? (
                              <span className="px-2 py-0.5 rounded bg-emerald-600 text-white text-[11px] font-bold">
                                WIN ✓ ({getGamePredWinner(g)})
                              </span>
                            ) : getGameStatus(g) === "LOSS" ? (
                              <span className="px-2 py-0.5 rounded bg-rose-600 text-white text-[11px] font-bold">
                                LOSS ✗ (Pred: {getGamePredWinner(g)})
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-bold">
                                PENDING
                              </span>
                            )}
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                activeVip3Of(g)
                                  ? "bg-amber-500 text-slate-950"
                                  : activeF1WtpOf(g)
                                    ? "bg-emerald-600 text-white"
                                    : "bg-slate-200 text-slate-700"
                              }`}
                            >
                              {activeVip3Of(g) ? "ویژه FIRE / VIP ✓" : activeF1WtpOf(g) ? "تایید سیستم جدید ✓" : "خارج از سیگنال"}
                            </span>
                            {(() => {
                              const rw = activeWtpOf(g);
                              if (!rw?.mel) return null;
                              return (
                                <span
                                  className={`px-2 py-0.5 rounded border font-mono text-[10.5px] font-bold ${
                                    rw.mel === "FIRE"
                                      ? "bg-amber-50 text-amber-950 border-amber-300"
                                      : rw.mel === "AIR"
                                        ? "bg-emerald-50 text-emerald-900 border-emerald-300"
                                        : rw.mel === "WATER"
                                          ? "bg-sky-50 text-sky-900 border-sky-300"
                                          : "bg-rose-50 text-rose-900 border-rose-300"
                                  }`}
                                  dir="ltr"
                                  title={`${oddsFreqMode === "daily" ? "Daily" : "Weekly"} (${rw.mon}) • Log5 Home: ${rw.l5h}% | Fair Odds H ${rw.hodds}x / A ${rw.aodds}x`}
                                >
                                  Log5 {oddsFreqMode === "daily" ? "DAY" : "MON"}: {rw.mel} ({rw.hodds}x / {rw.aodds}x)
                                </span>
                              );
                            })()}
                          </div>

                          <div className="flex flex-wrap items-center gap-2 font-mono text-xs" dir="ltr">
                            <span className="bg-white px-2 py-0.5 rounded border border-sky-200">
                              <b className="text-emerald-700">
                                HOME {hw} (+{avgHome})
                              </b>
                              <span className="text-slate-400 mx-1">/</span>
                              <b className="text-rose-700">
                                AWAY {aw} (-{avgAway})
                              </b>
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded border text-[11px] font-bold ${
                                liveIdx.delta > 0
                                  ? "bg-emerald-50 text-emerald-950 border-emerald-300"
                                  : liveIdx.delta < 0
                                    ? "bg-rose-50 text-rose-950 border-rose-300"
                                    : "bg-slate-50 text-slate-700 border-slate-300"
                              }`}
                              title={`H: ${liveIdx.formulaH} = +${liveIdx.idxH} | A: ${liveIdx.formulaA} = -${liveIdx.idxA} | S=${liveIdx.scoreH}:${liveIdx.scoreA}`}
                            >
                              Idx: +{liveIdx.idxH} / -{liveIdx.idxA} (Δ {liveIdx.delta > 0 ? `+${liveIdx.delta}` : liveIdx.delta})
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded font-extrabold text-[11px] ${
                                ch3Vh === 4
                                  ? "bg-emerald-600 text-white"
                                  : ch3Vh > ch3Va
                                    ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                                    : ch3Va === 4
                                      ? "bg-rose-600 text-white"
                                      : ch3Va > ch3Vh
                                        ? "bg-rose-100 text-rose-900 border border-rose-300"
                                        : "bg-slate-100 text-slate-700 border border-slate-300"
                              }`}
                              title={`شکل رملی ۴ خطی روزانه جدول: ${targetGeoTab} (${decodeGeoTabFa(targetGeoTab)})`}
                            >
                              4Ch Δ+S: {ch3Vh}-{ch3Va} {ch3Vh > ch3Va ? "H" : ch3Va > ch3Vh ? "A" : "="} • TAB:{targetGeoTab}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded font-bold text-[11px] ${
                                hw > aw
                                  ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                                  : aw > hw
                                    ? "bg-rose-100 text-rose-900 border border-rose-300"
                                    : "bg-slate-100 text-slate-700 border border-slate-300"
                              }`}
                            >
                              {majTeam} ({majPct}%)
                            </span>
                            <span className="text-sky-950 font-extrabold bg-amber-100 border border-amber-300 px-2 py-0.5 rounded">
                              {filteredPool.length} / {dayPool.length} ردیف
                            </span>
                            <span className="px-2 py-0.5 rounded bg-white border border-sky-300 text-sky-900 font-bold text-[11px]">
                              {isOpen ? "بستن ▲" : "باز کردن ▼"}
                            </span>
                          </div>
                        </div>

                        {/* Expanded Manual Filter Body (Light Pale-Blue & Crisp White) */}
                        {isOpen && (
                          <div className="p-3.5 bg-sky-50/40 space-y-3 border-t border-sky-200">
                            {/* Action Buttons Bar (Exact GOLD-FORMULA-PRIORITY Controls + 3 Independent Channels) */}
                            <div className="flex flex-wrap items-center gap-1.5">
                              {/* 1A. Auto GEO-FIN First */}
                              <button
                                type="button"
                                onClick={() => {
                                  const res = computeAutoFilterState(
                                    targetEl12,
                                    targetGeoFin,
                                    dayPool,
                                    manualPersp,
                                    true,
                                    "fin"
                                  );
                                  setManualGeoKind("fin");
                                  setManualFilters((prev) => ({
                                    ...prev,
                                    [g.n]: res.state,
                                  }));
                                }}
                                className="px-2.5 py-1.5 rounded bg-sky-600 hover:bg-sky-700 text-white font-bold text-[11px] transition-colors shadow-sm"
                              >
                                ۲. انتخاب خودکار (GEO-FIN اول)
                              </button>

                              {/* 1B. Auto GEO-DYN First (Independent Channel 3) */}
                              <button
                                type="button"
                                onClick={() => {
                                  const res = computeAutoFilterState(
                                    targetEl12,
                                    targetGeoDyn,
                                    dayPool,
                                    manualPersp,
                                    true,
                                    "dyn"
                                  );
                                  setManualGeoKind("dyn");
                                  setManualFilters((prev) => ({
                                    ...prev,
                                    [g.n]: res.state,
                                  }));
                                }}
                                className="px-2.5 py-1.5 rounded bg-cyan-700 hover:bg-cyan-800 text-white font-bold text-[11px] transition-colors shadow-sm"
                              >
                                ۳. انتخاب خودکار (GEO-DYN اول)
                              </button>

                              {/* 1C. Auto GEO-TAB First (Independent Channel 4: Daily 4-Line Standings Figure) */}
                              <button
                                type="button"
                                onClick={() => {
                                  const res = computeAutoFilterState(
                                    targetEl12,
                                    targetGeoTab,
                                    dayPool,
                                    manualPersp,
                                    true,
                                    "tab"
                                  );
                                  setManualFilters((prev) => ({
                                    ...prev,
                                    [g.n]: res.state,
                                  }));
                                }}
                                className="px-2.5 py-1.5 rounded bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-[11px] transition-colors shadow-sm"
                                title={decodeGeoTabFa(targetGeoTab)}
                              >
                                ۴. انتخاب خودکار (GEO-TAB جدول اول: {targetGeoTab})
                              </button>

                              {/* 2. Target PRIM (ELE-DYN) */}
                              <button
                                type="button"
                                onClick={() =>
                                  updateGameFilter((prev) => ({
                                    ...prev,
                                    cols: {
                                      ...prev.cols,
                                      0: targetEl12[0],
                                      1: targetEl12[1],
                                      2: targetEl12[2],
                                      3: targetEl12[3],
                                    },
                                    modeLabel: "مقادیر PRIM هدف (ELE-DYN)",
                                  }))
                                }
                                className="px-2.5 py-1.5 rounded bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] transition-colors shadow-sm"
                              >
                                مقادیر PRIM هدف (ELE-DYN)
                              </button>

                              {/* 3. Target FINAL (ELE-FINAL) */}
                              <button
                                type="button"
                                onClick={() =>
                                  updateGameFilter((prev) => ({
                                    ...prev,
                                    cols: {
                                      ...prev.cols,
                                      4: targetEl12[4],
                                      5: targetEl12[5],
                                      6: targetEl12[6],
                                      7: targetEl12[7],
                                    },
                                    modeLabel: "مقادیر FINAL هدف (ELE-FINAL)",
                                  }))
                                }
                                className="px-2.5 py-1.5 rounded bg-teal-600 hover:bg-teal-700 text-white font-bold text-[11px] transition-colors shadow-sm"
                              >
                                مقادیر FINAL هدف (ELE-FINAL)
                              </button>

                              {/* 4. Target ELE-P */}
                              <button
                                type="button"
                                onClick={() =>
                                  updateGameFilter((prev) => ({
                                    ...prev,
                                    cols: {
                                      ...prev.cols,
                                      8: targetEl12[8],
                                      9: targetEl12[9],
                                      10: targetEl12[10],
                                      11: targetEl12[11],
                                    },
                                    modeLabel: "مقادیر ELE-P هدف",
                                  }))
                                }
                                className="px-2.5 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] transition-colors shadow-sm"
                              >
                                مقادیر ELE-P هدف
                              </button>

                              {/* 5. Pink Next Best Frequency Button */}
                              {nextBestCol !== null && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const colKey = MANUAL_COL_META[nextBestCol!].key;
                                    const tVal = targetEl12[nextBestCol!];
                                    updateGameFilter((prev) => ({
                                      ...prev,
                                      cols: { ...prev.cols, [nextBestCol!]: tVal },
                                      modeLabel: "گام‌به‌گام دستی",
                                      pathLog: [
                                        ...(prev.pathLog ?? []),
                                        `${colKey}=${tVal} (${nextBestCnt})`,
                                      ],
                                    }));
                                  }}
                                  className="px-3 py-1.5 rounded bg-pink-600 hover:bg-pink-700 text-white font-extrabold text-[11px] transition-colors shadow-sm"
                                >
                                  انتخاب بعدی: {MANUAL_COL_META[nextBestCol].key} ({targetEl12[nextBestCol]}) — تعداد: {nextBestCnt}
                                </button>
                              )}

                              {/* 6. Green Full Step-by-Step Highest Frequency (Independent Channel 1) */}
                              <button
                                type="button"
                                onClick={() => {
                                  const res = computeAutoFilterState(
                                    targetEl12,
                                    targetGeoFin,
                                    dayPool,
                                    manualPersp,
                                    false,
                                    "fin"
                                  );
                                  setManualGeoKind("fin");
                                  setManualFilters((prev) => ({
                                    ...prev,
                                    [g.n]: res.state,
                                  }));
                                }}
                                className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[11px] transition-colors shadow-sm"
                              >
                                ۱. فیلتر کامل بیشترین تکرار (گام‌به‌گام STEP)
                              </button>

                              {/* 7. Purple Smart Auto-Select (Best of GEO & STEP) */}
                              <button
                                type="button"
                                onClick={() => {
                                  const stepRes = computeAutoFilterState(
                                    targetEl12,
                                    targetGeoFin,
                                    dayPool,
                                    manualPersp,
                                    false,
                                    "fin"
                                  );
                                  const geoRes = computeAutoFilterState(
                                    targetEl12,
                                    targetGeo,
                                    dayPool,
                                    manualPersp,
                                    true,
                                    rowGeoKind
                                  );
                                  const f30Val = g.f30 ?? g.vm6 ?? 0;
                                  const stepAgrees = (stepRes.hw >= stepRes.aw) === (f30Val >= 0);
                                  const geoAgrees = (geoRes.hw >= geoRes.aw) === (f30Val >= 0);
                                  const pickGeo =
                                    (stepRes.pct < 60 || (stepAgrees && !geoAgrees && stepRes.pct >= 55))
                                      ? false
                                      : !stepAgrees && geoAgrees && geoRes.pct >= 55
                                        ? true
                                        : geoRes.pct > stepRes.pct ||
                                          (geoRes.pct === stepRes.pct && geoRes.mv > stepRes.mv);
                                  const chosen = pickGeo ? geoRes : stepRes;
                                  setManualFilters((prev) => ({
                                    ...prev,
                                    [g.n]: {
                                      ...chosen.state,
                                      modeLabel: `هوشمند خودکار (${pickGeo ? "GEO اول" : "گام‌به‌گام"})`,
                                      stepSummary: stepRes.sumStr,
                                      geoSummary: geoRes.sumStr,
                                    },
                                  }));
                                }}
                                className="px-3 py-1.5 rounded bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-[11px] transition-colors shadow-sm"
                              >
                                ⚡ انتخاب هوشمند خودکار (بهترینِ GEO و گام‌به‌گام)
                              </button>

                              {/* 8. Clear Filters */}
                              <button
                                type="button"
                                onClick={() =>
                                  setManualFilters((prev) => ({
                                    ...prev,
                                    [g.n]: { cols: {}, geo: "ALL", geoTab: "ALL" },
                                  }))
                                }
                                className="px-2.5 py-1.5 rounded bg-rose-100 hover:bg-rose-200 text-rose-900 border border-rose-300 font-bold text-[11px] transition-colors"
                              >
                                پاک‌کردن فیلترها
                              </button>

                              {/* 9. Copy for Excel */}
                              <button
                                type="button"
                                onClick={() => {
                                  const headers = [
                                    "#", "DAY", "DATE", "HOME", "AWAY", "SCORE",
                                    ...MANUAL_COL_META.map((m) => m.key),
                                    "GEO-FIG", "GEO-TAB", "MARGIN",
                                  ];
                                  const tRow = [
                                    "TARGET", g.day, g.d, g.h, g.a, g.sc,
                                    ...targetEl12,
                                    targetGeo,
                                    targetGeoTab,
                                    g.st === "PENDING" ? `FUSION:${g.f30 ?? 0}` : g.aw,
                                  ];
                                  const hRows = filteredPool.map((r, i) => [
                                    String(i + 1),
                                    r.day,
                                    r.d,
                                    r.h,
                                    r.a,
                                    `${r.hp}-${r.ap}`,
                                    ...getRowEl12(r),
                                    getRowGeo(r),
                                    getRowGeoTab(r),
                                    r.mg > 0 ? `+${r.mg}` : String(r.mg),
                                  ]);
                                  const tsv = [headers, tRow, ...hRows]
                                    .map((row) => row.join("\t"))
                                    .join("\n");
                                  navigator.clipboard?.writeText(tsv);
                                  setCopiedGame(g.n);
                                  setTimeout(() => setCopiedGame(null), 2000);
                                }}
                                className="px-2.5 py-1.5 rounded bg-white hover:bg-sky-50 text-sky-950 border border-sky-300 font-bold text-[11px] transition-colors shadow-sm"
                              >
                                {copiedGame === g.n ? "کپی شد! ✓" : "کپی برای Excel"}
                              </button>
                            </div>

                            {/* 3-Channel Independent Numerical Index Header Strip (Directly Above 13-Dropdown Table) */}
                            {ch3Open && (
                              <div
                                className="rounded-lg border border-sky-300 bg-white p-2.5 shadow-sm space-y-2"
                                data-testid={`manual-idx3-header-${g.n}`}
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sky-100 pb-1.5">
                                  <div className="text-xs font-extrabold text-sky-950">
                                    سرستون شاخص عددی تقویت‌شده (Δ+S) در ۴ کانال مستقل (هم‌جهتی Δ با مجموع S + کانال ۴ شکل رملی ۴ خطی روزانه جدول GEO-TAB • کلیک روی هر کانال آن را بارگذاری می‌کند)
                                  </div>
                                  <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
                                    <span
                                      className={`px-2.5 py-0.5 rounded font-extrabold ${
                                        ch3Open.votesHome === 4
                                          ? "bg-emerald-600 text-white"
                                          : ch3Open.votesHome > ch3Open.votesAway
                                            ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                                            : ch3Open.votesAway === 4
                                              ? "bg-rose-600 text-white"
                                              : ch3Open.votesAway > ch3Open.votesHome
                                                ? "bg-rose-100 text-rose-900 border border-rose-300"
                                                : "bg-slate-100 text-slate-700 border border-slate-300"
                                      }`}
                                    >
                                      رأی ۴ کانال مستقل (Δ+S): {ch3Open.votesHome} به {ch3Open.votesAway}{" "}
                                      {ch3Open.votesHome > ch3Open.votesAway
                                        ? `به نفع بازیکن ۱ (${g.h})`
                                        : ch3Open.votesAway > ch3Open.votesHome
                                          ? `به نفع بازیکن ۲ (${g.a})`
                                          : "مساوی"}
                                      {ch3Open.votesHome === 4 && (
                                        <bdi dir="ltr" className="inline-block mr-1">
                                          (Δmin=+{ch3Open.minDelta})
                                        </bdi>
                                      )}
                                    </span>
                                    <span className="px-2 py-0.5 rounded bg-sky-100 text-sky-950 border border-sky-300 font-bold" dir="ltr">
                                      Active Pool ({filteredPool.length}r): P1 +{liveIdx.idxH} ({liveIdx.formulaH}) | P2 -{liveIdx.idxA} ({liveIdx.formulaA}) ➔ Δ={liveIdx.delta > 0 ? `+${liveIdx.delta}` : liveIdx.delta} • S={liveIdx.scoreH}:{liveIdx.scoreA} (Δ+S={liveIdx.effDelta > 0 ? `+${liveIdx.effDelta}` : liveIdx.effDelta})
                                    </span>
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2 font-mono text-[11px]">
                                  {[
                                    {
                                      key: "st",
                                      titleFa: "۱. گام‌به‌گام (STEP مستقل)",
                                      res: ch3Open.step,
                                      idx: ch3Open.idxSt,
                                      gKind: "fin" as const,
                                    },
                                    {
                                      key: "gf",
                                      titleFa: "۲. اول شکل رمل اصلاح‌شده (GEO-FIN)",
                                      res: ch3Open.geoFin,
                                      idx: ch3Open.idxGf,
                                      gKind: "fin" as const,
                                    },
                                    {
                                      key: "gd",
                                      titleFa: "۳. اول شکل رمل پویا (GEO-DYN)",
                                      res: ch3Open.geoDyn,
                                      idx: ch3Open.idxGd,
                                      gKind: "dyn" as const,
                                    },
                                    {
                                      key: "gt",
                                      titleFa: `۴. اول شکل رمل جدول روزانه (GEO-TAB ${targetGeoTab})`,
                                      res: ch3Open.geoTab,
                                      idx: ch3Open.idxGt,
                                      gKind: "fin" as const,
                                    },
                                  ].map((ch) => (
                                    <button
                                      key={ch.key}
                                      type="button"
                                      onClick={() => {
                                        setManualGeoKind(ch.gKind);
                                        setManualFilters((prev) => ({
                                          ...prev,
                                          [g.n]: ch.res.state,
                                        }));
                                      }}
                                      className={`text-right rounded-lg p-2 border transition-all hover:shadow ${
                                        ch.idx.effDelta > 0
                                          ? "bg-emerald-50/75 border-emerald-300 hover:bg-emerald-100/70"
                                          : ch.idx.effDelta < 0
                                            ? "bg-rose-50/75 border-rose-300 hover:bg-rose-100/70"
                                            : "bg-slate-50 border-slate-200 hover:bg-sky-50"
                                      }`}
                                    >
                                      <div className="flex items-center justify-between gap-1 mb-1">
                                        <span className="font-sans font-extrabold text-sky-950 text-[10.5px]">
                                          {ch.titleFa}
                                        </span>
                                        <span className="px-1.5 py-0.5 rounded bg-white border border-sky-200 text-[10px] font-bold text-slate-700 whitespace-nowrap" dir="ltr">
                                          {ch.res.unslicedPool.length}r • {ch.idx.hw}P1-{ch.idx.aw}P2
                                          {ch.res.isNatural57 ? " (5-7✓)" : ""}
                                        </span>
                                      </div>
                                      <div className="flex items-center justify-between gap-1 text-[10px]" dir="ltr">
                                        <span className="text-emerald-800 font-bold">
                                          P1: {ch.idx.formulaH} = <b>+{ch.idx.idxH}</b>
                                        </span>
                                        <span className="text-rose-800 font-bold">
                                          P2: {ch.idx.formulaA} = <b>-{ch.idx.idxA}</b>
                                        </span>
                                      </div>
                                      <div className="flex items-center justify-between gap-1 mt-1 pt-1 border-t border-black/5 text-[10px]" dir="ltr">
                                        <span className="font-extrabold text-slate-800">
                                          Δ={ch.idx.delta > 0 ? `+${ch.idx.delta}` : ch.idx.delta} • S={ch.idx.scoreH}:{ch.idx.scoreA}
                                        </span>
                                        <span
                                          className={`font-sans font-extrabold px-1.5 py-0.5 rounded ${
                                            ch.idx.effDelta > 0
                                              ? "bg-emerald-600 text-white"
                                              : ch.idx.effDelta < 0
                                                ? "bg-rose-600 text-white"
                                                : "bg-slate-300 text-slate-800"
                                          }`}
                                        >
                                          {ch.idx.effDelta > 0 ? "برد Δ+S بازیکن ۱" : ch.idx.effDelta < 0 ? "برد Δ+S بازیکن ۲" : "تساوی/خنثی"}
                                        </span>
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Active Filter Path & STEP vs GEO Comparison Banner (Light Blue) */}
                            {(curState.pathLog?.length || curState.stepSummary) && (
                              <div className="px-3 py-2 rounded bg-sky-100/80 border border-sky-300 text-[11px] font-mono flex flex-wrap items-center justify-between gap-2 text-slate-900">
                                <div>
                                  <span className="text-sky-950 font-extrabold">
                                    {curState.modeLabel ?? "مسیر فیلتر"}:{" "}
                                  </span>
                                  <span className="text-emerald-800 font-bold" dir="ltr">
                                    {curState.pathLog && curState.pathLog.length > 0
                                      ? curState.pathLog.join(" ➔ ")
                                      : "بدون فیلتر (همه مسابقات روز)"}
                                  </span>
                                </div>
                                {curState.stepSummary && curState.geoSummary && (
                                  <div className="flex items-center gap-3 text-xs">
                                    <span className="text-emerald-800 bg-white px-2 py-0.5 rounded border border-emerald-300">
                                      گام‌به‌گام (STEP): <b>{curState.stepSummary}</b>
                                    </span>
                                    <span className="text-sky-900 bg-white px-2 py-0.5 rounded border border-sky-300">
                                      GEO اول: <b>{curState.geoSummary}</b>
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* 13-Dropdown Filter & Results Table (Light Pale-Blue Theme) */}
                            <div className="overflow-x-auto border border-sky-300 rounded-md bg-white shadow-sm" dir="ltr">
                              <table className="w-full text-[11px] font-mono text-center border-collapse">
                                <thead>
                                  {/* Group Header Row */}
                                  <tr className="bg-sky-100 text-sky-950 border-b border-sky-300">
                                    <th colSpan={5} className="p-1.5 text-left pl-3 text-sky-950 font-extrabold">
                                      MATCHUP INFO ({manualPersp === "home" ? "PLAYER 1 ELEMENTAL VIEW" : "PLAYER 2 ELEMENTAL VIEW"})
                                    </th>
                                    <th colSpan={4} className="p-1.5 bg-indigo-100/90 text-indigo-950 border-x border-sky-300 font-extrabold">
                                      PRIM 1..4 ≡ ELE-DYN (P+FIN)
                                    </th>
                                    <th colSpan={4} className="p-1.5 bg-teal-100/90 text-teal-950 border-x border-sky-300 font-extrabold">
                                      FINAL 1..4 ≡ ELE-FINAL
                                    </th>
                                    <th colSpan={4} className="p-1.5 bg-sky-200/80 text-sky-950 border-x border-sky-300 font-extrabold">
                                      ELE-P 1..4 ≡ ELE-P
                                    </th>
                                    <th className="p-1.5 bg-amber-100/90 text-amber-950 border-x border-sky-300 font-extrabold">
                                      CODE-DYN
                                    </th>
                                    <th className="p-1.5 bg-orange-100/90 text-orange-950 border-x border-sky-300 font-extrabold" title="شکل رملی ۴ خطی روزانه قدرت پایه دو بازیکن (تا شب قبل)">
                                      GEO-TAB
                                    </th>
                                    <th className="p-1.5 text-emerald-900 font-extrabold">RESULT</th>
                                  </tr>

                                  {/* Column Names + Interactive Dropdowns Row */}
                                  <tr className="bg-sky-50 text-slate-800 border-b border-sky-300 align-bottom">
                                    <th className="p-1.5">#</th>
                                    <th className="p-1.5">DAY</th>
                                    <th className="p-1.5">DATE</th>
                                    <th className="p-1.5">P1 vs P2</th>
                                    <th className="p-1.5">SCORE</th>

                                    {MANUAL_COL_META.map((col) => {
                                      const cIdx = col.idx;
                                      const selVal = curState.cols[cIdx] ?? "ALL";
                                      const tVal = targetEl12[cIdx] ?? "";
                                      const isNext = nextBestCol === cIdx;

                                      const poolForCol = dayPool.filter((r) => {
                                        const el = getRowEl12(r);
                                        for (let k = 0; k < 12; k++) {
                                          if (k === cIdx) continue;
                                          const s = curState.cols[k];
                                          if (s && s !== "ALL" && el[k] !== s) return false;
                                        }
                                        if (curState.geo && curState.geo !== "ALL" && getRowGeo(r) !== curState.geo) {
                                          return false;
                                        }
                                        if (curState.geoTab && curState.geoTab !== "ALL" && getRowGeoTab(r) !== curState.geoTab) {
                                          return false;
                                        }
                                        return true;
                                      });

                                      const counts: Record<string, number> = {};
                                      poolForCol.forEach((r) => {
                                        const v = getRowEl12(r)[cIdx];
                                        if (v) counts[v] = (counts[v] ?? 0) + 1;
                                      });
                                      if (tVal && !(tVal in counts)) counts[tVal] = 0;

                                      const options = Object.keys(counts).sort((a, b) => {
                                        const na = parseInt(a.split(" ")[0] || "0", 10);
                                        const nb = parseInt(b.split(" ")[0] || "0", 10);
                                        return na - nb;
                                      });

                                      return (
                                        <th
                                          key={col.key}
                                          className={`p-1 border-x border-sky-200 min-w-[92px] ${
                                            selVal !== "ALL"
                                              ? "bg-sky-200/80"
                                              : isNext
                                                ? "bg-pink-100/80"
                                                : ""
                                          }`}
                                        >
                                          {isNext && (
                                            <div className="text-[9px] font-extrabold text-pink-700 mb-0.5 whitespace-nowrap">
                                              ← انتخاب بعدی ({nextBestCnt})
                                            </div>
                                          )}
                                          <div className="text-[10px] font-extrabold text-sky-950">
                                            {col.key}
                                          </div>
                                          <div className="text-[9px] text-slate-600 mb-1">
                                            {col.sub}
                                          </div>
                                          <select
                                            value={selVal}
                                            onChange={(e) => {
                                              const v = e.target.value;
                                              updateGameFilter((prev) => ({
                                                ...prev,
                                                cols: { ...prev.cols, [cIdx]: v },
                                                modeLabel: "فیلتر دستی کاربر",
                                              }));
                                            }}
                                            className={`w-full h-6 rounded px-1 text-[10px] font-mono border ${
                                              selVal !== "ALL"
                                                ? "bg-sky-600 text-white font-extrabold border-sky-700"
                                                : "bg-white text-slate-900 border-sky-300"
                                            }`}
                                          >
                                            <option value="ALL">همه ({poolForCol.length})</option>
                                            {options.map((opt) => (
                                              <option key={opt} value={opt}>
                                                {opt === tVal ? "★ " : ""}
                                                {opt} ({counts[opt]})
                                              </option>
                                            ))}
                                          </select>
                                        </th>
                                      );
                                    })}

                                    {/* 13th Dropdown: GEO-FIG (CODE-DYN) */}
                                    {(() => {
                                      const selGeo = curState.geo ?? "ALL";
                                      const poolForGeo = dayPool.filter((r) => {
                                        const el = getRowEl12(r);
                                        for (let k = 0; k < 12; k++) {
                                          const s = curState.cols[k];
                                          if (s && s !== "ALL" && el[k] !== s) return false;
                                        }
                                        if (curState.geoTab && curState.geoTab !== "ALL" && getRowGeoTab(r) !== curState.geoTab) {
                                          return false;
                                        }
                                        return true;
                                      });
                                      const geoCounts: Record<string, number> = {};
                                      poolForGeo.forEach((r) => {
                                        const gv = getRowGeo(r);
                                        if (gv) geoCounts[gv] = (geoCounts[gv] ?? 0) + 1;
                                      });
                                      if (targetGeo && !(targetGeo in geoCounts)) geoCounts[targetGeo] = 0;
                                      const geoOpts = Object.keys(geoCounts).sort();

                                      return (
                                        <th
                                          className={`p-1 border-x border-sky-200 min-w-[86px] ${
                                            selGeo !== "ALL" ? "bg-sky-200/80" : ""
                                          }`}
                                        >
                                          <div className="text-[10px] font-extrabold text-amber-900">
                                            GEO-FIG
                                          </div>
                                          <div className="text-[9px] text-slate-600 mb-1">
                                            CODE-DYN
                                          </div>
                                          <select
                                            value={selGeo}
                                            onChange={(e) => {
                                              const v = e.target.value;
                                              updateGameFilter((prev) => ({
                                                ...prev,
                                                geo: v,
                                                modeLabel: "فیلتر دستی کاربر",
                                              }));
                                            }}
                                            className={`w-full h-6 rounded px-1 text-[10px] font-mono border ${
                                              selGeo !== "ALL"
                                                ? "bg-sky-600 text-white font-extrabold border-sky-700"
                                                : "bg-white text-slate-900 border-sky-300"
                                            }`}
                                          >
                                            <option value="ALL">همه ({poolForGeo.length})</option>
                                            {geoOpts.map((opt) => (
                                              <option key={opt} value={opt}>
                                                {opt === targetGeo ? "★ " : ""}
                                                {opt} ({geoCounts[opt]})
                                              </option>
                                            ))}
                                          </select>
                                        </th>
                                      );
                                    })()}

                                    {/* 14th Dropdown: GEO-TAB (Daily 4-Line Standings Geomantic Figure) */}
                                    {(() => {
                                      const selTab = curState.geoTab ?? "ALL";
                                      const poolForTab = dayPool.filter((r) => {
                                        const el = getRowEl12(r);
                                        for (let k = 0; k < 12; k++) {
                                          const s = curState.cols[k];
                                          if (s && s !== "ALL" && el[k] !== s) return false;
                                        }
                                        if (curState.geo && curState.geo !== "ALL" && getRowGeo(r) !== curState.geo) {
                                          return false;
                                        }
                                        return true;
                                      });
                                      const tabCounts: Record<string, number> = {};
                                      poolForTab.forEach((r) => {
                                        const tv = getRowGeoTab(r);
                                        if (tv) tabCounts[tv] = (tabCounts[tv] ?? 0) + 1;
                                      });
                                      if (targetGeoTab && !(targetGeoTab in tabCounts)) tabCounts[targetGeoTab] = 0;
                                      const tabOpts = Object.keys(tabCounts).sort();

                                      return (
                                        <th
                                          className={`p-1 border-x border-sky-200 min-w-[92px] ${
                                            selTab !== "ALL" ? "bg-orange-200/80" : ""
                                          }`}
                                          title={decodeGeoTabFa(targetGeoTab)}
                                        >
                                          <div className="text-[10px] font-extrabold text-orange-950">
                                            GEO-TAB
                                          </div>
                                          <div className="text-[9px] text-slate-600 mb-1">
                                            RANK-4L
                                          </div>
                                          <select
                                            value={selTab}
                                            onChange={(e) => {
                                              const v = e.target.value;
                                              updateGameFilter((prev) => ({
                                                ...prev,
                                                geoTab: v,
                                                modeLabel: "فیلتر دستی شکل جدول (GEO-TAB)",
                                              }));
                                            }}
                                            className={`w-full h-6 rounded px-1 text-[10px] font-mono border ${
                                              selTab !== "ALL"
                                                ? "bg-orange-600 text-white font-extrabold border-orange-700"
                                                : "bg-white text-slate-900 border-sky-300"
                                            }`}
                                          >
                                            <option value="ALL">همه ({poolForTab.length})</option>
                                            {tabOpts.map((opt) => (
                                              <option key={opt} value={opt}>
                                                {opt === targetGeoTab ? "★ " : ""}
                                                {opt} ({tabCounts[opt]})
                                              </option>
                                            ))}
                                          </select>
                                        </th>
                                      );
                                    })()}

                                    <th className="p-1.5 min-w-[90px]">
                                      <div className="text-[10px] font-extrabold text-sky-950">MARGIN</div>
                                      <div className="text-[9px] text-slate-600">HOME - AWAY</div>
                                    </th>
                                  </tr>
                                </thead>

                                <tbody>
                                  {/* ROW 0: TARGET GAME ROW (Light Gold/Amber Highlight) */}
                                  <tr className="bg-amber-100/90 border-b-2 border-amber-400 text-amber-950 font-bold">
                                    <td className="p-1.5 text-amber-900 font-extrabold">TARGET</td>
                                    <td className="p-1.5">{g.day}</td>
                                    <td className="p-1.5 whitespace-nowrap">{g.d}</td>
                                    <td className="p-1.5 whitespace-nowrap text-left">
                                      <span className="text-blue-900 font-extrabold">{g.h}</span> vs{" "}
                                      <span className="text-purple-900 font-extrabold">{g.a}</span>
                                    </td>
                                    <td className="p-1.5 whitespace-nowrap">{g.sc}</td>
                                    {targetEl12.map((val, ci) => (
                                      <td
                                        key={ci}
                                        className="p-1.5 border-x border-amber-300 text-amber-950 whitespace-nowrap"
                                      >
                                        ★ {val}
                                      </td>
                                    ))}
                                    <td className="p-1.5 border-x border-amber-300 text-amber-950 font-extrabold">
                                      ★ {targetGeo}
                                    </td>
                                    <td
                                      className="p-1.5 border-x border-amber-300 text-orange-950 font-extrabold"
                                      title={decodeGeoTabFa(targetGeoTab)}
                                    >
                                      ★ {targetGeoTab}
                                    </td>
                                    <td className="p-1.5 whitespace-nowrap">
                                      {g.st === "PENDING" ? (
                                        <span className="text-sky-900 font-extrabold">
                                          FUSION: {(g.f30 ?? 0) > 0 ? `+${g.f30}` : g.f30 ?? 0}
                                        </span>
                                      ) : (
                                        <span
                                          className={
                                            g.aw === g.h ? "text-emerald-800 font-extrabold" : "text-rose-800 font-extrabold"
                                          }
                                        >
                                          WIN: {g.aw}
                                        </span>
                                      )}
                                    </td>
                                  </tr>

                                  {/* FILTERED HISTORICAL TWIN ROWS (2010–2026) */}
                                  {visibleHistRows.map((r, rIdx) => {
                                    const rEl12 = getRowEl12(r);
                                    const rGeo = getRowGeo(r);
                                    const rGeoTab = getRowGeoTab(r);
                                    return (
                                      <tr
                                        key={`${r.d}-${r.h}-${rIdx}`}
                                        className="border-b border-sky-100 even:bg-sky-50/40 hover:bg-sky-100/60 transition-colors text-slate-800"
                                      >
                                        <td className="p-1.5 text-slate-500">{rIdx + 1}</td>
                                        <td className="p-1.5 text-slate-700">{r.day}</td>
                                        <td className="p-1.5 whitespace-nowrap text-slate-900 font-medium">
                                          {r.d}
                                        </td>
                                        <td className="p-1.5 whitespace-nowrap text-left">
                                          <span
                                            className={
                                              r.mg > 0
                                                ? "text-emerald-800 font-bold"
                                                : "text-slate-700"
                                            }
                                          >
                                            {r.h}
                                          </span>{" "}
                                          <span className="text-slate-400">vs</span>{" "}
                                          <span
                                            className={
                                              r.mg < 0
                                                ? "text-rose-800 font-bold"
                                                : "text-slate-700"
                                            }
                                          >
                                            {r.a}
                                          </span>
                                        </td>
                                        <td className="p-1.5 whitespace-nowrap text-slate-700">
                                          {r.hp}-{r.ap}
                                        </td>
                                        {rEl12.map((val, ci) => {
                                          const isMatch = val === targetEl12[ci];
                                          const isFiltered =
                                            curState.cols[ci] && curState.cols[ci] !== "ALL";
                                          return (
                                            <td
                                              key={ci}
                                              className={`p-1.5 border-x border-sky-100 whitespace-nowrap ${
                                                isFiltered
                                                  ? "bg-sky-200/80 text-sky-950 font-extrabold"
                                                  : isMatch
                                                    ? "bg-emerald-50 text-emerald-900 font-semibold"
                                                    : "text-slate-600"
                                              }`}
                                            >
                                              {val}
                                            </td>
                                          );
                                        })}
                                        <td
                                          className={`p-1.5 border-x border-sky-100 font-bold ${
                                            curState.geo && curState.geo !== "ALL"
                                              ? "bg-sky-200/80 text-sky-950"
                                              : rGeo === targetGeo
                                                ? "bg-emerald-50 text-emerald-900"
                                                : "text-slate-600"
                                          }`}
                                        >
                                          {rGeo}
                                        </td>
                                        <td
                                          title={decodeGeoTabFa(rGeoTab)}
                                          className={`p-1.5 border-x border-sky-100 font-bold ${
                                            curState.geoTab && curState.geoTab !== "ALL"
                                              ? "bg-orange-200/80 text-orange-950"
                                              : rGeoTab === targetGeoTab
                                                ? "bg-emerald-50 text-emerald-900"
                                                : "text-slate-600"
                                          }`}
                                        >
                                          {rGeoTab}
                                        </td>
                                        <td
                                          className={`p-1.5 whitespace-nowrap font-bold ${
                                            r.mg > 0 ? "text-emerald-700" : "text-rose-700"
                                          }`}
                                        >
                                          {r.mg > 0 ? `+${r.mg} (HOME)` : `${r.mg} (AWAY)`}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>

                            {/* Show More toggle if > 60 rows */}
                            {filteredPool.length > 60 && (
                              <div className="text-center pt-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setManualShowAllRows((prev) => ({
                                      ...prev,
                                      [g.n]: !showAll,
                                    }))
                                  }
                                  className="px-3 py-1 rounded bg-white hover:bg-sky-100 text-sky-900 border border-sky-300 text-xs font-mono font-bold shadow-sm"
                                >
                                  {showAll
                                    ? "نمایش ۶۰ ردیف اول"
                                    : `نمایش تمام ${filteredPool.length} ردیف همزاد فیلترشده...`}
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Collapsible Dropdown 3: Summary Games & Predictions Table */}
        <div className="rounded-lg border border-sky-200 bg-sky-50/50 overflow-hidden">
          <div
            onClick={() => setOpenSummaryTable((v) => !v)}
            className="px-4 py-2.5 bg-sky-100/80 hover:bg-sky-100 cursor-pointer flex flex-wrap items-center justify-between gap-2 border-b border-sky-200/80 transition-colors"
          >
            <div className="flex items-center gap-2 text-xs font-bold text-sky-950">
              <span>📋 جدول خلاصه کل بازی‌ها و پیش‌بینی‌ها ({filteredGames.length} بازی فیلترشده)</span>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setOpenSummaryTable((v) => !v);
              }}
              className="px-3 py-1 rounded border border-sky-300 bg-white hover:bg-sky-50 text-sky-950 text-xs font-bold shadow-sm"
            >
              {openSummaryTable ? "بستن جدول خلاصه ▲" : "باز کردن جدول خلاصه کل بازی‌ها ▼"}
            </button>
          </div>
          {openSummaryTable && (
            <div className="p-3 bg-white">
        {loading ? (
          <div className="p-6 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> در حال بارگذاری مسابقات انفرادی تنیس ATP / WTA (۲۰۲۴–۲۰۲۶)...
          </div>
        ) : (
          <div className="bg-white border border-sky-200 rounded-md overflow-hidden">
            <div className="overflow-x-auto max-h-[540px]">
              <table className="w-full text-[11px] font-mono text-left border-collapse">
                <thead className="bg-slate-100 text-slate-700 sticky top-0 z-10 border-b border-slate-200">
                  {engineMode === "twins" || engineMode === "manual" ? (
                    <tr>
                      <th className="p-2">#</th>
                      <th className="p-2">Date</th>
                      <th className="p-2">Player 1 (بازیکن ۱)</th>
                      <th className="p-2">Player 2 (بازیکن ۲)</th>
                      <th className="p-2">Fusion (30)</th>
                      <th className="p-2">SMART Twins</th>
                      <th className="p-2">Formula_5 (Full / LOO)</th>
                      <th className="p-2">TP1 / TP2 / TP3</th>
                      <th className="p-2">Twin × Fusion</th>
                      <th className="p-2">Predicted Winner</th>
                      <th className="p-2">Actual / Score</th>
                      <th className="p-2">Status</th>
                    </tr>
                  ) : engineMode === "fusion" ? (
                    <tr>
                      <th className="p-2">#</th>
                      <th className="p-2">Date</th>
                      <th className="p-2">Player 1 (بازیکن ۱)</th>
                      <th className="p-2">Player 2 (بازیکن ۲)</th>
                      <th className="p-2">5 Methods (A / B / C / D / E)</th>
                      <th className="p-2">Pure Astro (25)</th>
                      <th className="p-2">Fusion (30)</th>
                      <th className="p-2">Fusion Tier</th>
                      <th className="p-2">Predicted Winner</th>
                      <th className="p-2">Actual / Score</th>
                      <th className="p-2">Status</th>
                    </tr>
                  ) : (
                    <tr>
                      <th className="p-2">#</th>
                      <th className="p-2">Date</th>
                      <th className="p-2">Player 1 (بازیکن ۱)</th>
                      <th className="p-2">Player 2 (بازیکن ۲)</th>
                      <th className="p-2">QULITY-FIN (P1 vs P2)</th>
                      <th className="p-2">QULITY-DECAN (P1 vs P2)</th>
                      <th className="p-2">VM6</th>
                      <th className="p-2">Pattern Tier</th>
                      <th className="p-2">Predicted Winner</th>
                      <th className="p-2">Actual / Score</th>
                      <th className="p-2">Status</th>
                    </tr>
                  )}
                </thead>
                <tbody>
                  {pageGames.map((g) => {
                    const isExp = expandedGame === g.n;
                    const st = getGameStatus(g);
                    const pw = getGamePredWinner(g);
                    const f30 = g.f30 ?? g.vm6;
                    const a25 = g.a25 ?? 0;
                    const mv = g.mv ?? [g.vm6, 0, 0, 0, 0];
                    return (
                      <Fragment key={g.n}>
                        <tr
                          onClick={() => setExpandedGame(isExp ? null : g.n)}
                          className="border-b border-slate-100 hover:bg-sky-50/70 cursor-pointer transition-colors"
                        >
                          <td className="p-2 font-bold text-slate-500">#{g.n}</td>
                          <td className="p-2 whitespace-nowrap">{g.d}</td>
                          <td className="p-2 font-semibold text-blue-800">{g.h}</td>
                          <td className="p-2 text-purple-800">{g.a}</td>
                          {engineMode === "twins" || engineMode === "manual" ? (
                            <>
                              <td className="p-2 font-extrabold text-sky-950 text-xs">
                                {f30 > 0 ? `+${f30}` : f30}
                              </td>
                              <td className="p-2 whitespace-nowrap">
                                <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-900 border border-emerald-200 font-bold text-[10px]">
                                  [{g.twMode || "STEP"}] {g.twVotes || "4H-3A"} ({g.twPct || "57%"})
                                </span>
                              </td>
                              <td className="p-2 whitespace-nowrap text-[10px]">
                                <span className="font-bold text-slate-900">{g.vip ? "VIP Dual" : g.f1 ? "تلفیق ۱ ✓" : "—"}</span>
                                <span className="text-slate-400 mx-1">/</span>
                                <span className="text-sky-700 font-semibold">{g.a1_veto ? "وتو ⛔" : g.s_a1 ? "گارد ✓" : "آزاد"}</span>
                              </td>
                              <td className="p-2 whitespace-nowrap text-[10px] font-bold text-amber-800">
                                {g.tp ? `+${g.tp[0]} / +${g.tp[1]} / +${g.tp[2]} gms` : "—"}
                              </td>
                              <td className="p-2 whitespace-nowrap">
                                {g.twAgree ? (
                                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-bold">
                                    AGREE ✓
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 text-[10px] font-bold">
                                    SPLIT ⚠
                                  </span>
                                )}
                              </td>
                            </>
                          ) : engineMode === "fusion" ? (
                            <>
                              <td className="p-2 whitespace-nowrap text-[10px]">
                                {mv.map((v, idx) => (
                                  <span
                                    key={idx}
                                    className={`inline-block px-1 py-0.5 mr-0.5 rounded ${
                                      v > 0
                                        ? "bg-blue-50 text-blue-800 font-bold"
                                        : v < 0
                                          ? "bg-purple-50 text-purple-800 font-bold"
                                          : "bg-slate-100 text-slate-500"
                                    }`}
                                  >
                                    {v > 0 ? `+${v}` : v}
                                  </span>
                                ))}
                              </td>
                              <td className="p-2 font-semibold text-slate-700">
                                {a25 > 0 ? `+${a25}` : a25}
                              </td>
                              <td className="p-2 font-extrabold text-sky-950 text-xs">
                                {f30 > 0 ? `+${f30}` : f30}
                              </td>
                              <td className="p-2 whitespace-nowrap">
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                    (g.f30 ?? 0) >= 12
                                      ? "bg-amber-100 text-amber-900 border border-amber-300"
                                      : (g.f30 ?? 0) >= 8
                                        ? "bg-sky-100 text-sky-900 border border-sky-300"
                                        : Math.abs(g.f30 ?? 0) >= 6
                                          ? "bg-indigo-50 text-indigo-800 border border-indigo-200"
                                          : "bg-slate-100 text-slate-600"
                                  }`}
                                >
                                  {(g.f30 ?? 0) >= 12 ? "F30 ≥ +12" : (g.f30 ?? 0) >= 8 ? "F30 ≥ +8" : `F30=${g.f30 ?? 0}`}
                                </span>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="p-2 whitespace-nowrap text-[10px] font-mono">
                                {g.deg1 ?? 121} / {g.deg?.[1] ?? 0} / {g.deg?.[2] ?? 0}
                              </td>
                              <td className="p-2 whitespace-nowrap text-[10px] font-mono">
                                {g.deg1 ?? 121} / {g.deg?.[3] ?? 0} / {g.deg?.[4] ?? 0}
                              </td>
                              <td className="p-2 font-bold text-sky-900">{g.f30 && g.f30 > 0 ? `+${g.f30}` : (g.f30 ?? 0)}</td>
                              <td className="p-2 whitespace-nowrap">
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                    g.vip
                                      ? "bg-amber-100 text-amber-900 border border-amber-300"
                                      : g.f1
                                        ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                                        : g.a1_veto
                                          ? "bg-rose-100 text-rose-900 border border-rose-300"
                                          : "bg-slate-100 text-slate-600"
                                  }`}
                                >
                                  {g.vip ? "VIP Dual" : g.f1 ? "تلفیق ۱ ✓" : g.a1_veto ? "وتوی گارد" : "رد فیلتر"}
                                </span>
                              </td>
                            </>
                          )}
                          <td className="p-2 font-bold text-slate-900">{pw}</td>
                          <td className="p-2 whitespace-nowrap text-[10px] text-slate-600">
                            {st === "PENDING" ? "Scheduled" : g.aw}
                          </td>
                          <td className="p-2">
                            {st === "WIN" ? (
                              <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">WIN ✓</span>
                            ) : st === "LOSS" ? (
                              <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-bold">LOSS ✗</span>
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold">PENDING</span>
                            )}
                          </td>
                        </tr>
                        {isExp && (
                          <tr key={`exp-${g.n}`} className="bg-sky-50/90 border-b border-sky-200">
                            <td colSpan={12} className="p-3.5">
                              <div className="text-xs font-bold text-sky-950 mb-2">
                                جزئیات کامل همزادهای المنتی تنیس و لایه‌های نجومی-جمتریا مسابقه #{g.n} ({g.h} vs {g.a} • {g.sc})
                              </div>
                              {g.twPeers && g.twPeers.length > 0 && (
                                <div className="mb-3 p-3 rounded-lg bg-emerald-50/90 border border-emerald-300">
                                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                                    <div className="text-[11px] font-bold text-emerald-950">
                                      همزادهای استخراج‌شده تنیس • روش: {g.twMode} • رأی همزادها: {g.twVotes} ({g.twPct}) → {g.twWin}
                                    </div>
                                    <div className="text-[11px] font-mono font-bold text-amber-900 bg-amber-100 px-2.5 py-0.5 rounded border border-amber-300">
                                      Game Margin: TP1 +{g.tp?.[0]} | TP2 +{g.tp?.[1]} | TP3 +{g.tp?.[2]}
                                    </div>
                                  </div>
                                  <div className="text-[11px] font-mono text-slate-700 mb-2 bg-white px-2.5 py-1 rounded border border-emerald-200">
                                    <b>Narrowing Path (ELE-P / ELE-FINAL / ELE-DYN):</b> {g.twPath}
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                                    {g.twPeers.map((peerStr, pi) => (
                                      <div key={pi} className="text-[11px] font-mono bg-white px-2.5 py-1 rounded border border-emerald-200 text-slate-800">
                                        <b className="text-emerald-700">Twin #{pi + 1}:</b> {peerStr}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5 text-[11px]">
                                <div className="bg-white p-2.5 rounded border border-sky-300">
                                  <div className="font-bold text-sky-900 mb-1">5-Method Fusion Breakdown (30 Votes)</div>
                                  <div><b>Method A (3L+DEG3+UTC00):</b> {mv[0] > 0 ? `+${mv[0]}` : mv[0]}</div>
                                  <div><b>Method B (Full+DEG3+UTC00):</b> {mv[1] > 0 ? `+${mv[1]}` : mv[1]}</div>
                                  <div><b>Method C (3L+DEG3+Local):</b> {mv[2] > 0 ? `+${mv[2]}` : mv[2]}</div>
                                  <div><b>Method D (Surface+IOC+UTC00):</b> {mv[3] > 0 ? `+${mv[3]}` : mv[3]}</div>
                                  <div><b>Method E (Full+City):</b> {mv[4] > 0 ? `+${mv[4]}` : mv[4]}</div>
                                  <div className="mt-1 pt-1 border-t border-slate-200 font-bold text-emerald-800">
                                    FUSION_30 = {f30 > 0 ? `+${f30}` : f30} | PURE_ASTRO_25 = {a25 > 0 ? `+${a25}` : a25} ({g.ag5 ?? 0}/5 Agree)
                                  </div>
                                </div>
                                <div className="bg-white p-2.5 rounded border border-sky-200">
                                  <div className="font-bold text-slate-700 mb-1">درجات نجومی-جمتریا تنیس (ATP: 121 • WTA: 47)</div>
                                  <div><b>بازیکن ۱ ({g.hc}):</b> DEG1={g.deg1 ?? 121} | DEG2={g.deg?.[1]} | DEG3={g.deg?.[2]}</div>
                                  <div><b>بازیکن ۲ ({g.ac}):</b> DEG1={g.deg1 ?? 121} | DEG2={g.deg?.[3]} | DEG3={g.deg?.[4]}</div>
                                  <div><b>تورنمنت و زمین:</b> {g.venue}</div>
                                  <div><b>تاریخ شمسی:</b> {g.sh_d} ({g.sh_m})</div>
                                </div>
                                <div className="bg-white p-2.5 rounded border border-sky-200">
                                  <div className="font-bold text-slate-700 mb-1">زاویه دوم زمین و کد کشور (P: Surface + IOC)</div>
                                  <div><b>بازیکن ۱ ({g.hc}):</b> IOC={g.h_ioc ?? "—"} | Surface={g.surface ?? "—"}</div>
                                  <div><b>بازیکن ۲ ({g.ac}):</b> IOC={g.a_ioc ?? "—"} | Surface={g.surface ?? "—"}</div>
                                  <div><b>وضعیت سیستم پایه:</b> {g.s_a1 ? "تأیید بازیکن ۱ ✓" : g.a1_veto ? "وتوی بازیکن ۲ ⛔" : "آزاد (بدون وتو)"}</div>
                                </div>
                                <div className="bg-white p-2.5 rounded border border-sky-200">
                                  <div className="font-bold text-slate-700 mb-1">شکل رمل دوگانه (GEO-FIN & GEO-DYN)</div>
                                  <div><b>GEO-FIN بازیکن ۱ / ۲:</b> {g.h_geo} vs {g.a_geo}</div>
                                  <div><b>GEO-DYN بازیکن ۱ / ۲:</b> {g.h_geo_dyn} vs {g.a_geo_dyn}</div>
                                  <div><b>کانال منتخب:</b> {g.chan} | <b>تلفیق ۱:</b> {g.f1 ? "واجد شرایط ✓" : "رد فیلتر"}</div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="bg-slate-50 px-4 py-2.5 border-t border-slate-200 flex items-center justify-between text-xs font-mono">
              <span>
                Page {safePage} of {totalPages} (Click any row to inspect 2010–2026 Twins, 5-Method Fusion & 9 Layers)
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

