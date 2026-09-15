'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { ArrowLeft, Tv2, X, AlertTriangle, Clock, ChevronDown, ChevronUp, RefreshCw, Wifi } from 'lucide-react';
import { calculateBet } from '@/lib/bets/math';

// ─── Types ────────────────────────────────────────────────────────────────────

type Match = {
  id: number | string;
  source?: 'sportmonks' | 'cricapi' | 'entitysport';
  localteam: { name: string; code: string };
  visitorteam: { name: string; code: string };
  note: string;
  status: string;
  starting_at?: string;
  score?: string; // CricAPI: human-readable score string
  winnerTeam?: string;
  runs?: Array<{ team_id: number; inning: number; score: number; wickets: number; overs: string }>;
  balls?: unknown[];
};

type BetSelection = {
  matchId: number;
  matchName: string;
  team: string;
  type: 'LAGAI' | 'KHAI';
  market: 'MATCH_ODDS' | 'BOOKMAKER' | 'SESSION';
  odds: number;
  minStake: number;
  maxStake: number;
  sessionLabel?: string;
};

type PlacedBet = {
  id: string;
  selection: string;
  odds: number;
  amount: number;
  liability?: number;
  status: string;
  placedAt: string | null;
};

type RealOdds = {
  home: { lagai: number; khai: number } | null;
  away: { lagai: number; khai: number } | null;
} | null;

// Ball event type for ticker
type BallEvent = {
  value: string; // "0", "1", "2", "3", "4", "6", "W", "Wd", "Nb", "LB"
  over: number;
  ball: number;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getStakeLimits(market: BetSelection['market']) {
  return market === 'BOOKMAKER'
    ? { minStake: 100, maxStake: 500000 }
    : { minStake: 100, maxStake: 5000 };
}

function getBetAmounts(amount: number, odds: number, type: BetSelection['type'], market: BetSelection['market']) {
  const result = calculateBet(amount, odds, type, market);
  return { deduction: result.deduction, payout: result.returnAmount, profit: result.profit };
}

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

/** Parse current over progress from the provider's overs string, e.g. "18.3". */
function parseOvers(oversStr: string | number | undefined): { completed: number; ball: number } {
  if (!oversStr) return { completed: 0, ball: 0 };
  const s = String(oversStr);
  const parts = s.split('.');
  return {
    completed: parseInt(parts[0] || '0', 10),
    ball: parseInt(parts[1] || '0', 10),
  };
}

function normaliseBallEvents(rawBalls: unknown[] | undefined): BallEvent[] {
  if (!rawBalls) return [];
  return rawBalls.flatMap((raw): BallEvent[] => {
    if (typeof raw !== 'object' || raw === null) return [];
    const data = raw as Record<string, unknown>;
    const score = typeof data.score === 'object' && data.score !== null
      ? data.score as Record<string, unknown>
      : {};
    const runs = typeof data.runs === 'object' && data.runs !== null
      ? data.runs as Record<string, unknown>
      : {};
    const over = Number(data.over ?? data.over_number ?? data.overNo ?? data.over_number_display);
    const ball = Number(data.ball ?? data.ball_number ?? data.ballNo ?? data.ball_number_display);
    const isWicket = Boolean(data.is_wicket ?? data.wicket ?? score.wicket);
    const isWide = Boolean(data.is_wide ?? data.wide ?? score.wide ?? runs.wide);
    const isNoBall = Boolean(data.is_no_ball ?? data.noball ?? data.no_ball ?? score.noball ?? runs.noball);
    const runValue = data.value ?? data.result ?? data.symbol ?? score.runs ?? runs.runs ?? data.runs;
    const value = isWicket ? 'W' : isWide ? 'Wd' : isNoBall ? 'Nb' : runValue;
    if (!Number.isFinite(over) || !Number.isFinite(ball) || value === undefined) return [];
    return [{ value: String(value), over, ball }];
  });
}

/** Get colour class for a ball event value */
function ballColour(value: string): string {
  if (value === '6') return 'bg-purple-600 text-white border-purple-400';
  if (value === '4') return 'bg-blue-600 text-white border-blue-400';
  if (value === 'W') return 'bg-red-600 text-white border-red-400';
  if (value === 'Wd' || value === 'Nb') return 'bg-orange-500 text-white border-orange-400';
  if (value === '0') return 'bg-gray-700 text-gray-300 border-gray-600';
  return 'bg-emerald-700 text-white border-emerald-500';
}

/** Compute current run rate */
function computeCRR(runs: number, overs: number, balls: number): string {
  const totalBalls = overs * 6 + balls;
  if (totalBalls === 0) return '0.00';
  return ((runs / totalBalls) * 6).toFixed(2);
}

// ─── OddsBtn ─────────────────────────────────────────────────────────────────

function OddsBtn({
  value,
  sub,
  type,
  onClick,
  suspended,
  disabled,
}: {
  value: number | string;
  sub?: number | string;
  type: 'LAGAI' | 'KHAI';
  onClick: () => void;
  suspended?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || suspended}
      aria-label={suspended ? `Odds ${value}; betting suspended` : `Odds ${value}`}
      className={`flex-1 flex flex-col items-center justify-center rounded-lg py-2 min-w-[60px] transition-all active:scale-95 disabled:cursor-not-allowed ${
        suspended ? 'border border-gray-700 bg-gray-800/60 opacity-70' : ''
      } ${
        suspended ? ''
        : type === 'LAGAI'
          ? 'bg-blue-500/20 hover:bg-blue-500/40 border border-blue-500/30 hover:border-blue-400'
          : 'bg-red-500/20 hover:bg-red-500/40 border border-red-500/30 hover:border-red-400'
      }`}
    >
      <span className={`text-lg font-black leading-none ${suspended ? 'text-gray-300' : type === 'LAGAI' ? 'text-blue-300' : 'text-red-300'}`}>{value}</span>
      {sub !== undefined && <span className="text-[10px] text-gray-500 mt-0.5">{sub}</span>}
      {suspended && <span className="text-[8px] font-black uppercase tracking-wider text-gray-500">Closed</span>}
    </button>
  );
}

// ─── BallTicker ───────────────────────────────────────────────────────────────

function BallTicker({ events }: { events: BallEvent[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [events]);

  if (events.length === 0) return null;

  // Group by over
  const byOver = new Map<number, BallEvent[]>();
  for (const e of events) {
    if (!byOver.has(e.over)) byOver.set(e.over, []);
    byOver.get(e.over)!.push(e);
  }

  const lastEvent = events[events.length - 1];

  return (
    <div
      ref={scrollRef}
      className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar py-1"
    >
      {[...byOver.entries()].map(([ov, balls]) => (
        <div key={ov} className="flex items-center gap-1 shrink-0">
          <span className="text-[9px] font-black text-gray-600 uppercase tracking-wider shrink-0">
            Ov {ov + 1}
          </span>
          {balls.map((b, i) => {
            const isLatest = b === lastEvent;
            return (
              <div
                key={i}
                className={`relative w-7 h-7 flex items-center justify-center rounded-full border text-[11px] font-black shrink-0 transition-transform ${ballColour(b.value)} ${isLatest ? 'ring-2 ring-white/40 scale-110' : ''}`}
              >
                {b.value}
                {isLatest && (
                  <span className="absolute inset-0 rounded-full animate-ping opacity-30 bg-white" />
                )}
              </div>
            );
          })}
          {/* 6-ball placeholder dots for incomplete overs */}
          {balls.length < 6 && [...Array(6 - balls.length)].map((_, i) => (
            <div key={`dot-${i}`} className="w-7 h-7 flex items-center justify-center rounded-full border border-gray-700 text-gray-700 text-[11px] font-black shrink-0">
              ·
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── BetSlipModal ─────────────────────────────────────────────────────────────

function BetSlipModal({
  selection,
  balance,
  onClose,
  onConfirm,
  currentOdds,
}: {
  selection: BetSelection;
  balance: number;
  onClose: () => void;
  onConfirm: (amount: number, odds: number) => Promise<void>;
  currentOdds: number;
}) {
  const [amount, setAmount] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const defaultLimits = getStakeLimits(selection.market);
  const minStake = Number.isFinite(selection.minStake) ? selection.minStake : defaultLimits.minStake;
  const maxStake = Number.isFinite(selection.maxStake) ? selection.maxStake : defaultLimits.maxStake;

  const stake = parseFloat(amount);
  const newOdds = currentOdds;
  const oddsChanged = currentOdds !== selection.odds;
  const betAmounts = amount ? getBetAmounts(stake, newOdds, selection.type, selection.market) : null;
  const profit = betAmounts ? betAmounts.profit.toFixed(2) : '0.00';
  const payout = betAmounts ? betAmounts.payout.toFixed(2) : '0.00';

  const handleConfirm = async () => {
    setSubmitError('');
    if (!amount || !Number.isFinite(stake)) {
      setSubmitError('Enter an amount to place this bet.');
      return;
    }
    if (stake < minStake || stake > maxStake) {
      setSubmitError(`Amount must be between ₹${minStake.toLocaleString('en-IN')} and ₹${maxStake.toLocaleString('en-IN')}.`);
      return;
    }
    if (!betAmounts) {
      setSubmitError('Please enter a valid amount.');
      return;
    }
    if (betAmounts.deduction > balance) {
      setSubmitError('Insufficient balance for this bet.');
      return;
    }
    setConfirming(true);
    try {
      await onConfirm(stake, newOdds);
    } catch (error: unknown) {
      setSubmitError(error instanceof Error ? error.message : 'Unable to place bet. Please try again.');
    } finally {
      setConfirming(false);
    }
  };

  const quickAmounts = selection.market === 'BOOKMAKER'
    ? [100, 500, 1000, 5000, 10000]
    : [100, 500, 1000, 2500, 5000];
  const invalidStake = Boolean(amount) && (
    stake < minStake || stake > maxStake || !betAmounts || betAmounts.deduction > balance
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-3" onClick={confirming ? undefined : onClose}>
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
          <button
            onClick={confirming ? undefined : onClose}
            disabled={confirming}
            className="text-white/60 hover:text-white mt-1 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Processing overlay banner */}
        {confirming && (
          <div className="bg-emerald-600/30 border-b border-emerald-500/50 px-4 py-2.5 flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin shrink-0" />
            <span className="text-emerald-300 text-sm font-bold">Placing your bet — please wait…</span>
          </div>
        )}

        {/* Odds Changed Banner */}
        {!confirming && oddsChanged && (
          <div className="bg-yellow-500/20 border-b border-yellow-500/40 px-4 py-2.5 flex items-center justify-between">
            <div className="flex items-center text-yellow-400 text-sm font-bold gap-2">
              <AlertTriangle className="w-4 h-4" />
              Odds changed! Accept to continue.
            </div>
            <div className="text-xs text-yellow-300 font-bold">Review the latest odds before placing</div>
          </div>
        )}

        <div className={`p-5 space-y-4 ${confirming ? 'pointer-events-none opacity-60' : ''}`}>
          {submitError && (
            <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2.5 text-sm text-red-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
              <span>{submitError}</span>
            </div>
          )}

          {/* Odds & Profit */}
          <div className="flex gap-3">
            <div className={`flex-1 rounded-xl p-3 text-center border ${selection.type === 'LAGAI' ? 'bg-blue-500/10 border-blue-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
              <div className="text-[11px] text-gray-400 font-bold mb-1">
                {selection.market === 'BOOKMAKER' ? 'Rate (%)' : 'Odds'}
              </div>
              <div className={`text-2xl font-black ${selection.type === 'LAGAI' ? 'text-blue-400' : 'text-red-400'}`}>{newOdds}</div>
              {oddsChanged && <div className="text-[10px] text-yellow-400 mt-1">Changed!</div>}
            </div>
            <div className="flex-1 bg-green-500/10 border border-green-500/20 rounded-xl p-3 text-center">
              <div className="text-[11px] text-gray-400 font-bold mb-1">Profit</div>
              <div className="text-2xl font-black text-green-400">₹{profit}</div>
            </div>
          </div>

          <div className={`rounded-xl border px-3 py-2.5 text-xs ${
            selection.type === 'LAGAI'
              ? 'border-blue-500/20 bg-blue-500/10 text-blue-200'
              : 'border-red-500/20 bg-red-500/10 text-red-200'
          }`}>
            {selection.type === 'LAGAI'
              ? 'Lagai: you pay the full stake. If your selected team wins, your return includes the stake and profit.'
              : 'Khai: enter the amount you want to win. The platform pays this win amount if your selected team loses; only the liability is deducted.'}
          </div>

          {/* Stake Input */}
          <div>
            <div className="text-[11px] text-gray-400 font-black uppercase tracking-wider mb-1.5">
              {selection.type === 'KHAI' ? 'Win amount (₹)' : 'Stake (₹)'}
            </div>
            <input
              type="number"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setSubmitError('');
              }}
              placeholder="0"
              min={minStake}
              max={maxStake}
              className="w-full bg-gray-800 border border-gray-600 focus:border-blue-500 rounded-xl px-4 py-3 text-2xl font-black text-white focus:outline-none transition-colors"
            />
            <div className="mt-1.5 flex justify-between text-[11px]">
              <span className={invalidStake ? 'text-red-400' : 'text-gray-500'}>
                Min: ₹{minStake.toLocaleString('en-IN')} | Max: ₹{maxStake.toLocaleString('en-IN')}
              </span>
              <span className="text-gray-400">Balance: <span className="text-white font-bold">₹{balance.toFixed(2)}</span></span>
            </div>
            <div className="mt-1 text-right text-[11px] text-green-400">
              {selection.market === 'BOOKMAKER' ? 'Total return' : 'Potential return'}: ₹{payout}
            </div>
            {betAmounts && selection.type === 'KHAI' && (
              <div className="mt-1 text-right text-[11px] text-orange-300">
                Liability deducted: ₹{betAmounts.deduction.toFixed(2)}
              </div>
            )}
          </div>

          {/* Quick Stakes */}
          <div className="grid grid-cols-5 gap-1.5">
            {quickAmounts.map((q) => (
              <button
                key={q}
                onClick={() => {
                  setAmount(String(q));
                  setSubmitError('');
                }}
                className="bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-black py-2 rounded-lg transition-colors"
              >
                {q >= 1000 ? `${q / 1000}K` : q}
              </button>
            ))}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button onClick={onClose} disabled={confirming} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 rounded-xl transition-colors text-sm disabled:opacity-40">
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={confirming || !amount || invalidStake}
              className={`flex-[2] font-black py-3 rounded-xl transition-all disabled:opacity-50 shadow-lg text-sm flex items-center justify-center gap-2 ${
                oddsChanged
                  ? 'bg-yellow-500 hover:bg-yellow-400 text-black shadow-yellow-500/20'
                  : selection.type === 'LAGAI'
                  ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/25'
                  : 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/25'
              }`}
            >
              {confirming ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Placing…
                </>
              ) : oddsChanged ? 'Accept & Place' : 'Place Bet'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

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
  const [settlementAttempted, setSettlementAttempted] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [ballEvents, setBallEvents] = useState<BallEvent[]>([]);

  const generatedOdds = match ? generateOdds(typeof match.id === 'number' ? match.id : 0) : null;

  const fetchMatch = useCallback(async () => {
    try {
      const res = await fetch(`/api/matches/${matchId}`);
      if (!res.ok) {
        throw new Error(`Match request failed with status ${res.status}`);
      }
      const data = await res.json();
      if (!data.data) {
        throw new Error('Match response did not contain match data');
      }
      setMatch(data.data);
    } catch (error) {
      console.error('Failed to load match details:', error);
      setToast('Unable to load this match. Please refresh.');
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

  const fetchOdds = useCallback(async (m: Match, signal?: AbortSignal) => {
    try {
      const res = await fetch(
        `/api/odds?home=${encodeURIComponent(m.localteam?.name)}&away=${encodeURIComponent(m.visitorteam?.name)}`,
        { cache: 'no-store', signal },
      );
      const data = await res.json();
      if (
        data.found &&
        data.odds &&
        (data.odds.home || data.odds.away)
      ) {
        setRealOdds(data.odds);
        setOddsSource('real');
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      /* silently fall back to generated */
    }
  }, []);

  useEffect(() => {
    fetchMatch();
    fetchBets();
    const interval = setInterval(fetchMatch, 15000);
    return () => clearInterval(interval);
  }, [fetchMatch, fetchBets]);

  // Derive ball-by-ball events from match data whenever match updates
  useEffect(() => {
    if (!match) return;
    const normStatus = String(match.status || '').toLowerCase().replace(/[\s_-]+/g, '');
    const live = ['inprogress', 'live', '1stinnings', '2ndinnings'].includes(normStatus);
    if (!live) { setBallEvents([]); return; }

    setBallEvents(normaliseBallEvents(match.balls));
  }, [match]);

  useEffect(() => {
    if (!match || settlementAttempted || !['Finished', 'Aban.', 'Cancl.', 'Postp.'].includes(match.status)) return;
    if (!match.winnerTeam) return;

    setSettlementAttempted(true);
    fetch('/api/bets/settle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matchId: String(match.id), winnerTeam: match.winnerTeam }),
    })
      .then((response) => {
        if (!response.ok) throw new Error(`Settlement failed with status ${response.status}`);
        return response.json();
      })
      .then(() => fetchBets())
      .catch((error) => {
        console.error('Automatic bet settlement failed:', error);
        setSettlementAttempted(false);
      });
  }, [fetchBets, match, settlementAttempted]);

  // Keep odds current only while this match detail view is mounted.
  useEffect(() => {
    if (!match) return;

    const controller = new AbortController();
    let requestInFlight = false;
    const pollOdds = async () => {
      if (requestInFlight || controller.signal.aborted) return;
      requestInFlight = true;
      try {
        await fetchOdds(match, controller.signal);
      } finally {
        requestInFlight = false;
      }
    };

    void pollOdds();
    const interval = setInterval(() => {
      void pollOdds();
    }, 5000);

    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [match, fetchOdds]);

  // Derive status synchronously from the latest fetched match so a stale render
  // can never open the betting dialog after the match has stopped.
  const normalisedStatus = String(match?.status || '').toLowerCase().replace(/[\s_-]+/g, '');
  const isLive = ['inprogress', 'live', '1stinnings', '2ndinnings'].includes(normalisedStatus);
  const isEnded = ['finished', 'aban.', 'cancl.', 'postp.', 'interrupted', 'abandoned', 'cancelled', 'postponed'].includes(normalisedStatus);
  const isUpcoming = !isLive && !isEnded;
  // Single source of truth for blocking all bet interactions
  const bettingDisabled = !isLive || isEnded || confirming;

  // Merged odds: real from The Odds API if available, else generated
  const isValidDecimalOdds = (value: unknown): value is { lagai: number; khai: number } =>
    typeof value === 'object' &&
    value !== null &&
    Number.isFinite((value as Record<string, unknown>).lagai) &&
    Number.isFinite((value as Record<string, unknown>).khai) &&
    (value as Record<string, number>).lagai > 1 &&
    (value as Record<string, number>).khai > 1;

  const odds = {
    matchOdds: {
      local: isValidDecimalOdds(realOdds?.home)
        ? realOdds.home
        : generatedOdds?.matchOdds.local ?? { lagai: 1.8, khai: 1.82 },
      visitor: isValidDecimalOdds(realOdds?.away)
        ? realOdds.away
        : generatedOdds?.matchOdds.visitor ?? { lagai: 2.2, khai: 2.22 },
    },
    bookmaker: generatedOdds?.bookmaker ?? { local: { lagai: 70, khai: 72 }, visitor: { lagai: 120, khai: 128 } },
    sessions: generatedOdds?.sessions ?? [],
  };

  const handleConfirmBet = async (amount: number, appliedOdds: number) => {
    if (!user || !selectedBet || !match) {
      throw new Error('Your session is no longer available. Please sign in again.');
    }
    // Defence-in-depth: never allow confirm if match is not live
    if (!isLive || isEnded) {
      throw new Error('Betting is only allowed while the match is live. The market has been suspended.');
    }
    const latestOdds = selectedBet.market === 'MATCH_ODDS'
      ? (selectedBet.team === match.localteam.name
        ? (selectedBet.type === 'LAGAI' ? odds.matchOdds.local.lagai : odds.matchOdds.local.khai)
        : (selectedBet.type === 'LAGAI' ? odds.matchOdds.visitor.lagai : odds.matchOdds.visitor.khai))
      : appliedOdds;
    if (latestOdds > selectedBet.odds) {
      throw new Error(`Odds moved from ${selectedBet.odds} to ${latestOdds}. Bets are accepted only when the current odds are lower or equal.`);
    }
    setConfirming(true);
    try {
      const res = await fetch('/api/bet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          matchId: matchId.toString(),
          selection: `${selectedBet.type} - ${selectedBet.team}${selectedBet.sessionLabel ? ' (' + selectedBet.sessionLabel + ')' : ''}`,
          odds: appliedOdds,
          amount,
          market: selectedBet.market,
          type: selectedBet.type,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setToast(`✅ Bet placed: ₹${amount} on ${selectedBet.team}`);
      setTimeout(() => setToast(''), 3000);
      setSelectedBet(null);
      await fetchBets();
    } catch (err: unknown) {
      throw new Error(err instanceof Error ? err.message : 'Unable to place bet. Please try again.');
    } finally {
      setConfirming(false);
    }
  };

  // selectBet now correctly closes over isLive/isEnded which are declared above
  const selectBet = (team: string, type: 'LAGAI' | 'KHAI', market: BetSelection['market'], oddsVal: number, sessionLabel?: string) => {
    if (!match) return;
    if (!isLive) return;   // Gate layer 1: match must be live
    if (isEnded) return;   // Gate layer 2: match must not be ended
    if (confirming) return; // Gate layer 3: no double-bet while processing
    const { minStake, maxStake } = getStakeLimits(market);
    setSelectedBet({
      matchId: Number(match.id),
      matchName: `${match.localteam?.name} v ${match.visitorteam?.name}`,
      team,
      type,
      market,
      odds: oddsVal,
      minStake,
      maxStake,
      sessionLabel,
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-gray-400 text-sm">Loading match…</span>
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




  const matchName = `${match.localteam?.name} v ${match.visitorteam?.name}`;
  const pendingStake = placedBets
    .filter((bet) => bet.status === 'PENDING')
    .reduce((total, bet) => total + Number(bet.amount || 0), 0);
  const localRun = match.runs?.find(r => r.team_id === (match.localteam as any)?.id);
  const visitorRun = match.runs?.find(r => r.team_id === (match.visitorteam as any)?.id);

  // Derive live score summary for the header ticker
  const latestRun = match.runs && match.runs.length > 0
    ? match.runs.reduce((a, b) => (b.inning > a.inning ? b : a))
    : null;
  const { completed: oversCompleted, ball: ballNum } = parseOvers(latestRun?.overs);
  const crr = latestRun ? computeCRR(latestRun.score, oversCompleted, ballNum) : null;

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

      {/* ── Match Header Card ─────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-2xl border border-gray-800 bg-gray-900">
        {/* Status bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-800 bg-gray-950 px-3 py-3 sm:px-4">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {isLive && (
              <span className="flex items-center gap-1.5 rounded-full border border-red-500/40 bg-red-500/15 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-red-300">
                <span className="h-2 w-2 animate-pulse rounded-full bg-red-400 shadow-[0_0_6px_rgba(239,68,68,0.9)]" />
                Live now
              </span>
            )}
            {isEnded && <span className="text-xs font-black text-gray-500 uppercase tracking-widest">ENDED</span>}
            {isUpcoming && <span className="text-xs font-bold text-blue-400">UPCOMING</span>}
            <span className="truncate text-sm text-gray-400">{match.note}</span>
          </div>
          <button className="p-1.5 rounded-lg bg-gray-800 text-gray-400 hover:text-blue-400 transition-colors">
            <Tv2 className="w-4 h-4" />
          </button>
        </div>

        {/* Scoreboard */}
        {match.source === 'cricapi' && match.score ? (
          <div className="px-5 py-4">
            <div className="font-black text-lg text-white mb-3 text-center">{matchName}</div>
            {/* Parsed score display */}
            <div className="text-green-400 font-bold text-sm text-center whitespace-pre-wrap mb-3">{match.score}</div>
            {/* Ball ticker for CricAPI */}
            {isLive && (
              <div className="mt-3 pt-3 border-t border-gray-800">
                <div className="flex items-center gap-2 mb-2">
                  <Wifi className="w-3 h-3 text-red-400 animate-pulse" />
                  <span className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Ball by Ball</span>
                </div>
                {ballEvents.length > 0
                  ? <BallTicker events={ballEvents} />
                  : <div className="text-xs text-gray-600">Ball-by-ball data is not available from this provider.</div>}
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 sm:p-5">
            {/* Teams + scores */}
            <div className="grid grid-cols-1 items-center gap-3 text-center sm:grid-cols-3">
              <div>
                <div className="break-words text-lg font-black text-white sm:text-xl">{match.localteam?.name}</div>
                {localRun ? (
                  <div className="text-3xl font-black text-green-400 mt-1">
                    {localRun.score}/{localRun.wickets}
                    <span className="text-sm text-gray-400 font-normal ml-2">({localRun.overs} ov)</span>
                  </div>
                ) : (
                  isLive && <div className="text-gray-600 text-sm mt-1">—</div>
                )}
              </div>
              <div className="text-gray-700 font-black text-lg italic sm:text-2xl">VS</div>
              <div>
                <div className="break-words text-lg font-black text-white sm:text-xl">{match.visitorteam?.name}</div>
                {visitorRun ? (
                  <div className="text-3xl font-black text-green-400 mt-1">
                    {visitorRun.score}/{visitorRun.wickets}
                    <span className="text-sm text-gray-400 font-normal ml-2">({visitorRun.overs} ov)</span>
                  </div>
                ) : (
                  isLive && <div className="text-gray-600 text-sm mt-1">—</div>
                )}
              </div>
            </div>

            {/* CRR + ball-by-ball ticker — only for live matches with data */}
            {isLive && (
              <div className="mt-4 pt-4 border-t border-gray-800 space-y-3">
                {/* Run rate row */}
                {crr && (
                  <div className="flex items-center justify-center gap-6 text-center">
                    <div>
                      <div className="text-[10px] text-gray-500 font-black uppercase tracking-wider">CRR</div>
                      <div className="text-base font-black text-amber-400">{crr}</div>
                    </div>
                    {latestRun && (
                      <div>
                        <div className="text-[10px] text-gray-500 font-black uppercase tracking-wider">Over</div>
                        <div className="text-base font-black text-white">{latestRun.overs}</div>
                      </div>
                    )}
                    {latestRun && (
                      <div>
                        <div className="text-[10px] text-gray-500 font-black uppercase tracking-wider">Wickets</div>
                        <div className="text-base font-black text-red-400">{latestRun.wickets}</div>
                      </div>
                    )}
                  </div>
                )}
                {/* Ball ticker */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Wifi className="w-3 h-3 text-red-400 animate-pulse" />
                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Ball by Ball</span>
                  </div>
                  {ballEvents.length > 0
                    ? <BallTicker events={ballEvents} />
                    : <div className="text-xs text-gray-600">Ball-by-ball data is not available from this provider.</div>}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Betting Gate Banners ──────────────────────────────────────────── */}
      {isUpcoming && (
        <div className="flex items-center gap-3 rounded-2xl border border-blue-500/30 bg-blue-500/10 px-4 py-3">
          <Clock className="w-5 h-5 text-blue-400 shrink-0" />
          <div>
            <div className="text-sm font-black text-blue-300">Betting not yet open</div>
            <div className="text-xs text-blue-400/70 mt-0.5">Markets will open when this match goes live.</div>
          </div>
        </div>
      )}

      {isLive && confirming && (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3">
          <div className="w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin shrink-0" />
          <div className="text-sm font-black text-emerald-300">Processing your bet — markets locked</div>
        </div>
      )}

      {/* ── Ended match — no betting ──────────────────────────────────────── */}
      {isEnded ? (
        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-8 text-center">
          <div className="text-4xl mb-3">🏏</div>
          <h3 className="text-xl font-black text-gray-300">Match Ended</h3>
          {match.winnerTeam && (
            <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-amber-500/15 border border-amber-500/30 px-4 py-1.5">
              <span className="text-amber-400 text-sm font-black">🏆 {match.winnerTeam} won</span>
            </div>
          )}
          <p className="text-gray-500 mt-3 text-sm">This match has concluded. No further bets can be placed.</p>
        </div>
      ) : (
        <>
          {/* ── Match Odds ─────────────────────────────────────────────────── */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-800 bg-gray-950 px-3 py-2.5 sm:px-4">
              <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
                <span className="text-xs font-black text-gray-300 uppercase tracking-wider">Match Odds</span>
                {oddsSource === 'real' ? (
                  <span className="text-[9px] font-black bg-green-500/15 border border-green-500/30 text-green-400 px-2 py-0.5 rounded-full uppercase tracking-wider">🟢 Live Odds</span>
                ) : (
                  <span className="text-[9px] font-black bg-gray-700/50 border border-gray-600 text-gray-500 px-2 py-0.5 rounded-full uppercase tracking-wider">Estimated</span>
                )}
                {/* Suspended badge for non-live */}
                {!isLive && (
                  <span className="text-[9px] font-black bg-gray-700/80 border border-gray-600 text-gray-400 px-2 py-0.5 rounded-full uppercase tracking-wider">🔒 Suspended</span>
                )}
              </div>
              <span className="text-xs text-gray-600">Min: 100 | Max: 5,000</span>
            </div>

            <div className="p-4 space-y-2">
              <div className="flex items-center mb-1">
                <div className="flex-1" />
                <div className="flex w-full gap-1 sm:w-[150px]">
                  <div className="flex-1 text-center text-[10px] font-black text-blue-400 uppercase tracking-wider">Lagai</div>
                  <div className="flex-1 text-center text-[10px] font-black text-red-400 uppercase tracking-wider">Khai</div>
                </div>
              </div>
              <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
                <div className="flex-1 font-bold text-white">{match!.localteam?.name}</div>
                <div className="flex w-full gap-1 sm:w-[150px]">
                  <OddsBtn
                    value={odds.matchOdds.local.lagai}
                    type="LAGAI"
                    suspended={!isLive}
                    disabled={bettingDisabled}
                    onClick={() => selectBet(match.localteam.name, 'LAGAI', 'MATCH_ODDS', odds.matchOdds.local.lagai)}
                  />
                  <OddsBtn
                    value={odds.matchOdds.local.khai}
                    type="KHAI"
                    suspended={!isLive}
                    disabled={bettingDisabled}
                    onClick={() => selectBet(match.localteam.name, 'KHAI', 'MATCH_ODDS', odds.matchOdds.local.khai)}
                  />
                </div>
              </div>
              <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
                <div className="flex-1 font-bold text-white">{match.visitorteam?.name}</div>
                <div className="flex w-full gap-1 sm:w-[150px]">
                  <OddsBtn
                    value={odds.matchOdds.visitor.lagai}
                    type="LAGAI"
                    suspended={!isLive}
                    disabled={bettingDisabled}
                    onClick={() => selectBet(match.visitorteam.name, 'LAGAI', 'MATCH_ODDS', odds.matchOdds.visitor.lagai)}
                  />
                  <OddsBtn
                    value={odds.matchOdds.visitor.khai}
                    type="KHAI"
                    suspended={!isLive}
                    disabled={bettingDisabled}
                    onClick={() => selectBet(match.visitorteam.name, 'KHAI', 'MATCH_ODDS', odds.matchOdds.visitor.khai)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Bookmaker market removed. */}
          {false && match && <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-800 bg-gray-950 px-3 py-2.5 sm:px-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-gray-300 uppercase tracking-wider">Bookmaker</span>
              </div>
              <span className="text-xs text-gray-600">Min: 100 | Max: 5,00,000</span>
            </div>
            <div className="p-4 space-y-2">
              <div className="flex items-center mb-1">
                <div className="flex-1" />
                <div className="flex w-full gap-1 sm:w-[150px]">
                  <div className="flex-1 text-center text-[10px] font-black text-blue-400 uppercase tracking-wider">Lagai</div>
                  <div className="flex-1 text-center text-[10px] font-black text-red-400 uppercase tracking-wider">Khai</div>
                </div>
              </div>
              <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
                <div className="flex-1 font-bold text-white">{match!.localteam?.name}</div>
                <div className="flex w-full gap-1 sm:w-[150px]">
                  <OddsBtn
                    value={odds.bookmaker.local.lagai}
                    sub="BM"
                    type="LAGAI"
                    suspended={!isLive}
                    disabled={bettingDisabled}
                    onClick={() => selectBet(match!.localteam.name, 'LAGAI', 'BOOKMAKER', odds.bookmaker.local.lagai)}
                  />
                  <OddsBtn
                    value={odds.bookmaker.local.khai}
                    sub="BM"
                    type="KHAI"
                    suspended={!isLive}
                    disabled={bettingDisabled}
                    onClick={() => selectBet(match!.localteam.name, 'KHAI', 'BOOKMAKER', odds.bookmaker.local.khai)}
                  />
                </div>
              </div>
              <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
                <div className="flex-1 font-bold text-white">{match!.visitorteam?.name}</div>
                <div className="flex w-full gap-1 sm:w-[150px]">
                  <OddsBtn
                    value={odds.bookmaker.visitor.lagai}
                    sub="BM"
                    type="LAGAI"
                    suspended={!isLive}
                    disabled={bettingDisabled}
                    onClick={() => selectBet(match!.visitorteam.name, 'LAGAI', 'BOOKMAKER', odds.bookmaker.visitor.lagai)}
                  />
                  <OddsBtn
                    value={odds.bookmaker.visitor.khai}
                    sub="BM"
                    type="KHAI"
                    suspended={!isLive}
                    disabled={bettingDisabled}
                    onClick={() => selectBet(match!.visitorteam.name, 'KHAI', 'BOOKMAKER', odds.bookmaker.visitor.khai)}
                  />
                </div>
              </div>
            </div>
          </div>}

          {/* ── Session Fancy — only for live matches ─────────────────────── */}
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
                    <div className="flex w-full gap-1 sm:w-[150px]">
                      <div className="flex-1 text-center text-[10px] font-black text-red-400 uppercase tracking-wider">No</div>
                      <div className="flex-1 text-center text-[10px] font-black text-blue-400 uppercase tracking-wider">Yes</div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {odds.sessions.map((session, i) => (
                      <div key={i} className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
                        <div className="flex-1 text-sm text-gray-300 leading-tight">{session.label}</div>
                        <div className="flex w-full gap-1 sm:w-[150px]">
                          <button
                            onClick={() => selectBet(session.label, 'KHAI', 'SESSION', session.no, session.label)}
                            disabled={bettingDisabled}
                            className="flex-1 flex flex-col items-center bg-red-500/15 hover:bg-red-500/30 border border-red-500/20 hover:border-red-400 rounded-lg py-1.5 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <span className="text-base font-black text-red-300 leading-none">{session.no}</span>
                            <span className="text-[9px] text-gray-600 mt-0.5">{session.noRate}</span>
                          </button>
                          <button
                            onClick={() => selectBet(session.label, 'LAGAI', 'SESSION', session.yes, session.label)}
                            disabled={bettingDisabled}
                            className="flex-1 flex flex-col items-center bg-blue-500/15 hover:bg-blue-500/30 border border-blue-500/20 hover:border-blue-400 rounded-lg py-1.5 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
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
      )}

      {/* ── My Bets · This Match ─────────────────────────────────────────── */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="bg-gray-950 px-4 py-2.5 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xs font-black text-gray-300 uppercase tracking-wider">My Bets · This Match</span>
            {pendingStake > 0 && (
              <span className="text-[10px] font-black rounded-full border border-orange-500/30 bg-orange-500/10 px-2 py-0.5 text-orange-300">
                Pending ₹{pendingStake.toFixed(2)}
              </span>
            )}
          </div>
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
                    <td className="px-4 py-2.5 text-center text-white font-bold">₹{(bet.liability ?? bet.amount).toFixed(2)}</td>
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
          currentOdds={
            selectedBet.market === 'MATCH_ODDS'
              ? selectedBet.team === match.localteam.name
                ? selectedBet.type === 'LAGAI' ? odds.matchOdds.local.lagai : odds.matchOdds.local.khai
                : selectedBet.type === 'LAGAI' ? odds.matchOdds.visitor.lagai : odds.matchOdds.visitor.khai
              : selectedBet.odds
          }
          onClose={() => { if (!confirming) setSelectedBet(null); }}
          onConfirm={handleConfirmBet}
        />
      )}
    </div>
  );
}
