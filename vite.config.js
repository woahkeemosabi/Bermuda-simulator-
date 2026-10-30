import { defineConfig } from 'vite';

export default defineConfig( {
	define: { __BERMUDA_QA_COMMIT__: JSON.stringify(process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || null) },
	// relative asset paths: the build runs from any sub-path (GitHub Pages serves it under /tidewater/)
	base: './',
	build: { target: 'esnext', chunkSizeWarningLimit: 4000 },
	server: { port: 5188, strictPort: true, host: '127.0.0.1' },
} );
