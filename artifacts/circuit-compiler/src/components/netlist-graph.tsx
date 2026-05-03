import type { Netlist } from "@workspace/api-client-react";

const compWidth = 100;
const compHeight = 60;
const paddingX = 180;
const paddingY = 120;

function getPinPos(
  nodes: Array<ReturnType<typeof buildNodes>[number]>,
  compId: string,
  pinName: string
) {
  const node = nodes.find((n) => n.id === compId);
  if (!node) return { x: 0, y: 0 };
  const pinIdx = node.pins.findIndex((p) => p.name === pinName);
  const totalPins = node.pins.length;
  const isRight = pinIdx % 2 === 0;
  const w = node.category === "module" ? compWidth + 20 : compWidth;
  const h = node.category === "module" ? compHeight + 20 : compHeight;
  return {
    x: node.x + (isRight ? w : 0),
    y: node.y + (h / (totalPins + 1)) * (pinIdx + 1),
  };
}

function buildNodes(netlist: Netlist) {
  const cols = Math.max(2, Math.ceil(Math.sqrt(netlist.components.length)));
  return netlist.components.map((comp, idx) => ({
    ...comp,
    x: (idx % cols) * paddingX + 60,
    y: Math.floor(idx / cols) * paddingY + 60,
  }));
}

function getNetColor(netType: string) {
  switch (netType) {
    case "power": return "#ef4444";
    case "ground": return "#6b7280";
    case "signal": return "#22c55e";
    default: return "#60a5fa";
  }
}

function getCategoryStyle(category: string) {
  switch (category) {
    case "passive": return { border: "#6b7280", fill: "#161B22" };
    case "active_discrete": return { border: "#f59e0b", fill: "#161B22" };
    case "active_ic": return { border: "#8b5cf6", fill: "#161B22" };
    case "sensor": return { border: "#06b6d4", fill: "#161B22" };
    case "module": return { border: "#22c55e", fill: "#161B22" };
    case "power": return { border: "#ef4444", fill: "#161B22" };
    default: return { border: "#30363D", fill: "#161B22" };
  }
}

function getCategorySymbol(category: string) {
  switch (category) {
    case "passive": return "~";
    case "active_discrete": return "▶";
    case "active_ic": return "△";
    case "sensor": return "◉";
    case "module": return "▦";
    case "power": return "⌁";
    default: return "□";
  }
}

export function NetlistGraph({ netlist }: { netlist: Netlist }) {
  const nodes = buildNodes(netlist);

  return (
    <div className="w-full h-full overflow-auto relative p-4" style={{ animation: "fadeIn 0.7s" }}>
      <svg className="min-w-[800px] min-h-[500px] w-full h-full" style={{ overflow: "visible" }}>
        <defs>
          <pattern id="gridpat" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#21262D" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#gridpat)" opacity="0.5" />

        {netlist.connections.map((conn, idx) => {
          const fromPos = getPinPos(nodes, conn.from, conn.fromPin);
          const toPos = getPinPos(nodes, conn.to, conn.toPin);
          const net = netlist.nets.find((n) => n.name === conn.net);
          const color = getNetColor(net?.type ?? "signal");
          const dx = Math.abs(toPos.x - fromPos.x) * 0.5;
          const d = `M ${fromPos.x} ${fromPos.y} C ${fromPos.x + dx} ${fromPos.y}, ${toPos.x - dx} ${toPos.y}, ${toPos.x} ${toPos.y}`;
          return (
            <path
              key={`conn-${idx}`}
              d={d}
              fill="none"
              stroke={color}
              strokeWidth="2"
              opacity="0.7"
              strokeLinecap="round"
            >
              <title>{conn.net} ({net?.type ?? "signal"}): {conn.from}.{conn.fromPin} → {conn.to}.{conn.toPin}</title>
            </path>
          );
        })}

        {nodes.map((node) => {
          const style = getCategoryStyle(node.category);
          const isModule = node.category === "module";
          const w = isModule ? compWidth + 20 : compWidth;
          const h = isModule ? compHeight + 20 : compHeight;
          const cx = w / 2;
          const sym = getCategorySymbol(node.category);

          return (
            <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
              <rect
                width={w}
                height={h}
                rx={node.category === "sensor" ? 16 : 4}
                fill={style.fill}
                stroke={style.border}
                strokeWidth={isModule ? 3 : 2}
              />
              <text
                x={cx}
                y={h / 2 - 6}
                textAnchor="middle"
                fontSize="11"
                fontFamily="JetBrains Mono, monospace"
                fontWeight="700"
                fill="#C9D1D9"
              >
                {node.id}
              </text>
              <text
                x={cx}
                y={h / 2 + 7}
                textAnchor="middle"
                fontSize="9"
                fontFamily="JetBrains Mono, monospace"
                fill={style.border}
              >
                {node.type}
              </text>
              <text
                x={w - 6}
                y={12}
                textAnchor="end"
                fontSize="10"
                fill={style.border}
                opacity="0.8"
              >
                {sym}
              </text>
              {node.pins.map((pin, pi) => {
                const isRight = pi % 2 === 0;
                const py = (h / (node.pins.length + 1)) * (pi + 1);
                const dotX = isRight ? w : 0;
                return (
                  <g key={pin.name}>
                    <circle cx={dotX} cy={py} r={3} fill={style.border} opacity="0.9">
                      <title>{pin.name} ({pin.direction})</title>
                    </circle>
                    <text
                      x={isRight ? w + 4 : -4}
                      y={py + 3}
                      textAnchor={isRight ? "start" : "end"}
                      fontSize="7.5"
                      fontFamily="JetBrains Mono, monospace"
                      fill="#6E7681"
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

      <div
        className="absolute bottom-4 right-4 p-2 rounded text-[9px] font-mono space-y-1"
        style={{ background: "#161B22AA", border: "1px solid #21262D", backdropFilter: "blur(4px)" }}
      >
        {[
          { color: "#ef4444", label: "Power" },
          { color: "#6b7280", label: "Ground" },
          { color: "#22c55e", label: "Signal" },
          { color: "#60a5fa", label: "Other" },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className="w-4 h-0.5 rounded" style={{ background: color }} />
            <span style={{ color: "#8B949E" }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
