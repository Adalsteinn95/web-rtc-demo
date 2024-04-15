const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(cors());

const server = http.createServer(app);

// WebSocket Server for general purposes
const wssGeneral = new WebSocket.Server({ noServer: true });
const wssWebRTC = new WebSocket.Server({ noServer: true });

app.get('/websocket', (req, res) => {
	res.send('WebSocket route');
});

app.get('/webrtc', (req, res) => {
	res.send('WebRTC signaling route');
});

server.on('upgrade', (request, socket, head) => {
	const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;

	if (pathname.startsWith('/websocket')) {
		wssGeneral.handleUpgrade(request, socket, head, (ws) => {
			wssGeneral.emit('connection', ws, request);
		});
	} else if (pathname.startsWith('/webrtc')) {
		wssWebRTC.handleUpgrade(request, socket, head, (ws) => {
			wssWebRTC.emit('connection', ws, request);
		});
	} else {
		socket.destroy();
	}
});

// Handling WebSocket connections
wssGeneral.on('connection', function connection(ws) {
	console.log('Connected to WebSocket general route');
	// WebSocket general communication logic here
	assignUniqueId(ws);
	notifyClientOfId(ws, wssGeneral);
	setupMessageAndCloseHandlers(ws, wssGeneral);
});

// Handling WebRTC Signaling connections
wssWebRTC.on('connection', function connection(ws) {
	console.log('Connected to WebRTC signaling route');
	// WebRTC signaling logic here
	assignUniqueId(ws);
	notifyClientOfId(ws, wssWebRTC);
	setupMessageAndCloseHandlers(ws, wssWebRTC);
});

function assignUniqueId(ws) {
	ws.id = uuidv4();
	console.log(`Assigned ID: ${ws.id} to the connection`);
}

function notifyClientOfId(ws, wss) {
	const clientData = { type: 'id', id: ws.id, clients: getClientIds(wss, ws.id) };
	ws.send(JSON.stringify(clientData));
}

function getClientIds(wss, id) {
	const clients = [];
	wss.clients.forEach((client) => {
		if (client.id !== id) {
			clients.push(client.id);
		}
	});
	return clients;
}

function setupMessageAndCloseHandlers(ws, wss) {
	ws.on('message', (message) => processClientMessage(ws, wss, message));
	ws.on('close', () => handleDisconnection(ws, wss));
}

function processClientMessage(ws, wss, message) {
	if (wss === wssGeneral) {
		console.info('Received:', message);
		broadcastBinaryMessage(wss, message);
	} else if (wss === wssWebRTC) {
		console.info('Received:', message);
		const data = JSON.parse(message);
		handleClientAction(ws, wss, data);
	}
}

function broadcastBinaryMessage(wss, message) {
	console.info('Broadcasting binary message');
	wss.clients.forEach((client) => client.send(message));
}

function handleClientAction(ws, wss, data) {
	switch (data.type) {
		case 'getClients':
			sendClientList(ws);
			break;
		case 'all':
			broadcastAll(data);
			break;
		default:
			sendMessageToOneUser(ws, wss, data);
			break;
	}
}

function handleDisconnection(ws, wss) {
	console.log('User disconnected:', ws.id);
	//broadcastDisconnection(wss, ws.id);
}

function sendClientList(ws) {
	const clients = getClientIds(ws.id);
	console.log(`Sending client list to ${ws.id}`);
	ws.send(JSON.stringify({ type: 'clientList', clients }));
}

function broadcastNewConnection(newClientId) {
	const message = { type: 'newConnection', id: newClientId };
	broadcastToAllExcept(newClientId, message);
}

function broadcastDisconnection(disconnectedClientId, wss) {
	const message = { type: 'disconnection', id: disconnectedClientId };
	broadcastToAll(wss, message);
}

function broadcastToAllExcept(wss, excludeId, message) {
	wss.clients.forEach((client) => {
		if (client.readyState === WebSocket.OPEN && client.id !== excludeId) {
			client.send(JSON.stringify(message));
		}
	});
}

function broadcastToAll(wss, message) {
	wss.clients.forEach((client) => {
		if (client.readyState === WebSocket.OPEN) {
			client.send(JSON.stringify(message));
		}
	});
}

function broadcastAll(wss, data) {
	const message = JSON.stringify(data);
	wss.clients.forEach((client) => client.send(message));
}

function sendMessageToOneUser(senderWs, wss, data) {
	const targetClient = Array.from(wss.clients).find(
		(client) => client.id === data.target && client.readyState === WebSocket.OPEN
	);
	if (targetClient) {
		console.log(`Sending message from ${senderWs.id} to ${data.target}`);
		targetClient.send(JSON.stringify({ ...data, sender: senderWs.id }));
	}
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
