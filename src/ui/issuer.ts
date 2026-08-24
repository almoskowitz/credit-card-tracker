/** Maps a card's free-text issuer name to its accent token. Unknown issuers fall back to --issuer-default. */
export function issuerVar(issuer: string): string {
  const key = issuer.trim().toLowerCase();
  if (key.includes('american express') || key === 'amex') return 'var(--issuer-amex)';
  if (key === 'chase') return 'var(--issuer-chase)';
  if (key.includes('capital one')) return 'var(--issuer-capital-one)';
  if (key === 'citi' || key.includes('citibank')) return 'var(--issuer-citi)';
  if (key === 'barclays') return 'var(--issuer-barclays)';
  if (key.includes('bank of america')) return 'var(--issuer-bank-of-america)';
  return 'var(--issuer-default)';
}
