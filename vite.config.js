import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// These are source/reference assets kept in the repository for provenance and future re-processing.
// Runtime code uses mobile-v2/mobile-v3 plus explicit hero/street-life desktop/mobile tiers instead.
// Keeping source-only variants out of dist prevents accidental browser fetches and cuts the Pages
// artifact without deleting originals or touching LICENSE/CREDITS files.
const SOURCE_ONLY_RUNTIME_EXCLUDES = [
	'models/bermuda/bermuda-boathouse.glb',
	'models/bermuda/bermuda-dock.glb',
	'models/bermuda/bermuda-house-a.glb',
	'models/bermuda/bermuda-house-b.glb',
	'models/bermuda/expansion',
	'models/bermuda/mobile',
	'models/bermuda/characters',
	'models/bermuda/mobile-v3/previews',
];

function pruneSourceOnlyRuntimeAssets() {
	return {
		name: 'bermuda-runtime-asset-prune',
		apply: 'build',
		async closeBundle() {
			const dist = resolve( process.cwd(), 'dist' );
			await Promise.all( SOURCE_ONLY_RUNTIME_EXCLUDES.map( async ( relativePath ) => {
				await rm( resolve( dist, relativePath ), { recursive: true, force: true } );
			} ) );
		},
	};
}

export default defineConfig( {
	// relative asset paths: the build runs from any sub-path (GitHub Pages serves it under /tidewater/)
	base: './',
	plugins: [ pruneSourceOnlyRuntimeAssets() ],
	build: { target: 'esnext', chunkSizeWarningLimit: 4000 },
	server: { port: 5188, strictPort: true, host: '127.0.0.1' },
} );
