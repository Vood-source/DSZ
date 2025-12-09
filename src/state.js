// Этот модуль теперь будет оберткой над БД
let db;

function setDB(database) {
    db = database;
}

// Получение списка пользователей в комнате
async function getUsersInRoom(roomId) {
    if (!db) return [];
    // Получаем пользователей, которые сейчас находятся в этой комнате
    // В данном случае мы полагаемся на то, что поле room_id обновляется при входе/выходе
    return await db.all('SELECT socket_id as id, username, room_id as roomId, avatar, status FROM users WHERE room_id = ?', roomId);
}

// Получение списка всех активных комнат
async function getActiveRooms() {
    if (!db) return [];
    const rooms = await db.all('SELECT * FROM rooms');
    // Для каждой комнаты нужно посчитать количество пользователей
    const activeRooms = [];
    for (const room of rooms) {
        const count = await db.get('SELECT COUNT(*) as count FROM users WHERE room_id = ?', room.id);
        activeRooms.push({
            id: room.id,
            userCount: count.count,
            createdAt: room.created_at
        });
    }
    return activeRooms;
}

// Добавление пользователя
async function addUser(user) {
    if (!db) return;
    await db.run(
        'INSERT OR REPLACE INTO users (socket_id, username, avatar, status, room_id) VALUES (?, ?, ?, ?, ?)',
        user.id, user.username, user.avatar, user.status, user.roomId
    );
}

// Обновление пользователя
async function updateUser(socketId, updates) {
    if (!db) return;
    const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = Object.values(updates);
    await db.run(`UPDATE users SET ${fields} WHERE socket_id = ?`, ...values, socketId);
}

// Удаление пользователя (или очистка room_id при выходе)
async function removeUser(socketId) {
    if (!db) return;
    await db.run('DELETE FROM users WHERE socket_id = ?', socketId);
}

// Получение пользователя
async function getUser(socketId) {
    if (!db) return null;
    const user = await db.get('SELECT socket_id as id, username, room_id as roomId, avatar, status FROM users WHERE socket_id = ?', socketId);
    return user;
}

// Создание комнаты
async function createRoom(room) {
    if (!db) return;
    await db.run('INSERT INTO rooms (id, name) VALUES (?, ?)', room.id, room.name || room.id);
}

// Удаление комнаты (если пустая)
async function deleteRoomIfEmpty(roomId) {
    if (!db) return;
    const count = await db.get('SELECT COUNT(*) as count FROM users WHERE room_id = ?', roomId);
    if (count.count === 0) {
        await db.run('DELETE FROM rooms WHERE id = ?', roomId);
    }
}

// Сохранение сообщения
async function saveMessage(message) {
    if (!db) return;
    await db.run(
        'INSERT INTO messages (id, room_id, sender, content, timestamp) VALUES (?, ?, ?, ?, ?)',
        message.id, message.roomId, message.sender, message.content, message.timestamp
    );
}

module.exports = {
    setDB,
    getUsersInRoom,
    getActiveRooms,
    addUser,
    updateUser,
    removeUser,
    getUser,
    createRoom,
    deleteRoomIfEmpty,
    saveMessage
};