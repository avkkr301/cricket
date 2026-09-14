'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Trash2, Users, DollarSign, Activity } from 'lucide-react';

type SubUser = {
  id: string;
  username: string;
  email: string;
  role: string;
  walletBalance: number;
  isRestricted: boolean;
  createdAt: string;
};

type ManagerGroup = SubUser & { users: SubUser[] };

export default function AccountManagement() {
  const { user } = useAuth();
  const [users, setUsers] = useState<SubUser[]>([]);
  const [managers, setManagers] = useState<ManagerGroup[]>([]);
  const [stats, setStats] = useState({ totalAccounts: 0, totalDistributed: 0 });
  const [loading, setLoading] = useState(true);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const [adjustments, setAdjustments] = useState<Record<string, { amount: string; reason: string }>>({});
  const [adjusting, setAdjusting] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchUsers = async () => {
    if (!user) return;
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/users/list?userId=${user.uid}&role=${user.role}`);
      const responseText = await res.text();
      let data: { users?: SubUser[]; managers?: ManagerGroup[]; stats?: { totalAccounts: number; totalDistributed: number }; error?: string } = {};
      if (responseText.trim()) {
        try {
          data = JSON.parse(responseText);
        } catch {
          throw new Error(`Network request failed (${res.status})`);
        }
      }
      if (!res.ok) throw new Error(data.error || 'Unable to load network accounts');
      if (data.users) {
        if (user.role === 'ADMIN') setManagers(data.managers || []);
        else setUsers(data.users);
        if (data.stats) setStats(data.stats);
      }
    } catch (error) {
      console.error('Failed to fetch users', error);
      setErrorMessage(error instanceof Error ? error.message : 'Unable to load network accounts');
    } finally {
      setLoading(false);
    }
  };

  const handleAdjustment = async (targetUserId: string, direction: 'CREDIT' | 'DEBIT') => {
    if (!user || (user.role !== 'ADMIN' && user.role !== 'MANAGER')) return;
    const form = adjustments[targetUserId] || { amount: '', reason: '' };
    setAdjusting(targetUserId);
    try {
      const res = await fetch('/api/wallet/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requesterId: user.uid, targetUserId, direction, amount: Number(form.amount), reason: form.reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await fetchUsers();
      setAdjustments((current) => ({ ...current, [targetUserId]: { amount: '', reason: '' } }));
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Unable to adjust balance');
    } finally {
      setAdjusting(null);
    }
  };

  const renderAdjustment = (target: SubUser) => {
    if (user?.role !== 'ADMIN' && user?.role !== 'MANAGER') return null;
    const form = adjustments[target.id] || { amount: '', reason: '' };
    return (
      <div className="mt-2 flex flex-wrap justify-end gap-1">
        <input
          type="number"
          min="0.01"
          step="0.01"
          placeholder="Amount"
          value={form.amount}
          onChange={(event) => setAdjustments((current) => ({ ...current, [target.id]: { ...form, amount: event.target.value } }))}
          className="w-24 rounded border border-gray-700 bg-gray-950 px-2 py-1 text-xs"
        />
        <input
          type="text"
          placeholder="Reason"
          value={form.reason}
          onChange={(event) => setAdjustments((current) => ({ ...current, [target.id]: { ...form, reason: event.target.value } }))}
          className="w-32 rounded border border-gray-700 bg-gray-950 px-2 py-1 text-xs"
        />
        <button onClick={() => handleAdjustment(target.id, 'CREDIT')} disabled={adjusting === target.id} className="rounded bg-green-700 px-2 py-1 text-[10px] font-bold">Credit</button>
        <button onClick={() => handleAdjustment(target.id, 'DEBIT')} disabled={adjusting === target.id} className="rounded bg-red-700 px-2 py-1 text-[10px] font-bold">Debit</button>
      </div>
    );
  };

  useEffect(() => {
    fetchUsers();
  }, [user]);

  const handleDelete = async (targetId: string) => {
    if (!user) return;
    if (!confirm('Are you sure you want to delete this account? This action revokes their access and wipes their wallet.')) return;
    
    setDeleteLoading(targetId);
    try {
      const res = await fetch('/api/users/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: targetId, requesterId: user.uid })
      });
      
      if (res.ok) {
        setUsers(users.filter(u => u.id !== targetId));
      } else {
        const err = await res.json();
        alert(err.error);
      }
    } catch (error) {
      console.error('Delete error', error);
    } finally {
      setDeleteLoading(null);
    }
  };

  if (loading) return <div className="h-40 flex items-center justify-center animate-pulse text-gray-500">Loading Network...</div>;

  return (
    <div className="space-y-6">
    {errorMessage && (
      <div className="rounded-lg border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-200">
        {errorMessage}
      </div>
    )}
    {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-900 border border-gray-800 p-4 rounded-xl flex items-center shadow-lg">
          <div className="p-3 bg-blue-500/10 rounded-lg mr-4">
            <Users className="text-blue-400 w-6 h-6" />
          </div>
          <div>
            <p className="text-gray-400 text-xs font-bold uppercase tracking-wider">Total {user?.role === 'ADMIN' ? 'Managers' : 'Users'}</p>
            <h3 className="text-2xl font-black">{stats.totalAccounts}</h3>
          </div>
        </div>
        <div className="bg-gray-900 border border-gray-800 p-4 rounded-xl flex items-center shadow-lg">
          <div className="p-3 bg-green-500/10 rounded-lg mr-4">
            <DollarSign className="text-green-400 w-6 h-6" />
          </div>
          <div>
            <p className="text-gray-400 text-xs font-bold uppercase tracking-wider">Total Distributed</p>
            <h3 className="text-2xl font-black text-green-400">${stats.totalDistributed.toFixed(2)}</h3>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-800/50">
          <h2 className="text-lg font-bold flex items-center">
            <Activity className="w-5 h-5 mr-2 text-gray-400" />
            Network Management
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-950/50 text-gray-400 uppercase tracking-wider text-xs font-bold">
              <tr>
                <th className="px-6 py-4">Username</th>
                <th className="px-6 py-4">Wallet Balance</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {user?.role === 'ADMIN' ? managers.map((manager) => (
                <tr key={manager.id} className="align-top hover:bg-gray-800/30">
                  <td className="px-6 py-4">
                    <div className="font-bold text-yellow-300">Manager: {manager.username}</div>
                    <div className="text-xs text-gray-500 font-mono mt-1">{manager.id}</div>
                    {renderAdjustment(manager)}
                    {manager.users.map((child) => (
                      <div key={child.id} className="mt-3 border-l-2 border-blue-500/40 pl-3">
                        <div className="font-bold text-gray-200">User: {child.username}</div>
                        <div className="text-xs text-gray-500 font-mono">{child.id}</div>
                        {renderAdjustment(child)}
                      </div>
                    ))}
                  </td>
                  <td className="px-6 py-4 font-mono font-bold text-green-400">
                    ${Number(manager.walletBalance || 0).toFixed(2)}
                    {manager.users.map((child) => <div key={child.id} className="mt-3 text-blue-300">${Number(child.walletBalance || 0).toFixed(2)}</div>)}
                  </td>
                  <td className="px-6 py-4 text-xs text-gray-400">
                    {manager.users.length} user{manager.users.length === 1 ? '' : 's'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => handleDelete(manager.id)} disabled={deleteLoading === manager.id} className="p-2 text-gray-400 hover:text-red-400 rounded-lg">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              )) : users.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                    No accounts created yet.
                  </td>
                </tr>
              )}
              {user?.role !== 'ADMIN' && users.map((sub) => (
                <tr key={sub.id} className="hover:bg-gray-800/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-bold text-gray-200">{sub.username}</div>
                    <div className="text-xs text-gray-500 font-mono mt-1">{sub.id}</div>
                  </td>
                  <td className="px-6 py-4 font-mono font-bold text-green-400">
                    ${sub.walletBalance.toFixed(2)}
                  </td>
                  <td className="px-6 py-4">
                    {sub.isRestricted ? (
                      <span className="px-2 py-1 bg-red-500/10 text-red-400 rounded-md text-xs font-bold border border-red-500/20">RESTRICTED</span>
                    ) : (
                      <span className="px-2 py-1 bg-green-500/10 text-green-400 rounded-md text-xs font-bold border border-green-500/20">ACTIVE</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => handleDelete(sub.id)}
                      disabled={deleteLoading === sub.id}
                      className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors disabled:opacity-50"
                      title="Delete User"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
