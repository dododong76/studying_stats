<script>
	const sums = Array.from({ length: 11 }, (_, i) => i + 2);
	let counts = $state(Object.fromEntries(sums.map((sum) => [sum, 0])));
	let totalRolls = $state(0);
	let dieA = $state(1);
	let dieB = $state(1);
	let isRolling = $state(false);
	let batchInput = $state('1000');

	const dieFaces = ['\u2680', '\u2681', '\u2682', '\u2683', '\u2684', '\u2685'];

	function pickDie() {
		return Math.floor(Math.random() * 6) + 1;
	}

	async function rollDice() {
		if (isRolling) return;
		isRolling = true;

		for (let i = 0; i < 12; i += 1) {
			dieA = pickDie();
			dieB = pickDie();
			await new Promise((resolve) => setTimeout(resolve, 55));
		}

		const sum = dieA + dieB;
		counts = { ...counts, [sum]: counts[sum] + 1 };
		totalRolls += 1;
		isRolling = false;
	}

	async function rollManyDice() {
		if (isRolling) return;

		const batchCount = Number.parseInt(batchInput, 10);
		if (!Number.isFinite(batchCount) || batchCount < 1) {
			batchInput = '1000';
			return;
		}

		const safeBatch = Math.min(batchCount, 100000);
		isRolling = true;

		for (let i = 0; i < 8; i += 1) {
			dieA = pickDie();
			dieB = pickDie();
			await new Promise((resolve) => setTimeout(resolve, 40));
		}

		const nextCounts = { ...counts };
		for (let i = 0; i < safeBatch; i += 1) {
			const sum = pickDie() + pickDie();
			nextCounts[sum] += 1;
		}

		counts = nextCounts;
		totalRolls += safeBatch;
		isRolling = false;
	}

	function resetStats() {
		counts = Object.fromEntries(sums.map((sum) => [sum, 0]));
		totalRolls = 0;
		dieA = 1;
		dieB = 1;
	}

	let maxCount = $derived(Math.max(1, ...Object.values(counts)));
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
	</div>

	<div class="right-panel">
		<h2>주사위 실험</h2>
		<div class="dice-wrap">
			<div class:rolling={isRolling} class="die">{dieFaces[dieA - 1]}</div>
			<div class:rolling={isRolling} class="die">{dieFaces[dieB - 1]}</div>
		</div>
		<div class="sum-text">현재 합: {dieA + dieB}</div>
		<button onclick={rollDice} disabled={isRolling}>
			{isRolling ? '던지는 중...' : '주사위 2개 던지기'}
		</button>

		<div class="batch-control">
			<label for="batch-count">한 번에 던질 횟수</label>
			<input
				id="batch-count"
				type="number"
				min="1"
				max="100000"
				step="1"
				bind:value={batchInput}
				disabled={isRolling}
			/>
			<button class="batch-btn" onclick={rollManyDice} disabled={isRolling}>
				입력 횟수만큼 한 번에 던지기
			</button>
			<div class="hint">예: 1000, 10000 (최대 100000)</div>
		</div>

		<button class="ghost" onclick={resetStats} disabled={isRolling}>통계 초기화</button>
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

	h2 {
		margin: 0;
		font-size: 1.05rem;
	}

	.dice-wrap {
		display: flex;
		gap: 14px;
	}

	.die {
		width: 82px;
		height: 82px;
		display: grid;
		place-items: center;
		border-radius: 14px;
		font-size: 2.1rem;
		background: #ffffff;
		border: 1px solid #c7d2fe;
		box-shadow: 0 8px 18px rgba(79, 70, 229, 0.15);
	}

	.die.rolling {
		animation: shake 0.3s ease-in-out infinite;
	}

	@keyframes shake {
		0% {
			transform: rotate(0deg) translateY(0);
		}
		25% {
			transform: rotate(-8deg) translateY(-2px);
		}
		50% {
			transform: rotate(8deg) translateY(0);
		}
		75% {
			transform: rotate(-6deg) translateY(2px);
		}
		100% {
			transform: rotate(0deg) translateY(0);
		}
	}

	.sum-text {
		font-weight: 700;
		color: #312e81;
	}

	button {
		border: 0;
		border-radius: 10px;
		padding: 10px 14px;
		font-weight: 700;
		cursor: pointer;
		background: linear-gradient(180deg, #4f46e5 0%, #4338ca 100%);
		color: #ffffff;
		width: 100%;
	}

	button:disabled {
		opacity: 0.7;
		cursor: not-allowed;
	}

	.ghost {
		background: #e2e8f0;
		color: #0f172a;
	}

	.batch-control {
		width: 100%;
		padding: 12px;
		border: 1px solid #c7d2fe;
		border-radius: 12px;
		background-color: #f8fafc;
	}

	label {
		display: block;
		font-size: 0.88rem;
		font-weight: 600;
		margin-bottom: 8px;
		color: #334155;
	}

	input {
		width: 100%;
		box-sizing: border-box;
		padding: 10px 12px;
		border-radius: 10px;
		border: 1px solid #94a3b8;
		margin-bottom: 10px;
		font-size: 1rem;
	}

	.batch-btn {
		background: linear-gradient(180deg, #0ea5e9 0%, #0369a1 100%);
	}

	.hint {
		margin-top: 8px;
		font-size: 0.78rem;
		color: #475569;
	}

	@media (max-width: 920px) {
		.teacher-lab {
			grid-template-columns: 1fr;
		}
	}
</style>
