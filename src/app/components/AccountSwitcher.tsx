import { useState } from "react";
import {
  User,
  Building2,
  FlaskConical,
  Zap,
  Check,
  ChevronDown,
  Plus,
  X,
  Pencil,
  Trash2,
  AlertTriangle,
  Layers,
  Briefcase,
  Flame,
  Star,
  Shield,
  Target,
  TrendingUp,
  Compass,
  Home,
  CreditCard,
  Globe,
  Lock,
} from "lucide-react";
import { useAccounts } from "../contexts/AccountContext";
import { useT } from "../i18n/LanguageContext";
import { useToast } from "../contexts/ToastContext";
import { useSubscription } from "../hooks/useSubscription";
import { isPlanLimitError } from "../utils/planLimits";
import { cn } from "../utils/cn";
import type { Account, AccountType } from "../store";
import { Modal, FIELD_BASE, Chip, CHIP_ROW } from "@/shared/ui";

const TYPE_ICON: Record<AccountType, typeof User> = {
  personal: User,
  prop: Building2,
  demo: FlaskConical,
  live: Zap,
};
const TYPE_LABEL_KEY = {
  personal: "account.typePersonal",
  prop: "account.typeProp",
  demo: "account.typeDemo",
  live: "account.typeLive",
} as const;

/**
 * LA TEINTE D'UN COMPTE — celle du THÈME, pas une couleur figée.
 *
 * Chaque compte porte un champ `color` en base, dont la valeur par défaut est
 * `#22d3ee` : un cyan hérité de l'ancienne identité néon. Comme aucun écran du
 * produit ne permet d'en choisir une autre, TOUS les comptes portaient ce
 * cyan — sur le thème émeraude comme sur n'importe quel autre. Le disque du
 * sélecteur était donc, littéralement, la seule pièce de l'interface qui
 * ignorait le thème.
 *
 * La teinte vient maintenant de l'accent. Le champ reste en base et n'est plus
 * lu à l'affichage : il ne portait aucune intention de l'utilisateur, faute
 * d'un endroit où l'exprimer. Le jour où un sélecteur de couleur existera,
 * c'est ici, et ici seulement, qu'il se branchera.
 */
const ACCOUNT_TINT = {
  fg: "var(--tv-accent)",
  bg: "rgb(var(--tv-accent-rgb) / 0.14)",
  bgSoft: "rgb(var(--tv-accent-rgb) / 0.10)",
  border: "rgb(var(--tv-accent-rgb) / 0.30)",
  ring: "rgb(var(--tv-accent-rgb) / 0.22)",
};

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  User,
  Building2,
  FlaskConical,
  Zap,
  Briefcase,
  Flame,
  Star,
  Shield,
  Target,
  TrendingUp,
  Layers,
  Compass,
  Home,
  CreditCard,
  Globe,
};

const AVAILABLE_ICONS = Object.keys(ICON_MAP);

function getAccountIcon(a: Account) {
  if (a.icon && ICON_MAP[a.icon]) return ICON_MAP[a.icon];
  return TYPE_ICON[a.type];
}

export default function AccountSwitcher({
  compact = false,
  variant = "bar",
  balance: balanceProp,
}: {
  /** Version resserrée. Sur la variante `bar` elle réduit les marges ; sur la
   *  variante `card` (le rail), elle réduit le sélecteur au seul disque de
   *  couleur du compte — l'état du rail plié. */
  compact?: boolean;
  variant?: "bar" | "fab" | "card";
  balance?: number;
}) {
  const { accounts, activeAccount, switchAccount, removeAccount } = useAccounts();
  const { accountLimit } = useSubscription();
  const computedBalance = balanceProp ?? activeAccount?.startingBalance ?? 0;
  const fmtBalance = `$${Math.round(computedBalance).toLocaleString("en-US")}`;
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleting, setDeleting] = useState<Account | null>(null);
  const [editingModalAccount, setEditingModalAccount] = useState<Account | null>(null);

  // Le plafond de comptes du palier. Le blocage d'écriture vit dans
  // `AccountContext.addAccount` ; ici on le montre AVANT, au geste d'ajout :
  // un free ne remplit jamais le formulaire pour découvrir la limite.
  const canAddAccount = accountLimit > accounts.length;
  const goPro = () => {
    // « Plus de comptes en Pro » → checkout Stripe direct (géré par App).
    window.dispatchEvent(new CustomEvent("tv:upgrade"));
  };

  // Le renommage EN LIGNE a été retiré ici. Il coexistait avec le formulaire
  // complet : selon la variante d'affichage, le même crayon donnait soit un
  // champ « nom » soit quatre champs. Depuis que les trois crayons ouvrent le
  // formulaire complet, ces branches étaient devenues inatteignables — ~150
  // lignes de JSX réparties sur trois rendus, plus leur état et leur
  // enregistrement. Un seul geste d'édition, un seul chemin de code.

  /**
   * AccountSheet — sélecteur de comptes dans un Modal PARTAGÉ (portal vers
   * document.body). C'est ce qui rend le changement de compte fiable partout :
   * un dropdown `absolute`/`fixed` rendu dans le panneau du Modal Jarvis
   * (transform + overflow-hidden) était clippé/invisible — le bug « le sous-
   * compte ne s'ouvre pas ». Le portal n'est jamais contenu ni clippé.
   */
  const AccountSheet = ({ open, onClose }: { open: boolean; onClose: () => void }) => (
    <Modal
      open={open}
      onClose={onClose}
      wrapperClassName="z-[70]"
      className="md:max-w-sm max-h-[80vh] overflow-hidden"
    >
      <div className="px-5 py-4 border-b border-white/[0.06]">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="tv-title">{t("account.title")}</h2>
            <p className="tv-row-label">{t("account.subtitle")}</p>
          </div>
          <button
            onClick={onClose}
            aria-label={t("common.close")}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-white/[0.05]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="p-3 max-h-[60vh] overflow-y-auto">
        {accounts.map((a) => {
          const Icon = getAccountIcon(a);
          const active = a.id === activeAccount?.id;
          return (
            <div
              key={a.id}
              className={cn(
                "group w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-colors",
                active ? "bg-cyan-500/15" : "hover:bg-white/[0.06]",
              )}
            >
              <button
                onClick={() => {
                  switchAccount(a.id);
                  onClose();
                }}
                className="flex-1 flex items-center gap-2.5 min-w-0 text-left"
              >
                <span
                  className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: ACCOUNT_TINT.bg, color: ACCOUNT_TINT.fg }}
                >
                  <Icon className="w-3.5 h-3.5" />
                </span>
                <span className="flex-1 min-w-0">
                  <span
                    className={cn(
                      "block text-sm font-medium truncate",
                      active ? "text-white" : "text-slate-300",
                    )}
                  >
                    {a.name}
                  </span>
                  <span className="block text-[10px] text-slate-500">
                    {t(TYPE_LABEL_KEY[a.type])}
                  </span>
                </span>
              </button>
              {accounts.length > 1 && (
                <button
                  onClick={() => {
                    setDeleting(a);
                    onClose();
                  }}
                  aria-label={t("account.delete")}
                  className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-slate-600 opacity-0 group-hover:opacity-100 hover:text-red-400 hover:bg-red-500/10 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
              {active && <Check className="w-4 h-4 text-cyan-300 shrink-0" />}
            </div>
          );
        })}
        <div className="h-px bg-white/[0.06] my-1.5 mx-1" />
        {canAddAccount ? (
          <button
            onClick={() => {
              setCreateOpen(true);
              onClose();
            }}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-cyan-300 hover:bg-cyan-500/10 transition-colors"
          >
            <span className="w-7 h-7 rounded-lg bg-cyan-500/10 flex items-center justify-center shrink-0">
              <Plus className="w-4 h-4" />
            </span>
            <span className="text-sm font-semibold">{t("account.new")}</span>
          </button>
        ) : (
          <button
            onClick={() => {
              goPro();
              onClose();
            }}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-slate-400 hover:bg-cyan-500/10 hover:text-cyan-300 transition-colors"
          >
            <span className="w-7 h-7 rounded-lg bg-cyan-500/10 flex items-center justify-center shrink-0">
              <Lock className="w-4 h-4" />
            </span>
            <span className="text-sm font-semibold">{t("account.moreAccountsPro")}</span>
          </button>
        )}
      </div>
    </Modal>
  );

  // Mobile FAB: a floating circular button (bottom-left, mirroring the AI Coach)
  // that opens a premium bottom sheet of tappable account cards — one tap to
  // switch sub-accounts. Original layout, no dropdown crowding the top bar.
  if (variant === "fab") {
    if (!activeAccount) return null;
    const ActiveIcon = getAccountIcon(activeAccount);
    return (
      <>
        {/* La pilule mobile dit EXACTEMENT ce que dit celle du rail : le disque
            de couleur, le nom, le solde, le chevron. C'est le même sélecteur,
            posé sur un autre écran — pas un composant cousin.

            Ce qui a sauté, et pourquoi :
              • le HALO COLORÉ sous le disque (`0 0 14px` de la teinte du
                compte). La version desktop n'en a jamais eu, et un halo n'est
                pas une information ;
              • le `max-w-[96px]` sur le nom. Quatre-vingt-seize pixels coupent
                « Compte principal » au milieu : la pilule s'étire maintenant
                jusqu'aux deux tiers de l'écran et ne tronque qu'au-delà ;
              • le libellé « COMPTE » au-dessus du nom, qui volait la ligne où
                le SOLDE devait s'écrire. Le disque et le chevron disent déjà
                qu'on est sur un sélecteur de compte. */}
        <button
          onClick={() => setOpen(true)}
          aria-label={`${activeAccount.name} — ${fmtBalance} — ${t("account.switch")}`}
          className="md:hidden fixed z-40 left-3 bottom-[calc(96px_+_env(safe-area-inset-bottom,0px))] h-12 max-w-[66vw] pl-1.5 pr-3 rounded-full flex items-center gap-2.5 float-shell active:scale-95 transition"
        >
          <span
            className="relative grid h-9 w-9 shrink-0 place-items-center rounded-xl border"
            style={{
              background: ACCOUNT_TINT.bg,
              color: ACCOUNT_TINT.fg,
              borderColor: ACCOUNT_TINT.border,
            }}
          >
            <ActiveIcon className="w-4 h-4" />
          </span>
          <span className="min-w-0 flex-1 text-left">
            <span className="block truncate text-[13px] font-semibold leading-tight text-white">
              {activeAccount.name}
            </span>
            <span className="tv-figure block text-[13px] leading-tight text-slate-400">
              {fmtBalance}
            </span>
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
        </button>

        {open && (
          <div
            className="md:hidden fixed inset-0 z-[70] flex items-end bg-black/60 backdrop-blur-sm animate-fade-in"
            onClick={() => setOpen(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full glass-strong rounded-t-3xl border-t border-white/[0.08] pb-[calc(env(safe-area-inset-bottom,0px)+16px)] animate-slide-up"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
                <div>
                  <h2 className="tv-title">{t("account.title")}</h2>
                  <p className="tv-row-label">{t("account.subtitle")}</p>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  aria-label={t("common.close")}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-white/[0.05]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2.5 p-4 max-h-[55vh] overflow-y-auto">
                {accounts.map((a) => {
                  const Icon = getAccountIcon(a);
                  const active = a.id === activeAccount.id;

                  return (
                    <div
                      key={a.id}
                      className={cn(
                        "relative flex flex-col gap-2 rounded-2xl p-3.5 border transition",
                        active ? "bg-white/[0.06]" : "bg-white/[0.03] border-white/[0.06]",
                      )}
                      style={
                        active
                          ? {
                              borderColor: ACCOUNT_TINT.border,
                              boxShadow: `0 0 0 1px ${ACCOUNT_TINT.ring}`,
                            }
                          : undefined
                      }
                    >
                      <button
                        onClick={() => {
                          switchAccount(a.id);
                          setOpen(false);
                        }}
                        className="flex flex-col gap-2 text-left active:scale-[0.97] transition-transform"
                      >
                        <span
                          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                          style={{ background: ACCOUNT_TINT.bg, color: ACCOUNT_TINT.fg }}
                        >
                          <Icon className="w-4.5 h-4.5" />
                        </span>
                        <span className="min-w-0 pr-6">
                          <span className="block text-sm font-bold text-white truncate">
                            {a.name}
                          </span>
                          <span className="block text-[10px] text-slate-500 truncate">
                            {t(TYPE_LABEL_KEY[a.type])}
                          </span>
                        </span>
                      </button>

                      {/* Rename + delete affordances */}
                      <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1">
                        {accounts.length > 1 && (
                          <button
                            onClick={() => setDeleting(a)}
                            aria-label={t("account.delete")}
                            className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-600 hover:text-red-400 hover:bg-red-500/10"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setEditingModalAccount(a);
                            setOpen(false);
                          }}
                          aria-label={t("account.rename")}
                          className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/[0.08]"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {active && (
                        <span className="tv-accent-fill absolute top-2.5 right-2.5 w-5 h-5 rounded-full flex items-center justify-center">
                          <Check className="w-3 h-3" strokeWidth={3} />
                        </span>
                      )}
                    </div>
                  );
                })}

                {canAddAccount ? (
                  <button
                    onClick={() => {
                      setCreateOpen(true);
                      setOpen(false);
                    }}
                    className="flex flex-col items-center justify-center gap-2 rounded-2xl p-3.5 border border-dashed border-cyan-500/30 bg-cyan-500/[0.06] text-cyan-300 hover:bg-cyan-500/10 transition active:scale-[0.97] min-h-[92px]"
                  >
                    <Plus className="w-5 h-5" />
                    <span className="text-xs font-semibold text-center">
                      {t("account.newShort")}
                    </span>
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      goPro();
                      setOpen(false);
                    }}
                    className="flex flex-col items-center justify-center gap-2 rounded-2xl p-3.5 border border-dashed border-white/[0.1] bg-white/[0.03] text-slate-400 hover:text-cyan-300 hover:bg-cyan-500/[0.06] transition active:scale-[0.97] min-h-[92px]"
                  >
                    <Lock className="w-5 h-5" />
                    <span className="text-xs font-semibold text-center">
                      {t("account.goProShort")}
                    </span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {createOpen && <CreateAccountModal onClose={() => setCreateOpen(false)} />}
        {editingModalAccount && (
          <CreateAccountModal
            edit={editingModalAccount}
            onClose={() => setEditingModalAccount(null)}
          />
        )}
        {deleting && (
          <DeleteAccountModal
            account={deleting}
            onConfirm={async () => {
              try {
                await removeAccount(deleting.id);
              } catch (e) {
                console.error("Failed to delete account", e);
              }
              setDeleting(null);
            }}
            onClose={() => setDeleting(null)}
          />
        )}
      </>
    );
  }

  // Trading Account — carte premium (footer/sidebar Jarvis).
  // Même langue visuelle que le coach : surface élevée, liseré accent,
  // icône teintée compte, solde en chiffres tabulaires.
  if (variant === "card") {
    // Le shell n'est rendu qu'une fois les comptes résolus (gate `accountsReady`
    // dans App.tsx) : ici `activeAccount` est donc prêt, sans squelette ni
    // « pop » — le compte s'affiche dès la première frame, même au F5.
    if (!activeAccount) return null;
    const ActiveIcon = getAccountIcon(activeAccount);
    return (
      /* Plié, le conteneur se réduit LUI AUSSI au disque et se centre. Un
         bouton de 40px laissé dans une boîte de 48px se colle à gauche : le
         disque tombait 4px à gauche de l'axe des icônes du rail. */
      <div className={cn("relative", compact ? "mx-auto w-10" : "w-full")}>
        {/* ── LE SÉLECTEUR DE COMPTE ──
            Une pilule qui se lit d'un coup, et qui existe DANS LES DEUX ÉTATS
            du rail — plié, elle se réduit au disque de couleur du compte, on
            n'a jamais à déplier la barre pour changer de compte.

            Ce qui a sauté, et pourquoi :
              • la COLONNE DE DROITE (solde + pastille « changer »). Elle se
                battait avec le nom pour 192px de large : le nom était coupé
                dans la moitié des cas. Le solde passe SOUS le nom, sur toute
                la largeur, où il a la place de s'écrire en entier.
              • la pastille « CHANGER ». Le chevron dit déjà que ça s'ouvre ;
                elle ne faisait que voler de la place au nom.
              • le CRAYON qui n'apparaissait qu'au survol. Une commande
                invisible tant qu'on ne passe pas dessus n'est pas une
                commande — l'édition vit dans la feuille qui s'ouvre. */}
        <button
          onClick={() => setOpen((v) => !v)}
          /* Plié, l'infobulle porte AUSSI le solde : c'est la seule chose que
             le disque ne peut pas dire, et on ne doit pas avoir à déplier la
             barre pour la lire. */
          title={
            compact
              ? `${activeAccount.name} · ${fmtBalance} — ${t("account.switch")}`
              : `${activeAccount.name} — ${t("account.switch")}`
          }
          aria-label={`${activeAccount.name} — ${fmtBalance} — ${t("account.switch")}`}
          className={cn(
            "tv-interactive group/acc flex items-center rounded-2xl text-left",
            "border border-[var(--tv-border)] bg-[var(--tv-plate-2)]",
            "hover:border-[var(--tv-border-strong)] hover:bg-[var(--tv-plate-3)]",
            compact ? "relative h-10 w-10 justify-center p-0" : "w-full gap-2.5 px-2.5 py-2",
          )}
        >
          <span
            className="grid h-7 w-7 shrink-0 place-items-center rounded-xl border"
            style={{
              background: ACCOUNT_TINT.bg,
              color: ACCOUNT_TINT.fg,
              borderColor: ACCOUNT_TINT.border,
            }}
          >
            <ActiveIcon className="h-[15px] w-[15px]" />
          </span>
          {/* Plié, le chevron ne disparaît pas — il se pose en pastille sur
              l'angle du disque. Sans lui, le disque se lit comme un badge
              décoratif et non comme une commande : rien n'indiquerait qu'on
              peut changer de compte sans déplier la barre. */}
          {compact && (
            <span className="acc-caret" aria-hidden="true">
              <ChevronDown className="h-2.5 w-2.5" />
            </span>
          )}
          {!compact && (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold leading-tight text-white">
                  {activeAccount.name}
                </span>
                <span className="tv-figure block text-[13px] leading-tight text-slate-400">
                  {fmtBalance}
                </span>
              </span>
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 shrink-0 text-slate-500 transition-transform",
                  open && "rotate-180",
                )}
              />
            </>
          )}
        </button>
        <AccountSheet open={open} onClose={() => setOpen(false)} />
        {createOpen && <CreateAccountModal onClose={() => setCreateOpen(false)} />}
        {editingModalAccount && (
          <CreateAccountModal
            edit={editingModalAccount}
            onClose={() => setEditingModalAccount(null)}
          />
        )}
        {deleting && (
          <DeleteAccountModal
            account={deleting}
            onConfirm={async () => {
              try {
                await removeAccount(deleting.id);
              } catch (e) {
                console.error("Failed to delete account", e);
              }
              setDeleting(null);
            }}
            onClose={() => setDeleting(null)}
          />
        )}
      </div>
    );
  }

  // Sidebar (bar) variant. Before accounts resolve the rail must reserve the
  // exact slot (same height as the pill) — otherwise the account pill pops in
  // after mount and shifts the whole nav/perf/user column on F5.
  if (!activeAccount) {
    return (
      <div
        aria-hidden="true"
        className="w-full flex items-center gap-2.5 rounded-2xl border border-white/[0.08] px-3 py-2.5"
      >
        {/* Reserved, not shimmering. The account resolves in a few dozen ms from
            cache; a pulsing placeholder in that window is a loading animation
            that outlives the load it describes — the rail looked busy on every
            single refresh. Flat blocks hold the exact same box, silently. */}
        <div className="w-8 h-8 rounded-lg bg-white/[0.05] shrink-0" />
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="h-3 w-2/3 rounded bg-white/[0.05]" />
          <div className="h-2 w-1/3 rounded bg-white/[0.04]" />
        </div>
      </div>
    );
  }
  const ActiveIcon = getAccountIcon(activeAccount);

  return (
    <div className="relative">
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setOpen((v) => !v)}
          title={t("account.switch")}
          className={cn(
            "flex-1 flex items-center gap-2.5 rounded-2xl border transition",
            compact ? "px-2.5 py-1.5" : "px-3 py-2.5",
            "bg-white/[0.04] border-white/[0.08] hover:border-cyan-500/30 hover:bg-white/[0.06]",
          )}
        >
          <span
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: ACCOUNT_TINT.bg, color: ACCOUNT_TINT.fg }}
          >
            <ActiveIcon className="w-4 h-4" />
          </span>
          <span className="flex-1 min-w-0 text-left">
            <span className="flex items-center gap-1.5">
              <span className="block text-sm font-semibold text-white truncate">
                {activeAccount.name}
              </span>
              {/* Formulaire complet, comme partout ailleurs. */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingModalAccount(activeAccount);
                }}
                aria-label={t("account.edit")}
                className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-600 opacity-0 hover:opacity-100 hover:text-white hover:bg-white/[0.08] transition shrink-0"
              >
                <Pencil className="w-3 h-3" />
              </button>
            </span>
            <span className="tv-figure block text-[10px] text-slate-500 truncate">
              {fmtBalance} · {t(TYPE_LABEL_KEY[activeAccount.type])}
            </span>
          </span>
          <span className="tv-label flex items-center gap-1 text-cyan-400/80 shrink-0">
            {t("account.switchShort")}
            <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", open && "rotate-180")} />
          </span>
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setEditingModalAccount(activeAccount);
          }}
          className="h-9 px-2.5 rounded-xl flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 hover:text-white hover:bg-white/[0.08] bg-white/[0.03] border border-white/[0.07] transition shrink-0"
        >
          <Pencil className="w-3 h-3" />
          <span>{t("account.editShort")}</span>
        </button>
      </div>

      <AccountSheet open={open} onClose={() => setOpen(false)} />

      {createOpen && <CreateAccountModal onClose={() => setCreateOpen(false)} />}
      {editingModalAccount && (
        <CreateAccountModal
          edit={editingModalAccount}
          onClose={() => setEditingModalAccount(null)}
        />
      )}
      {deleting && (
        <DeleteAccountModal
          account={deleting}
          onConfirm={async () => {
            try {
              await removeAccount(deleting.id);
            } catch (e) {
              console.error("Failed to delete account", e);
            }
            setDeleting(null);
          }}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  );
}

/** Two-step destructive confirmation: a first "I understand" gate, then the
 *  actual red delete — trades and history go with the account (FK cascade). */
function DeleteAccountModal({
  account,
  onConfirm,
  onClose,
}: {
  account: Account;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useT();
  const [step, setStep] = useState<1 | 2>(1);
  const [busy, setBusy] = useState(false);
  const Icon = getAccountIcon(account);

  return (
    <Modal
      open
      onClose={onClose}
      className="md:max-w-sm p-6 border border-red-500/20"
      wrapperClassName="z-[110]"
    >
      <div>
        <div className="flex justify-center mb-4">
          <div className="w-12 h-12 rounded-2xl bg-red-500/15 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-red-400" />
          </div>
        </div>

        <h2 className="tv-title text-center mb-1">
          {step === 1 ? t("account.deleteTitle") : t("account.deleteTitle2")}
        </h2>

        <div className="flex items-center justify-center gap-2 my-3">
          <span
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: ACCOUNT_TINT.bg, color: ACCOUNT_TINT.fg }}
          >
            <Icon className="w-3.5 h-3.5" />
          </span>
          <span className="text-sm font-bold text-white">{account.name}</span>
        </div>

        <p className="text-sm text-slate-400 text-center mb-5 leading-relaxed">
          {step === 1 ? t("account.deleteWarn1") : t("account.deleteWarn2")}
        </p>

        <div className="grid gap-2">
          {step === 1 ? (
            <button
              onClick={() => setStep(2)}
              className="w-full h-11 rounded-xl text-sm font-bold bg-white/[0.06] border border-white/[0.1] text-slate-200 hover:bg-white/[0.1] transition"
            >
              {t("account.deleteStep1Cta")}
            </button>
          ) : (
            <button
              onClick={async () => {
                if (busy) return;
                setBusy(true);
                await onConfirm();
              }}
              disabled={busy}
              className="w-full h-11 rounded-xl text-sm font-bold bg-red-500/90 hover:bg-red-500 text-white shadow-lg shadow-red-500/25 transition disabled:opacity-60"
            >
              {busy ? t("common.loading") : t("account.deleteStep2Cta")}
            </button>
          )}
          <button
            onClick={onClose}
            className="w-full h-11 rounded-xl text-sm font-semibold text-slate-400 hover:text-white hover:bg-white/[0.04] transition"
          >
            {t("common.cancel")}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function CreateAccountModal({ onClose, edit }: { onClose: () => void; edit?: Account }) {
  const { addAccount, editAccount } = useAccounts();
  const { t, lang } = useT();
  const { toast } = useToast();
  const [name, setName] = useState(edit?.name ?? "");
  const [type, setType] = useState<AccountType>(edit?.type ?? "prop");
  const [selectedIcon, setSelectedIcon] = useState<string | null>(edit?.icon ?? null);
  /**
   * Capital de départ — pré-rempli avec la valeur RÉELLE du compte en édition.
   *
   * L'expression précédente était `String((edit?.startingBalance ?? edit) ? 0 : "50000")`,
   * dont le résultat était inversé : un compte à 50 000 s'affichait à **0**, et
   * un compte à 0 s'affichait à **50 000**. Comme le champ est renvoyé tel quel
   * à l'enregistrement, **chaque édition écrasait le capital du compte** —
   * silencieusement, sans erreur.
   *
   * La portée était large : `startingBalance` est le dénominateur de la
   * variation de période, du sous-score de risque de l'Edge Score, de la
   * progression des objectifs et des statistiques quantitatives. Le remettre à
   * zéro faussait tous les pourcentages du produit d'un seul clic sur le crayon.
   */
  const [balance, setBalance] = useState(String(edit?.startingBalance ?? 50000));
  const [busy, setBusy] = useState(false);

  const types: AccountType[] = ["personal", "prop", "demo", "live"];

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      if (edit) {
        await editAccount(edit.id, {
          name: trimmed,
          type,
          icon: selectedIcon ?? "",
          startingBalance: Number(balance) || 0,
        });
      } else {
        await addAccount({
          name: trimmed,
          type,
          icon: selectedIcon ?? undefined,
          startingBalance: Number(balance) || 0,
        });
      }
      onClose();
    } catch (e) {
      // Limite de comptes atteinte : ce n'est pas un échec technique, c'est un
      // moment de vente — on le dit et on emmène vers l'offre.
      if (isPlanLimitError(e)) {
        toast(
          lang === "fr"
            ? "Ton offre autorise un seul compte — passe à Pro pour en ouvrir jusqu'à 3."
            : "Your plan allows one account — go Pro for up to 3.",
          "info",
        );
        window.dispatchEvent(new CustomEvent("tv:upgrade"));
        onClose();
        return;
      }
      console.error("Failed to save account", e);
      setBusy(false);
    }
  };

  // Same shell as Add Trade and Missed Setup: shared `Modal` (centered on
  // desktop, bottom sheet on mobile, blurred backdrop, Esc-to-close,
  // scroll-lock), a 2px accent rule, a 24px header, a body on the design
  // system's field skin, and a sticky action footer.
  const label = "tv-label block text-slate-400 mb-1.5";

  return (
    <Modal
      open
      onClose={onClose}
      className="md:max-w-lg"
      labelledBy="create-account-title"
      wrapperClassName="z-[100]"
    >
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
        <h2 id="create-account-title" className="tv-title flex items-center gap-2.5">
          <Layers className="w-4.5 h-4.5 text-cyan-400 shrink-0" />
          {edit ? t("account.editTitle") : t("account.new")}
        </h2>
        <button
          onClick={onClose}
          aria-label={t("common.close")}
          className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="px-6 py-5 space-y-5">
        <div>
          <label className={label}>{t("account.name")}</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            autoFocus
            placeholder={t("account.namePlaceholder")}
            className={cn(FIELD_BASE, "h-11")}
          />
        </div>

        <div>
          <label className={label}>{t("account.type")}</label>
          {/* The one chip of the design system — identical to the Mistakes and
              Confluences bubbles in the Add Trade modal. */}
          <div className={CHIP_ROW}>
            {types.map((tp) => {
              const TypeIcon = TYPE_ICON[tp];
              return (
                <Chip key={tp} selected={type === tp} onClick={() => setType(tp)}>
                  <TypeIcon className="w-3.5 h-3.5" /> {t(TYPE_LABEL_KEY[tp])}
                </Chip>
              );
            })}
          </div>
        </div>

        <div>
          <label className={label}>Icon</label>
          <div className="grid grid-cols-4 gap-1.5">
            {AVAILABLE_ICONS.map((iconName) => {
              const IconComp = ICON_MAP[iconName];
              const selected = selectedIcon === iconName;
              return (
                <button
                  key={iconName}
                  type="button"
                  onClick={() => setSelectedIcon(selected ? null : iconName)}
                  className={cn(
                    "h-10 rounded-lg flex items-center justify-center transition",
                    selected
                      ? "bg-cyan-500/15 border border-cyan-400/60 text-cyan-300"
                      : "bg-white/[0.04] border border-white/[0.06] text-slate-400 hover:border-white/15 hover:text-white hover:bg-white/[0.06]",
                  )}
                >
                  <IconComp className="w-4 h-4" />
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className={label}>{t("account.startingBalance")}</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">
              $
            </span>
            <input
              type="number"
              inputMode="decimal"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              className={cn(FIELD_BASE, "h-11 pl-7")}
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 px-6 py-4 border-t border-white/[0.06]">
        <button
          onClick={onClose}
          className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-300 bg-white/[0.04] hover:bg-white/[0.08] transition-colors"
        >
          {t("common.cancel")}
        </button>
        <button
          onClick={submit}
          disabled={!name.trim() || busy}
          className={cn(
            "px-5 py-2.5 rounded-xl text-sm font-bold transition whitespace-nowrap",
            name.trim() && !busy
              ? "tv-accent-fill"
              : "bg-white/[0.04] text-slate-600 cursor-not-allowed",
          )}
        >
          {busy
            ? edit
              ? t("account.editSaving")
              : t("account.creating")
            : edit
              ? t("account.editSave")
              : t("account.create")}
        </button>
      </div>
    </Modal>
  );
}

export type { Account };
