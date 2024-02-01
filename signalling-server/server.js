const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
	cors: {
		origin: '*', // For development ease, allowing all origins
		methods: ['GET', 'POST'],
		credentials: false
	}
});

io.on('connection', (socket) => {
	console.log('A user connected:', socket.id);

	socket.emit('your-id', socket.id);

	socket.on('offer', (data) => {
		console.log(`Relaying offer from ${socket.id} to ${data.target}`);
		socket.to(data.target).emit('offer', { sender: socket.id, description: data.description });
	});

	socket.on('answer', (data) => {
		console.log(`Relaying answer from ${socket.id} to ${data.target}`);
		socket.to(data.target).emit('answer', { sender: socket.id, description: data.description });
	});

	socket.on('candidate', (data) => {
		console.log(`Relaying ICE candidate from ${socket.id} to ${data.target}`);
		socket.to(data.target).emit('candidate', { sender: socket.id, candidate: data.candidate });
	});

	// Handle disconnection
	socket.on('disconnect', () => {
		console.log('User disconnected:', socket.id);
		// Notify other users possibly in the same peer connection
		socket.broadcast.emit('user-disconnected', socket.id);
	});
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
