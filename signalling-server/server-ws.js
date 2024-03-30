const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);

// Create a WebSocket server instance
const wss = new WebSocket.Server({ server });

// Enhanced connection handling to support one-to-one and broadcast messaging
wss.on('connection', (ws) => {
	console.log('A user connected');

	// Assign a unique ID to each connection
	const userId = Date.now();
	ws.id = userId;

	// Send the user their ID and client list
	const clientIds = Array.from(wss.clients)
		.filter((client) => client.readyState === WebSocket.OPEN)
		.map((client) => client.id);

	console.log(`clientIds: ${clientIds}`);
	ws.send(JSON.stringify({ type: 'id', id: ws.id, clients: clientIds }));
	ws.on('message', (message) => {
		console.log(`Received message from ${ws.id}`);
		const data = JSON.parse(message);

		console.log(data);

		if (data.type === 'getClients') {
			// Return all connected client IDs
			console.log(`Sending client list to ${ws.id}`);
			const clientIds = Array.from(wss.clients)
				.filter((client) => client.readyState === WebSocket.OPEN)
				.map((client) => client.id);
			ws.send(JSON.stringify({ type: 'clientList', clients: clientIds }));
		} else if (data.target === 'all') {
			// Broadcast message to all clients except the sender
			console.log(`Broadcasting message from ${ws.id}`);
			broadcast(ws, data);
		} else if (data.target) {
			// One-to-one messaging
			console.log(`Sending message from ${ws.id} to ${data.target}`);
			sendMessageToOneUser(ws, data, data.target);
		}
	});

	ws.on('close', () => {
		console.log('User disconnected:', ws.id);
		// Optionally notify other users about the disconnection
	});
});

function broadcast(senderWs, data) {
	wss.clients.forEach((client) => {
		if (client !== senderWs && client.readyState === WebSocket.OPEN) {
			client.send(JSON.stringify(data));
		}
	});
}

function sendMessageToOneUser(senderWs, data, targetId) {
	wss.clients.forEach((client) => {
		if (client.id == targetId && client.readyState === WebSocket.OPEN) {
			client.send(JSON.stringify(data));
		}
	});
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
