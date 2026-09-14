'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LogOut, Wallet, ShieldAlert, Trophy, Users, Activity, FileText, Megaphone, ChevronRight } from 'lucide-react';
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

  const navItemClass = (tab: string) => `flex items-center px-4 py-3 font-bold transition-all border-b-2 ${
    activeTab === tab 
      ? 'border-green-500 text-green-400 bg-gray-900' 
      : 'border-transparent text-gray-500 hover:text-gray-300 hover:bg-gray-800'
  }`;

  return (
    <div className="min-h-screen text-gray-100 pb-12 font-sans">
      {/* Premium Top Navbar */}
      <nav className="bg-gray-900 border-b border-gray-800 p-4 sticky top-0 z-50 shadow-2xl">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="gold-button rounded-lg p-2">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-white tracking-tight">CRICKET<span className="text-[#f3b51b]">X</span></h1>
              <span className="rounded-full bg-emerald-950 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-emerald-200">{user.role} PANEL</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {user.role !== 'ADMIN' && (
              <div className="flex items-center rounded-xl border border-emerald-700/60 bg-emerald-950/70 px-4 py-2 shadow-inner">
                <Wallet className="mr-2 h-4 w-4 text-[#f3b51b]" />
                <span className="font-bold font-mono tracking-tight text-white">₹{user.walletBalance.toFixed(2)}</span>
              </div>
            )}
            <button onClick={handleLogout} className="p-2 hover:bg-gray-800 rounded-full transition-colors text-gray-400 hover:text-red-400">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        {/* Tab Navigation */}
        <div className="max-w-7xl mx-auto mt-3 flex overflow-x-auto hide-scrollbar border-b border-emerald-900">
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
      <main className="max-w-7xl mx-auto mt-4 space-y-6 p-4 animate-in fade-in duration-300">
        <section className="exchange-panel flex flex-col gap-4 rounded-2xl p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-[#f3b51b]">
              <span className="h-2 w-2 animate-pulse rounded-full bg-[#f3b51b]" /> Cricket exchange
            </div>
            <h2 className="mt-1 text-2xl font-black text-white md:text-3xl">Live cricket markets</h2>
            <p className="mt-1 text-sm text-emerald-100/65">Fast odds, clear limits, and a complete audit trail for every bet.</p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-emerald-700/60 bg-emerald-950/60 px-4 py-3 text-sm">
            <Megaphone className="h-4 w-4 text-[#f3b51b]" />
            <span className="text-emerald-100">Markets refresh automatically</span>
            <ChevronRight className="h-4 w-4 text-emerald-400" />
          </div>
        </section>
        
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
  );
}
