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

/** Слоёвая раскладка для повторного buildGraph (rebuildGraph и смена типа графа) */
let cachedLayerLayout = null;

/** Граф загружен в формате Multi mod (список рёбер; матрица — суммарные веса) */
window.graphBuiltFromMultiMod = false;

function isMultiModGraphActive() {
    return !!window.graphBuiltFromMultiMod;
}

/**
 * @param {string} optionTitle — короткое название опции для сообщения
 * @returns {true} если нужно прервать действие
 */
function notifyIfMultiModBlocks(optionTitle) {
    if (!isMultiModGraphActive()) return false;
    showStatus(
        `«${optionTitle}» недоступна для графа из режима Multi mod: алгоритмы в «Опции» используют только матрицу смежности (одно число на пару вершин), а не отдельные параллельные рёбра из списка. Постройте граф без галочки Multi mod или нажмите «Очистить».`,
        true
    );
    return true;
}

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
    const guardTitle = type === 'bfs' ? 'BFS (поиск в ширину)' : 'DFS (поиск в глубину)';
    if (notifyIfMultiModBlocks(guardTitle)) return;
    closeOptionsMenu();
    
    selectedTraversalType = type;
    
    const menu = document.getElementById('traversalSubmenu');
    const titleEl = document.getElementById('traversalSubmenuTitle');
    
    if (type === 'bfs') {
        titleEl.textContent = 'BFS - Поиск в ширину';
    } else {
        titleEl.textContent = 'DFS - Поиск в глубину';
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

    if (notifyIfMultiModBlocks(selectedTraversalType === 'bfs' ? 'BFS' : 'DFS')) return;
    
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
    if (notifyIfMultiModBlocks('Кратчайший путь (Дейкстра)')) return;
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

    if (notifyIfMultiModBlocks('Кратчайший путь (Дейкстра)')) return;
    
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
    const title = type === 'kruskal' ? 'MST (Краскал)' : 'MST (Прим)';
    if (notifyIfMultiModBlocks(title)) return;
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

function updateLayerLayoutModalVisibility() {
    const multi = document.getElementById('graphCbMultiMod').checked;
    const layerBlock = document.getElementById('layerLayoutBlock');
    const layerCb = document.getElementById('graphCbLayerLayout');
    const sizesBlock = document.getElementById('layerSizesBlock');
    if (!layerBlock) return;
    if (multi) {
        layerBlock.style.display = 'none';
        if (layerCb) layerCb.checked = false;
        if (sizesBlock) sizesBlock.style.display = 'none';
    } else {
        layerBlock.style.display = 'block';
        if (sizesBlock) sizesBlock.style.display = layerCb && layerCb.checked ? 'block' : 'none';
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
            'Петля: одинаковые f и l, например <code>3 3 5</code>.<br>' +
            '<em>Для алгоритмов в «Опции» несколько дуг с одной парой (f,l) дают в матрице один вес — <strong>минимум</strong> по v; на холсте кратные рёбра остаются отдельными.</em>';
        namesBlock.style.display = 'none';
    } else {
        title.textContent = 'Введите матрицу смежности';
        help.innerHTML =
            'Квадратная матрица весов. Пример:<br>' +
            '0 1.5 0 2.3 1<br>1.5 0 1.0 0 8<br>0 1.0 0 1.7 7<br>2.3 0 1.7 0 4<br>0 0 0 0 0';
        namesBlock.style.display = nonArb ? 'block' : 'none';
    }
    updateLayerLayoutModalVisibility();
}

function parseLayerSizes(text) {
    const parts = text.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) {
        throw new Error('Укажите количество вершин на каждой линии, например: 1 2 3 2 1');
    }
    return parts.map((p, i) => {
        const n = parseInt(p, 10);
        if (Number.isNaN(n) || n < 1 || !Number.isInteger(n)) {
            throw new Error(`Число ${i + 1} в раскладке должно быть целым ≥ 1`);
        }
        return n;
    });
}

/**
 * Последовательное заполнение слоёв слева направо: сначала все вершины 1-й линии,
 * затем 2-й и т.д. Внутри линии — сверху вниз (slot 0 — верх).
 * Пример «1 3 3 1», 8 вершин: L0=[0], L1=[1,2,3], L2=[4,5,6], L3=[7].
 */
function assignVerticesToLayers(layerSizes, numVertices) {
    const sum = layerSizes.reduce((a, b) => a + b, 0);
    if (sum !== numVertices) {
        throw new Error(
            `Сумма чисел в раскладке (${sum}) должна равняться числу вершин в матрице (${numVertices})`
        );
    }
    const slotByVertex = [];
    let v = 0;
    for (let layer = 0; layer < layerSizes.length; layer++) {
        for (let slot = 0; slot < layerSizes[layer]; slot++) {
            slotByVertex[v] = { layer, slot };
            v++;
        }
    }
    return slotByVertex;
}

function applyLayerLayoutToGraph(graphData, layerSizes) {
    const n = graphData.numVertices;
    const slotByVertex = assignVerticesToLayers(layerSizes, n);
    const numLayers = layerSizes.length;
    const maxPerLayer = Math.max(...layerSizes);

    const layerSpacing =
        numLayers <= 1 ? 0 : Math.min(130, Math.max(88, 980 / (numLayers - 1)));
    const verticalSpacing = Math.min(120, Math.max(78, 520 / Math.max(1, maxPerLayer - 1)));

    const totalWidth = (numLayers - 1) * layerSpacing;
    const startX = -totalWidth / 2;
    const midRow = (maxPerLayer - 1) / 2;

    for (let i = 0; i < n; i++) {
        const { layer, slot } = slotByVertex[i];
        const countOnLayer = layerSizes[layer];
        const startRow = (maxPerLayer - countOnLayer) / 2;
        const row = startRow + slot;
        const prev = graphData.vertices[i];
        graphData.vertices[i] = {
            x: startX + layer * layerSpacing,
            y: (row - midRow) * verticalSpacing,
            label: prev.label,
            labelInside: prev.labelInside,
            side: prev.side
        };
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

/**
 * Multi mod: список дуг «f l v» (1-based). На холсте — все explicitEdges.
 * Матрица для аддона (Дейкстра, TSP, MST, …): на каждую ориентированную пару (i,j) — минимум v по всем дугам
 * с этой парой (один шаг i→j = одна дуга). Петли (f===l): то же — минимум по всем петлям на вершине.
 *
 * Ручная проверка: две строки «1 2 1» и «1 2 100» → matrix[0][1] === 1 (не 101).
 * Нулевой вес: первая дуга 0, вторая 5 → min(0,5)=0 (флаг hasEdge, не «ещё нет ребра»).
 */
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
    const hasEdge = Array.from({ length: n }, () => Array(n).fill(false));
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
        if (!hasEdge[fi][li0]) {
            matrix[fi][li0] = v;
            hasEdge[fi][li0] = true;
        } else {
            matrix[fi][li0] = Math.min(matrix[fi][li0], v);
        }
        explicitEdges.push({ from: fi, to: li0, weight: v });
    }
    return { matrix, vertexNames: nameTokens, explicitEdges };
}

function parseAndBuildGraphFromContent(content) {
    const multi = document.getElementById('graphCbMultiMod').checked;
    const nonArb = document.getElementById('graphCbNonArbitrary').checked;
    const namesText = document.getElementById('vertexNamesInput').value;
    const layerLayout = document.getElementById('graphCbLayerLayout')?.checked;

    if (multi) {
        if (layerLayout) {
            throw new Error('Слоёвая раскладка недоступна для режима Multi mod');
        }
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
    if (layerLayout) {
        const layerSizes = parseLayerSizes(document.getElementById('layerSizesInput').value);
        displayOpts = displayOpts || {};
        displayOpts.layerSizes = layerSizes;
    } else {
        cachedLayerLayout = null;
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
        window.graphBuiltFromMultiMod = false;

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

        const fp = matrixFingerprint(matrix);
        let layerSizesToApply = opts && opts.layerSizes ? opts.layerSizes : null;
        if (!layerSizesToApply && cachedLayerLayout && cachedLayerLayout.fingerprint === fp) {
            layerSizesToApply = cachedLayerLayout.sizes;
        }
        if (layerSizesToApply) {
            applyLayerLayoutToGraph(graphData, layerSizesToApply);
            cachedLayerLayout = { sizes: [...layerSizesToApply], fingerprint: fp };
            if (graphCanvas) graphCanvas.setColumnTitles('', '');
        } else {
            cachedLayerLayout = null;
        }
        
        if (graphCanvas) graphCanvas.setGraphData(graphData, matrix);
        if (graphCanvas) graphCanvas.setMaxFlowEdgeLabels(null);
        showStatus(`Граф: ${graphData.numVertices} вершин, ${graphData.edges.length} рёбер`);

        window.graphBuiltFromMultiMod = !!(
            opts &&
            Array.isArray(opts.explicitEdges) &&
            opts.explicitEdges.length > 0
        );
    } catch (e) {
        showStatus('Ошибка: ' + e.message, true);
    }
}

async function checkConnectivity() {
    if (notifyIfMultiModBlocks('Проверить связность')) return;
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
    cachedLayerLayout = null;
    window.graphBuiltFromMultiMod = false;
    if (graphCanvas) graphCanvas.setGraphData(null, null);
    document.getElementById('matrixInput').value = '';
    const vn = document.getElementById('vertexNamesInput');
    if (vn) vn.value = '';
    const layerCb = document.getElementById('graphCbLayerLayout');
    const layerInp = document.getElementById('layerSizesInput');
    if (layerCb) layerCb.checked = false;
    if (layerInp) layerInp.value = '';
    updateLayerLayoutModalVisibility();
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
    if (notifyIfMultiModBlocks('Проверить на эйлеровость')) return;
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
    if (notifyIfMultiModBlocks('Найти эйлеров цикл')) return;
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
    if (notifyIfMultiModBlocks('Задача коммивояжера')) return;
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

function showMaxFlowModal() {
    if (notifyIfMultiModBlocks('Максимальный поток')) return;
    closeOptionsMenu();
    if (!currentGraphData) return showStatus('Сначала постройте граф', true);

    const n = currentGraphData.numVertices;
    const srcEl = document.getElementById('maxFlowSource');
    const sinkEl = document.getElementById('maxFlowSink');
    if (srcEl) srcEl.max = n - 1;
    if (sinkEl) {
        sinkEl.max = n - 1;
        if (parseInt(sinkEl.value, 10) >= n) sinkEl.value = String(n - 1);
    }

    document.getElementById('maxFlowModal').classList.add('active');
}

function closeMaxFlowModal() {
    document.getElementById('maxFlowModal').classList.remove('active');
}

function getSelectedMaxFlowMode() {
    const picked = document.querySelector('input[name="maxFlowMode"]:checked');
    return picked ? picked.value : 'saturation';
}

async function runMaxFlowSolve() {
    if (!currentMatrix || !currentGraphData) {
        showStatus('Сначала постройте граф', true);
        return;
    }

    const n = currentMatrix.length;
    const source = parseInt(document.getElementById('maxFlowSource').value, 10);
    const sink = parseInt(document.getElementById('maxFlowSink').value, 10);
    const mode = getSelectedMaxFlowMode();

    if (Number.isNaN(source) || source < 0 || source >= n) {
        showStatus('Некорректный исток', true);
        return;
    }
    if (Number.isNaN(sink) || sink < 0 || sink >= n) {
        showStatus('Некорректный сток', true);
        return;
    }
    if (source === sink) {
        showStatus('Исток и сток должны различаться', true);
        return;
    }

    if (graphCanvas && graphCanvas.graphType !== 'directed') {
        setGraphType('directed');
        const dirRadio = document.querySelector('input[name="graphType"][value="directed"]');
        if (dirRadio) dirRadio.checked = true;
    }

    try {
        showStatus('Расчёт максимального потока...');
        const result = await window.cpp.solveMaxFlow(currentMatrix, source, sink, mode);

        closeMaxFlowModal();

        if (graphCanvas) {
            graphCanvas.clearHighlights();
            graphCanvas.setMaxFlowEdgeLabels(result.edges);
            graphCanvas.highlightVertices([source, sink]);
        }

        const modeLabel =
            mode === 'saturation' || mode === 'saturate'
                ? 'насыщение потока'
                : 'финальный результат';
        showAlgorithmResult(
            `Поток в сети (${modeLabel}): ${Number(result.maxFlow).toFixed(1)} | исток ${source} → сток ${sink}`
        );
        showStatus(`Поток в сети: ${Number(result.maxFlow).toFixed(1)} (${modeLabel})`);
    } catch (e) {
        showStatus('Ошибка: ' + e.message, true);
    }
}

function fillMaxFlowExample() {
    const matrix = [
        [0, 6, 6, 0, 0, 0, 0, 0],
        [0, 0, 0, 6, 2, 0, 0, 0],
        [0, 0, 0, 5, 8, 0, 0, 0],
        [0, 0, 0, 0, 0, 2, 9, 0],
        [0, 0, 0, 0, 0, 0, 11, 7],
        [0, 0, 0, 0, 0, 0, 0, 4],
        [0, 0, 0, 0, 0, 0, 0, 4],
        [0, 0, 0, 0, 0, 0, 0, 0]
    ];

    document.getElementById('graphCbLayerLayout').checked = true;
    document.getElementById('layerSizesInput').value = '1 3 3 1';
    document.getElementById('maxFlowSource').value = '0';
    document.getElementById('maxFlowSink').value = '7';

    const dirRadio = document.querySelector('input[name="graphType"][value="directed"]');
    if (dirRadio) dirRadio.checked = true;
    setGraphType('directed');

    buildGraph(matrix, { layerSizes: [1, 3, 3, 1] });
    showStatus('Пример из учебника (стр. 62–64): слои 1 3 3 1, исток 0, сток 7. Нажмите «Решить».');
}

function solveHungarian() {
    if (notifyIfMultiModBlocks('Венгерский алгоритм')) return;
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
    window.graphBuiltFromMultiMod = false;
    cachedVertexDisplayOpts = null;
    cachedLayerLayout = null;
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

function transportCostToColor(cij, cMin, cMax) {
    if (cMax <= cMin + 1e-9) return 'hsl(205, 72%, 42%)';
    const t = (cij - cMin) / (cMax - cMin);
    const hue = 205 * (1 - t);
    return `hsl(${hue}, 74%, 40%)`;
}

function parseTransportProblemText(raw) {
    const lines = raw
        .split(/\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0 && !l.startsWith('#'));
    if (lines.length < 4) {
        throw new Error('Нужны строка m n, m строк тарифов, строка запасов, строка спроса');
    }
    const head = lines[0].split(/\s+/).map(Number);
    const m = head[0];
    const n = head[1];
    if (head.length !== 2 || !Number.isInteger(m) || !Number.isInteger(n) || m < 1 || n < 1) {
        throw new Error('Первая строка: два положительных целых числа m и n');
    }
    if (lines.length < 1 + m + 2) {
        throw new Error(`После «m n» ожидается ${m} строк матрицы и две строки запасов и спроса`);
    }
    const costs = [];
    for (let i = 0; i < m; i++) {
        const row = lines[1 + i].split(/\s+/).map(Number);
        if (row.length !== n || row.some((x) => Number.isNaN(x))) {
            throw new Error(`Строка матрицы ${i + 1}: ровно ${n} чисел`);
        }
        costs.push(row);
    }
    const supplies = lines[1 + m].split(/\s+/).map(Number);
    const demands = lines[2 + m].split(/\s+/).map(Number);
    if (supplies.length !== m || supplies.some((x) => Number.isNaN(x))) {
        throw new Error(`Строка запасов: ровно ${m} чисел`);
    }
    if (demands.length !== n || demands.some((x) => Number.isNaN(x))) {
        throw new Error(`Строка спроса: ровно ${n} чисел`);
    }
    return { m, n, costs, supplies, demands };
}

function showTransportProblemModal() {
    closeOptionsMenu();
    document.getElementById('transportProblemModal').classList.add('active');
}

function closeTransportProblemModal() {
    document.getElementById('transportProblemModal').classList.remove('active');
}

function fillTransportExample() {
    const ta = document.getElementById('transportProblemInput');
    if (ta && typeof transportExampleText === 'function') ta.value = transportExampleText();
}

function runTransportProblemSolve() {
    const ta = document.getElementById('transportProblemInput');
    if (!ta) return;
    try {
        const { costs, supplies, demands } = parseTransportProblemText(ta.value);
        if (typeof solveTransportProblem !== 'function') {
            throw new Error('Не загружен transport-solver.js');
        }
        const sol = solveTransportProblem(supplies, demands, costs);
        closeTransportProblemModal();
        applyTransportSolutionToCanvas(sol);
        let msg = `Оптимальный план: сумма cᵢⱼ·xᵢⱼ = ${sol.totalCost.toFixed(4)}. `;
        if (sol.note) msg += sol.note + ' ';
        msg += 'На графе: толщина ребра ∼ xᵢⱼ, цвет ∼ тариф cᵢⱼ, подпись — x, c и вклад c·x.';
        showAlgorithmResult(msg);
    } catch (e) {
        showStatus('Транспортная задача: ' + e.message, true);
    }
}

function applyTransportSolutionToCanvas(sol) {
    cachedVertexDisplayOpts = null;
    cachedLayerLayout = null;
    window.graphBuiltFromMultiMod = false;

    const mE = sol.mExt;
    const nE = sol.nExt;
    const x = sol.xExtended;
    const c = sol.costExtended;
    const aExt = sol.suppliesExtended;
    const bExt = sol.demandsExtended;

    let cMin = Infinity;
    let cMax = -Infinity;
    for (let i = 0; i < mE; i++) {
        for (let j = 0; j < nE; j++) {
            if (x[i][j] > 1e-6) {
                cMin = Math.min(cMin, c[i][j]);
                cMax = Math.max(cMax, c[i][j]);
            }
        }
    }
    if (!Number.isFinite(cMin)) {
        cMin = 0;
        cMax = 1;
    }

    let maxFlow = 0;
    for (let i = 0; i < mE; i++) {
        for (let j = 0; j < nE; j++) {
            maxFlow = Math.max(maxFlow, x[i][j]);
        }
    }
    if (maxFlow < 1e-9) maxFlow = 1;

    const leftX = -300;
    const rightX = 300;
    const rows = Math.max(mE, nE);
    const vStep = Math.max(52, Math.min(88, 440 / rows));
    const startY = -((rows - 1) * vStep) / 2;

    const vertices = [];
    for (let i = 0; i < mE; i++) {
        const name = i < sol.mOrig ? `О${i + 1}` : 'Фикт. отпр.';
        vertices.push({
            x: leftX,
            y: startY + i * vStep,
            labelLines: [name, `a=${aExt[i]}`],
            labelInside: true
        });
    }
    const offsetR = mE;
    for (let j = 0; j < nE; j++) {
        const name = j < sol.nOrig ? `П${j + 1}` : 'Фикт. назн.';
        vertices.push({
            x: rightX,
            y: startY + j * vStep,
            labelLines: [name, `b=${bExt[j]}`],
            labelInside: true
        });
    }

    const edgesOverlay = [];
    for (let i = 0; i < mE; i++) {
        for (let j = 0; j < nE; j++) {
            const f = x[i][j];
            if (f < 1e-6) continue;
            const lw = 2 + 9 * (f / maxFlow);
            const col = transportCostToColor(c[i][j], cMin, cMax);
            const prod = f * c[i][j];
            const label =
                `x=${f < 9.995 ? f.toFixed(2) : f.toFixed(1)}\n` +
                `c=${c[i][j]}, c·x=${prod < 99.5 ? prod.toFixed(1) : prod.toFixed(0)}`;
            edgesOverlay.push({
                from: i,
                to: offsetR + j,
                lineWidth: lw,
                color: col,
                label
            });
        }
    }

    const numVertices = mE + nE;
    const matrixPad = Array.from({ length: numVertices }, () => Array(numVertices).fill(0));

    const graphData = {
        vertices,
        edges: [],
        numVertices,
        renderStraightEdges: true
    };

    currentGraphData = graphData;
    currentMatrix = matrixPad;
    window.currentGraphData = graphData;
    window.currentMatrix = matrixPad;

    if (graphCanvas) {
        graphCanvas.setColumnTitles('Пункты отправления (запас)', 'Пункты назначения (спрос)');
        graphCanvas.setGraphData(graphData, matrixPad);
        graphCanvas.setTransportOverlayEdges(edgesOverlay);
    }
    showStatus(`Транспортная задача: план с ${edgesOverlay.length} ненулевыми перевозками`);
}

// Экспорт в глобальную область
window.rebuildGraph = rebuildGraph;
window.showStatus = showStatus;
window.showTransportProblemModal = showTransportProblemModal;
window.closeTransportProblemModal = closeTransportProblemModal;
window.fillTransportExample = fillTransportExample;
window.runTransportProblemSolve = runTransportProblemSolve;
window.showMaxFlowModal = showMaxFlowModal;
window.closeMaxFlowModal = closeMaxFlowModal;
window.runMaxFlowSolve = runMaxFlowSolve;
window.fillMaxFlowExample = fillMaxFlowExample;

// Инициализация после загрузки DOM
document.addEventListener('DOMContentLoaded', () => {
    // Создаем graphCanvas
    graphCanvas = new InteractiveGraphCanvas();
    
    // Обработчик закрытия модального окна
    document.getElementById('inputModal').addEventListener('click', function(e) {
        if (e.target === this) closeModal();
    });

    const multiCb = document.getElementById('graphCbMultiMod');
    const layerCb = document.getElementById('graphCbLayerLayout');
    if (multiCb) {
        multiCb.addEventListener('change', () => {
            updateInputModalForOptions();
        });
    }
    if (layerCb) {
        layerCb.addEventListener('change', updateLayerLayoutModalVisibility);
    }
    
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
    document.getElementById('maxFlowModal').addEventListener('click', function(e) {
        if (e.target === this) closeMaxFlowModal();
    });
    document.getElementById('transportProblemModal').addEventListener('click', function(e) {
        if (e.target === this) closeTransportProblemModal();
    });
    const transportContent = document.querySelector('#transportProblemModal .modal-content');
    if (transportContent) transportContent.addEventListener('click', (e) => e.stopPropagation());
    
    ['addVertexMenu', 'deleteVertexMenu', 'addEdgeMenu', 'deleteEdgeMenu'].forEach(menuId => {
        const menu = document.getElementById(menuId);
        if (menu) {
            menu.addEventListener('click', (e) => e.stopPropagation());
        }
    });
    
    showStatus(
        '🖱️ Перетаскивайте вершины | 🖱️ Панорамируйте холст | 🔍 Колесико для зума | 2x клик на миникарте — центр | Ctrl+Shift+A — новая вершина'
    );
});