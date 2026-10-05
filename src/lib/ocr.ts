import { findPhoneNumbersInText } from 'libphonenumber-js';
import { emptyFields, type Fields } from './types';

// ponytail: keyword heuristics tuned on __fixtures__/cards.json; upgrade path is LLM parsing (Pro, spec §17).
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g;
const WEB = /(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|in|net|org|io|co|biz|info|ai|app|dev|edu)(?:\.in)?(?:\/\S*)?/i;
const SOCIAL = /@\w|\b(instagram|facebook|linkedin|twitter|youtube)\b/i;
const PIN = /\b\d{6}\b|\b\d{3}\s\d{3}\b/;
const TITLE =
  /\b(director|manager|ceo|cto|cfo|coo|founder|partner|proprietor|owner|engineer|head|officer|executive|president|vp|consultant|architect|designer|developer|analyst|advocate|accountants?|lead|specialist|supervisor|principal|professor|chairman|secretary|coordinator|advisor|agent|strategist|writer|editor|photographer|producer|trainer|coach|recruiter|planner|surgeon|physician|dentist)\b/i;
const COMPANY =
  /&|\b(pvt|private|ltd|limited|llp|inc|corp|corporation|industries|enterprises?|solutions|technologies|traders|trading|associates|group|co|company|studio|agency|services|systems|exports?|imports?|international|infotech|consultancy|labs|ventures|foods|pharma|motors|textiles|logistics|realty|builders|hospital|clinic|bank|media|films|productions|capital|finance|investments|interiors|school|college|university|institute|board)\b/i;
const ADDRESS =
  /\b(road|rd|street|marg|nagar|lane|floor|sector|plot|building|bldg|tower|complex|chowk|near|opp|colony|society|apartment|wing|shop|gali|bazar|bazaar|market|highway|layout|estate|midc|gidc|area|arcade|hills|india|mumbai|delhi|pune|bengaluru|bangalore|chennai|hyderabad|kolkata|ahmedabad|surat|jaipur|noida|gurgaon|gurugram|thane|nashik|indore|kochi|lucknow|chandigarh|vadodara|nagpur|coimbatore)\b/i;
const NAME = /^[A-Za-z][A-Za-z.'-]*(?:\s+[A-Za-z][A-Za-z.'-]*){0,3}$/;

const titleCase = (s: string) =>
  s === s.toUpperCase() ? s.toLowerCase().replace(/(^|[\s.'-])([a-z])/g, (_, p: string, c: string) => p + c.toUpperCase()) : s;

export function parseCardText(text: string): Fields {
  const f = emptyFields();
  const rest: string[] = [];
  const addr: string[] = [];
  const lines = text
    .replace(/\s+[|•·]\s+/g, '\n')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  for (const line of lines) {
    const emails = line.match(EMAIL) ?? [];
    for (const e of emails) if (!f.emails.includes(e.toLowerCase())) f.emails.push(e.toLowerCase());
    const noEmail = line.replace(EMAIL, ' ');
    const phones = findPhoneNumbersInText(noEmail.split(/\bfax\b/i)[0], 'IN')
      .filter((p) => p.number.isValid())
      .map((p) => String(p.number.number));
    for (const p of phones) if (!f.phones.includes(p)) f.phones.push(p);
    const web = noEmail.match(WEB);
    if (web && !f.website) f.website = web[0];
    if (emails.length || phones.length || web || SOCIAL.test(line) || /\bfax\b/i.test(line)) continue;
    if (PIN.test(line) || (ADDRESS.test(line) && !COMPANY.test(line))) addr.push(line);
    else rest.push(line);
  }

  f.address = addr.join(', ');
  const ti = rest.findIndex((l) => TITLE.test(l));
  const ci = rest.findIndex((l, i) => i !== ti && COMPANY.test(l));
  const namey = (i: number) => i >= 0 && i !== ti && i !== ci && NAME.test(rest[i]);
  const ni = namey(ti - 1) ? ti - 1 : rest.findIndex((_, i) => namey(i));
  if (ni >= 0) f.name = titleCase(rest[ni]);
  if (ti >= 0) f.title = rest[ti];
  const coi = ci >= 0 ? ci : rest.findIndex((_, i) => i !== ti && i !== ni);
  if (coi >= 0) f.company = rest[coi];
  return f;
}
