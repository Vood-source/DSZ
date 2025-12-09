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
    let roomId = '';
    let localStream = null;
    let peerConnections = {};
    let isMuted = false;
    let isDeafened = false;
    let currentAudioElements = {};
    let users = {}; // Хранилище пользователей для быстрого доступа
    let messages = []; // Хранилище сообщений для текущей комнаты

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
    socket.on('webrtcSignal', async ({ from, signal }) => {
        if (!peerConnections[from]) {
            createPeerConnection(from);
        }

        try {
            await peerConnections[from].signal(signal);
        } catch (err) {
            console.error('Ошибка обработки сигнала:', err);
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
            localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
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

    // Создание нового peer connection
    function createPeerConnection(userId) {
        const peerConnection = new SimplePeer({
            initiator: socket.id > userId,
            trickle: false,
            stream: localStream
        });

        peerConnection.on('signal', signal => {
            socket.emit('webrtcSignal', { to: userId, signal });
        });

        peerConnection.on('stream', stream => {
            // Создаем аудио элемент для воспроизведения звука
            const audioElement = document.createElement('audio');
            audioElement.srcObject = stream;
            audioElement.autoplay = true;
            audioElement.muted = isDeafened;
            currentAudioElements[userId] = audioElement;

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
            // Обновляем индикатор активности
            updateUserAudioIndicator(userId, false);
        });

        peerConnections[userId] = peerConnection;
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

        Object.values(peerConnections).forEach(pc => pc.destroy());
        peerConnections = {};
        currentAudioElements = {};
        messages = []; // Очищаем сообщения при выходе из комнаты
        messagesContainer.innerHTML = '';

        if (roomId) {
            socket.emit('leaveRoom', roomId);
        }
        roomId = '';
        roomNameElement.textContent = 'Выберите или создайте комнату';
        usersListElement.innerHTML = '';
        muteBtn.disabled = true;
        deafenBtn.disabled = true;

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