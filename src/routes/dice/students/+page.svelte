<script>
	import { page } from '$app/state';
	import { push } from 'firebase/database';
	import { db, ensureFirebaseAuth, formatFirebaseAuthError, missingEnvKeys, sessionEventsRef } from '$lib/firebase';
	import { getRandomDiceAnimalName } from '$lib/diceAnimals';

	const faces = Array.from({ length: 6 }, (_, i) => i + 1);

	/** @type {import('firebase/database').Database | null} */
	const firebaseDb = db;

	let sessionId = $state(page.url.searchParams.get('session') ?? '');
	let playerName = $state(getRandomDiceAnimalName());
	let batchInput = $state('1');
	let isRolling = $state(false);
	let isPreviewing = $state(false);
	let errorMessage = $state('');
	let diceValues = $state([1]);

	const allowedRollCounts = ['1', '2', '3'];

	function syncVisibleDiceCount() {
		const visibleCount = Number.parseInt(batchInput, 10);
		if (!Number.isFinite(visibleCount) || visibleCount < 1 || visibleCount > 3) return;
		diceValues = Array.from({ length: visibleCount }, (_, i) => diceValues[i] ?? pickDie());
	}

	/**
	 * @param {Event} event
	 */
	function handleBatchInputChange(event) {
		const target = event.currentTarget;
		if (!(target instanceof HTMLSelectElement)) return;
		batchInput = target.value;
		if (!isRolling) syncVisibleDiceCount();
	}

	function pickDie() {
		return Math.floor(Math.random() * 6) + 1;
	}

	/**
	 * @param {number} ms
	 */
	function sleep(ms) {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	/**
	 * @param {number} rollCount
	 * @returns {{countsDelta: Record<string, number>, lastSum: number, rolls: number[]}}
	 */
	function simulateBatch(rollCount) {
		const countsDelta = Object.fromEntries(faces.map((face) => [String(face), 0]));
		let lastSum = 0;
		/** @type {number[]} */
		const rolls = [];

		for (let i = 0; i < rollCount; i += 1) {
			const value = pickDie();
			countsDelta[String(value)] += 1;
			lastSum += value;
			rolls.push(value);
		}

		return { countsDelta, lastSum, rolls };
	}

	async function submit() {
		if (isRolling) return;

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

		if (!allowedRollCounts.includes(batchInput)) {
			batchInput = '1';
			errorMessage = '한 번에 굴릴 개수는 1, 2, 3 중 하나여야 해요.';
			return;
		}

		const safeRollCount = Number.parseInt(batchInput, 10);

		isRolling = true;
		isPreviewing = true;

		const previewTimer = setInterval(() => {
			diceValues = Array.from({ length: safeRollCount }, () => pickDie());
		}, 90);

		const { countsDelta, lastSum, rolls } = simulateBatch(safeRollCount);
		await sleep(1050);
		clearInterval(previewTimer);
		isPreviewing = false;
		diceValues = [...rolls];

		const payload = {
			playerName: playerName.trim() || '동물',
			rollCount: safeRollCount,
			lastSum,
			rolls,
			countsDelta,
			createdAt: Date.now()
		};

		try {
			await ensureFirebaseAuth();
			await push(sessionEventsRef(firebaseDb, sessionId), payload);
		} catch (err) {
			errorMessage = `전송 실패: ${formatFirebaseAuthError(err)}`;
		} finally {
			isRolling = false;
			isPreviewing = false;
			syncVisibleDiceCount();
		}
	}
</script>

<section class="students-lab">
	<div class="hero">
		<h1>DICE ROLLER</h1>
		<p>주사위를 굴리면 결과가 선생님 화면으로 실시간 전송됩니다.</p>
	</div>

	<div class="dice-stage">
		<div class="dice-row" aria-live="polite">
			{#each diceValues as dieValue, index}
				<div class={`cube-wrap ${isPreviewing ? `previewing wobble-${index % 3}` : ''}`}>
					<div
						class={`cube face-${dieValue} ${isRolling ? 'rolling' : ''}`}
					>
						<div class="face one"><span class="pip"></span></div>
						<div class="face two"><span class="pip"></span><span class="pip"></span></div>
						<div class="face three"><span class="pip"></span><span class="pip"></span><span class="pip"></span></div>
						<div class="face four">
							<span class="pip"></span><span class="pip"></span><span class="pip"></span><span class="pip"></span>
						</div>
						<div class="face five">
							<span class="pip"></span><span class="pip"></span><span class="pip"></span><span class="pip"></span
							><span class="pip"></span>
						</div>
						<div class="face six">
							<span class="pip"></span><span class="pip"></span><span class="pip"></span><span class="pip"></span
							><span class="pip"></span><span class="pip"></span>
						</div>
					</div>
				</div>
			{/each}
		</div>
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

		<div class="row">
			<div class="col">
				<label class="label" for="batchInput">한번에 굴리기</label>
				<select
					id="batchInput"
					class="input count-select"
					value={batchInput}
					onchange={handleBatchInputChange}
					disabled={isRolling}
				>
					{#each allowedRollCounts as count}
						<option value={count}>{count}개</option>
					{/each}
				</select>
			</div>
			<div class="col btncol">
				<div class="label spacer" aria-hidden="true">&nbsp;</div>
				<button
					class="btn"
					onclick={submit}
					disabled={isRolling}
				>
					{isRolling ? '굴리는 중...' : '던지기'}
				</button>
			</div>
		</div>

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
		gap: 20px;
		color: #e7eeff;
	}

	select.input {
		appearance: none;
		background-image:
			linear-gradient(45deg, transparent 50%, #dbeafe 50%),
			linear-gradient(135deg, #dbeafe 50%, transparent 50%);
		background-position:
			calc(100% - 18px) calc(50% - 3px),
			calc(100% - 12px) calc(50% - 3px);
		background-size: 6px 6px, 6px 6px;
		background-repeat: no-repeat;
		padding-right: 34px;
	}

	.hero {
		text-align: center;
	}

	.hero h1 {
		margin: 0;
		font-size: clamp(2rem, 6vw, 3.2rem);
		font-weight: 900;
		letter-spacing: 0.03em;
	}

	.hero p {
		margin: 8px 0 0;
		color: #adc2ff;
		font-weight: 700;
	}

	.dice-stage {
		padding: 12px 0 8px;
		perspective: 1100px;
	}

	.dice-row {
		display: flex;
		justify-content: center;
		align-items: center;
		gap: clamp(28px, 6vw, 64px);
		flex-wrap: wrap;
	}

	.cube-wrap {
		width: clamp(84px, 18vw, 130px);
		height: clamp(84px, 18vw, 130px);
		perspective: 900px;
		filter: drop-shadow(0 22px 20px rgba(0, 0, 0, 0.34));
		transform-style: preserve-3d;
	}

	.cube-wrap.previewing {
		animation: tumbleA 0.62s ease-in-out infinite;
	}

	.cube-wrap.previewing.wobble-1 {
		animation-name: tumbleB;
	}

	.cube-wrap.previewing.wobble-2 {
		animation-name: tumbleC;
	}

	.cube {
		position: relative;
		width: 100%;
		height: 100%;
		transform-style: preserve-3d;
		transition: transform 0.22s cubic-bezier(0.2, 0.75, 0.3, 1);
	}

	.cube.rolling {
		transition: transform 0.12s linear;
	}

	.cube.face-1 {
		transform: rotateX(0deg) rotateY(0deg);
	}
	.cube.face-2 {
		transform: rotateX(-90deg) rotateY(0deg);
	}
	.cube.face-3 {
		transform: rotateX(0deg) rotateY(-90deg);
	}
	.cube.face-4 {
		transform: rotateX(0deg) rotateY(90deg);
	}
	.cube.face-5 {
		transform: rotateX(90deg) rotateY(0deg);
	}
	.cube.face-6 {
		transform: rotateX(0deg) rotateY(180deg);
	}

	.face {
		position: absolute;
		inset: 0;
		background: linear-gradient(145deg, #ffffff 0%, #f4f6fb 100%);
		border: 2px solid #dde5f8;
		border-radius: 18%;
		padding: 13%;
		box-sizing: border-box;
		display: grid;
	}

	.one {
		grid-template-columns: 1fr;
		place-items: center;
		transform: translateZ(calc(clamp(84px, 18vw, 130px) / 2));
	}

	.two {
		grid-template-columns: repeat(2, 1fr);
		grid-template-rows: repeat(2, 1fr);
		transform: rotateX(90deg) translateZ(calc(clamp(84px, 18vw, 130px) / 2));
	}

	.three {
		grid-template-columns: repeat(3, 1fr);
		grid-template-rows: repeat(3, 1fr);
		transform: rotateY(90deg) translateZ(calc(clamp(84px, 18vw, 130px) / 2));
	}

	.four {
		grid-template-columns: repeat(2, 1fr);
		grid-template-rows: repeat(2, 1fr);
		transform: rotateY(-90deg) translateZ(calc(clamp(84px, 18vw, 130px) / 2));
	}

	.five {
		grid-template-columns: repeat(3, 1fr);
		grid-template-rows: repeat(3, 1fr);
		transform: rotateX(-90deg) translateZ(calc(clamp(84px, 18vw, 130px) / 2));
	}

	.six {
		grid-template-columns: repeat(2, 1fr);
		grid-template-rows: repeat(3, 1fr);
		transform: rotateY(180deg) translateZ(calc(clamp(84px, 18vw, 130px) / 2));
	}

	.pip {
		width: 30%;
		aspect-ratio: 1;
		border-radius: 50%;
		background: radial-gradient(circle at 35% 35%, #ff6464 0%, #e11d48 70%, #9f1239 100%);
		justify-self: center;
		align-self: center;
	}

	.two .pip:nth-child(1) {
		grid-column: 1;
		grid-row: 1;
	}
	.two .pip:nth-child(2) {
		grid-column: 2;
		grid-row: 2;
	}

	.three .pip:nth-child(1) {
		grid-column: 1;
		grid-row: 1;
	}
	.three .pip:nth-child(2) {
		grid-column: 2;
		grid-row: 2;
	}
	.three .pip:nth-child(3) {
		grid-column: 3;
		grid-row: 3;
	}

	.four .pip:nth-child(1) {
		grid-column: 1;
		grid-row: 1;
	}
	.four .pip:nth-child(2) {
		grid-column: 2;
		grid-row: 1;
	}
	.four .pip:nth-child(3) {
		grid-column: 1;
		grid-row: 2;
	}
	.four .pip:nth-child(4) {
		grid-column: 2;
		grid-row: 2;
	}

	.five .pip:nth-child(1) {
		grid-column: 1;
		grid-row: 1;
	}
	.five .pip:nth-child(2) {
		grid-column: 3;
		grid-row: 1;
	}
	.five .pip:nth-child(3) {
		grid-column: 2;
		grid-row: 2;
	}
	.five .pip:nth-child(4) {
		grid-column: 1;
		grid-row: 3;
	}
	.five .pip:nth-child(5) {
		grid-column: 3;
		grid-row: 3;
	}

	.six .pip:nth-child(1) {
		grid-column: 1;
		grid-row: 1;
	}
	.six .pip:nth-child(2) {
		grid-column: 2;
		grid-row: 1;
	}
	.six .pip:nth-child(3) {
		grid-column: 1;
		grid-row: 2;
	}
	.six .pip:nth-child(4) {
		grid-column: 2;
		grid-row: 2;
	}
	.six .pip:nth-child(5) {
		grid-column: 1;
		grid-row: 3;
	}
	.six .pip:nth-child(6) {
		grid-column: 2;
		grid-row: 3;
	}

	.control-panel {
		width: min(400px, 100%);
		margin: 0 auto;
		background: rgba(19, 34, 64, 0.72);
		border: 1px solid rgba(110, 145, 235, 0.35);
		border-radius: 20px;
		padding: 16px;
		display: flex;
		flex-direction: column;
		gap: 12px;
		backdrop-filter: blur(7px);
	}

	.label {
		font-size: 0.92rem;
		font-weight: 700;
		color: #dde8ff;
		margin-bottom: 6px;
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

	.count-select {
		width: auto;
		min-width: 5.5rem;
	}

	.row {
		display: grid;
		grid-template-columns: auto auto;
		justify-content: space-between;
		align-items: end;
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
		background: linear-gradient(180deg, #6f73ff 0%, #7c3aed 100%);
		color: #ffffff;
		width: 100%;
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
		.control-panel {
			align-items: center;
		}

		.label {
			text-align: center;
		}

		.row {
			grid-template-columns: 1fr;
			align-items: stretch;
			width: 100%;
			max-width: 260px;
		}

		.students-lab {
			padding: 20px 14px 18px;
		}

		.name-input {
			width: min(100%, 12ch);
		}

		.count-select {
			min-width: 5rem;
		}

		.col {
			display: flex;
			flex-direction: column;
			align-items: center;
		}

		.btncol {
			justify-content: flex-end;
		}

		.btn {
			width: auto;
			min-width: 120px;
			padding-inline: 26px;
		}
	}

	@keyframes tumbleA {
		0% {
			transform: rotateX(0deg) rotateY(0deg) rotateZ(0deg) translateY(0);
		}
		25% {
			transform: rotateX(12deg) rotateY(-18deg) rotateZ(6deg) translateY(-3px);
		}
		50% {
			transform: rotateX(-10deg) rotateY(16deg) rotateZ(-8deg) translateY(-5px);
		}
		75% {
			transform: rotateX(9deg) rotateY(-12deg) rotateZ(4deg) translateY(-2px);
		}
		100% {
			transform: rotateX(0deg) rotateY(0deg) rotateZ(0deg) translateY(0);
		}
	}

	@keyframes tumbleB {
		0% {
			transform: rotateX(0deg) rotateY(0deg) rotateZ(0deg) translateY(0);
		}
		20% {
			transform: rotateX(-14deg) rotateY(10deg) rotateZ(-5deg) translateY(-2px);
		}
		55% {
			transform: rotateX(11deg) rotateY(-16deg) rotateZ(7deg) translateY(-5px);
		}
		80% {
			transform: rotateX(-8deg) rotateY(10deg) rotateZ(-3deg) translateY(-2px);
		}
		100% {
			transform: rotateX(0deg) rotateY(0deg) rotateZ(0deg) translateY(0);
		}
	}

	@keyframes tumbleC {
		0% {
			transform: rotateX(0deg) rotateY(0deg) rotateZ(0deg) translateY(0);
		}
		30% {
			transform: rotateX(10deg) rotateY(14deg) rotateZ(-7deg) translateY(-3px);
		}
		60% {
			transform: rotateX(-13deg) rotateY(-10deg) rotateZ(6deg) translateY(-5px);
		}
		85% {
			transform: rotateX(7deg) rotateY(9deg) rotateZ(-2deg) translateY(-2px);
		}
		100% {
			transform: rotateX(0deg) rotateY(0deg) rotateZ(0deg) translateY(0);
		}
	}
</style>

