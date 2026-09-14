import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import type { QueryDocumentSnapshot } from 'firebase-admin/firestore';

type SerializedTransaction = {
  id: string;
  senderId?: string;
  receiverId?: string;
  timestamp: string | null;
  [key: string]: unknown;
};

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const role = searchParams.get('role');
    const filterUserId = searchParams.get('filterUserId'); // Optional: see specific user

    if (!userId || !role) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    if (role === 'USER') {
      // Users can only see transactions where they are sender or receiver
      // Firestore requires multiple queries for OR, so we fetch both and merge
      const sentSnapshot = await adminDb.collection('transactions').where('senderId', '==', userId).orderBy('timestamp', 'desc').get();
      const receivedSnapshot = await adminDb.collection('transactions').where('receiverId', '==', userId).orderBy('timestamp', 'desc').get();
      
      const combined = [...sentSnapshot.docs, ...receivedSnapshot.docs];
      // Sort in JS
      combined.sort((a, b) => b.data().timestamp.toDate().getTime() - a.data().timestamp.toDate().getTime());
      
      const transactions = combined.map(doc => ({ id: doc.id, ...doc.data(), timestamp: doc.data().timestamp.toDate().toISOString() }));
      return NextResponse.json({ transactions });
    }
    
    if (role === 'ADMIN') {
      const snapshot = await adminDb.collection('transactions').get();
      return NextResponse.json({ transactions: serializeTransactions(snapshot.docs) });
    }

    if (role === 'MANAGER' && !filterUserId) {
      const usersSnapshot = await adminDb.collection('users').where('parentId', '==', userId).get();
      const networkIds = new Set([userId, ...usersSnapshot.docs.map((doc) => doc.id)]);
      const snapshot = await adminDb.collection('transactions').get();
      const transactions = serializeTransactions(snapshot.docs).filter((tx) =>
        (tx.senderId ? networkIds.has(tx.senderId) : false) ||
        (tx.receiverId ? networkIds.has(tx.receiverId) : false)
      );
      return NextResponse.json({ transactions });
    }

    // For MANAGER/ADMIN, we could fetch all transactions involving them OR their subordinates.
    // For simplicity in this API, we fetch transactions where they are directly involved, 
    // OR if they provided a filterUserId (a subordinate), we fetch that subordinate's transactions.
    
    if (filterUserId) {
        // Fetch specific user transactions
        const sentSnapshot = await adminDb.collection('transactions').where('senderId', '==', filterUserId).orderBy('timestamp', 'desc').get();
        const receivedSnapshot = await adminDb.collection('transactions').where('receiverId', '==', filterUserId).orderBy('timestamp', 'desc').get();
        
        const combined = [...sentSnapshot.docs, ...receivedSnapshot.docs];
        combined.sort((a, b) => b.data().timestamp.toDate().getTime() - a.data().timestamp.toDate().getTime());
        
        const transactions = combined.map(doc => ({ id: doc.id, ...doc.data(), timestamp: doc.data().timestamp.toDate().toISOString() }));
        return NextResponse.json({ transactions });
    }

    // Default Manager/Admin view: Their own ledger
    const sentSnapshot = await adminDb.collection('transactions').where('senderId', '==', userId).orderBy('timestamp', 'desc').get();
    const receivedSnapshot = await adminDb.collection('transactions').where('receiverId', '==', userId).orderBy('timestamp', 'desc').get();
    
    const combined = [...sentSnapshot.docs, ...receivedSnapshot.docs];
    combined.sort((a, b) => b.data().timestamp.toDate().getTime() - a.data().timestamp.toDate().getTime());
    
    const transactions = combined.map(doc => ({ id: doc.id, ...doc.data(), timestamp: doc.data().timestamp.toDate().toISOString() }));
    
    return NextResponse.json({ transactions });

  } catch (error) {
    console.error('Reports Error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load reports' }, { status: 500 });
  }
}

function serializeTransactions(docs: QueryDocumentSnapshot[]): SerializedTransaction[] {
  return docs
    .map((doc) => {
      const data = doc.data();
      const timestamp = data.timestamp?.toDate?.()?.toISOString() ?? null;
      return { id: doc.id, ...data, timestamp } as SerializedTransaction;
    })
    .sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
}
