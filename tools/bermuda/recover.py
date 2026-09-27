"""Resume only recorded Meshy work. Accepted IDs are committed before waiting."""
import json
import os
import pathlib
import subprocess
import sys
from pack_glb import pack

ROOT = pathlib.Path.cwd()
WORK = pathlib.Path(os.environ['RUNNER_TEMP']) / 'bermuda-meshy-recovery'
WORK.mkdir(parents=True, exist_ok=True)
STATE = ROOT / 'tools/bermuda/task-lineage.json'
OUTPUT = ROOT / 'public/models/bermuda/mobile-v2'
CLI = ['npm', 'exec', '--yes', '--package=meshy-cli@0.4.0', '--', 'meshy']
FLAGS = ['--output-schema', 'v1', '--format', 'json', '--no-update-check', '--workspace', str(WORK)]
state = json.loads(STATE.read_text()) if STATE.exists() else {'version': 1, 'tasks': {}, 'assets': {}}
phase = int(sys.argv[1])
branch = os.environ['GITHUB_REF_NAME']
assert branch == 'bermuda-waterfront-verified-v2', 'Recovery only runs on the reviewed work branch'


def checkpoint(message):
    STATE.write_text(json.dumps(state, indent=2) + '\n')
    subprocess.run(['git', 'add', str(STATE)], check=True)
    if subprocess.run(['git', 'diff', '--cached', '--quiet']).returncode:
        subprocess.run(['git', 'commit', '-m', message], check=True)
        subprocess.run(['git', 'push', 'origin', 'HEAD:' + branch], check=True)


def cli(args):
    result = subprocess.run(CLI + args + FLAGS, text=True, capture_output=True)
    try:
        value = json.loads(result.stdout)
    except json.JSONDecodeError:
        raise RuntimeError('Meshy returned no JSON. Inspect task inventory before any resubmission.')
    if result.returncode or not value.get('ok'):
        error = value.get('error') or {}
        print(json.dumps({'command': value.get('command'), 'exit': result.returncode, 'error': error}), flush=True)
        raise RuntimeError('Meshy operation stopped. No automatic paid retry.')
    return value['result']


balance = cli(['balance'])['balance']
print(json.dumps({'phase': phase, 'verified_balance': balance}), flush=True)
assert balance >= (65 if phase == 1 else 30), 'Insufficient balance for approved recovery stages'

existing = [
    ('bermuda-dock', '01a0def8-3f75-72ec-8973-3ca5976cae36', 4000, 1024),
    ('bermuda-house-a', '01a0defc-1335-7017-983e-b4bf3ec7f275', 4000, 1024),
    ('bermuda-house-b', '01a0defe-b314-720a-8374-6e859ca76b35', 4000, 1024),
    ('bermuda-boathouse', '01a0df01-52a2-7057-abfd-c9e21a77d49c', 3000, 512),
    ('bermuda-palmetto', '01a0df05-3758-7606-b700-74387dbe2e84', 1500, 512),
]
missing = [
    ('bermuda-harbour-props', 2000, 512,
     'One lightweight Bermuda harbour props cluster: short dark metal double-horn mooring bollard beside a coiled thick cream rope, small white cylindrical boat fender with navy ends, compact cream dock utility pedestal. Objects close together on the same ground plane, each complete with solid simple geometry. Clean stylized realism, subtle coastal salt wear, mobile game asset. No ground slab, dock, water, buildings, people, tiny loose parts, text or logos.'),
    ('bermuda-channel-marker', 600, 512,
     'One simple red fixed harbour channel navigation marker, isolated low-poly Bermuda coastal game asset. Slender white cylindrical post with a flat red triangular daymark near the top and small dark cap. About 3 metres tall. The post ends straight at the waterline without a base. Simple complete closed surfaces and readable silhouette, restrained salt wear. No water, scenery, island, boat, railing, text, numbers or offshore buoy machinery.'),
]


def submit(key, resource, arguments, parent=None):
    if key not in state['tasks']:
        record = cli([resource, 'create'] + arguments + ['--async'])
        accepted = record.get('submission', {})
        task = accepted.get('task_id')
        if not task:
            raise RuntimeError('No accepted task ID. Query inventory before any retry.')
        state['tasks'][key] = {'resource': resource, 'task_id': task, 'status': 'SUBMITTED', 'parent_task_id': parent}
        checkpoint('Record accepted Meshy task: ' + key)
    print(json.dumps({'stage': key, **state['tasks'][key]}), flush=True)
    return key


def finish(key, download_model=False, texture=512, triangles=2000):
    record = state['tasks'][key]
    task, resource = record['task_id'], record['resource']
    init = cli(['project', 'init', '--root', str(WORK / 'projects'), '--name', key,
                '--task-id', task, '--task-type', resource])
    project = init['project_dir']
    finished = cli([resource, 'wait', task, '--timeout', '900', '--project', project, '--stage', key])
    result = finished['task']
    record.update(status=result['status'], consumed_credits=result.get('consumed_credits'))
    checkpoint('Record Meshy result: ' + key)
    assert result['status'] == 'SUCCEEDED'
    task_json = str(pathlib.Path(project) / ('task_' + task + '.json'))
    previews = WORK / 'previews'
    previews.mkdir(exist_ok=True)
    if result.get('thumbnail_url'):
        cli(['download', '--task-json', task_json, '--asset', 'thumbnail.primary',
             '--output', str(previews / (key + '.png'))])
    if download_model:
        source = WORK / (key + '.glb')
        cli(['download', '--task-json', task_json, '--model-format', 'glb', '--output', str(source)])
        name = key.removesuffix('-remesh')
        metadata = pack(source, OUTPUT / (name + '.glb'), texture, triangles)
        metadata.update(task_id=task, resource=resource, parent_task_id=record['parent_task_id'])
        state['assets'][name] = metadata
        subprocess.run(['git', 'add', str(OUTPUT / (name + '.glb'))], check=True)
        checkpoint('Save verified mobile GLB: ' + name)
        print(json.dumps(metadata), flush=True)


if phase == 1:
    pending = []
    for name, source, triangles, texture in existing:
        key = submit(name + '-remesh', 'remesh', ['--input-task-id', source, '--topology', 'triangle',
                    '--target-polycount', str(triangles), '--target-formats', 'glb'], source)
        pending.append((key, True, texture, triangles))
    for name, triangles, texture, prompt in missing:
        key = submit(name + '-preview', 'text-to-3d', ['--mode', 'preview', '--prompt', prompt, '--target-formats', 'glb'])
        pending.append((key, False, texture, triangles))
    for job in pending:
        finish(*job)
elif phase == 2:
    for name, triangles, texture, _ in missing:
        source = state['tasks'][name + '-preview']['task_id']
        key = submit(name + '-refine', 'text-to-3d', ['--mode', 'refine', '--preview-task-id', source,
                    '--enable-pbr', 'false', '--texture-resolution', '2k', '--remove-lighting', 'true',
                    '--texture-prompt', ('White painted marine post, red upper cap, restrained salt wear, opaque diffuse materials, no lettering.' if name.endswith('marker') else 'Charcoal metal mooring bollard, cream rope, white rubber fender with navy end caps and cream dock utility pedestal. Opaque diffuse colour, subtle salt wear, no text or logos.'),
                    '--target-formats', 'glb'], source)
        finish(key)
        refined = state['tasks'][key]['task_id']
        key = submit(name + '-remesh', 'remesh', ['--input-task-id', refined, '--topology', 'triangle',
                    '--target-polycount', str(triangles), '--target-formats', 'glb'], refined)
        finish(key, True, texture, triangles)
else:
    raise ValueError('Unknown phase')
print(json.dumps({'final_balance': cli(['balance'])['balance'], 'assets_saved': list(state['assets'])}), flush=True)
