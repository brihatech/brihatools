# Building Executable (.exe) for Distribution

This guide explains how to create a standalone Windows executable (.exe) that can be distributed to non-technical users.

## Prerequisites

Install PyInstaller (already in dev dependencies):

```bash
uv sync --dev
```

## Build the Executable

### Method 1: Using the spec file (Recommended)

```bash
uv run pyinstaller photo_framer.spec
```

### Method 2: Direct command

```bash
uv run pyinstaller --name PhotoFramer --onefile --windowed --hidden-import=PIL._tkinter_finder --hidden-import=customtkinter main.py
```

## Build Options

- `--onefile`: Packages everything into a single .exe file
- `--windowed`: Hides the console window (GUI mode)
- `--hidden-import`: Includes modules that PyInstaller might miss

## Output

The executable will be created in the `dist/` folder:

```
dist/
└── PhotoFramer.exe
```

## Distribution

Simply copy `PhotoFramer.exe` to any Windows machine and run it. No Python installation required!

## File Size

The .exe will be approximately 30-50 MB because it bundles:
- Python runtime
- CustomTkinter
- Pillow (PIL)
- All dependencies

## Troubleshooting

**Issue**: Missing modules error  
**Solution**: Add the module to `hiddenimports` in `photo_framer.spec`

**Issue**: Antivirus flags the .exe  
**Solution**: This is normal for PyInstaller executables. You can:
1. Sign the executable with a code signing certificate
2. Submit to antivirus vendors as false positive
3. Provide source code for verification

**Issue**: App doesn't start  
**Solution**: Run from command line to see error messages:
```bash
PhotoFramer.exe
```

## Testing

Before distributing, test the .exe on a clean Windows machine without Python installed.

## Notes

- The .exe is platform-specific (Windows only in this case)
- For macOS, use `--windowed` and it will create a .app bundle
- For Linux, the output will be a standalone binary
