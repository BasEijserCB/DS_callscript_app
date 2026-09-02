#!/usr/bin/env python3
"""
DS Logboek — Buildscript
========================
Gebruik: python3 build.py

Wat het doet:
1. Voert node --check uit op ds-logboek.js, paste-bookmarklet.js en
   tourtool/extra-rijtijd.js
2. Controleert of het gedeelde stijlblok DS_UI in ds-logboek.js en
   tourtool/extra-rijtijd.js nog letterlijk gelijk is
3. Detecteert versienummer uit ds-logboek.js
4. Synchroniseert PASTE_VERSION in paste-bookmarklet.js naar hetzelfde versienummer

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
# Losse tool met een eigen versienummer (RIJTIJD_VERSION); die wordt hier
# bewust niet gesynchroniseerd, alleen gecontroleerd.
syntax_check('tourtool/extra-rijtijd.js')

# ── STAP 1b: GEDEELDE STIJL VERGELIJKEN ──────────────────────────────────────
# ds-logboek.js en tourtool/extra-rijtijd.js dragen allebei een letterlijk
# identieke DS_UI-lijst: de knoppen, velden, blokken en kleuren die beide tools
# delen. Ze kunnen die code niet importeren — het zijn twee losse bestanden die
# elk apart door een bookmarklet geladen worden — dus is dit de enige plek waar
# gecontroleerd kan worden dat ze niet uit elkaar gelopen zijn.

def lees_ds_ui(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        inhoud = f.read()
    begin = inhoud.find('  var DS_UI = [')
    if begin == -1:
        print(f'DS_UI niet gevonden in {filename}.')
        sys.exit(1)
    eind = inhoud.find('\n  ];', begin)
    if eind == -1:
        print(f'DS_UI in {filename} wordt niet afgesloten.')
        sys.exit(1)
    return inhoud[begin:eind]

print('Gedeelde stijl: DS_UI vergelijken')
ui_widget = lees_ds_ui('ds-logboek.js')
ui_tool = lees_ds_ui('tourtool/extra-rijtijd.js')
if ui_widget != ui_tool:
    import difflib
    print('DS_UI LOOPT UITEEN tussen ds-logboek.js en tourtool/extra-rijtijd.js:')
    for regel in difflib.unified_diff(
            ui_widget.splitlines(), ui_tool.splitlines(),
            fromfile='ds-logboek.js', tofile='tourtool/extra-rijtijd.js', lineterm=''):
        print('  ' + regel)
    print('\nBeide bestanden moeten dezelfde DS_UI-lijst bevatten. Pas allebei aan.')
    sys.exit(1)
print(f'DS_UI identiek in beide bestanden ({ui_widget.count(chr(10))} regels).')

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
print(f'  ds-logboek.js + paste-bookmarklet.js + tourtool/extra-rijtijd.js → pushen naar GitHub')
print(f'  Loader haalt automatisch nieuwe versies op via stale-while-revalidate.')
