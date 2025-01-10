/*************************************************
 *  FUNKCIJA ZA PRILAGAJANJE #game-wrapper
 *************************************************/
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
  
    // Izračun “scale” glede na širino ali višino
    const scale = Math.min(
      winW / baseWidth,
      availableH / baseHeight
    );
  
    // Koliko bo velik #game-wrapper po skaliranju
    const scaledW = baseWidth * scale;
    const scaledH = baseHeight * scale;
  
    const wrapper = document.getElementById('game-wrapper');
    // Nastavimo transform (scale)
    wrapper.style.transform = `scale(${scale})`;
    wrapper.style.transformOrigin = "top left";

    // Izračun centriranja (levo / top)
    const offsetX = (winW - scaledW) / 2;
    const offsetY = marginTopBottom + (availableH - scaledH) / 2;
  
    wrapper.style.left = offsetX + 'px';
    wrapper.style.top  = offsetY + 'px';
}

/*************************************************
 *  Naloži “scaleToFit” ob load in resize
 *************************************************/
window.addEventListener('load', scaleToFit);
window.addEventListener('resize', scaleToFit);

/*************************************************
 *  GLAVNI “DOM CONTENT LOADED” DOGODEK
 *************************************************/
document.addEventListener('DOMContentLoaded', () => {
    // Že ob DOMContentLoaded še enkrat prilagodimo
    scaleToFit();

    const mazeSvg        = document.getElementById('maze-svg');
    const solutionPath   = document.getElementById('solution-path');
    const autoMoveButton = document.getElementById('auto-move');
    const resetGameButton= document.getElementById('reset-game');
    const navodilaButton = document.getElementById('navodila');
    const startGameButton= document.getElementById('start-game');
    const player         = document.getElementById('player');
    const goal           = document.getElementById('goal');
    const timerValue     = document.getElementById('timer-value');

    let timeElapsed    = 0;
    let timerInterval  = null;
    let gameStarted    = false;
    let foundCheese    = false;

    // Razmerje = (800 / 484), ker je <svg> velik 484×484 v pogledu,
    //   a dejansko se prikazuje na 800×800 (v CSS).
    const scale        = 800 / 484;

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

    // Sir (goal) je na zadnji točki
    const [goalX, goalY] = pathPoints[pathPoints.length - 1];
    goal.style.left = ((goalX - 16) * scale) + 'px';
    goal.style.top  = ((goalY - 16) * scale) + 'px';

    /*************************************************
     *  GLOBALNE SPREMENLJIVKE ZA MIŠKO
     *************************************************/
    let playerX = 240;
    let playerY = 10;
    // “Obračanje” - 0 = dol, 90 = levo, 180 = gor, 270 = desno
    let mouseRotation = 0;
    const offset       = 8;   // za centriranje slike miške
    const boundingHalf = 4;  
    // Za ročni “move” s puščicami
    const moveSpeed    = 2;   

    /*************************************************
     *  FUNKCIJA ZA POSODOBITEV POLOŽAJA V DOM
     *************************************************/
    function updatePlayerPosition() {
        player.style.left = ((playerX - offset) * scale) + 'px';
        player.style.top  = ((playerY - offset) * scale) + 'px';
        // Obračanje miške
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
            playerRect.left   < goalRect.right  &&
            playerRect.right  > goalRect.left   &&
            playerRect.top    < goalRect.bottom &&
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
     *     Riše mini-črte sproti in obrne miško v 4 smeri
     *************************************************/
    function smoothMoveAlongPath(speedPxPerSec = 80) {
        // speedPxPerSec = hitrost v piksl. na sekundo (npr. 80)

        // 1) Pobrišemo stare rdeče črte
        const oldLines = mazeSvg.querySelectorAll('line[stroke="red"]');
        oldLines.forEach(l => l.remove());

        // 2) Ponastavimo na začetek
        if (!pathPoints || pathPoints.length < 2) return;
        let currentSegment = 0;
        let startTime = null;

        // Miško postavi na prvo točko
        const [startX, startY] = pathPoints[0];
        playerX = startX;
        playerY = startY;
        updatePlayerPosition();
        
        // “Zadnje znane koordinate” za risanje
        let lastX = startX;
        let lastY = startY;

        // -- Spremenljivke za en segment (razdalja, trajanje) --
        let segmentDuration = 0;
        let x1=0, y1=0, x2=0, y2=0; 

        // Pripravimo prvi segment
        if (pathPoints.length >= 2) {
            [x1, y1] = pathPoints[0];
            [x2, y2] = pathPoints[1];
            const dist = getDistance(x1, y1, x2, y2);
            segmentDuration = (dist / speedPxPerSec) * 1000; 
        }

        // Glavna animacijska funkcija
        function animate(timestamp) {
            if (!gameStarted) return; // Če je igra resetirana vmes

            // Če prvič vstopimo v ta segment -> startTime
            if (!startTime) {
                startTime = timestamp;
            }
            const elapsed = timestamp - startTime;
            let progress = elapsed / segmentDuration;
            if (progress > 1) progress = 1;

            // Interpolacija
            const newX = x1 + (x2 - x1) * progress;
            const newY = y1 + (y2 - y1) * progress;

            // Risanje mini-črte od prejšnje do zdajšnje pozicije
            drawRedLine(lastX, lastY, newX, newY);

            // Posodobimo miško
            playerX = newX;
            playerY = newY;

            // Miška se obrne (4 smeri)
            const dx = newX - lastX;
            const dy = newY - lastY;
            if (Math.abs(dx) > Math.abs(dy)) {
                mouseRotation = (dx > 0) ? 270 : 90;
            } else {
                mouseRotation = (dy > 0) ? 0 : 180;
            }

            updatePlayerPosition();

            // Za naslednji frame
            lastX = newX;
            lastY = newY;

            if (progress < 1) {
                // Še animiramo ta segment
                requestAnimationFrame(animate);
            } else {
                // Segment zaključen
                currentSegment++;
                startTime = null; 

                // Ali je še naslednji segment?
                if (currentSegment < pathPoints.length - 1) {
                    // Nastavimo nove parametre segmenta
                    x1 = pathPoints[currentSegment][0];
                    y1 = pathPoints[currentSegment][1];
                    x2 = pathPoints[currentSegment + 1][0];
                    y2 = pathPoints[currentSegment + 1][1];
                    const dist = getDistance(x1, y1, x2, y2);
                    segmentDuration = (dist / speedPxPerSec) * 1000;
                    requestAnimationFrame(animate);
                } else {
                    // Zadnji segment končan
                    checkWin();
                }
            }
        }

        requestAnimationFrame(animate);
    }

    /*************************************************
     *  GUMBI / EVENT LISTENERS
     *************************************************/
    autoMoveButton.addEventListener('click', () => {
        if (!gameStarted) {
            Swal.fire('Najprej klikni na "Začni igro"!');
            return;
        }
        smoothMoveAlongPath(80); // 80 px/s
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
        gameStarted = false;
        stopTimer();

        // Postavi miško na začetek
        playerX = 240;
        playerY = 10;
        mouseRotation = 0;
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
            text: '1) Klikni "Začni igro" za zagon timerja\n2) Premikaj miško s puščicami ali klikni "Samodejno premikanje"\n3) Ko najdeš sir, izpiše, koliko časa si porabil\n4) S "Resetiraj" začneš znova',
            icon: 'info',
            confirmButtonText: 'Zapri'
        });
    });

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
                return false; // dotaknili bi se stene
            }
        }
        return true;
    }

    /*************************************************
     *  TIPKE ZA GIBANJE MIŠKE (PUŠČICE)
     *************************************************/
    let moveUp=false, moveDown=false, moveLeft=false, moveRight=false;

    document.addEventListener('keydown', (e) => {
        switch (e.key) {
            case 'ArrowUp':
                moveUp = true;  mouseRotation = 180;
                break;
            case 'ArrowDown':
                moveDown = true; mouseRotation = 0;
                break;
            case 'ArrowLeft':
                moveLeft = true; mouseRotation = 90;
                break;
            case 'ArrowRight':
                moveRight = true; mouseRotation = 270;
                break;
        }
    });
    document.addEventListener('keyup', (e) => {
        switch (e.key) {
            case 'ArrowUp':    moveUp=false;    break;
            case 'ArrowDown':  moveDown=false;  break;
            case 'ArrowLeft':  moveLeft=false;  break;
            case 'ArrowRight': moveRight=false; break;
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

        // Omejitve okvirja
        if (newX < boundingHalf)       newX = boundingHalf;
        if (newX > 484 - boundingHalf) newX = 484 - boundingHalf;
        if (newY < boundingHalf)       newY = boundingHalf;
        if (newY > 484 - boundingHalf) newY = 484 - boundingHalf;

        // Preveri, ali ni stene
        if (canMoveTo(newX, newY)) {
            playerX = newX;
            playerY = newY;
            updatePlayerPosition();
            checkWin();
        }
    }

    /*************************************************
     *  GLAVNI LOOP (da se ročno gibanje ponavlja)
     *************************************************/
    function gameLoop() {
        movePlayer();
        requestAnimationFrame(gameLoop);
    }
    gameLoop();
});
