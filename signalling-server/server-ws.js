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

function handleWebSocketConnection(wss) {
	wss.on('connection', function connection(ws) {
		assignUniqueId(ws);
		notifyClientOfId(ws, wss);
		setupMessageAndCloseHandlers(ws, wss);
	});
}

// Handling WebSocket connections for wssGeneral
handleWebSocketConnection(wssGeneral);

// Handling WebSocket connections for wssWebRTC
handleWebSocketConnection(wssWebRTC);

function assignUniqueId(ws) {
	ws.id = uuidv4();
	console.log(`Assigned ID: ${ws.id} to the connection`);
}

// Function to convert the first 16 bytes of a buffer into a UUID string
function bytesToUUID(buffer) {
	const hexParts = [];
	for (let i = 0; i < 16; i++) {
		const hex = buffer[i].toString(16).padStart(2, '0');
		hexParts.push(hex);
	}
	return [
		hexParts.slice(0, 4).join(''),
		hexParts.slice(4, 6).join(''),
		hexParts.slice(6, 8).join(''),
		hexParts.slice(8, 10).join(''),
		hexParts.slice(10, 16).join('')
	].join('-');
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
		sendBinaryMessagetoTarget(ws, wss, message);
	} else if (wss === wssWebRTC) {
		const data = JSON.parse(message);
		handleClientAction(ws, wss, data);
	}
}

function sendBinaryMessagetoTarget(ws, wss, data) {
	const uuidBuffer = data.slice(0, 16);
	const targetId = bytesToUUID(uuidBuffer);
	const dataBuffer = data.slice(16);

	const targetClient = Array.from(wss.clients).find(
		(client) => client.id === targetId && client.readyState === WebSocket.OPEN
	);

	if (targetClient) {
		targetClient.send(dataBuffer);
	}
}

function handleDisconnection(ws, wss) {
	console.log(`Disconnected: ${ws.id}`);
	broadcastDisconnection(ws.id, wss);
}

function handleClientAction(ws, wss, data) {
	switch (data.type) {
		case 'getClients':
			sendClientList(ws, wss);
			break;
		case 'newConnection':
			broadcastNewConnection(ws.id);
			break;
		case 'disconnect':
			broadcastDisconnection(ws.id, wss);
			break;
		default:
			sendMessageToOneUser(ws, wss, data);
			break;
	}
}

function sendClientList(ws, wss) {
	const clients = getClientIds(wss, ws.id);
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

function sendMessageToOneUser(senderWs, wss, data) {
	const targetClient = Array.from(wss.clients).find(
		(client) => client.id === data.target && client.readyState === WebSocket.OPEN
	);
	if (targetClient) {
		targetClient.send(JSON.stringify({ ...data, sender: senderWs.id }));
	}
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
