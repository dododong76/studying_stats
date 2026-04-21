<script>
    import favicon from '$lib/assets/favicon.svg';
    import { page } from '$app/state';

    let { children } = $props();

    const navItems = [
        {
            href: '/dice',
            label: '주사위 던지기',
            description: '통계적 확률과 수학적 확률의 관계를 알아봅니다.',
            image: '/주사위.jpg'
        },
        {
            href: '/birthday',
            label: '우리 반에 나와 생일이 같은 학생이 있을 확률은?',
            description: '학생이 체크한 생일 날짜를 달력에 표시하여 확인해봅시다다.',
            image: '/생일.jpg'
        },
        {
            href: '/RegressionLine',
            label: '회귀직선',
            description: '키와 발사이즈 간의 관계를 실시간으로 확인합니다.',
            image: '/회귀직선.jpg'
        },
        {
            href: '/N_distribution',
            label: '정규분포 그려보기',
            description: '정규분포 곡선을 그리고 분포를 관찰합니다.',
            image: '/정규분포.jpg'
        },
		{
            href: '/dice10',
            label: '주사위 10개의 합',
            description: '주사위 10개의 합을 충분히 많이 굴려 합의 분포를 관찰합니다.',
            image: '/주사위10개.jpg'
        },

    ];
</script>

<svelte:head>
    <link rel="icon" href={favicon} />
</svelte:head>

<header class="topbar">
    <div class="brand">함께 만든 데이터로 탐구하는 통계, 협력학습으로 디지털 리터러시 강화하기</div>
</header>

<main class="content-shell">
    {#if page.url.pathname === '/'}
        <section class="card-grid">
            {#each navItems as item}
                <a class="entry-card" href={item.href}>
                    <div class="entry-card__image-wrap">
                        <img src={item.image} alt={item.label} class="entry-card__image" />
                        <h2>{item.label}</h2>
                    </div>
                    <p>{item.description}</p>
                </a>
            {/each}
        </section>
    {:else}
        {@render children()}
    {/if}
</main>

<a class="home-fab" href="/" aria-label="Home">
    <svg class="home-fab__icon" viewBox="0 0 24 24" aria-hidden="true">
        <path
            d="M3 10.75L12 3l9 7.75v9.25a1 1 0 0 1-1 1h-5.5v-6.25a1 1 0 0 0-1-1h-3a1 1 0 0 0-1 1V21H4a1 1 0 0 1-1-1z"
        />
    </svg>
</a>

<style>
    :global(body) {
        margin: 0;
        /* 기존 height: 100vh를 min-height로 변경하고 overflow 추가 */
        min-height: 100vh;
        overflow-y: auto;
        font-family: 'Pretendard', 'Noto Sans KR', Arial, sans-serif;
        background: linear-gradient(180deg, #eef2ff 0%, #f8fafc 100%);
        color: #0f172a;
    }

    .topbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 14px 18px;
        background: rgba(30, 41, 59, 0.95);
        backdrop-filter: blur(8px);
        box-shadow: 0 10px 24px rgba(15, 23, 42, 0.18);
        position: sticky;
        top: 0;
        z-index: 10;
    }

    .brand {
        font-weight: 600;
        font-size: 1.15rem;
        color: #ffffff;
    }


    .content-shell {
        max-width: 1140px;
        margin: 18px auto 0;
        padding: 20px 14px 28px;
        min-height: calc(100vh - 84px);
    }

    .card-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
        gap: 50px;
    }

    .entry-card {
        display: flex;
        flex-direction: column;
        position: relative;
        background: linear-gradient(160deg, rgba(255, 255, 255, 0.95) 0%, rgba(248, 250, 252, 0.92) 100%);
        border: 1px solid rgba(148, 163, 184, 0.25);
        border-radius: 16px;
        overflow: hidden;
        text-decoration: none;
        padding: 0;
        color: #111827;
        box-shadow:
            0 12px 28px rgba(15, 23, 42, 0.12),
            0 2px 8px rgba(30, 41, 59, 0.08),
            inset 0 1px 0 rgba(255, 255, 255, 0.7);
        backdrop-filter: blur(8px);
        transition:
            transform 0.28s cubic-bezier(0.22, 1, 0.36, 1),
            box-shadow 0.28s cubic-bezier(0.22, 1, 0.36, 1),
            border-color 0.28s ease;
    }

    .entry-card:hover {
        transform: scale(1.1);
        border-color: rgba(148, 163, 184, 0.25);
    }

    .entry-card:active {
        transform: scale(1.04);
        filter: brightness(1.08);
        border-color: rgba(99, 102, 241, 0.45);
        box-shadow:
            0 18px 30px rgba(30, 41, 59, 0.18),
            0 6px 14px rgba(79, 70, 229, 0.18),
            inset 0 1px 0 rgba(255, 255, 255, 0.85);
    }

    .entry-card__image-wrap {
        aspect-ratio: 16 / 9;
        background: #cbd5e1;
        overflow: hidden;
        position: relative;
    }

    .entry-card__image-wrap::before {
        content: '';
        position: absolute;
        inset: 0;
        background: linear-gradient(180deg, rgba(15, 23, 42, 0.08) 0%, rgba(15, 23, 42, 0.55) 100%);
        z-index: 1;
    }

    .entry-card__image {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
        transform: scale(1.01);
        transition: transform 0.35s ease;
    }

    .entry-card:active .entry-card__image {
        transform: scale(1.06);
    }

    .entry-card h2 {
        margin: 12px 14px 0;
        font-size: 1.55rem;
        font-weight: 800;
        letter-spacing: -0.01em;
        color: #ffffff;
        position: absolute;
        right: 14px;
        bottom: 14px;
        text-shadow: 0 4px 14px rgba(0, 0, 0, 0.45);
        z-index: 2;
    }

    .entry-card p {
        margin: 14px 16px 18px;
        color: #334155;
        line-height: 1.5;
        font-size: 1.02rem;
        font-weight: 500;
    }

    .home-fab {
        position: fixed;
        left: 24px;
        top: 55px;
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: linear-gradient(180deg, #e54646 0%, #f67c50 100%);
        box-shadow: 0 12px 28px rgba(55, 48, 163, 0.38);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: #ffffff;
        text-decoration: none;
        padding: 0;
        z-index: 30;
        transition: transform 0.2s ease, box-shadow 0.2s ease;
    }

    .home-fab:hover {
        transform: translateY(-2px) scale(1.03);
        box-shadow: 0 16px 32px rgba(55, 48, 163, 0.45);
        background: linear-gradient(180deg, #6366f1 0%, #312e81 100%);
    }

    .home-fab:focus-visible {
        outline: 3px solid #c7d2fe;
        outline-offset: 3px;
    }

    .home-fab__icon {
        width: 24px;
        height: 24px;
        fill: currentColor;
    }

    @media (max-width: 760px) {
        .brand {
            font-size: 0.95rem;
        }

        .card-grid {
            grid-template-columns: 1fr;
            gap: 16px;
        }
    }
</style>