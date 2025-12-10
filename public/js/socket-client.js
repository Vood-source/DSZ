import { state, updateState } from './state.js';
import { updateUsersList, updateRoomList, addMessageToChat, updateProfilePreview, addUserToList, loadMessages } from './ui.js';
import { setupWebRTC, createPeerConnection, createScreenPeerConnection } from './webrtc.js';

export function setupSocketListeners(joinRoomCallback) {
    const socket = state.socket;

    socket.on('usersInRoom', (roomUsers) => {
        roomUsers.forEach(u => state.users[u.id] = u);
        updateUsersList(roomUsers);
        if (state.localStream) {
            roomUsers.forEach(u => {
                if (u.id !== socket.id && !state.peerConnections[u.id]) {
                    createPeerConnection(u.id);
                }
            });
        }
    });

    socket.on('roomListUpdated', (rooms) => {
        if (joinRoomCallback) {
            updateRoomList(rooms, joinRoomCallback);
        }
    });

    socket.on('newMessage', (message) => {
        addMessageToChat(message);
    });

    socket.on('roomCreated', ({ roomId: newRoomId, username: creator }) => {
        updateState('roomId', newRoomId);
        const roomModal = document.getElementById('room-modal');
        if (roomModal) {
            roomModal.classList.remove('active');
            setTimeout(() => roomModal.classList.add('hidden'), 200);
        }
        document.getElementById('room-name').textContent = `Комната: ${newRoomId}`;
        const copyBtn = document.getElementById('copy-room-id-btn');
        if (copyBtn) copyBtn.style.display = 'block';
        
        socket.emit('getActiveRooms');
        addUserToList({ username: state.username, avatar: state.userAvatar, status: state.userStatus }, true);
        setupWebRTC();
        loadMessages();
    });

    socket.on('roomJoined', ({ roomId: newRoomId, username: joiner }) => {
        updateState('roomId', newRoomId);
        const roomModal = document.getElementById('room-modal');
        if (roomModal) {
            roomModal.classList.remove('active');
            setTimeout(() => roomModal.classList.add('hidden'), 200);
        }
        document.getElementById('room-name').textContent = `Комната: ${newRoomId}`;
        const copyBtn = document.getElementById('copy-room-id-btn');
        if (copyBtn) copyBtn.style.display = 'block';

        socket.emit('getActiveRooms');
        addUserToList({ username: state.username, avatar: state.userAvatar, status: state.userStatus }, true);
        setupWebRTC();
        loadMessages();
    });

    socket.on('userJoined', ({ username: user, users: roomUsers }) => {
        roomUsers.forEach(u => state.users[u.id] = u);
        updateUsersList(roomUsers);
        if (state.localStream) {
            roomUsers.forEach(u => {
                if (u.id !== socket.id) createPeerConnection(u.id);
            });
        }
    });

    socket.on('userLeft', ({ username: user, users }) => {
        updateUsersList(users);
        if (state.peerConnections[user.id]) {
            state.peerConnections[user.id].close();
            delete state.peerConnections[user.id];
        }
    });

    socket.on('webrtcSignal', async ({ from, signal, type }) => {
        if (type === 'screen') {
            if (!state.screenPeerConnections[from]) createScreenPeerConnection(from);
            try {
                await state.screenPeerConnections[from].signal(signal);
            } catch (err) {
                console.error('Ошибка обработки сигнала экрана:', err);
            }
        } else {
            if (!state.peerConnections[from]) createPeerConnection(from);
            try {
                await state.peerConnections[from].signal(signal);
            } catch (err) {
                console.error('Ошибка обработки сигнала:', err);
            }
        }
    });

    socket.on('profileInfo', ({ avatar, status }) => {
        updateState('userAvatar', avatar || state.userAvatar);
        updateState('userStatus', status || state.userStatus);
        updateProfilePreview();
    });
}