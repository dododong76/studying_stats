<script>
	import { page } from '$app/state';
	import { push, ref } from 'firebase/database';
	import { db } from '$lib/firebase';
	import { getRandomDiceAnimalName } from '$lib/diceAnimals';

	const sums = Array.from({ length: 11 }, (_, i) => i + 2);

	/** @type {import('firebase/database').Database | null} */
	const firebaseDb = db;

	let sessionId = $state(page.url.searchParams.get('session') ?? '');
	let playerName = $state(getRandomDiceAnimalName());
	let batchInput = $state('1');
	let isRolling = $state(false);
	let sentCount = $state(0);
	let errorMessage = $state('');

	const maxAttempts = 10;

	function pickDie() {
		return Math.floor(Math.random() * 6) + 1;
	}

	/**
	 * @param {number} rollCount
	 * @returns {{countsDelta: Record<string, number>, lastSum: number}}
	 */
	function simulateBatch(rollCount) {
		const countsDelta = Object.fromEntries(sums.map((sum) => [String(sum), 0]));
		let lastSum = 2;

		for (let i = 0; i < rollCount; i += 1) {
			const dieA = pickDie();
			const dieB = pickDie();
			const sum = dieA + dieB;
			countsDelta[String(sum)] += 1;
			lastSum = sum;
		}

		return { countsDelta, lastSum };
	}

	async function submit() {
		if (isRolling) return;

		errorMessage = '';

		if (!firebaseDb) {
			errorMessage = 'Firebase 설정(VITE_FIREBASE_*)이 필요합니다.';
			return;
		}

		if (!sessionId) {
			errorMessage = '세션(session)이 필요합니다. 선생님 화면에서 링크를 확인하세요.';
			return;
		}

		if (sentCount >= maxAttempts) {
			errorMessage = '학생 전송 한도(최대 10회)를 모두 사용했어요.';
			return;
		}

		const rollCount = Number.parseInt(batchInput, 10);
		if (!Number.isFinite(rollCount) || rollCount < 1) {
			batchInput = '1';
			errorMessage = '던질 횟수는 1 이상의 숫자여야 해요.';
			return;
		}

		// 과도한 시뮬레이션을 방지하기 위한 클라이언트 제한
		const safeRollCount = Math.min(rollCount, 50000);

		isRolling = true;

		const { countsDelta, lastSum } = simulateBatch(safeRollCount);
		const eventIndex = sentCount + 1;

		const payload = {
			playerName: playerName.trim() || '동물',
			eventIndex,
			rollCount: safeRollCount,
			lastSum,
			countsDelta,
			createdAt: Date.now()
		};

		const eventsRef = ref(firebaseDb, `diceSessions/${sessionId}/events`);
		try {
			await push(eventsRef, payload);
			sentCount = eventIndex;
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			errorMessage = `전송 실패: ${message}`;
		} finally {
			isRolling = false;
		}
	}
</script>

<section class="students-lab">
	<div class="header">
		<h1>학생: 주사위 실험</h1>
		<p>이 페이지에서 던진 결과가 선생님 화면의 채팅창으로 실시간 공유됩니다.</p>
	</div>

	<div class="card">
		<label class="label" for="playerNameInput">학생 이름(동물)</label>
		<input
			id="playerNameInput"
			type="text"
			class="input"
			bind:value={playerName}
			placeholder="예: 고양이"
			maxlength="20"
		/>

		<div class="row">
			<div class="col">
				<label class="label" for="batchInput">던질 횟수</label>
				<input
					id="batchInput"
					type="number"
					min="1"
					max="50000"
					step="1"
					class="input"
					bind:value={batchInput}
					disabled={isRolling || sentCount >= maxAttempts}
				/>
			</div>
			<div class="col btncol">
				<div class="label spacer" aria-hidden="true">&nbsp;</div>
				<button
					class="btn"
					onclick={submit}
					disabled={isRolling || sentCount >= maxAttempts}
				>
					{isRolling ? '전송 중...' : `${sentCount + 1}번째 던지기`}
				</button>
			</div>
		</div>

		<div class="meta">
			남은 전송 횟수: <strong>{Math.max(0, maxAttempts - sentCount)}</strong> / {maxAttempts}
		</div>

		{#if errorMessage}
			<div class="error">{errorMessage}</div>
		{/if}
	</div>
</section>

<style>
	.students-lab {
		min-height: calc(100vh - 160px);
		padding: 18px;
		border-radius: 14px;
		border: 1px solid #bae6fd;
		background: linear-gradient(180deg, #ffffff 0%, #f0f9ff 100%);
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.header h1 {
		margin: 0;
	}

	.header p {
		margin: 8px 0 0;
		color: #334155;
	}

	.card {
		background: #f8fdff;
		border: 1px solid #bae6fd;
		border-radius: 14px;
		padding: 16px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.label {
		font-size: 0.92rem;
		font-weight: 700;
		color: #0f172a;
		margin-bottom: 6px;
	}

	.input {
		width: 100%;
		box-sizing: border-box;
		padding: 10px 12px;
		border-radius: 10px;
		border: 1px solid #94a3b8;
		font-size: 1rem;
	}

	.row {
		display: grid;
		grid-template-columns: 1fr 0.7fr;
		gap: 12px;
	}

	.btncol {
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
	}

	.btn {
		border: 0;
		border-radius: 10px;
		padding: 10px 14px;
		font-weight: 800;
		cursor: pointer;
		background: linear-gradient(180deg, #4f46e5 0%, #4338ca 100%);
		color: #ffffff;
		width: 100%;
	}

	.btn:disabled {
		opacity: 0.7;
		cursor: not-allowed;
	}

	.meta {
		color: #334155;
		font-size: 0.92rem;
	}

	.error {
		color: #b91c1c;
		background: rgba(185, 28, 28, 0.08);
		border: 1px solid rgba(185, 28, 28, 0.25);
		border-radius: 12px;
		padding: 10px 12px;
	}

	@media (max-width: 920px) {
		.row {
			grid-template-columns: 1fr;
		}
	}
</style>

