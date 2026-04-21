<script>
    import { page } from '$app/state';
    import { push, ref } from 'firebase/database';
    import { db, missingEnvKeys } from '$lib/firebase';
    import { getRandomDiceAnimalName } from '$lib/diceAnimals';

    /** @type {import('firebase/database').Database | null} */
    const firebaseDb = db;
    const doors = [1, 2, 3];

    let sessionId = $state(page.url.searchParams.get('session') ?? '');
    let playerName = $state(getRandomDiceAnimalName());
    let errorMessage = $state('');

    /** @type {1 | 2 | 3 | null} */
    let selectedDoor = $state(null);
    /** @type {1 | 2 | 3 | null} */
    let openedDoor = $state(null);
    /** @type {1 | 2 | 3 | null} */
    let prizeDoor = $state(null);
    /** @type {1 | 2 | 3 | null} */
    let finalChoice = $state(null);
    /** @type {'keep' | 'switch' | null} */
    let decision = $state(null);
    /** @type {'pick' | 'hostReveal' | 'choose' | 'countdown' | 'reveal' | 'done'} */
    let phase = $state('pick');
    let countdownText = $state('');
    let isWin = $state(false);
    let isSubmitting = $state(false);
    /** @type {1 | 2 | 3 | null} */
    let goatRevealDoor = $state(null);
    /** @type {1 | 2 | 3 | null} */
    let prizeRevealDoor = $state(null);

    let selectedMarkerDoor = $derived(finalChoice ?? selectedDoor);

    function randomDoor() {
        return /** @type {1 | 2 | 3} */ (doors[Math.floor(Math.random() * doors.length)]);
    }

    /**
     * @param {number} ms
     */
    function sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    function resetRound() {
        errorMessage = '';
        selectedDoor = null;
        openedDoor = null;
        prizeDoor = null;
        finalChoice = null;
        decision = null;
        phase = 'pick';
        countdownText = '';
        isWin = false;
        isSubmitting = false;
        goatRevealDoor = null;
        prizeRevealDoor = null;
    }

    /**
     * @param {1 | 2 | 3} door
     */
    async function selectInitialDoor(door) {
        if (phase !== 'pick' || isSubmitting) return;
        errorMessage = '';
        selectedDoor = door;
        prizeDoor = randomDoor();
        
        // 1. 페이즈 먼저 변경 (메시지 표시)
        phase = 'hostReveal';

        // 2. 1초 대기
        await sleep(1000);
        
        const candidates = doors.filter((d) => d !== door && d !== prizeDoor);
        const opened = candidates[Math.floor(Math.random() * candidates.length)] ?? null;
        const targetDoor = /** @type {1 | 2 | 3 | null} */ (opened);
        if (!targetDoor) return;

        // 3. 문 열기(이미지 변경)와 강조 애니메이션 동시 실행
        openedDoor = targetDoor;
        goatRevealDoor = targetDoor;
        
        await sleep(1300);
        goatRevealDoor = null;
        phase = 'choose';
    }

    /**
     * @param {'keep' | 'switch'} nextDecision
     */
    async function chooseDecision(nextDecision) {
        if (phase !== 'choose' || !selectedDoor || !openedDoor || !prizeDoor || isSubmitting) return;
        decision = nextDecision;

        if (nextDecision === 'switch') {
            const switched = doors.find((d) => d !== selectedDoor && d !== openedDoor) ?? null;
            if (!switched) return;
            finalChoice = /** @type {1 | 2 | 3} */ (switched);
        } else {
            finalChoice = selectedDoor;
        }

        phase = 'countdown';
        for (const n of [3, 2, 1]) {
            countdownText = String(n);
            await sleep(1000);
        }
        countdownText = '';
        
        // 카운트다운 후 reveal 페이즈 진입 (메시지 표시)
        phase = 'reveal';
        isWin = finalChoice === prizeDoor;
        
        // 1초 대기 후 자동차 공개
        await sleep(1000);
        
        // 자동차 문 열기와 강조 애니메이션 동시 실행
        prizeRevealDoor = prizeDoor;
        playFanfare();
        
        await sleep(1500);
        // prizeRevealDoor를 null로 만들지 않고 바로 done으로 넘어가야 문이 다시 닫히지 않음
        phase = 'done';
        prizeRevealDoor = null;
        await submitResult();
    }

    async function submitResult() {
        if (isSubmitting) return;
        errorMessage = '';

        if (!firebaseDb) {
            const suffix = missingEnvKeys?.length ? ` (누락: ${missingEnvKeys.join(', ')})` : '';
            errorMessage = `Firebase 설정(VITE_FIREBASE_*)이 필요합니다.${suffix}`;
            return;
        }

        if (!sessionId) {
            errorMessage = '세션(session)이 필요합니다. 선생님 화면의 QR 링크로 접속해 주세요.';
            return;
        }

        if (!selectedDoor || !openedDoor || !decision || !finalChoice || !prizeDoor) {
            errorMessage = '라운드를 완료한 뒤 전송됩니다.';
            return;
        }

        const payload = {
            playerName: playerName.trim() || '학생',
            initialChoice: selectedDoor,
            openedDoor,
            finalChoice,
            decision,
            prizeDoor,
            isWin,
            createdAt: Date.now()
        };

        const eventsRef = ref(firebaseDb, `montyHallSessions/${sessionId}/events`);
        isSubmitting = true;
        try {
            await push(eventsRef, payload);
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            errorMessage = `전송 실패: ${message}`;
        } finally {
            isSubmitting = false;
        }
    }

    function playFanfare() {
        const Ctx =
            globalThis.AudioContext ||
            /** @type {typeof AudioContext | undefined} */ (
                /** @type {any} */ (globalThis).webkitAudioContext
            );
        if (!Ctx) return;
        const ctx = new Ctx();
        const notes = [523.25, 659.25, 783.99, 1046.5];
        const now = ctx.currentTime;
        notes.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.0001, now + i * 0.2);
            gain.gain.exponentialRampToValueAtTime(0.16, now + i * 0.2 + 0.03);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.2 + 0.18);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + i * 0.2);
            osc.stop(now + i * 0.2 + 0.2);
        });
    }

    /**
     * @param {1 | 2 | 3} door
     */
    function contentOf(door) {
        if (openedDoor === door) return '염소';
        if (prizeRevealDoor === door) return '자동차';
        if (phase === 'done') {
            return prizeDoor === door ? '자동차' : '염소';
        }
        return '';
    }

    /**
     * @param {1 | 2 | 3} door
     */
    function doorImageSrc(door) {
        const content = contentOf(door);
        if (content === '자동차') return '/몬티홀(자동차문).png';
        if (content === '염소') return '/몬티홀(염소문).png';
        return '/몬티홀(닫힌문).png';
    }
</script>

<section class="students-lab">
    <div class="hero">
        <h1>몬티홀 문제</h1>
        <p>문 뒤에 새 자동차가 있습니다. 제대로 된 문을 선택하면 자동차를 가질 수 있습니다. 문 하나를 선택하세요.</p>
    </div>

    <div class="name-box">
        <label for="playerNameInput">이름</label>
        <input
            id="playerNameInput"
            type="text"
            bind:value={playerName}
            placeholder="예: 고양이"
            maxlength="20"
            disabled={phase === 'countdown'}
        />
    </div>

    <div class="door-stage" aria-live="polite">
        {#each doors as door}
            <button
                class={`door-frame ${selectedMarkerDoor === door ? 'selected' : ''}`}
                onclick={() => selectInitialDoor(/** @type {1 | 2 | 3} */ (door))}
                disabled={phase !== 'pick'}
            >
                <div class="door-index">문 {door}</div>
                <div
                    class={`door-image-wrap ${goatRevealDoor === door ? 'reveal-goat' : ''} ${prizeRevealDoor === door ? 'reveal-prize' : ''}`}
                >
                    <img
                        class="door-image"
                        src={doorImageSrc(/** @type {1 | 2 | 3} */ (door))}
                        alt={`문 ${door}`}
                        draggable="false"
                    />
                </div>
                {#if selectedMarkerDoor === door}
                    <div class="picked-tag">선택됨</div>
                {/if}
            </button>
        {/each}
    </div>

    <div class="message-panel">
        {#if phase === 'pick'}
            <p>문 위로 마우스를 올리면 확대됩니다. 원하는 문을 클릭하세요.</p>
        {:else if phase === 'hostReveal'}
            <p>자동차가 없는 문 하나를 열겠습니다.</p>
        {:else if phase === 'choose'}
            <p>지금 선택을 유지할 것인가요? 아니면 열리지 않은 다른 문으로 바꿀 것인가요?</p>
            <div class="decision-row">
                <button class="btn keep" onclick={() => chooseDecision('keep')} disabled={isSubmitting}>선택 유지</button>
                <button class="btn change" onclick={() => chooseDecision('switch')} disabled={isSubmitting}>선택 변경</button>
            </div>
        {:else if phase === 'countdown'}
            <p class="count">{countdownText}</p>
        {:else if phase === 'reveal'}
            <p>1초 후 자동차가 있는 문을 공개합니다...</p>
        {:else}
            <p>
                {#if decision === 'keep'}
                    선택을 바꾸지 않았습니다.
                {:else}
                    선택을 바꿨습니다.
                {/if}
                {isWin ? ' 자동차를 얻었습니다!' : ' 아쉽게도 염소입니다.'}
            </p>
        {/if}
    </div>

    <div class="bottom-actions">
        <button class="btn reset" onclick={resetRound} disabled={phase === 'countdown' || isSubmitting}>다시 하기</button>
    </div>

    {#if errorMessage}
        <div class="error">{errorMessage}</div>
    {/if}
</section>

<style>
    .students-lab {
        min-height: calc(100vh - 120px);
        padding: 24px 18px 20px;
        border-radius: 18px;
        background:
            radial-gradient(100% 65% at 50% 0%, rgba(250, 204, 21, 0.16) 0%, rgba(8, 20, 45, 0) 75%),
            linear-gradient(180deg, #111827 0%, #0b1222 100%);
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
        font-size: clamp(1.7rem, 6vw, 2.7rem);
        font-weight: 900;
    }

    .hero p {
        margin: 8px auto 0;
        max-width: 860px;
        color: #d9e7ff;
        font-weight: 600;
    }

    .name-box {
        display: flex;
        gap: 8px;
        align-items: center;
        justify-content: center;
    }

    .name-box label {
        font-weight: 700;
    }

    .name-box input {
        width: min(100%, 16ch);
        padding: 8px 10px;
        border-radius: 10px;
        border: 1px solid #5f7ab2;
        background: #111d39;
        color: #f8fbff;
    }

    .door-stage {
        display: grid;
        grid-template-columns: repeat(3, minmax(170px, 1fr));
        gap: 18px;
        margin: 8px auto 0;
        width: min(980px, 100%);
        perspective: 1200px;
        background: #ffffff;
        border-radius: 18px;
        padding: 16px;
        border: 1px solid #ffffff;
        box-shadow: 0 10px 24px rgba(15, 23, 42, 0.18);
    }

    .door-frame {
        position: relative;
        appearance: none;
        border: 0;
        border-radius: 16px;
        background: #ffffff;
        padding: 8px;
        cursor: pointer;
        transform-style: preserve-3d;
        transition: transform 0.28s ease, box-shadow 0.28s ease, outline-color 0.25s ease;
        box-shadow: 0 8px 18px rgba(0, 0, 0, 0.22);
        outline: 3px solid transparent;
        outline-offset: 2px;
    }

    .door-frame:hover:enabled {
        transform: scale(1.2);
        z-index: 2;
    }

    .door-frame:disabled {
        cursor: default;
    }

    .door-image-wrap {
        position: relative;
        aspect-ratio: 3 / 4.3;
        border-radius: 14px;
        overflow: hidden;
        background: #ffffff;
    }

    .door-image {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
        user-select: none;
        animation: imagePop 0.45s ease;
    }

    .door-image-wrap.reveal-goat .door-image,
    .door-image-wrap.reveal-prize .door-image {
        animation: doorRevealSlow 1.2s cubic-bezier(0.18, 0.9, 0.2, 1);
    }

    .door-index {
        margin-bottom: 8px;
        color: #334155;
        font-weight: 800;
        font-size: 1.03rem;
    }

    .picked-tag {
        position: absolute;
        top: -8px;
        right: -6px;
        padding: 4px 8px;
        background: #2563eb;
        border: 1px solid #93c5fd;
        border-radius: 999px;
        font-size: 0.78rem;
        font-weight: 800;
    }

    .door-frame.selected {
        outline-color: rgba(96, 165, 250, 0.95);
        box-shadow:
            0 0 0 3px rgba(59, 130, 246, 0.35),
            0 14px 26px rgba(0, 0, 0, 0.35);
    }

    .message-panel {
        width: min(860px, 100%);
        margin: 8px auto 0;
        padding: 12px 14px;
        border-radius: 12px;
        border: 1px solid rgba(191, 219, 254, 0.35);
        background: rgba(15, 23, 42, 0.65);
        text-align: center;
    }

    .message-panel p {
        margin: 0;
        font-weight: 700;
        color: #e2e8f0;
    }

    .decision-row {
        margin-top: 10px;
        display: flex;
        justify-content: center;
        gap: 10px;
        flex-wrap: wrap;
    }

    .btn {
        border: 0;
        border-radius: 10px;
        padding: 10px 14px;
        font-weight: 800;
        cursor: pointer;
        color: #fff;
    }

    .btn.keep {
        background: linear-gradient(180deg, #475569 0%, #334155 100%);
    }

    .btn.change {
        background: linear-gradient(180deg, #16a34a 0%, #15803d 100%);
    }

    .count {
        font-size: clamp(2.2rem, 8vw, 4rem);
        font-weight: 900;
        color: #facc15;
        animation: pulse 1s ease infinite;
    }

    .bottom-actions {
        display: flex;
        justify-content: center;
    }

    .btn.reset {
        background: linear-gradient(180deg, #2563eb 0%, #1e40af 100%);
    }

    .error {
        width: min(860px, 100%);
        margin: 0 auto;
        color: #ffb4b4;
        background: rgba(185, 28, 28, 0.2);
        border: 1px solid rgba(254, 131, 131, 0.4);
        border-radius: 12px;
        padding: 10px 12px;
    }

    @keyframes pulse {
        0%,
        100% {
            transform: scale(1);
            opacity: 0.95;
        }
        50% {
            transform: scale(1.15);
            opacity: 1;
        }
    }

    @keyframes imagePop {
        0% {
            opacity: 0.82;
            transform: scale(0.97);
        }
        100% {
            opacity: 1;
            transform: scale(1);
        }
    }

    @keyframes doorRevealSlow {
        0% {
            transform: scale(1) rotateY(0deg);
            filter: brightness(0.72) saturate(0.8);
        }
        45% {
            transform: scale(1.01) rotateY(-7deg);
            filter: brightness(0.92) saturate(0.95);
        }
        100% {
            transform: scale(1) rotateY(0deg);
            filter: brightness(1) saturate(1);
        }
    }

    @media (max-width: 860px) {
        .door-stage {
            grid-template-columns: 1fr;
            max-width: 280px;
        }
    }
</style>