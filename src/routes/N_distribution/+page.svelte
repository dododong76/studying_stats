<script>
	import { onDestroy, onMount } from 'svelte';
	import { page } from '$app/state';
	import { onValue, ref } from 'firebase/database';
	import { PhoneQrFrame, NormalCurveSvg } from '$lib';
	import { db, missingEnvKeys } from '$lib/firebase';

	/**
	 * @typedef {{
	 *   id: string,
	 *   playerName: string,
	 *   mean: number,
	 *   variance: number,
	 *   n?: number,
	 *   p?: number,
	 *   createdAt: number
	 * }} NormalEvent
	 */

	/** @type {import('firebase/database').Database | null} */
	const firebaseDb = db;

	let sessionId = $state(page.url.searchParams.get('session') ?? '');
	let studentLink = $state('');
	let studentUrl = $state('');
	/** @type {NormalEvent[]} */
	let events = $state([]);
	let errorMessage = $state('');

	/** @type {null | (() => void)} */
	let unsubscribe = null;

	function generateSessionId() {
		if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
		return `sess_${Math.random().toString(36).slice(2)}_${Date.now()}`;
	}

	/**
	 * @param {number} n
	 */
	function fmtNum(n) {
		if (!Number.isFinite(n)) return '—';
		const abs = Math.abs(n);
		const digits = abs >= 100 || abs < 0.01 ? 4 : abs >= 10 ? 3 : 2;
		return Number(n.toFixed(digits)).toString();
	}

	/**
	 * @param {unknown} v
	 */
	function toFiniteNumber(v) {
		const n = typeof v === 'number' ? v : Number(v);
		return Number.isFinite(n) ? n : NaN;
	}

	/**
	 * @param {NormalEvent} ev
	 */
	function formatFormula(ev) {
		if (ev.n !== undefined && ev.p !== undefined) {
			return `B(${fmtNum(ev.n)}, ${fmtNum(ev.p)})`;
		}
		return `N(${fmtNum(ev.mean)}, ${fmtNum(ev.variance)})`;
	}

	/**
	 * @param {Record<string, any> | null} raw
	 */
	function hydrateFromEvents(raw) {
		/** @type {NormalEvent[]} */
		const next = [];

		if (raw) {
			for (const [firebaseKey, value] of Object.entries(raw)) {
				if (!value || typeof value !== 'object') continue;
				const mean = toFiniteNumber(value.mean);
				const variance = toFiniteNumber(value.variance);
				const nRaw = value.n;
				const pRaw = value.p;
				const n = nRaw !== undefined && nRaw !== null ? Number(nRaw) : NaN;
				const p = pRaw !== undefined && pRaw !== null ? Number(pRaw) : NaN;
				const createdAt = Number(value.createdAt ?? 0);
				const playerName = String(value.playerName ?? '학생');

				next.push({
					id: firebaseKey,
					playerName,
					mean: Number.isFinite(mean) ? mean : 0,
					variance: Number.isFinite(variance) ? variance : 1,
					n: Number.isFinite(n) ? n : undefined,
					p: Number.isFinite(p) ? p : undefined,
					createdAt: Number.isFinite(createdAt) ? createdAt : 0
				});
			}
		}

		// 최신 전송이 맨 위로 오도록 내림차순 정렬
		next.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
		events = next.slice(0, 300);
	}

	onMount(() => {
		events = [];
		errorMessage = '';

		if (!sessionId) {
			sessionId = generateSessionId();
			const url = new URL(window.location.href);
			url.searchParams.set('session', sessionId);
			window.history.replaceState({}, '', url.toString());
		}

		studentLink = `/N_distribution/students?session=${encodeURIComponent(sessionId)}`;
		studentUrl = new URL(studentLink, window.location.origin).toString();

		if (!firebaseDb) {
			const suffix = missingEnvKeys?.length ? ` (누락: ${missingEnvKeys.join(', ')})` : '';
			errorMessage = `Firebase 설정(VITE_FIREBASE_*)이 필요합니다.${suffix}`;
			return;
		}

		const eventsRef = ref(firebaseDb, `nDistributionSessions/${sessionId}/events`);
		unsubscribe = onValue(
			eventsRef,
			(snapshot) => {
				errorMessage = '';
				hydrateFromEvents(snapshot.val());
			},
			(err) => {
				const message = err instanceof Error ? err.message : String(err);
				errorMessage = `실시간 구독 실패: ${message}`;
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
			<h1>정규분포 그려보기</h1>
			<p>고등학교 확률과 통계: 정규분포 N(μ, σ²)의 모양 확인</p>
		</div>

		<div class="cards-wrap">
			{#if events.length === 0}
				<div class="empty-cards">아직 학생이 전송한 그래프가 없습니다.</div>
			{:else}
				<div class="cards-grid">
					{#each events as ev (ev.id)}
						<article class="ndist-card">
							<div class="ndist-card__chart">
								{#key `${ev.id}-${ev.mean}-${ev.variance}`}
									<NormalCurveSvg mean={ev.mean} variance={ev.variance} width={260} height={120} />
								{/key}
							</div>
							<div class="ndist-card__meta">
								<span class="ndist-card__name">{ev.playerName}</span>
								<span class="ndist-card__formula">{formatFormula(ev)}</span>
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
			class="ndist-phone-qr"
			participateUrl={studentUrl || studentLink}
			emptySummaryText="아직 전송된 내역이 없습니다."
			qrPixelSize={280}
		>
			{#snippet feed()}
				{#if events.length === 0}
					<p class="ndist-feed-empty">아직 전송된 그래프가 없습니다.</p>
				{:else}
					<ul class="ndist-phone-list">
						{#each events as ev (ev.id)}
							<li class="ndist-phone-item">
								<p class="ndist-phone-item__submit-msg">{ev.playerName}가 제출했습니다.</p>
							</li>
						{/each}
					</ul>
				{/if}
			{/snippet}
		</PhoneQrFrame>

		{#if errorMessage}
			<div class="error">{errorMessage}</div>
		{/if}
	</div>
</section>

<style>
	.teacher-lab {
		display: grid;
		grid-template-columns: 3fr 2.25fr;
		gap: 16px;
		min-height: calc(100vh - 160px);
	}

	.left-panel {
		background-color: #ffffff;
		border: 1px solid #dbeafe;
		border-radius: 14px;
		padding: 16px;
		height: 85%;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		min-height: 0;
	}

	h1 {
		margin: 0;
		font-size: 1.2rem;
	}

	.panel-header p {
		margin: 8px 0 12px;
		color: #475569;
		font-size: 0.92rem;
	}

	.cards-wrap {
		flex: 1 1 auto;
		min-height: 0;
		overflow: auto;
		border-radius: 10px;
		border: 1px solid #e2e8f0;
		background: #f8fafc;
		padding: 12px;
	}

	.empty-cards {
		padding: 28px 16px;
		text-align: center;
		color: #64748b;
		font-size: 0.95rem;
	}

	.cards-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
		gap: 12px;
	}

	.ndist-card {
		background: #ffffff;
		border: 1px solid #e2e8f0;
		border-radius: 12px;
		padding: 10px 10px 8px;
		box-shadow: 0 4px 12px rgba(15, 23, 42, 0.06);
	}

	.ndist-card__chart {
		border-radius: 8px;
		background: linear-gradient(180deg, #f8fafc 0%, #ffffff 100%);
		padding: 4px 2px 0;
	}

	.ndist-card__meta {
		display: flex;
		flex-direction: column;
		gap: 2px;
		margin-top: 8px;
		font-size: 0.82rem;
		color: #334155;
	}

	.ndist-card__name {
		font-weight: 700;
	}

	.ndist-card__formula {
		font-variant-numeric: tabular-nums;
		color: #475569;
	}

	.right-panel {
		display: flex;
		flex-direction: column;
		align-items: stretch;
		justify-content: flex-start;
		align-self: start;
		min-height: 0;
		min-width: 0;
		box-sizing: border-box;
		padding: 0;
		background: transparent;
		border: none;
	}

	:global(.ndist-phone-qr) {
		--phone-screen-top: 7.5%;
		--phone-screen-left: 6.5%;
		--phone-screen-right: 6.5%;
		--phone-screen-bottom: 9.5%;
		--phone-fill-max-height: min(calc(100vh - 200px), 920px);
		--phone-feed-max-height: min(38vh, 20rem);
	}

	.ndist-phone-list {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.ndist-phone-item {
		border-radius: 8px;
		border: 1px solid #e2e8f0;
		background: #ffffff;
		padding: 0.55rem 0.65rem;
	}

	.ndist-phone-item__submit-msg {
		margin: 0;
		font-size: 0.78rem;
		line-height: 1.4;
		color: #0f172a;
		font-weight: 600;
	}

	.ndist-feed-empty {
		margin: 0;
		font-size: 0.78rem;
		line-height: 1.45;
		color: #64748b;
	}

	.error {
		flex: 0 0 auto;
		border-radius: 12px;
		padding: 10px 12px;
		border: 1px solid rgba(185, 28, 28, 0.25);
		background: rgba(185, 28, 28, 0.08);
		color: #b91c1c;
		font-weight: 700;
		width: 100%;
		box-sizing: border-box;
	}

	@media (max-width: 920px) {
		.teacher-lab {
			grid-template-columns: 1fr;
		}
	}
</style>
