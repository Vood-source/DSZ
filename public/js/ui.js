import { state } from './state.js';

// Элементы DOM
export const elements = {
    usernameModal: document.getElementById('username-modal'),
    roomModal: document.getElementById('room-modal'),
    profileModal: document.getElementById('profile-modal'),
    usernameInput: document.getElementById('username-input'),
    usernameSubmit: document.getElementById('username-submit'),
    createRoomBtn: document.getElementById('create-room-btn'),
    joinRoomBtn: document.getElementById('join-room-btn'),
    roomIdInput: document.getElementById('room-id-input'),
    createRoomElement: document.getElementById('create-room'),
    roomNameElement: document.getElementById('room-name'),
    usersListElement: document.getElementById('users-list'),
    muteBtn: document.getElementById('mute-btn'),
    deafenBtn: document.getElementById('deafen-btn'),
    leaveBtn: document.getElementById('leave-btn'),
    voiceChannelsElement: document.querySelector('.voice-channels'),
    messagesContainer: document.getElementById('messages-container'),
    messageInput: document.getElementById('message-input'),
    sendMessageBtn: document.getElementById('send-message-btn'),
    videoContainer: document.getElementById('video-container'),
    screenShareBtn: document.getElementById('screen-share-btn'),
    editProfileBtn: document.getElementById('edit-profile-btn'),
    saveProfileBtn: document.getElementById('save-profile-btn'),
    cancelProfileBtn: document.getElementById('cancel-profile-btn'),
    profileAvatarGrid: document.getElementById('profile-avatar-grid'),
    profileSelectedAvatar: document.getElementById('profile-selected-avatar'),
    statusSelect: document.getElementById('status-select'),
    profilePreviewAvatar: document.getElementById('profile-preview-avatar'),
    profilePreviewUsername: document.getElementById('profile-preview-username'),
    profilePreviewStatus: document.getElementById('profile-preview-status'),
    previewAvatar: document.getElementById('preview-avatar'), // User Area Avatar
    previewStatus: document.getElementById('preview-status'), // User Area Status Text
    previewUsername: document.getElementById('preview-username'), // User Area Name
    previewStatusDot: document.getElementById('preview-status-dot'), // User Area Status Dot
    avatarGrid: document.getElementById('avatar-grid'),
    selectedAvatar: document.getElementById('selected-avatar')
};

// Обновление превью профиля
export function updateProfilePreview() {
    // Обновление в User Area
    if (elements.previewAvatar) {
        // Сохраняем дочерний элемент статуса
        const statusDot = elements.previewStatusDot;
        elements.previewAvatar.childNodes[0].nodeValue = state.userAvatar || '😊';
        if (statusDot) elements.previewAvatar.appendChild(statusDot);
    }
    
    if (elements.previewStatus) {
        elements.previewStatus.textContent = state.userStatus || 'В сети';
    }
    
    if (elements.previewUsername) {
        elements.previewUsername.textContent = state.username || 'Ваше имя';
    }
    
    // Обновление точки статуса
    if (elements.previewStatusDot) {
        let color = '#3ba55c'; // Online
        const status = state.userStatus;
        if (status === 'Не беспокоить') color = '#ed4245';
        else if (status === 'Отошел') color = '#faa61a';
        else if (status === 'В игре') color = '#5865f2';
        
        elements.previewStatusDot.style.backgroundColor = color;
    }

    // Обновление в модальном окне (если оно открыто или будет открыто)
    if (elements.profilePreviewAvatar) elements.profilePreviewAvatar.textContent = state.userAvatar || '😊';
    if (elements.profilePreviewUsername) elements.profilePreviewUsername.textContent = state.username || 'Ваше имя';
    if (elements.profilePreviewStatus) elements.profilePreviewStatus.textContent = state.userStatus || 'В сети';
}

// Загрузка аватаров
export function loadAvatars(selectedAvatar = '😊') {
    elements.avatarGrid.innerHTML = '';
    const avatars = [
        '😊', '😎', '😇', '😈', '👽', '🤖', '🦄', '🐱', '🐶', '🦁',
        '🦊', '🐻', '🐼', '🐨', '🦄', '🐙', '🐛', '🦋', '🐝', '🐞'
    ];

    avatars.forEach(avatar => {
        const avatarBtn = document.createElement('button');
        avatarBtn.className = 'avatar-btn';
        avatarBtn.textContent = avatar;
        avatarBtn.dataset.avatar = avatar;
        if (avatar === selectedAvatar) {
            avatarBtn.classList.add('selected');
        }
        avatarBtn.addEventListener('click', () => {
            document.querySelectorAll('.avatar-btn').forEach(btn => btn.classList.remove('selected'));
            avatarBtn.classList.add('selected');
            elements.selectedAvatar.textContent = avatar;
        });
        elements.avatarGrid.appendChild(avatarBtn);
    });
}

// Добавление пользователя в список
export function addUserToList(user, isLocal = false) {
    const memberElement = document.createElement('div');
    memberElement.className = 'member';
    const avatar = user.avatar || '😊';
    const status = user.status || 'В сети';
    
    // Определение статуса для CSS класса
    let statusClass = 'status-online';
    if (status === 'Не беспокоить') statusClass = 'status-dnd';
    else if (status === 'Отошел') statusClass = 'status-idle';
    else if (status === 'На связи') statusClass = 'status-online';
    else statusClass = 'status-online';

    memberElement.innerHTML = `
        <div class="member-avatar">
            ${avatar}
            <div class="member-status-indicator ${statusClass}"></div>
        </div>
        <div class="member-name ${isLocal ? 'current' : ''}">${user.username}</div>
    `;
    
    // Добавляем индикатор голоса, если нужно (пока просто класс)
    memberElement.dataset.userId = user.id; // Для легкого поиска
    
    elements.usersListElement.appendChild(memberElement);
}

// Обновление списка пользователей
export function updateUsersList(users) {
    elements.usersListElement.innerHTML = '';
    users.forEach(user => {
        addUserToList(user, user.id === state.socket.id);
    });
}

// Добавление сообщения в чат
export function addMessageToChat(message) {
    state.messages.push(message);
    const messageElement = document.createElement('div');
    messageElement.className = 'message';
    
    // Получаем аватар пользователя из state.users если возможно, иначе дефолтный
    // В реальном приложении аватар должен приходить с сообщением
    const senderUser = Object.values(state.users).find(u => u.username === message.sender);
    const avatar = senderUser ? senderUser.avatar : '👤';

    // Форматирование времени
    const time = new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    messageElement.innerHTML = `
        <div class="message-avatar">${avatar}</div>
        <div class="message-content-wrapper">
            <div class="message-header">
                <span class="message-author">${message.sender}</span>
                <span class="message-timestamp">${time}</span>
            </div>
            <div class="message-text">${escapeHtml(message.content)}</div>
        </div>
    `;

    elements.messagesContainer.appendChild(messageElement);
    elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
}

// Загрузка истории сообщений
export function loadMessages() {
    elements.messagesContainer.innerHTML = '';
    state.messages.forEach(message => {
        addMessageToChat(message);
    });
}

// Экранирование HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Обновление списка комнат
export function updateRoomList(rooms, joinRoomCallback) {
    // Очищаем список комнат, оставляя кнопку создания
    // В новой структуре кнопка создания находится внутри .voice-channels, как и комнаты
    // Но лучше очищать все кроме кнопки с ID create-room
    
    const channelsContainer = elements.voiceChannelsElement;
    // Сохраняем кнопку создания
    const createBtn = document.getElementById('create-room');
    
    channelsContainer.innerHTML = '';
    if (createBtn) channelsContainer.appendChild(createBtn);

    rooms.forEach(room => {
        const roomElement = document.createElement('div');
        roomElement.className = 'channel';
        // Используем иконку динамика для голосовых каналов
        roomElement.innerHTML = `
            <span class="channel-icon">🔊</span>
            <span class="channel-name">Комната ${room.id.substring(0, 8)}</span>
        `;
        
        roomElement.addEventListener('click', () => {
            if (state.roomId !== room.id) {
                joinRoomCallback(room.id);
            }
        });
        
        roomElement.dataset.roomId = room.id;
        if (state.roomId === room.id) {
            roomElement.classList.add('active');
        }

        // Вставляем перед кнопкой создания или в конец
        channelsContainer.insertBefore(roomElement, createBtn);
    });
}

// Загрузка аватаров профиля
export function loadProfileAvatars(selectedAvatar = '😊') {
    elements.profileAvatarGrid.innerHTML = '';
    const avatars = [
        '😊', '😎', '😇', '😈', '👽', '🤖', '🦄', '🐱', '🐶', '🦁',
        '🦊', '🐻', '🐼', '🐨', '🦄', '🐙', '🐛', '🦋', '🐝', '🐞'
    ];

    avatars.forEach(avatar => {
        const avatarBtn = document.createElement('button');
        avatarBtn.className = 'avatar-btn';
        avatarBtn.textContent = avatar;
        avatarBtn.dataset.avatar = avatar;
        if (avatar === selectedAvatar) {
            avatarBtn.classList.add('selected');
        }
        avatarBtn.addEventListener('click', () => {
            document.querySelectorAll('#profile-avatar-grid .avatar-btn').forEach(btn => btn.classList.remove('selected'));
            avatarBtn.classList.add('selected');
            elements.profileSelectedAvatar.textContent = avatar;
            elements.profilePreviewAvatar.textContent = avatar;
        });
        elements.profileAvatarGrid.appendChild(avatarBtn);
    });
}

// Открытие модального окна профиля
export function openProfileModal() {
    if (elements.profileSelectedAvatar) elements.profileSelectedAvatar.textContent = state.userAvatar || '😊';
    if (elements.profilePreviewAvatar) elements.profilePreviewAvatar.textContent = state.userAvatar || '😊';
    if (elements.profilePreviewUsername) elements.profilePreviewUsername.textContent = state.username || 'Ваше имя';
    if (elements.profilePreviewStatus) elements.profilePreviewStatus.textContent = state.userStatus || 'В сети';

    loadProfileAvatars(state.userAvatar || '😊');

    if (elements.statusSelect) {
        elements.statusSelect.value = state.userStatus || 'В сети';
    }
    if (elements.profileModal) {
        elements.profileModal.classList.remove('hidden');
        // Небольшая задержка для анимации
        setTimeout(() => elements.profileModal.classList.add('active'), 10);
    }
}

// Закрытие модального окна профиля
export function closeProfileModal() {
    if (elements.profileModal) {
        elements.profileModal.classList.remove('active');
        setTimeout(() => elements.profileModal.classList.add('hidden'), 200);
    }
}

// Обновление индикатора аудио
export function updateUserAudioIndicator(userId, isSpeaking) {
    // В новой структуре ищем по data-userId или по имени
    // Лучше использовать data-userId, который мы добавили в addUserToList
    
    // Если userId не передан, ничего не делаем
    if (!userId) return;
    
    // Находим элемент пользователя в списке
    // Мы не добавляли ID в DOM элемент в предыдущей версии addUserToList,
    // но в новой версии добавили memberElement.dataset.userId = user.id
    
    // Ищем элемент по dataset.userId
    const memberElements = document.querySelectorAll('.member');
    
    memberElements.forEach(member => {
        // Проверяем соответствие ID
        // Если это локальный пользователь, ID может быть сокета
        
        let isMatch = false;
        
        if (member.dataset.userId === userId) {
            isMatch = true;
        } else {
            // Fallback: поиск по имени (менее надежно)
            const nameEl = member.querySelector('.member-name');
            if (nameEl && state.users[userId] && nameEl.textContent === state.users[userId].username) {
                isMatch = true;
            }
        }
        
        if (isMatch) {
            const avatar = member.querySelector('.member-avatar');
            if (avatar) {
                if (isSpeaking) {
                    avatar.style.boxShadow = '0 0 0 2px #3ba55c'; // Зеленая обводка
                } else {
                    avatar.style.boxShadow = 'none';
                }
            }
        }
    });
}