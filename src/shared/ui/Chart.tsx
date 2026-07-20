import type { ReactElement } from "react";
import { ResponsiveContainer } from "recharts";
import { cn } from "./cn";

/**
 * Charts — one import surface for the app's charting. Rather than duplicate the
 * chart theme (which already lives in a single place, `app/utils/chartTheme`,
 * and is imported by every chart), this centralizes the *container*: the
 * responsive wrapper + a consistent default height, so charts size uniformly.
 *
 * Recharts primitives are re-exported here so feature code imports charts from
 * one module. Visual theming (animation, tooltip, equity line, axes) stays in
 * `app/utils/chartTheme` — the existing single source of truth.
 */

export {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
  ReferenceLine,
  PieChart,
  Pie,
} from "recharts";

/**
 * ChartContainer — responsive wrapper with a default height. Pass a single
 * recharts chart element as `children` (ResponsiveContainer's contract).
 */
export function ChartContainer({
  height = 260,
  className,
  children,
}: {
  height?: number;
  className?: string;
  children: ReactElement;
}) {
  return (
    <div className={cn("w-full", className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}
