const samplePhrases = [
    "The integration of micro frameworks allows developers to build clean software architectures quickly.",
    "Artificial intelligence processes performance heuristics to optimize user interface feedback loops.",
    "Data analysis frameworks transform complex backend values into structured interface visual components."
];

let selectedPhrase = "";
let timer = null;
let timeLeft = 30;
let isPlaying = false;
let errors = 0;

// DOM Selectors
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

// Initialize Setup Configuration
function initTest() {
    selectedPhrase = samplePhrases[Math.floor(Math.random() * samplePhrases.length)];
    textChallenge.innerHTML = "";
    
    // Split phrase into spans for individual accurate monitoring
    selectedPhrase.split('').forEach(char => {
        const span = document.createElement('span');
        span.innerText = char;
        textChallenge.appendChild(span);
    });
    
    textChallenge.childNodes[0].classList.add('char-current');
    typingInput.value = "";
    timeLeft = 30;
    errors = 0;
    timerDisplay.innerText = `${timeLeft}s`;
    wpmDisplay.innerText = "0";
    accuracyDisplay.innerText = "100%";
    errorsDisplay.innerText = "0";
}

function startSession() {
    initTest();
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

// Processing User Typing Input State Transitions
typingInput.addEventListener("input", () => {
    if (!isPlaying) return;

    const arrayQuote = textChallenge.querySelectorAll('span');
    const arrayValue = typingInput.value.split('');
    
    errors = 0;
    
    arrayQuote.forEach((characterSpan, index) => {
        const character = arrayValue[index];
        characterSpan.className = ''; // Reset standard classes
        
        if (character == null) {
            if (index === arrayValue.length) {
                characterSpan.classList.add('char-current');
            }
        } else if (character === characterSpan.innerText) {
            characterSpan.classList.add('char-correct');
        } else {
            characterSpan.classList.add('char-incorrect');
            errors++;
        }
    });

    errorsDisplay.innerText = errors;
    calculateMetrics();

    // End application session prematurely if user safely types whole phrase
    if (arrayValue.length >= arrayQuote.length) {
        endSession();
    }
});

function calculateMetrics() {
    const totalTyped = typingInput.value.length;
    if (totalTyped === 0) return;

    // Standard metric calculation: (Characters / 5) / Minutes Elapsed
    const timeElapsed = (30 - timeLeft) / 60;
    const computedWpm = Math.round(((totalTyped / 5) / (timeElapsed || 0.01)));
    wpmDisplay.innerText = computedWpm >= 0 ? computedWpm : 0;

    // Evaluation of current accurate keystroke distribution percentages
    const accuracy = Math.round(((totalTyped - errors) / totalTyped) * 100);
    accuracyDisplay.innerText = `${accuracy >= 0 ? accuracy : 100}%`;
}

function endSession() {
    clearInterval(timer);
    isPlaying = false;
    typingInput.disabled = true;
    startBtn.innerText = "Restart Test";

    // Unveil Statistics Dashboard
    dashboard.classList.remove('hidden');

    const finalWPM = parseInt(wpmDisplay.innerText);
    const finalAccuracy = parseInt(accuracyDisplay.innerText);

    // Update Dashboard Graph metrics smoothly
    currentBar.style.height = `${Math.min(finalWPM, 100)}%`;
    currentBarText.innerText = `${finalWPM} WPM`;

    // Process Simple AI Rule Logic Simulation Engine
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

// Run immediate initial display loading structure parameters
initTest();