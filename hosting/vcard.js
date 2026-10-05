// @ts-check
// Shared by the app (src/lib) and the no-app fallback page (hosting/p.html). Keep it dependency-free ES.

// Any line break (CRLF, CR or LF) becomes a literal \n so a value can never start a new vCard property;
// other control characters are dropped.
/** @param {unknown} s */
const esc = (s) =>
  String(s ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\r|\n/g, '\\n')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .replace(/([,;])/g, '\\$1');

/**
 * Build a vCard 3.0 string.
 * @param {{ name: string, title?: string, company?: string, phones?: string[], emails?: string[], website?: string, address?: string, note?: string, url?: string }} c
 * @returns {string}
 */
export function toVCard(c) {
  const given = String(c.name ?? '').trim().split(/\s+/);
  const family = given.length > 1 ? given.pop() : '';
  const lines = ['BEGIN:VCARD', 'VERSION:3.0', `N:${esc(family)};${esc(given.join(' '))};;;`, `FN:${esc(c.name)}`];
  if (c.company) lines.push(`ORG:${esc(c.company)}`);
  if (c.title) lines.push(`TITLE:${esc(c.title)}`);
  for (const p of c.phones ?? []) lines.push(`TEL;TYPE=CELL:${esc(p)}`);
  for (const e of c.emails ?? []) lines.push(`EMAIL;TYPE=INTERNET:${esc(e)}`);
  if (c.website) lines.push(`URL:${esc(c.website)}`);
  if (c.url) lines.push(`URL:${esc(c.url)}`);
  if (c.address) lines.push(`ADR;TYPE=WORK:;;${esc(c.address)};;;;`);
  if (c.note) lines.push(`NOTE:${esc(c.note)}`);
  lines.push('END:VCARD');
  return lines.join('\r\n') + '\r\n';
}
