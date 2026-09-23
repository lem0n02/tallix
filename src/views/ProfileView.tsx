import React, { useState, useEffect } from 'react';
import { User, Mail, DollarSign, Camera, Upload, Trash2, Lock, CheckCircle2, Shield, AlertCircle } from 'lucide-react';
import { UserProfile, LanguageMode } from '../types';

interface ProfileViewProps {
  user: UserProfile;
  onSaveUser: (updatedUser: UserProfile) => void | Promise<void>;
  lang?: LanguageMode;
  onNavigate?: (path: string) => void;
  onExitGuestMode?: () => void;
  isGuestSession?: boolean;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  user,
  onSaveUser,
  onExitGuestMode,
  isGuestSession,
}) => {
  const [avatarUrl, setAvatarUrl] = useState<string>(user.avatarUrl || '');
  const [monthlyBudget, setMonthlyBudget] = useState<number | string>(user.liquidityLimit ?? 25000);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    setAvatarUrl(user.avatarUrl || '');
    setMonthlyBudget(user.liquidityLimit ?? 25000);
  }, [user]);

  const getInitials = (str: string) => {
    if (!str) return 'U';
    const parts = str.trim().split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return str.slice(0, 2).toUpperCase();
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    setSaveSuccess(false);

    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Image size must be less than 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const result = uploadEvent.target?.result;
      if (typeof result === 'string') {
        const img = new Image();
        img.onload = () => {
          const maxDim = 256;
          let width = img.width;
          let height = img.height;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const optimized = canvas.toDataURL('image/jpeg', 0.85);
            setAvatarUrl(optimized);
          } else {
            setAvatarUrl(result);
          }
        };
        img.onerror = () => {
          setAvatarUrl(result);
        };
        img.src = result;
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePicture = () => {
    setAvatarUrl('');
    setSaveSuccess(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const parsedBudget = Number(monthlyBudget);
      const validBudget = isNaN(parsedBudget) || parsedBudget < 0 ? 0 : parsedBudget;

      const updatedUser: UserProfile = {
        ...user,
        avatarUrl: avatarUrl ? avatarUrl : undefined,
        monthlyBudget: validBudget,
        liquidityLimit: validBudget,
      };

      await onSaveUser(updatedUser);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch {
      // Handled in parent
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 max-w-4xl mx-auto w-full space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between pb-4 border-b border-[#27272a]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold">
            <User className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-[#fafafa]">Profile & Account Settings</h1>
            <p className="text-xs text-[#a1a1aa]">Manage your public avatar and monthly personal spend limit</p>
          </div>
        </div>

        {saveSuccess && (
          <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg animate-in fade-in">
            <CheckCircle2 className="w-4 h-4" />
            <span>{user.isGuest || isGuestSession ? 'Profile saved locally' : 'Profile synced successfully'}</span>
          </div>
        )}
      </div>

      {(user.isGuest || isGuestSession) && (
        <div className="bg-amber-500/10 border border-amber-500/25 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-300">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
              <AlertCircle className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-white">Temporary Guest Mode Active</p>
              <p className="text-[11px] text-amber-300/80">
                You are exploring Tallix without a permanent account. Guest data is stored locally on this device only and will not sync to any server.
              </p>
            </div>
          </div>
          {onExitGuestMode && (
            <button
              type="button"
              onClick={onExitGuestMode}
              className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 font-semibold text-xs transition-colors cursor-pointer"
            >
              Exit Guest Mode
            </button>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: PROFILE PICTURE */}
        <div className="bg-[#18181b]/70 border border-[#27272a] rounded-2xl p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-[#a1a1aa] flex items-center gap-2">
              <Camera className="w-4 h-4 text-emerald-400" />
              <span>Profile Picture</span>
            </label>
            <span className="text-[11px] text-[#71717a]">Supported: JPG, PNG, WebP (Max 5MB)</span>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-5">
            <div className="relative group shrink-0">
              <div
                className={`w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden bg-gradient-to-tr ${
                  user.avatarGradient || 'from-emerald-500 to-teal-500'
                } flex items-center justify-center font-bold text-2xl text-white shadow-lg border-2 border-[#27272a]`}
              >
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={user.name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span>{getInitials(user.name)}</span>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2.5 w-full sm:w-auto">
              <div className="flex items-center gap-2">
                <label
                  htmlFor="profile-picture-upload-input"
                  className="bg-white hover:bg-[#e4e4e7] active:scale-95 text-black text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-2 transition-all cursor-pointer shadow-sm"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{avatarUrl ? 'Change Picture' : 'Upload Picture'}</span>
                  <input
                    id="profile-picture-upload-input"
                    type="file"
                    accept="image/png, image/jpeg, image/webp"
                    className="hidden"
                    onChange={handleImageUpload}
                  />
                </label>

                {avatarUrl && (
                  <button
                    type="button"
                    onClick={handleRemovePicture}
                    className="bg-[#27272a] hover:bg-[#3f3f46] text-red-400 hover:text-red-300 text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer border border-[#3f3f46]"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Remove</span>
                  </button>
                )}
              </div>

              {uploadError && (
                <p className="text-xs text-red-400 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{uploadError}</span>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Section 2: FULL NAME (READ-ONLY) */}
        <div className="bg-[#18181b]/70 border border-[#27272a] rounded-2xl p-5 sm:p-6 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-[#a1a1aa] flex items-center gap-2">
              <User className="w-4 h-4 text-emerald-400" />
              <span>Full Name</span>
            </label>
            <span className="text-[10px] text-amber-400/80 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded flex items-center gap-1">
              <Lock className="w-2.5 h-2.5" />
              <span>Read-Only</span>
            </span>
          </div>

          <div className="relative">
            <input
              type="text"
              value={user.name || ''}
              readOnly
              disabled
              className="w-full bg-[#09090b]/80 border border-[#27272a] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-[#fafafa] font-medium opacity-90 cursor-not-allowed select-none"
            />
          </div>
          <p className="text-[11px] text-[#71717a]">
            Full name is governed by your organization identity and cannot be altered from Profile.
          </p>
        </div>

        {/* Section 3: EMAIL (READ-ONLY) */}
        <div className="bg-[#18181b]/70 border border-[#27272a] rounded-2xl p-5 sm:p-6 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-[#a1a1aa] flex items-center gap-2">
              <Mail className="w-4 h-4 text-emerald-400" />
              <span>Email Address</span>
            </label>
            <span className="text-[10px] text-amber-400/80 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded flex items-center gap-1">
              <Lock className="w-2.5 h-2.5" />
              <span>Read-Only</span>
            </span>
          </div>

          <div className="relative">
            <input
              type="email"
              value={user.email || ''}
              readOnly
              disabled
              className="w-full bg-[#09090b]/80 border border-[#27272a] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-[#fafafa] font-mono opacity-90 cursor-not-allowed select-none"
            />
          </div>
          <p className="text-[11px] text-[#71717a]">
            Your primary login email is fixed for account security and cross-device sync.
          </p>
        </div>

        {/* Section 4: MONTHLY BUDGET */}
        <div className="bg-[#18181b]/70 border border-[#27272a] rounded-2xl p-5 sm:p-6 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-[#a1a1aa] flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-400" />
              <span>Monthly Personal Budget (BDT)</span>
            </label>
            <span className="text-[11px] text-emerald-400 font-mono font-bold">
              ৳ {Number(monthlyBudget || 0).toLocaleString()}
            </span>
          </div>

          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-emerald-400 font-bold text-sm">
              ৳
            </div>
            <input
              type="number"
              min="0"
              step="500"
              value={monthlyBudget}
              onChange={(e) => setMonthlyBudget(e.target.value)}
              placeholder="e.g. 25000"
              className="w-full bg-[#09090b] border border-[#27272a] focus:border-emerald-500 rounded-xl pl-9 pr-4 py-2.5 text-xs sm:text-sm text-[#fafafa] font-mono focus:outline-none transition-colors"
            />
          </div>
          <p className="text-[11px] text-[#71717a]">
            Used for calculating budget burn-rate alerts, liquidity telemetry, and spend thresholds.
          </p>
        </div>

        {/* Section 5: ACCOUNT & ROLE SUMMARY */}
        <div className="bg-[#18181b]/40 border border-[#27272a] rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-blue-400" />
            <span className="text-[#a1a1aa]">Account Governance:</span>
            <span className="text-white font-semibold">{user.systemRole || 'User'}</span>
            <span className="text-[#71717a] font-mono text-[10px]">({user.department || 'Workspace'})</span>
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="bg-white hover:bg-[#e4e4e7] active:scale-95 disabled:opacity-50 text-black text-xs font-bold px-5 py-2.5 rounded-xl transition-all cursor-pointer shadow-md flex items-center gap-2 ml-auto"
          >
            {isSaving ? (
              <span>Saving Changes...</span>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Save Profile Changes</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
