const { app, BrowserWindow } = require("electron");
const path = require("path");

// 创建窗口函数
function createWindow() {
  // 创建一个新的BrowserWindow实例
  const mainWindow = new BrowserWindow({
    // 设置窗口宽度
    width: 480,
    // 设置窗口高度
    height: 720,
    // 禁止窗口大小调整
    resizable: false,
    // 设置webPreferences
    webPreferences: {
      // 设置预加载脚本
      preload: path.join(__dirname, "preload.js"),
      // 启用上下文隔离
      contextIsolation: true,
      // 禁用Node.js集成
      nodeIntegration: false,
    },
  });

  // 加载index.html文件
  mainWindow.loadFile("index.html");
  // 打开开发者工具
  // mainWindow.webContents.openDevTools(); // Uncomment to debug
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", function () {
  if (process.platform !== "darwin") app.quit();
});
