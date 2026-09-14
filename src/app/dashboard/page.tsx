'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LogOut, Wallet, ShieldAlert, Trophy, Users, Activity, FileText, LayoutDashboard } from 'lucide-react';
import { auth } from '@/lib/firebase/client';
import LiveMatches from '@/components/LiveMatches';
import WalletTransfer from '@/components/WalletTransfer';
import CreateAccountForm from '@/components/CreateAccountForm';
import AccountManagement from '@/components/AccountManagement';
import ForcePasswordReset from '@/components/ForcePasswordReset';
import ReportsPanel from '@/components/ReportsPanel';

export default function Dashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'HOME' | 'NETWORK' | 'BANKING' | 'REPORTS'>('HOME');

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  if (loading || !user) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  if (user.mustChangePassword) {
    return <ForcePasswordReset />;
  }

  const handleLogout = async () => {
    await auth.signOut();
    router.push('/');
  };

  const navItemClass = (tab: string) => `flex shrink-0 items-center px-3 py-3 text-sm font-bold transition-all border-b-2 sm:px-4 ${
    activeTab === tab 
      ? 'border-green-500 text-green-400 bg-gray-900' 
      : 'border-transparent text-gray-500 hover:text-gray-300 hover:bg-gray-800'
  }`;

  return (
    <div className="sportsbook-shell min-h-screen overflow-x-hidden text-gray-100 pb-8 font-sans">
      <div className="flex min-h-screen">
      <aside className="sportsbook-sidebar hidden w-64 shrink-0 flex-col px-4 py-6 lg:flex">
        <div className="mb-10 flex items-center gap-3 px-2"><div className="gold-button rounded-lg p-2"><Trophy className="h-5 w-5" /></div><div><div className="text-xl font-black text-white">WIN<span className="text-[#f3b51b]">EXCH</span></div><div className="text-[9px] font-bold uppercase tracking-[0.25em] text-slate-500">Sportsbook</div></div></div>
        <div className="mb-3 px-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Workspace</div>
        <div className="space-y-1">
          {[['HOME', LayoutDashboard, user.role === 'USER' ? 'In-Play' : 'Overview'], ['REPORTS', FileText, 'Reports']].map(([tab, Icon, label]) => <button key={tab as string} onClick={() => setActiveTab(tab as 'HOME' | 'REPORTS')} className={`${navItemClass(tab as string)} w-full rounded-xl border-0 ${activeTab === tab ? 'bg-[#f3b51b]/10 text-[#f3b51b]' : ''}`}><Icon className="mr-3 h-4 w-4" />{label as string}</button>)}
          {(user.role === 'ADMIN' || user.role === 'MANAGER') && <><button onClick={() => setActiveTab('NETWORK')} className={`${navItemClass('NETWORK')} w-full rounded-xl border-0 ${activeTab === 'NETWORK' ? 'bg-[#f3b51b]/10 text-[#f3b51b]' : ''}`}><Users className="mr-3 h-4 w-4" />Network</button><button onClick={() => setActiveTab('BANKING')} className={`${navItemClass('BANKING')} w-full rounded-xl border-0 ${activeTab === 'BANKING' ? 'bg-[#f3b51b]/10 text-[#f3b51b]' : ''}`}><Wallet className="mr-3 h-4 w-4" />Banking</button></>}
        </div>
        <div className="mt-auto space-y-1 border-t border-slate-700/50 pt-4"><div className="flex items-center gap-3 rounded-xl bg-slate-950/30 p-3"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f3b51b] text-sm font-black text-[#07111f]">{user.username?.slice(0, 1).toUpperCase()}</div><div className="min-w-0"><div className="truncate text-sm font-bold text-white">{user.username}</div><div className="text-[10px] uppercase text-slate-500">{user.role}</div></div></div><button onClick={handleLogout} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold text-slate-400 hover:bg-red-500/10 hover:text-red-400"><LogOut className="h-4 w-4" />Sign out</button></div>
      </aside>
      <div className="min-w-0 flex-1">
      {/* Premium Top Navbar */}
      <nav className="sticky top-0 z-50 border-b border-slate-700/60 bg-[#091625]/95 px-3 py-3 shadow-2xl backdrop-blur sm:p-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <div className="gold-button shrink-0 rounded-lg p-2">
              <Trophy className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-black tracking-tight text-white sm:text-xl">WIN<span className="text-[#f3b51b]">EXCH</span></h1>
              <span className="rounded-full bg-emerald-950 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-emerald-200">{user.role} PANEL</span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-4">
            {user.role !== 'ADMIN' && (
              <div className="flex items-center rounded-xl border border-emerald-700/60 bg-emerald-950/70 px-2.5 py-2 shadow-inner sm:px-4">
                <Wallet className="mr-2 h-4 w-4 text-[#f3b51b]" />
                <span className="font-bold font-mono tracking-tight text-white">₹{user.walletBalance.toFixed(2)}</span>
              </div>
            )}
            <button onClick={handleLogout} className="rounded-full p-2 text-gray-400 transition-colors hover:bg-gray-800 hover:text-red-400 lg:hidden">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        {/* Tab Navigation */}
        <div className="mx-auto mt-3 flex max-w-7xl gap-1 overflow-x-auto border-b border-slate-700 hide-scrollbar lg:hidden">
          <button onClick={() => setActiveTab('HOME')} className={navItemClass('HOME')}>
            <Activity className="w-4 h-4 mr-2" />
            {user.role === 'USER' ? 'In-Play' : 'Overview'}
          </button>
          {(user.role === 'ADMIN' || user.role === 'MANAGER') && (
            <>
              <button onClick={() => setActiveTab('NETWORK')} className={navItemClass('NETWORK')}>
                <Users className="w-4 h-4 mr-2" />
                Network
              </button>
              <button onClick={() => setActiveTab('BANKING')} className={navItemClass('BANKING')}>
                <Wallet className="w-4 h-4 mr-2" />
                Banking
              </button>
            </>
          )}
          <button onClick={() => setActiveTab('REPORTS')} className={navItemClass('REPORTS')}>
            <FileText className="w-4 h-4 mr-2" />
            Reports
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="mx-auto mt-4 max-w-7xl space-y-6 p-4 animate-in fade-in duration-300">
        {user.isRestricted && (
          <div className="bg-red-500/10 border border-red-500/50 p-4 rounded-xl flex items-center text-red-400 shadow-lg">
            <ShieldAlert className="mr-3 w-6 h-6" />
            <div>
              <h3 className="font-bold">Account Restricted</h3>
              <p className="text-sm">You have been blocked by your administrator. Betting and transfers are disabled.</p>
            </div>
          </div>
        )}

        {/* Tab Rendering Logic */}
        
        {activeTab === 'HOME' && (
          <div>
            {user.role === 'USER' ? (
              <LiveMatches />
            ) : (
              <AccountManagement /> // For Admin/Manager, home shows network stats
            )}
          </div>
        )}

        {activeTab === 'NETWORK' && (user.role === 'ADMIN' || user.role === 'MANAGER') && (
          <div className="space-y-6">
            <section className="exchange-panel max-w-xl rounded-2xl p-6">
              <h2 className="text-xl font-bold mb-2 flex items-center text-white">
                <div className="p-2 bg-green-500/10 rounded-lg mr-3">
                  <Users className="text-green-400 w-5 h-5" /> 
                </div>
                Generate New {user.role === 'ADMIN' ? 'Manager' : 'User'}
              </h2>
              <p className="text-gray-400 text-sm mb-6 pl-12">
                Create a new subordinate account and instantly assign a starting balance.
              </p>
              <div className="pl-12">
                <CreateAccountForm />
              </div>
            </section>
          </div>
        )}

        {activeTab === 'BANKING' && (user.role === 'ADMIN' || user.role === 'MANAGER') && (
          <div>
            <section className="exchange-panel max-w-xl rounded-2xl p-6">
              <h2 className="text-xl font-bold mb-6 flex items-center text-white">
                <div className="p-2 bg-blue-500/10 rounded-lg mr-3">
                  <Wallet className="text-blue-400 w-5 h-5" /> 
                </div>
                Quick Transfer
              </h2>
              <WalletTransfer />
            </section>
          </div>
        )}

        {activeTab === 'REPORTS' && (
          <ReportsPanel />
        )}

      </main>
      </div>
      </div>
    </div>
  );
}
