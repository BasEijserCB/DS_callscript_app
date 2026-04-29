#!/usr/bin/env python3
"""
DS Logboek — Buildscript
========================
Gebruik: python3 build.py

Wat het doet:
1. Voert node --check uit op ds-logboek.js en paste-bookmarklet.js
2. Detecteert versienummer uit ds-logboek.js
3. Synchroniseert PASTE_VERSION in paste-bookmarklet.js naar hetzelfde versienummer

Vereisten: Python 3, Node.js
"""

import re
import subprocess
import sys

# ── STAP 1: SYNTAX CHECK ──────────────────────────────────────────────────────

def syntax_check(filename):
    print(f'Syntax check: {filename}')
    try:
        result = subprocess.run(['node', '--check', filename], capture_output=True, text=True)
        if result.returncode != 0:
            print(f'SYNTAX FOUT in {filename}:')
            print(result.stderr)
            sys.exit(1)
        print(f'{filename} syntax OK.')
    except FileNotFoundError:
        print(f'⚠ Node.js niet gevonden, syntax check overgeslagen.')

syntax_check('ds-logboek.js')
syntax_check('paste-bookmarklet.js')

# ── STAP 2: EXTRACT VERSION ──────────────────────────────────────────────────

with open('ds-logboek.js', 'r', encoding='utf-8') as f:
    source_content = f.read()

m = re.search(r'DS Logboek (v\d+\.\d+\.\d+)', source_content)
version = m.group(1) if m else 'onbekend'
print(f'Versie gedetecteerd: {version}')

# ── STAP 3: PASTE_VERSION SYNCHRONISEREN ─────────────────────────────────────

with open('paste-bookmarklet.js', 'r', encoding='utf-8') as f:
    paste_content = f.read()

updated = re.sub(r"(const PASTE_VERSION = ')[^']*(')", rf"\g<1>{version}\2", paste_content)

if updated == paste_content:
    print(f'paste-bookmarklet.js PASTE_VERSION al op {version}, geen wijziging nodig.')
else:
    with open('paste-bookmarklet.js', 'w', encoding='utf-8') as f:
        f.write(updated)
    print(f'paste-bookmarklet.js PASTE_VERSION bijgewerkt naar {version}.')

# ── KLAAR ─────────────────────────────────────────────────────────────────────

print('\nBuild geslaagd.')
print(f'  ds-logboek.js + paste-bookmarklet.js → pushen naar GitHub')
print(f'  Loader haalt automatisch nieuwe versies op via stale-while-revalidate.')
