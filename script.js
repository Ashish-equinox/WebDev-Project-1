/* =========================
   WHACK-EM GAME LOGIC
   ========================= */
const holes = document.querySelectorAll(".hole");
const scoreBoard = document.querySelector(".score");
const moles = document.querySelectorAll(".mole");
const startButton = document.querySelector("#start");
const gameStatus = document.querySelector(".game-status");

let lastHole;
let timeUp = false;
let score = 0;
let gameInProgress = false;
let timers = []; // track active timeouts

// Mole visible time (ms): increase = slower, decrease = faster
const SPEED_MIN_MS = 500;
const SPEED_MAX_MS = 1100;

/* ---------- Helpers ---------- */
function randomTime(min, max) {
  return Math.round(Math.random() * (max - min) + min);
}

function randomHole(holes) {
  const idx = Math.floor(Math.random() * holes.length);
  const hole = holes[idx];
  if (hole === lastHole) return randomHole(holes);
  lastHole = hole;
  return hole;
}

function clearTimers() {
  timers.forEach(id => clearTimeout(id));
  timers = [];
}

function hideAllMoles() {
  holes.forEach(h => h.classList.remove("up"));
}

/* ---------- Game flow ---------- */
function peep() {
  if (timeUp) return;
  const time = randomTime(SPEED_MIN_MS, SPEED_MAX_MS);
  const hole = randomHole(holes);
  hole.classList.add("up");
  const t = setTimeout(() => {
    hole.classList.remove("up");
    if (!timeUp) peep();
  }, time);
  timers.push(t);
}

function startGame() {
  if (gameInProgress) return;
  gameInProgress = true;

  clearTimers();
  hideAllMoles();
  timeUp = false;

  if (scoreBoard) scoreBoard.textContent = 0;
  score = 0;
  updateLeaderboard(0);

  if (startButton) startButton.style.display = "none";
  if (gameStatus) gameStatus.innerHTML = "";

  peep(); // start immediately

  // end after 10s
  const endId = setTimeout(() => {
    timeUp = true;
    clearTimers();
    hideAllMoles();
    gameInProgress = false;

    if (startButton) {
      startButton.textContent = "Try Again?";
      startButton.style.display = "block";
      if (gameStatus) gameStatus.appendChild(startButton);
    }
    endGame();
  }, 10000);
  timers.push(endId);
}

function bonk(e) {
  if (!e.isTrusted || !this.parentElement.classList.contains("up")) return;
  score++;
  this.parentElement.classList.remove("up");
  if (scoreBoard) scoreBoard.textContent = score;
  updateLeaderboard(score);

  this.classList.add("hit");
  setTimeout(() => this.classList.remove("hit"), 200);
}

moles.forEach(mole => mole.addEventListener("click", bonk));
if (startButton) startButton.addEventListener("click", startGame);

/* ---------- Storage & leaderboard (shared) ---------- */
function getScores() {
  try {
    return JSON.parse(localStorage.getItem("whackemScores") || "[]");
  } catch {
    return [];
  }
}

function setScores(arr) {
  localStorage.setItem("whackemScores", JSON.stringify(arr));
}

function saveScoreRecord(name, score) {
  const record = { name, score, ts: Date.now() };
  const scores = getScores();
  scores.push(record);
  scores.sort((a, b) => b.score - a.score || a.ts - b.ts);
  if (scores.length > 200) scores.length = 200;
  setScores(scores);
}

let highScore = parseInt(localStorage.getItem("whackemHighScore") || "0");
if (document.getElementById("highScore")) {
  document.getElementById("highScore").textContent = highScore;
}

function updateLeaderboard(currentScore) {
  if (document.getElementById("currentScore")) {
    document.getElementById("currentScore").textContent = currentScore;
  }
  if (currentScore > highScore) {
    highScore = currentScore;
    localStorage.setItem("whackemHighScore", highScore);
    if (document.getElementById("highScore")) {
      document.getElementById("highScore").textContent = highScore;
    }
  }
}

// Initialize home card on load
if (document.getElementById("currentScore")) {
  updateLeaderboard(parseInt(scoreBoard?.textContent || "0"));
}

// If a .score element exists on a page, keep card in sync with it
const scoreDisplay = document.querySelector(".score");
if (scoreDisplay) {
  const scoreObserver = new MutationObserver(() => {
    const currentScore = parseInt(scoreDisplay.textContent) || 0;
    updateLeaderboard(currentScore);
  });
  scoreObserver.observe(scoreDisplay, { childList: true, characterData: true, subtree: true });
}

function endGame() {
  const finalScore = parseInt((scoreBoard && scoreBoard.textContent) || String(score) || "0");
  updateLeaderboard(finalScore);

  if (finalScore > 0) {
    // Save only if user actually enters a name
    const raw = prompt(
      `Game Over!\nYour score: ${finalScore}\nEnter your name (or leave blank to skip):`,
      ""
    );
    if (raw !== null) {
      const name = raw.trim().substring(0, 20);
      if (name) saveScoreRecord(name, finalScore);
    }
  }

  if (confirm("Game over! View the leaderboard?")) {
    window.location.href = "leaderboard.html";
  }
}

/* ---------- Leaderboard page only ---------- */
const onLeaderboardPage =
  document.getElementById("tableBody") &&
  document.getElementById("addForm");

if (onLeaderboardPage) {
  const toast = document.getElementById("toast");
  function showToast(message, isSuccess = true) {
    toast.textContent = message;
    toast.className = `toast show ${isSuccess ? "success" : "error"}`;
    setTimeout(() => {
      toast.className = toast.className.replace("show", "");
    }, 3000);
  }

  const tbody = document.getElementById("tableBody");

  function renderLeaderboard() {
    const scores = getScores().sort((a, b) => b.score - a.score || a.ts - b.ts);
    const topScores = scores.slice(0, 10);
    tbody.innerHTML = "";

    if (topScores.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="5" style="text-align:center;">No scores yet. Go play!</td></tr>';
      return;
    }

    topScores.forEach((s, i) => {
      const tr = document.createElement("tr");
      const date = new Date(s.ts).toLocaleString();
      tr.innerHTML = `
        <td>${i + 1}</td>
        <td><input type="text" value="${s.name}" class="nameEdit" /></td>
        <td><input type="number" value="${s.score}" class="scoreEdit" min="0" /></td>
        <td>${date}</td>
        <td>
          <button class="btn update" data-ts="${s.ts}">Update</button>
          <button class="btn delete" data-ts="${s.ts}">Delete</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  document.getElementById("addForm").addEventListener("submit", e => {
    e.preventDefault();
    const name = (document.getElementById("nameInput").value.trim() || "Player").substring(0, 20);
    const score = parseInt(document.getElementById("scoreInput").value) || 0;
    const arr = getScores();
    arr.push({ name, score, ts: Date.now() });
    setScores(arr);
    e.target.reset();
    renderLeaderboard();
    showToast("Score added successfully!");
  });

  tbody.addEventListener("click", e => {
    const ts = Number(e.target.dataset.ts);
    if (!ts) return;

    let scores = getScores();
    if (e.target.classList.contains("update")) {
      const row = e.target.closest("tr");
      const idx = scores.findIndex(r => r.ts === ts);
      if (idx !== -1) {
        scores[idx].name = (row.querySelector(".nameEdit").value.trim() || "Player").substring(0, 20);
        scores[idx].score = parseInt(row.querySelector(".scoreEdit").value) || 0;
        setScores(scores);
        renderLeaderboard();
        showToast("Score updated!");
      }
    }

    if (e.target.classList.contains("delete")) {
      if (confirm("Are you sure you want to delete this score?")) {
        scores = scores.filter(r => r.ts !== ts);
        setScores(scores);
        renderLeaderboard();
        showToast("Score deleted.", false);
      }
    }
  });

  document.getElementById("clearAll").addEventListener("click", () => {
    if (confirm("Are you sure you want to clear ALL scores? This cannot be undone.")) {
      localStorage.removeItem("whackemScores");
      localStorage.removeItem("whackemHighScore");
      renderLeaderboard();
      showToast("All scores have been cleared.", false);
    }
  });

  renderLeaderboard();
}
