'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { FileText, History, Activity } from 'lucide-react';
import { calculateBet, roundMoney, type BetMarket, type BetType } from '@/lib/bets/math';

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
  liability?: number;
  type?: 'LAGAI' | 'KHAI';
  market?: 'MATCH_ODDS' | 'BOOKMAKER' | 'SESSION';
  potentialPayout: number;
  winnings?: number;
  winnerTeam?: string;
  status: 'PENDING' | 'WON' | 'LOST' | 'CANCELLED';
  placedAt: string | null;
};

function getBetSummary(bet: Bet) {
  const selectionTeam = bet.selection
    .replace(/^(LAGAI|KHAI|BACK|LAY|WIN|LOSE)\s*-\s*/i, '')
    .split(' (')[0]
    .trim();
  const isLay = bet.type === 'KHAI' || /^(KHAI|LAY)\s*-/i.test(bet.selection);
  const betType: BetType = isLay ? 'KHAI' : 'LAGAI';
  const market: BetMarket = bet.market ?? (bet.odds > 10 ? 'BOOKMAKER' : 'MATCH_ODDS');
  const calculation = calculateBet(Number(bet.amount || 0), Number(bet.odds || 0), betType, market);
  const liability = roundMoney(Number(bet.liability ?? calculation.liability));
  const profit = calculation.profit;
  const returnAmount = calculation.returnAmount;

  return {
    selectedTeam: selectionTeam,
    winningCondition: isLay ? `${selectionTeam} loses` : `${selectionTeam} wins`,
    liability,
    profit,
    returnAmount,
  };
}

export default function ReportsPanel() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [bets, setBets] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [activeReport, setActiveReport] = useState<'PENDING' | 'SETTLED' | 'ACTIVITY'>('PENDING');

  useEffect(() => {
    const fetchReports = async () => {
      if (!user) return;
      try {
        const [reportsRes, betsRes] = await Promise.all([
          fetch(`/api/reports?userId=${user.uid}&role=${user.role}`),
          fetch(`/api/bets?userId=${user.uid}&role=${user.role}`),
        ]);
        const data = await reportsRes.json();
        setTransactions(data.transactions || []);
        if (betsRes) {
          const betsData = await betsRes.json();
          const loadedBets: Bet[] = betsData.bets || [];
          setBets(loadedBets);

          const pendingBets = loadedBets.filter((bet) => bet.status === 'PENDING');
          const settlementResults = await Promise.all(
            pendingBets.map(async (bet) => {
              const matchResponse = await fetch(`/api/matches/${encodeURIComponent(bet.matchId)}`);
              if (!matchResponse.ok) return false;
              const matchData = await matchResponse.json();
              const match = matchData.data;
              if (!match?.winnerTeam || match.status !== 'Finished') return false;

              const settleResponse = await fetch('/api/bets/settle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ matchId: bet.matchId, winnerTeam: match.winnerTeam }),
              });
              return settleResponse.ok;
            }),
          );

          if (settlementResults.some(Boolean)) {
            const refreshedBetsResponse = await fetch(`/api/bets?userId=${user.uid}&role=${user.role}`);
            const refreshedBetsData = await refreshedBetsResponse.json();
            setBets(refreshedBetsData.bets || []);
          }
        }
      } catch (error) {
        console.error('Failed to fetch reports', error);
      } finally {
        setLoading(false);
      }
    };
    fetchReports();
    const interval = setInterval(fetchReports, 15000);
    return () => clearInterval(interval);
  }, [user]);

  const filteredTransactions = transactions.filter(tx => {
    if (startDate && new Date(tx.timestamp) < new Date(startDate)) return false;
    // Add 1 day to end date to include the whole day
    if (endDate && new Date(tx.timestamp) >= new Date(new Date(endDate).getTime() + 86400000)) return false;
    return true;
  });

  if (loading) return <div className="animate-pulse text-gray-500">Loading ledger...</div>;

  return (
    <div className="space-y-6 mt-8">
      {(user?.role === 'USER' || user?.role === 'MANAGER' || user?.role === 'ADMIN') && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl shadow-xl overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-800 bg-gray-800/50 p-4 sm:p-6">
            <h2 className="flex items-center text-base font-bold sm:text-lg">
              <History className="w-5 h-5 mr-2 text-blue-400" />
              {user.role === 'USER' ? 'My Bet History' : 'Network Bet Activity'}
            </h2>
            <div className="grid grid-cols-3 gap-1 rounded-lg bg-gray-950 p-1">
              {(['PENDING', 'SETTLED', 'ACTIVITY'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveReport(tab)}
                  className={`rounded-md px-2 py-1.5 text-[9px] font-black uppercase tracking-wider sm:px-3 sm:text-[10px] ${
                    activeReport === tab ? 'bg-[#f3b51b] text-emerald-950' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {tab === 'ACTIVITY' ? 'Credit / Debit' : tab}
                </button>
              ))}
            </div>
          </div>
          {activeReport !== 'ACTIVITY' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-950/50 text-gray-400 uppercase tracking-wider text-xs font-bold">
                <tr>
                  <th className="px-6 py-4">Placed</th>
                  <th className="px-6 py-4">Selection</th>
                  <th className="px-6 py-4">Odds</th>
                  <th className="px-6 py-4">Wins if</th>
                  <th className="px-6 py-4">Risk / Liability</th>
                  <th className="px-6 py-4">Net profit</th>
                  <th className="px-6 py-4">Return</th>
                  <th className="px-6 py-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {bets.length === 0 && (
                  <tr><td colSpan={9} className="px-6 py-8 text-center text-gray-500">No bets placed yet.</td></tr>
                )}
                {bets.filter((bet) => activeReport === 'PENDING' ? bet.status === 'PENDING' : bet.status !== 'PENDING').map((bet) => (
                  (() => {
                    const summary = getBetSummary(bet);
                    return <tr key={bet.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-gray-400 text-xs">
                      {bet.placedAt ? new Date(bet.placedAt).toLocaleString() : '—'}
                    </td>
                    <td className="px-6 py-4 font-bold text-white">{bet.selection}</td>
                    <td className="px-6 py-4 text-blue-400 font-mono font-bold">{bet.odds}</td>
                    <td className="px-6 py-4 font-bold text-yellow-300">
                      {summary.winningCondition}
                    </td>
                    <td className="px-6 py-4 text-white font-bold">₹{summary.liability.toFixed(2)}</td>
                    <td className="px-6 py-4 text-green-400 font-bold">₹{summary.profit.toFixed(2)}</td>
                    <td className="px-6 py-4 text-green-300 font-bold">₹{bet.status === 'WON' ? (bet.winnings ?? summary.returnAmount).toFixed(2) : summary.returnAmount.toFixed(2)}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-bold border ${
                        bet.status === 'WON' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                        bet.status === 'LOST' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                        'bg-orange-500/10 text-orange-400 border-orange-500/20'
                      }`}>{bet.status}</span>
                    </td>
                  </tr>;
                  })()
                ))}
              </tbody>
            </table>
          </div>
          )}
        </div>
      )}

      {(activeReport === 'ACTIVITY' || user?.role !== 'USER') && <div className="bg-gray-900 border border-gray-800 rounded-2xl shadow-xl overflow-hidden">
      <div className="flex flex-col items-stretch justify-between gap-4 border-b border-gray-800 bg-gray-800/50 p-4 sm:p-6 md:flex-row md:items-center">
        <h2 className="text-lg font-bold flex items-center">
          {activeReport === 'ACTIVITY' ? <Activity className="w-5 h-5 mr-2 text-[#f3b51b]" /> : <FileText className="w-5 h-5 mr-2 text-gray-400" />}
          {user?.role === 'USER' ? 'Wallet Activity' : 'Manager Network Credit / Debit Activity'}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
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
                    {isCredit ? '+' : '-'}₹{Number(tx.amount).toFixed(2)}
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
      </div>}
    </div>
  );
}
