import { X } from "@/shared/ui/icons";
import { Modal } from "@/shared/ui";
import { useT } from "@/app/i18n/LanguageContext";
import SubscriptionSection from "./SubscriptionSection";

/**
 * Débloquer TradeVault — la fenêtre unique qui s'ouvre sur chaque cadenas.
 *
 * Elle porte EXACTEMENT la carte d'achat de la page Abonnement
 * (`SubscriptionSection`, en mode compact) : même choix de formule, même
 * bouton au prix qui roule, mêmes erreurs traduites, même code promo. Avant,
 * la fenêtre recopiait deux cartes de prix, un champ promo et un bloc
 * d'erreur à elle — trois choses qui divergeaient de la page au premier
 * changement. Le titre et sa phrase restent ici : la fenêtre s'ouvre sans
 * contexte, elle dit d'abord ce qu'elle débloque.
 */
export default function UpgradeModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useT();
  return (
    <Modal
      open={open}
      onClose={onClose}
      wrapperClassName="z-[var(--tv-z-modal-top)]"
      className="md:max-w-xl"
    >
      <div className="p-4 md:p-5">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="pw-eyebrow">{t("subpage.pw.eyebrow")}</p>
            <h2 className="pw-title !mt-1 !text-[1.35rem]">{t("subpage.pw.title")}</h2>
            <p className="mt-1 text-[13px] text-slate-400">{t("subpage.pw.sub")}</p>
          </div>
          <button
            onClick={onClose}
            aria-label={t("upgrade.close")}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-500 transition hover:bg-white/[0.06] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <SubscriptionSection compact />
      </div>
    </Modal>
  );
}
