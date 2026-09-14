export type BetType = 'LAGAI' | 'KHAI';
export type BetMarket = 'MATCH_ODDS' | 'BOOKMAKER' | 'SESSION';

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function isValidMoney(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && roundMoney(value) === value;
}

export function calculateBet(
  amount: number,
  odds: number,
  type: BetType,
  market: BetMarket,
) {
  const profitRate = market === 'BOOKMAKER' ? odds / 100 : odds - 1;
  const liability = roundMoney(type === 'KHAI' ? amount * profitRate : amount);
  const returnAmount = roundMoney(type === 'KHAI'
    ? amount + liability
    : market === 'BOOKMAKER'
      ? amount * (1 + odds / 100)
      : amount * odds);

  return {
    deduction: liability,
    liability,
    returnAmount,
    profit: roundMoney(returnAmount - (type === 'KHAI' ? liability : amount)),
  };
}
