import { LanguageMode } from '../types';
import { formatExactMoney, toPaisa } from '../utils/money';

export function toBengaliNumerals(strOrNum: string | number | null | undefined): string {
  if (strOrNum === null || strOrNum === undefined) return '';
  const str = String(strOrNum);
  const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return str.replace(/\d/g, (d) => bnDigits[parseInt(d, 10)]);
}

export function formatNumber(
  val: number | string,
  lang: LanguageMode,
  options?: { minimumFractionDigits?: number; maximumFractionDigits?: number }
): string {
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) return String(val ?? '');

  const minDec = options?.minimumFractionDigits ?? 0;
  const maxDec = options?.maximumFractionDigits ?? 2;

  const formattedEn = num.toLocaleString('en-US', {
    minimumFractionDigits: minDec,
    maximumFractionDigits: maxDec,
  });

  if (lang === 'bn') {
    return toBengaliNumerals(formattedEn);
  }
  return formattedEn;
}

export function formatCurrency(amount: number | string | null | undefined, lang: LanguageMode): string {
  if (amount === null || amount === undefined || amount === '') {
    return lang === 'bn' ? '৳০.০০' : '৳0.00';
  }

  const paisa = toPaisa(amount);
  const formatted = formatExactMoney(amount);
  const isNegative = paisa < 0;
  const cleanFormatted = isNegative ? formatted.slice(1) : formatted;
  const enResult = `${isNegative ? '-' : ''}৳${cleanFormatted}`;

  if (lang === 'bn') {
    return toBengaliNumerals(enResult);
  }
  return enResult;
}

export function formatDate(dateStrOrObj: string | Date | null | undefined, lang: LanguageMode): string {
  if (!dateStrOrObj) return '';
  const d = new Date(dateStrOrObj);
  if (isNaN(d.getTime())) return String(dateStrOrObj);

  if (lang === 'bn') {
    const monthNamesBn = [
      'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
      'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
    ];
    const day = d.getDate();
    const month = monthNamesBn[d.getMonth()];
    const year = d.getFullYear();
    return toBengaliNumerals(`${day} ${month}, ${year}`);
  } else {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
}

export function formatDateTime(dateStrOrObj: string | Date | null | undefined, lang: LanguageMode): string {
  if (!dateStrOrObj) return '';
  const d = new Date(dateStrOrObj);
  if (isNaN(d.getTime())) return String(dateStrOrObj);

  const dateFormatted = formatDate(d, lang);
  let hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? (lang === 'bn' ? 'অপরাহ্ন' : 'PM') : (lang === 'bn' ? 'পূর্বাহ্ন' : 'AM');
  hours = hours % 12 || 12;
  const timeStr = `${hours}:${minutes} ${ampm}`;

  if (lang === 'bn') {
    return `${dateFormatted}, ${toBengaliNumerals(timeStr)}`;
  }
  return `${dateFormatted}, ${timeStr}`;
}
