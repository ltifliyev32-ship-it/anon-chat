const socket = io();

// ========== UTILITY ==========
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
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
const usersListEl = document.getElementById('usersList');
const tabBtns = document.querySelectorAll('.tab-btn');

const chatName = document.getElementById('chatName');
const chatAvatar = document.getElementById('chatAvatar');
const chatStatus = document.getElementById('chatStatus');

const messagesArea = document.getElementById('messagesArea');
const messageInput = document.getElementById('messageInput');
const recipientInput = document.getElementById('recipientInput'); // NEW
const sendBtn = document.getElementById('sendBtn');
const hamburgerBtn = document.getElementById('hamburgerBtn');
const profileModal = document.getElementById('profileModal');
const editUsername = document.getElementById('editUsername');
const editBio = document.getElementById('editBio');
const saveProfileBtn = document.getElementById('saveProfileBtn');

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

const mobileNav = document.getElementById('mobileNav');

let currentUser = null;
let currentChat = null; // { type: 'dm', userId, conversationId }
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
    chatApp.style.display = 'block';
    document.getElementById('currentUsername').innerText = currentUser.username;
    document.getElementById('currentBio').innerText = currentUser.bio || 'No bio';
    editUsername.value = currentUser.username;
    editBio.value = currentUser.bio || '';
    document.querySelector('.sidebar').setAttribute('data-user-count', '0');

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
  document.getElementById('userCount').innerText = users.length;
  document.querySelector('.sidebar').setAttribute('data-user-count', users.length);
  renderUsersList(users);

  // Update datalist for recipient auto-completion
  const datalist = document.getElementById('onlineUsersList');
  if (datalist) {
    datalist.innerHTML = '';
    users.forEach(username => {
      if (username !== currentUser.username) {
        const option = document.createElement('option');
        option.value = username;
        datalist.appendChild(option);
      }
    });
  }
});

// --- Public Chat (for groups / public channels) ---
socket.on('message history', (msgs) => {
  messagesArea.innerHTML = '';
  msgs.forEach(msg => appendMessage(msg, false));
});
socket.on('chat message', (msg) => appendMessage(msg, false));

function appendMessage(msg, isPrivate = false) {
  const isOwn = msg.userId === currentUser?.id;
  const div = document.createElement('div');
  div.className = `message ${isOwn ? 'own' : 'other'}`;
  div.innerHTML = `<div class="sender">${escapeHtml(msg.username)}</div><div>${escapeHtml(msg.text)}</div>`;
  messagesArea.appendChild(div);
  div.scrollIntoView({ behavior: 'smooth' });
}

// --- Private Messages ---
socket.on('private_message', (msg) => {
  // msg: { from, text, timestamp }
  const isOwn = (msg.from === 'You' || msg.from === currentUser.username);
  const div = document.createElement('div');
  div.className = `message ${isOwn ? 'own' : 'other'} private`;
  div.innerHTML = `<div class="sender">🔒 ${escapeHtml(msg.from)}</div><div>${escapeHtml(msg.text)}</div>`;
  messagesArea.appendChild(div);
  div.scrollIntoView({ behavior: 'smooth' });
});

socket.on('private_message_error', ({ error }) => {
  alert('Private message error: ' + error);
});

// --- Private Messages History (for DMs) ---
socket.on('private_messages_history', ({ conversationId, messages }) => {
  if (currentChat && currentChat.conversationId === conversationId) {
    messagesArea.innerHTML = '';
    messages.forEach(msg => {
      const isOwn = msg.senderId === currentUser.id;
      const div = document.createElement('div');
      div.className = `message ${isOwn ? 'own' : 'other'}`;
      div.innerHTML = `<div class="sender">${escapeHtml(msg.senderName)}</div><div>${escapeHtml(msg.text)}</div>`;
      messagesArea.appendChild(div);
    });
    messagesArea.scrollTop = messagesArea.scrollHeight;
  }
});

// --- Chats List (for DM sidebar) ---
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
  const addBtn = storiesRow.querySelector('.story-add');
  storiesRow.innerHTML = '';
  storiesRow.appendChild(addBtn);
  stories.forEach(s => addStoryToUI(s));
});
socket.on('new story', (story) => addStoryToUI(story));

socket.on('reels list', (reels) => {
  const addBtn = reelsGrid.querySelector('.reel-add');
  reelsGrid.innerHTML = '';
  reelsGrid.appendChild(addBtn);
  reels.forEach(r => addReelToUI(r));
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

function renderUsersList(users) {
  usersListEl.innerHTML = '';
  users.forEach(u => {
    if (u.id === currentUser?.id) return;
    const div = document.createElement('div');
    div.className = 'user-item';
    const following = currentUser?.following?.includes(u.id) || false;
    div.innerHTML = `
      <img class="chat-avatar" src="${u.avatar || 'https://ui-avatars.com/api/?background=555&color=fff&name='+u.username[0]}" style="width:40px;height:40px;border-radius:50%;">
      <div class="user-info">
        <strong class="user-name">${escapeHtml(u.username)}</strong>
        <div class="user-bio">${escapeHtml(u.bio || '')}</div>
      </div>
      <button class="follow-btn ${following ? 'following' : ''}" data-userid="${u.id}">
        ${following ? 'Unfollow' : 'Follow'}
      </button>
    `;
    const followBtn = div.querySelector('.follow-btn');
    followBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const userId = followBtn.dataset.userid;
      if (followBtn.classList.contains('following')) {
        socket.emit('unfollow_user', { targetUserId: userId });
      } else {
        socket.emit('follow_user', { targetUserId: userId });
      }
    });
    usersListEl.appendChild(div);
  });
}

function renderChats(chatsData) {
  chatsList.innerHTML = '';
  chatsData.forEach(chat => {
    const div = document.createElement('div');
    div.className = 'chat-item';
    div.dataset.convid = chat.conversationId;
    const lastMsg = chat.lastMsg ? escapeHtml(chat.lastMsg.text) : 'Start chatting';
    const time = chat.lastMsg ? new Date(chat.lastMsg.timestamp).toLocaleTimeString() : '';
    div.innerHTML = `
      <img class="chat-avatar" src="${chat.avatar || 'https://ui-avatars.com/api/?background=555&color=fff&name='+chat.username[0]}" style="width:48px;height:48px;border-radius:50%;">
      <div class="chat-info">
        <div class="chat-name">${escapeHtml(chat.username)}</div>
        <div class="last-msg">${lastMsg}</div>
      </div>
      <div class="timestamp">${time}</div>
    `;
    div.onclick = () => openDM(chat);
    chatsList.appendChild(div);
  });
}

function openDM(chat) {
  currentChat = { type: 'dm', userId: chat.userId, conversationId: chat.conversationId };
  chatName.innerText = chat.username;
  chatAvatar.src = chat.avatar || 'https://ui-avatars.com/api/?background=2c2c2e&color=fff&name='+chat.username[0];
  chatStatus.innerText = '🔒 DM';
  messageInput.disabled = false;
  sendBtn.disabled = false;
  recipientInput.value = chat.username; // Auto-fill recipient
  socket.emit('get_private_messages', { conversationId: chat.conversationId });
}

// ========== TAB SWITCHING ==========
tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    tabBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.dataset.tab;
    if (tab === 'chats') {
      chatsList.style.display = 'block';
      usersListEl.style.display = 'none';
    } else {
      chatsList.style.display = 'none';
      usersListEl.style.display = 'block';
      socket.emit('get_users');
    }
  });
});

// ========== STORY / REEL UI ==========
function addStoryToUI(story) {
  const div = document.createElement('div');
  div.className = 'story-item';
  div.onclick = () => viewMedia(story);
  if (story.mediaUrl) {
    const isVideo = story.mediaUrl.match(/\.(mp4|webm|ogg)$/i);
    div.innerHTML = isVideo
      ? `<video src="${story.mediaUrl}" style="width:70px;height:70px;border-radius:50%;object-fit:cover;"></video>`
      : `<img src="${story.mediaUrl}" style="width:70px;height:70px;border-radius:50%;object-fit:cover;">`;
  } else {
    div.innerHTML = `<div style="width:70px;height:70px;background:#ffd966;border-radius:50%;display:flex;align-items:center;justify-content:center;">📝</div>`;
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
  const div = document.createElement('div');
  div.className = 'reel-item';
  div.onclick = () => viewMedia(reel);
  if (reel.mediaUrl) {
    const isVideo = reel.mediaUrl.match(/\.(mp4|webm|ogg)$/i);
    div.innerHTML = isVideo
      ? `<video src="${reel.mediaUrl}" controls style="width:100%;max-height:200px;"></video>`
      : `<img src="${reel.mediaUrl}" style="width:100%;">`;
  } else {
    div.innerHTML = `<div style="padding:40px;text-align:center;">📝 ${escapeHtml(reel.text)}</div>`;
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
    viewerMedia.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;min-height:200px;background:#2a2a2e;border-radius:16px;padding:40px;width:100%;"><span style="font-size:48px;color:#ffd966;">📝</span></div>`;
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

// ========== SEND MESSAGE (UPDATED) ==========
sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendMessage();
});

function sendMessage() {
  const text = messageInput.value.trim();
  if (!text) return;

  const recipient = recipientInput.value.trim();

  if (recipient) {
    // Private message
    socket.emit('private_message', { recipient, message: text });
  } else {
    // Public message (fallback)
    socket.emit('chat message', { userId: currentUser.id, username: currentUser.username, text });
  }
  messageInput.value = '';
}

// ========== PROFILE EDIT ==========
hamburgerBtn.onclick = () => profileModal.style.display = 'flex';
document.querySelector('.close-modal').onclick = () => profileModal.style.display = 'none';

saveProfileBtn.onclick = () => {
  const newUsername = editUsername.value.trim();
  const newBio = editBio.value;
  if (!newUsername) return alert('Username cannot be empty');
  socket.emit('update profile', { userId: currentUser.id, username: newUsername, bio: newBio });
};

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

addStoryBtn.onclick = () => openUploadModal('stories');
addReelBtn.onclick = () => openUploadModal('reels');
closeUploadBtn.onclick = () => uploadModal.style.display = 'none';

confirmUploadBtn.onclick = async () => {
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
};

// ========== MOBILE NAVIGATION ==========
if (mobileNav) {
  mobileNav.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      mobileNav.querySelectorAll('button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const view = btn.dataset.view;
      const reelsSidebar = document.querySelector('.reels-sidebar');

      if (view === 'reels') {
        if (reelsSidebar) {
          reelsSidebar.style.display = 'flex';
          reelsSidebar.style.width = '100%';
          reelsSidebar.style.height = '100vh';
          reelsSidebar.style.height = '100dvh';
          reelsSidebar.style.position = 'fixed';
          reelsSidebar.style.top = '0';
          reelsSidebar.style.left = '0';
          reelsSidebar.style.zIndex = '30';
          reelsSidebar.style.background = '#fef9e6';
          reelsSidebar.style.borderLeft = 'none';
          reelsSidebar.style.overflowY = 'auto';
          if (!document.getElementById('closeReelsMobile')) {
            const closeBtn = document.createElement('button');
            closeBtn.id = 'closeReelsMobile';
            closeBtn.innerHTML = '✕';
            closeBtn.style.cssText = `
              position: absolute; top: 16px; right: 16px; font-size: 28px;
              background: none; border: none; color: #ff4d4d; cursor: pointer;
              z-index: 31; font-weight: bold;
            `;
            closeBtn.onclick = () => {
              reelsSidebar.style.display = '';
              reelsSidebar.style.width = '';
              reelsSidebar.style.height = '';
              reelsSidebar.style.position = '';
              reelsSidebar.style.top = '';
              reelsSidebar.style.left = '';
              reelsSidebar.style.zIndex = '';
              reelsSidebar.style.background = '';
              reelsSidebar.style.borderLeft = '';
              reelsSidebar.style.overflowY = '';
              closeBtn.remove();
              mobileNav.querySelectorAll('button').forEach(b => b.classList.remove('active'));
              document.querySelector('[data-view="chat"]').classList.add('active');
            };
            reelsSidebar.appendChild(closeBtn);
          }
        }
      } else if (view === 'stories') {
        const storiesSection = document.querySelector('.stories-section');
        if (storiesSection) storiesSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        const closeBtn = document.getElementById('closeReelsMobile');
        if (closeBtn) closeBtn.click();
      }
    });
  });
}
