<script>
	import { page } from '$app/state';
	import { push, ref } from 'firebase/database';
	import { db, missingEnvKeys } from '$lib/firebase';
	import { getRandomDiceAnimalName } from '$lib/diceAnimals';

	const faces = Array.from({ length: 6 }, (_, i) => i + 1);
	const rollCount = 10;

	/** @type {import('firebase/database').Database | null} */
	const firebaseDb = db;

	let sessionId = $state(page.url.searchParams.get('session') ?? '');
	let playerName = $state(getRandomDiceAnimalName());
	let isRolling = $state(false);
	let isPreviewing = $state(false);
	let errorMessage = $state('');
	let diceValues = $state(Array.from({ length: rollCount }, () => 1));
	let lastSumResult = $state(/** @type {number | null} */ (null));

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
	 * @returns {{countsDelta: Record<string, number>, lastSum: number, rolls: number[]}}
	 */
	function simulateBatch() {
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

		isRolling = true;
		isPreviewing = true;
		lastSumResult = null;

		const previewTimer = setInterval(() => {
			diceValues = Array.from({ length: rollCount }, () => pickDie());
		}, 90);

		const { countsDelta, lastSum, rolls } = simulateBatch();
		await sleep(1050);
		clearInterval(previewTimer);
		isPreviewing = false;
		diceValues = [...rolls];
		lastSumResult = lastSum;

		const payload = {
			playerName: playerName.trim() || '동물',
			rollCount,
			lastSum,
			rolls,
			countsDelta,
			createdAt: Date.now()
		};

		const eventsRef = ref(firebaseDb, `dice10Sessions/${sessionId}/events`);
		try {
			await push(eventsRef, payload);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			errorMessage = `전송 실패: ${message}`;
		} finally {
			isRolling = false;
			isPreviewing = false;
		}
	}
</script>

<section class="students-lab">
	<div class="hero">
		<h1>주사위 10개의 합 구하기</h1>
		<p>주사위 10개를 한 번에 굴려 합을 선생님 화면으로 전송합니다.</p>
	</div>

	<div class="dice-stage">
		<div class="dice-grid" aria-live="polite">
			{#each [0, 1] as row}
				<div class="dice-row">
					{#each diceValues.slice(row * 5, row * 5 + 5) as dieValue, col}
						{@const index = row * 5 + col}
						<div class={`cube-wrap ${isPreviewing ? `previewing wobble-${index % 3}` : ''}`}>
							<div class={`cube face-${dieValue} ${isRolling ? 'rolling' : ''}`}>
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
			{/each}
		</div>
	</div>
	<p class="sum-result" class:sum-result--hidden={lastSumResult === null || isRolling}>
		합: <strong>{lastSumResult ?? '-'}</strong>
	</p>

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

		<button class="btn" type="button" onclick={submit} disabled={isRolling}>
			{isRolling ? '굴리는 중...' : '주사위 10개 던지기'}
		</button>

		{#if errorMessage}
			<div class="error">{errorMessage}</div>
		{/if}
	</div>
</section>

<style>
	.students-lab {
		--cube: clamp(38px, 7.2vw, 54px);
		min-height: calc(100vh - 120px);
		padding: 22px 14px 20px;
		border-radius: 18px;
		background:
			radial-gradient(100% 65% at 50% 0%, rgba(76, 120, 255, 0.22) 0%, rgba(8, 20, 45, 0) 75%),
			linear-gradient(180deg, #0d1730 0%, #091127 100%);
		display: flex;
		flex-direction: column;
		gap: 14px;
		color: #e7eeff;
	}

	.hero {
		text-align: center;
	}

	.hero h1 {
		margin: 0;
		font-size: clamp(1.65rem, 5vw, 2.4rem);
		font-weight: 900;
		letter-spacing: 0.03em;
	}

	.hero p {
		margin: 6px 0 0;
		color: #adc2ff;
		font-weight: 700;
		font-size: 0.92rem;
		line-height: 1.45;
	}

	.dice-stage {
		padding: 6px 0 4px;
		perspective: 900px;
	}

	.dice-grid {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		width: 100%;
		max-width: 420px;
		margin: 0 auto;
	}

	.dice-row {
		display: flex;
		justify-content: center;
		align-items: center;
		gap: 10px 12px;
		flex-wrap: nowrap;
		width: 100%;
	}

	.cube-wrap {
		width: var(--cube);
		height: var(--cube);
		perspective: 700px;
		filter: drop-shadow(0 12px 12px rgba(0, 0, 0, 0.32));
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
		padding: 12%;
		box-sizing: border-box;
		display: grid;
	}

	.one {
		grid-template-columns: 1fr;
		place-items: center;
		transform: translateZ(calc(var(--cube) / 2));
	}

	.two {
		grid-template-columns: repeat(2, 1fr);
		grid-template-rows: repeat(2, 1fr);
		transform: rotateX(90deg) translateZ(calc(var(--cube) / 2));
	}

	.three {
		grid-template-columns: repeat(3, 1fr);
		grid-template-rows: repeat(3, 1fr);
		transform: rotateY(90deg) translateZ(calc(var(--cube) / 2));
	}

	.four {
		grid-template-columns: repeat(2, 1fr);
		grid-template-rows: repeat(2, 1fr);
		transform: rotateY(-90deg) translateZ(calc(var(--cube) / 2));
	}

	.five {
		grid-template-columns: repeat(3, 1fr);
		grid-template-rows: repeat(3, 1fr);
		transform: rotateX(-90deg) translateZ(calc(var(--cube) / 2));
	}

	.six {
		grid-template-columns: repeat(2, 1fr);
		grid-template-rows: repeat(3, 1fr);
		transform: rotateY(180deg) translateZ(calc(var(--cube) / 2));
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
		padding: 14px;
		display: flex;
		flex-direction: column;
		gap: 10px;
		backdrop-filter: blur(7px);
	}

	.sum-result {
		margin: 0;
		text-align: center;
		font-size: 1.05rem;
		font-weight: 800;
		color: #dbeafe;
		min-height: 1.6rem;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.sum-result--hidden {
		visibility: hidden;
	}

	.label {
		font-size: 0.88rem;
		font-weight: 700;
		color: #dde8ff;
		margin-bottom: 4px;
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
		font-size: 0.88rem;
	}

	@media (max-width: 920px) {
		.students-lab {
			padding: 18px 12px 16px;
		}

		.control-panel {
			align-items: center;
		}

		.label {
			text-align: center;
		}

		.name-input {
			width: min(100%, 12ch);
		}
	}

	@keyframes tumbleA {
		0% {
			transform: rotateX(0deg) rotateY(0deg) rotateZ(0deg) translateY(0);
		}
		25% {
			transform: rotateX(12deg) rotateY(-18deg) rotateZ(6deg) translateY(-2px);
		}
		50% {
			transform: rotateX(-10deg) rotateY(16deg) rotateZ(-8deg) translateY(-4px);
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
			transform: rotateX(11deg) rotateY(-16deg) rotateZ(7deg) translateY(-4px);
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
			transform: rotateX(10deg) rotateY(14deg) rotateZ(-7deg) translateY(-2px);
		}
		60% {
			transform: rotateX(-13deg) rotateY(-10deg) rotateZ(6deg) translateY(-4px);
		}
		85% {
			transform: rotateX(7deg) rotateY(9deg) rotateZ(-2deg) translateY(-2px);
		}
		100% {
			transform: rotateX(0deg) rotateY(0deg) rotateZ(0deg) translateY(0);
		}
	}
</style>
