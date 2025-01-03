function scaleToFit() {
    const baseWidth  = 1050; 
    const baseHeight = 800;
  
    // Npr. 20 px od zgoraj in 20 px od spodaj
    const marginTopBottom = 20;
  
    // Dejansko okno
    const winW = window.innerWidth;
    const winH = window.innerHeight;
  
    // Koliko je na voljo po višini, upoštevaj margin
    const availableH = winH - 2 * marginTopBottom;
  
    // Izračun “scale”
    const scale = Math.min(
      winW / baseWidth,
      availableH / baseHeight
    );
  
    // Koliko bo velik #game-wrapper po skaliranju
    const scaledW = baseWidth * scale;
    const scaledH = baseHeight * scale;
  
    const wrapper = document.getElementById('game-wrapper');
    // Nastavimo transform
    wrapper.style.transform = `scale(${scale})`;
  
    // Izračun centriranja
    const offsetX = (winW - scaledW) / 2;
    const offsetY = marginTopBottom + (availableH - scaledH)/2;
  
    wrapper.style.left = offsetX + 'px';
    wrapper.style.top  = offsetY + 'px';
  }
  
  // Povežemo
  window.addEventListener('load', scaleToFit);
  window.addEventListener('resize', scaleToFit);

document.addEventListener('DOMContentLoaded', () => {
    scaleToFit();
    const mazeSvg = document.getElementById('maze-svg');
    const solutionPath = document.getElementById('solution-path');
    const autoMoveButton = document.getElementById('auto-move');
    const resetGameButton = document.getElementById('reset-game');
    const navodilaButton = document.getElementById('navodila');
    const startGameButton = document.getElementById('start-game');
    const player = document.getElementById('player');
    const goal = document.getElementById('goal');
    const timerValue = document.getElementById('timer-value');

    let timeElapsed = 0;
    let timerInterval = null;

    // ali je igra zagnana
    let gameStarted = false;

    function startTimer() {
        if (timerInterval) return;

        timeElapsed = 0;
        timerValue.textContent = '0';
        timerInterval = setInterval(() => {
            timeElapsed++;
            timerValue.textContent = String(timeElapsed);
        }, 1000);
    }

    //ustavi timer
    function stopTimer() {
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
    }


    let foundCheese = false;
    let autoMoveIndex = 0;
    const scale = 800 / 484;

    // Preberi točke iz solution-path (sir je na zadnji točki)
    const pathPoints = solutionPath
        .getAttribute('points')
        .split(' ')
        .map(p => p.split(',').map(Number)); 
    // Sir (goal) na zadnji točki, treba ga centrirati 
    const [goalX, goalY] = pathPoints[pathPoints.length - 1];
    goal.style.left = ((goalX - 16) * scale) + 'px';
    goal.style.top = ((goalY - 16) * scale) + 'px';

  
    let playerX = 240;
    let playerY = 10;

  
    const offset = 8;  // za centriranje slike
    const boundingHalf = 4;  

    const moveSpeed = 1;

    let mouseRotation = 0;

    function updatePlayerPosition() {
        // upostevjaj scale
        player.style.left = ((playerX - offset) * scale) + 'px';
        player.style.top = ((playerY - offset) * scale) + 'px';
        // Obračanje miške
        player.style.transform = `rotate(${mouseRotation}deg)`;
    }
    updatePlayerPosition();

    function checkWin() {
        if (foundCheese) return;

        const playerRect = player.getBoundingClientRect();
        const goalRect = goal.getBoundingClientRect();

        if (
            playerRect.left < goalRect.right &&
            playerRect.right > goalRect.left &&
            playerRect.top < goalRect.bottom &&
            playerRect.bottom > goalRect.top
        ) {
            foundCheese = true;
            stopTimer();

            Swal.fire({
                title: 'Čestitke!',
                text: `Miška je našla sir! Porabil si ${timeElapsed} sekund.`,
                icon: 'success',
                confirmButtonText: 'Super!'
            }).then(() => {
                resetGame();
            });
        }
    }

    //prejsna tocka za risanje crte
    let prevX = null;
    let prevY = null;

    function moveAlongPath() {
        if (autoMoveIndex < pathPoints.length) {
            const [x, y] = pathPoints[autoMoveIndex];

            // narisi do tam
            if (autoMoveIndex > 0) {
                const lineEl = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                lineEl.setAttribute('x1', prevX);
                lineEl.setAttribute('y1', prevY);
                lineEl.setAttribute('x2', x);
                lineEl.setAttribute('y2', y);
                lineEl.setAttribute('stroke', 'red');
                lineEl.setAttribute('stroke-width', '2');
                mazeSvg.appendChild(lineEl);
            }
            //shrani tocko
            prevX = x;
            prevY = y;

            //premakni miško
            playerX = x;
            playerY = y;
            updatePlayerPosition();

            autoMoveIndex++;
            setTimeout(moveAlongPath, 100);
        } else {
            checkWin();
        }
    }

    autoMoveButton.addEventListener('click', () => {
        if (!gameStarted) {
            Swal.fire('Najprej klikni na "Začni igro"!');
            return;
        }
        autoMoveIndex = 0;
        // Zbriši stare rdeče črte
        const oldLines = mazeSvg.querySelectorAll('line[stroke="red"]');
        oldLines.forEach(l => l.remove());

        // Reset "prejšnja" točka
        prevX = null;
        prevY = null;

        moveAlongPath();
    });

    startGameButton.addEventListener('click', () => {
        if (gameStarted) {
            Swal.fire('Igra že teče!');
            return;
        }
        gameStarted = true;
        foundCheese = false;
        startTimer();
    });

    function resetGame() {
        foundCheese = false;
        autoMoveIndex = 0;
        gameStarted = false;
        stopTimer();

        // Postavi miško na začetek
        playerX = 240;
        playerY = 10;
        mouseRotation = 0; // da gleda meš dol
        updatePlayerPosition();

        timeElapsed = 0;
        timerValue.textContent = '0';

        // Pobriši rdeče črte
        const oldLines = mazeSvg.querySelectorAll('line[stroke="red"]');
        oldLines.forEach(l => l.remove());
    }

    resetGameButton.addEventListener('click', resetGame);

    navodilaButton.addEventListener('click', () => {
        Swal.fire({
            title: 'Navodila',
            text: '1) Klikni "Začni igro" za zagon timerja\n2) Premikaj miško s puščicami počasi ali klikni "Samodejno premikanje"\n3) Ko najdeš sir, izpiše, koliko časa si porabil\n4) S "Resetiraj" začneš znova',
            icon: 'info',
            confirmButtonText: 'Zapri'
        });
    });

    //zidi labirinta
    const mazeLines = mazeSvg.querySelectorAll('line');
    function canMoveTo(nx, ny) {
        const left = nx - boundingHalf;
        const right = nx + boundingHalf;
        const top = ny - boundingHalf;
        const bottom = ny + boundingHalf;

        for (const line of mazeLines) {
            const x1 = parseInt(line.getAttribute('x1'), 10);
            const y1 = parseInt(line.getAttribute('y1'), 10);
            const x2 = parseInt(line.getAttribute('x2'), 10);
            const y2 = parseInt(line.getAttribute('y2'), 10);

            const pad = 1;
            const lineLeft = Math.min(x1, x2) - pad;
            const lineRight = Math.max(x1, x2) + pad;
            const lineTop = Math.min(y1, y2) - pad;
            const lineBottom = Math.max(y1, y2) + pad;

            const horizOverlap = (left < lineRight && right > lineLeft);
            const vertOverlap = (top < lineBottom && bottom > lineTop);
            if (horizOverlap && vertOverlap) {
                return false;
            }
        }
        return true;
    }

    let moveUp = false, moveDown = false, moveLeft = false, moveRight = false;
//premik miši
    document.addEventListener('keydown', (e) => {
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
            case 'ArrowUp': moveUp = false; break;
            case 'ArrowDown': moveDown = false; break;
            case 'ArrowLeft': moveLeft = false; break;
            case 'ArrowRight': moveRight = false; break;
        }
    });

    // Vsak frame naredi do konca!!
    function movePlayer() {
        if (!gameStarted) return;

        let newX = playerX;
        let newY = playerY;

        if (moveUp) newY -= moveSpeed;
        if (moveDown) newY += moveSpeed;
        if (moveLeft) newX -= moveSpeed;
        if (moveRight) newX += moveSpeed;

        // omejitev
        if (newX < boundingHalf) newX = boundingHalf;
        if (newX > 484 - boundingHalf) newX = 484 - boundingHalf;
        if (newY < boundingHalf) newY = boundingHalf;
        if (newY > 484 - boundingHalf) newY = 484 - boundingHalf;

        if (canMoveTo(newX, newY)) {
            playerX = newX;
            playerY = newY;
            updatePlayerPosition();
            checkWin();
        }
    }
//glavni loop
    function gameLoop() {
        movePlayer();
        requestAnimationFrame(gameLoop);
    }
    gameLoop();
});

/*window.addEventListener('wheel', function (e) {
    if (e.ctrlKey) {
        e.preventDefault();
    }
}, { passive: false });

// Preprečimo Ctrl + + / Ctrl + - / Ctrl + 0  ... ipd.
window.addEventListener('keydown', function (e) {
    if (e.ctrlKey) {
        if (
            e.key === '+' ||
            e.key === '-' ||
            e.key === '0' ||
            e.key === '=' ||
            e.key === 'NumpadAdd' ||
            e.key === 'NumpadSubtract'
        ) {
            e.preventDefault();
        }
    }
});*/
