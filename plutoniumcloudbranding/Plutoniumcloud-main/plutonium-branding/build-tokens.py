#!/usr/bin/env python3
from pathlib import Path
import json,re
root=Path(__file__).resolve().parent
values=json.loads((root/'tokens.json').read_text(encoding='utf-8'))
lines='\n'.join('  --pc-'+re.sub(r'[A-Z]',lambda m:'-'+m.group().lower(),name)+': '+value+';' for name,value in values.items())
(root/'tokens.css').write_text('/* Plutonium Cloud visual contract v1. Presentation only. */\n:root {\n'+lines+'\n}\n',encoding='utf-8')
p=root/'authentik.css';css=p.read_text(encoding='utf-8')
css,count=re.subn(r'  /\* tokens:start \*/.*?  /\* tokens:end \*/','  /* tokens:start */\n'+lines+'\n  /* tokens:end */',css,flags=re.S)
assert count==1
p.write_text(css,encoding='utf-8')
print('Generated tokens.css and Authentik token declarations from tokens.json.')
