/**
 * `shared/ui` — the centralized TradeVault design system.
 *
 * One home for the visual primitives: Typography, Button, form controls, Card,
 * Table, Modal, Badge and Charts. Every primitive wraps the styles/tokens the
 * product already uses, so adopting them is drop-in and regression-free.
 *
 * Rule: `shared/ui` never imports from `app/` — these are leaf primitives, so
 * the dependency direction (app → shared) is preserved. Import them as:
 *
 *   import { Button, Card, Modal } from "@/shared/ui";
 */

export { cn } from "./cn";

// Design tokens — the centralized landing theme (typography, color, surface,
// motion). The single reference every primitive and future screen builds on.
export { tokens, font, color, accentVar, surface, radius, motion } from "./tokens";

export { Display, Heading, Text, Label } from "./Typography";

export { Button } from "./Button";
export type { ButtonProps, ButtonVariant, ButtonSize } from "./Button";

export { Input, Textarea, Select, Field, FIELD_BASE } from "./Input";

export { Card, CardHeader, CardTitle, CardBody } from "./Card";
export type { CardVariant } from "./Card";

export { Table, THead, TBody, TR, TH, TD, TableScroll } from "./Table";

export { Modal } from "./Modal";
export type { ModalSize } from "./Modal";

export { Badge } from "./Badge";
export type { BadgeVariant } from "./Badge";

export { ChartContainer } from "./Chart";
