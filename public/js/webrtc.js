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
        stream: state.localStream
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
        stream: state.localScreenStream
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
    const videoWrapper = document.createElement('div');
    videoWrapper.className = 'video-wrapper';

    const videoElement = document.createElement('video');
    videoElement.className = 'video-element';
    videoElement.srcObject = stream;
    videoElement.autoplay = true;
    videoElement.playsInline = true;

    const label = document.createElement('div');
    label.className = 'video-label';
    label.textContent = isScreen ? 'Трансляция: ' + (state.users[userId]?.username || 'Пользователь') : (state.users[userId]?.username || 'Пользователь');

    const fullscreenBtn = document.createElement('button');
    fullscreenBtn.className = 'fullscreen-btn';
    fullscreenBtn.innerHTML = '⛶';
    fullscreenBtn.title = 'Развернуть на весь экран';
    fullscreenBtn.addEventListener('click', () => toggleFullscreen(videoElement));

    const controls = document.createElement('div');
    controls.className = 'video-controls';
    controls.appendChild(label);
    controls.appendChild(fullscreenBtn);

    videoWrapper.appendChild(videoElement);
    videoWrapper.appendChild(controls);

    if (isScreen) {
        const screenIndicator = document.createElement('div');
        screenIndicator.className = 'screen-share-indicator';
        screenIndicator.textContent = 'ЭКРАН';
        videoWrapper.appendChild(screenIndicator);
        state.videoElements[userId + '_screen'] = videoWrapper;
    } else {
        state.videoElements[userId] = videoWrapper;
    }

    elements.videoContainer.appendChild(videoWrapper);

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