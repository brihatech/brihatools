"""Service layer for GUI - interfaces between UI and photo framing engine."""

import logging
from pathlib import Path
from dataclasses import dataclass
from typing import Callable, Optional
from PIL import Image
import threading

from .models import FrameConfig, ProcessingResult, ImageMetadata
from .engine import PhotoFramerEngine

logger = logging.getLogger(__name__)


@dataclass
class DirectoryScanResult:
    """Result of scanning a directory for images."""
    total_images: int
    portrait_count: int
    landscape_count: int
    square_count: int
    sample_portrait: Optional[Path] = None
    sample_landscape: Optional[Path] = None
    all_images: list[Path] = None


class ImageScanner:
    """Scans directories to detect images and their orientations."""
    
    SUPPORTED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp', '.bmp', '.tiff'}
    
    def scan_directory(self, directory: Path) -> DirectoryScanResult:
        """Scan directory and categorize images by orientation."""
        if not directory.exists() or not directory.is_dir():
            return DirectoryScanResult(0, 0, 0, 0, None, None, [])
        
        portrait_count = 0
        landscape_count = 0
        square_count = 0
        sample_portrait = None
        sample_landscape = None
        all_images = []
        
        files = [
            f for f in directory.iterdir()
            if f.is_file() and f.suffix.lower() in self.SUPPORTED_EXTENSIONS
        ]
        
        for file_path in files:
            try:
                with Image.open(file_path) as img:
                    w, h = img.size
                    all_images.append(file_path)
                    
                    # Detect orientation
                    if abs(w - h) / max(w, h) < 0.01:
                        square_count += 1
                    elif h > w:
                        portrait_count += 1
                        if sample_portrait is None:
                            sample_portrait = file_path
                    else:
                        landscape_count += 1
                        if sample_landscape is None:
                            sample_landscape = file_path
                            
            except Exception as e:
                logger.warning(f"Could not analyze {file_path}: {e}")
                continue
        
        total = portrait_count + landscape_count + square_count
        
        return DirectoryScanResult(
            total_images=total,
            portrait_count=portrait_count,
            landscape_count=landscape_count,
            square_count=square_count,
            sample_portrait=sample_portrait,
            sample_landscape=sample_landscape,
            all_images=all_images
        )


class PreviewGenerator:
    """Generates preview images for live feedback."""
    
    def __init__(self, config: FrameConfig):
        self.config = config
        self.engine = PhotoFramerEngine(config)
    
    def update_config(self, config: FrameConfig):
        """Update configuration and propagate to engine."""
        self.config = config
        self.engine.config = config
    
    def generate_preview(self, image_path: Path) -> Optional[Image.Image]:
        """Generate a preview of how the image will look framed.
        
        Returns PIL Image for display in GUI.
        """
        try:
            # Use the engine's process_image logic but return the image instead of saving
            with Image.open(image_path) as img:
                from PIL import ImageOps
                img = ImageOps.exif_transpose(img)
                img = img.convert("RGBA")
                
                orientation = self.engine._detect_orientation(img)
                target_size = self.engine._calculate_target_size(img.size, orientation)
                
                # Resize image
                resized_img = img.resize(target_size, Image.Resampling.LANCZOS)
                
                # Create composition
                final_image = self.engine.frame_image.copy()
                
                # Calculate centering position
                frame_w, frame_h = final_image.size
                img_w, img_h = resized_img.size
                
                x = (frame_w - img_w) // 2
                y = (frame_h - img_h) // 2
                
                # Apply vertical offset
                if orientation == "portrait":
                    offset_val = self.config.portrait_offset_y
                else: 
                    # Use landscape offset for square too
                    offset_val = self.config.landscape_offset_y
                
                y += int(frame_h * offset_val)
                
                # Paste resized image onto frame
                final_image.paste(resized_img, (x, y), resized_img)
                
                # Remove background if enabled in config
                if self.config.remove_background:
                    from rembg import remove
                    from io import BytesIO

                    img_bytes = BytesIO()
                    img.save(img_bytes, format="PNG")
                    img_bytes.seek(0)
                    img = Image.open(BytesIO(remove(img_bytes.read())))
                
                return final_image
                
        except Exception as e:
            logger.error(f"Error generating preview: {e}")
            return None


class BatchProcessor:
    """Processes multiple images with progress feedback."""
    
    def __init__(self, config: FrameConfig):
        self.config = config
        self.engine = PhotoFramerEngine(config)
        self._cancelled = False
    
    def process_all(
        self,
        images: list[Path],
        progress_callback: Optional[Callable[[int, int, str], None]] = None
    ) -> list[ProcessingResult]:
        """Process all images with progress updates.
        
        Args:
            images: List of image paths to process
            progress_callback: Optional callback(current, total, filename)
        
        Returns:
            List of ProcessingResult objects
        """
        results = []
        total = len(images)
        
        # Create output directory
        self.config.output_dir.mkdir(parents=True, exist_ok=True)
        
        for i, image_path in enumerate(images):
            if self._cancelled:
                logger.info("Processing cancelled by user")
                break
            
            if progress_callback:
                progress_callback(i + 1, total, image_path.name)
            
            result = self.engine.process_image(image_path)
            results.append(result)
        
        return results
    
    def cancel(self):
        """Cancel ongoing processing."""
        self._cancelled = True


def process_batch_async(
    config: FrameConfig,
    images: list[Path],
    progress_callback: Optional[Callable[[int, int, str], None]] = None,
    completion_callback: Optional[Callable[[list[ProcessingResult]], None]] = None
):
    """Process images in a background thread to avoid blocking GUI.
    
    Args:
        config: Frame configuration
        images: List of images to process
        progress_callback: Called with (current, total, filename)
        completion_callback: Called with results when complete
    """
    def worker():
        processor = BatchProcessor(config)
        results = processor.process_all(images, progress_callback)
        if completion_callback:
            completion_callback(results)
    
    thread = threading.Thread(target=worker, daemon=True)
    thread.start()
    return thread
