<script>
	import { page } from '$app/state';
	import { onDestroy } from 'svelte';
	import { push, ref } from 'firebase/database';
	import { db, missingEnvKeys } from '$lib/firebase';
	import { getRandomDiceAnimalName } from '$lib/diceAnimals';

	/** @type {import('firebase/database').Database | null} */
	const firebaseDb = db;

	let sessionId = $state(page.url.searchParams.get('session') ?? '');
	let playerName = $state(getRandomDiceAnimalName());
	let ballCountInput = $state('500');
	let rowsInput = $state('12');
	let isSimulating = $state(false);
	let isSending = $state(false);
	let errorMessage = $state('');
	/** @type {SVGSVGElement | null} */
	let boardSvgEl = $state(null);

	const boardW = 380;
	const boardH = 620;
	const topY = 88;
	const neckY = 144;
	const funnelL = 72;
	const funnelR = boardW - 72;
	const neckL = boardW / 2 - 14;
	const neckR = boardW / 2 + 14;
	const pegTopY = 176;
	const binsTopY = boardH - 170;
	const binsBottomY = boardH - 48;
	const binsL = 52;
	const binsR = boardW - 52;
	const ballR = 3.5;
	const pegR = 3.2;

	let ballCount = $derived.by(() => Math.max(100, Math.min(1000, Number.parseInt(ballCountInput, 10) || 500)));
	let rows = $derived.by(() => Math.max(9, Math.min(14, Number.parseInt(rowsInput, 10) || 12)));

	/**
	 * @typedef {{x:number,y:number}} Peg
	 * @typedef {{x:number,y:number,targetX:number,targetY:number,step:number,path:number,r:number,hue:number,vy:number,vx:number,bounceMs:number}} ActiveBall
	 */
	/** @type {Peg[]} */
	let pegs = $state([]);
	/** @type {number[]} */
	let bins = $state([]);
	/** @type {ActiveBall[]} */
	let activeBalls = $state([]);
	let droppedCount = $state(0);
	let settledCount = $state(0);
	let rafId = 0;
	let lastTs = 0;
	let spawnMsBucket = 0;

	$effect(() => {
		bins = Array.from({ length: rows + 1 }, () => 0);
		const width = binsR - binsL;
		const h = binsTopY - pegTopY;
		/** @type {Peg[]} */
		const next = [];
		for (let r = 0; r < rows; r += 1) {
			const y = pegTopY + (r / Math.max(1, rows - 1)) * h;
			const count = r + 1;
			for (let c = 0; c < count; c += 1) {
				const x = boardW / 2 + (c - (count - 1) / 2) * (width / (rows + 1));
				next.push({ x, y });
			}
		}
		pegs = next;
		resetBoard();
	});

	let peakBin = $derived.by(() => {
		let idx = 0;
		let max = -1;
		for (let i = 0; i < bins.length; i += 1) {
			if (bins[i] > max) {
				max = bins[i];
				idx = i;
			}
		}
		return idx;
	});

	let channelLines = $derived.by(() => {
		const n = rows + 1;
		const lane = (binsR - binsL) / n;
		return Array.from({ length: n + 1 }, (_, i) => binsL + i * lane);
	});

	let curvePath = $derived.by(() => {
		if (bins.length === 0) return '';
		const max = Math.max(1, ...bins);
		const lane = (binsR - binsL) / bins.length;
		const points = bins.map((v, i) => ({
			x: binsL + i * lane + lane / 2,
			y: binsBottomY - 6 - (v / max) * 100
		}));
		return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
	});

	function resetBoard() {
		if (rafId) cancelAnimationFrame(rafId);
		bins = Array.from({ length: rows + 1 }, () => 0);
		activeBalls = [];
		droppedCount = 0;
		settledCount = 0;
		isSimulating = false;
	}

	function spawnBall() {
		const lane = (binsR - binsL) / (rows + 1);
		const dy = (binsTopY - pegTopY) / Math.max(1, rows);
		const firstRight = Math.random() < 0.5 ? 1 : -1;
		activeBalls = [
			...activeBalls,
			{
				x: boardW / 2 + (Math.random() - 0.5) * 6,
				y: topY - 16,
				targetX: boardW / 2 + firstRight * (lane / 2),
				targetY: pegTopY + dy,
				step: 0,
				path: firstRight > 0 ? 1 : 0,
				r: ballR,
				hue: 36 + Math.random() * 18,
				vy: 0,
				vx: 0,
				bounceMs: 0
			}
		];
		droppedCount += 1;
	}

	/**
	 * @param {number} ts
	 */
	function loop(ts) {
		if (!isSimulating) return;
		const dtMs = Math.min(34, ts - (lastTs || ts));
		lastTs = ts;
		const dt = dtMs / 16.6667;

		spawnMsBucket += dtMs;
		const spawnEvery = ballCount <= 300 ? 76 : ballCount <= 700 ? 62 : 52;
		while (droppedCount < ballCount && spawnMsBucket >= spawnEvery) {
			spawnMsBucket -= spawnEvery;
			spawnBall();
		}

		const lane = (binsR - binsL) / (rows + 1);
		const stepDy = (binsTopY - pegTopY) / Math.max(1, rows);
		let nextBins = bins.slice();
		/** @type {ActiveBall[]} */
		const survivors = [];

		for (let i = 0; i < activeBalls.length; i += 1) {
			const b = activeBalls[i];
			// 핀 충돌 직후에는 짧게 물리 아크(위로 튕김)로 움직이게 하고,
			// 그 외에는 기존 목표점 추적 이동을 유지한다.
			if (b.bounceMs > 0) {
				b.vy += 0.025 * dt;
				b.vx *= 0.992;
				b.x += b.vx * dt;
				b.y += b.vy * dt;
				b.bounceMs -= dtMs;
			} else {
				b.vy += 0.025 * dt;
				b.y += (0.52 + b.vy) * dt;
				b.x += (b.targetX - b.x) * 0.12 * dt;
			}

			// funnel wall block
			if (b.y >= topY && b.y <= neckY + 2) {
				const t = (b.y - topY) / Math.max(1, neckY - topY);
				const lx = funnelL + (neckL - funnelL) * t;
				const rx = funnelR + (neckR - funnelR) * t;
				if (b.x < lx + b.r) {
					b.x = lx + b.r;
					if (b.bounceMs > 0) b.vx = Math.abs(b.vx) * 0.88;
					b.targetX += 1.1;
				}
				if (b.x > rx - b.r) {
					b.x = rx - b.r;
					if (b.bounceMs > 0) b.vx = -Math.abs(b.vx) * 0.88;
					b.targetX -= 1.1;
				}
			}

			// body side walls block
			if (b.y > neckY && b.y < binsTopY) {
				const t = (b.y - neckY) / Math.max(1, binsTopY - neckY);
				const lx = neckL + (binsL + 4 - neckL) * t;
				const rx = neckR + (binsR - 4 - neckR) * t;
				if (b.x < lx + b.r) {
					b.x = lx + b.r;
					if (b.bounceMs > 0) b.vx = Math.abs(b.vx) * 0.9;
					b.targetX += 1.6;
				}
				if (b.x > rx - b.r) {
					b.x = rx - b.r;
					if (b.bounceMs > 0) b.vx = -Math.abs(b.vx) * 0.9;
					b.targetX -= 1.6;
				}
			}

			// 핀(원형 기둥)과의 실제 충돌: 공-공 충돌과 유사한 반사감
			for (const p of pegs) {
				const dxp = b.x - p.x;
				const dyp = b.y - p.y;
				if (Math.abs(dxp) > 11 || Math.abs(dyp) > 11) continue;
				const minDist = b.r + pegR;
				const distSq = dxp * dxp + dyp * dyp;
				if (distSq <= 0 || distSq >= minDist * minDist) continue;

				const dist = Math.sqrt(distSq);
				const nx = dxp / dist;
				const ny = dyp / dist;
				const overlap = minDist - dist;

				// 겹침 보정
				b.x += nx * overlap;
				b.y += ny * overlap;

				// 법선 반사(고정 물체와의 충돌)
				const vn = b.vx * nx + b.vy * ny;
				if (vn < 0) {
					const restitution = 0.84;
					b.vx -= (1 + restitution) * vn * nx;
					b.vy -= (1 + restitution) * vn * ny;
				}

				// 충돌 후 짧은 아크 유지
				b.bounceMs = Math.max(b.bounceMs, 130);
			}

			// 공-공 충돌: 동일 질량 탄성 충돌 근사
			for (let j = i + 1; j < activeBalls.length; j += 1) {
				const o = activeBalls[j];
				const dx = o.x - b.x;
				const dy = o.y - b.y;
				const minDist = b.r + o.r;
				const distSq = dx * dx + dy * dy;
				if (distSq <= 0 || distSq >= minDist * minDist) continue;

				const dist = Math.sqrt(distSq);
				const nx = dx / dist;
				const ny = dy / dist;
				const overlap = minDist - dist;

				// 겹침 분리
				b.x -= nx * (overlap * 0.5);
				b.y -= ny * (overlap * 0.5);
				o.x += nx * (overlap * 0.5);
				o.y += ny * (overlap * 0.5);

				// 속도 성분 준비(비-아크 구슬은 target 추적으로 보정)
				const bvx = b.vx + (b.targetX - b.x) * 0.04;
				const ovx = o.vx + (o.targetX - o.x) * 0.04;
				const bvy = b.vy;
				const ovy = o.vy;

				// 법선 방향 상대속도
				const relN = (ovx - bvx) * nx + (ovy - bvy) * ny;
				if (relN > 0) continue;

				const restitution = 0.82;
				const impulse = (-(1 + restitution) * relN) / 2;
				const ix = impulse * nx;
				const iy = impulse * ny;

				b.vx -= ix;
				b.vy -= iy;
				o.vx += ix;
				o.vy += iy;

				// 충돌 이후 짧게 물리 아크를 유지해 자연스럽게 튕김 표현
				b.bounceMs = Math.max(b.bounceMs, 90);
				o.bounceMs = Math.max(o.bounceMs, 90);
			}

			if (b.step < rows && b.y >= b.targetY - 0.7) {
				const goRight = Math.random() < 0.5;
				b.x = b.targetX;
				b.y = b.targetY;
				b.step += 1;
				if (goRight) b.path += 1;
				// 핀 접촉 시 상향 + 수평 반발을 주어 자연스러운 튕김 아크를 만든다.  이 부분이 반발력부분분
				b.vy = -0.5;
				b.vx = goRight ? 1.0 : -1.0;
				b.bounceMs = 170;
				if (b.step < rows) {
					b.targetX += (goRight ? 1 : -1) * (lane / 2);
					b.targetY = pegTopY + (b.step + 1) * stepDy;
				}
			}

			if (b.y >= binsTopY - 2) {
				const idx = Math.max(0, Math.min(rows, b.path));
				nextBins[idx] += 1;
				settledCount += 1;
				// 렌더 부담을 줄이기 위해 채널 내 누적 공 애니메이션은 저장하지 않음
				// (분포는 bins/curve로만 표시)
				continue;
			}
			survivors.push(b);
		}

		bins = nextBins;
		activeBalls = survivors;
		if (settledCount >= ballCount && survivors.length === 0) {
			isSimulating = false;
			return;
		}
		rafId = requestAnimationFrame(loop);
	}

	function startDrop() {
		if (isSimulating) return;
		errorMessage = '';
		resetBoard();
		isSimulating = true;
		lastTs = 0;
		spawnMsBucket = 0;
		rafId = requestAnimationFrame(loop);
	}

	function stopLoop() {
		if (rafId) cancelAnimationFrame(rafId);
		rafId = 0;
	}

	async function submit() {
		if (isSending || isSimulating) return;
		errorMessage = '';
		if (!firebaseDb) {
			const suffix = missingEnvKeys?.length ? ` (누락: ${missingEnvKeys.join(', ')})` : '';
			errorMessage = `Firebase 설정(VITE_FIREBASE_*)이 필요합니다.${suffix}`;
			return;
		}
		if (!sessionId) {
			errorMessage = '세션(session)이 필요합니다. 선생님 화면 링크를 사용하세요.';
			return;
		}
		if (settledCount === 0) {
			errorMessage = '먼저 시뮬레이션을 실행해 주세요.';
			return;
		}

		isSending = true;
		let imageDataUrl = '';
		try {
			// 전송용: 정규분포(누적분포 곡선) 그래프만 별도 SVG로 생성
			const graphW = 320;
			const graphH = 150;
			const pad = { l: 24, r: 12, t: 12, b: 24 };
			const maxBin = Math.max(1, ...bins);
			const lane = (graphW - pad.l - pad.r) / Math.max(1, bins.length);
			const points = bins.map((v, i) => {
				const x = pad.l + lane * i + lane / 2;
				const y = graphH - pad.b - (v / maxBin) * (graphH - pad.t - pad.b);
				return { x, y };
			});
			const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
			const graphSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${graphW}" height="${graphH}" viewBox="0 0 ${graphW} ${graphH}">
<rect x="0" y="0" width="${graphW}" height="${graphH}" rx="12" fill="#ffffff"/>
<line x1="${pad.l}" y1="${graphH - pad.b}" x2="${graphW - pad.r}" y2="${graphH - pad.b}" stroke="#cbd5e1" stroke-width="2"/>
<line x1="${pad.l}" y1="${pad.t}" x2="${pad.l}" y2="${graphH - pad.b}" stroke="#e2e8f0" stroke-width="1"/>
<path d="${d}" fill="none" stroke="#f59e0b" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>
<text x="${graphW / 2}" y="${graphH - 6}" text-anchor="middle" font-size="11" fill="#475569">Galton Distribution</text>
</svg>`;
			imageDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(graphSvg)}`;

			await push(ref(firebaseDb, `galtonSessions/${sessionId}/events`), {
				playerName: playerName.trim() || '학생',
				ballCount,
				rows,
				bins,
				peakBin,
				imageDataUrl,
				createdAt: Date.now()
			});
		} catch (err) {
			errorMessage = `전송 실패: ${err instanceof Error ? err.message : '오류'}`;
		} finally {
			isSending = false;
		}
	}

	onDestroy(() => {
		stopLoop();
	});
</script>

<div class="students-page-scroll">
	<section class="students-lab">
		<div class="hero">
			<h1>Galton Board Lab</h1>
			<p>각 핀에서 좌/우로 분기하며 누적되는 이항분포를 관찰해 보세요.</p>
		</div>

		<div class="board-frame">
			<svg bind:this={boardSvgEl} width={boardW} height={boardH} viewBox={`0 0 ${boardW} ${boardH}`}>
				<rect x="0" y="0" width={boardW} height={boardH} rx="16" fill="#1e3a8a" />
				<rect x="10" y="10" width={boardW - 20} height={boardH - 20} rx="14" fill="#c8a47e" />
				<rect x="22" y="22" width={boardW - 44} height={boardH - 44} rx="12" fill="#eef2f7" />

				<line x1="30" y1="22" x2="30" y2={boardH - 22} stroke="#1d4ed8" stroke-width="8" />
				<line x1={boardW - 30} y1="22" x2={boardW - 30} y2={boardH - 22} stroke="#1d4ed8" stroke-width="8" />

				<!-- <line x1={funnelL} y1={topY} x2={funnelR} y2={topY} stroke="#111827" stroke-width="4" /> -->
				<line x1={funnelL-30} y1={topY-30} x2={neckL} y2={neckY+2} stroke="#111827" stroke-width="4" />
				<line x1={funnelR+30} y1={topY-30} x2={neckR} y2={neckY+2} stroke="#111827" stroke-width="4" />
				<!-- <line x1={neckL} y1={neckY} x2={neckR} y2={neckY} stroke="#111827" stroke-width="4" /> -->
				<!-- 밑부분 -->
				<line x1={neckL} y1={neckY} x2={binsL -5} y2={binsTopY} stroke="#111827" stroke-width="3" />
				<line x1={neckR} y1={neckY} x2={binsR +5} y2={binsTopY} stroke="#111827" stroke-width="3" />

				{#each pegs as peg}
					<circle cx={peg.x} cy={peg.y} r={pegR} fill="#94a3b8" />
				{/each}

				{#each channelLines as x}
					<line x1={x} y1={binsTopY} x2={x} y2={binsBottomY} stroke="#cbd5e1" stroke-width="4.4" />
				{/each}

				{#if curvePath}
					<path d={curvePath} fill="none" stroke="#f59e0b" stroke-width="2.6" opacity="0.9" />
				{/if}

				{#each activeBalls as b}
					<circle cx={b.x} cy={b.y} r={b.r} fill={`hsl(${b.hue} 92% 54%)`} />
				{/each}

				<text x={boardW / 2} y={boardH - 14} text-anchor="middle" fill="#0f172a" font-size="12" font-weight="700">
					진행 {settledCount}/{ballCount}
				</text>
			</svg>
		</div>

		<div class="controls">
			<div class="field">
				<label for="ballCountInput">구슬 개수: {ballCount}개</label>
				<input id="ballCountInput" type="range" min="100" max="1000" step="10" bind:value={ballCountInput} />
			</div>
			<div class="field">
				<label for="rowsInput">핀 줄 수: {rows}줄</label>
				<input id="rowsInput" type="range" min="9" max="14" step="1" bind:value={rowsInput} />
			</div>
			<div class="field">
				<label for="playerNameInput">참여 이름</label>
				<input id="playerNameInput" class="text-input" type="text" maxlength="15" bind:value={playerName} />
			</div>
			<div class="button-row">
				<button class="run-btn" type="button" onclick={startDrop} disabled={isSimulating}>
					{isSimulating ? '실행 중...' : '시뮬레이션 시작'}
				</button>
				<button class="submit-btn" type="button" onclick={submit} disabled={isSimulating || isSending}>
					{isSending ? '전송 중...' : '결과 제출'}
				</button>
			</div>
			{#if errorMessage}
				<p class="error-msg">{errorMessage}</p>
			{/if}
		</div>
	</section>
</div>

<style>
	.students-page-scroll { width: 100%; max-height: 100dvh; overflow-y: auto; background: #0f172a; }
	.students-lab { max-width: 520px; margin: 0 auto; padding: 16px 12px 20px; display: flex; flex-direction: column; gap: 12px; color: #f8fafc; }
	.hero h1 { margin: 0; text-align: center; font-size: 1.65rem; font-weight: 900; background: linear-gradient(to right, #93c5fd, #dbeafe); background-clip: text; -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
	.hero p { margin: 4px 0 0; text-align: center; color: #cbd5e1; font-size: 0.82rem; }
	.board-frame { background: #1e293b; border-radius: 16px; padding: 8px; box-shadow: 0 12px 28px rgba(0,0,0,0.4); }
	svg { width: 100%; height: auto; display: block; border-radius: 10px; }
	.controls { background: #1e293b; border: 1px solid #334155; border-radius: 14px; padding: 12px; display: flex; flex-direction: column; gap: 10px; }
	.field label { display: block; color: #e2e8f0; font-size: 0.82rem; font-weight: 700; margin-bottom: 4px; }
	input[type='range'] { width: 100%; accent-color: #3b82f6; }
	.text-input { width: 100%; box-sizing: border-box; background: #0f172a; border: 1px solid #334155; border-radius: 10px; padding: 9px 10px; color: #f8fafc; }
	.button-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
	button { border: none; border-radius: 10px; padding: 11px 8px; font-weight: 800; cursor: pointer; color: #fff; }
	.run-btn { background: linear-gradient(135deg, #3b82f6, #1d4ed8); }
	.submit-btn { background: linear-gradient(135deg, #f59e0b, #ea580c); }
	button:disabled { opacity: 0.55; cursor: not-allowed; }
	.error-msg { margin: 0; color: #fca5a5; font-size: 0.8rem; }
</style>
