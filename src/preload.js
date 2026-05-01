
const { contextBridge, ipcRenderer } = require('electron')

// Безопасно открываем API для HTML страницы
contextBridge.exposeInMainWorld('cpp', {
    calculate: (value) => ipcRenderer.invoke('cpp-calculate', value)
})