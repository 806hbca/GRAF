
// graph-canvas.js
class InteractiveGraphCanvas {
    constructor() {
        this.canvas = document.getElementById('graphCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.container = document.getElementById('canvas-container');
        
        this.minimapCanvas = document.getElementById('minimapCanvas');
        this.minimapCtx = this.minimapCanvas.getContext('2d');
        this.minimapContainer = document.getElementById('minimap');

        this.camera = {
            x: 0,
            y: 0,
            zoom: 1
        };
        
        this.targetCamera = {
            x: 0,
            y: 0,
            zoom: 1
        };
        
        this.mouse = {
            x: 0,
            y: 0,
            worldX: 0,
            worldY: 0,
            isPanning: false,
            panStartX: 0,
            panStartY: 0,
            cameraStartX: 0,
            cameraStartY: 0,
            isDraggingNode: false,
            dragNodeIndex: -1,
            dragStartX: 0,
            dragStartY: 0
        };
        
        this.currentGraphData = null;
        this.currentMatrix = null;
        this.graphType = 'undirected';
        
        this.vertexPositions = [];
        
        this.animationId = null;
        this.gridSize = 50;
        
        this.highlightedVertices = [];
        this.highlightedPath = [];
        this.highlightedEdges = [];
        
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
    
    setupEventListeners() {
        window.addEventListener('resize', () => this.resizeCanvas());
        
        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        window.addEventListener('mousemove', (e) => this.onMouseMove(e));
        window.addEventListener('mouseup', (e) => this.onMouseUp(e));
        this.canvas.addEventListener('wheel', (e) => this.onWheel(e));
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        
        this.minimapContainer.addEventListener('dblclick', (e) => {
            this.centerView();
        });
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
            if (dx * dx + dy * dy <= radius * radius) {
                return i;
            }
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
        this.mouse.worldX = worldPos.x;
        this.mouse.worldY = worldPos.y;
        
        const vertexIndex = this.findVertexAt(worldPos.x, worldPos.y);
        
        if (vertexIndex !== -1) {
            this.mouse.isDraggingNode = true;
            this.mouse.dragNodeIndex = vertexIndex;
            this.mouse.dragStartX = worldPos.x;
            this.mouse.dragStartY = worldPos.y;
            this.container.classList.add('grabbing');
        } else {
            this.mouse.isPanning = true;
            this.mouse.panStartX = e.clientX;
            this.mouse.panStartY = e.clientY;
            this.mouse.cameraStartX = this.targetCamera.x;
            this.mouse.cameraStartY = this.targetCamera.y;
            this.container.classList.add('grabbing');
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
            const vertexIndex = this.findVertexAt(worldPos.x, worldPos.y);
            if (vertexIndex !== -1) {
                this.container.style.cursor = 'move';
            } else {
                this.container.style.cursor = 'grab';
            }
        }
    }
    
    onMouseUp(e) {
        this.mouse.isPanning = false;
        this.mouse.isDraggingNode = false;
        this.mouse.dragNodeIndex = -1;
        this.container.classList.remove('grabbing');
        this.container.style.cursor = 'grab';
    }
    
    onWheel(e) {
        e.preventDefault();
        
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        const zoomFactor = 1.1;
        const oldZoom = this.targetCamera.zoom;
        
        if (e.deltaY < 0) {
            this.targetCamera.zoom *= zoomFactor;
        } else {
            this.targetCamera.zoom /= zoomFactor;
        }
        
        this.targetCamera.zoom = Math.min(Math.max(0.1, this.targetCamera.zoom), 5);
        
        const zoomChange = this.targetCamera.zoom / oldZoom;
        this.targetCamera.x = mouseX - (mouseX - this.targetCamera.x) * zoomChange;
        this.targetCamera.y = mouseY - (mouseY - this.targetCamera.y) * zoomChange;
    }
    
    setGraphData(graphData, matrix) {
        this.currentGraphData = graphData;
        this.currentMatrix = matrix;
        this.clearHighlights();
        
        this.vertexPositions = graphData.vertices.map(v => ({ x: v.x, y: v.y }));
        
        this.centerView();
    }
    
    setGraphType(type) {
        this.graphType = type;
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
        
        if (this.currentGraphData) {
            this.drawMinimap();
        }
    }
    
    drawGrid() {
        const gridSize = this.gridSize;
        const width = this.canvas.width / this.camera.zoom;
        const height = this.canvas.height / this.camera.zoom;
        
        const startX = Math.floor(-this.camera.x / this.camera.zoom / gridSize) * gridSize;
        const startY = Math.floor(-this.camera.y / this.camera.zoom / gridSize) * gridSize;
        const endX = startX + width + gridSize * 2;
        const endY = startY + height + gridSize * 2;
        
        this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.05)';
        this.ctx.lineWidth = 1;
        
        for (let x = startX; x <= endX; x += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, startY);
            this.ctx.lineTo(x, endY);
            this.ctx.stroke();
        }
        
        for (let y = startY; y <= endY; y += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(startX, y);
            this.ctx.lineTo(endX, y);
            this.ctx.stroke();
        }
        
        this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
        this.ctx.lineWidth = 2;
        
        this.ctx.beginPath();
        this.ctx.moveTo(startX, 0);
        this.ctx.lineTo(endX, 0);
        this.ctx.stroke();
        
        this.ctx.beginPath();
        this.ctx.moveTo(0, startY);
        this.ctx.lineTo(0, endY);
        this.ctx.stroke();
    }
    
    drawHighlightedPathEdges() {
        if (this.highlightedPath.length < 2) return;
        
        const { vertices } = this.currentGraphData;
        
        for (let i = 0; i < this.highlightedPath.length - 1; i++) {
            const fromVertex = this.highlightedPath[i];
            const toVertex = this.highlightedPath[i + 1];
            
            const from = vertices[fromVertex];
            const to = vertices[toVertex];
            
            if (!from || !to) continue;
            
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
            
            if (this.graphType === 'directed') {
                this.drawArrow(from, to, '#e74c3c', 4);
            }
        }
    }
    
    drawEdges() {
        if (!this.currentGraphData) return;
        
        const { edges, vertices } = this.currentGraphData;
        
        edges.forEach(edge => {
            const from = vertices[edge.from];
            const to = vertices[edge.to];
            if (!from || !to) return;
            
            const isPathEdge = this.isEdgeInPath(edge.from, edge.to);
            
            if (isPathEdge) return;
            
            this.ctx.strokeStyle = '#667eea';
            this.ctx.lineWidth = 2;
            
            this.ctx.beginPath();
            this.ctx.moveTo(from.x, from.y);
            this.ctx.lineTo(to.x, to.y);
            this.ctx.stroke();
            
            if (this.graphType === 'directed') {
                if (edge.isBidirectional) {
                    this.drawArrow(from, to, '#667eea', 1);
                    this.drawArrow(to, from, '#667eea', 1);
                } else {
                    this.drawArrow(from, to, '#667eea', 1);
                }
            }
            
            if (edge.weight !== 1 || edge.isBidirectional) {
                const midX = (from.x + to.x) / 2;
                const midY = (from.y + to.y) / 2;
                
                const weightText = edge.weight.toFixed(1);
                const textWidth = this.ctx.measureText(weightText).width;
                
                this.ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
                this.ctx.fillRect(midX - textWidth / 2 - 6, midY - 11, textWidth + 12, 22);
                
                this.ctx.strokeStyle = '#667eea';
                this.ctx.lineWidth = 1;
                this.ctx.strokeRect(midX - textWidth / 2 - 6, midY - 11, textWidth + 12, 22);
                
                this.ctx.fillStyle = '#667eea';
                this.ctx.font = 'bold 13px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.fillText(weightText, midX, midY);
            }
        });
    }
    
    drawArrow(from, to, color = '#667eea', lineWidth = 1) {
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        if (length === 0) return;
        
        const unitX = dx / length;
        const unitY = dy / length;
        
        const arrowX = to.x - unitX * 28;
        const arrowY = to.y - unitY * 28;
        
        const arrowSize = 10 + lineWidth;
        
        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.moveTo(arrowX, arrowY);
        this.ctx.lineTo(
            arrowX - unitX * arrowSize + unitY * arrowSize * 0.5,
            arrowY - unitY * arrowSize - unitX * arrowSize * 0.5
        );
        this.ctx.lineTo(
            arrowX - unitX * arrowSize - unitY * arrowSize * 0.5,
            arrowY - unitY * arrowSize + unitX * arrowSize * 0.5
        );
        this.ctx.closePath();
        this.ctx.fill();
    }
    
    drawNodes() {
        if (!this.currentGraphData) return;
        
        const { vertices } = this.currentGraphData;
        
        vertices.forEach((v, index) => {
            if (!v) return;
            
            const isHighlighted = this.highlightedVertices.includes(index);
            const isInPath = this.highlightedPath.includes(index);
            
            this.ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
            this.ctx.shadowBlur = isHighlighted || isInPath ? 15 : 8;
            this.ctx.shadowOffsetX = 0;
            this.ctx.shadowOffsetY = 3;
            
            this.ctx.beginPath();
            this.ctx.arc(v.x, v.y, 25, 0, Math.PI * 2);
            
            let fillColor = '#667eea';
            if (isInPath) fillColor = '#e74c3c';
            else if (isHighlighted) fillColor = '#f39c12';
            
            this.ctx.fillStyle = fillColor;
            this.ctx.fill();
            
            this.ctx.strokeStyle = 'white';
            this.ctx.lineWidth = (isHighlighted || isInPath) ? 4 : 2;
            this.ctx.stroke();
            
            this.ctx.shadowColor = 'transparent';
            this.ctx.shadowBlur = 0;
            
            this.ctx.fillStyle = 'white';
            this.ctx.font = 'bold 16px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(index, v.x, v.y);
        });
    }
    
    drawMinimap() {
        this.minimapCtx.clearRect(0, 0, 200, 150);
        this.minimapCtx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        this.minimapCtx.fillRect(0, 0, 200, 150);
        
        const { vertices } = this.currentGraphData;
        
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        vertices.forEach(v => {
            if (v) {
                minX = Math.min(minX, v.x);
                minY = Math.min(minY, v.y);
                maxX = Math.max(maxX, v.x);
                maxY = Math.max(maxY, v.y);
            }
        });
        
        const graphWidth = maxX - minX + 100;
        const graphHeight = maxY - minY + 100;
        const scale = Math.min(180 / graphWidth, 130 / graphHeight);
        const offsetX = 100 - (minX + maxX) / 2 * scale;
        const offsetY = 75 - (minY + maxY) / 2 * scale;
        
        this.currentGraphData.edges.forEach(edge => {
            const from = vertices[edge.from];
            const to = vertices[edge.to];
            if (!from || !to) return;
            
            this.minimapCtx.strokeStyle = 'rgba(102, 126, 234, 0.3)';
            this.minimapCtx.lineWidth = 0.5;
            this.minimapCtx.beginPath();
            this.minimapCtx.moveTo(from.x * scale + offsetX, from.y * scale + offsetY);
            this.minimapCtx.lineTo(to.x * scale + offsetX, to.y * scale + offsetY);
            this.minimapCtx.stroke();
        });
        
        vertices.forEach(v => {
            if (!v) return;
            this.minimapCtx.fillStyle = '#667eea';
            this.minimapCtx.beginPath();
            this.minimapCtx.arc(v.x * scale + offsetX, v.y * scale + offsetY, 2, 0, Math.PI * 2);
            this.minimapCtx.fill();
        });
        
        const viewX = -this.camera.x / this.camera.zoom * scale + offsetX;
        const viewY = -this.camera.y / this.camera.zoom * scale + offsetY;
        const viewW = this.canvas.width / this.camera.zoom * scale;
        const viewH = this.canvas.height / this.camera.zoom * scale;
        
        this.minimapCtx.strokeStyle = '#e74c3c';
        this.minimapCtx.lineWidth = 2;
        this.minimapCtx.strokeRect(viewX, viewY, viewW, viewH);
        
        this.minimapCtx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        this.minimapCtx.font = '10px Arial';
        this.minimapCtx.textAlign = 'center';
        this.minimapCtx.fillText('2x клик - центр', 100, 140);
    }
    
    isEdgeInPath(from, to) {
        for (let i = 0; i < this.highlightedPath.length - 1; i++) {
            if ((this.highlightedPath[i] === from && this.highlightedPath[i + 1] === to) ||
                (this.graphType === 'undirected' && 
                (this.highlightedPath[i] === to && this.highlightedPath[i + 1] === from))) {
                return true;
            }
        }
        return false;
    }
    
    highlightVertices(vertices) {
        this.highlightedVertices = vertices;
        this.highlightedPath = [];
    }
    
    highlightPath(path) {
        this.highlightedPath = path;
        this.highlightedVertices = [];
    }
    
    clearHighlights() {
        this.highlightedVertices = [];
        this.highlightedPath = [];
    }
    
    animate() {
        this.draw();
        this.animationId = requestAnimationFrame(() => this.animate());
    }
}