// graph-canvas.js
class InteractiveGraphCanvas {
    constructor() {
        this.canvas = document.getElementById('graphCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.container = document.getElementById('canvas-container');
        
        this.minimapCanvas = document.getElementById('minimapCanvas');
        this.minimapCtx = this.minimapCanvas.getContext('2d');
        this.minimapContainer = document.getElementById('minimap');

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
        
        this.shiftPressed = false;
        this.shiftFirstVertex = null;
        this.selectedVertexIndex = null;
        
        this.init();
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
                this.currentGraphData.vertices[this.mouse.dragNodeIndex] = {
                    x: this.vertexPositions[this.mouse.dragNodeIndex].x,
                    y: this.vertexPositions[this.mouse.dragNodeIndex].y
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
        
        // Shift + A: добавить вершину
        if ((e.key === 'a' || e.key === 'A') && e.shiftKey) {
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
    
    clearHighlights() { this.highlightedVertices = []; this.highlightedPath = []; }
    highlightVertices(v) { this.highlightedVertices = v; this.highlightedPath = []; }
    highlightPath(p) { this.highlightedPath = p; this.highlightedVertices = []; }
    
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
            this.drawHighlightedPathEdges();
            this.drawEdges();
            this.drawNodes();
        }
        this.ctx.restore();
        if (this.currentGraphData) this.drawMinimap();
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
    }
    


    // Замените метод drawHighlightedPathEdges:
    drawHighlightedPathEdges() {
        if (this.highlightedPath.length < 2) return;
        const { vertices } = this.currentGraphData;
        
        for (let i = 0; i < this.highlightedPath.length - 1; i++) {
            const fromVertex = this.highlightedPath[i];
            const toVertex = this.highlightedPath[i + 1];
            
            const from = vertices[fromVertex];
            const to = vertices[toVertex];
            
            if (!from || !to) continue;
            
            // Находим вес ребра из матрицы
            let weight = 0;
            const matrix = window.currentMatrix || this.currentMatrix;
            if (matrix && matrix[fromVertex] && matrix[fromVertex][toVertex] !== undefined) {
                weight = matrix[fromVertex][toVertex];
            }
            
            // Рисуем красную линию пути (без белого фона)
            this.ctx.strokeStyle = '#e74c3c'; 
            this.ctx.lineWidth = 4;
            this.ctx.shadowColor = 'rgba(231, 76, 60, 0.5)'; 
            this.ctx.shadowBlur = 8;
            this.ctx.beginPath(); 
            this.ctx.moveTo(from.x, from.y); 
            this.ctx.lineTo(to.x, to.y); 
            this.ctx.stroke();
            this.ctx.shadowColor = 'transparent'; 
            this.ctx.shadowBlur = 0;
            
            // Рисуем красные стрелки
            this.drawArrow(from, to, '#e74c3c', 4);
            
            // Для неориентированного графа рисуем стрелки в обе стороны
            if (this.graphType === 'undirected') {
                this.drawArrow(to, from, '#e74c3c', 4);
            }
            
            // Отображаем вес красным цветом
            if (weight !== 0) {
                const midX = (from.x + to.x) / 2;
                const midY = (from.y + to.y) / 2;
                const weightText = weight.toFixed(1);
                const textWidth = this.ctx.measureText(weightText).width;
                
                // Белый фон для текста
                this.ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
                this.ctx.fillRect(midX - textWidth / 2 - 6, midY - 11, textWidth + 12, 22);
                
                // Красная рамка
                this.ctx.strokeStyle = '#e74c3c';
                this.ctx.lineWidth = 2;
                this.ctx.strokeRect(midX - textWidth / 2 - 6, midY - 11, textWidth + 12, 22);
                
                // Красный текст
                this.ctx.fillStyle = '#e74c3c';
                this.ctx.font = 'bold 13px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.fillText(weightText, midX, midY);
            }
        }
    }
    
    drawEdges() {
        if (!this.currentGraphData) return;
        const { edges, vertices } = this.currentGraphData;
        
        edges.forEach(edge => {
            const from = vertices[edge.from], to = vertices[edge.to];
            if (!from || !to) return;
            
            // Пропускаем ребра, которые есть в выделенном пути
            if (this.isEdgeInPath(edge.from, edge.to)) return;
            
            this.ctx.strokeStyle = '#667eea'; 
            this.ctx.lineWidth = 2;
            this.ctx.beginPath(); 
            this.ctx.moveTo(from.x, from.y); 
            this.ctx.lineTo(to.x, to.y); 
            this.ctx.stroke();
            
            if (this.graphType === 'directed') {
                if (edge.isBidirectional) { 
                    // Проверяем оба направления
                    if (!this.isEdgeInPath(edge.from, edge.to)) {
                        this.drawArrow(from, to, '#667eea', 1);
                    }
                    if (!this.isEdgeInPath(edge.to, edge.from)) {
                        this.drawArrow(to, from, '#667eea', 1);
                    }
                } else {
                    if (!this.isEdgeInPath(edge.from, edge.to)) {
                        this.drawArrow(from, to, '#667eea', 1);
                    }
                }
            }
            
            // Вес ребра (только если не часть пути)
            if ((edge.weight !== 1 || edge.isBidirectional) && !this.isEdgeInPath(edge.from, edge.to)) {
                const mx = (from.x + to.x) / 2, my = (from.y + to.y) / 2;
                const txt = edge.weight.toFixed(1);
                const tw = this.ctx.measureText(txt).width;
                
                this.ctx.fillStyle = 'rgba(255,255,255,0.95)';
                this.ctx.fillRect(mx - tw/2 - 6, my - 11, tw + 12, 22);
                this.ctx.strokeStyle = '#667eea'; 
                this.ctx.lineWidth = 1;
                this.ctx.strokeRect(mx - tw/2 - 6, my - 11, tw + 12, 22);
                this.ctx.fillStyle = '#667eea'; 
                this.ctx.font = 'bold 13px Arial';
                this.ctx.textAlign = 'center'; 
                this.ctx.textBaseline = 'middle';
                this.ctx.fillText(txt, mx, my);
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
    
    drawNodes() {
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
            this.ctx.fillStyle = 'white'; this.ctx.font = 'bold 16px Arial';
            this.ctx.textAlign = 'center'; this.ctx.textBaseline = 'middle';
            this.ctx.fillText(i, v.x, v.y);
        });
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
        this.currentGraphData.edges.forEach(e => {
            const f = vertices[e.from], t = vertices[e.to];
            if (!f || !t) return;
            this.minimapCtx.strokeStyle = 'rgba(102,126,234,0.3)'; this.minimapCtx.lineWidth = 0.5;
            this.minimapCtx.beginPath(); this.minimapCtx.moveTo(f.x*scale+ox, f.y*scale+oy); this.minimapCtx.lineTo(t.x*scale+ox, t.y*scale+oy); this.minimapCtx.stroke();
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