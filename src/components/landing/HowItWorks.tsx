import React from 'react';
import { UserPlus, PlusCircle, Scale } from 'lucide-react';

export const HowItWorks: React.FC = () => {
  const steps = [
    {
      step: '01',
      icon: UserPlus,
      title: 'Create Account',
      description: 'Sign up in under 30 seconds with email or one-click social auth. Set up your personal or team liquidity limits.',
    },
    {
      step: '02',
      icon: PlusCircle,
      title: 'Add Expenses',
      description: 'Log individual receipts or share group charges. Attach photos, tag taxonomy categories, and choose split ratios.',
    },
    {
      step: '03',
      icon: Scale,
      title: 'Track & Settle',
      description: 'Tallix runs automated graph reduction to calculate minimum transfer paths. Review and approve wire settlements in one tap.',
    },
  ];

  return (
    <section id="how-it-works" className="py-20 bg-[#09090b] border-t border-[#27272a]">
      <div className="max-w-7xl mx-auto px-6 space-y-12">
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <span className="text-xs uppercase tracking-widest font-bold text-emerald-400">
            Streamlined Workflow
          </span>
          <h2 className="text-3xl md:text-4xl font-extrabold text-[#fafafa] tracking-tight">
            How Tallix Works In 3 Simple Steps
          </h2>
          <p className="text-sm text-[#a1a1aa]">
            No complex manuals or manual math. Get up and running in minutes.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          {/* Connector Line (Desktop) */}
          <div className="hidden md:block absolute top-1/2 left-1/6 right-1/6 h-0.5 bg-[#27272a] -translate-y-6 z-0"></div>

          {steps.map((item, idx) => {
            const IconComp = item.icon;
            return (
              <div
                key={idx}
                className="relative z-10 bg-[#18181b] border border-[#27272a] p-6 rounded-xl space-y-4 hover:border-emerald-500/40 transition-all shadow-md"
              >
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-xl bg-[#09090b] border border-[#27272a] flex items-center justify-center font-bold text-emerald-400">
                    <IconComp className="w-6 h-6" />
                  </div>
                  <span className="text-2xl font-mono font-bold text-[#3f3f46]">
                    {item.step}
                  </span>
                </div>

                <h3 className="text-lg font-bold text-[#fafafa]">{item.title}</h3>
                <p className="text-xs text-[#a1a1aa] leading-relaxed">{item.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
