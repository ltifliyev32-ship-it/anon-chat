// ... (existing code)

// ========== NEW: Follows ==========
function getFollows() {
  return readJSON('follows.json') || {};
}
function saveFollows(data) {
  writeJSON('follows.json', data);
}

// ========== NEW: Private Messages ==========
function getPrivateMessages() {
  return readJSON('private_messages.json') || { conversations: {} };
}
function savePrivateMessages(data) {
  writeJSON('private_messages.json', data);
}

// ========== NEW: Likes ==========
function getStoryLikes() {
  return readJSON('story_likes.json') || {};
}
function saveStoryLikes(data) {
  writeJSON('story_likes.json', data);
}
function getReelLikes() {
  return readJSON('reel_likes.json') || {};
}
function saveReelLikes(data) {
  writeJSON('reel_likes.json', data);
}

// ========== NEW: Socket Handlers ==========
io.on('connection', (socket) => {
  // ... existing (user online, etc.)

  // --- Follow ---
  socket.on('follow_user', ({ targetUserId }) => {
    const user = users.get(socket.id);
    if (!user) return;
    const follows = getFollows();
    if (!follows[user.userId]) follows[user.userId] = [];
    if (!follows[user.userId].includes(targetUserId)) {
      follows[user.userId].push(targetUserId);
      saveFollows(follows);
      // Notify target (optional)
      const targetSocket = [...users.entries()].find(([_, u]) => u.userId === targetUserId)?.[0];
      if (targetSocket) io.to(targetSocket).emit('followed_by', { userId: user.userId, username: user.nickname });
      socket.emit('follow_success', { targetUserId });
    }
  });

  socket.on('unfollow_user', ({ targetUserId }) => {
    const user = users.get(socket.id);
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
    const sender = users.get(socket.id);
    if (!sender) return;
    const msgObj = {
      id: Date.now() + '_' + Math.random(),
      senderId: sender.userId,
      senderName: sender.nickname,
      text,
      timestamp: new Date().toISOString()
    };
    const convId = getDMConvId(sender.userId, receiverId);
    const privateData = getPrivateMessages();
    if (!privateData.conversations[convId]) privateData.conversations[convId] = [];
    privateData.conversations[convId].push(msgObj);
    savePrivateMessages(privateData);
    // Send to receiver if online
    const receiverSocket = [...users.entries()].find(([_, u]) => u.userId === receiverId)?.[0];
    if (receiverSocket) {
      io.to(receiverSocket).emit('private_message', { ...msgObj, conversationId: convId });
    }
    socket.emit('private_message', { ...msgObj, conversationId: convId });
  });

  socket.on('get_chats', () => {
    const user = users.get(socket.id);
    if (!user) return;
    const privateData = getPrivateMessages();
    const chats = [];
    // Get all conversations where user is part
    Object.keys(privateData.conversations).forEach(convId => {
      if (convId.includes(user.userId)) {
        const otherId = convId.replace('dm_', '').split('_').find(id => id !== user.userId);
        if (otherId) {
          const msgs = privateData.conversations[convId];
          const lastMsg = msgs[msgs.length-1];
          // Get other user's details from users.json
          const allUsers = readJSON('users.json');
          const otherUser = allUsers.find(u => u.id === otherId);
          if (otherUser) {
            chats.push({
              conversationId: convId,
              userId: otherId,
              username: otherUser.username,
              avatar: otherUser.avatar || '',
              lastMsg: lastMsg ? { text: lastMsg.text, timestamp: lastMsg.timestamp } : null,
              unread: 0 // we can implement unread later
            });
          }
        }
      }
    });
    // Sort by latest message timestamp
    chats.sort((a, b) => {
      const aTime = a.lastMsg ? new Date(a.lastMsg.timestamp).getTime() : 0;
      const bTime = b.lastMsg ? new Date(b.lastMsg.timestamp).getTime() : 0;
      return bTime - aTime;
    });
    socket.emit('chats_list', chats);
  });

  // --- Likes for Stories ---
  socket.on('like_story', ({ storyId }) => {
    const user = users.get(socket.id);
    if (!user) return;
    const likes = getStoryLikes();
    if (!likes[storyId]) likes[storyId] = [];
    if (!likes[storyId].includes(user.userId)) {
      likes[storyId].push(user.userId);
      saveStoryLikes(likes);
      // Notify story owner (optional)
    }
    socket.emit('story_liked', { storyId, userId: user.userId });
    // Broadcast updated likes to all (or just story owner)
    io.emit('story_likes_update', { storyId, likes: likes[storyId] });
  });

  socket.on('like_reel', ({ reelId }) => {
    const user = users.get(socket.id);
    if (!user) return;
    const likes = getReelLikes();
    if (!likes[reelId]) likes[reelId] = [];
    if (!likes[reelId].includes(user.userId)) {
      likes[reelId].push(user.userId);
      saveReelLikes(likes);
    }
    socket.emit('reel_liked', { reelId, userId: user.userId });
    io.emit('reel_likes_update', { reelId, likes: likes[reelId] });
  });

  // ... existing disconnect, etc.
});
