import { NextResponse } from 'next/server';
import { adminDb, getAdminAuth } from '@/lib/firebase/admin';

// WARNING: In a real production app, you should delete this file after running it once,
// or protect it heavily with a secret key so people can't keep creating admins.
export async function POST(req: Request) {
  try {
    const { email, password, username, secretKey } = await req.json();

    const configuredSecret = process.env.ADMIN_SETUP_SECRET;
    if (!configuredSecret || secretKey !== configuredSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Create the user in Firebase Authentication
    const userRecord = await (await getAdminAuth()).createUser({
      email,
      password,
      displayName: username,
    });

    // 2. Create the MASTER ADMIN document in Firestore
    await adminDb.collection('users').doc(userRecord.uid).set({
      username,
      email,
      role: 'ADMIN', 
      parentId: null, // Admins have no parents
      walletBalance: 0.00, // Admins don't strictly need a balance to transfer, but good to have
      isRestricted: false,
      createdAt: new Date(),
    });

    return NextResponse.json({ 
        success: true, 
        message: `MASTER ADMIN account created successfully!`,
        userId: userRecord.uid 
    });

  } catch (error: unknown) {
    console.error('Admin Creation Error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to create admin account' }, { status: 500 });
  }
}
