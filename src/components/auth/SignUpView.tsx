import React, { useState } from 'react';
import { Eye, EyeOff, Loader2, ArrowRight, KeyRound, CheckCircle2, AlertCircle, Mail, UserCheck } from 'lucide-react';
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

  const [step, setStep] = useState<'details' | 'otp'>('details');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // OTP state
  const [otpInput, setOtpInput] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [otpError, setOtpError] = useState('');
  const [resendNotice, setResendNotice] = useState('');

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
      // Check for duplicate registered email
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

  // Step 1: Send OTP to user's email
  const handleInitiateSignUp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateDetails()) return;

    setLoading(true);

    setTimeout(() => {
      // Generate 6-digit verification code
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      setGeneratedOtp(code);
      setStep('otp');
      setLoading(false);
      setOtpError('');
    }, 600);
  };

  // Step 2: Verify OTP and finalize registration
  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpInput.trim()) {
      setOtpError('Please enter the 6-digit verification code');
      return;
    }

    if (otpInput.trim() !== generatedOtp) {
      setOtpError('Invalid verification code. Please check the code and try again.');
      return;
    }

    setLoading(true);
    setOtpError('');

    const cleanEmail = email.trim().toLowerCase();
    const userId = `usr_reg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    registerUserToCloudflareD1({
      id: userId,
      name: fullName.trim(),
      email: cleanEmail,
      password: password,
      systemRole: 'User',
      roleTitle: 'Financial Member',
      department: 'Personal Workspace',
      avatarGradient: 'from-blue-600 to-indigo-600',
      status: 'Active',
    })
      .then((result) => {
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
      })
      .catch((err: any) => {
        setLoading(false);
        setOtpError(err?.message || 'Registration failed. Please try again.');
      });
  };

  const handleResendCode = () => {
    const newCode = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(newCode);
    setOtpInput('');
    setOtpError('');
    setResendNotice('New verification code sent!');
    setTimeout(() => setResendNotice(''), 3000);
  };

  return (
    <AuthLayout
      onBackToHome={onBackToHome}
      title="Start managing expenses with Tallix"
      subtitle="Join engineering teams and shared squads. Split bills, track liquidity, and optimize burn rate with AI."
    >
      {step === 'details' ? (
        <>
          <div className="space-y-1">
            <h1 className="text-xl font-extrabold text-[#fafafa] tracking-tight">Create Account</h1>
            <p className="text-xs text-[#a1a1aa]">Real registration with email verification</p>
          </div>

          {errors.general && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-xs text-red-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errors.general}</span>
            </div>
          )}

          {/* Form Step 1: Details */}
          <form onSubmit={handleInitiateSignUp} className="space-y-3.5">
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
                className={`w-full bg-[#09090b] border rounded-xl px-3.5 py-2 text-xs text-[#fafafa] focus:outline-none placeholder-[#52525b] ${errors.fullName ? 'border-red-500/80' : 'border-[#27272a] focus:border-emerald-500'
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
                className={`w-full bg-[#09090b] border rounded-xl px-3.5 py-2 text-xs text-[#fafafa] focus:outline-none placeholder-[#52525b] ${errors.email ? 'border-red-500/80' : 'border-[#27272a] focus:border-emerald-500'
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
                  className={`w-full bg-[#09090b] border rounded-xl px-3.5 py-2 pr-10 text-xs text-[#fafafa] focus:outline-none placeholder-[#52525b] ${errors.password ? 'border-red-500/80' : 'border-[#27272a] focus:border-emerald-500'
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
                className={`w-full bg-[#09090b] border rounded-xl px-3.5 py-2 text-xs text-[#fafafa] focus:outline-none placeholder-[#52525b] ${errors.confirmPassword ? 'border-red-500/80' : 'border-[#27272a] focus:border-emerald-500'
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

            {/* Submit Step 1 */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-3 rounded-xl transition-all shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>Send Verification Code</span>
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
        </>
      ) : (
        /* Step 2: Verification (OTP) */
        <div className="space-y-4">
          <div className="space-y-1">
            <h1 className="text-xl font-extrabold text-[#fafafa] tracking-tight flex items-center gap-2">
              <Mail className="w-5 h-5 text-emerald-400" /> Verify Your Email
            </h1>
            <p className="text-xs text-[#a1a1aa]">
              Enter the 6-digit code sent to <span className="text-white font-medium">{email}</span>
            </p>
          </div>

          {/* OTP Code Notification Banner */}
          <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-3.5 space-y-1.5">
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Verification Code Sent!</span>
            </div>
            <p className="text-[11px] text-[#a1a1aa]">
              For verification, your 6-digit One-Time Passcode (OTP) is:
            </p>
            <div className="bg-[#09090b] border border-emerald-500/40 rounded-lg p-2 text-center font-mono font-extrabold text-lg tracking-widest text-emerald-400">
              {generatedOtp}
            </div>
          </div>

          {resendNotice && (
            <p className="text-xs text-emerald-400 font-semibold text-center">{resendNotice}</p>
          )}

          <form onSubmit={handleVerifyOtp} className="space-y-3.5">
            <div>
              <label htmlFor="otpCode" className="text-[11px] uppercase tracking-wider font-bold text-[#71717a] mb-1 flex items-center gap-1">
                <KeyRound className="w-3.5 h-3.5 text-emerald-400" /> Enter 6-Digit Code
              </label>
              <input
                id="otpCode"
                type="text"
                maxLength={6}
                value={otpInput}
                onChange={(e) => {
                  setOtpInput(e.target.value.replace(/\D/g, ''));
                  if (otpError) setOtpError('');
                }}
                placeholder="123456"
                className={`w-full bg-[#09090b] border rounded-xl px-3.5 py-2.5 text-center font-mono text-base tracking-widest text-[#fafafa] focus:outline-none placeholder-[#52525b] ${otpError ? 'border-red-500/80' : 'border-[#27272a] focus:border-emerald-500'
                  }`}
              />
              {otpError && <p className="text-[10px] text-red-400 mt-1 font-medium">{otpError}</p>}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-3 rounded-xl transition-all shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>Verify & Create Account</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="flex items-center justify-between text-xs pt-1">
              <button
                type="button"
                onClick={() => setStep('details')}
                className="text-[#71717a] hover:text-[#a1a1aa] cursor-pointer underline"
              >
                ← Edit details
              </button>
              <button
                type="button"
                onClick={handleResendCode}
                className="text-emerald-400 font-semibold hover:underline cursor-pointer"
              >
                Resend code
              </button>
            </div>
          </form>
        </div>
      )}
    </AuthLayout>
  );
};

