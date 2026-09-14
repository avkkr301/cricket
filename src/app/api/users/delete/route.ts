import { NextResponse } from 'next/server';
import { adminDb, getAdminAuth } from '@/lib/firebase/admin';

export async function DELETE(req: Request) {
  try {
    const { targetUserId, requesterId } = await req.json();

    if (!targetUserId || !requesterId) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    // Verify requester
    const requesterDoc = await adminDb.collection('users').doc(requesterId).get();
    if (!requesterDoc.exists) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const requesterData = requesterDoc.data();
    if (requesterData?.role === 'USER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Verify target
    const targetDoc = await adminDb.collection('users').doc(targetUserId).get();
    if (!targetDoc.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const targetData = targetDoc.data();

    // Check ownership
    if (requesterData?.role === 'MANAGER' && targetData?.parentId !== requesterId) {
      return NextResponse.json({ error: 'You do not have permission to delete this user.' }, { status: 403 });
    }
    
    if (requesterData?.role === 'ADMIN' && targetData?.role !== 'MANAGER') {
      return NextResponse.json({ error: 'Admins can only manage Managers.' }, { status: 403 });
    }

    // Delete from Firebase Auth
    await (await getAdminAuth()).deleteUser(targetUserId);

    // Update Firestore to mark as deleted instead of hard delete to preserve financial history
    await adminDb.collection('users').doc(targetUserId).update({
      isRestricted: true,
      isDeleted: true,
      walletBalance: 0, // Wipe their balance
      deletedAt: new Date()
    });

    return NextResponse.json({ success: true, message: 'User successfully deleted and access revoked.' });

  } catch (error: any) {
    console.error('Delete User Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
