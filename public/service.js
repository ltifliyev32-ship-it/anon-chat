const socket = io();

// DOM elements
const loginScreen = document.getElementById('loginScreen');
const chatApp = document.getElementById('chatApp');
const loginBtn = document.getElementById('loginBtn');
const nicknameInput = document.getElementById('nicknameInput');
const bioInput = document.getElementById('bioInput');

const currentNicknameSpan = document.getElementById('currentNickname');
const currentBioSpan = document.getElementById('currentBio');
const usersList = document.getElementById('usersList');
const userCountSpan = document.getElementById('userCount');
const messagesArea = document.getElementById('messagesArea');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const hamburgerBtn = document.getElementById('hamburgerBtn');
const profileModal = document.getElementById('profileModal');
const closeModal = document.querySelector('.close-modal');
const saveProfileBtn = document.getElementById('saveProfileBtn');
const editNickname = document.getElementById('editNickname');
const editBio = document.getElementById('editBio');

let currentUser = null;

// Login
loginBtn.addEventListener('click', () => {
  let nickname = nicknameInput.value.trim();
  let bio = bioInput.value.trim();
  if (nickname === '') nickname = null; // backend will generate random
  socket.emit('set nickname', { nickname, bio });
});

socket.on('login success', (userData) => {
  currentUser = userData;
  currentNicknameSpan.innerText = userData.nickname;
  currentBioSpan.innerText = userData.bio || 'No bio';
  editNickname.value = userData.nickname;
  editBio.value = userData.bio || '';
  loginScreen.style.display = 'none';
  chatApp.style.display = 'flex';
});

// Update user list
socket.on('users list', (users) => {
  userCountSpan.innerText = users.length;
  usersList.innerHTML = '';
  users.forEach(user => {
    const li = document.createElement('li');
    li.innerHTML = `<i class="fas fa-user-circle"></i> ${escapeHtml(user.nickname)} <small>${escapeHtml(user.bio || '')}</small>`;
    usersList.appendChild(li);
  });
});

// Receive messages
socket.on('chat message', (msg) => {
  const messageDiv = document.createElement('div');
  messageDiv.classList.add('message');
  const isOwn = (msg.userId === currentUser?.id);
  messageDiv.classList.add(isOwn ? 'own' : 'other');
  messageDiv.innerHTML = `
    <div class="sender">${escapeHtml(msg.nickname)}</div>
    <div>${escapeHtml(msg.text)}</div>
  `;
  messagesArea.appendChild(messageDiv);
  messagesArea.scrollTop = messagesArea.scrollHeight;
});

// Send message
function sendMessage() {
  const text = messageInput.value.trim();
  if (text === '') return;
  socket.emit('chat message', text);
  messageInput.value = '';
}
sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendMessage();
});

// Hamburger menu – open profile modal
hamburgerBtn.addEventListener('click', () => {
  if (currentUser) {
    editNickname.value = currentUser.nickname;
    editBio.value = currentUser.bio || '';
    profileModal.style.display = 'flex';
  }
});
closeModal.addEventListener('click', () => profileModal.style.display = 'none');
window.addEventListener('click', (e) => {
  if (e.target === profileModal) profileModal.style.display = 'none';
});

// Save profile updates
saveProfileBtn.addEventListener('click', () => {
  const newNick = editNickname.value.trim();
  const newBio = editBio.value.trim();
  if (newNick === '') return alert('Nickname cannot be empty');
  socket.emit('update profile', { nickname: newNick, bio: newBio });
  profileModal.style.display = 'none';
});

socket.on('profile updated', (updatedUser) => {
  currentUser = updatedUser;
  currentNicknameSpan.innerText = updatedUser.nickname;
  currentBioSpan.innerText = updatedUser.bio || 'No bio';
});

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>]/g, function(m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  });
}
