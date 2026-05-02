import { useState } from "react";
import { 
  useCompileCircuit, 
  useAnalyzeCircuitSafety, 
  useGetExamples, 
  getGetExamplesQueryKey, 
  CompileResult, 
  Netlist, 
  LlmAnalyzeResult,
  useExportNetlist,
  useGetComponentLibrary,
  getGetComponentLibraryQueryKey
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Play, ShieldAlert, Cpu, Activity, AlertTriangle, ShieldCheck, Loader2, ChevronDown, Download, Layers, Zap, Search, X } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";

export default function Home() {
  const [source, setSource] = useState(`// Simple LED circuit
let vcc = Net::power(5.0);
let gnd = Net::ground();

let r1 = Component::Resistor { resistance: 220.0 };
let led1 = Component::LED { color: "red" };

connect!(r1.pin1 => vcc);
connect!(r1.pin2 => led1.anode);
connect!(led1.cathode => gnd);`);

  const [compileResult, setCompileResult] = useState<CompileResult | null>(null);
  const [analysisResult, setAnalysisResult] = useState<LlmAnalyzeResult | null>(null);
  const [librarySearch, setLibrarySearch] = useState("");

  const compileMutation = useCompileCircuit();
  const analyzeMutation = useAnalyzeCircuitSafety();
  const exportMutation = useExportNetlist();
  
  const { data: examplesData } = useGetExamples({ query: { queryKey: getGetExamplesQueryKey() } });
  const { data: libraryData } = useGetComponentLibrary({ query: { queryKey: getGetComponentLibraryQueryKey() } });

  const handleCompile = () => {
    setCompileResult(null);
    setAnalysisResult(null);
    compileMutation.mutate({ data: { source } }, {
      onSuccess: (result) => {
        setCompileResult(result);
      }
    });
  };

  const handleAnalyze = () => {
    analyzeMutation.mutate({ data: { source, netlist: compileResult?.netlist } }, {
      onSuccess: (result) => {
        setAnalysisResult(result);
      }
    });
  };

  const handleExport = (format: "kicad" | "proteus" | "spice") => {
    if (!compileResult?.netlist) return;
    
    exportMutation.mutate({ 
      data: { netlist: compileResult.netlist, format, title: "circuit" } 
    }, {
      onSuccess: (result) => {
        const blob = new Blob([result.content], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = result.filename;
        a.click();
        URL.revokeObjectURL(url);
      }
    });
  };

  // Group components for the library panel
  const filteredComponents = libraryData?.components.filter(c => 
    c.type.toLowerCase().includes(librarySearch.toLowerCase()) || 
    c.description.toLowerCase().includes(librarySearch.toLowerCase())
  ) || [];

  const libraryGroups = filteredComponents.reduce((acc, comp) => {
    if (!acc[comp.category]) acc[comp.category] = [];
    acc[comp.category].push(comp);
    return acc;
  }, {} as Record<string, typeof filteredComponents>);

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden font-sans">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-border/40 bg-card">
        <div className="flex items-center gap-3">
          <div className="bg-primary/20 p-1.5 rounded-md">
            <Cpu className="w-5 h-5 text-primary" />
          </div>
          <h1 className="font-mono font-semibold text-lg tracking-tight">Strict Circuit Compiler</h1>
        </div>
        
        <div className="flex items-center gap-3">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="font-mono text-xs border-border/50 hover:bg-accent">
                <Layers className="w-4 h-4 mr-2 opacity-70" />
                Library
              </Button>
            </SheetTrigger>
            <SheetContent className="w-[400px] sm:w-[540px] flex flex-col h-full bg-card border-l border-border/40 p-0">
              <SheetHeader className="px-6 py-4 border-b border-border/40">
                <SheetTitle className="font-mono text-sm uppercase tracking-wider flex items-center gap-2">
                  <Layers className="w-4 h-4 text-primary" />
                  Component Library
                </SheetTitle>
              </SheetHeader>
              <div className="p-4 border-b border-border/40">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input 
                    placeholder="Search components..." 
                    value={librarySearch}
                    onChange={e => setLibrarySearch(e.target.value)}
                    className="pl-9 font-mono text-xs h-9 bg-background/50"
                  />
                  {librarySearch && (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                      onClick={() => setLibrarySearch("")}
                    >
                      <X className="w-3 h-3 text-muted-foreground" />
                    </Button>
                  )}
                </div>
              </div>
              <div className="flex-1 overflow-auto p-4 font-mono text-xs">
                {Object.entries(libraryGroups).length === 0 ? (
                  <div className="text-center text-muted-foreground py-8 italic">No components found.</div>
                ) : (
                  <div className="space-y-6">
                    {Object.entries(libraryGroups).map(([category, comps]) => (
                      <div key={category}>
                        <h3 className="uppercase tracking-widest text-[10px] text-muted-foreground mb-3 font-semibold border-b border-border/40 pb-1">{category}</h3>
                        <div className="space-y-3">
                          {comps.map(comp => (
                            <div key={comp.type} className="bg-background/50 rounded-md p-3 border border-border/40 hover:border-primary/30 transition-colors">
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="font-bold text-primary/90">{comp.type}</span>
                                {comp.voltageLevel && (
                                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-primary/20 bg-primary/5 text-primary/80">
                                    {comp.voltageLevel}V
                                  </Badge>
                                )}
                              </div>
                              <p className="text-muted-foreground mb-2 leading-relaxed">{comp.description}</p>
                              <div className="flex flex-wrap gap-1.5">
                                {comp.pins.map(pin => (
                                  <span key={pin.name} className="px-1.5 py-0.5 rounded bg-muted/50 text-[10px] text-muted-foreground border border-border/50" title={`Direction: ${pin.direction}\nType: ${pin.type}`}>
                                    {pin.name}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </SheetContent>
          </Sheet>

          <div className="w-px h-5 bg-border/50 mx-1"></div>

          {examplesData?.examples && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="font-mono text-xs border-border/50 hover:bg-accent" data-testid="dropdown-examples">
                  Examples <ChevronDown className="w-4 h-4 ml-2 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 font-mono text-xs bg-card border-border">
                {examplesData.examples.map((ex, i) => (
                  <DropdownMenuItem key={i} onClick={() => setSource(ex.source)} className="cursor-pointer focus:bg-accent focus:text-accent-foreground" data-testid={`example-${ex.name.toLowerCase().replace(/\\s+/g, '-')}`}>
                    <div className="flex flex-col gap-1">
                      <span className="font-semibold text-primary/90">{ex.name}</span>
                      <span className="text-muted-foreground line-clamp-1">{ex.description}</span>
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="outline" 
                size="sm" 
                className="font-mono text-xs border-border/50 hover:bg-accent"
                disabled={!compileResult?.success || exportMutation.isPending}
              >
                {exportMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2 opacity-70" />}
                EXPORT .NET <ChevronDown className="w-4 h-4 ml-2 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40 font-mono text-xs bg-card border-border">
              <DropdownMenuItem onClick={() => handleExport("kicad")} className="cursor-pointer">
                KiCad (.net)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("proteus")} className="cursor-pointer">
                Proteus (.sdf)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("spice")} className="cursor-pointer">
                SPICE (.sp)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button 
            onClick={handleCompile} 
            disabled={compileMutation.isPending}
            className="font-mono font-medium gap-2 shadow-sm shadow-primary/20"
            size="sm"
            data-testid="button-compile"
          >
            {compileMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            COMPILE
          </Button>

          <Button 
            onClick={handleAnalyze}
            disabled={analyzeMutation.isPending || !source.trim()}
            variant="secondary"
            size="sm"
            className="font-mono font-medium gap-2 border border-secondary-border"
            data-testid="button-analyze"
          >
            {analyzeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldAlert className="w-4 h-4" />}
            ANALYZE SAFETY
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left Column: Editor & Output */}
        <div className="w-1/2 flex flex-col border-r border-border/40">
          <div className="flex-1 flex flex-col min-h-0 relative">
            <div className="absolute top-0 right-0 px-3 py-1.5 text-[10px] font-mono text-muted-foreground uppercase tracking-wider bg-background/80 backdrop-blur-sm rounded-bl-md border-b border-l border-border/40 z-10">
              Source Code
            </div>
            <textarea
              className="w-full h-full bg-transparent text-foreground font-mono text-sm p-4 resize-none focus:outline-none border-none focus:ring-0 leading-relaxed selection:bg-primary/30"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              spellCheck={false}
              data-testid="input-editor"
            />
          </div>

          {/* Compiler Output */}
          <div className="h-64 border-t border-border/40 bg-card/50 flex flex-col">
            <div className="flex items-center px-4 py-2 border-b border-border/40 bg-card/80">
              <span className="text-xs font-mono font-medium text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                <Activity className="w-3.5 h-3.5" />
                Compiler Output
              </span>
            </div>
            <div className="flex-1 overflow-auto p-4 font-mono text-[13px] leading-relaxed">
              {!compileResult && !compileMutation.isPending && (
                <div className="text-muted-foreground/50 h-full flex items-center justify-center italic">
                  Ready to compile...
                </div>
              )}
              {compileMutation.isPending && (
                <div className="text-primary/70 animate-pulse flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Compiling circuit definition...
                </div>
              )}
              {compileResult && (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-4">
                  {compileResult.success ? (
                    <div className="text-green-400 font-medium flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4" />
                      Compiled successfully.
                    </div>
                  ) : (
                    <div className="text-destructive font-medium flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      Compilation failed with {compileResult.errors.length} error{compileResult.errors.length > 1 ? 's' : ''}.
                    </div>
                  )}

                  {compileResult.errors?.map((err, i) => (
                    <div key={i} className="text-destructive/90 pl-2 border-l-2 border-destructive/50">
                      <div className="font-bold mb-1">
                        error[{err.errorCode}]: {err.message}
                      </div>
                      <div className="text-muted-foreground">
                        {'-->'} line {err.line}, col {err.column}
                      </div>
                    </div>
                  ))}

                  {compileResult.warnings?.map((warn, i) => {
                    const isW003 = warn.warningCode === 'W003';
                    return (
                      <div key={i} className={`pl-3 py-1.5 border-l-2 bg-background/30 rounded-r-sm ${isW003 ? 'border-orange-500/70 text-orange-400/90' : 'border-amber-500/50 text-amber-500/90'}`}>
                        <div className="font-bold mb-1 flex items-center gap-2">
                          {isW003 ? <Zap className="w-4 h-4 text-orange-500" /> : <AlertTriangle className="w-4 h-4 text-amber-500" />}
                          <Badge variant="outline" className={`text-[10px] font-mono px-1 py-0 h-4 ${isW003 ? 'border-orange-500/50 text-orange-500' : 'border-amber-500/50 text-amber-500'}`}>
                            {warn.warningCode}
                          </Badge>
                          {warn.message}
                        </div>
                        <div className="text-muted-foreground opacity-70 ml-6">
                          {'-->'} line {warn.line}, col {warn.column}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Visualizer & LLM Analysis */}
        <div className="w-1/2 flex flex-col bg-background relative overflow-hidden">
          {/* Netlist Visualizer */}
          <div className="flex-1 p-6 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-mono font-medium text-muted-foreground uppercase tracking-widest">
                Netlist Visualizer
              </span>
              {compileResult?.netlist && (
                <Badge variant="outline" className="text-[10px] font-mono border-primary/30 text-primary/80">
                  {compileResult.netlist.components.length} Components
                </Badge>
              )}
            </div>
            
            <div className="flex-1 border border-border/40 rounded-lg bg-card/30 flex items-center justify-center overflow-hidden relative" data-testid="visualizer-container">
              {!compileResult?.netlist ? (
                <div className="text-muted-foreground/40 font-mono text-sm text-center">
                  No active netlist.<br/>Compile source to visualize.
                </div>
              ) : (
                <NetlistGraph netlist={compileResult.netlist} />
              )}
            </div>
          </div>

          {/* LLM Safety Analysis */}
          {(analysisResult || analyzeMutation.isPending) && (
            <div className="h-[40%] border-t border-border/40 bg-card/20 flex flex-col animate-in slide-in-from-bottom-8 duration-500">
              <div className="flex items-center justify-between px-4 py-2 border-b border-border/40 bg-card/80">
                <span className="text-xs font-mono font-medium text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  Safety Analysis
                </span>
                {analysisResult && (
                  <span className="text-[9px] text-muted-foreground/60 uppercase font-mono tracking-wider">
                    Powered by {analysisResult.model || "Gemma 2B (Placeholder)"}
                  </span>
                )}
              </div>
              
              <div className="flex-1 overflow-auto p-5">
                {analyzeMutation.isPending ? (
                  <div className="h-full flex flex-col items-center justify-center text-primary/60 space-y-4 animate-pulse">
                    <Loader2 className="w-8 h-8 animate-spin" />
                    <span className="font-mono text-sm">Analyzing circuit topology...</span>
                  </div>
                ) : analysisResult ? (
                  <div className="space-y-6">
                    <div className="flex items-center gap-6">
                      <div className="relative w-20 h-20 flex items-center justify-center shrink-0">
                        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                          <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/30" />
                          <circle 
                            cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="8" 
                            strokeDasharray="282.7" 
                            strokeDashoffset={282.7 - (282.7 * analysisResult.safetyScore) / 100}
                            className={
                              analysisResult.safetyScore > 80 ? "text-green-500" :
                              analysisResult.safetyScore > 50 ? "text-amber-500" : "text-destructive"
                            }
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-2xl font-bold font-mono">{analysisResult.safetyScore}</span>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {analysisResult.analysis}
                      </p>
                    </div>

                    {analysisResult.risks.length > 0 && (
                      <div>
                        <h4 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-3">Identified Risks</h4>
                        <div className="space-y-2">
                          {analysisResult.risks.map((risk, i) => (
                            <div key={i} className="flex items-start gap-3 bg-card p-3 rounded border border-border/50">
                              <Badge className={
                                risk.severity === 'critical' ? 'bg-destructive text-destructive-foreground' :
                                risk.severity === 'high' ? 'bg-orange-500 text-white' :
                                risk.severity === 'medium' ? 'bg-amber-500 text-white' : 'bg-blue-500 text-white'
                              }>
                                {risk.severity}
                              </Badge>
                              <div className="text-sm">
                                {risk.component && <span className="font-mono text-primary mr-2">{risk.component}:</span>}
                                {risk.description}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {analysisResult.suggestions.length > 0 && (
                      <div>
                        <h4 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-3">Suggestions</h4>
                        <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 pl-4 marker:text-primary/50">
                          {analysisResult.suggestions.map((sug, i) => (
                            <li key={i}>{sug}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function NetlistGraph({ netlist }: { netlist: Netlist }) {
  // A very rudimentary automatic layout for visualization purposes
  const compWidth = 100;
  const compHeight = 60;
  const paddingX = 180;
  const paddingY = 120;
  
  // Assign rough coordinates
  const nodes = netlist.components.map((comp, idx) => {
    // Simple grid layout
    const cols = Math.max(2, Math.ceil(Math.sqrt(netlist.components.length)));
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    return {
      ...comp,
      x: col * paddingX + 60,
      y: row * paddingY + 60
    };
  });

  const getPinPos = (compId: string, pinName: string) => {
    const node = nodes.find(n => n.id === compId);
    if (!node) return { x: 0, y: 0 };
    
    // Distribute pins along the edges roughly
    const pinIdx = node.pins.findIndex(p => p.name === pinName);
    const totalPins = node.pins.length;
    
    // Just put them on the right/left randomly based on index for now
    const isRight = pinIdx % 2 === 0;
    
    // Adjust layout slightly for larger nodes like modules
    const width = node.category === 'module' ? compWidth + 20 : compWidth;
    const height = node.category === 'module' ? compHeight + 20 : compHeight;
    
    return {
      x: node.x + (isRight ? width : 0),
      y: node.y + (height / (totalPins + 1)) * (pinIdx + 1)
    };
  };

  const getNetColor = (netType: string) => {
    switch (netType) {
      case 'power': return '#ef4444'; // red
      case 'ground': return '#6b7280'; // dark gray
      case 'signal': return '#22c55e'; // green
      default: return '#60a5fa'; // blue
    }
  };
  
  const getCategoryStyle = (category: string) => {
    switch (category) {
      case 'passive': return { border: '#6b7280', fill: 'hsl(var(--card))' };
      case 'active_discrete': return { border: '#f59e0b', fill: 'hsl(var(--card))' };
      case 'active_ic': return { border: '#8b5cf6', fill: 'hsl(var(--card))' };
      case 'sensor': return { border: '#06b6d4', fill: 'hsl(var(--card))' };
      case 'module': return { border: '#22c55e', fill: 'hsl(var(--card))' };
      case 'power': return { border: '#ef4444', fill: 'hsl(var(--card))' };
      default: return { border: 'hsl(var(--border))', fill: 'hsl(var(--card))' };
    }
  };

  return (
    <div className="w-full h-full overflow-auto relative p-4 animate-in fade-in duration-700">
      <svg className="min-w-[800px] min-h-[600px] w-full h-full" style={{ overflow: 'visible' }}>
        <defs>
          <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="currentColor" className="text-muted-foreground/50"/>
          </marker>
          <pattern id="zigzag" x="0" y="0" width="10" height="10" patternUnits="userSpaceOnUse">
            <path d="M 0 5 L 5 0 L 10 5 L 5 10 Z" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-muted-foreground/30" />
          </pattern>
        </defs>
        
        {/* Draw connections */}
        {netlist.connections.map((conn, idx) => {
          const fromPos = getPinPos(conn.from, conn.fromPin);
          const toPos = getPinPos(conn.to, conn.toPin);
          const net = netlist.nets.find(n => n.name === conn.net);
          const color = getNetColor(net?.type || 'signal');
          
          // Bezier curve
          const dx = Math.abs(toPos.x - fromPos.x) * 0.5;
          const path = `M ${fromPos.x} ${fromPos.y} C ${fromPos.x + dx} ${fromPos.y}, ${toPos.x - dx} ${toPos.y}, ${toPos.x} ${toPos.y}`;
          
          return (
            <path
              key={`conn-${idx}`}
              d={path}
              fill="none"
              stroke={color}
              strokeWidth="2"
              className="opacity-70 hover:opacity-100 hover:stroke-[3px] transition-all duration-200 cursor-pointer"
            >
              <title>{conn.net} ({net?.type})</title>
            </path>
          );
        })}

        {/* Draw components */}
        {nodes.map(node => {
          const style = getCategoryStyle(node.category);
          const isModule = node.category === 'module';
          const w = isModule ? compWidth + 20 : compWidth;
          const h = isModule ? compHeight + 20 : compHeight;
          const cx = w / 2;
          
          return (
            <g key={node.id} transform={`translate(${node.x}, ${node.y})`} className="group cursor-pointer">
              {node.category === 'sensor' ? (
                <rect 
                  width={w} height={h} rx="16" 
                  fill={style.fill} stroke={style.border} strokeWidth="2"
                  className="group-hover:brightness-125 transition-all duration-200"
                />
              ) : (
                <rect 
                  width={w} height={h} rx="4" 
                  fill={style.fill} stroke={style.border} strokeWidth={isModule ? "3" : "2"}
                  className="group-hover:brightness-125 transition-all duration-200"
                />
              )}
              
              {/* Category Inner Symbols */}
              {node.category === 'passive' && (
                <rect x="25" y={15} width={w - 50} height={h - 30} fill="url(#zigzag)" stroke="none" />
              )}
              {node.category === 'active_discrete' && (
                <path d={`M ${cx - 10} 25 L ${cx + 10} 35 L ${cx - 10} 45 Z`} fill="none" stroke={style.border} strokeWidth="1.5" />
              )}
              {node.category === 'active_ic' && (
                <path d={`M ${cx - 15} 20 L ${cx + 15} 35 L ${cx - 15} 50 Z`} fill="none" stroke={style.border} strokeWidth="1.5" />
              )}
              {node.category === 'power' && (
                <path d={`M ${cx + 2} 15 L ${cx - 8} 35 L ${cx + 2} 35 L ${cx - 2} 55 L ${cx + 10} 32 L ${cx} 32 Z`} fill={style.border} opacity="0.8" />
              )}

              <text x={cx} y={20} textAnchor="middle" fill="hsl(var(--foreground))" className="font-mono text-[11px] font-bold">
                {node.name}
              </text>
              <text x={cx} y={h - 10} textAnchor="middle" fill="hsl(var(--muted-foreground))" className="font-mono text-[9px]">
                {node.type}
              </text>
              
              {/* Draw pins */}
              {node.pins.map((pin, pinIdx) => {
                const isRight = pinIdx % 2 === 0;
                const py = (h / (node.pins.length + 1)) * (pinIdx + 1);
                return (
                  <g key={pin.name}>
                    <circle 
                      cx={isRight ? w : 0} 
                      cy={py} 
                      r="3" 
                      fill="hsl(var(--background))" 
                      stroke={style.border} 
                      strokeWidth="1.5"
                    />
                    <text 
                      x={isRight ? w - 6 : 6} 
                      y={py + 3} 
                      textAnchor={isRight ? "end" : "start"} 
                      fill="hsl(var(--muted-foreground))" 
                      className="font-mono text-[8px]"
                    >
                      {pin.name}
                    </text>
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
