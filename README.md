# 🍉 Desktop Watermelon Game (合成大西瓜)

A classic fruit-merging puzzle game, inspired by the popular "Suika Game", built to run natively on your desktop using Electron and Matter.js.

![Gameplay Screenshot](https://i.imgur.com/rO2Y4g8.png) 
*Note: You can replace this static image with an animated GIF of your gameplay.*

---

## ✨ Features

- **Classic Gameplay**: Drop fruits and watch them merge! Combine two identical fruits to create a larger one.
- **Realistic Physics**: Smooth and satisfying physics simulation powered by **Matter.js**.
- **Progressive Challenge**: Start with small fruits and strategically merge your way up to the giant watermelon.
- **Intelligent Game Over**: A smart game-over mechanism gives you a 3-second warning buffer if fruits cross the danger line, providing a chance to save your game!
- **Simple UI**: Clean interface displaying your current score and a restart button.
- **Cross-Platform**: Built with Electron to run on Windows, macOS, and Linux.
- **Ready for Distribution**: Comes pre-configured with `electron-builder` to easily package the game into a distributable installer.

## 🛠️ Tech Stack

- **Framework**: [Electron](https://www.electronjs.org/)
- **Physics Engine**: [Matter.js](https://brm.io/matter-js/)
- **Rendering**: HTML5 `<canvas>`
- **Language**: JavaScript (ES6+)
- **Packaging**: [electron-builder](https://www.electron.build/)

## 🚀 Getting Started

Follow these instructions to get a local copy up and running for development or testing.

### Prerequisites

- [Node.js](https://nodejs.org/) (which includes npm) installed on your system.

### Installation

1. **Clone the repository:**
   ```sh
   git clone https://github.com/YOUR_USERNAME/electron-watermelon-game.git
   ```

2. **Navigate to the project directory:**
   ```sh
   cd electron-watermelon-game
   ```

3. **Install NPM packages:**
   ```sh
   npm install
   ```

## 🕹️ How to Play

- **Run the game in development mode:**
  ```sh
  npm start
  ```
- **Move your mouse** to position the next fruit.
- **Click the left mouse button** to drop the fruit.
- **Merge, score, and avoid the red line!**

## 📦 Building for Distribution

This project is configured to be packaged into a distributable installer (`.exe`, `.dmg`, etc.).

- **Run the distribution script:**
  ```sh
  npm run dist
  ```
- After the process completes, you will find the installer in the newly created `/dist` folder.

**Note for Windows Users:** When a user runs the generated `.exe` installer for the first time, Windows Defender may show a security warning. They will need to click `More info` -> `Run anyway` to proceed with the installation. This is normal for unsigned applications.

## 📁 Project Structure

```
electron-watermelon-game/
├── dist/               # Packaged application output appears here
├── node_modules/       # Dependencies
├── assets/             # For game assets (images, sounds)
├── fruit.js            # Defines fruit properties (size, color, etc.)
├── index.html          # Main HTML file for the game window
├── main.js             # Electron main process entry point
├── package.json        # Project configuration and scripts
├── preload.js          # Electron preload script
├── renderer.js         # Core game logic (renderer process)
└── README.md           # This file
```

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
