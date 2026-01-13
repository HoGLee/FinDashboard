document.addEventListener('DOMContentLoaded', () => {
	// === API Keys and Configuration ===
	const ALPHA_VANTAGE_API_KEY = 'AK9PH524P0CB2IHL'; // This key is from user input.

	// === DOM Element References ===
	const elements = {
		bitcoin: {
			price: document.getElementById('bitcoin-price'),
			change: document.getElementById('bitcoin-change'),
			chartCanvas: document.getElementById('bitcoin-chart'),
		},
		search: {
			input: document.getElementById('stock-ticker-input'),
			button: document.getElementById('search-stock-button'),
			card: document.getElementById('stock-result-card'),
			name: document.getElementById('stock-name'),
			price: document.getElementById('stock-price'),
			change: document.getElementById('stock-change'),
			error: document.getElementById('stock-error'),
			chartCanvas: document.getElementById('stock-chart'),
		},
	};

	const chartInstances = {}; // To keep track of created charts

	// === Helper Functions ===
	function showLoading(element) {
		element.textContent = '로딩 중...';
		element.classList.remove('positive', 'negative', 'error-message');
	}

	function showError(element, message) {
		element.textContent = message;
		element.classList.add('error-message');
	}

	function formatNumber(num, fixed = 2) {
		return parseFloat(num)
			.toFixed(fixed)
			.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
	}

	// === Charting Function ===
	function renderChart(canvasId, labels, data, dataLabel, isKRW) {
		const ctx = document.getElementById(canvasId).getContext('2d');
		if (chartInstances[canvasId]) {
			chartInstances[canvasId].destroy(); // Destroy previous chart instance
		}
		chartInstances[canvasId] = new Chart(ctx, {
			type: 'line',
			data: {
				labels: labels,
				datasets: [
					{
						label: dataLabel,
						data: data,
						borderColor: '#00CC99',
						backgroundColor: 'rgba(0, 204, 153, 0.1)',
						borderWidth: 2,
						pointRadius: 0,
						tension: 0.1,
					},
				],
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				scales: {
					x: { display: false },
					y: { display: false },
				},
				plugins: {
					legend: { display: false },
					tooltip: {
						mode: 'index',
						intersect: false,
						callbacks: {
							label: function (context) {
								let label = context.dataset.label || '';
								if (label) {
									label += ': ';
								}
								let value = context.parsed.y;
								label += isKRW ? `₩${formatNumber(value, 0)}` : `$${formatNumber(value, 2)}`;
								return label;
							},
						},
					},
				},
			},
		});
	}

	// === API Fetching Functions ===

	async function fetchStockPriceData(symbol, displayId, elemGroup) {
		showLoading(elemGroup.price);
		elemGroup.change.textContent = '';
		if (elemGroup.name) elemGroup.name.textContent = displayId;
		if (elemGroup.error) elemGroup.error.textContent = '';

		if (ALPHA_VANTAGE_API_KEY === 'YOUR_ALPHA_VANTAGE_API_KEY' || !ALPHA_VANTAGE_API_KEY) {
			const msg = 'Alpha Vantage API 키를 설정해주세요!';
			showError(elemGroup.price, msg);
			if (elemGroup.name) showError(elemGroup.name, msg);
			showError(elemGroup.error, msg);
			return;
		}

		// 1. Fetch Global Quote (current price)
		try {
			const quoteUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${ALPHA_VANTAGE_API_KEY}`;
			const response = await fetch(quoteUrl);
			const data = await response.json();
			const globalQuote = data['Global Quote'];
			const note = data['Note'];
			const errorMessage = data['Error Message'];

			if (globalQuote && Object.keys(globalQuote).length > 0) {
				const currentPrice = parseFloat(globalQuote['05. price']);
				const changePrice = parseFloat(globalQuote['09. change']);
				elemGroup.price.textContent = `$ ${formatNumber(currentPrice, 2)}`;
				elemGroup.change.textContent = `${changePrice > 0 ? '+' : ''}${formatNumber(changePrice, 2)}`;
				elemGroup.change.className = `change ${changePrice >= 0 ? 'positive' : 'negative'}`;
				return true; // Indicate success for price data
			} else if (note) {
				throw new Error('API 요청 한도 초과');
			} else if (errorMessage) {
				throw new Error(`API 오류: ${errorMessage}`);
			} else {
				throw new Error(`'${symbol}' 현재가 정보 없음. 종목 코드를 확인하세요.`);
			}
		} catch (error) {
			console.error(`'${symbol}' 현재가 조회 오류:`, error);
			showError(elemGroup.price, error.message.includes('API') ? error.message : '로드 실패');
			return false; // Indicate failure
		}
	}
	async function fetchStockGraphData(symbol, displayId, elemGroup) {
		// showLoading(elemGroup.price); // Price already handled by fetchStockPriceData
		// elemGroup.change.textContent = ''; // Change already handled
		if (elemGroup.name) elemGroup.name.textContent = displayId;
		if (elemGroup.error) elemGroup.error.textContent = '';

		if (ALPHA_VANTAGE_API_KEY === 'YOUR_ALPHA_VANTAGE_API_KEY' || !ALPHA_VANTAGE_API_KEY) {
			const msg = 'Alpha Vantage API 키를 설정해주세요!';
			showError(elemGroup.price, msg);
			if (elemGroup.name) showError(elemGroup.name, msg);
			showError(elemGroup.error, msg);
			return;
		}
		// 2. Fetch Time Series (chart data)
		try {
			const seriesUrl = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&outputsize=compact&apikey=${ALPHA_VANTAGE_API_KEY}`;
			const response = await fetch(seriesUrl);
			const data = await response.json();
			const timeSeries = data['Time Series (Daily)'];

			if (timeSeries) {
				const dates = Object.keys(timeSeries).slice(0, 60).reverse(); // Last 60 days
				const prices = dates.map((date) => parseFloat(timeSeries[date]['4. close']));
				renderChart(elemGroup.chartCanvas.id, dates, prices, symbol, false);
			} else {
				console.warn(`'${symbol}' 차트 데이터 없음`);
			}
		} catch (error) {
			console.error(`'${symbol}' 차트 데이터 조회 오류:`, error);
		}
	}
	async function fetchCryptoData(symbol, market, displayId, elemGroup) {
		showLoading(elemGroup.price);
		elemGroup.change.textContent = '';
		if (elemGroup.name) elemGroup.name.textContent = displayId;
		if (elemGroup.error) elemGroup.error.textContent = '';

		// 1. Fetch current price from Upbit API (via CORS proxy)
		const proxyUrl = 'https://api.allorigins.win/raw?url=';
		const upbitApiUrl = `https://api.upbit.com/v1/ticker?markets=${market}-${symbol}`;

		try {
			const response = await fetch(proxyUrl + encodeURIComponent(upbitApiUrl));
			if (!response.ok) {
				throw new Error(`HTTP 오류! 상태: ${response.status}`);
			}
			const data = await response.json();
			if (data && data.length > 0) {
				const btc = data[0];
				elemGroup.price.textContent = `₩ ${formatNumber(btc.trade_price, 0)}`;
				const change = btc.signed_change_price;
				elemGroup.change.textContent = `${change > 0 ? '+' : ''}${formatNumber(change, 0)}`;
				elemGroup.change.className = `change ${change >= 0 ? 'positive' : 'negative'}`;
			} else {
				throw new Error('비트코인 현재가 정보 없음.');
			}
		} catch (error) {
			console.error('비트코인 현재가 조회 오류:', error);
			showError(elemGroup.price, error.message.includes('HTTP') ? error.message : '로드 실패');
			// Do not return here, continue to fetch chart data if possible
		}

		// 2. Fetch Time Series for chart from Alpha Vantage
		if (ALPHA_VANTAGE_API_KEY === 'YOUR_ALPHA_VANTAGE_API_KEY' || !ALPHA_VANTAGE_API_KEY) {
			const msg = 'Alpha Vantage API 키를 설정해주세요! 비트코인 차트를 불러올 수 없습니다.';
			console.warn(msg);
			// Optionally show an error on the chart area or bitcoin card
			return;
		}
	}

	// === Initial Data Load ===
	if (ALPHA_VANTAGE_API_KEY === 'YOUR_ALPHA_VANTAGE_API_KEY' || !ALPHA_VANTAGE_API_KEY) {
		showError(elements.search.error, 'Alpha Vantage API 키를 script.js에 설정해주세요! 주식 검색 및 비트코인 차트가 작동하지 않습니다.');
		showError(elements.bitcoin.price, 'API 키 설정 필요');
	} else {
		fetchCryptoData('BTC', 'KRW', '비트코인', elements.bitcoin);
	}

	// === Event Listeners ===
	elements.search.button.addEventListener('click', async () => {
		// Marked async here
		const ticker = elements.search.input.value.trim().toUpperCase();
		if (ticker) {
			elements.search.card.style.display = 'flex';
			const priceFetchSuccess = await fetchStockPriceData(ticker, ticker, elements.search); // Wait for price

			if (priceFetchSuccess) {
				// Only fetch graph if price data was successful
				await new Promise((resolve) => setTimeout(resolve, 1000)); // 1-second delay
				fetchStockGraphData(ticker, ticker, elements.search); // Fetch graph after delay
			}
		} else {
			elements.search.card.style.display = 'flex';
			showError(elements.search.name, '');
			showError(elements.search.price, '');
			showError(elements.search.change, '');
			showError(elements.search.error, '종목 코드를 입력해주세요.');
		}
	});

	// Hide stock result card initially
	elements.search.card.style.display = 'none';
});
