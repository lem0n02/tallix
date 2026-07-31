import React from 'react';

interface LandingFooterProps {
  onSignInClick: () => void;
  onSignUpClick: () => void;
  onLaunchAppClick?: () => void;
}

export const LandingFooter: React.FC<LandingFooterProps> = ({
  onSignInClick,
  onSignUpClick,
}) => {
  return (
    <footer className="bg-[#09090b] border-t border-[#27272a] text-xs text-[#71717a] py-12">
      <div className="max-w-7xl mx-auto px-6 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Col 1: Brand */}
          <div className="space-y-3 md:col-span-1">
            <div className="flex items-center gap-2 cursor-pointer" onClick={onSignInClick}>
              <div className="w-7 h-7 bg-emerald-600 rounded flex items-center justify-center font-bold text-sm text-white">
                T
              </div>
              <span className="text-base font-bold text-[#fafafa] tracking-tight">Tallix</span>
            </div>
            <p className="text-xs text-[#a1a1aa] leading-relaxed">
              Modern corporate and shared expense management platform powered by server-side Gemini AI.
            </p>
          </div>

          {/* Col 2: Navigation */}
          <div className="space-y-2">
            <p className="text-xs uppercase font-bold text-[#fafafa] tracking-wider">Product</p>
            <ul className="space-y-1.5">
              <li>
                <a href="#features" className="hover:text-white transition-colors">Features</a>
              </li>
              <li>
                <a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a>
              </li>
              <li>
                <a href="#why-tallix" className="hover:text-white transition-colors">Why Tallix</a>
              </li>
            </ul>
          </div>

          {/* Col 3: Authentication */}
          <div className="space-y-2">
            <p className="text-xs uppercase font-bold text-[#fafafa] tracking-wider">Account</p>
            <ul className="space-y-1.5">
              <li>
                <button onClick={onSignInClick} className="hover:text-white transition-colors text-left cursor-pointer">
                  Sign In
                </button>
              </li>
              <li>
                <button onClick={onSignUpClick} className="hover:text-white transition-colors text-left cursor-pointer">
                  Create Free Account
                </button>
              </li>
              <li>
                <span className="text-[#52525b]">Enterprise SSO (Contact)</span>
              </li>
            </ul>
          </div>

          {/* Col 4: Legal & Social */}
          <div className="space-y-2">
            <p className="text-xs uppercase font-bold text-[#fafafa] tracking-wider">Legal & Contact</p>
            <ul className="space-y-1.5">
              <li><span className="hover:text-white transition-colors cursor-pointer">Privacy Policy</span></li>
              <li><span className="hover:text-white transition-colors cursor-pointer">Terms of Service</span></li>
              <li><span className="hover:text-white transition-colors cursor-pointer">Security Audit</span></li>
              <li><span className="hover:text-white transition-colors cursor-pointer">support@tallix.io</span></li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-[#27272a] flex flex-col md:flex-row items-center justify-between gap-4">
          <p>© {new Date().getFullYear()} Tallix Financial Inc. All rights reserved.</p>
          <div className="flex items-center gap-6 font-mono text-[11px] text-[#52525b]">
            <span>Status: All Systems Operational</span>
            <span>v2.4.0</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
