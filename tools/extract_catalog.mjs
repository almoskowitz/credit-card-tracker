#!/usr/bin/env node
// Extracts INITIAL_CARD_DATABASE from index.html into data/cards.json (schema v1).
// Node, no dependencies. See openspec/changes/rebuild-v3/design.md §5 for the spec
// this implements. Run once, before index.html is replaced by the Vite entry point.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const INDEX_HTML = path.join(REPO_ROOT, 'index.html');
const OUTPUT = path.join(REPO_ROOT, 'data', 'cards.json');
const EXPECTED_LINE = 749;

const CATEGORIES = [
  { slug: 'dining', name: 'Dining' },
  { slug: 'supermarkets', name: 'Supermarkets' },
  { slug: 'gas', name: 'Gas Stations' },
  { slug: 'travel', name: 'Travel' },
  { slug: 'hotels', name: 'Hotels' },
  { slug: 'flights', name: 'Flights' },
  { slug: 'office-supply', name: 'Office Supply' },
  { slug: 'telecom', name: 'Internet / Cable / Phone' },
  { slug: 'shipping', name: 'Shipping' },
  { slug: 'drugstores', name: 'Drugstores' },
  { slug: 'rideshare', name: 'Rideshare' },
  { slug: 'streaming', name: 'Streaming' },
  { slug: 'everything-else', name: 'Everything Else' },
  { slug: 'other', name: 'Other' },
];
const CATEGORY_SLUGS = new Set(CATEGORIES.map((c) => c.slug));

// design.md §5.3 — the explicit 47-key -> 14-slug table. No fuzzy matching anywhere.
// notes: null means an exact/lossless mapping ("—" in the design table).
const MULTIPLIER_TABLE = {
  'AA Purchases': { slug: 'flights', notes: 'American Airlines purchases' },
  'Advertising': { slug: 'other', notes: 'Advertising' },
  'Airline/Car Rental/Cruise': { slug: 'travel', notes: 'Airline / car rental / cruise' },
  'AmexTravel': { slug: 'travel', notes: 'Booked via Amex Travel' },
  'AmexTravel Flights': { slug: 'flights', notes: 'Booked via Amex Travel' },
  'AmexTravel Hotels': { slug: 'hotels', notes: 'Booked via Amex Travel' },
  'Capital One Travel Hotels/Rental Cars': { slug: 'hotels', notes: 'Booked via Capital One Travel; incl. rental cars' },
  'Car Rentals': { slug: 'travel', notes: 'Car rentals' },
  'Chase Travel': { slug: 'travel', notes: 'Booked via Chase Travel' },
  'Construction/Hardware': { slug: 'other', notes: 'Construction / hardware' },
  'Delta Purchases': { slug: 'flights', notes: 'Delta purchases' },
  'Dining': { slug: 'dining', notes: null },
  'Dining (US Restaurants)': { slug: 'dining', notes: 'US restaurants only' },
  'Dining (US Takeout/Delivery)': { slug: 'dining', notes: 'US takeout / delivery only' },
  'Dining (US)': { slug: 'dining', notes: 'US only' },
  'Drugstores': { slug: 'drugstores', notes: null },
  'Electronics': { slug: 'other', notes: 'Electronics' },
  'Everything': { slug: 'everything-else', notes: null },
  'Everything (up to $50k)': { slug: 'everything-else', notes: 'Up to $50k/yr' },
  'Everything Else': { slug: 'everything-else', notes: null },
  'Fitness/Gym': { slug: 'other', notes: 'Fitness / gym' },
  'Flights': { slug: 'flights', notes: null },
  'Flights (Direct)': { slug: 'flights', notes: 'Booked direct with the airline' },
  'Food Delivery': { slug: 'dining', notes: 'Food delivery' },
  'Gas Stations': { slug: 'gas', notes: null },
  'Gas Stations (US)': { slug: 'gas', notes: 'US only' },
  'Grocery': { slug: 'supermarkets', notes: null },
  'Hilton': { slug: 'hotels', notes: 'Hilton properties' },
  'Hotels (Direct)': { slug: 'hotels', notes: 'Booked direct with the hotel' },
  'Hyatt Purchases': { slug: 'hotels', notes: 'Hyatt properties' },
  'Internet/Cable/Phone': { slug: 'telecom', notes: null },
  'JetBlue Purchases': { slug: 'flights', notes: 'JetBlue purchases' },
  'Lyft': { slug: 'rideshare', notes: 'Lyft only' },
  'Marriott': { slug: 'hotels', notes: 'Marriott properties' },
  'Office Supply': { slug: 'office-supply', notes: null },
  'Over $50k': { slug: 'everything-else', notes: 'Spend above $50k/yr' },
  'Purchases $5k+': { slug: 'everything-else', notes: 'Single purchases $5k+' },
  'Quarterly 5% Categories': { slug: 'other', notes: 'Rotating quarterly 5% categories' },
  'Rideshare': { slug: 'rideshare', notes: null },
  'Shipping': { slug: 'shipping', notes: null },
  'Software/Cloud': { slug: 'other', notes: 'Software / cloud' },
  'Streaming': { slug: 'streaming', notes: null },
  'Supermarkets': { slug: 'supermarkets', notes: null },
  'Supermarkets (US)': { slug: 'supermarkets', notes: 'US only' },
  'Telcom/Cable/Satellite': { slug: 'telecom', notes: null },
  'Top 2 Categories Auto': { slug: 'other', notes: 'Top 2 spend categories, automatic' },
  'Travel': { slug: 'travel', notes: null },
};

// The source's periodicBenefits "type" field only ever takes these 3 values, none of
// which is one of the 47 multiplier keys. No table for this mapping exists in design.md;
// this is the conservative, explicit, non-fuzzy reading: Dining/Travel map to their
// same-named slug, and the catch-all "Shop" (memberships, gift credits, retail credits)
// maps to "other" rather than guessing a specific retail category. Flagged in the PR/report.
const BENEFIT_TYPE_TABLE = {
  Dining: 'dining',
  Travel: 'travel',
  Shop: 'other',
};

const CADENCE_BY_FREQUENCY = {
  Monthly: 'monthly',
  Quarterly: 'quarterly',
  'Semi-Annual': 'semiannual',
  Annual: 'annual',
};

const SPAN_BY_FREQUENCY = { Monthly: 12, Quarterly: 4, 'Semi-Annual': 2 };

const MONTH_SUFFIX_TO_PERIOD = {
  Jan: 'M1', Feb: 'M2', Mar: 'M3', Apr: 'M4', May: 'M5', Jun: 'M6',
  Jul: 'M7', Aug: 'M8', Sep: 'M9', Oct: 'M10', Nov: 'M11', Dec: 'M12',
};
const QUARTER_SUFFIX_TO_PERIOD = { Q1: 'Q1', Q2: 'Q2', Q3: 'Q3', Q4: 'Q4' };
const HALF_SUFFIX_TO_PERIOD = { H1: 'H1', H2: 'H2' };

const SUFFIX_TABLE_BY_FREQUENCY = {
  Monthly: MONTH_SUFFIX_TO_PERIOD,
  Quarterly: QUARTER_SUFFIX_TO_PERIOD,
  'Semi-Annual': HALF_SUFFIX_TO_PERIOD,
};

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function loadDatabase(indexHtmlPath = INDEX_HTML) {
  if (!fs.existsSync(indexHtmlPath)) {
    throw new Error(`extract_catalog: ${indexHtmlPath} does not exist`);
  }
  const contents = fs.readFileSync(indexHtmlPath, 'utf8');
  const marker = 'const INITIAL_CARD_DATABASE';
  const markerIdx = contents.indexOf(marker);
  if (markerIdx === -1) {
    throw new Error(
      `extract_catalog: no parseable card database literal found in ${path.relative(REPO_ROOT, indexHtmlPath)} ` +
        `(expected near line ${EXPECTED_LINE})`,
    );
  }
  const braceStart = contents.indexOf('{', markerIdx);
  if (braceStart === -1) {
    throw new Error(`extract_catalog: found ${marker} but no opening brace followed it`);
  }
  const braceEnd = findMatchingBrace(contents, braceStart);
  const jsonText = contents.slice(braceStart, braceEnd + 1);
  let db;
  try {
    db = JSON.parse(jsonText);
  } catch (err) {
    throw new Error(`extract_catalog: failed to JSON.parse the card database literal: ${err.message}`);
  }
  const lineNumber = contents.slice(0, braceStart).split('\n').length;
  return { db, lineNumber };
}

function findMatchingBrace(text, openIdx) {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = openIdx; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
    } else if (ch === '{') {
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  throw new Error('extract_catalog: unbalanced braces in card database literal');
}

function normalizeValue(rawValue, monetaryValue) {
  if (typeof rawValue === 'number') {
    return { value: rawValue, displayValue: null };
  }
  if (typeof monetaryValue === 'number') {
    return { value: monetaryValue, displayValue: rawValue };
  }
  return { value: null, displayValue: rawValue };
}

function stripSuffix(name, frequency, period) {
  if (frequency === 'Annual') {
    return { base: name, wellFormed: true };
  }
  const table = SUFFIX_TABLE_BY_FREQUENCY[frequency];
  for (const [suffix, expectedPeriod] of Object.entries(table)) {
    if (name.endsWith(' ' + suffix)) {
      const base = name.slice(0, -(suffix.length + 1));
      return { base, wellFormed: expectedPeriod === period, matchedSuffix: suffix };
    }
  }
  return { base: name, wellFormed: false, matchedSuffix: null };
}

function modalValue(values) {
  const counts = new Map();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best = values[0];
  let bestCount = -1;
  for (const [v, count] of counts) {
    if (count > bestCount || (count === bestCount && v < best)) {
      best = v;
      bestCount = count;
    }
  }
  return best;
}

function mapBenefitCategory(type) {
  return BENEFIT_TYPE_TABLE[type] ?? 'other';
}

function mapMultiplierKey(key) {
  return MULTIPLIER_TABLE[key] ?? { slug: 'other', notes: key };
}

export function extract(db, { onIllFormedGroup = () => {} } = {}) {
  const cards = [];
  const stats = { rowCount: 0, byFrequency: { Monthly: 0, Quarterly: 0, 'Semi-Annual': 0, Annual: 0 } };
  let rowsAccountedFor = 0;
  let definitionCount = 0;
  const definitionCountByCadence = { monthly: 0, quarterly: 0, semiannual: 0, annual: 0 };
  let overrideCount = 0;
  let illFormedGroupCount = 0;

  for (const [cardName, card] of Object.entries(db)) {
    const rows = card.periodicBenefits ?? [];
    for (const row of rows) {
      stats.rowCount++;
      stats.byFrequency[row.frequency] = (stats.byFrequency[row.frequency] ?? 0) + 1;
    }

    // Group Monthly/Quarterly/Semi-Annual rows by (baseName, frequency); Annual rows are
    // never grouped — each is emitted as its own singleton per design.md §5.1.4.
    const groups = new Map(); // key -> { frequency, members: [{row, base, matchedSuffix}] }
    const annualRows = [];
    for (const row of rows) {
      if (row.frequency === 'Annual') {
        annualRows.push(row);
        continue;
      }
      const { base, wellFormed, matchedSuffix } = stripSuffix(row.name, row.frequency, row.period);
      const key = `${row.frequency}||${base}`;
      if (!groups.has(key)) groups.set(key, { frequency: row.frequency, base, members: [] });
      groups.get(key).members.push({ row, wellFormed, matchedSuffix });
    }

    const benefits = [];

    for (const { frequency, base, members } of groups.values()) {
      rowsAccountedFor += members.length;
      const span = SPAN_BY_FREQUENCY[frequency];
      const periods = members.map((m) => m.row.period);
      const uniquePeriods = new Set(periods);
      const allWellFormed = members.every((m) => m.wellFormed);
      const expectedPeriods = new Set(Object.values(SUFFIX_TABLE_BY_FREQUENCY[frequency]));
      const isCompleteSpan =
        allWellFormed &&
        members.length === span &&
        uniquePeriods.size === span &&
        [...uniquePeriods].every((p) => expectedPeriods.has(p));

      if (!isCompleteSpan) {
        illFormedGroupCount++;
        onIllFormedGroup({
          card: cardName,
          base,
          frequency,
          members: members.map((m) => ({ name: m.row.name, period: m.row.period, value: m.row.value })),
        });
        for (const { row } of members) {
          const { value, displayValue } = normalizeValue(row.value, row.monetaryValue);
          benefits.push({
            name: row.name,
            value,
            displayValue,
            cadence: CADENCE_BY_FREQUENCY[frequency],
            anchor: 'calendar',
            category: mapBenefitCategory(row.type),
          });
          definitionCount++;
          definitionCountByCadence[CADENCE_BY_FREQUENCY[frequency]]++;
        }
        continue;
      }

      const values = members.map((m) => m.row.value);
      const modal = modalValue(values);
      const overrides = {};
      for (const { row } of members) {
        if (row.value !== modal) overrides[row.period] = row.value;
      }
      const hasOverrides = Object.keys(overrides).length > 0;
      if (hasOverrides) overrideCount++;

      const { value, displayValue } = normalizeValue(modal, undefined);
      const def = {
        name: base,
        value,
        displayValue,
        cadence: CADENCE_BY_FREQUENCY[frequency],
        anchor: 'calendar',
        category: mapBenefitCategory(members[0].row.type),
      };
      if (hasOverrides) def.valueOverrides = overrides;
      benefits.push(def);
      definitionCount++;
      definitionCountByCadence[CADENCE_BY_FREQUENCY[frequency]]++;
    }

    for (const row of annualRows) {
      rowsAccountedFor += 1;
      const { value, displayValue } = normalizeValue(row.value, row.monetaryValue);
      benefits.push({
        name: row.name,
        value,
        displayValue,
        cadence: 'annual',
        anchor: 'calendar',
        category: mapBenefitCategory(row.type),
      });
      definitionCount++;
      definitionCountByCadence.annual++;
    }

    // Multipliers -> earnRates, collapsing same-slug collisions to the higher rate.
    const earnRateBySlug = new Map(); // slug -> { rate, keys: [{key, rate}] }
    for (const [key, rate] of Object.entries(card.multipliers ?? {})) {
      const { slug } = mapMultiplierKey(key);
      if (!earnRateBySlug.has(slug)) earnRateBySlug.set(slug, []);
      earnRateBySlug.get(slug).push({ key, rate });
    }
    const earnRates = [];
    for (const [slug, entries] of earnRateBySlug) {
      if (entries.length === 1) {
        const { key, rate } = entries[0];
        const { notes } = mapMultiplierKey(key);
        earnRates.push({ category: slug, rate, notes });
      } else {
        const winner = entries.reduce((a, b) => (b.rate > a.rate ? b : a));
        const notes = entries.map((e) => e.key).join('; ');
        earnRates.push({ category: slug, rate: winner.rate, notes });
      }
    }

    const spendThresholds = (card.spendBenefits ?? []).map((sb) => ({
      label: sb.name,
      requirement: sb.spendRequired,
      anchor: sb.yearType === 'Membership Year' ? 'anniversary' : 'calendar',
    }));

    cards.push({
      slug: slugify(cardName),
      name: cardName,
      issuer: card.issuer,
      annualFee: card.annualFee ?? null,
      benefits,
      earnRates,
      caps: [],
      spendThresholds,
    });
  }

  return {
    catalog: {
      schemaVersion: 1,
      updated: new Date().toISOString().slice(0, 10),
      categories: CATEGORIES,
      cards,
    },
    stats: {
      cardCount: cards.length,
      rowCount: stats.rowCount,
      byFrequency: stats.byFrequency,
      rowsAccountedFor,
      definitionCount,
      definitionCountByCadence,
      overrideCount,
      illFormedGroupCount,
    },
  };
}

function preCollapseSum(card) {
  let sum = 0;
  for (const row of card.periodicBenefits ?? []) {
    if (typeof row.value === 'number') sum += row.value;
  }
  return sum;
}

function postCollapseSum(catalogCard) {
  let sum = 0;
  for (const b of catalogCard.benefits) {
    if (b.value === null) continue;
    if (b.cadence === 'annual') {
      sum += b.value;
      continue;
    }
    const span = { monthly: 12, quarterly: 4, semiannual: 2 }[b.cadence];
    const suffixes = {
      monthly: Array.from({ length: 12 }, (_, i) => `M${i + 1}`),
      quarterly: ['Q1', 'Q2', 'Q3', 'Q4'],
      semiannual: ['H1', 'H2'],
    }[b.cadence];
    for (const suffix of suffixes) {
      sum += b.valueOverrides?.[suffix] ?? b.value;
    }
    void span;
  }
  return sum;
}

export function runInvariantGate(db, { catalog, stats }) {
  const checks = [];
  const dbCards = Object.entries(db);

  checks.push({
    name: 'Exactly 24 cards',
    pass: stats.cardCount === 24,
    detail: `${stats.cardCount} cards`,
  });

  checks.push({
    name: 'All 283 input rows accounted for',
    pass: stats.rowCount === 283 && stats.rowsAccountedFor === stats.rowCount,
    detail: `${stats.rowsAccountedFor} of ${stats.rowCount} rows accounted for`,
  });

  let sumsOk = true;
  const sumDetails = [];
  for (const [cardName, card] of dbCards) {
    const catalogCard = catalog.cards.find((c) => c.name === cardName);
    const pre = preCollapseSum(card);
    const post = postCollapseSum(catalogCard);
    const diff = Math.abs(pre - post);
    if (diff > 1e-6) {
      sumsOk = false;
      sumDetails.push(`${cardName}: pre=${pre} post=${post}`);
    }
  }
  checks.push({
    name: 'Per-card annual value sums match pre/post collapse',
    pass: sumsOk,
    detail: sumsOk ? `all ${dbCards.length} cards match` : sumDetails.join('; '),
  });

  let categoriesOk = true;
  for (const c of catalog.cards) {
    for (const b of c.benefits) if (!CATEGORY_SLUGS.has(b.category)) categoriesOk = false;
    for (const e of c.earnRates) if (!CATEGORY_SLUGS.has(e.category)) categoriesOk = false;
  }
  checks.push({ name: 'Every category is one of the 14 slugs', pass: categoriesOk, detail: categoriesOk ? 'ok' : 'violation found' });

  const CADENCES = new Set(['monthly', 'quarterly', 'semiannual', 'annual']);
  const ANCHORS = new Set(['calendar', 'anniversary']);
  let enumsOk = true;
  for (const c of catalog.cards) {
    for (const b of c.benefits) {
      if (!CADENCES.has(b.cadence) || !ANCHORS.has(b.anchor)) enumsOk = false;
    }
  }
  checks.push({ name: 'Every cadence and anchor is in its enum', pass: enumsOk, detail: enumsOk ? 'ok' : 'violation found' });

  checks.push({
    name: 'Ill-formed groups reported',
    pass: true,
    detail: `${stats.illFormedGroupCount} ill-formed group(s)`,
  });

  return checks;
}

function main() {
  let db, lineNumber;
  try {
    ({ db, lineNumber } = loadDatabase());
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }

  const illFormedGroups = [];
  const { catalog, stats } = extract(db, {
    onIllFormedGroup: (g) => {
      illFormedGroups.push(g);
      console.error(
        `ill-formed group: card=${g.card} base="${g.base}" frequency=${g.frequency} members=${JSON.stringify(g.members)}`,
      );
    },
  });

  console.log(
    `${stats.cardCount} cards, ${stats.rowCount} rows ` +
      `(${stats.byFrequency.Monthly ?? 0} monthly / ${stats.byFrequency.Quarterly ?? 0} quarterly / ` +
      `${stats.byFrequency['Semi-Annual'] ?? 0} semi-annual / ${stats.byFrequency.Annual ?? 0} annual)`,
  );
  console.log(`found literal at index.html:${lineNumber}`);
  console.log(
    `${stats.definitionCount} definitions emitted ` +
      `(${stats.definitionCountByCadence.monthly} monthly / ${stats.definitionCountByCadence.quarterly} quarterly / ` +
      `${stats.definitionCountByCadence.semiannual} semiannual / ${stats.definitionCountByCadence.annual} annual), ` +
      `${stats.overrideCount} with valueOverrides`,
  );

  const checks = runInvariantGate(db, { catalog, stats });
  console.log('\nInvariant gate:');
  let allPass = true;
  for (const check of checks) {
    console.log(`  [${check.pass ? 'PASS' : 'FAIL'}] ${check.name} — ${check.detail}`);
    if (!check.pass) allPass = false;
  }

  if (!allPass) {
    console.error('\nInvariant gate failed. data/cards.json was NOT written.');
    process.exit(1);
  }

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, JSON.stringify(catalog, null, 2) + '\n');
  console.log(`\nWrote ${path.relative(REPO_ROOT, OUTPUT)}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
