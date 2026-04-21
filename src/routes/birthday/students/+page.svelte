<script>
	import { page } from '$app/state';
	import { push, ref } from 'firebase/database';
	import { db, missingEnvKeys } from '$lib/firebase';
	import { getRandomDiceAnimalName } from '$lib/diceAnimals';

	/** @type {import('firebase/database').Database | null} */
	const firebaseDb = db;

	let sessionId = $state(page.url.searchParams.get('session') ?? '');
	let playerName = $state(getRandomDiceAnimalName());
	let monthInput = $state('1');
	let dayInput = $state('1');
	let isSending = $state(false);
	let errorMessage = $state('');

	const months = Array.from({ length: 12 }, (_, i) => i + 1);

	/**
	 * @param {number} month
	 */
	function getMaxDay(month) {
		if ([1, 3, 5, 7, 8, 10, 12].includes(month)) return 31;
		if ([4, 6, 9, 11].includes(month)) return 30;
		return 29;
	}

	let monthNum = $derived(Number(monthInput));
	let maxDay = $derived(getMaxDay(monthNum));
	let dayOptions = $derived(Array.from({ length: maxDay }, (_, i) => i + 1));

	$effect(() => {
		const day = Number(dayInput);
		if (day > maxDay) dayInput = String(maxDay);
	});

	async function submit() {
		if (isSending) return;
		errorMessage = '';

		if (!firebaseDb) {
			const suffix = missingEnvKeys?.length ? ` (누락: ${missingEnvKeys.join(', ')})` : '';
			errorMessage = `Firebase 설정(VITE_FIREBASE_*)이 필요합니다.${suffix}`;
			return;
		}

		if (!sessionId) {
			errorMessage = '세션(session)이 필요합니다. 선생님 화면에서 링크를 확인하세요.';
			return;
		}

		const month = Number(monthInput);
		const day = Number(dayInput);
		const max = getMaxDay(month);
		if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(day) || day < 1 || day > max) {
			errorMessage = '유효한 생일(월/일)을 선택해 주세요.';
			return;
		}

		isSending = true;

		const payload = {
			playerName: playerName.trim() || '학생',
			month,
			day,
			createdAt: Date.now()
		};

		const eventsRef = ref(firebaseDb, `birthdaySessions/${sessionId}/events`);
		try {
			await push(eventsRef, payload);
		} catch (err) {
			errorMessage = `전송 실패: ${err instanceof Error ? err.message : '오류'}`;
		} finally {
			isSending = false;
		}
	}
</script>

<section class="students-lab">
	<div class="hero">
		<h1>Birthday Check</h1>
		<p>연도 없이 월/일만 선택해서 생일을 제출해 주세요.</p>
	</div>

	<div class="card">
		<label class="label" for="playerNameInput">이름</label>
		<input
			id="playerNameInput"
			type="text"
			class="input"
			bind:value={playerName}
			placeholder="예: 강아지"
			maxlength="15"
		/>

		<div class="row">
			<div class="field">
				<label class="label" for="monthInput">월</label>
				<select id="monthInput" class="input" bind:value={monthInput}>
					{#each months as month}
						<option value={month}>{month}월</option>
					{/each}
				</select>
			</div>

			<div class="field">
				<label class="label" for="dayInput">일</label>
				<select id="dayInput" class="input" bind:value={dayInput}>
					{#each dayOptions as day}
						<option value={day}>{day}일</option>
					{/each}
				</select>
			</div>
		</div>

		<button class="submit-btn" type="button" onclick={submit} disabled={isSending}>
			{isSending ? '전송 중...' : '생일 제출하기'}
		</button>

		{#if errorMessage}
			<p class="error-msg">{errorMessage}</p>
		{/if}
	</div>
</section>

<style>
	.students-lab {
		min-height: calc(100vh - 120px);
		padding: 30px 18px;
		background:
			radial-gradient(100% 65% at 50% 0%, rgba(251, 146, 60, 0.22) 0%, rgba(8, 20, 45, 0) 75%),
			linear-gradient(180deg, #131f3a 0%, #0b1429 100%);
		color: #e2e8f0;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 16px;
	}

	.hero {
		text-align: center;
	}

	.hero h1 {
		margin: 0;
		font-size: 1.9rem;
		font-weight: 800;
		background: linear-gradient(to right, #fb923c, #f97316);
		background-clip: text;
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
	}

	.hero p {
		margin: 6px 0 0;
		color: #94a3b8;
	}

	.card {
		width: min(420px, 100%);
		background: rgba(15, 23, 42, 0.72);
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 16px;
		padding: 16px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.label {
		font-size: 0.85rem;
		color: #cbd5e1;
		font-weight: 600;
	}

	.input {
		background: #1e293b;
		border: 1px solid #334155;
		border-radius: 10px;
		padding: 10px;
		color: #f8fafc;
		font-size: 1rem;
	}

	.submit-btn {
		margin-top: 6px;
		border: none;
		border-radius: 12px;
		padding: 12px;
		color: white;
		font-weight: 700;
		background: linear-gradient(135deg, #f97316 0%, #ef4444 100%);
		cursor: pointer;
	}

	.submit-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.error-msg {
		margin: 4px 0 0;
		font-size: 0.84rem;
		color: #fca5a5;
	}
</style>
