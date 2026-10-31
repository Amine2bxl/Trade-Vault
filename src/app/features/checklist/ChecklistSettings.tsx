import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Plus, RotateCcw, X } from "@/shared/ui/icons";
import {
  Button,
  Chip,
  CHIP_ROW,
  Field,
  Input,
  Modal,
  SelectPicker,
  TimeField,
  Toggle,
} from "@/shared/ui";
import { useT } from "@/app/i18n/LanguageContext";
import { intlLocale } from "@/app/i18n/locale";
import type { TKey } from "@/app/i18n/translations";
import {
  type ChkConfig,
  type ChkItem,
  GATE_TEMPLATES,
  type GateTemplateId,
  isItemOn,
  templateItems,
} from "./checklistDefaults";
import { getTimeZoneOptions } from "./helpers";
import { GATE_TOKENS } from "./sessionPlan";

/**
 * Les réglages de la checklist — hors de l'écran de séance.
 *
 * Deux choses se règlent : la fenêtre de séance et les questions d'entrée.
 * Chaque question est éditable, activable, déplaçable ; un modèle (Essentiel,
 * ICT, price action, order flow) sert de point de départ. Les variables
 * ({entry}, {inv}…) sont remplacées par le plan du jour : c'est ce qui garde
 * une question vivante. Tout ce que l'application lit elle-même (trades du
 * jour, pertes, news) n'a pas à devenir une question — le panneau le dit.
 */

const TEMPLATE_KEYS: Record<GateTemplateId, TKey> = {
  essential: "chk.tplEssential",
  ict: "chk.tplIct",
  priceAction: "chk.tplPriceAction",
  orderFlow: "chk.tplOrderFlow",
};

interface Props {
  open: boolean;
  onClose: () => void;
  config: ChkConfig;
  onPatch: (patch: Partial<ChkConfig>) => void;
  onResetDay: () => void;
  onResetConfig: () => void;
}

export default function ChecklistSettings({
  open,
  onClose,
  config,
  onPatch,
  onResetDay,
  onResetConfig,
}: Props) {
  const { t, lang } = useT();
  const [draft, setDraft] = useState("");
  const tzOptions = useMemo(getTimeZoneOptions, []);

  const setItems = (items: ChkItem[]) => onPatch({ items });
  const add = () => {
    const title = draft.trim();
    if (!title) return;
    setItems([...config.items, { title, desc: "" }]);
    setDraft("");
  };
  const move = (i: number, by: -1 | 1) => {
    const j = i + by;
    if (j < 0 || j >= config.items.length) return;
    const items = config.items.slice();
    [items[i], items[j]] = [items[j], items[i]];
    setItems(items);
  };
  const active = config.items.filter(isItemOn).length;

  return (
    <Modal open={open} onClose={onClose} size="sm" labelledBy="chk-settings-title">
      <div className="space-y-5 p-4 md:p-5">
        <header className="flex items-center gap-2">
          <h2 id="chk-settings-title" className="tv-title flex-1">
            {t("chk.settings")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close")}
            className="tv-chk-tool"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <section className="space-y-2">
          <h3 className="tv-label text-slate-500">{t("chk.setWindow")}</h3>
          <div className="grid grid-cols-2 gap-2">
            <Field label={t("chk.setStart")}>
              <TimeField
                value={config.startTime}
                onChange={(v) => v && onPatch({ startTime: v })}
                locale={intlLocale(lang)}
                doneLabel={t("common.done")}
                aria-label={t("chk.setStart")}
                className="w-full"
              />
            </Field>
            <Field label={t("chk.setTz")}>
              <SelectPicker
                variant="field"
                label={t("chk.setTz")}
                value={config.timeZone}
                onChange={(v) => onPatch({ timeZone: v })}
                className="w-full"
                width="16rem"
                searchLabel={t("picker.search")}
                options={tzOptions.map((z) => ({ value: z, label: z.replace(/_/g, " ") }))}
              />
            </Field>
          </div>
        </section>

        <section className="space-y-2.5">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="tv-label text-slate-500">{t("chk.setCriteria")}</h3>
            <span className="tv-num text-xs text-slate-500">
              {active}/{config.items.length}
            </span>
          </div>
          <p className="tv-prose text-slate-500">{t("chk.setCriteriaHint")}</p>

          <div className="space-y-1.5">
            <span className="tv-label text-slate-500">{t("chk.setTemplates")}</span>
            <div className={CHIP_ROW}>
              {GATE_TEMPLATES.map((id) => (
                <Chip key={id} onClick={() => setItems(templateItems(id, lang))}>
                  {t(TEMPLATE_KEYS[id])}
                </Chip>
              ))}
            </div>
            <p className="tv-prose text-slate-500">{t("chk.setTemplateHint")}</p>
          </div>

          <ul className="space-y-1.5">
            {config.items.map((it, i) => (
              <li key={i} className="flex items-center gap-1.5">
                <Toggle
                  on={isItemOn(it)}
                  label={t("chk.setEnable")}
                  onChange={(on) =>
                    setItems(config.items.map((x, k) => (k === i ? { ...x, enabled: on } : x)))
                  }
                />
                <Input
                  value={it.title}
                  aria-label={t("chk.setCriteria")}
                  onChange={(e) =>
                    setItems(
                      config.items.map((x, k) => (k === i ? { ...x, title: e.target.value } : x)),
                    )
                  }
                  className="min-w-0 flex-1"
                />
                <div className="flex shrink-0 flex-col">
                  <button
                    type="button"
                    aria-label={t("chk.setUp")}
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                    className="tv-chk-tool h-5 disabled:opacity-30"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label={t("chk.setDown")}
                    disabled={i === config.items.length - 1}
                    onClick={() => move(i, 1)}
                    className="tv-chk-tool h-5 disabled:opacity-30"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                </div>
                <button
                  type="button"
                  aria-label={t("chk.setRemove")}
                  onClick={() => setItems(config.items.filter((_, k) => k !== i))}
                  className="tv-chk-tool"
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>

          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              add();
            }}
          >
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={t("chk.setAddPh")}
              aria-label={t("chk.setAddPh")}
              className="min-w-0 flex-1"
            />
            <Button type="submit" variant="subtle" disabled={!draft.trim()}>
              <Plus className="h-4 w-4" /> {t("common.add")}
            </Button>
          </form>

          {/* Les variables s'insèrent d'un clic dans la question en cours d'écriture. */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="tv-label text-slate-500">{t("chk.setTokens")}</span>
            {GATE_TOKENS.map((tok) => (
              <button
                key={tok}
                type="button"
                onClick={() => setDraft((d) => `${d}${d && !d.endsWith(" ") ? " " : ""}{${tok}}`)}
                className="tv-figure rounded-md border border-[var(--tv-border)] bg-[var(--tv-plate-2)] px-1.5 py-0.5 text-xs text-slate-300 hover:border-[var(--tv-border-strong)]"
              >
                {`{${tok}}`}
              </button>
            ))}
          </div>
          <p className="tv-prose text-slate-500">{t("chk.setTokensHint")}</p>
          <p className="tv-prose text-slate-500">{t("chk.setAuto")}</p>
        </section>

        <footer className="flex flex-wrap gap-2 border-t border-[var(--tv-border)] pt-4">
          <Button variant="subtle" size="sm" onClick={onResetDay}>
            <RotateCcw className="h-3.5 w-3.5" /> {t("chk.setResetDay")}
          </Button>
          <Button variant="danger" size="sm" onClick={onResetConfig}>
            {t("chk.setResetCfg")}
          </Button>
        </footer>
      </div>
    </Modal>
  );
}
