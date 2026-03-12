const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

function createWindow () {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    resizable: false, // 창 크기 조절 막기
    autoHideMenuBar: true, // 메뉴바 숨기기
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  win.setMenu(null); // 메뉴바를 아예 제거

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

  // 세이브 파일 존재 여부 확인
  ipcMain.handle('check-save-file', async () => {
    const savePath = path.join(app.getPath('userData'), 'savegame.json');
    return fs.existsSync(savePath);
  });

  // 설정 로드
  ipcMain.handle('load-settings', async () => {
    const settingsPath = path.join(app.getPath('userData'), 'settings.json');
    if (fs.existsSync(settingsPath)) {
      return JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    }
    return {
      language: 'ko',
      resolution: '1280x720',
      fullscreen: false
    };
  });

  // 설정 저장
  ipcMain.handle('save-settings', async (event, settings) => {
    const settingsPath = path.join(app.getPath('userData'), 'settings.json');
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
    return { success: true };
  });

  // 설정 즉시 적용 (창 크기 등)
  ipcMain.on('apply-settings', (event, settings) => {
    if (settings.fullscreen) {
      win.setResizable(true);
      win.setFullScreen(true);
      win.setResizable(false);
    } else {
      // 윈도우 모드로 전환 시 전체화면 해제 후 크기 조절
      win.setFullScreen(false);
      const [w, h] = stringToRes(settings.resolution);
      
      win.setResizable(true);
      win.setSize(w, h);
      win.setResizable(false);
      win.center();
    }
  });

  function stringToRes(resStr) {
    return resStr.split('x').map(Number);
  }

  // Depending on DEV or PROD, we load different URLs/files
  const isDev = !app.isPackaged;
  
  if (isDev) {
    win.loadURL('http://localhost:5173');
    // 설정 파일이 있다면 초기 창 크기 적용
    const settingsPath = path.join(app.getPath('userData'), 'settings.json');
    if (fs.existsSync(settingsPath)) {
      try {
        const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
        if (settings.fullscreen) {
          win.setFullScreen(true);
        } else {
          const [w, h] = settings.resolution.split('x').map(Number);
          win.setSize(w, h);
          win.center();
        }
      } catch (e) {
        console.error('Initial settings apply failed:', e);
      }
    }
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
