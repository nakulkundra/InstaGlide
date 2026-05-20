/* ==========================================================================
   INSTAGLIDE FRONTEND ENGINE
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
  // Tab Elements
  const tabButtons = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".tab-content");

  // Single Downloader Elements
  const singleUrlInput = document.getElementById("single-url");
  const singleClearBtn = document.getElementById("single-clear");
  const singleSubmitBtn = document.getElementById("single-submit");
  const singleLoader = document.getElementById("single-loader");
  const singleResult = document.getElementById("single-result");
  const singlePreviewContent = document.getElementById("single-preview-content");
  const singleAvatar = document.getElementById("single-avatar");
  const singleAuthor = document.getElementById("single-author");
  const singleCaption = document.getElementById("single-caption");
  const singleDownloadBtn = document.getElementById("single-download-btn");

  // Profile Explorer Elements
  const profileHandleInput = document.getElementById("profile-handle");
  const profileClearBtn = document.getElementById("profile-clear");
  const profileSubmitBtn = document.getElementById("profile-submit");
  const profileLoader = document.getElementById("profile-loader");
  const profileResult = document.getElementById("profile-result");
  const profileAvatar = document.getElementById("profile-avatar");
  const profileName = document.getElementById("profile-name");
  const profileBadgeHandle = document.getElementById("profile-badge-handle");
  const profileBio = document.getElementById("profile-bio");
  const selectAllCheckbox = document.getElementById("select-all-posts");
  const selectionStatus = document.getElementById("selection-status");
  const batchDownloadTrigger = document.getElementById("batch-download-trigger");
  const downloadAllTrigger = document.getElementById("download-all-trigger");
  const deselectAllBtn = document.getElementById("deselect-all-btn");
  const mediaGrid = document.getElementById("profile-media-grid");

  // Global Error & History Elements
  const globalError = document.getElementById("global-error");
  const errorMessage = document.getElementById("error-message");
  const historyList = document.getElementById("activity-history-list");

  // Slide-out Download Queue Elements
  const queueOverlay = document.getElementById("queue-overlay");
  const queueCloseBtn = document.getElementById("queue-close-btn");
  const queueStatusText = document.getElementById("queue-status-text");
  const queuePercentage = document.getElementById("queue-percentage");
  const queueProgressBar = document.getElementById("queue-progress-bar");
  const queueFileLabel = document.getElementById("queue-file-label");

  // Application State
  let activeTab = "single";
  let profilePosts = []; // Currently explored profile posts
  let selectedPosts = new Set(); // Set of shortcodes selected
  let isDownloadingBatch = false;

  // Render Activity History on Boot
  renderHistory();

  /* ==========================================
     1. Tab Navigation System
     ========================================== */
  tabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const targetTab = btn.getAttribute("data-tab");
      if (targetTab === activeTab) return;

      // Toggle active states
      tabButtons.forEach(b => b.classList.remove("active"));
      tabContents.forEach(c => c.classList.remove("active"));

      btn.classList.add("active");
      document.getElementById(`tab-${targetTab}`).classList.add("active");

      activeTab = targetTab;
      hideError();
    });
  });

  /* ==========================================
     2. Input Form Clear Controls
     ========================================== */
  setupInputField(singleUrlInput, singleClearBtn);
  setupInputField(profileHandleInput, profileClearBtn);

  function setupInputField(input, clearBtn) {
    input.addEventListener("input", () => {
      clearBtn.style.display = input.value.trim().length > 0 ? "flex" : "none";
    });

    clearBtn.addEventListener("click", () => {
      input.value = "";
      clearBtn.style.display = "none";
      input.focus();
    });
  }

  /* ==========================================
     3. Single Downloader Implementation
     ========================================== */
  singleSubmitBtn.addEventListener("click", handleSingleDownloadSubmit);
  singleUrlInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") handleSingleDownloadSubmit();
  });

  async function handleSingleDownloadSubmit() {
    const rawUrl = singleUrlInput.value.trim();
    hideError();
    singleResult.style.display = "none";

    if (!rawUrl) {
      showError("Please enter a valid Instagram video or reel link.");
      return;
    }

    if (!rawUrl.includes("instagram.com/")) {
      showError("Invalid Instagram URL. Please enter a valid instagram.com link.");
      return;
    }

    // Enter single loading state
    singleLoader.style.display = "flex";
    singleSubmitBtn.disabled = true;

    try {
      const response = await fetch("/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: rawUrl })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to extract video content.");
      }

      // Populate preview container
      singlePreviewContent.innerHTML = "";
      
      if (data.isCarousel && data.carousel && data.carousel.length > 0) {
        // Render Carousel Swiper
        const carouselContainer = document.createElement("div");
        carouselContainer.classList.add("carousel-container");
        
        let activeIndex = 0;
        const totalSlides = data.carousel.length;
        
        const renderActiveSlide = () => {
          carouselContainer.innerHTML = "";
          
          const currentSlide = data.carousel[activeIndex];
          const proxiedSlideDownloadUrl = `/api/proxy?url=${encodeURIComponent(currentSlide.downloadUrl)}`;
          const proxiedSlideThumbnailUrl = `/api/proxy?url=${encodeURIComponent(currentSlide.thumbnailUrl)}`;
          
          // Render Slide Content
          const slideContent = document.createElement("div");
          slideContent.classList.add("carousel-slide-content");
          
          if (currentSlide.isVideo) {
            const videoElement = document.createElement("video");
            videoElement.src = proxiedSlideDownloadUrl;
            videoElement.poster = proxiedSlideThumbnailUrl;
            videoElement.controls = true;
            videoElement.autoplay = false;
            videoElement.loop = true;
            videoElement.playsInline = true;
            slideContent.appendChild(videoElement);
          } else {
            const imgElement = document.createElement("img");
            imgElement.src = proxiedSlideThumbnailUrl;
            imgElement.alt = `Slide ${activeIndex + 1}`;
            slideContent.appendChild(imgElement);
          }
          
          carouselContainer.appendChild(slideContent);
          
          // Slide Indicator Badge
          const indicator = document.createElement("div");
          indicator.classList.add("carousel-indicator");
          indicator.innerHTML = `<span>${activeIndex + 1} / ${totalSlides}</span>`;
          carouselContainer.appendChild(indicator);
          
          // Add Navigation Controls if more than 1 slide
          if (totalSlides > 1) {
            const prevBtn = document.createElement("button");
            prevBtn.classList.add("carousel-nav-btn", "prev");
            prevBtn.innerHTML = `<i data-lucide="chevron-left"></i>`;
            prevBtn.addEventListener("click", (e) => {
              e.stopPropagation();
              activeIndex = (activeIndex - 1 + totalSlides) % totalSlides;
              renderActiveSlide();
            });
            carouselContainer.appendChild(prevBtn);
            
            const nextBtn = document.createElement("button");
            nextBtn.classList.add("carousel-nav-btn", "next");
            nextBtn.innerHTML = `<i data-lucide="chevron-right"></i>`;
            nextBtn.addEventListener("click", (e) => {
              e.stopPropagation();
              activeIndex = (activeIndex + 1) % totalSlides;
              renderActiveSlide();
            });
            carouselContainer.appendChild(nextBtn);
            
            lucide.createIcons();
          }
          
          // Update primary download button for the current active slide
          singleDownloadBtn.href = proxiedSlideDownloadUrl;
          singleDownloadBtn.setAttribute("download", `instagram_media_slide${activeIndex + 1}_${Date.now()}.${currentSlide.isVideo ? 'mp4' : 'jpg'}`);
          singleDownloadBtn.querySelector("span").textContent = `Download Slide ${activeIndex + 1}`;
        };
        
        singlePreviewContent.appendChild(carouselContainer);
        renderActiveSlide();
        
        // Add Batch Download button for the whole carousel
        const actionBox = document.querySelector("#tab-single .action-box");
        // Remove any old batch download buttons if present
        const oldBatchBtn = document.getElementById("single-batch-download-btn");
        if (oldBatchBtn) oldBatchBtn.remove();
        
        const batchBtn = document.createElement("button");
        batchBtn.id = "single-batch-download-btn";
        batchBtn.classList.add("secondary-batch-btn");
        batchBtn.style.marginTop = "10px";
        batchBtn.style.background = "linear-gradient(135deg, #4285F4 0%, #8B5CF6 50%, #EC4899 100%)";
        batchBtn.style.width = "100%";
        batchBtn.style.border = "none";
        batchBtn.style.borderRadius = "14px";
        batchBtn.style.padding = "16px";
        batchBtn.style.color = "#fff";
        batchBtn.style.fontWeight = "700";
        batchBtn.style.fontSize = "1.05rem";
        batchBtn.style.cursor = "pointer";
        batchBtn.style.display = "flex";
        batchBtn.style.alignItems = "center";
        batchBtn.style.justifyContent = "center";
        batchBtn.style.gap = "10px";
        batchBtn.style.boxShadow = "0 4px 16px rgba(66, 133, 244, 0.25)";
        
        batchBtn.innerHTML = `
          <i data-lucide="download"></i>
          <span>Download All ${totalSlides} Slides</span>
        `;
        
        batchBtn.addEventListener("click", async () => {
          // Open queue overlay and download all slides sequentially
          queueOverlay.style.display = "block";
          queueProgressBar.style.width = "0%";
          queuePercentage.textContent = "0%";
          
          for (let i = 0; i < totalSlides; i++) {
            const slide = data.carousel[i];
            const percent = Math.round((i / totalSlides) * 100);
            
            queueStatusText.textContent = `Downloading Slide ${i + 1} of ${totalSlides}...`;
            queuePercentage.textContent = `${percent}%`;
            queueProgressBar.style.width = `${percent}%`;
            queueFileLabel.textContent = `Streaming Slide ${i + 1}: slide_${i + 1}.${slide.isVideo ? 'mp4' : 'jpg'}`;
            
            forceBrowserDownload(slide.downloadUrl, `slide_${i + 1}`, slide.isVideo);
            
            await sleep(1500);
          }
          
          // Complete queue progress
          queueStatusText.textContent = `Batch slide download complete! Successfully saved all ${totalSlides} slides.`;
          queuePercentage.textContent = "100%";
          queueProgressBar.style.width = "100%";
          queueFileLabel.textContent = "All files downloaded.";
          
          setTimeout(() => {
            queueOverlay.style.display = "none";
          }, 4000);
        });
        
        actionBox.appendChild(batchBtn);
        lucide.createIcons();
        
      } else {
        // Regular single media (not carousel)
        // Remove batch download buttons if present
        const oldBatchBtn = document.getElementById("single-batch-download-btn");
        if (oldBatchBtn) oldBatchBtn.remove();
        
        const proxiedDownloadUrl = `/api/proxy?url=${encodeURIComponent(data.downloadUrl)}`;
        const proxiedThumbnailUrl = `/api/proxy?url=${encodeURIComponent(data.thumbnailUrl)}`;
        
        if (data.isVideo) {
          const videoElement = document.createElement("video");
          videoElement.src = proxiedDownloadUrl;
          videoElement.poster = proxiedThumbnailUrl;
          videoElement.controls = true;
          videoElement.autoplay = false;
          videoElement.loop = true;
          videoElement.playsInline = true;
          singlePreviewContent.appendChild(videoElement);
        } else {
          const imgElement = document.createElement("img");
          imgElement.src = proxiedThumbnailUrl;
          imgElement.alt = "Post Image";
          singlePreviewContent.appendChild(imgElement);
        }
        
        // Restore standard single download button text & link
        singleDownloadBtn.href = proxiedDownloadUrl;
        singleDownloadBtn.setAttribute("download", `instagram_media_${Date.now()}.${data.isVideo ? 'mp4' : 'jpg'}`);
        singleDownloadBtn.querySelector("span").textContent = "Download File";
      }
 
       // Populate metadata
       singleAuthor.textContent = data.author || "@instagram_creator";
       singleAvatar.src = data.avatar ? `/api/proxy?url=${encodeURIComponent(data.avatar)}` : "https://www.picuki.com/profile/favicon.png";
       singleCaption.textContent = data.caption || "No caption available.";
       
       // Show result card
       singleLoader.style.display = "none";
       singleResult.style.display = "block";
 
       // Save to Activity History
       saveToHistory({
         shortcode: extractShortcode(rawUrl) || `post_${Date.now()}`,
         creator: data.author || "@creator",
         thumbnail: data.thumbnailUrl,
         type: data.isVideo ? "video" : "image",
         caption: data.caption || "",
         downloadUrl: data.downloadUrl
       });

    } catch (err) {
      console.error(err);
      singleLoader.style.display = "none";
      showError(err.message || "An error occurred while connecting to our downloader API.");
    } finally {
      singleSubmitBtn.disabled = false;
    }
  }

  /* ==========================================
     4. Profile Explorer Implementation
     ========================================== */
  profileSubmitBtn.addEventListener("click", handleProfileExploreSubmit);
  profileHandleInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") handleProfileExploreSubmit();
  });

  async function handleProfileExploreSubmit() {
    const rawHandle = profileHandleInput.value.trim();
    hideError();
    profileResult.style.display = "none";
    selectedPosts.clear();
    updateSelectionUI();

    if (!rawHandle) {
      showError("Please enter a valid Instagram creator username.");
      return;
    }

    const cleanUsername = rawHandle.replace(/^@/, '');

    // Enter profile loading state
    profileLoader.style.display = "flex";
    profileSubmitBtn.disabled = true;

    try {
      const response = await fetch(`/api/profile/${cleanUsername}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to retrieve posts from this handle.");
      }

      profilePosts = data.posts || [];

      // Populate profile info
      profileAvatar.src = data.profile.avatarUrl ? `/api/proxy?url=${encodeURIComponent(data.profile.avatarUrl)}` : "https://www.picuki.com/profile/favicon.png";
      profileName.textContent = data.profile.name || cleanUsername;
      profileBadgeHandle.textContent = `@${cleanUsername}`;
      profileBio.textContent = data.profile.bio || "Instagram Creator";

      // Populate media grid
      mediaGrid.innerHTML = "";
      
      if (profilePosts.length === 0) {
        mediaGrid.innerHTML = `
          <div class="history-empty-state" style="grid-column: 1 / -1;">
            <i data-lucide="image-off"></i>
            <p>This profile does not have any public posts or reels available.</p>
          </div>
        `;
      } else {
        profilePosts.forEach(post => {
          const card = document.createElement("div");
          card.classList.add("media-card");
          card.setAttribute("data-shortcode", post.shortcode);

          const proxiedThumb = `/api/proxy?url=${encodeURIComponent(post.thumbnail)}`;

          card.innerHTML = `
            <div class="card-checkbox"><i data-lucide="check"></i></div>
            <div class="media-type-badge ${post.type === 'video' ? 'badge-video' : 'badge-image'}">
              <i data-lucide="${post.type === 'video' ? 'video' : 'image'}"></i>
              ${post.type === 'video' ? 'Reel' : 'Image'}
            </div>
            <img class="media-card-img" src="${proxiedThumb}" alt="Thumbnail" loading="lazy">
            <div class="media-card-overlay">
              <p class="overlay-caption">${post.caption || 'Instagram Post'}</p>
              <button class="card-download-btn" data-url="${post.url}" title="Download immediately">
                <i data-lucide="download"></i>
              </button>
            </div>
          `;

          // Handle single card click to toggle selection
          card.addEventListener("click", (e) => {
            // Check if user clicked the direct download button
            const downloadBtn = e.target.closest(".card-download-btn");
            if (downloadBtn) {
              e.stopPropagation();
              triggerSingleCardDownload(post);
              return;
            }

            // Toggle select state
            togglePostSelection(post.shortcode, card);
          });

          mediaGrid.appendChild(card);
        });
      }

      // Initialize icons inside grid
      lucide.createIcons();

      // Show results
      profileLoader.style.display = "none";
      profileResult.style.display = "flex";

    } catch (err) {
      console.error(err);
      profileLoader.style.display = "none";
      showError(err.message || "An error occurred while connecting to our profile scraper.");
    } finally {
      profileSubmitBtn.disabled = false;
    }
  }

  // Action: direct download from the media card overlay
  async function triggerSingleCardDownload(post) {
    try {
      const response = await fetch("/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: post.url })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error("Unable to download this post.");
      }

      // Save to history
      saveToHistory({
        shortcode: post.shortcode,
        creator: data.author || "@creator",
        thumbnail: data.thumbnailUrl,
        type: data.isVideo ? "video" : "image",
        caption: data.caption || "",
        downloadUrl: data.downloadUrl
      });

      // Trigger standard browser download
      forceBrowserDownload(data.downloadUrl, post.shortcode, data.isVideo);

    } catch (err) {
      console.error(err);
      showError("Direct download failed. Post might be blocked or rate-limited.");
    }
  }

  // Toggle selection state for a card
  function togglePostSelection(shortcode, cardElement) {
    if (selectedPosts.has(shortcode)) {
      selectedPosts.delete(shortcode);
      cardElement.classList.remove("selected");
    } else {
      selectedPosts.add(shortcode);
      cardElement.classList.add("selected");
    }
    updateSelectionUI();
  }

  // Update batch UI states based on current selection
  function updateSelectionUI() {
    const totalSelected = selectedPosts.size;
    selectionStatus.textContent = `${totalSelected} of ${profilePosts.length} selected`;

    // Manage Select All checkbox state
    if (profilePosts.length > 0 && totalSelected === profilePosts.length) {
      selectAllCheckbox.checked = true;
    } else {
      selectAllCheckbox.checked = false;
    }

    // Update Download Selected button text with count
    const batchBtnLabel = batchDownloadTrigger.querySelector("span");
    if (totalSelected > 0) {
      batchDownloadTrigger.classList.remove("disabled");
      batchBtnLabel.textContent = `Download Selected (${totalSelected})`;
    } else {
      batchDownloadTrigger.classList.add("disabled");
      batchBtnLabel.textContent = "Download Selected";
    }

    // Show/hide Deselect All button
    deselectAllBtn.style.display = totalSelected > 0 ? "flex" : "none";

    // Re-init icons for any new elements
    lucide.createIcons();
  }

  // "Select All" Toggle handler
  selectAllCheckbox.addEventListener("change", () => {
    const cards = document.querySelectorAll(".media-card");
    
    if (selectAllCheckbox.checked) {
      profilePosts.forEach(post => selectedPosts.add(post.shortcode));
      cards.forEach(c => c.classList.add("selected"));
    } else {
      selectedPosts.clear();
      cards.forEach(c => c.classList.remove("selected"));
    }
    updateSelectionUI();
  });

  // "Deselect All" button handler
  deselectAllBtn.addEventListener("click", () => {
    selectedPosts.clear();
    selectAllCheckbox.checked = false;
    const cards = document.querySelectorAll(".media-card");
    cards.forEach(c => c.classList.remove("selected"));
    updateSelectionUI();
  });

  /* ==========================================
     5. Sequential Download Queue Engine
     ========================================== */
  batchDownloadTrigger.addEventListener("click", startBatchDownloadingQueue);
  queueCloseBtn.addEventListener("click", () => {
    queueOverlay.style.display = "none";
  });

  // "Download All" — selects everything and starts the queue
  downloadAllTrigger.addEventListener("click", () => {
    if (profilePosts.length === 0 || isDownloadingBatch) return;
    // Select all posts first
    const cards = document.querySelectorAll(".media-card");
    profilePosts.forEach(post => selectedPosts.add(post.shortcode));
    cards.forEach(c => c.classList.add("selected"));
    selectAllCheckbox.checked = true;
    updateSelectionUI();
    // Immediately start the download queue
    startBatchDownloadingQueue();
  });

  async function startBatchDownloadingQueue() {
    if (selectedPosts.size === 0 || isDownloadingBatch) return;

    isDownloadingBatch = true;
    batchDownloadTrigger.classList.add("disabled");
    selectAllCheckbox.disabled = true;

    // Open sliding progress panel overlay
    queueOverlay.style.display = "block";
    queueProgressBar.style.width = "0%";
    queuePercentage.textContent = "0%";

    const selectedShortcodes = Array.from(selectedPosts);
    const totalItems = selectedShortcodes.length;
    let successCount = 0;

    for (let index = 0; index < totalItems; index++) {
      const shortcode = selectedShortcodes[index];
      const post = profilePosts.find(p => p.shortcode === shortcode);

      if (!post) continue;

      // Update progress UI
      const percent = Math.round((index / totalItems) * 100);
      queueStatusText.textContent = `Downloading item ${index + 1} of ${totalItems}...`;
      queuePercentage.textContent = `${percent}%`;
      queueProgressBar.style.width = `${percent}%`;
      queueFileLabel.textContent = `Scraping: instagram_media_${shortcode}...`;

      try {
        // Fetch actual media stream endpoint
        const response = await fetch("/api/download", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: post.url })
        });

        const data = await response.json();

        if (data.success) {
          queueFileLabel.textContent = `Streaming file: instagram_${shortcode}.${data.isVideo ? 'mp4' : 'jpg'}`;
          
          // Trigger physical download
          forceBrowserDownload(data.downloadUrl, shortcode, data.isVideo);
          successCount++;

          // Save to history
          saveToHistory({
            shortcode: shortcode,
            creator: data.author || "@creator",
            thumbnail: data.thumbnailUrl,
            type: data.isVideo ? "video" : "image",
            caption: data.caption || "",
            downloadUrl: data.downloadUrl
          });
        }
      } catch (err) {
        console.error(`Failed to download post shortcode: ${shortcode}`, err);
      }

      // Dynamic rate-limiting pause (1500ms) to bypass Instagram defenses and allow browser download initiation
      await sleep(1500);
    }

    // Complete queue progress
    queueStatusText.textContent = `Batch complete! Successfully saved ${successCount} of ${totalItems} items.`;
    queuePercentage.textContent = "100%";
    queueProgressBar.style.width = "100%";
    queueFileLabel.textContent = "All files downloaded.";

    // Re-enable and reset select UI
    isDownloadingBatch = false;
    selectAllCheckbox.disabled = false;
    selectAllCheckbox.checked = false;
    selectedPosts.clear();
    updateSelectionUI();

    // Deselect all cards
    const cards = document.querySelectorAll(".media-card");
    cards.forEach(c => c.classList.remove("selected"));

    // Automatically hide queue overlay after 4 seconds
    setTimeout(() => {
      if (!isDownloadingBatch) {
        queueOverlay.style.display = "none";
      }
    }, 4000);
  }

  /* ==========================================
     6. Utility Helper Functions
     ========================================== */
  function showError(msg) {
    globalError.style.display = "flex";
    errorMessage.textContent = msg;
    globalError.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function hideError() {
    globalError.style.display = "none";
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function extractShortcode(url) {
    const matches = url.match(/\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/);
    return matches ? matches[1] : null;
  }

  function forceBrowserDownload(downloadUrl, shortcode, isVideo) {
    const ext = isVideo ? "mp4" : "jpg";
    const downloadLink = document.createElement("a");
    downloadLink.href = `/api/proxy?url=${encodeURIComponent(downloadUrl)}`;
    downloadLink.download = `instagram_${shortcode}_${Date.now()}.${ext}`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  }

  /* ==========================================
     7. Activity History LocalStorage System
     ========================================== */
  function saveToHistory(item) {
    let history = JSON.parse(localStorage.getItem("instaglide_history") || "[]");
    
    // Prevent duplicate entries
    history = history.filter(h => h.shortcode !== item.shortcode);
    
    // Add to top of list
    history.unshift({
      ...item,
      timestamp: Date.now()
    });

    // Limit history to 6 entries
    if (history.length > 6) {
      history.pop();
    }

    localStorage.setItem("instaglide_history", JSON.stringify(history));
    renderHistory();
  }

  function renderHistory() {
    const history = JSON.parse(localStorage.getItem("instaglide_history") || "[]");
    historyList.innerHTML = "";

    if (history.length === 0) {
      historyList.innerHTML = `
        <div class="history-empty-state">
          <i data-lucide="folder-open"></i>
          <p>No recent downloads. Your physical file saves will appear here.</p>
        </div>
      `;
      lucide.createIcons();
      return;
    }

    history.forEach(item => {
      const row = document.createElement("div");
      row.classList.add("history-item");

      const proxiedThumb = `/api/proxy?url=${encodeURIComponent(item.thumbnail)}`;
      const proxiedDownload = `/api/proxy?url=${encodeURIComponent(item.downloadUrl)}`;

      row.innerHTML = `
        <div class="history-left">
          <img src="${proxiedThumb}" alt="Thumbnail" class="history-thumbnail">
          <div class="history-text">
            <div class="history-meta-top">
              <span class="history-handle">${item.creator}</span>
              <span class="history-type-lbl">${item.type}</span>
            </div>
            <p class="history-caption">${item.caption || 'Instagram Post'}</p>
          </div>
        </div>
        <button class="history-redownload-btn" data-url="${proxiedDownload}" data-shortcode="${item.shortcode}" data-video="${item.type === 'video'}" title="Re-download file">
          <i data-lucide="download-cloud"></i>
        </button>
      `;

      // Setup re-download click trigger
      row.querySelector(".history-redownload-btn").addEventListener("click", () => {
        forceBrowserDownload(item.downloadUrl, item.shortcode, item.type === "video");
      });

      historyList.appendChild(row);
    });

    // Initialize Lucide Icons for dynamic content
    lucide.createIcons();
  }
});
