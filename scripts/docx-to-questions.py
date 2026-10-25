import sys, re, json, zipfile, xml.etree.ElementTree as ET
W='{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
root=ET.fromstring(zipfile.ZipFile(sys.argv[1]).read('word/document.xml'))

def is_bold(r):
    rpr=r.find(W+'rPr')
    if rpr is None: return False
    for tag in ('b','u'):
        e=rpr.find(W+tag)
        if e is not None and e.get(W+'val') not in ('0','false','none'): return True
    return False

paras=[]
for p in root.iter(W+'p'):
    parts=[]
    for r in p.iter(W+'r'):
        t=''.join(x.text or '' for x in r.iter(W+'t'))
        if t: parts.append((t,is_bold(r)))
    # merge adjacent runs with same boldness
    merged=[]
    for t,b in parts:
        if merged and merged[-1][1]==b: merged[-1]=(merged[-1][0]+t,b)
        else: merged.append((t,b))
    plain=''.join(t for t,_ in merged).strip()
    marked=''
    for t,b in merged:
        if b and t.strip():
            lead=t[:len(t)-len(t.lstrip())]; trail=t[len(t.rstrip()):]
            marked+=lead+'**'+t.strip()+'**'+trail
        else: marked+=t
    paras.append((plain, marked.strip()))

sec_re=re.compile(r'^Section [A-Z]: (.+?) \(Questions (\d+)-(\d+)\)$')
q_re=re.compile(r'^(\d+)\.\s*(.*)$'); o_re=re.compile(r'^([a-d])\.\s*(.*)$')
questions=[]; topic=None; instruction=''; passage=''; cur=None; started=False; awaiting_instr=False
for plain,marked in paras:
    if plain.startswith('Answer Key'): break
    m=sec_re.match(plain)
    if m:
        topic=m.group(1); instruction=''; passage=''; awaiting_instr=True; started=True; cur=None; continue
    if not started or not plain: continue
    mq=q_re.match(plain); mo=o_re.match(plain)
    if mq and not mo:
        n=int(mq.group(1))
        cur={'number':n,'topic':topic,'instruction':instruction,'passage':passage,
             'prompt':q_re.match(marked.replace('**','',0)).group(2) if False else re.sub(r'^\**\d+\.\**\s*','',marked),'choices':[]}
        questions.append(cur); awaiting_instr=False; continue
    if mo and cur is not None and len(cur['choices'])<4:
        cur['choices'].append(re.sub(r'^\**[a-d]\.\**\s*','',marked)); continue
    # non-question paragraph inside a section: instruction or passage
    if cur is None or len(cur['choices'])==4:
        if awaiting_instr or (cur is None and not instruction):
            instruction=(instruction+' '+plain).strip() if instruction else plain; awaiting_instr=False
        else:
            passage=(passage+'\n\n'+plain).strip() if passage else plain
        cur=None if cur is None or len(cur['choices'])==4 else cur
        continue
    print('UNHANDLED', plain, file=sys.stderr)

# answer key
text='\n'.join(p for p,_ in paras)
key=dict((int(n),a) for n,a in re.findall(r'(\d+) ([A-D])\b', text[text.index('Answer Key'):]))
for q in questions: q['answer']=key.get(q['number'])
bad=[q['number'] for q in questions if len(q['choices'])!=4 or not q['answer']]
print('count',len(questions),'bad',bad, 'numbers ok', [q['number'] for q in questions]==list(range(1,101)), file=sys.stderr)
json.dump(questions, open(sys.argv[2],'w',encoding='utf-8'), ensure_ascii=False, indent=1)
