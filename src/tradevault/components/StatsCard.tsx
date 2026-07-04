import { cn } from '../utils/cn';
import { ReactNode } from 'react';

interface StatsCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon?: ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  delay?: number;
}

export default function StatsCard({ title, value, subtitle, icon, trend, delay = 0 }: StatsCardProps) {
  return (
    <div
      className="group relative glass rounded-2xl p-5 card-premium animate-fade-in-up overflow-hidden"
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Corner glow accent */}
      <div className={cn(
        'pointer-events-none absolute -top-10 -right-10 w-24 h-24 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500',
        trend === 'up' ? 'bg-emerald-500/30' : trend === 'down' ? 'bg-red-500/30' : 'bg-blue-500/30'
      )} />
      <div className="relative flex items-start justify-between mb-3">
        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{title}</span>
        {icon && (
          <div className={cn(
            'w-10 h-10 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110',
            trend === 'up' ? 'bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 text-emerald-400 shadow-[0_0_16px_rgba(16,185,129,0.15)]' :
            trend === 'down' ? 'bg-gradient-to-br from-red-500/20 to-red-500/5 text-red-400 shadow-[0_0_16px_rgba(239,68,68,0.15)]' :
            'bg-gradient-to-br from-blue-500/20 to-blue-500/5 text-blue-400 shadow-[0_0_16px_rgba(59,130,246,0.15)]'
          )}>
            {icon}
          </div>
        )}
      </div>
      <div
        className={cn(
          'relative text-lg md:text-xl font-bold tracking-tight tabular-nums',
          trend === 'up' ? 'text-emerald-400' :
          trend === 'down' ? 'text-red-400' :
          'text-white'
        )}
      >
        {value}
      </div>
      {subtitle && (
        <p className="relative text-[11px] text-slate-500 mt-1.5">{subtitle}</p>
      )}
    </div>
  );
}
