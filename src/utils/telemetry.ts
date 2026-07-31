import { GuestVisit } from '../types';

export interface TelemetryData {
  ip: string;
  country: string;
  browser: string;
  os: string;
  deviceType: 'Desktop' | 'Mobile' | 'Tablet';
  visitTime: string;
}

export async function captureVisitorTelemetry(): Promise<TelemetryData> {
  const ua = navigator.userAgent;

  // Detect Browser
  let browser = 'Chrome (V8)';
  if (ua.includes('Edg/')) {
    browser = 'Microsoft Edge';
  } else if (ua.includes('Firefox/')) {
    browser = 'Mozilla Firefox';
  } else if (ua.includes('Safari/') && !ua.includes('Chrome/')) {
    browser = 'Apple Safari';
  } else if (ua.includes('OPR/') || ua.includes('Opera/')) {
    browser = 'Opera';
  } else if (ua.includes('Chrome/')) {
    const match = ua.match(/Chrome\/([0-[#9]+)/);
    browser = match ? `Chrome ${match[1]}` : 'Google Chrome';
  }

  // Detect OS
  let os = 'Windows 11 (64-bit)';
  if (ua.includes('Win')) {
    os = 'Windows 11';
  } else if (ua.includes('Mac OS X')) {
    os = 'macOS Sonoma';
  } else if (ua.includes('Android')) {
    os = 'Android 14';
  } else if (ua.includes('iPhone') || ua.includes('iPad')) {
    os = 'iOS 17';
  } else if (ua.includes('Linux')) {
    os = 'Linux (x86_64)';
  }

  // Detect Device Type
  let deviceType: 'Desktop' | 'Mobile' | 'Tablet' = 'Desktop';
  if (/iPad|Tablet/i.test(ua) || (navigator.maxTouchPoints && navigator.maxTouchPoints > 2 && /Macintosh/i.test(ua))) {
    deviceType = 'Tablet';
  } else if (/Mobile|Android|iPhone|iPod/i.test(ua)) {
    deviceType = 'Mobile';
  } else if (window.innerWidth < 768) {
    deviceType = 'Mobile';
  }

  // Fallback IP and Country
  let ip = '103.114.172.45';
  let country = 'Dhaka, Bangladesh 🇧🇩';

  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz.includes('Dhaka') || tz.includes('Asia/Dhaka')) {
      country = 'Dhaka, Bangladesh 🇧🇩';
    } else if (tz.includes('America/')) {
      country = 'New York, USA 🇺🇸';
    } else if (tz.includes('Europe/London')) {
      country = 'London, UK 🇬🇧';
    } else if (tz.includes('Asia/Kolkata')) {
      country = 'Kolkata, India 🇮🇳';
    } else if (tz.includes('Asia/Tokyo')) {
      country = 'Tokyo, Japan 🇯🇵';
    } else {
      country = `${tz.replace('_', ' ')}`;
    }
  } catch {
    // default
  }

  // Attempt async IP fetching with 1.5s timeout
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1500);
    const res = await fetch('https://api.ipify.org?format=json', { signal: controller.signal });
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = await res.json();
      if (data.ip) {
        ip = data.ip;
      }
    }
  } catch {
    // Keep fallback IP if offline or blocked
  }

  return {
    ip,
    country,
    browser,
    os,
    deviceType,
    visitTime: new Date().toISOString(),
  };
}

export function createGuestVisitRecord(name: string, email: string, telemetry: TelemetryData): GuestVisit {
  return {
    id: `guest_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    name: name.trim() || 'Guest Visitor',
    email: email.trim().toLowerCase() || 'guest@tallix.io',
    ip: telemetry.ip,
    country: telemetry.country,
    browser: telemetry.browser,
    os: telemetry.os,
    deviceType: telemetry.deviceType,
    visitTime: telemetry.visitTime,
  };
}
