const { io } = require('socket.io-client');

const socket = io('http://localhost:3000');

socket.on('connect', () => {
    console.log('[Test] Connected to server.');
    socket.emit('join_room', { roomId: 'chat-test', handle: 'TestBot' });
    
    setTimeout(() => {
        console.log('[Test] Emitting send_message...');
        socket.emit('send_message', { roomId: 'chat-test', handle: 'TestBot', text: 'Hello world' });
    }, 1000);
});

socket.on('receive_message', (msg) => {
    console.log('[Test] Received message:', msg);
    process.exit(0);
});

setTimeout(() => {
    console.error('[Test] Timeout! Did not receive message.');
    process.exit(1);
}, 3000);
