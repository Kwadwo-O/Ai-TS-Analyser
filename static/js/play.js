document.addEventListener("DOMContentLoaded", function() {
    // ========== EXISTING TYPING GAME VARIABLES ==========
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
    const animToggle = document.getElementById("keyboard-animations-toggle");
    const rippleToggle = document.getElementById("ripple-animations-toggle");
    const themeButtons = document.querySelectorAll(".theme-tile-btn");

    // ========== NEW MEMORY MODE VARIABLES ==========
    const modeTypingBtn = document.getElementById("mode-typing");
    const modeMemoryBtn = document.getElementById("mode-memory");
    const memoryPanel = document.getElementById("memory-panel");
    const memorySentenceEl = document.getElementById("memorySentence");
    const memoryProgressEl = document.getElementById("memoryProgress");
    const memoryTimerEl = document.getElementById("memoryTimeLeft");
    const memoryInputContainer = document.getElementById("memoryInputContainer");
    const memoryInputEl = document.getElementById("memoryInput");
    const memorySubmitBtn = document.getElementById("memorySubmit");
    const memoryResetBtn = document.getElementById("memoryReset");
    const memoryResultEl = document.getElementById("memoryResult");

    const textSizeSlider = document.getElementById("text-size-slider");
    const textSizeBadge = document.getElementById("text-size-badge");

    let rawChallengeText = "";
    let timeElapsed = 0;
    let timerInterval = null;
    let timingStarted = false;
    const difficultyMap = { "1": "easy", "2": "medium", "3": "hard" };
    let currentMode = "typing"; // track which mode we're in

    // Memory mode variables
    let memoryDisplayTimeout = null;
    let memoryHideTimeout = null;
    let memoryProgressInterval = null;
    const MEMORY_DISPLAY_MS = 30000; // 30 seconds

    // TEXT PRESENTATION SIZING
    const savedSize = localStorage.getItem("game-engine-text-size") || "1.25";
    textSizeSlider.value = savedSize;
    textSizeBadge.textContent = `${savedSize}rem`;
    textDisplay.style.fontSize = `${savedSize}rem`;

    textSizeSlider.addEventListener("input", function() {
        const value = this.value;
        textSizeBadge.textContent = `${value}rem`;
        textDisplay.style.fontSize = `${value}rem`;
        localStorage.setItem("game-engine-text-size", value);
    });

    // THEME CONFIGURATION
    const savedTheme = localStorage.getItem("selected-game-theme") || "light";
    applyThemeEngineConfiguration(savedTheme);

    themeButtons.forEach(btn => {
        btn.addEventListener("click", function() {
            applyThemeEngineConfiguration(this.getAttribute("data-theme"));
        });
    });

    function applyThemeEngineConfiguration(themeName) {
        document.documentElement.setAttribute("data-game-theme", themeName);
        localStorage.setItem("selected-game-theme", themeName);
        themeButtons.forEach(b => b.classList.toggle("active", b.getAttribute("data-theme") === themeName));
    }

    // ========== MODE SWITCHING ==========
    function switchMode(newMode) {
        currentMode = newMode;
        if(newMode === "typing") {
            modeTypingBtn.style.opacity = "1";
            modeMemoryBtn.style.opacity = "0.6";
            memoryPanel.style.display = "none";
            setupPanel.style.display = "block";
            gamePanel.style.display = "none";
            resultsPanel.style.display = "none";
        } else if(newMode === "memory") {
            modeTypingBtn.style.opacity = "0.6";
            modeMemoryBtn.style.opacity = "1";
            memoryPanel.style.display = "block";
            setupPanel.style.display = "none";
            gamePanel.style.display = "none";
            resultsPanel.style.display = "none";
            // Start memory round immediately
            startMemoryRound();
        }
    }

    if(modeTypingBtn) {
        modeTypingBtn.addEventListener("click", () => switchMode("typing"));
    }
    if(modeMemoryBtn) {
        modeMemoryBtn.addEventListener("click", () => switchMode("memory"));
    }

    // ========== MEMORY MODE FUNCTIONS ==========
    async function startMemoryRound() {
        // Use the already-generated rawChallengeText
        if(!rawChallengeText) {
            // If no sentence was generated yet, generate one
            try {
                const difficulty = difficultyMap[difficultyControl.value] || "medium";
                const response = await fetch(`/api/generate?difficulty=${difficulty}`);
                const result = await response.json();
                if (!response.ok) throw new Error(result.error || "Failed to generate sentence.");
                rawChallengeText = result.sentence;
            } catch(err) {
                memoryResultEl.style.display = "block";
                memoryResultEl.innerHTML = `<p style="color:var(--primary);">Error: ${err.message}</p>`;
                return;
            }
        }

        // Show the sentence
        memorySentenceEl.textContent = rawChallengeText;
        memoryInputContainer.style.display = "none";
        memoryResultEl.style.display = "none";
        memoryProgressEl.style.width = "100%";

        // Animate the 30-second countdown
        let timeRemaining = 30;
        memoryTimerEl.textContent = "30";

        const startTime = Date.now();
        memoryProgressInterval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const pctRemaining = Math.max(0, 100 - (elapsed / MEMORY_DISPLAY_MS) * 100);
            memoryProgressEl.style.width = pctRemaining + "%";

            const secondsLeft = Math.ceil((MEMORY_DISPLAY_MS - elapsed) / 1000);
            memoryTimerEl.textContent = Math.max(0, secondsLeft);

            if(elapsed >= MEMORY_DISPLAY_MS) {
                clearInterval(memoryProgressInterval);
                // Hide sentence and show input
                memorySentenceEl.textContent = "";
                memoryInputContainer.style.display = "block";
                memoryInputEl.value = "";
                memoryInputEl.focus();
            }
        }, 100);
    }

    if(memorySubmitBtn) {
        memorySubmitBtn.addEventListener("click", async function() {
            const recalled = memoryInputEl.value || "";
            const payload = {
                original_sentence: rawChallengeText,
                recalled_sentence: recalled,
                difficulty: parseInt(difficultyControl.value, 10)
            };

            try {
                const response = await fetch("/api/submit_memory", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });
                const data = await response.json();

                if(data.error) {
                    memoryResultEl.style.display = "block";
                    memoryResultEl.innerHTML = `<p style="color:var(--primary);">Error: ${data.error}</p>`;
                    return;
                }

                // Display results
                document.getElementById("res-mem-accuracy").textContent = `${data.accuracy}%`;
                document.getElementById("res-mem-score").textContent = `${data.score}`;

                let mistakesHtml = "<strong>Mistakes:</strong> ";
                if(data.mistakes && data.mistakes.length > 0) {
                    mistakesHtml += `<div style="margin-top:0.5rem;">`;
                    data.mistakes.forEach(m => {
                        mistakesHtml += `<div><span style="text-decoration:line-through;color:var(--text-muted);">"${m.correct}"</span> <span style="color:var(--primary);font-weight:bold;">➔ "${m.entered}"</span></div>`;
                    });
                    mistakesHtml += `</div>`;
                } else {
                    mistakesHtml = "<strong>Perfect recall!</strong>";
                }
                document.getElementById("res-mem-mistakes").innerHTML = mistakesHtml;
                memoryInputContainer.style.display = "none";
                memoryResultEl.style.display = "block";
            } catch(err) {
                memoryResultEl.style.display = "block";
                memoryResultEl.innerHTML = `<p style="color:var(--primary);">Error: ${err.message}</p>`;
            }
        });
    }

    if(memoryResetBtn) {
        memoryResetBtn.addEventListener("click", () => {
            clearInterval(memoryProgressInterval);
            rawChallengeText = ""; // Clear so next round generates new sentence
            startMemoryRound();
        });
    }

    // ========== EXISTING TYPING GAME LOGIC BELOW ==========
    // (rest of the existing typing game code stays the same)

    function renderChallengeTextToDOM(text) {
        textDisplay.innerHTML = "";
        const lines = text.split("\n");

        lines.forEach((line, lineIdx) => {
            const lineContainer = document.createElement("div");
            lineContainer.classList.add("code-line-block");

            line.split("").forEach((char) => {
                const span = document.createElement("span");
                span.classList.add("char-span");
                if (char === " ") {
                    span.textContent = "·";
                    span.classList.add("whitespace-node");
                } else {
                    span.textContent = char;
                }
                lineContainer.appendChild(span);
            });

            if (lineIdx < lines.length - 1) {
                const breakSpan = document.createElement("span");
                breakSpan.classList.add("char-span", "whitespace-node");
                breakSpan.textContent = "↵\n";
                lineContainer.appendChild(breakSpan);
            }
            textDisplay.appendChild(lineContainer);
        });

        const firstChar = textDisplay.querySelector(".char-span");
        if (firstChar) firstChar.classList.add("active-cursor");
    }

    window.addEventListener("keydown", function(e) {
        let code = e.code;
        if (e.key === " ") code = "Space";

        const keyElement = document.getElementById(code);
        if (keyElement) {
            if (animToggle.checked) keyElement.classList.add("hardware-pressed");
            if (rippleToggle.checked) {
                const rect = keyElement.getBoundingClientRect();
                document.querySelectorAll(".key").forEach(k => {
                    if (k === keyElement) return;
                    const r = k.getBoundingClientRect();
                    const dist = Math.hypot((r.left+r.width/2)-(rect.left+rect.width/2), (r.top+r.height/2)-(rect.top+rect.height/2));
                    setTimeout(() => {
                        k.style.borderColor = "var(--button-color)";
                        setTimeout(() => k.style.borderColor = "", 100);
                    }, dist * 0.35);
                });
            }
        }

        if (gamePanel.style.display === "block" && !hiddenCatcher.disabled) {
            if (document.activeElement !== hiddenCatcher) hiddenCatcher.focus();

            if (code === "Space" && e.target !== hiddenCatcher) e.preventDefault();
            if (code === "Tab" || code === "Backspace") e.preventDefault();

            if (code === "Backspace") {
                hiddenCatcher.value = hiddenCatcher.value.slice(0, -1);
                hiddenCatcher.dispatchEvent(new Event('input'));
            } else if (code === "Tab") {
                hiddenCatcher.value += "    ";
                hiddenCatcher.dispatchEvent(new Event('input'));
            } else if (code === "Enter") {
                if (rawChallengeText.includes("\n") || rawChallengeText.includes("    ")) {
                    hiddenCatcher.value += "\n";
                    hiddenCatcher.dispatchEvent(new Event('input'));
                } else if (hiddenCatcher.value.length >= rawChallengeText.length) {
                    submitBtn.click();
                }
            } else if (e.key.length === 1) {
                if (document.activeElement !== hiddenCatcher) {
                    hiddenCatcher.value += e.key;
                    hiddenCatcher.dispatchEvent(new Event('input'));
                }
            }
        }
    });

    window.addEventListener("keyup", function(e) {
        let code = e.code; if (e.key === " ") code = "Space";
        const keyElement = document.getElementById(code);
        if (keyElement) keyElement.classList.remove("hardware-pressed");
    });

    if (difficultyControl) {
        difficultyControl.addEventListener("input", function() {
            difficultyBadge.textContent = difficultyMap[this.value];
        });
    }

    hiddenCatcher.addEventListener("input", function() {
        const val = this.value;

        if (!timingStarted && val.length > 0) {
            timingStarted = true;
            timerInterval = setInterval(() => {
                timeElapsed++;
                timerLabel.textContent = `${timeElapsed}s`;
                liveWpmLabel.textContent = `${Math.round((hiddenCatcher.value.length / 5) / (timeElapsed / 60))} WPM`;
            }, 1000);
        }

        const spans = textDisplay.querySelectorAll(".char-span");
        let idx = 0;

        spans.forEach((span) => {
            span.classList.remove("correct", "incorrect", "active-cursor");
            let targetChar = span.textContent;
            if (span.classList.contains("whitespace-node")) {
                targetChar = span.textContent.includes("↵") ? "\n" : " ";
            }

            if (idx < val.length) {
                if (val[idx] === targetChar) {
                    span.classList.add("correct");
                } else {
                    span.classList.add("incorrect");
                }
            } else if (idx === val.length) {
                span.classList.add("active-cursor");
            }
            idx++;
        });

        liveWpmLabel.textContent = `${Math.round((val.length / 5) / ((timeElapsed || 1) / 60))} WPM`;
        submitBtn.style.display = (val.length >= spans.length) ? "inline-flex" : "none";
    });

    if (startBtn) {
        startBtn.addEventListener("click", async function() {
            startBtn.disabled = true; startIcon.style.display = "none"; startSpinner.style.display = "inline-block"; startBtnText.textContent = "Fetching...";
            errorFallback.style.display = "none";

            try {
                const difficulty = difficultyMap[difficultyControl.value] || "medium";
                const response = await fetch(`/api/generate?difficulty=${difficulty}`);
                const result = await response.json();
                if (!response.ok) throw new Error(result.error || "Failed layout configurations.");

                rawChallengeText = result.sentence;
                renderChallengeTextToDOM(rawChallengeText);

                timeElapsed = 0; timingStarted = false;
                timerLabel.textContent = "0s"; liveWpmLabel.textContent = "0 WPM";
                hiddenCatcher.value = ""; hiddenCatcher.disabled = false;
                setupPanel.style.display = "none"; gamePanel.style.display = "block";

                document.body.addEventListener("click", () => { if(gamePanel.style.display === "block") hiddenCatcher.focus(); });
                hiddenCatcher.focus();
            } catch (err) {
                errorText.textContent = err.message; errorFallback.style.display = "block";
            } finally {
                startBtn.disabled = false; startIcon.style.display = "inline-block"; startSpinner.style.display = "none"; startBtnText.textContent = "Generate Challenge Passage";
            }
        });
    }

    if (submitBtn) {
        submitBtn.addEventListener("click", async function() {
            clearInterval(timerInterval);
            submitBtn.disabled = true; submitIcon.style.display = "none"; submitSpinner.style.display = "inline-block";

            try {
                const response = await fetch("/api/submit", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        original_sentence: rawChallengeText,
                        user_sentence: hiddenCatcher.value,
                        time: `${timeElapsed}s`,
                        typing_speed: liveWpmLabel.textContent
                    })
                });
                const metrics = await response.json();

                document.getElementById("res-speed").textContent = liveWpmLabel.textContent;
                document.getElementById("res-accuracy").textContent = metrics.accuracy || "100%";
                document.getElementById("res-score").textContent = metrics.score || "100/100";
                document.getElementById("res-analysis").textContent = metrics.text_analysis || "Completed.";

                const wrapper = document.getElementById("res-mistakes"); wrapper.innerHTML = "";
                if (metrics.mistakes && metrics.mistakes.length > 0) {
                    metrics.mistakes.forEach(m => {
                        const row = document.createElement("div");
                        row.innerHTML = `<span style="color:var(--text-muted); text-decoration:line-through;">${m.expected}</span> <span style="color:var(--primary); font-weight:bold;">➔ ${m.typed}</span>`;
                        wrapper.appendChild(row);
                    });
                    document.getElementById("mistakes-wrapper").style.display = "block";
                } else {
                    document.getElementById("mistakes-wrapper").style.display = "none";
                }

                gamePanel.style.display = "none"; resultsPanel.style.display = "block";
                if (window.confetti) confetti({ particleCount: 100, spread: 60, origin: { y: 0.6 } });
            } catch (err) {
                errorText.textContent = err.message; errorFallback.style.display = "block";
                gamePanel.style.display = "none"; setupPanel.style.display = "block";
            } finally {
                submitBtn.disabled = false; submitIcon.style.display = "inline-block"; submitSpinner.style.display = "none";
            }
        });
    }

    if (resetBtn) {
        resetBtn.addEventListener("click", function() {
            resultsPanel.style.display = "none"; setupPanel.style.display = "block";
        });
    }
});