<script>
	import { onDestroy, onMount } from 'svelte';
	import { page } from '$app/state';
	import { onValue, ref } from 'firebase/database';
	import { PhoneQrFrame } from '$lib';
	import { db, missingEnvKeys } from '$lib/firebase';

	/** @typedef {{ x: number, y: number }} Point */

	/**
	 * @typedef {{
	 *   id: string,
	 *   playerName: string,
	 *   point: Point,
	 *   createdAt: number
	 * }} RegressionEvent
	 */

	/** @type {import('firebase/database').Database | null} */
	const firebaseDb = db;

	let sessionId = $state(page.url.searchParams.get('session') ?? '');
	let studentLink = $state('');
	let studentUrl = $state('');
	/** @type {Point[]} */
	let points = $state([]);
	/** @type {RegressionEvent[]} */
	let events = $state([]);
	/** @type {{ id: string, text: string }[]} */
	let messages = $state([]);
	let errorMessage = $state('');

	/** @type {null | (() => void)} */
	let unsubscribe = null;
	const maxChatLines = 6;

	let chatSummaryLines = $derived(messages.map((m) => m.text));
	let lineParams = $derived(calculateRegression(points));
	const xMin = 200;
	const xMax = 320;
	const yMin = 130;
	const yMax = 200;
	const plotLeft = 15;
	const plotRight = 93;
	const plotTop = 8;
	const plotBottom = 90;
	const xTicks = Array.from({ length: (xMax - xMin) / 10 + 1 }, (_, i) => xMin + i * 10);
	const yTicks = Array.from({ length: (yMax - yMin) / 10 + 1 }, (_, i) => yMin + i * 10);

	function generateSessionId() {
		if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
		return `sess_${Math.random().toString(36).slice(2)}_${Date.now()}`;
	}

	/**
	 * @param {Point[]} src
	 * @returns {{ slope: number, intercept: number } | null}
	 */
	function calculateRegression(src) {
		if (src.length < 2) return null;
		const n = src.length;
		let sumX = 0;
		let sumY = 0;
		let sumXY = 0;
		let sumXX = 0;
		for (const p of src) {
			sumX += p.x;
			sumY += p.y;
			sumXY += p.x * p.y;
			sumXX += p.x * p.x;
		}
		const denominator = n * sumXX - sumX * sumX;
		if (denominator === 0) return null;
		const slope = (n * sumXY - sumX * sumY) / denominator;
		const intercept = (sumY - slope * sumX) / n;
		return { slope, intercept };
	}

	/**
	 * @param {Record<string, any> | null} raw
	 */
	function hydrateFromEvents(raw) {
		/** @type {RegressionEvent[]} */
		const nextEvents = [];
		/** @type {Point[]} */
		const nextPoints = [];
		/** @type {{ id: string, text: string }[]} */
		const nextMessages = [];

		if (raw) {
			for (const value of Object.values(raw)) {
				if (!value) continue;
				const x = Number(value?.point?.x);
				const y = Number(value?.point?.y);
				if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
				const playerName = String(value.playerName ?? '학생');
				const createdAt = Number(value.createdAt ?? 0);
				const id = createdAt ? String(createdAt) : String(Math.random());
				const point = { x, y };
				nextPoints.push(point);
				nextEvents.push({ id, playerName, point, createdAt: Number.isFinite(createdAt) ? createdAt : 0 });
				nextMessages.push({
					id,
					text: `${playerName}: 발 ${x.toFixed(1)}, 키 ${y.toFixed(1)}`
				});
			}
		}

		nextEvents.sort((a, b) => a.createdAt - b.createdAt);
		nextMessages.sort((a, b) => Number(a.id) - Number(b.id));
		points = nextEvents.map((e) => e.point);
		events = nextEvents.slice(-500);
		messages = nextMessages.slice(-maxChatLines);
	}

	/**
	 * @param {number} x
	 */
	function toSvgX(x) {
		return plotLeft + ((x - xMin) / (xMax - xMin)) * (plotRight - plotLeft);
	}

	/**
	 * @param {number} y
	 */
	function toSvgY(y) {
		return plotBottom - ((y - yMin) / (yMax - yMin)) * (plotBottom - plotTop);
	}

	onMount(() => {
		points = [];
		events = [];
		messages = [];
		errorMessage = '';

		if (!sessionId) {
			sessionId = generateSessionId();
			const url = new URL(window.location.href);
			url.searchParams.set('session', sessionId);
			window.history.replaceState({}, '', url.toString());
		}

		studentLink = `/RegressionLine/students?session=${encodeURIComponent(sessionId)}`;
		studentUrl = new URL(studentLink, window.location.origin).toString();

		if (!firebaseDb) {
			const suffix = missingEnvKeys?.length ? ` (누락: ${missingEnvKeys.join(', ')})` : '';
			errorMessage = `Firebase 설정(VITE_FIREBASE_*)이 필요합니다.${suffix}`;
			return;
		}

		const eventsRef = ref(firebaseDb, `regressionSessions/${sessionId}/events`);
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
			<h1>회귀직선 실험</h1>
			<p>발사이즈(X), 키(Y) 데이터가 누적되면 산점도와 회귀직선을 실시간으로 확인합니다.</p>
		</div>

		<div class="plot-wrap">
			<div class="axis-top-label">Y(키)</div>
			<svg viewBox="0 0 100 100" class="plot" role="img" aria-label="회귀 산점도">
				<g class="grid">
					{#each xTicks as tick}
						<line x1={toSvgX(tick)} y1={plotTop} x2={toSvgX(tick)} y2={plotBottom}></line>
					{/each}
					{#each yTicks as tick}
						<line x1={plotLeft} y1={toSvgY(tick)} x2={plotRight} y2={toSvgY(tick)}></line>
					{/each}
				</g>
				<line class="axis" x1={plotLeft} y1={plotBottom} x2={plotRight} y2={plotBottom}></line>
				<line class="axis" x1={plotLeft} y1={plotTop} x2={plotLeft} y2={plotBottom}></line>

				{#each xTicks as tick}
					<text class="tick-label tick-label--x" x={toSvgX(tick)} y={plotBottom + 4.6} text-anchor="middle">
						{tick}
					</text>
				{/each}
				{#each yTicks as tick}
					<text class="tick-label tick-label--y" x={plotLeft - 1.6} y={toSvgY(tick) + 0.7} text-anchor="end">
						{tick}
					</text>
				{/each}

				{#if lineParams}
					{@const yAtXMin = lineParams.slope * xMin + lineParams.intercept}
					{@const yAtXMax = lineParams.slope * xMax + lineParams.intercept}
					<line
						class="regression-line"
						x1={toSvgX(xMin)}
						y1={toSvgY(Math.max(yMin, Math.min(yMax, yAtXMin)))}
						x2={toSvgX(xMax)}
						y2={toSvgY(Math.max(yMin, Math.min(yMax, yAtXMax)))}
					></line>
				{/if}

				{#each points as p}
					<circle class="point" cx={toSvgX(p.x)} cy={toSvgY(p.y)} r="1.6"></circle>
				{/each}
			</svg>
			<div class="axis-bottom-label">X(발사이즈)</div>
		</div>
	</div>

	<div class="right-panel">
		<PhoneQrFrame
			fill
			class="regression-phone-qr"
			participateUrl={studentUrl || studentLink}
			summaries={chatSummaryLines}
			qrPixelSize={280}
			emptySummaryText="아직 전송된 좌표가 없습니다."
		/>
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
		background: #ffffff;
		border: 1px solid #dbeafe;
		border-radius: 14px;
		padding: 16px;
		height: 85%;
		box-sizing: border-box;
	}

	.panel-header h1 {
		margin: 0;
		font-size: 1.2rem;
	}

	.panel-header p {
		margin: 8px 0 12px;
		color: #475569;
		font-size: 0.92rem;
	}

	.plot-wrap {
		background: #f8fafc;
		border: 1px solid #e2e8f0;
		border-radius: 10px;
		padding: 10px;
	}

	.plot {
		width: 100%;
		height: 500px;
		background: #ffffff;
		border-radius: 8px;
	}

	.grid line {
		stroke: #e2e8f0;
		stroke-width: 0.35;
	}

	.axis {
		stroke: #475569;
		stroke-width: 0.65;
	}

	.point {
		fill: #4f46e5;
		opacity: 0.9;
	}

	.regression-line {
		stroke: #ef4444;
		stroke-width: 1.1;
	}

	.tick-label {
		fill: #334155;
		font-size: 2.15px;
		font-weight: 600;
	}

	.tick-label--x {
		fill: #1e3a8a;
	}

	.tick-label--y {
		fill: #334155;
	}

	.axis-top-label {
		text-align: left;
		font-size: 0.88rem;
		font-weight: 700;
		color: #334155;
		margin: 0 2px 8px;
	}

	.axis-bottom-label {
		text-align: right;
		font-size: 0.88rem;
		font-weight: 700;
		color: #334155;
		margin: 8px 2px 0;
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
	}

	:global(.regression-phone-qr) {
		--phone-screen-top: 7.5%;
		--phone-screen-left: 6.5%;
		--phone-screen-right: 6.5%;
		--phone-screen-bottom: 9.5%;
		--phone-fill-max-height: min(calc(100vh - 200px), 920px);
	}

	.error {
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
