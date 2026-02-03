# Photo Framer

A professional desktop application for batch-processing images onto branded frames. Features an intuitive split-layout GUI designed for non-technical users, plus a powerful CLI for automation. Creates consistent, professional-looking framed photos perfect for campaigns, branding, and social media.

## ✨ Features

- **Split Layout Interface**: Controls on left, large preview on right
- **Live Preview**: See exactly how photos will look before processing
- **Portrait & Landscape Support**: Separate scaling controls with preview toggle
- **Frame Preview**: Verify background frame selection visually
- **Fullscreen Mode**: Maximized by default for comfortable use
- **Batch Processing**: Process entire folders with progress feedback
- **Executable Distribution**: Create standalone .exe for easy sharing

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

3.  **(Optional) Install dev tools for .exe building:**

    ```bash
    uv sync --dev
    ```

## Usage

### Desktop GUI (Default)

Launch the graphical interface with no arguments:

```bash
uv run photo-framer
```

The GUI provides:
- Visual file selection for background frame and photos
- Live preview with instant parameter updates
- Separate controls for portrait and landscape scaling
- Progress feedback during batch processing

### Command Line Interface

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

## Building Executable for Distribution

Create a standalone .exe for distribution to non-technical users:

```bash
uv sync --dev
uv run pyinstaller photo_framer.spec
```

The executable will be in `dist/PhotoFramer.exe` (~45 MB). It bundles Python and all dependencies, requiring no installation.

See [BUILD_EXE.md](BUILD_EXE.md) for detailed instructions.

### Example

To frame images with a smaller portrait scale (e.g., to leave more room for top/bottom branding):

## Project Structure

- `photo_framer/` - Main package source
    - `cli.py` - Control plane (argparse interface)
    - `engine.py` - Data plane (image processing logic)
    - `models.py` - Configuration and data models
- `main.py` - Entry point script
- `pyproject.toml` - Dependencies and project metadata
