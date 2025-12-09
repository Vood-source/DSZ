// Хранилище комнат и пользователей
const rooms = {};
const users = {};

// Получение списка пользователей в комнате
function getUsersInRoom(roomId) {
    return rooms[roomId]?.users.map(id => ({
        id,
        username: users[id]?.username || 'Неизвестный',
        roomId: users[id]?.roomId || roomId,
        avatar: users[id]?.avatar || '😊',
        status: users[id]?.status || 'В сети'
    })) || [];
}

// Получение списка всех активных комнат
function getActiveRooms() {
    return Object.values(rooms).map(room => ({
        id: room.id,
        userCount: room.users.length,
        createdAt: room.createdAt
    }));
}

module.exports = {
    rooms,
    users,
    getUsersInRoom,
    getActiveRooms
};