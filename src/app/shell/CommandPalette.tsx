import { useEffect, useState } from "react";
import { Command } from "cmdk";
import { Plus, Download, Search, Upload } from "@/shared/ui/icons";
import { Trade, Page } from "../types";
import { NAV_ITEMS } from "./navigation";
import { formatPnl, formatShortDate } from "@/domain/tradeCalcs";
import { exportTradesCSV } from "../features/journal/exportCsv";
import { cn } from "@/shared/ui/cn";
import { stripRichText } from "@/shared/richText";
import { useT } from "../i18n/LanguageContext";
import { Modal } from "@/shared/ui";
import { SymbolLogo } from "../trading/SymbolLogo";

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
              stripRichText(tr.notes).toLowerCase().includes(q),
          )
          .slice(0, 8)
      : [];

  /* LA PALETTE — une seule surface centrée, comme la recherche d'une app :
     le champ en tête, les résultats en lignes de même hauteur, les touches
     en pied. Elle se calait en haut à gauche : la fenêtre portait sa propre
     largeur pleine et la palette s'y logeait à gauche, dans un second cadre. */
  return (
    <Modal
      open={open}
      onClose={onClose}
      wrapperClassName="tv-palette-wrap z-[var(--tv-z-sheet)]"
      className="tv-palette"
      focusPanel={false}
    >
      <Command
        label={t("palette.title")}
        shouldFilter={matchingTrades.length === 0}
        className="flex min-h-0 flex-col"
      >
        <div className="tv-palette-input">
          <Search className="h-[18px] w-[18px] shrink-0 text-slate-500" />
          <Command.Input
            value={query}
            onValueChange={setQuery}
            placeholder={t("palette.placeholder")}
            autoFocus
            className="min-w-0 flex-1 bg-transparent text-white placeholder-slate-500 focus:outline-none"
          />
          <kbd className="tv-palette-kbd">esc</kbd>
        </div>
        <Command.List className="tv-palette-list">
          <Command.Empty className="py-10 text-center text-sm text-slate-500">
            {t("palette.noResults")}
          </Command.Empty>

          {matchingTrades.length > 0 && (
            <Command.Group heading={t("common.trades")} className="tv-palette-group">
              {matchingTrades.map((tr) => (
                <Command.Item
                  key={tr.id}
                  value={`trade-${tr.id}`}
                  onSelect={() => run(() => onViewTrade(tr))}
                  className="tv-palette-item"
                >
                  <SymbolLogo symbol={tr.symbol} size="sm" />
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-semibold text-white">{tr.symbol}</span>
                    <span className="tv-num ml-2 text-xs text-slate-500">
                      {formatShortDate(tr.date)}
                      {tr.strategy ? ` · ${tr.strategy}` : ""}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "tv-figure text-[0.8125rem]",
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

          <Command.Group heading={t("palette.actions")} className="tv-palette-group">
            <Command.Item
              value={`${t("common.addTrade")} new trade add`}
              onSelect={() => run(onAddTrade)}
              className="tv-palette-item"
            >
              <span className="tv-palette-icon tv-palette-icon-accent">
                <Plus className="h-4 w-4" />
              </span>
              {t("common.addTrade")}
            </Command.Item>
            <Command.Item
              value={`${t("palette.import")} import csv`}
              onSelect={() => run(onOpenImport)}
              className="tv-palette-item"
            >
              <span className="tv-palette-icon">
                <Upload className="h-4 w-4" />
              </span>
              {t("palette.import")}
            </Command.Item>
            <Command.Item
              value={`${t("common.exportCsv")} export csv download`}
              onSelect={() => run(() => exportTradesCSV(trades))}
              className="tv-palette-item"
            >
              <span className="tv-palette-icon">
                <Download className="h-4 w-4" />
              </span>
              {t("common.exportCsv")}
            </Command.Item>
          </Command.Group>

          <Command.Group heading={t("palette.goTo")} className="tv-palette-group">
            {NAV_ITEMS.map(({ id, labelKey, icon: Icon }) => (
              <Command.Item
                key={id}
                value={`${t(labelKey)} ${id}`}
                onSelect={() => run(() => setPage(id))}
                className="tv-palette-item"
              >
                <span className="tv-palette-icon">
                  <Icon className="h-4 w-4" />
                </span>
                {t(labelKey)}
              </Command.Item>
            ))}
          </Command.Group>
        </Command.List>
        <div className="tv-palette-foot" aria-hidden>
          <span>
            <kbd className="tv-palette-kbd">↑</kbd>
            <kbd className="tv-palette-kbd">↓</kbd>
            {t("palette.navigate")}
          </span>
          <span>
            <kbd className="tv-palette-kbd">↵</kbd>
            {t("palette.open")}
          </span>
          <span>
            <kbd className="tv-palette-kbd">esc</kbd>
            {t("palette.close")}
          </span>
        </div>
      </Command>
    </Modal>
  );
}
