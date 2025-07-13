

# LRC File Downloader

A Puppeteer script that automatically downloads LRC lyrics files from [RCLyricsBand.com](https://rclyricsband.com).

## DEMO
*Includes Demo video:* [Demo Preview](https://github.com/Ruhani05/LyricsScrapper/issues/2) (available in above repo)

## Features

- **Alphabetical Processing**: Automatically cycles through A-Z artists
- **Batch Downloads**: Downloads all songs for each artist
- **Error Resilient**: Handles special characters and recovers from errors
- **Configurable**: Set download limits for testing
- Can run headless as well, make parameter true/false as per need.

## How It Works

1. Navigates to the artists page
2. Processes each alphabet letter (A-Z)
3. For each artist under a letter:
   - Visits artist page
   - Downloads LRC files for all songs
4. Maintains proper navigation flow between pages

## Setup

```bash
npm install puppeteer
node .\main_allalpha_test2.ts
```

## Configuration

- **Demo Mode**: Processes first 2 artists/songs per letter (default)
- **Full Mode**: Remove `Math.min(2, ...)` limits to download all
- **Custom Path**: Set download directory in code

## Error Handling

- Skips problematic letters
- Recovers from download failures
- Logs detailed progress


