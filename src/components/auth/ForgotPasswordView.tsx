import React, { useState } from 'react';
import { Loader2, ArrowRight, CheckCircle2, KeyRound } from 'lucide-react';
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
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setError(null);
    setLoading(true);

    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
    }, 1000);
  };

  return (
    <AuthLayout
      onBackToHome={onBackToHome}
      title="Reset Your Account Password"
      subtitle="Enter your corporate or personal email address and we will send you a secure password reset link."
    >
      <div className="space-y-2">
        <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-2">
          <KeyRound className="w-5 h-5" />
        </div>
        <h1 className="text-xl font-extrabold text-[#fafafa] tracking-tight">Forgot Password</h1>
        <p className="text-xs text-[#a1a1aa]">We will help you regain access to your Tallix workspace</p>
      </div>

      {submitted ? (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-5 space-y-3 text-center animate-in fade-in zoom-in-95">
          <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#fafafa]">Reset Link Sent!</h3>
            <p className="text-xs text-[#a1a1aa] mt-1 leading-relaxed">
              If an account associated with <span className="text-emerald-400 font-mono font-medium">{email}</span> exists, password reset instructions have been dispatched.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSignInNav}
            className="w-full mt-2 bg-[#27272a] hover:bg-[#3f3f46] text-[#fafafa] font-semibold text-xs py-2.5 rounded-xl transition-colors cursor-pointer"
          >
            Return to Sign In
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="resetEmail" className="block text-[11px] uppercase tracking-wider font-bold text-[#71717a] mb-1">
              Email Address
            </label>
            <input
              id="resetEmail"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError(null);
              }}
              placeholder="user@tallix.io"
              className={`w-full bg-[#09090b] border rounded-xl px-3.5 py-2.5 text-xs text-[#fafafa] focus:outline-none placeholder-[#52525b] ${
                error ? 'border-red-500/80 focus:border-red-500' : 'border-[#27272a] focus:border-emerald-500'
              }`}
            />
            {error && <p className="text-[10px] text-red-400 mt-1 font-medium">{error}</p>}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs py-3 rounded-xl transition-all shadow-md shadow-blue-600/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <span>Send Reset Link</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      )}

      <div className="pt-2 text-center text-xs text-[#71717a]">
        Remembered your password?{' '}
        <button
          type="button"
          onClick={handleSignInNav}
          className="text-emerald-400 font-bold hover:underline cursor-pointer"
        >
          Sign In
        </button>
      </div>
    </AuthLayout>
  );
};
