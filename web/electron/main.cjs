const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const fs = require('fs')
const { machineIdSync } = require('node-machine-id')
const os = require('os')

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    title: 'DataEntry Pro',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (isDev) {
    win.loadURL('http://localhost:5173')
    win.webContents.openDevTools()
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

// Expose machine ID to renderer via IPC
ipcMain.handle('get-machine-id', () => {
  try {
    return machineIdSync()
  } catch {
    return 'fallback-' + os.hostname()
  }
})

ipcMain.handle('get-hostname', () => os.hostname())

// Simple viewport capture — caller controls scrolling
ipcMain.handle('capture-viewport', async () => {
  const win = BrowserWindow.getFocusedWindow()
  if (!win) return null
  const image = await win.webContents.capturePage()
  return image.toPNG().toString('base64')
})

// Render HTML in a hidden window and capture it as PNG
ipcMain.handle('capture-html', async (_, htmlContent) => {
  const win = new BrowserWindow({
    width: 900,
    height: 800,
    show: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  })

  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent))

  // Wait for render
  await new Promise(r => setTimeout(r, 400))

  // Measure full content height
  const fullH = await win.webContents.executeJavaScript(
    'document.documentElement.scrollHeight'
  )
  win.setSize(900, Math.min(fullH + 20, 16000))
  await new Promise(r => setTimeout(r, 300))

  const image = await win.webContents.capturePage()
  const base64 = image.toPNG().toString('base64')
  win.close()
  return base64
})

// Save screenshot to user-chosen location
ipcMain.handle('save-screenshot', async (_, dataUrl, filename) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Save Screenshot',
    defaultPath: path.join(os.homedir(), 'Downloads', filename),
    filters: [{ name: 'PNG Image', extensions: ['png'] }],
  })
  if (canceled || !filePath) return { saved: false }

  const base64 = dataUrl.replace(/^data:image\/png;base64,/, '')
  fs.writeFileSync(filePath, Buffer.from(base64, 'base64'))
  return { saved: true, filePath }
})
