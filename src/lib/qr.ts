import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { LINK_DOMAIN, SCHEME } from './config';
import { emptyFields, type Fields } from './types';

export type QrResult = { kind: 'profile'; slug: string } | { kind: 'contact'; fields: Fields } | null;

export const SLUG_RE = /^[A-Za-z0-9]{10}$/;
const LINKEDIN_RE = /^https?:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/in\/([^/?#\s]+)\/?/i;

/** E.164 for valid numbers (default region IN), else null. */
export function normalizePhone(raw: string): string | null {
  const p = parsePhoneNumberFromString(raw.replace(/^tel:/i, ''), 'IN');
  return p?.isValid() ? p.number : null;
}

// RN's URL polyfill lacks host/pathname, so parse with a regex.
export function slugFromUrl(data: string, domain = LINK_DOMAIN): string | null {
  const s = data.trim();
  const web = s.match(/^https?:\/\/([^/?#]+)\/p\/([A-Za-z0-9]{10})\/?(?:[?#].*)?$/i);
  if (web && web[1].toLowerCase() === domain.toLowerCase()) return web[2];
  const app = s.match(new RegExp(`^${SCHEME}:\\/\\/p\\/([A-Za-z0-9]{10})\\/?$`));
  return app ? app[1] : null;
}

/** Split on semicolons that are not backslash-escaped; escapes are kept for unesc(). */
function splitSemi(s: string): string[] {
  const out = [''];
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '\\' && i + 1 < s.length) out[out.length - 1] += s[i] + s[++i];
    else if (s[i] === ';') out.push('');
    else out[out.length - 1] += s[i];
  }
  return out;
}

const unesc = (s: string) => s.replace(/\\n/gi, '\n').replace(/\\([,;:\\])/g, '$1');

export function parseVCard(text: string): Fields {
  const f = emptyFields();
  let nName = '';
  for (const line of text.replace(/\r?\n[ \t]/g, '').split(/\r?\n/)) {
    const i = line.indexOf(':');
    if (i < 0) continue;
    const key = (line.slice(0, i).split(';')[0].split('.').pop() ?? '').toUpperCase();
    const val = line.slice(i + 1).trim();
    if (key === 'FN') f.name = unesc(val);
    else if (key === 'N') {
      const [family = '', given = ''] = splitSemi(val).map(unesc);
      nName = `${given} ${family}`.trim();
    } else if (key === 'ORG') f.company = unesc(splitSemi(val)[0]);
    else if (key === 'TITLE') f.title = unesc(val);
    else if (key === 'TEL') f.phones.push(normalizePhone(val) ?? unesc(val).replace(/^tel:/i, ''));
    else if (key === 'EMAIL') f.emails.push(unesc(val));
    else if (key === 'URL' && !f.website) f.website = unesc(val);
    else if (key === 'ADR') f.address = splitSemi(val).map(unesc).filter(Boolean).join(', ');
  }
  if (!f.name) f.name = nName;
  return f;
}

function parseMeCard(body: string): Fields {
  const f = emptyFields();
  for (const part of splitSemi(body)) {
    const i = part.indexOf(':');
    if (i < 0) continue;
    const key = part.slice(0, i).toUpperCase();
    const val = unesc(part.slice(i + 1));
    if (key === 'N') f.name = val.split(',').map((s) => s.trim()).filter(Boolean).reverse().join(' ');
    else if (key === 'TEL') f.phones.push(normalizePhone(val) ?? val);
    else if (key === 'EMAIL') f.emails.push(val);
    else if (key === 'URL') f.website = val;
    else if (key === 'ADR') f.address = val;
    else if (key === 'ORG') f.company = val;
    else if (key === 'TITLE') f.title = val;
  }
  return f;
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s; // malformed %-escape from an untrusted QR: keep it raw rather than crash the scanner
  }
}

function linkedInName(slug: string): string {
  const words = safeDecode(slug).split('-').filter(Boolean);
  if (words.length > 1 && /\d/.test(words[words.length - 1])) words.pop();
  return words.map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
}

const useful = (f: Fields) => (f.name || f.phones.length || f.emails.length ? f : null);

/** Never throws: QR payloads are untrusted, and a throw here would crash the scanner. */
export function parseQr(data: string, domain = LINK_DOMAIN): QrResult {
  try {
    return parse(data, domain);
  } catch {
    return null;
  }
}

function parse(data: string, domain: string): QrResult {
  const s = data.trim();
  const slug = slugFromUrl(s, domain);
  if (slug) return { kind: 'profile', slug };
  let f: Fields | null = null;
  if (/^BEGIN:VCARD/i.test(s)) f = useful(parseVCard(s));
  else if (/^MECARD:/i.test(s)) f = useful(parseMeCard(s.slice(7)));
  else {
    const li = s.match(LINKEDIN_RE);
    if (li) f = { ...emptyFields(), name: linkedInName(li[1]), website: s };
  }
  return f ? { kind: 'contact', fields: f } : null;
}
