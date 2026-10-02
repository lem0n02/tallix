import React from 'react';
import { ArrowLeft, KeyRound, Info } from 'lucide-react';
import { AuthLayout } from './AuthLayout';

interface ForgotPasswordViewProps {
  onBackToHome?: () => void;
  onNavigateToSignIn?: () => void;
  onBackToSignIn?: () => void;
  registeredUsers?: any[];
}

export const ForgotPasswordView: React.FC<ForgotPasswordViewProps> = ({
  onBackToHome = () => {},
  onNavigateToSignIn,
  onBackToSignIn,
}) => {
  const handleSignInNav = onNavigateToSignIn || onBackToSignIn || (() => {});

  return (
    <AuthLayout
      onBackToHome={onBackToHome}
      title="Reset Your Account Password"
      subtitle="Password recovery and self-service credential management for Tallix users."
    >
      <div className="space-y-2">
        <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-2">
          <KeyRound className="w-5 h-5" />
        </div>
        <h1 className="text-xl font-extrabold text-[#fafafa] tracking-tight">Forgot Password</h1>
        <p className="text-xs text-[#a1a1aa]">Password Reset Notice</p>
      </div>

      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-5 space-y-3">
        <div className="flex items-start gap-2.5">
          <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h3 className="text-xs font-bold text-amber-300">Feature Temporarily Unavailable</h3>
            <p className="text-xs text-[#d4d4d8] leading-relaxed">
              Email-based password reset is temporarily disabled while our custom domain email services are being configured.
            </p>
            <p className="text-xs text-[#a1a1aa] leading-relaxed pt-1">
              Please sign in using your existing email and password. If you need assistance recovering your account, please contact the system administrator.
            </p>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={handleSignInNav}
        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-3 rounded-xl transition-all shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Return to Sign In</span>
      </button>
    </AuthLayout>
  );
};
