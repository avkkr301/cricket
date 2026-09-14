const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
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
const auth = getAuth();

async function createAdminM() {
  const username = 'adminM';
  const spoofedEmail = `${username.toLowerCase()}@local.app`;
  const password = 'M163';
  const paddedPassword = password + '_app'; // Padding to meet Firebase 6 char limit

  try {
    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(spoofedEmail);
      console.log('User already exists in Auth, updating password...');
      await auth.updateUser(userRecord.uid, { password: paddedPassword });
    } catch (e) {
      userRecord = await auth.createUser({
        email: spoofedEmail,
        password: paddedPassword,
        displayName: username,
      });
      console.log('Created new user in Auth.');
    }

    await db.collection('users').doc(userRecord.uid).set({
      username: username,
      email: spoofedEmail,
      role: 'MANAGER', 
      parentId: null,
      walletBalance: 10000.00, 
      isRestricted: false,
      createdAt: new Date(),
    });

    console.log(`Successfully created MANAGER account for ${username}`);
    process.exit(0);
  } catch (error) {
    console.error('Error creating account:', error);
    process.exit(1);
  }
}

createAdminM();
