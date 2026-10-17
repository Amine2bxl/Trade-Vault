/** Valeur civile locale, sans Date ni conversion de fuseau. */
export function parseTimeValue(value: string): { hour: number; minute: number } | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]),
    minute = Number(match[2]);
  return hour < 24 && minute < 60 ? { hour, minute } : null;
}
export function formatTimeValue(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}
/** Les quatre chiffres tapés au clavier deviennent HH:MM, sans arrondi. */
export function normalizeTimeDraft(value: string): string {
  const parsed = value.includes(":") ? parseTimeValue(value) : null;
  if (parsed) return formatTimeValue(parsed.hour, parsed.minute);
  const digits = value.replace(/\D/g, "").slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits;
}
export function minuteOptions(step = 1, selected?: number): number[] {
  const safeStep =
    Number.isFinite(step) && step > 0 ? Math.max(1, Math.min(60, Math.floor(step))) : 1;
  const values = Array.from({ length: Math.ceil(60 / safeStep) }, (_, i) => i * safeStep);
  if (
    selected !== undefined &&
    Number.isInteger(selected) &&
    selected >= 0 &&
    selected < 60 &&
    !values.includes(selected)
  )
    values.push(selected);
  return values.sort((a, b) => a - b);
}
