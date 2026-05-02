// app.js
// Глобальные переменные
let currentGraphData = null;
let currentMatrix = null;
let selectedTraversalType = 'bfs';

// Делаем переменные доступными глобально
window.currentMatrix = null;
window.currentGraphData = null;

// graphCanvas будет создан после загрузки DOM
let graphCanvas;

// Функции для работы с меню опций
function showOptionsMenu() {
    const menu = document.getElementById('optionsMenu');
    menu.style.display = 'block';
    
    const rect = menu.getBoundingClientRect();
    menu.style.left = (window.innerWidth - rect.width) / 2 + 'px';
    menu.style.top = (window.innerHeight - rect.height) / 2 + 'px';
    
    menu.scrollTop = 0;
    
    setTimeout(() => {
        document.addEventListener('click', closeOptionsMenu);
    }, 100);
}

function closeOptionsMenu(e) {
    const menu = document.getElementById('optionsMenu');
    if (e && !menu.contains(e.target)) {
        menu.style.display = 'none';
        document.removeEventListener('click', closeOptionsMenu);
    }
}

// Подменю для обхода графа
function showTraversalSubmenu(type) {
    closeOptionsMenu();
    
    selectedTraversalType = type;
    
    const menu = document.getElementById('traversalSubmenu');
    const title = document.getElementById('traversalSubmenuTitle');
    
    if (type === 'bfs') {
        title.textContent = 'BFS - Поиск в ширину';
    } else {
        title.textContent = 'DFS - Поиск в глубину';
    }
    
    menu.style.display = 'block';
    
    const rect = menu.getBoundingClientRect();
    menu.style.left = (window.innerWidth - rect.width) / 2 + 'px';
    menu.style.top = (window.innerHeight - rect.height) / 2 + 'px';
    
    document.getElementById('traversalStartVertex').focus();
    
    setTimeout(() => {
        document.addEventListener('click', closeTraversalSubmenu);
    }, 100);
}

function closeTraversalSubmenu(e) {
    const menu = document.getElementById('traversalSubmenu');
    if (e && !menu.contains(e.target)) {
        menu.style.display = 'none';
        document.removeEventListener('click', closeTraversalSubmenu);
    }
}

async function runTraversal() {
    const menu = document.getElementById('traversalSubmenu');
    menu.style.display = 'none';
    document.removeEventListener('click', closeTraversalSubmenu);
    
    if (!currentGraphData) return showStatus('Сначала постройте граф', true);
    const startVertex = parseInt(document.getElementById('traversalStartVertex').value);
    
    if (isNaN(startVertex) || startVertex < 0 || startVertex >= currentGraphData.numVertices) {
        return showStatus('Некорректная начальная вершина', true);
    }
    
    try {
        let result;
        if (selectedTraversalType === 'bfs') {
            result = await window.cpp.runBFS(startVertex);
            showAlgorithmResult(`BFS обход (от вершины ${startVertex}): ${result.join(' → ')}`);
        } else {
            result = await window.cpp.runDFS(startVertex);
            showAlgorithmResult(`DFS обход (от вершины ${startVertex}): ${result.join(' → ')}`);
        }
        if (graphCanvas) graphCanvas.highlightVertices(result);
    } catch (e) {
        showStatus('Ошибка: ' + e.message, true);
    }
}

// Подменю для кратчайшего пути
function showShortestPathMenu() {
    closeOptionsMenu();
    
    const menu = document.getElementById('shortestPathMenu');
    menu.style.display = 'block';
    
    const rect = menu.getBoundingClientRect();
    menu.style.left = (window.innerWidth - rect.width) / 2 + 'px';
    menu.style.top = (window.innerHeight - rect.height) / 2 + 'px';
    
    setTimeout(() => {
        document.addEventListener('click', closeShortestPathMenu);
    }, 100);
}

function closeShortestPathMenu(e) {
    const menu = document.getElementById('shortestPathMenu');
    if (e && !menu.contains(e.target)) {
        menu.style.display = 'none';
        document.removeEventListener('click', closeShortestPathMenu);
    }
}

async function runShortestPath() {
    const menu = document.getElementById('shortestPathMenu');
    menu.style.display = 'none';
    
    if (!currentGraphData) return showStatus('Сначала постройте граф', true);
    const start = parseInt(document.getElementById('spStartVertex').value);
    const end = parseInt(document.getElementById('spEndVertex').value);
    
    if (isNaN(start) || start < 0 || start >= currentGraphData.numVertices) {
        return showStatus('Некорректная начальная вершина', true);
    }
    
    if (isNaN(end) || end < 0 || end >= currentGraphData.numVertices) {
        return showStatus('Некорректная конечная вершина', true);
    }
    
    try {
        const path = await window.cpp.findShortestPath(start, end);
        if (path.length > 0) {
            let totalWeight = 0;
            for (let i = 0; i < path.length - 1; i++) {
                const from = path[i];
                const to = path[i + 1];
                if (currentMatrix && currentMatrix[from] && currentMatrix[from][to] !== undefined) {
                    totalWeight += currentMatrix[from][to];
                }
            }
            
            showAlgorithmResult(`Кратчайший путь ${start}→${end}: ${path.join(' → ')} | Сумма пути: ${totalWeight.toFixed(2)}`);
            if (graphCanvas) graphCanvas.highlightPath(path);
        } else {
            showAlgorithmResult('Путь не найден');
            if (graphCanvas) graphCanvas.clearHighlights();
        }
    } catch (e) {
        showStatus('Ошибка: ' + e.message, true);
    }
}

// MST алгоритмы
async function runMSTAlgorithm(type) {
    closeOptionsMenu();
    
    if (!currentGraphData) return showStatus('Сначала постройте граф', true);
    
    try {
        showStatus('Построение минимального остовного дерева...');
        
        let result;
        if (type === 'kruskal') {
            result = await window.cpp.kruskalMST();
            showAlgorithmResult(`MST (Краскал): ${result.edges.length} ребер, общий вес: ${result.totalWeight.toFixed(2)}`);
        } else {
            result = await window.cpp.primMST();
            showAlgorithmResult(`MST (Прим): ${result.edges.length} ребер, общий вес: ${result.totalWeight.toFixed(2)}`);
        }
        
        highlightMSTEdges(result);
        
    } catch (e) {
        showStatus('Ошибка: ' + e.message, true);
    }
}

function highlightMSTEdges(mstResult) {
    if (!currentGraphData) return;
    
    const path = [];
    const visited = new Set();
    
    if (mstResult.edges.length > 0) {
        const firstEdge = mstResult.edges[0];
        path.push(firstEdge.from);
        path.push(firstEdge.to);
        visited.add(firstEdge.from);
        visited.add(firstEdge.to);
        
        let changed = true;
        while (changed) {
            changed = false;
            for (const edge of mstResult.edges) {
                if (visited.has(edge.from) && !visited.has(edge.to)) {
                    path.push(edge.to);
                    visited.add(edge.to);
                    changed = true;
                } else if (visited.has(edge.to) && !visited.has(edge.from)) {
                    path.push(edge.from);
                    visited.add(edge.from);
                    changed = true;
                }
            }
        }
    }
    
    if (graphCanvas) graphCanvas.highlightPath(path);
}

// Остальные функции
function setGraphType(type) {
    if (graphCanvas) graphCanvas.setGraphType(type);
    if (currentMatrix) {
        buildGraph(currentMatrix);
    }
}

function showManualInput() {
    document.getElementById('inputModal').classList.add('active');
    document.getElementById('matrixInput').focus();
}

function closeModal() {
    document.getElementById('inputModal').classList.remove('active');
}

async function loadFromFile() {
    try {
        showStatus('Открытие файла...');
        const result = await window.electron.openFile();
        if (result) {
            document.getElementById('matrixInput').value = result.content;
            parseAndBuildGraph(result.content);
        }
    } catch (e) {
        showStatus('Ошибка: ' + e.message, true);
    }
}

function parseAndBuildGraph(content) {
    try {
        const lines = content.trim().split('\n');
        const matrix = [];
        
        for (let line of lines) {
            line = line.trim();
            if (line) {
                const row = line.split(/\s+/).map(Number);
                if (row.some(isNaN)) throw new Error('Все значения должны быть числами');
                matrix.push(row);
            }
        }
        
        const n = matrix.length;
        for (let i = 0; i < n; i++) {
            if (matrix[i].length !== n) throw new Error('Матрица должна быть квадратной');
        }
        
        currentMatrix = matrix;
        buildGraph(matrix);
        
    } catch (e) {
        showStatus('Ошибка: ' + e.message, true);
    }
}

async function submitMatrix() {
    const input = document.getElementById('matrixInput').value;
    if (input.trim()) {
        parseAndBuildGraph(input);
        closeModal();
    }
}

async function buildGraph(matrix) {
    try {
        showStatus('Построение графа...');
        
        let processedMatrix = matrix;
        if (graphCanvas && graphCanvas.graphType === 'undirected') {
            processedMatrix = matrix.map((row, i) => 
                row.map((val, j) => val !== 0 || matrix[j][i] !== 0 ? Math.max(val, matrix[j][i]) : 0)
            );
        }
        
        const graphData = await window.cpp.buildGraph(processedMatrix);
        currentGraphData = graphData;
        currentMatrix = matrix;
        
        window.currentMatrix = matrix;
        window.currentGraphData = graphData;
        
        if (graphCanvas) graphCanvas.setGraphData(graphData, matrix);
        showStatus(`Граф: ${graphData.numVertices} вершин, ${graphData.edges.length} рёбер`);
    } catch (e) {
        showStatus('Ошибка: ' + e.message, true);
    }
}

async function checkConnectivity() {
    closeOptionsMenu();
    
    if (!currentGraphData) return showStatus('Сначала постройте граф', true);
    
    try {
        const connected = await window.cpp.checkConnectivity();
        showAlgorithmResult(connected ? '✅ Граф связный' : '❌ Граф не связный');
    } catch (e) {
        showStatus('Ошибка: ' + e.message, true);
    }
}

function clearGraph() {
    currentGraphData = null;
    currentMatrix = null;
    window.currentMatrix = null;
    window.currentGraphData = null;
    if (graphCanvas) graphCanvas.setGraphData(null, null);
    document.getElementById('matrixInput').value = '';
    document.getElementById('algorithmResult').style.display = 'none';
    showStatus('Граф очищен');
}

function showAlgorithmResult(message) {
    const resultDiv = document.getElementById('algorithmResult');
    resultDiv.style.display = 'block';
    resultDiv.textContent = message;
}

function showStatus(message, isError = false) {
    const statusEl = document.getElementById('status');
    if (statusEl) {
        statusEl.textContent = message;
        statusEl.style.color = isError ? '#e74c3c' : '#7f8c8d';
    }
}

async function checkEulerianGraph() {
    closeOptionsMenu();
    
    if (!currentGraphData) return showStatus('Сначала постройте граф', true);
    
    try {
        const isEulerian = await window.cpp.checkEulerian();
        showAlgorithmResult(isEulerian ? '✅ Граф эйлеров' : '❌ Граф не эйлеров');
    } catch (e) {
        showStatus('Ошибка: ' + e.message, true);
    }
}

async function findEulerianCycleGraph() {
    closeOptionsMenu();
    
    if (!currentGraphData) return showStatus('Сначала постройте граф', true);
    
    try {
        const cycle = await window.cpp.findEulerianCycle();
        if (cycle.length > 0) {
            showAlgorithmResult(`Эйлеров цикл: ${cycle.join(' → ')}`);
            if (graphCanvas) graphCanvas.highlightPath(cycle);
        } else {
            showAlgorithmResult('Эйлеров цикл не найден');
        }
    } catch (e) {
        showStatus('Ошибка: ' + e.message, true);
    }
}

async function solveTSPGraph() {
    closeOptionsMenu();
    
    if (!currentGraphData) return showStatus('Сначала постройте граф', true);
    
    try {
        showStatus('Решение задачи коммивояжера...');
        const result = await window.cpp.solveTSP();
        
        if (result.path.length > 0) {
            showAlgorithmResult(`Оптимальный маршрут: ${result.path.join(' → ')} | Стоимость: ${result.cost.toFixed(2)}`);
            if (graphCanvas) graphCanvas.highlightPath(result.path);
        } else {
            showAlgorithmResult('Не удалось найти решение TSP');
        }
    } catch (e) {
        showStatus('Ошибка: ' + e.message, true);
    }
}

// Функции редактирования графа
function showEditMenu() {
    const menu = document.getElementById('editMenu');
    menu.style.display = 'block';
    
    const rect = menu.getBoundingClientRect();
    menu.style.left = (window.innerWidth - rect.width) / 2 + 'px';
    menu.style.top = (window.innerHeight - rect.height) / 2 + 'px';
    
    setTimeout(() => {
        document.addEventListener('click', closeEditMenu);
    }, 100);
}

function closeEditMenu(e) {
    const menu = document.getElementById('editMenu');
    if (e && !menu.contains(e.target)) {
        menu.style.display = 'none';
        document.removeEventListener('click', closeEditMenu);
    }
}

function closeSubmenu(menuId) {
    const menu = document.getElementById(menuId);
    if (menu) menu.style.display = 'none';
}

function showSubmenu(menuId) {
    closeEditMenu();
    
    const menu = document.getElementById(menuId);
    menu.style.display = 'block';
    
    const rect = menu.getBoundingClientRect();
    menu.style.left = (window.innerWidth - rect.width) / 2 + 'px';
    menu.style.top = (window.innerHeight - rect.height) / 2 + 'px';
    
    setTimeout(() => {
        document.addEventListener('click', closeSubmenuHandler);
    }, 100);
}

function closeSubmenuHandler(e) {
    const submenus = ['addVertexMenu', 'deleteVertexMenu', 'addEdgeMenu', 'deleteEdgeMenu'];
    let clickedInside = false;
    
    submenus.forEach(menuId => {
        const menu = document.getElementById(menuId);
        if (menu && menu.contains(e.target)) {
            clickedInside = true;
        }
    });
    
    if (!clickedInside) {
        submenus.forEach(menuId => {
            const menu = document.getElementById(menuId);
            if (menu) menu.style.display = 'none';
        });
        document.removeEventListener('click', closeSubmenuHandler);
    }
}

function showAddVertexMenu() {
    showSubmenu('addVertexMenu');
}

function showDeleteVertexMenu() {
    showSubmenu('deleteVertexMenu');
    document.getElementById('deleteVertexIndex').focus();
}

function showAddEdgeMenu() {
    showSubmenu('addEdgeMenu');
    document.getElementById('edgeFromVertex').focus();
}

function showDeleteEdgeMenu() {
    showSubmenu('deleteEdgeMenu');
    document.getElementById('deleteEdgeFrom').focus();
}

function deleteVertex() {
    if (!currentMatrix) {
        showStatus('Сначала постройте граф', true);
        closeSubmenu('deleteVertexMenu');
        return;
    }
    
    const vertexIndex = parseInt(document.getElementById('deleteVertexIndex').value);
    const n = currentMatrix.length;
    
    if (isNaN(vertexIndex) || vertexIndex < 0 || vertexIndex >= n) {
        showStatus('Некорректный индекс вершины', true);
        return;
    }
    
    if (n <= 1) {
        showStatus('Нельзя удалить последнюю вершину', true);
        return;
    }
    
    const newMatrix = [];
    for (let i = 0; i < n; i++) {
        if (i === vertexIndex) continue;
        const newRow = [];
        for (let j = 0; j < n; j++) {
            if (j === vertexIndex) continue;
            newRow.push(currentMatrix[i][j]);
        }
        newMatrix.push(newRow);
    }
    
    currentMatrix = newMatrix;
    buildGraph(currentMatrix);
    
    closeSubmenu('deleteVertexMenu');
    showStatus(`Вершина ${vertexIndex} удалена. Осталось вершин: ${n - 1}`);
}

function deleteEdge() {
    if (!currentMatrix) {
        showStatus('Сначала постройте граф', true);
        closeSubmenu('deleteEdgeMenu');
        return;
    }
    
    const from = parseInt(document.getElementById('deleteEdgeFrom').value);
    const to = parseInt(document.getElementById('deleteEdgeTo').value);
    const n = currentMatrix.length;
    
    if (isNaN(from) || from < 0 || from >= n || isNaN(to) || to < 0 || to >= n) {
        showStatus('Некорректные индексы вершин', true);
        return;
    }
    
    if (currentMatrix[from][to] === 0) {
        showStatus('Ребро не существует', true);
        return;
    }
    
    const wasBidirectional = (currentMatrix[to][from] !== 0);
    
    currentMatrix[from][to] = 0;
    
    if (graphCanvas && graphCanvas.graphType === 'undirected') {
        currentMatrix[to][from] = 0;
    }
    
    buildGraph(currentMatrix);
    
    closeSubmenu('deleteEdgeMenu');
    
    if (graphCanvas && graphCanvas.graphType === 'undirected') {
        showStatus(`Ребро ${from}↔${to} удалено полностью`);
    } else if (wasBidirectional) {
        showStatus(`Удалено ребро ${from}→${to}. Осталось ребро ${to}→${from} (вес: ${currentMatrix[to][from]})`);
    } else {
        showStatus(`Ребро ${from}→${to} удалено`);
    }
}

function addVertex() {
    if (!currentMatrix) {
        showStatus('Сначала постройте граф', true);
        closeSubmenu('addVertexMenu');
        return;
    }
    
    const n = currentMatrix.length;
    const newMatrix = [];
    
    for (let i = 0; i < n; i++) {
        const newRow = [...currentMatrix[i], 0];
        newMatrix.push(newRow);
    }
    
    const newRow = new Array(n + 1).fill(0);
    newMatrix.push(newRow);
    
    currentMatrix = newMatrix;
    buildGraph(currentMatrix);
    
    closeSubmenu('addVertexMenu');
    showStatus(`Вершина добавлена. Всего вершин: ${n + 1}`);
}

function addEdge() {
    if (!currentMatrix) {
        showStatus('Сначала постройте граф', true);
        closeSubmenu('addEdgeMenu');
        return;
    }
    
    const from = parseInt(document.getElementById('edgeFromVertex').value);
    const to = parseInt(document.getElementById('edgeToVertex').value);
    const weight = parseFloat(document.getElementById('edgeWeight').value) || 1;
    const bidirectional = document.getElementById('edgeBidirectional').checked;
    const n = currentMatrix.length;
    
    if (isNaN(from) || from < 0 || from >= n || isNaN(to) || to < 0 || to >= n) {
        showStatus('Некорректные индексы вершин', true);
        return;
    }
    
    if (from === to) {
        showStatus('Нельзя добавить петлю', true);
        return;
    }
    
    if (currentMatrix[from][to] !== 0) {
        showStatus('Ребро уже существует', true);
        return;
    }
    
    currentMatrix[from][to] = weight;
    
    if (bidirectional || (graphCanvas && graphCanvas.graphType === 'undirected')) {
        currentMatrix[to][from] = weight;
    }
    
    buildGraph(currentMatrix);
    
    closeSubmenu('addEdgeMenu');
    
    if (bidirectional) {
        showStatus(`Двустороннее ребро ${from}↔${to} (вес: ${weight}) добавлено`);
    } else {
        showStatus(`Ребро ${from}→${to} (вес: ${weight}) добавлено`);
    }
}

function rebuildGraph(matrix) {
    currentMatrix = matrix;
    buildGraph(matrix);
}

// Экспорт в глобальную область
window.rebuildGraph = rebuildGraph;
window.showStatus = showStatus;

// Инициализация после загрузки DOM
document.addEventListener('DOMContentLoaded', () => {
    // Создаем graphCanvas
    graphCanvas = new InteractiveGraphCanvas();
    
    // Обработчик закрытия модального окна
    document.getElementById('inputModal').addEventListener('click', function(e) {
        if (e.target === this) closeModal();
    });
    
    // Обработчики для popup меню
    document.getElementById('optionsMenu').addEventListener('click', (e) => e.stopPropagation());
    document.getElementById('editMenu').addEventListener('click', (e) => e.stopPropagation());
    document.getElementById('traversalSubmenu').addEventListener('click', (e) => e.stopPropagation());
    document.getElementById('shortestPathMenu').addEventListener('click', (e) => e.stopPropagation());
    
    ['addVertexMenu', 'deleteVertexMenu', 'addEdgeMenu', 'deleteEdgeMenu'].forEach(menuId => {
        const menu = document.getElementById(menuId);
        if (menu) {
            menu.addEventListener('click', (e) => e.stopPropagation());
        }
    });
    
    showStatus('🖱️ Перетаскивайте вершины | 🖱️ Панорамируйте холст | 🔍 Колесико для зума | 2x клик на миникарте - центр');
});