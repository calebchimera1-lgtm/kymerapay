import { formatMoney, type WalletSummary } from '@app/shared';
import { useId, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts';
import { formatShortDay } from '@/utils/dates';

interface Point {
  date: string;
  /** Plotting only — display values always come from the original strings. */
  moneyIn: number;
  moneyOut: number;
  inLabel: string;
  outLabel: string;
}

const compact = new Intl.NumberFormat('en-KE', { notation: 'compact', maximumFractionDigits: 1 });

/**
 * Diverging daily bars: money in above the baseline, money out below it.
 * Position (above/below) is the primary encoding, so direction never relies on
 * colour alone; the legend and tooltip name each series in words.
 */
export function CashflowChart({ summary }: { summary: WalletSummary }) {
  const [showTable, setShowTable] = useState(false);
  const tableId = useId();
  const data: Point[] = summary.daily.map((day) => ({
    date: day.date,
    moneyIn: Number(day.moneyIn),
    moneyOut: -Number(day.moneyOut),
    inLabel: day.moneyIn,
    outLabel: day.moneyOut,
  }));
  const activeDays = summary.daily.filter(
    (day) => day.moneyIn !== '0.00' || day.moneyOut !== '0.00',
  );

  return (
    <figure className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ul className="flex items-center gap-4 text-xs text-fg-muted" aria-label="Legend">
          <li className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-chart-in" aria-hidden="true" /> Money in (above)
          </li>
          <li className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-chart-out" aria-hidden="true" /> Money out
            (below)
          </li>
        </ul>
        <button
          type="button"
          aria-expanded={showTable}
          aria-controls={tableId}
          onClick={() => setShowTable((value) => !value)}
          className="text-xs font-semibold text-primary hover:underline"
        >
          {showTable ? 'Hide table' : 'View as table'}
        </button>
      </div>

      <div
        role="img"
        aria-label={`Daily money in and out over the last ${summary.periodDays} days. In: ${formatMoney(summary.moneyIn)}. Out: ${formatMoney(summary.moneyOut)}.`}
        className="h-52 sm:h-60"
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            stackOffset="sign"
            margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
            barCategoryGap="20%"
          >
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis
              dataKey="date"
              tickFormatter={formatShortDay}
              tick={{ fill: 'var(--fg-muted)', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
              minTickGap={24}
            />
            <YAxis
              width={44}
              tickFormatter={(value: number) => compact.format(Math.abs(value))}
              tick={{ fill: 'var(--fg-muted)', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <ReferenceLine y={0} stroke="var(--border-strong)" />
            <Tooltip
              cursor={{ fill: 'var(--surface-muted)' }}
              content={(props) => (
                <ChartTooltip {...(props as TooltipContentProps<number, string>)} />
              )}
            />
            <Bar
              dataKey="moneyIn"
              stackId="flow"
              fill="var(--chart-in)"
              radius={[4, 4, 0, 0]}
              maxBarSize={14}
            />
            <Bar
              dataKey="moneyOut"
              stackId="flow"
              fill="var(--chart-out)"
              radius={[0, 0, 4, 4]}
              maxBarSize={14}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {showTable && (
        <div id={tableId} className="overflow-x-auto">
          {activeDays.length === 0 ? (
            <p className="py-2 text-sm text-fg-muted">No money moved in this period.</p>
          ) : (
            <table className="w-full text-sm">
              <caption className="sr-only">Daily money in and out</caption>
              <thead>
                <tr className="text-left text-xs text-fg-muted">
                  <th scope="col" className="py-2 font-medium">
                    Day
                  </th>
                  <th scope="col" className="py-2 text-right font-medium">
                    In
                  </th>
                  <th scope="col" className="py-2 text-right font-medium">
                    Out
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border tabular-nums">
                {activeDays.map((day) => (
                  <tr key={day.date}>
                    <th scope="row" className="py-2 text-left font-medium">
                      {formatShortDay(day.date)}
                    </th>
                    <td className="py-2 text-right">{formatMoney(day.moneyIn)}</td>
                    <td className="py-2 text-right">{formatMoney(day.moneyOut)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </figure>
  );
}

function ChartTooltip({ active, payload }: TooltipContentProps<number, string>) {
  const point = payload?.[0]?.payload as Point | undefined;
  if (!active || !point) return null;
  return (
    <div className="rounded-xl border border-border bg-surface px-3 py-2 text-xs shadow-raised">
      <p className="mb-1 font-semibold">{formatShortDay(point.date)}</p>
      <p className="flex items-center gap-1.5 text-fg">
        <span className="size-2 rounded-sm bg-chart-in" aria-hidden="true" /> In
        <span className="ml-auto pl-3 font-semibold tabular-nums">
          {formatMoney(point.inLabel)}
        </span>
      </p>
      <p className="flex items-center gap-1.5 text-fg">
        <span className="size-2 rounded-sm bg-chart-out" aria-hidden="true" /> Out
        <span className="ml-auto pl-3 font-semibold tabular-nums">
          {formatMoney(point.outLabel)}
        </span>
      </p>
    </div>
  );
}
