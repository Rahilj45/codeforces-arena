import React, { useState } from 'react';
import { supabase } from '../supabase';
import { Link, Loader2, CheckCircle } from 'lucide-react';

export default function LinkCodeforces({ onLinked }) {
  const [handle, setHandle] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleLink = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      // Verify Codeforces handle exists
      const res = await fetch(`https://codeforces.com/api/user.info?handles=${handle}`);
      const data = await res.json();
      
      if (data.status !== 'OK') {
        throw new Error('Codeforces handle not found. Please check spelling.');
      }

      // Update Supabase Auth metadata
      const { error } = await supabase.auth.updateUser({
        data: { cf_handle: handle }
      });

      if (error) throw error;
      
      onLinked(handle);

    } catch (e) {
      setErrorMsg(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 font-sans">
      <div className="bg-slate-900/40 backdrop-blur-sm border border-slate-800 p-8 rounded-2xl shadow-2xl max-w-md w-full text-center">
        <div className="bg-blue-600/20 text-blue-400 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
          <Link size={32} />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Link Codeforces</h2>
        <p className="text-slate-400 mb-8 text-sm">
          To play in the Arena, you need to link your Codeforces account. We'll automatically fetch your rating and stats.
        </p>

        {errorMsg && <div className="bg-red-900/50 text-red-400 p-3 rounded-lg mb-6 border border-red-800 text-sm text-left">{errorMsg}</div>}

        <form onSubmit={handleLink} className="space-y-4 text-left">
          <div>
            <label className="block text-slate-400 text-sm mb-1 font-medium">Codeforces Handle</label>
            <input required type="text" value={handle} onChange={e=>setHandle(e.target.value)} className="w-full glass-panel border border-slate-700 rounded-lg px-4 py-2.5 text-white outline-none focus:border-blue-500 transition-colors" placeholder="e.g. tourist" />
          </div>

          <button type="submit" disabled={loading || !handle.trim()} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-lg flex justify-center items-center gap-2 mt-6 transition-all">
            {loading ? <Loader2 className="animate-spin" size={20} /> : <><CheckCircle size={20}/> Connect Account</>}
          </button>
        </form>
      </div>
    </div>
  );
}
