# 🌌 InstaGlide Downloader Suite

A premium, aerospace-grade multi-platform media downloader. Combining **Google Gemini**'s clean, intelligent design language with **Antigravity**'s futuristic precision, **InstaGlide** provides seamless high-performance extraction and downloading of Instagram single media (videos, reels, images, carousel slidecars), public creator profiles, and a complete high-fidelity **YouTube Music Downloader & Playlist Suite** streaming best-quality audio (M4A/AAC).

---

## ✨ Features

### 📸 Instagram Downloader Suite
- **🎯 Dual-Mode Extraction**:
  - **Single Downloader**: Instantly extract details and source assets from Reels, single images, videos, or full Carousel/Sidecar posts using a swiper-based visual inspector.
  - **Profile Explorer**: Input any public Instagram handle (e.g., `@antigravity_global`) to instantly parse their feed, visual grid, captions, statistics, and metadata.
- **🛡️ Resilient Scraper Engine**:
  - **GraphQL DocID Fetcher**: Employs native API calls (`doc_id=9510064595728286`) with a robust User-Agent rotator and custom request headers (`X-IG-App-ID`).
  - **Resilient Fallbacks**: Auto-downgrades to page-scrape embeds if the native endpoints are throttled.
  - **CORS Bypass Streaming Proxy**: Stream files directly through the Express backend so users can download actual media attachments directly rather than opening links in new tabs.

### 🎵 YouTube Music Suite (New!)
- **🎧 Best-Quality Audio extraction**: Automatically extracts and serves the highest quality progressive audio stream (typically 256kbps AAC in an `.m4a` container) directly.
- **📋 Playlist Track Checklist**: Renders a rich list containing playlist cover, creator metadata, and track listings with exact duration indicators. Features interactive checkbox selections, Select All toggles, and live selection counters.
- **⚡ Progressive Pipe Streaming**: Dynamically pipes binary streams (`res.pipe()`) directly from YouTube CDN servers to the browser. Fully on-the-fly and memory-safe—bypasses server disk writes entirely to fit within free cloud tier limitations.

### ⚙️ Premium UX & Styling
- **⚡ Sequential Batch Downloading**: Select multiple posts or track listings and download them sequentially inside our custom slide-out queue overlay. Features a built-in `1.5-second rate limiting delay` to bypass rate limits and guarantee browser downloads.
- **💫 Gemini × Antigravity Theme**:
  - Deep space black (`#0a0a14`) with responsive blue/purple nebula backdrop glows.
  - Ultra-refined dark frosted glass cards (`rgba(66, 133, 244, 0.08)`) with metallic-sleek borders.
  - Vibrant **Gemini Spark** accent gradient buttons (`#4285F4` → `#8B5CF6` → `#EC4899`) and subtle micro-animations.
  - Elegant typography featuring `DM Sans` (headings), `Inter` (body), and `Noto Sans Mono` (technical details).
- **📂 Activity History Log**: Local storage persistence caches recent downloads (including images, videos, and music tracks) for quick, one-click re-downloads with specialized media badges.

---

## 🛠️ Architecture & Tech Stack

- **Frontend**: Vanilla HTML5, modern client-side JavaScript, custom CSS3 variables, Lucide icons.
- **Backend**: Node.js, Express, Axios, Cheerio, CORS.
- **Media Engine**: `youtube-dl-exec` (modern wrapper for the high-performance `yt-dlp` media extraction system).

---

## 🚀 Getting Started

### 📋 Prerequisites
Ensure you have [Node.js](https://nodejs.org/) installed (v18.0.0 or higher recommended).

### ⚙️ Installation
1. Clone or navigate to the repository directory.
2. Install the production dependencies:
   ```bash
   npm install
   ```

### 🏃‍♂️ Running the App
Start the local development server:
```bash
npm start
```
The server will boot up and report active listeners:
```
=================================================
🚀 Premium Instagram Downloader Server Active!
🔌 Listening on: http://localhost:3000
=================================================
```

Open your browser and navigate to **`http://localhost:3000`** to experience the dashboard.

### 🍪 Bypassing YouTube Bot Challenges / "Sign in to confirm you're not a bot"
If you host this application on cloud providers like Render or if your local IP is rate-limited by YouTube, you may encounter an error asking to **"Sign in to confirm you're not a bot"**. This is a standard security measure enforced by YouTube on datacenter IP addresses.

To bypass this check safely and continue downloading high-fidelity streams:
1. Log in to YouTube in your web browser (using a secondary or throwaway Google account is recommended for security).
2. Install a browser extension that allows exporting cookies in Netscape format, such as **Get cookies.txt LOCALLY** (Chrome/Firefox).
3. Navigate to YouTube, click the extension, and export/download your cookies in **Netscape** format.
4. Save the downloaded file as **`cookies.txt`** and place it in the **root directory** of this project (same folder as `server.js`).
5. The application backend will automatically detect the presence of `cookies.txt` at runtime and attach it to your `yt-dlp` requests, fully bypassing bot challenges!

### 🌐 Cloud Deployment (Render)
InstaGlide includes a fully-configured `render.yaml` blueprint for instant cloud deployment:
1. Create a free account on **[Render](https://render.com/)**.
2. Click **New +** -> **Blueprint**.
3. Connect your GitHub repository `InstaGlide`.
4. Render will automatically read `render.yaml` and deploy your Node.js application! Every future commit pushed to your GitHub `main` branch will trigger an automated build and deploy.

### ⚡ Serverless Deployment (Vercel)
InstaGlide is fully optimized for **Vercel Serverless Functions** with an embedded `vercel.json` config:
1. Sign up for a free account on **[Vercel](https://vercel.com/)**.
2. Click **Add New** -> **Project**.
3. Import your GitHub repository `InstaGlide`.
4. Click **Deploy**! Vercel will automatically configure the routes and deploy your application as an ultra-fast serverless app.

---

## 📂 Project Structure

```
instaglide/
├── public/                 # Client assets
│   ├── index.html          # Main HTML structure with triple-tab layouts
│   ├── style.css           # Gemini × Antigravity custom stylesheet
│   └── app.js              # State orchestration, queue, and playlist engines
├── server.js               # Express application with GraphQL, CORS proxy, and YT download APIs
├── package.json            # Node configurations, scripts, and dependency trees
└── .gitignore              # Ignores local debug files and node modules
```

---

## 🔐 Privacy & Security Disclaimer
This application is strictly designed for personal backups, developer education, and creative research. All scraped media downloads are processed on-the-fly and streamed directly from public CDN servers without permanent storage on the host server. Always respect copyright guidelines and content ownership when downloading creator assets.
