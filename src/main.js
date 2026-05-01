const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')

// Загружаем C++ addon
const addon = require('../addon/build/Release/calculations')

let win

function createWindow() {
    win = new BrowserWindow({
        width: 900,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,   // Безопасность!
            nodeIntegration: false    // Безопасность!
        }
    })
    win.loadFile(path.join(__dirname, '../src/index.html'))
    win.webContents.openDevTools()
}

// IPC обработчик — получает вызов от HTML, передаёт в C++
ipcMain.handle('cpp-calculate', async (event, value) => {
    return new Promise((resolve, reject) => {
        addon.calculateAsync(value, (err, result) => {
            if (err) reject(err)
            else resolve(result)
        })
    })
})

app.whenReady().then(createWindow)
app.on('window-all-closed', () => app.quit())