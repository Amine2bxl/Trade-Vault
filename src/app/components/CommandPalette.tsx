import { useEffect, useState } from "react";
import { Command } from "cmdk";
import { Plus, Download, Search, Upload } from "lucide-react";
import { Trade, Page } from "../types";
import { NAV_ITEMS } from "../navigation";
import { formatPnl, formatShortDate } from "../utils/tradeCalcs";
import { exportTradesCSV } from "../utils/exportCsv";
import { cn } from "../utils/cn";
import { useT } from "../i18n/LanguageContext";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  trades: Trade[];
  setPage: (p: Page) => void;
  onAddTrade: () => void;
  onOpenImport: () => void;
  onViewTrade: (trade: Trade) => void;
}

export default function CommandPalette({
  open,
  onClose,
  trades,
  setPage,
  onAddTrade,
  onOpenImport,
  onViewTrade,
}: CommandPaletteProps) {
  const { t } = useT();
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  if (!open) return null;

  const run = (fn: () => void) => {
    onClose();
    fn();
  };

  // Trade search only kicks in once the user types (keeps the default list short)
  const q = query.trim().toLowerCase();
  const matchingTrades =
    q.length >= 1
      ? trades
          .filter(
            (tr) =>
              tr.symbol.toLowerCase().includes(q) ||
              tr.strategy.toLowerCase().includes(q) ||
              tr.notes.toLowerCase().includes(q),
          )
          .slice(0, 8)
      : [];

  const itemClass =
    "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-300 cursor-pointer data-[selected=true]:bg-cyan-500/10 data-[selected=true]:text-white transition-colors";

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center pt-[12vh] px-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <Command
        label={t("palette.title")}
        shouldFilter={matchingTrades.length === 0}
        className="relative glass-strong rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl shadow-black/60 animate-slide-in border border-cyan-500/15"
      >
        <div className="flex items-center gap-2.5 px-4 border-b border-white/[0.06]">
          <Search className="w-4 h-4 text-cyan-400/70 shrink-0" />
          <Command.Input
            value={query}
            onValueChange={setQuery}
            placeholder={t("palette.placeholder")}
            autoFocus
            className="flex-1 bg-transparent py-3.5 text-sm text-white placeholder-slate-500 focus:outline-none"
          />
          <kbd className="hidden md:inline text-[9px] font-bold text-slate-600 border border-white/[0.08] rounded px-1.5 py-0.5">
            ESC
          </kbd>
        </div>
        <Command.List className="max-h-[50vh] overflow-y-auto p-2">
          <Command.Empty className="py-8 text-center text-sm text-slate-500">
            {t("palette.noResults")}
          </Command.Empty>

          {matchingTrades.length > 0 && (
            <Command.Group
              heading={t("common.trades")}
              className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[9px] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-slate-500"
            >
              {matchingTrades.map((tr) => (
                <Command.Item
                  key={tr.id}
                  value={`trade-${tr.id}`}
                  onSelect={() => run(() => onViewTrade(tr))}
                  className={itemClass}
                >
                  <span
                    className={cn(
                      "w-1.5 h-1.5 rounded-full shrink-0",
                      tr.direction === "be"
                        ? "bg-slate-400"
                        : tr.pnl >= 0
                          ? "bg-emerald-400"
                          : "bg-red-400",
                    )}
                  />
                  <span className="font-bold text-white">{tr.symbol}</span>
                  <span className="text-[10px] text-slate-500">
                    {formatShortDate(tr.date)} · {tr.strategy}
                  </span>
                  <span
                    className={cn(
                      "ml-auto text-xs font-bold tabular-nums",
                      tr.direction === "be"
                        ? "text-slate-300"
                        : tr.pnl >= 0
                          ? "text-emerald-400"
                          : "text-red-400",
                    )}
                  >
                    {formatPnl(tr.pnl)}
                  </span>
                </Command.Item>
              ))}
            </Command.Group>
          )}

          <Command.Group
            heading={t("palette.actions")}
            className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[9px] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-slate-500"
          >
            <Command.Item
              value={`${t("common.addTrade")} new trade add`}
              onSelect={() => run(onAddTrade)}
              className={itemClass}
            >
              <Plus className="w-4 h-4 text-cyan-400" /> {t("common.addTrade")}
            </Command.Item>
            <Command.Item
              value={`${t("palette.import")} import csv`}
              onSelect={() => run(onOpenImport)}
              className={itemClass}
            >
              <Upload className="w-4 h-4 text-cyan-400" /> {t("palette.import")}
            </Command.Item>
            <Command.Item
              value={`${t("common.exportCsv")} export csv download`}
              onSelect={() => run(() => exportTradesCSV(trades))}
              className={itemClass}
            >
              <Download className="w-4 h-4 text-cyan-400" /> {t("common.exportCsv")}
            </Command.Item>
          </Command.Group>

          <Command.Group
            heading={t("palette.goTo")}
            className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[9px] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-slate-500"
          >
            {NAV_ITEMS.map(({ id, labelKey, icon: Icon }) => (
              <Command.Item
                key={id}
                value={`${t(labelKey)} ${id}`}
                onSelect={() => run(() => setPage(id))}
                className={itemClass}
              >
                <span className="text-slate-500">
                  <Icon className="w-4 h-4" />
                </span>{" "}
                {t(labelKey)}
              </Command.Item>
            ))}
          </Command.Group>
        </Command.List>
      </Command>
    </div>
  );
}
