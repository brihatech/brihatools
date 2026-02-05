"""Entry point for photo framer - GUI or CLI mode."""
import sys


def main():
    """Launch GUI by default, or CLI if arguments provided."""
    # Check if running in CLI mode (any arguments beyond script name)
    if len(sys.argv) > 1:
        from photo_framer.cli import main as cli_main
        cli_main()
    else:
        from photo_framer.gui import main as gui_main
        gui_main()


if __name__ == "__main__":
    main()