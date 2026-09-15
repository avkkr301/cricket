import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { isValidMoney, roundMoney } from '@/lib/bets/math';

export async function POST(req: Request) {
  try {
    const { senderId, receiverId, amount, operation = 'TRANSFER' } = await req.json();

    const parsedAmount = Number(amount);
    if (
      typeof senderId !== 'string' ||
      typeof receiverId !== 'string' ||
      !senderId ||
      !receiverId ||
      (operation !== 'TRANSFER' && operation !== 'WITHDRAW') ||
      !isValidMoney(parsedAmount) ||
      parsedAmount <= 0
    ) {
      return NextResponse.json({ error: 'Invalid transfer details' }, { status: 400 });
    }

    // Reference to the Firestore transaction
    const result = await adminDb.runTransaction(async (transaction) => {
      const senderRef = adminDb.collection('users').doc(senderId);
      const receiverRef = adminDb.collection('users').doc(receiverId);

      const senderDoc = await transaction.get(senderRef);
      const receiverDoc = await transaction.get(receiverRef);

      if (!senderDoc.exists || !receiverDoc.exists) {
        throw new Error('Sender or Receiver does not exist.');
      }

      const senderData = senderDoc.data();
      const receiverData = receiverDoc.data();

      if (operation === 'WITHDRAW') {
        if (senderData?.role !== 'MANAGER') {
          throw new Error('Only managers can withdraw funds from users.');
        }
        if (receiverData?.role !== 'USER' || receiverData.parentId !== senderId) {
          throw new Error('Managers can only withdraw from their assigned users.');
        }

        const userBalance = roundMoney(Number(receiverData.walletBalance) || 0);
        if (userBalance < parsedAmount) {
          throw new Error('Insufficient funds in the user wallet.');
        }

        const managerBalance = roundMoney(Number(senderData.walletBalance) || 0);
        transaction.update(receiverRef, {
          walletBalance: roundMoney(userBalance - parsedAmount),
        });
        transaction.update(senderRef, {
          walletBalance: roundMoney(managerBalance + parsedAmount),
        });

        transaction.set(adminDb.collection('transactions').doc(), {
          senderId: receiverId,
          receiverId: senderId,
          amount: parsedAmount,
          type: 'USER_WITHDRAWAL',
          reason: 'Manager withdrawal from subordinate user',
          timestamp: new Date(),
        });

        return { success: true, message: `Successfully withdrew ${parsedAmount.toFixed(2)}` };
      }

      // Core Rule: If sender is a Manager, check if they have enough balance
      if (senderData?.role === 'MANAGER') {
        const senderBalance = roundMoney(Number(senderData.walletBalance) || 0);
        if (senderBalance < parsedAmount) {
          throw new Error('Insufficient funds in Manager wallet.');
        }
        
        // Ensure Manager can only transfer to their own Users
        if (receiverData?.parentId !== senderId) {
          throw new Error('Manager can only transfer funds to their assigned users.');
        }
        
        // Deduct from Manager
        transaction.update(senderRef, {
          walletBalance: roundMoney(senderBalance - parsedAmount),
        });
      } 
      else if (senderData?.role === 'ADMIN') {
        // Ensure Admin only transfers to Managers
        if (receiverData?.role !== 'MANAGER') {
            throw new Error('Admin can only transfer funds directly to Managers.');
        }
        // Admins might have infinite balance, or we track it. Assuming infinite/mint for Admin here.
      } 
      else {
        throw new Error('Users cannot transfer funds.');
      }

      // Add to Receiver
      const currentReceiverBalance = roundMoney(Number(receiverData?.walletBalance) || 0);
      transaction.update(receiverRef, {
        walletBalance: roundMoney(currentReceiverBalance + parsedAmount),
      });

      // Log the transaction
      const transactionRef = adminDb.collection('transactions').doc();
      transaction.set(transactionRef, {
        senderId,
        receiverId,
        amount: parsedAmount,
        type: 'TRANSFER',
        timestamp: new Date(),
      });

      return { success: true, message: `Successfully transferred ${parsedAmount.toFixed(2)}` };
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error('Transfer Error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to transfer funds' }, { status: 500 });
  }
}
