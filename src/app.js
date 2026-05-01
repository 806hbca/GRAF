
// app.js
const graphCanvas = new InteractiveGraphCanvas();
let currentGraphData = null;
let currentMatrix = null;
let selectedTraversal = 'bfs';

// Функции для работы с popup меню
function showTraversalMenu() {
    const menu = document.getElementById('traversalMenu');
    menu.style.display = 'block';
    
    const rect = menu.getBoundingClientRect();
    menu.style.left = (window.innerWidth - rect.width) / 2 + 'px';
    menu.style.top = (window.innerHeight - rect.height) / 2 + 'px';
    
    setTimeout(() => {
        document.addEventListener('click', closeTraversalMenu);
    }, 100);
}

function closeTraversalMenu(e) {
    const menu = document.getElementById('traversalMenu');
    if (!menu.contains(e.target)) {
        menu.style.display = 'none';
        document.removeEventListener('click', closeTraversalMenu);
    }
}

function selectTraversal(type) {
    selectedTraversal = type;
    
    document.querySelectorAll('.traversal-option').forEach(opt => {
        opt.classList.remove('selected');
    });
    document.querySelector(`[data-type="${type}"]`).classList.add('selected');
}

function setGraphType(type) {
    graphCanvas.setGraphType(type);
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

document.getElementById('inputModal').addEventListener('click', function(e) {
    if (e.target === this) closeModal();
});

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
        if (graphCanvas.graphType === 'undirected') {
            processedMatrix = matrix.map((row, i) => 
                row.map((val, j) => val !== 0 || matrix[j][i] !== 0 ? Math.max(val, matrix[j][i]) : 0)
            );
        }
        
        const graphData = await window.cpp.buildGraph(processedMatrix);
        currentGraphData = graphData;
        graphCanvas.setGraphData(graphData, matrix);
        showStatus(`Граф: ${graphData.numVertices} вершин, ${graphData.edges.length} рёбер (${graphCanvas.graphType === 'directed' ? 'ориентированный' : 'неориентированный'})`);
    } catch (e) {
        showStatus('Ошибка: ' + e.message, true);
    }
}

async function runTraversal() {
    const menu = document.getElementById('traversalMenu');
    menu.style.display = 'none';
    document.removeEventListener('click', closeTraversalMenu);
    
    if (!currentGraphData) return showStatus('Сначала постройте граф', true);
    const startVertex = parseInt(document.getElementById('traversalStartVertex').value);
    
    if (isNaN(startVertex) || startVertex < 0 || startVertex >= currentGraphData.numVertices) {
        return showStatus('Некорректная начальная вершина', true);
    }
    
    try {
        if (selectedTraversal === 'bfs') {
            const result = await window.cpp.runBFS(startVertex);
            showAlgorithmResult(`BFS обход (от вершины ${startVertex}): ${result.join(' → ')}`);
            graphCanvas.highlightVertices(result);
        } else {
            const result = await window.cpp.runDFS(startVertex);
            showAlgorithmResult(`DFS обход (от вершины ${startVertex}): ${result.join(' → ')}`);
            graphCanvas.highlightVertices(result);
        }
    } catch (e) {
        showStatus('Ошибка: ' + e.message, true);
    }
}

async function findPath() {
    if (!currentGraphData) return showStatus('Сначала постройте граф', true);
    const start = parseInt(document.getElementById('pathStart').value);
    const end = parseInt(document.getElementById('pathEnd').value);
    
    try {
        const path = await window.cpp.findShortestPath(start, end);
        if (path.length > 0) {
            showAlgorithmResult(`Кратчайший путь ${start}→${end}: ${path.join(' → ')}`);
            graphCanvas.highlightPath(path);
        } else {
            showAlgorithmResult('Путь не найден');
            graphCanvas.clearHighlights();
        }
    } catch (e) {
        showStatus('Ошибка: ' + e.message, true);
    }
}

async function checkConnectivity() {
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
    graphCanvas.setGraphData(null, null);
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
    statusEl.textContent = message;
    statusEl.style.color = isError ? '#e74c3c' : '#7f8c8d';
}

// Функции для работы с меню опций
function showOptionsMenu() {
    const menu = document.getElementById('optionsMenu');
    menu.style.display = 'block';
    
    const rect = menu.getBoundingClientRect();
    menu.style.left = (window.innerWidth - rect.width) / 2 + 'px';
    menu.style.top = (window.innerHeight - rect.height) / 2 + 'px';
    
    setTimeout(() => {
        document.addEventListener('click', closeOptionsMenu);
    }, 100);
}

function closeOptionsMenu(e) {
    const menu = document.getElementById('optionsMenu');
    if (!menu.contains(e.target)) {
        menu.style.display = 'none';
        document.removeEventListener('click', closeOptionsMenu);
    }
}

async function checkEulerianGraph() {
    closeOptionsMenuHelper();
    
    if (!currentGraphData) return showStatus('Сначала постройте граф', true);
    
    try {
        const isEulerian = await window.cpp.checkEulerian();
        showAlgorithmResult(isEulerian ? '✅ Граф эйлеров (все степени вершин четные)' : '❌ Граф не эйлеров');
    } catch (e) {
        showStatus('Ошибка: ' + e.message, true);
    }
}

async function findEulerianCycleGraph() {
    closeOptionsMenuHelper();
    
    if (!currentGraphData) return showStatus('Сначала постройте граф', true);
    
    try {
        const cycle = await window.cpp.findEulerianCycle();
        if (cycle.length > 0) {
            showAlgorithmResult(`Эйлеров цикл: ${cycle.join(' → ')}`);
            graphCanvas.highlightPath(cycle);
        } else {
            showAlgorithmResult('Эйлеров цикл не найден (граф не эйлеров)');
        }
    } catch (e) {
        showStatus('Ошибка: ' + e.message, true);
    }
}

async function solveTSPGraph() {
    closeOptionsMenuHelper();
    
    if (!currentGraphData) return showStatus('Сначала постройте граф', true);
    
    try {
        showStatus('Решение задачи коммивояжера...');
        const result = await window.cpp.solveTSP();
        
        if (result.path.length > 0) {
            showAlgorithmResult(`Оптимальный маршрут: ${result.path.join(' → ')} | Стоимость: ${result.cost.toFixed(2)}`);
            graphCanvas.highlightPath(result.path);
        } else {
            showAlgorithmResult('Не удалось найти решение TSP');
        }
    } catch (e) {
        showStatus('Ошибка: ' + e.message, true);
    }
}

function closeOptionsMenuHelper() {
    const menu = document.getElementById('optionsMenu');
    menu.style.display = 'none';
    document.removeEventListener('click', closeOptionsMenu);
}

// Инициализация обработчиков событий для popup меню
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('traversalMenu').addEventListener('click', (e) => {
        e.stopPropagation();
    });
    
    document.getElementById('optionsMenu').addEventListener('click', (e) => {
        e.stopPropagation();
    });
});

showStatus('🖱️ Перетаскивайте вершины | 🖱️ Панорамируйте холст | 🔍 Колесико для зума | 2x клик на миникарте - центр');