<script>
	import { onDestroy, onMount } from 'svelte';
	import { page } from '$app/state';
	import { onValue, ref } from 'firebase/database';
	import { PhoneQrFrame } from '$lib';
	import { db, missingEnvKeys } from '$lib/firebase';

	const sumMin = 10;
	const sumMax = 60;
	const sums = Array.from({ length: sumMax - sumMin + 1 }, (_, i) => i + sumMin);

	/**
	 * @typedef {{ id: string, text: string }} ChatMessage
	 * @typedef {{
	 *   id: string,
	 *   playerName: string,
	 *   rollCount: number,
	 *   lastSum: number,
	 *   rolls?: number[],
	 *   createdAt: number
	 * }} Dice10Event
	 * @type {import('firebase/database').Database | null}
	 */
	const firebaseDb = db;

	let sessionId = $state(page.url.searchParams.get('session') ?? '');
	let studentLink = $state('');
	let studentUrl = $state('');
	/** @type {Record<number, number>} */
	let counts = $state(Object.fromEntries(sums.map((s) => [s, 0])));
	let totalRolls = $state(0);
	/** @type {ChatMessage[]} */
	let messages = $state([]);
	/** @type {Dice10Event[]} */
	let events = $state([]);
	let errorMessage = $state('');

	/** @type {null | (() => void)} */
	let unsubscribe = null;

	let rawMaxCount = $derived(Math.max(0, ...Object.values(counts)));
	let chartScaleMax = $derived(rawMaxCount > 8 ? rawMaxCount : 8);
	const maxChatLines = 6;

	let chatSummaryLines = $derived(messages.map((m) => m.text));

	function generateSessionId() {
		if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
		return `sess_${Math.random().toString(36).slice(2)}_${Date.now()}`;
	}

	/**
	 * @param {unknown} raw
	 * @returns {number[]}
	 */
	function normalizeRolls(raw) {
		if (!Array.isArray(raw)) return [];
		/** @type {number[]} */
		const out = [];
		for (const item of raw) {
			const n = Number(item);
			if (Number.isFinite(n)) out.push(n);
		}
		return out;
	}

	/**
	 * @param {any} ev
	 * @returns {number | null}
	 */
	function resolveTenDiceSum(ev) {
		if (!ev) return null;
		const rolls = normalizeRolls(ev.rolls);
		if (rolls.length === 10 && rolls.every((v) => v >= 1 && v <= 6)) {
			return rolls.reduce((a, b) => a + b, 0);
		}
		const s = Number(ev.lastSum);
		if (Number.isFinite(s) && s >= sumMin && s <= sumMax) return s;
		return null;
	}

	/**
	 * @param {Record<string, any> | null} raw
	 */
	function hydrateFromEvents(raw) {
		const nextCounts = Object.fromEntries(sums.map((s) => [s, 0]));
		let nextTotal = 0;
		/** @type {Dice10Event[]} */
		let nextEvents = [];
		/** @type {ChatMessage[]} */
		let nextMessages = [];

		if (raw) {
			for (const value of Object.values(raw)) {
				if (!value) continue;

				const sumVal = resolveTenDiceSum(value);
				if (sumVal === null) continue;

				nextCounts[sumVal] += 1;

				const rollCount = Number(value.rollCount ?? 0);
				if (Number.isFinite(rollCount) && rollCount > 0) nextTotal += rollCount;

				const playerName = String(value.playerName ?? '동물');
				const createdAt = Number(value.createdAt ?? 0);
				const id = createdAt ? String(createdAt) : String(Math.random());

				const rolls = normalizeRolls(value.rolls);

				nextEvents.push({
					id,
					playerName,
					rollCount: Number.isFinite(rollCount) ? rollCount : 10,
					lastSum: sumVal,
					rolls,
					createdAt: Number.isFinite(createdAt) ? createdAt : 0
				});

				nextMessages.push({
					id,
					text: `${playerName}이(가) 주사위 10개 굴려서 합 ${sumVal}`
				});
			}
		}

		nextEvents.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
		nextMessages.sort((a, b) => Number(a.id) - Number(b.id));

		counts = nextCounts;
		totalRolls = nextTotal;
		events = nextEvents.slice(-300);
		messages = nextMessages.slice(-maxChatLines);
	}

	onMount(() => {
		counts = Object.fromEntries(sums.map((s) => [s, 0]));
		totalRolls = 0;
		messages = [];
		events = [];
		errorMessage = '';

		if (!sessionId) {
			sessionId = generateSessionId();
			const url = new URL(window.location.href);
			url.searchParams.set('session', sessionId);
			window.history.replaceState({}, '', url.toString());
		}

		studentLink = `/dice10/students?session=${encodeURIComponent(sessionId)}`;
		studentUrl = new URL(studentLink, window.location.origin).toString();

		if (!firebaseDb) {
			const suffix = missingEnvKeys?.length ? ` (누락: ${missingEnvKeys.join(', ')})` : '';
			errorMessage = `Firebase 설정(VITE_FIREBASE_*)이 필요합니다.${suffix}`;
			return;
		}

		const eventsRef = ref(firebaseDb, `dice10Sessions/${sessionId}/events`);
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
			<h1>주사위 10개 · 합의 분포</h1>
			<p>고등학교 확률과 통계: 주사위 10개를 한 번에 굴려 합(10~60)의 상대도수를 확인합니다.</p>
		</div>

		<div class="chart-scroll">
			<div class="chart">
				{#each sums as sum}
					<div class="bar-row">
						<div
							class={`sum-chip ${sum % 10 === 0 ? '' : 'sum-chip--muted'}`}
							aria-label={sum % 10 === 0 ? `합 ${sum}` : undefined}
						>
							{sum % 10 === 0 ? sum : ''}
						</div>
						<div class="bar-track">
							<div class="bar-fill" style={`height: ${(counts[sum] / chartScaleMax) * 100}%`}></div>
						</div>
						<div class="value">{counts[sum]}</div>
					</div>
				{/each}
			</div>
		</div>

		<div class="stats">
			<div class="stats-top">주사위 10개를 한번에 굴린 횟수: <strong>{totalRolls/10}</strong></div>
		</div>
	</div>

	<div class="right-panel">
		<PhoneQrFrame
			fill
			class="dice10-phone-qr"
			participateUrl={studentUrl || studentLink}
			summaries={chatSummaryLines}
			qrPixelSize={280}
			emptySummaryText="아직 전송된 내역이 없습니다."
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
		background-color: #ffffff;
		border: 1px solid #dbeafe;
		border-radius: 14px;
		padding: 16px;
		height: 85%;
		box-sizing: border-box;
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

	.chart-scroll {
		overflow-x: auto;
		border-radius: 10px;
		border: 1px solid #e2e8f0;
		background-color: #f8fafc;
	}

	.chart {
		display: grid;
		grid-template-columns: repeat(51, minmax(12px, 16px));
		gap: 1.33px;
		padding: 10px 10px 8px;
		min-width: min(100%, 920px);
		margin: 0 auto;
		min-height: 380px;
	}

	.bar-row {
		display: grid;
		grid-template-rows: auto 1fr auto;
		align-items: end;
		gap: 2px;
	}

	.sum-chip {
		margin: 0 auto;
		min-width: 22px;
		padding: 2px 3px;
		border-radius: 5px;
		background: linear-gradient(145deg, #ffffff 0%, #f1f5f9 100%);
		border: 1px solid #dbe7ff;
		font-size: 0.58rem;
		font-weight: 800;
		color: #1e293b;
		text-align: center;
		line-height: 1.1;
	}

	.sum-chip--muted {
		background: transparent;
		border-color: transparent;
	}

	.value {
		text-align: center;
		font-size: 0.65rem;
		color: #1e293b;
	}

	.bar-track {
		height: 280px;
		border-radius: 6px;
		background-color: #e0e7ff;
		display: flex;
		align-items: flex-end;
		padding: 2px;
	}

	.bar-fill {
		width: 100%;
		border-radius: 4px;
		background: linear-gradient(180deg, #6366f1 0%, #4338ca 100%);
		transition: height 0.25s ease;
		min-height: 2px;
	}

	.stats {
		margin-top: 12px;
		padding: 12px;
		border-radius: 10px;
		background-color: #f1f5f9;
	}

	.stats-top {
		margin-bottom: 0;
		font-size: 0.92rem;
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

	:global(.dice10-phone-qr) {
		--phone-screen-top: 7.5%;
		--phone-screen-left: 6.5%;
		--phone-screen-right: 6.5%;
		--phone-screen-bottom: 9.5%;
		--phone-fill-max-height: min(calc(100vh - 200px), 920px);
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
