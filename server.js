const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Ensure data & uploads folders exist
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
const initFiles = ['users.json', 'messages.json', 'stories.json', 'reels.json'];
initFiles.forEach(file => {
  const filePath = path.join(dataDir, file);
  if (!fs.existsSync(filePath)) writeJSON(file, []);
});

// Multer config for file uploads
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

// ========== AUTH ENDPOINTS ==========
app.post('/api/signup', (req, res) => {
  let { username, password, bio } = req.body;
  const users = readJSON('users.json');
  if (username) {
    if (users.find(u => u.username === username)) {
      return res.status(400).json({ error: 'Username already taken' });
    }
  } else {
    // Generate random unique username
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

// ========== SOCKET.IO ==========
const usersOnline = new Map(); // socketId -> user object

io.on('connection', (socket) => {
  console.log('New socket connection:', socket.id);

  socket.on('user online', (user) => {
    usersOnline.set(socket.id, user);
    io.emit('update online', Array.from(usersOnline.values()));
  });

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

  socket.on('disconnect', () => {
    usersOnline.delete(socket.id);
    io.emit('update online', Array.from(usersOnline.values()));
  });
});

// Upload endpoint for stories & reels
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

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ AnonChat running on http://localhost:${PORT}`);
});
