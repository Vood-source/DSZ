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
    selectedAvatar: document.getElementById('selected-avatar'),
    copyRoomIdBtn: document.getElementById('copy-room-id-btn')
};

// Функция для показа тостов
export function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    // Анимация появления
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    // Удаление через 3 секунды
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            document.body.removeChild(toast);
        }, 300);
    }, 3000);
}

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
    if (!elements.avatarGrid) return;
    elements.avatarGrid.innerHTML = '';
    const avatars = [
        '😊', '😎', '😇', '😈', '👽', '🤖', '🦄', '🐱', '🐶', '🦁',
        '🦊', '🐻', '🐼', '🐨', '🦄', '🐙', '🐛', '🦋', '🐝', '🐞'
    ];

    avatars.forEach(avatar => {
        const avatarBtn = document.createElement('div');
        avatarBtn.className = 'avatar-option';
        avatarBtn.textContent = avatar;
        if (avatar === selectedAvatar) {
            avatarBtn.classList.add('selected');
        }
        avatarBtn.addEventListener('click', () => {
            document.querySelectorAll('.avatar-option').forEach(btn => btn.classList.remove('selected'));
            avatarBtn.classList.add('selected');
            if (elements.selectedAvatar) elements.selectedAvatar.textContent = avatar;
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
    
    // Авто-скролл вниз
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

// Обновление списка комнат (оптимизированное)
export function updateRoomList(rooms, joinRoomCallback) {
    const channelsContainer = elements.voiceChannelsElement;
    const createBtn = document.getElementById('create-room');
    
    // Получаем текущие элементы комнат
    const existingRooms = Array.from(channelsContainer.querySelectorAll('.channel'));
    const existingRoomIds = existingRooms.map(el => el.dataset.roomId).filter(Boolean);
    const newRoomIds = rooms.map(r => r.id);

    // Удаляем комнаты, которых больше нет
    existingRooms.forEach(el => {
        const id = el.dataset.roomId;
        if (id && !newRoomIds.includes(id)) {
            el.remove();
        }
    });

    // Добавляем или обновляем комнаты
    rooms.forEach(room => {
        let roomElement = channelsContainer.querySelector(`.channel[data-room-id="${room.id}"]`);
        
        // Генерация HTML для пользователей
        let usersHtml = '';
        if (room.users && room.users.length > 0) {
            usersHtml = '<div class="channel-users">';
            room.users.forEach(user => {
                usersHtml += `<div class="channel-user-avatar" title="${user.username}">${user.avatar}</div>`;
            });
            usersHtml += '</div>';
        }

        const innerHTML = `
            <div class="channel-info">
                <span class="channel-icon">🔊</span>
                <span class="channel-name">Комната ${room.id.substring(0, 8)}</span>
            </div>
            ${usersHtml}
        `;

        if (!roomElement) {
            // Создаем новую комнату
            roomElement = document.createElement('div');
            roomElement.className = 'channel';
            roomElement.dataset.roomId = room.id;
            roomElement.innerHTML = innerHTML;
            
            roomElement.addEventListener('click', () => {
                if (state.roomId !== room.id) {
                    joinRoomCallback(room.id);
                }
            });

            if (createBtn) {
                channelsContainer.insertBefore(roomElement, createBtn);
            } else {
                channelsContainer.appendChild(roomElement);
            }
        } else {
            // Обновляем существующую комнату только если содержимое изменилось
            if (roomElement.innerHTML !== innerHTML) {
                roomElement.innerHTML = innerHTML;
            }
        }

        // Обновляем активный класс
        if (state.roomId === room.id) {
            roomElement.classList.add('active');
        } else {
            roomElement.classList.remove('active');
        }
    });
}

// Загрузка аватаров профиля
export function loadProfileAvatars(selectedAvatar = '😊') {
    if (!elements.profileAvatarGrid) return;
    elements.profileAvatarGrid.innerHTML = '';
    const avatars = [
        '😊', '😎', '😇', '😈', '👽', '🤖', '🦄', '🐱', '🐶', '🦁',
        '🦊', '🐻', '🐼', '🐨', '🦄', '🐙', '🐛', '🦋', '🐝', '🐞'
    ];

    avatars.forEach(avatar => {
        const avatarBtn = document.createElement('div');
        avatarBtn.className = 'avatar-option';
        avatarBtn.textContent = avatar;
        if (avatar === selectedAvatar) {
            avatarBtn.classList.add('selected');
        }
        avatarBtn.addEventListener('click', () => {
            document.querySelectorAll('#profile-avatar-grid .avatar-option').forEach(btn => btn.classList.remove('selected'));
            avatarBtn.classList.add('selected');
            if (elements.profileSelectedAvatar) elements.profileSelectedAvatar.textContent = avatar;
            if (elements.profilePreviewAvatar) elements.profilePreviewAvatar.textContent = avatar;
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
    if (!userId) return;
    
    const memberElements = document.querySelectorAll('.member');
    
    memberElements.forEach(member => {
        let isMatch = false;
        
        if (member.dataset.userId === userId) {
            isMatch = true;
        } else {
            const nameEl = member.querySelector('.member-name');
            if (nameEl && state.users[userId] && nameEl.textContent === state.users[userId].username) {
                isMatch = true;
            }
        }
        
        if (isMatch) {
            const avatar = member.querySelector('.member-avatar');
            if (avatar) {
                if (isSpeaking) {
                    avatar.style.boxShadow = '0 0 0 2px #3ba55c';
                } else {
                    avatar.style.boxShadow = 'none';
                }
            }
        }
    });
}