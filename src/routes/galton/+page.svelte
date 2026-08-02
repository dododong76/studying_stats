<script>
    import { onDestroy, onMount } from 'svelte';
    import { page } from '$app/state';
    import { onValue } from 'firebase/database';
    import { PhoneQrFrame, TeacherHelpFab } from '$lib';
    import { db, ensureFirebaseAuth, formatFirebaseAuthError, missingEnvKeys, sessionEventsRef } from '$lib/firebase';

    /**
     * @typedef {{
     *   id: string,
     *   playerName: string,
     *   ballCount: number,
     *   rows: number,
     *   bins: number[],
     *   imageDataUrl?: string,
     *   createdAt: number
     * }} GaltonEvent
     */

    /** @type {import('firebase/database').Database | null} */
    const firebaseDb = db;

    let sessionId = $state(page.url.searchParams.get('session') ?? '');
    let studentLink = $state('');
    let studentUrl = $state('');
    /** @type {GaltonEvent[]} */
    let events = $state([]);
    let errorMessage = $state('');
    /** @type {null | (() => void)} */
    let unsubscribe = null;

    // 통합 평균 그래프 모달 상태
    let showAverageModal = $state(false);

    function generateSessionId() {
        if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
        return `sess_${Math.random().toString(36).slice(2)}_${Date.now()}`;
    }

    /**
     * @param {Record<string, any> | null} raw
     */
    function hydrate(raw) {
        /** @type {GaltonEvent[]} */
        const next = [];
        if (raw) {
            for (const [id, value] of Object.entries(raw)) {
                if (!value || typeof value !== 'object') continue;
                next.push({
                    id,
                    playerName: String(value.playerName ?? '학생'),
                    ballCount: Number(value.ballCount ?? 0) || 0,
                    rows: Number(value.rows ?? 0) || 0,
                    bins: Array.isArray(value.bins)
                        ? value.bins.map((/** @type {unknown} */ v) => Number(v) || 0)
                        : [],
                    imageDataUrl: typeof value.imageDataUrl === 'string' ? value.imageDataUrl : undefined,
                    createdAt: Number(value.createdAt ?? 0) || 0
                });
            }
        }
        next.sort((a, b) => b.createdAt - a.createdAt);
        events = next.slice(0, 240);
    }

    /** @type {string[]} */
    let summaryLines = $derived.by(() =>
        events
            .slice(0, 12)
            .map((ev) => `${ev.playerName}님이 결과를 제출했습니다. (구슬 ${ev.ballCount}개 · 핀 ${ev.rows}줄)`)
    );

    // 제출된 데이터를 바탕으로 평균 빈(bin) 분포 계산
    let averageData = $derived.by(() => {
        const validEvents = events.filter((e) => e.bins && e.bins.length > 0);
        if (validEvents.length === 0) return { bins: [], maxVal: 0, totalBalls: 0, avgBallCount: 0, totalCount: 0 };

        // 가장 빈 수가 많은 데이터 기준으로 길이 설정
        const maxBinsLen = Math.max(...validEvents.map((e) => e.bins.length));
        const sums = new Array(maxBinsLen).fill(0);

        validEvents.forEach((ev) => {
            ev.bins.forEach((val, idx) => {
                sums[idx] += val;
            });
        });

        const averages = sums.map((sum) => Number((sum / validEvents.length).toFixed(1)));
        const maxVal = Math.max(...averages, 1);
        const totalBalls = validEvents.reduce((acc, ev) => acc + ev.ballCount, 0);
        const avgBallCount = Math.round(totalBalls / validEvents.length);

        return {
            bins: averages,
            maxVal,
            totalCount: validEvents.length,
            avgBallCount
        };
    });

    // SVG 꺾은선 그래프 경로 계산
    let avgSvgPath = $derived.by(() => {
        const bins = averageData.bins;
        if (bins.length === 0) return '';
        const width = 500;
        const height = 220;
        const padding = 20;
        const max = averageData.maxVal;

        const step = (width - padding * 2) / Math.max(bins.length - 1, 1);

        const points = bins.map((val, idx) => {
            const x = padding + idx * step;
            const y = height - padding - (val / max) * (height - padding * 2);
            return `${x},${y}`;
        });

        return `M ${points.join(' L ')}`;
    });

    onMount(() => {
        if (!sessionId) {
            sessionId = generateSessionId();
            const url = new URL(window.location.href);
            url.searchParams.set('session', sessionId);
            window.history.replaceState({}, '', url.toString());
        }

        studentLink = `/galton/students?session=${encodeURIComponent(sessionId)}`;
        studentUrl = new URL(studentLink, window.location.origin).toString();

        if (!firebaseDb) {
            const suffix = missingEnvKeys?.length ? ` (누락: ${missingEnvKeys.join(', ')})` : '';
            errorMessage = `Firebase 설정(VITE_FIREBASE_*)이 필요합니다.${suffix}`;
            return;
        }

        void (async () => {
            try {
                await ensureFirebaseAuth();
            } catch (error) {
                errorMessage = `인증 초기화 실패: ${formatFirebaseAuthError(error)}`;
                return;
            }

            const eventsRef = sessionEventsRef(firebaseDb, sessionId);
            unsubscribe = onValue(
                eventsRef,
                (snapshot) => {
                    errorMessage = '';
                    hydrate(snapshot.val());
                },
                (err) => {
                    errorMessage = `실시간 구독 실패: ${err instanceof Error ? err.message : String(err)}`;
                }
            );
        })();
    });

    onDestroy(() => {
        unsubscribe?.();
    });
</script>

<section class="teacher-lab">
    <TeacherHelpFab title="갈톤 보드 안내">
        <h3>1. 무엇을 보나요?</h3>
        <p>학생들이 제출한 갈톤 보드 시뮬레이션(캡처·구슬 수·핀 줄 수)이 카드로 모입니다. 「통합 평균 그래프 보기」로 반 전체 평균 분포를 볼 수 있습니다.</p>
        <h3>2. 참여 방법</h3>
        <p>오른쪽 QR 코드로 학생 화면에 들어가 시뮬레이션 후 결과를 제출하면 왼쪽 카드 목록이 갱신됩니다.</p>
    </TeacherHelpFab>

    <div class="left-panel">
        <div class="panel-header">
            <div class="header-title-row">
                <h1>갈톤 보드 (이항분포)</h1>
                <button
                    class="avg-btn"
                    type="button"
                    onclick={() => (showAverageModal = true)}
                    disabled={events.length === 0}
                >
                    통합 평균 그래프 보기
                </button>
            </div>
            <p>학생들이 전송한 갈톤 보드 결과를 확인합니다.</p>
        </div>

        <div class="cards-wrap">
            {#if events.length === 0}
                <div class="empty-cards">아직 전송된 결과가 없습니다.</div>
            {:else}
                <div class="cards-grid">
                    {#each events as ev (ev.id)}
                        <article class="galton-card">
                            <div class="galton-card__preview">
                                {#if ev.imageDataUrl}
                                    <img src={ev.imageDataUrl} alt="갈톤보드 캡처" loading="lazy" />
                                {:else}
                                    <div class="fallback">캡처 없음</div>
                                {/if}
                            </div>
                            <div class="galton-card__meta">
                                <span class="name">{ev.playerName}</span>
                                <span class="desc">구슬 {ev.ballCount}개 · 핀 {ev.rows}줄</span>
                            </div>
                        </article>
                    {/each}
                </div>
            {/if}
        </div>
    </div>

    <div class="right-panel">
        <PhoneQrFrame
            fill
            class="galton-phone-qr"
            participateUrl={studentUrl || studentLink}
            summaries={summaryLines}
            emptySummaryText="아직 전송된 내역이 없습니다."
            qrPixelSize={280}
        />
        {#if errorMessage}
            <div class="error">{errorMessage}</div>
        {/if}
    </div>
</section>

<!-- 통합 평균 그래프 모달 팝업 -->
{#if showAverageModal}
    <div class="modal-backdrop" role="presentation">
        <button
            class="modal-backdrop-btn"
            type="button"
            aria-label="모달 닫기"
            onclick={() => (showAverageModal = false)}
        ></button>
        <div class="modal-content" role="dialog" aria-modal="true" tabindex="-1">
            <div class="modal-header">
                <h2>통합 평균 갈톤 분포 (정규분포)</h2>
                <button class="close-btn" type="button" onclick={() => (showAverageModal = false)}>✕</button>
            </div>

            <div class="modal-body">
                {#if averageData.bins.length === 0}
                    <p class="no-data">집계할 데이터가 부족합니다.</p>
                {:else}
                    <div class="summary-info">
                        <span>총 제출 학생: <strong>{averageData.totalCount}명</strong></span>
                        <span>평균 구슬 수: <strong>약 {averageData.avgBallCount}개</strong></span>
                    </div>

                    <div class="chart-container">
                        <svg viewBox="0 0 500 240" class="avg-chart">
                            <!-- 배경 그리드 가이드라인 -->
                            <line x1="20" y1="200" x2="480" y2="200" stroke="#cbd5e1" stroke-width="1.5" />
                            <line x1="20" y1="20" x2="480" y2="20" stroke="#f1f5f9" stroke-width="1" />

                            <!-- 꺾은선 (평균 분포 곡선) -->
                            <path d={avgSvgPath} fill="none" stroke="#f97316" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" />

                            <!-- 좌표 포인트 & 값 표시 -->
                            {#each averageData.bins as val, idx}
                                {@const width = 500}
                                {@const height = 220}
                                {@const padding = 20}
                                {@const step = (width - padding * 2) / Math.max(averageData.bins.length - 1, 1)}
                                {@const x = padding + idx * step}
                                {@const y = height - padding - (val / averageData.maxVal) * (height - padding * 2)}

                                <circle cx={x} cy={y} r="5" fill="#ea580c" />
                                <text x={x} y={y - 10} text-anchor="middle" font-size="11" fill="#475569" font-weight="bold">
                                    {val}
                                </text>
                                <text x={x} y="218" text-anchor="middle" font-size="10" fill="#94a3b8">
                                    #{idx + 1}
                                </text>
                            {/each}
                        </svg>
                    </div>
                {/if}
            </div>
        </div>
    </div>
{/if}

<style>
    .teacher-lab { display: grid; grid-template-columns: 3fr 2.25fr; gap: 16px; min-height: calc(100vh - 160px); }
    .left-panel { background: #fff; border: 1px solid #dbeafe; border-radius: 14px; padding: 16px; height: 85%; display: flex; flex-direction: column; min-height: 0; }
    
    .header-title-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
    }

    h1 { margin: 0; font-size: 1.2rem; }

    .avg-btn {
        background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
        color: white;
        border: none;
        border-radius: 8px;
        padding: 6px 14px;
        font-size: 0.85rem;
        font-weight: 700;
        cursor: pointer;
        box-shadow: 0 2px 6px rgba(249, 115, 22, 0.25);
        transition: transform 0.1s ease, opacity 0.2s;
    }

    .avg-btn:hover {
        opacity: 0.92;
        transform: translateY(-1px);
    }

    .avg-btn:disabled {
        background: #cbd5e1;
        cursor: not-allowed;
        box-shadow: none;
        transform: none;
    }

    .panel-header p { margin: 8px 0 12px; color: #475569; font-size: 0.92rem; }
    .cards-wrap { flex: 1 1 auto; min-height: 0; overflow: auto; border: 1px solid #e2e8f0; border-radius: 10px; background: #f8fafc; padding: 12px; }
    .empty-cards { padding: 28px 16px; text-align: center; color: #64748b; }
    .cards-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 12px; }
    .galton-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 10px; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.06); }
    .galton-card__preview { border-radius: 8px; overflow: hidden; border: 1px solid #dbeafe; aspect-ratio: 16 / 10; background: #020617; }
    .galton-card__preview img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .fallback { width: 100%; height: 100%; display: grid; place-items: center; color: #94a3b8; font-size: 0.82rem; }
    .galton-card__meta { margin-top: 8px; display: flex; flex-direction: column; gap: 2px; font-size: 0.82rem; }
    .name { font-weight: 700; color: #0f172a; }
    .desc { color: #475569; }
    .right-panel {
        display: flex;
        flex-direction: column;
        align-items: stretch;
        justify-content: flex-start;
        align-self: start; /* 👈 핸드폰 프레임이 세로로 찌그러지거나 늘어나는 것을 방지 */
        min-height: 0;
        min-width: 0;
        box-sizing: border-box;
    }

    :global(.galton-phone-qr) {
        /* 생일 캘린더에서 완벽하게 작동하던 내부 여백 변수들을 그대로 이식합니다 */
        --phone-screen-top: 7.5%;
        --phone-screen-left: 6.5%;
        --phone-screen-right: 6.5%;
        --phone-screen-bottom: 9.5%;
        --phone-fill-max-height: min(calc(100vh - 200px), 920px);
    }

    .error { margin-top: 10px; border-radius: 12px; padding: 10px 12px; border: 1px solid rgba(185, 28, 28, 0.25); background: rgba(185, 28, 28, 0.08); color: #b91c1c; font-weight: 700; }

    /* 모달 팝업 스타일 */
    .modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(15, 23, 42, 0.55);
        backdrop-filter: blur(4px);
        display: grid;
        place-items: center;
        z-index: 999;
        padding: 16px;
    }

    .modal-backdrop-btn {
        position: absolute;
        inset: 0;
        border: none;
        background: transparent;
        cursor: pointer;
    }

    .modal-content {
        position: relative;
        z-index: 1;
        background: #ffffff;
        border-radius: 16px;
        width: min(560px, 100%);
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
        overflow: hidden;
        border: 1px solid #e2e8f0;
    }

    .modal-header {
        padding: 16px 20px;
        background: #f8fafc;
        border-bottom: 1px solid #e2e8f0;
        display: flex;
        align-items: center;
        justify-content: space-between;
    }

    .modal-header h2 {
        margin: 0;
        font-size: 1.1rem;
        color: #0f172a;
    }

    .close-btn {
        background: transparent;
        border: none;
        font-size: 1.2rem;
        color: #64748b;
        cursor: pointer;
        padding: 4px 8px;
        border-radius: 6px;
    }

    .close-btn:hover {
        background: #e2e8f0;
        color: #0f172a;
    }

    .modal-body {
        padding: 20px;
    }

    .summary-info {
        display: flex;
        gap: 16px;
        margin-bottom: 16px;
        font-size: 0.9rem;
        color: #475569;
        background: #fff7ed;
        padding: 10px 14px;
        border-radius: 8px;
        border: 1px solid #ffedd5;
    }

    .chart-container {
        width: 100%;
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 12px;
    }

    .avg-chart {
        width: 100%;
        height: auto;
        display: block;
    }

    .no-data {
        text-align: center;
        color: #64748b;
        padding: 40px 0;
    }

    @media (max-width: 920px) { .teacher-lab { grid-template-columns: 1fr; } }
</style>