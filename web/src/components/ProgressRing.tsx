import { formatNumber } from '../format';

const SIZE = 64;

/** Ring filled to current / target (capped at full), with the numbers in the middle. */
export function ProgressRing({ current, target, color }: { current: number; target: number; color: string }) {
  const stroke = 6;
  const r = (SIZE - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const fraction = target === 0 ? 0 : Math.min(1, current / target);
  return (
    <svg width={SIZE} height={SIZE} role="img" aria-label={`${current} of ${target}`}>
      <circle cx={SIZE / 2} cy={SIZE / 2} r={r} fill="none" stroke="var(--cell-empty)" strokeWidth={stroke} />
      {fraction > 0 && (
        <circle cx={SIZE / 2} cy={SIZE / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${fraction * circumference} ${circumference}`} transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`} />
      )}
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" fill="var(--text)" fontSize={13} fontWeight={600}>
        {formatNumber(current)}/{formatNumber(target)}
      </text>
    </svg>
  );
}
