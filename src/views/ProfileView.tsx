import React, { useState, useEffect, useMemo } from 'react';
import { User, Upload, Trash2, CheckCircle2, AlertCircle, FileText, Eye, EyeOff, Lock, KeyRound, ShieldCheck, Download, Calendar } from 'lucide-react';
import { UserProfile, LanguageMode, Expense, Settlement } from '../types';
import { getAvailableReportMonths, downloadMonthlyPdf } from '../utils/pdfReportGenerator';
import { formatMonthDisplay } from '../utils/monthFilter';
import { MonthlyReportModal } from '../components/MonthlyReportModal';
import { useLanguage } from '../i18n/LanguageContext';
import { buildApiUrl } from '../services/apiConfig';

interface ProfileViewProps {
  user: UserProfile;
  onSaveUser: (updatedUser: UserProfile) => void | Promise<void>;
  onDeleteAccount?: () => void | Promise<void>;
  lang?: LanguageMode;
  onNavigate?: (path: string) => void;
  onExitGuestMode?: () => void;
  isGuestSession?: boolean;
  expenses?: Expense[];
  settlements?: Settlement[];
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  user,
  onSaveUser,
  onDeleteAccount,
  onExitGuestMode,
  isGuestSession,
  expenses = [],
  settlements = [],
}) => {
  const { t } = useLanguage();
  const [avatarUrl, setAvatarUrl] = useState<string>(user.avatarUrl || '');
  const [monthlyBudget, setMonthlyBudget] = useState<number | string>(user.liquidityLimit ?? 25000);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [selectedReportMonth, setSelectedReportMonth] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  // Security & Password Management State
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const availableMonths = useMemo(() => {
    return getAvailableReportMonths(expenses, settlements);
  }, [expenses, settlements]);

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

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!newPassword) {
      setPasswordError('Please enter a new password.');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match.');
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const res = await fetch(buildApiUrl('/api/user/update-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, email: user.email, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setPasswordSuccess('Password successfully updated in production! You can now use this password across all devices and fresh browsers.');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setPasswordError(data.error || 'Failed to update password. Please try again.');
      }
    } catch (err: any) {
      setPasswordError(err?.message || 'Network error updating password.');
    } finally {
      setIsUpdatingPassword(false);
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

      {/* Unified Profile Settings Form */}
      <form onSubmit={handleSubmit} className="bg-[#18181b]/70 border border-[#27272a] rounded-2xl p-5 sm:p-6 space-y-6">
        {/* Profile Picture */}
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-[#a1a1aa] block mb-3">
            Profile Picture
          </label>
          <div className="flex items-center gap-4">
            <div
              className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden bg-gradient-to-tr ${
                user.avatarGradient || 'from-emerald-500 to-teal-500'
              } flex items-center justify-center font-bold text-xl sm:text-2xl text-white shadow-md border border-[#27272a] shrink-0`}
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

            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <label
                  htmlFor="profile-picture-upload-input"
                  className="bg-white hover:bg-[#e4e4e7] active:scale-95 text-black text-xs font-bold px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
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
              <p className="text-[11px] text-[#71717a]">Supported formats: JPG, PNG, WebP (Max 5MB)</p>
              {uploadError && (
                <p className="text-xs text-red-400 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{uploadError}</span>
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-[#27272a]" />

        {/* Profile Inputs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Full Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-[#a1a1aa] block">
              Full Name
            </label>
            <input
              type="text"
              value={user.name || ''}
              readOnly
              disabled
              className="w-full bg-[#09090b]/80 border border-[#27272a] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-[#fafafa] font-medium opacity-90 cursor-not-allowed select-none"
            />
            <p className="text-[11px] text-[#71717a]">
              Full name is associated with your account identity.
            </p>
          </div>

          {/* Email Address */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-[#a1a1aa] block">
              Email Address
            </label>
            <input
              type="email"
              value={user.email || ''}
              readOnly
              disabled
              className="w-full bg-[#09090b]/80 border border-[#27272a] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-[#fafafa] font-mono opacity-90 cursor-not-allowed select-none"
            />
            <p className="text-[11px] text-[#71717a]">
              Primary email used for account security and synchronization.
            </p>
          </div>

          {/* Monthly Personal Budget */}
          <div className="space-y-1.5 sm:col-span-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-[#a1a1aa] block">
                Monthly Personal Budget (BDT)
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
              Used for personal spend thresholds and monthly liquidity calculations.
            </p>
          </div>
        </div>

        {/* Save Profile Changes */}
        <div className="flex items-center justify-end pt-4 border-t border-[#27272a]">
          <button
            type="submit"
            disabled={isSaving}
            className="bg-white hover:bg-[#e4e4e7] active:scale-95 disabled:opacity-50 text-black text-xs font-bold px-5 py-2.5 rounded-xl transition-all cursor-pointer shadow-md flex items-center gap-2"
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

      {/* Monthly Reports Section */}
      <div className="bg-[#18181b]/70 border border-[#27272a] rounded-2xl p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#27272a]">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#fafafa] flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-400" />
              <span>Monthly Reports</span>
            </h2>
            <p className="text-xs text-[#a1a1aa] mt-0.5">
              Monthly statements preserved and available offline.
            </p>
          </div>
          {availableMonths.length > 0 && (
            <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-0.5 rounded-md">
              {availableMonths.length} {availableMonths.length === 1 ? 'Report' : 'Reports'}
            </span>
          )}
        </div>

        {availableMonths.length === 0 ? (
          <p className="text-xs text-[#71717a] py-3 text-center">No monthly reports available yet.</p>
        ) : (
          <div className="space-y-2">
            {availableMonths.map((mKey) => {
              const display = formatMonthDisplay(mKey);
              return (
                <div
                  key={mKey}
                  className="bg-[#09090b] border border-[#27272a] hover:border-[#3f3f46] rounded-xl p-3 sm:px-4 sm:py-3 flex items-center justify-between gap-3 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs sm:text-sm font-semibold text-[#fafafa]">{display}</h3>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setSelectedReportMonth(mKey)}
                      className="px-3 py-1.5 rounded-lg bg-[#27272a] hover:bg-[#3f3f46] text-[#fafafa] text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer border border-[#3f3f46]"
                    >
                      <Eye className="w-3.5 h-3.5 text-blue-400" />
                      <span>View PDF</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadMonthlyPdf(mKey, user, expenses, settlements)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Danger Zone - Account Deletion */}
      {!user.isGuest && !isGuestSession && onDeleteAccount && (
        <div className="bg-red-950/20 border border-red-500/20 rounded-2xl p-5 sm:p-6 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-red-400 flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-red-400" />
                <span>{t('dangerZone')}</span>
              </h2>
              <p className="text-xs text-[#a1a1aa] mt-1 max-w-xl">
                {t('deleteAccountWarning')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowDeleteModal(true)}
              className="px-3.5 py-2 rounded-xl bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white border border-red-500/30 text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 self-start sm:self-auto"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{t('deleteAccount')}</span>
            </button>
          </div>
        </div>
      )}

      {/* Account Deletion Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#18181b] border border-red-500/40 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center gap-3 text-red-400">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center shrink-0">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#fafafa]">{t('deleteAccount')}</h3>
                <p className="text-xs text-red-300/80 font-mono">{user.email}</p>
              </div>
            </div>

            <p className="text-xs text-[#d4d4d8] leading-relaxed">
              {t('confirmDeleteAccount')}
            </p>

            <div className="p-3 bg-red-950/30 border border-red-500/20 rounded-xl text-[11px] text-red-300 space-y-1">
              <p className="font-semibold">• All personal expenses and settlements will be permanently erased.</p>
              <p className="font-semibold">• You will be removed from all squads and shared records.</p>
              <p className="font-semibold">• Your email will be freed immediately for fresh registration.</p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeletingAccount}
                className="px-4 py-2 rounded-xl bg-[#27272a] hover:bg-[#3f3f46] text-[#fafafa] text-xs font-semibold transition-colors cursor-pointer"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                disabled={isDeletingAccount}
                onClick={async () => {
                  if (onDeleteAccount) {
                    setIsDeletingAccount(true);
                    try {
                      await onDeleteAccount();
                    } finally {
                      setIsDeletingAccount(false);
                      setShowDeleteModal(false);
                    }
                  }
                }}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all cursor-pointer shadow-lg shadow-red-600/30 active:scale-95 disabled:opacity-50 flex items-center gap-2"
              >
                {isDeletingAccount ? (
                  <span>Deleting...</span>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Permanently Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Monthly Report PDF Preview Modal */}
      {selectedReportMonth && (
        <MonthlyReportModal
          isOpen={Boolean(selectedReportMonth)}
          onClose={() => setSelectedReportMonth(null)}
          monthKey={selectedReportMonth}
          user={user}
          expenses={expenses}
          settlements={settlements}
        />
      )}
    </div>
  );
};
