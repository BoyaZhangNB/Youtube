const express = require('express');
const cors = require('cors');
const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use('/videos', express.static(path.join(__dirname, 'downloaded_videos')));
app.use(express.static('.'));

// Create downloads directory if it doesn't exist
const DOWNLOAD_DIR = path.join(__dirname, 'downloaded_videos');
if (!fs.existsSync(DOWNLOAD_DIR)) {
    fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
}

// Store download progress and status
const downloadStatus = new Map();

// YouTube API configuration
const YOUTUBE_API_KEY = 'AIzaSyAnG7yvpHI3-1FK9n9GaJhRdcWVn0XO6-E'; // Replace with your API key
const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

// Search YouTube videos
app.get('/api/search', async (req, res) => {
    try {
        const { q, maxResults = 12 } = req.query;
        
        if (!q) {
            return res.status(400).json({ error: 'Query parameter is required' });
        }

        if (YOUTUBE_API_KEY === 'YOUR_YOUTUBE_API_KEY') {
            return res.status(400).json({ error: 'YouTube API key not configured' });
        }

        // Search for videos
        const searchUrl = `${YOUTUBE_API_BASE}/search?part=snippet&type=video&q=${encodeURIComponent(q)}&maxResults=${maxResults}&key=${YOUTUBE_API_KEY}`;
        const searchResponse = await fetch(searchUrl);
        const searchData = await searchResponse.json();

        if (!searchResponse.ok) {
            throw new Error(`YouTube API error: ${searchData.error?.message || 'Unknown error'}`);
        }

        if (!searchData.items || searchData.items.length === 0) {
            return res.json({ items: [] });
        }

        // Get video details (statistics, duration)
        const videoIds = searchData.items.map(item => item.id.videoId).join(',');
        const detailsUrl = `${YOUTUBE_API_BASE}/videos?part=statistics,contentDetails&id=${videoIds}&key=${YOUTUBE_API_KEY}`;
        const detailsResponse = await fetch(detailsUrl);
        const detailsData = await detailsResponse.json();

        // Merge search results with details
        const videosWithDetails = searchData.items.map(video => {
            const details = detailsData.items?.find(item => item.id === video.id.videoId);
            return {
                ...video,
                statistics: details?.statistics || {},
                contentDetails: details?.contentDetails || {}
            };
        });

        res.json({ items: videosWithDetails });

    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Download video using yt-dlp
app.post('/api/download', (req, res) => {
    const { videoId, title } = req.body;
    
    if (!videoId) {
        return res.status(400).json({ error: 'Video ID is required' });
    }

    // Check if video is already downloaded
    const videoFiles = fs.readdirSync(DOWNLOAD_DIR).filter(file => 
        file.includes(videoId) && (file.endsWith('.mp4') || file.endsWith('.webm') || file.endsWith('.mkv'))
    );

    if (videoFiles.length > 0) {
        return res.json({ 
            success: true, 
            videoPath: `/videos/${videoFiles[0]}`,
            message: 'Video already downloaded'
        });
    }

    // Initialize download status
    const downloadId = Date.now().toString();
    downloadStatus.set(downloadId, {
        videoId,
        title: title || 'Unknown',
        status: 'starting',
        progress: 0,
        error: null,
        filePath: null
    });

    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const outputTemplate = path.join(DOWNLOAD_DIR, `${videoId}_%(title)s.%(ext)s`);

    // yt-dlp command with options for best quality mp4
    const ytDlpArgs = [
        videoUrl,
        '-f', 'best[ext=mp4]/best',
        '-o', outputTemplate,
        '--no-playlist'
    ];

    console.log(`Starting download for video ID: ${videoId}`);
    const ytDlpProcess = spawn('yt-dlp', ytDlpArgs);

    // Update status
    downloadStatus.set(downloadId, {
        ...downloadStatus.get(downloadId),
        status: 'downloading',
        process: ytDlpProcess
    });

    let downloadOutput = '';

    ytDlpProcess.stdout.on('data', (data) => {
        const output = data.toString();
        downloadOutput += output;
        
        // Parse progress from yt-dlp output
        const progressMatch = output.match(/(\d+(?:\.\d+)?)%/);
        if (progressMatch) {
            const progress = parseFloat(progressMatch[1]);
            downloadStatus.set(downloadId, {
                ...downloadStatus.get(downloadId),
                progress
            });
        }
    });

    ytDlpProcess.stderr.on('data', (data) => {
        console.error(`yt-dlp error: ${data}`);
    });

    ytDlpProcess.on('close', (code) => {
        if (code === 0) {
            // Find the downloaded file
            const videoFiles = fs.readdirSync(DOWNLOAD_DIR).filter(file => 
                file.includes(videoId) && (file.endsWith('.mp4') || file.endsWith('.webm') || file.endsWith('.mkv'))
            );

            if (videoFiles.length > 0) {
                const filePath = `/videos/${videoFiles[0]}`;
                downloadStatus.set(downloadId, {
                    ...downloadStatus.get(downloadId),
                    status: 'completed',
                    progress: 100,
                    filePath
                });
                console.log(`Download completed: ${videoFiles[0]}`);
            } else {
                downloadStatus.set(downloadId, {
                    ...downloadStatus.get(downloadId),
                    status: 'error',
                    error: 'Downloaded file not found'
                });
            }
        } else {
            downloadStatus.set(downloadId, {
                ...downloadStatus.get(downloadId),
                status: 'error',
                error: `yt-dlp exited with code ${code}`
            });
            console.error(`yt-dlp process exited with code ${code}`);
        }
    });

    res.json({ success: true, downloadId, message: 'Download started' });
});

// Check download status
app.get('/api/download-status/:downloadId', (req, res) => {
    const { downloadId } = req.params;
    const status = downloadStatus.get(downloadId);
    
    if (!status) {
        return res.status(404).json({ error: 'Download not found' });
    }

    // Don't send the process object in response
    const { process, ...statusResponse } = status;
    res.json(statusResponse);
});

// Get all downloaded videos
app.get('/api/downloaded-videos', (req, res) => {
    try {
        const files = fs.readdirSync(DOWNLOAD_DIR);
        const videoFiles = files.filter(file => 
            file.endsWith('.mp4') || file.endsWith('.webm') || file.endsWith('.mkv')
        ).map(file => ({
            name: file,
            path: `/videos/${file}`,
            size: fs.statSync(path.join(DOWNLOAD_DIR, file)).size
        }));
        
        res.json(videoFiles);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete downloaded video
app.delete('/api/video/:filename', (req, res) => {
    try {
        const filename = req.params.filename;
        const filePath = path.join(DOWNLOAD_DIR, filename);
        
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            res.json({ success: true, message: 'Video deleted' });
        } else {
            res.status(404).json({ error: 'Video not found' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Server is running' });
});

// Check if yt-dlp is installed
app.get('/api/check-ytdlp', (req, res) => {
    exec('yt-dlp --version', (error, stdout, stderr) => {
        if (error) {
            res.json({ 
                installed: false, 
                error: 'yt-dlp not found. Please install it first.' 
            });
        } else {
            res.json({ 
                installed: true, 
                version: stdout.trim() 
            });
        }
    });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log('Make sure yt-dlp is installed: pip install yt-dlp');
});