import React, { useState, useEffect } from 'react';
import { X, User, Mail, DollarSign, Check, Camera, Upload, Trash2, Lock } from 'lucide-react';
import { UserProfile } from '../types';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  onSaveUser?: (updatedUser: UserProfile) => void;
  onSave?: (updatedUser: UserProfile) => void;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({
  isOpen,
  onClose,
  user,
  onSaveUser,
  onSave,
}) => {
  const [avatarUrl, setAvatarUrl] = useState<string>(user.avatarUrl || '');
  const [monthlyBudget, setMonthlyBudget] = useState<number | string>(user.liquidityLimit ?? 25000);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setAvatarUrl(user.avatarUrl || '');
      setMonthlyBudget(user.liquidityLimit ?? 25000);
      setUploadError(null);
    }
  }, [isOpen, user]);

  if (!isOpen) return null;

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
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Image size must be less than 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const result = uploadEvent.target?.result;
      if (typeof result === 'string') {
        // Optimize and compress avatar image for fast persistence and cross-device sync
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const parsedBudget = Number(monthlyBudget);
    const validBudget = isNaN(parsedBudget) || parsedBudget < 0 ? 0 : parsedBudget;

    // Full Name and Email are NEVER sent as editable changes from form inputs
    const updatedUser: UserProfile = {
      ...user,
      avatarUrl: avatarUrl ? avatarUrl : undefined,
      monthlyBudget: validBudget,
      liquidityLimit: validBudget,
    };

    const saveFn = onSaveUser || onSave;
    if (saveFn) {
      saveFn(updatedUser);
    }
    onClose();
  };

  return (
    <div
      id="edit-profile-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="edit-profile-modal-card"
        className="relative w-full max-w-md bg-[#18181b] border border-[#27272a] rounded-2xl p-5 sm:p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#27272a] pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#fafafa]">Edit Profile</h2>
              <p className="text-xs text-[#a1a1aa]">Manage your picture and monthly budget</p>
            </div>
          </div>
          <button
            id="close-profile-modal-btn"
            onClick={onClose}
            className="text-[#71717a] hover:text-[#fafafa] p-1.5 rounded-lg hover:bg-[#27272a] transition-colors cursor-pointer"
            aria-label="Close Profile Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Section 1: Profile Picture */}
          <div className="bg-[#09090b] border border-[#27272a] p-3.5 rounded-xl space-y-2.5">
            <label className="block text-[11px] uppercase tracking-wider font-bold text-[#71717a]">
              Profile Picture
            </label>
            <div className="flex items-center gap-3.5">
              <div className="relative group shrink-0">
                <div
                  className={`w-14 h-14 rounded-full overflow-hidden flex items-center justify-center font-bold text-lg text-white shadow-md border-2 border-emerald-500/40 bg-gradient-to-tr ${
                    user.avatarGradient || 'from-emerald-600 to-teal-500'
                  }`}
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
                <label
                  className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  title="Upload New Picture"
                >
                  <Camera className="w-4 h-4 text-white" />
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/jpg"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="flex-1 space-y-1.5 min-w-0">
                <div className="flex items-center gap-2">
                  <label
                    id="upload-profile-picture-btn"
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Picture</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/jpg"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </label>

                  {avatarUrl && (
                    <button
                      id="remove-profile-picture-btn"
                      type="button"
                      onClick={() => setAvatarUrl('')}
                      className="px-2.5 py-1.5 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 text-rose-400 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove</span>
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-[#71717a]">
                  Supports JPG, PNG or WEBP up to 5MB.
                </p>
                {uploadError && (
                  <p className="text-[10px] text-rose-400 font-medium">{uploadError}</p>
                )}
              </div>
            </div>
          </div>

          {/* Section 2: Full Name (READ-ONLY) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="profile-full-name-input"
                className="text-[11px] uppercase tracking-wider font-bold text-[#71717a]"
              >
                Full Name
              </label>
              <span className="text-[10px] text-[#71717a] flex items-center gap-1 font-medium">
                <Lock className="w-3 h-3 text-[#52525b]" />
                <span>Read-only</span>
              </span>
            </div>
            <div className="relative">
              <input
                id="profile-full-name-input"
                type="text"
                value={user.name}
                readOnly
                disabled
                aria-readonly="true"
                className="w-full bg-[#121215] border border-[#27272a] rounded-xl pl-9 pr-8 py-2 text-xs text-[#d4d4d8] cursor-not-allowed select-none focus:outline-none"
              />
              <User className="w-4 h-4 text-[#52525b] absolute left-3 top-2.5" />
              <Lock className="w-3.5 h-3.5 text-[#52525b] absolute right-3 top-2.5" />
            </div>
          </div>

          {/* Section 3: Email (READ-ONLY) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="profile-email-input"
                className="text-[11px] uppercase tracking-wider font-bold text-[#71717a]"
              >
                Email
              </label>
              <span className="text-[10px] text-[#71717a] flex items-center gap-1 font-medium">
                <Lock className="w-3 h-3 text-[#52525b]" />
                <span>Read-only</span>
              </span>
            </div>
            <div className="relative">
              <input
                id="profile-email-input"
                type="email"
                value={user.email}
                readOnly
                disabled
                aria-readonly="true"
                className="w-full bg-[#121215] border border-[#27272a] rounded-xl pl-9 pr-8 py-2 text-xs text-[#d4d4d8] cursor-not-allowed select-none focus:outline-none"
              />
              <Mail className="w-4 h-4 text-[#52525b] absolute left-3 top-2.5" />
              <Lock className="w-3.5 h-3.5 text-[#52525b] absolute right-3 top-2.5" />
            </div>
          </div>

          {/* Section 4: Monthly Budget (EDITABLE) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="profile-monthly-budget-input"
                className="text-[11px] uppercase tracking-wider font-bold text-[#71717a]"
              >
                Monthly Budget ($)
              </label>
            </div>
            <div className="relative">
              <input
                id="profile-monthly-budget-input"
                type="number"
                min="0"
                step="100"
                value={monthlyBudget}
                onChange={(e) => setMonthlyBudget(e.target.value)}
                className="w-full bg-[#09090b] border border-[#27272a] focus:border-emerald-500 rounded-xl pl-9 pr-3 py-2 text-xs text-[#fafafa] focus:outline-none font-mono"
                placeholder="25000"
              />
              <DollarSign className="w-4 h-4 text-[#10b981] absolute left-3 top-2.5" />
            </div>
            <p className="text-[10px] text-[#71717a] mt-1">
              Your target monthly spending limit in USD.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#27272a]">
            <button
              id="cancel-profile-btn"
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-[#27272a] hover:bg-[#27272a] text-xs font-semibold text-[#a1a1aa] hover:text-white transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              id="save-profile-btn"
              type="submit"
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white transition-all shadow-md shadow-emerald-600/30 flex items-center gap-1.5 cursor-pointer active:scale-[0.98]"
            >
              <Check className="w-4 h-4" />
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
