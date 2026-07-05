import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { Play, LogIn, ExternalLink, Loader2, Trophy, Clock, Users, CheckCircle, Lock, Unlock, Send, Globe, LogOut } from 'lucide-react';
import Leaderboard from './components/Leaderboard';
import Profile from './components/Profile';
import Auth from './components/Auth';
import LinkCodeforces from './components/LinkCodeforces';
import { supabase } from './supabase';
import { Toaster, toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import LiveBackground from './components/LiveBackground';
import TiltCard from './components/TiltCard';
import { playSound } from './utils/sounds';
import UpdatePassword from './components/UpdatePassword';
import { Analytics } from '@vercel/analytics/react';

const rawBackendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
const BACKEND_URL = rawBackendUrl.startsWith('http') ? rawBackendUrl : `https://${rawBackendUrl}`;
const socket = io(BACKEND_URL);

function App() {
  const [session, setSession] = useState(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [needsCFLink, setNeedsCFLink] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);

  const [handle, setHandle] = useState('');
  const [roomId, setRoomId] = useState('');
  const [roomName, setRoomName] = useState('');
  const [password, setPassword] = useState('');
  const [gameState, setGameState] = useState('join'); 
  const [isJoining, setIsJoining] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [roomData, setRoomData] = useState({ host: '', players: [], scoreboard: {}, isPrivate: false });
  const [problems, setProblems] = useState([]);
  
  const [minRating, setMinRating] = useState(800);
  const [maxRating, setMaxRating] = useState(1200);
  const [timeLimit, setTimeLimit] = useState(15);
  const [numProblems, setNumProblems] = useState(3);
  
  const [endTime, setEndTime] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);
  const [verifyingStatus, setVerifyingStatus] = useState({});
  const [winnerMessage, setWinnerMessage] = useState(null);
  const [countdownValue, setCountdownValue] = useState(0);

  // NEW STATES FOR PHASE 1
  const [publicRooms, setPublicRooms] = useState([]);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef(null);

  // PHASE 3 STATE
  const [activeTab, setActiveTab] = useState('arena');

  const [joinTab, setJoinTab] = useState('create'); // 'create' or 'join'
  const [isSpectator, setIsSpectator] = useState(false);
  const handleRef = useRef(handle);
  
  useEffect(() => {
    handleRef.current = handle;
  }, [handle]);

  useEffect(() => {
    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSession(session);
        const cfHandle = session.user.user_metadata?.cf_handle;
        if (!cfHandle) {
          setNeedsCFLink(true);
        } else {
          setHandle(cfHandle);
          checkSavedRoom(cfHandle);
        }
      }
      setIsCheckingSession(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      
      if (event === 'PASSWORD_RECOVERY') {
        setRecoveryMode(true);
      } else if (session) {
        const cfHandle = session.user.user_metadata?.cf_handle;
        if (!cfHandle) {
          setNeedsCFLink(true);
        } else {
          setNeedsCFLink(false);
          setHandle(cfHandle);
        }
      } else {
        setHandle('');
        setGameState('join');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkSavedRoom = (currentHandle) => {
    const savedRoom = localStorage.getItem('arena_roomId');
    const savedPass = localStorage.getItem('arena_password');
    if (savedRoom && currentHandle) {
      setRoomId(savedRoom);
      if (savedPass) setPassword(savedPass);
      socket.emit('join_room', { roomId: savedRoom, handle: currentHandle, password: savedPass });
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };


  useEffect(() => {
    socket.on('public_rooms_update', (rooms) => setPublicRooms(rooms));
    
    socket.on('room_state_update', (data) => {
      setRoomData({ roomName: data.roomName, host: data.host, players: data.players, spectators: data.spectators || [], scoreboard: data.scoreboard || {}, isPrivate: data.isPrivate });
      setGameState(prev => prev === 'join' ? 'lobby' : prev);
      setIsJoining(false);
    });

    socket.on('match_starting', (data) => {
      setGameState('countdown');
      setCountdownValue(data.countdown);
      playSound('countdown');
      let count = data.countdown;
      const interval = setInterval(() => {
        count -= 1;
        if (count > 0) {
          setCountdownValue(count);
          playSound('countdown');
        } else {
          clearInterval(interval);
        }
      }, 1000);
    });

    socket.on('new_problems', (data) => {
      setProblems(data.problems);
      setEndTime(data.endTime);
      setGameState('playing');
      setIsStarting(false);
      setWinnerMessage(null);
      setVerifyingStatus({});
      playSound('start');
      toast.success("Match Started! Good luck!");
    });

    socket.on('verification_started', (data) => {
      setVerifyingStatus(prev => ({ ...prev, [`${data.handle}-${data.problemId}`]: true }));
    });

    socket.on('verification_failed', (data) => {
      setVerifyingStatus(prev => ({ ...prev, [`${data.handle}-${data.problemId}`]: false }));
      if (data.handle === handleRef.current) {
          toast.error(`Failed ${data.problemId}: ${data.reason}`);
      }
    });

    socket.on('problem_solved', (data) => {
      setVerifyingStatus(prev => ({ ...prev, [`${data.handle}-${data.problemId}`]: false }));
      setRoomData(prev => ({ ...prev, scoreboard: data.scoreboard }));
      if (data.newEndTime) {
        setEndTime(data.newEndTime);
      }
      if (data.handle === handleRef.current) {
        playSound('solve_own');
      } else {
        playSound('solve_opp');
      }
    });

    socket.on('time_up', (data) => {
      setWinnerMessage(data.message);
      setGameState('finished');
      if (data.message.includes(handleRef.current) && data.message.includes('wins')) {
        playSound('win');
      } else {
        playSound('time_up');
      }
    });
    
    socket.on('kicked', (data) => {
      if (data.handle === handleRef.current) {
        toast.error("You have been kicked by the host.");
        leaveRoom();
      }
    });
    
    socket.on('receive_message', (msg) => {
      setMessages(prev => [...prev, msg]);
    });

    socket.on('error', (err) => {
      setIsJoining(false);
      setIsStarting(false);
      toast.error(err.message);
    });

    return () => {
      socket.off('public_rooms_update');
      socket.off('room_state_update');
      socket.off('new_problems');
      socket.off('verification_started');
      socket.off('verification_failed');
      socket.off('problem_solved');
      socket.off('time_up');
      socket.off('kicked');
      socket.off('receive_message');
      socket.off('error');
    };
  }, []);

  useEffect(() => {
    if (gameState === 'playing' && endTime) {
      const interval = setInterval(() => {
        const remaining = Math.max(0, endTime - Date.now());
        setTimeLeft(remaining);
        if (remaining === 0) clearInterval(interval);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [gameState, endTime]);
  
  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const joinRoom = (e) => {
    if(e) e.preventDefault();
    let targetRoomId = roomId;
    let targetRoomName = '';
    
    if (joinTab === 'create') {
        targetRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
        targetRoomName = roomName || `Arena ${targetRoomId}`;
        setRoomId(targetRoomId); // Update local state
    } else {
        if (!roomId) return toast.error("Please enter a room ID.");
    }

    if (handle) {
      localStorage.setItem('arena_handle', handle);
      localStorage.setItem('arena_roomId', targetRoomId);
      if (password) {
        localStorage.setItem('arena_password', password);
      } else {
        localStorage.removeItem('arena_password');
      }
      setIsJoining(true);
      socket.emit('join_room', { roomId: targetRoomId, roomName: targetRoomName, handle, password, isSpectator });
    } else {
      toast.error("Please enter your Codeforces Handle first!");
    }
  };
  
  const joinPublicRoom = (pubRoomId) => {
    if (!handle) {
      toast.error("Please enter a Codeforces handle before joining a public room.");
      return;
    }
    setRoomId(pubRoomId);
    setPassword('');
    localStorage.setItem('arena_handle', handle);
    localStorage.setItem('arena_roomId', pubRoomId);
    localStorage.removeItem('arena_password');
    socket.emit('join_room', { roomId: pubRoomId, handle, password: '', isSpectator: false });
  };

  const leaveRoom = () => {
    localStorage.removeItem('arena_handle');
    localStorage.removeItem('arena_roomId');
    localStorage.removeItem('arena_password');
    socket.emit('leave_room', { roomId, handle });
    setGameState('join');
    setRoomId('');
    setPassword('');
    setRoomData({ host: '', players: [], scoreboard: {}, isPrivate: false });
    setProblems([]);
    setMessages([]);
    setWinnerMessage(null);
  };

  const startGame = () => {
    if (roomData.players.length < 2) {
      toast.error("Minimum 2 players required to start a tournament!");
      return;
    }
    setIsStarting(true);
    socket.emit('start_game', { roomId, minRating, maxRating, timeLimit, numProblems });
  };

  const kickPlayer = (targetHandle) => {
    if (window.confirm(`Are you sure you want to kick ${targetHandle}?`)) {
      socket.emit('kick_player', { roomId, targetHandle });
    }
  };

  const claimSolve = (problemId) => {
    socket.emit('claim_solve', { handle, roomId, problemId });
  };
  
  const sendMessage = (e) => {
    e.preventDefault();
    if (chatInput.trim() !== '') {
      socket.emit('send_message', { roomId, handle, text: chatInput });
      setChatInput('');
    }
  };

  const formatTime = (ms) => {
    if (!ms) return '00:00';
    const totalSeconds = Math.floor(ms / 1000);
    const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const s = (totalSeconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const isHost = handle === roomData.host;
  
  const rankedPlayers = [...roomData.players].sort((a, b) => {
    const scoreA = (roomData.scoreboard[a] || []).length;
    const scoreB = (roomData.scoreboard[b] || []).length;
    return scoreB - scoreA;
  });

  if (isCheckingSession) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white font-bold text-xl"><Loader2 className="animate-spin mr-3"/> Loading...</div>;
  }

  if (recoveryMode) {
    return <UpdatePassword onPasswordUpdated={() => setRecoveryMode(false)} />;
  }

  if (!session) {
    return <Auth onSession={setSession} />;
  }

  if (needsCFLink) {
    return <LinkCodeforces onLinked={(h) => { setHandle(h); setNeedsCFLink(false); checkSavedRoom(h); }} />;
  }

  return (
    <div className="min-h-screen text-slate-100 flex flex-col items-center py-12 px-4 font-sans relative overflow-hidden z-0">
      <LiveBackground />
      <Toaster position="bottom-right" theme="dark" />
      {/* Navigation Header */}
      <div className="max-w-6xl w-full flex flex-col md:flex-row justify-between items-center mb-8 pb-4 border-b border-slate-700 gap-4">
        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-400 cursor-pointer" onClick={() => setActiveTab('arena')}>
          Codeforces Arena
        </h1>
        
        <div className="flex glass-panel rounded-lg p-1">
          <button onClick={() => setActiveTab('arena')} className={`px-4 py-2 rounded-md font-bold transition-all ${activeTab === 'arena' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>Arena</button>
          <button onClick={() => setActiveTab('leaderboard')} className={`px-4 py-2 rounded-md font-bold transition-all ${activeTab === 'leaderboard' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>Leaderboard</button>
          <button onClick={() => setActiveTab('profile')} className={`px-4 py-2 rounded-md font-bold transition-all ${activeTab === 'profile' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>Profile</button>
          <button onClick={handleLogout} className="px-4 py-2 rounded-md font-bold text-red-400 hover:text-red-300 hover:bg-red-900/30 flex items-center transition-all ml-2">
            <LogOut size={16} className="mr-1" /> Logout
          </button>
        </div>

        {gameState !== 'join' && activeTab === 'arena' && (
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-slate-400">
              <Users size={18} />
              <span className="font-semibold">{roomData.roomName || roomId}</span>
              <span className="text-xs text-slate-500 border-l border-slate-700 pl-2 ml-2">ID: {roomId}</span>
              {roomData.isPrivate ? <Lock size={14} className="text-rose-400 ml-1" /> : <Unlock size={14} className="text-emerald-400 ml-1" />}
            </div>
            <button onClick={leaveRoom} className="text-sm bg-red-900/30 text-red-400 hover:bg-red-900/50 hover:text-red-300 px-3 py-1 rounded transition-colors">
              Leave Room
            </button>
          </div>
        )}
      </div>

      {activeTab === 'leaderboard' && <Leaderboard backendUrl={BACKEND_URL} />}
      {activeTab === 'profile' && <Profile backendUrl={BACKEND_URL} handle={handle} />}

      <div className={activeTab === 'arena' ? 'w-full max-w-6xl flex flex-col items-center' : 'hidden'}>
      {/* VIEW: JOIN (SPLIT LAYOUT) */}
      {gameState === 'join' && (
        <div className="max-w-5xl w-full grid grid-cols-1 md:grid-cols-2 gap-8">
          
          <TiltCard className="h-fit">
            <div className="glass-panel p-8 rounded-2xl shadow-xl border border-white/10 h-full relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
              <div className="flex bg-slate-900/40 backdrop-blur-sm rounded-lg p-1 mb-6 relative z-10">
              <button type="button" onClick={() => setJoinTab('create')} className={`flex-1 px-4 py-2 rounded-md font-bold transition-all ${joinTab === 'create' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>Create Room</button>
              <button type="button" onClick={() => setJoinTab('join')} className={`flex-1 px-4 py-2 rounded-md font-bold transition-all ${joinTab === 'join' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>Join Room</button>
            </div>
            
            <form onSubmit={joinRoom} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">{joinTab === 'create' ? 'Room Name' : 'Room ID'}</label>
                {joinTab === 'create' ? (
                  <input type="text" className="w-full bg-slate-900/40 backdrop-blur-sm border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none" value={roomName} onChange={e => setRoomName(e.target.value)} placeholder="Name your new room (optional)..." />
                ) : (
                  <input type="text" required className="w-full bg-slate-900/40 backdrop-blur-sm border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none" value={roomId} onChange={e => setRoomId(e.target.value)} placeholder="Enter room ID..." />
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Room Password (Optional)</label>
                <input type="text" className="w-full bg-slate-900/40 backdrop-blur-sm border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none" value={password} onChange={e => setPassword(e.target.value)} placeholder={joinTab === 'create' ? "Leave blank for public room" : "Enter password if private"} />
              </div>
              {joinTab === 'join' && (
                <div className="flex items-center space-x-2 mt-2">
                  <input type="checkbox" id="spectatorMode" checked={isSpectator} onChange={e => setIsSpectator(e.target.checked)} className="rounded border-slate-700 bg-slate-900/40 backdrop-blur-sm text-blue-500 focus:ring-blue-500 focus:ring-offset-slate-800" />
                  <label htmlFor="spectatorMode" className="text-sm font-medium text-slate-300">Join as Spectator</label>
                </div>
              )}
              <button type="submit" disabled={isJoining} className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors mt-4 shadow-[0_0_20px_rgba(37,99,235,0.4)] hover:shadow-[0_0_30px_rgba(37,99,235,0.6)] relative z-10 flex items-center justify-center">
                {isJoining ? <Loader2 className="animate-spin" size={20} /> : (joinTab === 'create' ? 'Create Arena' : 'Join Arena')}
              </button>
            </form>
            </div>
          </TiltCard>

          <TiltCard className="max-h-[450px]">
            <div className="glass-panel p-8 rounded-2xl shadow-xl border border-white/10 h-full flex flex-col relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
              <h2 className="text-2xl font-semibold mb-6 flex items-center text-emerald-400 relative z-10">
              <Globe className="mr-2" /> Active Public Arenas
            </h2>
            <div className="overflow-y-auto flex-1 pr-2 space-y-3 custom-scrollbar">
              {publicRooms.length === 0 ? (
                <div className="text-slate-500 text-center mt-10">No public arenas active right now.<br/>Create one on the left!</div>
              ) : (
                publicRooms.map((room) => (
                  <div key={room.roomId} className="bg-slate-900/40 backdrop-blur-sm border border-slate-700 rounded-xl p-4 flex justify-between items-center transition-all hover:border-emerald-500/50">
                    <div>
                      <h4 className="font-semibold text-lg text-emerald-400">{room.roomName || room.roomId}</h4>
                      <p className="text-sm text-slate-400 mt-1 flex items-center">
                         <span className="text-blue-300 mr-2">Host: {room.host}</span>
                         <span className="text-slate-500 mr-2 border-l border-slate-700 pl-2">ID: {room.roomId}</span>
                         <Users size={12} className="mr-1" /> {room.playerCount}
                      </p>
                    </div>
                    <button onClick={() => joinPublicRoom(room.roomId)} className="bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white px-4 py-2 rounded-lg transition-colors font-medium">
                      Join
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
          </TiltCard>
        </div>
      )}

      {/* VIEW: LOBBY */}
      {gameState === 'lobby' && (
        <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-4 gap-8">
          
          <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-8 h-fit">
            <TiltCard>
              <div className="glass-panel p-6 rounded-2xl shadow-xl h-full border border-white/10 group relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                <div className="relative z-10">
              <h3 className="text-xl font-semibold mb-4 text-blue-400 flex items-center justify-between">
                Players ({roomData.players.length})
              </h3>
              <ul className="space-y-2 mb-6">
                {roomData.players.map(p => (
                  <li key={p} className="flex items-center justify-between bg-slate-900/40 backdrop-blur-sm p-3 rounded-lg border border-slate-700/50">
                    <span className="font-medium text-slate-200">{p} {p === handle ? '(You)' : ''}</span>
                    <div className="flex items-center gap-2">
                      {isHost && p !== handle && (
                         <button onClick={() => kickPlayer(p)} className="text-xs bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white px-2 py-1 rounded transition-colors">Kick</button>
                      )}
                      {p === roomData.host && <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-1 rounded font-semibold tracking-wide">HOST</span>}
                    </div>
                  </li>
                ))}
              </ul>
              {roomData.spectators && roomData.spectators.length > 0 && (
                <>
                  <h3 className="text-xl font-semibold mb-4 text-purple-400 flex items-center justify-between">
                    Spectators ({roomData.spectators.length})
                  </h3>
                  <ul className="space-y-2">
                    {roomData.spectators.map(p => (
                      <li key={p} className="flex items-center justify-between bg-slate-900/50 p-3 rounded-lg border border-slate-700/30">
                        <span className="font-medium text-slate-400">{p} {p === handle ? '(You)' : ''}</span>
                        {isHost && (
                           <button onClick={() => kickPlayer(p)} className="text-xs bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white px-2 py-1 rounded transition-colors">Kick</button>
                        )}
                      </li>
                    ))}
                  </ul>
                </>
              )}
                </div>
              </div>
            </TiltCard>

            <TiltCard>
              <div className="glass-panel p-6 rounded-2xl shadow-xl h-full border border-white/10 group relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                <div className="relative z-10">
              <h3 className="text-xl font-semibold mb-4 text-indigo-400">Match Settings</h3>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Min Rating</label>
                  <input type="number" disabled={!isHost} value={minRating} onChange={e => setMinRating(parseInt(e.target.value))} className="w-full bg-slate-900/40 backdrop-blur-sm border border-slate-700 rounded px-3 py-2 disabled:opacity-50" />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Max Rating</label>
                  <input type="number" disabled={!isHost} value={maxRating} onChange={e => setMaxRating(parseInt(e.target.value))} className="w-full bg-slate-900/40 backdrop-blur-sm border border-slate-700 rounded px-3 py-2 disabled:opacity-50" />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Time (mins)</label>
                  <input type="number" disabled={!isHost} value={timeLimit} onChange={e => setTimeLimit(parseInt(e.target.value))} className="w-full bg-slate-900/40 backdrop-blur-sm border border-slate-700 rounded px-3 py-2 disabled:opacity-50" />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Problems</label>
                  <input type="number" disabled={!isHost} min="1" max="10" value={numProblems} onChange={e => setNumProblems(parseInt(e.target.value))} className="w-full bg-slate-900/40 backdrop-blur-sm border border-slate-700 rounded px-3 py-2 disabled:opacity-50" />
                </div>
              </div>
              
              <button onClick={startGame} disabled={!isHost || isStarting} className="w-full flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-700 text-white font-semibold py-3 rounded-lg transition-colors shadow-lg">
                {isStarting ? <Loader2 className="animate-spin" size={18} /> : <Play className="mr-2" size={18} />}
                {isStarting ? 'Starting...' : (isHost ? 'Start Match' : 'Waiting for host...')}
                  </button>
                </div>
              </div>
            </TiltCard>
          </div>

          {/* Chat Panel in Lobby */}
          <TiltCard className="h-[500px]">
            <div className="glass-panel rounded-2xl shadow-xl border border-white/10 flex flex-col h-full group relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-teal-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
              <div className="relative z-10 flex flex-col h-full">
             <div className="p-4 border-b border-slate-700 font-semibold text-emerald-400 flex items-center">
               Room Chat
             </div>
             <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                {messages.length === 0 ? (
                  <div className="text-xs text-slate-500 text-center italic mt-4">No messages yet. Say hi!</div>
                ) : (
                  messages.map((m, i) => (
                    <div key={i} className={`flex flex-col ${m.handle === handle ? 'items-end' : 'items-start'}`}>
                       <span className="text-[10px] text-slate-500 mb-1 px-1">{m.handle} • {m.timestamp}</span>
                       <div className={`text-sm px-3 py-2 rounded-xl max-w-[90%] break-words ${m.handle === handle ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-200'}`}>
                         {m.text}
                       </div>
                    </div>
                  ))
                )}
                <div ref={chatEndRef} />
             </div>
             <form onSubmit={sendMessage} className="p-3 border-t border-slate-700 flex bg-slate-900/40 backdrop-blur-sm rounded-b-2xl">
               <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="Type a message..." className="flex-1 bg-transparent border-none outline-none text-sm px-2" />
               <button type="submit" disabled={!chatInput.trim()} className="text-blue-500 disabled:text-slate-600 p-1">
                 <Send size={18} />
               </button>
                </form>
              </div>
            </div>
          </TiltCard>
        </div>
      )}

      {/* VIEW: PLAYING OR FINISHED */}
      {(gameState === 'playing' || gameState === 'finished') && problems.length > 0 && (
        <div className="max-w-7xl w-full flex flex-col lg:flex-row gap-8">
          
          {/* Main Problem Area (Left) */}
          <div className="flex-1">
            {gameState === 'finished' && winnerMessage && (
              <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/50 rounded-xl shadow-lg">
                <h2 className="text-2xl font-bold text-amber-400 flex items-center justify-center">
                  <Trophy className="mr-2" /> Contest Finished!
                </h2>
                <p className="text-slate-300 mt-2 text-center font-medium">{winnerMessage}</p>
              </div>
            )}

            <div className="flex items-center justify-center text-5xl font-mono font-bold text-indigo-400 mb-8 drop-shadow-lg">
              <Clock className="mr-4" size={40} />
              {formatTime(timeLeft)}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {problems.map((problem, idx) => {
                const isSpectatorUser = (roomData.spectators || []).includes(handle);
                const solvedCount = (roomData.scoreboard[handle] || []).length;
                
                // Hide problems that the user hasn't unlocked yet
                if (!isSpectatorUser && idx > solvedCount) return null;

                const isSolvedByMe = (roomData.scoreboard[handle] || []).includes(problem.problemId);
                const isVerifying = verifyingStatus[`${handle}-${problem.problemId}`];
                
                return (
                  <motion.div 
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ delay: idx * 0.15, type: 'spring', stiffness: 200, damping: 20 }}
                    key={problem.problemId} 
                  >
                    <TiltCard>
                      <div className={`glass-panel p-6 rounded-2xl shadow-2xl border ${isSolvedByMe ? 'border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.5)] bg-emerald-900/10' : 'border-white/10 hover:border-blue-500/50 hover:shadow-[0_0_25px_rgba(59,130,246,0.3)]'} flex flex-col transition-colors duration-300 relative overflow-hidden group h-full`}>
                        <div className={`absolute inset-0 bg-gradient-to-br ${isSolvedByMe ? 'from-emerald-500/10 to-teal-500/10' : 'from-blue-500/5 to-purple-500/5'} opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none`} />
                        <div className="relative z-10 flex flex-col h-full">
                          <div className="text-sm font-semibold text-blue-400 tracking-wider mb-2 flex justify-between">
                            <span>PROBLEM</span>
                            <span className="bg-slate-900/40 backdrop-blur-sm px-2 py-0.5 rounded text-slate-300 border border-white/5">{problem.rating} Rating</span>
                          </div>
                          <h2 className="text-2xl font-bold mb-6 flex-1 text-white drop-shadow-md">{problem.problemId} - {problem.name}</h2>
                          
                          <div className="flex flex-col space-y-3">
                            <a href={`https://codeforces.com/problemset/problem/${problem.problemId.split('-')[0]}/${problem.problemId.split('-')[1]}`} target="_blank" rel="noreferrer" className="w-full flex items-center justify-center bg-slate-700 hover:bg-slate-600 text-white font-semibold py-3 rounded-xl transition-colors shadow">
                              <ExternalLink className="mr-2" size={18} /> Codeforces
                            </a>
                            
                            {gameState === 'playing' && !isSolvedByMe && !isSpectatorUser && (
                              <button onClick={() => claimSolve(problem.problemId)} disabled={isVerifying} className="w-full flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-900 text-white font-semibold py-3 rounded-xl transition-colors shadow">
                                {isVerifying ? <><Loader2 className="mr-2 animate-spin" size={18} /> Verifying...</> : 'Verify Solve'}
                              </button>
                            )}

                            {isSolvedByMe && (
                              <div className="w-full flex items-center justify-center bg-emerald-900/40 text-emerald-400 font-semibold py-3 rounded-xl border border-emerald-800">
                                <CheckCircle className="mr-2" size={18} /> Solved
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </TiltCard>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Right Side Column (Scoreboard + Chat) */}
          <div className="w-full lg:w-80 flex flex-col space-y-6 shrink-0">
            
            {/* Scoreboard */}
            <div className="glass-panel p-5 rounded-2xl shadow-xl border border-slate-700 h-fit">
              <h3 className="text-lg font-semibold mb-3 border-b border-slate-700 pb-2 text-indigo-300">Scoreboard</h3>
              <ul className="space-y-2">
                <AnimatePresence>
                  {rankedPlayers.map((p, index) => {
                    const score = (roomData.scoreboard[p] || []).length;
                    return (
                      <motion.li 
                        key={p} 
                        layout
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                        className={`flex items-center justify-between p-2 rounded-lg ${p === handle ? 'bg-indigo-900/40 border border-indigo-500/50' : 'bg-slate-900/40 backdrop-blur-sm border border-transparent'}`}
                      >
                        <div className="flex items-center">
                          <span className="text-slate-500 font-mono w-4 mr-2 text-sm">{index + 1}.</span>
                          <span className="font-medium text-sm truncate max-w-[100px]">{p}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <span className="text-emerald-400 font-bold">{score}</span>
                          <span className="text-slate-400 text-[10px] uppercase">pts</span>
                        </div>
                      </motion.li>
                    );
                  })}
                </AnimatePresence>
              </ul>
              
              {roomData.spectators && roomData.spectators.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-700">
                  <h3 className="text-xs font-semibold mb-2 text-slate-400 uppercase tracking-wider">Spectators</h3>
                  <div className="flex flex-wrap gap-2">
                    {roomData.spectators.map(s => (
                       <span key={s} className="text-xs bg-slate-900/40 backdrop-blur-sm text-slate-400 px-2 py-1 rounded">{s}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Chat Panel in Game */}
            <div className="glass-panel rounded-2xl shadow-xl border border-slate-700 flex flex-col flex-1 min-h-[400px]">
               <div className="p-3 border-b border-slate-700 font-semibold text-emerald-400 text-sm flex items-center">
                 Room Chat
               </div>
               <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
                  {messages.length === 0 ? (
                    <div className="text-xs text-slate-500 text-center italic mt-4">No messages yet. Say hi!</div>
                  ) : (
                    messages.map((m, i) => (
                      <div key={i} className={`flex flex-col ${m.handle === handle ? 'items-end' : 'items-start'}`}>
                         <span className="text-[9px] text-slate-500 mb-1 px-1">{m.handle} • {m.timestamp}</span>
                         <div className={`text-xs px-3 py-2 rounded-xl max-w-[90%] break-words ${m.handle === handle ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-200'}`}>
                           {m.text}
                         </div>
                      </div>
                    ))
                  )}
                  <div ref={chatEndRef} />
               </div>
               <form onSubmit={sendMessage} className="p-2 border-t border-slate-700 flex bg-slate-900/40 backdrop-blur-sm rounded-b-2xl">
                 <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="Type a message..." className="flex-1 bg-transparent border-none outline-none text-xs px-2" />
                 <button type="submit" disabled={!chatInput.trim()} className="text-blue-500 disabled:text-slate-600 p-1">
                   <Send size={16} />
                 </button>
               </form>
            </div>

          </div>
        </div>
      )}

      </div>

      <AnimatePresence>
        {gameState === 'countdown' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md"
          >
            <h2 className="text-3xl font-bold text-emerald-400 mb-8 tracking-[0.2em] uppercase glow-text">Match Starting</h2>
            <motion.div
              key={countdownValue}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1.5, opacity: 1 }}
              exit={{ scale: 2, opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="text-[12rem] font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400 drop-shadow-[0_0_30px_rgba(52,211,153,0.8)]"
            >
              {countdownValue}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <Analytics />
    </div>
  );
}

export default App;
