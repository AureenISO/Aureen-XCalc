// ==========================================
// PROYECTO AUREEN X - CORE SCRIPT (v9.0 BLINDADO)
// ==========================================

// --- 1. CONFIGURACIÓN PWA ---
let deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    const installBtn = document.getElementById('install-pwa-btn');
    if (installBtn) installBtn.style.display = 'block';
});

// --- 2. ESTADO GLOBAL ---
let state = {
    bcv: { rate: 0, currentInput: "0", isFromUSD: true },
    custom: { rate: 0, currentInput: "0", isFromUSD: true },
    general: { currentInput: "0", previousInput: "", operation: null, history: [] }
};
let currentMode = 'bcv';

// --- 3. UTILIDADES ---
function getTodayString() {
    const d = new Date();
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

// HORARIO NOCTURNO: 9:00 PM (21:00) - 11:59 PM (23:59)
function isPreviewWindow() {
    const h = new Date().getHours();
    return (h >= 21 && h <= 23); 
}

function isNewDay() { return !isPreviewWindow(); }

function formatNumber(numStr) {
    if (!numStr) return "0";
    let parts = numStr.split(',');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return parts.join(',');
}

function parseRaw(numStr) {
    return parseFloat(numStr.replace(/\./g, '').replace(',', '.')) || 0;
}

// --- 4. UI SEGURA (Evita crash por null) ---

function applyRateToUI(rate, dateLabel, color) {
    const bcvRateDisplay = document.getElementById('bcv-rate-display');
    const bcvDateDisplay = document.getElementById('bcv-date-display');
    
    // Protección: Si el elemento no existe, no hacemos nada (evita pantalla roja)
    if (!bcvRateDisplay || !bcvDateDisplay) return;

    state.bcv.rate = parseFloat(rate);
    bcvRateDisplay.innerText = state.bcv.rate.toFixed(2).replace('.', ',');
    bcvDateDisplay.innerText = dateLabel;
    bcvRateDisplay.style.color = color;
    updateDisplay('bcv');
}

function showNextRateUI(rateValue) {
    const displayContainer = document.querySelector('.rate-info');
    if (!displayContainer) return;

    let nextInfo = document.querySelector('.next-rate-info');
    if (!nextInfo) {
        nextInfo = document.createElement('div');
        nextInfo.className = 'next-rate-info';
        displayContainer.appendChild(nextInfo);
    }
    
    nextInfo.innerHTML = `
        <span class="next-rate-label" style="color:var(--text-secondary)">Mañana:</span>
        <span class="next-rate-value" style="color:#FF5252; font-weight:700; margin-left:5px;">
            ${rateValue.toFixed(2).replace('.',',')}
        </span>
    `;
}

function clearNextRateUI() {
    const existingNext = document.querySelector('.next-rate-info');
    if (existingNext) existingNext.remove();
    localStorage.removeItem('aureen-next-rate');
}

// --- 5. CORE: OBTENCIÓN DE TASA ---

async function fetchBCVRate(forceUpdate = false) {
    const bcvRateDisplay = document.getElementById('bcv-rate-display');
    const todayStr = getTodayString();
    
    const colorGreen = "#2ECC71"; 
    const colorOld = "#FFB74D";   

    const savedRate = parseFloat(localStorage.getItem('aureen-bcv-rate')) || 0;
    const savedDate = localStorage.getItem('aureen-bcv-date');
    const savedNextRate = parseFloat(localStorage.getItem('aureen-next-rate')) || 0;

    // A. LIMPIEZA MEDIANOCHE
    if (isNewDay()) clearNextRateUI();

    // B. MOSTRAR DATOS CACHEADOS (Prioridad Visual)
    if (savedRate > 0) {
        const color = (savedDate === todayStr) ? colorGreen : colorOld;
        applyRateToUI(savedRate, savedDate || "--/--", color);
        if (isPreviewWindow() && savedNextRate > 0) showNextRateUI(savedNextRate);
    }

    // C. LÓGICA DE BÚSQUEDA
    // Buscamos si: Forzamos, O es hora nocturna, O la fecha guardada no es hoy.
    if (forceUpdate || isPreviewWindow() || savedDate !== todayStr) {
        
        if (forceUpdate && bcvRateDisplay) {
            bcvRateDisplay.innerText = "...";
            bcvRateDisplay.style.color = "var(--text-secondary)";
        }

        let fetchedRate = 0;
        let success = false;
        const cacheBuster = `?t=${new Date().getTime()}`;

        // LISTA DE PROXIES ROBUSTA
        // allorigins es el más confiable para evitar CORS en entornos web.
        const proxies = [
            { url: 'https://api.allorigins.win/get?url=', type: 'json' },
            { url: 'https://corsproxy.io/?', type: 'html' }
        ];
        const bcvUrl = 'https://www.bcv.org.ve/'; 

        // 1. INTENTO SCRAPING (Para horario nocturno es obligatorio)
        for (const proxy of proxies) {
            if (success) break;
            try {
                // Encodeamos bien la URL para evitar errores 400
                const targetUrl = proxy.url + encodeURIComponent(bcvUrl) + cacheBuster;
                const response = await fetch(targetUrl);
                
                if (response.ok) {
                    let htmlContent = "";
                    
                    if (proxy.type === 'json') {
                        const json = await response.json();
                        htmlContent = json.contents;
                    } else {
                        htmlContent = await response.text();
                    }

                    if (!htmlContent) continue;

                    // PARSEO DOM (Busca id="dolar")
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(htmlContent, 'text/html');
                    const dolarDiv = doc.getElementById('dolar');

                    if (dolarDiv) {
                        const rawText = dolarDiv.textContent.replace(/\s+/g, ' ').trim();
                        // Regex flexible: busca números con coma y muchos decimales
                        const match = rawText.match(/(\d{2,3},\d{4,8})/);
                        
                        if (match && match[1]) {
                            fetchedRate = parseFloat(match[1].replace(',','.'));
                            // Validación anti-basura
                            if (fetchedRate > 10 && fetchedRate < 5000) {
                                success = true;
                                console.log("✅ Tasa obtenida vía Proxy:", fetchedRate);
                            }
                        }
                    }
                }
            } catch(e) { console.warn("Proxy falló, probando siguiente..."); }
        }

        // 2. INTENTO API (Solo de día como respaldo, prohibido de noche)
        if (!success && !isPreviewWindow()) {
            try {
                const resp = await fetch('https://ve.dolarapi.com/v1/dolares/oficial' + cacheBuster);
                if (resp.ok) {
                    const data = await resp.json();
                    if (data.promedio > 0) { 
                        fetchedRate = parseFloat(data.promedio); 
                        success = true; 
                    }
                }
            } catch (e) {}
        }

        // D. GUARDADO INTELIGENTE
        if (success && fetchedRate > 0) {
            if (isPreviewWindow()) {
                // MODO NOCHE:
                // Si no teníamos tasa verde, la creamos. Si ya había, la dejamos quieta.
                if (savedRate === 0) {
                    localStorage.setItem('aureen-bcv-rate', fetchedRate);
                    localStorage.setItem('aureen-bcv-date', todayStr);
                    applyRateToUI(fetchedRate, todayStr, colorGreen);
                } else {
                    // Restauramos visualmente la verde
                    applyRateToUI(savedRate, todayStr, colorGreen);
                }
                // Actualizamos la roja
                showNextRateUI(fetchedRate);
                localStorage.setItem('aureen-next-rate', fetchedRate);
            } else {
                // MODO DÍA:
                localStorage.setItem('aureen-bcv-rate', fetchedRate);
                localStorage.setItem('aureen-bcv-date', todayStr);
                applyRateToUI(fetchedRate, todayStr, colorGreen);
                clearNextRateUI();
            }
        } else {
            // FALLO TOTAL
            if (savedRate > 0) {
                applyRateToUI(savedRate, savedDate || "--/--", (savedDate === todayStr) ? colorGreen : colorOld);
            } else if (bcvRateDisplay) {
                bcvRateDisplay.innerText = "Reintentar";
                bcvRateDisplay.style.color = "#EF5350";
            }
        }
    }
}

// --- 6. VIGILANTE ---
function startNightlyWatcher() {
    if (isPreviewWindow()) fetchBCVRate(true);
    setInterval(() => {
        const h = new Date().getHours();
        const m = new Date().getMinutes();
        if ((h === 21 && m === 0) || (h === 0 && m === 0)) fetchBCVRate(true);
    }, 60000);
}

// --- 7. INICIALIZACIÓN ---
window.onload = function() {
    try { Telegram.WebApp.ready(); } catch (e) {}

    const savedTheme = localStorage.getItem('aureen-calc-theme') || 'dark';
    if (savedTheme === 'light') {
        document.body.setAttribute('data-theme', 'light');
        if(document.getElementById('theme-toggle')) document.getElementById('theme-toggle').checked = true;
    }

    try { state.general.history = JSON.parse(localStorage.getItem('aureen-calc-history')) || []; } catch (e) {}
    
    // Service Worker: Solo registrar si el protocolo es seguro (http/https)
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
        navigator.serviceWorker.register('sw.js').catch(console.error);
    }

    fetchBCVRate();        
    startNightlyWatcher(); 
    updateDisplay('custom');
    updateDisplay('general');

    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    if (!isStandalone) {
        setTimeout(() => {
            if (!sessionStorage.getItem('install-modal-closed')) showModal('install-pwa-modal');
        }, 3000);
    }
};

// --- 8. FUNCIONES DE CALCULADORA (CORE) ---
function switchMode(mode) {
    document.getElementById('options-menu').classList.remove('show');
    currentMode = mode;
    document.querySelectorAll('.mode-content').forEach(el => el.classList.remove('active'));
    document.getElementById(`${mode}-mode`).classList.add('active');
    document.querySelectorAll('.tab-button').forEach(el => el.classList.remove('active'));
    document.getElementById(`btn-${mode}`).classList.add('active');
}
function appendNumber(number, mode) {
    if (state[mode].currentInput === "0" && number !== '00') state[mode].currentInput = number;
    else if (state[mode].currentInput !== "0" || (state[mode].currentInput === "0" && number === '00')) {
         if(state[mode].currentInput.replace(/[,.]/g, '').length < 15) state[mode].currentInput += number;
    }
    updateDisplay(mode);
}
function appendDecimal(mode) {
    if (!state[mode].currentInput.includes(',')) state[mode].currentInput += ',';
    updateDisplay(mode);
}
function deleteLast(mode) {
    state[mode].currentInput = state[mode].currentInput.slice(0, -1);
    if (state[mode].currentInput === "") state[mode].currentInput = "0";
    updateDisplay(mode);
}
function clearAll(mode) {
    state[mode].currentInput = "0";
    if (mode === 'general') { state.general.previousInput = ""; state.general.operation = null; }
    updateDisplay(mode);
}
function updateDisplay(mode) {
    if (mode === 'bcv' || mode === 'custom') {
        const mainDisplay = document.getElementById(`${mode}-main-display`);
        const subDisplay = document.getElementById(`${mode}-sub-display`);
        const fromSymbol = document.getElementById(`${mode}-from-symbol`);
        const toSymbol = document.getElementById(`${mode}-to-symbol`);
        
        if (mode === 'custom') {
            const inputVal = document.getElementById('custom-rate-input').value;
            state.custom.rate = parseFloat(inputVal.replace(',', '.')) || 0;
        }
        mainDisplay.innerText = formatNumber(state[mode].currentInput);
        const currentRate = state[mode].rate;
        if (currentRate === 0) { subDisplay.innerText = "0,00"; return; }
        const mainValue = parseRaw(state[mode].currentInput);
        let subValue = state[mode].isFromUSD ? (mainValue * currentRate) : (mainValue / currentRate);
        if (state[mode].isFromUSD) { fromSymbol.innerText = "$"; toSymbol.innerText = "Bs"; }
        else { fromSymbol.innerText = "Bs"; toSymbol.innerText = "$"; }
        if (!isFinite(subValue) || isNaN(subValue)) subValue = 0;
        subDisplay.innerText = subValue.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } else if (mode === 'general') {
        document.getElementById('general-main-display').innerText = formatNumber(state.general.currentInput);
        if(state.general.operation != null) {
            document.getElementById('general-sub-display').innerText = `${formatNumber(state.general.previousInput)} ${state.general.operation}`;
        } else {
            document.getElementById('general-sub-display').innerText = '';
        }
    }
}
function swapCurrencies(mode) {
    state[mode].isFromUSD = !state[mode].isFromUSD;
    const subDisplayText = document.getElementById(`${mode}-sub-display`).innerText;
    state[mode].currentInput = parseRaw(subDisplayText).toString().replace('.', ',');
    updateDisplay(mode);
}

// --- 9. UI EXTRAS ---
function toggleOptionsMenu() { document.getElementById('options-menu').classList.toggle('show'); }
function showModal(id) { 
    document.getElementById(id).classList.add('show'); 
    document.getElementById('options-menu').classList.remove('show');
    if (id === 'history-screen') renderHistory();
}
function closeModal(id) { 
    document.getElementById(id).classList.remove('show');
    if (id === 'install-pwa-modal') sessionStorage.setItem('install-modal-closed', 'true');
}
function toggleTheme() {
    const toggle = document.getElementById('theme-toggle');
    if (toggle.checked) { document.body.setAttribute('data-theme', 'light'); localStorage.setItem('aureen-calc-theme', 'light'); }
    else { document.body.removeAttribute('data-theme'); localStorage.setItem('aureen-calc-theme', 'dark'); }
}
function triggerInstallPrompt() { if (deferredInstallPrompt) deferredInstallPrompt.prompt(); }
window.addEventListener('click', (e) => {
    const menu = document.getElementById('options-menu');
    const btn = document.getElementById('options-menu-btn');
    if (e.target && !menu.contains(e.target) && !btn.contains(e.target)) menu.classList.remove('show');
});

// Compartir
function shareToWhatsApp(mode) {
    const shopPhoneNumber = "584141802040"; 
    const mainAmount = document.getElementById(`${mode}-main-display`).innerText;
    const subAmount = document.getElementById(`${mode}-sub-display`).innerText;
    const rate = state[mode].rate.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (parseRaw(state[mode].currentInput) === 0) {
        window.open(`https://wa.me/${shopPhoneNumber}?text=${encodeURIComponent("Hola Erick, información sobre Aureen.")}`, '_blank');
        return; 
    }
    const emjAbacus = String.fromCodePoint(0x1F9EE);     
    const emjDollar = String.fromCodePoint(0x1F4B5);     
    const emjFlag   = String.fromCodePoint(0x1F1FB, 0x1F1EA); 
    let message = `*${emjAbacus} Cálculo Aureen*\n\n${emjDollar} ${state[mode].isFromUSD ? mainAmount : subAmount} $\n${emjFlag} ${state[mode].isFromUSD ? subAmount : mainAmount} Bs\n\nTasa: ${rate}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
}
function shareToTelegram(mode) { shareToSocialGeneric('telegram', mode); }
function shareToSocial(platform, mode) { shareToSocialGeneric(platform, mode); }
function shareToSocialGeneric(platform, mode) {
    const mainAmount = document.getElementById(`${mode}-main-display`).innerText;
    const subAmount = document.getElementById(`${mode}-sub-display`).innerText;
    const rate = state[mode].rate.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    let url = "";
    let msg = `Aureen Calc:\n$${state[mode].isFromUSD ? mainAmount : subAmount} = Bs${state[mode].isFromUSD ? subAmount : mainAmount}\nTasa: ${rate}`;
    if (parseRaw(state[mode].currentInput) === 0) msg = "Prueba Aureen X Calculator.";
    if (platform === 'telegram') url = `https://t.me/share/url?url=https://t.me/aureenAIbot&text=${encodeURIComponent(msg)}`;
    else if (platform === 'x') url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(msg)}`;
    else if (platform === 'threads') url = `https://www.threads.net/intent/post?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
}

// Haptic
function triggerHaptic() { if (navigator.vibrate) navigator.vibrate(15); }
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('button, .venezuela-banner, .creator-signature, .main-amount, .converted-amount').forEach(btn => {
        btn.addEventListener('click', () => triggerHaptic());
    });
});
