import React, { useState } from 'react';
import { supabase } from '../supabase';
import { Link, Loader2, CheckCircle, Copy, AlertCircle } from 'lucide-react';

const rawBackendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
const BACKEND_URL = rawBackendUrl.startsWith('http') ? rawBackendUrl : `https://${rawBackendUrl}`;

export default function LinkCodeforces({ onLinked }) {
  const [step, setStep] = useState(1);
  const [handle, setHandle] = useState('');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleStartVerification = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch(`${BACKEND_URL}/api/verify-handle-start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle })
      });
      const contentType = res.headers.get("content-type");
      let data = {};
      if (contentType && contentType.includes("application/json")) {
        data = await res.json();
      } else {
        throw new Error('Backend is waking up or unavailable. Please try again in 30 seconds.');
      }
      
      if (!res.ok) throw new Error(data.error || 'Failed to start verification.');

      setToken(data.token);
      setStep(2);
    } catch (e) {
      setErrorMsg(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckVerification = async () => {
    setLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch(`${BACKEND_URL}/api/verify-handle-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle })
      });
      const contentType = res.headers.get("content-type");
      let data = {};
      if (contentType && contentType.includes("application/json")) {
        data = await res.json();
      } else {
        throw new Error('Backend is waking up or unavailable. Please try again in 30 seconds.');
      }
      
      if (!res.ok) throw new Error(data.error || 'Verification check failed.');
      
      if (data.success) {
        // Verification succeeded!
        const { error } = await supabase.auth.updateUser({
          data: { cf_handle: handle }
        });
        if (error) throw error;
        
        onLinked(handle);
      } else {
        throw new Error(data.error || "Verification failed. Token not found.");
      }
    } catch (e) {
      setErrorMsg(e.message);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(token);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 font-sans">
      <div className="bg-slate-900/40 backdrop-blur-sm border border-slate-800 p-8 rounded-2xl shadow-2xl max-w-md w-full text-center">
        <div className="bg-blue-600/20 text-blue-400 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
          <Link size={32} />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Link Codeforces</h2>
        <p className="text-slate-400 mb-8 text-sm">
          To play in the Arena, you need to verify your Codeforces account.
        </p>

        {errorMsg && (
          <div className="bg-red-900/50 text-red-400 p-3 rounded-lg mb-6 border border-red-800 text-sm text-left flex items-start gap-2">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {step === 1 ? (
          <form onSubmit={handleStartVerification} className="space-y-4 text-left">
            <div>
              <label className="block text-slate-400 text-sm mb-1 font-medium">Codeforces Handle</label>
              <input required type="text" value={handle} onChange={e=>setHandle(e.target.value)} className="w-full glass-panel border border-slate-700 rounded-lg px-4 py-2.5 text-white outline-none focus:border-blue-500 transition-colors" placeholder="e.g. tourist" />
            </div>
            <button type="submit" disabled={loading || !handle.trim()} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg flex justify-center items-center gap-2 mt-6 transition-all disabled:bg-slate-700">
              {loading ? <Loader2 className="animate-spin" size={20} /> : 'Continue'}
            </button>
          </form>
        ) : (
          <div className="text-left space-y-4">
            <div className="bg-amber-900/20 border border-amber-500/50 p-4 rounded-xl">
              <h3 className="text-amber-400 font-semibold mb-2">Verification Required</h3>
              <p className="text-slate-300 text-sm mb-3">
                To prove you own <strong>{handle}</strong>, please temporarily change your <strong>First Name</strong> on your Codeforces profile to the following token:
              </p>
              
              <div className="flex items-center gap-2 mb-3">
                <code className="flex-1 bg-slate-950 text-emerald-400 font-mono text-lg px-4 py-2 rounded-lg border border-slate-800 text-center select-all">
                  {token}
                </code>
                <button onClick={copyToClipboard} className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors" title="Copy to clipboard">
                  <Copy size={20} />
                </button>
              </div>
              
              <p className="text-slate-400 text-xs italic">
                You can change your name back immediately after verification succeeds.
              </p>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setStep(1)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-semibold py-3 rounded-lg transition-colors">
                Back
              </button>
              <button onClick={handleCheckVerification} disabled={loading} className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-700 text-white font-bold py-3 rounded-lg flex justify-center items-center gap-2 transition-all">
                {loading ? <Loader2 className="animate-spin" size={20} /> : <><CheckCircle size={20}/> Verify Now</>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
