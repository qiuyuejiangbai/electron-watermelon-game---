// 当DOM内容加载完成后执行游戏初始化
document.addEventListener("DOMContentLoaded", () => {
  // Matter.js 引擎别名 - 解构导入物理引擎的核心模块
  const { Engine, Render, Runner, World, Bodies, Body, Events, Common } =
    Matter;

  // DOM 元素获取 - 获取页面中的关键元素
  const canvas = document.getElementById("game-canvas"); // 游戏画布
  const stageEl = document.getElementById("stage"); // 舞台容器（固定逻辑尺寸）
  const containerEl = document.getElementById("game-container"); // 外层容器（全屏）
  const scoreElement = document.getElementById("score"); // 分数显示元素
  const restartButton = document.getElementById("restart-button"); // 顶部重来按钮
  const restartButtonDialog = document.getElementById("restart-button-dialog"); // 对话框内重来按钮
  const gameOverScreen = document.getElementById("game-over-screen"); // 游戏结束屏幕
  const warningMessage = document.getElementById("warning-message"); // 警告消息

  // 游戏常量定义
  const WIDTH = 400; // 舞台逻辑宽度
  const HEIGHT = 600; // 舞台逻辑高度
  const TOP_LINE_Y = 120; // 顶部警戒线Y坐标
  const WALL_THICKNESS = 20; // 墙体厚度
  const SIDE_INSET = 30; // 左右向内收缩，以使“瓶”更小
  const BOTTOM_INSET = 30; // 底部向上收缩
  const STABLE_SPEED_THRESHOLD = 0.5; // 水果稳定速度阈值，低于此速度才进行红线检测

  // 游戏状态变量
  let engine, render, runner; // Matter.js 核心对象
  let currentFruit = null; // 当前操控的水果对象
  let score = 0; // 游戏分数
  let canDrop = true; // 是否可以投放水果
  let gameEnded = false; // 游戏是否结束
  let gameOverTimer = null; // 游戏结束3秒倒计时定时器
  let isWarningActive = false; // 警告状态是否激活

  // 贴图信息缓存 { [texturePath]: { pixelWidth, pixelHeight } }
  const textureInfoByPath = {};

  function preloadTextures() {
    return new Promise((resolve) => {
      // 收集唯一贴图路径
      const uniqueTextures = Array.from(
        new Set((FRUITS || []).map((f) => f.texture).filter(Boolean))
      );
      if (uniqueTextures.length === 0) {
        resolve();
        return;
      }

      let loadedCount = 0;
      const total = uniqueTextures.length;

      const done = () => {
        loadedCount += 1;
        if (loadedCount === total) resolve();
      };

      uniqueTextures.forEach((src) => {
        const img = new Image();
        img.onload = () => {
          const pixelWidth = img.naturalWidth || img.width || 100;
          const pixelHeight = img.naturalHeight || img.height || 100;
          let circleDiameterPx = Math.min(pixelWidth, pixelHeight);

          try {
            // 计算有效圆直径：扫描非透明区域的边界框
            const canvas = document.createElement("canvas");
            canvas.width = pixelWidth;
            canvas.height = pixelHeight;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0);
            const { data } = ctx.getImageData(0, 0, pixelWidth, pixelHeight);
            let minX = pixelWidth,
              minY = pixelHeight,
              maxX = -1,
              maxY = -1;
            const alphaThreshold = 0; // 0-255，放宽阈值，包含抗锯齿边缘以避免缝隙
            for (let y = 0; y < pixelHeight; y += 1) {
              for (let x = 0; x < pixelWidth; x += 1) {
                const idx = (y * pixelWidth + x) * 4 + 3;
                const a = data[idx];
                if (a > alphaThreshold) {
                  if (x < minX) minX = x;
                  if (y < minY) minY = y;
                  if (x > maxX) maxX = x;
                  if (y > maxY) maxY = y;
                }
              }
            }
            if (maxX >= 0 && maxY >= 0) {
              const effW = maxX - minX + 1;
              const effH = maxY - minY + 1;
              circleDiameterPx = Math.min(effW, effH);
            }
          } catch (e) {
            // 忽略扫描异常，退回使用整图宽度
          }

          textureInfoByPath[src] = {
            pixelWidth,
            pixelHeight,
            circleDiameterPx,
          };
          done();
        };
        img.onerror = () => {
          const fallback = 100;
          textureInfoByPath[src] = {
            pixelWidth: fallback,
            pixelHeight: fallback,
            circleDiameterPx: fallback,
          };
          done();
        };
        img.src = src;
      });
    });
  }

  // 计算在当前布局与缩放下，水果悬停/生成时的安全Y坐标（舞台坐标系）
  // 约束：
  // 1) 水果顶部不被 HUD 遮挡 => centerY - r >= hudBottom + HUD_MARGIN
  // 2) 水果底部高于红线（不跨越红线）=> centerY + r <= TOP_LINE_Y - RED_MARGIN
  function computeSafeHoverY(fruitRadius) {
    try {
      const ui = document.getElementById("ui-container");
      if (!stageEl) return Math.max(50, fruitRadius + 10);
      const stageRect = stageEl.getBoundingClientRect();
      const uiRect = ui ? ui.getBoundingClientRect() : null;
      // 舞台缩放比例：屏幕像素 -> 舞台坐标
      const scale = stageRect.height / HEIGHT;
      // HUD 底部到舞台顶部的像素距离
      let hudBottomToStageTopPx = uiRect
        ? uiRect.bottom - stageRect.top
        : -Infinity;
      if (!isFinite(hudBottomToStageTopPx)) hudBottomToStageTopPx = -Infinity;
      // HUD 底部（舞台坐标）
      const hudBottomStageY =
        hudBottomToStageTopPx > 0 ? hudBottomToStageTopPx / scale : 0;

      const HUD_MARGIN = 10; // 与 HUD 保持的最小视觉间隙
      const RED_MARGIN = 6; // 与红线保持的最小视觉间隙

      // 下界：不被 HUD 遮挡所需的最小 centerY
      const minCenter = Math.max(50, hudBottomStageY + fruitRadius + HUD_MARGIN);
      // 上界：底部高于红线所需的最大 centerY
      const maxCenter = TOP_LINE_Y - RED_MARGIN - fruitRadius;

      if (minCenter <= maxCenter) {
        // 在可行范围内，取中间值，避免紧贴任一边界
        return (minCenter + maxCenter) / 2;
      }
      // 若不可行（半径过大等），优先保证不遮挡 HUD
      return minCenter;
    } catch (_) {
      return Math.max(50, fruitRadius + 10);
    }
  }

  /**
   * 游戏初始化函数
   * 创建物理引擎、渲染器、边界墙体，重置游戏状态
   */
  async function init() {
    // 预加载所有水果贴图尺寸，以便按半径缩放
    await preloadTextures();
    // 创建物理引擎实例
    engine = Engine.create();

    // 创建渲染器，配置画布和显示选项
    // 背景交由外层容器处理，这里透明
    const BG_CSS = "transparent";

    render = Render.create({
      canvas: canvas,
      engine: engine,
      options: {
        width: WIDTH,
        height: HEIGHT,
        wireframes: false, // 关闭线框模式，显示填充图形
        background: BG_CSS, // 使用自定义背景图（不平铺，等比裁剪填满）
      },
    });

    // 适配高分屏：按设备像素比渲染，避免模糊
    try {
      Render.setPixelRatio(render, "auto");
    } catch (e) {
      // 兼容旧版本：回退到使用 window.devicePixelRatio
      if (typeof window !== "undefined" && window.devicePixelRatio) {
        Render.setPixelRatio(render, window.devicePixelRatio);
      }
    }

    // 提升贴图缩放质量
    if (render && render.context) {
      render.context.imageSmoothingEnabled = true;
      // @ts-ignore 兼容旧浏览器/运行时
      render.context.imageSmoothingQuality = "high";
    }

    // 显式设置背景为透明，兼容不同版本
    try {
      if (
        typeof Matter !== "undefined" &&
        Matter.Render &&
        Matter.Render.setBackground
      ) {
        Matter.Render.setBackground(render, BG_CSS);
      } else {
        // 回退：直接设置选项（部分版本也会生效）
        render.options.background = BG_CSS;
        // 背景交由 CSS 处理
      }
    } catch (_) {
      render.options.background = BG_CSS;
      // 背景交由 CSS 处理
    }

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
    const innerWidth = WIDTH - 2 * (SIDE_INSET + WALL_THICKNESS);
    const ground = Bodies.rectangle(
      WIDTH / 2,
      HEIGHT - (BOTTOM_INSET + WALL_THICKNESS),
      innerWidth,
      WALL_THICKNESS * 2,
      {
        isStatic: true, // 静态物体，不受重力影响
        render: {
          fillStyle: "#d9d9d9",
          strokeStyle: "#b5b5b5",
          lineWidth: 2,
        },
      }
    );

    // 将墙体向内收缩，缩小“瓶”宽度
    const leftWall = Bodies.rectangle(
      SIDE_INSET + WALL_THICKNESS / 2,
      HEIGHT / 2 - BOTTOM_INSET / 2,
      WALL_THICKNESS,
      HEIGHT - BOTTOM_INSET,
      {
        isStatic: true,
        render: {
          fillStyle: "#dedede",
          strokeStyle: "#b0b0b0",
          lineWidth: 2,
        },
      }
    );

    const rightWall = Bodies.rectangle(
      WIDTH - (SIDE_INSET + WALL_THICKNESS / 2),
      HEIGHT / 2 - BOTTOM_INSET / 2,
      WALL_THICKNESS,
      HEIGHT - BOTTOM_INSET,
      {
        isStatic: true,
        render: {
          fillStyle: "#dedede",
          strokeStyle: "#b0b0b0",
          lineWidth: 2,
        },
      }
    );

    // 将边界添加到物理世界
    World.add(engine.world, [ground, leftWall, rightWall]);

    // 创建顶部警戒线（红色）- 用于检测游戏结束条件
    const topLine = Bodies.rectangle(WIDTH / 2, TOP_LINE_Y, innerWidth, 2, {
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

    // 初次适配舞台缩放
    requestAnimationFrame(resizeStageToFit);
  }

  // 自适应缩放：让 400x600 舞台按比例适配容器，避免变形
  function resizeStageToFit() {
    if (!containerEl || !stageEl) return;
    const containerWidth = containerEl.clientWidth || window.innerWidth;
    const containerHeight = containerEl.clientHeight || window.innerHeight;
    const scaleX = containerWidth / 400;
    const scaleY = containerHeight / 600;
    const scale = Math.min(scaleX, scaleY); // contain：不裁切完整显示
    // 以舞台中心为缩放中心，避免偏移
    stageEl.style.transformOrigin = "center center";
    stageEl.style.transform = `translate(-50%, -50%) scale(${scale})`;
  }

  /**
   * 生成下一个水果
   * 随机选择水果类型并创建在画布顶部中央
   */
  function spawnNextFruit() {
    if (gameEnded) return; // 游戏结束时不再生成水果

    // 随机选择水果等级（0-3级）
    const level = Math.floor(Math.random() * 5);

    // 根据等级找到对应的水果数据
    const fruitData = FRUITS.find((f) => f.level === level);

    // 在画布顶部中央创建水果
    // 基于HUD位置动态计算安全生成高度
    const safeY = computeSafeHoverY(fruitData.radius);
    currentFruit = createFruit(WIDTH / 2, safeY, fruitData);

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
        sprite: {
          texture: fruitData.texture,
          // 使用非透明区域估算的有效圆直径，避免透明留白导致的视觉空隙
          xScale: (function () {
            const info = textureInfoByPath[fruitData.texture] || {};
            const d = info.circleDiameterPx || info.pixelWidth || 100;
            const SCALE_OVERDRAW = 1.001; // 轻微放大覆盖边缘，避免视觉缝隙
            return ((fruitData.radius * 2) / d) * SCALE_OVERDRAW;
          })(),
          yScale: (function () {
            const info = textureInfoByPath[fruitData.texture] || {};
            const d = info.circleDiameterPx || info.pixelWidth || 100;
            const SCALE_OVERDRAW = 1.001;
            return ((fruitData.radius * 2) / d) * SCALE_OVERDRAW;
          })(),
        },
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
    // 分数弹跳动画
    scoreElement.classList.remove("pop");
    // 触发重绘以重启动画
    void scoreElement.offsetWidth;
    scoreElement.classList.add("pop");
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
        // 将屏幕坐标归一化为世界坐标（0..WIDTH）
        const worldX = (mouseX / rect.width) * WIDTH;

        // 限制水果位置在画布边界内（考虑水果半径）
        const clampedX = Common.clamp(
          worldX,
          currentFruit.fruitData.radius,
          WIDTH - currentFruit.fruitData.radius
        );

        // 计算安全悬停高度，避免被顶部HUD遮挡
        const safeHoverY = computeSafeHoverY(currentFruit.fruitData.radius);
        // 更新水果位置
        Body.setPosition(currentFruit, { x: clampedX, y: safeHoverY });
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
    if (restartButtonDialog)
      restartButtonDialog.addEventListener("click", init);

    // 窗口尺寸变化时自适应缩放
    window.addEventListener("resize", resizeStageToFit);
  }

  // 游戏初始启动
  init();
});
