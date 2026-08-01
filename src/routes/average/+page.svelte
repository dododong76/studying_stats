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
     *   commuteMinutes: number,
     *   phoneMinutes: number,
     *   sleepMinutes: number,
     *   bookCount: number,
     *   penCount: number,
     *   updatedAt: number,
     *   lastSubmittedAt?: number
     * }} AverageResponse
     */
    /** @typedef {'commuteMinutes' | 'phoneMinutes' | 'sleepMinutes' | 'bookCount' | 'penCount'} AverageFieldKey */
    /**
     * @typedef {{
     *   key: AverageFieldKey,
     *   title: string,
     *   meanLabel: string,
     *   accent: string,
     *   formatMean: (value: number) => string
     * }} FieldConfig
     */

    /** @type {import('firebase/database').Database | null} */
    const firebaseDb = db;

    let sessionId = $state(page.url.searchParams.get('session') ?? '');
    let studentLink = $state('');
    let studentUrl = $state('');
    /** @type {AverageResponse[]} */
    let responses = $state([]);
    let errorMessage = $state('');
    /** @type {null | (() => void)} */
    let unsubscribe = null;

    /** @type {FieldConfig[]} */
    const fieldConfigs = [
        {
            key: 'commuteMinutes',
            title: '등교 시간',
            meanLabel: '평균 등교 시간',
            accent: 'blue',
            formatMean: (value) => `${formatClockish(value)}`
        },
        {
            key: 'phoneMinutes',
            title: '스마트폰 사용 시간',
            meanLabel: '평균 스마트폰 사용 시간',
            accent: 'orange',
            formatMean: (value) => `${formatClockish(value)}`
        },
        {
            key: 'sleepMinutes',
            title: '수면 시간',
            meanLabel: '평균 수면 시간',
            accent: 'violet',
            formatMean: (value) => `${formatClockish(value)}`
        },
        {
            key: 'bookCount',
            title: '책 권수',
            meanLabel: '평균 책 권수',
            accent: 'green',
            formatMean: (value) => `${formatNumber(value)}권`
        },
        {
            key: 'penCount',
            title: '필기구 개수',
            meanLabel: '평균 필기구 개수',
            accent: 'pink',
            formatMean: (value) => `${formatNumber(value)}개`
        }
    ];

    function generateSessionId() {
        if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
        return `sess_${Math.random().toString(36).slice(2)}_${Date.now()}`;
    }

    /** @param {number} value */
    function formatNumber(value) {
        const rounded = Math.round(value * 10) / 10;
        return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
    }

    /** @param {number} value */
    function formatClockish(value) {
        const rounded = Math.round(value * 10) / 10;
        if (rounded < 60) return `${formatNumber(rounded)}분`;
        const hours = Math.floor(rounded / 60);
        const minutes = Math.round((rounded - hours * 60) * 10) / 10;
        if (minutes === 0) return `${hours}시간`;
        return `${hours}시간 ${formatNumber(minutes)}분`;
    }

    /**
     * @param {AverageFieldKey} key
     * @param {number} value
     */
    function formatVariance(key, value) {
        if (key === 'commuteMinutes' || key === 'phoneMinutes' || key === 'sleepMinutes') {
            return `${formatNumber(value)}분²`;
        }
        if (key === 'bookCount') return `${formatNumber(value)}권²`;
        return `${formatNumber(value)}개²`;
    }

    /**
     * @param {AverageFieldKey} key
     * @param {number} value
     */
    function formatStdDev(key, value) {
        if (key === 'commuteMinutes' || key === 'phoneMinutes' || key === 'sleepMinutes') {
            return formatClockish(value);
        }
        if (key === 'bookCount') return `${formatNumber(value)}권`;
        return `${formatNumber(value)}개`;
    }

    /** @param {number[]} values */
    function calcStats(values) {
        if (values.length === 0) {
            return { count: 0, mean: 0, variance: 0, stddev: 0, min: 0, max: 0 };
        }
        const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
        const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
        const stddev = Math.sqrt(variance);
        return {
            count: values.length,
            mean,
            variance,
            stddev,
            min: Math.min(...values),
            max: Math.max(...values)
        };
    }

    /**
     * @param {Record<string, any> | null} raw
     */
    function hydrate(raw) {
        /** @type {AverageResponse[]} */
        const next = [];
        if (raw) {
            for (const [id, value] of Object.entries(raw)) {
                if (!value || typeof value !== 'object') continue;
                next.push({
                    id,
                    playerName: String(value.playerName ?? '학생'),
                    commuteMinutes: Number(value.commuteMinutes ?? 0) || 0,
                    phoneMinutes: Number(value.phoneMinutes ?? 0) || 0,
                    sleepMinutes: Number(value.sleepMinutes ?? 0) || 0,
                    bookCount: Number(value.bookCount ?? 0) || 0,
                    penCount: Number(value.penCount ?? 0) || 0,
                    updatedAt: Number(value.createdAt ?? value.updatedAt ?? 0) || 0,
                    lastSubmittedAt: Number(value.createdAt ?? value.lastSubmittedAt ?? 0) || 0
                });
            }
        }
        next.sort((a, b) => b.updatedAt - a.updatedAt);
        responses = next;
    }

    let responseCount = $derived(responses.length);
    let latestUpdatedText = $derived.by(() => {
        if (responses.length === 0) return '아직 제출된 응답이 없습니다';
        return `최근 제출: ${new Date(responses[0].updatedAt).toLocaleTimeString('ko-KR')}`;
    });

    let summaryLines = $derived.by(() =>
        responses
            .slice(0, 6)
            .map(
                /** @param {AverageResponse} item */
                (item) =>
                    `${item.playerName} · 등교 ${item.commuteMinutes}분 · 폰 ${formatClockish(item.phoneMinutes)}`
            )
    );

    let statCards = $derived.by(() =>
        fieldConfigs.map((field) => {
            const stats = calcStats(responses.map((item) => Number(item[field.key]) || 0));
            return {
                ...field,
                ...stats,
                meanText: field.formatMean(stats.mean),
                varianceText: formatVariance(field.key, stats.variance),
                stddevText: formatStdDev(field.key, stats.stddev)
            };
        })
    );

    onMount(() => {
        if (!sessionId) {
            sessionId = generateSessionId();
            const url = new URL(window.location.href);
            url.searchParams.set('session', sessionId);
            window.history.replaceState({}, '', url.toString());
        }

        studentLink = `/average/students?session=${encodeURIComponent(sessionId)}`;
        studentUrl = new URL(studentLink, window.location.origin).toString();

        if (!firebaseDb) {
            const suffix = missingEnvKeys?.length ? ` (누락: ${missingEnvKeys.join(', ')})` : '';
            errorMessage = `Firebase 설정(VITE_FIREBASE_*) 이 필요합니다.${suffix}`;
            return;
        }

        void (async () => {
            try {
                await ensureFirebaseAuth();
            } catch (error) {
                errorMessage = `인증 초기화 실패: ${formatFirebaseAuthError(error)}`;
                return;
            }

            const liveRef = sessionEventsRef(firebaseDb, sessionId);
            unsubscribe = onValue(
                liveRef,
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

<section class="average-board">
    <TeacherHelpFab title="생활 평균 안내">
        <h3>1. 무엇을 보나요?</h3>
        <p>학생들이 제출한 생활 데이터를 모아 평균, 분산, 표준편차를 실시간으로 확인합니다.</p>
        <h3>2. 참여 방법</h3>
        <p>오른쪽 QR 코드로 학생 화면에 들어가 값을 제출하면 왼쪽 통계 카드와 목록이 갱신됩니다.</p>
    </TeacherHelpFab>

    <div class="stage-panel">
        <header class="hero-panel">
            <div>
                <p class="eyebrow">LIVE AVERAGE STUDIO</p>
                <h1>우리 반 생활 평균 보드</h1>
                <p class="hero-copy">학생들이 보낸 생활 데이터를 모아 평균·분산·표준편차를 함께 봅니다.</p>
            </div>
            <div class="hero-meta">
                <div class="meta-chip">
                    <span class="meta-label">응답 인원</span>
                    <strong>{responseCount}명</strong>
                </div>
                <div class="meta-chip subtle">{latestUpdatedText}</div>
            </div>
        </header>

        <div class="stats-grid">
            {#each statCards as card}
                <article class={`stat-card ${card.accent}`}>
                    <div class="stat-card__header">
                        <span class="stat-card__title">{card.title}</span>
                        <span class="stat-card__count">{card.count}명 기준</span>
                    </div>

                    <div class="mean-stage">
                        <div class="mean-label">{card.meanLabel}</div>
                        <div class="mean-value">{card.meanText}</div>
                    </div>

                    <div class="substats">
                        <div class="substat">
                            <span>분산</span>
                            <strong>{card.varianceText}</strong>
                        </div>
                        <div class="substat">
                            <span>표준편차</span>
                            <strong>{card.stddevText}</strong>
                        </div>
                        <div class="substat">
                            <span>범위</span>
                            <strong>{formatNumber(card.min)} ~ {formatNumber(card.max)}</strong>
                        </div>
                    </div>
                </article>
            {/each}
        </div>

        <div class="response-panel">
            <div class="response-panel__header">
                <h2>학생별 제출 내역</h2>
                <p>새 응답이 들어오면 목록이 갱신됩니다.</p>
            </div>

            {#if responses.length === 0}
                <div class="empty-state">아직 제출된 응답이 없습니다. 학생 화면에서 값을 내면 여기에 표시됩니다.</div>
            {:else}
                <div class="response-list">
                    {#each responses as item, index (item.id)}
                        <div class="response-row">
                            <div class="response-index">{index + 1}</div>
                            <div class="response-values">
                                <span>{item.playerName}</span>
                                <span>등교 {item.commuteMinutes}분</span>
                                <span>폰 {formatClockish(item.phoneMinutes)}</span>
                                <span>수면 {formatClockish(item.sleepMinutes)}</span>
                                <span>책 {item.bookCount}권</span>
                                <span>필기구 {item.penCount}개</span>
                            </div>
                            <div class="response-time">
                                {new Date(item.updatedAt).toLocaleTimeString('ko-KR')}
                            </div>
                        </div>
                    {/each}
                </div>
            {/if}
        </div>
    </div>

    <div class="phone-panel">
        <PhoneQrFrame
            fill
            class="average-phone-qr"
            participateUrl={studentUrl || studentLink}
            summaries={summaryLines}
            qrPixelSize={220}
            linkLabel="학생 화면 열기"
            emptySummaryText="학생 응답이 들어오면 요약이 여기에 표시됩니다."
        />
        {#if errorMessage}
            <div class="error">{errorMessage}</div>
        {/if}
    </div>
</section>

<style>
    /* 메인 그리드 레이아웃: 왼쪽 보드(11) : 오른쪽 QR폰(7) */
    .average-board {
        display: grid;
        grid-template-columns: 11fr 7fr;
        gap: 16px;
        min-height: 0;
        height: 100%;
        align-items: start;
    }

    .stage-panel {
        display: flex;
        flex-direction: column;
        gap: 10px;
        min-height: 0;
        height: 100%;
    }

    .hero-panel {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        align-items: stretch;
        padding: 12px 16px;
        border-radius: 20px;
        background:
            radial-gradient(circle at top left, rgba(59, 130, 246, 0.22), transparent 30%),
            radial-gradient(circle at top right, rgba(236, 72, 153, 0.18), transparent 35%),
            linear-gradient(135deg, #020617, #111827 52%, #1e1b4b);
        color: #f8fafc;
        box-shadow: 0 20px 40px rgba(15, 23, 42, 0.25);
    }

    .eyebrow {
        margin: 0 0 4px;
        font-size: 0.72rem;
        font-weight: 900;
        letter-spacing: 0.18em;
        color: #7dd3fc;
    }

    h1 {
        margin: 0;
        font-size: clamp(1.3rem, 1.8vw, 2.1rem);
        line-height: 1.1;
    }

    .hero-copy {
        margin: 4px 0 0;
        font-size: clamp(0.78rem, 0.85vw, 0.95rem);
        color: #cbd5e1;
    }

    .hero-meta {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        gap: 6px;
        min-width: 150px;
    }

    .meta-chip {
        padding: 8px 12px;
        border-radius: 14px;
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.12);
        backdrop-filter: blur(8px);
    }

    .meta-chip strong {
        display: block;
        margin-top: 2px;
        font-size: clamp(1.4rem, 2vw, 2.2rem);
        line-height: 1;
    }

    .meta-chip.subtle {
        font-size: 0.8rem;
        font-weight: 700;
        color: #e2e8f0;
    }

    .meta-label {
        font-size: 0.75rem;
        color: #bfdbfe;
        font-weight: 800;
    }

    .stats-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
    }

    .stat-card {
        position: relative;
        overflow: hidden;
        border-radius: 18px;
        padding: 10px 12px 12px;
        color: #fff;
        box-shadow: 0 16px 32px rgba(15, 23, 42, 0.15);
    }

    .stat-card::before {
        content: '';
        position: absolute;
        inset: auto -8% -40% auto;
        width: 140px;
        height: 140px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.12);
        filter: blur(10px);
    }

    .stat-card.blue {
        background: linear-gradient(135deg, #2563eb, #38bdf8 58%, #dbeafe);
    }

    .stat-card.orange {
        background: linear-gradient(135deg, #ea580c, #fb923c 58%, #fde68a);
    }

    .stat-card.violet {
        background: linear-gradient(135deg, #6d28d9, #8b5cf6 58%, #c4b5fd);
    }

    .stat-card.green {
        background: linear-gradient(135deg, #047857, #10b981 58%, #a7f3d0);
    }

    .stat-card.pink {
        background: linear-gradient(135deg, #be185d, #ec4899 58%, #f9a8d4);
    }

    .stat-card__header {
        position: relative;
        z-index: 1;
        display: flex;
        justify-content: space-between;
        gap: 6px;
        font-size: 0.8rem;
        font-weight: 800;
    }

    .stat-card__count {
        color: rgba(255, 255, 255, 0.88);
    }

    .mean-stage {
        position: relative;
        z-index: 1;
        margin: 8px 0 8px;
        padding: 10px;
        border-radius: 14px;
        background: rgba(255, 255, 255, 0.14);
        backdrop-filter: blur(8px);
        animation: breathe 3.4s ease-in-out infinite;
        transform-origin: center;
    }

    .mean-label {
        font-size: 0.8rem;
        font-weight: 800;
        color: rgba(255, 255, 255, 0.92);
    }

    .mean-value {
        margin-top: 4px;
        font-size: clamp(1.6rem, 2.3vw, 2.5rem);
        line-height: 1;
        font-weight: 900;
        letter-spacing: -0.03em;
        text-shadow: 0 8px 18px rgba(15, 23, 42, 0.25);
    }

    .substats {
        position: relative;
        z-index: 1;
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 6px;
    }

    .substat {
        padding: 6px 6px;
        border-radius: 10px;
        background: rgba(15, 23, 42, 0.16);
    }

    .substat span {
        display: block;
        font-size: 0.7rem;
        font-weight: 700;
        color: rgba(255, 255, 255, 0.88);
    }

    .substat strong {
        display: block;
        margin-top: 2px;
        font-size: clamp(0.82rem, 0.95vw, 1.05rem);
        line-height: 1.2;
    }

    .response-panel {
        flex: 1 1 0;
        min-height: 0;
        background: linear-gradient(180deg, #ffffff, #f8fafc);
        border: 1px solid #dbeafe;
        border-radius: 16px;
        padding: 10px 12px;
        box-shadow: 0 10px 24px rgba(15, 23, 42, 0.06);
        display: flex;
        flex-direction: column;
    }

    .response-panel__header h2 {
        margin: 0;
        font-size: 1.05rem;
    }

    .response-panel__header p {
        margin: 2px 0 0;
        font-size: 0.78rem;
        color: #475569;
    }

    .empty-state {
        margin-top: 8px;
        padding: 16px 12px;
        border-radius: 14px;
        background: #eff6ff;
        color: #334155;
        font-size: 0.88rem;
        font-weight: 700;
        text-align: center;
    }

    .response-list {
        margin-top: 8px;
        flex: 1 1 auto;
        min-height: 0;
        display: flex;
        flex-direction: column;
        gap: 6px;
        overflow: auto;
    }

    .response-row {
        display: grid;
        grid-template-columns: 36px 1fr auto;
        gap: 8px;
        align-items: center;
        padding: 8px 8px;
        border-radius: 12px;
        background: #eff6ff;
    }

    .response-index {
        display: grid;
        place-items: center;
        width: 30px;
        height: 30px;
        border-radius: 999px;
        background: linear-gradient(135deg, #1d4ed8, #60a5fa);
        color: #fff;
        font-size: 0.82rem;
        font-weight: 900;
    }

    .response-values {
        display: flex;
        flex-wrap: wrap;
        gap: 4px 10px;
        font-size: 0.8rem;
        font-weight: 700;
        color: #0f172a;
    }

    .response-time {
        font-size: 0.72rem;
        font-weight: 800;
        color: #475569;
    }

    /* 우측 폰 패널 최적화 */
    .phone-panel {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-start;
        align-self: start;
        min-height: 0;
        min-width: 0;
        box-sizing: border-box;
        width: 100%;
    }

    :global(.average-phone-qr.phone-qr-frame--fill) {
        flex: 0 1 auto;
        height: auto;
        align-self: center;
    }

    :global(.average-phone-qr) {
        --phone-screen-top: 7.5%;
        --phone-screen-left: 6.5%;
        --phone-screen-right: 6.5%;
        --phone-screen-bottom: 9.5%;
        --phone-fill-max-height: min(calc(100vh - 120px), 820px);
    }

    .error {
        margin-top: 10px;
        border-radius: 14px;
        padding: 12px 14px;
        border: 1px solid rgba(185, 28, 28, 0.25);
        background: rgba(185, 28, 28, 0.08);
        color: #b91c1c;
        font-weight: 800;
    }

    @keyframes breathe {
        0%,
        100% {
            transform: scale(1);
        }
        50% {
            transform: scale(1.025);
        }
    }

    @media (max-width: 1100px) {
        .average-board {
            grid-template-columns: 1fr;
            height: auto;
        }

        .phone-panel {
            height: auto;
            align-items: center;
        }

        :global(.average-phone-qr .phone-qr-frame__shell) {
            width: min(300px, 100%);
        }
    }

    @media (max-width: 800px) {
        .hero-panel,
        .substats,
        .stats-grid {
            grid-template-columns: 1fr;
        }

        .hero-panel {
            flex-direction: column;
        }

        .response-row {
            grid-template-columns: 36px 1fr;
        }

        .response-time {
            grid-column: 2;
        }

        :global(.average-phone-qr) {
            --phone-screen-top: 9.5%;
            --phone-qr-img-width: 64%;
        }
    }
</style>