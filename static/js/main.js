// Memory mode client logic
(function(){
  const startBtn = document.getElementById('memory-start');
  const diffSel = document.getElementById('memory-difficulty');
  const sentenceEl = document.getElementById('memorySentence');
  const progressEl = document.getElementById('memoryProgress');
  const inputContainer = document.getElementById('memoryInputContainer');
  const inputEl = document.getElementById('memoryInput');
  const submitBtn = document.getElementById('memorySubmit');
  const resultEl = document.getElementById('memoryResult');

  let currentOrig = '';
  let showTimeout = null;
  let hideTimeout = null;
  let progressInterval = null;

  function computeDisplayDuration(sentence, difficulty){
    // Example formula: base time per word decreases as difficulty increases
    const words = sentence.trim().split(/\s+/).length;
    const basePerWord = difficulty === 1 ? 1.2 : difficulty === 2 ? 0.9 : difficulty === 3 ? 0.8 : 0.7;
    // clamp min and max
    const dur = Math.min(10, Math.max(2, Math.round(words * basePerWord)));
    return dur * 1000; // ms
  }

  async function startRound(){
    const difficulty = diffSel.value || '1';
    // fetch sentence
    const res = await fetch(`/api/generate_memory?difficulty=${difficulty}`);
    const data = await res.json();
    if(data.error){
      resultEl.style.display = 'block';
      resultEl.innerText = 'Error generating sentence: ' + (data.error || 'Unknown');
      return;
    }
    const sentence = (data.sentence || '').trim();
    if(!sentence){
      resultEl.style.display = 'block';
      resultEl.innerText = 'Empty sentence returned.';
      return;
    }
    currentOrig = sentence;
    sentenceEl.textContent = sentence;
    inputContainer.style.display = 'none';
    resultEl.style.display = 'none';
    progressEl.style.width = '0%';

    const displayMs = computeDisplayDuration(sentence, parseInt(difficulty, 10));
    // animate progress
    const startTime = Date.now();
    progressInterval && clearInterval(progressInterval);
    progressInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, (elapsed / displayMs) * 100);
      progressEl.style.width = pct + '%';
      if(pct >= 100) clearInterval(progressInterval);
    }, 50);

    // After displayMs hide sentence and show input
    clearTimeout(hideTimeout);
    hideTimeout = setTimeout(() => {
      sentenceEl.textContent = ''; // hide
      inputContainer.style.display = 'block';
      inputEl.value = '';
      inputEl.focus();
    }, displayMs);
  }

  async function submitRecall(){
    const recalled = inputEl.value || '';
    // send to server for scoring
    const payload = {
      original_sentence: currentOrig,
      recalled_sentence: recalled,
      // optionally include timeShown, recallTime, difficulty
      difficulty: parseInt(diffSel.value, 10)
    };
    const res = await fetch('/api/submit_memory', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    // show results
    resultEl.style.display = 'block';
    if(data.error){
      resultEl.innerText = 'Error: ' + data.error;
      return;
    }
    resultEl.innerHTML = `
      <div><strong>Accuracy:</strong> ${data.accuracy}%</div>
      <div><strong>Score:</strong> ${data.score}</div>
      <div><strong>Mistakes:</strong> ${data.mistakes.length}</div>
      <pre style="margin-top:.5rem">${JSON.stringify(data.mistakes, null, 2)}</pre>
    `;

    // Simple progression: increase difficulty on good score
    if(data.score >= 80 && parseInt(diffSel.value) < 4){
      diffSel.value = String(parseInt(diffSel.value) + 1);
      // optionally show toast "Difficulty increased"
    }
  }

  startBtn && startBtn.addEventListener('click', startRound);
  submitBtn && submitBtn.addEventListener('click', submitRecall);

  // Optional Skip logic
  const skipBtn = document.getElementById('memorySkip');
  if(skipBtn) skipBtn.addEventListener('click', () => {
    inputContainer.style.display = 'none';
    sentenceEl.textContent = '';
    resultEl.style.display = 'block';
    resultEl.innerText = 'Skipped.';
  });

})();
document.addEventListener('DOMContentLoaded', () => {
  const startBtn = document.getElementById('memory-start');
  if (!startBtn) return;

  // Minimal safe wiring for memory mode buttons
  startBtn.addEventListener('click', async () => {
    // Fetch sentence, show it, hide it, show textarea...
    // Use the code snippet I previously provided for full behavior
    console.log('Start memory round (implement logic here)');
  });

  const submitBtn = document.getElementById('memorySubmit');
  if (submitBtn) {
    submitBtn.addEventListener('click', async () => {
      console.log('Submit recall (implement logic here)');
    });
  }
});