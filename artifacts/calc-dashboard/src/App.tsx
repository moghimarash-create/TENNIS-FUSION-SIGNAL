import { useState } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layers, ShieldCheck, ChevronDown, ChevronUp, Database } from "lucide-react";
import NotFound from "@/pages/not-found";
import NbaDashboardTab, { type FusionModeKey, type TwinDbKind } from "./NbaDashboardTab";
import { TENNIS_TOURS, type TennisTour } from "./tennis-config";

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false } },
});

const MODE_KEYS: FusionModeKey[] = [
  "tri_gf_ultralock",
  "anti_nobet_smart",
  "total_elem_12",
  "tri_gf_routed",
  "gf_fin_pure",
  "pos_inv_lock",
  "earth_neg_lock",
  "safe_dl_core",
  "double_pwr_lock",
  "geo_1xxx_lock",
  "dual_pillar",
  "vip_cross",
  "astro_lock",
  "diamond",
];

const FUSION_MODES: Record<
  FusionModeKey,
  {
    shortFa: string;
    formulaEn: string;
  }
> = {
  tri_gf_ultralock: {
    shortFa: "حالت ۱۲ (ابرقفل ۳ عددی تلفیقی + قطب سرد ۰xxx + ۲ قفل ایمنی): پیش‌فرض",
    formulaEn: "Mode_9_Ultra(GF-FIN, Cnt>=1) ∪ ColdAnchor_Keep(0xxx<=-4) ∪ Bipolar_0011(Twin) ∪ S3_SignSplit ∪ Zero1xxx_Opp ∪ EARTH_Flip \\ (DualEarth_Hold ∪ TwinVs3of3_Hold)",
  },
  anti_nobet_smart: {
    shortFa: "حالت ۱۳ (ضد NO-BET هوشمند: حالت ۱۲ + آزادسازی مستقیم گروه ۱ + چرخش عکس گروه ۲)",
    formulaEn: "Mode_12_Core ∪ Direct_Release(M11 & NonEARTH & Log5>=75%) ∪ Opposite_Flip(!M11 & NonEARTH & (DP_Opp | RawFB_OppLog5>=60%))",
  },
  total_elem_12: {
    shortFa: "حالت ۱۴ (قطبیت المنت کل بازیکن+تورنمنت + داور رتبه‌بندی و امتیازدهی وزنی ۶ باکس)",
    formulaEn: "Entities + DomElem[F,A,W,E] + PureLog5 \\ (2xWATER ∪ Bipolar<75% ∪ Warm<0 -> Flip_Opp) ∪ OppFlip",
  },
  tri_gf_routed: {
    shortFa: "حالت ۱۱ (موتور مستقل ۳ عددی + قطب سرد ۰xxx + ضدحذف): بدون همزاد",
    formulaEn: "3-Num [Σ(1xxx), Σ(0xxx/0011), Σ(All), Σ(GF), Σ(3)] + Anti-Drop",
  },
  gf_fin_pure: {
    shortFa: "حالت ۱۰ (موتور خالص GF-FIN): عدد کمتر یا منفی‌تر برنده • بدون قفل و شرط",
    formulaEn: "Pick = argmin(GF-FIN) where GF-FIN = (8*s1 + 4*s2 + 2*s3 + 1*s4)/10 • Zero Locks",
  },
  pos_inv_lock: {
    shortFa: "حالت ۹ (قفل جامع v5 + داور GF-FIN)",
    formulaEn: "Mode_7_GF(Cnt>=1) ∪ VIP_SafeDL ∪ [Both_1xxx>0 -> Polarity_Inversion] ∪ [Div(1xxx,Σ) & |ΔGF-FIN|>=6 -> 2/3_Referee]",
  },
  earth_neg_lock: {
    shortFa: "حالت ۷ (قفل ایمن منفی + داور GF-FIN)",
    formulaEn: "Dual_Pillar & !(EARTH vs Stronger) & !PosInv_Trap & NegAnchor & Double_Lock",
  },
  safe_dl_core: {
    shortFa: "حالت ۸ (قفل مستقل ایمن + داور GF-FIN)",
    formulaEn: "Mode_7_GF(Cnt>=1) ∪ VIP_SafeDL ∪ (Safe_DL & NoEARTH & NegAnchor & Log5>=60% & T=P)",
  },
  double_pwr_lock: {
    shortFa: "حالت ۶ (قفل دوگانه ۱xxx + Σ): بدون فیلتر لنگر منفی",
    formulaEn: "Dual_Pillar AND Σ Pwr(1xxx, Pick) < Opp AND Σ Pwr(All, Pick) < Opp",
  },
  geo_1xxx_lock: {
    shortFa: "حالت ۵ (فیلتر رمل ۱xxx): تلفیق دو-ستونی + برتری منفی ۱xxx",
    formulaEn: "Dual_Pillar AND Σ Pwr(GEO-FIN = 1xxx, Pick) < Σ Pwr(GEO-FIN = 1xxx, Opp)",
  },
  dual_pillar: {
    shortFa: "حالت ۱ (جامع): تلفیق دو-ستونی تورنمنت/شهر + بازیکن ۱ به ۱",
    formulaEn: "(T.f1_wtp & (Twin_P == Pick | F30_P > 0)) ∪ (P.f1_wtp & (Twin_T == Pick | F30_T > 0))",
  },
  vip_cross: {
    shortFa: "حالت ۲ (شکارچی طلایی): VIP با تأیید متقابل دو موتور",
    formulaEn: "(T.vip & (Twin_P == Pick | F30_P > 0)) ∪ (P.vip & (Twin_T == Pick | F30_T > 0))",
  },
  astro_lock: {
    shortFa: "حالت ۳ (قفل متقابل نجومی): سیگنال یک موتور + F30 مثبت موتور دوم",
    formulaEn: "(T.f1_wtp & F30_P_for > 0) ∪ (P.f1_wtp & F30_T_for > 0)",
  },
  diamond: {
    shortFa: "حالت ۴ (قفل الماس T ∩ P): توافق هم‌زمان سیگنال نهایی دو موتور",
    formulaEn: "T.f1_wtp AND P.f1_wtp",
  },
};

function Home() {
  const [activeTour, setActiveTour] = useState<TennisTour>(() => {
    try {
      const saved = window.localStorage.getItem("tennis_fusion_tour_v1");
      if (saved === "WTA" || saved === "ATP") return saved;
    } catch {}
    return "ATP";
  });

  const [fusionMode, setFusionMode] = useState<FusionModeKey>(() => {
    try {
      const s = window.localStorage.getItem("tennis_fusion_mode_v1") as FusionModeKey | null;
      if (s && s in FUSION_MODES) return s;
    } catch {}
    return "tri_gf_ultralock";
  });
  const [twinDbKind, setTwinDbKind] = useState<TwinDbKind>("team");
  const [openBench, setOpenBench] = useState<boolean>(false);

  const switchTour = (t: TennisTour) => {
    setActiveTour(t);
    try {
      window.localStorage.setItem("tennis_fusion_tour_v1", t);
    } catch {}
  };

  const switchFusion = (m: FusionModeKey) => {
    setFusionMode(m);
    try {
      window.localStorage.setItem("tennis_fusion_mode_v1", m);
    } catch {}
  };

  const curTour = TENNIS_TOURS[activeTour];
  const cur = FUSION_MODES[fusionMode];

  return (
    <div className="min-h-[100dvh] w-full bg-background flex flex-col font-sans">
      <div className="flex-1 w-full max-w-6xl mx-auto px-3.5 sm:px-4 py-5 md:py-7 flex flex-col">
        <header className="mb-3.5 flex flex-wrap items-center justify-between gap-3" dir="rtl">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-emerald-700 text-white flex items-center justify-center shadow-xs shrink-0">
              <Layers className="h-4 w-4" />
            </div>
            <div>
              <h1
                className="text-lg md:text-xl font-extrabold tracking-tight text-slate-900"
                data-testid="text-dashboard-title"
              >
                داشبورد تلفیقی ۲ باکسی تنیس (TENNIS-FUSION-SIGNAL • {curTour.tour}: DEG1={curTour.deg1} [{curTour.zodiacDisplay}])
              </h1>
              <p className="text-slate-600 text-xs leading-snug">
                باکس ۱: چک‌لیست تیک‌دار شاخص‌های هر دو بازیکن • باکس ۲: حکم نهایی، قفل استفاده‌شده و نتیجه مسابقه در زیر هر کارت (بدون تاریخ تولد • متصل به {curTour.kalshiSeries})
              </p>
            </div>
          </div>

          <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-950 text-xs font-extrabold" dir="rtl">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-700" />
            ایزوله ۱۰۰٪ از شیت NBA-FUSION-CALCULATION
          </div>
        </header>

        {/* Clean ATP / WTA Tour Profile Selector Bar */}
        <div
          dir="rtl"
          className="mb-3 rounded-xl border-2 border-emerald-300 bg-emerald-50/80 p-2 shadow-2xs flex flex-wrap items-center justify-between gap-2"
          data-testid="bar-fusion-tennis-tour"
        >
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-testid="btn-fusion-tour-atp"
              onClick={() => switchTour("ATP")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition-all ${
                activeTour === "ATP"
                  ? "bg-sky-700 text-white shadow-xs"
                  : "bg-white text-slate-900 hover:bg-sky-50 border border-slate-200"
              }`}
            >
              تور مردان ATP • جمتریا ۴۸۱ ➔ DEG1 = 121 (1° LEO • FIRE • KXATPMATCH)
            </button>
            <button
              type="button"
              data-testid="btn-fusion-tour-wta"
              onClick={() => switchTour("WTA")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition-all ${
                activeTour === "WTA"
                  ? "bg-emerald-700 text-white shadow-xs"
                  : "bg-white text-slate-900 hover:bg-emerald-50 border border-slate-200"
              }`}
            >
              تور زنان WTA • جمتریا ۴۰۷ ➔ DEG1 = 47 (17° TAURUS • EARTH • KXWTAMATCH)
            </button>
          </div>
          <span className="px-2.5 py-1 rounded bg-white border border-emerald-200 font-mono text-[11px] font-extrabold text-emerald-950" dir="ltr">
            {`${curTour.tour} • DEG1=${curTour.deg1} (${curTour.zodiacDisplay} / ${curTour.element}) • Kalshi: ${curTour.kalshiSeries}`}
          </span>
        </div>

        {/* Clean Single-Row Active Fusion Mode Selector + Collapsible Guide */}
        <div
          dir="rtl"
          className="mb-4 rounded-xl border-2 border-sky-300 bg-sky-50/90 p-2.5 shadow-2xs space-y-2.5"
          data-testid="bar-fusion-modes"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[240px]">
              <span className="px-2 py-1 rounded-md bg-emerald-800 text-white text-[11px] font-extrabold shrink-0">
                موتور فعال:
              </span>
              <select
                value={fusionMode}
                onChange={(e) => switchFusion(e.target.value as FusionModeKey)}
                data-testid="select-fusion-mode"
                className="h-8 rounded-lg border-2 border-emerald-600 bg-white px-2.5 text-xs font-extrabold text-slate-950 shadow-2xs max-w-full"
              >
                {MODE_KEYS.map((mk) => (
                  <option key={mk} value={mk}>
                    {fusionMode === mk ? `✓ ${FUSION_MODES[mk].shortFa}` : FUSION_MODES[mk].shortFa}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              data-testid="button-toggle-bench"
              onClick={() => setOpenBench((v) => !v)}
              className="px-3 py-1.5 rounded-lg bg-white hover:bg-sky-100 border border-sky-300 text-sky-950 text-xs font-extrabold inline-flex items-center gap-1.5 shadow-2xs"
            >
              {openBench ? "بستن راهنمای ۱۴ حالت و قفل‌ها" : "راهنمای ۱۴ حالت تلفیقی و قفل‌ها"}
              {openBench ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          </div>

          {openBench && (
            <div className="bg-white rounded-lg border border-sky-200 p-3 space-y-3 overflow-x-auto">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-sky-100">
                <div className="flex flex-wrap items-center gap-1.5">
                  {MODE_KEYS.map((mk) => {
                    const m = FUSION_MODES[mk];
                    const active = fusionMode === mk;
                    return (
                      <button
                        key={mk}
                        type="button"
                        data-testid={`tab-fusion-${mk}`}
                        onClick={() => switchFusion(mk)}
                        className={`px-2.5 py-1.5 rounded-md text-[11px] font-extrabold transition-all ${
                          active
                            ? "bg-emerald-800 text-white shadow-xs ring-2 ring-amber-400"
                            : "bg-sky-50 text-sky-950 hover:bg-sky-100 border border-sky-200"
                        }`}
                      >
                        {m.shortFa}
                      </button>
                    );
                  })}
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
                    تورنمنت+شهر/کورت
                  </button>
                  <button
                    type="button"
                    data-testid="btn-twindb-player"
                    onClick={() => setTwinDbKind("player")}
                    className={`px-2 py-1 rounded-md transition-colors ${
                      twinDbKind === "player" ? "bg-indigo-700 text-white" : "text-indigo-900 hover:bg-white"
                    }`}
                  >
                    بازیکن ۱ به ۱ (جمتریا نام)
                  </button>
                </div>
              </div>

              <div className="text-xs font-extrabold text-sky-950 flex flex-wrap items-center justify-between gap-2">
                <span>فرمول فعال در موتور ۲ باکسی تنیس ({curTour.tour} • DEG1={curTour.deg1}):</span>
                <span className="font-mono text-[11px] text-emerald-950 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded" dir="ltr">
                  {cur.formulaEn}
                </span>
              </div>
            </div>
          )}
        </div>

        <NbaDashboardTab fusionMode={fusionMode} twinDbKind={twinDbKind} tour={activeTour} />

        <footer className="mt-8 pt-4 border-t border-border/50 text-center">
          <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest">
            TENNIS-FUSION-SIGNAL • Clean 2-Box Astro-Gematria Fusion (ATP DEG1=121 [1° LEO] • WTA DEG1=47 [17° TAURUS] • KXATPMATCH / KXWTAMATCH)
          </p>
        </footer>
      </div>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
