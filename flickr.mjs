import fs from 'fs/promises';
import { createWriteStream, existsSync, mkdirSync } from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import { homedir } from 'os';
import dotenv from 'dotenv';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

// Load configuration from .env files
const homeEnvPath = path.join(homedir(), '.env');
const localEnvPath = path.resolve('.env');
dotenv.config({ path: homeEnvPath });
dotenv.config({ path: localEnvPath });

// Parse CLI arguments
const argv = yargs(hideBin(process.argv))
  .option('album-id', {
    alias: 'a',
    type: 'string',
    describe: 'The Flickr album ID to download photos from',
  })
  .option('username', {
    alias: 'u',
    type: 'string',
    describe: 'The Flickr username of the album owner',
  })
  .option('url', {
    alias: 'l',
    type: 'string',
    describe: 'The Flickr album URL (e.g., https://www.flickr.com/photos/username/albums/album-id)',
  })
  .option('download-dir', {
    alias: 'd',
    type: 'string',
    default: './downloads',
    describe: 'Directory to download photos to',
  })
  .conflicts('url', ['album-id', 'username'])
  .check((args) => {
    if (!args.url && (!args['album-id'] || !args.username)) {
      throw new Error('You must provide either --url or both --album-id and --username');
    }
    return true;
  })
  .help()
  .argv;

// Ensure required environment variables are set
const FLICKR_KEY = process.env.FLICKR_KEY;
const DEBUG_TO_FILE = process.env.DEBUG_TO_FILE === 'true';
const LOG_FILE = './debug.log';

if (!FLICKR_KEY) {
  console.error('Flickr API Key must be defined in .env files.');
  process.exit(1);
}

// Extract CLI arguments
let ALBUM_ID = argv['album-id'];
let USERNAME = argv.username;
const DOWNLOAD_DIR = argv['download-dir'];
const URL = argv.url;

const FLICKR_API_URL = 'https://api.flickr.com/services/rest/';
const RATE_LIMIT_DELAY = 1000; // 1 second delay between requests

// Helper: Create the downloads directory if it doesn't exist
if (!existsSync(DOWNLOAD_DIR)) {
  mkdirSync(DOWNLOAD_DIR, { recursive: true });
}

// Helper: Write logs to a file
async function logToFile(data) {
  if (DEBUG_TO_FILE) {
    await fs.appendFile(LOG_FILE, `${new Date().toISOString()} - ${data}\n`);
  }
}

// Helper: Parse Flickr URL to extract album ID and username
function parseFlickrUrl(url) {
  const regex = /https:\/\/www\.flickr\.com\/photos\/([^/]+)\/albums\/(\d+)/;
  const match = url.match(regex);
  if (!match) {
    throw new Error('Invalid Flickr album URL. Ensure it matches the format: https://www.flickr.com/photos/username/albums/album-id');
  }
  const [, username, albumId] = match;
  return { username, albumId };
}

// Helper: Fetch JSON data from Flickr API
async function fetchFlickrData(endpoint, params) {
  const url = new URL(endpoint);
  params['api_key'] = FLICKR_KEY;
  params['format'] = 'json';
  params['nojsoncallback'] = '1';

  Object.entries(params).forEach(([key, value]) => url.searchParams.append(key, value));

  try {
    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`Flickr API Error: ${response.statusText}`);
    }
    const data = await response.json();
    await logToFile(JSON.stringify(data, null, 2)); // Log full response for debugging
    return data;
  } catch (error) {
    console.error('Error fetching data from Flickr:', error);
    throw error;
  }
}

// Helper: Resolve username to numeric user ID
async function resolveUserId(username) {
  const data = await fetchFlickrData(FLICKR_API_URL, {
    method: 'flickr.people.findByUsername',
    username,
  });

  if (data.stat !== 'ok' || !data.user) {
    throw new Error(`Failed to resolve user ID for username: ${username}`);
  }

  console.log(`Resolved username "${username}" to user ID: ${data.user.nsid}`);
  return data.user.nsid;
}

// Helper: Download an individual image
async function downloadImage(url, filepath) {
  const partialFile = `${filepath}.partial`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.statusText}`);
    }

    const fileStream = createWriteStream(partialFile);
    response.body.pipe(fileStream);

    return new Promise((resolve, reject) => {
      fileStream.on('finish', async () => {
        await fs.rename(partialFile, filepath);
        resolve();
      });
      fileStream.on('error', reject);
    });
  } catch (error) {
    console.error('Error downloading image:', error);
    throw error;
  }
}

// Helper: Fetch all album pages
async function fetchAllAlbumPhotos(userId, albumId) {
  const photos = [];
  let page = 1;
  let pages;

  do {
    const data = await fetchFlickrData(FLICKR_API_URL, {
      method: 'flickr.photosets.getPhotos',
      photoset_id: albumId,
      user_id: userId,
      page,
    });

    if (data.stat !== 'ok') {
      throw new Error(`Failed to fetch photos for album: ${albumId}`);
    }

    photos.push(...data.photoset.photo);
    pages = data.photoset.pages;
    page++;

    // Respect rate limiting
    await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY));
  } while (page <= pages);

  console.log(`Fetched ${photos.length} photos from album.`);
  return photos;
}

// Main: Fetch and download all photos from the album
async function downloadAlbum() {
  console.log(`Starting download for album.`);

  // Parse URL if provided
  if (URL) {
    try {
      const { username, albumId } = parseFlickrUrl(URL);
      USERNAME = username;
      ALBUM_ID = albumId;
      console.log(`Parsed album URL. Username: ${USERNAME}, Album ID: ${ALBUM_ID}`);
    } catch (error) {
      console.error(error.message);
      process.exit(1);
    }
  }

  // Resolve user ID
  let userId;
  try {
    userId = await resolveUserId(USERNAME);
  } catch (error) {
    console.error('Error resolving user ID:', error);
    process.exit(1);
  }

  // Fetch all photos
  let photos;
  try {
    photos = await fetchAllAlbumPhotos(userId, ALBUM_ID);
  } catch (error) {
    console.error('Error fetching album photos:', error);
    process.exit(1);
  }

  for (const photo of photos) {
    const photoId = photo.id;
    const photoTitle = photo.title.replace(/[^\w.-]/g, '_'); // Sanitize title for filenames

    // Fetch individual photo sizes to get download URL
    const sizesData = await fetchFlickrData(FLICKR_API_URL, {
      method: 'flickr.photos.getSizes',
      photo_id: photoId,
    });

    const largestSize = sizesData.sizes.size.pop(); // Get the largest available size
    if (!largestSize) {
      console.warn(`No sizes found for photo ID: ${photoId}`);
      continue;
    }

    const photoUrl = largestSize.source;
    const filepath = path.join(DOWNLOAD_DIR, `${photoTitle}-${photoId}.jpg`);

    // Skip already downloaded files
    if (existsSync(filepath) || existsSync(`${filepath}.partial`)) {
      console.log(`File already exists or is partially downloaded: ${filepath}`);
      continue;
    }

    console.log(`Downloading ${photoTitle} from ${photoUrl}...`);

    // Download photo
    try {
      await downloadImage(photoUrl, filepath);
      console.log(`Downloaded: ${filepath}`);
    } catch (error) {
      console.error(`Failed to download photo ${photoTitle}:`, error);
    }

    // Respect rate limiting
    await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY));
  }

  console.log('Album download completed.');
}

// Execute the script
downloadAlbum().catch((error) => {
  console.error('Error occurred during album download:', error);
  process.exit(1);
});



// node flickr.mjs --album-id 72177720310834741 --username letterformarchive --download-dir ./photos
