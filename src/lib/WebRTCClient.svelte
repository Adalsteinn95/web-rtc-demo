<script lang="ts">
	import { onMount } from 'svelte';
	import io from 'socket.io-client';
	import type { Socket } from 'socket.io-client';

	const signalingServerURL = 'http://localhost:3000';
	let socket: Socket;
	let localVideo: HTMLVideoElement;
	let remoteVideo: HTMLVideoElement;
	let peerConnection: RTCPeerConnection;
	const configuration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

	let peerId: string = '';

	onMount(() => {
		socket = io(signalingServerURL);

		navigator.mediaDevices
			.getUserMedia({ video: true, audio: true })
			.then((stream) => {
				localVideo.srcObject = stream;
				peerConnection = new RTCPeerConnection(configuration);
				stream.getTracks().forEach((track) => peerConnection.addTrack(track, stream));

				peerConnection.ontrack = (event) => {
					remoteVideo.srcObject = event.streams[0];
				};

				peerConnection.onicecandidate = (event) => {
					if (event.candidate) {
						socket.emit('candidate', { candidate: event.candidate, target: peerId });
					}
				};

				socket.on('offer', async (data) => {
					if (peerConnection.signalingState != 'stable') return;
					await peerConnection.setRemoteDescription(new RTCSessionDescription(data.description));
					const answer = await peerConnection.createAnswer();
					await peerConnection.setLocalDescription(answer);
					socket.emit('answer', {
						target: data.sender,
						description: peerConnection.localDescription
					});
				});

				socket.on('answer', async (data) => {
					if (!peerConnection.currentRemoteDescription && data.description) {
						await peerConnection.setRemoteDescription(new RTCSessionDescription(data.description));
					}
				});

				socket.on('candidate', async (data) => {
					if (data.candidate) {
						await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
					}
				});
			})
			.catch((error) => console.error('Error accessing media devices:', error));
	});

	async function call() {
		console.info('Calling peer', peerId);
		const offer = await peerConnection.createOffer();
		await peerConnection.setLocalDescription(offer);
		socket.emit('offer', { target: peerId, description: offer });
	}
</script>

<video bind:this={localVideo} autoplay muted></video>
<video bind:this={remoteVideo} autoplay></video>

<input type="text" bind:value={peerId} placeholder="Enter Peer ID" />
<button on:click={call} disabled={!peerId}>Call</button>
