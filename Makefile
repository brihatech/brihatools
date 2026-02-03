.PHONY: help install run build clean

help:
	@echo "Available commands:"
	@echo "  make install  - Install dependencies using uv"
	@echo "  make run      - Run the application"
	@echo "  make build    - Build the executable for distribution"
	@echo "  make clean    - Remove build artifacts and temporary files"

install:
	uv sync

run:
	uv run python main.py

build:
	uv run pyinstaller photo_framer.spec

clean:
	@uv run python -c "import shutil, pathlib; [shutil.rmtree(p, ignore_errors=True) for p in [pathlib.Path('build'), pathlib.Path('dist')]]"
	@uv run python -c "import shutil, pathlib; [shutil.rmtree(p, ignore_errors=True) for p in pathlib.Path('.').rglob('__pycache__')]"
	@echo "Cleaned build artifacts."
