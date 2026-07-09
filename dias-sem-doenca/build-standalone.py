#!/usr/bin/env python3
"""Gera o arquivo unico local (Dias-sem-Doenca.html) a partir de index.html+styles.css+app.js.
Usa funcao de substituicao (lambda) para NAO processar escapes tipo \\n."""
import re, os
d = os.path.dirname(os.path.abspath(__file__)); os.chdir(d)
html = open('index.html', encoding='utf-8').read()
css = open('styles.css', encoding='utf-8').read()
js = open('app.js', encoding='utf-8').read()
rep = lambda pat, r, s: re.sub(pat, lambda m: r, s)
html = re.sub(r'\s*<script src="https://www\.gstatic\.com/firebasejs/[^"]*"></script>', '', html)
html = re.sub(r'\s*<script src="firebase-config\.js"></script>', '', html)
html = re.sub(r'\s*<link rel="manifest"[^>]*>', '', html)
html = re.sub(r'\s*<link rel="icon"[^>]*>', '', html)
html = re.sub(r'\s*<link rel="apple-touch-icon"[^>]*>', '', html)
html = rep(r'\s*<link rel="stylesheet"[^>]*>', '\n  <style>\n'+css+'\n  </style>', html)
html = rep(r'\s*<script src="app\.js"></script>', '\n  <script>\n'+js+'\n  </script>', html)
open('Dias-sem-Doenca.html', 'w', encoding='utf-8').write(html)
print('ok:', len(html), 'bytes')
