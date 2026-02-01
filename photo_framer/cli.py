"""Control plane - CLI interface for photo framer."""

import argparse
import logging
import sys
from pathlib import Path
from .models import FrameConfig
from .engine import PhotoFramerEngine

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def parse_args():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description="Place images uniformly on a branded frame."
    )
    
    parser.add_argument(
        "--frame",
        type=Path,
        default=Path("./frame.png"),
        help="Path to the frame/background image (default: ./frame.png)"
    )
    
    parser.add_argument(
        "--input",
        type=Path,
        default=Path("./input_images"),
        help="Directory containing source images (default: ./input_images)"
    )
    
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("./output_images"),
        help="Directory to save processed images (default: ./output_images)"
    )
    
    parser.add_argument(
        "--margin",
        type=float,
        default=5.0,
        help="Margin percentage (not currently used directly, inferred from scale) (default: 5.0)"
    )
    
    parser.add_argument(
        "--portrait-scale",
        type=float,
        default=0.7,
        help="Scale factor for portrait images relative to frame (default: 0.7)"
    )
    
    parser.add_argument(
        "--landscape-scale",
        type=float,
        default=0.8,
        help="Scale factor for landscape images relative to frame (default: 0.8)"
    )
    
    parser.add_argument(
        "--quality",
        type=int,
        default=95,
        help="JPEG output quality 1-100 (default: 95)"
    )
    
    parser.add_argument(
        "--format",
        type=str,
        default="png",
        choices=["png", "jpg", "jpeg"],
        help="Output image format (default: png)"
    )
    
    return parser.parse_args()

def main():
    """Main entry point."""
    args = parse_args()
    
    try:
        config = FrameConfig(
            frame_path=args.frame.resolve(),
            input_dir=args.input.resolve(),
            output_dir=args.output.resolve(),
            margin_percent=args.margin,
            portrait_scale=args.portrait_scale,
            landscape_scale=args.landscape_scale,
            quality=args.quality,
            output_format=args.format
        )
        
        logger.info(f"Starting Photo Framer with config: {config}")
        
        engine = PhotoFramerEngine(config)
        results = engine.process_directory()
        
        success_count = sum(1 for r in results if r.success)
        fail_count = len(results) - success_count
        
        logger.info(f"Processing complete. Success: {success_count}, Failed: {fail_count}")
        
        if fail_count > 0:
            logger.warning("Some images failed to process:")
            for r in results:
                if not r.success:
                    logger.warning(f"  {r.input_path.name}: {r.message}")
                    
    except Exception as e:
        logger.error(f"Fatal error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
