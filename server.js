const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const setupSocket = require('./src/socket');
const initDB = require('./src/db');
const state = require('./src/state');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Сервирование статических файлов
app.use(express.static('public'));

// Маршрут для главной страницы
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

// Инициализация БД и запуск сервера
initDB().then(db => {
    state.setDB(db);
    console.log('База данных инициализирована');

    // Настройка Socket.IO
    setupSocket(io);

    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => {
        console.log(`Сервер запущен на порту ${PORT}`);
    });
}).catch(err => {
    console.error('Ошибка инициализации БД:', err);
});