const { io } = require('socket.io-client');

const socket = io('http://localhost:3000');
const ROOM_ID = 'PPZ3P8';
const HANDLE = 'AntigravityBot';

socket.on('connect', () => {
    console.log(`[Bot] Connected. Joining room ${ROOM_ID} as ${HANDLE}...`);
    socket.emit('join_room', { roomId: ROOM_ID, handle: HANDLE });
});

socket.on('room_state_update', (data) => {
    console.log('[Bot] Room state updated:', data);
});

socket.on('match_starting', (data) => {
    console.log(`[Bot] Match starting in ${data.countdown} seconds!`);
});

socket.on('new_problems', (data) => {
    console.log(`[Bot] Match started! Problems:`, data.problems);
    console.log(`[Bot] Good luck, I'm watching you!`);
});

socket.on('time_up', (data) => {
    console.log(`[Bot] Time is up! ${data.message}`);
});

socket.on('disconnect', () => {
    console.log('[Bot] Disconnected from server.');
});

// Send a chat message after a short delay
setTimeout(() => {
    socket.emit('send_message', { roomId: ROOM_ID, handle: HANDLE, text: "Hello! I am your AI opponent today! GLHF! Start the match when you are ready!" });
}, 2000);
