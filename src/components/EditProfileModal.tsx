import React, { useState } from 'react';
import { X, User, Mail, Briefcase, DollarSign, Check, Camera, Upload, Trash2, Layers } from 'lucide-react';
import { UserProfile } from '../types';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  onSaveUser?: (updatedUser: UserProfile) => void;
  onSave?: (updatedUser: UserProfile) => void;
}

const GRADIENT_OPTIONS = [
  { label: 'Emerald Teal', value: 'from-emerald-600 to-teal-500' },
  { label: 'Blue Indigo', value: 'from-blue-600 to-indigo-500' },
  { label: 'Violet Purple', value: 'from-violet-600 to-purple-500' },
  { label: 'Amber Orange', value: 'from-amber-500 to-orange-500' },
  { label: 'Rose Pink', value: 'from-rose-600 to-pink-500' },
  { label: 'Cyan Sky', value: 'from-cyan-500 to-blue-500' },
];

export const EditProfileModal: React.FC<EditProfileModalProps> = ({
  isOpen,
  onClose,
  user,
  onSaveUser,
  onSave,
}) => {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [title, setTitle] = useState(user.title || 'Staff Software Architect');
  const [department, setDepartment] = useState(user.department || 'Infrastructure & AI');
  const [liquidityLimit, setLiquidityLimit] = useState(user.liquidityLimit || 25000);
  const [avatarGradient, setAvatarGradient] = useState(user.avatarGradient || 'from-emerald-600 to-teal-500');
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl || '');
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});

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
    if (file.size > 5 * 1024 * 1024) {
      alert('Image file size must be less than 5MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setAvatarUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const validate = () => {
    const errs: { name?: string; email?: string } = {};
    if (!name.trim()) errs.name = 'Name is required';
    if (!email.trim()) {
      errs.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      errs.email = 'Enter a valid email address';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const updatedUser: UserProfile = {
      ...user,
      name,
      email,
      title,
      department,
      liquidityLimit: Number(liquidityLimit),
      avatarGradient,
      avatarUrl: avatarUrl || undefined,
    };

    const saveFn = onSaveUser || onSave;
    if (saveFn) {
      saveFn(updatedUser);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-lg bg-[#18181b] border border-[#27272a] rounded-2xl p-6 shadow-2xl space-y-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#27272a] pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#fafafa]">Edit User Profile</h2>
              <p className="text-xs text-[#a1a1aa]">Update your profile picture & personal details</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#71717a] hover:text-[#fafafa] p-1 rounded-lg hover:bg-[#27272a] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Avatar Picture Upload & Color Gradient */}
          <div className="bg-[#09090b] border border-[#27272a] p-4 rounded-xl space-y-3">
            <label className="block text-[11px] uppercase tracking-wider font-bold text-[#71717a]">
              Profile Picture
            </label>
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="relative group">
                <div
                  className={`w-16 h-16 rounded-full overflow-hidden flex items-center justify-center font-extrabold text-xl text-white shadow-lg shrink-0 border-2 border-emerald-500/50 bg-gradient-to-tr ${avatarGradient}`}
                >
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={name}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    getInitials(name)
                  )}
                </div>
                <label className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                  <Camera className="w-5 h-5 text-white" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="flex-1 space-y-2 w-full">
                <div className="flex items-center gap-2">
                  <label className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Picture</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </label>

                  {avatarUrl && (
                    <button
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
                  Upload your photo (JPG, PNG or WEBP up to 5MB).
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-[#1f1f23]">
              <span className="text-[10px] text-[#71717a] font-bold block mb-1.5">
                Fallback Gradient Color
              </span>
              <div className="grid grid-cols-6 gap-1.5">
                {GRADIENT_OPTIONS.map((grad) => (
                  <button
                    key={grad.value}
                    type="button"
                    onClick={() => setAvatarGradient(grad.value)}
                    className={`flex items-center justify-center p-1.5 rounded-lg border text-[10px] text-[#fafafa] transition-all cursor-pointer ${
                      avatarGradient === grad.value
                        ? 'border-emerald-500 bg-emerald-500/10 font-bold ring-1 ring-emerald-500/50'
                        : 'border-[#27272a] bg-[#141417] hover:border-[#3f3f46]'
                    }`}
                  >
                    <div className={`w-3.5 h-3.5 rounded-full bg-gradient-to-tr ${grad.value}`} />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Full Name & Email */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] uppercase tracking-wider font-bold text-[#71717a] mb-1">
                Full Name
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (errors.name) setErrors({ ...errors, name: undefined });
                  }}
                  className={`w-full bg-[#09090b] border rounded-xl pl-9 pr-3 py-2 text-xs text-[#fafafa] focus:outline-none ${
                    errors.name ? 'border-red-500' : 'border-[#27272a] focus:border-emerald-500'
                  }`}
                  placeholder="Sarah Chen"
                />
                <User className="w-4 h-4 text-[#71717a] absolute left-3 top-2.5" />
              </div>
              {errors.name && <p className="text-[10px] text-red-400 mt-1">{errors.name}</p>}
            </div>

            <div>
              <label className="block text-[11px] uppercase tracking-wider font-bold text-[#71717a] mb-1">
                Corporate Email
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errors.email) setErrors({ ...errors, email: undefined });
                  }}
                  className={`w-full bg-[#09090b] border rounded-xl pl-9 pr-3 py-2 text-xs text-[#fafafa] focus:outline-none ${
                    errors.email ? 'border-red-500' : 'border-[#27272a] focus:border-emerald-500'
                  }`}
                  placeholder="s.chen@tallix.io"
                />
                <Mail className="w-4 h-4 text-[#71717a] absolute left-3 top-2.5" />
              </div>
              {errors.email && <p className="text-[10px] text-red-400 mt-1">{errors.email}</p>}
            </div>
          </div>

          {/* Title & Department */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] uppercase tracking-wider font-bold text-[#71717a] mb-1">
                Job Title
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-[#09090b] border border-[#27272a] focus:border-emerald-500 rounded-xl pl-9 pr-3 py-2 text-xs text-[#fafafa] focus:outline-none"
                  placeholder="Principal Architect"
                />
                <Briefcase className="w-4 h-4 text-[#71717a] absolute left-3 top-2.5" />
              </div>
            </div>

            <div>
              <label className="block text-[11px] uppercase tracking-wider font-bold text-[#71717a] mb-1">
                Department
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full bg-[#09090b] border border-[#27272a] focus:border-emerald-500 rounded-xl pl-9 pr-3 py-2 text-xs text-[#fafafa] focus:outline-none"
                  placeholder="Infrastructure & AI"
                />
                <Layers className="w-4 h-4 text-[#71717a] absolute left-3 top-2.5" />
              </div>
            </div>
          </div>

          {/* Liquidity Limit */}
          <div>
            <label className="block text-[11px] uppercase tracking-wider font-bold text-[#71717a] mb-1">
              Monthly Liquidity Budget ($)
            </label>
            <div className="relative">
              <input
                type="number"
                value={liquidityLimit}
                onChange={(e) => setLiquidityLimit(Number(e.target.value))}
                className="w-full bg-[#09090b] border border-[#27272a] focus:border-emerald-500 rounded-xl pl-9 pr-3 py-2 text-xs text-[#fafafa] focus:outline-none font-mono"
                placeholder="25000"
              />
              <DollarSign className="w-4 h-4 text-[#71717a] absolute left-3 top-2.5" />
            </div>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#27272a]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-[#27272a] hover:bg-[#27272a] text-xs font-semibold text-[#a1a1aa] hover:text-white transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white transition-all shadow-md shadow-emerald-600/30 flex items-center gap-1.5 cursor-pointer"
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
