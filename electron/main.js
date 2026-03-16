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

  // 게임 세이브 (프론트 -> 백엔드) 자동 저장
  ipcMain.handle('save-game', async (event, dataObj) => {
    try {
      const savePath = path.join(app.getPath('userData'), 'savegame.json');
      // dataObj 파라미터가 객체일 수 있으므로 JSON 문자열로 변환 후 저장
      const dataString = typeof dataObj === 'string' ? dataObj : JSON.stringify(dataObj);
      fs.writeFileSync(savePath, dataString, 'utf-8');
      return { success: true, filePath: savePath };
    } catch (e) {
      console.error('Save failed:', e);
      return { success: false, error: e.message };
    }
  });

  // 게임 로드 (백엔드 -> 프론트) 자동 로드
  ipcMain.handle('load-game', async (event) => {
    try {
      const savePath = path.join(app.getPath('userData'), 'savegame.json');
      if (fs.existsSync(savePath)) {
        const dataString = fs.readFileSync(savePath, 'utf-8');
        // 파싱된 객체 형태로 바로 프론트에 넘겨주기 위해 JSON.parse 적용 (실패 시 원본 반환)
        let parsedData = dataString;
        try { parsedData = JSON.parse(dataString); } catch(err) {}
        
        return { success: true, data: parsedData };
      }
      return { success: false, error: 'File not found' };
    } catch (e) {
      console.error('Load failed:', e);
      return { success: false, error: e.message };
    }
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
