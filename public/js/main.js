import { state, updateState } from './state.js';
import { elements, updateProfilePreview, loadAvatars, openProfileModal, closeProfileModal, updateUserAudioIndicator } from './ui.js';
import { setupSocketListeners } from './socket-client.js';
import { toggleScreenShare, toggleMute, toggleDeafen, stopScreenShare } from './webrtc.js';

document.addEventListener('DOMContentLoaded', () => {
    state.socket = io();
    setupSocketListeners();

    // Инициализация
    function initApp() {
        state.socket.emit('getProfile');
        if (state.username) {
            updateProfilePreview();
        }
    }
    initApp();

    if (state.username) {
        elements.usernameModal.classList.add('hidden');
        elements.roomModal.classList.remove('hidden');
        updateProfilePreview();
        state.socket.emit('getActiveRooms');
    } else {
        elements.usernameModal.classList.remove('hidden');
        elements.roomModal.classList.add('hidden');
        loadAvatars();
    }

    // Функции действий
    window.joinRoom = function(roomId) {
        if (roomId) {
            state.socket.emit('joinRoom', { roomId, username: state.username, avatar: state.userAvatar, status: state.userStatus });
        }
    };

    function setUsername() {
        const name = elements.usernameInput.value.trim();
        const selectedAvatar = document.querySelector('.avatar-btn.selected')?.dataset.avatar || '😊';

        if (name && name.length >= 3 && name.length <= 20 && /^[a-zA-Z0-9_]+$/.test(name)) {
            updateState('username', name);
            updateState('userAvatar', selectedAvatar);
            updateState('userStatus', 'В сети');

            localStorage.setItem('discordCloneUsername', name);
            localStorage.setItem('discordCloneAvatar', selectedAvatar);
            localStorage.setItem('discordCloneStatus', 'В сети');

            elements.usernameModal.classList.add('hidden');
            elements.roomModal.classList.remove('hidden');
            updateProfilePreview();
            state.socket.emit('getActiveRooms');
        } else {
            alert('Имя должно содержать от 3 до 20 символов и состоять только из букв, цифр и подчеркиваний');
        }
    }

    function createRoom() {
        state.socket.emit('createRoom', { username: state.username, avatar: state.userAvatar, status: state.userStatus });
    }

    function joinRoomHandler() {
        const roomId = elements.roomIdInput.value.trim();
        window.joinRoom(roomId);
    }

    function leaveRoom() {
        if (state.localStream) {
            state.localStream.getTracks().forEach(track => track.stop());
            updateState('localStream', null);
        }
        if (state.localScreenStream) {
            state.localScreenStream.getTracks().forEach(track => track.stop());
            updateState('localScreenStream', null);
        }

        Object.values(state.peerConnections).forEach(pc => pc.destroy());
        Object.values(state.screenPeerConnections).forEach(pc => pc.destroy());
        updateState('peerConnections', {});
        updateState('screenPeerConnections', {});
        updateState('currentAudioElements', {});
        updateState('messages', []);
        
        elements.messagesContainer.innerHTML = '';
        elements.videoContainer.innerHTML = '';
        updateState('videoElements', {});

        if (state.roomId) {
            state.socket.emit('leaveRoom', state.roomId);
        }
        updateState('roomId', '');
        elements.roomNameElement.textContent = 'Выберите или создайте комнату';
        elements.usersListElement.innerHTML = '';
        elements.muteBtn.disabled = true;
        elements.deafenBtn.disabled = true;
        elements.screenShareBtn.classList.remove('active');
        elements.screenShareBtn.textContent = '🖥️ Транслировать экран';

        state.socket.emit('getActiveRooms');
    }

    function sendMessage() {
        const message = elements.messageInput.value.trim();
        if (message && state.roomId) {
            state.socket.emit('sendMessage', { roomId: state.roomId, message });
            elements.messageInput.value = '';
        }
    }

    function saveProfile() {
        const selectedAvatar = document.querySelector('#profile-avatar-grid .avatar-btn.selected')?.dataset.avatar || state.userAvatar || '😊';
        const selectedStatus = elements.statusSelect.value || state.userStatus || 'В сети';

        updateState('userAvatar', selectedAvatar);
        updateState('userStatus', selectedStatus);

        localStorage.setItem('discordCloneAvatar', selectedAvatar);
        localStorage.setItem('discordCloneStatus', selectedStatus);

        updateProfilePreview();
        state.socket.emit('updateProfile', { avatar: selectedAvatar, status: selectedStatus });
        closeProfileModal();
    }

    // Обработчики событий
    elements.usernameSubmit.addEventListener('click', setUsername);
    elements.createRoomBtn.addEventListener('click', createRoom);
    elements.joinRoomBtn.addEventListener('click', joinRoomHandler);
    elements.editProfileBtn.addEventListener('click', openProfileModal);
    elements.saveProfileBtn.addEventListener('click', saveProfile);
    elements.cancelProfileBtn.addEventListener('click', closeProfileModal);
    
    elements.createRoomElement.addEventListener('click', () => {
        if (state.username) elements.roomModal.classList.remove('hidden');
        else elements.usernameModal.classList.remove('hidden');
    });

    elements.muteBtn.addEventListener('click', toggleMute);
    elements.deafenBtn.addEventListener('click', toggleDeafen);
    elements.leaveBtn.addEventListener('click', leaveRoom);
    elements.sendMessageBtn.addEventListener('click', sendMessage);
    
    elements.messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
    
    elements.screenShareBtn.addEventListener('click', toggleScreenShare);
});