"""Resume preserved expansion tasks; checkpoint every accepted ID before waiting."""
import json, os, pathlib, subprocess, re
from pack_glb import pack
ROOT=pathlib.Path.cwd()
WORK=pathlib.Path(os.environ['RUNNER_TEMP'])/'bermuda-expansion-resume'; WORK.mkdir(exist_ok=True)
STATE=ROOT/'tools/bermuda/expansion-lineage.json'
OUTPUT=ROOT/'public/models/bermuda/mobile-v3'
PREVIEWS=OUTPUT/'previews'; PREVIEWS.mkdir(parents=True,exist_ok=True)
CLI=['npm','exec','--yes','--package=meshy-cli@0.4.0','--','meshy']
FLAGS=['--output-schema','v1','--format','json','--no-update-check','--workspace',str(WORK)]
branch=os.environ['GITHUB_REF_NAME']; assert branch=='bermuda-waterfront-expansion-recovery'
state=json.loads(STATE.read_text())
SPECS=[('limestone-seawall',4000,1024),('house-c',6000,1024),('house-d',6000,1024),('hillside-cluster',4500,512),('hilltop-landmark',3500,512),('bougainvillea-cluster',2500,512),('rocky-shoreline',3500,512),('marina-kit',3500,512),('fish-market',6000,1024),('bait-tackle',6000,1024)]
PROMPTS={
'rocky-shoreline':'Bermuda coastal rocky shoreline module, pale weathered limestone ledges and irregular low coastal rocks shaped by Atlantic water, light cream grey porous stone, suitable for turquoise shallows, game-ready modular asset, isolated, no water, no vegetation, no people.',
'marina-kit':'Bermuda harbour background kit, two complete small white sailing yachts with slender masts and furled sails, one compact moored motor yacht, clean realistic island harbour proportions, simple low-detail distant game asset, isolated arrangement, no water plane, no people, no pontoon.',
'fish-market':'Compact authentic Bermuda dockside fish market kiosk, cream rendered masonry walls, dominant white stepped limestone Bermuda roof with horizontal rainwater courses and tiny chimney, open shaded front selling counter facing positive front, shallow rectangular footprint, fish counter with neat blue cooler, tidy affluent St George Bermuda waterfront. Isolated whole building, all sides complete, no ground plane, no people, no wooden shack, no stilts, no text.',
'bait-tackle':'Compact authentic Bermuda dockside bait and tackle kiosk, soft pale turquoise rendered masonry walls, dominant white stepped limestone Bermuda roof with horizontal rainwater courses and small chimney, open shaded front shop counter, modest fishing rod display. Shallow rectangular footprint, tidy affluent St George Bermuda waterfront. Isolated complete building, no people, no ground plane, no wooden shack, no stilts, no text.'}

def cli(args):
 r=subprocess.run(CLI+args+FLAGS,text=True,capture_output=True)
 try:d=json.loads(r.stdout)
 except Exception:raise RuntimeError('Unknown Meshy response; inspect inventory before any paid retry')
 if r.returncode or not d.get('ok'):
  print(re.sub(r'https?://[^\s\"]+','[URL omitted]',json.dumps({'command':d.get('command'),'exit':r.returncode,'error':d.get('error')})),flush=True)
  raise RuntimeError('Meshy stopped; no automatic paid retry')
 return d['result']

def save(message):
 STATE.write_text(json.dumps(state,indent=2)+'\n')
 subprocess.run(['git','add',str(STATE),str(OUTPUT)],check=True)
 if subprocess.run(['git','diff','--cached','--quiet']).returncode:
  subprocess.run(['git','commit','-m',message],check=True)
  subprocess.run(['git','push','origin','HEAD:'+branch],check=True)

def submit(name,stage,args,parent=None):
 key='bermuda-'+name+'-'+stage
 if key not in state['tasks']:
  resource='remesh' if stage=='remesh' else 'text-to-3d'
  r=cli([resource,'create']+args+['--async']);task=r.get('submission',{}).get('task_id')
  if not task:raise RuntimeError('Accepted ID unknown; stop before any retry')
  state['tasks'][key]={'resource':resource,'task_id':task,'status':'SUBMITTED','parent_task_id':parent,'consumed_credits':None}
  save('Record accepted expansion task: '+key)
 print(json.dumps({'stage':key,**state['tasks'][key]}),flush=True)
 return key

def finish(key,package=None):
 record=state['tasks'][key]; task=record['task_id']; resource=record['resource']
 init=cli(['project','init','--root',str(WORK/'projects'),'--name',key,'--task-id',task,'--task-type',resource]);project=init['project_dir']
 r=cli([resource,'wait',task,'--timeout','900','--project',project,'--stage',key]);result=r['task']
 record.update(status=result['status'],consumed_credits=result.get('consumed_credits'));save('Record expansion result: '+key)
 assert result['status']=='SUCCEEDED'
 snapshot=str(pathlib.Path(project)/('task_'+task+'.json'))
 preview=PREVIEWS/(key+'.png')
 if result.get('thumbnail_url') and not preview.exists():cli(['download','--task-json',snapshot,'--asset','thumbnail.primary','--output',str(preview)])
 if package:
  name,triangles,texture=package; asset='bermuda-'+name
  if asset not in state['assets']:
   source=WORK/(key+'.glb')
   if not source.exists():cli(['download','--task-json',snapshot,'--model-format','glb','--output',str(source)])
   metadata=pack(source,OUTPUT/(asset+'.glb'),texture,int(triangles*1.05))
   assert metadata['bytes']<4_000_000, 'Per-asset mobile download budget exceeded'
   assert sum(a['triangles'] for a in state['assets'].values())+metadata['triangles']<50_000
   metadata.update(task_id=task,resource=resource,parent_task_id=record['parent_task_id'])
   state['assets'][asset]=metadata
   print(json.dumps(metadata),flush=True)
 save('Preserve optimized expansion output: '+key)
 return task

# Free checks first; six source models already paid for. Estimates apply only to missing stages.
estimates={}
for name,prompt in PROMPTS.items():
 e=cli(['make',prompt,'--dry-run']);estimates[name]=e['estimated_credits'];assert e['estimated_credits']<=30
balance=cli(['balance'])['balance']
remaining=0
for name,_,_ in SPECS:
 for stage,cost in [('preview',20),('refine',10),('remesh',5)]:
  if 'bermuda-'+name+'-'+stage not in state['tasks']:remaining+=cost
assert remaining<=170 and balance>=remaining
state['preflight']={'balance':balance,'estimated_remaining_credits':remaining,'generation_estimates':estimates,'remesh_estimate_each':5,'remesh_price_source':'https://docs.meshy.ai/en/api/pricing','price_checked':'2026-09-27'};save('Record expansion recovery credit preflight')
print(json.dumps(state['preflight']),flush=True)
# Recover charges and source thumbnails with free queries; no new source generations.
for name,_,_ in SPECS:
 for stage in ('preview','refine'):
  key='bermuda-'+name+'-'+stage
  if key in state['tasks'] and state['tasks'][key]['consumed_credits'] is None:
   record=state['tasks'][key];r=cli([record['resource'],'get',record['task_id']]);t=r.get('task',r)
   record.update(status=t.get('status',record['status']),consumed_credits=t.get('consumed_credits'))
save('Recover existing source task charges')
# Submit one stage per asset; accepted IDs are durable even if a later wait or git push fails.
pending=[]
for name,tri,tex in SPECS:
 source=state['tasks'].get('bermuda-'+name+'-refine')
 if source:
  key=submit(name,'remesh',['--input-task-id',source['task_id'],'--topology','triangle','--target-polycount',str(tri),'--target-formats','glb'],source['task_id'])
  pending.append((key,(name,tri,tex)))
 else:
  key=submit(name,'preview',['--mode','preview','--prompt',PROMPTS[name],'--target-formats','glb']);pending.append((key,None))
for key,package in pending:finish(key,package)
# Texture only the four previously unstarted assets.
refines=[]
for name in PROMPTS:
 src=state['tasks']['bermuda-'+name+'-preview']['task_id']
 key=submit(name,'refine',['--mode','refine','--preview-task-id',src,'--enable-pbr','false','--texture-resolution','2k','--remove-lighting','true','--texture-prompt',PROMPTS[name]+' Opaque diffuse materials, natural subtle colour variation, clean finish.','--target-formats','glb'],src);refines.append(key)
for key in refines:finish(key)
remeshes=[]
for name,tri,tex in SPECS:
 if name not in PROMPTS:continue
 src=state['tasks']['bermuda-'+name+'-refine']['task_id']
 key=submit(name,'remesh',['--input-task-id',src,'--topology','triangle','--target-polycount',str(tri),'--target-formats','glb'],src);remeshes.append((key,(name,tri,tex)))
for key,package in remeshes:finish(key,package)
state['balance_after']=cli(['balance'])['balance'];save('Finish expansion recovery with actual charges and hashes')
