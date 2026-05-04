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

/** Последние подписи вершин (для повторного buildGraph без явного displayOpts, тот же размер матрицы) */
let cachedVertexDisplayOpts = null;

function matrixFingerprint(matrix) {
    return matrix.map((row) => row.join(',')).join('|');
}

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
    if (!e) {
        menu.style.display = 'none';
        document.removeEventListener('click', closeOptionsMenu);
        return;
    }
    if (!menu.contains(e.target)) {
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
        const res = await window.cpp.findShortestPath(start, end);
        const path =
            res && typeof res === 'object' && Array.isArray(res.path)
                ? res.path
                : Array.isArray(res)
                  ? res
                  : [];
        const vertexDistances =
            res && typeof res === 'object' && Array.isArray(res.vertexDistances) ? res.vertexDistances : null;
        const vertexParents =
            res && typeof res === 'object' && Array.isArray(res.vertexParents) ? res.vertexParents : null;
        const dijkstraEdgeLabels = buildDijkstraEdgeLabels(vertexDistances, vertexParents, start);
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
            if (graphCanvas) {
                graphCanvas.clearHighlights();
                graphCanvas.highlightPath(path);
                if (dijkstraEdgeLabels.length) graphCanvas.setAlgorithmEdgeLabels(dijkstraEdgeLabels);
            }
        } else {
            showAlgorithmResult('Путь не найден');
            if (graphCanvas) {
                graphCanvas.clearHighlights();
                if (dijkstraEdgeLabels.length) graphCanvas.setAlgorithmEdgeLabels(dijkstraEdgeLabels);
            }
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

function showCreateGraphMenu() {
    const menu = document.getElementById('createGraphMenu');
    menu.style.display = 'block';
    const rect = menu.getBoundingClientRect();
    menu.style.left = (window.innerWidth - rect.width) / 2 + 'px';
    menu.style.top = (window.innerHeight - rect.height) / 2 + 'px';
    setTimeout(() => {
        document.addEventListener('click', closeCreateGraphMenu);
    }, 100);
}

function closeCreateGraphMenu(e) {
    const menu = document.getElementById('createGraphMenu');
    if (!e) {
        menu.style.display = 'none';
        document.removeEventListener('click', closeCreateGraphMenu);
        return;
    }
    if (!menu.contains(e.target)) {
        menu.style.display = 'none';
        document.removeEventListener('click', closeCreateGraphMenu);
    }
}

function updateInputModalForOptions() {
    const multi = document.getElementById('graphCbMultiMod').checked;
    const nonArb = document.getElementById('graphCbNonArbitrary').checked;
    const title = document.getElementById('inputModalTitle');
    const help = document.getElementById('inputModalHelp');
    const namesBlock = document.getElementById('vertexNamesBlock');
    if (multi) {
        title.textContent = 'Формат Multi mod';
        help.innerHTML =
            'Строка 1: ровно <strong>n</strong> имён вершин (каждое не длиннее 3 символов), через пробел.<br>' +
            'Далее <strong>m</strong> строк: три числа <code>f l v</code> — ребро из вершины <code>f</code> в вершину <code>l</code> с весом <code>v</code> (вершины <strong>1…n</strong>).<br>' +
            'Петля: одинаковые f и l, например <code>3 3 5</code>.';
        namesBlock.style.display = 'none';
    } else {
        title.textContent = 'Введите матрицу смежности';
        help.innerHTML =
            'Квадратная матрица весов. Пример:<br>' +
            '0 1.5 0 2.3 1<br>1.5 0 1.0 0 8<br>0 1.0 0 1.7 7<br>2.3 0 1.7 0 4<br>0 0 0 0 0';
        namesBlock.style.display = nonArb ? 'block' : 'none';
    }
}

function openGraphInputManual() {
    closeCreateGraphMenu();
    updateInputModalForOptions();
    document.getElementById('inputModal').classList.add('active');
    document.getElementById('matrixInput').focus();
}

function closeModal() {
    document.getElementById('inputModal').classList.remove('active');
}

function parseStandardAdjacencyMatrixOnly(content) {
    const lines = content.trim().split('\n');
    const matrix = [];
    for (let line of lines) {
        line = line.trim();
        if (line) {
            const row = line.split(/\s+/).map(Number);
            if (row.some(isNaN)) throw new Error('Все значения матрицы должны быть числами');
            matrix.push(row);
        }
    }
    const n = matrix.length;
    for (let i = 0; i < n; i++) {
        if (matrix[i].length !== n) throw new Error('Матрица должна быть квадратной');
    }
    return matrix;
}

function parseVertexNamesList(text, n) {
    const parts = text.trim().split(/[\s,\n\r]+/).filter(Boolean);
    if (parts.length !== n) {
        throw new Error(`Для режима «НЕ произвольная нумерация» нужно ровно ${n} имён вершин, указано: ${parts.length}`);
    }
    for (const p of parts) {
        if (!p.length) throw new Error('Пустое имя вершины не допускается');
    }
    return parts;
}

function parseMultiMod(content) {
    const lines = content
        .trim()
        .split(/\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0);
    if (lines.length < 2) {
        throw new Error('Multi mod: нужна строка из n имён и хотя бы одна строка рёбер (f l v)');
    }
    const nameTokens = lines[0].split(/\s+/).filter(Boolean);
    const n = nameTokens.length;
    if (n === 0) throw new Error('Первая строка: укажите имена вершин через пробел');
    for (const t of nameTokens) {
        if (t.length > 3) {
            throw new Error(
                `Неправильное имя «${t}»: имя не может быть длиннее 3 символов`
            );
        }
    }
    const matrix = Array.from({ length: n }, () => Array(n).fill(0));
    const explicitEdges = [];
    for (let li = 1; li < lines.length; li++) {
        const parts = lines[li].split(/\s+/).filter(Boolean);
        if (parts.length < 3) {
            throw new Error(`Строка ${li + 1}: ожидаются три числа f l v через пробел`);
        }
        const f = parseInt(parts[0], 10);
        const l = parseInt(parts[1], 10);
        const v = parseFloat(parts[2]);
        if (Number.isNaN(f) || Number.isNaN(l) || Number.isNaN(v)) {
            throw new Error(`Строка ${li + 1}: f, l и v должны быть числами`);
        }
        if (f < 1 || f > n || l < 1 || l > n) {
            throw new Error(`Строка ${li + 1}: номера вершин должны быть от 1 до ${n}`);
        }
        const fi = f - 1;
        const li0 = l - 1;
        matrix[fi][li0] += v;
        explicitEdges.push({ from: fi, to: li0, weight: v });
    }
    return { matrix, vertexNames: nameTokens, explicitEdges };
}

function parseAndBuildGraphFromContent(content) {
    const multi = document.getElementById('graphCbMultiMod').checked;
    const nonArb = document.getElementById('graphCbNonArbitrary').checked;
    const namesText = document.getElementById('vertexNamesInput').value;

    if (multi) {
        const { matrix, vertexNames, explicitEdges } = parseMultiMod(content);
        buildGraph(matrix, { names: vertexNames, labelInside: true, explicitEdges });
        return;
    }

    const matrix = parseStandardAdjacencyMatrixOnly(content);
    const n = matrix.length;
    let displayOpts = null;
    if (nonArb) {
        const names = parseVertexNamesList(namesText, n);
        displayOpts = { names, labelInside: true };
    }
    buildGraph(matrix, displayOpts);
}

async function loadFromFile() {
    try {
        showStatus('Открытие файла...');
        const result = await window.electron.openFile();
        if (!result) return;
        closeCreateGraphMenu();
        document.getElementById('matrixInput').value = result.content;
        const multi = document.getElementById('graphCbMultiMod').checked;
        const nonArb = document.getElementById('graphCbNonArbitrary').checked;

        if (nonArb && !multi) {
            updateInputModalForOptions();
            document.getElementById('inputModal').classList.add('active');
            showStatus('Укажите имена всех вершин в отдельном поле и нажмите «Построить граф»');
            return;
        }

        try {
            parseAndBuildGraphFromContent(result.content);
            showStatus('Граф построен из файла');
        } catch (e) {
            updateInputModalForOptions();
            document.getElementById('inputModal').classList.add('active');
            showStatus('Проверьте данные в окне и нажмите «Построить граф»: ' + e.message, true);
        }
    } catch (e) {
        showStatus('Ошибка: ' + e.message, true);
    }
}

async function submitMatrix() {
    const input = document.getElementById('matrixInput').value;
    if (!input.trim()) return;
    try {
        parseAndBuildGraphFromContent(input);
        closeModal();
    } catch (e) {
        showStatus('Ошибка: ' + e.message, true);
    }
}

async function buildGraph(matrix, displayOpts) {
    try {
        showStatus('Построение графа...');

        let opts = displayOpts;

        if (opts && opts.names && opts.names.length === matrix.length) {
            cachedVertexDisplayOpts = {
                names: [...opts.names],
                labelInside: !!opts.labelInside,
                explicitEdges: opts.explicitEdges
                    ? opts.explicitEdges.map((e) => ({ from: e.from, to: e.to, weight: e.weight }))
                    : null,
                fingerprint: matrixFingerprint(matrix),
                renderStraightEdges: !(opts.explicitEdges && opts.explicitEdges.length > 0)
            };
        } else if (
            !opts &&
            cachedVertexDisplayOpts &&
            cachedVertexDisplayOpts.names.length === matrix.length &&
            cachedVertexDisplayOpts.fingerprint === matrixFingerprint(matrix)
        ) {
            opts = {
                names: [...cachedVertexDisplayOpts.names],
                labelInside: !!cachedVertexDisplayOpts.labelInside,
                explicitEdges: cachedVertexDisplayOpts.explicitEdges
                    ? cachedVertexDisplayOpts.explicitEdges.map((e) => ({ ...e }))
                    : null,
                renderStraightEdges:
                    cachedVertexDisplayOpts.renderStraightEdges !== undefined
                        ? cachedVertexDisplayOpts.renderStraightEdges
                        : !cachedVertexDisplayOpts.explicitEdges?.length
            };
        } else if (!opts && cachedVertexDisplayOpts && cachedVertexDisplayOpts.names.length !== matrix.length) {
            cachedVertexDisplayOpts = null;
        } else if (
            !opts &&
            cachedVertexDisplayOpts &&
            cachedVertexDisplayOpts.fingerprint !== matrixFingerprint(matrix)
        ) {
            cachedVertexDisplayOpts = null;
        }
        
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

        let multiModRendering = false;
        if (opts && Array.isArray(opts.explicitEdges) && opts.explicitEdges.length > 0) {
            graphData.edges = opts.explicitEdges.map((e) => ({
                from: e.from,
                to: e.to,
                weight: e.weight,
                isBidirectional: false
            }));
            multiModRendering = true;
        }
        graphData.renderStraightEdges = !multiModRendering;

        if (opts && opts.names && opts.names.length === graphData.numVertices) {
            for (let i = 0; i < graphData.numVertices; i++) {
                const v = graphData.vertices[i];
                graphData.vertices[i] = {
                    x: v.x,
                    y: v.y,
                    label: opts.names[i],
                    labelInside: !!opts.labelInside
                };
            }
        }
        
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
    cachedVertexDisplayOpts = null;
    if (graphCanvas) graphCanvas.setGraphData(null, null);
    document.getElementById('matrixInput').value = '';
    const vn = document.getElementById('vertexNamesInput');
    if (vn) vn.value = '';
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

/** Подписи на рёбрах тура: накопленная стоимость до конца ребра (ветви и границы / TSP). */
function computeTspEdgeLabels(path, matrix) {
    const labels = [];
    if (!path || path.length < 2 || !matrix) return labels;
    let acc = 0;
    for (let i = 0; i < path.length - 1; i++) {
        const a = path[i];
        const b = path[i + 1];
        const w = matrix[a] && matrix[a][b] !== undefined ? matrix[a][b] : 0;
        acc += w;
        labels.push({ from: a, to: b, value: acc });
    }
    return labels;
}

/** Подписи на рёбрах дерева кратчайших путей от start: на ребре parent→i — расстояние dist[i]. */
function buildDijkstraEdgeLabels(vertexDistances, vertexParents, start) {
    const labels = [];
    if (!vertexDistances || !vertexParents) return labels;
    for (let i = 0; i < vertexDistances.length; i++) {
        if (i === start) continue;
        const d = vertexDistances[i];
        if (d === null || d === undefined || !Number.isFinite(Number(d))) continue;
        const p = vertexParents[i];
        if (p === null || p === undefined || p < 0) continue;
        labels.push({ from: p, to: i, value: Number(d) });
    }
    return labels;
}

async function solveTSPGraph() {
    closeOptionsMenu();
    
    if (!currentGraphData) return showStatus('Сначала постройте граф', true);
    
    try {
        showStatus('Решение задачи коммивояжера...');
        const result = await window.cpp.solveTSP();
        
        if (result.path.length > 0) {
            showAlgorithmResult(`Оптимальный маршрут: ${result.path.join(' → ')} | Стоимость: ${result.cost.toFixed(2)}`);
            if (graphCanvas && currentMatrix) {
                graphCanvas.clearHighlights();
                graphCanvas.highlightPath(result.path);
                graphCanvas.setAlgorithmEdgeLabels(computeTspEdgeLabels(result.path, currentMatrix));
            } else if (graphCanvas) {
                graphCanvas.highlightPath(result.path);
            }
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

let rightLabels = [];
/** Режим венгерского алгоритма: false = минимизация суммы, true = максимизация */
let hungarianMaximize = false;

function solveHungarian() {
    closeOptionsMenu();
    
    if (!currentGraphData) return showStatus('Сначала постройте граф', true);
    
    showHungarianModeModal();
}

function showHungarianModeModal() {
    const modal = document.getElementById('hungarianModeModal');
    modal.classList.add('active');
}

function closeHungarianModeModal() {
    const modal = document.getElementById('hungarianModeModal');
    modal.classList.remove('active');
}

function chooseHungarianMode(maximize) {
    hungarianMaximize = !!maximize;
    closeHungarianModeModal();
    const summary = document.getElementById('hungarianModeSummary');
    if (summary) {
        summary.textContent = hungarianMaximize
            ? 'Выбрано: максимизация суммы (матрица эффективности).'
            : 'Выбрано: минимизация суммы (матрица затрат).';
        summary.style.color = hungarianMaximize ? '#27ae60' : '#2980b9';
    }
    showLabelsModal();
}

function showLabelsModal() {
    const modal = document.getElementById('labelsModal');
    modal.classList.add('active');
    document.getElementById('leftLabels').focus();
}

function closeLabelsModal() {
    const modal = document.getElementById('labelsModal');
    modal.classList.remove('active');
}

async function submitLabels() {
    closeLabelsModal();
    
    if (!currentGraphData) return showStatus('Сначала постройте граф', true);
    
    const leftInput = document.getElementById('leftLabels').value.trim();
    const rightInput = document.getElementById('rightLabels').value.trim();
    
    leftLabels = leftInput ? leftInput.split(/[,\n]+/).map(s => s.trim()).filter(s => s) : [];
    rightLabels = rightInput ? rightInput.split(/[,\n]+/).map(s => s.trim()).filter(s => s) : [];
    
    try {
        showStatus('Решение задачи о назначениях...');
        const result = await window.cpp.solveHungarian(currentMatrix, hungarianMaximize);
        
        // ОТЛАДКА: выводим матрицу и назначения
        console.log('Матрица стоимостей:');
        for (let i = 0; i < currentMatrix.length; i++) {
            console.log(`Работник ${i}:`, currentMatrix[i].join('\t'));
        }
        
        console.log('Назначения (assignment):', result.assignment);
        console.log('Стоимость:', result.cost);
        
        // Проверяем каждое назначение
        let calculatedCost = 0;
        for (let i = 0; i < result.assignment.length; i++) {
            const j = result.assignment[i];
            console.log(`Работник ${i} -> Задача ${j}, стоимость: ${currentMatrix[i][j]}`);
            calculatedCost += currentMatrix[i][j];
        }
        console.log('Рассчитанная стоимость:', calculatedCost);
        
        if (result.assignment && result.assignment.length > 0) {
            let assignmentStr = '';
            for (let i = 0; i < result.assignment.length; i++) {
                const j = result.assignment[i];
                const leftName = leftLabels[i] || `Работник ${i}`;
                const rightName = rightLabels[j] || `Задача ${j}`;
                assignmentStr += `${leftName}→${rightName}(${currentMatrix[i][j]})`;
                if (i < result.assignment.length - 1) assignmentStr += ', ';
            }
            
            const modeLabel = hungarianMaximize ? 'Макс. сумма' : 'Мин. сумма';
            showAlgorithmResult(`Назначения: ${assignmentStr} | ${modeLabel}: ${result.cost.toFixed(2)}`);
            rebuildGraphForAssignment(result);
        }
    } catch (e) {
        showStatus('Ошибка: ' + e.message, true);
    }
}

function rebuildGraphForAssignment(assignmentResult) {
    if (!currentMatrix) return;
    
    const n = assignmentResult.numVertices;
    console.log('rebuildGraphForAssignment - n:', n);
    console.log('assignment:', assignmentResult.assignment);
    if (graphCanvas) {
        graphCanvas.setColumnTitles(
            leftLabels.length > 0 ? 'Работники' : '',
            rightLabels.length > 0 ? 'Задачи' : ''
        );
    }
    
    const positions = [];
    const verticalSpacing = 120;
    const leftX = -200;
    const rightX = 200;
    const startY = -(n - 1) * verticalSpacing / 2;
    
    // Левая колонка
    for (let i = 0; i < n; i++) {
        positions.push({ 
            x: leftX, 
            y: startY + i * verticalSpacing,
            label: leftLabels[i] || null,
            side: 'left'
        });
    }
    
    // Правая колонка
    for (let i = 0; i < n; i++) {
        positions.push({ 
            x: rightX, 
            y: startY + i * verticalSpacing,
            label: rightLabels[i] || null,
            side: 'right'
        });
    }
    
    // Ребра только для назначенных пар
    const newEdges = [];
    for (let i = 0; i < assignmentResult.assignment.length; i++) {
        const j = assignmentResult.assignment[i];
        newEdges.push({
            from: i,
            to: n + j,
            weight: currentMatrix[i][j],
            isBidirectional: true
        });
    }
    
    const graphData = {
        vertices: positions,
        edges: newEdges,
        numVertices: n * 2
    };
    
    currentGraphData = graphData;
    if (graphCanvas) {
        graphCanvas.setGraphData(graphData, currentMatrix);
        
        // НЕ ИСПОЛЬЗУЕМ highlightPath!
        // Вместо этого добавляем специальный режим для паросочетаний
        graphCanvas.showMatching(newEdges);
    }

    for (let i = 0; i < assignmentResult.assignment.length; i++) {
        const j = assignmentResult.assignment[i];
        console.log(`Создаю ребро: ${i} -> ${n + j}, вес: ${currentMatrix[i][j]}`);
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

    const hadEdge = currentMatrix[from][to] !== 0;

    currentMatrix[from][to] = weight;

    if (bidirectional || (graphCanvas && graphCanvas.graphType === 'undirected')) {
        currentMatrix[to][from] = weight;
    }

    buildGraph(currentMatrix);

    closeSubmenu('addEdgeMenu');

    if (bidirectional || (graphCanvas && graphCanvas.graphType === 'undirected')) {
        showStatus(
            hadEdge
                ? `Вес ребра ${from}↔${to} обновлён: ${weight}`
                : `Добавлено ребро ${from}↔${to} (вес ${weight})`
        );
    } else {
        showStatus(
            hadEdge
                ? `Вес ребра ${from}→${to} обновлён: ${weight}`
                : `Добавлено ребро ${from}→${to} (вес ${weight})`
        );
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
    document.getElementById('createGraphMenu').addEventListener('click', (e) => e.stopPropagation());
    document.getElementById('editMenu').addEventListener('click', (e) => e.stopPropagation());
    document.getElementById('traversalSubmenu').addEventListener('click', (e) => e.stopPropagation());
    document.getElementById('shortestPathMenu').addEventListener('click', (e) => e.stopPropagation());
    document.getElementById('labelsModal').addEventListener('click', function(e) {
        if (e.target === this) closeLabelsModal();
    });
    document.getElementById('hungarianModeModal').addEventListener('click', function(e) {
        if (e.target === this) closeHungarianModeModal();
    });
    
    ['addVertexMenu', 'deleteVertexMenu', 'addEdgeMenu', 'deleteEdgeMenu'].forEach(menuId => {
        const menu = document.getElementById(menuId);
        if (menu) {
            menu.addEventListener('click', (e) => e.stopPropagation());
        }
    });
    
    showStatus('🖱️ Перетаскивайте вершины | 🖱️ Панорамируйте холст | 🔍 Колесико для зума | 2x клик на миникарте - центр');
});