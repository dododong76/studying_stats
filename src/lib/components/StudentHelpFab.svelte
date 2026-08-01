<script>
    /** @type {{ title: string, children?: import('svelte').Snippet }} */
    let { title, children } = $props();

    let isHelpOpen = $state(false);
    let helpTitleId = $derived(`student-help-${title.replace(/\s+/g, '-').replace(/[^\w가-힣-]/g, '')}`);
</script>

<button class="student-help-fab" type="button" aria-label="도움말 열기" onclick={() => (isHelpOpen = true)}>?</button>

{#if isHelpOpen}
    <div class="student-help-overlay" role="presentation">
        <button
            class="student-help-backdrop"
            type="button"
            aria-label="도움말 닫기"
            onclick={() => (isHelpOpen = false)}
        ></button>
        <div
            class="student-help-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby={helpTitleId}
            tabindex="-1"
        >
            <button
                class="student-help-close"
                type="button"
                aria-label="도움말 닫기"
                onclick={() => (isHelpOpen = false)}
            >×</button>
            <h2 id={helpTitleId}>{title}</h2>
            <div class="student-help-content">
                {@render children?.()}
            </div>
        </div>
    </div>
{/if}

<style>
    /* 1. 우측 하단 고정 ? 플로팅 버튼 */
    .student-help-fab {
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 48px;
        height: 48px;
        border-radius: 50%;
        background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
        color: #ffffff;
        font-size: 1.5rem;
        font-weight: 700;
        border: none;
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.3);
        cursor: pointer;
        z-index: 1000;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform 0.2s ease, box-shadow 0.2s ease;
    }

    .student-help-fab:hover {
        transform: scale(1.08);
        box-shadow: 0 6px 20px rgba(59, 130, 246, 0.4);
    }

    .student-help-fab:active {
        transform: scale(0.95);
    }

    /* 2. 전체 화면 오버레이 레이아웃 */
    .student-help-overlay {
        position: fixed;
        inset: 0;
        z-index: 1001;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 16px;
    }

    /* 3. 배경 어둡게 (백드롭) */
    .student-help-backdrop {
        position: absolute;
        inset: 0;
        background: rgba(15, 23, 42, 0.75);
        backdrop-filter: blur(4px);
        border: none;
        width: 100%;
        height: 100%;
        cursor: pointer;
    }

    /* 4. 모달 창 기본 스타일 (반응형 다크 모드 디자인) */
    .student-help-modal {
        position: relative;
        z-index: 1002;
        width: 100%;
        max-width: 440px; /* 데스크톱 기본 최대 너비 */
        max-height: 85dvh; /* 모바일 주소창 감안한 dynamic viewport height */
        background: #1e293b;
        color: #f8fafc;
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 20px;
        padding: 24px;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5);
        display: flex;
        flex-direction: column;
        animation: popIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes popIn {
        from {
            opacity: 0;
            transform: scale(0.92) translateY(10px);
        }
        to {
            opacity: 1;
            transform: scale(1) translateY(0);
        }
    }

    /* 5. 닫기 버튼 (×) */
    .student-help-close {
        position: absolute;
        top: 16px;
        right: 16px;
        width: 32px;
        height: 32px;
        background: rgba(255, 255, 255, 0.08);
        border: none;
        border-radius: 50%;
        color: #94a3b8;
        font-size: 1.25rem;
        line-height: 1;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.2s, color 0.2s;
    }

    .student-help-close:hover {
        background: rgba(255, 255, 255, 0.16);
        color: #ffffff;
    }

    /* 6. 모달 제목 */
    .student-help-modal h2 {
        margin: 0 0 16px 0;
        font-size: 1.25rem;
        font-weight: 700;
        color: #60a5fa;
        padding-right: 28px; /* 닫기 버튼과 겹침 방지 */
    }

    /* 7. 내용 스크롤 영역 */
    .student-help-content {
        overflow-y: auto;
        font-size: 0.95rem;
        line-height: 1.6;
        color: #cbd5e1;
        padding-right: 4px;
    }

    /* 스크롤바 커스텀 */
    .student-help-content::-webkit-scrollbar {
        width: 6px;
    }
    .student-help-content::-webkit-scrollbar-thumb {
        background: #475569;
        border-radius: 3px;
    }

    /* 슬롯 내부 태그 기본 스타일링 */
    .student-help-content :global(h3) {
        font-size: 1rem;
        color: #f1f5f9;
        margin: 16px 0 6px 0;
    }
    .student-help-content :global(h3:first-child) {
        margin-top: 0;
    }
    .student-help-content :global(p) {
        margin: 0 0 10px 0;
    }

    /* 📱 8. 모바일 화면 최적화 (600px 이하 모바일 디바이스) */
    @media (max-width: 600px) {
        .student-help-overlay {
            padding: 12px;
            align-items: flex-end; /* 모바일에서는 바텀 시트 스타일로 변경 */
        }

        .student-help-modal {
            max-width: 100%;
            max-height: 80dvh;
            border-bottom-left-radius: 0;
            border-bottom-right-radius: 0;
            padding: 20px 18px;
            animation: slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .student-help-fab {
            bottom: 16px;
            right: 16px;
            width: 44px;
            height: 44px;
            font-size: 1.3rem;
        }

        @keyframes slideUp {
            from {
                opacity: 0;
                transform: translateY(100%);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
    }
</style>