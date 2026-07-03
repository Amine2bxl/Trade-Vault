import { useState, FormEvent } from 'react';
import { Mail, Lock, User, Eye, EyeOff, BookOpen, BarChart3, Sparkles, Target } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../utils/cn';
import logoSrc from '@/assets/tradevault-logo.png';

const FEATURES = [
  { icon: BookOpen, title: 'Log every trade', desc: 'Capture entries, exits, screenshots, confluences and mistakes in seconds.' },
  { icon: BarChart3, title: 'Deep analytics', desc: 'Equity curve, win rate, P&L by strategy, symbol and day of week.' },
  { icon: Target, title: 'Track missed setups', desc: "Review the A+ setups you didn't take and learn from them." },
  { icon: Sparkles, title: 'AI-powered insights', desc: 'Ask questions about your trading history and get instant answers.' },
];

export default function AuthModal() {
  const { login, signup, loginWithGoogle, requestPasswordReset } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
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

  const handleGoogle = async () => {
    setError('');
    setInfo('');
    setLoading(true);
    const err = await loginWithGoogle();
    if (err) {
      setError(err);
      setLoading(false);
    }
  };

  const inputClass = 'w-full bg-white/[0.04] border border-white/[0.08] rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/40 focus:ring-1 focus:ring-blue-500/20 transition-all';

  return (
    <div className="relative min-h-screen overflow-y-auto overflow-x-hidden"
      style={{ background: 'linear-gradient(135deg, #060810 0%, #0a0f1e 40%, #0c1222 100%)' }}>

      {/* Decorative orbs */}
      <div className="auth-orb w-[500px] h-[500px] bg-blue-600 -top-40 -left-40" style={{ animationDelay: '0s' }} />
      <div className="auth-orb w-[400px] h-[400px] bg-purple-600 -bottom-32 -right-32" style={{ animationDelay: '-5s' }} />
      <div className="auth-orb w-[300px] h-[300px] bg-cyan-600 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" style={{ animationDelay: '-10s' }} />

      <div className="relative z-10 min-h-screen flex items-center justify-center py-10 md:py-16">
        <div className="w-full max-w-5xl mx-4 grid md:grid-cols-2 gap-10 md:gap-16 items-center">

          {/* Marketing / product intro — makes this page explain what TradeVault does without requiring sign-in */}
          <div className="text-center md:text-left animate-fade-in-up">
            <div className="flex items-center gap-3 justify-center md:justify-start mb-5">
              <div className="relative w-11 h-11 shrink-0">
                <div className="absolute inset-0 rounded-xl bg-blue-500/40 blur-lg opacity-70" />
                <img src={logoSrc} alt="TradeVault" width={44} height={44} className="relative w-11 h-11 rounded-xl drop-shadow-[0_0_12px_rgba(59,130,246,0.5)]" />
              </div>
              <span className="text-xl font-bold text-white">TradeVault</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-white leading-tight mb-3">
              Your premium day trading journal
            </h1>
            <p className="text-sm md:text-base text-slate-400 max-w-md mx-auto md:mx-0 mb-8">
              TradeVault helps day traders log trades, review missed setups, and turn raw performance data into clear, actionable insights — so you can trade with discipline, not guesswork.
            </p>
            <div className="grid sm:grid-cols-2 gap-4 max-w-md mx-auto md:mx-0">
              {FEATURES.map(({ icon: Icon, title, desc }) => (
                <div key={title} className="text-left glass rounded-2xl p-4">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center mb-2">
                    <Icon className="w-4 h-4 text-blue-400" />
                  </div>
                  <div className="text-sm font-semibold text-white mb-0.5">{title}</div>
                  <div className="text-xs text-slate-500 leading-relaxed">{desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Auth card */}
          <div className="w-full max-w-md mx-auto animate-slide-in">
        <div className="glass-strong rounded-3xl p-8 shadow-2xl shadow-black/40">
          {/* Logo */}
          <div className="text-center mb-8 md:hidden">
            <div className="relative w-14 h-14 mx-auto mb-4">
              <div className="absolute inset-0 rounded-2xl bg-blue-500/40 blur-xl opacity-70" />
              <img
                src={logoSrc}
                alt="TradeVault"
                width={56}
                height={56}
                className="relative w-14 h-14 rounded-2xl drop-shadow-[0_0_14px_rgba(59,130,246,0.5)]"
              />
            </div>
            <h1 className="text-2xl font-bold text-white">TradeVault</h1>
            <p className="text-sm text-slate-400 mt-1">Your premium day trading journal</p>
          </div>

          {/* Tab Switcher */}
          <div className="flex bg-white/[0.04] rounded-xl p-1 mb-6">
            <button
              onClick={() => { setMode('login'); setError(''); }}
              className={cn(
                'flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all',
                mode === 'login' ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'text-slate-400 hover:text-white'
              )}
            >
              Sign In
            </button>
            <button
              onClick={() => { setMode('signup'); setError(''); }}
              className={cn(
                'flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all',
                mode === 'signup' ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'text-slate-400 hover:text-white'
              )}
            >
              Create Account
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
                  placeholder="Full name"
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
                placeholder="Email address"
                className={inputClass}
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Password"
                className={cn(inputClass, 'pr-11')}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
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
                  ? 'bg-blue-500/50 text-blue-200 cursor-wait'
                  : 'bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-400 hover:to-indigo-400 text-white shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30'
              )}
            >
              {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>

            {mode === 'login' && (
              <button
                type="button"
                onClick={async () => {
                  setError(''); setInfo('');
                  if (!email) { setError('Enter your email above to reset your password'); return; }
                  const err = await requestPasswordReset(email);
                  if (err) setError(err);
                  else setInfo('Password reset email sent. Check your inbox.');
                }}
                className="w-full text-xs text-slate-400 hover:text-blue-400 transition-colors"
              >
                Forgot password?
              </button>
            )}
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-white/[0.06]" />
            <span className="text-xs text-slate-600">or continue with</span>
            <div className="flex-1 h-px bg-white/[0.06]" />
          </div>

          {/* Google */}
          <button
            onClick={handleGoogle}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] py-3 rounded-xl text-sm font-medium text-slate-300 transition-all"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continue with Google
          </button>

          {/* Footer */}
          <p className="text-[10px] text-slate-600 text-center mt-6 leading-relaxed">
            By signing in you agree to our <a href="/terms" className="underline hover:text-slate-400">Terms of Service</a> and <a href="/privacy" className="underline hover:text-slate-400">Privacy Policy</a>.<br />
            Your data is stored securely in Supabase.
          </p>
        </div>
          </div>
        </div>
      </div>
    </div>
  );
}
