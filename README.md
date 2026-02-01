# Photo Framer

A powerful Python CLI tool designed to batch-process images by placing them uniformly onto a branded frame. It handles both portrait and landscape images with consistent scaling and centering, making it perfect for generating campaign or branding materials.

## Features

- **Batch Processing**: Process an entire directory of images at once.
- **Smart Orientation**: Automatically detects portrait, landscape, and square images.
- **Consistent Scaling**: Apply different scale factors for portrait and landscape images to ensure they fit the frame perfectly every time.
- **High Quality**: Uses high-quality resampling (Lanczos) for image resizing.
- **Configurable**: Easily adjust margins, scaling factors, and output paths via CLI arguments.
- **Modern Architecture**: Built with a clean Control Plane / Data Plane design using Python and Pillow.

## Installation

This project is managed with `uv`.

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/brihatech/photo-framer.git
    cd photo-framer
    ```

2.  **Install dependencies:**

    ```bash
    uv sync
    ```

## Usage

Run the tool using `uv run`. The entry point is `main.py` (or the `photo-framer` script).

### Basic Usage

```bash
uv run photo-framer --frame ./frame.png --input ./input_images --output ./output_images
```

### Command Line Arguments

| Argument | Default | Description |
|----------|---------|-------------|
| `--frame` | `./frame.png` | Path to the background frame image. |
| `--input` | `./input_images` | Directory containing source images. |
| `--output` | `./output_images` | Directory where framed images will be saved. |
| `--portrait-scale` | `0.7` | Scale factor for portrait images (0.0 to 1.0). |
| `--landscape-scale` | `0.8` | Scale factor for landscape images (0.0 to 1.0). |
| `--quality` | `95` | JPEG quality for output images (1-100). |
| `--format` | `png` | Output format (`png`, `jpg`, `jpeg`). |

### Example

To frame images with a smaller portrait scale (e.g., to leave more room for top/bottom branding):

```bash
uv run photo-framer --portrait-scale 0.6 --landscape-scale 0.75 --output ./campaign_v1
```

## Project Structure

- `photo_framer/` - Main package source
    - `cli.py` - Control plane (argparse interface)
    - `engine.py` - Data plane (image processing logic)
    - `models.py` - Configuration and data models
- `main.py` - Entry point script
- `pyproject.toml` - Dependencies and project metadata
