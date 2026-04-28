<script>
	import { onDestroy, onMount } from 'svelte';
	import { page } from '$app/state';
	import { onValue, ref } from 'firebase/database';
	import { PhoneQrFrame } from '$lib';
	import { db, missingEnvKeys } from '$lib/firebase';

	/**
	 * @typedef {{
	 *   id: string,
	 *   playerName: string,
	 *   ballCount: number,
	 *   rows: number,
	 *   bins: number[],
	 *   imageDataUrl?: string,
	 *   createdAt: number
	 * }} GaltonEvent
	 */

	/** @type {import('firebase/database').Database | null} */
	const firebaseDb = db;

	let sessionId = $state(page.url.searchParams.get('session') ?? '');
	let studentLink = $state('');
	let studentUrl = $state('');
	/** @type {GaltonEvent[]} */
	let events = $state([]);
	let errorMessage = $state('');
	/** @type {null | (() => void)} */
	let unsubscribe = null;

	function generateSessionId() {
		if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
		return `sess_${Math.random().toString(36).slice(2)}_${Date.now()}`;
	}

	/**
	 * @param {Record<string, any> | null} raw
	 */
	function hydrate(raw) {
		/** @type {GaltonEvent[]} */
		const next = [];
		if (raw) {
			for (const [id, value] of Object.entries(raw)) {
				if (!value || typeof value !== 'object') continue;
				next.push({
					id,
					playerName: String(value.playerName ?? '학생'),
					ballCount: Number(value.ballCount ?? 0) || 0,
					rows: Number(value.rows ?? 0) || 0,
					bins: Array.isArray(value.bins) ? value.bins.map((v) => Number(v) || 0) : [],
					imageDataUrl: typeof value.imageDataUrl === 'string' ? value.imageDataUrl : undefined,
					createdAt: Number(value.createdAt ?? 0) || 0
				});
			}
		}
		next.sort((a, b) => b.createdAt - a.createdAt);
		events = next.slice(0, 240);
	}

	onMount(() => {
		if (!sessionId) {
			sessionId = generateSessionId();
			const url = new URL(window.location.href);
			url.searchParams.set('session', sessionId);
			window.history.replaceState({}, '', url.toString());
		}

		studentLink = `/galton/students?session=${encodeURIComponent(sessionId)}`;
		studentUrl = new URL(studentLink, window.location.origin).toString();

		if (!firebaseDb) {
			const suffix = missingEnvKeys?.length ? ` (누락: ${missingEnvKeys.join(', ')})` : '';
			errorMessage = `Firebase 설정(VITE_FIREBASE_*)이 필요합니다.${suffix}`;
			return;
		}

		const eventsRef = ref(firebaseDb, `galtonSessions/${sessionId}/events`);
		unsubscribe = onValue(
			eventsRef,
			(snapshot) => {
				errorMessage = '';
				hydrate(snapshot.val());
			},
			(err) => {
				errorMessage = `실시간 구독 실패: ${err instanceof Error ? err.message : String(err)}`;
			}
		);
	});

	onDestroy(() => {
		unsubscribe?.();
	});
</script>

<section class="teacher-lab">
	<div class="left-panel">
		<div class="panel-header">
			<h1>갈톤 보드 (이항분포)</h1>
			<p>학생들이 전송한 갈톤 보드 결과를 확인합니다.</p>
		</div>

		<div class="cards-wrap">
			{#if events.length === 0}
				<div class="empty-cards">아직 전송된 결과가 없습니다.</div>
			{:else}
				<div class="cards-grid">
					{#each events as ev (ev.id)}
						<article class="galton-card">
							<div class="galton-card__preview">
								{#if ev.imageDataUrl}
									<img src={ev.imageDataUrl} alt="갈톤보드 캡처" loading="lazy" />
								{:else}
									<div class="fallback">캡처 없음</div>
								{/if}
							</div>
							<div class="galton-card__meta">
								<span class="name">{ev.playerName}</span>
								<span class="desc">구슬 {ev.ballCount}개 · 핀 {ev.rows}줄</span>
							</div>
						</article>
					{/each}
				</div>
			{/if}
		</div>
	</div>

	<div class="right-panel">
		<PhoneQrFrame
			fill
			class="galton-phone-qr"
			participateUrl={studentUrl || studentLink}
			emptySummaryText="아직 전송된 내역이 없습니다."
			qrPixelSize={280}
		/>
		{#if errorMessage}
			<div class="error">{errorMessage}</div>
		{/if}
	</div>
</section>

<style>
	.teacher-lab { display: grid; grid-template-columns: 3fr 2.25fr; gap: 16px; min-height: calc(100vh - 160px); }
	.left-panel { background: #fff; border: 1px solid #dbeafe; border-radius: 14px; padding: 16px; height: 85%; display: flex; flex-direction: column; min-height: 0; }
	h1 { margin: 0; font-size: 1.2rem; }
	.panel-header p { margin: 8px 0 12px; color: #475569; font-size: 0.92rem; }
	.cards-wrap { flex: 1 1 auto; min-height: 0; overflow: auto; border: 1px solid #e2e8f0; border-radius: 10px; background: #f8fafc; padding: 12px; }
	.empty-cards { padding: 28px 16px; text-align: center; color: #64748b; }
	.cards-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 12px; }
	.galton-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 10px; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.06); }
	.galton-card__preview { border-radius: 8px; overflow: hidden; border: 1px solid #dbeafe; aspect-ratio: 16 / 10; background: #020617; }
	.galton-card__preview img { width: 100%; height: 100%; object-fit: cover; display: block; }
	.fallback { width: 100%; height: 100%; display: grid; place-items: center; color: #94a3b8; font-size: 0.82rem; }
	.galton-card__meta { margin-top: 8px; display: flex; flex-direction: column; gap: 2px; font-size: 0.82rem; }
	.name { font-weight: 700; color: #0f172a; }
	.desc { color: #475569; }
	.right-panel { display: flex; flex-direction: column; align-items: stretch; min-width: 0; }
	:global(.galton-phone-qr) { --phone-fill-max-height: min(calc(100vh - 200px), 920px); }
	.error { margin-top: 10px; border-radius: 12px; padding: 10px 12px; border: 1px solid rgba(185, 28, 28, 0.25); background: rgba(185, 28, 28, 0.08); color: #b91c1c; font-weight: 700; }
	@media (max-width: 920px) { .teacher-lab { grid-template-columns: 1fr; } }
</style>
