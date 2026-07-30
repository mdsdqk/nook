import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatMoney } from "@/lib/money/format";
import type { CashFlowPoint } from "@/lib/money/types";

type CashFlowSectionProps = {
  series: CashFlowPoint[];
};

export function CashFlowSection({ series }: CashFlowSectionProps) {
  const recent = series.slice(-3).reverse();

  return (
    <section aria-labelledby="cashflow-heading">
      <Card className="hover:glass-1">
        <CardHeader className="mb-0 items-start">
          <div>
            <CardTitle id="cashflow-heading">Cash Flow</CardTitle>
            <CardDescription>Monthly net cash position.</CardDescription>
          </div>
          <div className="flex flex-col items-end gap-1 text-right">
            {recent.map((point) => (
              <p key={point.month} className="text-body-sm">
                <span className="text-on-surface/50">{point.month}</span>{" "}
                <span className="font-mono text-secondary">
                  +{formatMoney(point.net)}
                </span>
              </p>
            ))}
          </div>
        </CardHeader>
        <CardContent className="mt-4 h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="cashFlowFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4edea3" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#4edea3" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="month"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "rgba(226,226,232,0.45)", fontSize: 12 }}
              />
              <YAxis hide domain={["dataMin - 500", "dataMax + 500"]} />
              <Tooltip
                contentStyle={{
                  background: "#1a1c20",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 8,
                  color: "#e2e2e8",
                }}
                formatter={(value) => [
                  formatMoney(Number(value ?? 0)),
                  "Net",
                ]}
              />
              <Area
                type="monotone"
                dataKey="net"
                stroke="#4edea3"
                strokeWidth={2}
                fill="url(#cashFlowFill)"
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </section>
  );
}
