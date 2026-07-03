const { io } = require('socket.io-client');

const socket1 = io('http://localhost:3000');
const socket2 = io('http://localhost:3000');

socket1.on('connect', () => {
    console.log('[Socket 1] Connected. Joining room 1234 as PlayerA...');
    socket1.emit('join_room', { roomId: '1234', handle: 'PlayerA' });
});

socket2.on('connect', () => {
    console.log('[Socket 2] Connected. Joining room 1234 as PlayerB...');
    setTimeout(() => {
        socket2.emit('join_room', { roomId: '1234', handle: 'PlayerB' });
    }, 1000);
});

socket1.on('room_state_update', (data) => {
    console.log('[Socket 1] Room Update Received:', data.players);
});

socket2.on('room_state_update', (data) => {
    console.log('[Socket 2] Room Update Received:', data.players);
    if (data.players.length === 2) {
        console.log('✅ MULTIPLAYER TEST PASSED: Both players successfully joined and see each other!');
        process.exit(0);
    }
});
