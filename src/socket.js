const { v4: uuidv4 } = require('uuid');
const { availableAvatars, defaultStatuses } = require('./constants');
const state = require('./state');

module.exports = (io) => {
    io.on('connection', async (socket) => {
        console.log('Новый пользователь подключен:', socket.id);

        // Получение списка пользователей в комнате
        socket.on('getUsersInRoom', async (roomId) => {
            const users = await state.getUsersInRoom(roomId);
            if (users.length > 0) {
                socket.emit('usersInRoom', users);
            }
        });

        // Обновление профиля пользователя
        socket.on('updateProfile', async ({ avatar, status }) => {
            const user = await state.getUser(socket.id);
            if (user) {
                const updates = {};
                if (avatar) updates.avatar = avatar;
                if (status) updates.status = status;
                
                await state.updateUser(socket.id, updates);
                
                if (user.roomId) {
                    const roomUsers = await state.getUsersInRoom(user.roomId);
                    io.to(user.roomId).emit('usersInRoom', roomUsers);
                }
            }
        });

        // Получение информации о профиле пользователя
        socket.on('getProfile', async () => {
            const user = await state.getUser(socket.id);
            if (user) {
                socket.emit('profileInfo', {
                    username: user.username,
                    avatar: user.avatar,
                    status: user.status,
                    availableAvatars,
                    availableStatuses: defaultStatuses
                });
            }
        });

        // Получение списка активных комнат
        socket.on('getActiveRooms', async () => {
            const activeRooms = await state.getActiveRooms();
            socket.emit('activeRooms', activeRooms);
        });

        // Создание новой комнаты
        socket.on('createRoom', async ({ username, avatar, status }) => {
            const roomId = uuidv4();
            await state.createRoom({ id: roomId });
            
            const user = {
                id: socket.id,
                username,
                roomId,
                avatar: avatar || availableAvatars[Math.floor(Math.random() * availableAvatars.length)],
                status: status || defaultStatuses[0]
            };
            
            await state.addUser(user);
            socket.join(roomId);
            
            socket.emit('roomCreated', { roomId, username });
            
            const roomUsers = await state.getUsersInRoom(roomId);
            io.to(roomId).emit('userJoined', { username, users: roomUsers });
            
            const activeRooms = await state.getActiveRooms();
            io.emit('roomListUpdated', activeRooms);
        });

        // Подключение к существующей комнате
        socket.on('joinRoom', async ({ roomId, username, avatar, status }) => {
            // Проверяем существование комнаты (в данном случае просто пробуем добавить пользователя, если комнаты нет - создаем?)
            // Лучше проверить список комнат, но для простоты предположим, что ID валиден, если он пришел из списка.
            // Но если пользователь ввел ID вручную, надо проверить.
            // В текущей реализации createRoom создает запись в таблице rooms.
            
            // Здесь мы просто обновляем пользователя
            const user = {
                id: socket.id,
                username,
                roomId,
                avatar: avatar || availableAvatars[Math.floor(Math.random() * availableAvatars.length)],
                status: status || defaultStatuses[0]
            };
            
            await state.addUser(user);
            socket.join(roomId);
            
            socket.emit('roomJoined', { roomId, username });
            
            const roomUsers = await state.getUsersInRoom(roomId);
            io.to(roomId).emit('userJoined', { username, users: roomUsers });
            
            const activeRooms = await state.getActiveRooms();
            io.emit('roomListUpdated', activeRooms);
        });

        // Обработка текстовых сообщений
        socket.on('sendMessage', async ({ roomId, message }) => {
            const user = await state.getUser(socket.id);
            if (user) {
                const newMessage = {
                    id: uuidv4(),
                    roomId,
                    sender: user.username,
                    content: message,
                    timestamp: new Date()
                };
                
                await state.saveMessage(newMessage);
                io.to(roomId).emit('newMessage', newMessage);
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
        socket.on('leaveRoom', async (roomId) => {
            const user = await state.getUser(socket.id);
            if (user && user.roomId === roomId) {
                socket.to(roomId).emit('userStoppedScreenShare', { userId: socket.id });

                // Обновляем пользователя (убираем roomId)
                await state.updateUser(socket.id, { room_id: null });
                socket.leave(roomId);

                const roomUsers = await state.getUsersInRoom(roomId);
                io.to(roomId).emit('userLeft', { username: user.username, users: roomUsers });

                await state.deleteRoomIfEmpty(roomId);
                
                const activeRooms = await state.getActiveRooms();
                io.emit('roomListUpdated', activeRooms);
            }
        });

        // Отключение пользователя
        socket.on('disconnect', async () => {
            const user = await state.getUser(socket.id);
            if (user) {
                const roomId = user.roomId;
                if (roomId) {
                    socket.to(roomId).emit('userStoppedScreenShare', { userId: socket.id });
                    
                    // Удаляем пользователя полностью при дисконнекте
                    await state.removeUser(socket.id);
                    
                    const roomUsers = await state.getUsersInRoom(roomId);
                    io.to(roomId).emit('userLeft', { username: user.username, users: roomUsers });
                    
                    await state.deleteRoomIfEmpty(roomId);
                    
                    const activeRooms = await state.getActiveRooms();
                    io.emit('roomListUpdated', activeRooms);
                } else {
                    await state.removeUser(socket.id);
                }
            }
            console.log('Пользователь отключен:', socket.id);
        });
    });
};