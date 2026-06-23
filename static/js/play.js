document.addEventListener("DOMContentLoaded", function() {
    // ========== EXISTING TYPING GAME VARIABLES ==========\r
    const startBtn = document.getElementById("start-btn");
    const startIcon = document.getElementById("start-icon");
    const startSpinner = document.getElementById("start-spinner");
    const startBtnText = document.getElementById("start-btn-text");
    const submitBtn = document.getElementById("submit-btn");
    const submitIcon = document.getElementById("submit-icon");
    const submitSpinner = document.getElementById("submit-spinner");
    const submitBtnText = document.getElementById("submit-btn-text");
    const resetBtn = document.getElementById("reset-btn");
    const errorFallback = document.getElementById("error-fallback");
    const errorTitle = document.getElementById("error-title");
    const errorText = document.getElementById("error-text");
    const setupPanel = document.getElementById("setup-panel");
    const gamePanel = document.getElementById("game-panel");
    const resultsPanel = document.getElementById("results-panel");
    const textDisplay = document.getElementById("text-display");
    const hiddenCatcher = document.getElementById("hidden-keyboard-catcher");
    const timerLabel = document.getElementById("timer-label");
    const liveWpmLabel = document.getElementById("live-wpm");
    const difficultyControl = document.getElementById("difficulty-control");
    const difficultyBadge = document.getElementById("difficulty-badge");
    const textSizeSlider = document.getElementById("text-size-slider");
    const textSizeBadge = document.getElementById("text-size-badge");
    const modeTypingBtn = document.getElementById("mode-typing");
    const modeMemoryBtn = document.getElementById("mode-memory");
    const memoryPanel = document.getElementById("memory-panel");
    const cadenceMonitor = document.getElementById("cadence-monitor");

    let targetSentence = "";
    let startTime = null;
    let timerInterval = null;
    let currentMode = "typing"; // "typing" or "memory"\r

    // ========== GAME MODE SELECTION HANDLING ==========\r
    if (modeTypingBtn && modeMemoryBtn) {
        modeTypingBtn.addEventListener("click", function() {
            currentMode = "typing";
            modeTypingBtn.classList.add("active");
            modeMemoryBtn.classList.remove("active");
            setupPanel.classList.remove("hidden-node");
            gamePanel.classList.add("hidden-node");
            memoryPanel.classList.add("hidden-node");
            resultsPanel.classList.add("hidden-node");
            errorFallback.classList.add("hidden-node");
            clearInterval(timerInterval);
        });

        modeMemoryBtn.addEventListener("click", function() {
            currentMode = "memory";
            modeMemoryBtn.classList.add("active");
            modeTypingBtn.classList.remove("active");
            setupPanel.classList.remove("hidden-node");
            gamePanel.classList.add("hidden-node");
            memoryPanel.classList.add("hidden-node");
            resultsPanel.classList.add("hidden-node");
            errorFallback.classList.add("hidden-node");
            clearInterval(timerInterval);
            if (window.initializeMemoryMode) {
                window.initializeMemoryMode();
            }
        });
    }

    // ========== PRESENTATION SLIDERS AND CONFIGS ==========\r
    if (difficultyControl && difficultyBadge) {
        difficultyControl.addEventListener("input", function() {
            const val = parseInt(difficultyControl.value);
            if (val === 1) difficultyBadge.textContent = "Easy";
            else if (val === 3) difficultyBadge.textContent = "Hard";
            else difficultyBadge.textContent = "Medium";
        });
    }

    if (textSizeSlider && textSizeBadge) {
        textSizeSlider.addEventListener("input", function() {
            const val = textSizeSlider.value + "rem";
            textSizeBadge.textContent = val;
            if (textDisplay) textDisplay.style.fontSize = val;
        });
    }

    // ========== SENTENCE GENERATION ENGINE ROUTINE ==========\r
    if (startBtn) {
        startBtn.addEventListener("click", async function() {
            errorFallback.classList.add("hidden-node");
            startBtn.disabled = true;
            startIcon.classList.add("hidden-node");
            startSpinner.classList.remove("hidden-node");
            startBtnText.textContent = "Generating Challenge Context...";

            const diffMap = { "1": "easy", "2": "medium", "3": "hard" };
            const difficultyStr = diffMap[difficultyControl ? difficultyControl.value : "2"] || "medium";
            const selectedModel = localStorage.getItem("selected_model") || "google/gemini-2.5-flash";

            if (currentMode === "memory") {
                try {
                    const response = await fetch("/api/generate", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ difficulty: difficultyStr, model: selectedModel })
                    });
                    if (!response.ok) throw new Error("HTTP error payload generation corrupted.");
                    const data = await response.json();
                    if (!data.success) throw new Error(data.error || "Generation routine breakdown.");

                    setupPanel.classList.add("hidden-node");
                    if (window.startMemoryChallenge) {
                        window.startMemoryChallenge(data.sentence);
                    }
                } catch (err) {
                    errorTitle.textContent = "Generation Error";
                    errorText.textContent = err.message;
                    errorFallback.classList.remove("hidden-node");
                } finally {
                    startBtn.disabled = false;
                    startIcon.classList.remove("hidden-node");
                    startSpinner.classList.add("hidden-node");
                    startBtnText.textContent = "Generate Challenge Passage";
                }
                return;
            }

            // Default Speed Typing Generation Routing\r
            try {
                const response = await fetch("/api/generate", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ difficulty: difficultyStr, model: selectedModel })
                });
                if (!response.ok) throw new Error("Network response matrix non-operational.");
                const data = await response.json();
                if (!data.success) throw new Error(data.error || "Inference response payload malformed.");

                targetSentence = data.sentence;
                buildTextDisplay(targetSentence);

                setupPanel.classList.add("hidden-node");
                gamePanel.classList.remove("hidden-node");
                submitBtn.classList.add("hidden-node");

                timerLabel.textContent = "0s";
                liveWpmLabel.textContent = "0 WPM";
                if (cadenceMonitor) cadenceMonitor.classList.remove("active");

                startTime = null;
                clearInterval(timerInterval);
                hiddenCatcher.value = "";
                setTimeout(() => hiddenCatcher.focus(), 100);
            } catch (err) {
                errorTitle.textContent = "Generation Error";
                errorText.textContent = err.message;
                errorFallback.classList.remove("hidden-node");
            } finally {
                startBtn.disabled = false;
                startIcon.classList.remove("hidden-node");
                startSpinner.classList.add("hidden-node");
                startBtnText.textContent = "Generate Challenge Passage";
            }
        });
    }

    // ========== CORE LIVE TYPING TRACKING ACTIONS ==========\r
    function buildTextDisplay(text) {
        if (!textDisplay) return;
        textDisplay.innerHTML = "";
        text.split("").forEach((char, idx) => {
            const span = document.createElement("span");
            span.textContent = char;
            span.classList.add("char-node");
            if (idx === 0) span.classList.add("current-cursor");
            textDisplay.appendChild(span);
        });
    }

    if (hiddenCatcher) {
        document.addEventListener("click", function(e) {
            if (gamePanel && !gamePanel.classList.contains("hidden-node")) {
                if (e.target !== startBtn && e.target !== submitBtn && e.target !== resetBtn) {
                    hiddenCatcher.focus();
                }
            }
        });

        hiddenCatcher.addEventListener("input", function() {
            if (!startTime) {
                startTime = new Date();
                if (cadenceMonitor) cadenceMonitor.classList.add("active");
                timerInterval = setInterval(updateLiveTelemetry, 250);
            }
            evaluateCurrentInputState();
        });
    }

    function updateLiveTelemetry() {
        if (!startTime) return;
        const elapsed = (new Date() - startTime) / 1000;
        timerLabel.textContent = Math.floor(elapsed) + "s";

        const typedVal = hiddenCatcher.value;
        if (typedVal.length > 0 && elapsed > 0.5) {
            const words = typedVal.length / 5;
            const wpm = Math.round(words / (elapsed / 60));
            liveWpmLabel.textContent = wpm + " WPM";
        }
    }

    function evaluateCurrentInputState() {
        const typedVal = hiddenCatcher.value;
        const spans = textDisplay.querySelectorAll(".char-node");
        let isPerfectSoFar = true;

        spans.forEach((span, idx) => {
            span.classList.remove("correct", "incorrect", "current-cursor");
            if (idx < typedVal.length) {
                if (typedVal[idx] === span.textContent) {
                    span.classList.add("correct");
                } else {
                    span.classList.add("incorrect");
                    isPerfectSoFar = false;
                }
            } else if (idx === typedVal.length) {
                span.classList.add("current-cursor");
            }
        });

        if (typedVal.length >= targetSentence.length) {
            clearInterval(timerInterval);
            if (cadenceMonitor) cadenceMonitor.classList.remove("active");
            submitBtn.classList.remove("hidden-node");
            submitBtn.focus();
        } else {
            submitBtn.classList.add("hidden-node");
        }
    }

    // ========== SUBMISSION & AI ASSESSMENT ENGINE ROUTINE ==========\r
    if (submitBtn) {
        submitBtn.addEventListener("click", async function() {
            if (!startTime || !targetSentence) return;
            clearInterval(timerInterval);

            submitBtn.disabled = true;
            submitIcon.classList.add("hidden-node");
            submitSpinner.classList.remove("hidden-node");
            submitBtnText.textContent = "Analyzing Performance Grid...";

            const elapsedSeconds = (new Date() - startTime) / 1000;
            const typedText = hiddenCatcher.value;
            const selectedModel = localStorage.getItem("selected_model") || "google/gemini-2.5-flash";

            try {
                const response = await fetch("/api/submit", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        expected: targetSentence,
                        typed: typedText,
                        time_seconds: elapsedSeconds,
                        model: selectedModel
                    })
                });
                if (!response.ok) throw new Error("Evaluation routine processing timed out.");
                const data = await response.json();
                if (!data.success) throw new Error(data.error || "Analysis matrix payload processing failed.");

                const metrics = data.metrics;
                document.getElementById("res-speed").textContent = metrics.speed_wpm + " WPM";
                document.getElementById("res-accuracy").textContent = metrics.accuracy + "%";
                document.getElementById("res-score").textContent = metrics.score;
                document.getElementById("res-analysis").textContent = data.analysis;

                const wrapper = document.getElementById("res-mistakes");
                wrapper.innerHTML = "";
                if (metrics.mistakes && metrics.mistakes.length > 0) {
                    metrics.mistakes.forEach(m => {
                        const row = document.createElement("div");
                        row.className = "mistake-row-entry";
                        row.innerHTML = `<span style="text-decoration: line-through; opacity: 0.6;">${m.expected}</span> <span style="font-weight: bold; color: var(--primary);">➔ ${m.typed}</span>`;
                        wrapper.appendChild(row);
                    });
                    document.getElementById("mistakes-wrapper").classList.remove("hidden-node");
                } else {
                    const cleanRow = document.createElement("div");
                    cleanRow.className = "perfect-run-row";
                    cleanRow.textContent = "✓ Performance complete. Perfect accuracy profile achieved.";
                    wrapper.appendChild(cleanRow);
                    document.getElementById("mistakes-wrapper").classList.remove("hidden-node");
                }

                gamePanel.classList.add("hidden-node");
                resultsPanel.classList.remove("hidden-node");
                if (window.confetti) confetti({ particleCount: 100, spread: 60, origin: { y: 0.6 } });
            } catch (err) {
                errorTitle.textContent = "Submission Evaluation Error";
                errorText.textContent = err.message;
                errorFallback.classList.remove("hidden-node");
                gamePanel.classList.add("hidden-node");
                setupPanel.classList.remove("hidden-node");
            } finally {
                submitBtn.disabled = false;
                submitIcon.classList.remove("hidden-node");
                submitSpinner.classList.add("hidden-node");
                submitBtnText.textContent = "Submit for Evaluation";
            }
        });
    }

    if (resetBtn) {
        resetBtn.addEventListener("click", function() {
            resultsPanel.classList.add("hidden-node");
            setupPanel.classList.remove("hidden-node");
            errorFallback.classList.add("hidden-node");
            targetSentence = "";
            startTime = null;
            hiddenCatcher.value = "";
            if (textDisplay) textDisplay.innerHTML = "";
        });
    }

    // ========== LIVE PHYSICAL PERIPHERAL INPUT MATRIX MIRROR ==========\r
    const animationToggle = document.getElementById("keyboard-animations-toggle");
    const rippleToggle = document.getElementById("ripple-animations-toggle");

    window.addEventListener("keydown", function(e) {
        if (animationToggle && !animationToggle.checked) return;

        let code = e.code;
        if (e.key === " " || code === "Space") code = "Space";

        const keyElement = document.getElementById(code);
        if (keyElement) {
            keyElement.classList.add("hardware-pressed");
            if (rippleToggle && rippleToggle.checked) {
                createHardwareMatrixRipple(keyElement);
            }
        }
    });

    window.addEventListener("keyup", function(e) {
        let code = e.code;
        if (e.key === " " || code === "Space") code = "Space";

        const keyElement = document.getElementById(code);
        if (keyElement) {
            keyElement.classList.remove("hardware-pressed");
        }
    });

    function createHardwareMatrixRipple(element) {
        const circle = document.createElement("span");
        const diameter = Math.max(element.clientWidth, element.clientHeight);

        circle.style.width = circle.style.height = `${diameter}px`;
        circle.style.left = `${element.clientWidth / 2 - diameter / 2}px`;
        circle.style.top = `${element.clientHeight / 2 - diameter / 2}px`;
        circle.classList.add("ripple-wave-element");

        const existingRipple = element.querySelector(".ripple-wave-element");
        if (existingRipple) {
            existingRipple.remove();
        }

        element.appendChild(circle);
    }
});