# 🌌 InstaGlide

A premium, aerospace-grade Instagram Media Downloader and Creator Profile Explorer. Featuring a design inspired by **Google Gemini** and **Antigravity**'s futuristic precision, **InstaGlide** provides seamless high-performance extraction of single posts, videos, reels, and entire carousel slides, alongside profile exploration and intelligent batch downloading.

---

## ✨ Features

- **🎯 Dual-Mode Extraction**:
  - **Single Downloader**: Instantly extract details and source assets from Reels, single images, videos, or full Carousel/Sidecar posts using a swiper-based visual inspector.
  - **Profile Explorer**: Input any public Instagram handle (e.g. `@antigravity_global`) to instantly parse their feed, visual grid, captions, statistics, and metadata.
- **⚡ Sequential Batch Downloading**:
  - **Multi-Select & Select All**: Easily toggle selection across creator posts.
  - **Intelligent Queue System**: Queue multiple high-resolution downloads in a slide-out panel that downloads files sequentially with a built-in `1.5-second rate limiting delay` to prevent network bottlenecks or browser throttles.
- **💫 Gemini × Antigravity Design System**:
  - Deep space black (`#0a0a14`) with responsive blue/purple nebula backdrop glows.
  - Ultra-refined dark frosted glass cards (`rgba(66, 133, 244, 0.08)`) with metallic-sleek borders.
  - Vibrant **Gemini Spark** accent gradient buttons (`#4285F4` → `#8B5CF6` → `#EC4899`) and subtle micro-animations.
  - Elegant typography featuring `DM Sans` (headings), `Inter` (body), and `Noto Sans Mono` (technical details).
- **🛡️ Robust Engine**:
  - **GraphQL DocID Fetcher**: Employs native API calls (`doc_id=9510064595728286`) with a robust User-Agent rotator and custom request headers (`X-IG-App-ID`).
  - **Resilient Fallbacks**: Auto-downgrades to page-scrape embeds if the native endpoints are throttled.
  - **Built-in CORS Proxy**: Stream files directly through the Express backend so users can download actual media attachments directly rather than opening links in new tabs.

---

## 🛠️ Architecture & Tech Stack

- **Frontend**: Vanilla HTML5, modern client-side JavaScript, custom CSS3, Google Fonts.
- **Backend**: Node.js, Express, Axios, Cheerio, CORS.
- **Rate-Limiting & Proxying**: Implements proxy streams (`/api/proxy`) to bypass CORS on Instagram CDN resources and safe downloads.

---

## 🚀 Getting Started

### 📋 Prerequisites
Ensure you have [Node.js](https://nodejs.org/) installed (v16.0.0 or higher recommended).

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

### 🌐 Cloud Deployment (Render)
InstaGlide includes a fully-configured `render.yaml` blueprint for instant cloud deployment:
1. Create a free account on **[Render](https://render.com/)**.
2. Click **New +** -> **Blueprint**.
3. Connect your GitHub repository `InstaGlide`.
4. Render will automatically read `render.yaml` and deploy your Node.js application! Every future commit pushed to your GitHub `main` branch will trigger an automated build and deploy.

---

## 📂 Project Structure

```
instaglide/
├── public/                 # Client assets
│   ├── index.html          # Main HTML structure
│   ├── style.css           # Gemini × Antigravity custom stylesheet
│   └── app.js              # State orchestration, queue, and swiper engine
├── server.js               # Express application with GraphQL and stream proxy APIs
├── package.json            # Node configurations and dependency trees
└── .gitignore              # Ignores local debug files and node modules
```

---

## 🔐 Privacy & Security Disclaimer
This application is strictly designed for personal backups, developer education, and creative research. All scraped media downloads are processed on-the-fly and streamed directly from public Instagram CDN servers without permanent storage on the host server. Always respect copyright guidelines and content ownership when downloading creator assets.
