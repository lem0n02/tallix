import React from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';

interface CTAProps {
  onSignUpClick: () => void;
}

export const CTA: React.FC<CTAProps> = ({ onSignUpClick }) => {
  return (
    <section className="py-20 bg-[#09090b] border-t border-[#27272a]">
      <div className="max-w-5xl mx-auto px-6">
        <div className="relative rounded-2xl bg-gradient-to-br from-emerald-950/60 via-[#18181b] to-[#18181b] border border-emerald-500/30 p-10 md:p-16 text-center space-y-6 shadow-2xl overflow-hidden">
          {/* Subtle background blur */}
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-96 bg-emerald-500/10 blur-3xl rounded-full pointer-events-none"></div>

          <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full text-xs text-emerald-400 font-medium">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Join 10,000+ Teams Managing Expenses Today</span>
          </div>

          <h2 className="text-3xl md:text-5xl font-extrabold text-[#fafafa] tracking-tight max-w-2xl mx-auto">
            Ready to simplify your finances?
          </h2>

          <p className="text-xs md:text-sm text-[#a1a1aa] max-w-lg mx-auto leading-relaxed">
            Create your free Tallix account in seconds. Zero setup fees, no credit card required. Start organizing personal and squad expenses right away.
          </p>

          <div className="pt-2">
            <button
              onClick={onSignUpClick}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm px-8 py-3.5 rounded-xl transition-all shadow-xl shadow-emerald-600/30 inline-flex items-center gap-2 cursor-pointer"
            >
              <span>Create Free Account</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
