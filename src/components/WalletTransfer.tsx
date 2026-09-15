'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';

export default function WalletTransfer() {
  const { user } = useAuth();
  const [receivers, setReceivers] = useState<Array<{ id: string; username: string; role: string }>>([]);
  const [receiverId, setReceiverId] = useState('');
  const [amount, setAmount] = useState('');
  const [operation, setOperation] = useState<'TRANSFER' | 'WITHDRAW'>('TRANSFER');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  useEffect(() => {
    if (!user || (user.role !== 'ADMIN' && user.role !== 'MANAGER')) return;
    fetch(`/api/users/list?userId=${user.uid}&role=${user.role}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Unable to load recipients');
        const accounts = user.role === 'ADMIN'
          ? (data.managers || []).map((manager: { id: string; username: string; role?: string }) => ({
              id: manager.id,
              username: manager.username,
              role: manager.role || 'MANAGER',
            }))
          : (data.users || []).map((account: { id: string; username: string; role?: string }) => ({
              id: account.id,
              username: account.username,
              role: account.role || 'USER',
            }));
        setReceivers(accounts);
      })
      .catch((error) => setMessage({ text: error instanceof Error ? error.message : 'Unable to load recipients', type: 'error' }));
  }, [user]);

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setLoading(true);
    setMessage({ text: '', type: '' });

    try {
      const res = await fetch('/api/wallet/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: user.uid,
          receiverId,
          amount: parseFloat(amount),
          operation,
        })
      });

      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error);

      setMessage({ text: operation === 'WITHDRAW' ? 'Withdrawal successful!' : 'Transfer successful!', type: 'success' });
      setReceiverId('');
      setAmount('');
    } catch (err: unknown) {
      setMessage({ text: err instanceof Error ? err.message : 'Unable to transfer funds', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleTransfer} className="space-y-4">
      {message.text && (
        <div className={`p-3 rounded text-sm ${message.type === 'error' ? 'bg-red-500/20 text-red-300' : 'bg-green-500/20 text-green-300'}`}>
          {message.text}
        </div>
      )}
      
      {user?.role === 'MANAGER' && (
        <div className="flex rounded-lg bg-gray-900 p-1">
          <button
            type="button"
            onClick={() => setOperation('TRANSFER')}
            className={`flex-1 rounded px-3 py-2 text-sm font-bold ${operation === 'TRANSFER' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}
          >
            Transfer to user
          </button>
          <button
            type="button"
            onClick={() => setOperation('WITHDRAW')}
            className={`flex-1 rounded px-3 py-2 text-sm font-bold ${operation === 'WITHDRAW' ? 'bg-amber-600 text-white' : 'text-gray-400'}`}
          >
            Withdraw from user
          </button>
        </div>
      )}
      <div>
        <label className="block text-sm font-medium mb-1">{operation === 'WITHDRAW' ? 'User account' : 'Receiver'}</label>
        <select
          value={receiverId}
          onChange={(e) => setReceiverId(e.target.value)}
          className="w-full p-2 bg-gray-900 border border-gray-600 rounded focus:border-blue-400 focus:outline-none"
          required
        >
          <option value="">Select an account</option>
          {receivers.map((receiver) => (
            <option key={receiver.id} value={receiver.id}>
              {receiver.username} ({receiver.role})
            </option>
          ))}
        </select>
        {receivers.length === 0 && <p className="mt-1 text-xs text-gray-500">No eligible accounts found.</p>}
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Amount ($)</label>
        <input 
          type="number" 
          step="0.01"
          min="1"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full p-2 bg-gray-900 border border-gray-600 rounded focus:border-blue-400 focus:outline-none"
          required
        />
      </div>
      <button 
        type="submit" 
        disabled={loading || user?.isRestricted}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-2 px-4 rounded transition-colors"
      >
        {loading ? 'Processing...' : operation === 'WITHDRAW' ? 'Withdraw Funds' : 'Transfer Funds'}
      </button>
    </form>
  );
}
