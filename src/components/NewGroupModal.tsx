import React, { useState } from 'react';
import { X, Users, Plus, Trash2, Camera, Upload } from 'lucide-react';
import { Group } from '../types';

interface NewGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateGroup?: (group: Group) => void;
  onSave?: (group: Group) => void;
}

export const NewGroupModal: React.FC<NewGroupModalProps> = ({
  isOpen,
  onClose,
  onCreateGroup,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [memberEmails, setMemberEmails] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState('');

  if (!isOpen) return null;

  const gradients = [
    'from-blue-600 to-indigo-600',
    'from-emerald-600 to-teal-600',
    'from-amber-600 to-orange-600',
    'from-purple-600 to-pink-600',
    'from-cyan-600 to-blue-600',
  ];

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
        setImageUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAddEmail = () => {
    if (newEmail && newEmail.includes('@') && !memberEmails.includes(newEmail)) {
      setMemberEmails([...memberEmails, newEmail]);
      setNewEmail('');
    }
  };

  const handleRemoveEmail = (email: string) => {
    setMemberEmails(memberEmails.filter((e) => e !== email));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const randomGradient = gradients[Math.floor(Math.random() * gradients.length)];

    const createdGroup: Group = {
      id: `grp_${Date.now()}`,
      name,
      description,
      category,
      imageUrl: imageUrl || undefined,
      members: [
        ...memberEmails.map((email, idx) => ({
          id: `usr_new_${idx}_${Date.now()}`,
          name: email.split('@')[0].replace('.', ' '),
          email,
          role: 'Member' as const,
          balance: 0,
        })),
      ],
      currency: 'BDT',
      avatarGradient: randomGradient,
      totalSpent: 0,
      unsettledAmount: 0,
      createdAt: new Date().toISOString().split('T')[0],
      inviteCode: `TLX-${name.replace(/[^a-zA-Z]/g, '').substring(0, 3).toUpperCase() || 'SQD'}-${Math.floor(100 + Math.random() * 900)}`,
    };

    const createFn = onCreateGroup || onSave;
    if (createFn) {
      createFn(createdGroup);
    }
    setImageUrl('');
    setName('');
    setDescription('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#18181b] border border-[#27272a] rounded-xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#27272a] flex items-center justify-between bg-[#1c1c1f]">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-500" />
            <h3 className="text-base font-bold text-[#fafafa] uppercase tracking-wider">
              Create Expense Squad
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-[#71717a] hover:text-[#fafafa] p-1 rounded-md hover:bg-[#27272a]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto custom-scrollbar">
          {/* Squad Profile Picture Section */}
          <div className="bg-[#09090b] border border-[#27272a] p-3.5 rounded-xl space-y-2">
            <label className="block text-[11px] uppercase tracking-wider font-bold text-[#71717a]">
              Squad Profile Picture (Optional)
            </label>
            <div className="flex items-center gap-3">
              <div className="relative group shrink-0">
                <div className="w-14 h-14 rounded-xl overflow-hidden bg-[#18181b] border border-[#27272a] flex items-center justify-center font-bold text-lg text-white shadow-md">
                  {imageUrl ? (
                    <img src={imageUrl} alt="Squad avatar" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-blue-400">{name ? name.charAt(0).toUpperCase() : 'S'}</span>
                  )}
                </div>
                <label className="absolute inset-0 bg-black/60 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                  <Camera className="w-4 h-4 text-white" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <label className="px-3 py-1 bg-[#27272a] hover:bg-[#3f3f46] text-[#fafafa] rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border border-[#3f3f46]">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Logo / Photo</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </label>
                  {imageUrl && (
                    <button
                      type="button"
                      onClick={() => setImageUrl('')}
                      className="px-2 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-[#71717a]">
                  If no image is uploaded, the initial letter avatar will be used as fallback.
                </p>
              </div>
            </div>
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-wider font-bold text-[#71717a] mb-1">
              Squad Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Q4 Conference & Travel"
              className="w-full bg-[#09090b] border border-[#27272a] rounded-lg px-3 py-2 text-sm text-[#fafafa] focus:outline-none focus:border-blue-500 placeholder-[#52525b]"
            />
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-wider font-bold text-[#71717a] mb-1">
              Category Focus
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-[#09090b] border border-[#27272a] rounded-lg px-3 py-2 text-sm text-[#fafafa] focus:outline-none focus:border-blue-500"
            >
              <option value="🏠 Rent">🏠 Rent</option>
              <option value="🍛 Food">🍛 Food</option>
              <option value="🛒 Groceries">🛒 Groceries</option>
              <option value="💡 Utilities">💡 Utilities</option>
              <option value="🌐 Internet">🌐 Internet</option>
              <option value="🚍 Transportation">🚍 Transportation</option>
              <option value="🎓 Education">🎓 Education</option>
              <option value="📱 Mobile & Subscriptions">📱 Mobile & Subscriptions</option>
              <option value="🩺 Health">🩺 Health</option>
              <option value="👕 Personal Care">👕 Personal Care</option>
              <option value="🎉 Entertainment">🎉 Entertainment</option>
              <option value="🛍️ Shopping">🛍️ Shopping</option>
              <option value="👨‍👩‍👧 Family">👨‍👩‍👧 Family</option>
              <option value="💰 Savings">💰 Savings</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-wider font-bold text-[#71717a] mb-1">
              Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short mandate or scope description..."
              className="w-full bg-[#09090b] border border-[#27272a] rounded-lg px-3 py-2 text-sm text-[#fafafa] focus:outline-none focus:border-blue-500 placeholder-[#52525b]"
            />
          </div>

          {/* Invite Members */}
          <div>
            <label className="block text-[11px] uppercase tracking-wider font-bold text-[#71717a] mb-1">
              Invite Squad Members (By Email)
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="colleague@tallix.io"
                className="flex-1 bg-[#09090b] border border-[#27272a] rounded-lg px-3 py-1.5 text-sm text-[#fafafa] focus:outline-none focus:border-blue-500 placeholder-[#52525b]"
              />
              <button
                type="button"
                onClick={handleAddEmail}
                className="bg-[#27272a] hover:bg-[#3f3f46] text-[#fafafa] px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Add
              </button>
            </div>

            <div className="space-y-1 max-h-28 overflow-y-auto custom-scrollbar">
              <div className="text-[11px] text-[#a1a1aa] bg-[#09090b] p-1.5 rounded border border-[#27272a] flex justify-between items-center">
                <span>Staff Engineer (You)</span>
                <span className="text-[9px] bg-blue-500/20 text-blue-400 px-1.5 py-0.2 rounded font-bold">Admin</span>
              </div>
              {memberEmails.map((email) => (
                <div
                  key={email}
                  className="text-[11px] text-[#fafafa] bg-[#09090b] p-1.5 rounded border border-[#27272a] flex justify-between items-center"
                >
                  <span>{email}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveEmail(email)}
                    className="text-[#71717a] hover:text-red-400 p-0.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-3 flex items-center justify-end gap-3 border-t border-[#27272a]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs text-[#a1a1aa] hover:text-[#fafafa] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-md transition-colors cursor-pointer"
            >
              Create Squad
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
