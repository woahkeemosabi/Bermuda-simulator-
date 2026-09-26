import { Box3, BufferAttribute, BufferGeometry, Color, Group, InstancedMesh, Matrix4, Mesh, Quaternion, Vector3 } from '../../engine/index.js';
import { loadGLB, decodeImage } from '../../engine/loaders/GLTF.js';
import { Texture } from '../../engine/gpu/Texture.js';
import { generateMipmaps } from '../../engine/gpu/Mipmaps.js';
import { Material } from '../../engine/render/Material.js';

// Static, embedded GLBs only. Reuses the existing engine and its GLB parser; no second renderer,
// decoder worker, animation system or runtime mesh decompression is added to the mobile build.
// Geometry is shared by every placement; node transforms are baked once when the asset loads.
export function staticGeometry( gltf ) {

	if ( gltf.skins.length || gltf.animations.length ) throw new Error( 'Waterfront assets must be static.' );
	const parts = [];
	const bounds = new Box3().makeEmpty();
	let triangles = 0;
	const visit = ( index, parent ) => {

		const n = gltf.nodes[ index ];
		const local = new Matrix4().compose( new Vector3( ...n.t ), new Quaternion( ...n.r ), new Vector3( ...n.s ) );
		const world = new Matrix4().multiplyMatrices( parent, local );
		if ( n.mesh !== undefined ) for ( const primitive of gltf.meshes[ n.mesh ] ) {

			if ( primitive.mode !== 4 ) throw new Error( 'Waterfront assets must use triangle primitives.' );
			const attributes = primitive.attributes;
			if ( ! attributes.POSITION || attributes.POSITION.itemSize !== 3 ) throw new Error( 'Missing GLB positions.' );
			const geometry = new BufferGeometry();
			geometry.setAttribute( 'position', floatAttribute( attributes.POSITION ) );
			if ( attributes.NORMAL ) geometry.setAttribute( 'normal', floatAttribute( attributes.NORMAL ) );
			if ( attributes.TEXCOORD_0 ) geometry.setAttribute( 'uv', floatAttribute( attributes.TEXCOORD_0 ) );
			const vertexCount = geometry.attributes.position.count;
			const sourceIndices = primitive.indices || Uint32Array.from( { length: vertexCount }, ( _, i ) => i );
			if ( sourceIndices.length % 3 ) throw new Error( 'Incomplete GLB triangle.' );
			for ( const i of sourceIndices ) if ( i >= vertexCount ) throw new Error( 'GLB index exceeds vertex count.' );
			const indices = vertexCount <= 65535 ? Uint16Array.from( sourceIndices ) : Uint32Array.from( sourceIndices );
			if ( world.determinant() < 0 ) for ( let i = 0; i < indices.length; i += 3 ) {

				const tmp = indices[ i + 1 ]; indices[ i + 1 ] = indices[ i + 2 ]; indices[ i + 2 ] = tmp;

			}
			geometry.setIndex( new BufferAttribute( indices, 1 ) );
			geometry.applyMatrix4( world );
			if ( ! geometry.attributes.normal ) geometry.computeVertexNormals();
			for ( const p of geometry.attributes.position.array ) if ( ! Number.isFinite( p ) ) throw new Error( 'Non-finite GLB position.' );
			geometry.computeBoundingBox();
			bounds.union( geometry.boundingBox );
			triangles += indices.length / 3;
			parts.push( { name: n.name, geometry, materialIndex: primitive.material } );

		}
		for ( const child of n.children ) visit( child, world );

	};
	for ( const root of gltf.roots ) visit( root, new Matrix4() );
	if ( ! parts.length ) throw new Error( 'Empty waterfront GLB.' );
	return { parts, bounds, triangles };

}

function floatAttribute( attribute ) {

	const src = new BufferAttribute( attribute.array, attribute.itemSize, attribute.normalized );
	const values = new Float32Array( src.count * src.itemSize );
	for ( let i = 0; i < src.count; i ++ ) for ( let c = 0; c < src.itemSize; c ++ ) values[ i * src.itemSize + c ] = src.getComponent( i, c );
	return new BufferAttribute( values, src.itemSize );

}

export async function loadStaticAsset( url, { id, maxTriangles = 6000, maxTextureSize = 1024 } ) {

	const gltf = await loadGLB( url );
	const asset = staticGeometry( gltf );
	const materials = new Map(), textures = new Map();
	asset.id = id;
	asset.textures = textures;
	asset.materials = materials;
	asset.dispose = () => {

		for ( const part of asset.parts ) part.geometry.dispose();
		for ( const material of materials.values() ) material.dispose();
		for ( const texture of textures.values() ) texture.destroy();

	};
	try {

		if ( asset.triangles > maxTriangles ) throw new Error( id + ': triangle budget exceeded.' );
		// A bottom-centred pivot gives consistent placement regardless of Meshy's export origin.
		const center = asset.bounds.getCenter( new Vector3() );
		asset.size = asset.bounds.getSize( new Vector3() );
		if ( Math.min( asset.size.x, asset.size.y, asset.size.z ) <= 0 ) throw new Error( id + ': degenerate bounds.' );
		const offset = new Vector3( - center.x, - asset.bounds.min.y, - center.z );
		for ( const part of asset.parts ) {

			part.geometry.translate( offset.x, offset.y, offset.z );
			part.geometry.computeBoundingSphere();
			if ( ! materials.has( part.materialIndex ) ) {

				const source = gltf.materials[ part.materialIndex ] || {};
				const pbr = source.pbrMetallicRoughness || {};
				if ( source.alphaMode === 'BLEND' ) throw new Error( id + ': use opaque or alpha-cutout materials.' );
				if ( materials.size >= 4 ) throw new Error( id + ': material budget exceeded.' );
				let texture;
				if ( pbr.baseColorTexture ) {

					if ( ! part.geometry.attributes.uv ) throw new Error( id + ': textured geometry needs UV0.' );
					if ( ( pbr.baseColorTexture.texCoord || 0 ) !== 0 ) throw new Error( id + ': only UV0 is supported.' );
					const imageIndex = gltf.textures[ pbr.baseColorTexture.index ].source;
					if ( ! textures.has( imageIndex ) ) {

						const image = gltf.images[ imageIndex ];
						if ( ! image || ! image.bytes ) throw new Error( id + ': textures must be embedded.' );
						const px = await decodeImage( image.bytes, image.mimeType );
						if ( Math.max( px.width, px.height ) > maxTextureSize ) throw new Error( id + ': texture budget exceeded.' );
						const map = new Texture( { label: id + '-base-color', width: px.width, height: px.height,
							format: 'rgba8unorm-srgb', data: px.data, mips: true, sampler: 'linearRepeat' } );
						textures.set( imageIndex, map );
						map.getGPU();
						generateMipmaps( map );

					}
					texture = textures.get( imageIndex );

				}
				const factor = pbr.baseColorFactor || [ 1, 1, 1, 1 ];
				materials.set( part.materialIndex, new Material( {
					name: 'bermuda-' + id + '-' + ( part.materialIndex ?? 0 ),
					color: new Color( factor[ 0 ], factor[ 1 ], factor[ 2 ] ),
					roughness: Math.max( 0.75, pbr.roughnessFactor ?? 0.9 ), metalness: 0,
					side: source.doubleSided ? 'double' : 'front',
					alphaTest: source.alphaMode === 'MASK' ? ( source.alphaCutoff ?? 0.5 ) : 0,
					opacity: factor[ 3 ], receiveShadows: false, underwaterLighting: 'lite', localLightsCheap: true,
					textures: texture ? { bermudaAlbedo: texture } : {},
					surface: texture ? 'let c = textureSample( bermudaAlbedo, smpLinearRepeat, in.uv ); s.albedo *= c.rgb; s.alpha *= c.a;' : '',
				} ) );

			}
			part.material = materials.get( part.materialIndex );

		}
		asset.bounds.translate( offset );
		return asset;

	} catch ( error ) {

		asset.dispose();
		throw error;

	}

}

export function placeStaticAsset( asset, placements ) {

	const group = new Group();
	group.name = 'Bermuda-' + asset.id;
	const matrix = new Matrix4(), rotation = new Quaternion(), position = new Vector3(), scale = new Vector3();
	for ( const part of asset.parts ) {

		const mesh = placements.length > 1 ? new InstancedMesh( part.geometry, part.material, placements.length ) : new Mesh( part.geometry, part.material );
		mesh.name = group.name + '-' + part.name;
		mesh.castShadow = false;
		mesh.receiveShadow = false;
		placements.forEach( ( p, i ) => {

			position.set( p.x, p.y, p.z );
			rotation.setFromAxisAngle( new Vector3( 0, 1, 0 ), p.yaw || 0 );
			scale.setScalar( p.scale || 1 );
			if ( mesh.isInstancedMesh ) mesh.setMatrixAt( i, matrix.compose( position, rotation, scale ) );
			else { mesh.position.copy( position ); mesh.quaternion.copy( rotation ); mesh.scale.copy( scale ); }

		} );
		if ( mesh.isInstancedMesh ) { mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere(); }
		group.add( mesh );

	}
	return group;

}
