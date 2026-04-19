#!/usr/bin/env python3
"""
DS Logboek — Buildscript
========================
Gebruik: python3 build.py

Wat het doet:
1. Voert node --check uit op ds-logboek.js
2. Voert node --check uit op paste-bookmarklet.js
3. Minificeert paste-bookmarklet.js naar paste-bookmarklet-min.txt
4. Voegt versie toe (uit ds-logboek.js) aan de minified output

Vereisten: Python 3, Node.js
"""

import re
import subprocess
import sys
import os
from urllib.parse import quote

# ── STAP 1: SYNTAX CHECK DS-LOGBOEK ──────────────────────────────────────────

SOURCE = 'ds-logboek.js'

print(f'Syntax check: {SOURCE}')
try:
    result = subprocess.run(['node', '--check', SOURCE], capture_output=True, text=True)
    if result.returncode != 0:
        print(f'SYNTAX FOUT in {SOURCE}:')
        print(result.stderr)
        sys.exit(1)
    print(f'{SOURCE} syntax OK.')
except FileNotFoundError:
    print(f'⚠ Node.js niet gevonden, syntax check overgeslagen.')

# ── STAP 2: EXTRACT VERSION ──────────────────────────────────────────────────

with open(SOURCE, 'r', encoding='utf-8') as f:
    source_content = f.read()

m = re.search(r'DS Logboek (v\d+\.\d+\.\d+)', source_content)
version = m.group(1) if m else 'onbekend'
print(f'Versie gedetecteerd: {version}')

# ── STAP 3: PASTE BOOKMARKLET MINIFICEREN ────────────────────────────────────

BOOKMARKLET_SOURCE = 'paste-bookmarklet.js'
BOOKMARKLET_OUTPUT = 'paste-bookmarklet-min.txt'

if not os.path.exists(BOOKMARKLET_SOURCE):
    print(f'Geen {BOOKMARKLET_SOURCE} gevonden, stap overgeslagen.')
else:
    print(f'Syntax check: {BOOKMARKLET_SOURCE}')
    try:
        result = subprocess.run(['node', '--check', BOOKMARKLET_SOURCE], capture_output=True, text=True)
        if result.returncode != 0:
            print(f'SYNTAX FOUT in {BOOKMARKLET_SOURCE}:')
            print(result.stderr)
            sys.exit(1)
        print(f'{BOOKMARKLET_SOURCE} syntax OK.')
    except FileNotFoundError:
        print(f'⚠ Node.js niet gevonden, syntax check overgeslagen.')

    print(f'Minificeren: {BOOKMARKLET_SOURCE}')
    with open(BOOKMARKLET_SOURCE, 'r', encoding='utf-8') as f:
        code = f.read()

    code = code.strip()
    if code.startswith('javascript:'):
        code = code[len('javascript:'):]

    minified = re.sub(r'//[^\n]*', '', code)
    minified = re.sub(r'\n\s*', ' ', minified)
    minified = re.sub(r'\s{2,}', ' ', minified)
    minified = minified.strip()

    encoded = 'javascript:' + quote(minified)

    with open(BOOKMARKLET_OUTPUT, 'w', encoding='utf-8') as f:
        f.write(f'# paste-bookmarklet — gegenereerd vanuit DS Logboek {version}\n')
        f.write(encoded)

    print(f'Geschreven: {BOOKMARKLET_OUTPUT} ({len(encoded)} tekens)')

# ── KLAAR ─────────────────────────────────────────────────────────────────────

print('\nBuild geslaagd.')
print(f'  ds-logboek.js    → pushen naar GitHub, dan cache leegmaken in browser')
if os.path.exists(BOOKMARKLET_SOURCE):
    print(f'  paste-bookmarklet-min.txt → inhoud gebruiken als bookmarklet URL (alleen de tweede regel!)')
