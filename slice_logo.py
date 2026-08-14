import sys
from PIL import Image

try:
    img_path = sys.argv[1]
    img = Image.open(img_path)
    width, height = img.size
    print(f"Image Size: {width}x{height}")
    
    # Assuming the 3 logos are arranged either horizontally or vertically
    # Let's crop into 3 equal pieces based on orientation
    if width > height:
        w = width // 3
        img1 = img.crop((0, 0, w, height))
        img2 = img.crop((w, 0, 2*w, height))
        img3 = img.crop((2*w, 0, width, height))
    else:
        h = height // 3
        img1 = img.crop((0, 0, width, h))
        img2 = img.crop((0, h, width, 2*h))
        img3 = img.crop((0, 2*h, width, height))
        
    img1.save("apps/marketing/public/logo-1.png")
    img2.save("apps/marketing/public/logo-2.png")
    img3.save("apps/marketing/public/logo-3.png")
    
    print("Cropped into 3 pieces successfully.")
except Exception as e:
    print(f"Error: {e}")
