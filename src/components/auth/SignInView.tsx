import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Loader2, ArrowRight, UserCheck } from 'lucide-react';
import { AuthLayout } from './AuthLayout';
import { UserProfile, RegisteredUser } from '../../types';
import { isFixedAdminCredentials, getFixedAdminProfile } from '../../config/fixedAdminAuth';
import { loginUserViaD1, loginUserViaGoogle } from '../../services/authService';
import { buildApiUrl, fetchGoogleClientId, getGoogleClientIdSync } from '../../services/apiConfig';

interface SignInViewProps {
  onBackToHome?: () => void;
  onNavigateToSignUp?: () => void;
  onNavigateToForgotPassword?: () => void;
  onSuccessAuth?: (user: UserProfile) => void;
  registeredUsers?: RegisteredUser[];
  onSuccess?: (user: UserProfile) => void;
  onSwitchToSignUp?: () => void;
  onForgotPassword?: () => void;
  onOpenGuestModal?: () => void;
  onContinueAsGuest?: () => void;
}

export const SignInView: React.FC<SignInViewProps> = ({
  onBackToHome = () => { },
  onNavigateToSignUp,
  onNavigateToForgotPassword,
  onSuccessAuth,
  registeredUsers = [],
  onSuccess,
  onSwitchToSignUp,
  onForgotPassword,
  onOpenGuestModal,
  onContinueAsGuest,
}) => {
  const handleSuccess = onSuccessAuth || onSuccess || (() => { });
  const handleSignUpNav = onNavigateToSignUp || onSwitchToSignUp || (() => { });
  const handleForgotNav = onNavigateToForgotPassword || onForgotPassword || (() => { });

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [runtimeClientId, setRuntimeClientId] = useState<string>(() => getGoogleClientIdSync());
  const [errors, setErrors] = useState<{ email?: string; password?: string; general?: string }>({});

  useEffect(() => {
    let isMounted = true;
    if (!runtimeClientId) {
      fetchGoogleClientId().then((id) => {
        if (isMounted && id) {
          setRuntimeClientId(id);
        }
      });
    }
    return () => {
      isMounted = false;
    };
  }, [runtimeClientId]);

  const validate = () => {
    const errs: { email?: string; password?: string; general?: string } = {};
    if (!email.trim()) {
      errs.email = 'Email address is required';
    } else if (!/\S+@\S+\.\S+/.test(email.trim())) {
      errs.email = 'Please enter a valid email address';
    }

    if (!password) {
      errs.password = 'Password is required';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleAuthenticate = async (emailToAuth: string, pwdToAuth: string) => {
    const cleanEmail = emailToAuth.trim().toLowerCase();

    // 1. Hardcoded Fixed Admin Credential Check
    // When the exact hardcoded admin email and password are provided, authenticate as Super Administrator
    if (isFixedAdminCredentials(cleanEmail, pwdToAuth)) {
      const adminProfile = getFixedAdminProfile();
      handleSuccess(adminProfile);
      setLoading(false);
      return;
    }

    // 2. Authoritative Login via Cloudflare D1
    try {
      const result = await loginUserViaD1(cleanEmail, pwdToAuth);
      if (result.success && result.user) {
        handleSuccess(result.user);
        return;
      }

      const errorMsg = result.error || 'Authentication failed. Please check your credentials.';
      const lower = errorMsg.toLowerCase();
      if (lower.includes('no account found')) {
        setErrors({ email: 'No account found. Please create an account first.' });
      } else if (lower.includes('disabled')) {
        setErrors({ general: 'This user account has been disabled. Please contact the administrator.' });
      } else if (lower.includes('google sign-in') || lower.includes('sign in with google')) {
        setErrors({ general: errorMsg });
      } else if (lower.includes('invalid email or password')) {
        setErrors({ password: 'Invalid email or password. Please try again.' });
      } else {
        setErrors({ general: errorMsg });
      }
    } catch (err: any) {
      setErrors({ general: err?.message || 'An unexpected error occurred during sign in.' });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    await handleAuthenticate(email, password);
  };

  const handleGoogleSignIn = async () => {
    setErrors({});
    let clientId = runtimeClientId || getGoogleClientIdSync();

    if (!clientId) {
      setGoogleLoading(true);
      try {
        clientId = await fetchGoogleClientId();
        if (clientId) {
          setRuntimeClientId(clientId);
        }
      } catch {
        // ignore
      } finally {
        setGoogleLoading(false);
      }
    }

    if (!clientId) {
      setErrors({
        general: 'Google Sign-In is not configured. Please set VITE_GOOGLE_CLIENT_ID in your environment variables.',
      });
      return;
    }

    if (typeof window === 'undefined' || (!window.google?.accounts?.id && !window.google?.accounts?.oauth2)) {
      setErrors({
        general: 'Google Identity Service is loading or blocked by your browser. Please check your connection or disable ad blockers.',
      });
      return;
    }

    setGoogleLoading(true);

    const onGoogleToken = async (token: string, isAccessToken: boolean) => {
      try {
        const result = await loginUserViaGoogle(token, isAccessToken);
        if (result.success && result.user) {
          handleSuccess(result.user);
          return;
        }

        const errorMsg = result.error || 'Google authentication failed.';
        const lower = errorMsg.toLowerCase();
        if (lower.includes('disabled')) {
          setErrors({ general: 'This user account has been disabled. Please contact the administrator.' });
        } else {
          setErrors({ general: errorMsg });
        }
      } catch (err: any) {
        setErrors({ general: err?.message || 'An unexpected error occurred during Google sign in.' });
      } finally {
        setGoogleLoading(false);
      }
    };

    // 1. Prefer OAuth2 Popup Token Client (works across all browsers, cookies configurations, and iframes)
    if (window.google?.accounts?.oauth2?.initTokenClient) {
      try {
        const tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: 'email profile openid',
          callback: async (tokenRes) => {
            if (tokenRes?.access_token) {
              await onGoogleToken(tokenRes.access_token, true);
            } else if (tokenRes?.error) {
              setErrors({ general: `Google Sign-In error: ${tokenRes.error_description || tokenRes.error}` });
              setGoogleLoading(false);
            }
          },
          error_callback: () => {
            setErrors({ general: 'Google sign-in popup was cancelled or blocked.' });
            setGoogleLoading(false);
          },
        });
        tokenClient.requestAccessToken({ prompt: 'select_account' });
        return;
      } catch (err) {
        console.warn('[GoogleAuth] OAuth2 client init error, falling back to One-Tap prompt:', err);
      }
    }

    // 2. Fallback to Google Identity Services One Tap / ID Token
    if (window.google?.accounts?.id) {
      try {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: async (res: any) => {
            if (res?.credential) {
              await onGoogleToken(res.credential, false);
            } else {
              setGoogleLoading(false);
            }
          },
          auto_select: false,
          cancel_on_tap_outside: true,
        });

        window.google.accounts.id.prompt((notification: any) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            setGoogleLoading(false);
          }
        });
      } catch (err: any) {
        setErrors({ general: err?.message || 'Failed to initialize Google Sign-In.' });
        setGoogleLoading(false);
      }
    }
  };

  return (
    <AuthLayout
      onBackToHome={onBackToHome}
      title="Welcome back to Tallix"
      subtitle="Sign in to your account to manage personal expenses and collaborate in shared squads."
    >
      <div className="space-y-1">
        <h1 className="text-xl font-extrabold text-[#fafafa] tracking-tight">Sign In</h1>
        <p className="text-xs text-[#a1a1aa]">Enter your account credentials to continue</p>
      </div>

      {/* General Error Banner */}
      {errors.general && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400 font-medium">
          {errors.general}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-[11px] uppercase tracking-wider font-bold text-[#71717a] mb-1">
            Email Address
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (errors.email) setErrors({ ...errors, email: undefined });
            }}
            placeholder="name@company.com"
            className={`w-full bg-[#09090b] border rounded-xl px-3.5 py-2.5 text-xs text-[#fafafa] focus:outline-none placeholder-[#52525b] ${errors.email ? 'border-red-500/80 focus:border-red-500' : 'border-[#27272a] focus:border-emerald-500'
              }`}
          />
          {errors.email && <p className="text-[10px] text-red-400 mt-1 font-medium">{errors.email}</p>}
        </div>

        <div>
          <div className="flex justify-between items-center mb-1">
            <label htmlFor="password" className="block text-[11px] uppercase tracking-wider font-bold text-[#71717a]">
              Password
            </label>
            {(onNavigateToForgotPassword || onForgotPassword) && (
              <button
                type="button"
                onClick={handleForgotNav}
                className="text-[10px] text-emerald-400 hover:underline cursor-pointer font-medium"
              >
                Forgot Password?
              </button>
            )}
          </div>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errors.password) setErrors({ ...errors, password: undefined });
              }}
              placeholder="••••••••••••"
              className={`w-full bg-[#09090b] border rounded-xl px-3.5 py-2.5 pr-10 text-xs text-[#fafafa] focus:outline-none placeholder-[#52525b] ${errors.password ? 'border-red-500/80 focus:border-red-500' : 'border-[#27272a] focus:border-emerald-500'
                }`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-2.5 text-[#71717a] hover:text-[#fafafa] p-0.5 cursor-pointer"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {errors.password && <p className="text-[10px] text-red-400 mt-1 font-medium">{errors.password}</p>}
        </div>

        {/* Remember Me */}
        <div className="flex items-center gap-2">
          <input
            id="remember"
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="w-4 h-4 rounded border-[#27272a] bg-[#09090b] text-emerald-600 focus:ring-emerald-500 cursor-pointer"
          />
          <label htmlFor="remember" className="text-xs text-[#a1a1aa] cursor-pointer">
            Remember this browser session
          </label>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading || googleLoading}
          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-3 rounded-xl transition-all shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <span>Sign In</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      {/* Divider */}
      <div className="relative my-4 flex items-center justify-center">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-[#27272a]"></div>
        </div>
        <div className="relative px-3 bg-[#18181b] text-[11px] font-semibold text-[#71717a] uppercase tracking-wider">
          OR
        </div>
      </div>

      {/* Continue with Google */}
      <button
        type="button"
        disabled={loading || googleLoading}
        onClick={handleGoogleSignIn}
        className="w-full bg-[#18181b] hover:bg-[#27272a] active:scale-[0.99] text-[#fafafa] border border-[#27272a] hover:border-[#3f3f46] font-semibold text-xs py-3 rounded-xl transition-all flex items-center justify-center gap-3 cursor-pointer shadow-sm disabled:opacity-50"
      >
        {googleLoading ? (
          <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
        ) : (
          <>
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Continue with Google</span>
          </>
        )}
      </button>

      {/* Guest Mode & Sign Up */}
      <div className="pt-2 flex flex-col items-center gap-2 text-xs text-[#71717a]">
        <div>
          Don&apos;t have an account?{' '}
          <button
            type="button"
            onClick={handleSignUpNav}
            className="text-emerald-400 font-bold hover:underline cursor-pointer"
          >
            Create Free Account
          </button>
        </div>
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
