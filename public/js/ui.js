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
    previewAvatar: document.getElementById('preview-avatar'),
    previewStatus: document.getElementById('preview-status'),
    previewUsername: document.getElementById('preview-username'),
    avatarGrid: document.getElementById('avatar-grid'),
    selectedAvatar: document.getElementById('selected-avatar')
};

// Обновление превью профиля
export function updateProfilePreview() {
    if (elements.previewAvatar && elements.previewStatus && elements.previewUsername) {
        elements.previewAvatar.textContent = state.userAvatar || '😊';
        elements.previewStatus.textContent = state.userStatus || 'В сети';
        elements.previewUsername.textContent = state.username || 'Ваше имя';
    }
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
    const userElement = document.createElement('div');
    userElement.className = 'user-card';
    const avatar = user.avatar || '😊';
    const status = user.status || 'В сети';

    userElement.innerHTML = `
        <div class="user-avatar" title="${status}">${avatar}</div>
        <div class="user-name">${user.username}</div>
        <div class="user-status">${status}</div>
        ${isLocal ? '<div class="voice-indicator">Вы</div>' : '<div class="voice-indicator">Говорит...</div>'}
    `;
    elements.usersListElement.appendChild(userElement);
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
    const isCurrentUser = message.sender === state.username;

    messageElement.innerHTML = `
        <div class="sender">${message.sender}</div>
        <div class="content">${escapeHtml(message.content)}</div>
    `;

    if (isCurrentUser) {
        messageElement.classList.add('current-user');
    }

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
    while (elements.voiceChannelsElement.children.length > 1) {
        elements.voiceChannelsElement.removeChild(elements.voiceChannelsElement.children[1]);
    }

    rooms.forEach(room => {
        const roomElement = document.createElement('div');
        roomElement.className = 'channel';
        roomElement.innerHTML = `<span># Голосовая комната ${room.id.substring(0, 8)}</span>`;
        
        roomElement.addEventListener('click', () => {
            if (state.roomId !== room.id) {
                joinRoomCallback(room.id);
            }
        });
        
        roomElement.dataset.roomId = room.id;
        if (state.roomId === room.id) {
            roomElement.classList.add('active');
        }

        elements.voiceChannelsElement.insertBefore(roomElement, elements.voiceChannelsElement.children[1]);
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
    elements.profileSelectedAvatar.textContent = state.userAvatar || '😊';
    elements.profilePreviewAvatar.textContent = state.userAvatar || '😊';
    elements.profilePreviewUsername.textContent = state.username || 'Ваше имя';
    elements.profilePreviewStatus.textContent = state.userStatus || 'В сети';

    loadProfileAvatars(state.userAvatar || '😊');

    if (elements.statusSelect) {
        elements.statusSelect.value = state.userStatus || 'В сети';
    }
    elements.profileModal.classList.remove('hidden');
}

// Закрытие модального окна профиля
export function closeProfileModal() {
    elements.profileModal.classList.add('hidden');
}

// Обновление индикатора аудио
export function updateUserAudioIndicator(userId, isSpeaking) {
    const userCards = document.querySelectorAll('.user-card');
    userCards.forEach(card => {
        const userNameElement = card.querySelector('.user-name');
        if (!userNameElement) return;

        const usernameFromCard = userNameElement.textContent;
        const isCurrentUser = userId === state.socket.id;

        if ((isCurrentUser && usernameFromCard === state.username) ||
            (!isCurrentUser && state.users[userId] && state.users[userId].username === usernameFromCard)) {
            const indicator = card.querySelector('.voice-indicator');
            const avatar = card.querySelector('.user-avatar');

            if (indicator) {
                indicator.textContent = isSpeaking ? 'Говорит...' : (isCurrentUser ? (state.isMuted ? 'Микрофон выключен' : 'Вы') : 'Молчит');
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