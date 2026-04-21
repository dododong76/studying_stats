<script>
	import { page } from '$app/state';
	import { push, ref } from 'firebase/database';
	import { db, missingEnvKeys } from '$lib/firebase';
	import { getRandomDiceAnimalName } from '$lib/diceAnimals';

	/** @type {import('firebase/database').Database | null} */
	const firebaseDb = db;
	const xMin = 200;
	const xMax = 320;
	const yMin = 130;
	const yMax = 200;

	let sessionId = $state(page.url.searchParams.get('session') ?? '');
	let playerName = $state(getRandomDiceAnimalName());
	let xInput = $state('255');
	let yInput = $state('170');
	let isSubmitting = $state(false);
	let errorMessage = $state('');
	let previewPoint = $state({ x: 255, y: 170 });

	/**
	 * @param {string} raw
	 * @returns {number | null}
	 */
	function parseShoeSize(raw) {
		const trimmed = raw.trim();
		if (!trimmed) return null;
		const x = Number(trimmed);
		if (!Number.isFinite(x)) return null;
		if (x < xMin || x > xMax) return null;
		return x;
	}

	/**
	 * @param {string} raw
	 * @returns {number | null}
	 */
	function parseHeight(raw) {
		const trimmed = raw.trim();
		if (!trimmed) return null;
		const y = Number(trimmed);
		if (!Number.isFinite(y)) return null;
		if (y < yMin || y > yMax) return null;
		return y;
	}

	/**
	 * @returns {{ x: number, y: number } | null}
	 */
	function parsePointInputs() {
		const x = parseShoeSize(xInput);
		const y = parseHeight(yInput);
		if (x === null || y === null) return null;
		return { x, y };
	}

	/**
	 * @param {Event} event
	 */
	function handleXInput(event) {
		const target = event.currentTarget;
		if (!(target instanceof HTMLInputElement)) return;
		xInput = target.value;
		const parsed = parsePointInputs();
		if (parsed) previewPoint = parsed;
	}

	/**
	 * @param {Event} event
	 */
	function handleYInput(event) {
		const target = event.currentTarget;
		if (!(target instanceof HTMLInputElement)) return;
		yInput = target.value;
		const parsed = parsePointInputs();
		if (parsed) previewPoint = parsed;
	}

	async function submit() {
		if (isSubmitting) return;
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

		const parsed = parsePointInputs();
		if (!parsed) {
			errorMessage = `발사이즈(X)는 ${xMin}~${xMax}, 키(Y)는 ${yMin}~${yMax} 범위로 입력해 주세요.`;
			return;
		}

		isSubmitting = true;
		const payload = {
			playerName: playerName.trim() || '학생',
			point: parsed,
			createdAt: Date.now()
		};

		const eventsRef = ref(firebaseDb, `regressionSessions/${sessionId}/events`);
		try {
			await push(eventsRef, payload);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			errorMessage = `전송 실패: ${message}`;
		} finally {
			isSubmitting = false;
		}
	}
</script>

<section class="students-lab">
	<div class="hero">
		<h1>REGRESSION LINE</h1>
		<p>발사이즈(X), 키(Y)를 전송하면 선생님 화면의 산점도와 회귀직선이 즉시 갱신됩니다.</p>
	</div>

	<div class="preview-wrap">
		<div class="preview-title">미리보기 좌표</div>
		<div class="preview-point">(발 {previewPoint.x.toFixed(1)}, 키 {previewPoint.y.toFixed(1)})</div>
	</div>

	<div class="control-panel">
		<label class="label" for="playerNameInput">이름</label>
		<input
			id="playerNameInput"
			type="text"
			class="input name-input"
			bind:value={playerName}
			placeholder="예: 고양이"
			maxlength="20"
		/>

		<div class="point-row">
			<div class="axis-col">
				<label class="label" for="xInput">발사이즈 (X)</label>
				<input
					id="xInput"
					type="text"
					class="input axis-input"
					value={xInput}
					oninput={handleXInput}
					placeholder="예: 255"
					disabled={isSubmitting}
				/>
			</div>
			<div class="axis-col">
				<label class="label" for="yInput">키 (Y)</label>
				<input
					id="yInput"
					type="text"
					class="input axis-input"
					value={yInput}
					oninput={handleYInput}
					placeholder="예: 170"
					disabled={isSubmitting}
				/>
			</div>
		</div>

		<button class="btn" onclick={submit} disabled={isSubmitting}>
			{isSubmitting ? '전송 중...' : '전송하기'}
		</button>

		{#if errorMessage}
			<div class="error">{errorMessage}</div>
		{/if}
	</div>
</section>

<style>
	.students-lab {
		min-height: calc(100vh - 120px);
		padding: 28px 20px 24px;
		border-radius: 18px;
		background:
			radial-gradient(100% 65% at 50% 0%, rgba(76, 120, 255, 0.22) 0%, rgba(8, 20, 45, 0) 75%),
			linear-gradient(180deg, #0d1730 0%, #091127 100%);
		display: flex;
		flex-direction: column;
		gap: 18px;
		color: #e7eeff;
	}

	.hero {
		text-align: center;
	}

	.hero h1 {
		margin: 0;
		font-size: clamp(1.8rem, 5vw, 2.8rem);
		font-weight: 900;
		letter-spacing: 0.03em;
	}

	.hero p {
		margin: 8px 0 0;
		color: #adc2ff;
		font-weight: 700;
	}

	.preview-wrap {
		width: min(420px, 100%);
		margin: 0 auto;
		border-radius: 14px;
		border: 1px solid rgba(110, 145, 235, 0.35);
		background: rgba(19, 34, 64, 0.5);
		padding: 12px 14px;
		text-align: center;
	}

	.preview-title {
		font-size: 0.86rem;
		color: #bfdbfe;
	}

	.preview-point {
		margin-top: 6px;
		font-size: 1.2rem;
		font-weight: 800;
	}

	.control-panel {
		width: min(420px, 100%);
		margin: 0 auto;
		background: rgba(19, 34, 64, 0.72);
		border: 1px solid rgba(110, 145, 235, 0.35);
		border-radius: 20px;
		padding: 16px;
		display: flex;
		flex-direction: column;
		gap: 12px;
		backdrop-filter: blur(7px);
		align-items: center;
	}

	.label {
		font-size: 0.92rem;
		font-weight: 700;
		color: #dde8ff;
		text-align: center;
	}

	.input {
		width: 100%;
		box-sizing: border-box;
		padding: 10px 12px;
		border-radius: 10px;
		border: 1px solid #4968a8;
		background: #111d39;
		color: #f8fbff;
		font-size: 1rem;
	}

	.name-input {
		width: min(100%, 14ch);
	}

	.point-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
		width: min(100%, 260px);
	}

	.axis-col {
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.axis-input {
		max-width: 9ch;
	}

	.btn {
		border: 0;
		border-radius: 10px;
		padding: 10px 16px;
		font-weight: 800;
		cursor: pointer;
		background: linear-gradient(180deg, #6f73ff 0%, #7c3aed 100%);
		color: #ffffff;
		width: fit-content;
		min-width: 120px;
	}

	.btn:disabled {
		opacity: 0.7;
		cursor: not-allowed;
	}

	.error {
		color: #ffb4b4;
		background: rgba(185, 28, 28, 0.2);
		border: 1px solid rgba(254, 131, 131, 0.4);
		border-radius: 12px;
		padding: 10px 12px;
	}

	@media (max-width: 920px) {
		.students-lab {
			padding: 20px 14px 18px;
		}

		.control-panel {
			width: min(360px, 100%);
		}

		.name-input {
			width: min(100%, 12ch);
		}

		.point-row {
			grid-template-columns: 1fr;
			width: min(100%, 180px);
		}
	}
</style>
