import { useRef, useState, useCallback } from "react";
import { Loader2, Eye, X, Upload, CheckCircle2, AlertTriangle, Sparkles, Zap } from "lucide-react";
import type { HecateAnalyzeResult } from "@workspace/api-client-react";

interface HecateModalProps {
  onClose: () => void;
  onInject: (dslCode: string) => void;
  onAnalyze: (imageBase64: string, mimeType: string) => void;
  loading: boolean;
  result: HecateAnalyzeResult | null;
  error: string | null;
}

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"] as const;
type AcceptedMime = (typeof ACCEPTED)[number];

function isAccepted(mime: string): mime is AcceptedMime {
  return (ACCEPTED as readonly string[]).includes(mime);
}

export function HecateModal({ onClose, onInject, onAnalyze, loading, result, error }: HecateModalProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<AcceptedMime>("image/jpeg");
  const [b64, setB64] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  const processFile = useCallback((file: File) => {
    setFileError(null);
    if (!isAccepted(file.type)) {
      setFileError("Unsupported format. Please use JPEG, PNG, or WebP.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setFileError("File exceeds 8 MB limit.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      // Extract base64 (strip data:image/...;base64, prefix)
      const base64 = dataUrl.split(",")[1] ?? "";
      setPreview(dataUrl);
      setB64(base64);
      setMimeType(file.type as AcceptedMime);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleActivate = () => {
    if (b64 && mimeType) onAnalyze(b64, mimeType);
  };

  const confidenceColor = result
    ? result.confidence >= 80 ? "#3FB950"
    : result.confidence >= 50 ? "#D29922"
    : "#F85149"
    : "#8B949E";

  const confidenceLabel = result
    ? result.confidence >= 80 ? "High Confidence"
    : result.confidence >= 50 ? "Moderate Confidence"
    : "Low Confidence"
    : "";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(1,4,9,0.92)", backdropFilter: "blur(8px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative w-full max-w-2xl rounded-2xl font-mono overflow-hidden flex flex-col"
        style={{
          background: "#0D1117",
          border: "1px solid #7C3AED40",
          boxShadow: "0 0 80px rgba(124,58,237,0.2), 0 25px 60px rgba(0,0,0,0.7)",
          maxHeight: "90vh",
        }}
      >
        {/* ── Purple glow header ── */}
        <div
          className="relative px-6 py-5 shrink-0 border-b"
          style={{
            background: "linear-gradient(135deg, #1A0A2E 0%, #0D1117 60%)",
            borderColor: "#7C3AED30",
          }}
        >
          {/* Ambient glow orb */}
          <div
            className="absolute top-0 left-0 w-48 h-48 rounded-full pointer-events-none"
            style={{
              background: "radial-gradient(circle, rgba(124,58,237,0.15) 0%, transparent 70%)",
              transform: "translate(-30%, -30%)",
            }}
          />

          <div className="relative flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              {/* Animated eye orb */}
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  background: "linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)",
                  boxShadow: loading
                    ? "0 0 24px rgba(124,58,237,0.8)"
                    : "0 0 12px rgba(124,58,237,0.4)",
                  transition: "box-shadow 0.3s",
                }}
              >
                {loading ? (
                  <Loader2 className="w-6 h-6 text-white animate-spin" />
                ) : (
                  <Eye className="w-6 h-6 text-white" />
                )}
              </div>
              <div>
                <h2 className="text-base font-bold tracking-wide" style={{ color: "#E2D9F3" }}>
                  The Eyes of HECATE
                </h2>
                <p className="text-[11px] mt-0.5" style={{ color: "#7C3AED" }}>
                  Multimodal AI · PCB Vision Reverse-Engineering
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

          {!loading && !result && (
            <p className="relative mt-3 text-[11px] leading-relaxed" style={{ color: "#8B949E" }}>
              Upload a photo of a physical PCB or breadboard circuit. HECATE will
              identify components, trace connectivity, and reverse-engineer it into
              CircuitRust DSL code automatically.
            </p>
          )}
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-auto p-6 space-y-4">

          {/* ── Upload zone (only when no result) ── */}
          {!result && (
            <>
              <div
                className="relative rounded-xl border-2 border-dashed transition-all cursor-pointer"
                style={{
                  borderColor: dragOver ? "#7C3AED" : fileError ? "#F85149" : "#30363D",
                  background: dragOver ? "#7C3AED0D" : "#0A0D12",
                  minHeight: preview ? "auto" : "160px",
                }}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => !preview && fileRef.current?.click()}
              >
                {!preview ? (
                  <div className="flex flex-col items-center justify-center gap-3 p-8">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center"
                      style={{ background: "#161B22", border: "1px solid #30363D" }}
                    >
                      <Upload className="w-5 h-5" style={{ color: "#7C3AED" }} />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold" style={{ color: "#C9D1D9" }}>
                        Drop your PCB photo here
                      </p>
                      <p className="text-[11px] mt-1" style={{ color: "#6E7681" }}>
                        or click to browse · JPEG, PNG, WebP · max 8 MB
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="relative">
                    <img
                      src={preview}
                      alt="PCB preview"
                      className="w-full rounded-xl object-contain"
                      style={{ maxHeight: "280px" }}
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreview(null);
                        setB64(null);
                        setFileError(null);
                        if (fileRef.current) fileRef.current.value = "";
                      }}
                      className="absolute top-2 right-2 p-1.5 rounded-lg"
                      style={{ background: "rgba(13,17,23,0.85)", color: "#8B949E" }}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                    <div
                      className="absolute bottom-2 left-2 px-2 py-1 rounded-md text-[10px]"
                      style={{ background: "rgba(13,17,23,0.85)", color: "#8B949E", border: "1px solid #21262D" }}
                    >
                      Click × to replace
                    </div>
                  </div>
                )}
              </div>

              {fileError && (
                <div className="flex items-center gap-2 text-[11px]" style={{ color: "#F85149" }}>
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  {fileError}
                </div>
              )}
            </>
          )}

          {/* ── Loading state ── */}
          {loading && (
            <div
              className="rounded-xl p-6 flex flex-col items-center gap-4"
              style={{ background: "#0A0D12", border: "1px solid #7C3AED20" }}
            >
              {/* Pulsing eye animation */}
              <div className="relative flex items-center justify-center">
                <div
                  className="absolute w-24 h-24 rounded-full animate-ping"
                  style={{ background: "rgba(124,58,237,0.1)" }}
                />
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg, #1A0A2E, #0D1117)", border: "1px solid #7C3AED40" }}
                >
                  <Eye className="w-7 h-7" style={{ color: "#7C3AED" }} />
                </div>
              </div>
              <div className="text-center space-y-1">
                <p className="text-sm font-bold" style={{ color: "#E2D9F3" }}>
                  Processing by HECATE...
                </p>
                <p className="text-[11px]" style={{ color: "#7C3AED" }}>
                  Identifying components · Tracing connectivity · Generating DSL
                </p>
              </div>
              {preview && (
                <img src={preview} alt="Analyzing" className="w-32 rounded-lg opacity-40 object-contain" />
              )}
            </div>
          )}

          {/* ── Error state ── */}
          {error && !loading && (
            <div
              className="rounded-xl p-4 flex items-start gap-3"
              style={{ background: "#1A0808", border: "1px solid #F8514940" }}
            >
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#F85149" }} />
              <div>
                <p className="text-[12px] font-semibold" style={{ color: "#F85149" }}>HECATE encountered an error</p>
                <p className="text-[11px] mt-1" style={{ color: "#8B949E" }}>{error}</p>
              </div>
            </div>
          )}

          {/* ── Result state ── */}
          {result && !loading && (
            <div className="space-y-4">
              {/* Revelation header */}
              <div
                className="rounded-xl p-4 flex items-start gap-3"
                style={{ background: "#0A1628", border: "1px solid #7C3AED40" }}
              >
                <Sparkles className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#7C3AED" }} />
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-bold" style={{ color: "#E2D9F3" }}>
                    HECATE has revealed the circuit's inner logic.
                  </p>
                  <p className="text-[11px] mt-1.5 leading-relaxed" style={{ color: "#8B949E" }}>
                    {result.analysis}
                  </p>
                </div>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-2">
                <div
                  className="rounded-lg px-3 py-2.5 flex flex-col gap-0.5"
                  style={{ background: "#0A0D12", border: "1px solid #21262D" }}
                >
                  <span className="text-[9px] uppercase tracking-widest" style={{ color: "#6E7681" }}>Confidence</span>
                  <span className="text-lg font-bold" style={{ color: confidenceColor }}>{result.confidence}%</span>
                  <span className="text-[9px]" style={{ color: confidenceColor }}>{confidenceLabel}</span>
                </div>
                <div
                  className="rounded-lg px-3 py-2.5 flex flex-col gap-0.5"
                  style={{ background: "#0A0D12", border: "1px solid #21262D" }}
                >
                  <span className="text-[9px] uppercase tracking-widest" style={{ color: "#6E7681" }}>Components</span>
                  <span className="text-lg font-bold" style={{ color: "#79C0FF" }}>{result.componentCount}</span>
                  <span className="text-[9px]" style={{ color: "#6E7681" }}>identified</span>
                </div>
                <div
                  className="rounded-lg px-3 py-2.5 flex flex-col gap-0.5"
                  style={{ background: "#0A0D12", border: "1px solid #21262D" }}
                >
                  <span className="text-[9px] uppercase tracking-widest" style={{ color: "#6E7681" }}>DSL Lines</span>
                  <span className="text-lg font-bold" style={{ color: "#3FB950" }}>
                    {result.dslCode.split("\n").filter(l => l.trim()).length}
                  </span>
                  <span className="text-[9px]" style={{ color: "#6E7681" }}>generated</span>
                </div>
              </div>

              {/* DSL preview */}
              <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #21262D" }}>
                <div
                  className="px-3 py-1.5 flex items-center justify-between border-b"
                  style={{ background: "#161B22", borderColor: "#21262D" }}
                >
                  <span className="text-[10px] font-semibold" style={{ color: "#7C3AED" }}>
                    ◈ Generated CircuitRust DSL
                  </span>
                  <span className="text-[9px]" style={{ color: "#6E7681" }}>circuit.src</span>
                </div>
                <pre
                  className="p-4 text-[11px] overflow-auto leading-relaxed"
                  style={{
                    background: "#0A0D12",
                    color: "#C9D1D9",
                    maxHeight: "200px",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {result.dslCode}
                </pre>
              </div>

              {/* Inject button */}
              <button
                onClick={() => onInject(result.dslCode)}
                className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all hover:opacity-90 active:scale-[0.99]"
                style={{
                  background: "linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)",
                  color: "white",
                  boxShadow: "0 4px 20px rgba(124,58,237,0.35)",
                }}
              >
                <Zap className="w-4 h-4" />
                Inject into Editor &amp; Compile
              </button>

              <button
                onClick={() => { setPreview(null); setB64(null); }}
                className="w-full py-2 rounded-xl text-xs transition-all hover:opacity-70"
                style={{ color: "#6E7681", background: "transparent", border: "1px solid #21262D" }}
              >
                Try a different image
              </button>
            </div>
          )}

          {/* Hidden file input */}
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {/* ── Footer actions (only in ready state) ── */}
        {!loading && !result && (
          <div
            className="px-6 py-4 border-t shrink-0 flex items-center justify-between gap-3"
            style={{ borderColor: "#21262D", background: "#0A0D12" }}
          >
            <p className="text-[10px]" style={{ color: "#6E7681" }}>
              Powered by Gemini Vision · No data is stored
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
                  boxShadow: b64 ? "0 2px 12px rgba(124,58,237,0.3)" : "none",
                }}
              >
                <Eye className="w-3.5 h-3.5" />
                Activate HECATE's Vision
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
