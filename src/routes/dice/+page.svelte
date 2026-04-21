<script>
	import { onDestroy, onMount } from 'svelte';
	import { page } from '$app/state';
	import { onValue, ref } from 'firebase/database';
	import { PhoneQrFrame } from '$lib';
	import { db, missingEnvKeys } from '$lib/firebase';

	const faces = Array.from({ length: 6 }, (_, i) => i + 1);

	/**
	 * @typedef {{ id: string, text: string }} ChatMessage
	 * @typedef {{
	 *   id: string,
	 *   playerName: string,
	 *   rollCount: number,
	 *   lastSum: number,
	 *   rolls?: number[],
	 *   createdAt: number
	 * }} DiceEvent
	 * @type {import('firebase/database').Database | null}
	 */
	const firebaseDb = db;

	let sessionId = $state(page.url.searchParams.get('session') ?? '');
	let studentLink = $state('');
	let studentUrl = $state('');
	let counts = $state(Object.fromEntries(faces.map((face) => [face, 0])));
	let totalRolls = $state(0);
	/** @type {ChatMessage[]} */
	let messages = $state([]);
	/** @type {DiceEvent[]} */
	let events = $state([]);
	let errorMessage = $state('');

	/** @type {null | (() => void)} */
	let unsubscribe = null;

	let rawMaxCount = $derived(Math.max(0, ...Object.values(counts)));
	let chartScaleMax = $derived(rawMaxCount > 10 ? rawMaxCount : 10);
	const maxChatLines = 6;

	let chatSummaryLines = $derived(messages.map((m) => m.text));

	function generateSessionId() {
		// 브라우저에서 동작하는 환경을 우선 사용합니다.
		if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
		return `sess_${Math.random().toString(36).slice(2)}_${Date.now()}`;
	}

	/**
	 * @param {any} ev
	 */
	function appendEvent(ev) {
		if (!ev) return;

		const nextCounts = { ...counts };
		const countsDelta = ev.countsDelta ?? {};

		for (const face of faces) {
			nextCounts[face] += Number(countsDelta[String(face)] ?? 0);
		}

		counts = nextCounts;

		const rollCount = Number(ev.rollCount ?? 0);
		if (Number.isFinite(rollCount) && rollCount > 0) totalRolls += rollCount;

		const playerName = String(ev.playerName ?? '동물');
		const lastSum = Number(ev.lastSum ?? 0);
		const rollText = Number.isFinite(rollCount) && rollCount > 0 ? `주사위 ${rollCount}개` : '주사위 1개';

		const rolls = normalizeRolls(ev.rolls);
		const rollsText = rolls.length > 0 ? rolls.join(',') : String(lastSum);
		const text = `${playerName}이(가) ${rollText} 굴려서 ${rollsText} 나옴`;

		const createdAt = Number(ev.createdAt ?? 0);
		const id = createdAt ? String(createdAt) : String(Math.random());

		messages = [...messages, { id, text }];
		if (messages.length > maxChatLines) messages = messages.slice(-maxChatLines);

		const normalized = {
			id,
			playerName,
			rollCount: Number.isFinite(rollCount) ? rollCount : 0,
			lastSum: Number.isFinite(lastSum) ? lastSum : 0,
			rolls,
			createdAt: Number.isFinite(createdAt) ? createdAt : 0
		};

		events = [...events, normalized];
		if (events.length > 300) events = events.slice(-300);
	}

	/**
	 * @param {Record<string, any> | null} raw
	 */
	function hydrateFromEvents(raw) {
		const nextCounts = Object.fromEntries(faces.map((face) => [face, 0]));
		let nextTotal = 0;
		/** @type {DiceEvent[]} */
		let nextEvents = [];
		/** @type {ChatMessage[]} */
		let nextMessages = [];

		if (raw) {
			for (const value of Object.values(raw)) {
				if (!value) continue;

				const countsDelta = value.countsDelta ?? {};
				for (const face of faces) {
					nextCounts[face] += Number(countsDelta[String(face)] ?? 0);
				}

				const rollCount = Number(value.rollCount ?? 0);
				if (Number.isFinite(rollCount) && rollCount > 0) nextTotal += rollCount;

				const playerName = String(value.playerName ?? '동물');
				const lastSum = Number(value.lastSum ?? 0);
				const createdAt = Number(value.createdAt ?? 0);
				const id = createdAt ? String(createdAt) : String(Math.random());

				const rolls = normalizeRolls(value.rolls);

				nextEvents.push({
					id,
					playerName,
					rollCount: Number.isFinite(rollCount) ? rollCount : 0,
					lastSum: Number.isFinite(lastSum) ? lastSum : 0,
					rolls,
					createdAt: Number.isFinite(createdAt) ? createdAt : 0
				});

				const rollText = Number.isFinite(rollCount) && rollCount > 0 ? `주사위 ${rollCount}개` : '주사위 1개';
				const rollsText = rolls.length > 0 ? rolls.join(',') : String(lastSum);
				nextMessages.push({
					id,
					text: `${playerName}이(가) ${rollText} 굴려서 ${rollsText} 나옴`
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

	onMount(() => {
		// 새 세션/새로고침 시 state를 초기화한 뒤 기존 이벤트부터 채웁니다.
		counts = Object.fromEntries(faces.map((face) => [face, 0]));
		totalRolls = 0;
		messages = [];
		events = [];
		errorMessage = '';

		if (!sessionId) {
			sessionId = generateSessionId();
			// URL에 session 파라미터가 없으면 추가해 학생이 같은 세션으로 접속할 수 있게 합니다.
			const url = new URL(window.location.href);
			url.searchParams.set('session', sessionId);
			window.history.replaceState({}, '', url.toString());
		}

		studentLink = `/dice/students?session=${encodeURIComponent(sessionId)}`;
		studentUrl = new URL(studentLink, window.location.origin).toString();

		if (!firebaseDb) {
			const suffix = missingEnvKeys?.length ? ` (누락: ${missingEnvKeys.join(', ')})` : '';
			errorMessage = `Firebase 설정(VITE_FIREBASE_*)이 필요합니다.${suffix}`;
			return;
		}

		const eventsRef = ref(firebaseDb, `diceSessions/${sessionId}/events`);
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
			<h1>주사위 분포실험</h1>
			<p>고등학교 확률과 통계: 확률분포와 상대도수 확인</p>
		</div>

		<div class="chart">
			{#each faces as sum}
				<div class="bar-row">
					<div class={`die-mini face-${sum}`} aria-label={`주사위 ${sum}`}>
						{#each Array.from({ length: sum }) as _}
							<span class="pip"></span>
						{/each}
					</div>
					<div class="bar-track">
						<div
							class="bar-fill"
							style={`height: ${(counts[sum] / chartScaleMax) * 100}%`}
						></div>
					</div>
					<div class="value">{counts[sum]}</div>
				</div>
			{/each}
		</div>

		<div class="stats">
			<div class="stats-top">총 굴린 주사위 횟수: <strong>{totalRolls}</strong></div>
			<!-- <div class="stats-grid">
				{#each sums as sum}
					<div class="stat-item">{sum}: {counts[sum]}회</div>
				{/each}
			</div> -->
		</div>
	</div>

	<div class="right-panel">
		<PhoneQrFrame
			fill
			class="dice-phone-qr"
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
      
	.chart {
		display: grid;
		grid-template-columns: repeat(6, minmax(30px, 1fr));
		gap: 8px;
		padding: 10px;
		border-radius: 10px;
		background-color: #f8fafc;
		border: 1px solid #e2e8f0;
		min-height: 420px;
	}

	.bar-row {
		display: grid;
		grid-template-rows: auto 1fr auto;
		align-items: end;
		gap: 6px;
	}

	.label,
	.value {
		text-align: center;
		font-size: 0.82rem;
		color: #1e293b;
	}

	.die-mini {
		width: 26px;
		height: 26px;
		margin: 0 auto;
		border-radius: 6px;
		background: linear-gradient(145deg, #ffffff 0%, #f8fafc 100%);
		border: 1px solid #dbe7ff;
		box-shadow: 0 2px 6px rgba(30, 41, 59, 0.12);
		padding: 4px;
		display: grid;
	}

	.die-mini .pip {
		width: 5px;
		height: 5px;
		border-radius: 999px;
		background: #334155;
		justify-self: center;
		align-self: center;
	}

	.die-mini.face-1 {
		grid-template-columns: 1fr;
		grid-template-rows: 1fr;
	}

	.die-mini.face-2 {
		grid-template-columns: repeat(2, 1fr);
		grid-template-rows: repeat(2, 1fr);
	}
	.die-mini.face-2 .pip:nth-child(1) {
		grid-column: 1;
		grid-row: 1;
	}
	.die-mini.face-2 .pip:nth-child(2) {
		grid-column: 2;
		grid-row: 2;
	}

	.die-mini.face-3 {
		grid-template-columns: repeat(3, 1fr);
		grid-template-rows: repeat(3, 1fr);
	}
	.die-mini.face-3 .pip:nth-child(1) {
		grid-column: 1;
		grid-row: 1;
	}
	.die-mini.face-3 .pip:nth-child(2) {
		grid-column: 2;
		grid-row: 2;
	}
	.die-mini.face-3 .pip:nth-child(3) {
		grid-column: 3;
		grid-row: 3;
	}

	.die-mini.face-4 {
		grid-template-columns: repeat(2, 1fr);
		grid-template-rows: repeat(2, 1fr);
	}
	.die-mini.face-4 .pip:nth-child(1) {
		grid-column: 1;
		grid-row: 1;
	}
	.die-mini.face-4 .pip:nth-child(2) {
		grid-column: 2;
		grid-row: 1;
	}
	.die-mini.face-4 .pip:nth-child(3) {
		grid-column: 1;
		grid-row: 2;
	}
	.die-mini.face-4 .pip:nth-child(4) {
		grid-column: 2;
		grid-row: 2;
	}

	.die-mini.face-5 {
		grid-template-columns: repeat(3, 1fr);
		grid-template-rows: repeat(3, 1fr);
	}
	.die-mini.face-5 .pip:nth-child(1) {
		grid-column: 1;
		grid-row: 1;
	}
	.die-mini.face-5 .pip:nth-child(2) {
		grid-column: 3;
		grid-row: 1;
	}
	.die-mini.face-5 .pip:nth-child(3) {
		grid-column: 2;
		grid-row: 2;
	}
	.die-mini.face-5 .pip:nth-child(4) {
		grid-column: 1;
		grid-row: 3;
	}
	.die-mini.face-5 .pip:nth-child(5) {
		grid-column: 3;
		grid-row: 3;
	}

	.die-mini.face-6 {
		grid-template-columns: repeat(2, 1fr);
		grid-template-rows: repeat(3, 1fr);
	}
	.die-mini.face-6 .pip:nth-child(1) {
		grid-column: 1;
		grid-row: 1;
	}
	.die-mini.face-6 .pip:nth-child(2) {
		grid-column: 2;
		grid-row: 1;
	}
	.die-mini.face-6 .pip:nth-child(3) {
		grid-column: 1;
		grid-row: 2;
	}
	.die-mini.face-6 .pip:nth-child(4) {
		grid-column: 2;
		grid-row: 2;
	}
	.die-mini.face-6 .pip:nth-child(5) {
		grid-column: 1;
		grid-row: 3;
	}
	.die-mini.face-6 .pip:nth-child(6) {
		grid-column: 2;
		grid-row: 3;
	}

	.bar-track {
		height: 320px;
		border-radius: 8px;
		background-color: #e0e7ff;
		display: flex;
		align-items: flex-end;
		padding: 3px;
	}

	.bar-fill {
		width: 100%;
		border-radius: 6px;
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
		margin-bottom: 8px;
	}

	/* .stats-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
		gap: 6px;
		font-size: 0.86rem;
		color: #334155;
	} */

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

	:global(.dice-phone-qr) {
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
