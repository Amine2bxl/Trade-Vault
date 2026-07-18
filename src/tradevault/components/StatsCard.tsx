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
      className="group relative glass rounded-xl md:rounded-2xl p-3 md:p-3.5 card-premium animate-fade-in-up overflow-hidden"
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Corner glow accent */}
      <div className={cn(
        'pointer-events-none absolute -top-8 -right-8 w-20 h-20 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500',
        trend === 'up' ? 'bg-emerald-500/30' : trend === 'down' ? 'bg-red-500/30' : 'bg-cyan-500/30'
      )} />
      <div className="relative flex items-center gap-1.5 mb-2">
        {icon && (
          <span className={cn(
            'shrink-0',
            trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-red-400' : 'text-cyan-400'
          )}>
            {icon}
          </span>
        )}
        <span className="text-[9px] md:text-[10px] font-semibold text-slate-500 uppercase tracking-wider truncate">{title}</span>
      </div>
      <div
        className={cn(
          'font-display relative text-lg md:text-xl font-extrabold tracking-tight tabular-nums leading-none',
          trend === 'up' ? 'text-emerald-400' :
          trend === 'down' ? 'text-red-400' :
          'text-white'
        )}
      >
        {value}
      </div>
      {subtitle && (
        <p className="relative text-[9px] md:text-[10px] text-slate-500 mt-1 truncate">{subtitle}</p>
      )}
    </div>
  );
}
