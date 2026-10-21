"""Optional asset maintenance: pip install cairosvg, then run after export-catalog.cjs.
Generated PNGs are committed; no Python or Node.js is required to build the app.
"""
from pathlib import Path
import cairosvg
for source in Path('composeApp/src/commonMain/composeResources/files/art').glob('*.svg'):
    cairosvg.svg2png(url=str(source), write_to=str(source.with_suffix('.png')))
    source.unlink()
