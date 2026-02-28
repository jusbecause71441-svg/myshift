const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function generateFavicon() {
    try {
        console.log('🎨 Generating favicon from custom image...');
        
        // Generate favicon (32x32 for compatibility)
        await sharp('image.jpg')
            .resize(32, 32, {
                fit: 'cover',
                position: 'center'
            })
            .png({
                quality: 90,
                compressionLevel: 6
            })
            .toFile('favicon.ico');
        
        console.log('✅ Generated favicon.ico');
        console.log('🎉 Favicon generated successfully!');
        
    } catch (error) {
        console.error('❌ Error generating favicon:', error);
        process.exit(1);
    }
}

generateFavicon();
