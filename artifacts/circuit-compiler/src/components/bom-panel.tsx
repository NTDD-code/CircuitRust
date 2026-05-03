import { Download, FileJson, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Netlist } from "@workspace/api-client-react";
import { generateBOM, bomToCSV } from "@/lib/bom";

interface BomPanelProps {
  netlist: Netlist;
}

function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1000);
}

export function BomPanel({ netlist }: BomPanelProps) {
  const items = generateBOM(netlist);
  const total = items.reduce((s, i) => s + i.totalPrice, 0);

  const handleDownloadCSV = () => {
    downloadFile(bomToCSV(items), "bom.csv", "text/csv");
  };

  const handleDownloadJSON = () => {
    downloadFile(JSON.stringify({ bom: items, total: total.toFixed(2) }, null, 2), "netlist.json", "application/json");
  };

  const CATEGORY_COLORS: Record<string, string> = {
    passive: "#6b7280",
    active_discrete: "#f59e0b",
    active_ic: "#8b5cf6",
    sensor: "#06b6d4",
    module: "#22c55e",
    power: "#ef4444",
  };

  return (
    <div className="flex flex-col h-full" style={{ background: "#0D1117" }}>
      <div className="flex items-center justify-between px-4 py-2.5 border-b shrink-0" style={{ borderColor: "#21262D" }}>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: "#6E7681" }}>
            Bill of Materials
          </span>
          <Badge
            className="text-[9px] font-mono px-1.5 py-0 h-4"
            style={{ background: "#1F2937", color: "#8B949E", border: "none" }}
          >
            {items.length} line{items.length !== 1 ? "s" : ""}
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleDownloadCSV}
            className="h-7 px-2.5 font-mono text-[10px] gap-1.5"
            style={{ borderColor: "#30363D", color: "#8B949E", background: "transparent" }}
          >
            <FileText className="w-3 h-3" />
            CSV
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleDownloadJSON}
            className="h-7 px-2.5 font-mono text-[10px] gap-1.5"
            style={{ borderColor: "#30363D", color: "#8B949E", background: "transparent" }}
          >
            <FileJson className="w-3 h-3" />
            JSON
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs font-mono border-collapse">
          <thead>
            <tr style={{ borderBottom: "1px solid #21262D" }}>
              {["#", "Component", "Package", "Qty", "Unit $", "Total $"].map((h) => (
                <th
                  key={h}
                  className="px-3 py-2 text-left text-[10px] uppercase tracking-wider"
                  style={{ color: "#6E7681", background: "#0D1117" }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr
                key={item.type}
                style={{ borderBottom: "1px solid #161B22" }}
                className="hover:bg-[#161B22] transition-colors"
              >
                <td className="px-3 py-2" style={{ color: "#6E7681" }}>
                  {i + 1}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: CATEGORY_COLORS[item.category] ?? "#6E7681" }}
                    />
                    <span style={{ color: "#C9D1D9" }}>{item.type}</span>
                  </div>
                  <div className="text-[9px] mt-0.5" style={{ color: "#6E7681" }}>
                    {item.ref}
                  </div>
                </td>
                <td className="px-3 py-2" style={{ color: "#8B949E" }}>
                  {item.package}
                </td>
                <td className="px-3 py-2 text-center" style={{ color: "#C9D1D9" }}>
                  {item.quantity}
                </td>
                <td className="px-3 py-2" style={{ color: "#8B949E" }}>
                  ${item.unitPrice.toFixed(2)}
                </td>
                <td className="px-3 py-2" style={{ color: "#3FB950" }}>
                  ${item.totalPrice.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: "2px solid #21262D" }}>
              <td colSpan={5} className="px-3 py-2 text-right font-bold uppercase tracking-wider text-[10px]" style={{ color: "#6E7681" }}>
                Estimated Total
              </td>
              <td className="px-3 py-2 font-bold text-sm" style={{ color: "#3FB950" }}>
                ${total.toFixed(2)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
