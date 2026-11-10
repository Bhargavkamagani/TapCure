import { BRAND } from '../../data/landingData.js'

/**
 * The four policies, as data for PolicyReader (2026-11-07).
 *
 * Section layouts are copied from the pages they used to live in; all wording
 * stays in the dictionaries (legalPrivacy.js `lpp.*`, legalTerms.js `lt.*` /
 * `lmd.*`, legalRefund.js `lcr.*`). Each section also has a one-line
 * "simple words" key (`<prefix>.simple.<id>`), written only from that
 * section's own text — the full text is what applies.
 *
 * Keep these in step with the policy text: if a paragraph key is removed from
 * a dictionary, remove it here too (an unknown key renders as the key itself —
 * that is how "lpp.s2.p2" ended up on the live Privacy page).
 *
 * NOTE: all four documents should be reviewed by a qualified legal
 * professional before public launch.
 */

export const COMPANY = 'Trovate LLP'
export const EFFECTIVE_DATE = '1 September 2026'
export const CONTACT_EMAIL = 'hello@tapcure.in'
export const CONTACT_PHONE = '+91 93468 21621'
export const CONTACT_ADDRESS = 'Hyderabad, Telangana, India'

export const VARS = {
  brand: BRAND.name, company: COMPANY, email: CONTACT_EMAIL, phone: CONTACT_PHONE,
  address: CONTACT_ADDRESS, date: EFFECTIVE_DATE,
}

// Block specs: 'p:<key>' paragraph, 'sub:<key>' sub-heading, ['ul', [keys]] list.
const p = (k) => ({ type: 'p', key: k })
const sub = (k) => ({ type: 'sub', key: k })
const ul = (keys) => ({ type: 'ul', keys })
const L = (prefix, n) => Array.from({ length: n }, (_, i) => `${prefix}.${i + 1}`)

const privacy = [
  { id: 0, title: 'lpol.ui.intro', simple: 'lpp.simple.intro', blocks: [p('lpp.intro.p1'), p('lpp.intro.p2')] },
  { id: 1, blocks: [p('lpp.s1.p1'), p('lpp.s1.p2'), ul(L('lpp.s1.a', 11)), p('lpp.s1.p3')] },
  // 2.4 Payment Information: its paragraph `lpp.s2.p2` was retired with the
  // platform fee, so only p3 remains under that sub-heading.
  { id: 2, blocks: [p('lpp.s2.p1'), sub('lpp.s2.sub1'), ul(L('lpp.s2.a', 12)), sub('lpp.s2.sub2'), ul(L('lpp.s2.b', 12)), sub('lpp.s2.sub3'), ul(L('lpp.s2.c', 9)), sub('lpp.s2.sub4'), p('lpp.s2.p3'), sub('lpp.s2.sub5'), p('lpp.s2.p4'), p('lpp.s2.p5')] },
  { id: 3, blocks: [p('lpp.s3.p1'), ul(L('lpp.s3.a', 16))] },
  { id: 4, blocks: [p('lpp.s4.p1'), p('lpp.s4.p2'), p('lpp.s4.p3'), p('lpp.s4.p4')] },
  { id: 5, tone: 'warn', blocks: [p('lpp.s5.p1'), p('lpp.s5.p2'), p('lpp.s5.p3'), ul(L('lpp.s5.a', 5)), p('lpp.s5.p4')] },
  { id: 6, blocks: [p('lpp.s6.p1'), ul(L('lpp.s6.a', 7)), p('lpp.s6.p2')] },
  { id: 7, blocks: [p('lpp.s7.p1'), ul(L('lpp.s7.a', 7)), p('lpp.s7.p2')] },
  { id: 8, blocks: [p('lpp.s8.p1'), ul(L('lpp.s8.a', 5)), p('lpp.s8.p2')] },
  { id: 9, blocks: [p('lpp.s9.p1'), ul(L('lpp.s9.a', 7)), p('lpp.s9.p2')] },
  { id: 10, blocks: [p('lpp.s10.p1'), ul(L('lpp.s10.a', 6)), p('lpp.s10.p2'), p('lpp.s10.p3')] },
  { id: 11, blocks: [p('lpp.s11.p1'), p('lpp.s11.p2')] },
  { id: 12, blocks: [p('lpp.s12.p1'), ul(L('lpp.s12.a', 6)), p('lpp.s12.p2')] },
  { id: 13, blocks: [p('lpp.s13.p1')] },
  { id: 14, blocks: [p('lpp.s14.p1'), ul(L('lpp.s14.a', 7)), p('lpp.s14.p2')] },
  { id: 15, blocks: [p('lpp.s15.p1')] },
  { id: 16, title: 'lpol.ui.contact', simple: 'lpp.simple.16', contact: true, blocks: [p('lpp.contact.title'), p('lpp.contact.address'), p('lpp.contact.grievance')] },
].map((s) => ({ title: `lpp.s${s.id}.title`, simple: `lpp.simple.${s.id}`, ...s }))

// Terms: 'pN' = paragraph, a number N = list of keys li1..liN.
const TERMS_SPECS = [
  [1, ['p1', 'p2']], [2, ['p1', 'p2']], [3, ['p1', 'p2', 5]], [4, ['p1', 8, 'p2']], [5, ['p1', 7, 'p2']],
  [6, ['p1', 'p2', 'p3', 'p4']], [7, ['p1', 'p2', 5, 'p3']], [8, ['p1', 5, 'p2'], { readMore: '/cancellation-refund' }],
  [9, ['p1', 'p2', 'p3', 'p4'], { tone: 'warn' }], [10, ['p1', 4, 'p2'], { tone: 'warn' }], [11, ['p1', 'p2']],
  [12, ['p1', 8]], [13, ['p1', 'p2']], [14, ['p1', 'p2']], [15, ['p1', 9]], [16, ['p1']], [17, ['p1', 5]],
  [18, ['p1']], [19, ['p1', 'p2']],
]
const terms = [
  ...TERMS_SPECS.map(([id, specs, extra = {}]) => ({
    id, title: `lt.s${id}.title`, simple: `lt.simple.${id}`, tone: extra.tone,
    readMore: extra.readMore && { label: `lt.s${id}.readMore`, to: extra.readMore },
    blocks: specs.map((b) => (typeof b === 'number'
      ? ul(Array.from({ length: b }, (_, i) => `lt.s${id}.li${i + 1}`))
      : p(`lt.s${id}.${b}`))),
  })),
  { id: 20, title: 'lpol.ui.contact', simple: 'lt.simple.20', contact: true, blocks: [p('lt.contact.title')] },
]

const refund = [
  [1, [p('lcr.s1.p1'), p('lcr.s1.p2')]],
  [2, [p('lcr.s2.p1'), p('lcr.s2.p2')]],
  [3, [p('lcr.s3.p1'), ul(['lcr.s3.li1', 'lcr.s3.li2', 'lcr.s3.li3'])]],
  [4, [p('lcr.s4.p1'), p('lcr.s4.p2'), p('lcr.s4.p3')]],
  [5, [p('lcr.s5.p1'), p('lcr.s5.p2'), p('lcr.s5.p3')]],
  [6, [p('lcr.s6.p1'), p('lcr.s6.p2'), p('lcr.s6.p3')]],
  [7, [p('lcr.s7.p1')]],
  [8, [p('lcr.s8.p1'), p('lcr.s8.p2')]],
].map(([id, blocks]) => ({ id, title: `lcr.s${id}.title`, simple: `lcr.simple.${id}`, blocks }))

const disclaimer = [
  { id: 1, tone: 'warn', blocks: [p('lmd.s1.p1'), p('lmd.s1.p2'), ul([1, 2, 3, 4, 5, 6].map((i) => `lmd.not.li${i}`)), p('lmd.s1.p3')] },
  { id: 2, tone: 'warn', blocks: [p('lmd.s2.p1'), ul(['lmd.s2.li1', 'lmd.s2.li2', 'lmd.s2.li3']), p('lmd.s2.p2')] },
  { id: 3, tone: 'warn', blocks: [p('lmd.s3.p1'), p('lmd.s3.p2')] },
].map((s) => ({ title: `lmd.s${s.id}.title`, simple: `lmd.simple.${s.id}`, ...s }))

/** In the order they appear on the left. `name` is the list label; `lead` the line under it. */
export const POLICIES = [
  { key: 'privacy', to: '/privacy', name: 'lpol.privacy.title', lead: 'lpp.hero.subtitle', effective: EFFECTIVE_DATE, sections: privacy },
  { key: 'terms', to: '/terms', name: 'lpol.terms.title', lead: 'lt.hero.subtitle', effective: EFFECTIVE_DATE, sections: terms },
  { key: 'refund', to: '/cancellation-refund', name: 'lpol.refund.title', lead: 'lcr.subtitle', effectiveKey: 'lcr.effectiveDate', sections: refund },
  { key: 'disclaimer', to: '/medical-disclaimer', name: 'lpol.disclaimer.title', lead: 'lmd.hero.subtitle', emergency: true, closing: 'lmd.closing', sections: disclaimer },
]
