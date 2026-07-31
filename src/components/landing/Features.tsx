import React from 'react';
import { CreditCard, Users, Scale, BarChart3, ShieldCheck, RefreshCw } from 'lucide-react';

export const Features: React.FC = () => {
  const featuresList = [
    {
      icon: CreditCard,
      title: 'Personal Expenses',
      description: 'Audit personal corporate card charges, receipt uploads, taxonomy categorization, and exportable CSV reports.',
      color: 'text-emerald-400',
    },
    {
      icon: Users,
      title: 'Shared Groups',
      description: 'Create expense squads for trips, housing, or cloud operations with invite codes and individual member balances.',
      color: 'text-blue-400',
    },
    {
      icon: Scale,
      title: 'Split Bills',
      description: 'Supports equal, percentage, or exact dollar splits with automated debt graph matrix reduction.',
      color: 'text-amber-400',
    },
    {
      icon: BarChart3,
      title: 'Financial Analytics',
      description: 'Visualize category burn rates, vendor concentration, budget caps, and tax deduction estimations.',
      color: 'text-indigo-400',
    },
    {
      icon: ShieldCheck,
      title: 'Secure Authentication',
      description: 'HttpOnly cookie sessions, Ed25519 JWT signing, password strength validation, and role-based permissions.',
      color: 'text-emerald-400',
    },
    {
      icon: RefreshCw,
      title: 'Cloud Sync',
      description: 'Real-time Drizzle ORM synchronization, background audit logging, and automated claim settlement approvals.',
      color: 'text-cyan-400',
    },
  ];

  return (
    <section id="features" className="py-20 bg-[#09090b]">
      <div className="max-w-7xl mx-auto px-6 space-y-12">
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <span className="text-xs uppercase tracking-widest font-bold text-emerald-400">
            Engineered For Speed & Precision
          </span>
          <h2 className="text-3xl md:text-4xl font-extrabold text-[#fafafa] tracking-tight">
            Everything You Need To Master Finances
          </h2>
          <p className="text-sm text-[#a1a1aa]">
            Replace messy spreadsheets with an enterprise-grade financial engine designed for modern teams and shared households.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {featuresList.map((feature, idx) => {
            const IconComponent = feature.icon;
            return (
              <div
                key={idx}
                className="group p-6 rounded-xl bg-[#18181b] border border-[#27272a] hover:border-emerald-500/50 transition-all duration-300 hover:-translate-y-1 shadow-sm flex flex-col justify-between"
              >
                <div className="space-y-4">
                  <div className="w-10 h-10 rounded-lg bg-[#09090b] border border-[#27272a] flex items-center justify-center group-hover:border-emerald-500/30 transition-colors">
                    <IconComponent className={`w-5 h-5 ${feature.color}`} />
                  </div>
                  <h3 className="text-base font-bold text-[#fafafa] group-hover:text-emerald-400 transition-colors">
                    {feature.title}
                  </h3>
                  <p className="text-xs text-[#a1a1aa] leading-relaxed">
                    {feature.description}
                  </p>
                </div>

                <div className="pt-4 mt-4 border-t border-[#27272a]/50 text-[11px] text-[#71717a] group-hover:text-[#a1a1aa] flex items-center gap-1">
                  <span>Learn details</span>
                  <span className="transition-transform group-hover:translate-x-1">→</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
