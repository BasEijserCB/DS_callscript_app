#!/usr/bin/env python3
"""
DS Logboek — Buildscript
========================
Gebruik: python3 build.py

Wat het doet:
1. Voert node --check uit op ds-logboek.js
2. Minificeert paste-bookmarklet.js naar paste-bookmarklet-min.txt
3. Minificeert loader-bookmarklet.js naar loader-bookmarklet-min.txt
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

# ── STAP 3: BOOKMARKLETS MINIFICEREN ─────────────────────────────────────────

def build_bookmarklet(source, output, label):
    if not os.path.exists(source):
        print(f'Geen {source} gevonden, stap overgeslagen.')
        return False
    print(f'Syntax check: {source}')
    try:
        result = subprocess.run(['node', '--check', source], capture_output=True, text=True)
        if result.returncode != 0:
            print(f'SYNTAX FOUT in {source}:')
            print(result.stderr)
            sys.exit(1)
        print(f'{source} syntax OK.')
    except FileNotFoundError:
        print(f'⚠ Node.js niet gevonden, syntax check overgeslagen.')

    print(f'Minificeren: {source}')
    with open(source, 'r', encoding='utf-8') as f:
        code = f.read()

    code = code.strip()
    if code.startswith('javascript:'):
        code = code[len('javascript:'):]

    minified = re.sub(r'(?<!:)//[^\n]*', '', code)
    minified = re.sub(r'\n\s*', ' ', minified)
    minified = re.sub(r'\s{2,}', ' ', minified)
    minified = minified.strip()

    encoded = 'javascript:' + quote(minified)

    with open(output, 'w', encoding='utf-8') as f:
        f.write(f'# {label} — gegenereerd vanuit DS Logboek {version}\n')
        f.write(encoded)

    print(f'Geschreven: {output} ({len(encoded)} tekens)')
    return True

paste_built = build_bookmarklet('paste-bookmarklet.js', 'paste-bookmarklet-min.txt', 'paste-bookmarklet')
loader_built = build_bookmarklet('loader-bookmarklet.js', 'loader-bookmarklet-min.txt', 'loader-bookmarklet')

# ── KLAAR ─────────────────────────────────────────────────────────────────────

print('\nBuild geslaagd.')
print(f'  ds-logboek.js    → pushen naar GitHub (loader haalt zelf nieuwe versie op)')
if paste_built:
    print(f'  paste-bookmarklet-min.txt  → inhoud gebruiken als bookmarklet URL (alleen de tweede regel!)')
if loader_built:
    print(f'  loader-bookmarklet-min.txt → inhoud gebruiken als bookmarklet URL (alleen de tweede regel!)')
print(f'  Werk install.html bij met de nieuwe bookmarklet-URLs én versienummer.')
