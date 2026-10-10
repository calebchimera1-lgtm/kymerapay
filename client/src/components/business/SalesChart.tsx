import { formatMoney, type SalesDay } from '@app/shared';
import { useId, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts';
import { formatShortDay } from '@/utils/dates';

interface Point {
  date: string;
  /** Plotting only — labels always use the exact server strings. */
  sales: number;
  label: string;
  transactions: number;
}

const compact = new Intl.NumberFormat('en-KE', { notation: 'compact', maximumFractionDigits: 1 });

/** Daily sales, one series: no legend box (the card title names it), hover tooltip, table view. */
export function SalesChart({ days, title }: { days: SalesDay[]; title: string }) {
  const [showTable, setShowTable] = useState(false);
  const tableId = useId();
  const data: Point[] = days.map((day) => ({
    date: day.date,
    sales: Number(day.sales),
    label: day.sales,
    transactions: day.transactions,
  }));
  const withSales = days.filter((day) => day.transactions > 0);

  return (
    <figure className="space-y-3">
      <div className="flex justify-end">
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
        aria-label={`${title}: ${withSales.length} days with sales.`}
        className="h-56 sm:h-64"
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
            barCategoryGap="22%"
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
              tickFormatter={(value: number) => compact.format(value)}
              tick={{ fill: 'var(--fg-muted)', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              cursor={{ fill: 'var(--surface-muted)' }}
              content={(props) => (
                <SalesTooltip {...(props as TooltipContentProps<number, string>)} />
              )}
            />
            <Bar dataKey="sales" fill="var(--chart-in)" radius={[4, 4, 0, 0]} maxBarSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      {showTable && (
        <div id={tableId} className="overflow-x-auto">
          {withSales.length === 0 ? (
            <p className="py-2 text-sm text-fg-muted">No sales in this period yet.</p>
          ) : (
            <table className="w-full text-sm">
              <caption className="sr-only">{title}</caption>
              <thead>
                <tr className="text-left text-xs text-fg-muted">
                  <th scope="col" className="py-2 font-medium">
                    Day
                  </th>
                  <th scope="col" className="py-2 text-right font-medium">
                    Payments
                  </th>
                  <th scope="col" className="py-2 text-right font-medium">
                    Sales
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border tabular-nums">
                {withSales.map((day) => (
                  <tr key={day.date}>
                    <th scope="row" className="py-2 text-left font-medium">
                      {formatShortDay(day.date)}
                    </th>
                    <td className="py-2 text-right">{day.transactions}</td>
                    <td className="py-2 text-right">{formatMoney(day.sales)}</td>
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

function SalesTooltip({ active, payload }: TooltipContentProps<number, string>) {
  const point = payload?.[0]?.payload as Point | undefined;
  if (!active || !point) return null;
  return (
    <div className="rounded-xl border border-border bg-surface px-3 py-2 text-xs shadow-raised">
      <p className="mb-1 font-semibold">{formatShortDay(point.date)}</p>
      <p className="font-semibold text-fg tabular-nums">{formatMoney(point.label)}</p>
      <p className="text-fg-muted">
        {point.transactions} payment{point.transactions === 1 ? '' : 's'}
      </p>
    </div>
  );
}
