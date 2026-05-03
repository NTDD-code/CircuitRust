import { useState, useEffect } from "react";
import { Settings, Cloud, Monitor, CheckCircle, XCircle, Loader2, Radio, RefreshCw, Download, Sparkles } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AiProviderSettings,
  CLOUD_MODELS,
  GOOGLE_MODELS,
  saveAiSettings,
} from "@/lib/ai-provider";
import { useGetOllamaModels, useAiChat } from "@workspace/api-client-react";

interface AiSettingsDrawerProps {
  open: boolean;
  onClose: () => void;
  settings: AiProviderSettings;
  onSettingsChange: (s: AiProviderSettings) => void;
}

interface OllamaDetectedModel {
  name: string;
  size: number;
}

export function AiSettingsDrawer({
  open,
  onClose,
  settings,
  onSettingsChange,
}: AiSettingsDrawerProps) {
  const [draft, setDraft] = useState<AiProviderSettings>(settings);
  const [cloudStatus, setCloudStatus] = useState<"idle" | "testing" | "ok" | "fail">("idle");
  const [googleStatus, setGoogleStatus] = useState<"idle" | "testing" | "ok" | "fail">("idle");
  const [ollamaModels, setOllamaModels] = useState<OllamaDetectedModel[]>([]);
  const [ollamaAlive, setOllamaAlive] = useState<boolean | null>(null);
  const [pullModel, setPullModel] = useState("");
  const [pullStatus, setPullStatus] = useState<"idle" | "pulling" | "done" | "error">("idle");
  const [pullProgress, setPullProgress] = useState("");

  const ollamaModelsMutation = useGetOllamaModels();
  const testCloudMutation = useAiChat();
  const testGoogleMutation = useAiChat();

  useEffect(() => {
    if (open) setDraft(settings);
  }, [open, settings]);

  const updateCloud = (patch: Partial<AiProviderSettings["cloud"]>) =>
    setDraft((d) => ({ ...d, cloud: { ...d.cloud, ...patch } }));

  const updateLocal = (patch: Partial<AiProviderSettings["local"]>) =>
    setDraft((d) => ({ ...d, local: { ...d.local, ...patch } }));

  const updateGoogle = (patch: Partial<AiProviderSettings["google"]>) =>
    setDraft((d) => ({ ...d, google: { ...d.google, ...patch } }));

  const handleSaveCloud = () => {
    const next = { ...draft, activeProvider: "cloud" as const };
    onSettingsChange(next);
    saveAiSettings(next);
    onClose();
  };

  const handleSaveLocal = () => {
    const next = { ...draft, activeProvider: "local" as const };
    onSettingsChange(next);
    saveAiSettings(next);
    onClose();
  };

  const handleSaveGoogle = () => {
    const next = { ...draft, activeProvider: "google" as const };
    onSettingsChange(next);
    saveAiSettings(next);
    onClose();
  };

  const handleTestCloud = () => {
    if (!draft.cloud.apiKey) return;
    setCloudStatus("testing");
    testCloudMutation.mutate(
      {
        data: {
          provider: "cloud",
          model: draft.cloud.model,
          systemPrompt: "You are a helpful assistant. Reply with a single word.",
          userMessage: "Say: OK",
          apiKey: draft.cloud.apiKey,
        },
      },
      {
        onSuccess: () => setCloudStatus("ok"),
        onError: () => setCloudStatus("fail"),
      }
    );
  };

  const handleTestGoogle = () => {
    if (!draft.google.apiKey) return;
    setGoogleStatus("testing");
    testGoogleMutation.mutate(
      {
        data: {
          provider: "google",
          model: draft.google.model,
          systemPrompt: "You are a helpful assistant. Reply with a single word.",
          userMessage: "Say: OK",
          googleApiKey: draft.google.apiKey,
        },
      },
      {
        onSuccess: () => setGoogleStatus("ok"),
        onError: () => setGoogleStatus("fail"),
      }
    );
  };

  const handleDetectOllama = () => {
    ollamaModelsMutation.mutate(
      { data: { baseUrl: draft.local.baseUrl } },
      {
        onSuccess: (data) => {
          setOllamaAlive(data.alive);
          setOllamaModels(data.models as OllamaDetectedModel[]);
        },
        onError: () => {
          setOllamaAlive(false);
          setOllamaModels([]);
        },
      }
    );
  };

  const handlePullModel = async () => {
    if (!pullModel.trim()) return;
    setPullStatus("pulling");
    setPullProgress("Starting pull...");

    try {
      const res = await fetch("/api/ollama/pull", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseUrl: draft.local.baseUrl, model: pullModel.trim() }),
      });

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value);
        const lines = text.split("\n").filter((l) => l.startsWith("data: "));
        for (const line of lines) {
          try {
            const json = JSON.parse(line.slice(6));
            if (json.error) throw new Error(json.error);
            if (json.status === "success") {
              setPullStatus("done");
              setPullProgress("Model ready.");
              handleDetectOllama();
              return;
            }
            if (json.completed && json.total) {
              const pct = Math.round((json.completed / json.total) * 100);
              const gbDone = (json.completed / 1e9).toFixed(1);
              const gbTotal = (json.total / 1e9).toFixed(1);
              setPullProgress(`${json.status} — ${pct}% (${gbDone} GB / ${gbTotal} GB)`);
            } else if (json.status) {
              setPullProgress(json.status);
            }
          } catch {
            /* ignore malformed lines */
          }
        }
      }
      setPullStatus("done");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setPullProgress(`Error: ${msg}`);
      setPullStatus("error");
    }
  };

  const formatSize = (bytes: number) => `${(bytes / 1e9).toFixed(1)} GB`;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        className="w-[440px] sm:w-[480px] flex flex-col h-full p-0 border-l"
        style={{ background: "#161B22", borderColor: "#30363D" }}
      >
        <SheetHeader className="px-6 py-4 border-b" style={{ borderColor: "#30363D" }}>
          <SheetTitle className="flex items-center gap-2 font-mono text-sm" style={{ color: "#C9D1D9" }}>
            <Settings className="w-4 h-4" style={{ color: "#58A6FF" }} />
            AI Provider Settings
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-auto">
          <Tabs defaultValue="google" className="h-full">
            <TabsList
              className="w-full rounded-none border-b h-10"
              style={{ background: "#0D1117", borderColor: "#30363D" }}
            >
              <TabsTrigger
                value="google"
                className="flex-1 font-mono text-xs gap-1.5 data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-[#4285F4] rounded-none"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Google
              </TabsTrigger>
              <TabsTrigger
                value="cloud"
                className="flex-1 font-mono text-xs gap-1.5 data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-blue-400 rounded-none"
              >
                <Cloud className="w-3.5 h-3.5" />
                Anthropic
              </TabsTrigger>
              <TabsTrigger
                value="local"
                className="flex-1 font-mono text-xs gap-1.5 data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-green-400 rounded-none"
              >
                <Monitor className="w-3.5 h-3.5" />
                Ollama
              </TabsTrigger>
            </TabsList>

            {/* ── Google / Gemini ── */}
            <TabsContent value="google" className="p-6 space-y-5 m-0">
              <p className="text-xs font-mono leading-relaxed" style={{ color: "#6E7681" }}>
                Use Google Gemini with your own API key. Get one free at{" "}
                <a
                  href="https://aistudio.google.com/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "#4285F4" }}
                >
                  aistudio.google.com
                </a>
              </p>

              <div className="space-y-2">
                <label className="text-xs font-mono" style={{ color: "#8B949E" }}>
                  Google API Key
                </label>
                <Input
                  type="password"
                  placeholder="AIza..."
                  value={draft.google.apiKey}
                  onChange={(e) => updateGoogle({ apiKey: e.target.value })}
                  className="font-mono text-xs h-9 border-0 focus-visible:ring-1"
                  style={{ background: "#0D1117", color: "#C9D1D9" }}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-mono" style={{ color: "#8B949E" }}>
                  Model
                </label>
                <Select
                  value={draft.google.model}
                  onValueChange={(v) => updateGoogle({ model: v })}
                >
                  <SelectTrigger
                    className="font-mono text-xs h-9 border-0"
                    style={{ background: "#0D1117", color: "#C9D1D9" }}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent style={{ background: "#161B22", borderColor: "#30363D" }}>
                    {GOOGLE_MODELS.map((m) => (
                      <SelectItem key={m.id} value={m.id} className="font-mono text-xs">
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleTestGoogle}
                  disabled={!draft.google.apiKey || googleStatus === "testing"}
                  className="font-mono text-xs h-8"
                  style={{ borderColor: "#30363D", color: "#C9D1D9" }}
                >
                  {googleStatus === "testing" ? (
                    <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                  ) : null}
                  Test Connection
                </Button>
                {googleStatus === "ok" && (
                  <Badge className="gap-1 text-xs font-mono" style={{ background: "#1A3C1A", color: "#3FB950" }}>
                    <CheckCircle className="w-3 h-3" /> Connected
                  </Badge>
                )}
                {googleStatus === "fail" && (
                  <Badge className="gap-1 text-xs font-mono" style={{ background: "#3C1A1A", color: "#F85149" }}>
                    <XCircle className="w-3 h-3" /> Failed
                  </Badge>
                )}
              </div>

              <Button
                className="w-full font-mono text-xs h-9"
                style={{ background: "#4285F4", color: "#fff" }}
                onClick={handleSaveGoogle}
                disabled={!draft.google.apiKey}
              >
                Save & Use Google Gemini
              </Button>
            </TabsContent>

            {/* ── Anthropic / Claude ── */}
            <TabsContent value="cloud" className="p-6 space-y-5 m-0">
              <div className="space-y-2">
                <label className="text-xs font-mono" style={{ color: "#8B949E" }}>
                  API Key
                </label>
                <Input
                  type="password"
                  placeholder="sk-ant-api03-..."
                  value={draft.cloud.apiKey}
                  onChange={(e) => updateCloud({ apiKey: e.target.value })}
                  className="font-mono text-xs h-9 border-0 focus-visible:ring-1"
                  style={{ background: "#0D1117", color: "#C9D1D9" }}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-mono" style={{ color: "#8B949E" }}>
                  Model
                </label>
                <Select
                  value={draft.cloud.model}
                  onValueChange={(v) => updateCloud({ model: v })}
                >
                  <SelectTrigger
                    className="font-mono text-xs h-9 border-0"
                    style={{ background: "#0D1117", color: "#C9D1D9" }}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent style={{ background: "#161B22", borderColor: "#30363D" }}>
                    {CLOUD_MODELS.map((m) => (
                      <SelectItem key={m.id} value={m.id} className="font-mono text-xs">
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleTestCloud}
                  disabled={!draft.cloud.apiKey || cloudStatus === "testing"}
                  className="font-mono text-xs h-8"
                  style={{ borderColor: "#30363D", color: "#C9D1D9" }}
                >
                  {cloudStatus === "testing" ? (
                    <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                  ) : null}
                  Test Connection
                </Button>
                {cloudStatus === "ok" && (
                  <Badge className="gap-1 text-xs font-mono" style={{ background: "#1A3C1A", color: "#3FB950" }}>
                    <CheckCircle className="w-3 h-3" /> Connected
                  </Badge>
                )}
                {cloudStatus === "fail" && (
                  <Badge className="gap-1 text-xs font-mono" style={{ background: "#3C1A1A", color: "#F85149" }}>
                    <XCircle className="w-3 h-3" /> Failed
                  </Badge>
                )}
              </div>

              <Button
                className="w-full font-mono text-xs h-9"
                style={{ background: "#1F6FEB", color: "#fff" }}
                onClick={handleSaveCloud}
                disabled={!draft.cloud.apiKey}
              >
                Save & Use Cloud
              </Button>
            </TabsContent>

            {/* ── Ollama / Local ── */}
            <TabsContent value="local" className="p-6 space-y-5 m-0">
              <p className="text-xs font-mono leading-relaxed" style={{ color: "#6E7681" }}>
                Ollama runs AI models entirely on your machine. No API key needed. Your data never leaves your
                computer.{" "}
                <a href="https://ollama.com" target="_blank" rel="noopener noreferrer" style={{ color: "#58A6FF" }}>
                  https://ollama.com
                </a>
              </p>

              <div className="space-y-2">
                <label className="text-xs font-mono" style={{ color: "#8B949E" }}>
                  Ollama Base URL
                </label>
                <Input
                  placeholder="http://localhost:11434"
                  value={draft.local.baseUrl}
                  onChange={(e) => updateLocal({ baseUrl: e.target.value })}
                  className="font-mono text-xs h-9 border-0 focus-visible:ring-1"
                  style={{ background: "#0D1117", color: "#C9D1D9" }}
                />
              </div>

              <Button
                size="sm"
                variant="outline"
                onClick={handleDetectOllama}
                disabled={ollamaModelsMutation.isPending}
                className="w-full font-mono text-xs h-9 gap-2"
                style={{ borderColor: "#30363D", color: "#C9D1D9" }}
              >
                {ollamaModelsMutation.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                Detect Running Models
              </Button>

              {ollamaAlive !== null && (
                <div
                  className="rounded p-3 text-xs font-mono"
                  style={{
                    background: ollamaAlive ? "#1A3C1A" : "#3C1A1A",
                    color: ollamaAlive ? "#3FB950" : "#F85149",
                    border: `1px solid ${ollamaAlive ? "#2D5A2D" : "#5A2D2D"}`,
                  }}
                >
                  {ollamaAlive ? (
                    ollamaModels.length > 0 ? (
                      `✓ Ollama reachable — ${ollamaModels.length} model(s) found`
                    ) : (
                      "⚠ Ollama reachable but no models installed. Run: ollama pull llama3:8b"
                    )
                  ) : (
                    `✗ Cannot reach Ollama at ${draft.local.baseUrl}. Run: ollama serve`
                  )}
                </div>
              )}

              {ollamaModels.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-mono" style={{ color: "#8B949E" }}>
                    Select model:
                  </p>
                  {ollamaModels.map((m) => (
                    <button
                      key={m.name}
                      onClick={() => updateLocal({ model: m.name })}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded text-left hover:bg-[#21262D] transition-colors"
                      style={{
                        background: draft.local.model === m.name ? "#1F6FEB22" : "#0D1117",
                        border: `1px solid ${draft.local.model === m.name ? "#1F6FEB" : "#30363D"}`,
                      }}
                    >
                      <Radio
                        className="w-3.5 h-3.5 shrink-0"
                        style={{ color: draft.local.model === m.name ? "#58A6FF" : "#6E7681" }}
                      />
                      <span className="flex-1 font-mono text-xs" style={{ color: "#C9D1D9" }}>
                        {m.name}
                      </span>
                      <span className="text-[10px] font-mono" style={{ color: "#6E7681" }}>
                        {formatSize(m.size)}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-mono" style={{ color: "#8B949E" }}>
                  Or enter model name manually
                </label>
                <Input
                  placeholder="e.g. llama3:8b, codellama:13b"
                  value={draft.local.model && !ollamaModels.find((m) => m.name === draft.local.model) ? draft.local.model : ""}
                  onChange={(e) => updateLocal({ model: e.target.value })}
                  className="font-mono text-xs h-9 border-0 focus-visible:ring-1"
                  style={{ background: "#0D1117", color: "#C9D1D9" }}
                />
              </div>

              <div className="space-y-2 pt-2 border-t" style={{ borderColor: "#21262D" }}>
                <p className="text-xs font-mono font-semibold" style={{ color: "#8B949E" }}>
                  Install a New Model
                </p>
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g. llama3:8b"
                    value={pullModel}
                    onChange={(e) => setPullModel(e.target.value)}
                    className="font-mono text-xs h-8 border-0 focus-visible:ring-1 flex-1"
                    style={{ background: "#0D1117", color: "#C9D1D9" }}
                  />
                  <Button
                    size="sm"
                    onClick={handlePullModel}
                    disabled={!pullModel.trim() || pullStatus === "pulling"}
                    className="font-mono text-xs h-8 px-3 gap-1.5 shrink-0"
                    style={{ background: "#238636", color: "#fff" }}
                  >
                    {pullStatus === "pulling" ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Download className="w-3 h-3" />
                    )}
                    Pull
                  </Button>
                </div>
                {pullProgress && (
                  <p
                    className="text-[10px] font-mono"
                    style={{ color: pullStatus === "error" ? "#F85149" : pullStatus === "done" ? "#3FB950" : "#8B949E" }}
                  >
                    {pullProgress}
                  </p>
                )}
              </div>

              <Button
                className="w-full font-mono text-xs h-9"
                style={{ background: "#238636", color: "#fff" }}
                onClick={handleSaveLocal}
                disabled={!draft.local.model}
              >
                Save & Use Local
              </Button>
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}
