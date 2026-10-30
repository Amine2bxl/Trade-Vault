import { useMemo, useState } from "react";
import { Plus, Trash2, X } from "@/shared/ui/icons";
import { useAccounts } from "@/app/contexts/AccountContext";
import { useAuth } from "@/app/contexts/AuthContext";
import { useToast } from "@/app/contexts/ToastContext";
import { useT } from "@/app/i18n/LanguageContext";
import { intlLocale } from "@/app/i18n/locale";
import {
  addCashMovement,
  addSnapshot,
  CASH_KINDS,
  deleteCashMovement,
  deleteSnapshot,
  type CashKind,
} from "@/app/store/cashLedger";
import { useCashLedger } from "@/app/trading/useBalanceLedger";
import type { Trade } from "@/app/types";
import { assessDataQuality } from "@/domain/dataQuality";
import { todayLocalDate } from "@/shared/calendar-date";
import { formatMoney, parseCurrency } from "@/shared/currency";
import {
  Badge,
  Button,
  DateField,
  Field,
  Input,
  Modal,
  SelectPicker,
  TimeField,
} from "@/shared/ui";

/**
 * TRÉSORERIE ET QUALITÉ DES DONNÉES du compte actif (lot 1).
 *
 * Le trader y déclare ses mouvements hors trades (dépôts, retraits, payouts…)
 * et les soldes qu'il relève, et y voit ce que les statistiques écartent faute
 * de preuve. Une déclaration reste une déclaration : elle ESTIME un solde
 * historique (PARTIAL), elle ne le prouve pas — seuls un solde observé par le
 * broker ou un relevé le peuvent (`domain/balanceAtEntry`).
 */
export default function AccountLedger({ trades }: { trades: Trade[] }) {
  const { activeAccount } = useAccounts();
  const { user } = useAuth();
  const { t, lang } = useT();
  const { toast } = useToast();
  const { data, loading, invalidate } = useCashLedger();
  const [form, setForm] = useState<"cash" | "snapshot" | null>(null);

  const accountId = activeAccount?.id ?? null;
  const currency = parseCurrency(activeAccount?.currency);
  const cash = data.cash.filter((c) => c.accountId === accountId);
  const snapshots = data.snapshots.filter((s) => s.accountId === accountId);
  const quality = useMemo(
    () =>
      assessDataQuality(
        trades.filter((tr) => tr.accountId === accountId),
        { snapshots, cash },
      ),
    // `snapshots`/`cash` dérivent de `data` et du compte.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [trades, data, accountId],
  );
  const dateFmt = new Intl.DateTimeFormat(intlLocale(lang), {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const money = (n: number) => formatMoney(n, { currency });

  const remove = async (kind: "cash" | "snapshot", id: string) => {
    if (!user) return;
    try {
      await (kind === "cash" ? deleteCashMovement(user.id, id) : deleteSnapshot(user.id, id));
      await invalidate();
    } catch {
      toast(t("ledger.saveFailed"), "error");
    }
  };

  const total = quality.trades;
  const rows: { key: Parameters<typeof t>[0]; n: number }[] = [
    { key: "ledger.q.pending", n: quality.pendingReview },
    { key: "ledger.q.risk", n: quality.riskUnmeasured },
    { key: "ledger.q.fees", n: quality.feesUnknown },
    { key: "ledger.q.clock", n: quality.clockUnproven },
  ];
  const gaps = quality.reconciliation.filter((r) => r.status !== "reconciled");

  return (
    <section className="tv-set-group space-y-4">
      <div>
        <h2 className="tv-set-title">{t("ledger.title")}</h2>
        <p className="tv-prose mt-1 max-w-2xl text-slate-500">{t("ledger.intro")}</p>
      </div>

      {/* ── Ce que les statistiques écartent ── */}
      <div className="tv-set-list p-3.5">
        <p className="tv-label text-slate-500">{t("ledger.qualityTitle")}</p>
        <ul className="mt-2 space-y-1.5">
          {rows.map((r) => (
            <li key={r.key} className="flex items-baseline justify-between gap-3">
              <span className="tv-prose text-slate-300">{t(r.key)}</span>
              <span className="tv-figure text-slate-200">
                {t("ledger.nOf").replace("{n}", String(r.n)).replace("{total}", String(total))}
              </span>
            </li>
          ))}
          <li>
            <span className="tv-prose text-slate-300">{t("ledger.q.balance")}</span>
            <span className="tv-figure mt-0.5 block text-slate-200">
              {t("ledger.balanceSplit")
                .replace("{verified}", String(quality.balance.verified))
                .replace("{partial}", String(quality.balance.partial))
                .replace("{unknown}", String(quality.balance.unknown))}
            </span>
          </li>
        </ul>
        {gaps.length > 0 && (
          <ul className="mt-3 space-y-1 border-t border-[var(--tv-border)] pt-3">
            {gaps.map((g) => (
              <li key={g.from + g.to} className="tv-prose text-amber-300">
                {(g.status === "gap" ? t("ledger.gap") : t("ledger.undetermined"))
                  .replace("{from}", dateFmt.format(new Date(g.from)))
                  .replace("{to}", dateFmt.format(new Date(g.to)))
                  .replace("{gap}", formatMoney(g.gap, { currency, signed: true }))}
              </li>
            ))}
          </ul>
        )}
      </div>

      {!data.available && !loading ? (
        <p className="tv-prose text-slate-500">{t("ledger.unavailable")}</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="ghost" disabled={!accountId} onClick={() => setForm("cash")}>
              <Plus className="h-4 w-4" />
              {t("ledger.addCash")}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={!accountId}
              onClick={() => setForm("snapshot")}
            >
              <Plus className="h-4 w-4" />
              {t("ledger.addSnapshot")}
            </Button>
          </div>

          {cash.length === 0 && snapshots.length === 0 ? (
            <p className="tv-prose text-slate-500">{t("ledger.empty")}</p>
          ) : (
            <ul className="tv-set-list divide-y divide-[var(--tv-border)] px-3.5">
              {[
                ...cash.map((c) => ({
                  id: c.id,
                  kind: "cash" as const,
                  at: c.occurredAt,
                  label: t(`ledger.kind.${c.kind}`),
                  amount: formatMoney(c.amount, { currency, signed: true }),
                  source: c.source,
                })),
                ...snapshots.map((s) => ({
                  id: s.id,
                  kind: "snapshot" as const,
                  at: s.observedAt,
                  label: t("ledger.snapshot"),
                  amount: money(s.balance),
                  source: s.source,
                })),
              ]
                .sort((a, b) => (a.at < b.at ? 1 : -1))
                .map((row) => (
                  <li key={row.kind + row.id} className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-slate-200">{row.label}</p>
                      <p className="tv-prose mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-slate-500">
                        <span>{dateFmt.format(new Date(row.at))}</span>
                        <Badge variant={row.source === "user" ? "neutral" : "accent"}>
                          {t(`ledger.source.${row.source}`)}
                        </Badge>
                      </p>
                    </div>
                    <span className="tv-figure shrink-0 text-slate-100">{row.amount}</span>
                    {row.source === "user" ? (
                      <button
                        type="button"
                        aria-label={t("ledger.delete")}
                        onClick={() => void remove(row.kind, row.id)}
                        className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-white/5 hover:text-red-300"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : (
                      <span className="h-11 w-11 shrink-0" />
                    )}
                  </li>
                ))}
            </ul>
          )}
        </>
      )}

      {form && accountId && user && (
        <LedgerForm
          kind={form}
          onClose={() => setForm(null)}
          onSave={async (input) => {
            try {
              if (form === "cash") {
                await addCashMovement(user.id, {
                  accountId,
                  kind: input.kind,
                  amount: input.amount,
                  occurredAt: input.at,
                  currency,
                  evidence: input.note,
                });
              } else {
                await addSnapshot(user.id, {
                  accountId,
                  balance: input.amount,
                  observedAt: input.at,
                  currency,
                  evidence: input.note,
                });
              }
              await invalidate();
              setForm(null);
            } catch {
              toast(t("ledger.saveFailed"), "error");
            }
          }}
        />
      )}
    </section>
  );
}

interface LedgerInput {
  kind: CashKind;
  amount: number;
  /** Instant ISO : date et heure saisies dans le fuseau de l'appareil. */
  at: string;
  note: string;
}

function LedgerForm({
  kind,
  onClose,
  onSave,
}: {
  kind: "cash" | "snapshot";
  onClose: () => void;
  onSave: (input: LedgerInput) => Promise<void>;
}) {
  const { t, lang } = useT();
  const [cashKind, setCashKind] = useState<CashKind>("deposit");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayLocalDate());
  const [time, setTime] = useState("17:00");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const value = parseFloat(amount.replace(",", "."));
  // Un ajustement exige sa justification (contrainte `cash_ledger_sign`).
  const needsNote = kind === "cash" && cashKind === "adjustment";
  const valid =
    Number.isFinite(value) &&
    (kind === "snapshot" ? value >= 0 : value !== 0) &&
    !!date &&
    /^\d{2}:\d{2}$/.test(time) &&
    (!needsNote || note.trim().length > 0);
  const titleId = "ledger-form-title";

  return (
    <Modal open onClose={saving ? () => {} : onClose} size="sm" labelledBy={titleId}>
      <div className="flex items-start justify-between gap-3 border-b border-[var(--tv-border)] px-5 py-4">
        <div className="min-w-0">
          <h2 id={titleId} className="tv-title leading-tight">
            {kind === "cash" ? t("ledger.addCash") : t("ledger.addSnapshot")}
          </h2>
          <p className="tv-prose mt-1 text-slate-500">
            {kind === "cash" ? t("ledger.cashHint") : t("ledger.snapshotHint")}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("common.close")}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="space-y-3 p-5">
        {kind === "cash" && (
          <Field label={t("ledger.kindLabel")}>
            <SelectPicker
              variant="field"
              label={t("ledger.kindLabel")}
              value={cashKind}
              onChange={setCashKind}
              options={CASH_KINDS.map((k) => ({ value: k, label: t(`ledger.kind.${k}`) }))}
            />
          </Field>
        )}
        <Field
          label={kind === "cash" ? t("ledger.amount") : t("ledger.balance")}
          htmlFor="ledger-amount"
        >
          <Input
            id="ledger-amount"
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="tv-figure"
            placeholder={kind === "cash" && cashKind === "adjustment" ? "-250" : "1000"}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("ledger.date")}>
            <DateField
              value={date}
              onChange={setDate}
              locale={intlLocale(lang)}
              todayLabel={t("common.today")}
              aria-label={t("ledger.date")}
            />
          </Field>
          <Field label={t("ledger.time")}>
            <TimeField
              value={time}
              onChange={setTime}
              locale={intlLocale(lang)}
              aria-label={t("ledger.time")}
            />
          </Field>
        </div>
        <Field
          label={needsNote ? t("ledger.noteRequired") : t("ledger.note")}
          htmlFor="ledger-note"
        >
          <Input
            id="ledger-note"
            value={note}
            maxLength={500}
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>
      </div>
      <div className="flex justify-end gap-2 border-t border-[var(--tv-border)] px-5 py-4">
        <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>
          {t("common.cancel")}
        </Button>
        <Button
          size="sm"
          disabled={!valid || saving}
          onClick={async () => {
            setSaving(true);
            await onSave({
              kind: cashKind,
              amount: value,
              // Date et heure de l'APPAREIL du trader : l'instant est exact
              // pour lui, quel que soit le fuseau du serveur.
              at: new Date(`${date}T${time}:00`).toISOString(),
              note,
            });
            setSaving(false);
          }}
        >
          {t("common.save")}
        </Button>
      </div>
    </Modal>
  );
}
