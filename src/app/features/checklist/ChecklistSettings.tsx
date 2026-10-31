import { useMemo, useState } from "react";
import { Plus, RotateCcw, X } from "@/shared/ui/icons";
import { Button, Field, Input, Modal, SelectPicker, TimeField, Toggle } from "@/shared/ui";
import { useT } from "@/app/i18n/LanguageContext";
import { intlLocale } from "@/app/i18n/locale";
import { type ChkConfig, type ChkItem, isItemOn } from "./checklistDefaults";
import { getTimeZoneOptions } from "./helpers";

/**
 * Les réglages de la checklist — hors de l'écran de séance.
 *
 * Deux choses seulement se règlent : la fenêtre de séance et les critères
 * personnels posés à l'entrée. Tout le reste (trades du jour, pertes, news) est
 * LU par l'application : le demander serait recréer la case qu'on coche par
 * réflexe. Le panneau le dit en une ligne, pour que personne ne recrée ici un
 * critère « pas de perte aujourd'hui » que l'écran vérifie déjà.
 */

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

        <section className="space-y-2">
          <h3 className="tv-label text-slate-500">{t("chk.setCriteria")}</h3>
          <p className="tv-prose text-slate-500">{t("chk.setCriteriaHint")}</p>
          <ul className="space-y-1.5">
            {config.items.map((it, i) => (
              <li key={i} className="flex items-center gap-2">
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
