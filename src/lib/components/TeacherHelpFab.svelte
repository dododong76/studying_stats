<script>
    /** @type {{ title: string, children?: import('svelte').Snippet }} */
    let { title, children } = $props();

    let isHelpOpen = $state(false);
    let helpTitleId = $derived(`teacher-help-${title.replace(/\s+/g, '-').replace(/[^\w가-힣-]/g, '')}`);
</script>

<button class="help-fab" type="button" aria-label="도움말 열기" onclick={() => (isHelpOpen = true)}>?</button>

{#if isHelpOpen}
    <div class="help-overlay" role="presentation">
        <button class="help-backdrop" type="button" aria-label="도움말 닫기" onclick={() => (isHelpOpen = false)}></button>
        <div class="help-modal" role="dialog" aria-modal="true" aria-labelledby={helpTitleId} tabindex="-1">
            <button class="help-close" type="button" aria-label="도움말 닫기" onclick={() => (isHelpOpen = false)}>×</button>
            <h2 id={helpTitleId}>{title}</h2>
            <div class="help-content">
                {@render children?.()}
            </div>
        </div>
    </div>
{/if}

<style>
    .help-fab {
        position: fixed;
        top: 94px;
        right: 28px;
        width: 64px;
        height: 64px;
        border-radius: 999px;
        border: none;
        background: linear-gradient(135deg, #f97316, #ef4444);
        color: #fff;
        font-size: 2rem;
        font-weight: 900;
        line-height: 1;
        box-shadow: 0 12px 26px rgba(15, 23, 42, 0.28);
        cursor: pointer;
        z-index: 55;
    }

    .help-fab:hover {
        transform: translateY(-2px);
        filter: brightness(1.06);
    }

    .help-overlay {
        position: fixed;
        inset: 0;
        background: rgba(15, 23, 42, 0.48);
        backdrop-filter: blur(3px);
        display: grid;
        place-items: center;
        z-index: 100;
        padding: 24px;
    }

    .help-backdrop {
        position: absolute;
        inset: 0;
        border: none;
        background: transparent;
        cursor: pointer;
    }

    .help-modal {
        position: relative;
        width: min(860px, 94vw);
        max-height: 85dvh; /* 모바일 높이 초과 방지 */
        display: flex;
        flex-direction: column;
        background: #fff7ed;
        border: 2px solid #fdba74;
        border-radius: 28px;
        padding: 34px 32px 30px;
        box-shadow: 0 24px 60px rgba(2, 6, 23, 0.32);
    }

    .help-close {
        position: absolute;
        top: 14px;
        right: 16px;
        width: 68px;
        height: 68px;
        border-radius: 999px;
        border: none;
        background: #ef4444;
        color: #fff;
        font-size: 2.5rem;
        font-weight: 900;
        line-height: 1;
        cursor: pointer;
        box-shadow: 0 10px 24px rgba(239, 68, 68, 0.38);
        z-index: 10;
    }

    .help-modal h2 {
        margin: 0 88px 18px 0;
        font-size: 2.1rem;
        color: #9a3412;
        flex-shrink: 0;
    }

    /* 본문 스크롤 영역 */
    .help-content {
        overflow-y: auto;
        padding-right: 6px;
    }

    /* 커스텀 스크롤바 */
    .help-content::-webkit-scrollbar {
        width: 6px;
    }
    .help-content::-webkit-scrollbar-thumb {
        background: #fdba74;
        border-radius: 3px;
    }

    .help-content :global(h3) {
        margin: 16px 0 8px;
        font-size: 1.5rem;
        color: #7c2d12;
    }

    .help-content :global(h3:first-child) {
        margin-top: 0;
    }

    .help-content :global(p) {
        margin: 0 0 10px;
        font-size: 1.2rem;
        line-height: 1.65;
        color: #1f2937;
        font-weight: 600;
    }

    /* 📱 모바일 및 소형 화면 반응형 처리 */
    @media (max-width: 900px) {
        .help-fab {
            top: 82px;
            right: 16px;
            width: 56px;
            height: 56px;
            font-size: 1.75rem;
        }

        .help-overlay {
            padding: 16px;
        }

        .help-modal {
            width: 100%;
            max-height: 80dvh;
            padding: 24px 20px 20px;
            border-radius: 20px;
        }

        .help-close {
            top: 12px;
            right: 12px;
            width: 44px;
            height: 44px;
            font-size: 1.8rem;
        }

        .help-modal h2 {
            margin: 0 52px 14px 0;
            font-size: 1.5rem;
        }

        .help-content :global(h3) {
            font-size: 1.2rem;
            margin: 12px 0 6px;
        }

        .help-content :global(p) {
            font-size: 1rem;
            line-height: 1.5;
        }
    }
</style>