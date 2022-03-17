// create web socket client, connect to localhost:9090 and send a message
import WebSocket from 'ws';
const ws = new WebSocket('wss://localhost:4040');


ws.on('open', () => {
    ws.send('Hello World from client!');
});

ws.on('message', (message) => {
    console.log('received: %s', message);
});