import React from 'react';
import { Star } from 'lucide-react';

export const Testimonials: React.FC = () => {
  const reviews = [
    {
      name: 'David Vance',
      role: 'VP of Engineering at CloudScale',
      avatar: 'D',
      quote: 'Tallix simplified our company trip expenses and team offsites completely. The debt graph feature eliminated 10+ unnecessary Venmo transfers.',
      rating: 5,
    },
    {
      name: 'Sarah Chen',
      role: 'Principal Architect at Tallix',
      avatar: 'S',
      quote: 'The real-time Gemini AI spend auditing immediately flagged duplicate SaaS subscriptions that saved us over $4,200 annually.',
      rating: 5,
    },
    {
      name: 'Marcus Thorne',
      role: 'Co-Founder at NextGen AI',
      avatar: 'M',
      quote: 'Super clean developer UI. The dark theme, instant CSV export, and clear member balance balances make expense reconciliation effortless.',
      rating: 5,
    },
  ];

  return (
    <section className="py-20 bg-[#09090b] border-t border-[#27272a]">
      <div className="max-w-7xl mx-auto px-6 space-y-12">
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <span className="text-xs uppercase tracking-widest font-bold text-emerald-400">
            User Testimonials
          </span>
          <h2 className="text-3xl md:text-4xl font-extrabold text-[#fafafa] tracking-tight">
            Loved By Tech Teams & Power Users
          </h2>
          <p className="text-sm text-[#a1a1aa]">
            Here is what engineering leaders and founders say about managing expenses on Tallix.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {reviews.map((rev, idx) => (
            <div
              key={idx}
              className="p-6 rounded-xl bg-[#18181b] border border-[#27272a] space-y-4 hover:border-emerald-500/40 transition-all shadow-sm flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-center gap-1 text-amber-400">
                  {Array.from({ length: rev.rating }).map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-amber-400" />
                  ))}
                </div>
                <p className="text-xs text-[#a1a1aa] leading-relaxed italic">
                  &ldquo;{rev.quote}&rdquo;
                </p>
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-[#27272a]/60">
                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 font-bold text-white flex items-center justify-center text-sm shadow-sm">
                  {rev.avatar}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#fafafa]">{rev.name}</h4>
                  <p className="text-[10px] text-[#71717a]">{rev.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
