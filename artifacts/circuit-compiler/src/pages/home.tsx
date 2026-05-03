import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import JSZip from "jszip";
import {
  useCompileCircuit,
  useExportNetlist,
  useGetExamples,
  useGetComponentLibrary,
  useHecateAnalyze,
  getGetExamplesQueryKey,
  getGetComponentLibraryQueryKey,
  type CompileResult,
  type LlmAnalyzeResult,
  type NetlistComponent,
  type HecateAnalyzeResult,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { LucideProps } from "lucide-react";
import type { ForwardRefExoticComponent, RefAttributes } from "react";
import {
  Play,
  AlertTriangle,
  ShieldCheck,
  Loader2,
  ChevronDown,
  Download,
  Settings,
  Activity,
  BarChart2,
  Network,
  Cpu,
  List,
  Package,
  FlaskConical,
  Eye,
  FilePlus,
  Copy,
  Check,
} from "lucide-react";
import { SplashScreen } from "@/components/splash-screen";
import { CircuitEditor } from "@/components/circuit-editor";
import { LibraryPanel } from "@/components/library-panel";
import { AiAssistantPanel } from "@/components/ai-assistant-panel";
import { AiSettingsDrawer } from "@/components/ai-settings-drawer";
import { CircuitSafetyTree } from "@/components/circuit-safety-tree";
import { BomPanel } from "@/components/bom-panel";
import { NetlistView } from "@/components/netlist-view";
import { loadAiSettings, saveAiSettings, getProviderLabel, isProviderConfigured, type AiProviderSettings } from "@/lib/ai-provider";
import { generateFix, FIX_LABELS } from "@/lib/safety-fix";
import { HealthGauge } from "@/components/health-gauge";
import { calculateHealthScore, playCompileSound } from "@/lib/health-score";
import { HecateModal } from "@/components/hecate-modal";
import type { SafetyIssue } from "@workspace/api-client-react";

type LucideIcon = ForwardRefExoticComponent<Omit<LucideProps, "ref"> & RefAttributes<SVGSVGElement>>;
type OutputTabDef = { id: OutputTab; icon: LucideIcon; label: string; disabled?: boolean };

// ── Frontend RefDes helper (mirrors backend circuit-exporter logic) ─────────
const REFDES_PFX: Record<string, string> = {
  Resistor:"R",PhotoResistor:"R",Thermistor:"R",Capacitor:"C",Inductor:"L",Transformer:"T",
  LED:"D",Diode:"D",ZenerDiode:"D",SchottkyDiode:"D",TVSDiode:"D",
  NPN:"Q",PNP:"Q",NMOSFET:"Q",PMOSFET:"Q",
  OpAmp741:"U",OpAmpTL082:"U",OpAmpLM358:"U",VoltageRegulator:"U",LDO:"U",
  BuckConverter:"U",BoostConverter:"U",LevelShifter:"U",IC:"U",
  DHT11:"U",DHT22:"U",MPU6050:"U",Ultrasonic:"US",IRSensor:"U",
  ArduinoUno:"MCU",ArduinoNano:"MCU",ESP32:"MCU",ESP8266:"MCU",
  RaspberryPiPico:"MCU",STM32:"MCU",
  Button:"SW",Switch:"SW",Crystal:"Y",Buzzer:"BZ",Motor:"M",Relay:"K",Solenoid:"L",
};
const BOM_PACKAGES: Record<string, string> = {
  Resistor:"R_Axial_DIN0207",Capacitor:"C_Disc_D5.0mm",Inductor:"L_Axial",
  LED:"LED_D5.0mm",Diode:"D_DO-41",ZenerDiode:"D_DO-35",SchottkyDiode:"D_DO-35",
  NPN:"TO-92_Inline",PNP:"TO-92_Inline",NMOSFET:"TO-220-3",PMOSFET:"TO-220-3",
  ArduinoUno:"Arduino_UNO_THT",ArduinoNano:"Arduino_Nano",ESP32:"ESP32-WROOM",
  OpAmp741:"DIP-8_W7.62mm",OpAmpLM358:"DIP-8_W7.62mm",VoltageRegulator:"TO-220-3",
};
function buildFrontendRefDesMap(comps: Pick<NetlistComponent,"id"|"type">[]): Map<string,string> {
  const counters=new Map<string,number>(), used=new Set<string>(), map=new Map<string,string>();
  for(const c of comps){const pfx=REFDES_PFX[c.type]??"X",m=c.id.match(new RegExp(`^${pfx}(\\d+)$`,"i"));if(m){const rd=`${pfx}${m[1]}`;map.set(c.id,rd);used.add(rd);}}
  for(const c of comps){if(map.has(c.id))continue;const pfx=REFDES_PFX[c.type]??"X";let n=(counters.get(pfx)??0)+1;while(used.has(`${pfx}${n}`))n++;counters.set(pfx,n);used.add(`${pfx}${n}`);map.set(c.id,`${pfx}${n}`);}
  return map;
}

const INITIAL_SOURCE = `// LED circuit with current-limiting resistor + test suite
let vcc = Net::power(5.0);
let gnd = Net::ground();

let r1   = Component::Resistor { resistance: "220" };
let led1 = Component::LED { color: "red" };

connect!(vcc      => r1.pin1);
connect!(r1.pin2  => led1.anode);
connect!(led1.cathode => gnd);

// ── Hardware-as-Code tests ────────────────────────────────
test "LED protection verified" {
  assert_connected!(r1.pin2, led1.anode);
  assert_net_exists!(vcc);
  assert_net_exists!(gnd);
  assert_gt!(r1.resistance, "100");
}

test "Power rails present" {
  assert_connected!(vcc, r1.pin1);
  assert_connected!(gnd, led1.cathode);
}`;

type OutputTab = "output" | "bom" | "netlist" | "tree" | "hecate";

export default function Home() {
  const [showSplash, setShowSplash] = useState(true);
  const [source, setSource] = useState(() => {
    return localStorage.getItem("scc_last_source") ?? INITIAL_SOURCE;
  });
  const [compileResult, setCompileResult] = useState<CompileResult | null>(null);
  const [analysisResult, setAnalysisResult] = useState<LlmAnalyzeResult | null>(null);
  const [aiSettings, setAiSettings] = useState<AiProviderSettings>(loadAiSettings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [outputTab, setOutputTab] = useState<OutputTab>("output");
  const [applyingFix, setApplyingFix] = useState<string | null>(null);
  const [appliedFix, setAppliedFix] = useState<string | null>(null);
  const [focusedComponent, setFocusedComponent] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [bundleLoading, setBundleLoading] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // ── HECATE Vision state ─────────────────────────────────────────────────────
  const [hecateOpen, setHecateOpen]       = useState(false);
  const [hecateResult, setHecateResult]   = useState<HecateAnalyzeResult | null>(null);
  const [hecateError, setHecateError]     = useState<string | null>(null);
  const [hecateToast, setHecateToast]     = useState<string | null>(null);
  const [hecateRevealData, setHecateRevealData] = useState<{
    result: HecateAnalyzeResult;
    photoUrl: string;
  } | null>(null);
  const hecateJustInjectedRef = useRef(false);

  const insertTextRef     = useRef<((text: string) => void) | null>(null);
  const handleCompileRef  = useRef<() => void>(() => {});
  const scrollToLineRef   = useRef<((line: number) => void) | null>(null);

  const compileMutation  = useCompileCircuit();
  const exportMutation   = useExportNetlist();
  const hecateMutation   = useHecateAnalyze();
  const { data: examplesData } = useGetExamples({ query: { queryKey: getGetExamplesQueryKey() } });
  const { data: libraryData } = useGetComponentLibrary({ query: { queryKey: getGetComponentLibraryQueryKey() } });

  const handleCompile = useCallback(() => {
    setCompileResult(null);
    setAnalysisResult(null);
    setOutputTab("output");
    compileMutation.mutate(
      { data: { source } },
      {
        onSuccess: (result) => {
          setCompileResult(result);
          setFocusedComponent(null);
          playCompileSound(result.success);
          if (result.success && result.netlist) {
            if (hecateJustInjectedRef.current) {
              hecateJustInjectedRef.current = false;
              setOutputTab("hecate");
            } else {
              setOutputTab("tree");
            }
          }
        },
      }
    );
  }, [source, compileMutation]);

  const handleExport = (format: "kicad" | "proteus" | "spice") => {
    if (!compileResult?.netlist) return;
    exportMutation.mutate(
      { data: { netlist: compileResult.netlist, format, title: "circuit" } },
      {
        onSuccess: (result) => {
          const blob = new Blob([result.content], { type: "text/plain" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = result.filename;
          a.style.display = "none";
          document.body.appendChild(a);
          a.click();
          setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }, 1000);
        },
      }
    );
  };

  const handleInsertFromLibrary = useCallback((text: string) => {
    if (insertTextRef.current) {
      const current = source;
      insertTextRef.current(current + "\n" + text);
      setSource(current + "\n" + text);
    }
  }, [source]);

  const handleInsertCode = useCallback((code: string) => {
    if (insertTextRef.current) {
      insertTextRef.current(code);
    }
    setSource(code);
  }, []);

  const handleSettingsChange = useCallback((s: AiProviderSettings) => {
    setAiSettings(s);
    saveAiSettings(s);
  }, []);

  const toggleProvider = useCallback(() => {
    const next: AiProviderSettings = {
      ...aiSettings,
      activeProvider: aiSettings.activeProvider === "cloud" ? "local" : "cloud",
    };
    setAiSettings(next);
    saveAiSettings(next);
  }, [aiSettings]);

  const registerInsert = useCallback((cb: (text: string) => void) => {
    insertTextRef.current = cb;
  }, []);

  const registerScrollToLine = useCallback((cb: (line: number) => void) => {
    scrollToLineRef.current = cb;
  }, []);

  const handleTraceToCode = useCallback((compId: string, pinName?: string) => {
    if (!scrollToLineRef.current) return;
    const lines = source.split("\n");
    let targetLine = -1;

    if (pinName) {
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(`${compId}.${pinName}`)) {
          targetLine = i + 1;
          break;
        }
      }
    }

    if (targetLine === -1) {
      const re = new RegExp(`\\blet\\s+${compId}\\b`);
      for (let i = 0; i < lines.length; i++) {
        if (re.test(lines[i])) {
          targetLine = i + 1;
          break;
        }
      }
    }

    if (targetLine !== -1) {
      scrollToLineRef.current(targetLine);
    }
  }, [source]);

  const handleApplyFix = useCallback((issue: SafetyIssue) => {
    const result = generateFix(issue.code, issue.detail ?? issue.message, source);
    if (!result) return;

    // Apply fixed source to the editor
    if (insertTextRef.current) insertTextRef.current(result.fixed);
    setSource(result.fixed);
    setApplyingFix(issue.code);
    setAppliedFix(null);

    // Recompile with the fixed source after a short settle delay
    setTimeout(() => {
      setCompileResult(null);
      setAnalysisResult(null);
      setOutputTab("output");
      compileMutation.mutate(
        { data: { source: result.fixed } },
        {
          onSuccess: (r) => {
            setCompileResult(r);
            setApplyingFix(null);
            setAppliedFix(issue.code);
            playCompileSound(r.success);
            if (r.success && r.netlist) setOutputTab("tree");
            // Clear the "applied" tick after 3 s
            setTimeout(() => setAppliedFix(null), 3000);
          },
        },
      );
    }, 250);
  }, [source, compileMutation]);

  // ── HECATE handlers ────────────────────────────────────────────────────────
  const handleHecateAnalyze = useCallback((imageBase64: string, mimeType: string, description: string) => {
    setHecateResult(null);
    setHecateError(null);
    hecateMutation.mutate(
      {
        data: {
          imageBase64,
          mimeType: mimeType as "image/jpeg" | "image/png" | "image/webp",
          ...(description.trim() ? { description: description.trim() } : {}),
        },
      },
      {
        onSuccess: (result) => {
          setHecateResult(result);
        },
        onError: (err) => {
          const msg = err instanceof Error ? err.message : "HECATE vision analysis failed. Try a clearer image.";
          setHecateError(msg);
        },
      }
    );
  }, [hecateMutation]);

  const handleHecateInject = useCallback((dslCode: string, photoUrl: string) => {
    setSource(dslCode);
    if (insertTextRef.current) insertTextRef.current(dslCode);
    // Store reveal data for the split-view HECATE tab
    if (hecateResult) {
      setHecateRevealData({ result: hecateResult, photoUrl });
    }
    hecateJustInjectedRef.current = true;
    setHecateOpen(false);
    setHecateResult(null);
    setHecateError(null);
    // Auto-compile after inject
    setTimeout(() => handleCompileRef.current(), 80);
    // Show revelation toast
    setHecateToast("HECATE has revealed the circuit's inner logic.");
    setTimeout(() => setHecateToast(null), 5000);
  }, [hecateResult]);

  const handleHecateClose = useCallback(() => {
    setHecateOpen(false);
    setHecateResult(null);
    setHecateError(null);
  }, []);

  // ── New blank file ──────────────────────────────────────────────────────────
  const handleNewFile = useCallback(() => {
    const blank = "";
    setSource(blank);
    if (insertTextRef.current) insertTextRef.current(blank);
    setCompileResult(null);
    setAnalysisResult(null);
    setHecateRevealData(null);
    setHecateResult(null);
    setHecateError(null);
    setFocusedComponent(null);
    setAppliedFix(null);
    setApplyingFix(null);
    setShowSuccess(false);
    setOutputTab("output");
    setCopiedKey(null);
  }, []);

  // ── Copy error / warning text to clipboard ──────────────────────────────────
  const handleCopyDiag = useCallback((key: string, text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedKey(key);
    setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 2000);
  }, []);

  // ── Production Bundle download ─────────────────────────────────────────────
  const handleDownloadBundle = useCallback(async () => {
    if (!compileResult?.netlist || !compileResult.success) return;
    setBundleLoading(true);
    try {
      const exportResult = await exportMutation.mutateAsync({
        data: { netlist: compileResult.netlist, format: "kicad", title: "circuit" },
      });

      // BOM CSV
      const refMap = buildFrontendRefDesMap(compileResult.netlist.components);
      const bomLines = [
        "Reference,Value,Type,Package,Quantity",
        ...compileResult.netlist.components.map((comp) => {
          const props = (comp.properties ?? {}) as Record<string, string>;
          const value = props.resistance ?? props.capacitance ?? props.inductance ?? props.model ?? props.color ?? comp.type;
          const ref = refMap.get(comp.id) ?? comp.id;
          const pkg = BOM_PACKAGES[comp.type] ?? "THT";
          return `${ref},${value},${comp.type},${pkg},1`;
        }),
      ];
      const bomCsv = bomLines.join("\n");

      // Safety report
      const tr = compileResult.testResults ?? [];
      const testsPassed = tr.filter((t) => t.passed).length;
      const testsTotal  = tr.length;
      const score       = calculateHealthScore(compileResult) ?? 0;
      const verdict     = score === 100 ? "READY FOR PROTOTYPE" : score >= 60 ? "NEEDS REVIEW" : "DO NOT BUILD";
      const now         = new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC";
      const bar         = "█".repeat(Math.round(score / 5)) + "░".repeat(20 - Math.round(score / 5));
      const divider     = "=".repeat(65);
      const dash        = "-".repeat(65);

      const reportLines = [
        divider,
        "  CIRCUIT SAFETY REPORT — CircuitRust Compiler v2.0",
        divider,
        "",
        `  Generated  : ${now}`,
        `  Source     : circuit.src`,
        "",
        `  HEALTH SCORE : ${score}/100  ${bar}`,
        `  VERDICT      : ${verdict}`,
        "",
        `${dash.slice(0, 20)} TEST RESULTS ${"-".repeat(32)}`,
        "",
        testsTotal > 0
          ? `  Tests Passed : ${testsPassed}/${testsTotal}${testsPassed === testsTotal ? " ✓ All assertions satisfied" : ""}`
          : "  No test{} blocks defined in this circuit.",
        "",
        ...tr.flatMap((t) => [
          `  [${t.passed ? "PASS" : "FAIL"}] ${t.description}`,
          ...t.assertions.map((a) => `        ${a.passed ? "✓" : "✗"} ${a.message}`),
          "",
        ]),
        `${dash.slice(0, 20)} SAFETY AUDIT ${"-".repeat(32)}`,
        "",
        ...(compileResult.safetyIssues ?? []).length === 0
          ? ["  No safety issues detected. Safe to prototype."]
          : (compileResult.safetyIssues ?? []).map((i) => `  [${i.severity}] ${i.code}: ${i.message}`),
        "",
        `${dash.slice(0, 20)} NETLIST SUMMARY ${"-".repeat(29)}`,
        "",
        `  Components  : ${compileResult.netlist.components.length}`,
        `  Connections : ${compileResult.netlist.connections.length}`,
        `  Nets        : ${compileResult.netlist.nets.length}`,
        `  Power Nets  : ${compileResult.netlist.nets.filter((n) => n.type === "power").length}`,
        `  Ground Nets : ${compileResult.netlist.nets.filter((n) => n.type === "ground").length}`,
        "",
        divider,
        "  End of Report",
        divider,
      ];

      const zip = new JSZip();
      zip.file("circuit.net", exportResult.content);
      zip.file("bom.csv", bomCsv);
      zip.file("safety_report.txt", reportLines.join("\n"));
      const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = "circuit_production.zip";
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
    } catch {
      // Export or zip failure — silently recover; bundleLoading is reset in finally
    } finally {
      setBundleLoading(false);
    }
  }, [compileResult, exportMutation]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep ref in sync so debounce always calls latest handleCompile
  useEffect(() => { handleCompileRef.current = handleCompile; }, [handleCompile]);

  // Auto-compile: 1.5 s debounce after every keystroke
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!compileMutation.isPending) handleCompileRef.current();
    }, 1500);
    return () => clearTimeout(timer);
  }, [source]); // eslint-disable-line react-hooks/exhaustive-deps

  const healthScore = useMemo(
    () => (compileResult ? calculateHealthScore(compileResult) : null),
    [compileResult],
  );

  useEffect(() => {
    if (healthScore !== 100) return;
    const tr = compileResult?.testResults ?? [];
    const allTestsPass = tr.length === 0 || tr.every((t) => t.passed);
    if (!allTestsPass) return;
    setShowSuccess(true);
    const timer = setTimeout(() => setShowSuccess(false), 5000);
    return () => clearTimeout(timer);
  }, [healthScore, compileResult?.testResults]); // eslint-disable-line react-hooks/exhaustive-deps

  const providerConfigured = isProviderConfigured(aiSettings);
  const providerLabel = getProviderLabel(aiSettings);

  return (
    <>
      {showSplash && <SplashScreen onDone={() => setShowSplash(false)} />}

      {/* ── HECATE Vision Modal ── */}
      {hecateOpen && (
        <HecateModal
          onClose={handleHecateClose}
          onInject={handleHecateInject}
          onAnalyze={handleHecateAnalyze}
          loading={hecateMutation.isPending}
          result={hecateResult}
          error={hecateError}
        />
      )}

      <AiSettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={aiSettings}
        onSettingsChange={handleSettingsChange}
      />

      <div
        className="flex flex-col h-screen overflow-hidden"
        style={{ background: "#0D1117", color: "#C9D1D9", fontFamily: "JetBrains Mono, monospace" }}
      >
        {/* ── Header ── */}
        <header
          className="flex items-center justify-between px-4 h-12 shrink-0 border-b"
          style={{ background: "#161B22", borderColor: "#30363D" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-sm shrink-0"
              style={{ background: "linear-gradient(135deg, #F0883E 0%, #FFD700 100%)" }}
            >
              ⚡
            </div>
            <span className="font-mono font-bold text-sm tracking-tight" style={{ color: "#C9D1D9" }}>
              Strict Circuit Compiler
            </span>
            <span className="text-xs font-mono hidden sm:block" style={{ color: "#6E7681" }}>
              Write circuits like Rust.
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Health Gauge */}
            {healthScore !== null && (
              <HealthGauge score={healthScore} />
            )}

            <div className="w-px h-5" style={{ background: "#30363D" }} />

            {/* Provider badge */}
            <button
              onClick={toggleProvider}
              title="Click to toggle provider"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-mono transition-colors hover:opacity-80"
              style={{
                background: providerConfigured ? "#1A2A1A" : "#1F2937",
                color: providerConfigured
                  ? aiSettings.activeProvider === "cloud" ? "#58A6FF" : "#3FB950"
                  : "#6E7681",
                border: "1px solid",
                borderColor: providerConfigured ? "#2D4A2D" : "#30363D",
              }}
            >
              {aiSettings.activeProvider === "cloud" ? "☁" : "⬡"} {providerLabel.slice(2, 32)}
            </button>

            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              style={{ color: "#6E7681" }}
              onClick={() => setSettingsOpen(true)}
              title="AI Provider Settings"
            >
              <Settings className="w-4 h-4" />
            </Button>

            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              style={{ color: "#6E7681" }}
              onClick={handleNewFile}
              title="New blank circuit — clears editor and all results"
            >
              <FilePlus className="w-4 h-4" />
            </Button>

            <div className="w-px h-5 mx-1" style={{ background: "#30363D" }} />

            {examplesData?.examples && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="font-mono text-xs h-8 px-3 gap-1"
                    style={{ color: "#8B949E" }}
                  >
                    Examples <ChevronDown className="w-3.5 h-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-64 font-mono text-xs"
                  style={{ background: "#161B22", border: "1px solid #30363D" }}
                >
                  {examplesData.examples.map((ex, i) => (
                    <DropdownMenuItem
                      key={i}
                      onClick={() => {
                        setSource(ex.source);
                        if (insertTextRef.current) insertTextRef.current(ex.source);
                        setCompileResult(null);
                        setAnalysisResult(null);
                      }}
                      className="cursor-pointer flex flex-col gap-0.5 py-2"
                      style={{ color: "#C9D1D9" }}
                    >
                      <span className="font-semibold" style={{ color: "#58A6FF" }}>{ex.name}</span>
                      <span className="text-[10px]" style={{ color: "#6E7681" }}>{ex.description}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="font-mono text-xs h-8 px-3 gap-1"
                  disabled={!compileResult?.success}
                  style={{ color: "#8B949E" }}
                >
                  {(exportMutation.isPending || bundleLoading) ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  Export <ChevronDown className="w-3.5 h-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-52 font-mono text-xs"
                style={{ background: "#161B22", border: "1px solid #30363D" }}
              >
                <DropdownMenuItem
                  onClick={handleDownloadBundle}
                  disabled={bundleLoading}
                  className="cursor-pointer flex items-center gap-2 py-2"
                  style={{ color: "#3FB950" }}
                >
                  <Package className="w-3.5 h-3.5 shrink-0" />
                  <div>
                    <div className="font-semibold">Production Bundle</div>
                    <div className="text-[9px]" style={{ color: "#6E7681" }}>.net + bom.csv + safety_report</div>
                  </div>
                </DropdownMenuItem>
                <div className="my-1 border-t" style={{ borderColor: "#21262D" }} />
                <DropdownMenuItem onClick={() => handleExport("kicad")} style={{ color: "#C9D1D9" }}>
                  KiCad (.net)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("proteus")} style={{ color: "#C9D1D9" }}>
                  Proteus (.sdf)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("spice")} style={{ color: "#C9D1D9" }}>
                  SPICE (.sp)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* HECATE Vision button */}
            <button
              onClick={() => { setHecateOpen(true); setHecateResult(null); setHecateError(null); }}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-mono font-semibold transition-all hover:opacity-90 active:scale-[0.98]"
              title="Open HECATE's Eyes — AI PCB vision reverse-engineering"
              style={{
                background: "linear-gradient(135deg, #3B1D6E 0%, #1E1B4B 100%)",
                color: "#C4B5FD",
                border: "1px solid #7C3AED50",
                boxShadow: "0 2px 12px rgba(124,58,237,0.25)",
              }}
            >
              <Eye className="w-3.5 h-3.5" />
              HECATE
            </button>

            <Button
              onClick={handleCompile}
              disabled={compileMutation.isPending}
              size="sm"
              className="font-mono text-xs h-8 px-4 gap-1.5"
              style={{ background: "#1F6FEB", color: "#fff" }}
            >
              {compileMutation.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5" />
              )}
              COMPILE
            </Button>
          </div>
        </header>

        {/* ── HECATE revelation toast ── */}
        {hecateToast && (
          <div className="fixed top-14 inset-x-0 flex justify-center z-50 pointer-events-none">
            <div
              className="flex items-center gap-3 px-5 py-2.5 rounded-lg font-mono text-sm"
              style={{
                background: "#1A0A2E",
                border:     "1px solid #7C3AED80",
                color:      "#E2D9F3",
                boxShadow:  "0 4px 32px rgba(124,58,237,0.4)",
              }}
            >
              <Eye className="w-4 h-4 shrink-0" style={{ color: "#7C3AED" }} />
              <span>{hecateToast}</span>
            </div>
          </div>
        )}

        {/* ── Success toast ── */}
        {showSuccess && (() => {
          const tr = compileResult?.testResults ?? [];
          const tp = tr.filter((t) => t.passed).length;
          return (
            <div className="fixed top-14 inset-x-0 flex justify-center z-50 pointer-events-none">
              <div
                className="flex items-center gap-3 px-5 py-2.5 rounded-lg font-mono text-sm"
                style={{
                  background: "#0D3320",
                  border:     "1px solid #3FB950",
                  color:      "#3FB950",
                  boxShadow:  "0 4px 32px rgba(63,185,80,0.4)",
                  animation:  "pulse 2s cubic-bezier(0.4,0,0.6,1) infinite",
                }}
              >
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>Circuit is Safe to Build! · Health: <strong>100/100</strong></span>
                {tr.length > 0 && (
                  <span style={{ opacity: 0.9 }}>
                    · Tests: <strong>{tp}/{tr.length}</strong> ✓
                  </span>
                )}
              </div>
            </div>
          );
        })()}

        {/* ── Main 3-panel body ── */}
        <div className="flex flex-1 min-h-0">
          {/* Left: Library Sidebar */}
          <div
            className="w-[240px] shrink-0 border-r overflow-hidden flex flex-col"
            style={{ borderColor: "#21262D" }}
          >
            <LibraryPanel
              components={libraryData?.components ?? []}
              onInsert={handleInsertFromLibrary}
            />
          </div>

          {/* Center: Editor + Output Tabs */}
          <div className="flex-1 min-w-0 flex flex-col min-h-0">
            {/* Monaco Editor */}
            <div className="flex-1 min-h-0 relative">
              <div
                className="absolute top-0 right-0 z-10 px-2.5 py-1 text-[9px] font-mono uppercase tracking-wider"
                style={{ color: "#6E7681", background: "#0D1117AA", backdropFilter: "blur(4px)" }}
              >
                SOURCE CODE · Ctrl+Enter to compile
              </div>
              <CircuitEditor
                value={source}
                onChange={setSource}
                onCompile={handleCompile}
                errors={compileResult?.errors}
                onInsertText={registerInsert}
                onScrollToLine={registerScrollToLine}
              />
            </div>

            {/* Output tabs bar */}
            <div
              className="shrink-0 flex items-center border-t"
              style={{ background: "#161B22", borderColor: "#21262D", height: "36px" }}
            >
              {(
                [
                  { id: "output",  icon: Activity,  label: "COMPILER OUTPUT" },
                  { id: "bom",     icon: BarChart2,  label: "BOM",         disabled: !compileResult?.success },
                  { id: "netlist", icon: List,       label: "NETLIST",     disabled: !compileResult?.netlist },
                  { id: "tree",    icon: Network,    label: "SAFETY TREE", disabled: !compileResult?.netlist },
                  { id: "hecate",  icon: Eye,        label: "HECATE VIEW", disabled: !hecateRevealData || !compileResult?.netlist },
                ] satisfies OutputTabDef[]
              ).map(({ id, icon: Icon, label, disabled }) => (
                <button
                  key={id}
                  onClick={() => !disabled && setOutputTab(id)}
                  disabled={disabled}
                  className="flex items-center gap-1.5 px-4 h-full text-[10px] font-mono uppercase tracking-wider transition-colors border-b-2"
                  style={{
                    color: outputTab === id
                      ? (id === "hecate" ? "#C4B5FD" : "#C9D1D9")
                      : disabled ? "#3C4450" : id === "hecate" && hecateRevealData ? "#7C3AED" : "#6E7681",
                    borderColor: outputTab === id
                      ? (id === "hecate" ? "#7C3AED" : "#58A6FF")
                      : "transparent",
                    background: outputTab === id ? "#0D1117" : "transparent",
                    cursor: disabled ? "not-allowed" : "pointer",
                  }}
                >
                  <Icon className="w-3 h-3" />
                  {label}
                  {id === "hecate" && hecateRevealData && outputTab !== "hecate" && (
                    <span
                      className="ml-1 w-1.5 h-1.5 rounded-full"
                      style={{ background: "#7C3AED", boxShadow: "0 0 4px rgba(124,58,237,0.8)" }}
                    />
                  )}
                </button>
              ))}

              {compileResult && (
                <div className="ml-auto px-4 flex items-center gap-2">
                  {compileResult.success ? (
                    <span className="text-[10px] font-mono flex items-center gap-1" style={{ color: "#3FB950" }}>
                      <ShieldCheck className="w-3 h-3" />
                      {compileResult.netlist?.components.length ?? 0} components · {compileResult.warnings.length} warnings
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono flex items-center gap-1" style={{ color: "#F85149" }}>
                      <AlertTriangle className="w-3 h-3" />
                      {compileResult.errors.length} error{compileResult.errors.length !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Output panel content */}
            <div
              className="shrink-0 overflow-auto"
              style={{ height: "320px", background: "#0D1117", borderTop: "1px solid #21262D" }}
            >
              {outputTab === "output" && (() => {
                const srcLines = source.split("\n");
                return (
                  <div className="p-4 font-mono text-xs leading-relaxed overflow-auto h-full" style={{ background: "#0D1117" }}>
                    {/* ── Idle state ── */}
                    {!compileResult && !compileMutation.isPending && (
                      <div className="pt-6 text-center" style={{ color: "#3C4450" }}>
                        {"// Ready to compile... (Ctrl+Enter)"}
                      </div>
                    )}

                    {/* ── Compiling animation ── */}
                    {compileMutation.isPending && (
                      <div className="space-y-0.5 animate-pulse" style={{ color: "#8B949E" }}>
                        <div>
                          <span style={{ color: "#3FB950", fontWeight: "bold" }}>   Compiling</span>{" "}
                          circuit "untitled" (strict mode)
                        </div>
                        <div>
                          <span style={{ color: "#3FB950", fontWeight: "bold" }}>    Checking</span>{" "}
                          safety rules and voltage compatibility
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Loader2 className="w-3 h-3 animate-spin" /> Running compilation pass...
                        </div>
                      </div>
                    )}

                    {/* ── Compile result ── */}
                    {compileResult && (
                      <div className="space-y-0">
                        {/* Header */}
                        <div style={{ color: "#8B949E" }}>
                          <span style={{ color: "#3FB950", fontWeight: "bold" }}>   Compiling</span>{" "}
                          circuit "untitled" ({compileResult.netlist?.components.length ?? 0} components, strict mode)
                        </div>
                        <div className="mb-3" style={{ color: "#8B949E" }}>
                          <span style={{ color: "#3FB950", fontWeight: "bold" }}>    Checking</span>{" "}
                          {compileResult.netlist?.connections.length ?? 0} connections, {compileResult.netlist?.nets.length ?? 0} power domains
                        </div>

                        {/* ── Errors ── */}
                        {compileResult.errors.map((err, i) => {
                          const srcLine = srcLines[err.line - 1] ?? "";
                          const lineNum = String(err.line).padStart(4);
                          const col0    = Math.max(0, (err.column ?? 1) - 1);
                          const caretPad    = " ".repeat(col0);
                          const caretSpan   = srcLine.length > col0 ? "^" + "~".repeat(Math.max(0, Math.min(srcLine.slice(col0).trimEnd().length - 1, 30))) : "^";
                          const copyKey = `e-${i}`;
                          const copyText = `error[${err.errorCode}]: ${err.message}\n --> circuit.src:${err.line}:${err.column}${srcLine ? `\n${lineNum} | ${srcLine}\n     | ${caretPad}${caretSpan}` : ""}`;
                          return (
                            <div
                              key={copyKey}
                              className="mb-3 rounded px-1 -mx-1 transition-colors relative group"
                              onMouseEnter={(e) => { e.currentTarget.style.background = "#161B22"; }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                            >
                              {/* copy button */}
                              <button
                                onClick={() => handleCopyDiag(copyKey, copyText)}
                                className="absolute top-0 right-0 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Copy error"
                                style={{ color: copiedKey === copyKey ? "#3FB950" : "#6E7681" }}
                              >
                                {copiedKey === copyKey
                                  ? <Check className="w-3 h-3" />
                                  : <Copy className="w-3 h-3" />}
                              </button>
                              {/* error[EXXX]: message — also click to locate in Safety Tree */}
                              <div
                                className="cursor-pointer"
                                title="Click to locate in Safety Tree"
                                onClick={() => {
                                  const compId = err.message.match(/'([^']+)'/)?.[1];
                                  if (compId) { setFocusedComponent(compId); setOutputTab("tree"); }
                                }}
                              >
                                <span style={{ color: "#FF2D55", fontWeight: "bold" }}>error</span>
                                <span style={{ color: "#8B949E" }}>[</span>
                                <span style={{ color: "#FF6B6B", fontWeight: "bold" }}>{err.errorCode}</span>
                                <span style={{ color: "#8B949E" }}>]</span>
                                <span style={{ color: "#F85149" }}>: {err.message}</span>
                              </div>
                              <div>
                                <span style={{ color: "#8B949E" }}> --&gt; </span>
                                <span style={{ color: "#E6EDF3", fontWeight: "bold" }}>circuit.src</span>
                                <span style={{ color: "#8B949E" }}>:{err.line}:{err.column}</span>
                              </div>
                              <div style={{ color: "#30363D" }}>     |</div>
                              {srcLine && (
                                <>
                                  <div style={{ whiteSpace: "pre" }}>
                                    <span style={{ color: "#6E7681" }}>{lineNum} | </span>
                                    <span style={{ color: "#E6EDF3" }}>{srcLine}</span>
                                  </div>
                                  <div style={{ whiteSpace: "pre" }}>
                                    <span style={{ color: "#30363D" }}>     | </span>
                                    <span style={{ color: "#30363D" }}>{caretPad}</span>
                                    <span style={{ color: "#FF2D55", fontWeight: "bold" }}>{caretSpan}</span>
                                  </div>
                                </>
                              )}
                              <div style={{ color: "#30363D" }}>     |</div>
                            </div>
                          );
                        })}

                        {/* ── Warnings ── */}
                        {compileResult.warnings.map((warn, i) => {
                          const srcLine = srcLines[warn.line - 1] ?? "";
                          const lineNum = String(warn.line).padStart(4);
                          const isVoltage = warn.warningCode === "W003";
                          const warnColor = isVoltage ? "#F0883E" : "#D29922";
                          const col0    = Math.max(0, (warn.column ?? 1) - 1);
                          const caretPad  = " ".repeat(col0);
                          const caretSpan = srcLine.length > col0 ? "^" + "~".repeat(Math.max(0, Math.min(srcLine.slice(col0).trimEnd().length - 1, 30))) : "^";
                          const copyKey = `w-${i}`;
                          const copyText = `warning[${warn.warningCode}]: ${warn.message}\n --> circuit.src:${warn.line}:${warn.column}${srcLine ? `\n${lineNum} | ${srcLine}\n     | ${caretPad}${caretSpan}` : ""}`;
                          return (
                            <div
                              key={copyKey}
                              className="mb-2 rounded px-1 -mx-1 transition-colors relative group"
                              onMouseEnter={(e) => { e.currentTarget.style.background = "#161B22"; }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                            >
                              {/* copy button */}
                              <button
                                onClick={() => handleCopyDiag(copyKey, copyText)}
                                className="absolute top-0 right-0 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Copy warning"
                                style={{ color: copiedKey === copyKey ? "#3FB950" : "#6E7681" }}
                              >
                                {copiedKey === copyKey
                                  ? <Check className="w-3 h-3" />
                                  : <Copy className="w-3 h-3" />}
                              </button>
                              {/* warning[WXXX]: message — click to locate in Safety Tree */}
                              <div
                                className="cursor-pointer"
                                title="Click to locate in Safety Tree"
                                onClick={() => {
                                  const compId = warn.message.match(/'([^']+)'/)?.[1];
                                  if (compId) { setFocusedComponent(compId); setOutputTab("tree"); }
                                }}
                              >
                                <span style={{ color: warnColor, fontWeight: "bold" }}>warning</span>
                                <span style={{ color: "#8B949E" }}>[</span>
                                <span style={{ color: warnColor, fontWeight: "bold" }}>{warn.warningCode}</span>
                                <span style={{ color: "#8B949E" }}>]</span>
                                <span style={{ color: warnColor }}>: {warn.message}</span>
                              </div>
                              <div>
                                <span style={{ color: "#8B949E" }}> --&gt; </span>
                                <span style={{ color: "#E6EDF3", fontWeight: "bold" }}>circuit.src</span>
                                <span style={{ color: "#8B949E" }}>:{warn.line}:{warn.column}</span>
                              </div>
                              <div style={{ color: "#30363D" }}>     |</div>
                              {srcLine && (
                                <>
                                  <div style={{ whiteSpace: "pre" }}>
                                    <span style={{ color: "#6E7681" }}>{lineNum} | </span>
                                    <span style={{ color: "#E6EDF3" }}>{srcLine}</span>
                                  </div>
                                  <div style={{ whiteSpace: "pre" }}>
                                    <span style={{ color: "#30363D" }}>     | </span>
                                    <span style={{ color: "#30363D" }}>{caretPad}</span>
                                    <span style={{ color: warnColor }}>{caretSpan}</span>
                                  </div>
                                </>
                              )}
                              <div style={{ color: "#30363D" }}>     |</div>
                            </div>
                          );
                        })}

                        {/* ── Safety Audit ── */}
                        {compileResult.safetyIssues && compileResult.safetyIssues.length > 0 && (
                          <div className="mt-2 pt-2 space-y-2 border-t" style={{ borderColor: "#21262D" }}>
                            <div style={{ color: "#6E7681" }}>{"// ── Safety Audit ─────────────────────────────────"}</div>
                            {compileResult.safetyIssues.map((issue, i) => {
                              const cfg = {
                                FATAL:    { color: "#FF2D20", label: "FATAL",    icon: "💥" },
                                CRITICAL: { color: "#FF6B35", label: "CRITICAL", icon: "🔥" },
                                DANGER:   { color: "#F0883E", label: "DANGER",   icon: "⚡" },
                                WARNING:  { color: "#D29922", label: "WARNING",  icon: "⚠" },
                              }[issue.severity] ?? { color: "#D29922", label: "NOTE", icon: "·" };
                              const fixLabel   = FIX_LABELS[issue.code];
                              const isApplying = applyingFix === issue.code;
                              const wasApplied = appliedFix  === issue.code;
                              return (
                                <div key={i} className="space-y-0.5">
                                  <div>
                                    <span style={{ color: cfg.color, fontWeight: "bold" }}>{cfg.icon} {cfg.label}</span>
                                    <span style={{ color: "#8B949E" }}> [{issue.code}]</span>
                                    <span style={{ color: cfg.color }}>: {issue.message}</span>
                                  </div>
                                  {issue.detail && (
                                    <div>
                                      <span style={{ color: "#30363D" }}>     = </span>
                                      <span style={{ color: "#56D364", fontWeight: "bold" }}>note</span>
                                      <span style={{ color: "#8B949E" }}>: {issue.detail}</span>
                                    </div>
                                  )}
                                  <div>
                                    <span style={{ color: "#30363D" }}>     = </span>
                                    <span style={{ color: "#79C0FF", fontWeight: "bold" }}>help</span>
                                    <span style={{ color: "#6E7681" }}>: line {issue.line}</span>
                                  </div>
                                  {fixLabel && (
                                    <button
                                      onClick={() => handleApplyFix(issue)}
                                      disabled={isApplying}
                                      className="ml-5 mt-0.5 px-2.5 py-1 rounded text-[10px] font-mono font-semibold transition-all"
                                      style={{
                                        background: wasApplied ? "#0D3320" : `${cfg.color}14`,
                                        border: `1px solid ${wasApplied ? "#3FB950" : cfg.color}55`,
                                        color: wasApplied ? "#3FB950" : cfg.color,
                                        cursor: isApplying ? "wait" : "pointer",
                                      }}
                                    >
                                      {wasApplied ? "✓ fix applied & recompiled" : isApplying ? "applying fix..." : `⚡ apply fix: ${fixLabel}`}
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* ── Test Suite ── */}
                        {compileResult.testResults && compileResult.testResults.length > 0 && (() => {
                          const tr = compileResult.testResults!;
                          const passed = tr.filter((t) => t.passed).length;
                          const allPass = passed === tr.length;
                          return (
                            <div className="mt-2 pt-2 border-t" style={{ borderColor: "#21262D" }}>
                              <div className="mb-1.5" style={{ color: "#6E7681" }}>
                                {"// ── Test Suite ─────────────────────────────────────"}
                              </div>
                              {tr.map((test, ti) => (
                                <div key={ti} className="mb-2">
                                  <div className="flex items-center gap-1.5">
                                    <span style={{ color: "#6E7681" }}>test</span>
                                    <span style={{ color: "#79C0FF", fontWeight: "bold" }}>"{test.description}"</span>
                                    <span style={{ color: "#6E7681" }}>→</span>
                                    <span style={{
                                      color: test.passed ? "#3FB950" : "#F85149",
                                      fontWeight: "bold",
                                    }}>
                                      {test.passed ? "PASS ✓" : "FAIL ✗"}
                                    </span>
                                  </div>
                                  {test.assertions.map((a, ai) => (
                                    <div key={ai} className="mt-0.5 ml-4" style={{ color: "#6E7681" }}>
                                      <span style={{ color: a.passed ? "#3FB950" : "#F85149" }}>
                                        {a.passed ? "✓" : "✗"}
                                      </span>
                                      {" "}
                                      <span style={{ color: "#8B949E", fontFamily: "monospace" }}>
                                        {a.code}
                                      </span>
                                      {" "}
                                      <span style={{ color: "#6E7681" }}>
                                        — {a.message}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              ))}
                              <div
                                className="mt-1 px-2 py-1.5 rounded flex items-center gap-2"
                                style={{
                                  background: allPass ? "#0D2B1A" : "#2B0D0D",
                                  border: `1px solid ${allPass ? "#1A4D2E" : "#4D1A1A"}`,
                                }}
                              >
                                <FlaskConical className="w-3 h-3 shrink-0" style={{ color: allPass ? "#3FB950" : "#F85149" }} />
                                <span style={{ color: allPass ? "#3FB950" : "#F85149", fontWeight: "bold" }}>
                                  Tests: {passed}/{tr.length} passed
                                </span>
                              </div>
                            </div>
                          );
                        })()}

                        {/* ── Final summary line ── */}
                        <div className="mt-4 pt-2 border-t" style={{ borderColor: "#30363D" }}>
                          {compileResult.errors.length > 0 ? (
                            <div>
                              <span style={{ color: "#F85149", fontWeight: "bold" }}>error</span>
                              <span style={{ color: "#C9D1D9" }}>
                                : could not compile circuit due to{" "}
                                <span style={{ color: "#F85149", fontWeight: "bold" }}>{compileResult.errors.length}</span>{" "}
                                error{compileResult.errors.length !== 1 ? "s" : ""}
                              </span>
                              {compileResult.warnings.length > 0 && (
                                <span style={{ color: "#D29922" }}>
                                  {" "}({compileResult.warnings.length} warning{compileResult.warnings.length !== 1 ? "s" : ""})
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center gap-2" style={{ color: "#3FB950" }}>
                              <ShieldCheck className="w-3.5 h-3.5" />
                              <span style={{ fontWeight: "bold" }}>Finished</span>
                              <span style={{ color: "#C9D1D9" }}>
                                — {compileResult.netlist?.components.length ?? 0} component{(compileResult.netlist?.components.length ?? 0) !== 1 ? "s" : ""} compiled successfully
                              </span>
                              {compileResult.warnings.length > 0 && (
                                <span style={{ color: "#D29922" }}>
                                  · {compileResult.warnings.length} warning{compileResult.warnings.length !== 1 ? "s" : ""}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {outputTab === "bom" && compileResult?.netlist && (
                <BomPanel netlist={compileResult.netlist} />
              )}

              {outputTab === "netlist" && compileResult?.netlist && (
                <NetlistView netlist={compileResult.netlist} />
              )}

              {outputTab === "tree" && compileResult?.netlist && (
                <CircuitSafetyTree
                  netlist={compileResult.netlist}
                  errors={compileResult.errors}
                  warnings={compileResult.warnings}
                  safetyIssues={compileResult.safetyIssues ?? []}
                  testResults={compileResult.testResults ?? []}
                  focusedComponent={focusedComponent}
                  onComponentFocus={setFocusedComponent}
                  onTraceToCode={handleTraceToCode}
                  healthScore={healthScore}
                />
              )}

              {outputTab === "hecate" && hecateRevealData && compileResult?.netlist && (() => {
                const { result: hr, photoUrl } = hecateRevealData;
                const modeColors: Record<string, string> = {
                  "vision-only": "#79C0FF", "description-guided": "#D29922", "merged": "#3FB950",
                };
                const modeLabels: Record<string, string> = {
                  "vision-only": "Vision Only", "description-guided": "Description-Guided", "merged": "Vision + Guidance",
                };
                const modeColor = modeColors[hr.reconstructionMode] ?? "#8B949E";
                const modeLabel = modeLabels[hr.reconstructionMode] ?? hr.reconstructionMode;
                const confColor = hr.confidence >= 80 ? "#3FB950" : hr.confidence >= 50 ? "#D29922" : "#F85149";
                return (
                  <div className="flex h-full min-h-0" style={{ background: "#0D1117" }}>
                    {/* ── Left: Original Photo ── */}
                    <div
                      className="w-[300px] shrink-0 flex flex-col border-r"
                      style={{ borderColor: "#21262D" }}
                    >
                      <div
                        className="px-3 py-2 border-b flex items-center justify-between shrink-0"
                        style={{ background: "#0A0D12", borderColor: "#21262D" }}
                      >
                        <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: "#6E7681" }}>
                          BEFORE · Physical Build
                        </span>
                        {hr.uglyBuildDetected && (
                          <span
                            className="text-[9px] px-1.5 py-0.5 rounded"
                            style={{ background: "#D2992215", color: "#D29922", border: "1px solid #D2992240" }}
                          >
                            ugly build
                          </span>
                        )}
                      </div>
                      <div className="flex-1 overflow-auto p-3 space-y-3">
                        {photoUrl ? (
                          <img
                            src={photoUrl}
                            alt="Original circuit"
                            className="w-full rounded-lg object-contain"
                            style={{
                              filter: hr.uglyBuildDetected ? "brightness(0.82) saturate(0.65)" : "none",
                              border: "1px solid #21262D",
                            }}
                          />
                        ) : (
                          <div
                            className="w-full h-32 rounded-lg flex items-center justify-center text-[11px]"
                            style={{ background: "#0A0D12", border: "1px solid #21262D", color: "#4A5568" }}
                          >
                            No photo
                          </div>
                        )}
                        {/* Stats chips */}
                        <div className="grid grid-cols-2 gap-1.5">
                          <div className="rounded-lg px-2 py-1.5 flex flex-col" style={{ background: "#0A0D12", border: "1px solid #21262D" }}>
                            <span className="text-[9px] uppercase tracking-widest" style={{ color: "#6E7681" }}>Confidence</span>
                            <span className="text-sm font-bold" style={{ color: confColor }}>{hr.confidence}%</span>
                          </div>
                          <div className="rounded-lg px-2 py-1.5 flex flex-col" style={{ background: "#0A0D12", border: "1px solid #21262D" }}>
                            <span className="text-[9px] uppercase tracking-widest" style={{ color: "#6E7681" }}>Components</span>
                            <span className="text-sm font-bold" style={{ color: "#79C0FF" }}>{hr.componentCount}</span>
                          </div>
                        </div>
                        <div className="rounded-lg px-2.5 py-2" style={{ background: "#0A0D12", border: `1px solid ${modeColor}30` }}>
                          <span className="text-[9px] uppercase tracking-widest" style={{ color: "#6E7681" }}>Reconstruction</span>
                          <p className="text-[11px] font-bold mt-0.5" style={{ color: modeColor }}>{modeLabel}</p>
                        </div>
                        {/* Analysis */}
                        <div
                          className="rounded-lg p-2.5 text-[10px] leading-relaxed"
                          style={{ background: "#0A1628", border: "1px solid #7C3AED20", color: "#8B949E" }}
                        >
                          <p className="text-[9px] uppercase tracking-widest mb-1" style={{ color: "#4A3080" }}>
                            HECATE Analysis
                          </p>
                          {hr.analysis}
                        </div>
                        {/* Safety note */}
                        {hr.uglyBuildDetected && hr.safetyNote && (
                          <div
                            className="rounded-lg p-2.5 text-[10px] leading-relaxed"
                            style={{ background: "#1A1200", border: "1px solid #D2992240", color: "#9D8A50" }}
                          >
                            <p className="text-[9px] uppercase tracking-widest mb-1 font-bold" style={{ color: "#D29922" }}>
                              ⚠ Physical Safety Note
                            </p>
                            {hr.safetyNote}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* ── Right: Clean Safety Tree ── */}
                    <div className="flex-1 min-w-0 flex flex-col">
                      <div
                        className="px-3 py-2 border-b flex items-center gap-2 shrink-0"
                        style={{ background: "#080611", borderColor: "#7C3AED20" }}
                      >
                        <Eye className="w-3 h-3" style={{ color: "#7C3AED" }} />
                        <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: "#7C3AED" }}>
                          AFTER · Clean Safety Tree
                        </span>
                        <span
                          className="ml-auto text-[9px] px-1.5 py-0.5 rounded"
                          style={{ background: "#7C3AED15", color: "#A78BFA", border: "1px solid #7C3AED30" }}
                        >
                          HECATE reconstructed
                        </span>
                      </div>
                      <div className="flex-1 min-h-0 overflow-auto">
                        <CircuitSafetyTree
                          netlist={compileResult.netlist}
                          errors={compileResult.errors}
                          warnings={compileResult.warnings}
                          safetyIssues={compileResult.safetyIssues ?? []}
                          testResults={compileResult.testResults ?? []}
                          focusedComponent={focusedComponent}
                          onComponentFocus={setFocusedComponent}
                          onTraceToCode={handleTraceToCode}
                          healthScore={healthScore}
                        />
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Right: AI Assistant */}
          <div
            className="w-[320px] shrink-0 border-l overflow-hidden flex flex-col"
            style={{ borderColor: "#21262D" }}
          >
            <AiAssistantPanel
              settings={aiSettings}
              onOpenSettings={() => setSettingsOpen(true)}
              netlist={compileResult?.netlist}
              source={source}
              analysisResult={analysisResult}
              setAnalysisResult={setAnalysisResult}
              onInsertCode={handleInsertCode}
            />
          </div>
        </div>

        {/* ── Status bar ── */}
        <div
          className="shrink-0 flex items-center justify-between px-4 h-6 text-[9px] font-mono border-t"
          style={{ background: "#161B22", borderColor: "#21262D", color: "#6E7681" }}
        >
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <Cpu className="w-3 h-3" /> Strict Circuit Compiler v2.0
            </span>
            {compileResult?.netlist && (
              <>
                <span style={{ color: "#3C4450" }}>·</span>
                <span>{compileResult.netlist.components.length} components</span>
                <span style={{ color: "#3C4450" }}>·</span>
                <span>{compileResult.netlist.nets.length} nets</span>
                <span style={{ color: "#3C4450" }}>·</span>
                <span>{compileResult.netlist.connections.length} connections</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span>circuit-dsl</span>
            <span style={{ color: "#3C4450" }}>·</span>
            <span>{source.split("\n").length} lines</span>
            <span style={{ color: "#3C4450" }}>·</span>
            <span
              style={{
                color: providerConfigured
                  ? aiSettings.activeProvider === "cloud"
                    ? "#58A6FF"
                    : "#3FB950"
                  : "#6E7681",
              }}
            >
              {providerLabel}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
