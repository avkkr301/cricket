const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '.env.local') });

if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = getFirestore();

async function updateRole() {
  try {
    const snapshot = await db.collection('users').where('username', '==', 'adminM').get();
    if (snapshot.empty) {
      console.log('User adminM not found.');
      return;
    }
    
    const docId = snapshot.docs[0].id;
    await db.collection('users').doc(docId).update({
      role: 'ADMIN',
      parentId: null
    });
    
    console.log('Successfully updated adminM to ADMIN role.');
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

updateRole();
