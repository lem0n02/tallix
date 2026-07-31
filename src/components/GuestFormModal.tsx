import React, { useState, useEffect } from 'react';
import { User, Mail, ShieldCheck, Globe, Monitor, Smartphone, Cpu, ArrowRight, Sparkles, X } from 'lucide-react';
import { captureVisitorTelemetry, TelemetryData, createGuestVisitRecord } from '../utils/telemetry';
import { GuestVisit, LanguageMode } from '../types';
import { getTranslation } from '../i18n/translations';

interface GuestFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitGuest: (guestRecord: GuestVisit) => void;
  lang?: LanguageMode;
}

export const GuestFormModal: React.FC<GuestFormModalProps> = ({
  isOpen,
  onClose,
  onSubmitGuest,
  lang = 'en',
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [telemetry, setTelemetry] = useState<TelemetryData | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const t = (key: Parameters<typeof getTranslation>[1]) => getTranslation(lang as LanguageMode, key);

  useEffect(() => {
    if (isOpen) {
      setIsCapturing(true);
      captureVisitorTelemetry().then((data) => {
        setTelemetry(data);
        setIsCapturing(false);
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter your full name.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }

    const currentTelemetry: TelemetryData = telemetry || {
      ip: '103.114.172.45',
      country: 'Dhaka, Bangladesh 🇧🇩',
      browser: 'Google Chrome 126',
      os: 'Windows 11',
      deviceType: 'Desktop',
      visitTime: new Date().toISOString(),
    };

    const record = createGuestVisitRecord(name, email, currentTelemetry);
    onSubmitGuest(record);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-[#09090b] border border-[#27272a] text-[#fafafa] rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl relative">
        {/* Top Header Banner */}
        <div className="bg-gradient-to-r from-blue-600/20 via-emerald-600/20 to-teal-600/20 p-6 border-b border-[#27272a] relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-[#a1a1aa] hover:text-white p-1 rounded-lg bg-[#18181b]/60 border border-[#27272a] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs px-2.5 py-1 rounded-full mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{t('guestUser')}</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            {t('guestFormTitle')}
          </h2>
          <p className="text-xs text-[#a1a1aa] mt-1">
            {t('guestFormSubtitle')}
          </p>
        </div>

        {/* Guest Input Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[#a1a1aa] uppercase tracking-wider mb-1.5">
              {t('fullName')} <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <User className="w-4 h-4 absolute left-3 top-3 text-[#71717a]" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError(null);
                }}
                placeholder={t('enterNamePlaceholder')}
                className="w-full bg-[#18181b] border border-[#27272a] focus:border-blue-500 text-white rounded-lg pl-9 pr-3 py-2.5 text-sm outline-none transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#a1a1aa] uppercase tracking-wider mb-1.5">
              {t('emailAddress')} <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-3 text-[#71717a]" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError(null);
                }}
                placeholder={t('enterEmailPlaceholder')}
                className="w-full bg-[#18181b] border border-[#27272a] focus:border-blue-500 text-white rounded-lg pl-9 pr-3 py-2.5 text-sm outline-none transition-colors"
              />
            </div>
          </div>

          {/* Telemetry Badge / Auto-collected System Info */}
          <div className="bg-[#18181b]/80 border border-[#27272a] rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between text-[11px] text-[#a1a1aa] font-medium border-b border-[#27272a] pb-2">
              <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                <ShieldCheck className="w-3.5 h-3.5" />
                Auto Telemetry Collector
              </span>
              <span className="text-[10px] text-[#71717a]">
                {isCapturing ? t('telemetryCollected') : 'Session Ready'}
              </span>
            </div>

            {telemetry ? (
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="flex items-center gap-1.5 text-[#a1a1aa]">
                  <Globe className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span className="truncate">IP: <strong className="text-white font-mono">{telemetry.ip}</strong></span>
                </div>
                <div className="flex items-center gap-1.5 text-[#a1a1aa]">
                  <Globe className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="truncate">{telemetry.country}</span>
                </div>
                <div className="flex items-center gap-1.5 text-[#a1a1aa]">
                  <Monitor className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                  <span className="truncate">{telemetry.browser}</span>
                </div>
                <div className="flex items-center gap-1.5 text-[#a1a1aa]">
                  {telemetry.deviceType === 'Mobile' ? (
                    <Smartphone className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  ) : (
                    <Cpu className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  )}
                  <span className="truncate">{telemetry.os} ({telemetry.deviceType})</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center py-2 text-xs text-[#71717a] animate-pulse">
                Detecting visitor network & device...
              </div>
            )}
          </div>

          <p className="text-[11px] text-[#71717a] leading-tight">
            {t('guestNotice')}
          </p>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-[#a1a1aa] hover:text-white bg-[#18181b] border border-[#27272a] transition-colors cursor-pointer"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg text-xs font-bold text-black bg-white hover:bg-[#e4e4e7] active:scale-95 flex items-center gap-2 transition-all cursor-pointer shadow-lg"
            >
              <span>{t('continueAsGuest')}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
