import { useState } from "react";
import { Search, X, ChevronDown, ChevronRight, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ComponentInfo } from "@workspace/api-client-react";

interface LibraryPanelProps {
  components: ComponentInfo[];
  onInsert: (text: string) => void;
}

const CATEGORY_ICONS: Record<string, string> = {
  passive: "⚡",
  active_discrete: "⬡",
  active_ic: "□",
  sensor: "◉",
  module: "▦",
  power: "⌁",
};

const CATEGORY_LABELS: Record<string, string> = {
  passive: "Passives",
  active_discrete: "Transistors & Diodes",
  active_ic: "ICs & Op-Amps",
  sensor: "Sensors",
  module: "Microcontrollers",
  power: "Power",
};

const CATEGORY_ORDER = ["module", "active_ic", "active_discrete", "passive", "sensor", "power"];

function buildInsertText(comp: ComponentInfo): string {
  const id = comp.type.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 4) + "1";
  const hasProps = comp.type === "Resistor" || comp.type === "Capacitor" || comp.type === "LED";
  if (comp.type === "Resistor") {
    return `let ${id} = Component::Resistor { resistance: "10k" };`;
  }
  if (comp.type === "Capacitor") {
    return `let ${id} = Component::Capacitor { capacitance: "100nF" };`;
  }
  if (comp.type === "LED") {
    return `let ${id} = Component::LED { color: "red" };`;
  }
  if (!hasProps) {
    return `let ${id} = Component::${comp.type};`;
  }
  return `let ${id} = Component::${comp.type};`;
}

export function LibraryPanel({ components, onInsert }: LibraryPanelProps) {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    module: true,
    active_ic: false,
    active_discrete: false,
    passive: false,
    sensor: false,
    power: false,
  });

  const filtered = search
    ? components.filter(
        (c) =>
          c.type.toLowerCase().includes(search.toLowerCase()) ||
          c.description.toLowerCase().includes(search.toLowerCase())
      )
    : components;

  const grouped = CATEGORY_ORDER.reduce(
    (acc, cat) => {
      const items = filtered.filter((c) => c.category === cat);
      if (items.length > 0) acc[cat] = items;
      return acc;
    },
    {} as Record<string, ComponentInfo[]>
  );

  const toggleCategory = (cat: string) =>
    setExpanded((prev) => ({ ...prev, [cat]: !prev[cat] }));

  return (
    <div className="flex flex-col h-full" style={{ background: "#0D1117" }}>
      <div className="px-3 py-3 border-b" style={{ borderColor: "#21262D" }}>
        <p className="text-[10px] font-mono uppercase tracking-widest mb-2" style={{ color: "#6E7681" }}>
          Component Library
        </p>
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "#6E7681" }} />
          <Input
            placeholder="Search components..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs font-mono border-0 focus-visible:ring-0"
            style={{ background: "#161B22", color: "#C9D1D9" }}
          />
          {search && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
              onClick={() => setSearch("")}
            >
              <X className="w-3 h-3" style={{ color: "#6E7681" }} />
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {Object.entries(grouped).length === 0 ? (
          <div className="text-center py-8 text-xs font-mono" style={{ color: "#6E7681" }}>
            No components found
          </div>
        ) : (
          Object.entries(grouped).map(([category, comps]) => (
            <div key={category}>
              <button
                onClick={() => toggleCategory(category)}
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[#161B22] transition-colors"
                style={{ borderBottom: "1px solid #21262D" }}
              >
                <span className="text-base">{CATEGORY_ICONS[category]}</span>
                <span className="flex-1 text-xs font-mono font-semibold uppercase tracking-wider" style={{ color: "#8B949E" }}>
                  {CATEGORY_LABELS[category] ?? category}
                </span>
                <Badge
                  className="text-[9px] h-4 px-1.5 rounded-sm font-mono"
                  style={{ background: "#21262D", color: "#6E7681", border: "none" }}
                >
                  {comps.length}
                </Badge>
                {expanded[category] ? (
                  <ChevronDown className="w-3.5 h-3.5" style={{ color: "#6E7681" }} />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" style={{ color: "#6E7681" }} />
                )}
              </button>

              {(expanded[category] || !!search) && (
                <div className="pb-1">
                  {comps.map((comp) => (
                    <div
                      key={comp.type}
                      className="mx-2 my-1 rounded px-2.5 py-2 hover:bg-[#161B22] transition-colors group"
                      style={{ border: "1px solid transparent" }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.borderColor = "#30363D")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.borderColor = "transparent")
                      }
                    >
                      <div className="flex items-start justify-between gap-1 mb-1">
                        <span className="text-xs font-mono font-bold" style={{ color: "#58A6FF" }}>
                          {comp.type}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          {comp.voltageLevel && (
                            <span
                              className="text-[9px] font-mono px-1 rounded"
                              style={{ background: "#1F2937", color: "#F0883E" }}
                            >
                              {comp.voltageLevel}V
                            </span>
                          )}
                          <Button
                            size="icon"
                            className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity rounded"
                            style={{ background: "#1F6FEB", color: "#fff" }}
                            onClick={() => onInsert(buildInsertText(comp))}
                            title="Insert into editor"
                          >
                            <Plus className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                      <p className="text-[10px] mb-1.5 leading-relaxed" style={{ color: "#8B949E" }}>
                        {comp.description}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {comp.pins.slice(0, 6).map((pin) => (
                          <span
                            key={pin.name}
                            className="text-[9px] font-mono px-1 rounded"
                            style={{ background: "#161B22", color: "#6E7681", border: "1px solid #21262D" }}
                            title={`${pin.direction} · ${pin.type}`}
                          >
                            {pin.name}
                          </span>
                        ))}
                        {comp.pins.length > 6 && (
                          <span className="text-[9px] font-mono" style={{ color: "#6E7681" }}>
                            +{comp.pins.length - 6} more
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
