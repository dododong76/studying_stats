<script>
	/** @type {{ title: string, children?: import('svelte').Snippet }} */
	let { title, children } = $props();

	let isHelpOpen = $state(false);
	let helpTitleId = $derived(`student-help-${title.replace(/\s+/g, '-').replace(/[^\w가-힣-]/g, '')}`);
</script>

<button class="student-help-fab" type="button" aria-label="도우말 열기" onclick={() => (isHelpOpen = true)}>?</button>

{#if isHelpOpen}
	<div class="student-help-overlay" role="presentation">
		<button
			class="student-help-backdrop"
			type="button"
			aria-label="도우말 닫기"
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
				aria-label="도우말 닫기"
				onclick={() => (isHelpOpen = false)}
			>×</button>
			<h2 id={helpTitleId}>{title}</h2>
			<div class="student-help-content">
				{@render children?.()}
			</div>
		</div>
	</div>
{/if}
