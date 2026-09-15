'use client';

import { useEffect, useState, useCallback } from 'react';
import { Activity, CalendarClock, ChevronRight, Clock } from 'lucide-react';
import MatchDetail from './MatchDetail';

type Match = {
  id: number | string;
  localteam: { name: string; code: string };
  visitorteam: { name: string; code: string };
  note: string;
  status: string;
  starting_at?: string;
  isLive?: boolean;
  matchType?: string; // 't20' | 'odi' | 'test' | 't10' etc.
  type?: string;
  format?: string;
};

// Statuses Sportmonks uses for ended matches — filter them out
const ENDED_STATUSES = ['Finished', 'Aban.', 'Cancl.', 'Postp.', 'Interrupted'];

export default function LiveMatches() {
  const [activeTab, setActiveTab] = useState<'TODAY' | 'LIVE'>('TODAY');
  const [liveMatches, setLiveMatches]       = useState<Match[]>([]);
  const [upcomingMatches, setUpcomingMatches] = useState<Match[]>([]);
  const [loading, setLoading]               = useState(true);
  const [selectedMatchId, setSelectedMatchId] = useState<number | string | null>(null);

  const fetchMatches = useCallback(async () => {
    try {
      const [liveRes, upcomingRes] = await Promise.all([
        fetch('/api/matches/live'),
        fetch('/api/matches/upcoming'),
      ]);
      const liveData     = await liveRes.json();
      const upcomingData = await upcomingRes.json();

      const live: Match[] = (liveData.data || [])
        .filter((m: Match) => !ENDED_STATUSES.includes(m.status))
        .map((m: Match) => ({ ...m, isLive: true }));

      const upcoming: Match[] = (upcomingData.data || [])
        .filter((m: Match) => !ENDED_STATUSES.includes(m.status))
        .map((m: Match) => ({ ...m, isLive: false }));

      setLiveMatches(live);
      setUpcomingMatches(upcoming);
    } catch (err) {
      console.error('Failed to fetch matches', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMatches();
    const interval = setInterval(fetchMatches, 30000);
    return () => clearInterval(interval);
  }, [fetchMatches]);

  // Open match detail
  if (selectedMatchId !== null) {
    return <MatchDetail matchId={selectedMatchId} onBack={() => setSelectedMatchId(null)} />;
  }

  // Home tab combines all live matches with at least five upcoming fixtures
  // when the providers have that many available. Live matches do not count
  // toward the upcoming-match minimum.
  const todayMatches: Match[] = [
    ...liveMatches,
    ...upcomingMatches.filter((upcoming) => !liveMatches.some((live) => live.id === upcoming.id)),
  ];
  const liveOnly = liveMatches;

  const matchesToDisplay = activeTab === 'TODAY' ? todayMatches : liveOnly;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-3">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-gray-400 text-sm">Loading markets...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* Tab Bar */}
      <div className="flex gap-2">
        {/* Tab 1 — TODAY (live + next 24h upcoming) */}
        <button
          onClick={() => setActiveTab('TODAY')}
          className={`flex-1 py-3 font-black rounded-xl flex items-center justify-center gap-2 transition-all text-sm ${
            activeTab === 'TODAY'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
        >
          <CalendarClock className="w-4 h-4" />
          Today
          {todayMatches.length > 0 && (
            <span className="bg-white/20 text-white text-xs font-black px-2 py-0.5 rounded-full">
              {todayMatches.length}
            </span>
          )}
        </button>

        {/* Tab 2 — LIVE only */}
        <button
          onClick={() => setActiveTab('LIVE')}
          className={`flex-1 py-3 font-black rounded-xl flex items-center justify-center gap-2 transition-all text-sm ${
            activeTab === 'LIVE'
              ? 'bg-red-500 text-white shadow-lg shadow-red-500/25'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
        >
          <Activity className="w-4 h-4" />
          Live
          {liveMatches.length > 0 && (
            <span className={`text-xs font-black px-2 py-0.5 rounded-full ${activeTab === 'LIVE' ? 'bg-white/25 text-white' : 'bg-red-500/20 text-red-400'}`}>
              {liveMatches.length}
            </span>
          )}
        </button>
      </div>

      {/* Match List */}
      {matchesToDisplay.length === 0 ? (
        <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-12 text-center">
          {activeTab === 'LIVE' ? (
            <>
              <Activity className="w-14 h-14 mx-auto text-gray-700 mb-4" />
              <h3 className="text-lg font-black text-gray-400">No live matches right now</h3>
              <p className="text-gray-600 mt-2 text-sm">Switch to Today to see upcoming fixtures.</p>
            </>
          ) : (
            <>
              <CalendarClock className="w-14 h-14 mx-auto text-gray-700 mb-4" />
              <h3 className="text-lg font-black text-gray-400">No matches today</h3>
              <p className="text-gray-600 mt-2 text-sm">Check back later for more action.</p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {/* Section header for Today tab */}
          {activeTab === 'TODAY' && liveMatches.length > 0 && (
            <div className="flex items-center gap-2 px-1 pb-1">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_6px_rgba(239,68,68,0.8)]" />
              <span className="text-xs font-black text-red-500 uppercase tracking-widest">Live Now</span>
            </div>
          )}

          {matchesToDisplay.map((match, idx) => {
            const isFirstUpcoming =
              activeTab === 'TODAY' &&
              liveMatches.length > 0 &&
              idx === liveMatches.length;
            const matchType = (match.matchType || match.type || match.format || '').toLowerCase();

            return (
              <div
                key={match.id}
                className={`sportsbook-card overflow-hidden rounded-2xl shadow-lg ${
                  match.isLive ? 'border-red-500/50 shadow-red-950/40' : ''
                }`}
              >
                {/* Separator between live & upcoming in TODAY tab */}
                {isFirstUpcoming && (
                  <div className="flex items-center gap-2 px-1 py-2">
                    <span className="text-xs font-black uppercase tracking-widest text-[#f3b51b] flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" /> Upcoming matches
                    </span>
                    <div className="flex-1 h-px bg-gray-800" />
                  </div>
                )}

                <button
                  onClick={() => setSelectedMatchId(match.id)}
                  className="group flex w-full items-center gap-2 p-3 text-left transition-all hover:bg-emerald-700/30 sm:gap-4 sm:p-4"
                >
                  {/* Status indicator */}
                  <div className="flex w-8 flex-shrink-0 flex-col items-center sm:w-10">
                    {match.isLive ? (
                      <>
                        <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)] mb-1" />
                        <span className="text-[9px] font-black text-red-500 uppercase tracking-wider">LIVE</span>
                      </>
                    ) : (
                      <>
                        <Clock className="w-4 h-4 text-blue-400 mb-0.5" />
                        {match.starting_at && (
                          <span className="text-[9px] font-black text-blue-400 text-center leading-tight">
                            {new Date(match.starting_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                          </span>
                        )}
                      </>
                    )}
                  </div>

                  {/* Match info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {match.isLive && (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-red-500/40 bg-red-500/15 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-red-300">
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />
                          Live now
                        </span>
                      )}
                    </div>
                    <div className="font-black text-white text-sm leading-tight truncate">
                      {match.localteam?.name}{' '}
                      <span className="text-gray-600 font-normal">v</span>{' '}
                      {match.visitorteam?.name}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5 truncate">{match.note}</div>
                    {match.starting_at && !match.isLive && (
                      <div className="text-[11px] text-blue-400/70 mt-0.5">
                        {new Date(match.starting_at).toLocaleString('en-IN', {
                          day: '2-digit', month: 'short',
                          hour: '2-digit', minute: '2-digit', hour12: true,
                        })}
                      </div>
                    )}
                  </div>

                  {/* Match type badge + arrow */}
                  <div className="flex flex-shrink-0 items-center gap-1 sm:gap-2">
                    {matchType && (
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border uppercase tracking-wider ${
                        matchType === 't20'  ? 'bg-purple-500/15 border-purple-500/30 text-purple-400' :
                        matchType === 'odi'  ? 'bg-blue-500/15 border-blue-500/30 text-blue-400' :
                        matchType === 'test' ? 'bg-amber-500/15 border-amber-500/30 text-amber-400' :
                        matchType === 't10'  ? 'bg-pink-500/15 border-pink-500/30 text-pink-400' :
                        'bg-gray-700 border-gray-600 text-gray-400'
                      }`}>
                        {matchType.toUpperCase()}
                      </span>
                    )}
                    <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-gray-300 transition-colors" />
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
