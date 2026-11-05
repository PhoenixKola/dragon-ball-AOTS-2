"""Build a private, offline Windows review ZIP from the already verified dist folder."""
from pathlib import Path
from shutil import copy2, copytree, rmtree, which
from zipfile import ZipFile, ZIP_DEFLATED
import subprocess

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / 'dist'
RELEASE = ROOT / 'release'
NAME = 'AOTS2-Namek-Saga-experience-overhaul-incomplete-RC-windows'
STAGE = RELEASE / NAME

if not (DIST / 'index.html').is_file():
    raise SystemExit('Build dist first with npm run build')
subprocess.check_call(['python', '-I', str(ROOT / 'tools/audit_runtime_assets.py')], cwd=ROOT)
node = which('node.exe')
if not node:
    raise SystemExit('Windows node.exe is needed to make the portable package')
node = Path(node).resolve()
major = int(subprocess.check_output([node, '--version'], text=True).strip().lstrip('v').split('.')[0])
if major < 20:
    raise SystemExit('Node 20 or newer is required')
license_file = node.parent / 'LICENSE'
if not license_file.is_file():
    raise SystemExit('Node LICENSE is missing beside node.exe')

RELEASE.mkdir(exist_ok=True)
if STAGE.resolve().parent != RELEASE.resolve() or STAGE.name != NAME:
    raise SystemExit('Refusing to replace a staging directory outside release/')
if STAGE.exists():
    rmtree(STAGE)
copytree(DIST, STAGE / 'dist')
(STAGE / 'tools').mkdir()
copy2(ROOT / 'tools/serve-dist.mjs', STAGE / 'tools/serve-dist.mjs')
(STAGE / 'runtime').mkdir()
copy2(node, STAGE / 'runtime/node.exe')
copy2(license_file, STAGE / 'runtime/NODE-LICENSE.txt')
copy2(ROOT / 'START_GAME.bat', STAGE / 'START_GAME.bat')
(STAGE / 'public').mkdir()
copy2(ROOT / 'public/icon.ico', STAGE / 'public/icon.ico')
(STAGE / 'README-PLAY.txt').write_text(
    'ATTACK OF THE SAIYANS II - NAMEK SAGA\n'
    'Private incomplete experience-overhaul review build. Windows 10/11.\n\n'
    'Double-click START_GAME.bat. Keep the server window open while playing; close it to quit.\n'
    'The included Node runtime serves the local game on 127.0.0.1:5173. Chrome or Edge is recommended.\n'
    'No internet connection, npm installation or account is needed at play time.\n\n'
    'Move: WASD/arrows; interact: E/Enter; menu/back: Esc/X; fullscreen: F.\n'
    'In battle, choose with arrows/Enter or mouse. Active Guard: 1/2/3 for the targeted fighter.\n'
    'Audio and visual settings are in the title/menu Settings screen.\n\n'
    'Saves are stored in your browser for this exact address. Export saves from Save/Load before\n'
    'switching browsers or computers. Updating the game at the same address preserves them.\n'
    'This is a private fan project. Do not distribute.\n', encoding='utf-8')

zip_path = RELEASE / (NAME + '.zip')
with ZipFile(zip_path, 'w', ZIP_DEFLATED, compresslevel=6) as z:
    for path in sorted(STAGE.rglob('*')):
        if path.is_file():
            z.write(path, path.relative_to(RELEASE))
print(zip_path)
print(f'{zip_path.stat().st_size / 1024 / 1024:.1f} MiB')
