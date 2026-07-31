import React from 'react';
import { ShieldCheck, CheckCircle2, ArrowLeft } from 'lucide-react';
import tallixLogo from '../../assets/images/tallix_brand_app_logo_1785406274692.jpg';

interface AuthLayoutProps {
  children: React.ReactNode;
  onBackToHome: () => void;
  title: string;
  subtitle: string;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({
  children,
  onBackToHome,
  title,
  subtitle,
}) => {
  return (
    <div className="min-h-screen bg-[#09090b] text-[#fafafa] flex flex-col md:flex-row font-sans">
      {/* Left Side: Branding, Illustration & Benefits */}
      <div className="hidden md:flex md:w-1/2 bg-gradient-to-br from-emerald-950/60 via-[#121215] to-[#09090b] border-r border-[#27272a] p-12 flex-col justify-between relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 blur-3xl rounded-full pointer-events-none"></div>

        {/* Brand Header */}
        <div className="relative z-10">
          <button
            onClick={onBackToHome}
            className="inline-flex items-center gap-2 text-xs text-[#a1a1aa] hover:text-white transition-colors cursor-pointer mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Home</span>
          </button>

          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl overflow-hidden bg-[#18181b] border border-[#27272a] flex items-center justify-center shrink-0 shadow-lg">
              <img
                src={tallixLogo}
                alt="Tallix Logo"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <span className="text-xl font-bold tracking-tight text-[#fafafa]">Tallix</span>
          </div>
        </div>

        {/* Showcase Illustration Content */}
        <div className="relative z-10 space-y-6 max-w-md">
          <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full text-xs text-emerald-400 font-medium">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Bank-Grade Encryption & Audit Security</span>
          </div>

          <h2 className="text-3xl font-extrabold text-[#fafafa] tracking-tight leading-tight">
            {title}
          </h2>

          <p className="text-sm text-[#a1a1aa] leading-relaxed">
            {subtitle}
          </p>

          <div className="space-y-3 pt-2 text-xs text-[#a1a1aa]">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Real-time minimum transfer debt graph solver</span>
            </div>
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Personal corporate expense auditing & receipt attachments</span>
            </div>
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Server-side Gemini 3.6 AI spend anomaly detection</span>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="relative z-10 text-[11px] text-[#52525b] font-mono">
          © {new Date().getFullYear()} Tallix Inc. SOC2 Type II Certified.
        </div>
      </div>

      {/* Right Side: Authentication Card */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 md:p-12 relative">
        <button
          onClick={onBackToHome}
          className="md:hidden absolute top-6 left-6 inline-flex items-center gap-2 text-xs text-[#a1a1aa] hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Home</span>
        </button>

        <div className="w-full max-w-[420px] bg-[#18181b] border border-[#27272a] rounded-2xl p-8 shadow-2xl space-y-6">
          {children}
        </div>
      </div>
    </div>
  );
};
