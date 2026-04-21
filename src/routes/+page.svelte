<section class="home">
	<h1>확률과 통계 협업 실험실</h1>
	<p>교사와 학생이 함께 통계 실험을 수행하고 결과를 공유하는 테스트 공간입니다.</p>

	<div class="cards">
		<a class="card" href="/dice">
			<h2>주사위 던지기기</h2>
			<p>통계적 확률과 수학적 확률의 관계 알아보기</p>
		</a>
		<a class="card" href="/dice10">
			<h2>주사위 10개 · 합의 분포</h2>
			<p>10개를 한 번에 굴려 합(10~60)의 상대도수를 확인</p>
		</a>
		<a class="card" href="/RegressionLine">
			<h2>RegressionLine</h2>
			<p>좌표 데이터를 모아 산점도와 회귀직선을 함께 확인</p>
		</a>
		<a class="card" href="/N_distribution">
			<h2>정규분포 실험</h2>
			<p>정규분포 실험: 표본을 누적하며 종 모양 히스토그램 관찰</p>
		</a>
	</div>
</section>

<style>
	.home {
		padding: 8px;
		height: 70%;
	}

	h1 {
		margin: 4px 0 10px;
		font-size: clamp(1.4rem, 2.8vw, 2rem);
	}

	p {
		margin: 0 0 16px;
		color: #334155;
	}

	.cards {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 14px;
	}

	.card {
		text-decoration: none;
		color: inherit;
		padding: 18px;
		border-radius: 14px;
		border: 1px solid #bfdbfe;
		background: linear-gradient(160deg, #ffffff 0%, #eff6ff 100%);
		box-shadow: 0 8px 24px rgba(30, 64, 175, 0.1);
		transition: transform 0.2s ease;
	}

	.card:hover {
		transform: scale(1.1);
	}

	h2 {
		margin: 0 0 8px;
	}

	.card p {
		margin: 0;
	}
</style>
