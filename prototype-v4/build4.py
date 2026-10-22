import os
d=os.path.dirname(os.path.abspath(__file__))+'/'
pre=open(d+'pre.txt').read()
src='\n'.join(open(d+f).read() for f in ['data.js','art.js','cook.js','app.js','shell.js','v4.js'])
html=pre+'<script>\n'+src+'\n</script>\n'
html=html.replace("function dateLabel(iso,long){const d=new Date(iso); return long?`${DOWL[d.getDay()]}, ${d.getDate()} ${MON[d.getMonth()]}`","function dateLabel(iso,long){const d=new Date(iso); return long?`${DOWL[d.getDay()][0].toUpperCase()+DOWL[d.getDay()].slice(1)}, ${d.getDate()} ${MON[d.getMonth()]}`").replace(' style="text-transform:capitalize"','')
open(d+'index.html','w').write(html)
print(len(html))
