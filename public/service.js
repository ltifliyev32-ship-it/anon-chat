const socket = io();

// DOM Elements
const authContainer = document.getElementById('authContainer');
const chatApp = document.getElementById('chatApp');
const showLoginBtn = document.getElementById('showLoginBtn');
const showSignupBtn = document.getElementById('showSignupBtn');
const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');
const doLogin = document.getElementById('doLogin');
const doSignup = document.getElementById('doSignup');

let currentUser = null;

// Auth Tabs
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

// Signup
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

// Login
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
    socket.emit('user online', currentUser);
    socket.emit('get messages');
    socket.emit('get stories');
    socket.emit('get reels');
  }
};

// Socket Chat
socket.on('message history', (msgs) => {
  const container = document.getElementById('messagesArea');
  container.innerHTML = '';
  msgs.forEach(msg => appendMessage(msg));
});
socket.on('chat message', (msg) => appendMessage(msg));
function appendMessage(msg) {
  const isOwn = msg.userId === currentUser?.id;
  const div = document.createElement('div');
  div.className = `message ${isOwn ? 'own' : 'other'}`;
  div.innerHTML = `<div class="sender">${escapeHtml(msg.username)}</div><div>${escapeHtml(msg.text)}</div>`;
  document.getElementById('messagesArea').appendChild(div);
  div.scrollIntoView({ behavior: 'smooth' });
}
document.getElementById('sendBtn').onclick = () => {
  const input = document.getElementById('messageInput');
  if (input.value.trim()) {
    socket.emit('chat message', { userId: currentUser.id, username: currentUser.username, text: input.value });
    input.value = '';
  }
};
document.getElementById('messageInput').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') document.getElementById('sendBtn').click();
});

// Online users
socket.on('update online', (users) => {
  const container = document.getElementById('usersList');
  const countSpan = document.getElementById('userCount');
  countSpan.innerText = users.length;
  container.innerHTML = '';
  users.forEach(u => {
    const li = document.createElement('li');
    li.innerHTML = `<i class="fas fa-user-circle"></i> ${escapeHtml(u.username)} <small>${escapeHtml(u.bio || '')}</small>`;
    container.appendChild(li);
  });
});

// Hamburger Menu – Edit Profile
const modal = document.getElementById('profileModal');
document.getElementById('hamburgerBtn').onclick = () => modal.style.display = 'flex';
document.querySelector('.close-modal').onclick = () => modal.style.display = 'none';
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
  modal.style.display = 'none';
});

// Stories & Reels Upload
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

// Display stories
socket.on('stories list', (stories) => {
  const row = document.getElementById('storiesRow');
  const addBtn = row.querySelector('.story-add');
  row.innerHTML = '';
  row.appendChild(addBtn);
  stories.forEach(s => addStoryToUI(s));
});
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
  row.appendChild(div);
}
socket.on('new story', (story) => addStoryToUI(story));

// Reels
socket.on('reels list', (reels) => {
  const grid = document.getElementById('reelsGrid');
  const addBtn = grid.querySelector('.reel-add');
  grid.innerHTML = '';
  grid.appendChild(addBtn);
  reels.forEach(r => addReelToUI(r));
});
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
  grid.appendChild(div);
}
socket.on('new reel', (reel) => addReelToUI(reel));

function viewMedia(item) {
  alert(`Post by ${item.username}\n${item.text || 'No text'}\nMedia: ${item.mediaUrl || 'text only'}`);
  // In a full version, open a modal with media player
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>]/g, function(m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  });
}
