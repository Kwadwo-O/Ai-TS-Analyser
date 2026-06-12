// Local application fallback string configuration matrix
const fallbackPhrase = "The integration of micro frameworks allows developers to build clean software architectures quickly.";

// Runtime State Tracking Variables
let selectedPhrase = "";
let timer = null;
let timeLeft = 30;
let isPlaying = false;
let errors = 0;

// DOM View Mapping Registries
const textChallenge = document.getElementById("text-challenge");
const typingInput = document.getElementById("typing-input");
const startBtn = document.getElementById("start-btn");
const timerDisplay = document.getElementById("timer-display");
const wpmDisplay = document.getElementById("wpm-display");
const accuracyDisplay = document.getElementById("accuracy-display");
const errorsDisplay = document.getElementById("errors-display");
const dashboard = document.getElementById("dashboard");
const aiAnalysis = document.getElementById("ai-analysis");
const currentBar = document.getElementById("current-bar");
const currentBarText = document.getElementById("current-bar-text");

// API Authentication Modal View Nodes
const apiModal = document.getElementById("api-modal");
const apiKeyInput = document.getElementById("api-key-input");
const saveKeyBtn = document.getElementById("save-key-btn");
const clearKeyBtn = document.getElementById("clear-key-btn");

/**
 * Validates existence of client token inside browser storage layers
 */
function checkApiKeyConfiguration() {
    const savedKey = localStorage.getItem("openrouter_api_key");
    if (!savedKey) {
        // Force display configuration modal parameters if token is missing
        apiModal.classList.remove("hidden");
    } else {
        apiModal.classList.add("hidden");
        initTest();
    }
}

// Event logic to pull user text entry strings and append to storage
saveKeyBtn.addEventListener("click", () => {
    const userEnteredKey = apiKeyInput.value.trim();
    if (userEnteredKey.startsWith("sk-or-")) {
        localStorage.setItem("openrouter_api_key", userEnteredKey);
        apiKeyInput.value = ""; // Strip variable references out of DOM memory nodes
        checkApiKeyConfiguration();
    } else {
        alert("Please enter a valid OpenRouter API key starting with 'sk-or-'");
    }
});

// Lets the user clear their key to switch accounts or revoke access
clearKeyBtn.addEventListener("click", () => {
    if (confirm("Are you sure you want to remove your saved API key from local storage?")) {
        localStorage.removeItem("openrouter_api_key");
        textChallenge.innerHTML = "Awaiting API access key token validation...";
        checkApiKeyConfiguration();
    }
});

/**
 * Direct Frontend-to-OpenRouter dynamic network fetch engine
 */
async function fetchAiPhraseFromOpenRouter() {
    const userActiveToken = localStorage.getItem("openrouter_api_key");
    if (!userActiveToken) return fallbackPhrase;

    try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${userActiveToken}`,
                "Content-Type": "application/json",
                "HTTP-Referer": window.location.origin,
                "X-Title": "AI Typing Speed Analyser"
            },
            body: JSON.stringify({
                model: "openrouter/free", // Targets the free resource tier
                messages: [
                    {
                        role: "user",
                        content: "Generate a single, interesting, one-sentence typing test challenge between 15 and 25 words. Do not include quotes, explanations, or labels. Just return the raw sentence text."
                    }
                ],
                max_tokens: 50
            })
        });

        const data = await response.json();
        if (data.choices && data.choices[0].message) {
            return data.choices[0].message.content.trim().replace(/^["']|["']$/g, '');
        }
        throw new Error("Malformed completion token payload layout response structure.");
    } catch (err) {
        console.error("OpenRouter endpoint error context handshake fallback activated:", err);
        return fallbackPhrase; // Soft fallback protection
    }
}

/**
 * Initializes and generates challenge spans
 */
async function initTest() {
    textChallenge.innerHTML = "Fetching dynamic challenge string from OpenRouter Free AI tier...";
    selectedPhrase = await fetchAiPhraseFromOpenRouter();
    textChallenge.innerHTML = "";

    selectedPhrase.split('').forEach(char => {
        const span = document.createElement('span');
        span.innerText = char;
        textChallenge.appendChild(span);
    });

    if (textChallenge.childNodes.length > 0) {
        textChallenge.childNodes[0].classList.add('char-current');
    }

    typingInput.value = "";
    timeLeft = 30;
    errors = 0;
    timerDisplay.innerText = `${timeLeft}s`;
    wpmDisplay.innerText = "0";
    accuracyDisplay.innerText = "100%";
    errorsDisplay.innerText = "0";
}

function startSession() {
    if (!localStorage.getItem("openrouter_api_key")) return checkApiKeyConfiguration();
    isPlaying = true;
    typingInput.disabled = false;
    typingInput.focus();
    startBtn.innerText = "Reset Test";
    timer = setInterval(updateTimer, 1000);
}

function updateTimer() {
    if (timeLeft > 0) {
        timeLeft--;
        timerDisplay.innerText = `${timeLeft}s`;
        calculateMetrics();
    } else {
        endSession();
    }
}

typingInput.addEventListener("input", () => {
    if (!isPlaying) return;
    const arrayQuote = textChallenge.querySelectorAll('span');
    const arrayValue = typingInput.value.split('');
    errors = 0;

    arrayQuote.forEach((characterSpan, index) => {
        const character = arrayValue[index];
        characterSpan.className = '';
        if (character == null) {
            if (index === arrayValue.length) characterSpan.classList.add('char-current');
        } else if (character === characterSpan.innerText) {
            characterSpan.classList.add('char-correct');
        } else {
            characterSpan.classList.add('char-incorrect');
            errors++;
        }
    });

    errorsDisplay.innerText = errors;
    calculateMetrics();

    if (arrayValue.length >= arrayQuote.length) endSession();
});

function calculateMetrics() {
    const totalTyped = typingInput.value.length;
    if (totalTyped === 0) return;
    const timeElapsed = (30 - timeLeft) / 60;
    const computedWpm = Math.round(((totalTyped / 5) / (timeElapsed || 0.01)));
    wpmDisplay.innerText = computedWpm >= 0 ? computedWpm : 0;

    const accuracy = Math.round(((totalTyped - errors) / totalTyped) * 100);
    accuracyDisplay.innerText = `${accuracy >= 0 ? accuracy : 100}%`;
}

function endSession() {
    clearInterval(timer);
    isPlaying = false;
    typingInput.disabled = true;
    startBtn.innerText = "Restart Test";
    dashboard.classList.remove('hidden');

    const finalWPM = parseInt(wpmDisplay.innerText);
    const finalAccuracy = parseInt(accuracyDisplay.innerText);

    currentBar.style.height = `${Math.min(finalWPM, 100)}%`;
    currentBarText.innerText = `${finalWPM} WPM`;

    generateAiFeedback(finalWPM, finalAccuracy);
}

function generateAiFeedback(wpm, accuracy) {
    let analyticalFeedback = "";
    if (wpm > 70 && accuracy >= 95) {
        analyticalFeedback = `Excellent performance! Your typing speed is in the top tier. Your motor control and memory maps are highly efficient. Maintain this pacing structure to master technical coding output.`;
    } else if (wpm > 50 && accuracy >= 90) {
        analyticalFeedback = `Strong progression tracked. Your baseline velocity exhibits steady improvements compared to prior historical nodes. Focus on reducing slight micro-stalls during multi-character sequencing to cross the 70 WPM milestone.`;
    } else if (accuracy < 90) {
        analyticalFeedback = `Heuristic alert: Your raw speed is conflicting with sequence reliability. The generative AI model suggests dropping target WPM by 10% intentionally until error counts stabilize below 3 units per block. Speed follows accuracy!`;
    } else {
        analyticalFeedback = `Baseline metrics captured successfully. Your pacing rhythm is stable, providing an ideal anchor layout. Focus on finger positioning structures to naturally expand muscle agility profiles over subsequent modules.`;
    }
    aiAnalysis.innerText = analyticalFeedback;
}

startBtn.addEventListener("click", () => {
    if (isPlaying) {
        clearInterval(timer);
        initTest();
        typingInput.disabled = true;
        startBtn.innerText = "Start Typing Test";
    } else {
        startSession();
    }
});

// Initial boot configurations check hook
checkApiKeyConfiguration();