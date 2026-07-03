import React, { useState } from 'react';
import { supabase } from '../supabase';
import { Mail, Lock, User, Loader2, LogIn } from 'lucide-react';
import LiveBackground from './LiveBackground';
import TiltCard from './TiltCard';

export default function Auth({ onSession }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  
  const [isLogin, setIsLogin] = useState(true);
  const [isResetMode, setIsResetMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [needsOTP, setNeedsOTP] = useState(false);
  const [otp, setOtp] = useState('');

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (data.session) onSession(data.session);
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { first_name: firstName, last_name: lastName }
          }
        });
        if (error) throw error;
        setSuccessMsg('Signup successful! Please check your email for the OTP code.');
        setNeedsOTP(true);
      }
    } catch (e) {
      setErrorMsg(e.message);
    } finally {
      setLoading(false);
    }
  };

  const verifyOTP = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    try {
      const { data, error } = await supabase.auth.verifyOtp({ email, token: otp, type: 'signup' });
      if (error) throw error;
      if (data.session) onSession(data.session);
    } catch (e) {
      setErrorMsg(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    if (!email) {
      setErrorMsg("Please enter your email address first.");
      return;
    }
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin
      });
      if (error) throw error;
      setSuccessMsg("Password reset email sent! Please check your inbox.");
      setIsResetMode(false);
    } catch (e) {
      setErrorMsg(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 font-sans relative overflow-hidden z-0">
      <LiveBackground />
      <TiltCard>
        <div className="glass-panel p-8 rounded-2xl shadow-[0_0_50px_rgba(59,130,246,0.15)] border border-white/10 max-w-md w-full relative group overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
          <div className="relative z-10">
            <h2 className="text-3xl font-bold text-center text-white mb-8 drop-shadow-md">
          Codeforces <span className="text-blue-500">Arena</span>
        </h2>
        
        {errorMsg && <div className="bg-red-900/50 text-red-400 p-4 rounded-lg mb-6 border border-red-800 text-sm">{errorMsg}</div>}
        {successMsg && <div className="bg-emerald-900/50 text-emerald-400 p-4 rounded-lg mb-6 border border-emerald-800 text-sm">{successMsg}</div>}

        {needsOTP ? (
          <form onSubmit={verifyOTP} className="space-y-4">
            <div>
              <label className="block text-slate-400 text-sm mb-1 font-medium">Enter 6-digit OTP from Email</label>
              <input required type="text" value={otp} onChange={e=>setOtp(e.target.value)} className="w-full glass-panel border border-slate-700 rounded-lg px-4 py-3 text-white outline-none focus:border-blue-500 font-bold tracking-widest text-center text-xl" placeholder="123456" />
            </div>
            <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg flex justify-center items-center gap-2 transition-all shadow-lg shadow-blue-900/50">
              {loading ? <Loader2 className="animate-spin" size={20} /> : 'Verify Account'}
            </button>
          </form>
        ) : isResetMode ? (
          <form onSubmit={handlePasswordReset} className="space-y-4">
            <div>
              <label className="block text-slate-400 text-sm mb-1 font-medium">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 text-slate-500" size={18} />
                <input required type="email" value={email} onChange={e=>setEmail(e.target.value)} className="w-full glass-panel border border-slate-700 rounded-lg pl-10 pr-4 py-2.5 text-white outline-none focus:border-blue-500 transition-colors" placeholder="you@example.com" />
              </div>
            </div>
            <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg flex justify-center items-center gap-2 mt-4 transition-all shadow-lg shadow-blue-900/50">
              {loading ? <Loader2 className="animate-spin" size={20} /> : 'Send Reset Link'}
            </button>
            <p className="text-center mt-4">
              <button type="button" onClick={() => { setIsResetMode(false); setErrorMsg(''); setSuccessMsg(''); }} className="text-slate-400 font-medium hover:text-white transition-colors text-sm">
                Back to Login
              </button>
            </p>
          </form>
        ) : (
          <form onSubmit={handleAuth} className="space-y-4">
            {!isLogin && (
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-slate-400 text-sm mb-1 font-medium">First Name</label>
                  <input required type="text" value={firstName} onChange={e=>setFirstName(e.target.value)} className="w-full glass-panel border border-slate-700 rounded-lg px-4 py-2.5 text-white outline-none focus:border-blue-500 transition-colors" />
                </div>
                <div className="flex-1">
                  <label className="block text-slate-400 text-sm mb-1 font-medium">Last Name</label>
                  <input required type="text" value={lastName} onChange={e=>setLastName(e.target.value)} className="w-full glass-panel border border-slate-700 rounded-lg px-4 py-2.5 text-white outline-none focus:border-blue-500 transition-colors" />
                </div>
              </div>
            )}
            
            <div>
              <label className="block text-slate-400 text-sm mb-1 font-medium">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 text-slate-500" size={18} />
                <input required type="email" value={email} onChange={e=>setEmail(e.target.value)} className="w-full glass-panel border border-slate-700 rounded-lg pl-10 pr-4 py-2.5 text-white outline-none focus:border-blue-500 transition-colors" placeholder="you@example.com" />
              </div>
            </div>

            <div>
              <label className="block text-slate-400 text-sm mb-1 font-medium">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 text-slate-500" size={18} />
                <input required type="password" value={password} onChange={e=>setPassword(e.target.value)} className="w-full glass-panel border border-slate-700 rounded-lg pl-10 pr-4 py-2.5 text-white outline-none focus:border-blue-500 transition-colors" placeholder="••••••••" />
              </div>
            </div>

            <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg flex justify-center items-center gap-2 mt-6 transition-all shadow-lg shadow-blue-900/50">
              {loading ? <Loader2 className="animate-spin" size={20} /> : (isLogin ? 'Sign In Securely' : 'Create Account')}
            </button>

            {isLogin && (
              <div className="text-right mt-2">
                <button type="button" onClick={() => { setIsResetMode(true); setErrorMsg(''); setSuccessMsg(''); }} className="text-sm text-slate-400 hover:text-white transition-colors">
                  Forgot Password?
                </button>
              </div>
            )}
            
            <p className="text-center text-slate-400 text-sm mt-6">
              {isLogin ? "Don't have an account? " : "Already have an account? "}
              <button type="button" onClick={() => { setIsLogin(!isLogin); setErrorMsg(''); setSuccessMsg(''); }} className="text-blue-400 font-medium hover:text-blue-300 hover:underline">
                {isLogin ? 'Sign Up' : 'Log In'}
              </button>
            </p>
          </form>
        )}
          </div>
        </div>
      </TiltCard>
    </div>
  );
}
