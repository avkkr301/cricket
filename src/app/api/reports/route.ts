import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const role = searchParams.get('role');
    const filterUserId = searchParams.get('filterUserId'); // Optional: see specific user

    if (!userId || !role) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    let query = adminDb.collection('transactions').orderBy('timestamp', 'desc');

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

  } catch (error: any) {
    console.error('Reports Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
