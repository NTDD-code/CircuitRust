import { useRef, useState, useCallback, useEffect } from "react";
import {
  Loader2, Eye, X, Upload, AlertTriangle, Sparkles, Zap,
  FlaskConical, ShieldCheck, Layers, Search, History, ChevronDown, Trash2,
} from "lucide-react";
import type { HecateAnalyzeResult } from "@workspace/api-client-react";
import {
  addHistoryEntry, loadHistory, clearHistory, timeAgo,
  type HecateHistoryEntry,
} from "@/lib/hecate-history";

export interface HecateModalProps {
  onClose: () => void;
  onInject: (dslCode: string, photoUrl: string) => void;
  onAnalyze: (imageBase64: string, mimeType: string, description: string) => void;
  loading: boolean;
  result: HecateAnalyzeResult | null;
  error: string | null;
}

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"] as const;
type AcceptedMime = (typeof ACCEPTED)[number];
function isAccepted(mime: string): mime is AcceptedMime {
  return (ACCEPTED as readonly string[]).includes(mime);
}

const LOAD_PHASES = [
  { icon: Search,       label: "Phase 1 — Visual Inventory",       sub: "Scanning components, ignoring the mess..." },
  { icon: Layers,       label: "Phase 2 — Description Parsing",    sub: "Reading functional intent as Primary Truth..." },
  { icon: FlaskConical, label: "Phase 3 — Functional Merge",       sub: "Reconstructing standard netlist from intent..." },
  { icon: ShieldCheck,  label: "Phase 4 — Heuristic Safety Audit", sub: "Checking physical build safety..." },
];

const MODE_META: Record<string, { label: string; color: string; short: string }> = {
  "vision-only":        { label: "Vision Only",        color: "#79C0FF", short: "V" },
  "description-guided": { label: "Description-Guided", color: "#D29922", short: "D" },
  "merged":             { label: "Vision + Guidance",  color: "#3FB950", short: "V+D" },
};

export function HecateModal({ onClose, onInject, onAnalyze, loading, result, error }: HecateModalProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview,      setPreview]      = useState<string | null>(null);
  const [mimeType,     setMimeType]     = useState<AcceptedMime>("image/jpeg");
  const [b64,          setB64]          = useState<string | null>(null);
  const [dragOver,     setDragOver]     = useState(false);
  const [fileError,    setFileError]    = useState<string | null>(null);
  const [description,  setDescription]  = useState("");
  const [loadPhase,    setLoadPhase]    = useState(0);
  const [history,      setHistory]      = useState<HecateHistoryEntry[]>([]);
  const [historyOpen,  setHistoryOpen]  = useState(false);

  // Load history on mount
  useEffect(() => { setHistory(loadHistory()); }, []);

  // Cycle loading phases
  useEffect(() => {
    if (!loading) { setLoadPhase(0); return; }
    const id = setInterval(() => setLoadPhase(p => (p + 1) % LOAD_PHASES.length), 1800);
    return () => clearInterval(id);
  }, [loading]);

  // Save to history when a result arrives
  useEffect(() => {
    if (!result || loading) return;
    const photoUrl = preview ?? "";
    addHistoryEntry(photoUrl, description, result).then(() => {
      setHistory(loadHistory());
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  const processFile = useCallback((file: File) => {
    setFileError(null);
    if (!isAccepted(file.type)) { setFileError("Unsupported format. Use JPEG, PNG, or WebP."); return; }
    if (file.size > 8 * 1024 * 1024) { setFileError("File exceeds 8 MB limit."); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setPreview(dataUrl);
      setB64(dataUrl.split(",")[1] ?? "");
      setMimeType(file.type as AcceptedMime);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };
  const handleActivate = () => { if (b64 && mimeType) onAnalyze(b64, mimeType, description); };
  const handleReset    = () => {
    setPreview(null); setB64(null); setFileError(null);
    if (fileRef.current) fileRef.current.value = "";
  };
  const handleClearHistory = () => { clearHistory(); setHistory([]); };

  // Re-inject directly from a history entry (no re-analysis needed)
  const handleReInject = (entry: HecateHistoryEntry) => {
    onInject(entry.result.dslCode, entry.thumbnailUrl);
  };

  const confidenceColor = result
    ? result.confidence >= 80 ? "#3FB950" : result.confidence >= 50 ? "#D29922" : "#F85149"
    : "#8B949E";
  const confidenceLabel = result
    ? result.confidence >= 80 ? "High" : result.confidence >= 50 ? "Moderate" : "Low"
    : "";
  const modeInfo  = result ? (MODE_META[result.reconstructionMode] ?? MODE_META["vision-only"]) : null;
  const PhaseIcon = LOAD_PHASES[loadPhase].icon;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(1,4,9,0.93)", backdropFilter: "blur(8px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative w-full rounded-2xl font-mono overflow-hidden flex flex-col"
        style={{
          background: "#0D1117",
          border: "1px solid #7C3AED40",
          boxShadow: "0 0 100px rgba(124,58,237,0.18), 0 25px 60px rgba(0,0,0,0.75)",
          maxHeight: "92vh",
          maxWidth: result ? "860px" : "600px",
          transition: "max-width 0.35s cubic-bezier(0.4,0,0.2,1)",
        }}
      >
        {/* ── Header ── */}
        <div
          className="relative px-6 py-4 shrink-0 border-b"
          style={{ background: "linear-gradient(135deg, #1A0A2E 0%, #0D1117 60%)", borderColor: "#7C3AED30" }}
        >
          <div
            className="absolute top-0 left-0 w-56 h-56 rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(124,58,237,0.12) 0%, transparent 70%)", transform: "translate(-30%,-30%)" }}
          />
          <div className="relative flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  background: "linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)",
                  boxShadow: loading ? "0 0 28px rgba(124,58,237,0.9)" : "0 0 12px rgba(124,58,237,0.4)",
                  transition: "box-shadow 0.3s",
                }}
              >
                {loading ? <Loader2 className="w-5 h-5 text-white animate-spin" /> : <Eye className="w-5 h-5 text-white" />}
              </div>
              <div>
                <h2 className="text-sm font-bold tracking-wide" style={{ color: "#E2D9F3" }}>
                  The Eyes of HECATE
                  <span className="ml-2 text-[10px] font-normal px-1.5 py-0.5 rounded" style={{ background: "#7C3AED20", color: "#A78BFA" }}>
                    Ugly-Build Mode
                  </span>
                </h2>
                <p className="text-[10px] mt-0.5" style={{ color: "#7C3AED" }}>
                  4-Phase Vision · Functional Reconstruction · Safety Audit
                  {history.length > 0 && (
                    <span className="ml-2 px-1.5 py-0.5 rounded text-[9px]" style={{ background: "#7C3AED20", color: "#A78BFA" }}>
                      {history.length} session{history.length !== 1 ? "s" : ""} saved
                    </span>
                  )}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg transition-colors hover:bg-white/5"
              style={{ color: "#6E7681" }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-auto p-5 space-y-4">

          {/* ── Upload + Description (only when no result and not loading) ── */}
          {!result && !loading && (
            <>
              <div className="flex gap-4">
                {/* Upload zone */}
                <div className="flex-1 min-w-0">
                  <label className="block text-[10px] uppercase tracking-widest mb-1.5" style={{ color: "#6E7681" }}>
                    Circuit Photo
                  </label>
                  <div
                    className="relative rounded-xl border-2 border-dashed transition-all cursor-pointer"
                    style={{
                      borderColor: dragOver ? "#7C3AED" : fileError ? "#F85149" : "#30363D",
                      background:  dragOver ? "#7C3AED0D" : "#0A0D12",
                      minHeight:   preview ? "auto" : "140px",
                    }}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    onClick={() => !preview && fileRef.current?.click()}
                  >
                    {!preview ? (
                      <div className="flex flex-col items-center justify-center gap-2.5 p-6">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "#161B22", border: "1px solid #30363D" }}>
                          <Upload className="w-4 h-4" style={{ color: "#7C3AED" }} />
                        </div>
                        <div className="text-center">
                          <p className="text-xs font-semibold" style={{ color: "#C9D1D9" }}>Drop photo here</p>
                          <p className="text-[10px] mt-0.5" style={{ color: "#6E7681" }}>JPEG · PNG · WebP · max 8 MB</p>
                          <p className="text-[10px] mt-1" style={{ color: "#4A5568" }}>Messy builds welcome.</p>
                        </div>
                      </div>
                    ) : (
                      <div className="relative">
                        <img src={preview} alt="PCB preview" className="w-full rounded-xl object-contain" style={{ maxHeight: "220px" }} />
                        <button
                          onClick={(e) => { e.stopPropagation(); handleReset(); }}
                          className="absolute top-2 right-2 p-1.5 rounded-lg"
                          style={{ background: "rgba(13,17,23,0.85)", color: "#8B949E" }}
                        >
                          <X className="w-3 h-3" />
                        </button>
                        <div className="absolute bottom-2 left-2 px-2 py-1 rounded-md text-[10px]" style={{ background: "rgba(13,17,23,0.85)", color: "#8B949E", border: "1px solid #21262D" }}>
                          Click × to replace
                        </div>
                      </div>
                    )}
                  </div>
                  {fileError && (
                    <div className="flex items-center gap-1.5 mt-1.5 text-[11px]" style={{ color: "#F85149" }}>
                      <AlertTriangle className="w-3 h-3 shrink-0" />{fileError}
                    </div>
                  )}
                </div>

                {/* Description textarea */}
                <div className="flex-1 min-w-0 flex flex-col">
                  <label className="block text-[10px] uppercase tracking-widest mb-1.5" style={{ color: "#6E7681" }}>
                    HECATE Guidance
                    <span className="ml-1.5 normal-case text-[9px]" style={{ color: "#4A5568" }}>(Primary Truth)</span>
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={"Describe what this circuit does...\n\nExample:\n\"NPN H-bridge motor controller\nfor 12V DC motor, uses four\n2N2222 transistors\"\n\nHECATE will use this as truth\nwhen the image is unclear."}
                    className="flex-1 resize-none rounded-xl text-[11px] leading-relaxed p-3 focus:outline-none transition-colors"
                    style={{
                      background: "#0A0D12",
                      border: `1px solid ${description.trim() ? "#7C3AED50" : "#30363D"}`,
                      color: "#C9D1D9",
                      minHeight: "140px",
                      caretColor: "#7C3AED",
                    }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = "#7C3AED80"; }}
                    onBlur={(e)  => { e.currentTarget.style.borderColor = description.trim() ? "#7C3AED50" : "#30363D"; }}
                  />
                  {description.trim() && (
                    <p className="mt-1.5 text-[10px] flex items-center gap-1" style={{ color: "#3FB950" }}>
                      <ShieldCheck className="w-3 h-3" />
                      Guided mode active — description will be Primary Truth
                    </p>
                  )}
                </div>
              </div>

              {/* Ugly-Build callout */}
              <div className="rounded-lg px-3 py-2.5 text-[10px] leading-relaxed" style={{ background: "#0A0D12", border: "1px solid #21262D", color: "#6E7681" }}>
                <span style={{ color: "#7C3AED", fontWeight: "bold" }}>Ugly-Build Mode: </span>
                HECATE ignores solder blobs, flux residue, and messy wires. It focuses on{" "}
                <span style={{ color: "#C9D1D9" }}>functional component identification</span>. If your image is too chaotic,
                add a description and HECATE will use it as Primary Truth to reconstruct a{" "}
                <span style={{ color: "#3FB950" }}>safe, standard netlist</span>.
              </div>

              {/* ── History Panel ── */}
              {history.length > 0 && (
                <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #21262D" }}>
                  {/* History header (toggle) */}
                  <button
                    onClick={() => setHistoryOpen(o => !o)}
                    className="w-full flex items-center justify-between px-4 py-2.5 transition-colors hover:bg-white/[0.02]"
                    style={{ background: "#0A0D12" }}
                  >
                    <div className="flex items-center gap-2">
                      <History className="w-3.5 h-3.5" style={{ color: "#7C3AED" }} />
                      <span className="text-[11px] font-semibold" style={{ color: "#C9D1D9" }}>
                        Recent Analyses
                      </span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: "#7C3AED20", color: "#A78BFA" }}>
                        {history.length}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleClearHistory(); }}
                        className="flex items-center gap-1 px-2 py-1 rounded text-[9px] transition-colors hover:opacity-80"
                        style={{ color: "#6E7681", border: "1px solid #30363D" }}
                        title="Clear history"
                      >
                        <Trash2 className="w-2.5 h-2.5" />
                        Clear
                      </button>
                      <ChevronDown
                        className="w-3.5 h-3.5 transition-transform"
                        style={{
                          color: "#6E7681",
                          transform: historyOpen ? "rotate(180deg)" : "rotate(0deg)",
                        }}
                      />
                    </div>
                  </button>

                  {/* History entries */}
                  {historyOpen && (
                    <div
                      className="divide-y"
                      style={{ borderTop: "1px solid #21262D", borderColor: "#21262D" }}
                    >
                      {history.map((entry) => {
                        const m    = MODE_META[entry.result.reconstructionMode] ?? MODE_META["vision-only"];
                        const cc   = entry.result.confidence >= 80 ? "#3FB950"
                                   : entry.result.confidence >= 50 ? "#D29922" : "#F85149";
                        const dslLineCount = entry.result.dslCode.split("\n").filter(l => l.trim()).length;
                        return (
                          <div
                            key={entry.id}
                            className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-white/[0.015]"
                            style={{ background: "#080B10" }}
                          >
                            {/* Thumbnail */}
                            <div
                              className="shrink-0 rounded-lg overflow-hidden"
                              style={{ width: "60px", height: "45px", background: "#0A0D12", border: "1px solid #21262D" }}
                            >
                              {entry.thumbnailUrl ? (
                                <img
                                  src={entry.thumbnailUrl}
                                  alt="thumbnail"
                                  className="w-full h-full object-cover"
                                  style={{ filter: entry.result.uglyBuildDetected ? "saturate(0.6) brightness(0.8)" : "none" }}
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Eye className="w-4 h-4" style={{ color: "#3C4450" }} />
                                </div>
                              )}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: `${cc}18`, color: cc, border: `1px solid ${cc}40` }}>
                                  {entry.result.confidence}%
                                </span>
                                <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: `${m.color}14`, color: m.color, border: `1px solid ${m.color}35` }}>
                                  {m.short}
                                </span>
                                {entry.result.uglyBuildDetected && (
                                  <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: "#D2992212", color: "#D29922", border: "1px solid #D2992235" }}>
                                    ugly
                                  </span>
                                )}
                                <span className="text-[9px] ml-auto" style={{ color: "#4A5568" }}>
                                  {timeAgo(entry.timestamp)}
                                </span>
                              </div>
                              <p className="mt-1 text-[10px] leading-relaxed truncate" style={{ color: "#8B949E" }}>
                                {entry.description.trim()
                                  ? entry.description.trim()
                                  : entry.result.analysis.slice(0, 80)}
                              </p>
                              <p className="mt-0.5 text-[9px]" style={{ color: "#4A5568" }}>
                                {entry.result.componentCount} components · {dslLineCount} DSL lines
                              </p>
                            </div>

                            {/* Re-inject button */}
                            <button
                              onClick={() => handleReInject(entry)}
                              className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all hover:opacity-90 active:scale-[0.97]"
                              style={{
                                background: "linear-gradient(135deg, #7C3AED20, #4F46E520)",
                                color: "#A78BFA",
                                border: "1px solid #7C3AED40",
                              }}
                              title="Re-inject this DSL into the editor"
                            >
                              <Zap className="w-3 h-3" />
                              Re-inject
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* ── 4-Phase Loading ── */}
          {loading && (
            <div className="rounded-xl p-6 flex flex-col items-center gap-5" style={{ background: "#0A0D12", border: "1px solid #7C3AED20" }}>
              <div className="relative flex items-center justify-center">
                <div className="absolute w-28 h-28 rounded-full animate-ping" style={{ background: "rgba(124,58,237,0.08)" }} />
                <div className="absolute w-20 h-20 rounded-full" style={{ background: "rgba(124,58,237,0.05)", animation: "ping 1.5s cubic-bezier(0,0,0.2,1) infinite", animationDelay: "0.5s" }} />
                <div className="w-14 h-14 rounded-full flex items-center justify-center relative z-10" style={{ background: "linear-gradient(135deg, #1A0A2E, #0D1117)", border: "1px solid #7C3AED60", boxShadow: "0 0 32px rgba(124,58,237,0.5)" }}>
                  <PhaseIcon className="w-6 h-6" style={{ color: "#7C3AED" }} />
                </div>
              </div>
              <div className="w-full space-y-2">
                {LOAD_PHASES.map((phase, i) => {
                  const StepIcon = phase.icon;
                  const isActive = i === loadPhase;
                  const isDone   = i < loadPhase;
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg transition-all"
                      style={{ background: isActive ? "#7C3AED12" : "transparent", border: `1px solid ${isActive ? "#7C3AED40" : "transparent"}`, opacity: isDone ? 0.45 : 1 }}
                    >
                      <div className="w-5 h-5 rounded flex items-center justify-center shrink-0" style={{ background: isActive ? "#7C3AED20" : isDone ? "#3FB95020" : "transparent" }}>
                        {isDone
                          ? <span style={{ color: "#3FB950", fontSize: "10px" }}>✓</span>
                          : <StepIcon className="w-3 h-3" style={{ color: isActive ? "#A78BFA" : "#4A5568" }} />}
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold" style={{ color: isActive ? "#E2D9F3" : isDone ? "#6E7681" : "#4A5568" }}>{phase.label}</p>
                        {isActive && <p className="text-[10px]" style={{ color: "#7C3AED" }}>{phase.sub}</p>}
                      </div>
                      {isActive && <Loader2 className="w-3 h-3 ml-auto animate-spin shrink-0" style={{ color: "#7C3AED" }} />}
                    </div>
                  );
                })}
              </div>
              {preview && <img src={preview} alt="Analyzing" className="w-24 rounded-lg opacity-30 object-contain" />}
            </div>
          )}

          {/* ── Error ── */}
          {error && !loading && (
            <div className="rounded-xl p-4 flex items-start gap-3" style={{ background: "#1A0808", border: "1px solid #F8514940" }}>
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#F85149" }} />
              <div>
                <p className="text-[12px] font-semibold" style={{ color: "#F85149" }}>HECATE encountered an error</p>
                <p className="text-[11px] mt-1" style={{ color: "#8B949E" }}>{error}</p>
              </div>
            </div>
          )}

          {/* ── Result ── */}
          {result && !loading && (
            <div className="space-y-3">
              {/* Revelation header */}
              <div className="rounded-xl p-3.5 flex items-start gap-3" style={{ background: "#0A1628", border: "1px solid #7C3AED40" }}>
                <Sparkles className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#7C3AED" }} />
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-bold" style={{ color: "#E2D9F3" }}>HECATE has revealed the circuit's inner logic.</p>
                  <p className="text-[11px] mt-1 leading-relaxed" style={{ color: "#8B949E" }}>{result.analysis}</p>
                </div>
              </div>

              {/* Safety Note */}
              {result.uglyBuildDetected && result.safetyNote && (
                <div className="rounded-xl p-3.5 flex items-start gap-3" style={{ background: "#1A1200", border: "1px solid #D2992260" }}>
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#D29922" }} />
                  <div>
                    <p className="text-[11px] font-bold mb-1" style={{ color: "#D29922" }}>⚠ HECATE Physical Safety Note</p>
                    <p className="text-[10px] leading-relaxed" style={{ color: "#9D8A50" }}>{result.safetyNote}</p>
                  </div>
                </div>
              )}

              {/* Stats row */}
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: "Confidence",  value: `${result.confidence}%`, sub: confidenceLabel,                                      color: confidenceColor },
                  { label: "Components",  value: String(result.componentCount), sub: "identified",                                    color: "#79C0FF" },
                  { label: "DSL Lines",   value: String(result.dslCode.split("\n").filter(l => l.trim()).length), sub: "generated",    color: "#3FB950" },
                  { label: "Mode",        value: modeInfo?.label ?? "–", sub: result.uglyBuildDetected ? "ugly build" : "clean build", color: modeInfo?.color ?? "#8B949E" },
                ].map(({ label, value, sub, color }) => (
                  <div key={label} className="rounded-lg px-2.5 py-2 flex flex-col gap-0.5" style={{ background: "#0A0D12", border: "1px solid #21262D" }}>
                    <span className="text-[9px] uppercase tracking-widest" style={{ color: "#6E7681" }}>{label}</span>
                    <span className="text-sm font-bold leading-tight" style={{ color }}>{value}</span>
                    <span className="text-[9px]" style={{ color: "#4A5568" }}>{sub}</span>
                  </div>
                ))}
              </div>

              {/* Split view: photo + DSL */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #21262D" }}>
                  <div className="px-3 py-1.5 flex items-center justify-between border-b" style={{ background: "#161B22", borderColor: "#21262D" }}>
                    <span className="text-[10px] font-semibold" style={{ color: "#6E7681" }}>BEFORE · Physical Build</span>
                    {result.uglyBuildDetected && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: "#D2992215", color: "#D29922", border: "1px solid #D2992240" }}>ugly build</span>
                    )}
                  </div>
                  {preview ? (
                    <div style={{ background: "#0A0D12", position: "relative" }}>
                      <img
                        src={preview}
                        alt="Original circuit"
                        className="w-full object-contain"
                        style={{ maxHeight: "200px", filter: result.uglyBuildDetected ? "brightness(0.85) saturate(0.7)" : "none" }}
                      />
                      {result.uglyBuildDetected && (
                        <div className="absolute inset-0 pointer-events-none rounded-b-xl" style={{ background: "linear-gradient(to bottom, transparent 50%, rgba(215,153,34,0.08) 100%)" }} />
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-32 text-[11px]" style={{ background: "#0A0D12", color: "#4A5568" }}>No preview</div>
                  )}
                </div>
                <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #7C3AED30" }}>
                  <div className="px-3 py-1.5 flex items-center justify-between border-b" style={{ background: "#0D0A20", borderColor: "#7C3AED20" }}>
                    <span className="text-[10px] font-semibold" style={{ color: "#7C3AED" }}>AFTER · Clean Netlist</span>
                    <span className="text-[9px]" style={{ color: "#4A3080" }}>circuit.src</span>
                  </div>
                  <pre className="p-3 text-[10px] overflow-auto leading-relaxed" style={{ background: "#080611", color: "#C9D1D9", maxHeight: "200px", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                    {result.dslCode}
                  </pre>
                </div>
              </div>

              {/* Inject */}
              <button
                onClick={() => onInject(result.dslCode, preview ?? "")}
                className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all hover:opacity-90 active:scale-[0.99]"
                style={{ background: "linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)", color: "white", boxShadow: "0 4px 24px rgba(124,58,237,0.4)" }}
              >
                <Zap className="w-4 h-4" />
                Inject into Editor &amp; Compile — Reveal the Magic
              </button>
              <button
                onClick={handleReset}
                className="w-full py-2 rounded-xl text-xs transition-all hover:opacity-70"
                style={{ color: "#6E7681", background: "transparent", border: "1px solid #21262D" }}
              >
                Try a different image
              </button>
            </div>
          )}
        </div>

        {/* Hidden file input */}
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFileChange} />

        {/* ── Footer (only in ready/error state) ── */}
        {!loading && !result && (
          <div className="px-5 py-3.5 border-t shrink-0 flex items-center justify-between gap-3" style={{ borderColor: "#21262D", background: "#0A0D12" }}>
            <p className="text-[10px]" style={{ color: "#4A5568" }}>
              Powered by Gemini Vision · Sessions saved locally
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="px-4 py-1.5 rounded-lg text-xs transition-colors hover:opacity-70"
                style={{ color: "#8B949E", border: "1px solid #30363D" }}
              >
                Cancel
              </button>
              <button
                onClick={handleActivate}
                disabled={!b64}
                className="flex items-center gap-2 px-5 py-1.5 rounded-lg text-xs font-bold transition-all hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed"
                style={{
                  background: b64 ? "linear-gradient(135deg, #7C3AED, #4F46E5)" : "#1F2937",
                  color: "white",
                  boxShadow: b64 ? "0 2px 14px rgba(124,58,237,0.3)" : "none",
                }}
              >
                <Eye className="w-3.5 h-3.5" />
                {description.trim() ? "Activate HECATE (Guided)" : "Activate HECATE's Vision"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
