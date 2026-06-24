document.addEventListener("DOMContentLoaded", function() {
    // 1. SELECT CORE ELEMENT INTERFACES
    const rootContainer = document.getElementById("play-root");
    const modeButtons = document.querySelectorAll("#mode-selection-matrix .diff-btn");
    const diffButtons = document.querySelectorAll("#difficulty-selection-matrix .diff-btn");
    const textSizeSlider = document.getElementById("text-size-slider");
    const textSizeBadge = document.getElementById("text-size-badge");
    const textDisplay = document.getElementById("text-display");

    // Engine Interfaces
    const startBtn = document.getElementById("start-btn");
    const leaveBtn = document.getElementById("leave-btn");
    const setupPanel = document.getElementById("setup-panel");
    const gamePanel = document.getElementById("game-panel");
    const errorFallback = document.getElementById("error-fallback");
    const hiddenCatcher = document.getElementById("hidden-keyboard-catcher");

    // Language Dropdown Interface Selectors
    const codeLanguageContainer = document.getElementById("code-language-container");
    const codeLanguageSelect = document.getElementById("code-language-select");

    // Dynamic Submission Interface Hooks
    const completionControls = document.getElementById("completion-controls");
    const submitChallengeBtn = document.getElementById("submit-challenge-btn");

    // Telemetry Interfaces
    const timerLabel = document.getElementById("timer-label");
    const liveWpmLabel = document.getElementById("live-wpm");

    // Keyboard Matrix Layout Assets
    const virtualKeyboard = document.getElementById("virtual-keyboard-board");
    const keyboardVisibilityToggle = document.getElementById("keyboard-visibility-toggle");
    const keyboardGlowToggle = document.getElementById("keyboard-glow-toggle");
    const rippleAnimationsToggle = document.getElementById("ripple-animations-toggle");

    // Accessibility Framework Switches
    const highContrastToggle = document.getElementById("high-contrast-toggle");
    const boldTextToggle = document.getElementById("bold-text-toggle");
    const themeToggle = document.getElementById("theme-toggle");

    // Local runtime variables
    let activeMode = "normal";
    let activeDifficulty = "easy";
    let activeLanguage = "python";
    let targetSentence = "";
    let startTime = null;
    let timerInterval = null;
    let isSessionFinished = false;

    // Initialize Workspace Font Scalers
    if (textSizeSlider && textDisplay) {
        textDisplay.style.fontSize = `${textSizeSlider.value}px`;
    }

    // 2. WORKSPACE MODE SELECTOR MECHANICS
    modeButtons.forEach(button => {
        button.addEventListener("click", function() {
            modeButtons.forEach(btn => btn.classList.remove("active"));
            this.classList.add("active");
            activeMode = this.getAttribute("data-mode");

            if (activeMode === "code") {
                if (codeLanguageContainer) codeLanguageContainer.style.display = "block";
            } else {
                if (codeLanguageContainer) codeLanguageContainer.style.display = "none";
            }
        });
    });

    if (codeLanguageSelect) {
        codeLanguageSelect.addEventListener("change", function() {
            activeLanguage = this.value;
        });
    }

    function applyDifficultyButtonColors(colorHex, hoverHex) {
        diffButtons.forEach(btn => {
            btn.style.setProperty('--local-diff-color', colorHex);
            btn.style.setProperty('--local-diff-hover', hoverHex);
        });
    }

    // 3. ENGINE DIFFICULTY SELECTOR MECHANICS
    diffButtons.forEach(button => {
        button.addEventListener("click", function() {
            diffButtons.forEach(btn => btn.classList.remove("active"));
            this.classList.add("active");
            activeDifficulty = this.getAttribute("data-value");

            if (activeDifficulty === "easy") {
                applyDifficultyButtonColors('#2ecc71', '#27ae60');
            } else if (activeDifficulty === "medium") {
                applyDifficultyButtonColors('#f1c40f', '#d68910');
            } else if (activeDifficulty === "hard") {
                applyDifficultyButtonColors('#e74c3c', '#c0392b');
            }
        });
    });

    if (textSizeSlider) {
        textSizeSlider.addEventListener("input", function() {
            textSizeBadge.textContent = `${this.value}px`;
            if (textDisplay) textDisplay.style.fontSize = `${this.value}px`;
        });
    }

    // 4. API FETCH LOGIC: GENERATE PASSAGE
    if (startBtn) {
        startBtn.addEventListener("click", async function() {
            if (errorFallback) errorFallback.style.display = "none";
            startBtn.disabled = true;
            isSessionFinished = false;
            if (completionControls) completionControls.style.display = "none";

            try {
                let url = `/api/generate?difficulty=${encodeURIComponent(activeDifficulty)}&mode=${encodeURIComponent(activeMode)}`;
                if (activeMode === "code") {
                    url += `&language=${encodeURIComponent(activeLanguage)}`;
                }

                const response = await fetch(url, {
                    method: "GET",
                    headers: { "Content-Type": "application/json" }
                });

                if (!response.ok) throw new Error("Server generation failed.");
                const data = await response.json();

                if (data.error) throw new Error(data.error);
                targetSentence = data.sentence || "def verify_metrics():\n    return True";

            } catch (err) {
                if (activeMode === "code") {
                    targetSentence = "function initWorkspace() {\n    console.log('Ready');\n}";
                } else {
                    targetSentence = "The quick brown fox jumps over the lazy dog near the workspace.";
                }
            } finally {
                buildUnifiedTextDisplay(targetSentence);
                setupPanel.style.display = "none";
                gamePanel.style.display = "block";

                timerLabel.textContent = "0s";
                liveWpmLabel.textContent = "0 WPM";
                startTime = null;
                clearInterval(timerInterval);
                hiddenCatcher.value = "";
                startBtn.disabled = false;

                setTimeout(() => hiddenCatcher.focus(), 100);
            }
        });
    }

    // 5. LEAVE GAME ACTIONS
    if (leaveBtn) {
        leaveBtn.addEventListener("click", function() {
            clearInterval(timerInterval);
            timerInterval = null;
            startTime = null;
            targetSentence = "";
            hiddenCatcher.value = "";
            isSessionFinished = false;

            if (textDisplay) textDisplay.innerHTML = "";

            timerLabel.textContent = "0s";
            liveWpmLabel.textContent = "0 WPM";

            if (completionControls) completionControls.style.display = "none";
            gamePanel.style.display = "none";
            setupPanel.style.display = "block";
        });
    }

    // UNIFIED CHARACTER BOX RENDERING ENGINE
    function buildUnifiedTextDisplay(text) {
        if (!textDisplay) return;
        textDisplay.innerHTML = "";

        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            const charBox = document.createElement("span");
            charBox.className = "char-box";
            charBox.setAttribute("data-index", i);

            if (char === "\n") {
                charBox.classList.add("is-newline");
                charBox.innerHTML = '<span class="enter-badge">&#x23CE;</span>';
            } else if (char === " ") {
                charBox.classList.add("is-space");
                charBox.innerHTML = "&nbsp;";
            } else {
                charBox.textContent = char;
            }
            textDisplay.appendChild(charBox);
        }
        updateUnifiedCaretPosition(0);
    }

    function updateUnifiedCaretPosition(index) {
        const boxes = textDisplay.querySelectorAll(".char-box");
        boxes.forEach(box => box.classList.remove("is-current-caret"));

        if (index < boxes.length) {
            boxes[index].classList.add("is-current-caret");
        }
    }

    // 6. LIVE INPUT LOGIC & INPUT SHAKE LISTENERS
    if (hiddenCatcher) {
        document.addEventListener("click", function(e) {
            if (gamePanel && gamePanel.style.display === "block" && !isSessionFinished) {
                if (e.target !== startBtn && e.target !== leaveBtn && !completionControls.contains(e.target)) {
                    hiddenCatcher.focus();
                }
            }
        });

        hiddenCatcher.addEventListener("input", function() {
            if (isSessionFinished) return;

            if (!startTime) {
                startTime = new Date();
                timerInterval = setInterval(updateLiveTelemetry, 250);
            }
            evaluateUnifiedInputState();
        });
    }

    function updateLiveTelemetry() {
        if (!startTime || isSessionFinished) return;
        const elapsed = (new Date() - startTime) / 1000;
        timerLabel.textContent = Math.floor(elapsed) + "s";

        const typedVal = hiddenCatcher.value;
        if (typedVal.length > 0 && elapsed > 0.5) {
            const words = typedVal.length / 5;
            const wpm = Math.round(words / (elapsed / 60));
            liveWpmLabel.textContent = wpm + " WPM";
        }
    }

    function evaluateUnifiedInputState() {
        if (isSessionFinished) return;

        const typedVal = hiddenCatcher.value;
        const boxes = textDisplay.querySelectorAll(".char-box");

        for (let i = 0; i < boxes.length; i++) {
            const box = boxes[i];
            const targetChar = targetSentence[i];

            // Only update states for newly modified characters to protect execution cycles
            if (i < typedVal.length) {
                const userChar = typedVal[i];

                if (userChar === targetChar) {
                    if (!box.classList.contains("correct")) {
                        box.classList.remove("incorrect", "incorrect-space", "incorrect-newline");
                        box.classList.add("correct");
                    }
                } else {
                    if (!box.classList.contains("incorrect") && !box.classList.contains("incorrect-newline") && !box.classList.contains("incorrect-space")) {
                        box.classList.remove("correct");

                        if (box.classList.contains("is-newline")) {
                            box.classList.add("incorrect-newline");
                        } else if (targetChar === " ") {
                            box.classList.add("incorrect-space", "incorrect");
                        } else {
                            box.classList.add("incorrect");
                        }

                        // Re-trigger the shaking CSS animation on key mistakes
                        box.style.animation = 'none';
                        box.offsetHeight; // Triggers DOM reflow
                        box.style.animation = null;
                    }
                }
            } else {
                // Clear character styles if user hits backspace
                box.classList.remove("correct", "incorrect", "incorrect-space", "incorrect-newline");
            }
        }

        updateUnifiedCaretPosition(typedVal.length);

        if (typedVal.length >= targetSentence.length) {
            isSessionFinished = true;
            clearInterval(timerInterval);
            hiddenCatcher.blur();
            if (completionControls) {
                completionControls.style.display = "block";
                setTimeout(() => submitChallengeBtn.focus(), 150);
            }
        }
    }

    // 7. PIPELINE SUBMISSION INTERFACE
    if (submitChallengeBtn) {
        submitChallengeBtn.addEventListener("click", async function() {
            submitChallengeBtn.disabled = true;
            submitChallengeBtn.textContent = "Transmitting Payload...";

            const payload = {
                original_sentence: targetSentence,
                user_sentence: hiddenCatcher.value,
                time: timerLabel.textContent,
                typing_speed: liveWpmLabel.textContent
            };

            try {
                const response = await fetch("/api/submit", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) throw new Error("Metrics delivery tracking failed.");
                const data = await response.json();

                alert(`Analysis Track Recorded Successfully!\nAccuracy: ${data.accuracy || "100%"}\nScore: ${data.score || "100/100"}\nTier: ${data.user_rating || "Pro"}`);

                gamePanel.style.display = "none";
                completionControls.style.display = "none";
                setupPanel.style.display = "block";

            } catch (err) {
                alert(`Operational API Submission Failure: ${err.message}`);
            } finally {
                submitChallengeBtn.disabled = false;
                submitChallengeBtn.textContent = "Submit Results Vector";
            }
        });
    }

    // 8. VIRTUAL KEYBOARD GLOW ENGINE
    function triggerRadiatingBorderRipple(pressedKeyElement) {
        const allKeys = document.querySelectorAll('.key');
        const rect1 = pressedKeyElement.getBoundingClientRect();
        const x1 = rect1.left + rect1.width / 2;
        const y1 = rect1.top + rect1.height / 2;

        allKeys.forEach(key => {
            if (key === pressedKeyElement) return;

            const rect2 = key.getBoundingClientRect();
            const x2 = rect2.left + rect2.width / 2;
            const y2 = rect2.top + rect2.height / 2;

            const distance = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
            const delayMs = distance * 0.9;

            key.classList.remove('border-ripple-fx');
            void key.offsetWidth;

            key.style.animationDelay = `${delayMs}ms`;
            key.classList.add('border-ripple-fx');

            key.addEventListener('animationend', function cleanup() {
                key.classList.remove('border-ripple-fx');
                key.style.animationDelay = '0ms';
                key.removeEventListener('animationend', cleanup);
            });
        });
    }

    window.addEventListener("keydown", function(event) {
        let targetId = event.code;
        if (event.key === " " || targetId === "Space") targetId = "Space";

        if (targetId === "Tab") {
            if (gamePanel && gamePanel.style.display === "block" && !isSessionFinished) {
                event.preventDefault();

                if (!startTime) {
                    startTime = new Date();
                    timerInterval = setInterval(updateLiveTelemetry, 250);
                }

                hiddenCatcher.value += "    ";
                evaluateUnifiedInputState();
            }
        }

        const visualKey = document.getElementById(targetId);
        if (visualKey) {
            if (targetId === "CapsLock") {
                visualKey.classList.toggle("caps-lock-active");
            }
            if (!visualKey.classList.contains("hardware-pressed-active")) {
                visualKey.classList.add("hardware-pressed-active");
                if (rippleAnimationsToggle && rippleAnimationsToggle.checked) {
                    triggerRadiatingBorderRipple(visualKey);
                }
            }
        }
    });

    window.addEventListener("keyup", function(event) {
        let targetId = event.code;
        if (event.key === " " || targetId === "Space") targetId = "Space";

        const visualKey = document.getElementById(targetId);
        if (visualKey) {
            visualKey.classList.remove("hardware-pressed-active");
        }
    });

    // 9. SYSTEM ACCESSIBILITY SWITCHES
    if (keyboardVisibilityToggle) {
        keyboardVisibilityToggle.addEventListener("change", function() {
            if (this.checked) virtualKeyboard.classList.remove("keyboard-hidden");
            else virtualKeyboard.classList.add("keyboard-hidden");
        });
    }

    if (keyboardGlowToggle) {
        keyboardGlowToggle.addEventListener("change", function() {
            if (this.checked) rootContainer.classList.add("keyboard-glow-active");
            else rootContainer.classList.remove("keyboard-glow-active");
        });
    }

    if (highContrastToggle) {
        highContrastToggle.addEventListener("change", function() {
            if (this.checked) rootContainer.classList.add("high-contrast-active");
            else rootContainer.classList.remove("high-contrast-active");
        });
    }

    if (boldTextToggle) {
        boldTextToggle.addEventListener("change", function() {
            if (this.checked) rootContainer.classList.add("bold-text-active");
            else rootContainer.classList.remove("bold-text-active");
        });
    }

    if (themeToggle) {
        themeToggle.addEventListener("change", function() {
            if (this.checked) rootContainer.classList.add("light-theme");
            else rootContainer.classList.remove("light-theme");
        });
    }
});