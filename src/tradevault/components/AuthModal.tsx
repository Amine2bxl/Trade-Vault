import { useState, FormEvent } from 'react';
import { Mail, Lock, User, Eye, EyeOff, BookOpen, BarChart3, Sparkles, Target, ArrowLeft, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useT } from '../i18n/LanguageContext';
import { cn } from '../utils/cn';
import { SITE_DOMAIN, SITE_NAME } from '@/lib/site';
import logoSrc from '@/assets/tradevault-logo.png';

/**
 * The brand lockup: logo, wordmark and the canonical domain. Repeated on both
 * the desktop panel and the mobile card so the sign-in screen always identifies
 * itself — a credential form that doesn't say whose it is reads as a phish.
 */
function BrandLockup({ size }: { size: 'sm' | 'lg' }) {
  const box = size === 'lg' ? 'w-14 h-14' : 'w-11 h-11';
  const radius = size === 'lg' ? 'rounded-2xl' : 'rounded-xl';
  const px = size === 'lg' ? 56 : 44;
  return (
    <div className={cn('flex items-center gap-3', size === 'lg' && 'flex-col gap-3')}>
      <div className={cn('relative shrink-0', box)}>
        <div className={cn('absolute inset-0 bg-cyan-500/40 blur-lg opacity-70', radius)} />
        <img
          src={logoSrc}
          alt=""
          aria-hidden
          width={px}
          height={px}
          className={cn('relative drop-shadow-[0_0_12px_rgba(6,182,212,0.5)]', box, radius)}
        />
      </div>
      <div className={cn(size === 'lg' && 'text-center')}>
        <div className={cn('font-bold text-white leading-none', size === 'lg' ? 'text-2xl' : 'text-xl')}>
          {SITE_NAME}
        </div>
        <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-400/70">
          {SITE_DOMAIN}
        </div>
      </div>
    </div>
  );
}

function useFeatures() {
  const { t } = useT();
  return [
    { icon: BookOpen, title: t('auth.feature1Title'), desc: t('auth.feature1Desc') },
    { icon: BarChart3, title: t('auth.feature2Title'), desc: t('auth.feature2Desc') },
    { icon: Target, title: t('auth.feature3Title'), desc: t('auth.feature3Desc') },
    { icon: Sparkles, title: t('auth.feature4Title'), desc: t('auth.feature4Desc') },
  ];
}

interface AuthModalProps {
  /** Tab shown on mount — the landing "start free" CTA opens straight on signup. */
  initialMode?: 'login' | 'signup';
  /** When set, shows a back affordance returning to the public landing page. */
  onBack?: () => void;
}

export default function AuthModal({ initialMode = 'login', onBack }: AuthModalProps) {
  const { t } = useT();
  const FEATURES = useFeatures();
  const { login, signup, loginWithGoogle, loginWithDiscord, requestPasswordReset } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);
    if (mode === 'login') {
      const err = await login(email, password);
      if (err) setError(err);
    } else {
      const err = await signup(name, email, password);
      if (err) {
        setError(err);
      } else {
        // Instant account creation — sign in immediately (email verification disabled)
        const loginErr = await login(email, password);
        if (loginErr) setError(loginErr);
      }
    }
    setLoading(false);
  };

  const handleOAuth = async (provider: 'google' | 'discord') => {
    setError('');
    setInfo('');
    setLoading(true);
    const err = provider === 'google' ? await loginWithGoogle() : await loginWithDiscord();
    if (err) {
      setError(err);
      setLoading(false);
    }
  };

  const inputClass = 'w-full bg-white/[0.04] border border-white/[0.08] rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20 transition-all';

  return (
    <div className="relative min-h-dvh w-full overflow-x-clip bg-[#060d16]">
      {/* Same ambient mesh as the landing — one visual identity site-wide. */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 55% at 60% -10%,rgba(6,182,212,.09),transparent 60%),radial-gradient(ellipse 55% 45% at 95% 55%,rgba(99,102,241,.07),transparent 55%)',
        }}
      />

      {/* Decorative orbs */}
      <div className="auth-orb w-[500px] h-[500px] bg-cyan-600 -top-40 -left-40" style={{ animationDelay: '0s' }} />
      <div className="auth-orb w-[400px] h-[400px] bg-teal-600 -bottom-32 -right-32" style={{ animationDelay: '-5s' }} />
      <div className="auth-orb w-[300px] h-[300px] bg-cyan-600 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" style={{ animationDelay: '-10s' }} />

      {onBack && (
        <button
          onClick={onBack}
          className="absolute z-20 top-[max(1rem,env(safe-area-inset-top))] left-4 md:top-6 md:left-6 flex items-center gap-1.5 px-3 h-11 rounded-xl glass border border-white/[0.08] text-sm font-semibold text-slate-300 hover:text-white hover:bg-white/[0.06] transition-all"
        >
          <ArrowLeft className="w-4 h-4" /> {t('landing.back')}
        </button>
      )}

      <div className="relative z-10 min-h-dvh flex items-center justify-center px-4 py-16 md:py-6">
        <div className="w-full max-w-5xl grid md:grid-cols-2 gap-8 md:gap-16 md:items-center">

          {/* Marketing / product intro — desktop only, so the mobile card always fits
              within one screen height without needing to scroll. */}
          <div className="hidden md:block text-left animate-fade-in-up">
            <div className="mb-5">
              <BrandLockup size="sm" />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-white leading-tight mb-3">
              {t('auth.headline')}
            </h1>
            <p className="text-sm md:text-base text-slate-400 max-w-md mb-8">
              {t('auth.description')}
            </p>
            <div className="grid sm:grid-cols-2 gap-4 max-w-md">
              {FEATURES.map(({ icon: Icon, title, desc }) => (
                <div key={title} className="text-left glass rounded-2xl p-4">
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center mb-2">
                    <Icon className="w-4 h-4 text-cyan-400" />
                  </div>
                  <div className="text-sm font-semibold text-white mb-0.5">{title}</div>
                  <div className="text-xs text-slate-500 leading-relaxed">{desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Auth card */}
          <div className="w-full max-w-md mx-auto flex flex-col justify-center animate-slide-in">
        <div className="glass-strong rounded-3xl p-6 md:p-8 shadow-2xl shadow-black/40">
          {/* Brand — mobile only; the desktop panel to the left already carries it. */}
          <div className="flex flex-col items-center text-center mb-8 md:hidden">
            <BrandLockup size="lg" />
            <p className="text-sm text-slate-400 mt-3">{t('auth.headline')}</p>
          </div>

          {/* Desktop: a compact brand line inside the card, so the credential
              form is never visually detached from the identity it belongs to. */}
          <div className="hidden md:flex items-center gap-2.5 mb-6 pb-5 border-b border-white/[0.06]">
            <img
              src={logoSrc}
              alt=""
              aria-hidden
              width={28}
              height={28}
              className="w-7 h-7 rounded-lg shrink-0"
            />
            <span className="text-sm font-bold text-white">{SITE_NAME}</span>
            <span className="text-[11px] text-slate-600">·</span>
            <span className="text-[11px] font-medium text-slate-500">{SITE_DOMAIN}</span>
          </div>

          {/* Tab Switcher */}
          <div className="flex bg-white/[0.04] rounded-xl p-1 mb-6">
            <button
              onClick={() => { setMode('login'); setError(''); }}
              className={cn(
                'flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all',
                mode === 'login' ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/20' : 'text-slate-400 hover:text-white'
              )}
            >
              {t('auth.signIn')}
            </button>
            <button
              onClick={() => { setMode('signup'); setError(''); }}
              className={cn(
                'flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all',
                mode === 'signup' ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/20' : 'text-slate-400 hover:text-white'
              )}
            >
              {t('auth.createAccount')}
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400 mb-4 animate-fade-in">
              {error}
            </div>
          )}

          {info && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 text-sm text-emerald-400 mb-4 animate-fade-in">
              {info}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder={t('auth.fullName')}
                  autoComplete="name"
                  required
                  className={inputClass}
                />
              </div>
            )}
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder={t('auth.emailAddress')}
                autoComplete="email"
                required
                className={inputClass}
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={t('auth.password')}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                required
                minLength={6}
                className={cn(inputClass, 'pr-11')}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? t('common.showLess') : t('common.view')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 w-11 h-11 -mr-2 flex items-center justify-center text-slate-500 hover:text-slate-300 transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={cn(
                'w-full py-3 rounded-xl text-sm font-bold transition-all',
                loading
                  ? 'bg-cyan-500/50 text-cyan-200 cursor-wait'
                  : 'bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-white shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/30'
              )}
            >
              {loading ? t('auth.pleaseWait') : mode === 'login' ? t('auth.signIn') : t('auth.createAccount')}
            </button>

            {mode === 'login' && (
              <button
                type="button"
                onClick={async () => {
                  setError(''); setInfo('');
                  if (!email) { setError(t('auth.enterEmailForReset')); return; }
                  const err = await requestPasswordReset(email);
                  if (err) setError(err);
                  else setInfo(t('auth.resetSent'));
                }}
                className="w-full text-xs text-slate-400 hover:text-cyan-400 transition-colors"
              >
                {t('auth.forgotPassword')}
              </button>
            )}
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-white/[0.06]" />
            <span className="text-xs text-slate-600">{t('auth.orContinueWith')}</span>
            <div className="flex-1 h-px bg-white/[0.06]" />
          </div>

          {/* SSO — Google & Discord */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handleOAuth('google')}
              disabled={loading}
              className="flex items-center justify-center gap-2.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] py-3 rounded-xl text-sm font-medium text-slate-300 transition-all"
            >
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Google
            </button>
            <button
              onClick={() => handleOAuth('discord')}
              disabled={loading}
              className="flex items-center justify-center gap-2.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] py-3 rounded-xl text-sm font-medium text-slate-300 transition-all"
            >
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="#5865F2">
                <path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.058a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
              </svg>
              Discord
            </button>
          </div>

          {/* Trust marker — reassures on a form that asks for a password. */}
          <div className="flex items-center justify-center gap-1.5 mt-6 text-[10px] font-semibold text-slate-500">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400/70 shrink-0" />
            {t('auth.dataStored')}
          </div>

          {/* Footer */}
          <p className="text-[10px] text-slate-600 text-center mt-3 leading-relaxed">
            {t('auth.termsAgree')} <a href="/terms" className="underline hover:text-slate-400">{t('auth.termsOfService')}</a> {t('auth.and')} <a href="/privacy" className="underline hover:text-slate-400">{t('auth.privacyPolicy')}</a>.
          </p>
        </div>
          </div>
        </div>
      </div>
    </div>
  );
}
