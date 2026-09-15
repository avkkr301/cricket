'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { LockKeyhole } from 'lucide-react';
import { auth } from '@/lib/firebase/client';
import { updatePassword } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';

export default function ForcePasswordReset() {
  const { user } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (newPassword.length < 4) {
      setError('Password must be at least 4 characters long');
      return;
    }

    setLoading(true);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser || !user) throw new Error('Not authenticated');

      // Firebase requires 6 chars, so we pad it just like we do in login/creation
      const paddedPassword = newPassword + '_app';
      
      await updatePassword(currentUser, paddedPassword);
      
      // Update Firestore to remove the restriction
      await updateDoc(doc(db, 'users', user.uid), {
        mustChangePassword: false
      });
      
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to update password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-800 p-8 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex justify-center mb-6">
          <div className="bg-red-500/10 p-4 rounded-full">
            <LockKeyhole className="w-10 h-10 text-red-500" />
          </div>
        </div>
        <h1 className="text-2xl font-black text-white text-center mb-2">Update Required</h1>
        <p className="text-gray-400 text-center text-sm mb-8">
          For your security, you must change your default password before accessing your account.
        </p>

        {error && <div className="bg-red-500/20 text-red-400 p-3 rounded-lg text-sm mb-6 text-center">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-300 mb-2">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full p-3 bg-gray-950 border border-gray-800 rounded-xl focus:outline-none focus:border-green-500 text-white"
              required
              minLength={4}
              placeholder="Enter at least 4 characters"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-300 mb-2">Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full p-3 bg-gray-950 border border-gray-800 rounded-xl focus:outline-none focus:border-green-500 text-white"
              required
              minLength={4}
              placeholder="Re-enter password"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white font-bold py-3 px-4 rounded-xl transition-colors mt-6"
          >
            {loading ? 'Updating...' : 'Update Password & Continue'}
          </button>
        </form>
      </div>
    </div>
  );
}
