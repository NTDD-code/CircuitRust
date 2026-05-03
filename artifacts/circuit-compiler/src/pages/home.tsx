import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import {
  useCompileCircuit,
  useExportNetlist,
  useGetExamples,
  useGetComponentLibrary,
  getGetExamplesQueryKey,
  getGetComponentLibraryQueryKey,
  type CompileResult,
  type LlmAnalyzeResult,
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
import type { SafetyIssue } from "@workspace/api-client-react";

type LucideIcon = ForwardRefExoticComponent<Omit<LucideProps, "ref"> & RefAttributes<SVGSVGElement>>;
type OutputTabDef = { id: OutputTab; icon: LucideIcon; label: string; disabled?: boolean };

const INITIAL_SOURCE = `// Simple LED circuit with current-limiting resistor
let vcc = Net::power(5.0);
let gnd = Net::ground();

let r1   = Component::Resistor { resistance: "220" };
let led1 = Component::LED { color: "red" };

connect!(vcc      => r1.pin1);
connect!(r1.pin2  => led1.anode);
connect!(led1.cathode => gnd);`;

type OutputTab = "output" | "bom" | "netlist" | "tree";

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

  const insertTextRef     = useRef<((text: string) => void) | null>(null);
  const handleCompileRef  = useRef<() => void>(() => {});

  const compileMutation = useCompileCircuit();
  const exportMutation = useExportNetlist();
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
            setOutputTab("tree");
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
    setShowSuccess(true);
    const t = setTimeout(() => setShowSuccess(false), 4500);
    return () => clearTimeout(t);
  }, [healthScore]);

  const providerConfigured = isProviderConfigured(aiSettings);
  const providerLabel = getProviderLabel(aiSettings);

  return (
    <>
      {showSplash && <SplashScreen onDone={() => setShowSplash(false)} />}

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
                  {exportMutation.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  Export <ChevronDown className="w-3.5 h-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-44 font-mono text-xs"
                style={{ background: "#161B22", border: "1px solid #30363D" }}
              >
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

        {/* ── Success toast ── */}
        {showSuccess && (
          <div className="fixed top-14 inset-x-0 flex justify-center z-50 pointer-events-none">
            <div
              className="flex items-center gap-3 px-5 py-2.5 rounded-lg font-mono text-sm animate-pulse"
              style={{
                background: "#0D3320",
                border:     "1px solid #3FB950",
                color:      "#3FB950",
                boxShadow:  "0 4px 24px rgba(63,185,80,0.3)",
              }}
            >
              <ShieldCheck className="w-4 h-4 shrink-0" />
              Circuit is Safe to Build! · Health Score: 100%
            </div>
          </div>
        )}

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
              />
            </div>

            {/* Output tabs bar */}
            <div
              className="shrink-0 flex items-center border-t"
              style={{ background: "#161B22", borderColor: "#21262D", height: "36px" }}
            >
              {(
                [
                  { id: "output", icon: Activity, label: "COMPILER OUTPUT" },
                  { id: "bom", icon: BarChart2, label: "BOM", disabled: !compileResult?.success },
                  { id: "netlist", icon: List, label: "NETLIST", disabled: !compileResult?.netlist },
                  { id: "tree", icon: Network, label: "SAFETY TREE", disabled: !compileResult?.netlist },
                ] satisfies OutputTabDef[]
              ).map(({ id, icon: Icon, label, disabled }) => (
                <button
                  key={id}
                  onClick={() => !disabled && setOutputTab(id)}
                  disabled={disabled}
                  className="flex items-center gap-1.5 px-4 h-full text-[10px] font-mono uppercase tracking-wider transition-colors border-b-2"
                  style={{
                    color: outputTab === id ? "#C9D1D9" : disabled ? "#3C4450" : "#6E7681",
                    borderColor: outputTab === id ? "#58A6FF" : "transparent",
                    background: outputTab === id ? "#0D1117" : "transparent",
                    cursor: disabled ? "not-allowed" : "pointer",
                  }}
                >
                  <Icon className="w-3 h-3" />
                  {label}
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
                          return (
                            <div
                              key={`e-${i}`}
                              className="mb-3 cursor-pointer rounded px-1 -mx-1 transition-colors"
                              title="Click to locate in Safety Tree"
                              onClick={() => {
                                const compId = err.message.match(/'([^']+)'/)?.[1];
                                if (compId) { setFocusedComponent(compId); setOutputTab("tree"); }
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.background = "#161B22"; }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                            >
                              <div>
                                <span style={{ color: "#F85149", fontWeight: "bold" }}>error</span>
                                <span style={{ color: "#8B949E" }}>[</span>
                                <span style={{ color: "#FF9A8B", fontWeight: "bold" }}>{err.errorCode}</span>
                                <span style={{ color: "#8B949E" }}>]</span>
                                <span style={{ color: "#F85149" }}>: {err.message}</span>
                              </div>
                              <div style={{ color: "#6E7681" }}>&nbsp;--&gt;&nbsp;circuit.src:{err.line}:{err.column}</div>
                              <div style={{ color: "#30363D" }}>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;|</div>
                              {srcLine && (
                                <>
                                  <div>
                                    <span style={{ color: "#6E7681" }}>{lineNum} |&nbsp;</span>
                                    <span style={{ color: "#C9D1D9" }}>{srcLine}</span>
                                  </div>
                                  <div>
                                    <span style={{ color: "#30363D" }}>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;|&nbsp;</span>
                                    <span style={{ color: "#F85149" }}>{"^".repeat(Math.min(srcLine.trim().length, 50))}</span>
                                  </div>
                                </>
                              )}
                              <div style={{ color: "#30363D" }}>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;|</div>
                            </div>
                          );
                        })}

                        {/* ── Warnings ── */}
                        {compileResult.warnings.map((warn, i) => {
                          const srcLine = srcLines[warn.line - 1] ?? "";
                          const lineNum = String(warn.line).padStart(4);
                          const isVoltage = warn.warningCode === "W003";
                          const warnColor = isVoltage ? "#F0883E" : "#D29922";
                          return (
                            <div
                              key={`w-${i}`}
                              className="mb-2 cursor-pointer rounded px-1 -mx-1 transition-colors"
                              title="Click to locate in Safety Tree"
                              onClick={() => {
                                const compId = warn.message.match(/'([^']+)'/)?.[1];
                                if (compId) { setFocusedComponent(compId); setOutputTab("tree"); }
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.background = "#161B22"; }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                            >
                              <div>
                                <span style={{ color: warnColor, fontWeight: "bold" }}>warning</span>
                                <span style={{ color: "#8B949E" }}>[</span>
                                <span style={{ color: warnColor }}>{warn.warningCode}</span>
                                <span style={{ color: "#8B949E" }}>]</span>
                                <span style={{ color: warnColor }}>: {warn.message}</span>
                              </div>
                              <div style={{ color: "#6E7681" }}>&nbsp;--&gt;&nbsp;circuit.src:{warn.line}:{warn.column}</div>
                              <div style={{ color: "#30363D" }}>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;|</div>
                              {srcLine && (
                                <div>
                                  <span style={{ color: "#6E7681" }}>{lineNum} |&nbsp;</span>
                                  <span style={{ color: "#C9D1D9" }}>{srcLine}</span>
                                </div>
                              )}
                              <div style={{ color: "#30363D" }}>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;|</div>
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
                                    <div style={{ color: "#8B949E" }}>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;= note: {issue.detail}</div>
                                  )}
                                  <div style={{ color: "#6E7681" }}>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;= help: line {issue.line}</div>
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
                  focusedComponent={focusedComponent}
                  onComponentFocus={setFocusedComponent}
                />
              )}
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
