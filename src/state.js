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
        // Получаем комнаты и количество пользователей
        const rooms = await db.all(`
            SELECT r.id, r.created_at as createdAt, COUNT(u.socket_id) as userCount
            FROM rooms r
            LEFT JOIN users u ON r.id = u.room_id
            GROUP BY r.id
        `);

        // Если комнат нет, возвращаем пустой массив
        if (rooms.length === 0) return [];

        // Получаем пользователей для всех комнат одним запросом
        // Ограничиваем количество пользователей на клиенте или здесь, если нужно
        // В SQLite нет простого способа сделать LIMIT внутри GROUP BY или PARTITION BY без оконных функций
        // Поэтому получим всех пользователей активных комнат и сгруппируем в JS
        const roomIds = rooms.map(r => `'${r.id}'`).join(',');
        if (roomIds) {
            const allUsers = await db.all(`SELECT room_id, avatar, username FROM users WHERE room_id IN (${roomIds})`);
            
            // Группируем пользователей по комнатам
            const usersByRoom = {};
            allUsers.forEach(user => {
                if (!usersByRoom[user.room_id]) {
                    usersByRoom[user.room_id] = [];
                }
                if (usersByRoom[user.room_id].length < 5) { // Ограничиваем до 5 аватаров
                    usersByRoom[user.room_id].push({ avatar: user.avatar, username: user.username });
                }
            });

            // Добавляем пользователей к комнатам
            rooms.forEach(room => {
                room.users = usersByRoom[room.id] || [];
            });
        } else {
            rooms.forEach(room => room.users = []);
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