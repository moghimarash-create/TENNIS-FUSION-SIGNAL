import path from "node:path";
import { fileURLToPath } from "node:url";
import { TENNIS_TOURS } from "./tennis-config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PYTHON_DIR = path.resolve(__dirname, "..", "python");

export type SheetLink = {
  label: string;
  spreadsheetId: string;
  tab?: string;
  url: string;
  market?: string;
};

export type StepDef = {
  id: number;
  name: string;
  description: string;
  runtime: "python" | "node";
  implemented: boolean;
  command: string;
  args: string[];
  inputs: SheetLink[];
  outputs: SheetLink[];
};

const INPUT_SHEET_ID = process.env.TENNIS_FUSION_INPUT_SHEET_ID ?? "";
const CALC_SHEET_ID = process.env.TENNIS_FUSION_CALC_SHEET_ID ?? "";

const sheetUrl = (id: string, tab?: string): string =>
  !id
    ? "#tennis-isolated-sheets-disabled"
    : tab
      ? `https://docs.google.com/spreadsheets/d/${id}/edit#gid=0&fvid=${encodeURIComponent(tab)}`
      : `https://docs.google.com/spreadsheets/d/${id}/edit`;

export const STEPS: StepDef[] = [
  {
    id: 1,
    name: `Tennis Clean 2-Box Dual-Engine Fusion (ATP DEG1=${TENNIS_TOURS.ATP.deg1} [1° LEO] • WTA DEG1=${TENNIS_TOURS.WTA.deg1} [17° TAURUS])`,
    description:
      "Combines TENNIS-SIGNAL-DASHBORD (Tournament/City/Court) and TENNIS-PLAYER-SIGNAL (1v1 Player A Name vs Player B Name, zero birthdate) in the clean 2-box fusion engine with Kalshi KXATPMATCH & KXWTAMATCH execution. 100% isolated from NBA-FUSION-CALCULATION.",
    runtime: "python",
    implemented: true,
    command: "python",
    args: [path.join(PYTHON_DIR, "nba_live_sync.py")],
    inputs: [
      {
        label: "TENNIS-FUSION-INPUT (Isolated • Auto-Write Disabled)",
        spreadsheetId: INPUT_SHEET_ID,
        tab: "Sheet1",
        url: sheetUrl(INPUT_SHEET_ID),
      },
    ],
    outputs: [
      {
        label: "TENNIS-FUSION-CALCULATION (Isolated • Auto-Write Disabled)",
        spreadsheetId: CALC_SHEET_ID,
        tab: "Fusion_Benchmark_Summary",
        url: sheetUrl(CALC_SHEET_ID, "Fusion_Benchmark_Summary"),
      },
    ],
  },
];

export function getStep(id: number): StepDef | undefined {
  return STEPS.find((s) => s.id === id);
}
