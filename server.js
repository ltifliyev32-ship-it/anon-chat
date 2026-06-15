const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);

// CORS konfiqurasiyası (Render üçün vacibdir)
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Fayl sistemini və static qovluqları təyin et
const publicPath = path.join(__dirname, 'public');
const uploadDir = path.join(__dirname, 'uploads');

if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

app.use(express.static(publicPath));
app.use('/uploads', express.static(uploadDir));

// Multer konfiqurasiyası
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, unique + path.extname(file.originalname));
  }
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

app.post('/upload', upload.single('media'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({ url: `/uploads/${req.file.filename}` });
});

// Məlumat bazası (In-memory)
const users = new Map();
const userDetails = new Map();
const groups = new Map();
const messages = new Map();
const stories = [];

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('init', (data) => {
    const { userId, nickname, avatar } = data;
    users.set(socket.id, { userId, nickname, avatar });
    userDetails.set(userId, { nickname, avatar, online: true, socketId: socket.id });
    
    // Bütün istifadəçiləri yenilə
    const allUsers = Array.from(userDetails.values());
    socket.emit('init_ack', { users: allUsers, groups: Array.from(groups.values()), stories });
    io.emit('update_user_list', allUsers);
  });

  socket.on('send_message', (payload) => {
    const sender = users.get(socket.id);
    if (!sender) return;
    
    const msgObj = {
      id: Date.now(),
      senderId: sender.userId,
      senderName: sender.nickname,
      content: payload.content,
      timestamp: Date.now()
    };
    
    io.emit('new_message', msgObj);
  });

  socket.on('disconnect', () => {
    users.delete(socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ Server is running on port ${PORT}`);
});
