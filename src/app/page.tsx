'use client';

import { useState, useEffect } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase/client';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Activity, ArrowRight, LockKeyhole, Loader2, ShieldCheck, Trophy } from 'lucide-react';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [captchaCode, setCaptchaCode] = useState(() => Math.floor(1000 + Math.random() * 9000).toString());
  const [userCaptcha, setUserCaptcha] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();
  const { user, loading } = useAuth();

  const generateCaptcha = () => {
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    setCaptchaCode(code);
  };

  useEffect(() => {
    if (!loading && user) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-[#07111f]">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#f3b51b] border-t-transparent" />
      <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Loading…</span>
    </div>
  );
  if (user) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError('');

    if (userCaptcha !== captchaCode) {
      setError('Invalid Captcha Code');
      generateCaptcha();
      setUserCaptcha('');
      return;
    }

    if (password.length < 4) {
      setError('Password must be at least 4 characters');
      return;
    }

    setSubmitting(true);
    try {
      // Firebase requires an email, so we spoof one using their unique username
      const spoofedEmail = `${username.toLowerCase()}@local.app`;
      const paddedPassword = password + '_app'; // Padding for Firebase 6 char limit
      await signInWithEmailAndPassword(auth, spoofedEmail, paddedPassword);
      router.push('/dashboard');
    } catch {
      setError('Invalid username or password');
      generateCaptcha();
      setUserCaptcha('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-glow flex min-h-screen items-center justify-center px-4 py-8">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-700/50 bg-[#0a1728]/95 shadow-2xl lg:grid-cols-[1.1fr_0.9fr]">
        <div className="hidden flex-col justify-between bg-gradient-to-br from-[#122d4c] to-[#0a1728] p-10 lg:flex">
          <div>
            <div className="mb-8 flex items-center gap-3">
              <div className="gold-button rounded-xl p-3"><Trophy className="h-6 w-6" /></div>
              <div><div className="text-2xl font-black tracking-tight text-white">WIN<span className="text-[#f3b51b]">EXCH</span></div><div className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400">Cricket exchange</div></div>
            </div>
            <h2 className="max-w-md text-4xl font-black leading-tight text-white">Trade every ball with confidence.</h2>
            <p className="mt-4 max-w-md text-slate-300">Live cricket markets, transparent odds and fast settlement in one professional exchange.</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              [Activity, 'Live markets'],
              [ShieldCheck, 'Secure ledger'],
              [LockKeyhole, 'Private access'],
            ].map(([Icon, label]) => <div key={label as string} className="rounded-xl border border-slate-600/40 bg-slate-950/20 p-3"><Icon className="mb-2 h-4 w-4 text-[#f3b51b]" /><div className="text-xs font-bold text-slate-300">{label as string}</div></div>)}
          </div>
        </div>

        <div className="p-6 sm:p-10">
          <div className="mb-8 flex items-center gap-3 lg:hidden"><div className="gold-button rounded-lg p-2"><Trophy className="h-5 w-5" /></div><div className="text-xl font-black text-white">WIN<span className="text-[#f3b51b]">EXCH</span></div></div>
          <div className="mb-8"><p className="text-xs font-black uppercase tracking-[0.2em] text-[#f3b51b]">Member portal</p><h1 className="mt-2 text-3xl font-black text-white">Welcome back</h1><p className="mt-2 text-sm text-slate-400">Sign in to access your cricket exchange.</p></div>

          {error && <p className="text-red-500 mb-4 text-center text-sm bg-red-100/10 p-2 rounded">{error}</p>}

          <form onSubmit={handleLogin} className="space-y-6">
            <fieldset disabled={submitting} className="space-y-6 border-0 p-0 m-0 disabled:opacity-60 disabled:pointer-events-none transition-opacity duration-200">
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.trim())}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950/60 p-3 text-white outline-none transition focus:border-[#f3b51b]"
                  required
                  autoComplete="username"
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950/60 p-3 text-white outline-none transition focus:border-[#f3b51b]"
                  required
                  minLength={4}
                  autoComplete="current-password"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">Security code</label>
                <div className="flex gap-4 items-center">
                  <div className="select-none rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 font-mono text-2xl tracking-widest text-[#f3b51b] line-through decoration-slate-500">
                    {captchaCode}
                  </div>
                  <input
                    type="text"
                    maxLength={4}
                    value={userCaptcha}
                    onChange={(e) => setUserCaptcha(e.target.value.replace(/\D/g, ''))}
                    placeholder="Enter 4 digits"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950/60 p-3 text-center text-xl tracking-widest text-white outline-none focus:border-[#f3b51b]"
                    required
                  />
                </div>
              </div>
            </fieldset>

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#f3b51b] py-3 font-black text-[#07111f] transition hover:bg-[#ffd45b] disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Signing in…
                </>
              ) : (
                <>
                  Enter exchange <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
