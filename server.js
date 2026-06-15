const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: '*' } });

// Ensure uploads folder exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// Multer config for files (images, videos, audio)
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, unique + path.extname(file.originalname));
  }
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB

app.use(express.static('public'));
app.use('/uploads', express.static(uploadDir));

// Upload endpoint
app.post('/upload', upload.single('media'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const url = `/uploads/${req.file.filename}`;
  res.json({ url });
});

// In-memory data store (for demo; replace with DB in production)
const users = new Map();      // socketId -> { userId, nickname, avatar }
const userDetails = new Map(); // userId -> { nickname, avatar, online }
const groups = new Map();     // groupId -> { id, name, members, createdBy }
const messages = new Map();   // conversationId -> array of messages
const stories = [];           // array of story objects

// Helper: generate convId for DM
function getDMConvId(userA, userB) {
  return `dm_${[userA, userB].sort().join('_')}`;
}

io.on('connection', (socket) => {
  console.log('New connection:', socket.id);

  socket.on('init', (data) => {
    const { userId, nickname, avatar } = data;
    users.set(socket.id, { userId, nickname, avatar });
    userDetails.set(userId, { nickname, avatar, online: true, socketId: socket.id });
    // Send existing users, groups, stories to the newcomer
    const allUsers = Array.from(userDetails.values()).map(u => ({
      id: [...userDetails.entries()].find(([id, val]) => val.socketId === u.socketId)?.[0],
      nickname: u.nickname,
      avatar: u.avatar,
      online: u.online
    }));
    const allGroups = Array.from(groups.values());
    socket.emit('init_ack', { users: allUsers, groups: allGroups, stories });
    // Broadcast updated user list to everyone
    io.emit('update_user_list', allUsers);
  });

  socket.on('update_profile', ({ nickname, avatar }) => {
    const user = users.get(socket.id);
    if (user) {
      user.nickname = nickname;
      user.avatar = avatar;
      userDetails.set(user.userId, { ...userDetails.get(user.userId), nickname, avatar });
      const allUsers = Array.from(userDetails.values()).map(u => ({
        id: [...userDetails.entries()].find(([id, val]) => val.socketId === u.socketId)?.[0],
        nickname: u.nickname,
        avatar: u.avatar,
        online: u.online
      }));
      io.emit('update_user_list', allUsers);
    }
  });

  socket.on('create_group', ({ name, members }) => {
    const creator = users.get(socket.id);
    if (!creator) return;
    const groupId = `group_${Date.now()}`;
    const newGroup = {
      id: groupId,
      name,
      members: [creator.userId, ...members],
      createdBy: creator.userId
    };
    groups.set(groupId, newGroup);
    io.emit('update_groups', Array.from(groups.values()));
  });

  socket.on('fetch_messages', ({ conversationId }) => {
    const msgs = messages.get(conversationId) || [];
    socket.emit('message_history', { conversationId, messages: msgs });
  });

  socket.on('send_message', ({ conversationId, type, toId, groupId, messageType, content }) => {
    const sender = users.get(socket.id);
    if (!sender) return;
    const msgObj = {
      id: Date.now() + '_' + Math.random(),
      senderId: sender.userId,
      senderName: sender.nickname,
      type: messageType,
      content,
      timestamp: Date.now()
    };
    if (!messages.has(conversationId)) messages.set(conversationId, []);
    messages.get(conversationId).push(msgObj);

    // Emit to all members of the conversation
    if (groupId) {
      const group = groups.get(groupId);
      if (group) {
        group.members.forEach(memberId => {
          const memberSocket = [...users.entries()].find(([_, u]) => u.userId === memberId)?.[0];
          if (memberSocket) io.to(memberSocket).emit('new_message', { ...msgObj, conversationId });
        });
      }
    } else if (toId) {
      // DM: send to both participants
      const recipientSocket = [...users.entries()].find(([_, u]) => u.userId === toId)?.[0];
      if (recipientSocket) io.to(recipientSocket).emit('new_message', { ...msgObj, conversationId });
      socket.emit('new_message', { ...msgObj, conversationId });
    }
  });

  socket.on('add_story', ({ mediaUrl, type }) => {
    const user = users.get(socket.id);
    if (!user) return;
    const story = {
      userId: user.userId,
      userNickname: user.nickname,
      userAvatar: user.avatar,
      mediaUrl,
      type,
      timestamp: Date.now()
    };
    stories.unshift(story);
    // keep only last 24h
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    while (stories.length && stories[stories.length-1]?.timestamp < cutoff) stories.pop();
    io.emit('stories_update', stories);
  });

  socket.on('disconnect', () => {
    const user = users.get(socket.id);
    if (user) {
      userDetails.delete(user.userId);
      const allUsers = Array.from(userDetails.values()).map(u => ({
        id: [...userDetails.entries()].find(([id, val]) => val.socketId === u.socketId)?.[0],
        nickname: u.nickname,
        avatar: u.avatar,
        online: u.online
      }));
      io.emit('update_user_list', allUsers);
    }
    users.delete(socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
