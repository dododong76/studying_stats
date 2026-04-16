<script>
	const binCount = 21;
	const minX = -3;
	const maxX = 3;
	const step = (maxX - minX) / binCount;
	const bins = Array.from({ length: binCount }, (_, i) => ({
		index: i,
		center: minX + step * (i + 0.5)
	}));

	let frequencies = $state(Array.from({ length: binCount }, () => 0));
	let totalSamples = $state(0);
	let sampleInput = $state('1000');
	let isSampling = $state(false);

	function gaussianSample() {
		const u1 = Math.max(Math.random(), Number.EPSILON);
		const u2 = Math.random();
		return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
	}

	/** @param {number} value */
	function toBinIndex(value) {
		const raw = Math.floor(((value - minX) / (maxX - minX)) * binCount);
		return Math.max(0, Math.min(binCount - 1, raw));
	}

	async function sampleOne() {
		if (isSampling) return;
		isSampling = true;

		const value = gaussianSample();
		const index = toBinIndex(value);
		const next = [...frequencies];
		next[index] += 1;
		frequencies = next;
		totalSamples += 1;

		await new Promise((resolve) => setTimeout(resolve, 120));
		isSampling = false;
	}

	async function sampleMany() {
		if (isSampling) return;

		const batch = Number.parseInt(sampleInput, 10);
		if (!Number.isFinite(batch) || batch < 1) {
			sampleInput = '1000';
			return;
		}

		const safeBatch = Math.min(batch, 200000);
		isSampling = true;

		const next = [...frequencies];
		for (let i = 0; i < safeBatch; i += 1) {
			const value = gaussianSample();
			const index = toBinIndex(value);
			next[index] += 1;
		}
		frequencies = next;
		totalSamples += safeBatch;

		await new Promise((resolve) => setTimeout(resolve, 150));
		isSampling = false;
	}

	function resetSamples() {
		frequencies = Array.from({ length: binCount }, () => 0);
		totalSamples = 0;
	}

	let maxFrequency = $derived(Math.max(1, ...frequencies));
</script>

<section class="students-lab">
	<div class="header">
		<h1>정규분포 실험</h1>
		<p>버튼을 눌러 표본을 누적하면 히스토그램이 종 모양(정규분포)에 가까워집니다.</p>
	</div>

	<div class="histogram">
		{#each bins as bin}
			<div class="bin">
				<div class="track">
					<div class="fill" style={`height: ${(frequencies[bin.index] / maxFrequency) * 100}%`}></div>
				</div>
				<div class="xlabel">{bin.center.toFixed(1)}</div>
			</div>
		{/each}
	</div>

	<div class="controls">
		<button onclick={sampleOne} disabled={isSampling}>표본 1개 추가</button>
		<div class="batch">
			<input type="number" min="1" max="200000" bind:value={sampleInput} disabled={isSampling} />
			<button class="sky" onclick={sampleMany} disabled={isSampling}>
				입력 횟수만큼 추가
			</button>
		</div>
		<button class="ghost" onclick={resetSamples} disabled={isSampling}>초기화</button>
	</div>

	<div class="summary">
		총 표본 수: <strong>{totalSamples}</strong>
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

	.histogram {
		display: grid;
		grid-template-columns: repeat(21, minmax(20px, 1fr));
		gap: 6px;
		min-height: 420px;
		padding: 12px;
		border-radius: 10px;
		border: 1px solid #bae6fd;
		background: #f8fdff;
	}

	.bin {
		display: grid;
		grid-template-rows: 1fr auto;
		gap: 6px;
	}

	.track {
		height: 360px;
		padding: 3px;
		border-radius: 8px;
		background: #dbeafe;
		display: flex;
		align-items: flex-end;
	}

	.fill {
		width: 100%;
		min-height: 2px;
		border-radius: 6px;
		background: linear-gradient(180deg, #0ea5e9 0%, #0369a1 100%);
		transition: height 0.25s ease;
	}

	.xlabel {
		text-align: center;
		font-size: 0.72rem;
		color: #334155;
	}

	.controls {
		display: grid;
		grid-template-columns: 1fr 1.4fr 1fr;
		gap: 10px;
	}

	.batch {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
	}

	button,
	input {
		border-radius: 10px;
		border: 1px solid #94a3b8;
		padding: 10px 12px;
		font-size: 0.95rem;
	}

	button {
		border: 0;
		color: #fff;
		background: linear-gradient(180deg, #4f46e5 0%, #4338ca 100%);
		font-weight: 700;
		cursor: pointer;
	}

	.sky {
		background: linear-gradient(180deg, #0ea5e9 0%, #0369a1 100%);
	}

	.ghost {
		background: #e2e8f0;
		color: #0f172a;
	}

	.summary {
		color: #0f172a;
	}

	@media (max-width: 980px) {
		.controls {
			grid-template-columns: 1fr;
		}

		.batch {
			grid-template-columns: 1fr;
		}
	}
</style>
