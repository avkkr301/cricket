import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';

export async function POST(req: Request) {
  try {
    const { username, role, creatorId, initialBalance = 0 } = await req.json();

    if (!username || !role || !creatorId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const parsedBalance = parseFloat(initialBalance);
    if (isNaN(parsedBalance) || parsedBalance < 0) {
      return NextResponse.json({ error: 'Invalid initial balance' }, { status: 400 });
    }

    // Determine default password based on role
    const defaultPassword = role === 'MANAGER' ? '1111' : '0000';
    const paddedPassword = defaultPassword + '_app';

    // Run everything in a transaction to ensure money is safe
    const result = await adminDb.runTransaction(async (transaction) => {
      // 1. Verify the Creator
      const creatorRef = adminDb.collection('users').doc(creatorId);
      const creatorDoc = await transaction.get(creatorRef);
      
      if (!creatorDoc.exists) {
          throw new Error('Creator does not exist');
      }

      const creatorData = creatorDoc.data();
      const creatorRole = creatorData?.role;

      // Enforce Hierarchy Rules:
      if (creatorRole === 'ADMIN' && role !== 'MANAGER') {
          throw new Error('Admins can only create Managers.');
      }
      if (creatorRole === 'MANAGER' && role !== 'USER') {
          throw new Error('Managers can only create standard Users.');
      }
      if (creatorRole === 'USER') {
          throw new Error('Users do not have permission to create accounts.');
      }

      // Handle Manager Balance Deduction for User Creation
      if (creatorRole === 'MANAGER') {
        const creatorBalance = Number(creatorData?.walletBalance) || 0;
        if (creatorBalance < parsedBalance) {
          throw new Error(`Insufficient funds. You only have $${creatorBalance} available.`);
        }
        // Deduct from Manager
        transaction.update(creatorRef, {
          walletBalance: creatorBalance - parsedBalance,
        });
      }

      // 2. Create the user in Firebase Authentication
      const spoofedEmail = `${username.toLowerCase()}@local.app`;

      let userRecord;
      try {
        userRecord = await adminAuth.createUser({
          email: spoofedEmail,
          password: paddedPassword,
          displayName: username,
        });
      } catch (authError: any) {
        if (authError.code === 'auth/email-already-exists') {
          throw new Error('Username already exists. Please choose another.');
        }
        throw authError;
      }

      // 3. Create the user's profile document in Firestore
      const newUserRef = adminDb.collection('users').doc(userRecord.uid);
      transaction.set(newUserRef, {
        username,
        email: spoofedEmail,
        role, 
        parentId: role === 'ADMIN' ? null : creatorId,
        walletBalance: parsedBalance,
        isRestricted: false,
        mustChangePassword: true, // Flag to force password reset on first login
        createdAt: new Date(),
      });

      // 4. Log the transaction if money was moved
      if (parsedBalance > 0) {
        const transactionLogRef = adminDb.collection('transactions').doc();
        transaction.set(transactionLogRef, {
          senderId: creatorId,
          receiverId: userRecord.uid,
          amount: parsedBalance,
          type: 'TRANSFER',
          note: 'Initial account creation funding',
          timestamp: new Date(),
        });
      }

      return { uid: userRecord.uid, role };
    });

    return NextResponse.json({ 
        success: true, 
        message: `${result.role} account created successfully with starting balance of $${parsedBalance}!`,
        userId: result.uid 
    });

  } catch (error: any) {
    console.error('Account Creation Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
