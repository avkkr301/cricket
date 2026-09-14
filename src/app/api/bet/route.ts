import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { calculateBet, isValidMoney, roundMoney, type BetMarket, type BetType } from '@/lib/bets/math';

export async function POST(req: Request) {
  try {
    const { userId, matchId, selection, odds, amount, market, type } = await req.json();
    const parsedOdds = Number(odds);
    const parsedAmount = Number(amount);
    const validMarkets = ['MATCH_ODDS', 'BOOKMAKER', 'SESSION'];
    const maxAmount = market === 'BOOKMAKER' ? 500000 : 5000;
    const betType = type === 'KHAI' ? 'KHAI' : type === 'LAGAI' ? 'LAGAI' : null;

    if (
      typeof userId !== 'string' ||
      typeof matchId !== 'string' ||
      typeof selection !== 'string' ||
      typeof market !== 'string' ||
      !validMarkets.includes(market) ||
      !betType ||
      !selection.trim() ||
      !Number.isFinite(parsedOdds) ||
      parsedOdds <= 1 ||
      !Number.isFinite(parsedAmount) ||
      !isValidMoney(parsedAmount) ||
      parsedAmount < 100 ||
      parsedAmount > maxAmount
    ) {
      return NextResponse.json({ error: 'Invalid bet details' }, { status: 400 });
    }

    const result = await adminDb.runTransaction(async (transaction) => {
      const userRef = adminDb.collection('users').doc(userId);
      const userDoc = await transaction.get(userRef);

      if (!userDoc.exists) {
        throw new Error('User does not exist.');
      }

      const userData = userDoc.data();

      // Only Users can place bets
      if (userData?.role !== 'USER') {
        throw new Error('Only standard users can place bets.');
      }

      if (userData.isRestricted) {
        throw new Error('Your account is restricted and cannot place bets.');
      }

      // Check balance
      const walletBalance = roundMoney(Number(userData.walletBalance) || 0);
      const calculation = calculateBet(parsedAmount, parsedOdds, betType as BetType, market as BetMarket);
      const deduction = calculation.deduction;
      if (walletBalance < deduction) {
        throw new Error('Insufficient funds to place this bet.');
      }

      // 1. Deduct balance
      transaction.update(userRef, {
        walletBalance: roundMoney(walletBalance - deduction),
      });

      // 2. Record the Bet
      const betRef = adminDb.collection('bets').doc();
      const placedAt = new Date();
      transaction.set(betRef, {
        userId,
        matchId,
        selection: selection.trim(),
        odds: parsedOdds,
        amount: roundMoney(parsedAmount),
        market,
        type: betType,
        liability: calculation.liability,
        potentialPayout: calculation.returnAmount,
        status: 'PENDING',
        placedAt,
        createdAt: placedAt,
      });

      // 3. Record the transaction history
      const transactionRef = adminDb.collection('transactions').doc();
      transaction.set(transactionRef, {
        senderId: userId,
        receiverId: 'HOUSE',
        amount: deduction,
        type: 'BET_DEDUCTION',
        timestamp: placedAt,
        betId: betRef.id,
      });

      return { success: true, message: `Bet placed successfully! Potential return: ${calculation.returnAmount.toFixed(2)}` };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Bet Placement Error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to place bet' }, { status: 500 });
  }
}
