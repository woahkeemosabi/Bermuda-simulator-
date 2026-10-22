"""Package a Meshy GLB for the native mobile renderer, without altering its mesh."""
import argparse
import copy
import hashlib
import io
import json
import pathlib
import struct
from PIL import Image


def pack(source, destination, max_texture, max_triangles):
    data = pathlib.Path(source).read_bytes()
    magic, version, length = struct.unpack_from('<III', data)
    assert magic == 0x46546C67 and version == 2 and length == len(data), 'Invalid GLB header'
    document, binary = None, None
    offset = 12
    while offset < length:
        size, kind = struct.unpack_from('<II', data, offset)
        payload = data[offset + 8:offset + 8 + size]
        if kind == 0x4E4F534A:
            document = json.loads(payload)
        elif kind == 0x004E4942:
            binary = payload
        offset += size + 8
    assert document is not None and binary is not None
    assert not set(document.get('extensionsRequired', [])) - {'EXT_texture_webp'}, 'Unsupported geometry extension'
    assert not document.get('skins') and not document.get('animations'), 'Expected static asset'
    triangles = 0
    for mesh in document.get('meshes', []):
        for primitive in mesh['primitives']:
            assert primitive.get('mode', 4) == 4
            a = document['accessors'][primitive.get('indices', primitive['attributes']['POSITION'])]
            triangles += a['count'] // 3
    assert 0 < triangles <= max_triangles, f'Triangle budget exceeded: {triangles} > {max_triangles}'
    original = copy.deepcopy(document)
    result = bytearray()
    views, view_map = [], {}

    def append_view(payload, old_index=None):
        while len(result) % 4:
            result.append(0)
        view = copy.deepcopy(original['bufferViews'][old_index]) if old_index is not None else {}
        view.update(buffer=0, byteOffset=len(result), byteLength=len(payload))
        result.extend(payload)
        views.append(view)
        return len(views) - 1

    for accessor in document.get('accessors', []):
        assert 'sparse' not in accessor, 'Sparse accessor unsupported'
        if 'bufferView' in accessor:
            old = accessor['bufferView']
            if old not in view_map:
                view = original['bufferViews'][old]
                assert view.get('buffer', 0) == 0
                start = view.get('byteOffset', 0)
                view_map[old] = append_view(binary[start:start + view['byteLength']], old)
            accessor['bufferView'] = view_map[old]

    images, textures, texture_map, sizes = [], [], {}, []
    for material in document.get('materials', []):
        material.pop('normalTexture', None)
        material.pop('occlusionTexture', None)
        material.pop('emissiveTexture', None)
        material.pop('extensions', None)
        material['doubleSided'] = True
        assert material.get('alphaMode', 'OPAQUE') != 'BLEND'
        pbr = material.setdefault('pbrMetallicRoughness', {})
        pbr.pop('metallicRoughnessTexture', None)
        pbr.update(metallicFactor=0, roughnessFactor=0.9)
        if 'baseColorTexture' not in pbr:
            continue
        slot = pbr['baseColorTexture']
        assert slot.get('texCoord', 0) == 0 and not slot.get('extensions')
        old_texture = slot['index']
        if old_texture not in texture_map:
            texture = original['textures'][old_texture]
            image_index = texture.get('source', texture.get('extensions', {}).get('EXT_texture_webp', {}).get('source'))
            image = original['images'][image_index]
            view = original['bufferViews'][image['bufferView']]
            start = view.get('byteOffset', 0)
            with Image.open(io.BytesIO(binary[start:start + view['byteLength']])) as im:
                im.thumbnail((max_texture, max_texture), Image.Resampling.LANCZOS)
                im = im.convert('RGBA' if material.get('alphaMode') == 'MASK' else 'RGB')
                output = io.BytesIO()
                im.save(output, format='PNG', optimize=True)
                sizes.append(list(im.size))
            images.append({'bufferView': append_view(output.getvalue()), 'mimeType': 'image/png'})
            textures.append({'source': len(images) - 1, 'sampler': 0})
            texture_map[old_texture] = len(textures) - 1
        slot['index'] = texture_map[old_texture]

    document['asset'] = {'version': '2.0', 'generator': 'Meshy; Bermuda native-renderer texture packaging'}
    document['bufferViews'] = views
    document['buffers'] = [{'byteLength': len(result)}]
    document['images'], document['textures'] = images, textures
    document['samplers'] = [{'magFilter': 9729, 'minFilter': 9987, 'wrapS': 10497, 'wrapT': 10497}]
    document.pop('extensionsUsed', None)
    document.pop('extensionsRequired', None)
    encoded = json.dumps(document, separators=(',', ':')).encode()
    encoded += b' ' * (-len(encoded) % 4)
    result.extend(b'\0' * (-len(result) % 4))
    out = struct.pack('<III', 0x46546C67, 2, 28 + len(encoded) + len(result))
    out += struct.pack('<II', len(encoded), 0x4E4F534A) + encoded
    out += struct.pack('<II', len(result), 0x004E4942) + result
    destination = pathlib.Path(destination)
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(out)
    return {'file': destination.name, 'bytes': len(out), 'sha256': hashlib.sha256(out).hexdigest(),
            'triangles': triangles, 'textures': sizes, 'materials': len(document.get('materials', []))}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('source')
    parser.add_argument('destination')
    parser.add_argument('--texture', type=int, required=True)
    parser.add_argument('--triangles', type=int, required=True)
    args = parser.parse_args()
    print(json.dumps(pack(args.source, args.destination, args.texture, args.triangles)))
