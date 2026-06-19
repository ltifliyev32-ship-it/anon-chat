const socket = io();

// ========== UTILITY ==========
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatTime(date) {
  const d = new Date(date);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return 'Now';
  if (diff < 3600000) return Math.floor(diff / 60000) + 'm';
  if (diff < 86400000) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diff < 604800000) return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
  return d.toLocaleDateString();
}

// ========== DOM REFS ==========
const authContainer = document.getElementById('authContainer');
const chatApp = document.getElementById('chatApp');
const showLoginBtn = document.getElementById('showLoginBtn');
const showSignupBtn = document.getElementById('showSignupBtn');
const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');
const doLogin = document.getElementById('doLogin');
const doSignup = document.getElementById('doSignup');

const chatsList = document.getElementById('chatsList');
const messagesArea = document.getElementById('messagesArea');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const chatName = document.getElementById('chatName');
const chatAvatar = document.getElementById('chatAvatar');
const chatStatus = document.getElementById('chatStatus');
const userCountDisplay = document.getElementById('userCountDisplay');

const hamburgerBtn = document.getElementById('hamburgerBtn');
const profileModal = document.getElementById('profileModal');
const editUsername = document.getElementById('editUsername');
const editBio = document.getElementById('editBio');
const saveProfileBtn = document.getElementById('saveProfileBtn');
const profileAvatarPreview = document.getElementById('profileAvatarPreview');
const avatarUpload = document.getElementById('avatarUpload');

const uploadModal = document.getElementById('uploadModal');
const uploadFile = document.getElementById('uploadFile');
const uploadText = document.getElementById('uploadText');
const uploadTitle = document.getElementById('uploadTitle');
const confirmUploadBtn = document.getElementById('confirmUploadBtn');
const closeUploadBtn = document.querySelector('.close-upload');

const addStoryBtn = document.getElementById('addStoryBtn');
const addReelBtn = document.getElementById('addReelBtn');
const storiesRow = document.getElementById('storiesRow');
const reelsGrid = document.getElementById('reelsGrid');

const viewerModal = document.getElementById('storyViewerModal');
const viewerMedia = document.getElementById('storyViewerMedia');
const viewerCaption = document.getElementById('storyViewerCaption');
const viewerUser = document.getElementById('storyViewerUser');
const viewerLikeBtn = document.getElementById('viewerLikeBtn');
const viewerLikeCount = document.getElementById('viewerLikeCount');
const closeViewerBtn = document.getElementById('closeStoryViewer');

const bottomBtns = document.querySelectorAll('.bottom-btn');
const mainArea = document.querySelector('.main-area');

let currentUser = null;
let currentChat = null;
let chats = [];
let allUsers = [];

// ========== AUTH TABS ==========
showLoginBtn.onclick = () => {
  loginForm.style.display = 'block';
  signupForm.style.display = 'none';
  showLoginBtn.classList.add('active');
  showSignupBtn.classList.remove('active');
};
showSignupBtn.onclick = () => {
  loginForm.style.display = 'none';
  signupForm.style.display = 'block';
  showSignupBtn.classList.add('active');
  showLoginBtn.classList.remove('active');
};

// ========== SIGNUP ==========
doSignup.onclick = async () => {
  let username = document.getElementById('signupUsername').value.trim();
  const password = document.getElementById('signupPassword').value;
  const bio = document.getElementById('signupBio').value;
  if (!password) return alert('Password required');
  try {
    const res = await fetch('/api/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username || null, password, bio })
    });
    const data = await res.json();
    if (data.error) alert(data.error);
    else {
      alert('Account created! Please login.');
      showLoginBtn.click();
    }
  } catch (err) {
    console.error(err);
    alert('Signup failed');
  }
};

// ========== LOGIN ==========
doLogin.onclick = async () => {
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;
  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (data.error) return alert(data.error);
    currentUser = data.user;
    authContainer.style.display = 'none';
    chatApp.style.display = 'flex';
    document.getElementById('currentUsername').innerText = currentUser.username;
    document.getElementById('currentBio').innerText = currentUser.bio || 'No bio';
    editUsername.value = currentUser.username;
    editBio.value = currentUser.bio || '';
    profileAvatarPreview.src = currentUser.avatar || 'https://ui-avatars.com/api/?background=5b6ee1&color=fff&name=' + currentUser.username[0];

    socket.emit('user online', currentUser);
    socket.emit('get messages');
    socket.emit('get stories');
    socket.emit('get reels');
    socket.emit('get_chats');
  } catch (err) {
    console.error(err);
    alert('Login failed');
  }
};

// ========== SOCKET EVENTS ==========

socket.on('update online', (users) => {
  allUsers = users;
  const count = users.length;
  userCountDisplay.textContent = count + ' online';
  renderUsersList(users);
});

// --- Public Chat ---
socket.on('message history', (msgs) => {
  messagesArea.innerHTML = '';
  msgs.forEach(msg => appendMessage(msg, false));
});
socket.on('chat message', (msg) => appendMessage(msg, false));

function appendMessage(msg, isPrivate = false) {
  const isOwn = msg.userId === currentUser?.id || msg.from === 'You' || msg.from === currentUser?.username;
  const div = document.createElement('div');
  div.className = `message ${isOwn ? 'own' : 'other'} ${isPrivate ? 'private' : ''}`;
  let senderName = msg.username || msg.from || 'Unknown';
  if (isOwn) senderName = 'You';
  div.innerHTML = `
    <div class="sender">${escapeHtml(senderName)}</div>
    <div>${escapeHtml(msg.text)}</div>
    <span class="timestamp">${formatTime(msg.timestamp || Date.now())}</span>
  `;
  messagesArea.appendChild(div);
  messagesArea.scrollTop = messagesArea.scrollHeight;
}

// --- Private Messages ---
socket.on('private_message', (msg) => {
  if (currentChat && currentChat.conversationId === msg.conversationId) {
    const isOwn = msg.senderId === currentUser.id || msg.from === 'You';
    const div = document.createElement('div');
    div.className = `message ${isOwn ? 'own' : 'other'} private`;
    div.innerHTML = `
      <div class="sender">🔒 ${isOwn ? 'You' : escapeHtml(msg.senderName || msg.from)}</div>
      <div>${escapeHtml(msg.text)}</div>
      <span class="timestamp">${formatTime(msg.timestamp || Date.now())}</span>
    `;
    messagesArea.appendChild(div);
    messagesArea.scrollTop = messagesArea.scrollHeight;
  }
  socket.emit('get_chats');
});

socket.on('private_message_error', ({ error }) => {
  alert('Private message error: ' + error);
});

socket.on('private_messages_history', ({ conversationId, messages }) => {
  if (currentChat && currentChat.conversationId === conversationId) {
    messagesArea.innerHTML = '';
    messages.forEach(msg => {
      const isOwn = msg.senderId === currentUser.id;
      const div = document.createElement('div');
      div.className = `message ${isOwn ? 'own' : 'other'} private`;
      div.innerHTML = `
        <div class="sender">${isOwn ? 'You' : escapeHtml(msg.senderName)}</div>
        <div>${escapeHtml(msg.text)}</div>
        <span class="timestamp">${formatTime(msg.timestamp)}</span>
      `;
      messagesArea.appendChild(div);
    });
    messagesArea.scrollTop = messagesArea.scrollHeight;
  }
});

// --- Chats List ---
socket.on('chats_list', (chatsData) => {
  chats = chatsData;
  renderChats(chatsData);
});

// --- Follow/Unfollow ---
socket.on('follow_success', ({ targetUserId }) => {
  const btn = document.querySelector(`.follow-btn[data-userid="${targetUserId}"]`);
  if (btn) {
    btn.classList.add('following');
    btn.textContent = 'Unfollow';
  }
});
socket.on('unfollow_success', ({ targetUserId }) => {
  const btn = document.querySelector(`.follow-btn[data-userid="${targetUserId}"]`);
  if (btn) {
    btn.classList.remove('following');
    btn.textContent = 'Follow';
  }
});

// --- Stories & Reels ---
socket.on('stories list', (stories) => {
  const addBtn = storiesRow?.querySelector('.story-add');
  if (storiesRow) {
    storiesRow.innerHTML = '';
    if (addBtn) storiesRow.appendChild(addBtn);
    stories.forEach(s => addStoryToUI(s));
  }
});
socket.on('new story', (story) => addStoryToUI(story));

socket.on('reels list', (reels) => {
  const addBtn = reelsGrid?.querySelector('.reel-add');
  if (reelsGrid) {
    reelsGrid.innerHTML = '';
    if (addBtn) reelsGrid.appendChild(addBtn);
    reels.forEach(r => addReelToUI(r));
  }
});
socket.on('new reel', (reel) => addReelToUI(reel));

// --- Likes ---
socket.on('story_likes_update', ({ storyId, likes }) => {
  const btn = document.querySelector(`.like-btn[data-id="${storyId}"]`);
  if (btn) btn.innerHTML = `❤️ ${likes.length}`;
  if (viewerLikeBtn.dataset.id === storyId) {
    viewerLikeCount.innerText = likes.length;
  }
});
socket.on('reel_likes_update', ({ reelId, likes }) => {
  const btn = document.querySelector(`.like-btn[data-reelid="${reelId}"]`);
  if (btn) btn.innerHTML = `❤️ ${likes.length}`;
  if (viewerLikeBtn.dataset.id === reelId) {
    viewerLikeCount.innerText = likes.length;
  }
});

// ========== RENDER FUNCTIONS ==========

function renderChats(chatsData) {
  chatsList.innerHTML = '';
  if (!chatsData || chatsData.length === 0) {
    chatsList.innerHTML = `
      <div style="text-align:center;padding:40px 20px;color:#9ca3af;">
        <i class="fas fa-inbox" style="font-size:32px;display:block;margin-bottom:8px;"></i>
        <p>No conversations yet</p>
        <span style="font-size:13px;">Start messaging someone</span>
      </div>
    `;
    return;
  }
  chatsData.forEach(chat => {
    const div = document.createElement('div');
    div.className = `chat-item ${currentChat?.conversationId === chat.conversationId ? 'active' : ''}`;
    div.dataset.convid = chat.conversationId;
    const lastMsg = chat.lastMsg ? escapeHtml(chat.lastMsg.text) : 'Start chatting';
    const time = chat.lastMsg ? formatTime(chat.lastMsg.timestamp) : '';
    const avatar = chat.avatar || `https://ui-avatars.com/api/?background=5b6ee1&color=fff&name=${chat.username[0]}`;
    div.innerHTML = `
      <img class="avatar" src="${avatar}" alt="${escapeHtml(chat.username)}">
      <div class="info">
        <div class="name">
          ${escapeHtml(chat.username)}
          <span class="time">${time}</span>
        </div>
        <div class="preview">${lastMsg}</div>
      </div>
      ${chat.unread ? `<span class="badge">${chat.unread}</span>` : ''}
    `;
    div.onclick = () => openDM(chat);
    chatsList.appendChild(div);
  });
}

function renderUsersList(users) {
  // For now, we're not displaying users list in the new UI
  // The bottom nav "Users" tab can be implemented later
}

function openDM(chat) {
  currentChat = { type: 'dm', userId: chat.userId, conversationId: chat.conversationId };
  chatName.innerText = chat.username;
  const avatar = chat.avatar || `https://ui-avatars.com/api/?background=5b6ee1&color=fff&name=${chat.username[0]}`;
  chatAvatar.src = avatar;
  chatAvatar.style.display = 'block';
  chatStatus.innerText = 'Online';
  messageInput.disabled = false;
  sendBtn.disabled = false;
  socket.emit('get_private_messages', { conversationId: chat.conversationId });
  renderChats(chats);
  // On mobile, open the chat view
  if (window.innerWidth <= 768) {
    mainArea.classList.add('open');
  }
}

// ========== TAB SWITCHING (Bottom Nav) ==========
bottomBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    bottomBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.dataset.tab;
    if (tab === 'chats') {
      // Close mobile chat view if open
      mainArea.classList.remove('open');
    }
    // Other tabs can be implemented later
  });
});

// ========== STORY / REEL UI ==========
function addStoryToUI(story) {
  if (!storiesRow) return;
  const div = document.createElement('div');
  div.className = 'story-item';
  div.onclick = () => viewMedia(story);
  if (story.mediaUrl) {
    const isVideo = story.mediaUrl.match(/\.(mp4|webm|ogg)$/i);
    div.innerHTML = isVideo
      ? `<video src="${story.mediaUrl}" style="width:70px;height:70px;border-radius:50%;object-fit:cover;"></video>`
      : `<img src="${story.mediaUrl}" style="width:70px;height:70px;border-radius:50%;object-fit:cover;">`;
  } else {
    div.innerHTML = `<div style="width:70px;height:70px;background:#e5e7eb;border-radius:50%;display:flex;align-items:center;justify-content:center;">📝</div>`;
  }
  div.innerHTML += `<div class="story-username">${escapeHtml(story.username)}</div>`;
  const likeBtn = document.createElement('button');
  likeBtn.className = 'like-btn';
  likeBtn.dataset.id = story.id;
  likeBtn.innerHTML = '❤️ 0';
  likeBtn.onclick = (e) => {
    e.stopPropagation();
    socket.emit('like_story', { storyId: story.id });
  };
  div.appendChild(likeBtn);
  storiesRow.appendChild(div);
  socket.emit('get_story_likes', { storyId: story.id });
}

function addReelToUI(reel) {
  if (!reelsGrid) return;
  const div = document.createElement('div');
  div.className = 'reel-item';
  div.onclick = () => viewMedia(reel);
  if (reel.mediaUrl) {
    const isVideo = reel.mediaUrl.match(/\.(mp4|webm|ogg)$/i);
    div.innerHTML = isVideo
      ? `<video src="${reel.mediaUrl}" controls style="width:100%;max-height:200px;"></video>`
      : `<img src="${reel.mediaUrl}" style="width:100%;">`;
  } else {
    div.innerHTML = `<div style="padding:20px;text-align:center;">📝 ${escapeHtml(reel.text)}</div>`;
  }
  div.innerHTML += `<div class="reel-caption"><strong>${escapeHtml(reel.username)}</strong>: ${escapeHtml(reel.text || '')}</div>`;
  const likeBtn = document.createElement('button');
  likeBtn.className = 'like-btn';
  likeBtn.dataset.reelid = reel.id;
  likeBtn.innerHTML = '❤️ 0';
  likeBtn.onclick = (e) => {
    e.stopPropagation();
    socket.emit('like_reel', { reelId: reel.id });
  };
  div.appendChild(likeBtn);
  reelsGrid.appendChild(div);
  socket.emit('get_reel_likes', { reelId: reel.id });
}

// ========== STORY VIEWER ==========
function viewMedia(item) {
  viewerMedia.innerHTML = '';
  viewerCaption.textContent = '';
  viewerUser.innerHTML = `<i class="fas fa-user-circle"></i> ${escapeHtml(item.username)}`;

  if (item.mediaUrl) {
    const isVideo = item.mediaUrl.match(/\.(mp4|webm|ogg|mov)$/i);
    if (isVideo) {
      const video = document.createElement('video');
      video.src = item.mediaUrl;
      video.controls = true;
      video.autoplay = true;
      video.playsInline = true;
      viewerMedia.appendChild(video);
      video.addEventListener('loadeddata', () => video.play().catch(() => {}));
    } else {
      const img = document.createElement('img');
      img.src = item.mediaUrl;
      img.alt = item.text || 'Story media';
      viewerMedia.appendChild(img);
    }
  } else {
    viewerMedia.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;min-height:200px;background:#1a1a2e;border-radius:16px;padding:40px;width:100%;"><span style="font-size:48px;">📝</span></div>`;
  }

  if (item.text && item.text.trim()) viewerCaption.textContent = item.text;

  viewerLikeBtn.dataset.id = item.id;
  viewerLikeBtn.dataset.type = item.type || 'story';
  if (item.type === 'reel') {
    socket.emit('get_reel_likes', { reelId: item.id });
  } else {
    socket.emit('get_story_likes', { storyId: item.id });
  }

  viewerModal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

viewerLikeBtn.addEventListener('click', function() {
  const id = this.dataset.id;
  const type = this.dataset.type;
  if (type === 'reel') {
    socket.emit('like_reel', { reelId: id });
  } else {
    socket.emit('like_story', { storyId: id });
  }
});

function closeViewer() {
  viewerModal.style.display = 'none';
  document.body.style.overflow = '';
  const video = viewerMedia.querySelector('video');
  if (video) video.pause();
}

closeViewerBtn.addEventListener('click', closeViewer);
viewerModal.addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeViewer();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && viewerModal.style.display === 'flex') closeViewer();
});

// ========== SEND MESSAGE ==========
sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendMessage();
});

function sendMessage() {
  const text = messageInput.value.trim();
  if (!text || !currentChat) return;

  if (currentChat.type === 'dm') {
    socket.emit('private_message', { recipient: currentChat.userId, message: text });
  } else {
    socket.emit('chat message', { userId: currentUser.id, username: currentUser.username, text });
  }
  messageInput.value = '';
}

// ========== PROFILE EDIT ==========
hamburgerBtn.addEventListener('click', () => {
  editUsername.value = currentUser.username;
  editBio.value = currentUser.bio || '';
  profileAvatarPreview.src = currentUser.avatar || `https://ui-avatars.com/api/?background=5b6ee1&color=fff&name=${currentUser.username[0]}`;
  profileModal.style.display = 'flex';
});
document.querySelector('.close-modal').addEventListener('click', () => profileModal.style.display = 'none');
profileModal.addEventListener('click', (e) => {
  if (e.target === profileModal) profileModal.style.display = 'none';
});

avatarUpload.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (ev) => { profileAvatarPreview.src = ev.target.result; };
    reader.readAsDataURL(file);
  }
});

saveProfileBtn.addEventListener('click', async () => {
  const newUsername = editUsername.value.trim();
  const newBio = editBio.value;
  if (!newUsername) return alert('Username cannot be empty');
  let avatarUrl = currentUser.avatar || '';
  const file = avatarUpload.files[0];
  if (file) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', 'stories');
    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    const data = await res.json();
    if (data.success) avatarUrl = data.post.mediaUrl;
  }
  socket.emit('update profile', { userId: currentUser.id, username: newUsername, bio: newBio, avatar: avatarUrl });
});

socket.on('profile updated', ({ username, bio }) => {
  currentUser.username = username;
  currentUser.bio = bio;
  document.getElementById('currentUsername').innerText = username;
  document.getElementById('currentBio').innerText = bio || 'No bio';
  profileModal.style.display = 'none';
});

// ========== UPLOAD STORY / REEL ==========
let uploadType = 'stories';

function openUploadModal(type) {
  uploadType = type;
  uploadTitle.innerText = type === 'stories' ? 'Add Story (expires in 24h)' : 'Upload Reel';
  uploadModal.style.display = 'flex';
}

document.getElementById('addStoryBtn')?.addEventListener('click', () => openUploadModal('stories'));
document.getElementById('addReelBtn')?.addEventListener('click', () => openUploadModal('reels'));
closeUploadBtn?.addEventListener('click', () => uploadModal.style.display = 'none');

confirmUploadBtn.addEventListener('click', async () => {
  const file = uploadFile.files[0];
  const text = uploadText.value.trim();
  if (!file && !text) return alert('Please select a file or write text');

  const formData = new FormData();
  if (file) formData.append('file', file);
  formData.append('type', uploadType);
  formData.append('text', text);
  formData.append('userId', currentUser.id);
  formData.append('username', currentUser.username);

  try {
    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    const data = await res.json();
    if (data.success) {
      uploadModal.style.display = 'none';
      uploadFile.value = '';
      uploadText.value = '';
      if (uploadType === 'stories') addStoryToUI(data.post);
      else addReelToUI(data.post);
    } else {
      alert('Upload failed: ' + (data.error || 'Unknown error'));
    }
  } catch (err) {
    console.error('Upload error:', err);
    alert('Error uploading file');
  }
});

// ========== CLOSE MOBILE CHAT ==========
// Close chat when clicking outside on mobile (optional)
document.addEventListener('click', (e) => {
  if (window.innerWidth <= 768 && mainArea.classList.contains('open')) {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar.contains(e.target) && !mainArea.contains(e.target)) {
      mainArea.classList.remove('open');
    }
  }
});

// ========== INIT ==========
console.log('AnonChat UI loaded successfully!');
