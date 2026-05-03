import { getHealthColor, getHealthLabel } from "@/lib/health-score";

const R  = 15;
const SW = 3;
const SZ = (R + SW) * 2 + 2;
const C  = 2 * Math.PI * R;

interface HealthGaugeProps {
  score: number;
  compact?: boolean;
}

export function HealthGauge({ score, compact = false }: HealthGaugeProps) {
  const clamped = Math.max(0, Math.min(100, score));
  const color   = getHealthColor(clamped);
  const label   = getHealthLabel(clamped);
  const offset  = C * (1 - clamped / 100);
  const cx = SZ / 2;
  const cy = SZ / 2;

  return (
    <div
      className="flex items-center gap-2 px-2.5 py-1 rounded-md"
      style={{
        background:   `${color}11`,
        border:       `1px solid ${color}33`,
        transition:   "background 0.5s, border-color 0.5s",
      }}
    >
      {/* SVG ring */}
      <div className="relative shrink-0" style={{ width: SZ, height: SZ }}>
        <svg width={SZ} height={SZ}>
          <circle
            cx={cx} cy={cy} r={R}
            fill="none"
            stroke="#21262D"
            strokeWidth={SW}
          />
          <circle
            cx={cx} cy={cy} r={R}
            fill="none"
            stroke={color}
            strokeWidth={SW}
            strokeLinecap="round"
            strokeDasharray={`${C} ${C}`}
            strokeDashoffset={offset}
            transform={`rotate(-90 ${cx} ${cy})`}
            style={{ transition: "stroke-dashoffset 0.6s cubic-bezier(.4,0,.2,1), stroke 0.5s" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="font-mono font-bold leading-none"
            style={{ color, fontSize: "9px" }}
          >
            {clamped}
          </span>
        </div>
      </div>

      {!compact && (
        <div className="flex flex-col leading-none gap-px">
          <span
            className="font-mono font-bold text-[9px] uppercase tracking-wider"
            style={{ color, transition: "color 0.5s" }}
          >
            {label}
          </span>
          <span className="font-mono text-[8px]" style={{ color: "#6E7681" }}>
            circuit health
          </span>
        </div>
      )}
    </div>
  );
}
