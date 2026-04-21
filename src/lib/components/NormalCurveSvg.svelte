<script>
	/**
	 * 정규분포 N(μ, σ²) 확률밀도함수 곡선 (σ² = variance).
	 * 학생 랩(/N_distribution/students)과 동일: X축 0~100, Y는 평균에서의 피크 기준 1.2배로 스케일.
	 * @typedef {{ mean: number, variance: number, width?: number, height?: number, class?: string }} NormalCurveProps
	 */
	/** @type {NormalCurveProps} */
	let {
		mean,
		variance,
		width = 280,
		height = 140,
		class: className = ''
	} = $props();

	/**
	 * @param {number} x
	 * @param {number} mu
	 * @param {number} sigma
	 */
	function normalPdf(x, mu, sigma) {
		const s = sigma > 1e-15 ? sigma : 1e-15;
		const z = (x - mu) / s;
		return (1 / (s * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * z * z);
	}

	/** 학생 랩 chart (300×150)과 동일 비율의 여백 */
	const LAB_CHART_W = 300;
	const LAB_CHART_H = 150;
	const LAB_MARGIN = { top: 20, right: 10, bottom: 25, left: 10 };

	let paths = $derived.by(() => {
		const mu = Number(mean);
		const v = Number(variance);
		const sigma = Math.sqrt(Math.max(v, 1e-12));

		const w = width;
		const h = height;
		const ml = LAB_MARGIN.left * (w / LAB_CHART_W);
		const mr = LAB_MARGIN.right * (w / LAB_CHART_W);
		const mt = LAB_MARGIN.top * (h / LAB_CHART_H);
		const mb = LAB_MARGIN.bottom * (h / LAB_CHART_H);

		const xMin = 0;
		const xMax = 100;
		const peakY = normalPdf(mu, mu, sigma);
		const yLimit = peakY * 1.2;

		const innerW = w - ml - mr;
		const innerH = h - mt - mb;
		const baseY = h - mb;

		/** @param {number} x */
		const pdf = (x) => normalPdf(x, mu, sigma);

		const points = [];
		for (let x = xMin; x <= xMax; x += 0.5) {
			const px = ml + (x / xMax) * innerW;
			const py = baseY - (pdf(x) / yLimit) * innerH;
			points.push({ px, py });
		}

		const lineCoords = points.map((p) => `${p.px.toFixed(2)} ${p.py.toFixed(2)}`);
		const dLine = `M ${lineCoords[0]} L ${lineCoords.slice(1).join(' L ')}`;
		const firstX = points[0].px;
		const lastX = points[points.length - 1].px;
		const dArea = `M ${firstX.toFixed(2)} ${baseY.toFixed(2)} L ${lineCoords.join(' L ')} L ${lastX.toFixed(2)} ${baseY.toFixed(2)} Z`;

		let meanLine = null;
		if (mu >= 0 && mu <= xMax) {
			const mx = ml + (mu / xMax) * innerW;
			meanLine = { x1: mx, y1: baseY, x2: mx, y2: mt };
		}

		return { dLine, dArea, meanLine };
	});
</script>

<svg
	class={['normal-curve-svg', className].filter(Boolean).join(' ')}
	viewBox="0 0 {width} {height}"
	width={width}
	height={height}
	role="img"
	aria-label={`정규분포 평균 ${mean}, 분산 ${variance}`}
>
	<line
		x1={LAB_MARGIN.left * (width / LAB_CHART_W)}
		y1={height - LAB_MARGIN.bottom * (height / LAB_CHART_H)}
		x2={width - LAB_MARGIN.right * (width / LAB_CHART_W)}
		y2={height - LAB_MARGIN.bottom * (height / LAB_CHART_H)}
		stroke="#e2e8f0"
		stroke-width="2"
	/>
	<line
		x1={LAB_MARGIN.left * (width / LAB_CHART_W)}
		y1={height - LAB_MARGIN.bottom * (height / LAB_CHART_H)}
		x2={LAB_MARGIN.left * (width / LAB_CHART_W)}
		y2={LAB_MARGIN.top * (height / LAB_CHART_H)}
		stroke="#e2e8f0"
		stroke-width="1"
		stroke-dasharray="2"
	/>
	{#if paths.meanLine}
		<line
			x1={paths.meanLine.x1}
			y1={paths.meanLine.y1}
			x2={paths.meanLine.x2}
			y2={paths.meanLine.y2}
			stroke="#8b5cf6"
			stroke-width="1"
			stroke-dasharray="4"
		/>
	{/if}
	<path class="normal-curve-svg__area" d={paths.dArea} fill="rgba(99, 102, 241, 0.22)" />
	<path
		class="normal-curve-svg__line"
		d={paths.dLine}
		fill="none"
		stroke="#3b82f6"
		stroke-width="3"
		stroke-linecap="round"
		stroke-linejoin="round"
	/>
</svg>

<style>
	.normal-curve-svg {
		display: block;
		width: 100%;
		height: auto;
		max-width: 100%;
	}

	.normal-curve-svg__line {
		vector-effect: non-scaling-stroke;
	}
</style>
