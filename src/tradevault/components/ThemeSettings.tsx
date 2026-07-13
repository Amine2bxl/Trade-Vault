import { useState } from 'react';
import { Palette, Check, Star, Copy, Pencil, Trash2, Plus, Wand2, ChevronDown } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useT } from '../i18n/LanguageContext';
import { useConfirm } from '../contexts/ConfirmContext';
import { ThemeDef, harmonize, lighten } from '../utils/themes';
import { cn } from '../utils/cn';

// Tiny per-theme equity sparkline so every card reads as a distinct identity
// (uses the theme's OWN colors, independent of what's currently active).
function ThemePreview({ theme }: { theme: ThemeDef }) {
  const gid = `tp-${theme.id}`;
  return (
    <svg viewBox="0 0 120 46" className="w-full h-10" aria-hidden="true" preserveAspectRatio="none">
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
      <path d="M2 38 L22 30 L40 34 L60 18 L80 24 L100 8 L118 12 L118 46 L2 46 Z" fill={`url(#${gid})`} />
      <path d="M2 38 L22 30 L40 34 L60 18 L80 24 L100 8 L118 12" fill="none" stroke={`url(#${gid}s)`} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Swatch({ color }: { color: string }) {
  return <span className="w-4 h-4 rounded-full border border-white/15" style={{ background: color }} />;
}

export default function ThemeSettings() {
  const { t } = useT();
  const confirm = useConfirm();
  const { themes, activeId, defaultId, setActive, setDefault, createTheme, updateTheme, duplicateTheme, deleteTheme } = useTheme();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [openPresets, setOpenPresets] = useState(true);
  const [openCustom, setOpenCustom] = useState(false);

  const presets = themes.filter((th) => th.builtin);
  const custom = themes.filter((th) => !th.builtin);
  const editing = themes.find((th) => th.id === editingId && !th.builtin);

  const startNew = () => {
    const id = createTheme({ name: t('appearance.namePlaceholder'), primary: '#8b5cf6', secondary: '#ec4899', highlight: '#c4b5fd' });
    setEditingId(id);
  };

  const onEdit = (id: string) => { setActive(id); setEditingId(id); };
  const onDuplicate = (id: string) => { const nid = duplicateTheme(id); setEditingId(nid); };
  const onDelete = async (id: string) => {
    if (!(await confirm(t('appearance.deleteConfirm'), { danger: true }))) return;
    if (editingId === id) setEditingId(null);
    deleteTheme(id);
  };

  const Card = ({ th }: { th: ThemeDef }) => {
    const isActive = th.id === activeId;
    const isDefault = th.id === defaultId;
    return (
      <div
        className={cn('group relative rounded-2xl p-3 border transition-all cursor-pointer overflow-hidden',
          isActive ? 'bg-white/[0.05] border-transparent shadow-lg' : 'bg-white/[0.02] border-white/[0.06] hover:border-white/[0.12]')}
        style={isActive ? { boxShadow: `0 0 0 1.5px ${th.primary}, 0 8px 26px -8px ${th.primary}55` } : undefined}
        onClick={() => setActive(th.id)}
      >
        <div className="rounded-xl overflow-hidden bg-black/30 mb-2.5">
          <ThemePreview theme={th} />
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <Swatch color={th.primary} />
            <Swatch color={th.secondary} />
            <span className="text-xs font-semibold text-white truncate">{th.name}</span>
          </div>
          {isActive && <Check className="w-4 h-4 shrink-0" style={{ color: th.primary }} />}
        </div>

        {/* Badges + actions */}
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[9px] uppercase tracking-wider font-bold text-slate-600">
            {isDefault ? t('appearance.default') : th.builtin ? '' : t('appearance.yours')}
          </span>
          <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
            <IconBtn title={t('appearance.setDefault')} onClick={() => setDefault(th.id)} active={isDefault}>
              <Star className={cn('w-3.5 h-3.5', isDefault && 'fill-amber-400 text-amber-400')} />
            </IconBtn>
            <IconBtn title={t('appearance.duplicate')} onClick={() => onDuplicate(th.id)}>
              <Copy className="w-3.5 h-3.5" />
            </IconBtn>
            {!th.builtin && (
              <>
                <IconBtn title={t('appearance.edit')} onClick={() => onEdit(th.id)}>
                  <Pencil className="w-3.5 h-3.5" />
                </IconBtn>
                <IconBtn title={t('appearance.delete')} onClick={() => onDelete(th.id)} danger>
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
    <div className="glass-strong rounded-3xl p-6 space-y-4">
      <div className="flex items-start gap-2">
        <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0">
          <Palette className="w-4 h-4" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-white uppercase tracking-wider">{t('appearance.title')}</h2>
          <p className="text-[11px] text-slate-500 mt-0.5">{t('appearance.subtitle')}</p>
        </div>
      </div>

      <Section title={t('appearance.presets')} count={presets.length} open={openPresets} onToggle={() => setOpenPresets((v) => !v)}>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {presets.map((th) => <Card key={th.id} th={th} />)}
        </div>
      </Section>

      <Section title={t('appearance.yours')} count={custom.length} open={openCustom} onToggle={() => setOpenCustom((v) => !v)}>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {custom.map((th) => <Card key={th.id} th={th} />)}
          <button
            onClick={startNew}
            className="rounded-2xl border-2 border-dashed border-white/[0.10] hover:border-cyan-500/40 hover:bg-cyan-500/[0.03] transition-all flex flex-col items-center justify-center gap-1.5 min-h-[112px] text-slate-500 hover:text-cyan-300"
          >
            <Plus className="w-5 h-5" />
            <span className="text-[11px] font-semibold">{t('appearance.new')}</span>
          </button>
        </div>
      </Section>

      {editing && (
        <div className="rounded-2xl bg-white/[0.03] border border-white/[0.08] p-4 space-y-3 animate-fade-in">
          <div className="flex items-center gap-2">
            <input
              value={editing.name}
              onChange={(e) => updateTheme(editing.id, { name: e.target.value })}
              placeholder={t('appearance.namePlaceholder')}
              className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/40"
            />
            <button
              onClick={() => updateTheme(editing.id, { secondary: harmonize(editing.primary), highlight: lighten(editing.primary) })}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-semibold hover:bg-cyan-500/15 transition-all shrink-0"
              title={t('appearance.auto')}
            >
              <Wand2 className="w-3.5 h-3.5" /> {t('appearance.auto')}
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <ColorField label={t('appearance.primary')} value={editing.primary} onChange={(v) => updateTheme(editing.id, { primary: v })} />
            <ColorField label={t('appearance.secondary')} value={editing.secondary} onChange={(v) => updateTheme(editing.id, { secondary: v })} />
            <ColorField label={t('appearance.highlight')} value={editing.highlight} onChange={(v) => updateTheme(editing.id, { highlight: v })} />
          </div>
          <div className="flex justify-end">
            <button
              onClick={() => setEditingId(null)}
              className="px-5 py-2 rounded-xl text-sm font-bold bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-white shadow-lg shadow-cyan-500/20 transition-all"
            >
              {t('appearance.done')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Collapsible group. Header stays visible so the panel reads clean when closed;
// the body animates open/closed via grid-rows 0fr→1fr for a smooth, premium reveal.
function Section({ title, count, open, onToggle, children }: { title: string; count: number; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div>
      <button
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center gap-2 mb-2 group"
      >
        <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500 group-hover:text-slate-300 transition-colors">{title}</span>
        <span className="text-[10px] font-bold text-slate-600 tabular-nums">{count}</span>
        <span className="flex-1 h-px bg-white/[0.06]" />
        <ChevronDown className={cn('w-3.5 h-3.5 text-slate-500 transition-transform duration-300', open ? 'rotate-180' : 'rotate-0')} />
      </button>
      <div className={cn('grid transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]', open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0')}>
        <div className="overflow-hidden">
          <div className="pb-1">{children}</div>
        </div>
      </div>
    </div>
  );
}

function IconBtn({ children, onClick, title, danger, active }: { children: React.ReactNode; onClick: () => void; title: string; danger?: boolean; active?: boolean }) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={cn('w-7 h-7 rounded-lg flex items-center justify-center transition-all',
        active ? 'text-amber-400' : danger ? 'text-slate-500 hover:text-red-400 hover:bg-red-500/10' : 'text-slate-500 hover:text-white hover:bg-white/[0.06]')}
    >
      {children}
    </button>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1.5">{label}</span>
      <div className="relative flex items-center gap-2 bg-white/[0.04] border border-white/[0.08] rounded-xl px-2 py-1.5">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-7 h-7 rounded-lg cursor-pointer bg-transparent border-0 p-0 shrink-0"
          style={{ appearance: 'none' }}
        />
        <span className="text-[11px] font-mono text-slate-300 uppercase truncate">{value}</span>
      </div>
    </label>
  );
}
