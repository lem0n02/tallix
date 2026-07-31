import React from 'react';

export const TrustedBy: React.FC = () => {
  const companies = [
    'VERCEL',
    'LINEAR',
    'STRIPE',
    'SUPABASE',
    'CLOUDFLARE',
    'NOTION',
  ];

  return (
    <section className="py-10 border-y border-[#27272a] bg-[#09090b]">
      <div className="max-w-7xl mx-auto px-6 text-center space-y-4">
        <p className="text-[11px] uppercase tracking-widest font-bold text-[#71717a]">
          TRUSTED BY MODERN ENGINEERING TEAMS & FAST-GROWING STARTUPS
        </p>
        <div className="flex flex-wrap items-center justify-center gap-8 md:gap-16 opacity-60">
          {companies.map((company, idx) => (
            <span
              key={idx}
              className="font-mono text-sm font-bold tracking-wider text-[#a1a1aa] hover:text-[#fafafa] transition-colors cursor-default"
            >
              {company}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
};
