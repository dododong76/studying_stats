<script>
    import { page } from '$app/state';
    import { push, ref } from 'firebase/database';
    import { db, missingEnvKeys } from '$lib/firebase';
    import { getRandomDiceAnimalName } from '$lib/diceAnimals';

    /** @type {import('firebase/database').Database | null} */
    const firebaseDb = db;

    let sessionId = $state(page.url.searchParams.get('session') ?? '');
    let playerName = $state(getRandomDiceAnimalName());

    let mInput = $state('50');
    let varianceInput = $state('25');
    let isSending = $state(false);
    let errorMessage = $state('');

    const chartW = 300;
    const chartH = 150;
    const margin = { top: 20, right: 10, bottom: 25, left: 10 };

    /**
     * @param {string} s
     */
    function parseFloatLocale(s) {
        return Number.parseFloat(String(s).replace(',', '.'));
    }

    let meanNum = $derived(parseFloatLocale(mInput));
    let varianceNum = $derived(parseFloatLocale(varianceInput));
    let sigmaNum = $derived(
        Number.isFinite(varianceNum) && varianceNum > 0 ? Math.sqrt(varianceNum) : NaN
    );

    let previewOk = $derived.by(() => {
        if (!Number.isFinite(meanNum)) return false;
        if (!Number.isFinite(varianceNum) || varianceNum <= 1e-15) return false;
        return true;
    });

    // --- 그래프 경로 계산 로직 ---
    let pathData = $derived.by(() => {
        if (!previewOk) return "";
        
        const points = [];
        const xMin = 0;
        const xMax = 100;
        
        // 정규분포 확률밀도함수 (PDF)
        /** @param {number} x */
        const pdf = (x) => {
            const s = sigmaNum;
            const m = meanNum;
            return (1 / (s * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * Math.pow((x - m) / s, 2));
        };

        // Y축 스케일 결정을 위한 최댓값 (평균일 때)
        const peakY = pdf(meanNum);
        const yLimit = peakY * 1.2; // 여유 공간 20%

        for (let x = xMin; x <= xMax; x += 0.5) {
            const px = margin.left + (x / xMax) * (chartW - margin.left - margin.right);
            // Y축은 뒤집혀 있으므로 (1 - 비율) 처리
            const py = (chartH - margin.bottom) - (pdf(x) / yLimit) * (chartH - margin.bottom - margin.top);
            points.push(`${px},${py}`);
        }
        
        return `M ${points.join(' L ')}`;
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
        if (!previewOk) {
            errorMessage = '평균 m은 실수로, 분산 σ²는 0보다 크게 입력해 주세요.';
            return;
        }

        isSending = true;
        const payload = {
            playerName: playerName.trim() || '학생',
            mean: meanNum,
            variance: varianceNum,
            createdAt: Date.now()
        };

        const eventsRef = ref(firebaseDb, `nDistributionSessions/${sessionId}/events`);
        try {
            await push(eventsRef, payload);
        } catch (err) {
            errorMessage = `전송 실패: ${err instanceof Error ? err.message : '오류'}`;
        } finally {
            isSending = false;
        }
    }
</script>

<div class="students-page-scroll">
    <section class="students-lab">
        <div class="hero">
            <h1>Normal Curve Lab</h1>
            <p>
                평균(m)과 분산(σ²)을 바꿔 보세요. 그래프가 실시간으로 변화합니다. (X축 범위: 0~100)
            </p>
        </div>

        <div class="formula-panel">
            <span class="dist-symbol">N</span>
            <span class="paren">(</span>
            <div class="input-group">
                <input id="mIn" class="num num-m" type="number" step="any" bind:value={mInput} />
                <span class="sub-label">평균(m)</span>
            </div>
            <span class="comma">,</span>
            <div class="input-group">
                <input
                    id="varIn"
                    class="num num-var"
                    type="number"
                    min="0.1"
                    step="any"
                    bind:value={varianceInput}
                />
                <span class="sub-label">분산(σ²)</span>
            </div>
            <span class="paren">)</span>
        </div>

        <div class="stats-display">
            {#if previewOk}
                <div class="badge-row">
                    <span class="badge">m = {meanNum.toFixed(1)}</span>
                    <span class="badge">σ = {sigmaNum.toFixed(2)}</span>
                </div>
            {:else}
                <p class="hint-text">분산은 0보다 커야 합니다.</p>
            {/if}
        </div>

        <div class="chart-container">
            {#if previewOk}
                <div class="chart-wrapper">
                    <svg width={chartW} height={chartH} viewBox="0 0 {chartW} {chartH}">
                        <line x1={margin.left} y1={chartH - margin.bottom} x2={chartW - margin.right} y2={chartH - margin.bottom} stroke="#e2e8f0" stroke-width="2" />
                        <line x1={margin.left} y1={chartH - margin.bottom} x2={margin.left} y2={margin.top} stroke="#e2e8f0" stroke-width="1" stroke-dasharray="2" />
                        
                        <text x={margin.left} y={chartH - 5} font-size="10" fill="#64748b" text-anchor="middle">0</text>
                        <text x={chartW / 2} y={chartH - 5} font-size="10" fill="#64748b" text-anchor="middle">50</text>
                        <text x={chartW - margin.right} y={chartH - 5} font-size="10" fill="#64748b" text-anchor="middle">100</text>

                        <path d={pathData} fill="none" stroke="#3b82f6" stroke-width="3" stroke-linejoin="round" />
                        
                        {#if meanNum >= 0 && meanNum <= 100}
                            {@const mx = margin.left + (meanNum / 100) * (chartW - margin.left - margin.right)}
                            <line x1={mx} y1={chartH - margin.bottom} x2={mx} y2={margin.top} stroke="#8b5cf6" stroke-width="1" stroke-dasharray="4" />
                        {/if}
                    </svg>
                </div>
            {:else}
                <div class="chart-placeholder">올바른 값을 입력하면 곡선이 나타납니다.</div>
            {/if}
        </div>

        <div class="action-panel">
            <div class="name-field">
                <label for="playerNameInput">참여 이름</label>
                <input
                    id="playerNameInput"
                    type="text"
                    class="input name-input"
                    bind:value={playerName}
                    maxlength="15"
                />
            </div>

            <button class="submit-btn" type="button" onclick={submit} disabled={isSending || !previewOk}>
                {isSending ? '전송 중...' : '그래프 제출하기'}
            </button>

            {#if errorMessage}
                <p class="error-msg">{errorMessage}</p>
            {/if}
        </div>
    </section>
</div>

<style>
    .students-page-scroll {
        width: 100%;
        max-height: 100dvh;
        overflow-y: auto;
        background: #0f172a;
    }

    .students-lab {
        padding: 32px 20px;
        display: flex;
        flex-direction: column;
        gap: 20px;
        max-width: 480px;
        margin: 0 auto;
        color: #f8fafc;
    }

    .hero h1 {
        margin: 0;
        font-size: 1.8rem;
        background: linear-gradient(to right, #60a5fa, #a78bfa);
        background-clip: text;
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        text-align: center;
        font-weight: 800;
    }

    .hero p {
        text-align: center;
        font-size: 0.9rem;
        color: #94a3b8;
        margin-top: 4px;
        line-height: 1.45;
    }

    .formula-panel {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        font-size: 1.5rem;
        background: rgba(30, 41, 59, 0.6);
        padding: 15px;
        border-radius: 20px;
        border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .dist-symbol {
        color: #60a5fa;
        font-size: 2rem;
        font-weight: bold;
    }

    .input-group {
        display: flex;
        flex-direction: column;
        align-items: center;
    }

    .sub-label {
        font-size: 0.65rem;
        color: #64748b;
    }

    .num {
        width: 70px;
        background: #1e293b;
        border: 2px solid #334155;
        border-radius: 10px;
        color: white;
        text-align: center;
        padding: 5px;
        font-size: 1.1rem;
    }

    .stats-display {
        min-height: 30px;
        display: flex;
        justify-content: center;
        align-items: center;
    }

    .badge {
        background: #334155;
        padding: 3px 10px;
        border-radius: 15px;
        font-size: 0.75rem;
        color: #e2e8f0;
        margin: 0 4px;
    }

    .chart-container {
        background: white;
        border-radius: 20px;
        padding: 15px;
        min-height: 170px;
        display: flex;
        justify-content: center;
        align-items: center;
        position: relative;
    }

    .chart-wrapper {
        width: 100%;
        text-align: center;
    }

    .hint-text {
        margin: 0;
        font-size: 0.85rem;
        color: #94a3b8;
    }

    .chart-placeholder {
        color: #64748b;
        font-size: 0.9rem;
        text-align: center;
    }

    .action-panel {
        display: flex;
        flex-direction: column;
        gap: 15px;
    }

    .name-field {
        display: flex;
        flex-direction: column;
        gap: 5px;
    }

    .input.name-input {
        background: #1e293b;
        border: 1px solid #334155;
        border-radius: 10px;
        padding: 10px;
        color: white;
    }

    .submit-btn {
        background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
        border: none;
        border-radius: 12px;
        padding: 14px;
        color: white;
        font-weight: 700;
        cursor: pointer;
        transition: transform 0.1s;
    }

    .submit-btn:active:not(:disabled) {
        transform: scale(0.98);
    }

    .submit-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .error-msg {
        color: #f87171;
        font-size: 0.8rem;
        text-align: center;
    }
</style>