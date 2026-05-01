// src/main.js
const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const fs = require('fs')

// Проверяем загрузку addon
let addon;
try {
    addon = require('../addon/build/Release/grafalgorithms')
    console.log('Addon loaded successfully')
    console.log('Available functions:', Object.keys(addon))
} catch (error) {
    console.error('Failed to load addon:', error)
    console.error('Make sure to build the addon first: npm run build-addon')
}

let win
let currentMatrix = null

function createWindow() {
    win = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    })
    win.loadFile(path.join(__dirname, 'index.html'))
    win.webContents.openDevTools()
}

function registerIpcHandlers() {
    // Построение графа
    ipcMain.handle('build-graph', async (event, matrix) => {
        console.log('build-graph called')
        if (!addon) throw new Error('Addon not loaded')
        currentMatrix = matrix
        return addon.buildGraph(matrix)
    })

    // BFS обход
    ipcMain.handle('run-bfs', async (event, startVertex) => {
        if (!addon || !currentMatrix) throw new Error('Addon or matrix not available')
        return addon.bfs(currentMatrix, startVertex)
    })

    // DFS обход
    ipcMain.handle('run-dfs', async (event, startVertex) => {
        if (!addon || !currentMatrix) throw new Error('Addon or matrix not available')
        return addon.dfs(currentMatrix, startVertex)
    })

    // Кратчайший путь
    ipcMain.handle('find-shortest-path', async (event, start, end) => {
        if (!addon || !currentMatrix) throw new Error('Addon or matrix not available')
        return addon.shortestPath(currentMatrix, start, end)
    })

    // Проверка связности
    ipcMain.handle('check-connectivity', async () => {
        if (!addon || !currentMatrix) throw new Error('Addon or matrix not available')
        return addon.isConnected(currentMatrix)
    })

    // Проверка на эйлеровость
    ipcMain.handle('check-eulerian', async () => {
        if (!addon || !currentMatrix) throw new Error('Addon or matrix not available')
        return addon.isEulerian(currentMatrix)
    })

    // Поиск эйлерова цикла
    ipcMain.handle('find-eulerian-cycle', async () => {
        if (!addon || !currentMatrix) throw new Error('Addon or matrix not available')
        return addon.findEulerianCycle(currentMatrix)
    })

    // Задача коммивояжера
    ipcMain.handle('solve-tsp', async () => {
        if (!addon || !currentMatrix) throw new Error('Addon or matrix not available')
        return addon.solveTSP(currentMatrix)
    })

    // MST алгоритм Краскала
    ipcMain.handle('kruskal-mst', async () => {
        if (!addon || !currentMatrix) throw new Error('Addon or matrix not available')
        return addon.kruskalMST(currentMatrix)
    })

    // MST алгоритм Прима
    ipcMain.handle('prim-mst', async () => {
        if (!addon || !currentMatrix) throw new Error('Addon or matrix not available')
        return addon.primMST(currentMatrix)
    })

    // Открытие файла
    ipcMain.handle('open-file', async () => {
        if (!win) throw new Error('Window not available')
        
        const result = await dialog.showOpenDialog(win, {
            properties: ['openFile'],
            filters: [{ name: 'Text Files', extensions: ['txt'] }]
        })
        
        if (!result.canceled && result.filePaths.length > 0) {
            const content = fs.readFileSync(result.filePaths[0], 'utf-8')
            return { content, fileName: path.basename(result.filePaths[0]) }
        }
        return null
    })
    
    console.log('IPC handlers registered')
}

app.whenReady().then(() => {
    registerIpcHandlers()
    createWindow()
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
})