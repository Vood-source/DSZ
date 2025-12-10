// Этот модуль теперь будет оберткой над БД
let db;

function setDB(database) {
    db = database;
}

// Получение списка пользователей в комнате
async function getUsersInRoom(roomId) {
    if (!db) return [];
    try {
        return await db.all('SELECT socket_id as id, username, room_id as roomId, avatar, status FROM users WHERE room_id = ?', roomId);
    } catch (err) {
        console.error(`Ошибка при получении пользователей комнаты ${roomId}:`, err);
        return [];
    }
}

// Получение списка всех активных комнат (оптимизированный запрос)
async function getActiveRooms() {
    if (!db) return [];
    try {
        const rooms = await db.all(`
            SELECT r.id, r.created_at as createdAt, COUNT(u.socket_id) as userCount
            FROM rooms r
            LEFT JOIN users u ON r.id = u.room_id
            GROUP BY r.id
        `);

        // Для каждой комнаты получаем список аватаров пользователей
        for (const room of rooms) {
            if (room.userCount > 0) {
                const users = await db.all('SELECT avatar, username FROM users WHERE room_id = ? LIMIT 5', room.id);
                room.users = users;
            } else {
                room.users = [];
            }
        }

        return rooms;
    } catch (err) {
        console.error('Ошибка при получении списка комнат:', err);
        return [];
    }
}

// Добавление пользователя
async function addUser(user) {
    if (!db) return;
    try {
        await db.run(
            'INSERT OR REPLACE INTO users (socket_id, username, avatar, status, room_id) VALUES (?, ?, ?, ?, ?)',
            user.id, user.username, user.avatar, user.status, user.roomId
        );
    } catch (err) {
        console.error('Ошибка при добавлении пользователя:', err);
    }
}

// Обновление пользователя
async function updateUser(socketId, updates) {
    if (!db) return;
    try {
        const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
        const values = Object.values(updates);
        if (fields.length > 0) {
            await db.run(`UPDATE users SET ${fields} WHERE socket_id = ?`, ...values, socketId);
        }
    } catch (err) {
        console.error(`Ошибка при обновлении пользователя ${socketId}:`, err);
    }
}

// Удаление пользователя
async function removeUser(socketId) {
    if (!db) return;
    try {
        await db.run('DELETE FROM users WHERE socket_id = ?', socketId);
    } catch (err) {
        console.error(`Ошибка при удалении пользователя ${socketId}:`, err);
    }
}

// Получение пользователя
async function getUser(socketId) {
    if (!db) return null;
    try {
        return await db.get('SELECT socket_id as id, username, room_id as roomId, avatar, status FROM users WHERE socket_id = ?', socketId);
    } catch (err) {
        console.error(`Ошибка при получении пользователя ${socketId}:`, err);
        return null;
    }
}

// Создание комнаты
async function createRoom(room) {
    if (!db) return;
    try {
        await db.run('INSERT INTO rooms (id, name) VALUES (?, ?)', room.id, room.name || room.id);
    } catch (err) {
        console.error('Ошибка при создании комнаты:', err);
    }
}

// Удаление комнаты (если пустая)
async function deleteRoomIfEmpty(roomId) {
    if (!db) return;
    try {
        const count = await db.get('SELECT COUNT(*) as count FROM users WHERE room_id = ?', roomId);
        if (count && count.count === 0) {
            await db.run('DELETE FROM rooms WHERE id = ?', roomId);
        }
    } catch (err) {
        console.error(`Ошибка при удалении комнаты ${roomId}:`, err);
    }
}

// Сохранение сообщения
async function saveMessage(message) {
    if (!db) return;
    try {
        await db.run(
            'INSERT INTO messages (id, room_id, sender, content, timestamp) VALUES (?, ?, ?, ?, ?)',
            message.id, message.roomId, message.sender, message.content, message.timestamp
        );
    } catch (err) {
        console.error('Ошибка при сохранении сообщения:', err);
    }
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