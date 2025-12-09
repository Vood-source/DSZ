/**
 * Тестовый скрипт для проверки базовой функциональности сервера
 */
const io = require('socket.io-client');
const assert = require('assert');

// Настройки теста
const SERVER_URL = 'http://localhost:3000';
const TEST_USERNAME = 'testuser_' + Math.floor(Math.random() * 1000);
const TEST_ROOM = 'test-room-' + Math.floor(Math.random() * 1000);

let socket1, socket2;

// Тесты
describe('Discord Clone WebRTC Server', () => {
    before(() => {
        // Подключаем два тестовых клиента
        socket1 = io(SERVER_URL);
        socket2 = io(SERVER_URL);
    });

    after(() => {
        // Отключаем клиентов
        if (socket1) socket1.disconnect();
        if (socket2) socket2.disconnect();
    });

    it('Должен создавать комнату', (done) => {
        socket1.on('roomCreated', ({ roomId, username }) => {
            assert.ok(roomId);
            assert.equal(username, TEST_USERNAME + '1');
            done();
        });

        socket1.emit('createRoom', TEST_USERNAME + '1');
    });

    it('Должен подключаться к комнате', (done) => {
        let roomId;

        socket1.on('roomCreated', ({ roomId: newRoomId }) => {
            roomId = newRoomId;
            socket2.emit('joinRoom', { roomId, username: TEST_USERNAME + '2' });
        });

        socket2.on('roomJoined', ({ roomId: joinedRoomId }) => {
            assert.ok(joinedRoomId);
            done();
        });

        socket1.emit('createRoom', TEST_USERNAME + '1');
    });

    it('Должен получать список пользователей в комнате', (done) => {
        let roomId;

        socket1.on('roomCreated', ({ roomId: newRoomId }) => {
            roomId = newRoomId;
            socket2.emit('joinRoom', { roomId, username: TEST_USERNAME + '2' });
        });

        socket2.on('userJoined', ({ users }) => {
            assert.ok(Array.isArray(users));
            assert.equal(users.length, 2);
            done();
        });

        socket1.emit('createRoom', TEST_USERNAME + '1');
    });

    it('Должен обрабатывать отключение пользователя', (done) => {
        let roomId;

        socket1.on('roomCreated', ({ roomId: newRoomId }) => {
            roomId = newRoomId;
            socket2.emit('joinRoom', { roomId, username: TEST_USERNAME + '2' });
        });

        socket2.on('userJoined', () => {
            socket2.disconnect();
        });

        socket1.on('userLeft', ({ users }) => {
            assert.ok(Array.isArray(users));
            assert.equal(users.length, 1);
            done();
        });

        socket1.emit('createRoom', TEST_USERNAME + '1');
    });
});

console.log('Тестовый скрипт готов. Запустите сервер и выполните:');
console.log('npm install mocha assert socket.io-client');
console.log('npx mocha test.js');