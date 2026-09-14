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

export default function AccountManagement() {
  const { user } = useAuth();
  const [users, setUsers] = useState<SubUser[]>([]);
  const [stats, setStats] = useState({ totalAccounts: 0, totalDistributed: 0 });
  const [loading, setLoading] = useState(true);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);

  const fetchUsers = async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/users/list?userId=${user.uid}&role=${user.role}`);
      const data = await res.json();
      if (data.users) {
        setUsers(data.users);
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Failed to fetch users', error);
    } finally {
      setLoading(false);
    }
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
              {users.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                    No accounts created yet.
                  </td>
                </tr>
              )}
              {users.map((sub) => (
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
