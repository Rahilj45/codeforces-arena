import React, { useState, useEffect } from 'react';
import { Trophy, Medal, Star } from 'lucide-react';
import TiltCard from './TiltCard';

export default function Leaderboard({ backendUrl }) {
  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${backendUrl}/api/leaderboard`)
      .then(r => r.json())
      .then(data => { setLeaders(data); setLoading(false); })
      .catch(e => { console.error(e); setLoading(false); });
  }, [backendUrl]);

  if (loading) return <div className="text-white text-center mt-10">Loading Rankings...</div>;

  return (
    <div className="w-full max-w-5xl">
      <TiltCard>
        <div className="glass-panel p-8 rounded-2xl shadow-xl border border-white/10 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/10 to-amber-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
          
          <h2 className="text-3xl font-bold text-white mb-6 flex items-center gap-3 relative z-10 glow-text">
            <Trophy className="text-yellow-400" size={32}/> Global Arena Rankings
          </h2>
          
          <div className="overflow-x-auto relative z-10">
            <table className="w-full text-left text-slate-300 border-collapse">
              <thead className="text-xs uppercase bg-slate-900/40 backdrop-blur-sm text-slate-400 border-b border-slate-700/50">
                <tr>
                  <th className="px-6 py-4 rounded-tl-lg">Rank</th>
                  <th className="px-6 py-4">Handle</th>
                  <th className="px-6 py-4">Arena ELO</th>
                  <th className="px-6 py-4">Wins</th>
                  <th className="px-6 py-4 rounded-tr-lg">Losses</th>
                </tr>
              </thead>
              <tbody>
                {leaders.map((u, i) => (
                  <tr key={u.cf_handle} className="border-b border-slate-700/30 hover:bg-slate-800/40 transition-colors backdrop-blur-sm">
                    <td className="px-6 py-4 font-bold">
                      {i === 0 ? <span className="text-yellow-400 flex items-center gap-1"><Medal size={18}/> 1st</span> :
                       i === 1 ? <span className="text-slate-300 flex items-center gap-1"><Medal size={18}/> 2nd</span> :
                       i === 2 ? <span className="text-amber-600 flex items-center gap-1"><Medal size={18}/> 3rd</span> :
                       `#${i + 1}`}
                    </td>
                    <td className="px-6 py-4 text-blue-400 font-medium">{u.cf_handle}</td>
                    <td className="px-6 py-4 font-bold text-white flex items-center gap-2">
                      <Star size={16} className={i < 3 ? "text-yellow-400" : "text-slate-500"}/>
                      {u.arena_rating || 800}
                    </td>
                    <td className="px-6 py-4 text-emerald-400 font-bold">{u.wins || 0}</td>
                    <td className="px-6 py-4 text-red-400">{u.losses || 0}</td>
                  </tr>
                ))}
                {leaders.length === 0 && (
                  <tr>
                    <td colSpan="5" className="px-6 py-8 text-center text-slate-500">No players ranked yet. Play some matches!</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </TiltCard>
    </div>
  );
}
