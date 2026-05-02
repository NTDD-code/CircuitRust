import { useState, useRef, useCallback, useEffect } from "react";
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
import { Badge } from "@/components/ui/badge";
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
  Zap,
  Settings,
  Activity,
  BarChart2,
  Network,
  Cpu,
} from "lucide-react";
import { SplashScreen } from "@/components/splash-screen";
import { CircuitEditor } from "@/components/circuit-editor";
import { LibraryPanel } from "@/components/library-panel";
import { AiAssistantPanel } from "@/components/ai-assistant-panel";
import { AiSettingsDrawer } from "@/components/ai-settings-drawer";
import { SchematicRenderer } from "@/components/schematic-renderer";
import { BomPanel } from "@/components/bom-panel";
import { loadAiSettings, saveAiSettings, getProviderLabel, isProviderConfigured, type AiProviderSettings } from "@/lib/ai-provider";

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

type OutputTab = "output" | "bom" | "visualizer";

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

  const insertTextRef = useRef<((text: string) => void) | null>(null);

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
          if (result.success && result.netlist) {
            setOutputTab("visualizer");
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
          a.click();
          URL.revokeObjectURL(url);
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
                  { id: "visualizer", icon: Network, label: "SCHEMATIC", disabled: !compileResult?.netlist },
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
              style={{ height: "220px", background: "#0D1117", borderTop: "1px solid #21262D" }}
            >
              {outputTab === "output" && (
                <div className="p-4 font-mono text-xs leading-relaxed space-y-3">
                  {!compileResult && !compileMutation.isPending && (
                    <div className="h-full flex items-center justify-center pt-8" style={{ color: "#3C4450" }}>
                      Ready to compile... (Ctrl+Enter)
                    </div>
                  )}
                  {compileMutation.isPending && (
                    <div className="flex items-center gap-2 animate-pulse" style={{ color: "#58A6FF" }}>
                      <Loader2 className="w-4 h-4 animate-spin" /> Compiling circuit definition...
                    </div>
                  )}
                  {compileResult && (
                    <div className="space-y-2">
                      {compileResult.success ? (
                        <div className="flex items-center gap-2" style={{ color: "#3FB950" }}>
                          <ShieldCheck className="w-4 h-4" />
                          <span>
                            ✓ Compiled successfully — {compileResult.errors.length} errors —{" "}
                            {compileResult.netlist?.components.length ?? 0} components
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2" style={{ color: "#F85149" }}>
                          <AlertTriangle className="w-4 h-4" />
                          Compilation failed with {compileResult.errors.length} error{compileResult.errors.length !== 1 ? "s" : ""}.
                        </div>
                      )}

                      {/* ── Safety Audit ── */}
                      {compileResult.safetyIssues && compileResult.safetyIssues.length > 0 && (
                        <div className="space-y-2">
                          <div
                            className="flex items-center gap-2 pt-1 pb-1 border-b"
                            style={{ borderColor: "#21262D" }}
                          >
                            <span className="text-[10px] font-mono font-bold uppercase tracking-widest" style={{ color: "#FF6B35" }}>
                              🔥 Safety Audit
                            </span>
                            <Badge
                              className="text-[9px] font-mono px-1.5 py-0 h-4"
                              style={{ background: "#3D1A0A", color: "#FF6B35", border: "1px solid #FF6B35" }}
                            >
                              {compileResult.safetyIssues.length} issue{compileResult.safetyIssues.length !== 1 ? "s" : ""}
                            </Badge>
                          </div>
                          {compileResult.safetyIssues.map((issue, i) => {
                            const cfg = {
                              FATAL:    { icon: "💥", color: "#FF2D20", bg: "#3D0A0A", badge: "#FF2D20", label: "FATAL ERROR" },
                              CRITICAL: { icon: "🔥", color: "#FF6B35", bg: "#3D1A0A", badge: "#FF6B35", label: "CRITICAL" },
                              DANGER:   { icon: "⚡", color: "#F0883E", bg: "#3D2A0A", badge: "#F0883E", label: "DANGER" },
                              WARNING:  { icon: "⚠️", color: "#D29922", bg: "#2D2200", badge: "#D29922", label: "WARNING" },
                            }[issue.severity];
                            return (
                              <div
                                key={i}
                                className="rounded-md p-2.5 space-y-1"
                                style={{ background: cfg.bg, border: `1px solid ${cfg.color}44` }}
                              >
                                <div className="flex items-start gap-2">
                                  <span className="text-sm shrink-0 mt-px">{cfg.icon}</span>
                                  <div className="flex-1 space-y-0.5">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <Badge
                                        className="text-[9px] font-mono px-1.5 py-0 h-4 shrink-0"
                                        style={{ background: "transparent", color: cfg.color, border: `1px solid ${cfg.color}` }}
                                      >
                                        [{cfg.label}]
                                      </Badge>
                                      <span className="font-semibold text-[11px]" style={{ color: cfg.color }}>
                                        {issue.message}
                                      </span>
                                    </div>
                                    {issue.detail && (
                                      <div className="text-[10px] leading-relaxed" style={{ color: "#8B949E" }}>
                                        {issue.detail}
                                      </div>
                                    )}
                                    <div className="text-[9px]" style={{ color: "#6E7681" }}>
                                      {issue.code} · line {issue.line}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* ── Compiler Errors ── */}
                      {compileResult.errors.map((err, i) => (
                        <div
                          key={i}
                          className="pl-3 border-l-2 space-y-0.5"
                          style={{ borderColor: "#F85149" }}
                        >
                          <div style={{ color: "#F85149" }}>
                            <span className="font-bold">error[{err.errorCode}]:</span> {err.message}
                          </div>
                          <div style={{ color: "#6E7681" }}>
                            → line {err.line}, col {err.column}
                          </div>
                        </div>
                      ))}

                      {compileResult.warnings.map((warn, i) => {
                        const isW003 = warn.warningCode === "W003";
                        return (
                          <div
                            key={i}
                            className="pl-3 border-l-2 space-y-0.5"
                            style={{ borderColor: isW003 ? "#F0883E" : "#D29922" }}
                          >
                            <div
                              className="flex items-center gap-2"
                              style={{ color: isW003 ? "#F0883E" : "#D29922" }}
                            >
                              {isW003 ? (
                                <Zap className="w-3.5 h-3.5 shrink-0" />
                              ) : (
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                              )}
                              <Badge
                                className="text-[9px] font-mono px-1.5 py-0 h-4 shrink-0"
                                style={{
                                  background: "transparent",
                                  color: isW003 ? "#F0883E" : "#D29922",
                                  border: `1px solid ${isW003 ? "#F0883E" : "#D29922"}`,
                                }}
                              >
                                {warn.warningCode}
                              </Badge>
                              {warn.message}
                            </div>
                            <div style={{ color: "#6E7681" }}>→ line {warn.line}</div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {outputTab === "bom" && compileResult?.netlist && (
                <BomPanel netlist={compileResult.netlist} />
              )}

              {outputTab === "visualizer" && compileResult?.netlist && (
                <SchematicRenderer netlist={compileResult.netlist} />
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
