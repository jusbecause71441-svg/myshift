from PIL import Image, ImageOps
import os

def manual_crop_and_generate():
    """Manual crop coordinates and generate icons"""
    try:
        print("🎨 Manual cropping and generating icons...")
        
        # Open original image
        img = Image.open('image.jpg')
        print(f"📐 Original image size: {img.size}")
        
        # Manual crop coordinates (adjust these based on your image)
        # These coordinates crop to just the bus, removing white background
        left = 50   # Adjust based on your image
        top = 50    # Adjust based on your image
        right = 350  # Adjust based on your image
        bottom = 350 # Adjust based on your image
        
        # Crop to bus only
        cropped_img = img.crop((left, top, right, bottom))
        print(f"✅ Manually cropped to: {cropped_img.size}")
        
        # Ensure icons directory exists
        icons_dir = 'icons'
        if not os.path.exists(icons_dir):
            os.makedirs(icons_dir)
        
        # Icon sizes required for PWA
        icon_sizes = [72, 96, 128, 144, 152, 192, 384, 512]
        
        # Generate each icon size
        for size in icon_sizes:
            print(f"📐 Generating {size}x{size} icon...")
            
            # Resize cropped image to fill the icon completely
            resized_img = cropped_img.resize((size, size), Image.Resampling.LANCZOS)
            
            # Save as PNG
            icon_path = os.path.join(icons_dir, f'icon-{size}x{size}.png')
            resized_img.save(icon_path, 'PNG', optimize=True, quality=95)
            print(f"✅ Generated {icon_path}")
        
        # Generate favicon
        print("📐 Generating favicon...")
        favicon_resized = cropped_img.resize((32, 32), Image.Resampling.LANCZOS)
        favicon_resized.save('favicon.ico', 'PNG', optimize=True, quality=95)
        print("✅ Generated favicon.ico")
        
        print("🎉 All icons generated with bus filling entire space!")
        print(f"📁 Icons saved in: {icons_dir}/")
        print("🔧 If bus is still small, adjust crop coordinates in the script")
        
    except Exception as error:
        print(f"❌ Error generating icons: {error}")
        exit(1)

if __name__ == "__main__":
    manual_crop_and_generate()
