import { state, updateState } from './state.js';
import { elements, updateUserAudioIndicator } from './ui.js';

// Настройка WebRTC
export async function setupWebRTC() {
    try {
        const audioConstraints = {
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
                channelCount: 2,
                sampleRate: 48000,
                sampleSize: 16,
                latency: 0.02,
                advanced: [
                    { opus: { stereo: true, maxaveragebitrate: 128000 } }
                ]
            },
            video: false
        };

        const stream = await navigator.mediaDevices.getUserMedia(audioConstraints);
        updateState('localStream', stream);
        
        elements.muteBtn.textContent = state.isMuted ? '🎤 Включить микрофон' : '🎤 Выключить микрофон';
        elements.muteBtn.disabled = false;
        elements.deafenBtn.disabled = false;

        updateUserAudioIndicator(state.socket.id, !state.isMuted);
        state.socket.emit('getUsersInRoom', state.roomId);
    } catch (err) {
        console.error('Ошибка доступа к микрофону:', err);
        alert('Не удалось получить доступ к микрофону. Проверьте разрешения.');
    }
}

// Создание peer connection
export function createPeerConnection(userId) {
    const peerConnection = new SimplePeer({
        initiator: state.socket.id > userId,
        trickle: false,
        stream: state.localStream,
        config: {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:global.stun.twilio.com:3478' },
                { urls: 'stun:stun.voip.blackberry.com:3478' }
            ]
        }
    });

    peerConnection.on('signal', signal => {
        state.socket.emit('webrtcSignal', { to: userId, signal, type: 'media' });
    });

    peerConnection.on('stream', stream => {
        const videoTracks = stream.getVideoTracks();
        if (videoTracks.length > 0) {
            createVideoElement(userId, stream, true);
        } else {
            const audioElement = document.createElement('audio');
            audioElement.srcObject = stream;
            audioElement.autoplay = true;
            audioElement.muted = state.isDeafened;
            state.currentAudioElements[userId] = audioElement;
        }
        updateUserAudioIndicator(userId, true);
    });

    peerConnection.on('error', err => {
        console.error('Ошибка peer connection:', err);
    });

    peerConnection.on('close', () => {
        console.log('Peer connection закрыто');
        if (state.peerConnections[userId]) delete state.peerConnections[userId];
        if (state.currentAudioElements[userId]) delete state.currentAudioElements[userId];
        if (state.videoElements[userId]) deleteVideoElement(userId);
        if (state.videoElements[userId + '_screen']) deleteVideoElement(userId + '_screen');
        updateUserAudioIndicator(userId, false);
    });

    state.peerConnections[userId] = peerConnection;

    if (state.localScreenStream) {
        createScreenPeerConnection(userId);
    }
}

// Создание screen peer connection
export function createScreenPeerConnection(userId) {
    const peerConnection = new SimplePeer({
        initiator: state.socket.id > userId,
        trickle: false,
        stream: state.localScreenStream,
        config: {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:global.stun.twilio.com:3478' },
                { urls: 'stun:stun.voip.blackberry.com:3478' }
            ]
        }
    });

    peerConnection.on('signal', signal => {
        state.socket.emit('webrtcSignal', { to: userId, signal, type: 'screen' });
    });

    peerConnection.on('stream', stream => {
        createVideoElement(userId, stream, true);
    });

    peerConnection.on('error', err => {
        console.error('Ошибка screen peer connection:', err);
    });

    peerConnection.on('close', () => {
        console.log('Screen peer connection закрыто');
        if (state.screenPeerConnections[userId]) delete state.screenPeerConnections[userId];
        if (state.videoElements[userId + '_screen']) deleteVideoElement(userId + '_screen');
    });

    state.screenPeerConnections[userId] = peerConnection;
}

// Создание видео элемента
function createVideoElement(userId, stream, isScreen = false) {
    const videoTile = document.createElement('div');
    videoTile.className = 'video-tile';

    const videoElement = document.createElement('video');
    videoElement.srcObject = stream;
    videoElement.autoplay = true;
    videoElement.playsInline = true;

    const username = state.users[userId]?.username || 'Пользователь';
    const labelText = isScreen ? `Экран: ${username}` : username;

    const overlay = document.createElement('div');
    overlay.className = 'video-overlay';
    
    const nameLabel = document.createElement('div');
    nameLabel.className = 'video-username';
    nameLabel.textContent = labelText;
    
    const fullscreenBtn = document.createElement('button');
    fullscreenBtn.className = 'btn-icon';
    fullscreenBtn.innerHTML = '⛶';
    fullscreenBtn.title = 'На весь экран';
    fullscreenBtn.style.color = 'white';
    fullscreenBtn.addEventListener('click', () => toggleFullscreen(videoElement));

    overlay.appendChild(nameLabel);
    overlay.appendChild(fullscreenBtn);

    videoTile.appendChild(videoElement);
    videoTile.appendChild(overlay);

    if (isScreen) {
        state.videoElements[userId + '_screen'] = videoTile;
    } else {
        state.videoElements[userId] = videoTile;
    }

    // Показываем контейнер видео, если он скрыт
    if (elements.videoContainer.classList.contains('hidden')) {
        elements.videoContainer.classList.remove('hidden');
    }

    elements.videoContainer.appendChild(videoTile);

    stream.getVideoTracks().forEach(track => {
        track.onended = () => {
            deleteVideoElement(isScreen ? userId + '_screen' : userId);
        };
    });
}

// Удаление видео элемента
function deleteVideoElement(key) {
    if (state.videoElements[key]) {
        elements.videoContainer.removeChild(state.videoElements[key]);
        delete state.videoElements[key];
    }
    
    // Если видео больше нет, скрываем контейнер
    if (elements.videoContainer.children.length === 0) {
        elements.videoContainer.classList.add('hidden');
    }
}

// Полноэкранный режим
function toggleFullscreen(videoElement) {
    if (!document.fullscreenElement) {
        if (videoElement.requestFullscreen) videoElement.requestFullscreen();
        else if (videoElement.webkitRequestFullscreen) videoElement.webkitRequestFullscreen();
        else if (videoElement.msRequestFullscreen) videoElement.msRequestFullscreen();
    } else {
        if (document.exitFullscreen) document.exitFullscreen();
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
        else if (document.msExitFullscreen) document.msExitFullscreen();
    }
}

// Управление медиа
export async function toggleScreenShare() {
    if (state.localScreenStream) {
        stopScreenShare();
    } else {
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
            updateState('localScreenStream', stream);
            
            elements.screenShareBtn.classList.add('active');
            elements.screenShareBtn.textContent = '🖥️ Остановить трансляцию';
            
            state.socket.emit('startScreenShare', { roomId: state.roomId });
            
            const roomUsers = Object.values(state.users).filter(u => u.id !== state.socket.id);
            roomUsers.forEach(user => {
                if (!state.screenPeerConnections[user.id]) createScreenPeerConnection(user.id);
            });
            
            createVideoElement(state.socket.id + '_screen', stream, true);
        } catch (err) {
            console.error('Ошибка доступа к экрану:', err);
            if (err.name !== 'NotAllowedError') alert('Не удалось получить доступ к экрану. Проверьте разрешения.');
        }
    }
}

export function stopScreenShare() {
    if (state.localScreenStream) {
        state.localScreenStream.getTracks().forEach(track => track.stop());
        updateState('localScreenStream', null);
    }
    
    Object.values(state.screenPeerConnections).forEach(pc => pc.destroy());
    updateState('screenPeerConnections', {});
    
    deleteVideoElement(state.socket.id + '_screen');
    
    if (state.roomId) state.socket.emit('stopScreenShare', { roomId: state.roomId });
    
    elements.screenShareBtn.classList.remove('active');
    elements.screenShareBtn.textContent = '🖥️ Транслировать экран';
}

export function toggleMute() {
    if (!state.localStream) return;
    
    const newMutedState = !state.isMuted;
    updateState('isMuted', newMutedState);
    
    state.localStream.getAudioTracks().forEach(track => track.enabled = !newMutedState);
    elements.muteBtn.textContent = newMutedState ? '🎤 Включить микрофон' : '🎤 Выключить микрофон';
    updateUserAudioIndicator(state.socket.id, !newMutedState);
}

export function toggleDeafen() {
    const newDeafenedState = !state.isDeafened;
    updateState('isDeafened', newDeafenedState);
    
    elements.deafenBtn.textContent = newDeafenedState ? '🔊 Включить звук' : '🔇 Отключить звук';
    Object.keys(state.currentAudioElements).forEach(userId => {
        state.currentAudioElements[userId].muted = newDeafenedState;
    });
}