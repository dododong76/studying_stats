<script>
	import { onDestroy, onMount } from 'svelte';
	import { page } from '$app/state';
	import { onValue, ref } from 'firebase/database';
	import { db } from '$lib/firebase';

	const sums = Array.from({ length: 11 }, (_, i) => i + 2);

	/**
	 * @typedef {{ id: string, text: string }} ChatMessage
	 * @typedef {{
	 *   id: string,
	 *   playerName: string,
	 *   rollCount: number,
	 *   lastSum: number,
	 *   createdAt: number
	 * }} DiceEvent
	 * @type {import('firebase/database').Database | null}
	 */
	const firebaseDb = db;

	let sessionId = $state(page.url.searchParams.get('session') ?? '');
	let studentLink = $state('');
	let studentUrl = $state('');
	let qrDataUrl = $state('');
	let counts = $state(Object.fromEntries(sums.map((sum) => [sum, 0])));
	let totalRolls = $state(0);
	/** @type {ChatMessage[]} */
	let messages = $state([]);
	/** @type {DiceEvent[]} */
	let events = $state([]);
	let errorMessage = $state('');

	/** @type {null | (() => void)} */
	let unsubscribe = null;

	let maxCount = $derived(Math.max(1, ...Object.values(counts)));
	let recentEvents = $derived([...events].slice(-50).reverse());

	function generateSessionId() {
		// 브라우저에서 동작하는 환경을 우선 사용합니다.
		if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
		return `sess_${Math.random().toString(36).slice(2)}_${Date.now()}`;
	}

	/**
	 * @param {number} ts
	 */
	function formatTime(ts) {
		if (!Number.isFinite(ts) || ts <= 0) return '';
		try {
			return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
		} catch {
			return '';
		}
	}

	/**
	 * @param {any} ev
	 */
	function appendEvent(ev) {
		if (!ev) return;

		const nextCounts = { ...counts };
		const countsDelta = ev.countsDelta ?? {};

		for (const sum of sums) {
			nextCounts[sum] += Number(countsDelta[String(sum)] ?? 0);
		}

		counts = nextCounts;

		const rollCount = Number(ev.rollCount ?? 0);
		if (Number.isFinite(rollCount) && rollCount > 0) totalRolls += rollCount;

		const playerName = String(ev.playerName ?? '동물');
		const lastSum = Number(ev.lastSum ?? 0);
		const rollText = Number.isFinite(rollCount) && rollCount > 0 ? `${rollCount}번` : '1회';

		const text = `${playerName}이(가) ${rollText} 던져서 합 ${String(lastSum)} 나옴`;

		const createdAt = Number(ev.createdAt ?? 0);
		const id = createdAt ? String(createdAt) : String(Math.random());

		messages = [...messages, { id, text }];
		if (messages.length > 200) messages = messages.slice(-200);

		const normalized = {
			id,
			playerName,
			rollCount: Number.isFinite(rollCount) ? rollCount : 0,
			lastSum: Number.isFinite(lastSum) ? lastSum : 0,
			createdAt: Number.isFinite(createdAt) ? createdAt : 0
		};

		events = [...events, normalized];
		if (events.length > 300) events = events.slice(-300);
	}

	/**
	 * @param {Record<string, any> | null} raw
	 */
	function hydrateFromEvents(raw) {
		const nextCounts = Object.fromEntries(sums.map((sum) => [sum, 0]));
		let nextTotal = 0;
		/** @type {DiceEvent[]} */
		let nextEvents = [];
		/** @type {ChatMessage[]} */
		let nextMessages = [];

		if (raw) {
			for (const value of Object.values(raw)) {
				if (!value) continue;

				const countsDelta = value.countsDelta ?? {};
				for (const sum of sums) {
					nextCounts[sum] += Number(countsDelta[String(sum)] ?? 0);
				}

				const rollCount = Number(value.rollCount ?? 0);
				if (Number.isFinite(rollCount) && rollCount > 0) nextTotal += rollCount;

				const playerName = String(value.playerName ?? '동물');
				const lastSum = Number(value.lastSum ?? 0);
				const createdAt = Number(value.createdAt ?? 0);
				const id = createdAt ? String(createdAt) : String(Math.random());

				nextEvents.push({
					id,
					playerName,
					rollCount: Number.isFinite(rollCount) ? rollCount : 0,
					lastSum: Number.isFinite(lastSum) ? lastSum : 0,
					createdAt: Number.isFinite(createdAt) ? createdAt : 0
				});

				const rollText = Number.isFinite(rollCount) && rollCount > 0 ? `${rollCount}번` : '1회';
				nextMessages.push({
					id,
					text: `${playerName}이(가) ${rollText} 던져서 합 ${String(lastSum)} 나옴`
				});
			}
		}

		nextEvents.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
		nextMessages.sort((a, b) => Number(a.id) - Number(b.id));

		counts = nextCounts;
		totalRolls = nextTotal;
		events = nextEvents.slice(-300);
		messages = nextMessages.slice(-200);
	}

	onMount(() => {
		// 새 세션/새로고침 시 state를 초기화한 뒤 기존 이벤트부터 채웁니다.
		counts = Object.fromEntries(sums.map((sum) => [sum, 0]));
		totalRolls = 0;
		messages = [];
		events = [];
		errorMessage = '';
		qrDataUrl = '';

		if (!sessionId) {
			sessionId = generateSessionId();
			// URL에 session 파라미터가 없으면 추가해 학생이 같은 세션으로 접속할 수 있게 합니다.
			const url = new URL(window.location.href);
			url.searchParams.set('session', sessionId);
			window.history.replaceState({}, '', url.toString());
		}

		studentLink = `/dice/students?session=${encodeURIComponent(sessionId)}`;
		studentUrl = new URL(studentLink, window.location.origin).toString();

		(async () => {
			try {
				const qrcode = await import('qrcode');
				qrDataUrl = await qrcode.toDataURL(studentUrl, { width: 240, margin: 1 });
			} catch (err) {
				console.warn('[dice] Failed to generate QR code', err);
				qrDataUrl = '';
			}
		})();

		if (!firebaseDb) {
			errorMessage = 'Firebase 설정(VITE_FIREBASE_*)이 필요합니다.';
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
			{#each sums as sum}
				<div class="bar-row">
					<div class="label">{sum}</div>
					<div class="bar-track">
						<div
							class="bar-fill"
							style={`height: ${(counts[sum] / maxCount) * 100}%`}
						></div>
					</div>
					<div class="value">{counts[sum]}</div>
				</div>
			{/each}
		</div>

		<div class="stats">
			<div class="stats-top">총 던진 횟수: <strong>{totalRolls}</strong></div>
			<div class="stats-grid">
				{#each sums as sum}
					<div class="stat-item">{sum}: {counts[sum]}회</div>
				{/each}
			</div>
		</div>

		<div class="events-card">
			<div class="events-title">최근 전송 기록</div>
			{#if recentEvents.length === 0}
				<div class="events-empty">아직 학생 전송이 없어요. 학생이 던지면 아래 표가 실시간으로 채워집니다.</div>
			{:else}
				<div class="events-table-wrap">
					<table class="events-table">
						<thead>
							<tr>
								<th>시간</th>
								<th>이름</th>
								<th>횟수</th>
								<th>마지막 합</th>
							</tr>
						</thead>
						<tbody>
							{#each recentEvents as ev (ev.id)}
								<tr>
									<td class="mono">{formatTime(ev.createdAt)}</td>
									<td>{ev.playerName}</td>
									<td class="mono">{ev.rollCount}</td>
									<td class="mono">{ev.lastSum}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>
	</div>

	<div class="right-panel">
		<h2>실시간 채팅</h2>

		<div class="session-card">
			<div class="session-title">학생 참여 링크</div>
			<a class="session-link" href={studentUrl || studentLink} target="_blank" rel="noreferrer">
				{studentUrl || studentLink}
			</a>
			<div class="session-sub">위 링크를 QR코드로 공유하세요.</div>
			{#if qrDataUrl}
				<div class="qr-wrap">
					<img class="qr" src={qrDataUrl} alt="학생 참여 QR 코드" />
				</div>
			{:else}
				<div class="qr-placeholder">QR 코드를 생성하는 중이거나, 브라우저에서 QR 생성이 불가합니다.</div>
			{/if}
		</div>

		{#if errorMessage}
			<div class="error">{errorMessage}</div>
		{/if}

		<div class="chat">
			{#if messages.length === 0}
				<div class="chat-empty">학생이 전송하면 여기 채팅창에 1줄 요약이 실시간으로 표시됩니다.</div>
			{:else}
				{#each messages as m}
					<div class="chat-line">{m.text}</div>
				{/each}
			{/if}
		</div>
	</div>
</section>

<style>
	.teacher-lab {
		display: grid;
		grid-template-columns: 3fr 2fr;
		gap: 16px;
		min-height: calc(100vh - 160px);
	}

	.left-panel,
	.right-panel {
		background-color: #ffffff;
		border: 1px solid #dbeafe;
		border-radius: 14px;
		padding: 16px;
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
		grid-template-columns: repeat(11, minmax(30px, 1fr));
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

	.stats-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
		gap: 6px;
		font-size: 0.86rem;
		color: #334155;
	}

	.right-panel {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: flex-start;
		gap: 12px;
		background: linear-gradient(180deg, #ffffff 0%, #eef2ff 100%);
	}

	.session-card {
		width: 100%;
		border: 1px solid #c7d2fe;
		border-radius: 12px;
		padding: 12px;
		background-color: #f8fafc;
	}

	.session-title {
		font-weight: 800;
		color: #0f172a;
		margin-bottom: 8px;
	}

	.session-link {
		display: block;
		word-break: break-all;
		color: #4338ca;
		font-weight: 800;
		text-decoration: none;
		padding: 8px 10px;
		border-radius: 10px;
		border: 1px solid #c7d2fe;
		background: #ffffff;
	}

	.session-link:hover {
		background: #eef2ff;
	}

	.session-sub {
		margin-top: 8px;
		color: #475569;
		font-size: 0.85rem;
	}

	.chat {
		width: 100%;
		flex: 1;
		min-height: 260px;
		max-height: 420px;
		overflow-y: auto;
		border: 1px solid #e2e8f0;
		border-radius: 12px;
		background: #ffffff;
		padding: 10px;
	}

	.chat-empty {
		color: #64748b;
		font-size: 0.92rem;
		padding: 8px;
	}

	.chat-line {
		padding: 8px 8px;
		border-bottom: 1px solid rgba(148, 163, 184, 0.18);
		color: #0f172a;
		font-weight: 600;
		line-height: 1.35;
	}

	.chat-line:last-child {
		border-bottom: 0;
	}

	.error {
		width: 100%;
		border-radius: 12px;
		padding: 10px 12px;
		border: 1px solid rgba(185, 28, 28, 0.25);
		background: rgba(185, 28, 28, 0.08);
		color: #b91c1c;
		font-weight: 700;
	}

	h2 {
		margin: 0;
		font-size: 1.05rem;
	}

	.qr-wrap {
		margin-top: 10px;
		display: grid;
		place-items: center;
		padding: 10px;
		border-radius: 12px;
		border: 1px solid #c7d2fe;
		background: #ffffff;
	}

	.qr {
		width: 220px;
		height: 220px;
		image-rendering: pixelated;
	}

	.qr-placeholder {
		margin-top: 10px;
		font-size: 0.85rem;
		color: #475569;
		padding: 10px;
		border-radius: 12px;
		border: 1px dashed rgba(99, 102, 241, 0.35);
		background: rgba(99, 102, 241, 0.06);
	}

	.events-card {
		margin-top: 12px;
		padding: 12px;
		border-radius: 12px;
		border: 1px solid #e2e8f0;
		background: #ffffff;
	}

	.events-title {
		font-weight: 800;
		color: #0f172a;
		margin-bottom: 8px;
	}

	.events-empty {
		color: #64748b;
		font-size: 0.92rem;
		padding: 6px 2px;
	}

	.events-table-wrap {
		width: 100%;
		overflow: auto;
		border-radius: 10px;
		border: 1px solid #e2e8f0;
	}

	.events-table {
		width: 100%;
		border-collapse: collapse;
		min-width: 420px;
	}

	.events-table th,
	.events-table td {
		padding: 8px 10px;
		border-bottom: 1px solid rgba(148, 163, 184, 0.18);
		text-align: left;
		white-space: nowrap;
		font-size: 0.92rem;
	}

	.events-table th {
		position: sticky;
		top: 0;
		background: #f8fafc;
		color: #0f172a;
		font-weight: 800;
	}

	.mono {
		font-variant-numeric: tabular-nums;
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New',
			monospace;
	}

	@media (max-width: 920px) {
		.teacher-lab {
			grid-template-columns: 1fr;
		}
	}
</style>
