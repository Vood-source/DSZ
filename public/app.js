document.addEventListener('DOMContentLoaded', () => {
    // Состояние приложения
    let username = localStorage.getItem('discordCloneUsername') || '';
    const socket = io(); // Инициализация Socket.IO в начале

    // Элементы DOM
    const usernameModal = document.getElementById('username-modal');
    const roomModal = document.getElementById('room-modal');

    // Если имя пользователя уже сохранено, пропускаем ввод имени
    if (username) {
        usernameModal.classList.add('hidden');
        roomModal.classList.remove('hidden');

        // Запрашиваем список активных комнат
        socket.emit('getActiveRooms');
    } else {
        usernameModal.classList.remove('hidden');
        roomModal.classList.add('hidden');
    }
    const usernameInput = document.getElementById('username-input');
    const usernameSubmit = document.getElementById('username-submit');
    const createRoomBtn = document.getElementById('create-room-btn');
    const joinRoomBtn = document.getElementById('join-room-btn');
    const roomIdInput = document.getElementById('room-id-input');
    const createRoomElement = document.getElementById('create-room');
    const roomNameElement = document.getElementById('room-name');
    const usersListElement = document.getElementById('users-list');
    const muteBtn = document.getElementById('mute-btn');
    const deafenBtn = document.getElementById('deafen-btn');
    const leaveBtn = document.getElementById('leave-btn');
    const voiceChannelsElement = document.querySelector('.voice-channels');
    const messagesContainer = document.getElementById('messages-container');
    const messageInput = document.getElementById('message-input');
    const sendMessageBtn = document.getElementById('send-message-btn');
    const videoContainer = document.getElementById('video-container');
    const screenShareBtn = document.getElementById('screen-share-btn');
    let roomId = '';
    let localStream = null;
    let localScreenStream = null;
    let peerConnections = {};
    let screenPeerConnections = {};
    let isMuted = false;
    let isDeafened = false;
    let currentAudioElements = {};
    let users = {}; // Хранилище пользователей для быстрого доступа
    let messages = []; // Хранилище сообщений для текущей комнаты
    let videoElements = {}; // Хранилище видео элементов

    // Обработчики событий
    usernameSubmit.addEventListener('click', setUsername);
    createRoomBtn.addEventListener('click', createRoom);
    joinRoomBtn.addEventListener('click', joinRoom);
    createRoomElement.addEventListener('click', () => {
        if (username) {
            roomModal.classList.remove('hidden');
        } else {
            usernameModal.classList.remove('hidden');
        }
    });
    muteBtn.addEventListener('click', toggleMute);
    deafenBtn.addEventListener('click', toggleDeafen);
    leaveBtn.addEventListener('click', leaveRoom);
    sendMessageBtn.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
    screenShareBtn.addEventListener('click', toggleScreenShare);

    // Обработка получения списка пользователей в комнате
    socket.on('usersInRoom', (roomUsers) => {
        // Обновляем локальное хранилище пользователей
        roomUsers.forEach(u => {
            users[u.id] = u;
        });

        updateUsersList(roomUsers);
        if (localStream) {
            roomUsers.forEach(u => {
                if (u.id !== socket.id && !peerConnections[u.id]) {
                    createPeerConnection(u.id);
                }
            });
        }
    });

    // Обработка обновления списка комнат
    socket.on('roomListUpdated', (rooms) => {
        updateRoomList(rooms);
    });

    // Обработка нового сообщения
    socket.on('newMessage', (message) => {
        addMessageToChat(message);
    });

    // Установка имени пользователя
    function setUsername() {
        const name = usernameInput.value.trim();
        if (name && name.length >= 3 && name.length <= 20 && /^[a-zA-Z0-9_]+$/.test(name)) {
            username = name;
            localStorage.setItem('discordCloneUsername', name);
            usernameModal.classList.add('hidden');
            roomModal.classList.remove('hidden');

            // Запрашиваем список активных комнат при входе
            socket.emit('getActiveRooms');
        } else {
            alert('Имя должно содержать от 3 до 20 символов и состоять только из букв, цифр и подчеркиваний');
        }
    }

    // Создание новой комнаты
    function createRoom() {
        socket.emit('createRoom', username);
    }

    // Подключение к существующей комнате
    function joinRoom() {
        const roomId = roomIdInput.value.trim();
        if (roomId) {
            socket.emit('joinRoom', { roomId, username });
        }
    }

    // Обработка создания комнаты
    socket.on('roomCreated', ({ roomId: newRoomId, username: creator }) => {
        roomId = newRoomId;
        roomModal.classList.add('hidden');
        roomNameElement.textContent = `Комната: ${roomId}`;

        // Запрашиваем обновленный список комнат
        socket.emit('getActiveRooms');

        addUserToList(username, true);
        setupWebRTC();
        loadMessages(); // Загружаем сообщения при создании комнаты
    });

    // Обработка подключения к комнате
    socket.on('roomJoined', ({ roomId: newRoomId, username: joiner }) => {
        roomId = newRoomId;
        roomModal.classList.add('hidden');
        roomNameElement.textContent = `Комната: ${roomId}`;

        // Запрашиваем обновленный список комнат
        socket.emit('getActiveRooms');

        addUserToList(username, true);
        setupWebRTC();
        loadMessages(); // Загружаем сообщения при подключении к комнате
    });

    // Обработка подключения нового пользователя
    socket.on('userJoined', ({ username: user, users: roomUsers }) => {
        // Обновляем локальное хранилище пользователей
        roomUsers.forEach(u => {
            users[u.id] = u;
        });

        updateUsersList(roomUsers);
        if (localStream) {
            roomUsers.forEach(u => {
                if (u.id !== socket.id) {
                    createPeerConnection(u.id);
                }
            });
        }
    });

    // Обработка отключения пользователя
    socket.on('userLeft', ({ username: user, users }) => {
        updateUsersList(users);
        if (peerConnections[user.id]) {
            peerConnections[user.id].close();
            delete peerConnections[user.id];
        }
    });

    // Обработка сигналов WebRTC
    socket.on('webrtcSignal', async ({ from, signal, type }) => {
        if (type === 'screen') {
            if (!screenPeerConnections[from]) {
                createScreenPeerConnection(from);
            }
            try {
                await screenPeerConnections[from].signal(signal);
            } catch (err) {
                console.error('Ошибка обработки сигнала экрана:', err);
            }
        } else {
            if (!peerConnections[from]) {
                createPeerConnection(from);
            }
            try {
                await peerConnections[from].signal(signal);
            } catch (err) {
                console.error('Ошибка обработки сигнала:', err);
            }
        }
    });


    // Добавление пользователя в список
    function addUserToList(username, isLocal = false) {
        const userElement = document.createElement('div');
        userElement.className = 'user-card';
        userElement.innerHTML = `
            <div class="user-avatar">${username.charAt(0).toUpperCase()}</div>
            <div class="user-name">${username}</div>
            ${isLocal ? '<div class="voice-indicator">Вы</div>' : '<div class="voice-indicator">Говорит...</div>'}
        `;
        usersListElement.appendChild(userElement);
    }

    // Обновление списка пользователей
    function updateUsersList(users) {
        usersListElement.innerHTML = '';
        users.forEach(user => {
            addUserToList(user.username, user.id === socket.id);
        });
    }

    // Обновление списка комнат
    function updateRoomList(rooms) {
        // Удаляем все комнаты кроме первой (кнопки создания комнаты)
        while (voiceChannelsElement.children.length > 1) {
            voiceChannelsElement.removeChild(voiceChannelsElement.children[1]);
        }

        // Добавляем активные комнаты
        rooms.forEach(room => {
            addRoomToChannelList(room.id);
        });
    }

    // Настройка WebRTC
    async function setupWebRTC() {
        try {
            // Настраиваем ограничения для высокого качества звука
            const audioConstraints = {
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    channelCount: 2,
                    sampleRate: 48000,
                    sampleSize: 16,
                    // Используем кодек Opus для лучшего качества
                    latency: 0.02, // 20ms для минимальной задержки
                    // Настройка битрейта (в битах в секунду)
                    // Opus поддерживает от 6 kbps до 510 kbps
                    advanced: [
                        { opus: { stereo: true, maxaveragebitrate: 128000 } } // 128 kbps для высокого качества
                    ]
                },
                video: false
            };

            // Запрашиваем доступ к микрофону с настроенными параметрами
            localStream = await navigator.mediaDevices.getUserMedia(audioConstraints);
            muteBtn.textContent = isMuted ? '🎤 Включить микрофон' : '🎤 Выключить микрофон';
            muteBtn.disabled = false;
            deafenBtn.disabled = false;

            // Обновляем индикатор микрофона
            updateUserAudioIndicator(socket.id, !isMuted);

            // Получаем список пользователей в комнате
            socket.emit('getUsersInRoom', roomId);
        } catch (err) {
            console.error('Ошибка доступа к микрофону:', err);
            alert('Не удалось получить доступ к микрофону. Проверьте разрешения.');
        }
    }

    // Переключение экранной трансляции
    async function toggleScreenShare() {
        if (localScreenStream) {
            // Останавливаем трансляцию
            stopScreenShare();
        } else {
            // Начинаем трансляцию
            try {
                localScreenStream = await navigator.mediaDevices.getDisplayMedia({
                    video: true,
                    audio: true
                });

                // Обновляем UI
                screenShareBtn.classList.add('active');
                screenShareBtn.textContent = '🖥️ Остановить трансляцию';

                // Сообщаем серверу о начале трансляции
                socket.emit('startScreenShare', { roomId });

                // Создаем peer connections для всех пользователей в комнате
                const roomUsers = Object.values(users).filter(u => u.id !== socket.id);
                roomUsers.forEach(user => {
                    if (!screenPeerConnections[user.id]) {
                        createScreenPeerConnection(user.id);
                    }
                });

                // Добавляем наш собственный экран в UI
                createVideoElement(socket.id + '_screen', localScreenStream, true);

            } catch (err) {
                console.error('Ошибка доступа к экрану:', err);
                if (err.name !== 'NotAllowedError') {
                    alert('Не удалось получить доступ к экрану. Проверьте разрешения.');
                }
            }
        }
    }

    // Остановка экранной трансляции
    function stopScreenShare() {
        if (localScreenStream) {
            localScreenStream.getTracks().forEach(track => track.stop());
            localScreenStream = null;
        }

        Object.values(screenPeerConnections).forEach(pc => pc.destroy());
        screenPeerConnections = {};

        // Удаляем наш экран из UI
        deleteVideoElement(socket.id + '_screen');

        // Сообщаем серверу об остановке трансляции
        if (roomId) {
            socket.emit('stopScreenShare', { roomId });
        }

        // Обновляем UI
        screenShareBtn.classList.remove('active');
        screenShareBtn.textContent = '🖥️ Транслировать экран';
    }

    // Создание нового peer connection для аудио/видео
    function createPeerConnection(userId) {
        const peerConnection = new SimplePeer({
            initiator: socket.id > userId,
            trickle: false,
            stream: localStream
        });

        peerConnection.on('signal', signal => {
            socket.emit('webrtcSignal', { to: userId, signal, type: 'media' });
        });

        peerConnection.on('stream', stream => {
            // Проверяем, есть ли в потоке видео треки (камера или экран)
            const videoTracks = stream.getVideoTracks();
            if (videoTracks.length > 0) {
                // Это видео поток (экранная трансляция другого пользователя)
                createVideoElement(userId, stream, true);
            } else {
                // Это аудио поток
                const audioElement = document.createElement('audio');
                audioElement.srcObject = stream;
                audioElement.autoplay = true;
                audioElement.muted = isDeafened;
                currentAudioElements[userId] = audioElement;
            }

            // Обновляем индикатор активности
            updateUserAudioIndicator(userId, true);
        });

        peerConnection.on('error', err => {
            console.error('Ошибка peer connection:', err);
        });

        peerConnection.on('close', () => {
            console.log('Peer connection закрыто');
            if (peerConnections[userId]) {
                delete peerConnections[userId];
            }
            if (currentAudioElements[userId]) {
                delete currentAudioElements[userId];
            }
            if (videoElements[userId]) {
                deleteVideoElement(userId);
            }
            if (videoElements[userId + '_screen']) {
                deleteVideoElement(userId + '_screen');
            }
            // Обновляем индикатор активности
            updateUserAudioIndicator(userId, false);
        });

        peerConnections[userId] = peerConnection;

        // Если у нас есть активная экранная трансляция, создаем отдельное соединение для нее
        if (localScreenStream) {
            createScreenPeerConnection(userId);
        }
    }

    // Создание нового peer connection для экранной трансляции
    function createScreenPeerConnection(userId) {
        const peerConnection = new SimplePeer({
            initiator: socket.id > userId,
            trickle: false,
            stream: localScreenStream
        });

        peerConnection.on('signal', signal => {
            socket.emit('webrtcSignal', { to: userId, signal, type: 'screen' });
        });

        peerConnection.on('stream', stream => {
            // Это экранный поток
            createVideoElement(userId, stream, true);
        });

        peerConnection.on('error', err => {
            console.error('Ошибка screen peer connection:', err);
        });

        peerConnection.on('close', () => {
            console.log('Screen peer connection закрыто');
            if (screenPeerConnections[userId]) {
                delete screenPeerConnections[userId];
            }
            if (videoElements[userId + '_screen']) {
                deleteVideoElement(userId + '_screen');
            }
        });

        screenPeerConnections[userId] = peerConnection;
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
        label.textContent = isScreen ? 'Трансляция: ' + users[userId]?.username : users[userId]?.username || 'Пользователь';

        // Кнопка полноэкранного режима
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

            // Сохраняем с суффиксом _screen для идентификации
            videoElements[userId + '_screen'] = videoWrapper;
        } else {
            videoElements[userId] = videoWrapper;
        }

        videoContainer.appendChild(videoWrapper);

        // Обработка окончания потока
        stream.getVideoTracks().forEach(track => {
            track.onended = () => {
                deleteVideoElement(isScreen ? userId + '_screen' : userId);
            };
        });
    }

    // Удаление видео элемента
    function deleteVideoElement(key) {
        if (videoElements[key]) {
            videoContainer.removeChild(videoElements[key]);
            delete videoElements[key];
        }
    }

    // Переключение полноэкранного режима
    function toggleFullscreen(videoElement) {
        if (!document.fullscreenElement) {
            if (videoElement.requestFullscreen) {
                videoElement.requestFullscreen();
            } else if (videoElement.webkitRequestFullscreen) { /* Safari */
                videoElement.webkitRequestFullscreen();
            } else if (videoElement.msRequestFullscreen) { /* IE11 */
                videoElement.msRequestFullscreen();
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) { /* Safari */
                document.webkitExitFullscreen();
            } else if (document.msExitFullscreen) { /* IE11 */
                document.msExitFullscreen();
            }
        }
    }

    // Переключение микрофона
    function toggleMute() {
        if (!localStream) return;

        isMuted = !isMuted;
        localStream.getAudioTracks().forEach(track => {
            track.enabled = !isMuted;
        });
        muteBtn.textContent = isMuted ? '🎤 Включить микрофон' : '🎤 Выключить микрофон';

        // Обновляем индикатор микрофона для текущего пользователя
        updateUserAudioIndicator(socket.id, !isMuted);
    }

    // Переключение звука
    function toggleDeafen() {
        isDeafened = !isDeafened;
        deafenBtn.textContent = isDeafened ? '🔊 Включить звук' : '🔇 Отключить звук';

        // Отключаем/включаем звук для всех аудио элементов
        Object.keys(currentAudioElements).forEach(userId => {
            currentAudioElements[userId].muted = isDeafened;
        });
    }

    // Добавление комнаты в список каналов
    function addRoomToChannelList(roomId) {
        const existingRoom = document.querySelector(`.channel[data-room-id="${roomId}"]`);
        if (existingRoom) return;

        const roomElement = document.createElement('div');
        roomElement.className = 'channel';
        roomElement.innerHTML = `
            <span># Голосовая комната ${roomId.substring(0, 8)}</span>
        `;
        roomElement.addEventListener('click', () => {
            if (this.roomId !== roomId) {
                leaveRoom();
                socket.emit('joinRoom', { roomId, username });
            }
        });
        roomElement.dataset.roomId = roomId;

        // Помечаем активную комнату
        if (this.roomId === roomId) {
            roomElement.classList.add('active');
        }

        voiceChannelsElement.insertBefore(roomElement, voiceChannelsElement.children[1]);
    }

    // Обновление индикатора аудио активности
    function updateUserAudioIndicator(userId, isSpeaking) {
        const userCards = document.querySelectorAll('.user-card');
        userCards.forEach(card => {
            const userNameElement = card.querySelector('.user-name');
            if (!userNameElement) return;

            const usernameFromCard = userNameElement.textContent;
            const isCurrentUser = userId === socket.id;

            if ((isCurrentUser && usernameFromCard === username) ||
                (!isCurrentUser && users[userId] && users[userId].username === usernameFromCard)) {
                const indicator = card.querySelector('.voice-indicator');
                const avatar = card.querySelector('.user-avatar');

                if (indicator) {
                    indicator.textContent = isSpeaking ? 'Говорит...' : (isCurrentUser ? (isMuted ? 'Микрофон выключен' : 'Вы') : 'Молчит');
                    indicator.style.color = isSpeaking ? '#43b581' : '#72767d';
                }

                if (avatar) {
                    avatar.style.border = isSpeaking ? '2px solid #43b581' : 'none';
                    if (isSpeaking) {
                        avatar.classList.add('speaking');
                    } else {
                        avatar.classList.remove('speaking');
                    }
                }
            }
        });
    }

    // Обновление списка комнат
    function updateRoomList(rooms) {
        // Удаляем все комнаты кроме первой (кнопки создания комнаты)
        while (voiceChannelsElement.children.length > 1) {
            voiceChannelsElement.removeChild(voiceChannelsElement.children[1]);
        }

        // Добавляем активные комнаты
        rooms.forEach(room => {
            addRoomToChannelList(room.id);
        });
    }

    // Выход из комнаты
    function leaveRoom() {
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            localStream = null;
        }

        if (localScreenStream) {
            localScreenStream.getTracks().forEach(track => track.stop());
            localScreenStream = null;
        }

        Object.values(peerConnections).forEach(pc => pc.destroy());
        Object.values(screenPeerConnections).forEach(pc => pc.destroy());
        peerConnections = {};
        screenPeerConnections = {};
        currentAudioElements = {};
        messages = []; // Очищаем сообщения при выходе из комнаты
        messagesContainer.innerHTML = '';
        videoContainer.innerHTML = '';
        videoElements = {};

        if (roomId) {
            socket.emit('leaveRoom', roomId);
        }
        roomId = '';
        roomNameElement.textContent = 'Выберите или создайте комнату';
        usersListElement.innerHTML = '';
        muteBtn.disabled = true;
        deafenBtn.disabled = true;
        screenShareBtn.classList.remove('active');
        screenShareBtn.textContent = '🖥️ Транслировать экран';

        // Запрашиваем обновленный список комнат
        socket.emit('getActiveRooms');
    }

    // Отправка сообщения
    function sendMessage() {
        const message = messageInput.value.trim();
        if (message && roomId) {
            socket.emit('sendMessage', { roomId, message });
            messageInput.value = '';
        }
    }

    // Добавление сообщения в чат
    function addMessageToChat(message) {
        messages.push(message);
        const messageElement = document.createElement('div');
        messageElement.className = 'message';

        const isCurrentUser = message.sender === username;
        const messageClass = isCurrentUser ? 'current-user' : 'other-user';

        messageElement.innerHTML = `
            <div class="sender">${message.sender}</div>
            <div class="content">${escapeHtml(message.content)}</div>
        `;

        // Добавляем класс для стилизации сообщений текущего пользователя
        if (isCurrentUser) {
            messageElement.classList.add('current-user');
        }

        messagesContainer.appendChild(messageElement);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // Экранирование HTML для безопасности
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Загрузка истории сообщений при подключении к комнате
    function loadMessages() {
        messagesContainer.innerHTML = '';
        messages.forEach(message => {
            addMessageToChat(message);
        });
    }
});