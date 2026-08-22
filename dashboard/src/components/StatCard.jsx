import { TrendingUp, TrendingDown } from 'lucide-react';

const colorMap = {
  blue: {
    iconBg: 'bg-blue-500/10 text-blue-500 border-blue-500/20 shadow-blue-500/10',
    topGlow: 'from-blue-500/15 via-blue-500/5 to-transparent',
    trendUp: 'text-emerald-700 bg-emerald-500/10 border-emerald-500/20',
    trendDown: 'text-rose-700 bg-rose-500/10 border-rose-500/20',
    accentBorder: 'group-hover:border-blue-500/40',
  },
  green: {
    iconBg: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 shadow-emerald-500/10',
    topGlow: 'from-emerald-500/15 via-emerald-500/5 to-transparent',
    trendUp: 'text-emerald-700 bg-emerald-500/10 border-emerald-500/20',
    trendDown: 'text-rose-700 bg-rose-500/10 border-rose-500/20',
    accentBorder: 'group-hover:border-emerald-500/40',
  },
  red: {
    iconBg: 'bg-rose-500/10 text-rose-500 border-rose-500/20 shadow-rose-500/10',
    topGlow: 'from-rose-500/15 via-rose-500/5 to-transparent',
    trendUp: 'text-rose-700 bg-rose-500/10 border-rose-500/20',
    trendDown: 'text-emerald-700 bg-emerald-500/10 border-emerald-500/20',
    accentBorder: 'group-hover:border-rose-500/40',
  },
  yellow: {
    iconBg: 'bg-amber-500/10 text-amber-500 border-amber-500/20 shadow-amber-500/10',
    topGlow: 'from-amber-500/15 via-amber-500/5 to-transparent',
    trendUp: 'text-amber-800 bg-amber-500/10 border-amber-500/20',
    trendDown: 'text-emerald-700 bg-emerald-500/10 border-emerald-500/20',
    accentBorder: 'group-hover:border-amber-500/40',
  },
};

export default function StatCard({ icon: Icon, label, value, trend, trendLabel, color = 'blue' }) {
  const c = colorMap[color] || colorMap.blue;
  const isPositive = trend >= 0;

  return (
    <div className={`relative bg-white rounded-2xl p-5 shadow-sm hover:shadow-md border border-slate-200/80 ${c.accentBorder} card-hover animate-fade-in overflow-hidden group transition-all duration-300`}>
      {/* Top Ambient Glow Gradient */}
      <div className={`absolute -top-10 -right-10 w-36 h-36 bg-gradient-to-br ${c.topGlow} blur-2xl pointer-events-none rounded-full transition-opacity duration-300`} />

      <div className="flex items-start justify-between mb-4 relative">
        <div className={`w-11 h-11 rounded-xl border flex items-center justify-center shadow-inner ${c.iconBg}`}>
          <Icon className="w-5 h-5" />
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border backdrop-blur-sm ${
            isPositive ? c.trendUp : c.trendDown
          }`}>
            {isPositive ? (
              <TrendingUp className="w-3.5 h-3.5" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5" />
            )}
            <span className="tabular-nums">{isPositive ? '+' : ''}{trend}%</span>
          </div>
        )}
      </div>

      <div className="relative">
        <p className="text-3xl font-extrabold text-slate-800 tracking-tight tabular-nums">{value}</p>
        <p className="text-sm font-semibold text-slate-600 mt-1">{label}</p>
        {trendLabel && (
          <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-slate-100">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
            <p className="text-xs font-medium text-slate-500">{trendLabel}</p>
          </div>
        )}
      </div>
    </div>
  );
}
