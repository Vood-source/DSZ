const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Хранилище комнат и пользователей
const rooms = {};
const users = {};

// Сервирование статических файлов
app.use(express.static('public'));

// Маршрут для главной страницы
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

// Обработка WebSocket соединений
io.on('connection', (socket) => {
    console.log('Новый пользователь подключен:', socket.id);

    // Получение списка пользователей в комнате
    socket.on('getUsersInRoom', (roomId) => {
        if (rooms[roomId]) {
            socket.emit('usersInRoom', getUsersInRoom(roomId));
        }
    });

    // Получение списка активных комнат
    socket.on('getActiveRooms', () => {
        socket.emit('activeRooms', getActiveRooms());
    });

    // Создание новой комнаты
    socket.on('createRoom', (username) => {
        const roomId = uuidv4();
        rooms[roomId] = {
            id: roomId,
            users: [],
            createdAt: new Date()
        };
        users[socket.id] = { id: socket.id, username, roomId };
        socket.join(roomId);
        rooms[roomId].users.push(socket.id);
        socket.emit('roomCreated', { roomId, username });
        io.to(roomId).emit('userJoined', { username, users: getUsersInRoom(roomId) });
        io.emit('roomListUpdated', getActiveRooms());
    });

    // Подключение к существующей комнате
    socket.on('joinRoom', ({ roomId, username }) => {
        if (!rooms[roomId]) {
            socket.emit('error', 'Комната не найдена');
            return;
        }
        users[socket.id] = { id: socket.id, username, roomId };
        socket.join(roomId);
        rooms[roomId].users.push(socket.id);
        socket.emit('roomJoined', { roomId, username });
        io.to(roomId).emit('userJoined', { username, users: getUsersInRoom(roomId) });
        io.emit('roomListUpdated', getActiveRooms());
    });

    // Обработка текстовых сообщений
    socket.on('sendMessage', ({ roomId, message }) => {
        if (rooms[roomId] && users[socket.id]) {
            const { username } = users[socket.id];
            io.to(roomId).emit('newMessage', {
                id: uuidv4(),
                sender: username,
                content: message,
                timestamp: new Date()
            });
        }
    });

    // Обработка сигналов WebRTC
    socket.on('webrtcSignal', ({ to, signal, type }) => {
        io.to(to).emit('webrtcSignal', { from: socket.id, signal, type });
    });

    // Обработка начала экранной трансляции
    socket.on('startScreenShare', ({ roomId }) => {
        socket.to(roomId).emit('userStartedScreenShare', { userId: socket.id });
    });

    // Обработка остановки экранной трансляции
    socket.on('stopScreenShare', ({ roomId }) => {
        socket.to(roomId).emit('userStoppedScreenShare', { userId: socket.id });
    });

    // Выход из комнаты
    socket.on('leaveRoom', (roomId) => {
        if (users[socket.id] && rooms[roomId]) {
            const { username } = users[socket.id];
            // Уведомляем о прекращении трансляции, если она была активна
            socket.to(roomId).emit('userStoppedScreenShare', { userId: socket.id });

            rooms[roomId].users = rooms[roomId].users.filter(id => id !== socket.id);
            io.to(roomId).emit('userLeft', { username, users: getUsersInRoom(roomId) });
            socket.leave(roomId);
            delete users[socket.id];

            // Удаляем комнату, если она пустая
            if (rooms[roomId] && rooms[roomId].users.length === 0) {
                delete rooms[roomId];
            }
            io.emit('roomListUpdated', getActiveRooms());
        }
    });

    // Отключение пользователя
    socket.on('disconnect', () => {
        if (users[socket.id]) {
            const { roomId, username } = users[socket.id];
            if (rooms[roomId]) {
                // Уведомляем о прекращении трансляции, если она была активна
                socket.to(roomId).emit('userStoppedScreenShare', { userId: socket.id });

                rooms[roomId].users = rooms[roomId].users.filter(id => id !== socket.id);
                io.to(roomId).emit('userLeft', { username, users: getUsersInRoom(roomId) });

                // Удаляем комнату, если она пустая
                if (rooms[roomId].users.length === 0) {
                    delete rooms[roomId];
                }
                io.emit('roomListUpdated', getActiveRooms());
            }
            delete users[socket.id];
        }
        console.log('Пользователь отключен:', socket.id);
    });
});

// Получение списка пользователей в комнате
function getUsersInRoom(roomId) {
    return rooms[roomId]?.users.map(id => ({
        id,
        username: users[id]?.username || 'Неизвестный',
        roomId: users[id]?.roomId || roomId
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

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});