const socket = io();

// ========== DOM REFS ==========
const authContainer = document.getElementById('authContainer');
const chatApp = document.getElementById('chatApp');
const showLoginBtn = document.getElementById('showLoginBtn');
const showSignupBtn = document.getElementById('showSignupBtn');
const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');
const doLogin = document.getElementById('doLogin');
const doSignup = document.getElementById('doSignup');

// New sidebar tabs
const chatsList = document.getElementById('chatsList');
const usersListEl = document.getElementById('usersList'); // used for Users tab
const tabBtns = document.querySelectorAll('.tab-btn');

// Chat header (for DM)
const chatName = document.getElementById('chatName');
const chatAvatar = document.getElementById('chatAvatar');
const chatStatus = document.getElementById('chatStatus');

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
};

// ========== LOGIN ==========
doLogin.onclick = async () => {
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;
  const res = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const data = await res.json();
  if (data.error) alert(data.error);
  else {
    currentUser = data.user;
    authContainer.style.display = 'none';
    chatApp.style.display = 'block';
    document.getElementById('currentUsername').innerText = currentUser.username;
    document.getElementById('currentBio').innerText = currentUser.bio || 'No bio';
    document.getElementById('editUsername').value = currentUser.username;
    document.getElementById('editBio').value = currentUser.bio || '';
    document.querySelector('.sidebar').setAttribute('data-user-count', '0');

    socket.emit('user online', currentUser);
    socket.emit('get messages');       // public chat history
    socket.emit('get stories');
    socket.emit('get reels');
    socket.emit('get_chats');          // DM conversation list
  }
};

// ========== SOCKET EVENTS ==========

// --- Online Users (for both badge and Users tab) ---
socket.on('update online', (users) => {
  allUsers = users;
  // Update online badge
  document.getElementById('userCount').innerText = users.length;
  document.querySelector('.sidebar').setAttribute('data-user-count', users.length);
  // Render Users tab
  renderUsersList(users);
});

// --- Public Chat (for groups later) ---
socket.on('message history', (msgs) => {
  const container = document.getElementById('messagesArea');
  container.innerHTML = '';
  msgs.forEach(msg => appendMessage(msg, false));
});
socket.on('chat message', (msg) => appendMessage(msg, false));

function appendMessage(msg, isPrivate = false) {
  // If private, we handle differently (own logic is inside private handler)
  // For public, we just display
  const isOwn = msg.userId === currentUser?.id;
  const div = document.createElement('div');
  div.className = `message ${isOwn ? 'own' : 'other'}`;
  div.innerHTML = `<div class="sender">${escapeHtml(msg.username)}</div><div>${escapeHtml(msg.text)}</div>`;
  document.getElementById('messagesArea').appendChild(div);
  div.scrollIntoView({ behavior: 'smooth' });
}

// Send public message (will be used for groups later)
document.getElementById('sendBtn').addEventListener('click', () => {
  const input = document.getElementById('messageInput');
  if (input.value.trim()) {
    // If we are in a private chat, send private message
    if (currentChat && currentChat.type === 'dm') {
      socket.emit('private_message', { receiverId: currentChat.userId, text: input.value });
    } else {
      socket.emit('chat message', { userId: currentUser.id, username: currentUser.username, text: input.value });
    }
    input.value = '';
  }
});
document.getElementById('messageInput').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') document.getElementById('sendBtn').click();
});

// --- Private Messages ---
socket.on('private_message', (msg) => {
  if (currentChat && currentChat.conversationId === msg.conversationId) {
    // Display in messages area
    const isOwn = msg.senderId === currentUser.id;
    const div = document.createElement('div');
    div.className = `message ${isOwn ? 'own' : 'other'}`;
    div.innerHTML = `<div class="sender">${escapeHtml(msg.senderName)}</div><div>${escapeHtml(msg.text)}</div>`;
    document.getElementById('messagesArea').appendChild(div);
    div.scrollIntoView({ behavior: 'smooth' });
  }
  // Refresh chat list to update last message
  socket.emit('get_chats');
});

socket.on('private_messages_history', ({ conversationId, messages }) => {
  if (currentChat && currentChat.conversationId === conversationId) {
    const container = document.getElementById('messagesArea');
    container.innerHTML = '';
    messages.forEach(msg => {
      const isOwn = msg.senderId === currentUser.id;
      const div = document.createElement('div');
      div.className = `message ${isOwn ? 'own' : 'other'}`;
      div.innerHTML = `<div class="sender">${escapeHtml(msg.senderName)}</div><div>${escapeHtml(msg.text)}</div>`;
      container.appendChild(div);
    });
    container.scrollTop = container.scrollHeight;
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

// --- Stories & Reels (with likes) ---
socket.on('stories list', (stories) => {
  const row = document.getElementById('storiesRow');
  const addBtn = row.querySelector('.story-add');
  row.innerHTML = '';
  row.appendChild(addBtn);
  stories.forEach(s => addStoryToUI(s));
});
socket.on('new story', (story) => addStoryToUI(story));

socket.on('reels list', (reels) => {
  const grid = document.getElementById('reelsGrid');
  const addBtn = grid.querySelector('.reel-add');
  grid.innerHTML = '';
  grid.appendChild(addBtn);
  reels.forEach(r => addReelToUI(r));
});
socket.on('new reel', (reel) => addReelToUI(reel));

// --- Likes updates ---
socket.on('story_likes_update', ({ storyId, likes }) => {
  const btn = document.querySelector(`.like-btn[data-id="${storyId}"]`);
  if (btn) btn.innerHTML = `❤️ ${likes.length}`;
  // also update viewer like count
  if (document.getElementById('viewerLikeBtn').dataset.storyid === storyId) {
    document.getElementById('viewerLikeCount').innerText = likes.length;
  }
});
socket.on('reel_likes_update', ({ reelId, likes }) => {
  const btn = document.querySelector(`.like-btn[data-reelid="${reelId}"]`);
  if (btn) btn.innerHTML = `❤️ ${likes.length}`;
});

// ========== RENDER FUNCTIONS ==========

// Users list (for Follow/Unfollow)
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

// Chats list (DMs)
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

// Open a DM
function openDM(chat) {
  currentChat = { type: 'dm', userId: chat.userId, conversationId: chat.conversationId };
  // Update header
  chatName.innerText = chat.username;
  chatAvatar.src = chat.avatar || 'https://ui-avatars.com/api/?background=2c2c2e&color=fff&name='+chat.username[0];
  chatStatus.innerText = '🔒 DM';
  // Enable input
  document.getElementById('messageInput').disabled = false;
  document.getElementById('sendBtn').disabled = false;
  // Fetch messages
  socket.emit('get_private_messages', { conversationId: chat.conversationId });
}

// Tab switching
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
      // refresh users list
      socket.emit('get_users');
    }
  });
});

// ========== STORY / REEL UI WITH LIKES ==========
function addStoryToUI(story) {
  const row = document.getElementById('storiesRow');
  const div = document.createElement('div');
  div.className = 'story-item';
  div.onclick = () => viewMedia(story);
  if (story.mediaUrl) {
    if (story.mediaUrl.match(/\.(mp4|webm|ogg)$/i))
      div.innerHTML = `<video src="${story.mediaUrl}" style="width:70px;height:70px;border-radius:50%;object-fit:cover;"></video>`;
    else
      div.innerHTML = `<img src="${story.mediaUrl}" style="width:70px;height:70px;border-radius:50%;object-fit:cover;">`;
  } else {
    div.innerHTML = `<div style="width:70px;height:70px;background:#ffd966;border-radius:50%;display:flex;align-items:center;justify-content:center;">📝</div>`;
  }
  div.innerHTML += `<div class="story-username">${escapeHtml(story.username)}</div>`;
  // Like button
  const likeBtn = document.createElement('button');
  likeBtn.className = 'like-btn';
  likeBtn.dataset.id = story.id;
  likeBtn.innerHTML = '❤️ 0';
  likeBtn.onclick = (e) => {
    e.stopPropagation();
    socket.emit('like_story', { storyId: story.id });
  };
  div.appendChild(likeBtn);
  row.appendChild(div);
  // Fetch initial likes
  socket.emit('get_story_likes', { storyId: story.id });
}

function addReelToUI(reel) {
  const grid = document.getElementById('reelsGrid');
  const div = document.createElement('div');
  div.className = 'reel-item';
  div.onclick = () => viewMedia(reel);
  if (reel.mediaUrl) {
    if (reel.mediaUrl.match(/\.(mp4|webm|ogg)$/i))
      div.innerHTML = `<video src="${reel.mediaUrl}" controls style="width:100%;max-height:200px;"></video>`;
    else
      div.innerHTML = `<img src="${reel.mediaUrl}" style="width:100%;">`;
  } else {
    div.innerHTML = `<div style="padding:40px;text-align:center;">📝 ${escapeHtml(reel.text)}</div>`;
  }
  div.innerHTML += `<div class="reel-caption"><strong>${escapeHtml(reel.username)}</strong>: ${escapeHtml(reel.text || '')}</div>`;
  // Like button
  const likeBtn = document.createElement('button');
  likeBtn.className = 'like-btn';
  likeBtn.dataset.reelid = reel.id;
  likeBtn.innerHTML = '❤️ 0';
  likeBtn.onclick = (e) => {
    e.stopPropagation();
    socket.emit('like_reel', { reelId: reel.id });
  };
  div.appendChild(likeBtn);
  grid.appendChild(div);
  socket.emit('get_reel_likes', { reelId: reel.id });
}

// ========== STORY VIEWER WITH LIKE ==========
function viewMedia(item) {
  const modal = document.getElementById('storyViewerModal');
  const mediaContainer = document.getElementById('storyViewerMedia');
  const captionEl = document.getElementById('storyViewerCaption');
  const userEl = document.getElementById('storyViewerUser');
  const likeBtn = document.getElementById('viewerLikeBtn');
  const likeCount = document.getElementById('viewerLikeCount');

  // Clear and set
  mediaContainer.innerHTML = '';
  captionEl.textContent = '';
  userEl.innerHTML = `<i class="fas fa-user-circle"></i> ${escapeHtml(item.username)}`;

  // Show media
  if (item.mediaUrl) {
    const isVideo = item.mediaUrl.match(/\.(mp4|webm|ogg|mov)$/i);
    if (isVideo) {
      const video = document.createElement('video');
      video.src = item.mediaUrl;
      video.controls = true;
      video.autoplay = true;
      video.playsInline = true;
      mediaContainer.appendChild(video);
      video.addEventListener('loadeddata', () => video.play().catch(() => {}));
    } else {
      const img = document.createElement('img');
      img.src = item.mediaUrl;
      img.alt = item.text || 'Story media';
      mediaContainer.appendChild(img);
    }
  } else {
    mediaContainer.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;min-height:200px;background:#2a2a2e;border-radius:16px;padding:40px;width:100%;"><span style="font-size:48px;color:#ffd966;">📝</span></div>`;
  }

  if (item.text && item.text.trim()) captionEl.textContent = item.text;

  // Set like button state
  likeBtn.dataset.id = item.id;
  likeBtn.dataset.type = item.type || 'story'; // 'story' or 'reel'
  // Fetch likes count
  if (item.type === 'reel') {
    socket.emit('get_reel_likes', { reelId: item.id });
  } else {
    socket.emit('get_story_likes', { storyId: item.id });
  }

  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

// Like button in viewer
document.getElementById('viewerLikeBtn').addEventListener('click', function() {
  const id = this.dataset.id;
  const type = this.dataset.type;
  if (type === 'reel') {
    socket.emit('like_reel', { reelId: id });
  } else {
    socket.emit('like_story', { storyId: id });
  }
});

// Update viewer like count when update arrives
socket.on('story_likes_update', ({ storyId, likes }) => {
  const btn = document.getElementById('viewerLikeBtn');
  if (btn.dataset.id === storyId) {
    document.getElementById('viewerLikeCount').innerText = likes.length;
  }
});
socket.on('reel_likes_update', ({ reelId, likes }) => {
  const btn = document.getElementById('viewerLikeBtn');
  if (btn.dataset.id === reelId) {
    document.getElementById('viewerLikeCount').innerText = likes.length;
  }
});

// Close story viewer
document.getElementById('closeStoryViewer').addEventListener('click', closeViewer);
document.getElementById('storyViewerModal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeViewer();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const modal = document.getElementById('storyViewerModal');
    if (modal.style.display === 'flex') closeViewer();
  }
});
function closeViewer() {
  document.getElementById('storyViewerModal').style.display = 'none';
  document.body.style.overflow = '';
  const video = document.querySelector('#storyViewerMedia video');
  if (video) video.pause();
}

// ========== PROFILE EDIT ==========
const profileModal = document.getElementById('profileModal');
document.getElementById('hamburgerBtn').onclick = () => profileModal.style.display = 'flex';
document.querySelector('.close-modal').onclick = () => profileModal.style.display = 'none';
document.getElementById('saveProfileBtn').onclick = () => {
  const newUsername = document.getElementById('editUsername').value.trim();
  const newBio = document.getElementById('editBio').value;
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
  document.getElementById('uploadTitle').innerText = type === 'stories' ? 'Add Story (expires in 24h)' : 'Upload Reel';
  document.getElementById('uploadModal').style.display = 'flex';
}
document.getElementById('addStoryBtn').onclick = () => openUploadModal('stories');
document.getElementById('addReelBtn').onclick = () => openUploadModal('reels');
document.querySelector('.close-upload').onclick = () => document.getElementById('uploadModal').style.display = 'none';
document.getElementById('confirmUploadBtn').onclick = async () => {
  const fileInput = document.getElementById('uploadFile');
  const text = document.getElementById('uploadText').value;
  if (!fileInput.files[0] && !text) return alert('Please select a file or write text');
  const formData = new FormData();
  if (fileInput.files[0]) formData.append('file', fileInput.files[0]);
  formData.append('type', uploadType);
  formData.append('text', text);
  formData.append('userId', currentUser.id);
  formData.append('username', currentUser.username);
  const res = await fetch('/api/upload', { method: 'POST', body: formData });
  const data = await res.json();
  if (data.success) {
    document.getElementById('uploadModal').style.display = 'none';
    document.getElementById('uploadFile').value = '';
    document.getElementById('uploadText').value = '';
    if (uploadType === 'stories') addStoryToUI(data.post);
    else addReelToUI(data.post);
  }
};

// ========== MOBILE NAVIGATION ==========
const mobileNav = document.getElementById('mobileNav');
if (mobileNav) {
  mobileNav.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      mobileNav.querySelectorAll('button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const view = btn.dataset.view;
      const storiesSection = document.querySelector('.stories-section');
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
        if (storiesSection) storiesSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        const closeBtn = document.getElementById('closeReelsMobile');
        if (closeBtn) closeBtn.click();
      }
    });
  });
}

// ========== UTILITY ==========
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>]/g, function(m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  });
}
// ========== UPLOAD STORY / REEL ==========
let uploadType = 'stories';
function openUploadModal(type) {
  uploadType = type;
  document.getElementById('uploadTitle').innerText = type === 'stories' ? 'Add Story (expires in 24h)' : 'Upload Reel';
  document.getElementById('uploadModal').style.display = 'flex';
}

document.getElementById('addStoryBtn').onclick = () => openUploadModal('stories');
document.getElementById('addReelBtn').onclick = () => openUploadModal('reels');
document.querySelector('.close-upload').onclick = () => document.getElementById('uploadModal').style.display = 'none';

document.getElementById('confirmUploadBtn').onclick = async () => {
  const fileInput = document.getElementById('uploadFile');
  const text = document.getElementById('uploadText').value;
  
  if (!fileInput.files[0] && !text) return alert('Please select a file or write text');
  
  const formData = new FormData();
  if (fileInput.files[0]) formData.append('file', fileInput.files[0]);
  formData.append('type', uploadType);
  formData.append('text', text);
  formData.append('userId', currentUser.id);
  formData.append('username', currentUser.username);
  
  try {
    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (data.success) {
      document.getElementById('uploadModal').style.display = 'none';
      document.getElementById('uploadText').value = '';
      fileInput.value = '';
      alert('Uploaded successfully!');
    } else {
      alert('Upload failed');
    }
  } catch (err) {
    console.error('Upload error:', err);
    alert('Error uploading file');
  }
};

// Helper for security
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
