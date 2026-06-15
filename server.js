const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static('public'));

// In‑memory storage
const users = new Map(); // socketId -> { id, nickname, bio, online }

io.on('connection', (socket) => {
  console.log('New user connected:', socket.id);

  // When user sets their nickname (after login)
  socket.on('set nickname', ({ nickname, bio }) => {
    const userId = socket.id;
    const finalNick = nickname || `Anonim_${Math.floor(10000 + Math.random() * 90000)}`;
    const userData = {
      id: userId,
      nickname: finalNick,
      bio: bio || '',
      online: true
    };
    users.set(socket.id, userData);
    socket.emit('login success', userData);
    // Broadcast updated user list to everyone
    const allUsers = Array.from(users.values());
    io.emit('users list', allUsers);
  });

  // Update profile (nickname & bio)
  socket.on('update profile', ({ nickname, bio }) => {
    const user = users.get(socket.id);
    if (user) {
      user.nickname = nickname;
      user.bio = bio;
      users.set(socket.id, user);
      socket.emit('profile updated', user);
      // Broadcast updated user list
      const allUsers = Array.from(users.values());
      io.emit('users list', allUsers);
    }
  });

  // Send chat message
  socket.on('chat message', (msg) => {
    const user = users.get(socket.id);
    if (user) {
      io.emit('chat message', {
        id: Date.now(),
        userId: user.id,
        nickname: user.nickname,
        text: msg,
        timestamp: new Date().toISOString()
      });
    }
  });

  // User disconnects
  socket.on('disconnect', () => {
    users.delete(socket.id);
    const allUsers = Array.from(users.values());
    io.emit('users list', allUsers);
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
