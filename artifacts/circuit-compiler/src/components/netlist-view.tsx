import type { Netlist } from "@workspace/api-client-react";

const FOOTPRINTS: Record<string, string> = {
  Resistor: "R_Axial_DIN0207",
  Capacitor: "C_Disc_D5.0mm",
  Inductor: "L_Axial_L5.3mm",
  LED: "LED_D5.0mm",
  Diode: "D_DO-41",
  ZenerDiode: "D_DO-35",
  SchottkyDiode: "D_DO-35",
  TVSDiode: "D_DO-41",
  NPN: "TO-92_Inline",
  PNP: "TO-92_Inline",
  NMOSFET: "TO-220-3_Vertical",
  PMOSFET: "TO-220-3_Vertical",
  OpAmp741: "DIP-8_W7.62mm",
  OpAmpTL082: "DIP-8_W7.62mm",
  OpAmpLM358: "DIP-8_W7.62mm",
  VoltageRegulator: "TO-220-3_Vertical",
  LDO: "TO-252-2",
  BuckConverter: "Converter_DCDC_7-SMD",
  BoostConverter: "Converter_DCDC_7-SMD",
  LevelShifter: "4xLevelShifter_4ch",
  DHT11: "Sensor:DHT11",
  DHT22: "Sensor:DHT22",
  MPU6050: "QFN-24_4x4mm",
  Ultrasonic: "PinHeader_1x04_P2.54mm",
  ArduinoUno: "Module:Arduino_UNO_R3",
  ArduinoNano: "Module:Arduino_Nano",
  ESP32: "Module:ESP32-WROOM-32",
  ESP8266: "Module:ESP-12E",
  RaspberryPiPico: "Module:RPi_Pico",
  Buzzer: "Buzzer_12x9.5RM7.6",
  Motor: "PinHeader_1x02_P2.54mm",
  Relay: "Relay_SPDT_Pitch5.08mm",
};

const CATEGORY_COLORS: Record<string, string> = {
  passive: "#6b7280",
  active_discrete: "#f59e0b",
  active_ic: "#8b5cf6",
  sensor: "#06b6d4",
  module: "#22c55e",
  power: "#ef4444",
  actuator: "#f97316",
};

function getCompValue(comp: Netlist["components"][number]): string {
  const p = comp.properties ?? {};
  return (
    (p as Record<string, string>)["resistance"] ??
    (p as Record<string, string>)["capacitance"] ??
    (p as Record<string, string>)["inductance"] ??
    (p as Record<string, string>)["model"] ??
    (p as Record<string, string>)["color"] ??
    "—"
  );
}

function getCategoryBadge(category: string) {
  const color = CATEGORY_COLORS[category] ?? "#8B949E";
  return (
    <span
      className="px-1.5 py-0 rounded text-[9px] font-mono"
      style={{ background: `${color}22`, color, border: `1px solid ${color}44` }}
    >
      {category}
    </span>
  );
}

export function NetlistView({ netlist }: { netlist: Netlist }) {
  const powerNets = netlist.nets.filter((n) => n.type === "power");
  const groundNets = netlist.nets.filter((n) => n.type === "ground");
  const signalNets = netlist.nets.filter((n) => n.type === "signal");

  return (
    <div
      className="h-full overflow-auto font-mono text-xs"
      style={{ background: "#0D1117", color: "#C9D1D9" }}
    >
      <div className="p-4 space-y-6">

        {/* ── Components Table ── */}
        <section>
          <div
            className="flex items-center gap-2 mb-2 pb-1 border-b"
            style={{ borderColor: "#21262D" }}
          >
            <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: "#6E7681" }}>
              Components
            </span>
            <span
              className="text-[9px] px-1.5 rounded font-mono"
              style={{ background: "#161B22", color: "#58A6FF", border: "1px solid #30363D" }}
            >
              {netlist.components.length}
            </span>
          </div>
          <table className="w-full border-collapse">
            <thead>
              <tr style={{ color: "#6E7681", borderBottom: "1px solid #21262D" }}>
                <th className="text-left py-1.5 pr-4 font-normal">REF</th>
                <th className="text-left py-1.5 pr-4 font-normal">TYPE</th>
                <th className="text-left py-1.5 pr-4 font-normal">CATEGORY</th>
                <th className="text-left py-1.5 pr-4 font-normal">VALUE</th>
                <th className="text-left py-1.5 font-normal">FOOTPRINT</th>
              </tr>
            </thead>
            <tbody>
              {netlist.components.map((comp, i) => (
                <tr
                  key={i}
                  style={{ borderBottom: "1px solid #161B22" }}
                  className="hover:bg-[#161B22] transition-colors"
                >
                  <td className="py-1.5 pr-4">
                    <span style={{ color: "#58A6FF", fontWeight: "bold" }}>
                      {comp.name.toUpperCase()}
                    </span>
                  </td>
                  <td className="py-1.5 pr-4" style={{ color: "#C9D1D9" }}>
                    {comp.type}
                  </td>
                  <td className="py-1.5 pr-4">
                    {getCategoryBadge(comp.category)}
                  </td>
                  <td className="py-1.5 pr-4" style={{ color: "#F0883E" }}>
                    {getCompValue(comp)}
                  </td>
                  <td className="py-1.5 text-[9px]" style={{ color: "#6E7681" }}>
                    {FOOTPRINTS[comp.type] ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* ── Nets ── */}
        <section>
          <div
            className="flex items-center gap-2 mb-2 pb-1 border-b"
            style={{ borderColor: "#21262D" }}
          >
            <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: "#6E7681" }}>
              Nets
            </span>
            <span
              className="text-[9px] px-1.5 rounded font-mono"
              style={{ background: "#161B22", color: "#58A6FF", border: "1px solid #30363D" }}
            >
              {netlist.nets.length}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {powerNets.map((net, i) => (
              <div
                key={`p-${i}`}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded"
                style={{ background: "#3D0A0A", border: "1px solid #ef444444", color: "#ef4444" }}
              >
                <span>⌁</span>
                <span className="font-bold">{net.name}</span>
                <span className="text-[9px] opacity-70">{net.voltage ?? "?"}V · power</span>
              </div>
            ))}
            {groundNets.map((net, i) => (
              <div
                key={`g-${i}`}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded"
                style={{ background: "#1C1F23", border: "1px solid #6b728044", color: "#6b7280" }}
              >
                <span>⏚</span>
                <span className="font-bold">{net.name}</span>
                <span className="text-[9px] opacity-70">ground</span>
              </div>
            ))}
            {signalNets.map((net, i) => (
              <div
                key={`s-${i}`}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded"
                style={{ background: "#0D2A0D", border: "1px solid #22c55e44", color: "#22c55e" }}
              >
                <span>~</span>
                <span className="font-bold">{net.name}</span>
                <span className="text-[9px] opacity-70">signal</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── Connections ── */}
        <section>
          <div
            className="flex items-center gap-2 mb-2 pb-1 border-b"
            style={{ borderColor: "#21262D" }}
          >
            <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: "#6E7681" }}>
              Connections
            </span>
            <span
              className="text-[9px] px-1.5 rounded font-mono"
              style={{ background: "#161B22", color: "#58A6FF", border: "1px solid #30363D" }}
            >
              {netlist.connections.length}
            </span>
          </div>
          <div className="space-y-1">
            {netlist.connections.map((conn, i) => {
              const net = netlist.nets.find((n) => n.name === conn.net);
              const netColor =
                net?.type === "power" ? "#ef4444"
                : net?.type === "ground" ? "#6b7280"
                : net?.type === "signal" ? "#22c55e"
                : "#60a5fa";
              return (
                <div
                  key={i}
                  className="flex items-center gap-2 px-2 py-1 rounded hover:bg-[#161B22] transition-colors"
                >
                  <span style={{ color: "#58A6FF" }}>
                    {conn.from}
                    <span style={{ color: "#6E7681" }}>.</span>
                    <span style={{ color: "#79C0FF" }}>{conn.fromPin}</span>
                  </span>
                  <span style={{ color: "#3FB950" }}>⟶</span>
                  <span style={{ color: "#58A6FF" }}>
                    {conn.to}
                    <span style={{ color: "#6E7681" }}>.</span>
                    <span style={{ color: "#79C0FF" }}>{conn.toPin}</span>
                  </span>
                  <span className="ml-auto text-[9px] px-1.5 rounded" style={{ color: netColor, background: `${netColor}18`, border: `1px solid ${netColor}33` }}>
                    {conn.net}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

      </div>
    </div>
  );
}
