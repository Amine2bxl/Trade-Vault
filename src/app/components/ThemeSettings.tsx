import { useState } from "react";
import { Palette, Check, Star, Copy, Pencil, Trash2, Plus, ChevronDown } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
import { useT } from "../i18n/LanguageContext";
import { useConfirm } from "../contexts/ConfirmContext";
import ThemeStudioModal from "./ThemeStudioModal";
import { ThemeDef } from "../utils/themes";
import { cn } from "../utils/cn";

// Per-theme preview: a full colour band (primary · secondary · highlight, so
// every colour of the identity is visible at a glance) above an equity
// sparkline drawn in the theme's OWN colours. Never cropped — the band and the
// curve both sit fully inside the card.
function ThemePreview({ theme }: { theme: ThemeDef }) {
  const gid = `tp-${theme.id}`;
  return (
    <div className="w-full">
      <div className="flex h-3 w-full">
        <span className="flex-1" style={{ background: theme.primary }} />
        <span className="flex-1" style={{ background: theme.secondary }} />
        <span className="flex-1" style={{ background: theme.highlight }} />
      </div>
      <svg
        viewBox="0 0 120 44"
        className="block w-full h-14"
        aria-hidden="true"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={theme.highlight} stopOpacity="0.35" />
            <stop offset="100%" stopColor={theme.primary} stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`${gid}s`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={theme.primary} />
            <stop offset="100%" stopColor={theme.highlight} />
          </linearGradient>
        </defs>
        <path
          d="M2 36 L22 28 L40 32 L60 16 L80 22 L100 8 L118 12 L118 44 L2 44 Z"
          fill={`url(#${gid})`}
        />
        <path
          d="M2 36 L22 28 L40 32 L60 16 L80 22 L100 8 L118 12"
          fill="none"
          stroke={`url(#${gid}s)`}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

function Swatch({ color }: { color: string }) {
  return (
    <span className="w-4 h-4 rounded-full border border-white/15" style={{ background: color }} />
  );
}

export default function ThemeSettings() {
  const { t } = useT();
  const confirm = useConfirm();
  const {
    themes,
    activeId,
    defaultId,
    setActive,
    setDefault,
    createTheme,
    duplicateTheme,
    deleteTheme,
  } = useTheme();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [openPresets, setOpenPresets] = useState(true);
  const [openCustom, setOpenCustom] = useState(false);

  const presets = themes.filter((th) => th.builtin);
  const custom = themes.filter((th) => !th.builtin);
  const editing = themes.find((th) => th.id === editingId && !th.builtin);

  const startNew = () => {
    const id = createTheme({
      name: t("appearance.namePlaceholder"),
      primary: "#8b5cf6",
      secondary: "#ec4899",
      highlight: "#c4b5fd",
    });
    setEditingId(id);
  };

  const onEdit = (id: string) => {
    setActive(id);
    setEditingId(id);
  };
  const onDuplicate = (id: string) => {
    const nid = duplicateTheme(id);
    setEditingId(nid);
  };
  const onDelete = async (id: string) => {
    if (!(await confirm(t("appearance.deleteConfirm"), { danger: true }))) return;
    if (editingId === id) setEditingId(null);
    deleteTheme(id);
  };

  const Card = ({ th }: { th: ThemeDef }) => {
    const isActive = th.id === activeId;
    const isDefault = th.id === defaultId;
    return (
      <div
        className={cn(
          "group relative rounded-2xl p-3 border transition cursor-pointer overflow-hidden",
          isActive
            ? "bg-white/[0.05] border-transparent shadow-lg"
            : "bg-white/[0.02] border-white/[0.06] hover:border-white/[0.12]",
        )}
        style={
          isActive
            ? { boxShadow: `0 0 0 1.5px ${th.primary}, 0 8px 26px -8px ${th.primary}55` }
            : undefined
        }
        onClick={() => setActive(th.id)}
      >
        <div className="rounded-xl overflow-hidden bg-black/30 mb-2.5">
          <ThemePreview theme={th} />
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <Swatch color={th.primary} />
            <Swatch color={th.secondary} />
            <Swatch color={th.highlight} />
            <span className="text-xs font-semibold text-white truncate">{th.name}</span>
          </div>
          {isActive && <Check className="w-4 h-4 shrink-0" style={{ color: th.primary }} />}
        </div>

        {/* Badges + actions */}
        <div className="mt-2 flex items-center justify-between">
          <span className="tv-label text-slate-600">
            {isDefault ? t("appearance.default") : th.builtin ? "" : t("appearance.yours")}
          </span>
          <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
            <IconBtn
              title={t("appearance.setDefault")}
              onClick={() => setDefault(th.id)}
              active={isDefault}
            >
              <Star className={cn("w-3.5 h-3.5", isDefault && "fill-amber-400 text-amber-400")} />
            </IconBtn>
            <IconBtn title={t("appearance.duplicate")} onClick={() => onDuplicate(th.id)}>
              <Copy className="w-3.5 h-3.5" />
            </IconBtn>
            {!th.builtin && (
              <>
                <IconBtn title={t("appearance.edit")} onClick={() => onEdit(th.id)}>
                  <Pencil className="w-3.5 h-3.5" />
                </IconBtn>
                <IconBtn title={t("appearance.delete")} onClick={() => onDelete(th.id)} danger>
                  <Trash2 className="w-3.5 h-3.5" />
                </IconBtn>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="glass-strong rounded-3xl p-5 space-y-4">
      <div className="flex items-start gap-2">
        <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0">
          <Palette className="w-4 h-4" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-white uppercase tracking-wider">
            {t("appearance.title")}
          </h2>
          <p className="tv-row-label mt-0.5">{t("appearance.subtitle")}</p>
        </div>
      </div>

      <Section
        title={t("appearance.presets")}
        count={presets.length}
        open={openPresets}
        onToggle={() => setOpenPresets((v) => !v)}
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {presets.map((th) => (
            <Card key={th.id} th={th} />
          ))}
        </div>
      </Section>

      <Section
        title={t("appearance.yours")}
        count={custom.length}
        open={openCustom}
        onToggle={() => setOpenCustom((v) => !v)}
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {custom.map((th) => (
            <Card key={th.id} th={th} />
          ))}
          <button
            onClick={startNew}
            className="rounded-2xl border-2 border-dashed border-white/[0.10] hover:border-cyan-500/40 hover:bg-cyan-500/[0.03] transition flex flex-col items-center justify-center gap-1.5 min-h-[136px] text-slate-500 hover:text-cyan-300"
          >
            <Plus className="w-5 h-5" />
            <span className="text-[11px] font-semibold">{t("appearance.new")}</span>
          </button>
        </div>
      </Section>

      {/* Édition : le STUDIO, unique éditeur de thème du produit.
          Un panneau d'édition en ligne vivait ici et ne proposait que les
          trois couleurs d'accent. Le conserver à côté du studio aurait fait
          deux éditeurs pour une même chose — et deux endroits à tenir à jour
          chaque fois qu'un réglage s'ajoute. */}
      {editing && <ThemeStudioModal themeId={editing.id} onClose={() => setEditingId(null)} />}
    </div>
  );
}

// Collapsible group. Header stays visible so the panel reads clean when closed;
// the body animates open/closed via grid-rows 0fr→1fr for a smooth, premium reveal.
function Section({
  title,
  count,
  open,
  onToggle,
  children,
}: {
  title: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <button
        onClick={onToggle}
        aria-expanded={open}
        /* 36px de hauteur : l'en-tête d'accordéon n'en faisait que 16, la
           hauteur de son texte. C'est une ligne qu'on touche pour ouvrir et
           fermer une section — elle a besoin d'une zone, pas d'une ligne. */
        className="group -mx-1 mb-1 flex h-9 w-full items-center gap-2 px-1"
      >
        <span className="tv-label text-slate-500 group-hover:text-slate-300 transition-colors">
          {title}
        </span>
        <span className="tv-figure text-[10px] text-slate-600">{count}</span>
        <span className="flex-1 h-px bg-white/[0.06]" />
        <ChevronDown
          className={cn(
            "w-3.5 h-3.5 text-slate-500 transition-transform duration-300",
            open ? "rotate-180" : "rotate-0",
          )}
        />
      </button>
      <div
        className={cn(
          "grid transition duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="overflow-hidden">
          {/* p-1 leaves room for the active card's outer ring/shadow so it is
              never clipped by the collapse container. */}
          <div className="p-1">{children}</div>
        </div>
      </div>
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  title,
  danger,
  active,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  danger?: boolean;
  active?: boolean;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={cn(
        /* 32px et non 28 : douze pastilles de thème alignées, chacune sous le
           seuil du pouce. L'icône garde sa taille. */
        "flex h-8 w-8 items-center justify-center rounded-lg transition",
        active
          ? "text-amber-400"
          : danger
            ? "text-slate-500 hover:text-red-400 hover:bg-red-500/10"
            : "text-slate-500 hover:text-white hover:bg-white/[0.06]",
      )}
    >
      {children}
    </button>
  );
}
