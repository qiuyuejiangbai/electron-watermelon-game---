// 当DOM内容加载完成后执行游戏初始化
document.addEventListener("DOMContentLoaded", () => {
  // Matter.js 引擎别名 - 解构导入物理引擎的核心模块
  const { Engine, Render, Runner, World, Bodies, Body, Events, Common } =
    Matter;

  // DOM 元素获取 - 获取页面中的关键元素
  const canvas = document.getElementById("game-canvas"); // 游戏画布
  const scoreElement = document.getElementById("score"); // 分数显示元素
  const restartButton = document.getElementById("restart-button"); // 重新开始按钮
  const gameOverScreen = document.getElementById("game-over-screen"); // 游戏结束屏幕
  const warningMessage = document.getElementById("warning-message"); // 警告消息

  // 游戏常量定义
  const WIDTH = 400; // 游戏画布宽度
  const HEIGHT = 600; // 游戏画布高度
  const TOP_LINE_Y = 100; // 顶部警戒线Y坐标
  const STABLE_SPEED_THRESHOLD = 0.5; // 水果稳定速度阈值，低于此速度才进行红线检测

  // 游戏状态变量
  let engine, render, runner; // Matter.js 核心对象
  let currentFruit = null; // 当前操控的水果对象
  let score = 0; // 游戏分数
  let canDrop = true; // 是否可以投放水果
  let gameEnded = false; // 游戏是否结束
  let gameOverTimer = null; // 游戏结束3秒倒计时定时器
  let isWarningActive = false; // 警告状态是否激活

  /**
   * 游戏初始化函数
   * 创建物理引擎、渲染器、边界墙体，重置游戏状态
   */
  function init() {
    // 创建物理引擎实例
    engine = Engine.create();

    // 创建渲染器，配置画布和显示选项
    render = Render.create({
      canvas: canvas,
      engine: engine,
      options: {
        width: WIDTH,
        height: HEIGHT,
        wireframes: false, // 关闭线框模式，显示填充图形
        background: "#faf8ef", // 设置背景颜色
      },
    });

    // 创建运行器来控制物理引擎的更新循环
    runner = Runner.create();

    // 重置游戏状态到初始值
    score = 0;
    canDrop = true;
    gameEnded = false;
    isWarningActive = false;

    // 清除之前的游戏结束定时器
    if (gameOverTimer) clearTimeout(gameOverTimer);

    // 更新UI显示
    updateScore(0);
    gameOverScreen.style.display = "none";
    warningMessage.style.display = "none";

    // 清空物理世界中的所有物体
    World.clear(engine.world);
    Engine.clear(engine);

    // 创建游戏边界 - 地面和左右两堵墙
    const ground = Bodies.rectangle(WIDTH / 2, HEIGHT - 20, WIDTH, 40, {
      isStatic: true, // 静态物体，不受重力影响
      render: { fillStyle: "#e0e0e0" }, // 设置填充颜色
    });

    const leftWall = Bodies.rectangle(0, HEIGHT / 2, 20, HEIGHT, {
      isStatic: true,
      render: { fillStyle: "#e0e0e0" },
    });

    const rightWall = Bodies.rectangle(WIDTH, HEIGHT / 2, 20, HEIGHT, {
      isStatic: true,
      render: { fillStyle: "#e0e0e0" },
    });

    // 将边界添加到物理世界
    World.add(engine.world, [ground, leftWall, rightWall]);

    // 创建顶部警戒线（红色）- 用于检测游戏结束条件
    const topLine = Bodies.rectangle(WIDTH / 2, TOP_LINE_Y, WIDTH, 2, {
      isStatic: true, // 静态物体
      isSensor: true, // 传感器，不产生物理碰撞
      render: { fillStyle: "#ff0000" }, // 红色警戒线
    });
    World.add(engine.world, topLine);

    // 生成第一个水果
    spawnNextFruit();

    // 启动渲染和物理引擎
    Render.run(render);
    Runner.run(runner, engine);

    // 添加事件监听器
    addEventListeners();
  }

  /**
   * 生成下一个水果
   * 随机选择水果类型并创建在画布顶部中央
   */
  function spawnNextFruit() {
    if (gameEnded) return; // 游戏结束时不再生成水果

    // 随机选择水果等级（0-3级）
    const level = Math.floor(Math.random() * 4);

    // 根据等级找到对应的水果数据
    const fruitData = FRUITS.find((f) => f.level === level);

    // 在画布顶部中央创建水果
    currentFruit = createFruit(WIDTH / 2, 50, fruitData);

    // 设置为静态物体，等待用户操控
    Body.setStatic(currentFruit, true);
    canDrop = true;
  }

  /**
   * 创建水果物体
   * @param {number} x - X坐标
   * @param {number} y - Y坐标
   * @param {Object} fruitData - 水果数据（包含半径、颜色、等级等信息）
   * @returns {Object} 创建的水果物体
   */
  function createFruit(x, y, fruitData) {
    // 创建圆形物体作为水果
    const fruit = Bodies.circle(x, y, fruitData.radius, {
      label: "fruit", // 标签，用于碰撞检测
      restitution: 0.3, // 弹性系数
      friction: 0.2, // 摩擦系数
      render: {
        fillStyle: fruitData.color, // 水果颜色
        strokeStyle: "#555", // 边框颜色
        lineWidth: 2, // 边框宽度
      },
    });

    // 将水果数据附加到物体上，方便后续使用
    fruit.fruitData = fruitData;

    // 将水果添加到物理世界
    World.add(engine.world, fruit);
    return fruit;
  }

  /**
   * 更新分数显示
   * @param {number} points - 要增加的分数
   */
  function updateScore(points) {
    score += points;
    scoreElement.innerText = score;
  }

  /**
   * 游戏结束处理
   * 停止游戏运行，显示游戏结束界面
   */
  function gameOver() {
    gameEnded = true;
    warningMessage.style.display = "none"; // 隐藏警告消息
    gameOverScreen.style.display = "flex"; // 显示游戏结束屏幕
    Runner.stop(runner); // 停止物理引擎运行
    Render.stop(render); // 停止渲染
  }

  /**
   * 添加各种事件监听器
   * 包括鼠标控制、碰撞检测、游戏结束检测等
   */
  function addEventListeners() {
    // 鼠标移动控制 - 控制当前水果的水平位置
    canvas.addEventListener("mousemove", (event) => {
      if (currentFruit && !gameEnded) {
        // 获取画布相对位置
        const rect = canvas.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;

        // 限制水果位置在画布边界内（考虑水果半径）
        const clampedX = Common.clamp(
          mouseX,
          currentFruit.fruitData.radius,
          WIDTH - currentFruit.fruitData.radius
        );

        // 更新水果位置
        Body.setPosition(currentFruit, { x: clampedX, y: 50 });
      }
    });

    // 鼠标点击控制 - 投放水果
    canvas.addEventListener("click", () => {
      if (currentFruit && canDrop && !gameEnded) {
        canDrop = false; // 防止重复投放
        const droppedFruit = currentFruit; // 临时保存对当前水果的引用
        Body.setStatic(droppedFruit, false); // 取消静态状态，使水果受重力影响

        // 给刚下落的水果一个短暂的“豁免”状态，防止其因初始弹跳立即触发游戏结束
        // 这个 isImmune 属性会在 'afterUpdate' 事件中被检查
        droppedFruit.isImmune = true;
        setTimeout(() => {
          // 1.5秒后取消豁免状态，使其恢复正常的红线检测
          if (droppedFruit) {
            droppedFruit.isImmune = false;
          }
        }, 1500);

        currentFruit = null; // 清空当前水果引用
        setTimeout(spawnNextFruit, 800); // 延迟生成下一个水果
      }
    });

    // 碰撞检测 - 处理相同水果的合并
    Events.on(engine, "collisionStart", (event) => {
      const pairs = event.pairs;

      pairs.forEach((pair) => {
        const { bodyA, bodyB } = pair;

        // 检查是否为两个相同等级的水果碰撞
        if (
          bodyA.label === "fruit" &&
          bodyB.label === "fruit" &&
          bodyA.fruitData.level === bodyB.fruitData.level
        ) {
          const nextLevel = bodyA.fruitData.level + 1;

          // 如果存在下一级水果，进行合并
          if (nextLevel < FRUITS.length) {
            // 移除原来的两个水果
            World.remove(engine.world, [bodyA, bodyB]);

            // 创建下一级水果在两个水果的中间位置
            const nextFruitData = FRUITS.find((f) => f.level === nextLevel);
            createFruit(
              (bodyA.position.x + bodyB.position.x) / 2,
              (bodyA.position.y + bodyB.position.y) / 2,
              nextFruitData
            );

            // 增加分数（分数等于新水果的等级）
            updateScore(nextFruitData.level);
          }
        }
      });
    });

    // 游戏结束检测 - 带3秒警告的检测机制
    Events.on(engine, "afterUpdate", () => {
      if (gameEnded) return;

      // 获取所有非静态的水果物体
      const fruits = Matter.Composite.allBodies(engine.world).filter(
        (b) => b.label === "fruit" && !b.isStatic
      );

      // 使用 .some() 更简洁地检查是否有水果超过警戒线
      const isFruitOverLine = fruits.some(
        (fruit) =>
          !fruit.isImmune && // 检查水果是否处于“豁免”状态
          fruit.position.y - fruit.fruitData.radius < TOP_LINE_Y &&
          fruit.speed < STABLE_SPEED_THRESHOLD // 检查水果速度是否低于阈值
      );

      // 处理警告状态和游戏结束逻辑
      if (isFruitOverLine) {
        console.log("Fruit is over line!");
        fruits.forEach((fruit) => {
          console.log(
            `Fruit Y: ${fruit.position.y}, Radius: ${fruit.fruitData.radius}, TOP_LINE_Y: ${TOP_LINE_Y}`
          );
        });
        console.log(`isWarningActive: ${isWarningActive}`);

        if (!isWarningActive) {
          isWarningActive = true;
          warningMessage.style.display = "block";

          // Clear any existing timer to avoid multiple timers running
          if (gameOverTimer) {
            clearTimeout(gameOverTimer);
          }

          gameOverTimer = setTimeout(() => {
            gameOver();
          }, 3000);
        }
      } else {
        if (isWarningActive) {
          console.log("No fruit over line, deactivating warning.");

          isWarningActive = false;
          warningMessage.style.display = "none";

          // Only clear the timer if it exists
          if (gameOverTimer) {
            clearTimeout(gameOverTimer);
          }

          gameOverTimer = null;
        }
      }
    });

    // 重新开始按钮事件监听
    restartButton.addEventListener("click", init);
  }

  // 游戏初始启动
  init();
});
