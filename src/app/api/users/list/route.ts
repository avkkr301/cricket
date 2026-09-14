import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

type UserListItem = {
  id: string;
  walletBalance?: number;
  createdAt?: string;
  [key: string]: unknown;
};

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const role = searchParams.get('role'); // Current user's role

    if (!userId || !role) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    if (role === 'USER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Admins see Managers, Managers see Users
    const targetRole = role === 'ADMIN' ? 'MANAGER' : 'USER';

    const usersSnapshot = await adminDb
      .collection('users')
      .where('role', '==', targetRole)
      .where('parentId', '==', role === 'ADMIN' ? null : userId)
      .orderBy('createdAt', 'desc')
      .get();

    const users: UserListItem[] = usersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      // Don't send sensitive info to client
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString(),
    }));

    // Generate basic stats
    const totalBalance = users.reduce((sum, u) => sum + (Number(u.walletBalance) || 0), 0);

    return NextResponse.json({ 
      users,
      stats: {
        totalAccounts: users.length,
        totalDistributed: totalBalance
      }
    });

  } catch (error: any) {
    console.error('List Users Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
