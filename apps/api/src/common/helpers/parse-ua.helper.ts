import { UAParser } from 'ua-parser-js';

export function parseUA(ua: string | null): {
  browser: string | null;
  os: string | null;
} {
  if (!ua) return { browser: null, os: null };

  const parsed = new UAParser(ua).getResult();

  return {
    browser: parsed.browser.name
      ? `${parsed.browser.name} ${parsed.browser.version}`.trim()
      : null,
    os: parsed.os.name ? `${parsed.os.name} ${parsed.os.version}`.trim() : null,
  };
}
