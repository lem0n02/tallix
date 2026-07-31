import React from 'react';
import { ArrowRight, Sparkles, TrendingUp, Users, ShieldCheck, CheckCircle2, Scale } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';

interface LandingHeroProps {
  onGetStartedClick: () => void;
  onLaunchAppClick?: () => void;
}

export const LandingHero: React.FC<LandingHeroProps> = ({
  onGetStartedClick,
}) => {
  const { t } = useLanguage();

  return (
    <section className="relative pt-12 pb-20 overflow-hidden bg-radial from-emerald-950/20 via-[#09090b] to-[#09090b]">
      {/* Background Subtle Gradient Blobs */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[550px] bg-emerald-500/10 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-10">
        {/* Left Column: Headlines & CTAs */}
        <div className="lg:col-span-6 space-y-6 text-left">
          <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full text-xs text-emerald-400 font-medium">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{t('landingHeroTitle')}</span>
          </div>

          <h1 className="text-4xl md:text-6xl font-extrabold text-[#fafafa] tracking-tight leading-[1.1]">
            {t('landingHeroTitle').split(' ')[0]}{' '}
            <span className="bg-gradient-to-r from-emerald-400 to-teal-200 bg-clip-text text-transparent">
              {t('landingHeroTitle').split(' ').slice(1).join(' ')}
            </span>
          </h1>

          <p className="text-sm md:text-base text-[#a1a1aa] leading-relaxed max-w-xl">
            {t('landingHeroSub')}
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <button
              onClick={onGetStartedClick}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm px-6 py-3 rounded-lg transition-all shadow-lg shadow-emerald-600/30 flex items-center gap-2 cursor-pointer"
            >
              <span>{t('getStartedFree')}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="pt-4 flex items-center gap-6 text-xs text-[#71717a]">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>No Credit Card Required</span>
            </div>
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>SOC2 Type II Audited</span>
            </div>
          </div>
        </div>

        {/* Right Column: Dashboard Mockup Preview */}
        <div className="lg:col-span-6 relative">
          <div className="relative mx-auto rounded-2xl bg-[#18181b] border border-[#27272a] p-4 shadow-2xl shadow-emerald-950/40 space-y-4">
            {/* Top Mockup Header Bar */}
            <div className="flex items-center justify-between border-b border-[#27272a] pb-3 px-2">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                <div className="w-3 h-3 rounded-full bg-amber-500/80"></div>
                <div className="w-3 h-3 rounded-full bg-emerald-500/80"></div>
                <span className="text-[11px] font-mono text-[#71717a] ml-2">app.tallix.io/dashboard</span>
              </div>
              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-mono">
                Live Preview
              </span>
            </div>

            {/* Metric Cards Mockup Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#09090b] border border-[#27272a] p-3.5 rounded-xl space-y-1">
                <p className="text-[10px] text-[#71717a] uppercase font-bold tracking-wider">
                  Total Liquidity
                </p>
                <p className="text-xl font-bold font-mono text-[#fafafa]">$18,450.00</p>
                <div className="flex items-center gap-1 text-[10px] text-emerald-400">
                  <TrendingUp className="w-3 h-3" />
                  <span>+12.4% vs last month</span>
                </div>
              </div>

              <div className="bg-[#09090b] border border-[#27272a] p-3.5 rounded-xl space-y-1">
                <p className="text-[10px] text-[#71717a] uppercase font-bold tracking-wider">
                  Active Squad Debt
                </p>
                <p className="text-xl font-bold font-mono text-amber-400">$340.50</p>
                <div className="flex items-center justify-between text-[10px] text-[#a1a1aa]">
                  <span>2 Claims Pending</span>
                  <span className="text-blue-400 font-semibold">Settle →</span>
                </div>
              </div>
            </div>

            {/* Mini Chart & Squad Balances */}
            <div className="bg-[#09090b] border border-[#27272a] p-3.5 rounded-xl space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-[#fafafa] flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-blue-400" />
                  Q4 Cloud & HQ Squad
                </span>
                <span className="text-[10px] text-[#71717a]">4 Members</span>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center text-[11px] p-2 rounded bg-[#18181b]">
                  <span className="text-[#fafafa] font-medium">Sarah Chen</span>
                  <span className="font-mono text-emerald-400 font-bold">+$120.00 (Owed)</span>
                </div>
                <div className="flex justify-between items-center text-[11px] p-2 rounded bg-[#18181b]">
                  <span className="text-[#fafafa] font-medium">Alex Rivera</span>
                  <span className="font-mono text-amber-400 font-bold">-$45.00 (Owes)</span>
                </div>
              </div>
            </div>

            {/* Floating Settlement Tag */}
            <div className="absolute -bottom-4 -right-4 bg-emerald-600 text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow-lg flex items-center gap-2 border border-emerald-400/30 animate-bounce">
              <Scale className="w-4 h-4" />
              <span>Optimal Debt Matrix Enabled</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
