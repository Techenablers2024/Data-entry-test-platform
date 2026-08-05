const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  getMachineId:   () => ipcRenderer.invoke('get-machine-id'),
  getHostname:    () => ipcRenderer.invoke('get-hostname'),
  saveScreenshot: (dataUrl, filename) => ipcRenderer.invoke('save-screenshot', dataUrl, filename),
  captureHtml:    (html) => ipcRenderer.invoke('capture-html', html),
})
