// ========== ENHANCED STORY/REEL VIEWER ==========
function viewMedia(item) {
  const modal = document.getElementById('storyViewerModal');
  const mediaContainer = document.getElementById('storyViewerMedia');
  const captionEl = document.getElementById('storyViewerCaption');
  const userEl = document.getElementById('storyViewerUser');

  // Clear previous content
  mediaContainer.innerHTML = '';
  captionEl.textContent = '';
  userEl.innerHTML = '';

  // Show user info
  userEl.innerHTML = `<i class="fas fa-user-circle"></i> ${escapeHtml(item.username)}`;

  // Show media (image or video)
  if (item.mediaUrl) {
    const isVideo = item.mediaUrl.match(/\.(mp4|webm|ogg|mov)$/i);
    if (isVideo) {
      const video = document.createElement('video');
      video.src = item.mediaUrl;
      video.controls = true;
      video.autoplay = true;
      video.loop = false;
      video.playsInline = true;
      video.setAttribute('playsinline', '');
      mediaContainer.appendChild(video);
      // Auto-play when loaded
      video.addEventListener('loadeddata', () => {
        video.play().catch(() => {});
      });
    } else {
      const img = document.createElement('img');
      img.src = item.mediaUrl;
      img.alt = item.text || 'Story media';
      img.loading = 'lazy';
      mediaContainer.appendChild(img);
    }
  } else {
    // Text-only post
    mediaContainer.innerHTML = `
      <div style="
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 200px;
        background: #2a2a2e;
        border-radius: 16px;
        padding: 40px;
        width: 100%;
      ">
        <span style="font-size: 48px; color: #ffd966;">📝</span>
      </div>
    `;
  }

  // Show caption
  if (item.text && item.text.trim()) {
    captionEl.textContent = item.text;
  }

  // Show modal
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden'; // Prevent scroll behind modal
}

// Close story viewer
document.getElementById('closeStoryViewer').addEventListener('click', () => {
  const modal = document.getElementById('storyViewerModal');
  modal.style.display = 'none';
  document.body.style.overflow = '';
  // Pause any playing video
  const video = document.querySelector('#storyViewerMedia video');
  if (video) video.pause();
});

// Also close when clicking outside the content
document.getElementById('storyViewerModal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) {
    document.getElementById('closeStoryViewer').click();
  }
});

// Close with Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const modal = document.getElementById('storyViewerModal');
    if (modal.style.display === 'flex') {
      document.getElementById('closeStoryViewer').click();
    }
  }
});
