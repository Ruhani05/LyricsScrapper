//replace line 113 and 132, with actual length in for loop right now for demo it is set to two per character and two per artist.
//skipping 0-9 tag
// Math.min(2, artistLinks.length);
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const langdetect = require('langdetect');

function detectLanguage(text) {
    try {
        const result = langdetect.detectOne(text);
        return result || 'Unknown';
    } catch (e) {
        return 'Unknown';
    }
}

// Helper function to escape CSS selectors
function escapeCssSelector(selector) {
    return selector.replace(/[!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~]/g, '\\$&');
}

async function downloadLRCFiles() {
    const downloadPath = path.join(__dirname, 'lrc_downloads');
    if (!fs.existsSync(downloadPath)) {
        fs.mkdirSync(downloadPath);
    }

    // Configure browser with more robust settings
    const browser = await puppeteer.launch({
        headless: true,
        defaultViewport: null,
        args: [
            '--start-maximized',
            '--disable-dev-shm-usage',
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu'
        ],
        ignoreHTTPSErrors: true
        ,
        protocolTimeout: 120000, // 2 minutes for protocol operations
        timeout: 120000 // 2 minutes for browser launch
    });

    try {
        const page = await browser.newPage();
        await page.setDefaultNavigationTimeout(60000);
        await page.setDefaultTimeout(30000);

        const client = await page.target().createCDPSession();
        await client.send('Page.setDownloadBehavior', {
            behavior: 'allow',
            downloadPath: downloadPath
        });

        // Main navigation with retries
        await retryNavigation(async () => {
            await page.goto('https://rclyricsband.com/singers', {
                waitUntil: 'networkidle2',
                timeout: 60000
            });
        });

        const alphabetButtons = await page.$$('div.tab > button.tablinks');
        const alphabetLetters = [];
        
        for (const button of alphabetButtons) {
            const letter = await button.evaluate(el => el.textContent.trim());
            if (letter.length === 1 && /[B-Z]/.test(letter)) {
                alphabetLetters.push(letter);
            }
        }

        console.log(`Found alphabets: ${alphabetLetters.join(', ')}`);

        for (const letter of alphabetLetters) {
            console.log(`\nProcessing alphabet: ${letter}`);
            
            try {
                await retryNavigation(async () => {
                    const letterButton = await page.evaluateHandle((l) => {
                        const buttons = Array.from(document.querySelectorAll('div.tab > button.tablinks'));
                        return buttons.find(btn => btn.textContent.trim() === l);
                    }, letter);
                    
                    if (letterButton) {
                        await letterButton.click();
                        console.log(`Selected alphabet ${letter}`);
                        await delay(2000);
                    }
                });

                let artistLinks = [];
                try {
                    const escapedLetter = escapeCssSelector(letter);
                    const selector = `[id="${escapedLetter}"] ul li a.list_artist`;
                    artistLinks = await page.$$eval(selector, links => 
                        links.map(link => ({
                            name: link.textContent.trim(),
                            url: link.href
                        }))
                    );
                } catch (error) {
                    console.log(`Error finding artists for ${letter}:`, error.message);
                    continue;
                }

                console.log(`Found ${artistLinks.length} artists for ${letter}`);

                for (let i = 0; i < Math.min(2, artistLinks.length); i++) {//change upper bound here
                    const artist = artistLinks[i];
                    console.log(`\nProcessing artist: ${artist.name}`);
                    
                    try {
                        await retryNavigation(async () => {
                            await page.goto(artist.url, { waitUntil: 'networkidle2' });
                        });

                        const songLinks = await page.$$eval('li.singers_list > a', links => 
                            links.map(link => ({
                                
                                title: link.textContent.trim(),
                                url: link.href
                            }))
                        );

                        console.log(`Found ${songLinks.length} songs`);

                        for (let j = 0; j < Math.min(2, songLinks.length);; j++) {//change upper bound here
                            const song = songLinks[j];
                            console.log(`  Downloading: ${song.lang+song.title}`);
                            
                            try {
                                await downloadSong(browser, song.url, downloadPath);
                            } catch (error) {
                                console.log(`    ✗ Error downloading song: ${error.message}`);
                                continue;
                            }
                        }
                    } catch (error) {
                        console.log(`Error processing artist ${artist.name}:`, error.message);
                        await recoverToMainPage(browser, letter);
                        continue;
                    }

                    // Return to artists list
                    try {
                        await retryNavigation(async () => {
                            await page.goto('https://rclyricsband.com/singers', { waitUntil: 'networkidle2' });
                            const letterButton = await page.evaluateHandle((l) => {
                                const buttons = Array.from(document.querySelectorAll('div.tab > button.tablinks'));
                                return buttons.find(btn => btn.textContent.trim() === l);
                            }, letter);
                            if (letterButton) {
                                await letterButton.click();
                                await delay(2000);
                            }
                        });
                    } catch (error) {
                        console.log('Error returning to artists list:', error.message);
                        await recoverToMainPage(browser, letter);
                    }
                }
            } catch (error) {
                console.log(`Error processing alphabet ${letter}:`, error.message);
                await recoverToMainPage(browser);
                continue;
            }
        }

        console.log('\nAll downloads completed!');
    } catch (error) {
        console.error('Fatal error:', error);
    } finally {
        try {
            await browser.close();
        } catch (error) {
            console.log('Browser cleanup error:', error.message);
        }
    }
}

// Helper functions
async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function retryNavigation(action, maxRetries = 3, delayMs = 2000) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            await action();
            return;
        } catch (error) {
            if (i === maxRetries - 1) throw error;
            console.log(`Retry ${i + 1}/${maxRetries} after error: ${error.message}`);
            await delay(delayMs);
        }
    }
}

async function downloadSong1(browser, songUrl, downloadPath) {
    const songPage = await browser.newPage();
    try {
        await songPage.setDefaultNavigationTimeout(30000);
        await songPage.setDefaultTimeout(15000);

        await retryNavigation(async () => {
            await songPage.goto(songUrl, { waitUntil: 'networkidle2' });
        });

        const lrcButton = await songPage.waitForSelector('div.button_container > button#lrc', { timeout: 10000 });
        await lrcButton.click();
        console.log('    ✓ LRC download initiated');
        await delay(3000); // Wait for download to complete
    } finally {
        try {
            await songPage.close();
        } catch (error) {
            console.log('Error closing song page:', error.message);
        }
    }
}
async function downloadSong(browser, songUrl, downloadPath) {
    const songPage = await browser.newPage();
    try {
        await songPage.setDefaultNavigationTimeout(30000);
        await songPage.setDefaultTimeout(15000);

        await retryNavigation(async () => {
            await songPage.goto(songUrl, { waitUntil: 'networkidle2' });
        });

        // Check if the song is in English
        const isEnglish = await songPage.evaluate(() => {
            const lrcText = document.querySelector('#lrc_text')?.textContent;
            return lrcText?.includes('[lang:English]');
        });

        if (!isEnglish) {
            console.log('    ✗ Skipping non-English song');
            return;
        }

        // Proceed with download if English
        const lrcButton = await songPage.waitForSelector('div.button_container > button#lrc', { timeout: 10000 });
        await lrcButton.click();
        console.log('    ✓ LRC download initiated');
        await delay(3000);
    } finally {
        await songPage.close();
    }
}
async function recoverToMainPage(browser, letter = null) {
    const page = await browser.newPage();
    try {
        await page.setDefaultNavigationTimeout(30000);
        await retryNavigation(async () => {
            await page.goto('https://rclyricsband.com/singers', { waitUntil: 'networkidle2' });
            if (letter) {
                const letterButton = await page.evaluateHandle((l) => {
                    const buttons = Array.from(document.querySelectorAll('div.tab > button.tablinks'));
                    return buttons.find(btn => btn.textContent.trim() === l);
                }, letter);
                if (letterButton) {
                    await letterButton.click();
                    await delay(2000);
                }
            }
        });
        return page;
    } catch (error) {
        console.log('Recovery failed:', error.message);
        await page.close();
        throw error;
    }
}

downloadLRCFiles();
