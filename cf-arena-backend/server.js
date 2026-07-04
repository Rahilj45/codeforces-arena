const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');
const { getUniqueRoomProblems } = require('./utils/problemSelector');
const { Queue, Worker, QueueEvents } = require('bullmq');
const IORedis = require('ioredis');

const app = express();
app.use(express.json());
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// --- TEMPORARY AUTO-SEEDER ---
setTimeout(async () => {
    try {
        console.log("Fetching top Codeforces users for Global Leaderboard...");
        const res = await fetch('https://codeforces.com/api/user.ratedList?activeOnly=true');
        const data = await res.json();
        
        if (data.status === 'OK') {
            const topUsers = data.result.slice(0, 49);
            console.log(`Seeding ${topUsers.length} dummy users into Supabase...`);
            
            const records = topUsers.map((u, i) => ({
                cf_handle: u.handle,
                arena_rating: 2000 + (50 - i) * 10,
                wins: Math.floor(Math.random() * 50) + 10,
                losses: Math.floor(Math.random() * 20),
                last_synced: new Date().toISOString()
            }));

            const { error } = await supabase.from('users').upsert(records, { onConflict: 'cf_handle' });
            if (error) console.error("Error seeding:", error);
            else console.log("Successfully seeded database with global Codeforces users!");
        }
    } catch(e) {
        console.error("Auto-seed failed:", e);
    }
}, 5000);
// -----------------------------

const rawRedisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
let redisUrl = rawRedisUrl.replace(/^["']|["']$/g, '').trim();

// Strip accidental 'REDIS_URL=' prefix if user pasted the entire key=value into the value field
redisUrl = redisUrl.replace(/^REDIS_URL=/i, '');

// Fix double/triple slashes in protocol because of bad copy-paste (e.g. redis:////default...)
redisUrl = redisUrl.replace(/^(rediss?:\/\/)\/+(.*)/i, '$1$2');

if (redisUrl.startsWith('//')) {
    redisUrl = 'rediss:' + redisUrl;
}

const redisOptions = { maxRetriesPerRequest: null };

if (redisUrl.includes('upstash.io')) {
    // Upstash requires TLS, so ensure the protocol is rediss://
    redisUrl = redisUrl.replace(/^redis:\/\//i, 'rediss://');
    if (!redisUrl.startsWith('rediss://')) {
        redisUrl = 'rediss://' + redisUrl.replace(/^(?:rediss?:\/\/)?/, '');
    }
    redisOptions.tls = { rejectUnauthorized: false };
} else if (redisUrl.startsWith('rediss://')) {
    redisOptions.tls = { rejectUnauthorized: false };
}

const createRedisConnection = () => new IORedis(redisUrl, redisOptions);

const verificationQueue = new Queue('cf-verification', {
    connection: createRedisConnection(),
    defaultJobOptions: { attempts: 5, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: true, removeOnFail: 100 }
});

const verificationWorker = new Worker('cf-verification', async (job) => {
    const { handle, problemId, roomId } = job.data;
    console.log(`[Worker] Verifying submission for ${handle} on ${problemId}...`);

    const [contestIdStr, index] = problemId.split('-');
    const targetContestId = parseInt(contestIdStr, 10);

    let data;
    try {
        const response = await fetch(`https://codeforces.com/api/user.status?handle=${handle}&from=1&count=10`);
        if (!response.ok && response.status !== 400) {
            throw new Error(`HTTP Error: ${response.status}`);
        }
        data = await response.json();
    } catch (e) {
        throw new Error(`Fetch failed, will retry: ${e.message}`);
    }

    if (data.status !== 'OK') {
        // Return instantly instead of throwing, so it doesn't get stuck in a 5-attempt retry loop
        return { success: false, reason: data.comment || 'API Error', handle, roomId, problemId };
    }

    const submissions = data.result || [];
    let solved = false;
    let submitTime = null;
    let isTesting = false;

    for (const sub of submissions) {
        if (sub.problem && sub.problem.contestId === targetContestId && sub.problem.index === index) {
            if (sub.verdict === 'OK') {
                solved = true;
                submitTime = sub.creationTimeSeconds;
                break;
            } else if (sub.verdict === 'TESTING' || sub.verdict === 'WAITING' || sub.verdict === null) {
                isTesting = true;
            }
        }
    }

    if (solved) {
        return { success: true, timestamp: submitTime, handle, roomId, problemId };
    } else if (isTesting) {
        throw new Error(`Submission is currently in state TESTING. Will retry...`);
    } else {
        return { success: false, reason: `No 'OK' verdict found for ${problemId}.`, handle, roomId, problemId };
    }

}, { connection: createRedisConnection(), concurrency: 1, limiter: { max: 1, duration: 1500 } });


const queueEvents = new QueueEvents('cf-verification', { connection: createRedisConnection() });

queueEvents.on('completed', ({ jobId, returnvalue }) => {
    let result = returnvalue;
    if (typeof result === 'string') {
        try { result = JSON.parse(result); } catch(e) {}
    }

    if (result && result.success) {
        const { handle, roomId, problemId, timestamp } = result;
        const room = activeRooms[roomId];
        
        if (room) {
            if (!room.scoreboard[handle]) room.scoreboard[handle] = [];
            
            // Check if anyone has already solved this problem (Lockout logic)
            let alreadySolved = false;
            for (const p of room.players) {
                if ((room.scoreboard[p] || []).includes(problemId)) {
                    alreadySolved = true;
                    break;
                }
            }

            if (!alreadySolved && !room.scoreboard[handle].includes(problemId)) {
                room.scoreboard[handle].push(problemId);

                // Reset global timer for the room
                if (room.timeLimit) {
                    if (room.timer) clearTimeout(room.timer);
                    const durationMs = room.timeLimit * 60 * 1000;
                    room.endTime = Date.now() + durationMs;
                    room.timer = setTimeout(() => {
                        handleTimeUp(room, roomId);
                    }, durationMs);
                }
                
                io.to(roomId).emit('problem_solved', { handle, problemId, timestamp, scoreboard: room.scoreboard, newEndTime: room.endTime });
            } else if (alreadySolved && !room.scoreboard[handle].includes(problemId)) {
                // If already solved by someone else, notify this user that they were too late
                io.to(roomId).emit('verification_failed', { handle, problemId, reason: 'Too late! An opponent already solved this problem.' });
            }
            
            if (room.activeProblems && room.scoreboard[handle].length === room.activeProblems.length) {
                if (room.timer) clearTimeout(room.timer);
                io.to(roomId).emit('time_up', { message: `${handle} solved all problems and won the contest!` });
                processMatchResult(room, handle);
                room.activeProblems = null;
            }
        }
    } else if (result && result.success === false) {
        const { handle, roomId, problemId, reason } = result;
        io.to(roomId).emit('verification_failed', { handle, problemId, reason });
    }
});



queueEvents.on('failed', async ({ jobId, failedReason }) => {
    const job = await verificationQueue.getJob(jobId);
    if (job) {
        const { handle, roomId, problemId } = job.data;
        io.to(roomId).emit('verification_failed', { handle, problemId, reason: failedReason });
    }
});

app.post('/api/user/sync', async (req, res) => {
    const { cf_handle } = req.body;
    if (!cf_handle) return res.status(400).json({ error: 'cf_handle is required' });
    try {
        const response = await fetch(`https://codeforces.com/api/user.status?handle=${cf_handle}`);
        const data = await response.json();
        if (data.status === 'FAILED') return res.status(400).json({ error: data.comment });
        if (!response.ok) return res.status(response.status).json({ error: 'API Error' });

        const solvedSet = new Set();
        (data.result || []).forEach(sub => {
            if (sub.verdict === 'OK' && sub.problem?.contestId) {
                solvedSet.add(`${sub.problem.contestId}-${sub.problem.index}`);
            }
        });
        const solvedArray = Array.from(solvedSet);

        const { data: userData, error } = await supabase.from('users').upsert({ cf_handle, solved_problems: solvedArray, last_synced: new Date().toISOString() }, { onConflict: 'cf_handle' }).select();
        if (error) return res.status(500).json({ error: 'DB Error' });
        res.json({ message: 'Synced', user: userData[0], solved_count: solvedArray.length });
    } catch (e) {
        res.status(500).json({ error: 'Internal Error' });
    }
});

const activeRooms = {}; 

function handleTimeUp(room, roomId) {
    let winner = null;
    let maxSolves = -1;
    let tie = false;

    for (const [p, solves] of Object.entries(room.scoreboard)) {
        if (solves.length > maxSolves) {
            maxSolves = solves.length;
            winner = p;
            tie = false;
        } else if (solves.length === maxSolves) {
            tie = true;
        }
    }

    if (maxSolves > 0 && !tie && winner) {
        io.to(roomId).emit('time_up', { message: `Time is up! ${winner} wins with ${maxSolves} solves!` });
        processMatchResult(room, winner);
    } else {
        io.to(roomId).emit('time_up', { message: 'Time is up! Match ended in a draw.' });
    }
    room.activeProblems = null;
}

async function processMatchResult(room, winnerHandle) {
    if (room.players.length < 2) return; // No ELO for solo practice

    const losers = room.players.filter(p => p !== winnerHandle);
    const totalProblems = room.activeProblems ? room.activeProblems.length : 0;

    try {
        await supabase.from('match_history').insert({
            winner_handle: winnerHandle,
            loser_handles: losers,
            total_problems: totalProblems
        });

        const { data: users } = await supabase.from('users')
            .select('cf_handle, arena_rating, wins, losses')
            .in('cf_handle', room.players);
        
        if (!users) return;

        for (const u of users) {
            if (u.cf_handle === winnerHandle) {
                await supabase.from('users').update({
                    arena_rating: (u.arena_rating || 800) + 20,
                    wins: (u.wins || 0) + 1
                }).eq('cf_handle', u.cf_handle);
            } else {
                await supabase.from('users').update({
                    arena_rating: Math.max(0, (u.arena_rating || 800) - 10),
                    losses: (u.losses || 0) + 1
                }).eq('cf_handle', u.cf_handle);
            }
        }
    } catch (e) {
        console.error("Error processing match result:", e);
    }
}

app.get('/api/leaderboard', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('cf_handle, arena_rating, wins, losses')
            .order('arena_rating', { ascending: false })
            .limit(50);
        if (error) throw error;
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/profile/:handle', async (req, res) => {
    try {
        const { handle } = req.params;
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('cf_handle, arena_rating, wins, losses')
            .eq('cf_handle', handle)
            .single();
            
        if (userError) throw userError;

        const { data: history, error: historyError } = await supabase
            .from('match_history')
            .select('*')
            .or(`winner_handle.eq.${handle},loser_handles.cs.{${handle}}`)
            .order('created_at', { ascending: false })
            .limit(20);

        if (historyError) throw historyError;

        let cfRating = null;
        try {
            const cfRes = await fetch(`https://codeforces.com/api/user.info?handles=${handle}`);
            const cfData = await cfRes.json();
            if (cfData.status === 'OK' && cfData.result && cfData.result.length > 0) {
                cfRating = cfData.result[0].rating || 'Unrated';
            }
        } catch(e) {}

        res.json({ user, history, cfRating });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

const getPublicRooms = () => {
    return Object.keys(activeRooms)
        .filter(roomId => !activeRooms[roomId].isPrivate)
        .map(roomId => ({
            roomId,
            roomName: activeRooms[roomId].roomName || roomId,
            host: activeRooms[roomId].host,
            playerCount: activeRooms[roomId].players.length
        }));
};

const broadcastPublicRooms = () => {
    io.emit('public_rooms_update', getPublicRooms());
};

io.on('connection', (socket) => {
    
    // Immediately send public rooms list to the newly connected user
    socket.emit('public_rooms_update', getPublicRooms());

    socket.on('join_room', ({ roomId, roomName, handle, password, isSpectator }) => {
        if (!roomId || !handle) return;

        if (activeRooms[roomId]) {
            if (activeRooms[roomId].isPrivate && activeRooms[roomId].password !== password) {
                socket.emit('error', { message: 'Incorrect password for this private room.' });
                return;
            }
        } else {
            activeRooms[roomId] = { 
                roomName: roomName || roomId,
                host: handle, 
                players: [], 
                spectators: [],
                timer: null, 
                activeProblems: null, 
                scoreboard: {},
                isPrivate: !!password,
                password: password || null
            };
        }

        socket.join(roomId);
        socket.handle = handle; 
        socket.roomId = roomId;

        if (isSpectator) {
            if (!activeRooms[roomId].spectators.includes(handle)) {
                activeRooms[roomId].spectators.push(handle);
            }
            activeRooms[roomId].players = activeRooms[roomId].players.filter(p => p !== handle);
        } else {
            if (!activeRooms[roomId].players.includes(handle)) {
                activeRooms[roomId].players.push(handle);
            }
            activeRooms[roomId].spectators = activeRooms[roomId].spectators.filter(p => p !== handle);
        }

        if (!activeRooms[roomId].scoreboard[handle]) {
            activeRooms[roomId].scoreboard[handle] = [];
        }

        io.to(roomId).emit('room_state_update', { 
            roomId, 
            roomName: activeRooms[roomId].roomName || roomId,
            host: activeRooms[roomId].host, 
            players: activeRooms[roomId].players, 
            spectators: activeRooms[roomId].spectators,
            scoreboard: activeRooms[roomId].scoreboard, 
            isPrivate: activeRooms[roomId].isPrivate 
        });
        
        if (activeRooms[roomId].activeProblems) {
            socket.emit('new_problems', { problems: activeRooms[roomId].activeProblems, endTime: activeRooms[roomId].endTime });
        }
        
        broadcastPublicRooms();
    });

    socket.on('start_game', async ({ roomId, minRating, maxRating, timeLimit, numProblems }) => {
        const room = activeRooms[roomId];
        if (!room || room.host !== socket.handle) return;
        if (room.isStarting) return; // Prevent multiple simultaneous starts
        if (room.players.length < 2) {
            return io.to(roomId).emit('error', { message: 'You need at least 2 players to start a tournament!' });
        }
        
        room.isStarting = true;
        try {
            const num = parseInt(numProblems) || 1;
            const problems = await getUniqueRoomProblems(room.players, minRating, maxRating, num);
            const durationMs = timeLimit * 60 * 1000;
            const endTime = Date.now() + durationMs;
            
            const activeProblems = problems.map(p => ({
                problemId: p.problem_id, name: p.name, rating: p.rating
            }));
            
            io.to(roomId).emit('match_starting', { countdown: 3 });

            setTimeout(() => {
                room.isStarting = false;
                room.activeProblems = activeProblems;
                room.endTime = endTime;
                room.timeLimit = timeLimit;
                
                room.players.forEach(p => room.scoreboard[p] = []);

                io.to(roomId).emit('new_problems', { problems: activeProblems, endTime });

                if (room.timer) clearTimeout(room.timer); 
                room.timer = setTimeout(() => {
                    handleTimeUp(room, roomId);
                }, durationMs);
            }, 3000);
        } catch (error) {
            room.isStarting = false;
            io.to(roomId).emit('error', { message: error.message });
        }
    });

    socket.on('kick_player', ({ roomId, targetHandle }) => {
        const room = activeRooms[roomId];
        if (room && room.host === socket.handle && room.host !== targetHandle) {
            room.players = room.players.filter(p => p !== targetHandle);
            room.spectators = room.spectators.filter(p => p !== targetHandle);
            io.to(roomId).emit('kicked', { handle: targetHandle });
            io.to(roomId).emit('room_state_update', { 
                roomId, 
                host: room.host, 
                players: room.players, 
                spectators: room.spectators,
                scoreboard: room.scoreboard, 
                isPrivate: room.isPrivate 
            });
        }
    });

    socket.on('claim_solve', async ({ handle, roomId, problemId }) => {
        if (!handle || !roomId || !problemId) return;
        io.to(roomId).emit('verification_started', { handle, problemId });
        try {
            await verificationQueue.add('verify-solve', { handle, roomId, problemId }, { jobId: `${handle}-${problemId}-${Date.now()}` });
        } catch (error) {
            io.to(roomId).emit('verification_failed', { handle, problemId, reason: 'Redis queue error.' });
        }
    });

    // Chat event
    socket.on('send_message', ({ roomId, handle, text }) => {
        if (!roomId || !handle || !text) return;
        io.to(roomId).emit('receive_message', { 
            handle, 
            text, 
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
    });

    const handleLeave = () => {
        const { roomId, handle } = socket;
        if (!roomId || !handle) return;
        socket.leave(roomId);
        const room = activeRooms[roomId];
        if (room) {
            room.players = room.players.filter(p => p !== handle);
            room.spectators = room.spectators.filter(p => p !== handle);
            if (room.players.length === 0 && room.spectators.length === 0) {
                if (room.timer) clearTimeout(room.timer);
                delete activeRooms[roomId];
            } else {
                if (room.host === handle && room.players.length > 0) {
                    room.host = room.players[0]; 
                }
                io.to(roomId).emit('room_state_update', { 
                    roomId, 
                    host: room.host, 
                    players: room.players, 
                    spectators: room.spectators,
                    scoreboard: room.scoreboard, 
                    isPrivate: room.isPrivate 
                });
            }
        }
        broadcastPublicRooms();
    };

    socket.on('leave_room', () => {
        handleLeave();
        socket.handle = null;
        socket.roomId = null;
    });

    socket.on('disconnect', () => {
        handleLeave();
    });
});

const verificationTokens = {};

app.post('/api/verify-handle-start', (req, res) => {
    const { handle } = req.body;
    if (!handle) return res.status(400).json({ error: "Handle required" });
    
    const token = 'arena_' + Math.random().toString(36).substring(2, 8).toLowerCase();
    verificationTokens[handle] = token;
    
    res.json({ handle, token });
});

app.post('/api/verify-handle-check', async (req, res) => {
    const { handle } = req.body;
    if (!handle) return res.status(400).json({ error: "Handle required" });
    
    const token = verificationTokens[handle];
    if (!token) return res.status(400).json({ error: "No verification started for this handle" });

    try {
        const response = await fetch(`https://codeforces.com/api/user.info?handles=${handle}`);
        if (!response.ok) {
            return res.status(400).json({ error: "Codeforces API error. Make sure the handle exists." });
        }
        const data = await response.json();
        
        if (data.status === 'OK' && data.result && data.result.length > 0) {
            const user = data.result[0];
            const firstName = user.firstName || "";
            const lastName = user.lastName || "";
            
            if (firstName.includes(token) || lastName.includes(token)) {
                // Ensure no other user has this handle
                try {
                    let page = 1;
                    let hasMore = true;
                    while (hasMore) {
                        const { data: { users }, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
                        if (error) throw error;
                        if (!users || users.length === 0) {
                            hasMore = false;
                        } else {
                            for (const u of users) {
                                if (u.user_metadata?.cf_handle && u.user_metadata.cf_handle.toLowerCase() === handle.toLowerCase()) {
                                    return res.json({ success: false, error: "This Codeforces handle is already linked to another account." });
                                }
                            }
                            if (users.length < 100) hasMore = false;
                            page++;
                        }
                    }
                } catch (dbError) {
                    console.error("DB Error checking users:", dbError);
                    // allow pass-through if DB fetch fails just in case, or fail? Let's fail secure.
                    return res.status(500).json({ error: "Failed to check handle uniqueness. Please try again." });
                }

                delete verificationTokens[handle];
                return res.json({ success: true });
            } else {
                return res.json({ success: false, error: "Verification token not found in Codeforces First/Last Name." });
            }
        }
        res.status(400).json({ error: "Invalid response from Codeforces" });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

server.listen(process.env.PORT || 3000, () => console.log('Backend running'));
