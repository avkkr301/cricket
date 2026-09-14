'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/client';

type UserData = {
  uid: string;
  email: string | null;
  role: 'ADMIN' | 'MANAGER' | 'USER';
  username: string;
  walletBalance: number;
  isRestricted: boolean;
  mustChangePassword?: boolean;
};

type AuthContextType = {
  user: UserData | null;
  loading: boolean;
};

const AuthContext = createContext<AuthContextType>({ user: null, loading: true });

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Listen to their Firestore document in real-time (so wallet updates instantly!)
        const docRef = doc(db, 'users', firebaseUser.uid);
        const unsubscribeSnapshot = onSnapshot(docRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              role: data.role,
              username: data.username,
              walletBalance: data.walletBalance,
              isRestricted: data.isRestricted,
              mustChangePassword: data.mustChangePassword,
            });
          }
          setLoading(false);
        });
        
        return () => unsubscribeSnapshot();
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
