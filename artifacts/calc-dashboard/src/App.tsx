import { Component, useState, useEffect, useMemo, type ErrorInfo, type ReactNode } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layers, ShieldCheck, ChevronDown, ChevronUp, Database } from "lucide-react";
import NbaDashboardTab, {
  computeMode17BenchStats,
  type FusionModeKey,
  type ModeBenchSummary,
  type TwinDbKind,
} from "./NbaDashboardTab";
import {
  DEG3_OPTIONS,
  POWER_PROFILES,
  POWER_PROFILE_KEYS,
  SHARD_BUILD_VERSION,
  TENNIS_TOURS,
  type Deg3OptionKey,
  type PowerProfileKey,
  type TennisTourScope,
  type V20GradeKey,
} from "./tennis-config";

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false } },
});

const LEGACY_16_MODE_KEYS: FusionModeKey[] = [
  "dual_pillar",
  "vip_cross",
  "astro_lock",
  "diamond",
  "geo_1xxx_lock",
  "double_pwr_lock",
  "earth_neg_lock",
  "safe_dl_core",
  "pos_inv_lock",
  "gf_fin_pure",
  "tri_gf_routed",
  "tri_gf_ultralock",
  "anti_nobet_smart",
  "total_elem_12",
  "fusion4_elem",
  "referee6_ranked",
];

const SELECT_MODE_KEYS: FusionModeKey[] = ["mode17", ...LEGACY_16_MODE_KEYS];
const MODE_KEYS: FusionModeKey[] = [...LEGACY_16_MODE_KEYS, "mode17"];

const FUSION_MODES: Record<
  FusionModeKey,
  {
    modeNum: number;
    benchKey: string;
    shortFa: string;
    formulaEn: string;
  }
> = {
  mode17: {
    modeNum: 17,
    benchKey: "mode17",
    shortFa: "★ حالت ۱۷ • معماری ۳ سطحی + رمل ۳حرفی روز هفته (C ⊂ B ⊂ A • طلایی B: ۸۸٫۹٪) [پیشنهادی]",
    formulaEn: "v22 3-Code Day-XOR Geomancy (C: 90.2% ⊂ B: 88.9% ★ ⊂ A: 87.2%) • Gem-7 (95.3%) + Veto-3C-A∪B + Veto-1∪3",
  },
  dual_pillar: {
    modeNum: 1,
    benchKey: "dual_pillar",
    shortFa: "حالت ۱ (جامع): تلفیق دو-ستونی مکان (T) + کورت/کد بازیکن (P)",
    formulaEn: "(T.f1_wtp & (P.pick == T.pick | F30_P > 0)) ∪ (P.f1_wtp & (T.pick == P.pick | F30_T > 0))",
  },
  vip_cross: {
    modeNum: 2,
    benchKey: "vip_cross",
    shortFa: "حالت ۲ (شکارچی طلایی): VIP با تأیید متقابل دو زاویه T × P",
    formulaEn: "(T.vip & P_supports_T) ∪ (P.vip & T_supports_P)",
  },
  astro_lock: {
    modeNum: 3,
    benchKey: "astro_lock",
    shortFa: "حالت ۳ (قفل متقابل نجومی): سیگنال همزاد یک زاویه + F30 مثبت زاویه مکمل",
    formulaEn: "(T.f1_wtp & F30_P_for > 0) ∪ (P.f1_wtp & F30_T_for > 0)",
  },
  diamond: {
    modeNum: 4,
    benchKey: "diamond",
    shortFa: "حالت ۴ (قفل الماس T ∩ P): توافق هم‌زمان سیگنال نهایی هر دو زاویه",
    formulaEn: "T.f1_wtp AND P.f1_wtp AND (T.pick == P.pick)",
  },
  geo_1xxx_lock: {
    modeNum: 5,
    benchKey: "geo_1xxx_lock",
    shortFa: "حالت ۵ (فیلتر رمل ۱xxx): تلفیق دو-ستونی + برتری قطب گرم Σ(1xxx)",
    formulaEn: "Dual_Pillar AND Σ Pwr(GEO-FIN = 1xxx, Pick) < Σ Pwr(1xxx, Opp)",
  },
  double_pwr_lock: {
    modeNum: 6,
    benchKey: "double_pwr_lock",
    shortFa: "حالت ۶ (قفل دوگانه ۱xxx + ΣAll): هم‌جهتی هم‌زمان ۱xxx و توان کل ۶ بعد",
    formulaEn: "Dual_Pillar AND Σ Pwr(1xxx, Pick) < Opp AND Σ Pwr(All 6, Pick) < Opp",
  },
  earth_neg_lock: {
    modeNum: 7,
    benchKey: "earth_neg_lock",
    shortFa: "حالت ۷ (قفل ایمن منفی + داور GF-FIN): حذف تله EARTH + لنگر منفی",
    formulaEn: "Dual_Pillar & !(EARTH vs Stronger) & !PosInv_Trap & NegAnchor & (Double_Lock | 2/3_Maj)",
  },
  safe_dl_core: {
    modeNum: 8,
    benchKey: "safe_dl_core",
    shortFa: "حالت ۸ (قفل مستقل ایمن + داور GF-FIN): هسته ایمن + Elo≥60% + T=P",
    formulaEn: "Mode_7 ∪ VIP_SafeDL ∪ (Safe_DL & NoEARTH & NegAnchor & SurfaceElo>=60% & T==P)",
  },
  pos_inv_lock: {
    modeNum: 9,
    benchKey: "pos_inv_lock",
    shortFa: "حالت ۹ (قفل جامع v5 + چرخش قطبیت دو-مثبت ۱xxx)",
    formulaEn: "Mode_7 ∪ VIP_SafeDL ∪ [Both_1xxx>0 -> Polarity_Inversion] ∪ [Div & |ΔGF-FIN|>=5 -> 2/3_Maj]",
  },
  gf_fin_pure: {
    modeNum: 10,
    benchKey: "gf_fin_pure",
    shortFa: "حالت ۱۰ (موتور خالص GF-FIN): عدد منفی‌تر برنده • پوشش ۱۰۰٪ بدون قفل",
    formulaEn: "Pick = argmin(Σ GF-FIN_6_Facets) • 100% Full-Slate Coverage",
  },
  tri_gf_routed: {
    modeNum: 11,
    benchKey: "tri_gf_routed",
    shortFa: "حالت ۱۱ (موتور مستقل ۳ عددی + قطب سرد ۰xxx + ضدحذف): بدون همزاد",
    formulaEn: "3-Num [Σ(1xxx), Σ(0xxx), Σ(All), Σ(GF), Σ(3)] + Anti-Drop",
  },
  tri_gf_ultralock: {
    modeNum: 12,
    benchKey: "tri_gf_ultralock",
    shortFa: "حالت ۱۲ (ابرقفل ۳ عددی تلفیقی + قطب سرد ۰xxx + ۲ قفل ایمنی): پایه ۱۲",
    formulaEn: "Mode_9_Ultra ∪ ColdAnchor(0xxx<=-4) ∪ Bipolar_0011 ∪ S3_Split \\ (DualEarth ∪ 3of3_Clash)",
  },
  anti_nobet_smart: {
    modeNum: 13,
    benchKey: "anti_nobet_smart",
    shortFa: "حالت ۱۳ (ضد NO-BET هوشمند: حالت ۱۲ + آزادسازی مستقیم Elo≥75% + چرخش عکس)",
    formulaEn: "Mode_12_Core ∪ Direct_Release(M11 & NonEARTH & Elo>=75%) ∪ Opposite_Flip",
  },
  total_elem_12: {
    modeNum: 14,
    benchKey: "smart_elem_14",
    shortFa: "حالت ۱۴ (قطبیت المنت کل [F-A-W-E] + مهار ۳ تله خطا)",
    formulaEn: "7_Entities_Per_Player + DomElem[F,A,W,E] + SurfaceElo% \\ (2xWATER ∪ Bipolar<75% ∪ AwayWarm<0)",
  },
  fusion4_elem: {
    modeNum: 15,
    benchKey: "fusion4_elem",
    shortFa: "حالت ۱۵ (موتور تلفیق ۴ پترن باکس ۲ + فالوآپ المنت غالب)",
    formulaEn: "Pattern1(Home+M11+Dom) ∪ Pattern2(Smart14∩Dom) ∪ Pattern3(StrongDom+P12) ∪ Pattern4(CleanSignal)",
  },
  referee6_ranked: {
    modeNum: 16,
    benchKey: "referee6_ranked",
    shortFa: "حالت ۱۶ (داور نهایی رتبه‌بندی و امتیازدهی وزنی ۶ باکس سیگنال)",
    formulaEn: "Weighted_6Box_Referee(Box6:10 + Box3:9 + Box2:6 + Box5:3.5 + Box4:1.5 + Box1:1.5, Δ>=5.5)",
  },
};

function toPersianPct(pct: number): string {
  const faDigits = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
  const s = (Math.round(pct * 10) / 10).toFixed(1).replace(".", "٫");
  return `${s.replace(/\d/g, (d) => faDigits[Number(d)] ?? d)}٪`;
}

function Home() {
  const [activeTour, setActiveTour] = useState<TennisTourScope>(() => {
    try {
      const saved = window.localStorage.getItem("tennis_fusion_tour_v4");
      if (saved === "ATP" || saved === "WTA" || saved === "ALL") return saved;
    } catch {}
    return "ALL";
  });

  const [deg3Opt, setDeg3Opt] = useState<Deg3OptionKey>(() => {
    try {
      const saved = window.localStorage.getItem("tennis_fusion_deg3_v3");
      if (saved === "opt1" || saved === "opt2" || saved === "opt3") return saved;
    } catch {}
    return "opt3";
  });

  const [powerProfile, setPowerProfile] = useState<PowerProfileKey>(() => {
    try {
      const s = window.localStorage.getItem("tennis_fusion_pwr_v3");
      if (s === "c_vol" || s === "b_pure" || s === "a_elo") return s;
    } catch {}
    return "c_vol";
  });

  const [fusionMode, setFusionMode] = useState<FusionModeKey>(() => {
    try {
      const s = window.localStorage.getItem("tennis_fusion_mode_v5") as FusionModeKey | null;
      if (s && s in FUSION_MODES) return s;
    } catch {}
    return "mode17";
  });

  const [v20Grade, setV20Grade] = useState<V20GradeKey>(() => {
    try {
      const s = window.localStorage.getItem("tennis_v20_grade_v1");
      if (s === "C" || s === "B" || s === "A") return s;
    } catch {}
    return "B";
  });

  const [twinDbKind, setTwinDbKind] = useState<TwinDbKind>("team");
  const [openBench, setOpenBench] = useState<boolean>(false);
  const [benchData, setBenchData] = useState<any | null>(null);
  const [shardGamesCache, setShardGamesCache] = useState<{ atp: any[]; wta: any[] } | null>(null);

  useEffect(() => {
    fetch(`/fusion_modes_benchmark.json?v=${SHARD_BUILD_VERSION}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          setBenchData(d);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    const yrs = ["2024", "2025", "2026"];
    const atpUrls = yrs.map((yr) => `/fusion_atp_${deg3Opt}_${yr}.json?v=${SHARD_BUILD_VERSION}`);
    const wtaUrls = yrs.map((yr) => `/fusion_wta_${deg3Opt}_${yr}.json?v=${SHARD_BUILD_VERSION}`);
    Promise.all([
      Promise.all(atpUrls.map((u) => fetch(u, { cache: "no-store" }).then((r) => (r.ok ? r.json() : { games: [] })))),
      Promise.all(wtaUrls.map((u) => fetch(u, { cache: "no-store" }).then((r) => (r.ok ? r.json() : { games: [] })))),
    ])
      .then(([atpDocs, wtaDocs]) => {
        if (cancelled) return;
        const atpGames = atpDocs.flatMap((d: any) => d?.games ?? []);
        const wtaGames = wtaDocs.flatMap((d: any) => d?.games ?? []);
        setShardGamesCache({ atp: atpGames, wta: wtaGames });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [deg3Opt]);

  const dynMode17Bench = useMemo<Record<TennisTourScope, ModeBenchSummary> | null>(() => {
    if (!shardGamesCache) return null;
    return {
      ATP: computeMode17BenchStats(shardGamesCache.atp, powerProfile, v20Grade),
      WTA: computeMode17BenchStats(shardGamesCache.wta, powerProfile, v20Grade),
      ALL: computeMode17BenchStats([...shardGamesCache.atp, ...shardGamesCache.wta], powerProfile, v20Grade),
    };
  }, [shardGamesCache, powerProfile, v20Grade]);

  const switchTour = (t: TennisTourScope) => {
    setActiveTour(t);
    try {
      window.localStorage.setItem("tennis_fusion_tour_v4", t);
    } catch {}
  };

  const switchDeg3 = (o: Deg3OptionKey) => {
    setDeg3Opt(o);
    try {
      window.localStorage.setItem("tennis_fusion_deg3_v3", o);
    } catch {}
  };

  const switchPowerProfile = (p: PowerProfileKey) => {
    setPowerProfile(p);
    try {
      window.localStorage.setItem("tennis_fusion_pwr_v3", p);
    } catch {}
  };

  const switchFusion = (m: FusionModeKey) => {
    setFusionMode(m);
    try {
      window.localStorage.setItem("tennis_fusion_mode_v5", m);
    } catch {}
  };

  const switchV20Grade = (gr: V20GradeKey) => {
    setV20Grade(gr);
    try {
      window.localStorage.setItem("tennis_v20_grade_v1", gr);
    } catch {}
  };

  const liveM17Pct = dynMode17Bench?.[activeTour]?.total?.pct;
  const m17PctTag =
    typeof liveM17Pct === "number" && liveM17Pct > 0
      ? toPersianPct(liveM17Pct)
      : powerProfile === "c_vol"
        ? "۸۸٫۹٪"
        : powerProfile === "b_pure"
          ? "۸۰٫۰٪"
          : "۷۱٫۱٪";
  const gradeLabelTag =
    v20Grade === "C" ? "👑 نخبه C" : v20Grade === "B" ? "⭐ طلایی B ★" : "🟢 حجم کامل A";
  const getModeShortFa = (mk: FusionModeKey) =>
    mk === "mode17"
      ? `★ حالت ۱۷ • ${gradeLabelTag} (${m17PctTag}) [پیشنهادی]`
      : FUSION_MODES[mk].shortFa;

  const cur = FUSION_MODES[fusionMode];
  const baseBenchForProfile =
    benchData?.byProfile?.[powerProfile]?.[deg3Opt]?.[activeTour] ??
    benchData?.byOption?.[deg3Opt]?.[activeTour] ??
    {};
  const activeModesBench: Record<string, any> = {
    ...baseBenchForProfile,
    ...(dynMode17Bench ? { mode17: dynMode17Bench[activeTour] } : {}),
  };
  const curBench = activeModesBench[cur.benchKey];

  return (
    <div className="min-h-[100dvh] w-full bg-background flex flex-col font-sans">
      <div className="flex-1 w-full max-w-6xl mx-auto px-3.5 sm:px-4 py-5 md:py-7 flex flex-col">
        <header className="mb-3 flex flex-wrap items-center justify-between gap-3" dir="rtl">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-emerald-700 text-white flex items-center justify-center shadow-xs shrink-0">
              <Layers className="h-4 w-4" />
            </div>
            <div>
              <h1
                className="text-lg md:text-xl font-extrabold tracking-tight text-slate-900"
                data-testid="text-dashboard-title"
              >
                داشبورد تلفیقی ۲ باکسی تنیس (TENNIS-FUSION-SIGNAL • ۱۷ حالت × ۳ پایه قدرت فصل • ۲۰۲۴–۲۰۲۶)
              </h1>
              <p className="text-slate-600 text-xs leading-snug">
                باکس ۱: چک‌لیست تیک‌دار شاخص‌ها + جدول فصل و Surface Pyth هر دو بازیکن • باکس ۲: حکم نهایی، قفل استفاده‌شده و نتیجه مسابقه در زیر هر کارت (بدون تاریخ تولد • متصل به KXATPMATCH / KXWTAMATCH)
              </p>
            </div>
          </div>

          <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-950 text-xs font-extrabold" dir="rtl">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-700" />
            حالت ایزوله تنیس • بدون تاریخ تولد
          </div>
        </header>

        {/* Top Bar 1: Tour Switcher (ATP / WTA / ALL) + 3-Option DEG3 Switcher + 3-Way Base Power Switcher */}
        <div
          dir="rtl"
          className="mb-3 rounded-xl border-2 border-emerald-300 bg-emerald-50/80 p-2.5 shadow-2xs space-y-2"
          data-testid="bar-fusion-tennis-tour-deg3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="px-2 py-1 rounded bg-slate-800 text-white text-[11px] font-extrabold">تور فعال:</span>
              <button
                type="button"
                data-testid="btn-fusion-tour-atp"
                onClick={() => switchTour("ATP")}
                className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all ${
                  activeTour === "ATP"
                    ? "bg-sky-700 text-white shadow-xs"
                    : "bg-white text-slate-900 hover:bg-sky-50 border border-slate-200"
                }`}
              >
                ATP مردان (DEG1=121 • 1° LEO • KXATPMATCH)
              </button>
              <button
                type="button"
                data-testid="btn-fusion-tour-wta"
                onClick={() => switchTour("WTA")}
                className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all ${
                  activeTour === "WTA"
                    ? "bg-emerald-700 text-white shadow-xs"
                    : "bg-white text-slate-900 hover:bg-emerald-50 border border-slate-200"
                }`}
              >
                WTA زنان (DEG1=47 • 17° TAURUS • KXWTAMATCH)
              </button>
              <button
                type="button"
                data-testid="btn-fusion-tour-all"
                onClick={() => switchTour("ALL")}
                className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all ${
                  activeTour === "ALL"
                    ? "bg-indigo-700 text-white shadow-xs"
                    : "bg-white text-slate-900 hover:bg-indigo-50 border border-slate-200"
                }`}
              >
                هر دو تور (ALL: ATP + WTA)
              </button>
            </div>

            <span className="px-2.5 py-1 rounded bg-white border border-emerald-200 font-mono text-[11px] font-extrabold text-emerald-950" dir="ltr">
              {activeTour === "ALL"
                ? "ATP(121) + WTA(47) • Zero Birthdate"
                : `${activeTour} • DEG1=${TENNIS_TOURS[activeTour].deg1} (${TENNIS_TOURS[activeTour].zodiacDisplay}) • ${TENNIS_TOURS[activeTour].kalshiSeries}`}
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-emerald-200/70">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="px-2 py-1 rounded bg-emerald-800 text-white text-[11px] font-extrabold">آپشن DEG3 مکان (T):</span>
              {(["opt1", "opt2", "opt3"] as Deg3OptionKey[]).map((ok) => {
                const isAct = deg3Opt === ok;
                const isBest = benchData?.bestDefaultDeg3 === ok;
                return (
                  <button
                    key={ok}
                    type="button"
                    data-testid={`btn-fusion-deg3-${ok}`}
                    onClick={() => switchDeg3(ok)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition-all ${
                      isAct
                        ? "bg-amber-500 text-slate-950 shadow-2xs ring-1 ring-amber-700"
                        : "bg-white text-slate-800 hover:bg-amber-50 border border-emerald-200"
                    }`}
                  >
                    {DEG3_OPTIONS[ok].shortFa} {isBest ? "★" : ""}
                  </button>
                );
              })}
            </div>
            <span className="font-mono text-[10.5px] text-slate-700 bg-white/90 px-2 py-0.5 rounded border border-emerald-200" dir="ltr">
              {DEG3_OPTIONS[deg3Opt].formulaEn}
            </span>
          </div>

          <div
            className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-emerald-200/70"
            data-testid="bar-fusion-power-profile"
          >
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="px-2 py-1 rounded bg-indigo-900 text-white text-[11px] font-extrabold">
                موتور قدرت و جدول پایه:
              </span>
              {POWER_PROFILE_KEYS.map((pk) => {
                const isAct = powerProfile === pk;
                return (
                  <button
                    key={pk}
                    type="button"
                    data-testid={`btn-fusion-pwr-${pk}`}
                    onClick={() => switchPowerProfile(pk)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition-all ${
                      isAct
                        ? "bg-indigo-700 text-white shadow-2xs ring-1 ring-indigo-950"
                        : "bg-white text-slate-900 hover:bg-indigo-50 border border-indigo-200"
                    }`}
                  >
                    {POWER_PROFILES[pk].shortFa}
                  </button>
                );
              })}
            </div>
            <span className="font-mono text-[10.5px] text-indigo-950 bg-white/90 px-2 py-0.5 rounded border border-indigo-200" dir="ltr">
              {POWER_PROFILES[powerProfile].formulaEn}
            </span>
          </div>
        </div>

        {/* Top Bar 2: Clean Active v20 Engine Summary + Collapsible 2024/2025/2026 Benchmark Inspector */}
        <div
          dir="rtl"
          className="mb-4 rounded-xl border-2 border-sky-300 bg-sky-50/90 p-2.5 shadow-2xs space-y-2.5"
          data-testid="bar-fusion-modes"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[240px]">
              <span className="px-2.5 py-1 rounded-md bg-emerald-800 text-white text-xs font-extrabold shrink-0">
                {getModeShortFa(fusionMode)}
              </span>
              {fusionMode !== "mode17" && (
                <button
                  type="button"
                  onClick={() => switchFusion("mode17")}
                  className="px-2.5 py-1 rounded-md bg-amber-400 hover:bg-amber-500 text-slate-950 border border-amber-600 text-xs font-extrabold"
                >
                  بازگشت به حالت ۱۷ ★
                </button>
              )}
              {curBench && (
                <span
                  data-testid="badge-active-mode-bench"
                  className="px-2 py-1 rounded-md bg-emerald-100 text-emerald-950 border border-emerald-300 font-mono text-[11px] font-extrabold"
                  dir="ltr"
                >
                  {fusionMode === "mode17" && dynMode17Bench
                    ? `Grade ${v20Grade} (${activeTour}): ${curBench.total?.pct ?? 0}% (${curBench.total?.rec ?? "0/0"}) • ATP: ${dynMode17Bench.ATP.total.pct}% (${dynMode17Bench.ATP.total.rec}) • WTA: ${dynMode17Bench.WTA.total.pct}% (${dynMode17Bench.WTA.total.rec}) • Last50: ${curBench.last50?.pct ?? 0}%`
                    : `Total: ${curBench.total?.pct ?? 0}% (${curBench.total?.rec ?? "0/0"}) • 2026: ${curBench["2026"]?.pct ?? 0}% • Last50: ${curBench.last50?.pct ?? 0}%`}
                </span>
              )}
            </div>

            <button
              type="button"
              data-testid="button-toggle-bench"
              onClick={() => setOpenBench((v) => !v)}
              className="px-3 py-1.5 rounded-lg bg-white hover:bg-sky-100 border border-sky-300 text-sky-950 text-xs font-extrabold inline-flex items-center gap-1.5 shadow-2xs"
            >
              {openBench ? "بستن جدول بنچمارک و آرشیو (۲۰۲۴–۲۰۲۶)" : "جدول بنچمارک و آرشیو (۲۰۲۴–۲۰۲۶)"}
              {openBench ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          </div>

          {openBench && (
            <div className="bg-white rounded-lg border border-sky-200 p-3 space-y-3 overflow-x-auto">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-sky-100">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-extrabold text-sky-950">
                    بازرس حالت‌های تلفیقی:
                  </span>
                  <select
                    value={fusionMode}
                    onChange={(e) => switchFusion(e.target.value as FusionModeKey)}
                    data-testid="select-fusion-mode"
                    className="h-8 rounded-lg border border-emerald-600 bg-white px-2.5 text-xs font-extrabold text-slate-950"
                  >
                    {SELECT_MODE_KEYS.map((mk) => (
                      <option key={mk} value={mk}>
                        {fusionMode === mk ? `✓ ${getModeShortFa(mk)}` : getModeShortFa(mk)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="inline-flex items-center rounded-lg border border-sky-300 bg-sky-50/70 p-0.5 text-[11px] font-bold">
                  <span className="px-2 text-slate-600 inline-flex items-center gap-1">
                    <Database className="h-3 w-3 text-sky-700" />
                    همزادیاب دستی:
                  </span>
                  <button
                    type="button"
                    data-testid="btn-twindb-team"
                    onClick={() => setTwinDbKind("team")}
                    className={`px-2 py-1 rounded-md transition-colors ${
                      twinDbKind === "team" ? "bg-sky-700 text-white" : "text-sky-900 hover:bg-white"
                    }`}
                  >
                    زاویه T (مکان/تورنمنت)
                  </button>
                  <button
                    type="button"
                    data-testid="btn-twindb-player"
                    onClick={() => setTwinDbKind("player")}
                    className={`px-2 py-1 rounded-md transition-colors ${
                      twinDbKind === "player" ? "bg-indigo-700 text-white" : "text-indigo-900 hover:bg-white"
                    }`}
                  >
                    زاویه P (جنس کورت + IOC)
                  </button>
                </div>
              </div>

              <div className="text-[11px] font-mono text-emerald-950 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded" dir="ltr">
                {cur.formulaEn}
              </div>

              <table className="w-full text-xs border-collapse font-mono tabular-nums text-right" data-testid="table-modes-benchmark">
                <thead>
                  <tr className="bg-sky-100/80 text-sky-950 border-b border-sky-200 font-sans">
                    <th className="py-1.5 px-2.5">شماره و معماری موتور تلفیقی (۱ تا ۱۷)</th>
                    <th className="py-1.5 px-2.5">فصل ۲۰۲۴</th>
                    <th className="py-1.5 px-2.5">فصل ۲۰۲۵</th>
                    <th className="py-1.5 px-2.5">فصل ۲۰۲۶</th>
                    <th className="py-1.5 px-2.5">کل ۳ فصل (۲۰۲۴–۲۰۲۶)</th>
                    <th className="py-1.5 px-2.5">۵۰ سیگنال اخیر</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sky-100">
                  {MODE_KEYS.map((mk) => {
                    const m = FUSION_MODES[mk];
                    const st = activeModesBench[m.benchKey];
                    const isCur = fusionMode === mk;
                    const isM17 = mk === "mode17";
                    return (
                      <tr
                        key={mk}
                        data-testid={`row-bench-${mk}`}
                        onClick={() => switchFusion(mk)}
                        className={`cursor-pointer transition-colors ${
                          isCur
                            ? "bg-emerald-50/95 font-bold text-slate-950"
                            : isM17
                              ? "bg-amber-50/70 hover:bg-amber-100/70 text-slate-900 font-bold"
                              : "hover:bg-sky-50/60 text-slate-700"
                        }`}
                      >
                        <td className="py-1.5 px-2.5 font-sans font-extrabold text-sky-950">
                          <div>{isCur ? "✓ " : ""}{getModeShortFa(mk)}</div>
                          {isM17 && dynMode17Bench && (
                            <div className="text-[10.5px] font-mono text-amber-900 mt-0.5" dir="ltr">
                              {`ATP: ${dynMode17Bench.ATP.total.pct}% (${dynMode17Bench.ATP.total.rec}) • WTA: ${dynMode17Bench.WTA.total.pct}% (${dynMode17Bench.WTA.total.rec})`}
                            </div>
                          )}
                        </td>
                        <td className="py-1.5 px-2.5">{st?.["2024"]?.pct ?? 0}% ({st?.["2024"]?.rec ?? "0/0"})</td>
                        <td className="py-1.5 px-2.5">{st?.["2025"]?.pct ?? 0}% ({st?.["2025"]?.rec ?? "0/0"})</td>
                        <td className="py-1.5 px-2.5 text-indigo-800 font-extrabold">{st?.["2026"]?.pct ?? 0}% ({st?.["2026"]?.rec ?? "0/0"})</td>
                        <td className="py-1.5 px-2.5 text-emerald-800 font-extrabold">{st?.total?.pct ?? 0}% ({st?.total?.rec ?? "0/0"})</td>
                        <td className="py-1.5 px-2.5 text-sky-900 font-extrabold">{st?.last50?.pct ?? 0}% ({st?.last50?.rec ?? "0/0"})</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <NbaDashboardTab
          fusionMode={fusionMode}
          twinDbKind={twinDbKind}
          tour={activeTour}
          deg3Opt={deg3Opt}
          powerProfile={powerProfile}
          v20Grade={v20Grade}
          onChangeV20Grade={switchV20Grade}
        />

        <footer className="mt-8 pt-4 border-t border-border/50 text-center">
          <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest">
            TENNIS-FUSION-SIGNAL • Clean 2-Box v20 Nested C⊂B⊂A Astro-Gematria Fusion (ATP DEG1=121 [1° LEO] • WTA DEG1=47 [17° TAURUS] • KXATPMATCH / KXWTAMATCH)
          </p>
        </footer>
      </div>
    </div>
  );
}

class AppErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; errorMessage: string }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: "" };
  }

  static getDerivedStateFromError(error: unknown) {
    const msg = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    return { hasError: true, errorMessage: msg };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error("TENNIS-FUSION-SIGNAL UI ErrorBoundary caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full bg-slate-50 flex items-center justify-center p-6" dir="rtl">
          <div className="max-w-xl w-full rounded-xl border-2 border-rose-300 bg-white p-5 shadow-sm space-y-3">
            <h2 className="text-base font-extrabold text-rose-800">
              خطای زمان اجرا در رندر داشبورد (ErrorBoundary)
            </h2>
            <pre
              className="text-xs font-mono bg-slate-900 text-rose-200 p-3 rounded-lg overflow-x-auto whitespace-pre-wrap"
              dir="ltr"
            >
              {this.state.errorMessage}
            </pre>
            <button
              type="button"
              onClick={() => {
                try {
                  window.localStorage.removeItem("tennis_fusion_tour_v2");
                  window.localStorage.removeItem("tennis_fusion_tour_v3");
                  window.localStorage.removeItem("tennis_fusion_deg3_v2");
                  window.localStorage.removeItem("tennis_fusion_deg3_v3");
                  window.localStorage.removeItem("tennis_fusion_pwr_v1");
                  window.localStorage.removeItem("tennis_fusion_pwr_v2");
                  window.localStorage.removeItem("tennis_fusion_pwr_v3");
                  window.localStorage.removeItem("tennis_fusion_mode_v2");
                  window.localStorage.removeItem("tennis_fusion_mode_v3");
                  window.localStorage.removeItem("tennis_fusion_mode_v4");
                  window.localStorage.removeItem("tennis_fusion_mode_v5");
                  window.localStorage.removeItem("tennis_v20_grade_v1");
                } catch {}
                window.location.reload();
              }}
              className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-extrabold"
            >
              بازنشانی تنظیمات و بارگذاری مجدد داشبورد
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/index.html" component={Home} />
      <Route component={Home} />
    </Switch>
  );
}

const rawViteBase = String(import.meta.env.BASE_URL || "/").trim();
const normalizedRouterBase =
  rawViteBase === "/" || rawViteBase === "./" || rawViteBase === "." || rawViteBase === ""
    ? ""
    : rawViteBase.replace(/\/$/, "");

function App() {
  return (
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={normalizedRouterBase}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </AppErrorBoundary>
  );
}

export default App;
