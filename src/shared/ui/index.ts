/**
 * `shared/ui` — the centralized TradeVault design system.
 *
 * One home for the visual primitives: Typography, Button, form controls, Card,
 * Table, Modal and Badge. Every primitive wraps the styles/tokens the product
 * already uses, so adopting them is drop-in and regression-free.
 *
 * PAS de graphiques ici. `Chart.tsx` réexportait recharts depuis ce baril :
 * comme presque tous les écrans importent `@/shared/ui`, recharts (370 Ko)
 * entrait par un import STATIQUE dans le chunk principal — y compris pour un
 * utilisateur qui n'ouvre jamais une page de graphiques. Les pages qui en ont
 * besoin importent recharts directement, dans leur propre chunk différé.
 *
 * Rule: `shared/ui` never imports from `app/` — these are leaf primitives, so
 * the dependency direction (app → shared) is preserved. Import them as:
 *
 *   import { Button, Card, Modal } from "@/shared/ui";
 */

export { cn } from "./cn";

// Design tokens — the centralized landing theme (typography, color, surface,
// motion). The single reference every primitive and future screen builds on.
export {
  tokens,
  font,
  color,
  accentVar,
  surface,
  radius,
  motion,
  density,
  type,
  // Semantic layer — the seven levels of depth, plus the text/border/elevation,
  // duration, z-index and interaction contracts derived from them.
  level,
  text,
  border,
  elevation,
  duration,
  zIndex,
  behavior,
} from "./tokens";

export { Display, Heading, Text, Label } from "./Typography";

export { Button } from "./Button";
export type { ButtonProps, ButtonVariant, ButtonSize } from "./Button";

export { Input, Textarea, Select, Field, FIELD_BASE } from "./Input";

export { Card, CardHeader, CardTitle, CardBody } from "./Card";
export type { CardVariant, CardPad } from "./Card";

export { PageContainer } from "./PageContainer";

export { Table, THead, TBody, TR, TH, TD, TableScroll } from "./Table";

export { Modal } from "./Modal";
export type { ModalSize } from "./Modal";

export { Badge } from "./Badge";
export type { BadgeVariant } from "./Badge";

export { Chip, RemovableChip, CHIP_BASE, CHIP_ROW } from "./Chip";
export type { ChipTone } from "./Chip";

export { PageHeader, SectionHeader } from "./PageHeader";
export { EmptyState } from "./EmptyState";
export { Metric } from "./Metric";
export type { MetricProps } from "./Metric";
export { StreakCard } from "./StreakCard";
export type { StreakCardProps } from "./StreakCard";
export { StreakCalendar } from "./StreakCalendar";
export type { StreakPeriod } from "./StreakCalendar";
