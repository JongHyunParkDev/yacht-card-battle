const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

function createWindow () {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // 게임 세이브 (프론트 -> 백엔드)
  ipcMain.handle('save-game', async (event, dataString) => {
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title: '게임 세이브 파일 저장',
      defaultPath: 'savegame.json',
      filters: [{ name: 'JSON', extensions: ['json'] }]
    });

    if (!canceled && filePath) {
      fs.writeFileSync(filePath, dataString, 'utf-8');
      return { success: true, filePath };
    }
    return { success: false };
  });

  // 게임 로드 (백엔드 -> 프론트)
  ipcMain.handle('load-game', async (event) => {
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title: '게임 세이브 파일 불러오기',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile']
    });

    if (!canceled && filePaths.length > 0) {
      const dataString = fs.readFileSync(filePaths[0], 'utf-8');
      return { success: true, data: dataString };
    }
    return { success: false };
  });

  // Depending on DEV or PROD, we load different URLs/files
  const isDev = !app.isPackaged;
  
  if (isDev) {
    win.loadURL('http://127.0.0.1:5173');
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}


app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
