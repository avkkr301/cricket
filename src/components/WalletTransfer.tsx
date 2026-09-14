'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';

export default function WalletTransfer() {
  const { user } = useAuth();
  const [receiverId, setReceiverId] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

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
          amount: parseFloat(amount)
        })
      });

      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error);

      setMessage({ text: 'Transfer successful!', type: 'success' });
      setReceiverId('');
      setAmount('');
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
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
      
      <div>
        <label className="block text-sm font-medium mb-1">Receiver User ID</label>
        <input 
          type="text" 
          value={receiverId}
          onChange={(e) => setReceiverId(e.target.value)}
          className="w-full p-2 bg-gray-900 border border-gray-600 rounded focus:border-blue-400 focus:outline-none"
          required
          placeholder="Paste User UID here"
        />
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
        {loading ? 'Processing...' : 'Transfer Funds'}
      </button>
    </form>
  );
}
