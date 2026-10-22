import fs from 'node:fs';

function replaceOnce(source, oldText, newText, label) {
  if (!source.includes(oldText)) throw new Error(`${label} marker not found`);
  return source.replace(oldText, newText);
}

const gltfPath = 'src/engine/loaders/GLTF.js';
let gltf = fs.readFileSync(gltfPath, 'utf8');
gltf = replaceOnce(
  gltf,
  "\tif ( json.extensionsRequired && json.extensionsRequired.length ) throw new Error( 'GLB: unsupported extensions ' + json.extensionsRequired.join( ', ' ) );",
  "\tconst requiredExtensions = json.extensionsRequired || [];\n\tconst unsupportedExtensions = requiredExtensions.filter( ( name ) => name !== 'EXT_texture_webp' );\n\tif ( unsupportedExtensions.length ) throw new Error( 'GLB: unsupported extensions ' + unsupportedExtensions.join( ', ' ) );",
  'GLTF required-extension guard',
);

const imageMarker = "\tconst images = ( json.images || [] ).map( ( im ) => ( { bytes: im.bufferView !== undefined ? viewBytes( im.bufferView ) : null, mimeType: im.mimeType, uri: im.uri } ) );";
const imageInsert = `\t// EXT_texture_webp stores the preferred image source on the texture extension rather than\n\t// texture.source. Normalize it here so the rest of the engine can remain extension-agnostic.\n\tconst textures = ( json.textures || [] ).map( ( texture ) => {\n\n\t\tconst webp = texture.extensions && texture.extensions.EXT_texture_webp;\n\t\treturn webp && webp.source !== undefined ? { ...texture, source: webp.source } : texture;\n\n\t} );\n\n${imageMarker}`;
gltf = replaceOnce(gltf, imageMarker, imageInsert, 'GLTF image');
gltf = replaceOnce(
  gltf,
  "\treturn { json, nodes, roots, meshes, skins, animations, materials: json.materials || [], textures: json.textures || [], images };",
  "\treturn { json, nodes, roots, meshes, skins, animations, materials: json.materials || [], textures, images };",
  'GLTF return',
);
fs.writeFileSync(gltfPath, gltf);

const identityPath = 'src/world/BermudaIdentity.js';
let identity = fs.readFileSync(identityPath, 'utf8');
const importMarker = "import { installReferenceStreetLife } from './ReferenceStreetLife.js';";
identity = replaceOnce(
  identity,
  importMarker,
  `${importMarker}\nimport { installReferenceStreetLifeModels } from './ReferenceStreetLifeModels.js';`,
  'BermudaIdentity import',
);

const callMarker = "\tinstallReferenceStreetLife( app );";
const callBlock = `\tinstallReferenceStreetLife( app );
\t// Meshy models replace the lightweight procedural scooters/people only after each GLB has
\t// loaded and passed the runtime checks. Keep mobile boot responsive by streaming this cosmetic
\t// pass shortly after the core scene; desktop starts it immediately. A load failure leaves the
\t// proven procedural fallback visible instead of breaking gameplay.
\tconst loadStreetLifeModels = () => installReferenceStreetLifeModels( app ).catch( ( error ) =>
\t\tconsole.warn( 'Bermuda Meshy street-life pass failed; procedural fallbacks remain active.', error ) );
\tconst params = typeof location !== 'undefined' ? new URLSearchParams( location.search ) : null;
\tconst mobileStreetLife = typeof navigator !== 'undefined' && ! params?.has( 'desktop' ) && (
\t\t/iPhone|iPad|iPod|Android/i.test( navigator.userAgent ) ||
\t\t( navigator.maxTouchPoints > 1 && typeof screen !== 'undefined' && Math.min( screen.width, screen.height ) < 1024 )
\t);
\tif ( mobileStreetLife && typeof setTimeout === 'function' ) setTimeout( loadStreetLifeModels, 3200 );
\telse void loadStreetLifeModels();`;
identity = replaceOnce(identity, callMarker, callBlock, 'BermudaIdentity street-life call');
fs.writeFileSync(identityPath, identity);

console.log('Meshy street-life runtime patches applied.');
