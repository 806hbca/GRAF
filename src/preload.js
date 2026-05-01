// src/preload.js
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('cpp', {
    buildGraph: (matrix) => ipcRenderer.invoke('build-graph', matrix),
    runBFS: (startVertex) => ipcRenderer.invoke('run-bfs', startVertex),
    runDFS: (startVertex) => ipcRenderer.invoke('run-dfs', startVertex),
    findShortestPath: (start, end) => ipcRenderer.invoke('find-shortest-path', start, end),
    checkConnectivity: () => ipcRenderer.invoke('check-connectivity'),
    checkEulerian: () => ipcRenderer.invoke('check-eulerian'),
    findEulerianCycle: () => ipcRenderer.invoke('find-eulerian-cycle'),
    solveTSP: () => ipcRenderer.invoke('solve-tsp'),
    kruskalMST: () => ipcRenderer.invoke('kruskal-mst'),
    primMST: () => ipcRenderer.invoke('prim-mst')
})

contextBridge.exposeInMainWorld('electron', {
    openFile: () => ipcRenderer.invoke('open-file')
})