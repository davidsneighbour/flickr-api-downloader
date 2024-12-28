# Flickr Album Downloader

A Node.js script to download all photos from a Flickr album, including support for public albums, pagination, and incomplete download recovery. The script can fetch album information using either the album ID and username or a Flickr album URL.

---

## Installation

### Prerequisites

1. **Node.js**: Ensure Node.js (v18 or higher) is installed.
   Check your version:

   ```bash
   node -v
   ```

2. **NPM**: Comes with Node.js. Ensure it's available:

   ```bash
   npm -v
   ```

3. **Flickr API Key**: Obtain a Flickr API key by registering at [Flickr API](https://www.flickr.com/services/api/).

---

### Steps

1. **Clone or Download the Repository**:

   ```bash
   git clone <repository-url>
   cd <repository-folder>
   ```

2. **Install Dependencies**:

   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Create a `.env` file in the root directory or in your home directory (`~/.env`) with the following content:

   ```dotenv
   FLICKR_KEY=your_flickr_api_key
   DEBUG_TO_FILE=true # Optional: Enable logging API responses to a file
   ```

4. **Run the Script**:
   Use the examples below to start downloading photos.

---

## Usage

The script supports various ways to specify the album details. Use the `--help` flag to see all options:

```bash
node flickr.mjs --help
```

### Options

- `--url, -l`: Flickr album URL (e.g., `https://www.flickr.com/photos/username/albums/album-id`).
- `--album-id, -a`: Flickr album ID (requires `--username`).
- `--username, -u`: Flickr username of the album owner.
- `--download-dir, -d`: Directory to download photos (default: `./downloads`).

---

### Examples

#### 1. Download Photos Using Album URL

Provide the URL of the Flickr album:

```bash
node flickr.mjs --url https://www.flickr.com/photos/flickr/albums/72177720320073958/ --download-dir ./photos
```

#### 2. Download Photos Using Album ID and Username

Specify the album ID and the username:

```bash
node flickr.mjs --album-id 72177720320073958 --username flickr --download-dir ./photos
```

#### 3. View Help

List all available options:

```bash
node flickr.mjs --help
```

---

## Features

1. **Fetch Album Details**:
   - Supports using Flickr album URLs or album ID and username.

2. **Incomplete Download Recovery**:
   - Creates `.partial` files for downloads and resumes them if incomplete.

3. **Pagination**:
   - Handles albums with more than 500 photos.

4. **Rate Limiting**:
   - Introduces a delay between requests to avoid API rate-limit violations.

5. **Debug Logging**:
   - Optionally logs detailed API responses to a file (`debug.log`).

---

## Debugging

If you encounter issues:

1. Enable detailed logging by adding this to your `.env` file:

   ```dotenv
   DEBUG_TO_FILE=true
   ```

2. Check the `debug.log` file in the script's root directory for detailed API responses and errors.

---

## License

This project is open source and available under the [MIT License](LICENSE).
