# YouTube Video Search & Downloader

A full-stack application that allows you to search for YouTube videos, download them using yt-dlp, and play them in a custom fullscreen player without using YouTube's interface.

## Features

- 🔍 **Smart Search**: Search for YouTube videos using the YouTube Data API
- 📥 **Video Download**: Download videos using yt-dlp for offline viewing
- 🎥 **Custom Player**: Watch downloaded videos in a custom HTML5 player
- 📊 **Download Progress**: Real-time download progress indicator
- 📱 **Responsive Design**: Works perfectly on desktop, tablet, and mobile devices
- ⚡ **Fast Loading**: Optimized performance with lazy loading images
- 🎨 **Modern UI**: Clean, intuitive design with smooth animations
- ⌨️ **Keyboard Support**: Use Enter to search, Escape to close video player

## Setup Instructions

### 1. Install Dependencies

#### Install yt-dlp
```bash
# Using pip
pip install yt-dlp

# Or using Homebrew (macOS)
brew install yt-dlp

# Or using chocolatey (Windows)
choco install yt-dlp
```

#### Install Node.js dependencies
```bash
npm install
```

### 2. Get YouTube API Key

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **YouTube Data API v3**
4. Create credentials (API Key)
5. Copy your API key

### 3. Configure the Application

1. Open `server.js` in your text editor
2. Find this line:
   ```javascript
   const YOUTUBE_API_KEY = 'YOUR_YOUTUBE_API_KEY';
   ```
3. Replace `'YOUR_YOUTUBE_API_KEY'` with your actual API key:
   ```javascript
   const YOUTUBE_API_KEY = 'your_actual_api_key_here';
   ```

### 4. Run the Application

1. **Start the backend server:**
   ```bash
   npm start
   # Or for development with auto-reload:
   npm run dev
   ```

2. **Open your web browser** and navigate to:
   ```
   http://localhost:3001
   ```

## Usage

1. **Search Videos**: Enter keywords in the search bar and press Enter or click the search button
2. **Download & Play**: Click on any video thumbnail to download it and play in the custom player
3. **Monitor Progress**: Watch the download progress bar at the bottom of each video card
4. **Close Player**: Click the X button, press Escape, or click outside the video to close
5. **Mobile**: The app is fully responsive and touch-friendly on mobile devices

## File Structure

```
Youtube/
├── index.html              # Main HTML file
├── styles.css              # CSS styling  
├── script.js               # Frontend JavaScript
├── server.js               # Backend Node.js server
├── package.json            # Node.js dependencies
├── downloaded_videos/      # Downloaded video files (auto-created)
└── README.md              # This file
```

## How It Works

1. **Search**: Frontend searches YouTube using the Data API via the backend
2. **Download**: When you click a video, the backend uses yt-dlp to download it
3. **Progress**: Real-time download progress is shown via WebSocket-like polling
4. **Play**: Once downloaded, the video plays in a custom HTML5 player
5. **Cache**: Downloaded videos are saved locally for future viewing

## Important Notes

⚠️ **Legal Disclaimer**: This tool is for personal use only. Downloading YouTube videos may violate YouTube's Terms of Service and copyright laws depending on the content and your jurisdiction. Use responsibly and ensure you have the right to download the content.

⚠️ **Storage**: Downloaded videos will consume disk space. The app stores videos in the `downloaded_videos/` folder.

## Browser Compatibility

- Chrome (recommended)
- Firefox
- Safari
- Edge

## API Quotas

The YouTube Data API has usage quotas. For personal use, the free tier is usually sufficient. Monitor your usage in the Google Cloud Console if needed.

## Customization

### Changing Colors
Edit the CSS variables in `styles.css` to customize the color scheme:
- Search button color: `.search-btn { background: #ff0000; }`
- Gradient background: `body { background: linear-gradient(...); }`

### Adjusting Video Grid
Modify the grid layout in `styles.css`:
```css
.video-grid {
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
}
```

### Search Results Count
Change the number of results in `script.js`:
```javascript
const searchUrl = `${API_BASE_URL}/search?part=snippet&type=video&q=${encodeURIComponent(query)}&maxResults=12&key=${API_KEY}`;
```

## Troubleshooting

### "Backend server is not running" Error
- Make sure you've started the server with `npm start`
- Check that the server is running on port 3001
- Verify no other application is using port 3001

### "yt-dlp is not installed" Error
- Install yt-dlp using `pip install yt-dlp`
- Make sure yt-dlp is in your system PATH
- Try running `yt-dlp --version` in terminal to verify installation

### "API key not configured" Error
- Make sure you've replaced `YOUR_YOUTUBE_API_KEY` in `server.js`
- Verify your API key is correct and has YouTube Data API v3 enabled
- Restart the server after changing the API key

### Download Fails
- Check your internet connection
- Verify yt-dlp is properly installed and updated
- Some videos may be geo-blocked or have download restrictions
- Check server logs in the terminal for detailed error messages

### Video Won't Play
- Ensure the download completed successfully
- Check if your browser supports the video format (MP4/WebM)
- Try refreshing the page and downloading again

## License

This project is open source and available under the MIT License.

## Contributing

Feel free to fork this project and submit pull requests for improvements!