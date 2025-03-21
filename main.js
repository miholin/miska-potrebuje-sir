/*************************************************
 *  FUNKCIJA ZA PRILAGAJANJE #game-wrapper
 *************************************************/
function scaleToFit() {
    const baseWidth  = 1050;
    const baseHeight = 800;
    const marginTopBottom = 20;
    const winW = window.innerWidth;
    const winH = window.innerHeight;
    const availableH = winH - 2 * marginTopBottom;
    const scale = Math.min(winW / baseWidth, availableH / baseHeight);
    const scaledW = baseWidth * scale;
    const scaledH = baseHeight * scale;
    const wrapper = document.getElementById('game-wrapper');
    wrapper.style.transform = `scale(${scale})`;
    wrapper.style.transformOrigin = "top left";
    const offsetX = (winW - scaledW) / 2;
    const offsetY = marginTopBottom + (availableH - scaledH) / 2;
    wrapper.style.left = offsetX + 'px';
    wrapper.style.top  = offsetY + 'px';
  }
  
  window.addEventListener('load', scaleToFit);
  window.addEventListener('resize', scaleToFit);
  
  /*************************************************
   *  POMOŽNA FUNKCIJA ZA SWEETALERT OPCIJE
   *  (vrne dark/light nastavitve glede na razred na #sidebar)
   *************************************************/
  function getSwalOptions() {
    if (document.getElementById('sidebar').classList.contains('dark-mode')) {
      return {
        background: '#222',
        color: '#fff',
        confirmButtonColor: '#444'
      };
    } else {
      return {
        background: '#fff',
        color: '#000',
        confirmButtonColor: '#3085d6'
      };
    }
  }
  
  /*************************************************
   *  GLAVNI “DOM CONTENT LOADED” DOGODEK
   *************************************************/
  document.addEventListener('DOMContentLoaded', () => {
    scaleToFit();
  
    // Lastni preklop dark mode:
    // Gumb z ID "dark-toggle" preklopi razred "dark-mode" na #sidebar.
    const darkToggle = document.getElementById('dark-toggle');
    darkToggle.addEventListener('click', () => {
      document.getElementById('sidebar').classList.toggle('dark-mode');
    });
  
    // Elementi DOM-a za igro
    const mazeSvg         = document.getElementById('maze-svg');
    const solutionPath    = document.getElementById('solution-path');
    const autoMoveButton  = document.getElementById('auto-move');
    const resetGameButton = document.getElementById('reset-game');
    const navodilaButton  = document.getElementById('navodila');
    const vizitkaButton   = document.getElementById('vizitka');
    const player          = document.getElementById('player');
    const goal            = document.getElementById('goal');
    const timerValue      = document.getElementById('timer-value');
  
    let timeElapsed   = 0;
    let timerInterval = null;
    let gameStarted   = false;
    let foundCheese   = false;
    const scaleFactor = 800 / 484;
  
    /*************************************************
     *  TIMER FUNKCIJE
     *************************************************/
    function startTimer() {
      if (timerInterval) return;
      timeElapsed = 0;
      timerValue.textContent = '0';
      timerInterval = setInterval(() => {
        timeElapsed++;
        timerValue.textContent = String(timeElapsed);
      }, 1000);
    }
  
    function stopTimer() {
      if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
      }
    }
  
    /*************************************************
     *  REŠITVENA POT (TOČKE) IN POSTAVITEV SIRA
     *************************************************/
    const pathPoints = solutionPath
      .getAttribute('points')
      .split(' ')
      .map(p => p.split(',').map(Number));
    const [goalX, goalY] = pathPoints[pathPoints.length - 1];
    goal.style.left = ((goalX - 16) * scaleFactor) + 'px';
    goal.style.top  = ((goalY - 16) * scaleFactor) + 'px';
  
    /*************************************************
     *  GLOBALNE SPREMENLJIVKE ZA MIŠKO
     *************************************************/
    let playerX = 240;
    let playerY = 10;
    let mouseRotation = 0;
    const offset       = 8;
    const boundingHalf = 2; // zmanjšan collision box
    const moveSpeed    = 0.8;
  
    /*************************************************
     *  FUNKCIJA ZA POSODOBITEV POLOŽAJA V DOM
     *************************************************/
    function updatePlayerPosition() {
      player.style.left = ((playerX - offset) * scaleFactor) + 'px';
      player.style.top  = ((playerY - offset) * scaleFactor) + 'px';
      player.style.transform = `rotate(${mouseRotation}deg)`;
    }
    updatePlayerPosition();
  
    /*************************************************
     *  PREVERI, ALI SE JE MIŠKA DOTAKNILA SIRA
     *************************************************/
    function checkWin() {
      if (foundCheese) return;
      const playerRect = player.getBoundingClientRect();
      const goalRect   = goal.getBoundingClientRect();
      if (
        playerRect.left   < goalRect.right &&
        playerRect.right  > goalRect.left &&
        playerRect.top    < goalRect.bottom &&
        playerRect.bottom > goalRect.top
      ) {
        foundCheese = true;
        stopTimer();
        Swal.fire({
          title: 'Čestitke!',
          text: `Miška je našla sir! Porabil si ${timeElapsed} sekund.`,
          imageUrl: 'Slike/najdu_si.gif',  
          imageAlt: 'Najdu si sirček :)',
          confirmButtonText: 'Super!',
          ...getSwalOptions()
        }).then(() => {
          resetGame();
        });
      }
    }
  
    /*************************************************
     *  RISANJE RDEČE ČRTE V SVG
     *************************************************/
    function drawRedLine(x1, y1, x2, y2) {
      const lineEl = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      lineEl.setAttribute('x1', x1);
      lineEl.setAttribute('y1', y1);
      lineEl.setAttribute('x2', x2);
      lineEl.setAttribute('y2', y2);
      lineEl.setAttribute('stroke', 'red');
      lineEl.setAttribute('stroke-width', '2');
      mazeSvg.appendChild(lineEl);
    }
  
    /*************************************************
     *  POMOŽNA FUNKCIJA - RAZDALJA MED DVEMA TOČKAMA
     *************************************************/
    function getDistance(x1, y1, x2, y2) {
      const dx = x2 - x1;
      const dy = y2 - y1;
      return Math.sqrt(dx * dx + dy * dy);
    }
  
    /*************************************************
     *  “SMOOTH” SAMODEJNO PREMIKANJE – KONSTANTNA HITROST
     *************************************************/
    function smoothMoveAlongPath(speedPxPerSec = 80) {
      const oldLines = mazeSvg.querySelectorAll('line[stroke="red"]');
      oldLines.forEach(l => l.remove());
      if (!pathPoints || pathPoints.length < 2) return;
      let currentSegment = 0;
      let startTime = null;
      const [startX, startY] = pathPoints[0];
      playerX = startX;
      playerY = startY;
      updatePlayerPosition();
      let lastX = startX;
      let lastY = startY;
      let segmentDuration = 0;
      let x1 = 0, y1 = 0, x2 = 0, y2 = 0;
      if (pathPoints.length >= 2) {
        [x1, y1] = pathPoints[0];
        [x2, y2] = pathPoints[1];
        const dist = getDistance(x1, y1, x2, y2);
        segmentDuration = (dist / speedPxPerSec) * 1000;
      }
      function animate(timestamp) {
        if (!gameStarted) return;
        if (!startTime) { startTime = timestamp; }
        const elapsed = timestamp - startTime;
        let progress = elapsed / segmentDuration;
        if (progress > 1) progress = 1;
        const newX = x1 + (x2 - x1) * progress;
        const newY = y1 + (y2 - y1) * progress;
        drawRedLine(lastX, lastY, newX, newY);
        playerX = newX;
        playerY = newY;
        const dx = newX - lastX;
        const dy = newY - lastY;
        mouseRotation = (Math.abs(dx) > Math.abs(dy))
                        ? (dx > 0 ? 270 : 90)
                        : (dy > 0 ? 0 : 180);
        updatePlayerPosition();
        lastX = newX;
        lastY = newY;
        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          currentSegment++;
          startTime = null;
          if (currentSegment < pathPoints.length - 1) {
            x1 = pathPoints[currentSegment][0];
            y1 = pathPoints[currentSegment][1];
            x2 = pathPoints[currentSegment + 1][0];
            y2 = pathPoints[currentSegment + 1][1];
            const dist = getDistance(x1, y1, x2, y2);
            segmentDuration = (dist / speedPxPerSec) * 1000;
            requestAnimationFrame(animate);
          } else {
            checkWin();
          }
        }
      }
      requestAnimationFrame(animate);
    }
  
    /*************************************************
     *  EVENT LISTENERS ZA GUMBE
     *************************************************/
    autoMoveButton.addEventListener('click', () => {
      if (!gameStarted) {
        gameStarted = true;
        foundCheese = false;
        startTimer();
      }
      smoothMoveAlongPath(80);
    });
  
    vizitkaButton.addEventListener('click', () => {
      Swal.fire({
        title: 'Vizitka',
        html: `
            <p><strong>Miha Sever</strong></p>
            <p>4.RB, ERŠ Nova Gorica</p>
        `,
        icon: 'info',
        confirmButtonText: 'Zapri',
        ...getSwalOptions()
      });
    });
  
    navodilaButton.addEventListener('click', () => {
      Swal.fire({
        title: 'Navodila',
        text: '1) Premikaj miško s puščicami ali klikni "Samodejno premikanje".\n' +
              '2) Timer se zažene ob prvem premiku.\n' +
              '3) Ko najdeš sir, se prikaže porabljen čas.\n' +
              '4) S "Resetiraj" začneš znova.',
        icon: 'info',
        confirmButtonText: 'Zapri',
        ...getSwalOptions()
      });
    });
  
    function resetGame() {
      foundCheese = false;
      gameStarted = false;
      stopTimer();
      playerX = 240;
      playerY = 10;
      mouseRotation = 0;
      updatePlayerPosition();
      timeElapsed = 0;
      timerValue.textContent = '0';
      const oldLines = mazeSvg.querySelectorAll('line[stroke="red"]');
      oldLines.forEach(l => l.remove());
    }
    resetGameButton.addEventListener('click', resetGame);
  
    /*************************************************
     *  PREPREČIMO TRKE S STENAMI LABIRINTA (ROČNI PREMIK)
     *************************************************/
    const mazeLines = mazeSvg.querySelectorAll('line');
    function canMoveTo(nx, ny) {
      const left   = nx - boundingHalf;
      const right  = nx + boundingHalf;
      const top    = ny - boundingHalf;
      const bottom = ny + boundingHalf;
      for (const line of mazeLines) {
        const x1 = parseInt(line.getAttribute('x1'), 10);
        const y1 = parseInt(line.getAttribute('y1'), 10);
        const x2 = parseInt(line.getAttribute('x2'), 10);
        const y2 = parseInt(line.getAttribute('y2'), 10);
        const pad = 1;
        const lineLeft   = Math.min(x1, x2) - pad;
        const lineRight  = Math.max(x1, x2) + pad;
        const lineTop    = Math.min(y1, y2) - pad;
        const lineBottom = Math.max(y1, y2) + pad;
        const horizOverlap = (left < lineRight && right > lineLeft);
        const vertOverlap  = (top < lineBottom && bottom > lineTop);
        if (horizOverlap && vertOverlap) {
          return false;
        }
      }
      return true;
    }
  
    /*************************************************
     *  TIPKE ZA GIBANJE MIŠKE (PUŠČICE)
     *************************************************/
    let moveUp = false, moveDown = false, moveLeft = false, moveRight = false;
    document.addEventListener('keydown', (e) => {
      if (!gameStarted) {
        gameStarted = true;
        foundCheese = false;
        startTimer();
      }
      switch (e.key) {
        case 'ArrowUp':
          moveUp = true;
          mouseRotation = 180;
          break;
        case 'ArrowDown':
          moveDown = true;
          mouseRotation = 0;
          break;
        case 'ArrowLeft':
          moveLeft = true;
          mouseRotation = 90;
          break;
        case 'ArrowRight':
          moveRight = true;
          mouseRotation = 270;
          break;
      }
    });
    document.addEventListener('keyup', (e) => {
      switch (e.key) {
        case 'ArrowUp':    moveUp = false; break;
        case 'ArrowDown':  moveDown = false; break;
        case 'ArrowLeft':  moveLeft = false; break;
        case 'ArrowRight': moveRight = false; break;
      }
    });
  
    /*************************************************
     *  FUNKCIJA ZA PREMIK MIŠKE (ROČNI)
     *************************************************/
    function movePlayer() {
      if (!gameStarted) return;
      let newX = playerX;
      let newY = playerY;
      if (moveUp)    newY -= moveSpeed;
      if (moveDown)  newY += moveSpeed;
      if (moveLeft)  newX -= moveSpeed;
      if (moveRight) newX += moveSpeed;
      if (newX < boundingHalf)       newX = boundingHalf;
      if (newX > 484 - boundingHalf) newX = 484 - boundingHalf;
      if (newY < boundingHalf)       newY = boundingHalf;
      if (newY > 484 - boundingHalf) newY = 484 - boundingHalf;
      if (canMoveTo(newX, newY)) {
        playerX = newX;
        playerY = newY;
        updatePlayerPosition();
        checkWin();
      }
    }
  
    /*************************************************
     *  GLAVNI LOOP (za ročno premikanje)
     *************************************************/
    function gameLoop() {
      movePlayer();
      requestAnimationFrame(gameLoop);
    }
    gameLoop();
  });
  