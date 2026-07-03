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
      className="glass rounded-2xl p-5 card-premium animate-fade-in-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between mb-3">
        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{title}</span>
        {icon && (
          <div className={cn(
            'w-9 h-9 rounded-xl flex items-center justify-center transition-colors',
            trend === 'up' ? 'bg-emerald-500/10 text-emerald-400' :
            trend === 'down' ? 'bg-red-500/10 text-red-400' :
            'bg-blue-500/10 text-blue-400'
          )}>
            {icon}
          </div>
        )}
      </div>
      <div className={cn(
        'text-2xl font-bold tracking-tight',
        trend === 'up' ? 'text-emerald-400' :
        trend === 'down' ? 'text-red-400' :
        'text-white'
      )}>
        {value}
      </div>
      {subtitle && (
        <p className="text-[11px] text-slate-500 mt-1">{subtitle}</p>
      )}
    </div>
  );
}
