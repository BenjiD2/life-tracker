import { formatNumber } from '../format';

/** Ring filled to current / target (capped at full), with the numbers in the middle. */
export function ProgressRing({ current, target, color, size = 64 }: { current: number; target: number; color: string; size?: number }) {
  const stroke = 6;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const fraction = target === 0 ? 0 : Math.min(1, current / target);
  return (
    <svg width={size} height={size} role="img" aria-label={`${current} of ${target}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--cell-empty)" strokeWidth={stroke} />
      {fraction > 0 && (
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${fraction * circumference} ${circumference}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      )}
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" fill="var(--text)" fontSize={13} fontWeight={600}>
        {formatNumber(current)}/{formatNumber(target)}
      </text>
    </svg>
  );
}
