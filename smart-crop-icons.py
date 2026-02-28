from PIL import Image, ImageOps, ImageDraw
import os

def smart_crop(image_path):
    """Smart crop to remove white/cream background"""
    img = Image.open(image_path)
    
    # Convert to RGB for processing
    if img.mode != 'RGB':
        img = img.convert('RGB')
    
    # Get image dimensions
    width, height = img.size
    
    # Sample pixels to find content boundaries
    pixels = img.load()
    
    # Find content boundaries (non-white pixels)
    min_x, min_y = width, height
    max_x, max_y = 0, 0
    
    # Define white/cream threshold (adjust as needed)
    white_threshold = 240
    
    for y in range(height):
        for x in range(width):
            r, g, b = pixels[x, y]
            # If pixel is not white/cream, update boundaries
            if r < white_threshold or g < white_threshold or b < white_threshold:
                min_x = min(min_x, x)
                min_y = min(min_y, y)
                max_x = max(max_x, x)
                max_y = max(max_y, y)
    
    # Add some padding
    padding = 5
    min_x = max(0, min_x - padding)
    min_y = max(0, min_y - padding)
    max_x = min(width, max_x + padding + 1)
    max_y = min(height, max_y + padding + 1)
    
    # Crop to content
    if max_x > min_x and max_y > min_y:
        cropped = img.crop((min_x, min_y, max_x, max_y))
        print(f"✅ Smart cropped from {img.size} to {cropped.size}")
        return cropped
    else:
        print("⚠️  No content found, using original")
        return img

def generate_icons():
    """Generate PWA icons from smart-cropped bus image"""
    try:
        print("🎨 Smart cropping and generating icons...")
        
        # Smart crop to remove white background
        cropped_img = smart_crop('image.jpg')
        
        # Ensure icons directory exists
        icons_dir = 'icons'
        if not os.path.exists(icons_dir):
            os.makedirs(icons_dir)
        
        # Icon sizes required for PWA
        icon_sizes = [72, 96, 128, 144, 152, 192, 384, 512]
        
        # Generate each icon size
        for size in icon_sizes:
            print(f"📐 Generating {size}x{size} icon...")
            
            # Create a new image with the target size
            icon_img = Image.new('RGB', (size, size), (255, 255, 255))
            
            # Calculate scaling to make bus as large as possible
            img_width, img_height = cropped_img.size
            aspect_ratio = img_width / img_height
            
            # Determine scaling to fill the icon
            if img_width > img_height:
                # Wider image - scale to height
                new_height = size
                new_width = int(size * aspect_ratio)
            else:
                # Taller image - scale to width
                new_width = size
                new_height = int(size / aspect_ratio)
            
            # Resize with high quality
            resized_img = cropped_img.resize((new_width, new_height), Image.Resampling.LANCZOS)
            
            # Calculate position to center the image
            x = (size - new_width) // 2
            y = (size - new_height) // 2
            
            # Paste the resized image onto the center
            icon_img.paste(resized_img, (x, y))
            
            # Save as PNG
            icon_path = os.path.join(icons_dir, f'icon-{size}x{size}.png')
            icon_img.save(icon_path, 'PNG', optimize=True, quality=95)
            print(f"✅ Generated {icon_path}")
        
        # Generate favicon
        print("📐 Generating favicon...")
        favicon_img = Image.new('RGB', (32, 32), (255, 255, 255))
        
        favicon_aspect = img_width / img_height
        if img_width > img_height:
            new_favicon_height = 32
            new_favicon_width = int(32 * favicon_aspect)
        else:
            new_favicon_width = 32
            new_favicon_height = int(32 / favicon_aspect)
        
        favicon_resized = cropped_img.resize((new_favicon_width, new_favicon_height), Image.Resampling.LANCZOS)
        
        fx = (32 - new_favicon_width) // 2
        fy = (32 - new_favicon_height) // 2
        favicon_img.paste(favicon_resized, (fx, fy))
        
        favicon_img.save('favicon.ico', 'PNG', optimize=True, quality=95)
        print("✅ Generated favicon.ico")
        
        print("🎉 All icons generated with maximum bus visibility!")
        print(f"📁 Icons saved in: {icons_dir}/")
        
    except Exception as error:
        print(f"❌ Error generating icons: {error}")
        exit(1)

if __name__ == "__main__":
    generate_icons()
