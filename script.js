// --- CONFIGURACIÓN INICIAL ---
let deferredInstallPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    const installBtn = document.getElementById('install-pwa-btn');
    if (installBtn) installBtn.style.display = 'block';
});

// --- ESTADO GLOBAL ---
let state = {
    bcv: { rate: 0, currentInput: "0", isFromUSD: true },
    custom: { rate: 0, currentInput: "0", isFromUSD: true },
    general: { currentInput: "0", previousInput: "", operation: null, history: [] }
};
let currentMode = 'bcv';

// --- UTILIDAD: FECHA DE HOY ---
function getTodayString() {
    const d = new Date();
    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

// --- NUEVA FUNCIÓN: FORMATEAR NÚMEROS (AGREGAR PUNTOS) ---
function formatNumber(numStr) {
    if (!numStr) return "0";
    // Separamos la parte entera de los decimales
    let parts = numStr.split(',');
    // Agregamos los puntos de mil a la parte entera
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    // Unimos de nuevo (si tenía decimales, los pone, si no, queda entero)
    return parts.join(',');
}

// --- UTILIDAD: LIMPIAR NÚMEROS PARA CÁLCULOS (QUITAR PUNTOS) ---
function parseRaw(numStr) {
    // Quitamos los puntos y cambiamos la coma por punto para que JS entienda
    return parseFloat(numStr.replace(/\./g, '').replace(',', '.')) || 0;
}

// --- FUNCIÓN WHATSAPP (INFALIBLE) ---
function shareToWhatsApp(mode) {
    const shopPhoneNumber = "584141802040"; 

    const mainAmount = document.getElementById(`${mode}-main-display`).innerText;
    const subAmount = document.getElementById(`${mode}-sub-display`).innerText;
    const rate = state[mode].rate.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    
    const isZero = (mainAmount === "0" || mainAmount === "0,00" || mainAmount === "0.00" || mainAmount === "");
    const appLink = "t.me/aureenAIbot"; 

    // EMOJIS MATEMÁTICOS
    const emjAbacus  = String.fromCodePoint(0x1F9EE);     
    const emjDollar  = String.fromCodePoint(0x1F4B5);     
    const emjDown    = String.fromCodePoint(0x2B07, 0xFE0F); 
    const emjFlag    = String.fromCodePoint(0x1F1FB, 0x1F1EA); 
    const emjChart   = String.fromCodePoint(0x1F4CA);     

    let message = "";

    if (isZero) {
        const infoMessage = "Hola Erick, me gustaría solicitar información sobre el proyecto Aureen.";
        window.open(`https://wa.me/${shopPhoneNumber}?text=${encodeURIComponent(infoMessage)}`, '_blank');
        return; 
    } else {
        let usdAmount = state[mode].isFromUSD ? mainAmount : subAmount;
        let bsAmount = state[mode].isFromUSD ? subAmount : mainAmount;

        message = `*${emjAbacus} Cálculo Aureen*\n\n`;
        message += `${emjDollar}  ${usdAmount} $\n`;
        message += `${emjDown}\n`;
        message += `${emjFlag}  ${bsAmount} Bs\n\n`;
        message += `${emjChart} Tasa: ${rate}\n`;
        message += `_#TasaBCV #AureenX_`;
    }

    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
}
// --- FUNCIÓN TELEGRAM (INFALIBLE) ---
function shareToTelegram(mode) {
    const contactUsername = "Emanrique0"; 

    const mainAmount = document.getElementById(`${mode}-main-display`).innerText;
    const subAmount = document.getElementById(`${mode}-sub-display`).innerText;
    const rate = state[mode].rate.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    
    const isZero = (mainAmount === "0" || mainAmount === "0,00" || mainAmount === "0.00" || mainAmount === "");
    const appLink = "https://t.me/aureenAIbot";

    // EMOJIS MATEMÁTICOS
    const emjAbacus  = String.fromCodePoint(0x1F9EE);     
    const emjDollar  = String.fromCodePoint(0x1F4B5);     
    const emjDown    = String.fromCodePoint(0x2B07, 0xFE0F); 
    const emjFlag    = String.fromCodePoint(0x1F1FB, 0x1F1EA); 
    const emjChart   = String.fromCodePoint(0x1F4CA);

    let url = "";

    if (isZero) {
        url = `https://t.me/${contactUsername}`;
    } else {
        let usdAmount = state[mode].isFromUSD ? mainAmount : subAmount;
        let bsAmount = state[mode].isFromUSD ? subAmount : mainAmount;
        
        let message = `${emjAbacus} Cálculo Aureen\n\n`;
        message += `${emjDollar}  ${usdAmount} $\n`;
        message += `${emjDown}\n`;
        message += `${emjFlag}  ${bsAmount} Bs\n\n`;
        message += `${emjChart} Tasa: ${rate}\n`;
        message += `#TasaBCV #AureenX`;

        url = `https://t.me/share/url?url=${encodeURIComponent(appLink)}&text=${encodeURIComponent(message)}`;
    }

    window.open(url, '_blank');
}

// --- UTILIDAD: FECHA DE HOY (FORMATO BONITO DD/MM/AAAA) ---
function getTodayString() {
    const d = new Date();
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0'); // Mes empieza en 0
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
}

// --- FUNCIÓN MAESTRA: OBTENER TASA BCV (CON COLOR DESTAQUE) ---
async function fetchBCVRate(forceUpdate = false) {
    const bcvRateDisplay = document.getElementById('bcv-rate-display');
    const bcvDateDisplay = document.getElementById('bcv-date-display');
    const todayStr = getTodayString();
    
    const savedRate = localStorage.getItem('aureen-bcv-rate');
    const savedDate = localStorage.getItem('aureen-bcv-date');

    // COLOR PARA RESALTAR LA TASA (Verde Esmeralda)
    const highlightColor = "#2ECC71"; 

    // 1. INTENTO USAR DATOS GUARDADOS
    if (!forceUpdate && savedRate && savedDate === todayStr) {
        console.log(`Usando tasa guardada: ${savedRate}`);
        state.bcv.rate = parseFloat(savedRate);
        
        bcvRateDisplay.innerText = state.bcv.rate.toFixed(2).replace('.', ',');
        bcvDateDisplay.innerText = savedDate;
        
        // APLICAMOS EL COLOR DESTAQUE AQUÍ
        bcvRateDisplay.style.color = highlightColor;
        
        updateDisplay('bcv');
        return; 
    }

    // 2. BUSCANDO...
    bcvRateDisplay.innerText = "...";
    bcvRateDisplay.style.color = "var(--secondary-text)";
    
    let success = false;
    let rateFound = 0;

    // A. Intento API
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000); 
        const response = await fetch('https://ve.dolarapi.com/v1/dolares/oficial', { signal: controller.signal });
        clearTimeout(timeoutId);

        if (response.ok) {
            const data = await response.json();
            if (data && data.promedio > 0) {
                rateFound = parseFloat(data.promedio);
                success = true;
            }
        }
    } catch (e) { console.warn("API lenta..."); }

    // B. Intento Proxies
    if (!success) {
        const proxies = ['https://api.allorigins.win/raw?url=', 'https://corsproxy.io/?'];
        const bcvUrl = 'https://www.bcv.org.ve/';

        for (const proxy of proxies) {
            if (success) break;
            try {
                const targetUrl = proxy + encodeURIComponent(bcvUrl);
                const response = await fetch(targetUrl);
                if (!response.ok) throw new Error('Status ' + response.status);
                const html = await response.text();
                
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                const strongs = doc.querySelectorAll('strong');
                for (let s of strongs) {
                    const txt = s.textContent.trim();
                    if (/^\d{2,3},\d{2,8}$/.test(txt)) {
                        rateFound = parseFloat(txt.replace(',', '.'));
                        success = true;
                        break;
                    }
                }
            } catch (e) { console.warn(e); }
        }
    }

    // 3. RESULTADO FINAL
    if (success && rateFound > 0) {
        state.bcv.rate = rateFound;
        localStorage.setItem('aureen-bcv-rate', rateFound);
        localStorage.setItem('aureen-bcv-date', todayStr);
        
        bcvRateDisplay.innerText = state.bcv.rate.toFixed(2).replace('.', ',');
        bcvDateDisplay.innerText = todayStr;
        
        // APLICAMOS EL COLOR DESTAQUE AQUÍ TAMBIÉN
        bcvRateDisplay.style.color = highlightColor;
        
        updateDisplay('bcv');
    } else {
        if (savedRate) {
            state.bcv.rate = parseFloat(savedRate);
            bcvRateDisplay.innerText = state.bcv.rate.toFixed(2).replace('.', ',');
            bcvDateDisplay.innerText = savedDate || "--/--";
            bcvRateDisplay.style.color = "#FFB74D"; // Naranja si es dato viejo
            updateDisplay('bcv');
        } else {
            bcvRateDisplay.innerText = "Reintentar";
            bcvDateDisplay.innerText = "--/--";
            bcvRateDisplay.style.color = "#EF5350"; // Rojo error
            bcvRateDisplay.onclick = () => fetchBCVRate(true);
        }
    }
}

// --- INICIALIZACIÓN ---
window.onload = function() {
    try { Telegram.WebApp.ready(); } catch (e) {}

    const savedTheme = localStorage.getItem('aureen-calc-theme') || 'dark';
    if (savedTheme === 'light') {
        document.body.setAttribute('data-theme', 'light');
        if(document.getElementById('theme-toggle')) document.getElementById('theme-toggle').checked = true;
    }

    try { state.general.history = JSON.parse(localStorage.getItem('aureen-calc-history')) || []; } catch (e) {}

    if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(console.error);

    fetchBCVRate();
    updateDisplay('custom');
    updateDisplay('general');

    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    if (!isStandalone) {
        setTimeout(() => {
            if (!sessionStorage.getItem('install-modal-closed')) {
                showModal('install-pwa-modal');
            }
        }, 3000);
    }
};

// --- LÓGICA UI Y CÁLCULOS ---
function switchMode(mode) {
    document.getElementById('options-menu').classList.remove('show');
    currentMode = mode;
    document.querySelectorAll('.mode-content').forEach(el => el.classList.remove('active'));
    document.getElementById(`${mode}-mode`).classList.add('active');
    document.querySelectorAll('.tab-button').forEach(el => el.classList.remove('active'));
    document.getElementById(`btn-${mode}`).classList.add('active');
}

function appendNumber(number, mode) {
    // Agregamos el número a la cadena "cruda" (sin puntos)
    if (state[mode].currentInput === "0" && number !== '00') {
        state[mode].currentInput = number;
    } else if (state[mode].currentInput !== "0" || (state[mode].currentInput === "0" && number === '00') ) {
         // Limitamos a 15 dígitos para evitar errores de JS
         // (eliminamos puntos y comas para contar los dígitos reales)
         if(state[mode].currentInput.replace(/[,.]/g, '').length < 15) {
             state[mode].currentInput += number;
         }
    }
    updateDisplay(mode);
}

function appendDecimal(mode) {
    if (!state[mode].currentInput.includes(',')) {
        state[mode].currentInput += ',';
    }
    updateDisplay(mode);
}

function deleteLast(mode) {
    state[mode].currentInput = state[mode].currentInput.slice(0, -1);
    if (state[mode].currentInput === "") state[mode].currentInput = "0";
    updateDisplay(mode);
}

function clearAll(mode) {
    state[mode].currentInput = "0";
    if (mode === 'general') {
        state.general.previousInput = "";
        state.general.operation = null;
    }
    updateDisplay(mode);
}

function updateDisplay(mode) {
    if (mode === 'bcv' || mode === 'custom') {
        const fromSymbol = document.getElementById(`${mode}-from-symbol`);
        const toSymbol = document.getElementById(`${mode}-to-symbol`);
        const mainDisplay = document.getElementById(`${mode}-main-display`);
        const subDisplay = document.getElementById(`${mode}-sub-display`);
        
        if (mode === 'custom') {
            const inputVal = document.getElementById('custom-rate-input').value;
            state.custom.rate = parseFloat(inputVal.replace(',', '.')) || 0;
        }
        
        const currentRate = state[mode].rate;
        
        // --- AQUÍ ESTÁ LA MAGIA DEL FORMATO ---
        // Usamos formatNumber para mostrar "1.000.000" en vez de "1000000"
        mainDisplay.innerText = formatNumber(state[mode].currentInput);
        
        if (currentRate === 0) {
            subDisplay.innerText = "0,00";
            return;
        }

        // Para calcular, usamos la versión limpia (sin puntos)
        const mainValue = parseRaw(state[mode].currentInput);
        let subValue = 0;

        if (state[mode].isFromUSD) {
            subValue = mainValue * currentRate;
            fromSymbol.innerText = "$"; toSymbol.innerText = "Bs";
        } else {
            subValue = mainValue / currentRate;
            fromSymbol.innerText = "Bs"; toSymbol.innerText = "$";
        }

        if (!isFinite(subValue) || isNaN(subValue)) subValue = 0;
        subDisplay.innerText = subValue.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    
    } else if (mode === 'general') {
        // En la calculadora general también aplicamos el formato visual
        document.getElementById('general-main-display').innerText = formatNumber(state.general.currentInput);
        
        if(state.general.operation != null) {
            // Formateamos también el número anterior pequeño
            const prevFormatted = formatNumber(state.general.previousInput);
            document.getElementById('general-sub-display').innerText = `${prevFormatted} ${state.general.operation}`;
        } else {
            document.getElementById('general-sub-display').innerText = '';
        }
    }
}

function swapCurrencies(mode) {
    state[mode].isFromUSD = !state[mode].isFromUSD;
    const subDisplayText = document.getElementById(`${mode}-sub-display`).innerText;
    // Al cambiar, tomamos el valor formateado y lo limpiamos para guardarlo en el estado
    const subValueRaw = parseRaw(subDisplayText);
    
    // Lo guardamos como string con coma decimal
    state[mode].currentInput = subValueRaw.toString().replace('.', ',');
    updateDisplay(mode);
}

// --- CALCULADORA GENERAL ---
function chooseOperation(op) {
    if(state.general.currentInput === '0' && state.general.previousInput === '') return;
    if(state.general.previousInput !== '') calculate();
    state.general.operation = op;
    state.general.previousInput = state.general.currentInput;
    state.general.currentInput = '0';
    updateDisplay('general');
}

function calculate() {
    let result;
    const prev = parseRaw(state.general.previousInput);
    const current = parseRaw(state.general.currentInput);
    const op = state.general.operation;

    if(isNaN(prev) || isNaN(current)) return;

    switch(op) {
        case '+': result = prev + current; break;
        case '-': result = prev - current; break;
        case '×': result = prev * current; break;
        case '÷': result = prev / current; break;
        case '^': result = Math.pow(prev, current); break;
        case '%': result = (prev / 100) * current; break;
        default: return;
    }

    // 1. Para el Historial: Queremos que se vea bonito con puntos (ej: 1.200,50)
    const resultForHistory = result.toLocaleString('es-VE', { maximumFractionDigits: 10 });

    // 2. Para el Estado (Memoria): Queremos el número crudo pero con coma (ej: 1200,50)
    // (Esto es vital para poder seguir operando sobre el resultado)
    let resultForState = result.toString().replace('.', ',');
    
    state.general.history.unshift({
        operation: `${formatNumber(state.general.previousInput)} ${op} ${formatNumber(state.general.currentInput)}`,
        result: resultForHistory
    });
    
    if (state.general.history.length > 50) state.general.history.pop();
    localStorage.setItem('aureen-calc-history', JSON.stringify(state.general.history));

    state.general.currentInput = resultForState;
    state.general.operation = null;
    state.general.previousInput = '';
    updateDisplay('general');
    if(document.getElementById('history-screen').classList.contains('show')) renderHistory();
}

// --- UI EXTRAS ---
function toggleOptionsMenu() { document.getElementById('options-menu').classList.toggle('show'); }

function showModal(id) { 
    document.getElementById(id).classList.add('show'); 
    document.getElementById('options-menu').classList.remove('show');
    if (id === 'history-screen') renderHistory();
}

function closeModal(id) { 
    document.getElementById(id).classList.remove('show');
    if (id === 'install-pwa-modal') {
        sessionStorage.setItem('install-modal-closed', 'true');
    }
}

function toggleTheme() {
    const toggle = document.getElementById('theme-toggle');
    if (toggle.checked) {
        document.body.setAttribute('data-theme', 'light');
        localStorage.setItem('aureen-calc-theme', 'light');
    } else {
        document.body.removeAttribute('data-theme');
        localStorage.setItem('aureen-calc-theme', 'dark');
    }
}

function renderHistory() {
    const container = document.getElementById('history-content-area');
    if (!container) return;
    if (state.general.history.length === 0) {
        container.innerHTML = '<p class="history-empty-message">No hay cálculos guardados.</p>';
        return;
    }
    let html = '';
    state.general.history.forEach(item => {
        html += `<div class="history-item"><span class="operation">${item.operation}</span><span class="result">= ${item.result}</span></div>`;
    });
    container.innerHTML = html;
}

function clearHistory() {
    state.general.history = [];
    localStorage.removeItem('aureen-calc-history');
    renderHistory();
}

function triggerInstallPrompt() {
    if (deferredInstallPrompt) deferredInstallPrompt.prompt();
}

window.addEventListener('click', (e) => {
    const menu = document.getElementById('options-menu');
    const btn = document.getElementById('options-menu-btn');
    if (e.target && !menu.contains(e.target) && !btn.contains(e.target)) menu.classList.remove('show');
});
// --- FUNCIÓN REDES SOCIALES (INFALIBLE) ---
function shareToSocial(platform, mode) {
    const mainAmount = document.getElementById(`${mode}-main-display`).innerText;
    const subAmount = document.getElementById(`${mode}-sub-display`).innerText;
    const rate = state[mode].rate.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    
    const isZero = (mainAmount === "0" || mainAmount === "0,00" || mainAmount === "0.00" || mainAmount === "");
    const appLink = "t.me/aureenAIbot"; 

    // CONSTRUIMOS LOS EMOJIS CON CÓDIGO MATEMÁTICO (No fallan nunca)
    const emjSparkle = String.fromCodePoint(0x2728);      // ✨
    const emjDiamond = String.fromCodePoint(0x1F539);     // 🔹
    const emjPhone   = String.fromCodePoint(0x1F4F2);     // 📲
    const emjAbacus  = String.fromCodePoint(0x1F9EE);     // 🧮
    const emjDollar  = String.fromCodePoint(0x1F4B5);     // 💵
    const emjDown    = String.fromCodePoint(0x2B07, 0xFE0F); // ⬇️
    const emjFlag    = String.fromCodePoint(0x1F1FB, 0x1F1EA); // 🇻🇪 (Bandera VE)
    const emjChart   = String.fromCodePoint(0x1F4CA);     // 📊

    let message = "";

    if (isZero) {
        message = `${emjSparkle} Aureen X\n`;
        message += `Tu calculadora de Tasa BCV.\n\n`;
        message += `${emjDiamond} Rápida y precisa\n`;
        message += `${emjDiamond} Diseño Liquid Glass\n\n`;
        message += `${emjPhone} Pruébala gratis:\n`;
        message += `${appLink}\n\n`;
        message += `#Venezuela #AureenX`;

    } else {
        let usdAmount = state[mode].isFromUSD ? mainAmount : subAmount;
        let bsAmount = state[mode].isFromUSD ? subAmount : mainAmount;

        message = `${emjAbacus} Cálculo Aureen\n\n`;
        message += `${emjDollar}  ${usdAmount} $\n`;
        message += `${emjDown}\n`;
        message += `${emjFlag}  ${bsAmount} Bs\n\n`;
        message += `${emjChart} Tasa: ${rate}\n`;
        message += `#TasaBCV #AureenX`;
    }

    let url = "";
    const encodedText = encodeURIComponent(message);

    if (platform === 'x') {
        url = `https://twitter.com/intent/tweet?text=${encodedText}`;
    } else if (platform === 'threads') {
        url = `https://www.threads.net/intent/post?text=${encodedText}`;
    }

    window.open(url, '_blank');
}
// --- FEEDBACK TÁCTIL (VIBRACIÓN) ---
function triggerHaptic() {
    // Verificamos si el navegador soporta vibración
    if (navigator.vibrate) {
        navigator.vibrate(15); // Vibración muy corta y seca (15ms)
    }
}

// --- CONECTAR VIBRACIÓN A TODOS LOS BOTONES ---
document.addEventListener('DOMContentLoaded', () => {
    // Seleccionamos todos los elementos clicables importantes
    const buttons = document.querySelectorAll('button, .venezuela-banner, .creator-signature, .main-amount, .converted-amount');
    
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            triggerHaptic();
        });
    });
});