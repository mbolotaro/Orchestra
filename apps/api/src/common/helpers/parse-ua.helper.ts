import { UAParser } from 'ua-parser-js';

export type DeviceType = 'mobile' | 'tablet' | 'desktop';

export function parseUA(ua: string | null): {
  browser: string | null;
  os: string | null;
  type: DeviceType;
} {
  if (!ua) return { browser: null, os: null, type: 'desktop' };

  const parsed = new UAParser(ua).getResult();

  const type: DeviceType =
    parsed.device.type === 'mobile'
      ? 'mobile'
      : parsed.device.type === 'tablet'
        ? 'tablet'
        : 'desktop';

  return {
    browser: parsed.browser.name
      ? `${parsed.browser.name} ${parsed.browser.version}`.trim()
      : null,
    os: parsed.os.name ? `${parsed.os.name} ${parsed.os.version}`.trim() : null,
    type,
  };
}
