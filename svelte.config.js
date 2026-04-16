import adapter from '@sveltejs/adapter-static';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
	},
	kit: {
		// Netlify 정적 배포를 위해 adapter-static을 사용합니다.
		adapter: adapter({
			pages: 'build',
			assets: 'build',
			// 프리렌더가 불가능한 동적 라우트가 있을 때 `index.html`을 fallback으로 사용합니다.
			// (예: /dice, /N_distribution 같은 route가 prerender 대상으로 감지되지 않는 경우)
			fallback: 'index.html'
		})
	}
};

export default config;
