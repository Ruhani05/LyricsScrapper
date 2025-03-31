const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function downloadLRCFiles() {
    const downloadPath = path.join(__dirname, 'lrc_downloads');
    if (!fs.existsSync(downloadPath)) {
        fs.mkdirSync(downloadPath);
    }

    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,
        args: ['--start-maximized']
    });

    const page = await browser.newPage();

    try {

        const client = await page.target().createCDPSession();
        await client.send('Page.setDownloadBehavior', {
            behavior: 'allow',
            downloadPath: downloadPath
        });

        //  Navigate to singers page
        await page.goto('https://rclyricsband.com/singers', {
            waitUntil: 'networkidle2',
            timeout: 60000
        });

     
        const alphabetButton = await page.waitForSelector('div.tab > button.tablinks.active');
        await alphabetButton.click();
        console.log('Selected alphabet A');
        await new Promise(resolve => setTimeout(resolve, 2000));

        
        const artistLinks = await page.$$eval('#A ul li a.list_artist', links => 
            links.map(link => ({
                name: link.textContent.trim(),
                url: link.href
            }))
        );

        console.log(`Found ${artistLinks.length} artists starting with A`);

     
        for (const artist of artistLinks) {
            console.log(`\nProcessing artist: ${artist.name}`);
            await page.goto(artist.url, { waitUntil: 'networkidle2' });

       
            const songLinks = await page.$$eval('li.singers_list > a', links => 
                links.map(link => ({
                    title: link.textContent.trim(),
                    url: link.href
                }))
            );

            console.log(`Found ${songLinks.length} songs`);

            for (const song of songLinks) {
                console.log(`  Downloading: ${song.title}`);
                
                try {
             
                    await page.goto(song.url, { waitUntil: 'networkidle2' });

                    // Click LRC download button
                    const lrcButton = await page.waitForSelector('div.button_container > button#lrc', { timeout: 5000 });
                    await lrcButton.click();
                    console.log('    ✓ LRC download initiated');
                    
                    // Wait for download to complete
                    await new Promise(resolve => setTimeout(resolve, 3000));
                    
                    
                    await page.goBack({ waitUntil: 'networkidle2' });
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } catch (error) {
                    console.log('    ✗ Error during download:', error.message);
                    // If error occurs, try to recover by going back to artist page
                    if (page.url() !== artist.url) {
                        await page.goto(artist.url, { waitUntil: 'networkidle2' });
                    }
                }
            }

      
            await page.goBack({ waitUntil: 'networkidle2' });
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        console.log('\nAll downloads completed!');
    } catch (error) {
        console.error('Fatal error:', error);
    } finally {
        await browser.close();
    }
}

downloadLRCFiles();