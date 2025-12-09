const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const setupSocket = require('./src/socket');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Сервирование статических файлов
app.use(express.static('public'));

// Маршрут для главной страницы
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

// Настройка Socket.IO
setupSocket(io);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});