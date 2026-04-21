<script>
	import { onDestroy, onMount } from 'svelte';
	import { page } from '$app/state';
	import { onValue, ref } from 'firebase/database';
	import { PhoneQrFrame } from '$lib';
	import { db, missingEnvKeys } from '$lib/firebase';

	/**
	 * @typedef {{ id: string, text: string }} ChatMessage
	 * @typedef {{
	 *   id: string,
	 *   playerName: string,
	 *   initialChoice: number,
	 *   openedDoor: number,
	 *   finalChoice: number,
	 *   decision: 'keep' | 'switch',
	 *   prizeDoor: number,
	 *   isWin: boolean,
	 *   createdAt: number
	 * }} MontyEvent
	 * @type {import('firebase/database').Database | null}
	 */
	const firebaseDb = db;

	let sessionId = $state(page.url.searchParams.get('session') ?? '');
	let studentLink = $state('');
	let studentUrl = $state('');
	/** @type {ChatMessage[]} */
	let messages = $state([]);
	/** @type {MontyEvent[]} */
	let events = $state([]);
	let errorMessage = $state('');
	let keepCount = $state(0);
	let switchCount = $state(0);
	let keepWinCount = $state(0);
	let switchWinCount = $state(0);
	let totalCount = $state(0);

	/** @type {null | (() => void)} */
	let unsubscribe = null;
	const maxChatLines = 6;

	let keepWinRate = $derived(keepCount > 0 ? Math.round((keepWinCount / keepCount) * 1000) / 10 : 0);
	let switchWinRate = $derived(
		switchCount > 0 ? Math.round((switchWinCount / switchCount) * 1000) / 10 : 0
	);
	let chatSummaryLines = $derived(messages.map((m) => m.text));

	function generateSessionId() {
		if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
		return `sess_${Math.random().toString(36).slice(2)}_${Date.now()}`;
	}

	/**
	 * @param {Record<string, any> | null} raw
	 */
	function hydrateFromEvents(raw) {
		/** @type {MontyEvent[]} */
		const nextEvents = [];
		/** @type {ChatMessage[]} */
		const nextMessages = [];
		let nextKeepCount = 0;
		let nextSwitchCount = 0;
		let nextKeepWinCount = 0;
		let nextSwitchWinCount = 0;

		if (raw) {
			for (const value of Object.values(raw)) {
				if (!value) continue;

				const playerName = String(value.playerName ?? '학생');
				const initialChoice = Number(value.initialChoice ?? 1);
				const openedDoor = Number(value.openedDoor ?? 2);
				const finalChoice = Number(value.finalChoice ?? initialChoice);
				const decision = value.decision === 'switch' ? 'switch' : 'keep';
				const prizeDoor = Number(value.prizeDoor ?? 1);
				const isWin = Boolean(value.isWin);
				const createdAt = Number(value.createdAt ?? 0);
				const id = createdAt ? String(createdAt) : String(Math.random());

				if (decision === 'switch') {
					nextSwitchCount += 1;
					if (isWin) nextSwitchWinCount += 1;
				} else {
					nextKeepCount += 1;
					if (isWin) nextKeepWinCount += 1;
				}

				nextEvents.push({
					id,
					playerName,
					initialChoice,
					openedDoor,
					finalChoice,
					decision,
					prizeDoor,
					isWin,
					createdAt: Number.isFinite(createdAt) ? createdAt : 0
				});

				nextMessages.push({
					id,
					text: `${playerName} · ${decision === 'switch' ? '변경' : '유지'} · ${isWin ? '당첨' : '실패'}`
				});
			}
		}

		nextEvents.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
		nextMessages.sort((a, b) => Number(a.id) - Number(b.id));

		events = nextEvents.slice(-300);
		messages = nextMessages.slice(-maxChatLines);
		keepCount = nextKeepCount;
		switchCount = nextSwitchCount;
		keepWinCount = nextKeepWinCount;
		switchWinCount = nextSwitchWinCount;
		totalCount = nextKeepCount + nextSwitchCount;
	}

	onMount(() => {
		events = [];
		messages = [];
		errorMessage = '';
		keepCount = 0;
		switchCount = 0;
		keepWinCount = 0;
		switchWinCount = 0;
		totalCount = 0;

		if (!sessionId) {
			sessionId = generateSessionId();
			const url = new URL(window.location.href);
			url.searchParams.set('session', sessionId);
			window.history.replaceState({}, '', url.toString());
		}

		studentLink = `/MontyHall/students?session=${encodeURIComponent(sessionId)}`;
		studentUrl = new URL(studentLink, window.location.origin).toString();

		if (!firebaseDb) {
			const suffix = missingEnvKeys?.length ? ` (누락: ${missingEnvKeys.join(', ')})` : '';
			errorMessage = `Firebase 설정(VITE_FIREBASE_*)이 필요합니다.${suffix}`;
			return;
		}

		const eventsRef = ref(firebaseDb, `montyHallSessions/${sessionId}/events`);
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
			<h1>몬티홀 문제 실험을 직접해보자.</h1>
			<p>선택을 유지할지 바꿀지에 따라 당첨 확률이 어떻게 달라지는지 확인합니다.</p>
		</div>
		<div class="stat-card">
			<h2>전체 제출 : </h2> 
			<div class="value">{totalCount}</div>
		</div>
		<div class="stats-grid">

			<div class="stat-card">
				<h2>유지를 선택했을 때</h2>
				<div class="value">{keepCount}번 중 당첨 {keepWinCount}회</div>
				<p>성공률 {keepWinRate}%</p>
			</div>
			<div class="stat-card">
				<h2>변경을 선택했을 때</h2>
				<div class="value">{switchCount}번 중 당첨 {switchWinCount}회</div>
				<p>성공률 {switchWinRate}%</p>
			</div>
		</div>

		<div class="bars">
			<div class="bar-block">
				<div class="bar-label">유지</div>
				<div class="bar-track">
					<div class="bar-fill keep" style={`width: ${keepWinRate}%`}></div>
				</div>
				<div class="bar-value">{keepWinRate}%</div>
			</div>
			<div class="bar-block">
				<div class="bar-label">변경</div>
				<div class="bar-track">
					<div class="bar-fill switch" style={`width: ${switchWinRate}%`}></div>
				</div>
				<div class="bar-value">{switchWinRate}%</div>
			</div>
		</div>
	</div>

	<div class="right-panel">
		<PhoneQrFrame
			fill
			class="monty-phone-qr"
			participateUrl={studentUrl || studentLink}
			summaries={chatSummaryLines}
			qrPixelSize={280}
			emptySummaryText="아직 제출된 결과가 없습니다."
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

	.stats-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 10px;
		margin-bottom: 14px;
	}

	.stat-card {
		border: 1px solid #dbeafe;
		border-radius: 12px;
		padding: 12px;
		background: #f8fbff;
	}

	.stat-card h2 {
		margin: 0;
		font-size: 0.95rem;
		color: #334155;
	}

	.stat-card .value {
		margin-top: 8px;
		font-size: 1.8rem;
		font-weight: 800;
		color: #0f172a;
	}

	.stat-card p {
		margin: 8px 0 0;
		color: #475569;
		font-size: 0.9rem;
	}

	.bars {
		padding: 12px;
		border-radius: 12px;
		border: 1px solid #e2e8f0;
		background: #f8fafc;
		display: grid;
		gap: 10px;
	}

	.bar-block {
		display: grid;
		grid-template-columns: 48px 1fr 68px;
		gap: 10px;
		align-items: center;
	}

	.bar-label {
		font-weight: 700;
		color: #334155;
		text-align: center;
	}

	.bar-track {
		height: 22px;
		border-radius: 999px;
		background: #dbeafe;
		overflow: hidden;
	}

	.bar-fill {
		height: 100%;
		border-radius: 999px;
		min-width: 2px;
		transition: width 0.25s ease;
	}

	.bar-fill.keep {
		background: linear-gradient(180deg, #94a3b8 0%, #475569 100%);
	}

	.bar-fill.switch {
		background: linear-gradient(180deg, #22c55e 0%, #15803d 100%);
	}

	.bar-value {
		font-weight: 700;
		color: #1e293b;
		text-align: right;
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

	:global(.monty-phone-qr) {
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

		.stats-grid {
			grid-template-columns: 1fr;
		}

		.bar-block {
			grid-template-columns: 48px 1fr 56px;
		}
	}
</style>
