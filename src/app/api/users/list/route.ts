import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

type UserListItem = {
  id: string;
  parentId?: string | null;
  walletBalance?: number;
  createdAt?: string;
  users?: UserListItem[];
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

    if (role === 'ADMIN') {
      const [managersSnapshot, usersSnapshot] = await Promise.all([
        adminDb.collection('users').where('role', '==', 'MANAGER').get(),
        adminDb.collection('users').where('role', '==', 'USER').get(),
      ]);

      const managers: Array<UserListItem & { users: UserListItem[] }> = managersSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString(),
        users: usersSnapshot.docs
          .filter((userDoc) => userDoc.data().parentId === doc.id)
          .map((userDoc) => ({
            id: userDoc.id,
            ...userDoc.data(),
            createdAt: userDoc.data().createdAt?.toDate?.()?.toISOString(),
          })),
      }));
      const byCreatedAt = (left: UserListItem, right: UserListItem) =>
        String(right.createdAt || '').localeCompare(String(left.createdAt || ''));
      managers.sort(byCreatedAt);
      managers.forEach((manager) => manager.users.sort(byCreatedAt));
      const users = managers.flatMap((manager) => manager.users);
      return NextResponse.json({
        users: managers,
        managers,
        stats: {
          totalAccounts: managers.length,
          totalUsers: users.length,
          totalDistributed: managers.reduce((sum, manager) => sum + (Number(manager.walletBalance) || 0), 0),
          totalUserBalance: users.reduce((sum, listedUser) => sum + (Number(listedUser.walletBalance) || 0), 0),
        },
      });
    }

    // Managers see their direct users.
    const targetRole = 'USER';

    const usersSnapshot = await adminDb
      .collection('users')
      .where('role', '==', targetRole)
      .where('parentId', '==', role === 'ADMIN' ? null : userId)
      .get();

    const users: UserListItem[] = usersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      // Don't send sensitive info to client
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString(),
    }));
    users.sort((left, right) =>
      String(right.createdAt || '').localeCompare(String(left.createdAt || '')),
    );

    // Generate basic stats
    const totalBalance = users.reduce((sum, u) => sum + (Number(u.walletBalance) || 0), 0);

    return NextResponse.json({ 
      users,
      stats: {
        totalAccounts: users.length,
        totalDistributed: totalBalance
      }
    });

  } catch (error: unknown) {
    console.error('List Users Error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to list users' }, { status: 500 });
  }
}
