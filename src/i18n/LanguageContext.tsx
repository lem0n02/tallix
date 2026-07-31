import React, { createContext, useContext } from 'react';
import { LanguageMode } from '../types';
import { getTranslation, translations } from './translations';
import {
  formatNumber as formatNumberUtil,
  formatCurrency as formatCurrencyUtil,
  formatDate as formatDateUtil,
  formatDateTime as formatDateTimeUtil,
  toBengaliNumerals as toBengaliNumeralsUtil,
} from './formatters';

export interface LanguageContextType {
  lang: LanguageMode;
  setLang: (lang: LanguageMode) => void;
  toggleLang: () => void;
  t: (key: keyof typeof translations.en) => string;
  formatNumber: (val: number | string, options?: { minimumFractionDigits?: number; maximumFractionDigits?: number }) => string;
  formatCurrency: (amount: number | string) => string;
  formatDate: (dateStrOrObj: string | Date | null | undefined) => string;
  formatDateTime: (dateStrOrObj: string | Date | null | undefined) => string;
  toBengaliNumerals: (strOrNum: string | number | null | undefined) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{
  lang: LanguageMode;
  setLang: (lang: LanguageMode) => void;
  children: React.ReactNode;
}> = ({ lang, setLang, children }) => {
  const toggleLang = () => {
    setLang(lang === 'en' ? 'bn' : 'en');
  };

  const t = (key: keyof typeof translations.en): string => {
    return getTranslation(lang, key);
  };

  const contextValue: LanguageContextType = {
    lang,
    setLang,
    toggleLang,
    t,
    formatNumber: (val, options) => formatNumberUtil(val, lang, options),
    formatCurrency: (amount) => formatCurrencyUtil(amount, lang),
    formatDate: (date) => formatDateUtil(date, lang),
    formatDateTime: (date) => formatDateTimeUtil(date, lang),
    toBengaliNumerals: (str) => (lang === 'bn' ? toBengaliNumeralsUtil(str) : String(str ?? '')),
  };

  return (
    <LanguageContext.Provider value={contextValue}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    return {
      lang: 'en',
      setLang: () => {},
      toggleLang: () => {},
      t: (key: keyof typeof translations.en) => getTranslation('en', key),
      formatNumber: (val) => String(val ?? ''),
      formatCurrency: (amount) => `৳${Number(amount).toFixed(2)}`,
      formatDate: (date) => String(date ?? ''),
      formatDateTime: (date) => String(date ?? ''),
      toBengaliNumerals: (str) => String(str ?? ''),
    };
  }
  return context;
};
