// Backend API Configuration
const BACKEND_URL = 'http://localhost:3001';

// DOM Elements
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const videoGrid = document.getElementById('videoGrid');
const loading = document.getElementById('loading');
const errorMessage = document.getElementById('errorMessage');
const errorText = document.getElementById('errorText');
const videoPlayer = document.getElementById('videoPlayer');
const closePlayer = document.getElementById('closePlayer');

// State
let currentSearchTerm = '';
let isSearching = false;
let downloadStatus = new Map();
let currentVideoElement = null;

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeEventListeners();
    checkBackendConnection();
});

// Initialize event listeners
function initializeEventListeners() {
    // Search functionality
    searchBtn.addEventListener('click', handleSearch);
    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            handleSearch();
        }
    });

    // Video player controls
    closePlayer.addEventListener('click', closeVideoPlayer);
    
    // Close player on escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && !videoPlayer.classList.contains('hidden')) {
            closeVideoPlayer();
        }
    });

    // Close player when clicking outside video
    videoPlayer.addEventListener('click', function(e) {
        if (e.target === videoPlayer) {
            closeVideoPlayer();
        }
    });
}

// Check backend connection and yt-dlp installation
async function checkBackendConnection() {
    try {
        const healthResponse = await fetch(`${BACKEND_URL}/api/health`);
        if (!healthResponse.ok) {
            throw new Error('Backend not responding');
        }

        const ytdlpResponse = await fetch(`${BACKEND_URL}/api/check-ytdlp`);
        const ytdlpData = await ytdlpResponse.json();
        
        if (!ytdlpData.installed) {
            showError('yt-dlp is not installed. Please install it with: pip install yt-dlp');
        }
    } catch (error) {
        showError('Backend server is not running. Please start the server with: npm start');
    }
}

// Handle search functionality
async function handleSearch() {
    const query = searchInput.value.trim();
    
    if (!query) {
        showError('Please enter a search term.');
        return;
    }

    if (isSearching) {
        return;
    }

    currentSearchTerm = query;
    await searchVideos(query);
}

// Search for videos using backend API
async function searchVideos(query) {
    try {
        isSearching = true;
        showLoading();
        clearResults();
        hideError();

        const response = await fetch(`${BACKEND_URL}/api/search?q=${encodeURIComponent(query)}&maxResults=12`);
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Search failed');
        }

        const data = await response.json();
        
        if (data.items && data.items.length > 0) {
            displayVideos(data.items);
        } else {
            showError('No videos found for your search. Try different keywords.');
        }

    } catch (error) {
        console.error('Search error:', error);
        showError(`Failed to search videos: ${error.message}`);
    } finally {
        hideLoading();
        isSearching = false;
    }
}

// Display videos in the grid
function displayVideos(videos) {
    videoGrid.innerHTML = '';

    videos.forEach((video, index) => {
        const videoCard = createVideoCard(video, index);
        videoGrid.appendChild(videoCard);
    });
}

// Create a video card element
function createVideoCard(video, index) {
    const card = document.createElement('div');
    card.className = 'video-card';
    card.style.animationDelay = `${index * 0.1}s`;

    const thumbnail = video.snippet.thumbnails.high || video.snippet.thumbnails.medium || video.snippet.thumbnails.default;
    const viewCount = video.statistics ? formatViewCount(video.statistics.viewCount) : 'N/A';
    const duration = video.contentDetails ? formatDuration(video.contentDetails.duration) : '';
    const publishedDate = new Date(video.snippet.publishedAt).toLocaleDateString();

    card.innerHTML = `
        <div class="video-thumbnail">
            <img src="${thumbnail.url}" alt="${escapeHtml(video.snippet.title)}" loading="lazy">
            <div class="play-overlay">
                <i class="fas fa-download"></i>
                <span class="download-text">Download & Play</span>
            </div>
            ${duration ? `<div class="video-duration">${duration}</div>` : ''}
        </div>
        <div class="video-info">
            <h3 class="video-title">${escapeHtml(video.snippet.title)}</h3>
            <p class="video-channel">${escapeHtml(video.snippet.channelTitle)}</p>
            <div class="video-stats">
                <div class="video-views">
                    <i class="fas fa-eye"></i>
                    <span>${viewCount} views</span>
                </div>
                <div class="video-date">${publishedDate}</div>
            </div>
        </div>
        <div class="download-progress hidden">
            <div class="progress-bar">
                <div class="progress-fill"></div>
            </div>
            <span class="progress-text">Preparing download...</span>
        </div>
    `;

    // Add click event to download and play video
    card.addEventListener('click', () => downloadAndPlayVideo(video.id.videoId, video.snippet.title, card));

    return card;
}

// Download and play video
async function downloadAndPlayVideo(videoId, title, cardElement) {
    try {
        // Show download progress
        const progressElement = cardElement.querySelector('.download-progress');
        const progressFill = cardElement.querySelector('.progress-fill');
        const progressText = cardElement.querySelector('.progress-text');
        
        progressElement.classList.remove('hidden');
        progressText.textContent = 'Starting download...';

        // Start download
        const downloadResponse = await fetch(`${BACKEND_URL}/api/download`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ videoId, title }),
        });

        const downloadData = await downloadResponse.json();
        
        if (!downloadData.success) {
            throw new Error(downloadData.error || 'Download failed');
        }

        // If video is already downloaded, play immediately
        if (downloadData.videoPath) {
            progressElement.classList.add('hidden');
            playVideo(downloadData.videoPath, title);
            return;
        }

        // Monitor download progress
        const downloadId = downloadData.downloadId;
        monitorDownloadProgress(downloadId, progressFill, progressText, title, progressElement);

    } catch (error) {
        console.error('Download error:', error);
        showError(`Failed to download video: ${error.message}`);
        const progressElement = cardElement.querySelector('.download-progress');
        progressElement.classList.add('hidden');
    }
}

// Monitor download progress
async function monitorDownloadProgress(downloadId, progressFill, progressText, title, progressElement) {
    const checkProgress = async () => {
        try {
            const response = await fetch(`${BACKEND_URL}/api/download-status/${downloadId}`);
            const status = await response.json();

            if (status.status === 'downloading') {
                const progress = status.progress || 0;
                progressFill.style.width = `${progress}%`;
                progressText.textContent = `Downloading... ${Math.round(progress)}%`;
                
                setTimeout(checkProgress, 1000);
            } else if (status.status === 'completed') {
                progressFill.style.width = '100%';
                progressText.textContent = 'Download complete!';
                
                setTimeout(() => {
                    progressElement.classList.add('hidden');
                    playVideo(status.filePath, title);
                }, 500);
            } else if (status.status === 'error') {
                throw new Error(status.error);
            } else {
                setTimeout(checkProgress, 1000);
            }
        } catch (error) {
            console.error('Progress check error:', error);
            showError(`Download failed: ${error.message}`);
            progressElement.classList.add('hidden');
        }
    };

    checkProgress();
}

// Play video in fullscreen with custom HTML5 player
function playVideo(videoPath, title) {
    // Create custom video player HTML
    const playerContainer = document.getElementById('playerContainer') || createPlayerContainer();
    
    playerContainer.innerHTML = `
        <div class="custom-video-container">
            <video 
                id="customVideoPlayer" 
                controls 
                autoplay
                preload="metadata"
                class="custom-video-player"
            >
                <source src="${BACKEND_URL}${videoPath}" type="video/mp4">
                <source src="${BACKEND_URL}${videoPath}" type="video/webm">
                Your browser does not support the video tag.
            </video>
            <div class="video-title-overlay">
                <h2>${escapeHtml(title)}</h2>
            </div>
        </div>
    `;
    
    currentVideoElement = document.getElementById('customVideoPlayer');
    videoPlayer.classList.remove('hidden');
    
    // Prevent body scrolling when video player is open
    document.body.style.overflow = 'hidden';

    // Handle video load errors
    currentVideoElement.addEventListener('error', function() {
        showError('Failed to load video. The file may be corrupted or in an unsupported format.');
        closeVideoPlayer();
    });

    // Handle video loaded
    currentVideoElement.addEventListener('loadeddata', function() {
        console.log('Video loaded successfully');
    });
}

// Create player container if it doesn't exist
function createPlayerContainer() {
    let container = document.getElementById('playerContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'playerContainer';
        container.className = 'player-container';
        videoPlayer.appendChild(container);
    }
    return container;
}

// Close video player
function closeVideoPlayer() {
    videoPlayer.classList.add('hidden');
    
    // Stop video if playing
    if (currentVideoElement) {
        currentVideoElement.pause();
        currentVideoElement.src = '';
        currentVideoElement = null;
    }
    
    // Clear player container
    const playerContainer = document.getElementById('playerContainer');
    if (playerContainer) {
        playerContainer.innerHTML = '';
    }
    
    // Restore body scrolling
    document.body.style.overflow = 'auto';
}

// Utility functions
function showLoading() {
    loading.classList.remove('hidden');
}

function hideLoading() {
    loading.classList.add('hidden');
}

function showError(message) {
    errorText.textContent = message;
    errorMessage.classList.remove('hidden');
}

function hideError() {
    errorMessage.classList.add('hidden');
}

function clearResults() {
    videoGrid.innerHTML = '';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatViewCount(count) {
    if (!count) return 'N/A';
    
    const num = parseInt(count);
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toLocaleString();
}

function formatDuration(duration) {
    if (!duration) return '';
    
    // Parse ISO 8601 duration format (PT#M#S)
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return '';
    
    const hours = parseInt(match[1]) || 0;
    const minutes = parseInt(match[2]) || 0;
    const seconds = parseInt(match[3]) || 0;
    
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    } else {
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
}

// Add some demo search suggestions
const searchSuggestions = [
    'music videos',
    'tutorials',
    'documentaries',
    'tech reviews',
    'cooking shows',
    'nature videos'
];

// Add placeholder rotation for search input
let suggestionIndex = 0;
setInterval(() => {
    if (document.activeElement !== searchInput) {
        searchInput.placeholder = `Search for ${searchSuggestions[suggestionIndex]}...`;
        suggestionIndex = (suggestionIndex + 1) % searchSuggestions.length;
    }
}, 3000);