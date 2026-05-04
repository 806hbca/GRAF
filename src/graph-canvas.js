// graph-canvas.js
class InteractiveGraphCanvas {
    constructor() {
        this.canvas = document.getElementById('graphCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.container = document.getElementById('canvas-container');
        this.columnTitles = null;
        this.minimapCanvas = document.getElementById('minimapCanvas');
        this.minimapCtx = this.minimapCanvas.getContext('2d');
        this.minimapContainer = document.getElementById('minimap');
        this.matchingEdges = null;
        /** @type {{from:number,to:number,lineWidth:number,color:string,label:string}[]|null} */
        this.transportOverlayEdges = null;
        this.camera = { x: 0, y: 0, zoom: 1 };
        this.targetCamera = { x: 0, y: 0, zoom: 1 };
        
        this.mouse = {
            x: 0, y: 0, worldX: 0, worldY: 0,
            isPanning: false, panStartX: 0, panStartY: 0,
            cameraStartX: 0, cameraStartY: 0,
            isDraggingNode: false, dragNodeIndex: -1,
            dragStartX: 0, dragStartY: 0
        };
        
        this.currentGraphData = null;
        this.currentMatrix = null;
        this.graphType = 'undirected';
        this.vertexPositions = [];
        this.animationId = null;
        this.gridSize = 50;
        this.highlightedVertices = [];
        this.highlightedPath = [];
        /** Подписи алгоритмов по рёбрам: [{ from, to, value }, ...] — точка как у веса ребра */
        this.algorithmEdgeLabels = null;
        
        this.shiftPressed = false;
        this.shiftFirstVertex = null;
        this.selectedVertexIndex = null;
        
        this.init();
    }
    setColumnTitles(leftTitle, rightTitle) {
        this.columnTitles = {
            left: leftTitle,
            right: rightTitle
        };
    }
    init() {
        this.resizeCanvas();
        this.setupEventListeners();
        this.animate();
    }
    
    resizeCanvas() {
        const rect = this.container.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        this.minimapCanvas.width = 200;
        this.minimapCanvas.height = 150;
    }
    
    showMatching(edges) {
        // Очищаем все подсветки
        this.highlightedPath = [];
        this.highlightedVertices = [];
        
        // Сохраняем ребра паросочетания
        this.matchingEdges = edges;
        this.algorithmEdgeLabels = null;
    }

    applyCursor(type) {
        // Создаем кастомный черный курсор через canvas
        const cursorCanvas = document.createElement('canvas');
        cursorCanvas.width = 32;
        cursorCanvas.height = 32;
        const cursorCtx = cursorCanvas.getContext('2d');
        
        // Рисуем черную стрелку
        cursorCtx.fillStyle = '#000000';
        cursorCtx.strokeStyle = '#ffffff';
        cursorCtx.lineWidth = 1.5;
        cursorCtx.beginPath();
        cursorCtx.moveTo(5, 3);
        cursorCtx.lineTo(5, 25);
        cursorCtx.lineTo(12, 20);
        cursorCtx.lineTo(18, 28);
        cursorCtx.lineTo(21, 26);
        cursorCtx.lineTo(15, 18);
        cursorCtx.lineTo(22, 16);
        cursorCtx.closePath();
        cursorCtx.fill();
        cursorCtx.stroke();
        
        const dataUrl = cursorCanvas.toDataURL();
        
        const cursors = {
            'grab': `url(${dataUrl}) 5 3, grab`,
            'grabbing': `url(${dataUrl}) 5 3, grabbing`,
            'move': `url(${dataUrl}) 5 3, move`,
            'pointer': `url(${dataUrl}) 5 3, pointer`
        };
        
        this.canvas.style.cursor = cursors[type] || 'default';
    }
    
    setupEventListeners() {
        window.addEventListener('resize', () => this.resizeCanvas());
        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        window.addEventListener('mousemove', (e) => this.onMouseMove(e));
        window.addEventListener('mouseup', (e) => this.onMouseUp(e));
        this.canvas.addEventListener('wheel', (e) => this.onWheel(e));
        this.canvas.addEventListener('contextmenu', (e) => this.onContextMenu(e));
        window.addEventListener('keydown', (e) => this.onKeyDown(e));
        window.addEventListener('keyup', (e) => this.onKeyUp(e));
        this.minimapContainer.addEventListener('dblclick', () => this.centerView());
    }
    
    screenToWorld(screenX, screenY) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: (screenX - rect.left - this.camera.x) / this.camera.zoom,
            y: (screenY - rect.top - this.camera.y) / this.camera.zoom
        };
    }
    
    findVertexAt(worldX, worldY) {
        if (!this.currentGraphData || !this.vertexPositions.length) return -1;
        const radius = 25 / this.camera.zoom;
        for (let i = this.vertexPositions.length - 1; i >= 0; i--) {
            const pos = this.vertexPositions[i];
            const dx = pos.x - worldX;
            const dy = pos.y - worldY;
            if (dx * dx + dy * dy <= radius * radius) return i;
        }
        return -1;
    }
    
    centerView() {
        if (!this.currentGraphData || !this.vertexPositions.length) {
            const rect = this.container.getBoundingClientRect();
            this.targetCamera.x = rect.width / 2;
            this.targetCamera.y = rect.height / 2;
            this.targetCamera.zoom = 1;
            return;
        }
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        this.vertexPositions.forEach(pos => {
            minX = Math.min(minX, pos.x - 50);
            minY = Math.min(minY, pos.y - 50);
            maxX = Math.max(maxX, pos.x + 50);
            maxY = Math.max(maxY, pos.y + 50);
        });
        const graphWidth = maxX - minX;
        const graphHeight = maxY - minY;
        const rect = this.container.getBoundingClientRect();
        const zoomX = rect.width / graphWidth;
        const zoomY = rect.height / graphHeight;
        this.targetCamera.zoom = Math.min(zoomX, zoomY, 1.5);
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        this.targetCamera.x = rect.width / 2 - centerX * this.targetCamera.zoom;
        this.targetCamera.y = rect.height / 2 - centerY * this.targetCamera.zoom;
    }
    
    onMouseDown(e) {
        if (e.target !== this.canvas) return;
        const worldPos = this.screenToWorld(e.clientX, e.clientY);
        const vertexIndex = this.findVertexAt(worldPos.x, worldPos.y);
        if (vertexIndex !== -1) {
            this.mouse.isDraggingNode = true;
            this.mouse.dragNodeIndex = vertexIndex;
            this.mouse.dragStartX = worldPos.x;
            this.mouse.dragStartY = worldPos.y;
            this.applyCursor('grabbing');
        } else {
            this.mouse.isPanning = true;
            this.mouse.panStartX = e.clientX;
            this.mouse.panStartY = e.clientY;
            this.mouse.cameraStartX = this.targetCamera.x;
            this.mouse.cameraStartY = this.targetCamera.y;
            this.applyCursor('grabbing');
        }
    }
    
    onMouseMove(e) {
        const worldPos = this.screenToWorld(e.clientX, e.clientY);
        this.mouse.worldX = worldPos.x;
        this.mouse.worldY = worldPos.y;
        
        document.getElementById('coordinates').textContent = 
            `X: ${Math.round(worldPos.x)}, Y: ${Math.round(worldPos.y)} | Масштаб: ${Math.round(this.camera.zoom * 100)}%`;
        
        if (this.mouse.isDraggingNode && this.mouse.dragNodeIndex !== -1) {
            const dx = worldPos.x - this.mouse.dragStartX;
            const dy = worldPos.y - this.mouse.dragStartY;
            this.vertexPositions[this.mouse.dragNodeIndex].x += dx;
            this.vertexPositions[this.mouse.dragNodeIndex].y += dy;
            this.mouse.dragStartX = worldPos.x;
            this.mouse.dragStartY = worldPos.y;
            if (this.currentGraphData) {
                const idx = this.mouse.dragNodeIndex;
                const prev = this.currentGraphData.vertices[idx] || {};
                this.currentGraphData.vertices[idx] = {
                    ...prev,
                    x: this.vertexPositions[idx].x,
                    y: this.vertexPositions[idx].y
                };
            }
        }
        if (this.mouse.isPanning) {
            const dx = e.clientX - this.mouse.panStartX;
            const dy = e.clientY - this.mouse.panStartY;
            this.targetCamera.x = this.mouse.cameraStartX + dx;
            this.targetCamera.y = this.mouse.cameraStartY + dy;
        }
        if (!this.mouse.isDraggingNode && !this.mouse.isPanning) {
            this.applyCursor(this.findVertexAt(worldPos.x, worldPos.y) !== -1 ? 'move' : 'grab');
        }
    }
    
    onMouseUp(e) {
        this.mouse.isPanning = false;
        this.mouse.isDraggingNode = false;
        this.mouse.dragNodeIndex = -1;
        this.applyCursor('grab');
    }
    
    onWheel(e) {
        e.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const zoomFactor = 1.1;
        const oldZoom = this.targetCamera.zoom;
        this.targetCamera.zoom *= e.deltaY < 0 ? zoomFactor : 1 / zoomFactor;
        this.targetCamera.zoom = Math.min(Math.max(0.1, this.targetCamera.zoom), 5);
        const zoomChange = this.targetCamera.zoom / oldZoom;
        this.targetCamera.x = mouseX - (mouseX - this.targetCamera.x) * zoomChange;
        this.targetCamera.y = mouseY - (mouseY - this.targetCamera.y) * zoomChange;
    }
    
    onContextMenu(e) {
        e.preventDefault();
        if (!this.currentGraphData) return;
        const worldPos = this.screenToWorld(e.clientX, e.clientY);
        const vertexIndex = this.findVertexAt(worldPos.x, worldPos.y);
        if (vertexIndex !== -1) {
            if (this.shiftPressed) {
                if (this.shiftFirstVertex === null) {
                    this.shiftFirstVertex = vertexIndex;
                    if (typeof showStatus === 'function') showStatus(`Первая вершина: ${vertexIndex}. Выберите вторую.`);
                } else {
                    const from = this.shiftFirstVertex;
                    const to = vertexIndex;
                    if (from !== to) this.addBidirectionalEdge(from, to);
                    this.shiftFirstVertex = null;
                }
            } else {
                this.selectedVertexIndex = vertexIndex;
                if (typeof showStatus === 'function') showStatus(`Вершина ${vertexIndex} выделена. Нажмите Delete.`);
            }
        }
    }
    
    onKeyDown(e) {
        if (e.key === 'Shift') {
            this.shiftPressed = true;
        }
        
        // Ctrl + Shift + A: добавить вершину
        if ((e.key === 'a' || e.key === 'A') && e.ctrlKey && e.shiftKey) {
            e.preventDefault();
            e.stopPropagation();
            this.addVertexAtCenter();
            return;
        }
        
        if ((e.key === 'Delete' || e.key === 'Del') && this.selectedVertexIndex !== null) {
            this.deleteSelectedVertex();
        }
        
        if (e.key === 'Escape') { 
            this.shiftFirstVertex = null; 
            this.selectedVertexIndex = null; 
            if (typeof showStatus === 'function') showStatus('Сброшено'); 
        }
    }
    
    onKeyUp(e) {
        if (e.key === 'Shift') { this.shiftPressed = false; this.shiftFirstVertex = null; }
    }
    
    addVertexAtCenter() {
        // Используем глобальную currentMatrix через window
        const matrix = window.currentMatrix || currentMatrix;
        
        if (!matrix) {
            if (typeof showStatus === 'function') {
                showStatus('Сначала постройте граф', true);
            }
            return;
        }
        
        const n = matrix.length;
        const newMatrix = [];
        
        for (let i = 0; i < n; i++) {
            const newRow = [...matrix[i], 0];
            newMatrix.push(newRow);
        }
        
        const newRow = new Array(n + 1).fill(0);
        newMatrix.push(newRow);
        
        // Обновляем глобальную матрицу
        if (typeof window.currentMatrix !== 'undefined') {
            window.currentMatrix = newMatrix;
        }
        
        // Вызываем перестроение графа
        if (typeof window.rebuildGraph === 'function') {
            window.rebuildGraph(newMatrix);
        } else if (typeof rebuildGraph === 'function') {
            rebuildGraph(newMatrix);
        }
        
        if (typeof showStatus === 'function') {
            showStatus(`Вершина ${n} добавлена. Всего: ${n + 1}`);
        }
    }
    addBidirectionalEdge(from, to) {
        if (!this.currentMatrix) return;
        const weight = this.currentMatrix[from][to] || this.currentMatrix[to][from] || 1;
        this.currentMatrix[from][to] = weight;
        this.currentMatrix[to][from] = weight;
        if (typeof window.rebuildGraph === 'function') window.rebuildGraph(this.currentMatrix);
        if (typeof showStatus === 'function') showStatus(`Ребро ${from}↔${to} (вес: ${weight})`);
    }
    
    deleteSelectedVertex() {
        if (this.selectedVertexIndex === null || !this.currentMatrix) return;
        const idx = this.selectedVertexIndex;
        const n = this.currentMatrix.length;
        if (n <= 1) return;
        const newMatrix = [];
        for (let i = 0; i < n; i++) {
            if (i === idx) continue;
            const row = [];
            for (let j = 0; j < n; j++) if (j !== idx) row.push(this.currentMatrix[i][j]);
            newMatrix.push(row);
        }
        this.currentMatrix = newMatrix;
        this.selectedVertexIndex = null;
        if (typeof window.rebuildGraph === 'function') window.rebuildGraph(this.currentMatrix);
        if (typeof showStatus === 'function') showStatus(`Вершина ${idx} удалена`);
    }
    
    setGraphData(graphData, matrix) {
        this.currentGraphData = graphData;
        this.currentMatrix = matrix;
        this.clearHighlights();
        this.vertexPositions = graphData.vertices.map(v => ({ x: v.x, y: v.y }));
        this.centerView();
    }
    
    setGraphType(type) { this.graphType = type; }
    
    clearHighlights() {
        this.highlightedVertices = [];
        this.highlightedPath = [];
        this.matchingEdges = null;
        this.transportOverlayEdges = null;
        this.algorithmEdgeLabels = null;
    }

    /**
     * Рёбра транспортной задачи: толщина по x_ij, цвет по c_ij, подпись на ребре.
     * @param {{from:number,to:number,lineWidth:number,color:string,label:string}[]|null} edges
     */
    setTransportOverlayEdges(edges) {
        this.transportOverlayEdges = edges && edges.length ? edges : null;
    }
    highlightVertices(v) {
        this.highlightedVertices = v;
        this.highlightedPath = [];
        this.algorithmEdgeLabels = null;
    }
    highlightPath(p) {
        this.highlightedPath = p;
        this.highlightedVertices = [];
        this.algorithmEdgeLabels = null;
    }

    /** @param {{from:number,to:number,value:number}[]} entries */
    setAlgorithmEdgeLabels(entries) {
        this.algorithmEdgeLabels = entries && entries.length ? entries : null;
    }
    
    isEdgeInPath(from, to) {
        for (let i = 0; i < this.highlightedPath.length - 1; i++) {
            // Проверяем прямое направление
            if (this.highlightedPath[i] === from && this.highlightedPath[i + 1] === to) {
                return true;
            }
            // Для неориентированного графа проверяем и обратное направление
            if (this.graphType === 'undirected' && 
                this.highlightedPath[i] === to && this.highlightedPath[i + 1] === from) {
                return true;
            }
        }
        return false;
    }

    /** Радиус круга вершины (совпадает с drawNodeBodies) */
    static vertexBodyRadius() {
        return 25;
    }

    /**
     * Точка на окружности вершины: от центра fromC в сторону towardC на inset пикселей (не дальше середины хорды).
     */
    vertexRimPoint(fromC, towardC, inset) {
        const dx = towardC.x - fromC.x;
        const dy = towardC.y - fromC.y;
        const L = Math.hypot(dx, dy);
        if (L < 1e-6) return { x: fromC.x, y: fromC.y };
        const maxInset = Math.min(inset, Math.max(2, L / 2 - 1.5));
        const ux = dx / L;
        const uy = dy / L;
        return { x: fromC.x + ux * maxInset, y: fromC.y + uy * maxInset };
    }

    /**
     * Прямое ребро центр–центр (режим без multi mod), как в исходной версии.
     */
    drawStraightGraphEdge(from, to, edge, color, lineWidth, extra = {}) {
        const { forceBidirArrows = false } = extra;
        if (!from || !to) return;
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = lineWidth;
        this.ctx.beginPath();
        this.ctx.moveTo(from.x, from.y);
        this.ctx.lineTo(to.x, to.y);
        this.ctx.stroke();

        const w = edge.weight;
        if (w !== 0 && (w !== 1 || edge.isBidirectional)) {
            const mx = (from.x + to.x) / 2;
            const my = (from.y + to.y) / 2;
            const txt = Number(w).toFixed(1);
            const tw = this.ctx.measureText(txt).width;
            this.ctx.fillStyle = 'rgba(255,255,255,0.95)';
            this.ctx.fillRect(mx - tw / 2 - 6, my - 11, tw + 12, 22);
            this.ctx.strokeStyle = color;
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(mx - tw / 2 - 6, my - 11, tw + 12, 22);
            this.ctx.fillStyle = color;
            this.ctx.font = 'bold 13px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(txt, mx, my);
        }

        if (this.graphType !== 'directed') return;
        if (forceBidirArrows) {
            this.drawArrow(from, to, color, 1);
            this.drawArrow(to, from, color, 1);
        } else if (edge.isBidirectional) {
            if (!this.isEdgeInPath(edge.from, edge.to)) this.drawArrow(from, to, color, 1);
            if (!this.isEdgeInPath(edge.to, edge.from)) this.drawArrow(to, from, color, 1);
        } else if (!this.isEdgeInPath(edge.from, edge.to)) {
            this.drawArrow(from, to, color, 1);
        }
    }

    getGraphCentroid(vertices) {
        let cx = 0;
        let cy = 0;
        let n = 0;
        vertices.forEach((v) => {
            if (v) {
                cx += v.x;
                cy += v.y;
                n++;
            }
        });
        if (!n) return { x: 0, y: 0 };
        return { x: cx / n, y: cy / n };
    }

    prepareEdgeLayoutMetadata(edges) {
        const groups = new Map();
        edges.forEach((e, i) => {
            const key = `${e.from},${e.to}`;
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(i);
        });
        return edges.map((e, i) => {
            const key = `${e.from},${e.to}`;
            const indices = groups.get(key);
            const slot = indices.indexOf(i);
            return { slot, total: indices.length, isSelf: e.from === e.to };
        });
    }

    quadBezierPoint(t, p0, p1, p2) {
        const u = 1 - t;
        return {
            x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
            y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y
        };
    }

    quadBezierTangent(t, p0, p1, p2) {
        const u = 1 - t;
        const dx = 2 * u * (p1.x - p0.x) + 2 * t * (p2.x - p1.x);
        const dy = 2 * u * (p1.y - p0.y) + 2 * t * (p2.y - p1.y);
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        return { dx: dx / len, dy: dy / len };
    }

    drawSelfLoopArc(fromPt, weight, slot, total, centroid, color, lineWidth, drawDirectedArrow, edgeIsBidirectional, vertexIndex) {
        const nr = 25;
        const vx = fromPt.x;
        const vy = fromPt.y;
        let ox = vx - centroid.x;
        let oy = vy - centroid.y;
        let olen = Math.hypot(ox, oy);
        if (olen < 22) {
            const idx = typeof vertexIndex === 'number' ? vertexIndex : 0;
            const golden = 2.39996322972865332;
            ox = Math.cos(idx * golden);
            oy = Math.sin(idx * golden);
            olen = 1;
        }
        ox /= olen;
        oy /= olen;
        const slotRot = total > 1 ? (slot - (total - 1) / 2) * 0.55 : 0;
        const base = Math.atan2(oy, ox) + slotRot;
        const arcSpan = Math.PI * 0.75;
        const t0 = base - arcSpan / 2;
        const t1 = base + arcSpan / 2;
        const bulge = 88 + slot * 22 + (total > 1 ? 18 : 0);
        const p0 = { x: vx + Math.cos(t0) * nr, y: vy + Math.sin(t0) * nr };
        const p2 = { x: vx + Math.cos(t1) * nr, y: vy + Math.sin(t1) * nr };
        const p1 = { x: vx + Math.cos(base) * (nr + bulge), y: vy + Math.sin(base) * (nr + bulge) };

        this.ctx.save();
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = Math.max(lineWidth, 3);
        this.ctx.beginPath();
        this.ctx.moveTo(p0.x, p0.y);
        this.ctx.quadraticCurveTo(p1.x, p1.y, p2.x, p2.y);
        this.ctx.stroke();
        this.ctx.restore();

        const showWeight = weight !== 0 && (weight !== 1 || drawDirectedArrow || edgeIsBidirectional);
        if (showWeight) {
            const tW = total > 1 ? 0.28 + (0.5 * slot) / Math.max(1, total - 1) : 0.5;
            let pos = this.quadBezierPoint(tW, p0, p1, p2);
            const tan = this.quadBezierTangent(tW, p0, p1, p2);
            const perpX = -tan.dy;
            const perpY = tan.dx;
            const labelOff = (slot - (total - 1) / 2) * 20;
            pos = { x: pos.x + perpX * labelOff, y: pos.y + perpY * labelOff };
            const txt = Number(weight).toFixed(1);
            const tw = this.ctx.measureText(txt).width;
            this.ctx.fillStyle = 'rgba(255,255,255,0.95)';
            this.ctx.fillRect(pos.x - tw / 2 - 6, pos.y - 11, tw + 12, 22);
            this.ctx.strokeStyle = color;
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(pos.x - tw / 2 - 6, pos.y - 11, tw + 12, 22);
            this.ctx.fillStyle = color;
            this.ctx.font = 'bold 13px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(txt, pos.x, pos.y);
        }

        if (drawDirectedArrow) {
            const tArrow = 0.88;
            const pt = this.quadBezierPoint(tArrow, p0, p1, p2);
            const tip = { x: vx + Math.cos(t1) * (nr - 2), y: vy + Math.sin(t1) * (nr - 2) };
            this.drawArrow(pt, tip, color, lineWidth);
        }
    }

    drawCurvedEdgeArc(fromPt, toPt, weight, slot, total, color, lineWidth, drawDirectedArrow, bidirArrows, edgeIsBidirectional) {
        const vr = InteractiveGraphCanvas.vertexBodyRadius();
        const dx0 = toPt.x - fromPt.x;
        const dy0 = toPt.y - fromPt.y;
        const L0 = Math.hypot(dx0, dy0);
        if (L0 < 1e-6) return null;

        const p0 = this.vertexRimPoint(fromPt, toPt, vr);
        const p2 = this.vertexRimPoint(toPt, fromPt, vr);

        const dx = p2.x - p0.x;
        const dy = p2.y - p0.y;
        const L = Math.hypot(dx, dy);
        if (L < 1e-6) return null;

        const mxCent = (fromPt.x + toPt.x) / 2;
        const myCent = (fromPt.y + toPt.y) / 2;
        const mx = (p0.x + p2.x) / 2;
        const my = (p0.y + p2.y) / 2;
        const centroid = this.currentGraphData
            ? this.getGraphCentroid(this.currentGraphData.vertices)
            : { x: mx, y: my };
        const px = -dy / L;
        const py = dx / L;
        const slotIndex = slot - (total - 1) / 2;
        const baseSep = 56;
        const extra = Math.min(72, L0 * 0.22);
        let curve = slotIndex * (baseSep + extra);
        if (total === 1) {
            const gcx = centroid.x - mxCent;
            const gcy = centroid.y - myCent;
            const dot = gcx * px + gcy * py;
            const bendAway = (dot >= 0 ? -1 : 1) * Math.max(28, Math.min(48, L0 * 0.18));
            curve += bendAway;
        }
        const p1 = { x: mx + px * curve, y: my + py * curve };

        this.ctx.save();
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = lineWidth;
        this.ctx.beginPath();
        this.ctx.moveTo(p0.x, p0.y);
        this.ctx.quadraticCurveTo(p1.x, p1.y, p2.x, p2.y);
        this.ctx.stroke();
        this.ctx.restore();

        const showWeight = weight !== 0 && (weight !== 1 || bidirArrows || edgeIsBidirectional);
        if (showWeight) {
            const tW = total > 1 ? 0.26 + (0.48 * slot) / Math.max(1, total - 1) : 0.5;
            let pos = this.quadBezierPoint(tW, p0, p1, p2);
            const tan = this.quadBezierTangent(tW, p0, p1, p2);
            const perpX = -tan.dy;
            const perpY = tan.dx;
            const labelOff = slotIndex * 28;
            pos = { x: pos.x + perpX * labelOff, y: pos.y + perpY * labelOff };
            const txt = Number(weight).toFixed(1);
            const tw = this.ctx.measureText(txt).width;
            this.ctx.fillStyle = 'rgba(255,255,255,0.95)';
            this.ctx.fillRect(pos.x - tw / 2 - 6, pos.y - 11, tw + 12, 22);
            this.ctx.strokeStyle = color;
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(pos.x - tw / 2 - 6, pos.y - 11, tw + 12, 22);
            this.ctx.fillStyle = color;
            this.ctx.font = 'bold 13px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(txt, pos.x, pos.y);
        }

        const rimTo = this.vertexRimPoint(toPt, fromPt, vr - 2);
        const rimFrom = this.vertexRimPoint(fromPt, toPt, vr - 2);

        if (drawDirectedArrow) {
            const tArrow = 0.9;
            const pt = this.quadBezierPoint(tArrow, p0, p1, p2);
            this.drawArrow(pt, rimTo, color, lineWidth);
        } else if (bidirArrows) {
            const qf = this.quadBezierPoint(0.14, p0, p1, p2);
            const qt = this.quadBezierPoint(0.86, p0, p1, p2);
            this.drawArrow(qf, rimFrom, color, lineWidth);
            this.drawArrow(qt, rimTo, color, lineWidth);
        }

        return { p0, p1, p2 };
    }

    /** Индекс ребра в `edges` и направление как в отрисовке (для дуги и slot). */
    findEdgeLayoutByEndpoints(a, b) {
        const edges = this.currentGraphData.edges;
        for (let i = 0; i < edges.length; i++) {
            const e = edges[i];
            if (e.from === a && e.to === b) return { edgeIndex: i, from: e.from, to: e.to };
            if (e.isBidirectional && e.from === b && e.to === a) return { edgeIndex: i, from: e.from, to: e.to };
        }
        for (let i = 0; i < edges.length; i++) {
            const e = edges[i];
            if (!e.isBidirectional && e.from === b && e.to === a) return { edgeIndex: i, from: e.from, to: e.to };
        }
        return null;
    }

    /** Точка подписи на дуге (как у синего веса ребра). */
    computeCurvedEdgeLabelAnchor(fromPt, toPt, slot, total) {
        const vr = InteractiveGraphCanvas.vertexBodyRadius();
        const dx0 = toPt.x - fromPt.x;
        const dy0 = toPt.y - fromPt.y;
        const L0 = Math.hypot(dx0, dy0);
        if (L0 < 1e-6) return { x: (fromPt.x + toPt.x) / 2, y: (fromPt.y + toPt.y) / 2 };

        const p0 = this.vertexRimPoint(fromPt, toPt, vr);
        const p2 = this.vertexRimPoint(toPt, fromPt, vr);
        const dx = p2.x - p0.x;
        const dy = p2.y - p0.y;
        const L = Math.hypot(dx, dy);
        if (L < 1e-6) return { x: (fromPt.x + toPt.x) / 2, y: (fromPt.y + toPt.y) / 2 };

        const mxCent = (fromPt.x + toPt.x) / 2;
        const myCent = (fromPt.y + toPt.y) / 2;
        const mx = (p0.x + p2.x) / 2;
        const my = (p0.y + p2.y) / 2;
        const centroid = this.currentGraphData
            ? this.getGraphCentroid(this.currentGraphData.vertices)
            : { x: mx, y: my };
        const px = -dy / L;
        const py = dx / L;
        const slotIndex = slot - (total - 1) / 2;
        const baseSep = 56;
        const extra = Math.min(72, L0 * 0.22);
        let curve = slotIndex * (baseSep + extra);
        if (total === 1) {
            const gcx = centroid.x - mxCent;
            const gcy = centroid.y - myCent;
            const dot = gcx * px + gcy * py;
            const bendAway = (dot >= 0 ? -1 : 1) * Math.max(28, Math.min(48, L0 * 0.18));
            curve += bendAway;
        }
        const p1 = { x: mx + px * curve, y: my + py * curve };

        const tW = total > 1 ? 0.26 + (0.48 * slot) / Math.max(1, total - 1) : 0.5;
        let pos = this.quadBezierPoint(tW, p0, p1, p2);
        const tan = this.quadBezierTangent(tW, p0, p1, p2);
        const perpX = -tan.dy;
        const perpY = tan.dx;
        const labelOff = slotIndex * 28;
        return { x: pos.x + perpX * labelOff, y: pos.y + perpY * labelOff };
    }

    /** Середина ребра (мировые координаты) для подписи алгоритма. */
    getAlgorithmLabelPointForEdge(fromIdx, toIdx) {
        if (!this.currentGraphData) return null;
        const { vertices, edges, renderStraightEdges } = this.currentGraphData;
        const A = vertices[fromIdx];
        const B = vertices[toIdx];
        if (!A || !B) return null;
        if (fromIdx === toIdx) return { x: A.x, y: A.y };

        const straight = renderStraightEdges !== false;
        if (straight) {
            return { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
        }

        const layout = this.findEdgeLayoutByEndpoints(fromIdx, toIdx);
        if (!layout) {
            return { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
        }
        const fromPt = vertices[layout.from];
        const toPt = vertices[layout.to];
        const meta = this.prepareEdgeLayoutMetadata(edges);
        const m = meta[layout.edgeIndex];
        return this.computeCurvedEdgeLabelAnchor(fromPt, toPt, m.slot, m.total);
    }

    draw() {
        this.camera.x += (this.targetCamera.x - this.camera.x) * 0.1;
        this.camera.y += (this.targetCamera.y - this.camera.y) * 0.1;
        this.camera.zoom += (this.targetCamera.zoom - this.camera.zoom) * 0.1;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.save();
        this.ctx.translate(this.camera.x, this.camera.y);
        this.ctx.scale(this.camera.zoom, this.camera.zoom);
        this.drawGrid();
        if (this.currentGraphData) {
            this.drawEdges();
            this.drawTransportOverlayEdges();
            this.drawMatchingEdges();
            this.drawHighlightedPathEdges();
            this.drawNodeBodies();
            this.drawNodeLabels();
            this.drawAlgorithmEdgeLabels();
        }
        this.ctx.restore();
        if (this.currentGraphData) this.drawMinimap();
    }

    drawTransportOverlayEdges() {
        if (!this.transportOverlayEdges || !this.transportOverlayEdges.length || !this.currentGraphData) return;
        const { vertices } = this.currentGraphData;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        for (const ed of this.transportOverlayEdges) {
            const from = vertices[ed.from];
            const to = vertices[ed.to];
            if (!from || !to) continue;
            this.ctx.strokeStyle = ed.color || '#16a085';
            this.ctx.lineWidth = ed.lineWidth || 3;
            this.ctx.globalAlpha = 0.92;
            this.ctx.beginPath();
            this.ctx.moveTo(from.x, from.y);
            this.ctx.lineTo(to.x, to.y);
            this.ctx.stroke();
            this.ctx.globalAlpha = 1;
            if (ed.label) {
                const mx = (from.x + to.x) / 2;
                const my = (from.y + to.y) / 2;
                const lines = String(ed.label).split('\n');
                this.ctx.font = 'bold 11px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                const lh = 13;
                const startY = my - ((lines.length - 1) * lh) / 2;
                lines.forEach((line, idx) => {
                    const y = startY + idx * lh;
                    const tw = this.ctx.measureText(line).width;
                    this.ctx.fillStyle = 'rgba(255,255,255,0.96)';
                    this.ctx.fillRect(mx - tw / 2 - 5, y - 8, tw + 10, 16);
                    this.ctx.strokeStyle = ed.color || '#16a085';
                    this.ctx.lineWidth = 1;
                    this.ctx.strokeRect(mx - tw / 2 - 5, y - 8, tw + 10, 16);
                    this.ctx.fillStyle = '#2c3e50';
                    this.ctx.fillText(line, mx, y);
                });
            }
        }
    }

    drawMatchingEdges() {
        if (!this.matchingEdges || this.matchingEdges.length === 0) return;
        
        const { vertices } = this.currentGraphData;
        
        // Отрисовываем каждое ребро паросочетания отдельно
        const meta = this.prepareEdgeLayoutMetadata(this.matchingEdges);
        const centroid = this.getGraphCentroid(vertices);

        const straight = !this.currentGraphData || this.currentGraphData.renderStraightEdges !== false;

        this.matchingEdges.forEach((edge, idx) => {
            const from = vertices[edge.from];
            const to = vertices[edge.to];
            
            if (!from || !to) return;

            this.ctx.shadowColor = 'rgba(231, 76, 60, 0.5)';
            this.ctx.shadowBlur = 8;

            const m = meta[idx];
            if (m.isSelf) {
                this.drawSelfLoopArc(from, edge.weight, m.slot, m.total, centroid, '#e74c3c', 4, false, true, edge.from);
            } else if (straight) {
                this.drawStraightGraphEdge(from, to, edge, '#e74c3c', 4, { forceBidirArrows: true });
            } else {
                this.drawCurvedEdgeArc(from, to, edge.weight, m.slot, m.total, '#e74c3c', 4, false, true, true);
            }

            this.ctx.shadowColor = 'transparent';
            this.ctx.shadowBlur = 0;
        });
    }
    
    drawGrid() {
        const gs = this.gridSize;
        const w = this.canvas.width / this.camera.zoom;
        const h = this.canvas.height / this.camera.zoom;
        const sx = Math.floor(-this.camera.x / this.camera.zoom / gs) * gs;
        const sy = Math.floor(-this.camera.y / this.camera.zoom / gs) * gs;
        const ex = sx + w + gs * 2;
        const ey = sy + h + gs * 2;
        
        this.ctx.strokeStyle = 'rgba(0,0,0,0.05)';
        this.ctx.lineWidth = 1;
        for (let x = sx; x <= ex; x += gs) { this.ctx.beginPath(); this.ctx.moveTo(x, sy); this.ctx.lineTo(x, ey); this.ctx.stroke(); }
        for (let y = sy; y <= ey; y += gs) { this.ctx.beginPath(); this.ctx.moveTo(sx, y); this.ctx.lineTo(ex, y); this.ctx.stroke(); }
        this.ctx.strokeStyle = 'rgba(0,0,0,0.2)'; this.ctx.lineWidth = 2;
        this.ctx.beginPath(); this.ctx.moveTo(sx, 0); this.ctx.lineTo(ex, 0); this.ctx.stroke();
        this.ctx.beginPath(); this.ctx.moveTo(0, sy); this.ctx.lineTo(0, ey); this.ctx.stroke();
        
        // Отображаем заголовки столбцов, если они есть
        if (this.columnTitles) {
            this.ctx.fillStyle = '#2c3e50';
            this.ctx.font = 'bold 16px Arial';
            this.ctx.textAlign = 'center';
            
            if (this.columnTitles.left) {
                this.ctx.fillText(this.columnTitles.left, -200, -300);
            }
            if (this.columnTitles.right) {
                this.ctx.fillText(this.columnTitles.right, 200, -300);
            }
        }
    }
    


    // Замените метод drawHighlightedPathEdges:
    drawHighlightedPathEdges() {
        if (this.highlightedPath.length < 2) return;
        const { vertices } = this.currentGraphData;
        const centroid = this.getGraphCentroid(vertices);
        const straight = this.currentGraphData.renderStraightEdges !== false;
        
        for (let i = 0; i < this.highlightedPath.length - 1; i++) {
            const fromVertex = this.highlightedPath[i];
            const toVertex = this.highlightedPath[i + 1];
            
            const from = vertices[fromVertex];
            const to = vertices[toVertex];
            
            if (!from || !to) continue;
            
            let weight = 0;
            const matrix = window.currentMatrix || this.currentMatrix;
            
            let realFrom = fromVertex;
            let realTo = toVertex;
            
            const n = this.currentGraphData.numVertices / 2;
            if (toVertex >= n) {
                realTo = toVertex - n;
            }
            
            if (matrix && matrix[realFrom] && matrix[realFrom][realTo] !== undefined) {
                weight = matrix[realFrom][realTo];
            }
            
            this.ctx.strokeStyle = '#e74c3c'; 
            this.ctx.lineWidth = 4;
            this.ctx.shadowColor = 'rgba(231, 76, 60, 0.5)'; 
            this.ctx.shadowBlur = 8;

            if (fromVertex === toVertex) {
                this.drawSelfLoopArc(from, weight, 0, 1, centroid, '#e74c3c', 4, false, true, fromVertex);
            } else if (straight) {
                this.drawStraightGraphEdge(from, to, {
                    weight,
                    from: fromVertex,
                    to: toVertex,
                    isBidirectional: false
                }, '#e74c3c', 4, { forceBidirArrows: true });
            } else {
                this.drawCurvedEdgeArc(from, to, weight, 0, 1, '#e74c3c', 4, false, true, true);
            }

            this.ctx.shadowColor = 'transparent'; 
            this.ctx.shadowBlur = 0;
        }
    }
    
    drawEdges() {
        if (!this.currentGraphData) return;
        const { edges, vertices } = this.currentGraphData;
        const meta = this.prepareEdgeLayoutMetadata(edges);
        const centroid = this.getGraphCentroid(vertices);
        const straight = this.currentGraphData.renderStraightEdges !== false;
        const curvedMulti = this.currentGraphData.renderStraightEdges === false;
        
        edges.forEach((edge, idx) => {
            const from = vertices[edge.from], to = vertices[edge.to];
            if (!from || !to) return;

            const m = meta[idx];
            const skipForPath =
                this.isEdgeInPath(edge.from, edge.to) && !(curvedMulti && m.total > 1);
            if (skipForPath) return;

            if (m.isSelf) {
                this.drawSelfLoopArc(
                    from,
                    edge.weight,
                    m.slot,
                    m.total,
                    centroid,
                    '#667eea',
                    4,
                    this.graphType === 'directed' && !edge.isBidirectional,
                    edge.isBidirectional,
                    edge.from
                );
                return;
            }

            if (straight) {
                this.drawStraightGraphEdge(from, to, edge, '#667eea', 2);
            } else {
                const dirArrow = this.graphType === 'directed' && !edge.isBidirectional;
                const bidirArrows = this.graphType === 'directed' && edge.isBidirectional;
                this.drawCurvedEdgeArc(from, to, edge.weight, m.slot, m.total, '#667eea', 4, dirArrow, bidirArrows, edge.isBidirectional);
            }
        });
    }
    
    drawArrow(from, to, color = '#667eea', lw = 1) {
        const dx = to.x - from.x, dy = to.y - from.y;
        const len = Math.sqrt(dx*dx + dy*dy);
        if (!len) return;
        const ux = dx/len, uy = dy/len;
        const ax = to.x - ux*28, ay = to.y - uy*28;
        const sz = 10 + lw;
        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.moveTo(ax, ay);
        this.ctx.lineTo(ax - ux*sz + uy*sz*0.5, ay - uy*sz - ux*sz*0.5);
        this.ctx.lineTo(ax - ux*sz - uy*sz*0.5, ay - uy*sz + ux*sz*0.5);
        this.ctx.closePath();
        this.ctx.fill();
    }
    
    drawNodeBodies() {
        if (!this.currentGraphData) return;
        this.currentGraphData.vertices.forEach((v, i) => {
            if (!v) return;
            const hl = this.highlightedVertices.includes(i);
            const ip = this.highlightedPath.includes(i);
            this.ctx.shadowColor = 'rgba(0,0,0,0.2)';
            this.ctx.shadowBlur = (hl || ip) ? 15 : 8;
            this.ctx.shadowOffsetX = 0; this.ctx.shadowOffsetY = 3;
            this.ctx.beginPath(); this.ctx.arc(v.x, v.y, 25, 0, Math.PI*2);
            this.ctx.fillStyle = ip ? '#e74c3c' : hl ? '#f39c12' : '#667eea';
            this.ctx.fill();
            this.ctx.strokeStyle = 'white'; this.ctx.lineWidth = (hl || ip) ? 4 : 2; this.ctx.stroke();
            this.ctx.shadowColor = 'transparent'; this.ctx.shadowBlur = 0;
        });
    }

    drawNodeLabels() {
        if (!this.currentGraphData) return;
        this.currentGraphData.vertices.forEach((v, i) => {
            if (!v) return;
            const ip = this.highlightedPath.includes(i);
            this.ctx.textAlign = 'center'; this.ctx.textBaseline = 'middle';
            
            if (v.labelLines && v.labelLines.length) {
                this.ctx.fillStyle = 'white';
                const lh = v.labelLines.length > 2 ? 10 : 11;
                const off = -((v.labelLines.length - 1) * lh) / 2;
                v.labelLines.forEach((line, idx) => {
                    this.ctx.font = idx === 0 ? 'bold 12px Arial' : 'bold 10px Arial';
                    this.ctx.fillText(String(line), v.x, v.y + off + idx * lh);
                });
            } else if (v.label && v.labelInside) {
                this.ctx.fillStyle = 'white';
                const txt = String(v.label);
                this.ctx.font = txt.length > 2 ? 'bold 11px Arial' : 'bold 14px Arial';
                this.ctx.fillText(txt, v.x, v.y);
            } else if (v.label) {
                this.ctx.fillStyle = '#2c3e50';
                this.ctx.font = 'bold 13px Arial';
                this.ctx.fillText(v.label, v.x, v.y - 35);
                this.ctx.fillStyle = 'white';
                this.ctx.font = 'bold 16px Arial';
                this.ctx.fillText(i.toString(), v.x, v.y);
            } else {
                this.ctx.fillStyle = 'white';
                this.ctx.font = 'bold 14px Arial';
                this.ctx.fillText(i.toString(), v.x, v.y);
            }
        });
    }

    drawAlgorithmEdgeLabels() {
        if (!this.currentGraphData || !this.algorithmEdgeLabels) return;
        const color = '#e74c3c';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.font = 'bold 13px Arial';
        for (const entry of this.algorithmEdgeLabels) {
            const pt = this.getAlgorithmLabelPointForEdge(entry.from, entry.to);
            if (!pt) continue;
            const txt = Number(entry.value).toFixed(1);
            const tw = this.ctx.measureText(txt).width;
            this.ctx.fillStyle = 'rgba(255,255,255,0.95)';
            this.ctx.fillRect(pt.x - tw / 2 - 6, pt.y - 11, tw + 12, 22);
            this.ctx.strokeStyle = color;
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(pt.x - tw / 2 - 6, pt.y - 11, tw + 12, 22);
            this.ctx.fillStyle = color;
            this.ctx.fillText(txt, pt.x, pt.y);
        }
    }

    drawNodes() {
        this.drawNodeBodies();
        this.drawNodeLabels();
    }
    
    drawMinimap() {
        this.minimapCtx.clearRect(0, 0, 200, 150);
        this.minimapCtx.fillStyle = 'rgba(255,255,255,0.9)';
        this.minimapCtx.fillRect(0, 0, 200, 150);
        const { vertices } = this.currentGraphData;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        vertices.forEach(v => { if (v) { minX = Math.min(minX, v.x); minY = Math.min(minY, v.y); maxX = Math.max(maxX, v.x); maxY = Math.max(maxY, v.y); } });
        const gw = maxX - minX + 100, gh = maxY - minY + 100;
        const scale = Math.min(180/gw, 130/gh);
        const ox = 100 - (minX+maxX)/2*scale, oy = 75 - (minY+maxY)/2*scale;
        const straightMini = this.currentGraphData.renderStraightEdges !== false;
        this.currentGraphData.edges.forEach(e => {
            const f = vertices[e.from], t = vertices[e.to];
            if (!f || !t) return;
            this.minimapCtx.strokeStyle = 'rgba(102,126,234,0.3)'; this.minimapCtx.lineWidth = 0.5;
            const fx = f.x * scale + ox, fy = f.y * scale + oy, tx = t.x * scale + ox, ty = t.y * scale + oy;
            if (e.from === e.to) {
                this.minimapCtx.beginPath();
                this.minimapCtx.arc(fx + 4 * scale, fy - 4 * scale, 5 * scale, 0, Math.PI * 1.4);
                this.minimapCtx.stroke();
            } else if (straightMini) {
                this.minimapCtx.beginPath();
                this.minimapCtx.moveTo(fx, fy);
                this.minimapCtx.lineTo(tx, ty);
                this.minimapCtx.stroke();
            } else {
                const mx = (fx + tx) / 2, my = (fy + ty) / 2;
                const dx = tx - fx, dy = ty - fy;
                const LL = Math.hypot(dx, dy) || 1;
                const px = (-dy / LL) * 6 * scale, py = (dx / LL) * 6 * scale;
                this.minimapCtx.beginPath();
                this.minimapCtx.moveTo(fx, fy);
                this.minimapCtx.quadraticCurveTo(mx + px, my + py, tx, ty);
                this.minimapCtx.stroke();
            }
        });
        vertices.forEach(v => { if (!v) return; this.minimapCtx.fillStyle = '#667eea'; this.minimapCtx.beginPath(); this.minimapCtx.arc(v.x*scale+ox, v.y*scale+oy, 2, 0, Math.PI*2); this.minimapCtx.fill(); });
        const vx = -this.camera.x/this.camera.zoom*scale + ox, vy = -this.camera.y/this.camera.zoom*scale + oy;
        const vw = this.canvas.width/this.camera.zoom*scale, vh = this.canvas.height/this.camera.zoom*scale;
        this.minimapCtx.strokeStyle = '#e74c3c'; this.minimapCtx.lineWidth = 2;
        this.minimapCtx.strokeRect(vx, vy, vw, vh);
        this.minimapCtx.fillStyle = 'rgba(0,0,0,0.5)'; this.minimapCtx.font = '10px Arial';
        this.minimapCtx.textAlign = 'center'; this.minimapCtx.fillText('2x клик - центр', 100, 140);
    }
    
    animate() {
        this.draw();
        this.animationId = requestAnimationFrame(() => this.animate());
    }
}