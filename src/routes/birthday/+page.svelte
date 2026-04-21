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
	 *   month: number,
	 *   day: number,
	 *   createdAt: number
	 * }} BirthdayEvent
	 */

	/** @type {import('firebase/database').Database | null} */
	const firebaseDb = db;

	let sessionId = $state(page.url.searchParams.get('session') ?? '');
	let studentLink = $state('');
	let studentUrl = $state('');
	/** @type {BirthdayEvent[]} */
	let events = $state([]);
	/** @type {Record<string, number>} */
	let birthdayCounts = $state({});
	let errorMessage = $state('');

	/** @type {null | (() => void)} */
	let unsubscribe = null;

	const monthNames = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
	const weekLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
	const daysPerMonth = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
	const firstWeekDay2026 = [4, 0, 0, 3, 5, 1, 3, 6, 2, 4, 0, 2]; // 2026년 기준 시작 요일(0=일)

	/** @type {{ month: number, title: string, cells: ({day:number, key:string} | null)[] }[]} */
	let calendarMonths = $derived.by(() => {
		return monthNames.map((title, idx) => {
			const month = idx + 1;
			const firstWeekDay = firstWeekDay2026[idx];
			const days = daysPerMonth[idx];
			/** @type {({day:number, key:string} | null)[]} */
			const cells = [];
			for (let i = 0; i < firstWeekDay; i += 1) cells.push(null);
			for (let day = 1; day <= days; day += 1) {
				cells.push({ day, key: `${month}-${day}` });
			}
			while (cells.length % 7 !== 0) cells.push(null);
			return { month, title, cells };
		});
	});

	/** @type {string[]} */
	let summaryLines = $derived.by(() =>
		events
			.slice(0, 12)
			.map((ev) => `${ev.playerName}님이 ${ev.month}월 ${ev.day}일 체크`)
	);

	function generateSessionId() {
		if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
		return `sess_${Math.random().toString(36).slice(2)}_${Date.now()}`;
	}

	/**
	 * @param {Record<string, any> | null} raw
	 */
	function hydrateFromEvents(raw) {
		/** @type {BirthdayEvent[]} */
		const next = [];
		/** @type {Record<string, number>} */
		const countMap = {};

		if (raw) {
			for (const [firebaseKey, value] of Object.entries(raw)) {
				if (!value || typeof value !== 'object') continue;
				const month = Number(value.month);
				const day = Number(value.day);
				if (!Number.isInteger(month) || month < 1 || month > 12) continue;
				if (!Number.isInteger(day) || day < 1 || day > (daysPerMonth[month - 1] ?? 31)) continue;
				const createdAt = Number(value.createdAt ?? 0);
				const playerName = String(value.playerName ?? '학생');

				next.push({
					id: firebaseKey,
					playerName,
					month,
					day,
					createdAt: Number.isFinite(createdAt) ? createdAt : 0
				});

				const key = `${month}-${day}`;
				countMap[key] = (countMap[key] ?? 0) + 1;
			}
		}

		next.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
		events = next.slice(0, 500);
		birthdayCounts = countMap;
	}

	onMount(() => {
		events = [];
		birthdayCounts = {};
		errorMessage = '';

		if (!sessionId) {
			sessionId = generateSessionId();
			const url = new URL(window.location.href);
			url.searchParams.set('session', sessionId);
			window.history.replaceState({}, '', url.toString());
		}

		studentLink = `/birthday/students?session=${encodeURIComponent(sessionId)}`;
		studentUrl = new URL(studentLink, window.location.origin).toString();

		if (!firebaseDb) {
			const suffix = missingEnvKeys?.length ? ` (누락: ${missingEnvKeys.join(', ')})` : '';
			errorMessage = `Firebase 설정(VITE_FIREBASE_*)이 필요합니다.${suffix}`;
			return;
		}

		const eventsRef = ref(firebaseDb, `birthdaySessions/${sessionId}/events`);
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
			<h1>생일 캘린더</h1>
			<p>학생이 선택한 생일 날짜에 점을 표시합니다. 2명 이상이면 더 큰 빨간 점으로 표시됩니다.</p>
		</div>

		<div class="calendar-wrap">
			<div class="calendar-grid">
				{#each calendarMonths as monthData}
					<article class="month-card">
						<h3>{monthData.title}</h3>
						<div class="week-header">
							{#each weekLabels as label}
								<span>{label}</span>
							{/each}
						</div>
						<div class="days-grid">
							{#each monthData.cells as cell}
								{#if cell}
									{@const count = birthdayCounts[cell.key] ?? 0}
									<div class="day-cell" title={`${monthData.month}월 ${cell.day}일 (${count}명)`}>
										{#if count > 0}
											<span class={`day-mark ${count >= 2 ? 'day-mark--multi' : 'day-mark--single'}`} aria-hidden="true"></span>
										{/if}
										<span class="day-num">{cell.day}</span>
									</div>
								{:else}
									<div class="day-cell day-cell--empty" aria-hidden="true"></div>
								{/if}
							{/each}
						</div>
					</article>
				{/each}
			</div>
		</div>
	</div>

	<div class="right-panel">
		<PhoneQrFrame
			fill
			class="birthday-phone-qr"
			participateUrl={studentUrl || studentLink}
			summaries={summaryLines}
			qrPixelSize={280}
			emptySummaryText="아직 체크된 생일이 없습니다."
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
		border: 1px solid #fed7aa;
		border-radius: 14px;
		padding: 16px;
		display: flex;
		flex-direction: column;
		min-height: 0;
	}

	.panel-header h1 {
		margin: 0;
		font-size: 1.24rem;
	}

	.panel-header p {
		margin: 8px 0 12px;
		color: #475569;
		font-size: 0.92rem;
	}

	.calendar-wrap {
		flex: 1 1 auto;
		min-height: 0;
		overflow: auto;
		border-radius: 10px;
		border: 1px solid #ffedd5;
		background: #fff7ed;
		padding: 10px;
	}

	.calendar-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(190px, 1fr));
		gap: 12px;
	}

	.month-card {
		background: #ffffff;
		border: 1px solid #fed7aa;
		border-radius: 10px;
		padding: 8px;
	}

	.month-card h3 {
		margin: 0 0 6px;
		text-align: center;
		font-size: 0.88rem;
		font-weight: 800;
		color: #1e3a8a;
		letter-spacing: 0.04em;
	}

	.week-header,
	.days-grid {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		gap: 2px;
	}

	.week-header span {
		text-align: center;
		font-size: 0.66rem;
		font-weight: 700;
		color: #334155;
	}

	.week-header span:first-child,
	.week-header span:last-child {
		color: #ef4444;
	}

	.day-cell {
		aspect-ratio: 1 / 1;
		border-radius: 7px;
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #ffffff;
	}

	.day-cell--empty {
		background: transparent;
	}

	.day-num {
		position: relative;
		z-index: 1;
		font-size: 0.68rem;
		line-height: 1;
		font-weight: 700;
		color: #1f2937;
	}

	.day-mark {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		border-radius: 999px;
		z-index: 0;
	}

	.day-mark--single {
		width: 17px;
		height: 17px;
		background: #fb923c;
		opacity: 0.9;
	}

	.day-mark--multi {
		width: 22px;
		height: 22px;
		background: #ef4444;
		opacity: 0.92;
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

	:global(.birthday-phone-qr) {
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
	}

	@media (max-width: 1060px) {
		.calendar-grid {
			grid-template-columns: repeat(2, minmax(190px, 1fr));
		}
	}

	@media (max-width: 920px) {
		.teacher-lab {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 640px) {
		.calendar-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
