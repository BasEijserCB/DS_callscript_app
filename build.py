#!/usr/bin/env python3
"""
DS Logboek — Buildscript
========================
Gebruik: python3 build.py

Wat het doet:
1. Leest ds-logboek.js
2. Corrigeert dubbele regex backslashes (GAS template literal fix)
3. Voert node --check uit op ds-logboek.js
4. Minificeert paste-bookmarklet.js naar paste-bookmarklet-min.txt

Vereisten: Python 3, Node.js
"""

import re
import subprocess
import sys
import os
from urllib.parse import quote

# ── STAP 1: DS-LOGBOEK REGEX FIX ─────────────────────────────────────────────

SOURCE = 'ds-logboek.js'

print(f'Lezen: {SOURCE}')
with open(SOURCE, 'r', encoding='utf-8') as f:
    iife = f.read()

# Corrigeer dubbele backslashes in regex (GAS template literal artefact)
# \\d wordt \d, \\w wordt \w, etc.
iife_fixed = re.sub(r'\\\\([dDwWsSnbtfrvuU0-9])', r'\\\1', iife)

if iife_fixed != iife:
    print('Regex backslash correctie toegepast.')
    with open(SOURCE, 'w', encoding='utf-8') as f:
        f.write(iife_fixed)
else:
    print('Geen regex backslash correctie nodig.')

# ── STAP 2: SYNTAX CHECK DS-LOGBOEK ──────────────────────────────────────────

print(f'Syntax check: {SOURCE}')
result = subprocess.run(['node', '--check', SOURCE], capture_output=True, text=True)
if result.returncode != 0:
    print(f'SYNTAX FOUT in {SOURCE}:')
    print(result.stderr)
    sys.exit(1)
print(f'{SOURCE} syntax OK.')

# ── STAP 3: PASTE BOOKMARKLET MINIFICEREN ────────────────────────────────────

BOOKMARKLET_SOURCE = 'paste-bookmarklet.js'
BOOKMARKLET_OUTPUT = 'paste-bookmarklet-min.txt'

if not os.path.exists(BOOKMARKLET_SOURCE):
    print(f'Geen {BOOKMARKLET_SOURCE} gevonden, stap overgeslagen.')
else:
    print(f'Syntax check: {BOOKMARKLET_SOURCE}')
    result = subprocess.run(['node', '--check', BOOKMARKLET_SOURCE], capture_output=True, text=True)
    if result.returncode != 0:
        print(f'SYNTAX FOUT in {BOOKMARKLET_SOURCE}:')
        print(result.stderr)
        sys.exit(1)
    print(f'{BOOKMARKLET_SOURCE} syntax OK.')

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
        f.write(encoded)

    print(f'Geschreven: {BOOKMARKLET_OUTPUT} ({len(encoded)} tekens)')

# ── KLAAR ─────────────────────────────────────────────────────────────────────

print('\nBuild geslaagd.')
print(f'  ds-logboek.js    → pushen naar GitHub, dan cache leegmaken in browser')
if os.path.exists(BOOKMARKLET_SOURCE):
    print(f'  paste-bookmarklet-min.txt → inhoud gebruiken als bookmarklet URL')
