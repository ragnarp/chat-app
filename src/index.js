const path = require('path');
const http = require('http');
const express = require('express');
const socketio = require('socket.io');
const Filter = require('bad-words');
const {
  addUser,
  getUser,
  removeUser,
  getUsersInRoom,
} = require('./utils/users');
const {
  generateMessage,
  generateLocationMessage,
} = require('./utils/messages');

const app = express();
const server = http.createServer(app);
const io = socketio(server);
const port = process.env.PORT || 3000;
const publicDirectoryPath = path.join(__dirname, '../public');

app.use(express.static(publicDirectoryPath));

// Events

io.on('connection', (socket) => {
  console.log('New Web Socket Connection');

  socket.on('join', (options, callback) => {
    //spreed parameter!
    const { error, user } = addUser({ id: socket.id, ...options });

    if (error) {
      return callback(error);
    }
    //use the trimmed version of room
    socket.join(user.room);

    socket.emit('message', generateMessage('Admin', 'Welcome!'));
    socket.broadcast
      .to(user.room)
      .emit(
        'message',
        generateMessage('Admin', `${user.username} has joined!`)
      );

    io.to(user.room).emit('roomData', {
      room: user.room,
      users: getUsersInRoom(user.room),
    });

    //notify the client that he was able to join successfully!
    callback();
  });
  //Listen for client sendMessage
  socket.on('sendMessage', (message, callback) => {
    console.log('Received sendMessage event: ', message);
    const filter = new Filter();
    if (filter.isProfane(message.text)) {
      return callback('Profanity is not allowed!');
    }
    const user = getUser(socket.id);
    if (!user) {
      console.log('User not found for socket id: ', socket.id);
      return callback('Use not found!');
    }
    //emit to all clients in same room
    io.to(user.room).emit('message', generateMessage(user.username, message));
    callback();
  });

  //Listen for client sendLocation
  socket.on('sendLocation', (coords, callback) => {
    console.log('Received sendLocatin event: ', coords);
    const user = getUser(socket.id);
    if (!user) {
      console.log('User not found for socket id: ', socket.id);
      return callback('Use not found!');
    }
    //emit location message to all clients
    io.to(user.room).emit(
      'locationMessage',
      generateLocationMessage(
        user.username,
        `https://google.com/maps?q=${coords.latitude},${coords.longitude}`
      )
    );

    callback();
  });
  socket.on('disconnect', () => {
    const user = removeUser(socket.id);
    if (user) {
      io.to(user.room).emit(
        'message',
        generateMessage('Admin', `${user.username} has left!`)
      );

      //notify the room change
      io.to(user.room).emit('roomData', {
        room: user.room,
        users: getUsersInRoom(user.room),
      });
    }
  });
});

server.listen(port, () => {
  console.log('Chat-app Running on ' + port);
});

module.exports = { server, app };
