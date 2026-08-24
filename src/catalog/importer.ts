import type { CatalogBenefit, CatalogCard, CatalogEarnRate, CatalogSpendThreshold } from './catalog';
import { CATEGORY_SLUGS } from './categories';

const CADENCES = ['monthly', 'quarterly', 'semiannual', 'annual'] as const;
const ANCHORS = ['calendar', 'anniversary'] as const;
const CADENCE_SET: ReadonlySet<string> = new Set(CADENCES);
const ANCHOR_SET: ReadonlySet<string> = new Set(ANCHORS);
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const CADENCE_OPTIONS = CADENCES.join('|');
const ANCHOR_OPTIONS = ANCHORS.join('|');
const CATEGORY_OPTIONS = () => Array.from(CATEGORY_SLUGS).join(', ');

const BENEFIT_FIELDS = ['name', 'value', 'displayValue', 'cadence', 'anchor', 'category', 'valueOverrides'] as const;
const CARD_FIELDS = ['slug', 'name', 'issuer', 'annualFee', 'rewardCurrency', 'benefits', 'earnRates', 'caps', 'spendThresholds'] as const;
const EARN_RATE_FIELDS = ['category', 'rate', 'notes'] as const;
const SPEND_THRESHOLD_FIELDS = ['label', 'requirement', 'anchor'] as const;

/** A single validation failure, already formatted as `<path>.<field> <message>` or `<path> <message>`. */
export type ImportError = string;

export type CardValidation = { ok: true; value: CatalogCard } | { ok: false; errors: ImportError[] };
export type BenefitValidation = { ok: true; value: CatalogBenefit } | { ok: false; errors: ImportError[] };

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function unknownFieldErrors(obj: Record<string, unknown>, allowed: readonly string[], path: string): ImportError[] {
  const allowedSet = new Set<string>(allowed);
  const errors: ImportError[] = [];
  for (const key of Object.keys(obj)) {
    if (!allowedSet.has(key)) {
      errors.push(`${path ? `${path}.${key}` : key} is not a recognized field`);
    }
  }
  return errors;
}

function field(path: string, name: string): string {
  return path ? `${path}.${name}` : name;
}

function validateBenefitShape(value: unknown, path: string): { errors: ImportError[]; value: CatalogBenefit | null } {
  const errors: ImportError[] = [];
  if (!isPlainObject(value)) {
    return { errors: [`${path || 'benefit'} must be an object`], value: null };
  }
  errors.push(...unknownFieldErrors(value, BENEFIT_FIELDS, path));

  const name = value.name;
  if (typeof name !== 'string' || name.trim() === '') {
    errors.push(`${field(path, 'name')} is required`);
  }

  if (!('value' in value) || (value.value !== null && typeof value.value !== 'number')) {
    errors.push(`${field(path, 'value')} must be number|null`);
  }

  if (!('displayValue' in value) || (value.displayValue !== null && typeof value.displayValue !== 'string')) {
    errors.push(`${field(path, 'displayValue')} must be string|null`);
  }

  if (typeof value.cadence !== 'string' || !CADENCE_SET.has(value.cadence)) {
    errors.push(`${field(path, 'cadence')} must be ${CADENCE_OPTIONS}`);
  }

  if (typeof value.anchor !== 'string' || !ANCHOR_SET.has(value.anchor)) {
    errors.push(`${field(path, 'anchor')} must be ${ANCHOR_OPTIONS}`);
  }

  if (typeof value.category !== 'string' || !CATEGORY_SLUGS.has(value.category)) {
    errors.push(`${field(path, 'category')} must be one of: ${CATEGORY_OPTIONS()}`);
  }

  let valueOverrides: Record<string, number> | undefined;
  if ('valueOverrides' in value && value.valueOverrides !== undefined) {
    if (!isPlainObject(value.valueOverrides)) {
      errors.push(`${field(path, 'valueOverrides')} must be an object`);
    } else {
      valueOverrides = {};
      for (const [k, v] of Object.entries(value.valueOverrides)) {
        if (typeof v !== 'number') {
          errors.push(`${field(path, 'valueOverrides')}.${k} must be a number`);
        } else {
          valueOverrides[k] = v;
        }
      }
    }
  }

  if (errors.length > 0) return { errors, value: null };

  const benefit: CatalogBenefit = {
    name: name as string,
    value: (value.value as number | null) ?? null,
    displayValue: (value.displayValue as string | null) ?? null,
    cadence: value.cadence as CatalogBenefit['cadence'],
    anchor: value.anchor as CatalogBenefit['anchor'],
    category: value.category as string,
    ...(valueOverrides ? { valueOverrides } : {}),
  };
  return { errors: [], value: benefit };
}

/** Validates a bare benefit object — the shape pasted directly onto an open card. */
export function validateBenefit(value: unknown): BenefitValidation {
  const { errors, value: benefit } = validateBenefitShape(value, '');
  if (errors.length > 0 || !benefit) return { ok: false, errors };
  return { ok: true, value: benefit };
}

function validateEarnRate(value: unknown, path: string): { errors: ImportError[]; value: CatalogEarnRate | null } {
  const errors: ImportError[] = [];
  if (!isPlainObject(value)) return { errors: [`${path} must be an object`], value: null };
  errors.push(...unknownFieldErrors(value, EARN_RATE_FIELDS, path));

  if (typeof value.category !== 'string' || !CATEGORY_SLUGS.has(value.category)) {
    errors.push(`${field(path, 'category')} must be one of: ${CATEGORY_OPTIONS()}`);
  }
  if (typeof value.rate !== 'number') {
    errors.push(`${field(path, 'rate')} must be a number`);
  }
  if ('notes' in value && value.notes !== null && typeof value.notes !== 'string') {
    errors.push(`${field(path, 'notes')} must be string|null`);
  }

  if (errors.length > 0) return { errors, value: null };
  return {
    errors: [],
    value: { category: value.category as string, rate: value.rate as number, notes: (value.notes as string | null) ?? null },
  };
}

function validateSpendThreshold(value: unknown, path: string): { errors: ImportError[]; value: CatalogSpendThreshold | null } {
  const errors: ImportError[] = [];
  if (!isPlainObject(value)) return { errors: [`${path} must be an object`], value: null };
  errors.push(...unknownFieldErrors(value, SPEND_THRESHOLD_FIELDS, path));

  if (typeof value.label !== 'string' || value.label.trim() === '') {
    errors.push(`${field(path, 'label')} is required`);
  }
  if (typeof value.requirement !== 'number') {
    errors.push(`${field(path, 'requirement')} must be a number`);
  }
  if (typeof value.anchor !== 'string' || !ANCHOR_SET.has(value.anchor)) {
    errors.push(`${field(path, 'anchor')} must be ${ANCHOR_OPTIONS}`);
  }

  if (errors.length > 0) return { errors, value: null };
  return {
    errors: [],
    value: { label: value.label as string, requirement: value.requirement as number, anchor: value.anchor as CatalogSpendThreshold['anchor'] },
  };
}

/** Validates a full catalog card object — the shape used both by `data/cards.json` and a pasted new card. */
export function validateCatalogCard(value: unknown): CardValidation {
  const errors: ImportError[] = [];
  if (!isPlainObject(value)) return { ok: false, errors: ['card must be an object'] };

  errors.push(...unknownFieldErrors(value, CARD_FIELDS, ''));

  if (typeof value.slug !== 'string' || !SLUG_RE.test(value.slug)) {
    errors.push('slug must be kebab-case (e.g. "amex-platinum")');
  }
  if (typeof value.name !== 'string' || value.name.trim() === '') {
    errors.push('name is required');
  }
  if (typeof value.issuer !== 'string' || value.issuer.trim() === '') {
    errors.push('issuer is required');
  }
  if (!('annualFee' in value) || (value.annualFee !== null && typeof value.annualFee !== 'number')) {
    errors.push('annualFee must be number|null');
  }
  if ('rewardCurrency' in value && value.rewardCurrency !== undefined && value.rewardCurrency !== null && typeof value.rewardCurrency !== 'string') {
    errors.push('rewardCurrency must be string|null');
  }

  const benefits: CatalogBenefit[] = [];
  if (!Array.isArray(value.benefits)) {
    errors.push('benefits must be an array');
  } else {
    value.benefits.forEach((b, i) => {
      const { errors: benefitErrors, value: benefit } = validateBenefitShape(b, `benefits[${i}]`);
      errors.push(...benefitErrors);
      if (benefit) benefits.push(benefit);
    });
  }

  const earnRates: CatalogEarnRate[] = [];
  if (!Array.isArray(value.earnRates)) {
    errors.push('earnRates must be an array');
  } else {
    value.earnRates.forEach((e, i) => {
      const { errors: earnErrors, value: earnRate } = validateEarnRate(e, `earnRates[${i}]`);
      errors.push(...earnErrors);
      if (earnRate) earnRates.push(earnRate);
    });
  }

  if (!Array.isArray(value.caps)) {
    errors.push('caps must be an array');
  }

  const spendThresholds: CatalogSpendThreshold[] = [];
  if (!Array.isArray(value.spendThresholds)) {
    errors.push('spendThresholds must be an array');
  } else {
    value.spendThresholds.forEach((t, i) => {
      const { errors: thresholdErrors, value: threshold } = validateSpendThreshold(t, `spendThresholds[${i}]`);
      errors.push(...thresholdErrors);
      if (threshold) spendThresholds.push(threshold);
    });
  }

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      slug: value.slug as string,
      name: value.name as string,
      issuer: value.issuer as string,
      annualFee: (value.annualFee as number | null) ?? null,
      rewardCurrency: (value.rewardCurrency as string | null | undefined) ?? null,
      benefits,
      earnRates,
      caps: [],
      spendThresholds,
    },
  };
}

export interface JsonParseFailure {
  kind: 'parse';
  message: string;
}

/** JSON.parse, with the failure distinguished from a schema violation and the position preserved when V8 reports one. */
export function parseJson(text: string): { ok: true; value: unknown } | { ok: false; error: JsonParseFailure } {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, error: { kind: 'parse', message: `Invalid JSON: ${message}` } };
  }
}

export type PasteKind = 'card' | 'benefit';

/** A card has `issuer` and a `benefits` array; a bare benefit has `cadence` and no `issuer`. */
export function detectPasteKind(value: unknown): PasteKind | null {
  if (!isPlainObject(value)) return null;
  if (typeof value.issuer === 'string' && Array.isArray(value.benefits)) return 'card';
  if (typeof value.cadence === 'string') return 'benefit';
  return null;
}

export type PasteValidation =
  | { ok: true; kind: 'card'; value: CatalogCard }
  | { ok: true; kind: 'benefit'; value: CatalogBenefit }
  | { ok: false; kind: 'parse'; errors: ImportError[] }
  | { ok: false; kind: 'schema'; errors: ImportError[] };

/** Parses and validates pasted text as either a full catalog card or a bare benefit. */
export function validatePaste(text: string): PasteValidation {
  const parsed = parseJson(text);
  if (!parsed.ok) return { ok: false, kind: 'parse', errors: [parsed.error.message] };

  const kind = detectPasteKind(parsed.value);
  if (kind === null) {
    return {
      ok: false,
      kind: 'schema',
      errors: ['Could not tell whether this is a card (needs issuer + benefits[]) or a benefit (needs cadence)'],
    };
  }
  if (kind === 'card') {
    const result = validateCatalogCard(parsed.value);
    return result.ok ? { ok: true, kind: 'card', value: result.value } : { ok: false, kind: 'schema', errors: result.errors };
  }
  const result = validateBenefit(parsed.value);
  return result.ok ? { ok: true, kind: 'benefit', value: result.value } : { ok: false, kind: 'schema', errors: result.errors };
}
