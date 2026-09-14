'use client';

import { useState, useEffect } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase/client';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [captchaCode, setCaptchaCode] = useState('');
  const [userCaptcha, setUserCaptcha] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();
  const { user, loading } = useAuth();

  const generateCaptcha = () => {
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    setCaptchaCode(code);
  };

  // Generate a random 4 digit captcha on load
  useEffect(() => {
    generateCaptcha();
  }, []);

  useEffect(() => {
    if (!loading && user) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (user) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (userCaptcha !== captchaCode) {
      setError('Invalid Captcha Code');
      generateCaptcha(); // Reset captcha on fail
      setUserCaptcha('');
      return;
    }

    if (password.length < 4) {
      setError('Password must be at least 4 characters');
      return;
    }

    try {
      // Firebase requires an email, so we spoof one using their unique username
      const spoofedEmail = `${username.toLowerCase()}@local.app`;
      const paddedPassword = password + '_app'; // Padding for Firebase 6 char limit
      await signInWithEmailAndPassword(auth, spoofedEmail, paddedPassword);
      router.push('/dashboard');
    } catch (err: any) {
      setError('Invalid username or password');
      generateCaptcha();
      setUserCaptcha('');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-md">
        <h1 className="text-3xl font-bold text-center mb-8 text-green-400">Cricket Exchange</h1>
        {error && <p className="text-red-500 mb-4 text-center text-sm bg-red-100/10 p-2 rounded">{error}</p>}
        
        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value.trim())}
              className="w-full p-3 rounded bg-gray-700 border border-gray-600 focus:outline-none focus:border-green-400"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 rounded bg-gray-700 border border-gray-600 focus:outline-none focus:border-green-400"
              required
              minLength={4}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Security Code</label>
            <div className="flex gap-4 items-center">
              <div className="bg-gray-900 text-green-400 font-mono text-2xl tracking-widest px-4 py-2 rounded border border-gray-600 select-none line-through decoration-gray-500">
                {captchaCode}
              </div>
              <input
                type="text"
                maxLength={4}
                value={userCaptcha}
                onChange={(e) => setUserCaptcha(e.target.value.replace(/\D/g, ''))} // Only allow numbers
                placeholder="Enter 4 digits"
                className="w-full p-3 rounded bg-gray-700 border border-gray-600 focus:outline-none focus:border-green-400 text-center text-xl tracking-widest"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded transition-colors"
          >
            Secure Login
          </button>
        </form>
      </div>
    </div>
  );
}
