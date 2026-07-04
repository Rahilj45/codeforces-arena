import React, { useState, useEffect } from 'react';
import { User, Activity, Swords, Unplug, Loader2 } from 'lucide-react';
import { supabase } from '../supabase';

export default function Profile({ backendUrl, handle }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchHandle, setSearchHandle] = useState(handle || '');
  const [queryHandle, setQueryHandle] = useState(handle || '');
  const [unlinking, setUnlinking] = useState(false);

  const handleUnlink = async () => {
    if (window.confirm("Are you sure you want to unlink your Codeforces handle? You will need to verify a new one to play.")) {
      setUnlinking(true);
      try {
        await supabase.auth.updateUser({ data: { cf_handle: null } });
        window.location.reload();
      } catch (e) {
        console.error(e);
        setUnlinking(false);
      }
    }
  };

  useEffect(() => {
    if (!queryHandle) {
      setLoading(false);
      return;
    }
    setLoading(true);
    
    const fetchProfile = async () => {
      try {
        const res = await fetch(`${backendUrl}/api/profile/${queryHandle}`);
        const d = await res.json();
        
        if (!d.user && queryHandle === handle) {
          // If the user's own profile is missing from the DB, auto-sync it!
          await fetch(`${backendUrl}/api/user/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cf_handle: handle })
          });
          
          // Re-fetch after sync
          const res2 = await fetch(`${backendUrl}/api/profile/${queryHandle}`);
          const d2 = await res2.json();
          setData(d2);
        } else {
          setData(d);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    
    fetchProfile();
  }, [backendUrl, queryHandle, handle]);

  return (
    <div className="max-w-4xl mx-auto p-6 mt-10">
      <div className="flex gap-4 mb-8">
        <input 
          type="text" 
          value={searchHandle} 
          onChange={e => setSearchHandle(e.target.value)} 
          onKeyDown={e => e.key === 'Enter' && setQueryHandle(searchHandle)}
          placeholder="Search Codeforces Handle..."
          className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
        />
        <button 
          onClick={() => setQueryHandle(searchHandle)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-bold transition-all flex items-center gap-2"
        >
          <User size={20}/> Search Profile
        </button>
      </div>

      {loading && <div className="text-white text-center">Loading...</div>}
      
      {!loading && !data?.user && queryHandle && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 text-center text-slate-400">
          User not found in Arena. They need to play at least one match to appear here.
        </div>
      )}

      {!loading && data?.user && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Stats Card */}
          <div className="col-span-1 bg-slate-800 rounded-xl border border-slate-700 p-6 shadow-xl h-fit">
            <h2 className="text-2xl font-bold text-white mb-2">{data.user.cf_handle}</h2>
            <div className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400 mb-2">
              {data.user.arena_rating || 800} ELO
            </div>
            
            {data.cfRating && (
              <div className="text-sm font-semibold text-slate-400 mb-6 bg-slate-900 px-3 py-1 rounded-full inline-block">
                Actual CF Rating: {data.cfRating}
              </div>
            )}
            
            <div className="space-y-3">
              <div className="flex justify-between text-slate-300">
                <span>Wins</span>
                <span className="font-bold text-emerald-400">{data.user.wins || 0}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Losses</span>
                <span className="font-bold text-red-400">{data.user.losses || 0}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Win Rate</span>
                <span className="font-bold text-blue-400">
                  {data.user.wins + data.user.losses > 0 
                    ? Math.round((data.user.wins / (data.user.wins + data.user.losses)) * 100) 
                    : 0}%
                </span>
              </div>
            </div>
            
            {queryHandle === handle && (
              <button 
                onClick={handleUnlink}
                disabled={unlinking}
                className="w-full mt-6 bg-red-900/30 hover:bg-red-600 border border-red-800 hover:border-red-500 text-red-400 hover:text-white px-4 py-3 rounded-lg font-bold transition-all flex justify-center items-center gap-2"
              >
                {unlinking ? <Loader2 className="animate-spin" size={20} /> : <Unplug size={20} />}
                Unlink Codeforces Handle
              </button>
            )}
          </div>

          {/* Match History */}
          <div className="col-span-1 md:col-span-2 bg-slate-800 rounded-xl border border-slate-700 p-6 shadow-xl">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2"><Swords size={20}/> Recent Matches</h3>
            <div className="space-y-4">
              {data.history.length === 0 ? (
                <div className="text-slate-400 text-center py-8">No matches played yet.</div>
              ) : (
                data.history.map(match => {
                  const isWinner = match.winner_handle === data.user.cf_handle;
                  return (
                    <div key={match.id} className={`p-4 rounded-lg border ${isWinner ? 'bg-emerald-900/20 border-emerald-800' : 'bg-red-900/20 border-red-800'} flex justify-between items-center`}>
                      <div>
                        <div className={`font-bold ${isWinner ? 'text-emerald-400' : 'text-red-400'}`}>
                          {isWinner ? 'VICTORY' : 'DEFEAT'}
                        </div>
                        <div className="text-sm text-slate-400 mt-1">
                          vs {isWinner ? match.loser_handles.join(', ') : match.winner_handle}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-white font-bold">{match.total_problems} Problems</div>
                        <div className="text-xs text-slate-500 mt-1">{new Date(match.created_at).toLocaleDateString()}</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
