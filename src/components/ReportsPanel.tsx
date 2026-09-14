'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { FileText, History } from 'lucide-react';

type Transaction = {
  id: string;
  amount: number;
  type: string;
  timestamp: string;
  senderId: string;
  receiverId: string;
  betId?: string;
};

type Bet = {
  id: string;
  matchId: string;
  selection: string;
  odds: number;
  amount: number;
  potentialPayout: number;
  winnings?: number;
  status: 'PENDING' | 'WON' | 'LOST';
  placedAt: string | null;
};

export default function ReportsPanel() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [bets, setBets] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    const fetchReports = async () => {
      if (!user) return;
      try {
        const [reportsRes, betsRes] = await Promise.all([
          fetch(`/api/reports?userId=${user.uid}&role=${user.role}`),
          user.role === 'USER' ? fetch(`/api/bets?userId=${user.uid}`) : Promise.resolve(null),
        ]);
        const data = await reportsRes.json();
        setTransactions(data.transactions || []);
        if (betsRes) {
          const betsData = await betsRes.json();
          setBets(betsData.bets || []);
        }
      } catch (error) {
        console.error('Failed to fetch reports', error);
      } finally {
        setLoading(false);
      }
    };
    fetchReports();
  }, [user]);

  const filteredTransactions = transactions.filter(tx => {
    if (startDate && new Date(tx.timestamp) < new Date(startDate)) return false;
    // Add 1 day to end date to include the whole day
    if (endDate && new Date(tx.timestamp) > new Date(new Date(endDate).getTime() + 86400000)) return false;
    return true;
  });

  if (loading) return <div className="animate-pulse text-gray-500">Loading ledger...</div>;

  return (
    <div className="space-y-6 mt-8">
      {user?.role === 'USER' && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl shadow-xl overflow-hidden">
          <div className="p-6 border-b border-gray-800 flex items-center justify-between bg-gray-800/50">
            <h2 className="text-lg font-bold flex items-center">
              <History className="w-5 h-5 mr-2 text-blue-400" />
              Complete Bet History
            </h2>
            <span className="text-xs text-gray-500">{bets.length} total</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-950/50 text-gray-400 uppercase tracking-wider text-xs font-bold">
                <tr>
                  <th className="px-6 py-4">Placed</th>
                  <th className="px-6 py-4">Selection</th>
                  <th className="px-6 py-4">Odds</th>
                  <th className="px-6 py-4">Stake</th>
                  <th className="px-6 py-4">Payout</th>
                  <th className="px-6 py-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {bets.length === 0 && (
                  <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-500">No bets placed yet.</td></tr>
                )}
                {bets.map((bet) => (
                  <tr key={bet.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-gray-400 text-xs">
                      {bet.placedAt ? new Date(bet.placedAt).toLocaleString() : '—'}
                    </td>
                    <td className="px-6 py-4 font-bold text-white">{bet.selection}</td>
                    <td className="px-6 py-4 text-blue-400 font-mono font-bold">{bet.odds}</td>
                    <td className="px-6 py-4 text-white font-bold">₹{bet.amount.toFixed(2)}</td>
                    <td className="px-6 py-4 text-green-400 font-bold">₹{(bet.winnings ?? bet.potentialPayout ?? 0).toFixed(2)}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-bold border ${
                        bet.status === 'WON' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                        bet.status === 'LOST' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                        'bg-orange-500/10 text-orange-400 border-orange-500/20'
                      }`}>{bet.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="bg-gray-900 border border-gray-800 rounded-2xl shadow-xl overflow-hidden">
      <div className="p-6 border-b border-gray-800 flex flex-col md:flex-row justify-between items-start md:items-center bg-gray-800/50 gap-4">
        <h2 className="text-lg font-bold flex items-center">
          <FileText className="w-5 h-5 mr-2 text-gray-400" />
          Financial Ledger & Reports
        </h2>
        <div className="flex items-center gap-2">
          <input 
            type="date" 
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="bg-gray-950 border border-gray-700 p-2 rounded text-sm text-gray-300 focus:outline-none focus:border-green-500" 
          />
          <span className="text-gray-500">to</span>
          <input 
            type="date" 
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="bg-gray-950 border border-gray-700 p-2 rounded text-sm text-gray-300 focus:outline-none focus:border-green-500" 
          />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-950/50 text-gray-400 uppercase tracking-wider text-xs font-bold">
            <tr>
              <th className="px-6 py-4">Date</th>
              <th className="px-6 py-4">Type</th>
              <th className="px-6 py-4">Amount</th>
              <th className="px-6 py-4">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/50">
            {filteredTransactions.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                  No transactions found for this period.
                </td>
              </tr>
            )}
            {filteredTransactions.map((tx) => {
              const isCredit = tx.receiverId === user?.uid;
              return (
                <tr key={tx.id} className="hover:bg-gray-800/30 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-gray-400">
                    {new Date(tx.timestamp).toLocaleString()}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-xs font-bold border ${
                      tx.type === 'BET_DEDUCTION' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' : 
                      tx.type === 'WIN_REWARD' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 
                      'bg-blue-500/10 text-blue-400 border-blue-500/20'
                    }`}>
                      {tx.type.replace('_', ' ')}
                    </span>
                  </td>
                  <td className={`px-6 py-4 font-mono font-bold ${isCredit ? 'text-green-400' : 'text-red-400'}`}>
                    {isCredit ? '+' : '-'}${tx.amount.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-gray-500 text-xs">
                    {tx.betId ? `Bet ID: ${tx.betId}` : `Transfer Flow: ${tx.senderId.slice(0,5)} -> ${tx.receiverId.slice(0,5)}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
    </div>
  );
}
