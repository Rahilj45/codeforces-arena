import React, { useState } from 'react';
import { supabase } from '../supabase';
import { Lock, Loader2 } from 'lucide-react';
import LiveBackground from './LiveBackground';
import TiltCard from './TiltCard';
import { toast } from 'sonner';

export default function UpdatePassword({ onPasswordUpdated }) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated successfully!");
      onPasswordUpdated();
    } catch (e) {
      toast.error(e.message);
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
              Set New <span className="text-blue-500">Password</span>
            </h2>
            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="block text-slate-400 text-sm mb-1 font-medium">New Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 text-slate-500" size={18} />
                  <input required type="password" value={password} onChange={e=>setPassword(e.target.value)} className="w-full glass-panel border border-slate-700 rounded-lg pl-10 pr-4 py-2.5 text-white outline-none focus:border-blue-500 transition-colors" placeholder="••••••••" />
                </div>
              </div>
              <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg flex justify-center items-center gap-2 mt-6 transition-all shadow-lg shadow-blue-900/50">
                {loading ? <Loader2 className="animate-spin" size={20} /> : 'Update Password'}
              </button>
            </form>
          </div>
        </div>
      </TiltCard>
    </div>
  );
}
