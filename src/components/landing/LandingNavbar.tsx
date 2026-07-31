import React from 'react';
import { ArrowRight, Globe } from 'lucide-react';
import tallixLogo from '../../assets/images/tallix_brand_app_logo_1785406274692.jpg';
import { useLanguage } from '../../i18n/LanguageContext';

interface LandingNavbarProps {
  onSignInClick: () => void;
  onSignUpClick: () => void;
  onLaunchAppClick?: () => void;
}

export const LandingNavbar: React.FC<LandingNavbarProps> = ({
  onSignInClick,
  onSignUpClick,
}) => {
  const { lang, setLang, t } = useLanguage();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#27272a] bg-[#09090b]/80 backdrop-blur-md transition-all">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Left: Brand */}
        <div className="flex items-center gap-3 cursor-pointer" onClick={onSignInClick}>
          <div className="w-8 h-8 rounded-lg overflow-hidden border border-[#27272a] bg-[#18181b] flex items-center justify-center shrink-0 shadow-md">
            <img
              src={tallixLogo}
              alt="Tallix Logo"
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-bold tracking-tight text-[#fafafa]">{t('brandName')}</span>
            <span className="text-[9px] uppercase tracking-widest text-[#71717a] font-bold">{t('brandTagline')}</span>
          </div>
        </div>

        {/* Center: Navigation */}
        <nav className="hidden md:flex items-center gap-8 text-xs font-medium text-[#a1a1aa]">
          <a href="#features" className="hover:text-white transition-colors">
            {t('features')}
          </a>
          <a href="#how-it-works" className="hover:text-white transition-colors">
            {t('howItWorks')}
          </a>
          <a href="#why-tallix" className="hover:text-white transition-colors">
            {t('whyTallix')}
          </a>
          <div className="flex items-center gap-1.5 cursor-not-allowed opacity-70">
            <span>{t('pricing')}</span>
            <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.2 rounded font-bold uppercase">
              {t('comingSoon')}
            </span>
          </div>
        </nav>

        {/* Right: Actions */}
        <div className="flex items-center gap-3">
          {/* Bangla / English Language Toggle */}
          <div className="flex items-center bg-[#18181b] border border-[#27272a] rounded-lg p-0.5">
            <button
              onClick={() => setLang('en')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer flex items-center gap-1 ${
                lang === 'en'
                  ? 'bg-emerald-600 text-white shadow-sm font-bold'
                  : 'text-[#a1a1aa] hover:text-[#fafafa]'
              }`}
              title="Switch to English"
            >
              <span>English</span>
            </button>
            <button
              onClick={() => setLang('bn')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer flex items-center gap-1 ${
                lang === 'bn'
                  ? 'bg-emerald-600 text-white shadow-sm font-bold'
                  : 'text-[#a1a1aa] hover:text-[#fafafa]'
              }`}
              title="বাংলা ভাষাতে পরিবর্তন করুন"
            >
              <span>বাংলা</span>
            </button>
          </div>

          <button
            onClick={onSignInClick}
            className="text-xs text-[#a1a1aa] hover:text-[#fafafa] font-semibold px-3 py-1.5 transition-colors cursor-pointer"
          >
            {t('signInBtn')}
          </button>
          <button
            onClick={onSignUpClick}
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2 rounded-lg transition-all cursor-pointer shadow-md shadow-emerald-600/20 flex items-center gap-1.5"
          >
            <span>{t('getStartedFree')}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
};
