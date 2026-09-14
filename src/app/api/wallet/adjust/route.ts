import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { isValidMoney, roundMoney } from '@/lib/bets/math';

export async function POST(req: Request) {
  try {
    const { requesterId, targetUserId, direction, amount, reason } = await req.json();
    const parsedAmount = Number(amount);

    if (
      typeof requesterId !== 'string' ||
      typeof targetUserId !== 'string' ||
      !requesterId ||
      !targetUserId ||
      (direction !== 'CREDIT' && direction !== 'DEBIT') ||
      !isValidMoney(parsedAmount) ||
      parsedAmount <= 0 ||
      typeof reason !== 'string' ||
      !reason.trim()
    ) {
      return NextResponse.json({ error: 'Invalid balance adjustment details' }, { status: 400 });
    }

    const result = await adminDb.runTransaction(async (transaction) => {
      const requesterRef = adminDb.collection('users').doc(requesterId);
      const targetRef = adminDb.collection('users').doc(targetUserId);
      const requesterDoc = await transaction.get(requesterRef);
      const targetDoc = await transaction.get(targetRef);

      if (!requesterDoc.exists || !['ADMIN', 'MANAGER'].includes(String(requesterDoc.data()?.role))) {
        throw new Error('Only administrators and managers can adjust balances.');
      }
      if (!targetDoc.exists || !['MANAGER', 'USER'].includes(String(targetDoc.data()?.role))) {
        throw new Error('Target must be a manager or user.');
      }
      const requester = requesterDoc.data()!;
      const target = targetDoc.data()!;
      if (requester.role === 'MANAGER' && (target.role !== 'USER' || target.parentId !== requesterId)) {
        throw new Error('Managers can only adjust balances for their own users.');
      }

      const previousBalance = roundMoney(Number(targetDoc.data()?.walletBalance) || 0);
      const requesterBalance = roundMoney(Number(requester.walletBalance) || 0);
      const nextBalance = direction === 'CREDIT'
        ? roundMoney(previousBalance + parsedAmount)
        : roundMoney(previousBalance - parsedAmount);
      if (nextBalance < 0) throw new Error('Debit exceeds the target wallet balance.');

      transaction.update(targetRef, { walletBalance: nextBalance });
      if (requester.role === 'MANAGER') {
        const nextRequesterBalance = direction === 'CREDIT'
          ? roundMoney(requesterBalance - parsedAmount)
          : roundMoney(requesterBalance + parsedAmount);
        if (nextRequesterBalance < 0) throw new Error('Credit exceeds the manager wallet balance.');
        transaction.update(requesterRef, { walletBalance: nextRequesterBalance });
      }
      transaction.set(adminDb.collection('transactions').doc(), {
        senderId: direction === 'CREDIT' ? requesterId : targetUserId,
        receiverId: direction === 'CREDIT' ? targetUserId : requesterId,
        targetUserId,
        amount: parsedAmount,
        type: requester.role === 'ADMIN'
          ? direction === 'CREDIT' ? 'ADMIN_CREDIT' : 'ADMIN_DEBIT'
          : direction === 'CREDIT' ? 'MANAGER_CREDIT' : 'MANAGER_DEBIT',
        reason: reason.trim(),
        previousBalance,
        newBalance: nextBalance,
        actorId: requesterId,
        timestamp: new Date(),
      });

      return { previousBalance, newBalance: nextBalance };
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('Balance adjustment error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to adjust balance' },
      { status: 400 },
    );
  }
}
