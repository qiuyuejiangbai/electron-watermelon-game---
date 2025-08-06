document.addEventListener('DOMContentLoaded', () => {
    // Engine Aliases
    const { Engine, Render, Runner, World, Bodies, Body, Events, Common } = Matter;

    // DOM Elements
    const canvas = document.getElementById('game-canvas');
    const scoreElement = document.getElementById('score');
    const restartButton = document.getElementById('restart-button');
    const gameOverScreen = document.getElementById('game-over-screen');
    const warningMessage = document.getElementById('warning-message');

    // Game Constants
    const WIDTH = 400;
    const HEIGHT = 600;
    const TOP_LINE_Y = 100;

    // Game State
    let engine, render, runner;
    let currentFruit = null;
    let score = 0;
    let canDrop = true;
    let gameEnded = false;
    let gameOverTimer = null; // Timer for the 3-second countdown
    let isWarningActive = false;

    function init() {
        // Engine and Renderer
        engine = Engine.create();
        render = Render.create({
            canvas: canvas,
            engine: engine,
            options: {
                width: WIDTH,
                height: HEIGHT,
                wireframes: false,
                background: '#faf8ef'
            }
        });
        runner = Runner.create();

        // Reset Game State
        score = 0;
        canDrop = true;
        gameEnded = false;
        isWarningActive = false;
        if (gameOverTimer) clearTimeout(gameOverTimer);
        updateScore(0);
        gameOverScreen.style.display = 'none';
        warningMessage.style.display = 'none';
        World.clear(engine.world);
        Engine.clear(engine);

        // Walls and Ground
        const ground = Bodies.rectangle(WIDTH / 2, HEIGHT - 20, WIDTH, 40, { isStatic: true, render: { fillStyle: '#e0e0e0' } });
        const leftWall = Bodies.rectangle(0, HEIGHT / 2, 20, HEIGHT, { isStatic: true, render: { fillStyle: '#e0e0e0' } });
        const rightWall = Bodies.rectangle(WIDTH, HEIGHT / 2, 20, HEIGHT, { isStatic: true, render: { fillStyle: '#e0e0e0' } });
        World.add(engine.world, [ground, leftWall, rightWall]);

        // Top line indicator
        const topLine = Bodies.rectangle(WIDTH / 2, TOP_LINE_Y, WIDTH, 2, { isStatic: true, isSensor: true, render: { fillStyle: '#ff0000' } });
        World.add(engine.world, topLine);

        // Initial fruit
        spawnNextFruit();

        // Run the simulation
        Render.run(render);
        Runner.run(runner, engine);

        // Event Handlers
        addEventListeners();
    }

    function spawnNextFruit() {
        if (gameEnded) return;
        const level = Math.floor(Math.random() * 4);
        const fruitData = FRUITS.find(f => f.level === level);
        currentFruit = createFruit(WIDTH / 2, 50, fruitData);
        Body.setStatic(currentFruit, true);
        canDrop = true;
    }

    function createFruit(x, y, fruitData) {
        const fruit = Bodies.circle(x, y, fruitData.radius, {
            label: 'fruit',
            restitution: 0.3,
            friction: 0.2,
            render: {
                fillStyle: fruitData.color,
                strokeStyle: '#555',
                lineWidth: 2
            }
        });
        fruit.fruitData = fruitData;
        World.add(engine.world, fruit);
        return fruit;
    }

    function updateScore(points) {
        score += points;
        scoreElement.innerText = score;
    }

    function gameOver() {
        gameEnded = true;
        warningMessage.style.display = 'none';
        gameOverScreen.style.display = 'flex';
        Runner.stop(runner);
        Render.stop(render);
    }

    function addEventListeners() {
        // Mouse Controls
        canvas.addEventListener('mousemove', (event) => {
            if (currentFruit && !gameEnded) {
                const rect = canvas.getBoundingClientRect();
                const mouseX = event.clientX - rect.left;
                const clampedX = Common.clamp(mouseX, currentFruit.fruitData.radius, WIDTH - currentFruit.fruitData.radius);
                Body.setPosition(currentFruit, { x: clampedX, y: 50 });
            }
        });

        canvas.addEventListener('click', () => {
            if (currentFruit && canDrop && !gameEnded) {
                canDrop = false;
                Body.setStatic(currentFruit, false);
                currentFruit = null;
                setTimeout(spawnNextFruit, 800);
            }
        });

        // Collision Detection
        Events.on(engine, 'collisionStart', (event) => {
            const pairs = event.pairs;
            pairs.forEach(pair => {
                const { bodyA, bodyB } = pair;
                if (bodyA.label === 'fruit' && bodyB.label === 'fruit' && bodyA.fruitData.level === bodyB.fruitData.level) {
                    const nextLevel = bodyA.fruitData.level + 1;
                    if (nextLevel < FRUITS.length) {
                        World.remove(engine.world, [bodyA, bodyB]);
                        const nextFruitData = FRUITS.find(f => f.level === nextLevel);
                        createFruit(
                            (bodyA.position.x + bodyB.position.x) / 2,
                            (bodyA.position.y + bodyB.position.y) / 2,
                            nextFruitData
                        );
                        updateScore(nextFruitData.level);
                    }
                }
            });
        });

        // Game Over Check with 3-second warning
        Events.on(engine, 'afterUpdate', () => {
            if (gameEnded) return;

            const fruits = World.allBodies(engine.world).filter(b => b.label === 'fruit' && !b.isStatic);
            let isFruitOverLine = false;

            for (const fruit of fruits) {
                // Check if the top of the fruit is above the line
                if ((fruit.position.y - fruit.fruitData.radius) < TOP_LINE_Y) {
                    isFruitOverLine = true;
                    break;
                }
            }

            if (isFruitOverLine) {
                if (!isWarningActive) {
                    isWarningActive = true;
                    warningMessage.style.display = 'block';
                    gameOverTimer = setTimeout(() => {
                        gameOver();
                    }, 3000);
                }
            } else {
                if (isWarningActive) {
                    isWarningActive = false;
                    warningMessage.style.display = 'none';
                    clearTimeout(gameOverTimer);
                    gameOverTimer = null;
                }
            }
        });

        // Restart Button
        restartButton.addEventListener('click', init);
    }

    // Initial game start
    init();
});