import React, { useState } from 'react';
import { Eye, EyeOff, Loader2, ArrowRight, AlertCircle, UserCheck } from 'lucide-react';
import { AuthLayout } from './AuthLayout';
import { UserProfile, RegisteredUser } from '../../types';
import { registerUserToCloudflareD1 } from '../../services/authService';

interface SignUpViewProps {
  onBackToHome?: () => void;
  onNavigateToSignIn?: () => void;
  onSuccessAuth?: (user: UserProfile) => void;
  onRegisterUser?: (user: RegisteredUser) => void;
  registeredUsers?: RegisteredUser[];
  onSuccess?: (user: UserProfile) => void;
  onRegister?: (user: RegisteredUser) => void;
  onSwitchToSignIn?: () => void;
  onContinueAsGuest?: () => void;
}

export const SignUpView: React.FC<SignUpViewProps> = ({
  onBackToHome = () => { },
  onNavigateToSignIn,
  onSuccessAuth,
  onRegisterUser,
  registeredUsers = [],
  onSuccess,
  onRegister,
  onSwitchToSignIn,
  onContinueAsGuest,
}) => {
  const handleSuccess = onSuccessAuth || onSuccess || (() => { });
  const handleSignInNav = onNavigateToSignIn || onSwitchToSignIn || (() => { });
  const handleRegister = onRegisterUser || onRegister;

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const [errors, setErrors] = useState<{
    fullName?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
    terms?: string;
    general?: string;
  }>({});

  // Password strength calculation
  const getPasswordStrength = (pwd: string) => {
    if (!pwd) return { score: 0, label: 'None', color: 'bg-[#27272a]' };
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;

    if (score <= 1) return { score: 1, label: 'Weak', color: 'bg-red-500' };
    if (score === 2 || score === 3) return { score: 2, label: 'Medium', color: 'bg-amber-500' };
    return { score: 3, label: 'Strong', color: 'bg-emerald-500' };
  };

  const strength = getPasswordStrength(password);

  const validateDetails = () => {
    const errs: typeof errors = {};
    if (!fullName.trim()) {
      errs.fullName = 'Full Name is required';
    }

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      errs.email = 'Email address is required';
    } else if (!/\S+@\S+\.\S+/.test(cleanEmail)) {
      errs.email = 'Please enter a valid email address';
    } else {
      // Check for duplicate registered email in local cache
      const existingUser = registeredUsers.find(
        (u) => u.email.toLowerCase() === cleanEmail
      );
      if (existingUser) {
        errs.email = 'This email is already registered. Please sign in instead.';
      }
    }

    if (!password) {
      errs.password = 'Password is required';
    } else if (password.length < 8) {
      errs.password = 'Password must be at least 8 characters';
    }

    if (confirmPassword !== password) {
      errs.confirmPassword = 'Passwords do not match';
    }

    if (!acceptTerms) {
      errs.terms = 'You must accept the terms & privacy policy';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Direct Account Creation (No email verification or OTP)
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateDetails()) return;

    setLoading(true);
    setErrors({});
    const cleanEmail = email.trim().toLowerCase();
    const userId = `usr_reg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    try {
      const result = await registerUserToCloudflareD1({
        id: userId,
        name: fullName.trim(),
        email: cleanEmail,
        password: password,
        systemRole: 'User',
        roleTitle: 'Financial Member',
        department: 'Personal Workspace',
        avatarGradient: 'from-blue-600 to-indigo-600',
        status: 'Active',
      });

      setLoading(false);
      const savedUser = result.user;

      if (handleRegister) {
        handleRegister(savedUser);
      }

      const newProfile: UserProfile = {
        id: savedUser.id,
        name: savedUser.name,
        email: savedUser.email,
        role: 'User Member',
        systemRole: 'User',
        title: savedUser.roleTitle || 'Financial Member',
        department: savedUser.department || 'Personal Workspace',
        avatarGradient: savedUser.avatarGradient || 'from-blue-600 to-indigo-600',
        liquidityLimit: 100000,
        currentLiquidity: 0,
        monthlyBurnRate: 0,
      };

      handleSuccess(newProfile);
    } catch (err: any) {
      setLoading(false);
      const errMsg = err?.message || 'Registration failed. Please try again.';
      if (errMsg.toLowerCase().includes('already registered')) {
        setErrors({ email: 'This email is already registered. Please sign in instead.' });
      } else {
        setErrors({ general: errMsg });
      }
    }
  };

  return (
    <AuthLayout
      onBackToHome={onBackToHome}
      title="Start managing expenses with Tallix"
      subtitle="Join engineering teams and shared squads. Split bills, track liquidity, and optimize burn rate with AI."
    >
      <div className="space-y-1">
        <h1 className="text-xl font-extrabold text-[#fafafa] tracking-tight">Create Account</h1>
        <p className="text-xs text-[#a1a1aa]">Create your personal account to get started</p>
      </div>

      {errors.general && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-xs text-red-400 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errors.general}</span>
        </div>
      )}

      {/* Direct Registration Form */}
      <form onSubmit={handleSignUp} className="space-y-3.5">
        <div>
          <label htmlFor="fullName" className="block text-[11px] uppercase tracking-wider font-bold text-[#71717a] mb-1">
            Full Name
          </label>
          <input
            id="fullName"
            type="text"
            value={fullName}
            onChange={(e) => {
              setFullName(e.target.value);
              if (errors.fullName) setErrors({ ...errors, fullName: undefined });
            }}
            placeholder="Sarah Chen"
            className={`w-full bg-[#09090b] border rounded-xl px-3.5 py-2 text-xs text-[#fafafa] focus:outline-none placeholder-[#52525b] ${
              errors.fullName ? 'border-red-500/80' : 'border-[#27272a] focus:border-emerald-500'
            }`}
          />
          {errors.fullName && <p className="text-[10px] text-red-400 mt-0.5 font-medium">{errors.fullName}</p>}
        </div>

        <div>
          <label htmlFor="signUpEmail" className="block text-[11px] uppercase tracking-wider font-bold text-[#71717a] mb-1">
            Email Address
          </label>
          <input
            id="signUpEmail"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (errors.email) setErrors({ ...errors, email: undefined });
            }}
            placeholder="s.chen@tallix.io"
            className={`w-full bg-[#09090b] border rounded-xl px-3.5 py-2 text-xs text-[#fafafa] focus:outline-none placeholder-[#52525b] ${
              errors.email ? 'border-red-500/80' : 'border-[#27272a] focus:border-emerald-500'
            }`}
          />
          {errors.email && (
            <div className="mt-1 space-y-1">
              <p className="text-[10px] text-red-400 font-medium">{errors.email}</p>
              {errors.email.includes('already registered') && (
                <button
                  type="button"
                  onClick={handleSignInNav}
                  className="text-[11px] text-emerald-400 underline font-semibold cursor-pointer"
                >
                  Click here to Sign In instead →
                </button>
              )}
            </div>
          )}
        </div>

        <div>
          <label htmlFor="signUpPassword" className="block text-[11px] uppercase tracking-wider font-bold text-[#71717a] mb-1">
            Password
          </label>
          <div className="relative">
            <input
              id="signUpPassword"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errors.password) setErrors({ ...errors, password: undefined });
              }}
              placeholder="At least 8 characters"
              className={`w-full bg-[#09090b] border rounded-xl px-3.5 py-2 pr-10 text-xs text-[#fafafa] focus:outline-none placeholder-[#52525b] ${
                errors.password ? 'border-red-500/80' : 'border-[#27272a] focus:border-emerald-500'
              }`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-2 text-[#71717a] hover:text-[#fafafa] p-0.5 cursor-pointer"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {/* Password Strength Meter */}
          {password && (
            <div className="mt-1.5 space-y-1">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-[#71717a]">Password Strength:</span>
                <span className={`font-bold ${strength.score === 3 ? 'text-emerald-400' : strength.score === 2 ? 'text-amber-400' : 'text-red-400'}`}>
                  {strength.label}
                </span>
              </div>
              <div className="h-1 bg-[#09090b] rounded-full overflow-hidden border border-[#27272a] flex gap-1 p-0.5">
                <div className={`h-full flex-1 rounded-full ${strength.score >= 1 ? strength.color : 'bg-[#27272a]'}`}></div>
                <div className={`h-full flex-1 rounded-full ${strength.score >= 2 ? strength.color : 'bg-[#27272a]'}`}></div>
                <div className={`h-full flex-1 rounded-full ${strength.score >= 3 ? strength.color : 'bg-[#27272a]'}`}></div>
              </div>
            </div>
          )}
          {errors.password && <p className="text-[10px] text-red-400 mt-0.5 font-medium">{errors.password}</p>}
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-[11px] uppercase tracking-wider font-bold text-[#71717a] mb-1">
            Confirm Password
          </label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              if (errors.confirmPassword) setErrors({ ...errors, confirmPassword: undefined });
            }}
            placeholder="Re-enter password"
            className={`w-full bg-[#09090b] border rounded-xl px-3.5 py-2 text-xs text-[#fafafa] focus:outline-none placeholder-[#52525b] ${
              errors.confirmPassword ? 'border-red-500/80' : 'border-[#27272a] focus:border-emerald-500'
            }`}
          />
          {errors.confirmPassword && <p className="text-[10px] text-red-400 mt-0.5 font-medium">{errors.confirmPassword}</p>}
        </div>

        {/* Accept Terms */}
        <div>
          <div className="flex items-start gap-2">
            <input
              id="terms"
              type="checkbox"
              checked={acceptTerms}
              onChange={(e) => setAcceptTerms(e.target.checked)}
              className="w-4 h-4 mt-0.5 rounded border-[#27272a] bg-[#09090b] text-emerald-600 focus:ring-emerald-500 cursor-pointer"
            />
            <label htmlFor="terms" className="text-[11px] text-[#a1a1aa] cursor-pointer leading-tight">
              I agree to the <span className="text-emerald-400 hover:underline">Terms of Service</span> and <span className="text-emerald-400 hover:underline">Privacy Policy</span>.
            </label>
          </div>
          {errors.terms && <p className="text-[10px] text-red-400 mt-0.5 font-medium">{errors.terms}</p>}
        </div>

        {/* Submit: Create Account */}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-3 rounded-xl transition-all shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <span>Create Account</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      {/* Switch to Sign In */}
      <div className="pt-2 text-center text-xs text-[#71717a]">
        Already have an account?{' '}
        <button
          type="button"
          onClick={handleSignInNav}
          className="text-emerald-400 font-bold hover:underline cursor-pointer"
        >
          Sign In
        </button>
      </div>

      {onContinueAsGuest && (
        <div className="pt-3 border-t border-[#27272a]/80 mt-2 w-full">
          <button
            type="button"
            onClick={onContinueAsGuest}
            className="w-full bg-[#18181b] hover:bg-[#27272a] text-[#e4e4e7] hover:text-white border border-[#27272a] hover:border-[#3f3f46] font-semibold text-xs py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-[0.99]"
          >
            <UserCheck className="w-4 h-4 text-emerald-400" />
            <span>Continue as Guest</span>
          </button>
        </div>
      )}
    </AuthLayout>
  );
};
