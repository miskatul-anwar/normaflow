/**
 * One figure with a label. Every summary strip on the Output page uses this, so they all look alike:
 * a neutral card, the number in ink, and a small dot that carries the meaning (good / watch / problem).
 */
export type Tone = 'good' | 'watch' | 'bad' | 'info' | 'neutral';

const DOT: Record<Tone, string> = {
  good: 'bg-green-500',
  watch: 'bg-amber-500',
  bad: 'bg-red-500',
  info: 'bg-blue-500',
  neutral: 'bg-gray-300',
};

export function StatCard({ label, value, note, tone = 'neutral' }: { label: string; value: React.ReactNode; note?: string; tone?: Tone }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
        <span className={`size-2 shrink-0 rounded-full ${DOT[tone]}`} aria-hidden />
        {label}
      </div>
      <div className="mt-1.5 text-2xl font-semibold tabular-nums text-gray-900">{value}</div>
      {note && <div className="mt-0.5 text-xs text-gray-500">{note}</div>}
    </div>
  );
}
