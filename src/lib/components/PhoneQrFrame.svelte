<script>
	import { browser } from '$app/environment';

	/**
	 * 학생 참여 QR + 전송 요약을 핸드폰 PNG 프레임 안에 넣는 재사용 컴포넌트입니다.
	 * @typedef {{
	 *   participateUrl: string,
	 *   summaries?: string[],
	 *   feed?: import('svelte').Snippet,
	 *   frameSrc?: string,
	 *   linkLabel?: string,
	 *   qrPixelSize?: number,
	 *   emptySummaryText?: string,
	 *   class?: string,
	 *   fill?: boolean,
	 * }} Props
	 */

	/** @type {Props} */
	let {
		participateUrl,
		summaries = [],
		feed,
		// `static/핸드폰.png`를 쓰려면 파일을 추가한 뒤 frameSrc만 바꾸면 됩니다.
		frameSrc = '/핸드폰 디자인.png',
		linkLabel = '학생 참여 열기',
		qrPixelSize = 200,
		emptySummaryText = '학생이 전송하면 여기에 한 줄 요약이 표시됩니다.',
		class: className = '',
		fill = false
	} = $props();

	let qrDataUrl = $state('');

	function resolveQrTarget() {
		const raw = String(participateUrl ?? '').trim();
		if (!raw) return '';
		if (/^https?:\/\//i.test(raw)) return raw;
		if (!browser) return raw;
		try {
			return new URL(raw, window.location.origin).href;
		} catch {
			return raw;
		}
	}

	$effect(() => {
		if (!browser) return;

		const target = resolveQrTarget();
		if (!target) {
			qrDataUrl = '';
			return;
		}

		let cancelled = false;

		(async () => {
			try {
				const qrcode = await import('qrcode');
				const dataUrl = await qrcode.toDataURL(target, {
					width: qrPixelSize,
					margin: 1,
					color: { dark: '#0f172a', light: '#ffffff' }
				});
				if (!cancelled) qrDataUrl = dataUrl;
			} catch (err) {
				console.warn('[PhoneQrFrame] QR 생성 실패', err);
				if (!cancelled) qrDataUrl = '';
			}
		})();

		return () => {
			cancelled = true;
		};
	});
</script>

<div class={['phone-qr-frame', fill && 'phone-qr-frame--fill', className].filter(Boolean).join(' ')}>
	<div class="phone-qr-frame__shell">
		<img class="phone-qr-frame__bezel" src={frameSrc} alt="" role="presentation" decoding="async" />

		<div class="phone-qr-frame__screen" aria-label="학생 참여 미리보기">
			<div class="phone-qr-frame__qr">
				{#if qrDataUrl}
					<img src={qrDataUrl} alt="학생 참여 QR 코드" class="phone-qr-frame__qr-img" />
				{:else}
					<div class="phone-qr-frame__qr-placeholder">QR 준비 중…</div>
				{/if}
			</div>

			<div class="phone-qr-frame__feed" role="region" aria-label="학생 전송 피드">
				{#if feed}
					{@render feed()}
				{:else if summaries.length === 0}
					<p class="phone-qr-frame__empty">{emptySummaryText}</p>
				{:else}
					<ul class="phone-qr-frame__list">
						{#each [...summaries].reverse() as line, i (i + ':' + line)}
							<li class="phone-qr-frame__line">{line}</li>
						{/each}
					</ul>
				{/if}
			</div>

			<a
				class="phone-qr-frame__btn"
				href={participateUrl || '#'}
				target="_blank"
				rel="noreferrer"
				aria-disabled={!participateUrl}
				onclick={(e) => {
					if (!participateUrl) e.preventDefault();
				}}
			>
				{linkLabel}
			</a>
		</div>
	</div>
</div>

<style>
	.phone-qr-frame {
		/* 흰 화면 영역이 PNG마다 다를 수 있어, 필요 시 페이지에서 오버라이드하세요 */
		--phone-screen-top: 7.5%;
		--phone-screen-left: 6.5%;
		--phone-screen-right: 6.5%;
		--phone-screen-bottom: 9.5%;
		--phone-feed-max-height: 9.5rem;
		--phone-qr-img-width: min(72%, 168px);
		--phone-fill-max-height: min(90vh, 900px);
	}

	.phone-qr-frame__shell {
		position: relative;
		width: min(280px, 100%);
		margin-inline: auto;
	}

	.phone-qr-frame__bezel {
		display: block;
		width: 100%;
		height: auto;
		user-select: none;
		pointer-events: none;
	}

	/* 부모 열 높이에 맞춰 베젤 PNG를 크게 키웁니다(폭은 열·뷰포트에 맞게 자동). */
	.phone-qr-frame--fill {
		flex: 1 1 auto;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		min-height: 0;
		align-self: stretch;
		--phone-feed-max-height: min(38vh, 18rem);
		--phone-qr-img-width: min(78%, 280px);
	}

	.phone-qr-frame--fill .phone-qr-frame__shell {
		display: inline-block;
		width: auto;
		max-width: 100%;
		height: min(var(--phone-fill-max-height), 100%);
		margin-inline: auto;
		line-height: 0;
		vertical-align: top;
	}

	.phone-qr-frame--fill .phone-qr-frame__bezel {
		width: auto;
		height: 100%;
		max-width: 100%;
		object-fit: contain;
	}

	.phone-qr-frame--fill .phone-qr-frame__empty,
	.phone-qr-frame--fill .phone-qr-frame__line {
		font-size: clamp(0.78rem, 1.6cqw, 0.92rem);
	}

	.phone-qr-frame--fill .phone-qr-frame__btn {
		font-size: clamp(0.8rem, 1.8cqw, 0.95rem);
		padding: 1rem 0.65rem;
	}

	.phone-qr-frame--fill .phone-qr-frame__screen {
		container-type: inline-size;
	}

	.phone-qr-frame__screen {
		position: absolute;
		top: var(--phone-screen-top);
		left: var(--phone-screen-left);
		right: var(--phone-screen-right);
		bottom: var(--phone-screen-bottom);
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		align-items: stretch;
		gap: 0.45rem;
		min-height: 0;
		padding: 0.35rem 0.4rem 0.45rem;
		border-radius: 10px;
	}

	.phone-qr-frame__qr {
		flex: 0 0 auto;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0.15rem 0 0.1rem;
	}

	.phone-qr-frame__qr-img {
		width: var(--phone-qr-img-width);
		height: auto;
		display: block;
		image-rendering: pixelated;
	}

	.phone-qr-frame__qr-placeholder {
		min-height: 120px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.78rem;
		color: #64748b;
		text-align: center;
		padding: 0 0.5rem;
	}

	.phone-qr-frame__feed {
		flex: 1 1 auto;
		width: calc(100% - 60px);
		margin-left: auto;
    	margin-right: auto;
		min-height: 0;
		max-height: var(--phone-feed-max-height); 
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
		border-radius: 8px;
		background: rgba(248, 250, 252, 0.95);
		border: 1px solid #e2e8f0;
		padding: 0.35rem 0.45rem;
		scrollbar-gutter: stable;
	}

	.phone-qr-frame__empty {
		margin: 0;
		font-size: 0.78rem;
		line-height: 1.45;
		color: #64748b;
	}

	.phone-qr-frame__list {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.phone-qr-frame__line {
		font-size: 1.5rem;
		line-height: 2;
		color: #0f172a;
		word-break: keep-all;
		overflow-wrap: anywhere;
		padding-bottom: 0.3rem;
		border-bottom: 1px solid #e2e8f0;
	}

	.phone-qr-frame__line:last-child {
		border-bottom: none;
		padding-bottom: 0;
	}

	.phone-qr-frame__btn {
		flex: 0 0 auto;
		display: flex;
		width: calc(100% - 60px);
		margin-left: auto;
    	margin-right: auto;
		align-items: center;
		justify-content: center;
		margin-top: auto;
		padding: 0.45rem 0.55rem;
		border-radius: 999px;
		font-size: 0.78rem;
		font-weight: 600;
		text-decoration: none;
		text-align: center;
		color: #ffffff;
		background: linear-gradient(180deg, #4f46e5 0%, #3730a3 100%);
		box-shadow: 0 4px 12px rgba(55, 48, 163, 0.28);
		transition: transform 0.15s ease, box-shadow 0.15s ease;
	}

	.phone-qr-frame__btn:hover {
		transform: translateY(-1px);
		box-shadow: 0 6px 14px rgba(55, 48, 163, 0.35);
	}

	.phone-qr-frame__btn:focus-visible {
		outline: 2px solid #c7d2fe;
		outline-offset: 2px;
	}

	.phone-qr-frame__btn[aria-disabled='true'] {
		opacity: 0.45;
		pointer-events: none;
		box-shadow: none;
	}
</style>
