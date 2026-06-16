const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// ========== INITIALIZE FOLDERS & JSON FILES ==========
const dataDir = path.join(__dirname, 'data');
const uploadsDir = path.join(__dirname, 'uploads');
const storiesDir = path.join(uploadsDir, 'stories');
const reelsDir = path.join(uploadsDir, 'reels');
[dataDir, uploadsDir, storiesDir, reelsDir].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Helper functions for JSON storage
function readJSON(file) {
  try {
    return JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf8'));
  } catch (err) {
    return [];
  }
}
function writeJSON(file, data) {
  fs.writeFileSync(path.join(dataDir, file), JSON.stringify(data, null, 2));
}

// Initialize empty JSON files if not present
const initFiles = ['users.json', 'messages.json', 'stories.json', 'reels.json', 'follows.json', 'private_messages.json', 'story_likes.json', 'reel_likes.json'];
initFiles.forEach(file => {
  const filePath = path.join(dataDir, file);
  if (!fs.existsSync(filePath)) {
    if (file === 'private_messages.json') writeJSON(file, { conversations: {} });
    else if (file === 'follows.json' || file === 'story_likes.json' || file === 'reel_likes.json') writeJSON(file, {});
    else writeJSON(file, []);
  }
});

// ========== MULTER CONFIG ==========
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const type = req.body.type || 'stories';
    cb(null, path.join(uploadsDir, type));
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, unique + path.extname(file.originalname));
  }
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

app.use(express.static('public'));
app.use('/uploads', express.static(uploadsDir));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ========== HELPERS ==========
function getDMConvId(userA, userB) {
  return `dm_${[userA, userB].sort().join('_')}`;
}

// ========== DATA ACCESSORS ==========
function getFollows() { return readJSON('follows.json') || {}; }
function saveFollows(data) { writeJSON('follows.json', data); }

function getPrivateMessages() {
  const data = readJSON('private_messages.json');
  return data && data.conversations ? data : { conversations: {} };
}
function savePrivateMessages(data) { writeJSON('private_messages.json', data); }

function getStoryLikes() { return readJSON('story_likes.json') || {}; }
function saveStoryLikes(data) { writeJSON('story_likes.json', data); }
function getReelLikes() { return readJSON('reel_likes.json') || {}; }
function saveReelLikes(data) { writeJSON('reel_likes.json', data); }

// ========== AUTH ENDPOINTS ==========
app.post('/api/signup', (req, res) => {
  let { username, password, bio } = req.body;
  const users = readJSON('users.json');
  if (username) {
    if (users.find(u => u.username === username)) {
      return res.status(400).json({ error: 'Username already taken' });
    }
  } else {
    let unique = false;
    while (!unique) {
      const randomNum = Math.floor(Math.random() * 100000);
      username = `Anonim_${randomNum}`;
      if (!users.find(u => u.username === username)) unique = true;
    }
  }
  const newUser = {
    id: Date.now().toString(),
    username,
    password, // ⚠️ In production, hash this!
    bio: bio || '',
    createdAt: new Date().toISOString()
  };
  users.push(newUser);
  writeJSON('users.json', users);
  res.json({ success: true, user: { id: newUser.id, username: newUser.username, bio: newUser.bio } });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const users = readJSON('users.json');
  const user = users.find(u => u.username === username && u.password === password);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  res.json({ success: true, user: { id: user.id, username: user.username, bio: user.bio } });
});

// ========== UPLOAD ENDPOINT ==========
app.post('/api/upload', upload.single('file'), (req, res) => {
  const { type, text, userId, username } = req.body;
  const fileUrl = req.file ? `/uploads/${type}/${req.file.filename}` : null;
  const newPost = {
    id: Date.now().toString(),
    userId,
    username,
    text: text || '',
    mediaUrl: fileUrl,
    type: type,
    timestamp: new Date().toISOString()
  };
  if (type === 'stories') {
    const stories = readJSON('stories.json');
    stories.unshift(newPost);
    writeJSON('stories.json', stories);
    io.emit('new story', newPost);
  } else {
    const reels = readJSON('reels.json');
    reels.unshift(newPost);
    writeJSON('reels.json', reels);
    io.emit('new reel', newPost);
  }
  res.json({ success: true, post: newPost });
});

// ========== SOCKET.IO ==========
const usersOnline = new Map(); // socketId -> user object

io.on('connection', (socket) => {
  console.log('New socket connection:', socket.id);

  // --- User online ---
  socket.on('user online', (user) => {
    usersOnline.set(socket.id, user);
    io.emit('update online', Array.from(usersOnline.values()));
  });

  // --- Public chat (legacy for groups) ---
  socket.on('get messages', () => {
    const messages = readJSON('messages.json');
    socket.emit('message history', messages);
  });
  socket.on('chat message', (msg) => {
    const messages = readJSON('messages.json');
    const newMsg = { id: Date.now(), ...msg, timestamp: new Date().toISOString() };
    messages.push(newMsg);
    writeJSON('messages.json', messages);
    io.emit('chat message', newMsg);
  });

  // --- Profile update ---
  socket.on('update profile', ({ userId, username, bio }) => {
    const users = readJSON('users.json');
    const userIndex = users.findIndex(u => u.id === userId);
    if (userIndex !== -1) {
      users[userIndex].username = username;
      users[userIndex].bio = bio;
      writeJSON('users.json', users);
      // Update online user data
      for (let [sid, u] of usersOnline.entries()) {
        if (u.id === userId) {
          u.username = username;
          u.bio = bio;
          usersOnline.set(sid, u);
          io.emit('update online', Array.from(usersOnline.values()));
          break;
        }
      }
      socket.emit('profile updated', { username, bio });
    }
  });

  // --- Get all users (for Users tab) ---
  socket.on('get_users', () => {
    const users = readJSON('users.json');
    // Exclude current user? But we want to show all for following.
    socket.emit('all_users', users);
  });

  // --- Follow / Unfollow ---
  socket.on('follow_user', ({ targetUserId }) => {
    const user = usersOnline.get(socket.id);
    if (!user) return;
    const follows = getFollows();
    if (!follows[user.userId]) follows[user.userId] = [];
    if (!follows[user.userId].includes(targetUserId)) {
      follows[user.userId].push(targetUserId);
      saveFollows(follows);
      const targetSocket = [...usersOnline.entries()].find(([_, u]) => u.id === targetUserId)?.[0];
      if (targetSocket) io.to(targetSocket).emit('followed_by', { userId: user.userId, username: user.username });
      socket.emit('follow_success', { targetUserId });
    }
  });
  socket.on('unfollow_user', ({ targetUserId }) => {
    const user = usersOnline.get(socket.id);
    if (!user) return;
    const follows = getFollows();
    if (follows[user.userId]) {
      follows[user.userId] = follows[user.userId].filter(id => id !== targetUserId);
      saveFollows(follows);
      socket.emit('unfollow_success', { targetUserId });
    }
  });

  // --- Private Messages ---
  socket.on('private_message', ({ receiverId, text }) => {
    const sender = usersOnline.get(socket.id);
    if (!sender) return;
    const msgObj = {
      id: Date.now() + '_' + Math.random(),
      senderId: sender.id,
      senderName: sender.username,
      text,
      timestamp: new Date().toISOString()
    };
    const convId = getDMConvId(sender.id, receiverId);
    const privateData = getPrivateMessages();
    if (!privateData.conversations[convId]) privateData.conversations[convId] = [];
    privateData.conversations[convId].push(msgObj);
    savePrivateMessages(privateData);

    // Send to receiver if online
    const receiverSocket = [...usersOnline.entries()].find(([_, u]) => u.id === receiverId)?.[0];
    if (receiverSocket) {
      io.to(receiverSocket).emit('private_message', { ...msgObj, conversationId: convId });
    }
    socket.emit('private_message', { ...msgObj, conversationId: convId });
  });

  // --- Get private messages history ---
  socket.on('get_private_messages', ({ conversationId }) => {
    const privateData = getPrivateMessages();
    const messages = privateData.conversations[conversationId] || [];
    socket.emit('private_messages_history', { conversationId, messages });
  });

  // --- Get chats list (for sidebar) ---
  socket.on('get_chats', () => {
    const user = usersOnline.get(socket.id);
    if (!user) return;
    const privateData = getPrivateMessages();
    const allUsers = readJSON('users.json');
    const chats = [];
    Object.keys(privateData.conversations).forEach(convId => {
      if (convId.includes(user.id)) {
        const otherId = convId.replace('dm_', '').split('_').find(id => id !== user.id);
        if (otherId) {
          const msgs = privateData.conversations[convId];
          const lastMsg = msgs[msgs.length - 1];
          const otherUser = allUsers.find(u => u.id === otherId);
          if (otherUser) {
            chats.push({
              conversationId: convId,
              userId: otherId,
              username: otherUser.username,
              avatar: otherUser.avatar || '',
              lastMsg: lastMsg ? { text: lastMsg.text, timestamp: lastMsg.timestamp } : null
            });
          }
        }
      }
    });
    chats.sort((a, b) => {
      const aTime = a.lastMsg ? new Date(a.lastMsg.timestamp).getTime() : 0;
      const bTime = b.lastMsg ? new Date(b.lastMsg.timestamp).getTime() : 0;
      return bTime - aTime;
    });
    socket.emit('chats_list', chats);
  });

  // --- Stories & Reels (list) ---
  socket.on('get stories', () => {
    let stories = readJSON('stories.json');
    const now = Date.now();
    const active = stories.filter(s => now - new Date(s.timestamp).getTime() < 24 * 60 * 60 * 1000);
    if (active.length !== stories.length) writeJSON('stories.json', active);
    socket.emit('stories list', active);
  });
  socket.on('get reels', () => {
    const reels = readJSON('reels.json');
    socket.emit('reels list', reels);
  });

  // --- Likes ---
  socket.on('like_story', ({ storyId }) => {
    const user = usersOnline.get(socket.id);
    if (!user) return;
    const likes = getStoryLikes();
    if (!likes[storyId]) likes[storyId] = [];
    if (!likes[storyId].includes(user.id)) {
      likes[storyId].push(user.id);
      saveStoryLikes(likes);
      io.emit('story_likes_update', { storyId, likes: likes[storyId] });
    }
  });
  socket.on('like_reel', ({ reelId }) => {
    const user = usersOnline.get(socket.id);
    if (!user) return;
    const likes = getReelLikes();
    if (!likes[reelId]) likes[reelId] = [];
    if (!likes[reelId].includes(user.id)) {
      likes[reelId].push(user.id);
      saveReelLikes(likes);
      io.emit('reel_likes_update', { reelId, likes: likes[reelId] });
    }
  });

  // --- Get likes count (optional) ---
  socket.on('get_story_likes', ({ storyId }) => {
    const likes = getStoryLikes();
    socket.emit('story_likes_update', { storyId, likes: likes[storyId] || [] });
  });
  socket.on('get_reel_likes', ({ reelId }) => {
    const likes = getReelLikes();
    socket.emit('reel_likes_update', { reelId, likes: likes[reelId] || [] });
  });

  // --- Disconnect ---
  socket.on('disconnect', () => {
    usersOnline.delete(socket.id);
    io.emit('update online', Array.from(usersOnline.values()));
    console.log('User disconnected:', socket.id);
  });
});

// ========== START SERVER ==========
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ AnonChat server running on http://localhost:${PORT}`);
});
