import { normalizePhone, parseQr, parseVCard } from './qr';
import { toVCard } from '../../hosting/vcard.js';

const D = 'cards.example.in';

test('our link and app scheme give a profile slug', () => {
  expect(parseQr(`https://${D}/p/Ab3dE5gH7j`, D)).toEqual({ kind: 'profile', slug: 'Ab3dE5gH7j' });
  expect(parseQr(`https://${D}/p/Ab3dE5gH7j/?utm=x`, D)).toEqual({ kind: 'profile', slug: 'Ab3dE5gH7j' });
  expect(parseQr('nfcapp://p/Ab3dE5gH7j', D)).toEqual({ kind: 'profile', slug: 'Ab3dE5gH7j' });
});

test('rejects foreign domains, bad slugs and junk', () => {
  expect(parseQr('https://evil.example/p/Ab3dE5gH7j', D)).toBeNull();
  expect(parseQr(`https://${D}/p/short`, D)).toBeNull();
  expect(parseQr('hello world', D)).toBeNull();
  expect(parseQr('https://google.com', D)).toBeNull();
  expect(parseQr('BEGIN:VCARD\nVERSION:3.0\nEND:VCARD', D)).toBeNull();
});

test('vCard with folded lines, params and grouped keys', () => {
  const v =
    'BEGIN:VCARD\r\nVERSION:3.0\r\nN:Mehta;Karan;;;\r\nFN:Karan Me\r\n hta\r\nORG:Acme Industries Pvt Ltd;Sales\r\n' +
    'TITLE:Regional Manager\r\nitem1.TEL;TYPE=CELL:+91 98201 23456\r\nEMAIL;TYPE=INTERNET:karan@acme.in\r\n' +
    'URL:https://acme.in\r\nEND:VCARD';
  expect(parseQr(v, D)).toEqual({
    kind: 'contact',
    fields: {
      name: 'Karan Mehta',
      title: 'Regional Manager',
      company: 'Acme Industries Pvt Ltd',
      phones: ['+919820123456'],
      emails: ['karan@acme.in'],
      website: 'https://acme.in',
      address: '',
    },
  });
});

test('vCard N is used when FN is missing; tel: URIs are stripped', () => {
  const f = parseVCard('BEGIN:VCARD\nVERSION:4.0\nN:Iyer;Lakshmi;;;\nTEL;VALUE=uri:tel:+919812345678\nEND:VCARD');
  expect(f.name).toBe('Lakshmi Iyer');
  expect(f.phones).toEqual(['+919812345678']);
});

test('toVCard escapes commas, semicolons, newlines and round-trips', () => {
  const c = {
    name: "Rhea D'Souza",
    company: 'Shah, Mehta & Co.; LLP',
    title: 'Partner',
    phones: ['+919876543210'],
    emails: ['rhea@shahmehta.in'],
    website: 'https://shahmehta.in',
    address: 'Line 1\nLine 2',
    note: 'Met at expo; Pune',
  };
  const v = toVCard(c);
  expect(v.startsWith('BEGIN:VCARD\r\nVERSION:3.0\r\n')).toBe(true);
  expect(v).toContain("N:D'Souza;Rhea;;;\r\n");
  expect(v).toContain('ORG:Shah\\, Mehta & Co.\\; LLP\r\n');
  expect(v).toContain('NOTE:Met at expo\\; Pune\r\n');
  const f = parseVCard(v);
  expect(f.name).toBe("Rhea D'Souza");
  expect(f.company).toBe('Shah, Mehta & Co.; LLP');
  expect(f.title).toBe('Partner');
  expect(f.phones).toEqual(['+919876543210']);
  expect(f.emails).toEqual(['rhea@shahmehta.in']);
  expect(f.website).toBe('https://shahmehta.in');
  expect(f.address).toBe('Line 1\nLine 2');
});

test('non-ASCII names survive the round trip', () => {
  expect(parseVCard(toVCard({ name: 'राहुल शर्मा' })).name).toBe('राहुल शर्मा');
  expect(parseVCard(toVCard({ name: 'Zoë Müller' })).name).toBe('Zoë Müller');
});

test('MeCard', () => {
  expect(parseQr('MECARD:N:Sharma,Rahul;TEL:09876543210;EMAIL:rahul@x.in;ORG:X Traders;;', D)).toEqual({
    kind: 'contact',
    fields: {
      name: 'Rahul Sharma',
      title: '',
      company: 'X Traders',
      phones: ['+919876543210'],
      emails: ['rahul@x.in'],
      website: '',
      address: '',
    },
  });
});

test('LinkedIn profile URL becomes a contact', () => {
  expect(parseQr('https://www.linkedin.com/in/priya-nair-4b2a1c9/', D)).toEqual({
    kind: 'contact',
    fields: expect.objectContaining({ name: 'Priya Nair', website: 'https://www.linkedin.com/in/priya-nair-4b2a1c9/' }),
  });
});

test('Indian phone formats normalise to E.164; junk is rejected', () => {
  expect(normalizePhone('+91 98765 43210')).toBe('+919876543210');
  expect(normalizePhone('098765-43210')).toBe('+919876543210');
  expect(normalizePhone('(022) 2204 1234')).toBe('+912222041234');
  expect(normalizePhone('12345')).toBeNull();
  expect(normalizePhone('400001')).toBeNull();
});
