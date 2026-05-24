<script>
	import { browser } from '$app/environment';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { push } from 'firebase/database';
	import { getRandomDiceAnimalName } from '$lib/diceAnimals';
	import { db, ensureFirebaseAuth, formatFirebaseAuthError, missingEnvKeys, sessionEventsRef } from '$lib/firebase';

	/** @type {import('firebase/database').Database | null} */
	const firebaseDb = db;

	let sessionId = $state(page.url.searchParams.get('session') ?? '');
	let isSending = $state(false);
	let errorMessage = $state('');
	let sentOnce = $state(false);
	let hasDirtyChanges = $state(true);
	let participantId = $state('');
	let playerName = $state(getRandomDiceAnimalName());

	let commuteMinutes = $state(30);
	let phoneMinutes = $state(60);
	let sleepMinutes = $state(480);
	let bookCount = $state(2);
	let penCount = $state(5);

	let phoneLabel = $derived.by(() => {
		const h = Math.floor(phoneMinutes / 60);
		const m = phoneMinutes % 60;
		if (h === 0) return `${m}분`;
		if (m === 0) return `${h}시간`;
		return `${h}시간 ${m}분`;
	});

	let sleepLabel = $derived.by(() => {
		const h = Math.floor(sleepMinutes / 60);
		const m = sleepMinutes % 60;
		if (m === 0) return `${h}시간`;
		return `${h}시간 ${m}분`;
	});

	function markDirty() {
		hasDirtyChanges = true;
	}

	function generateParticipantId() {
		if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
		return `student_${Math.random().toString(36).slice(2)}_${Date.now()}`;
	}

	function getPayload() {
		return {
			playerName: playerName.trim() || '학생',
			commuteMinutes: Number(commuteMinutes),
			phoneMinutes: Number(phoneMinutes),
			sleepMinutes: Number(sleepMinutes),
			bookCount: Number(bookCount),
			penCount: Number(penCount)
		};
	}

	onMount(() => {
		if (!browser) return;
		const storageKey = 'average-student-participant-id';
		const storedId = window.localStorage.getItem(storageKey);
		participantId = storedId || generateParticipantId();
		window.localStorage.setItem(storageKey, participantId);
	});

	async function submit() {
		if (isSending || !hasDirtyChanges) return;
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

		isSending = true;
		try {
			await ensureFirebaseAuth();
			const payload = getPayload();
			await push(sessionEventsRef(firebaseDb, sessionId), {
				participantId,
				...payload,
				createdAt: Date.now()
			});
			sentOnce = true;
			hasDirtyChanges = false;
		} catch (err) {
			errorMessage = `전송 실패: ${formatFirebaseAuthError(err)}`;
		} finally {
			isSending = false;
		}
	}
</script>

<div class="avg-page">
	<section class="card">
		<header class="card-header">
			<h1>우리 반 생활 평균 조사</h1>
			<p>슬라이더를 움직여 나의 생활 데이터를 알려 주세요.</p>
		</header>

		<div class="name-field">
			<label for="playerNameInput">이름(별명)</label>
			<input
				id="playerNameInput"
				class="name-input"
				type="text"
				maxlength="15"
				bind:value={playerName}
				oninput={markDirty}
			/>
		</div>

		<div class="question commute">
			<div class="q-label">
				<span class="q-title">등교 시간</span>
				<span class="q-value">{commuteMinutes}분</span>
			</div>
			<input type="range" min="0" max="120" step="5" bind:value={commuteMinutes} oninput={markDirty} />
			<div class="q-scale"><span>0분</span><span>120분</span></div>
		</div>

		<div class="question phone">
			<div class="q-label">
				<span class="q-title">하루 스마트폰 사용 시간</span>
				<span class="q-value">{phoneLabel}</span>
			</div>
			<input type="range" min="0" max="300" step="30" bind:value={phoneMinutes} oninput={markDirty} />
			<div class="q-scale"><span>0분</span><span>5시간</span></div>
		</div>

		<div class="question sleep">
			<div class="q-label">
				<span class="q-title">하루 수면 시간</span>
				<span class="q-value">{sleepLabel}</span>
			</div>
			<input type="range" min="120" max="600" step="30" bind:value={sleepMinutes} oninput={markDirty} />
			<div class="q-scale"><span>2시간</span><span>10시간</span></div>
		</div>

		<div class="question books">
			<div class="q-label">
				<span class="q-title">책 읽는 권수</span>
				<span class="q-value">{bookCount}권</span>
			</div>
			<input type="range" min="0" max="10" step="1" bind:value={bookCount} oninput={markDirty} />
			<div class="q-scale"><span>0권</span><span>10권</span></div>
		</div>

		<div class="question pens">
			<div class="q-label">
				<span class="q-title">가지고 있는 필기구 개수</span>
				<span class="q-value">{penCount}개</span>
			</div>
			<input type="range" min="0" max="20" step="1" bind:value={penCount} oninput={markDirty} />
			<div class="q-scale"><span>0개</span><span>20개</span></div>
		</div>

		{#if errorMessage}
			<p class="error-msg">{errorMessage}</p>
		{/if}

		<button class="submit-btn" type="button" onclick={submit} disabled={isSending || !hasDirtyChanges}>
			{#if isSending}
				보내는 중…
			{:else if !hasDirtyChanges && sentOnce}
				보낸 값 유지
			{:else}
				선생님에게 보내기
			{/if}
		</button>
	</section>
</div>
<style>
	.avg-page {
		min-height: 100dvh;
		display: flex;
		justify-content: center;
		align-items: stretch;
		background: radial-gradient(circle at top, #1e293b 0, #020617 55%);
		padding: 16px 12px;
		box-sizing: border-box;
	}

	.card {
		width: 100%;
		max-width: 480px;
		margin: 0 auto;
		background: rgba(15, 23, 42, 0.96);
		border-radius: 18px;
		padding: 16px 14px 18px;
		box-shadow: 0 18px 40px rgba(0, 0, 0, 0.6);
		color: #e5e7eb;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.card-header h1 {
		margin: 0;
		text-align: center;
		font-size: 1.4rem;
		font-weight: 900;
		background: linear-gradient(to right, #38bdf8, #a855f7, #f97316);
		background-clip: text;
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
	}

	.card-header p {
		margin: 6px 0 0;
		text-align: center;
		font-size: 0.85rem;
		color: #9ca3af;
	}

	.name-field {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 10px 12px 12px;
		border-radius: 14px;
		background: linear-gradient(135deg, rgba(168, 85, 247, 0.18), rgba(59, 130, 246, 0.12));
	}

	.name-field label {
		font-size: 0.82rem;
		font-weight: 800;
		color: #e5e7eb;
	}

	.name-input {
		width: 100%;
		box-sizing: border-box;
		border: 1px solid rgba(255, 255, 255, 0.14);
		border-radius: 12px;
		padding: 10px 12px;
		background: rgba(15, 23, 42, 0.8);
		color: #f8fafc;
		font-size: 0.96rem;
		font-weight: 700;
	}

	.question {
		padding: 10px 10px 12px;
		border-radius: 14px;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.question.commute {
		background: linear-gradient(135deg, rgba(59, 130, 246, 0.22), rgba(56, 189, 248, 0.08));
	}

	.question.phone {
		background: linear-gradient(135deg, rgba(248, 113, 113, 0.22), rgba(251, 191, 36, 0.12));
	}

	.question.sleep {
		background: linear-gradient(135deg, rgba(129, 140, 248, 0.22), rgba(37, 99, 235, 0.16));
	}

	.question.books {
		background: linear-gradient(135deg, rgba(16, 185, 129, 0.22), rgba(45, 212, 191, 0.12));
	}

	.question.pens {
		background: linear-gradient(135deg, rgba(244, 114, 182, 0.22), rgba(251, 113, 133, 0.14));
	}

	.q-label {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 4px;
		font-size: 0.88rem;
	}

	.q-title {
		font-weight: 800;
	}

	.q-value {
		font-weight: 700;
		color: #f9fafb;
	}

	input[type='range'] {
		width: 100%;
		accent-color: #3b82f6;
	}

	.question.phone input[type='range'] {
		accent-color: #fb923c;
	}

	.question.sleep input[type='range'] {
		accent-color: #a855f7;
	}

	.question.books input[type='range'] {
		accent-color: #22c55e;
	}

	.question.pens input[type='range'] {
		accent-color: #ec4899;
	}

	.q-scale {
		display: flex;
		justify-content: space-between;
		font-size: 0.72rem;
		color: #d1d5db;
	}

	.submit-btn {
		margin-top: 4px;
		width: 100%;
		border: none;
		border-radius: 999px;
		padding: 11px 10px;
		font-weight: 900;
		font-size: 0.98rem;
		color: #0f172a;
		background: linear-gradient(135deg, #f97316, #facc15);
		box-shadow: 0 10px 20px rgba(248, 181, 92, 0.4);
		cursor: pointer;
	}

	.submit-btn:disabled {
		background: #4b5563;
		color: #e5e7eb;
		box-shadow: none;
		cursor: not-allowed;
		opacity: 0.7;
	}

	.error-msg {
		margin: 4px 2px 0;
		font-size: 0.8rem;
		color: #fecaca;
	}

	@media (min-width: 640px) {
		.card {
			padding-inline: 22px;
		}
	}
</style>
