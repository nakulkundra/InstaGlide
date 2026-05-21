import express from 'express';
import cors from 'cors';
import axios from 'axios';
import * as cheerio from 'cheerio';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';
import { create as createYoutubeDl } from 'youtube-dl-exec';
import { execSync } from 'child_process';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Resolve __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let youtubedl;

// Dynamic, self-healing yt-dlp resolver and downloader
async function bootstrapYtDlp() {
  const binDir = path.resolve(__dirname, 'bin');
  if (!fs.existsSync(binDir)) {
    fs.mkdirSync(binDir, { recursive: true });
  }

  const platform = process.platform;
  let binaryName = 'yt-dlp';
  let downloadUrl = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp';

  if (platform === 'win32') {
    binaryName = 'yt-dlp.exe';
    downloadUrl = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe';
  } else if (platform === 'darwin') {
    binaryName = 'yt-dlp_macos';
    downloadUrl = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos';
  }

  const binaryPath = path.join(binDir, binaryName);

  if (fs.existsSync(binaryPath)) {
    console.log(`[API/YT] Found local latest yt-dlp binary at: ${binaryPath}`);
    youtubedl = createYoutubeDl(binaryPath);
    return;
  }

  console.log(`[API/YT] yt-dlp binary not found. Dynamically downloading latest release from: ${downloadUrl}`);
  try {
    const response = await axios({
      method: 'GET',
      url: downloadUrl,
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0'
      },
      timeout: 45000 // 45s timeout for download
    });

    fs.writeFileSync(binaryPath, response.data);
    fs.chmodSync(binaryPath, 0o755);
    console.log(`[API/YT] Successfully downloaded and set executable permissions for: ${binaryPath}`);
    youtubedl = createYoutubeDl(binaryPath);
  } catch (err) {
    console.error(`[API/YT] Dynamic yt-dlp download failed: ${err.message}`);
    
    // Check if system already has yt-dlp installed globally in PATH as a fallback
    try {
      execSync('which yt-dlp');
      console.log(`[API/YT] Fallback: Found global 'yt-dlp' in system PATH. Initializing with it.`);
      youtubedl = createYoutubeDl('yt-dlp');
    } catch (_) {
      console.log(`[API/YT] Attempting standard fallback to default youtube-dl-exec...`);
      youtubedl = createYoutubeDl();
    }
  }
}

// Helper to get yt-dlp options with auto-detected cookies.txt to bypass YouTube bot detection
function getYoutubeDlOptions(extraParams = {}) {
  const options = {
    noCheckCertificates: true,
    noWarnings: true,
    jsRuntimes: 'node', // Crucial for solving YouTube signature 'n' challenges on modern player endpoints
    ...extraParams
  };

  const cookiesPath = path.resolve(__dirname, 'cookies.txt');
  if (fs.existsSync(cookiesPath)) {
    const stats = fs.statSync(cookiesPath);
    console.log(`[API/YT] Auto-detected cookies.txt at: ${cookiesPath} (Size: ${stats.size} bytes). Attaching to yt-dlp.`);
    options.cookies = cookiesPath;
  } else {
    console.warn(`[API/YT] WARNING: cookies.txt NOT found at: ${cookiesPath}`);
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[API/YT] Local development active. Trying to read cookies from local Chrome...`);
      options.cookiesFromBrowser = 'chrome';
    }
  }

  return options;
}


// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Serve static frontend files from 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Standard headers to mimic a real desktop browser
const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Cache-Control': 'max-age=0'
};

/**
 * Endpoint to scrape metadata and direct video/image stream URL for a single post/reel.
 */
app.post('/api/download', async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ success: false, error: 'Instagram URL is required' });
  }

  try {
    // 1. Sanitize and normalize the URL
    let cleanUrl = url.trim().split('?')[0]; // Remove query params
    if (!cleanUrl.endsWith('/')) {
      cleanUrl += '/';
    }

    // Ensure it's a valid Instagram link
    if (!cleanUrl.includes('instagram.com/')) {
      return res.status(400).json({ success: false, error: 'Invalid Instagram URL' });
    }

    console.log(`[API/Download] Scraped URL: ${cleanUrl}`);

    // Extract shortcode
    const matches = cleanUrl.match(/\/(?:p|reel|tv|reels)\/([A-Za-z0-9_-]+)/);
    if (!matches) {
      return res.status(400).json({ success: false, error: 'Could not extract shortcode from Instagram URL' });
    }
    const shortcode = matches[1];

    // Method 1: Try Native Instagram GraphQL API with doc_id
    try {
      const variables = JSON.stringify({
        shortcode: shortcode,
        fetch_tagged_user_count: null,
        hoisted_comment_id: null,
        hoisted_reply_id: null
      });

      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'X-IG-App-ID': '936619743392459',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': `https://www.instagram.com/p/${shortcode}/`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Connection': 'keep-alive'
      };

      console.log(`[API/Download] Trying Native GraphQL API for shortcode: ${shortcode}`);
      const getUrl = `https://www.instagram.com/graphql/query/?doc_id=9510064595728286&variables=${encodeURIComponent(variables)}`;
      
      const response = await axios.get(getUrl, {
        headers,
        timeout: 10000
      });

      if (response.data?.data?.xdt_shortcode_media) {
        const media = response.data.data.xdt_shortcode_media;
        const author = media.owner?.username || 'instagram_creator';
        const avatar = media.owner?.profile_pic_url || '';
        const caption = media.edge_media_to_caption?.edges?.[0]?.node?.text || 'Instagram Media';
        const isVideo = media.is_video;
        const downloadUrl = isVideo ? media.video_url : media.display_url;
        const thumbnailUrl = media.display_url;

        // Carousel slidecar check
        const isCarousel = media.__typename === 'XDTGraphSidecar';
        let carousel = [];

        if (isCarousel && media.edge_sidecar_to_children?.edges) {
          carousel = media.edge_sidecar_to_children.edges.map(edge => {
            const node = edge.node;
            return {
              isVideo: node.is_video,
              downloadUrl: node.video_url || node.display_url,
              thumbnailUrl: node.display_url
            };
          });
        }

        console.log(`[API/Download] Native GraphQL Success! Type: ${media.__typename}, isVideo: ${isVideo}, isCarousel: ${isCarousel}`);
        return res.json({
          success: true,
          isVideo,
          downloadUrl,
          thumbnailUrl,
          caption,
          author: `@${author}`,
          avatar,
          isCarousel,
          carousel
        });
      }
    } catch (graphqlError) {
      console.warn(`[API/Download] Native GraphQL failed: ${graphqlError.message}. Trying Fallback API...`);
    }

    // Method 2: Try Shortcode API JSON endpoint (?__a=1&__d=dis)
    try {
      const fallbackUrl = `https://www.instagram.com/p/${shortcode}/?__a=1&__d=dis`;
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'X-IG-App-ID': '936619743392459',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': `https://www.instagram.com/p/${shortcode}/`,
        'Connection': 'keep-alive'
      };

      console.log(`[API/Download] Trying Fallback Shortcode API for shortcode: ${shortcode}`);
      const response = await axios.get(fallbackUrl, {
        headers,
        timeout: 10000
      });

      if (response.data?.items && response.data.items.length > 0) {
        const item = response.data.items[0];
        const isVideo = !!item.video_versions;
        let downloadUrl = '';
        if (isVideo && item.video_versions.length > 0) {
          downloadUrl = item.video_versions[0].url;
        } else if (item.image_versions2?.candidates && item.image_versions2.candidates.length > 0) {
          downloadUrl = item.image_versions2.candidates[0].url;
        }
        const thumbnailUrl = item.image_versions2?.candidates?.[0]?.url || '';
        const author = item.user?.username || 'instagram_creator';
        const avatar = item.user?.profile_pic_url || '';
        const caption = item.caption?.text || 'Instagram Media';

        const isCarousel = item.carousel_media && item.carousel_media.length > 0;
        let carousel = [];
        if (isCarousel) {
          carousel = item.carousel_media.map(mediaItem => {
            const isVid = !!mediaItem.video_versions;
            return {
              isVideo: isVid,
              downloadUrl: isVid ? mediaItem.video_versions[0].url : mediaItem.image_versions2.candidates[0].url,
              thumbnailUrl: mediaItem.image_versions2.candidates[0].url
            };
          });
        }

        console.log(`[API/Download] Fallback Shortcode Success! isVideo: ${isVideo}, isCarousel: ${isCarousel}`);
        return res.json({
          success: true,
          isVideo,
          downloadUrl,
          thumbnailUrl,
          caption,
          author: `@${author}`,
          avatar,
          isCarousel,
          carousel
        });
      }
    } catch (fallbackError) {
      console.warn(`[API/Download] Fallback Shortcode API failed: ${fallbackError.message}. Trying legacy Embed scrape...`);
    }

    // Method 3: Legacy embed DOM scraper
    const embedUrl = `${cleanUrl}embed/captioned/`;
    let embedResponse;
    try {
      embedResponse = await axios.get(embedUrl, {
        headers: BROWSER_HEADERS,
        timeout: 10000
      });
    } catch (err) {
      console.error('[API/Download] Embed request failed, trying raw page...', err.message);
      embedResponse = await axios.get(cleanUrl, {
        headers: BROWSER_HEADERS,
        timeout: 10000
      });
    }

    const html = embedResponse.data;
    const $ = cheerio.load(html);

    let videoUrl = $('video').attr('src');
    let imageUrl = $('.EmbeddedMediaImage').attr('src') || $('meta[property="og:image"]').attr('content');
    let caption = $('.CaptionText').text().trim() || $('.Caption').text().trim() || $('meta[property="og:description"]').attr('content') || 'Instagram Media';
    let author = $('.UsernameText').text().trim() || 'Instagram Creator';
    let avatar = $('.Avatar').attr('src') || '';

    if (caption.includes('Instagram:')) {
      caption = caption.split('Instagram:')[1].trim();
    }

    if (!videoUrl) {
      const videoMatch = html.match(/"video_url"\s*:\s*"([^"]+)"/) || 
                         html.match(/video_url\\":\\"(.*?)\\"/) ||
                         html.match(/"videoSource"\s*:\s*"([^"]+)"/);
      
      if (videoMatch) {
        videoUrl = videoMatch[1].replace(/\\u0026/g, '&').replace(/\\/g, '');
      }
    }

    const isVideo = !!videoUrl;
    const downloadUrl = isVideo ? videoUrl : imageUrl;

    if (!downloadUrl) {
      return res.status(404).json({
        success: false,
        error: 'Unable to extract download URL. The post might be private, restricted, or rate-limited.'
      });
    }

    console.log(`[API/Download] Legacy Scraper Success! isVideo: ${isVideo}`);
    return res.json({
      success: true,
      isVideo,
      downloadUrl,
      thumbnailUrl: imageUrl,
      caption,
      author: author.startsWith('@') ? author : `@${author}`,
      avatar,
      isCarousel: false,
      carousel: []
    });

  } catch (error) {
    console.error('[API/Download] Error processing single download:', error.message);
    return res.status(500).json({
      success: false,
      error: 'An internal error occurred while scraping the video. Please check the link and try again.'
    });
  }
});

/**
 * Endpoint to scrape public Instagram profiles via viewer mirrors (Imginn/Greatphone).
 */
app.get('/api/profile/:username', async (req, res) => {
  let { username } = req.params;

  if (!username) {
    return res.status(400).json({ success: false, error: 'Username is required' });
  }

  // Sanitize username (remove @ if present, trim whitespace)
  username = username.trim().replace(/^@/, '');

  console.log(`[API/Profile] Scraping profile: ${username}`);

  // Method 1: Try Instagram native web profile API
  try {
    const url = `https://www.instagram.com/api/v1/users/web_profile_info/?username=${username}`;
    
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      'X-IG-App-ID': '936619743392459',
      'X-Requested-With': 'XMLHttpRequest',
      'Referer': `https://www.instagram.com/${username}/`,
      'Connection': 'keep-alive'
    };

    console.log(`[API/Profile] Fetching profile from Native API for ${username}...`);
    const response = await axios.get(url, {
      headers,
      timeout: 12000
    });

    if (response.data?.data?.user) {
      const user = response.data.data.user;
      const avatar = user.profile_pic_url_hd || user.profile_pic_url || '';
      const name = user.full_name || username;
      const bio = user.biography || '';
      const postsEdges = user.edge_owner_to_timeline_media?.edges || [];

      console.log(`[API/Profile] Success fetching profile from Native API. Found ${postsEdges.length} posts.`);

      const posts = postsEdges.map(edge => {
        const node = edge.node;
        const shortcode = node.shortcode;
        const caption = node.edge_media_to_caption?.edges?.[0]?.node?.text || '';
        const isVideo = node.is_video;
        const thumbnail = node.display_url;
        return {
          shortcode,
          url: `https://www.instagram.com/p/${shortcode}/`,
          thumbnail,
          type: isVideo ? 'video' : 'image',
          caption: caption.trim()
        };
      });

      return res.json({
        success: true,
        source: 'Instagram Native API',
        profile: {
          username,
          name,
          bio,
          avatarUrl: avatar
        },
        posts
      });
    }
  } catch (err) {
    console.warn(`[API/Profile] Native API failed: ${err.message}. Trying mirror fallback...`);
  }

  // Method 2: Fallback to public mirrors (Imginn/Greatphone)
  const mirrors = [
    {
      name: 'Imginn',
      url: `https://imginn.com/${username}/`,
      parser: (html) => {
        const $ = cheerio.load(html);
        const posts = [];

        // Parse profile meta info
        const avatar = $('.profile-avatar img').attr('src') || $('.avatar img').attr('src') || '';
        const name = $('.profile-name h1').text().trim() || $('.name').text().trim() || username;
        const bio = $('.profile-bio').text().trim() || $('.bio').text().trim() || 'Instagram Creator';

        // Parse posts
        $('a').each((i, el) => {
          const href = $(el).attr('href') || '';
          // Imginn uses links with /p/ for posts
          if (href.includes('/p/')) {
            const shortcode = href.split('/p/')[1].replace(/\//g, '');
            const img = $(el).find('img');
            const thumbnail = img.attr('src') || img.attr('data-src') || '';
            const caption = img.attr('alt') || $(el).find('.desc').text().trim() || '';
            
            // Check for play/video elements or tags to determine if it's a video
            const hasVideoIndicator = $(el).find('.video, .play, i.fa-play, .video-icon, .icon-play').length > 0 || 
                                     href.includes('/reel/') || 
                                     $(el).text().toLowerCase().includes('video');

            if (shortcode && !posts.some(p => p.shortcode === shortcode)) {
              posts.push({
                shortcode,
                url: `https://www.instagram.com/p/${shortcode}/`,
                thumbnail,
                type: hasVideoIndicator ? 'video' : 'image',
                caption: caption.trim()
              });
            }
          }
        });

        return { avatar, name, bio, posts };
      }
    },
    {
      name: 'Greatphone',
      url: `https://greatphone.com/profile/${username}`,
      parser: (html) => {
        const $ = cheerio.load(html);
        const posts = [];

        const avatar = $('.avatar img').attr('src') || '';
        const name = $('.user-name').text().trim() || username;
        const bio = $('.user-bio').text().trim() || 'Instagram Creator';

        $('a').each((i, el) => {
          const href = $(el).attr('href') || '';
          if (href.includes('/p/') || href.includes('/reel/')) {
            const pathParts = href.split('/');
            const shortcode = pathParts[pathParts.length - 2] || pathParts[pathParts.length - 1];
            const img = $(el).find('img');
            const thumbnail = img.attr('src') || '';
            const caption = img.attr('alt') || '';
            const isVideo = $(el).find('.play-button, .video-badge').length > 0 || href.includes('/reel/');

            if (shortcode && !posts.some(p => p.shortcode === shortcode)) {
              posts.push({
                shortcode,
                url: `https://www.instagram.com/p/${shortcode}/`,
                thumbnail,
                type: isVideo ? 'video' : 'image',
                caption: caption.trim()
              });
            }
          }
        });

        return { avatar, name, bio, posts };
      }
    }
  ];

  // Try each mirror sequentially until one succeeds
  for (const mirror of mirrors) {
    try {
      console.log(`[API/Profile] Trying mirror fallback: ${mirror.name}`);
      const response = await axios.get(mirror.url, {
        headers: BROWSER_HEADERS,
        timeout: 12000
      });

      const data = mirror.parser(response.data);

      if (data.posts && data.posts.length > 0) {
        console.log(`[API/Profile] Success fetching profile from mirror ${mirror.name}. Found ${data.posts.length} posts.`);
        return res.json({
          success: true,
          source: mirror.name,
          profile: {
            username,
            name: data.name,
            bio: data.bio,
            avatarUrl: data.avatarUrl || data.avatar
          },
          posts: data.posts
        });
      }
      
      console.warn(`[API/Profile] Mirror ${mirror.name} returned 0 posts, trying next...`);
    } catch (err) {
      console.error(`[API/Profile] Mirror ${mirror.name} failed:`, err.message);
    }
  }

  // If all mirrors fail, return error
  return res.status(404).json({
    success: false,
    error: `Unable to retrieve posts for username: "${username}". The profile might be private, deactivated, or our scraper is currently rate-limited.`
  });
});

/**
 * ============================================================================
 * YOUTUBE MUSIC / VIDEO SUITE ENDPOINTS
 * ============================================================================
 */

/**
 * Endpoint to fetch YouTube or YouTube Music single song/video or playlist metadata.
 * Uses yt-dlp to extract titles, creators, cover thumbnails, durations, and playlist tracks.
 */
app.get('/api/yt/info', async (req, res) => {
  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ success: false, error: 'YouTube URL is required' });
  }

  console.log(`[API/YT] Fetching metadata for URL: ${url}`);
  try {
    // Run yt-dlp to get flat playlist info or single video info
    const info = await youtubedl(url, getYoutubeDlOptions({
      dumpSingleJson: true,
      flatPlaylist: true,
      preferFreeFormats: true
    }));

    if (!info) {
      throw new Error('Failed to retrieve video metadata');
    }

    // Determine if it is a playlist or a single video
    const isPlaylist = info._type === 'playlist' || Array.isArray(info.entries);

    if (isPlaylist) {
      console.log(`[API/YT] Detected Playlist: "${info.title}". Found ${info.entries.length} tracks.`);
      const entries = info.entries.map(entry => {
        // Handle thumbnails safely
        let thumbnail = '';
        if (entry.thumbnails && entry.thumbnails.length > 0) {
          thumbnail = entry.thumbnails[entry.thumbnails.length - 1].url;
        } else {
          thumbnail = `https://i.ytimg.com/vi/${entry.id}/hqdefault.jpg`;
        }

        return {
          id: entry.id,
          title: entry.title || 'Unknown Track',
          artist: entry.uploader || entry.channel || info.title || 'Unknown Artist',
          thumbnail: thumbnail,
          duration: entry.duration || 0
        };
      });

      return res.json({
        success: true,
        type: 'playlist',
        id: info.id,
        title: info.title || 'Unknown Playlist',
        artist: info.uploader || info.channel || 'Unknown Creator',
        thumbnail: info.thumbnails && info.thumbnails.length > 0 ? info.thumbnails[info.thumbnails.length - 1].url : entries[0]?.thumbnail || '',
        entriesCount: entries.length,
        entries: entries
      });
    } else {
      console.log(`[API/YT] Detected Single Track: "${info.title}"`);
      // Single video
      let thumbnail = '';
      if (info.thumbnails && info.thumbnails.length > 0) {
        thumbnail = info.thumbnails[info.thumbnails.length - 1].url;
      } else {
        thumbnail = `https://i.ytimg.com/vi/${info.id}/hqdefault.jpg`;
      }

      return res.json({
        success: true,
        type: 'video',
        id: info.id,
        title: info.title || 'Unknown Track',
        artist: info.uploader || info.channel || 'Unknown Artist',
        thumbnail: thumbnail,
        duration: info.duration || 0
      });
    }
  } catch (error) {
    console.error('[API/YT] Error fetching metadata:', error.message);
    const isVercelSandbox = !!process.env.VERCEL || error.message.includes('python3') || error.message.includes('ENOENT');
    if (isVercelSandbox) {
      return res.status(500).json({
        success: false,
        isVercelSandbox: true,
        error: 'Vercel Serverless Sandbox Limitations detected. AWS Lambda does not support python/yt-dlp binary extractions.'
      });
    }
    let errMsg = `Failed to retrieve YouTube Music metadata: ${error.message}`;
    if (error.message.includes('confirm you\'re not a bot') || error.message.includes('Sign in')) {
      errMsg += '. YouTube is blocking this request with a bot challenge. To resolve this, export your YouTube cookies as a Netscape-format "cookies.txt" file and place it in the application\'s root directory.';
    }
    return res.status(500).json({
      success: false,
      error: errMsg
    });
  }
});

/**
 * Endpoint to stream best quality YouTube audio (typically 128kbps/256kbps AAC in an M4A container)
 * directly to the client browser on-the-fly, completely bypassing local disk writes.
 */
app.get('/api/yt/download', async (req, res) => {
  const { id } = req.query;
  if (!id) {
    return res.status(400).send('YouTube Video ID is required');
  }

  const url = `https://www.youtube.com/watch?v=${id}`;
  console.log(`[API/YT] Fetching high-quality audio stream for Video ID: ${id}`);

  try {
    // 1. Get metadata title and uploader to set correct filename
    let title = 'Audio';
    let artist = 'YouTube';

    try {
      const meta = await youtubedl(url, getYoutubeDlOptions({
        dumpSingleJson: true
      }));
      if (meta) {
        title = meta.title || 'Audio';
        artist = meta.uploader || meta.channel || 'YouTube';
      }
    } catch (e) {
      console.warn('[API/YT] Could not retrieve metadata for filename creation, using defaults');
    }

    // Clean up filename (replace spaces, secure chars)
    const cleanFilename = `${artist} - ${title}`.replace(/[\\/:*?"<>|]/g, '_').trim();

    // 2. Get direct CDN progressive stream URL for best quality audio
    // We prioritize M4A containers (AAC) because they are natively supported by browsers and devices,
    // otherwise fallback to any bestaudio track (Opus/WebM).
    const streamUrl = await youtubedl(url, getYoutubeDlOptions({
      getUrl: true,
      format: 'bestaudio[ext=m4a]/bestaudio'
    }));

    const targetStreamUrl = streamUrl.trim();
    if (!targetStreamUrl) {
      throw new Error('Direct stream URL could not be resolved');
    }

    console.log(`[API/YT] Resolved direct CDN stream URL. Streaming track...`);

    // 3. Initiate progressive binary stream to client
    const response = await axios({
      method: 'get',
      url: targetStreamUrl,
      responseType: 'stream',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.youtube.com/',
        'Origin': 'https://www.youtube.com'
      }
    });

    // Set high-fidelity download headers
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(cleanFilename)}.m4a"`);
    res.setHeader('Content-Type', 'audio/x-m4a');
    
    // Support content-length if available
    if (response.headers['content-length']) {
      res.setHeader('Content-Length', response.headers['content-length']);
    }

    // Pipe response
    response.data.pipe(res);

  } catch (error) {
    console.error('[API/YT] Download failed:', error.message);
    if (!res.headersSent) {
      const isVercelSandbox = !!process.env.VERCEL || error.message.includes('python3') || error.message.includes('ENOENT');
      if (isVercelSandbox) {
        res.setHeader('Content-Type', 'application/json');
        return res.status(500).json({
          success: false,
          isVercelSandbox: true,
          error: 'Vercel Serverless Sandbox Limitations detected. AWS Lambda does not support python/yt-dlp binary extractions.'
        });
      }
      let errMsg = `Failed to stream YouTube Music audio: ${error.message}`;
      if (error.message.includes('confirm you\'re not a bot') || error.message.includes('Sign in')) {
        errMsg += '. YouTube is blocking this request with a bot challenge. To resolve this, export your YouTube cookies as a Netscape-format "cookies.txt" file and place it in the application\'s root directory.';
      }
      res.status(500).send(errMsg);
    }
  }
});

/**
 * CORS proxy endpoint to stream binary files (images/videos) directly to the browser.
 * This is crucial for bypassing browser-side CORS blocks on CDN domains (*.fbcdn.net).
 */
app.get('/api/proxy', async (req, res) => {
  const { url } = req.query;

  if (!url) {
    return res.status(400).send('Target URL is required');
  }

  try {
    console.log(`[API/Proxy] Streaming content: ${url.substring(0, 80)}...`);

    const response = await axios({
      url,
      method: 'GET',
      responseType: 'stream',
      headers: {
        'User-Agent': BROWSER_HEADERS['User-Agent'],
        'Referer': 'https://www.instagram.com/'
      },
      timeout: 15000
    });

    // Set appropriate content headers
    const contentType = response.headers['content-type'] || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);

    if (response.headers['content-length']) {
      res.setHeader('Content-Length', response.headers['content-length']);
    }

    // Set header to trigger physical browser download
    const isVideo = contentType.startsWith('video');
    const extension = isVideo ? 'mp4' : 'jpg';
    res.setHeader('Content-Disposition', `attachment; filename="instagram_media_${Date.now()}.${extension}"`);

    // Pipe binary stream directly back to client
    response.data.pipe(res);

  } catch (error) {
    console.error('[API/Proxy] Error proxying file:', error.message);
    res.status(500).send('Error proxying media stream');
  }
});

// Start the server with binary bootstrapping
bootstrapYtDlp()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`=================================================`);
      console.log(`🚀 Premium Instagram Downloader Server Active!`);
      console.log(`🔌 Listening on: http://localhost:${PORT}`);
      console.log(`=================================================`);
    });
  })
  .catch((err) => {
    console.error('[API/YT] Bootstrapping critical failure:', err.message);
    // Start server anyway to prevent Render crash loops
    app.listen(PORT, () => {
      console.log(`=================================================`);
      console.log(`⚠️ Premium Server Active with Startup Warnings!`);
      console.log(`🔌 Listening on: http://localhost:${PORT}`);
      console.log(`=================================================`);
    });
  });

export default app;
