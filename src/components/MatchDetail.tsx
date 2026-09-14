'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { ArrowLeft, Tv2, X, AlertTriangle, Clock, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';

type Match = {
  id: number | string;
  source?: 'sportmonks' | 'cricapi';
  localteam: { name: string; code: string };
  visitorteam: { name: string; code: string };
  note: string;
  status: string;
  starting_at?: string;
  score?: string; // CricAPI: human-readable score string
  runs?: Array<{ team_id: number; inning: number; score: number; wickets: number; overs: string }>;
};

type BetSelection = {
  matchId: number;
  matchName: string;
  team: string;
  type: 'LAGAI' | 'KHAI';
  market: 'MATCH_ODDS' | 'BOOKMAKER' | 'SESSION';
  odds: number;
  sessionLabel?: string;
};

type PlacedBet = {
  id: string;
  selection: string;
  odds: number;
  amount: number;
  status: string;
  placedAt: string | null;
};

function generateOdds(matchId: number) {
  const seed = matchId % 10;
  return {
    matchOdds: {
      local: { lagai: +(1.6 + seed * 0.05).toFixed(2), khai: +(1.62 + seed * 0.05).toFixed(2) },
      visitor: { lagai: +(2.2 + seed * 0.08).toFixed(2), khai: +(2.25 + seed * 0.08).toFixed(2) },
    },
    bookmaker: {
      local: { lagai: +(65 + seed * 2), khai: +(67 + seed * 2) },
      visitor: { lagai: +(120 + seed * 5), khai: +(128 + seed * 5) },
    },
    sessions: [
      { label: '1st Wkt Partnership', no: 28, yes: 26, noRate: 110, yesRate: 90 },
      { label: '5 Over Run', no: 42, yes: 40, noRate: 100, yesRate: 100 },
      { label: '10 Over Run', no: 82, yes: 80, noRate: 100, yesRate: 100 },
      { label: '20 Over Run', no: 155, yes: 153, noRate: 100, yesRate: 100 },
      { label: '2nd Wkt Fall', no: 69, yes: 65, noRate: 110, yesRate: 90 },
      { label: '3rd Wkt Fall', no: 111, yes: 108, noRate: 110, yesRate: 90 },
    ],
  };
}

function OddsBtn({
  value,
  sub,
  type,
  onClick,
  suspended,
}: {
  value: number | string;
  sub?: number | string;
  type: 'LAGAI' | 'KHAI';
  onClick: () => void;
  suspended?: boolean;
}) {
  if (suspended) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-gray-800/60 rounded-lg py-2 min-w-[60px] cursor-not-allowed">
        <span className="text-[9px] font-black text-gray-600 uppercase tracking-wider">SUSP</span>
      </div>
    );
  }
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex flex-col items-center justify-center rounded-lg py-2 min-w-[60px] transition-all active:scale-95 ${
        type === 'LAGAI'
          ? 'bg-blue-500/20 hover:bg-blue-500/40 border border-blue-500/30 hover:border-blue-400'
          : 'bg-red-500/20 hover:bg-red-500/40 border border-red-500/30 hover:border-red-400'
      }`}
    >
      <span className={`text-lg font-black leading-none ${type === 'LAGAI' ? 'text-blue-300' : 'text-red-300'}`}>{value}</span>
      {sub !== undefined && <span className="text-[10px] text-gray-500 mt-0.5">{sub}</span>}
    </button>
  );
}

function BetSlipModal({
  selection,
  balance,
  onClose,
  onConfirm,
}: {
  selection: BetSelection;
  balance: number;
  onClose: () => void;
  onConfirm: (amount: number) => Promise<void>;
}) {
  const [amount, setAmount] = useState('');
  const [oddsChanged, setOddsChanged] = useState(false);
  const [newOdds, setNewOdds] = useState(selection.odds);
  const [countdown, setCountdown] = useState(10);
  const [confirming, setConfirming] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const profit = amount ? (parseFloat(amount) * (newOdds - 1)).toFixed(2) : '0.00';

  // Randomly simulate odds drift after 2-4s
  useEffect(() => {
    const delay = 2000 + Math.random() * 2000;
    const drift = setTimeout(() => {
      if (Math.random() > 0.4) {
        setNewOdds((o) => +(o + (Math.random() > 0.5 ? 0.05 : -0.05)).toFixed(2));
        setOddsChanged(true);
      }
    }, delay);
    return () => clearTimeout(drift);
  }, []);

  // 10s countdown when odds change
  useEffect(() => {
    if (!oddsChanged) return;
    timerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(timerRef.current!);
          onClose();
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current!);
  }, [oddsChanged, onClose]);

  const handleConfirm = async () => {
    if (!amount || parseFloat(amount) <= 0) return;
    setConfirming(true);
    await onConfirm(parseFloat(amount));
    setConfirming(false);
  };

  const quickAmounts = [100, 500, 1000, 5000, 10000];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-3" onClick={onClose}>
      <div
        className="w-full max-w-sm bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`px-5 py-4 flex justify-between items-start ${selection.type === 'LAGAI' ? 'bg-blue-700' : 'bg-red-700'}`}>
          <div>
            <div className="text-[11px] font-black text-white/60 uppercase tracking-widest mb-1">
              {selection.type === 'LAGAI' ? '🔵 Back (Lagai)' : '🔴 Lay (Khai)'} · {selection.market.replace('_', ' ')}
            </div>
            <div className="text-white font-black text-xl leading-tight">{selection.team}</div>
            <div className="text-white/60 text-sm mt-0.5">{selection.matchName}</div>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white mt-1"><X className="w-5 h-5" /></button>
        </div>

        {/* Odds Changed Banner */}
        {oddsChanged && (
          <div className="bg-yellow-500/20 border-b border-yellow-500/40 px-4 py-2.5 flex items-center justify-between">
            <div className="flex items-center text-yellow-400 text-sm font-bold gap-2">
              <AlertTriangle className="w-4 h-4" />
              Odds changed! Accept to continue.
            </div>
            <div className="flex items-center text-yellow-300 font-black text-xl gap-1">
              <Clock className="w-4 h-4" />
              {countdown}s
            </div>
          </div>
        )}

        <div className="p-5 space-y-4">
          {/* Odds & Profit */}
          <div className="flex gap-3">
            <div className={`flex-1 rounded-xl p-3 text-center border ${selection.type === 'LAGAI' ? 'bg-blue-500/10 border-blue-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
              <div className="text-[11px] text-gray-400 font-bold mb-1">Odds</div>
              <div className={`text-2xl font-black ${selection.type === 'LAGAI' ? 'text-blue-400' : 'text-red-400'}`}>{newOdds}</div>
              {oddsChanged && <div className="text-[10px] text-yellow-400 mt-1">Changed!</div>}
            </div>
            <div className="flex-1 bg-green-500/10 border border-green-500/20 rounded-xl p-3 text-center">
              <div className="text-[11px] text-gray-400 font-bold mb-1">Profit</div>
              <div className="text-2xl font-black text-green-400">₹{profit}</div>
            </div>
          </div>

          {/* Stake Input */}
          <div>
            <div className="text-[11px] text-gray-400 font-black uppercase tracking-wider mb-1.5">Stake (₹)</div>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className="w-full bg-gray-800 border border-gray-600 focus:border-blue-500 rounded-xl px-4 py-3 text-2xl font-black text-white focus:outline-none transition-colors"
            />
            <div className="mt-1.5 flex justify-between text-[11px]">
              <span className="text-gray-500">Min: ₹100</span>
              <span className="text-gray-400">Balance: <span className="text-white font-bold">₹{balance.toFixed(2)}</span></span>
            </div>
          </div>

          {/* Quick Stakes */}
          <div className="grid grid-cols-5 gap-1.5">
            {quickAmounts.map((q) => (
              <button
                key={q}
                onClick={() => setAmount(String(q))}
                className="bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-black py-2 rounded-lg transition-colors"
              >
                {q >= 1000 ? `${q / 1000}K` : q}
              </button>
            ))}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 rounded-xl transition-colors text-sm">
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={confirming || !amount || parseFloat(amount) <= 0}
              className={`flex-[2] font-black py-3 rounded-xl transition-all disabled:opacity-50 shadow-lg text-sm ${
                oddsChanged
                  ? 'bg-yellow-500 hover:bg-yellow-400 text-black shadow-yellow-500/20'
                  : selection.type === 'LAGAI'
                  ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/25'
                  : 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/25'
              }`}
            >
              {confirming ? 'Placing...' : oddsChanged ? `Accept & Place` : 'Place Bet'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

type RealOdds = {
  home: { lagai: number; khai: number } | null;
  away: { lagai: number; khai: number } | null;
} | null;

// ─── Match Detail View ────────────────────────────────────────────────────────
export default function MatchDetail({ matchId, onBack }: { matchId: number | string; onBack: () => void }) {
  const { user } = useAuth();
  const [match, setMatch] = useState<Match | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedBet, setSelectedBet] = useState<BetSelection | null>(null);
  const [placedBets, setPlacedBets] = useState<PlacedBet[]>([]);
  const [toast, setToast] = useState('');
  const [sessionsOpen, setSessionsOpen] = useState(true);
  const [realOdds, setRealOdds] = useState<RealOdds>(null);
  const [oddsSource, setOddsSource] = useState<'real' | 'generated'>('generated');

  const generatedOdds = match ? generateOdds(typeof match.id === 'number' ? match.id : 0) : null;

  const fetchMatch = useCallback(async () => {
    try {
      const res = await fetch(`/api/matches/${matchId}`);
      const data = await res.json();
      setMatch(data.data ?? null);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  const fetchBets = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/bets?matchId=${matchId}&userId=${user.uid}`);
      const data = await res.json();
      setPlacedBets(data.bets || []);
    } catch {
      /* silent */
    }
  }, [matchId, user]);

  const fetchOdds = useCallback(async (m: Match) => {
    try {
      const res = await fetch(
        `/api/odds?home=${encodeURIComponent(m.localteam?.name)}&away=${encodeURIComponent(m.visitorteam?.name)}`
      );
      const data = await res.json();
      if (data.found && data.odds) {
        setRealOdds(data.odds);
        setOddsSource('real');
      }
    } catch {
      /* silently fall back to generated */
    }
  }, []);

  useEffect(() => {
    fetchMatch();
    fetchBets();
    const interval = setInterval(fetchMatch, 15000);
    return () => clearInterval(interval);
  }, [fetchMatch, fetchBets]);

  // Once match loads, fetch real odds
  useEffect(() => {
    if (match) fetchOdds(match);
    const interval = setInterval(() => { if (match) fetchOdds(match); }, 60000);
    return () => clearInterval(interval);
  }, [match, fetchOdds]);

  // Merged odds: real from The Odds API if available, else generated
  const odds = {
    matchOdds: {
      local: realOdds?.home ?? generatedOdds?.matchOdds.local ?? { lagai: 1.8, khai: 1.82 },
      visitor: realOdds?.away ?? generatedOdds?.matchOdds.visitor ?? { lagai: 2.2, khai: 2.22 },
    },
    bookmaker: generatedOdds?.bookmaker ?? { local: { lagai: 70, khai: 72 }, visitor: { lagai: 120, khai: 128 } },
    sessions: generatedOdds?.sessions ?? [],
  };

  const handleConfirmBet = async (amount: number) => {
    if (!user || !selectedBet || !match) return;
    try {
      const res = await fetch('/api/bet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          matchId: matchId.toString(),
          selection: `${selectedBet.type} - ${selectedBet.team}${selectedBet.sessionLabel ? ' (' + selectedBet.sessionLabel + ')' : ''}`,
          odds: selectedBet.odds,
          amount,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setToast(`✅ Bet placed: ₹${amount} on ${selectedBet.team}`);
      setTimeout(() => setToast(''), 3000);
      setSelectedBet(null);
      fetchBets();
    } catch (err: any) {
      setToast(`❌ ${err.message}`);
      setTimeout(() => setToast(''), 4000);
    }
  };

  const selectBet = (team: string, type: 'LAGAI' | 'KHAI', market: BetSelection['market'], oddsVal: number, sessionLabel?: string) => {
    if (!match) return;
    setSelectedBet({
      matchId: Number(match.id),
      matchName: `${match.localteam?.name} v ${match.visitorteam?.name}`,
      team,
      type,
      market,
      odds: oddsVal,
      sessionLabel,
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
        <span className="text-gray-400 text-sm">Loading match...</span>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-400">Match not found.</p>
        <button onClick={onBack} className="mt-4 text-blue-400 underline">Go back</button>
      </div>
    );
  }

  const isLive = match.status === 'Inprogress';
  const isEnded = ['Finished', 'Aban.', 'Cancl.', 'Postp.'].includes(match.status);
  const matchName = `${match.localteam?.name} v ${match.visitorteam?.name}`;
  const localRun = match.runs?.find(r => r.team_id === (match.localteam as any)?.id);
  const visitorRun = match.runs?.find(r => r.team_id === (match.visitorteam as any)?.id);

  return (
    <div className="space-y-4 pb-8">
      {/* Back header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors font-bold text-sm">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <button onClick={fetchMatch} className="ml-auto text-gray-500 hover:text-gray-300 transition-colors">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Match Header Card */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="bg-gray-950 px-4 py-3 flex items-center justify-between border-b border-gray-800">
          <div className="flex items-center gap-2">
            {isLive && (
              <span className="flex items-center text-xs font-black text-red-500 uppercase tracking-widest">
                <span className="w-2 h-2 bg-red-500 rounded-full mr-1.5 animate-pulse shadow-[0_0_6px_rgba(239,68,68,0.9)]" />
                LIVE
              </span>
            )}
            {isEnded && <span className="text-xs font-black text-gray-500 uppercase tracking-widest">ENDED</span>}
            {!isLive && !isEnded && <span className="text-xs font-bold text-blue-400">UPCOMING</span>}
            <span className="text-gray-400 text-sm">{match.note}</span>
          </div>
          <button className="p-1.5 rounded-lg bg-gray-800 text-gray-400 hover:text-blue-400 transition-colors">
            <Tv2 className="w-4 h-4" />
          </button>
        </div>

        {/* Scoreboard */}
        {match.source === 'cricapi' && match.score ? (
          <div className="px-5 py-4 text-center">
            <div className="font-black text-xl text-white mb-2">{matchName}</div>
            <div className="text-green-400 font-bold text-sm whitespace-pre-wrap">{match.score}</div>
          </div>
        ) : (
          <div className="p-5 grid grid-cols-3 items-center text-center">
            <div>
              <div className="font-black text-xl text-white">{match.localteam?.name}</div>
              {localRun && (
                <div className="text-2xl font-black text-green-400 mt-1">
                  {localRun.score}/{localRun.wickets}
                  <span className="text-sm text-gray-400 font-normal ml-1">({localRun.overs} ov)</span>
                </div>
              )}
            </div>
            <div className="text-gray-700 font-black text-2xl italic">VS</div>
            <div>
              <div className="font-black text-xl text-white">{match.visitorteam?.name}</div>
              {visitorRun && (
                <div className="text-2xl font-black text-green-400 mt-1">
                  {visitorRun.score}/{visitorRun.wickets}
                  <span className="text-sm text-gray-400 font-normal ml-1">({visitorRun.overs} ov)</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Ended match — no betting */}
      {isEnded ? (
        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-8 text-center">
          <div className="text-4xl mb-3">🏏</div>
          <h3 className="text-xl font-black text-gray-300">Match Ended</h3>
          <p className="text-gray-500 mt-2 text-sm">This match has concluded. No further bets can be placed.</p>
        </div>
      ) : (
        odds && (
          <>
            {/* Match Odds */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
              <div className="bg-gray-950 px-4 py-2.5 border-b border-gray-800 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-gray-300 uppercase tracking-wider">Match Odds</span>
                  {oddsSource === 'real' ? (
                    <span className="text-[9px] font-black bg-green-500/15 border border-green-500/30 text-green-400 px-2 py-0.5 rounded-full uppercase tracking-wider">🟢 Live Odds</span>
                  ) : (
                    <span className="text-[9px] font-black bg-gray-700/50 border border-gray-600 text-gray-500 px-2 py-0.5 rounded-full uppercase tracking-wider">Estimated</span>
                  )}
                </div>
                <span className="text-xs text-gray-600">Min: 100 | Max: 5,000</span>
              </div>
              <div className="p-4 space-y-2">
                <div className="flex items-center gap-1 mb-1">
                  <div className="flex-1" />
                  <div className="flex gap-1 w-[150px]">
                    <div className="flex-1 text-center text-[10px] font-black text-blue-400 uppercase tracking-wider">Lagai</div>
                    <div className="flex-1 text-center text-[10px] font-black text-red-400 uppercase tracking-wider">Khai</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 font-bold text-white">{match.localteam?.name}</div>
                  <div className="flex gap-1 w-[150px]">
                    <OddsBtn value={odds.matchOdds.local.lagai} type="LAGAI" onClick={() => selectBet(match.localteam.name, 'LAGAI', 'MATCH_ODDS', odds.matchOdds.local.lagai)} />
                    <OddsBtn value={odds.matchOdds.local.khai} type="KHAI" onClick={() => selectBet(match.localteam.name, 'KHAI', 'MATCH_ODDS', odds.matchOdds.local.khai)} />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 font-bold text-white">{match.visitorteam?.name}</div>
                  <div className="flex gap-1 w-[150px]">
                    <OddsBtn value={odds.matchOdds.visitor.lagai} type="LAGAI" onClick={() => selectBet(match.visitorteam.name, 'LAGAI', 'MATCH_ODDS', odds.matchOdds.visitor.lagai)} />
                    <OddsBtn value={odds.matchOdds.visitor.khai} type="KHAI" onClick={() => selectBet(match.visitorteam.name, 'KHAI', 'MATCH_ODDS', odds.matchOdds.visitor.khai)} />
                  </div>
                </div>
              </div>
            </div>

            {/* Bookmaker Odds */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
              <div className="bg-gray-950 px-4 py-2.5 border-b border-gray-800 flex justify-between items-center">
                <span className="text-xs font-black text-gray-300 uppercase tracking-wider">Bookmaker Odds</span>
                <span className="text-xs text-gray-600">Min: 100 | Max: 5,00,000</span>
              </div>
              <div className="p-4 space-y-2">
                <div className="flex items-center gap-1 mb-1">
                  <div className="flex-1" />
                  <div className="flex gap-1 w-[150px]">
                    <div className="flex-1 text-center text-[10px] font-black text-blue-400 uppercase tracking-wider">Lagai</div>
                    <div className="flex-1 text-center text-[10px] font-black text-red-400 uppercase tracking-wider">Khai</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 font-bold text-white">{match.localteam?.name}</div>
                  <div className="flex gap-1 w-[150px]">
                    <OddsBtn value={odds.bookmaker.local.lagai} type="LAGAI" onClick={() => selectBet(match.localteam.name, 'LAGAI', 'BOOKMAKER', odds.bookmaker.local.lagai)} />
                    <OddsBtn value={odds.bookmaker.local.khai} type="KHAI" onClick={() => selectBet(match.localteam.name, 'KHAI', 'BOOKMAKER', odds.bookmaker.local.khai)} />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 font-bold text-white">{match.visitorteam?.name}</div>
                  <div className="flex gap-1 w-[150px]">
                    <OddsBtn value={odds.bookmaker.visitor.lagai} type="LAGAI" onClick={() => selectBet(match.visitorteam.name, 'LAGAI', 'BOOKMAKER', odds.bookmaker.visitor.lagai)} />
                    <OddsBtn value={odds.bookmaker.visitor.khai} type="KHAI" onClick={() => selectBet(match.visitorteam.name, 'KHAI', 'BOOKMAKER', odds.bookmaker.visitor.khai)} />
                  </div>
                </div>
              </div>
            </div>

            {/* Session Fancy — only for live matches */}
            {isLive && (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                <button
                  onClick={() => setSessionsOpen(!sessionsOpen)}
                  className="w-full bg-gray-950 px-4 py-2.5 border-b border-gray-800 flex justify-between items-center"
                >
                  <span className="text-xs font-black text-gray-300 uppercase tracking-wider">Session / Fancy</span>
                  {sessionsOpen ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                </button>
                {sessionsOpen && (
                  <div className="p-4">
                    <div className="flex items-center mb-2">
                      <div className="flex-1" />
                      <div className="flex gap-1 w-[150px]">
                        <div className="flex-1 text-center text-[10px] font-black text-red-400 uppercase tracking-wider">No</div>
                        <div className="flex-1 text-center text-[10px] font-black text-blue-400 uppercase tracking-wider">Yes</div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {odds.sessions.map((session, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <div className="flex-1 text-sm text-gray-300 leading-tight">{session.label}</div>
                          <div className="flex gap-1 w-[150px]">
                            <button
                              onClick={() => selectBet(session.label, 'KHAI', 'SESSION', session.no, session.label)}
                              className="flex-1 flex flex-col items-center bg-red-500/15 hover:bg-red-500/30 border border-red-500/20 hover:border-red-400 rounded-lg py-1.5 transition-all active:scale-95"
                            >
                              <span className="text-base font-black text-red-300 leading-none">{session.no}</span>
                              <span className="text-[9px] text-gray-600 mt-0.5">{session.noRate}</span>
                            </button>
                            <button
                              onClick={() => selectBet(session.label, 'LAGAI', 'SESSION', session.yes, session.label)}
                              className="flex-1 flex flex-col items-center bg-blue-500/15 hover:bg-blue-500/30 border border-blue-500/20 hover:border-blue-400 rounded-lg py-1.5 transition-all active:scale-95"
                            >
                              <span className="text-base font-black text-blue-300 leading-none">{session.yes}</span>
                              <span className="text-[9px] text-gray-600 mt-0.5">{session.yesRate}</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )
      )}

      {/* ── Match Bet Report ───────────────────────────────────────────────── */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="bg-gray-950 px-4 py-2.5 border-b border-gray-800 flex items-center justify-between">
          <span className="text-xs font-black text-gray-300 uppercase tracking-wider">My Bets · This Match</span>
          <span className={`text-xs font-black px-2 py-0.5 rounded-full ${placedBets.length > 0 ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-800 text-gray-500'}`}>
            {placedBets.length} Bet{placedBets.length !== 1 ? 's' : ''}
          </span>
        </div>
        {placedBets.length === 0 ? (
          <div className="px-4 py-6 text-center text-gray-600 text-sm">No bets placed on this match yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] font-black text-gray-500 uppercase tracking-wider bg-gray-950/50">
                  <th className="px-4 py-2 text-left">No.</th>
                  <th className="px-4 py-2 text-left">Selection</th>
                  <th className="px-4 py-2 text-center">Odds</th>
                  <th className="px-4 py-2 text-center">Stake</th>
                  <th className="px-4 py-2 text-center">Status</th>
                  <th className="px-4 py-2 text-right">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {placedBets.map((bet, i) => (
                  <tr key={bet.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-2.5 text-gray-500">{i + 1}</td>
                    <td className="px-4 py-2.5 font-bold text-white">{bet.selection}</td>
                    <td className="px-4 py-2.5 text-center text-blue-400 font-mono font-bold">{bet.odds}</td>
                    <td className="px-4 py-2.5 text-center text-white font-bold">₹{bet.amount}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                        bet.status === 'WON' ? 'bg-green-500/10 text-green-400 border-green-500/20'
                        : bet.status === 'LOST' ? 'bg-red-500/10 text-red-400 border-red-500/20'
                        : 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                      }`}>
                        {bet.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-500 text-xs">
                      {bet.placedAt ? new Date(bet.placedAt).toLocaleTimeString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-800 border border-gray-700 px-6 py-3 rounded-2xl shadow-2xl font-bold text-sm text-white animate-in slide-in-from-bottom-4 whitespace-nowrap">
          {toast}
        </div>
      )}

      {/* Bet Slip Modal */}
      {selectedBet && (
        <BetSlipModal
          selection={selectedBet}
          balance={user?.walletBalance ?? 0}
          onClose={() => setSelectedBet(null)}
          onConfirm={handleConfirmBet}
        />
      )}
    </div>
  );
}
