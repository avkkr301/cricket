'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { ShieldPlus } from 'lucide-react';

export default function CreateAccountForm() {
  const { user } = useAuth();
  const [username, setUsername] = useState('');
  const [initialBalance, setInitialBalance] = useState('0');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  if (!user || user.role === 'USER') return null;

  const targetRole = user.role === 'ADMIN' ? 'MANAGER' : 'USER';

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ text: '', type: '' });

    try {
      const res = await fetch('/api/users/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creatorId: user.uid,
          username,
          role: targetRole,
          initialBalance: parseFloat(initialBalance),
        }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

      setMessage({ text: data.message, type: 'success' });
      setUsername('');
      setInitialBalance('0');
    } catch (err: unknown) {
      setMessage({ text: err instanceof Error ? err.message : 'Unable to create account', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleCreate} className="space-y-4 mt-4">
      {message.text && (
        <div className={`p-3 rounded text-sm ${message.type === 'error' ? 'bg-red-500/20 text-red-300' : 'bg-green-500/20 text-green-300'}`}>
          {message.text}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium mb-1">New {targetRole} Username</label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value.trim())}
          className="w-full p-2 bg-gray-900 border border-gray-600 rounded focus:border-green-400 focus:outline-none"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Initial Wallet Balance ($)
          {user.role === 'MANAGER' && <span className="text-xs text-gray-400 block">This will be deducted from your wallet!</span>}
        </label>
        <input
          type="number"
          step="0.01"
          min="0"
          value={initialBalance}
          onChange={(e) => setInitialBalance(e.target.value)}
          className="w-full p-2 bg-gray-900 border border-gray-600 rounded focus:border-green-400 focus:outline-none"
          required
        />
      </div>

      <button
        type="submit"
        disabled={loading || user.isRestricted}
        className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold py-2 px-4 rounded transition-colors flex items-center justify-center"
      >
        <ShieldPlus className="w-4 h-4 mr-2" />
        {loading ? 'Creating...' : `Create ${targetRole} Account`}
      </button>
    </form>
  );
}
