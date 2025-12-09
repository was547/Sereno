class ProjectDatabase {
    constructor() {
        this.dbName = 'SerenoDB';
        this.dbVersion = 1;
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                if (!db.objectStoreNames.contains('projects')) {
                    const store = db.createObjectStore('projects', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('name', 'name', { unique: false });
                    store.createIndex('createdAt', 'createdAt', { unique: false });
                    store.createIndex('updatedAt', 'updatedAt', { unique: false });
                }
            };
        });
    }

    async saveProject(project) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['projects'], 'readwrite');
            const store = transaction.objectStore('projects');
            
            if (project.id) {
                project.updatedAt = Date.now();
                const request = store.put(project);
                request.onsuccess = () => resolve(project.id);
                request.onerror = () => reject(request.error);
            } else {
                project.createdAt = Date.now();
                project.updatedAt = Date.now();
                const request = store.add(project);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            }
        });
    }

    async getProject(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['projects'], 'readonly');
            const store = transaction.objectStore('projects');
            const request = store.get(id);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getAllProjects() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['projects'], 'readonly');
            const store = transaction.objectStore('projects');
            const request = store.getAll();
            
            request.onsuccess = () => {
                const projects = request.result.sort((a, b) => b.updatedAt - a.updatedAt);
                resolve(projects);
            };
            request.onerror = () => reject(request.error);
        });
    }

    async deleteProject(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['projects'], 'readwrite');
            const store = transaction.objectStore('projects');
            const request = store.delete(id);
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
}

const imageLibrary = [
    {
        id: 'italy-street',
        name: 'Vila Italiana',
        src: 'images/italy.png',
        category: 'cidades'
    },
    {
        id: 'spain-street',
        name: 'Pueblo da Espanha',
        src: 'images/spain.png',
        category: 'cidades'
    },
    {
        id: 'turia',
        name: 'Turia',
        src: 'images/turia.png',
        category: 'paisagens'
    },
    {
        id: 'bibi',
        name: 'Bibi',
        src: 'images/bibi.png',
        category: 'personagens'
    },
    {
        id: 'lili',
        name: 'Lili',
        src: 'images/lili.png',
        category: 'personagens'
    },
    {
        id: 'bulldogfrances',
        name: 'Bulldog Francês',
        src: 'images/bulldogfrances.png',
        category: 'animais'
    }
];

const colorPalette = [
    '#e05c8a',
    '#7c5ce0',
    '#5c8ae0',
    '#5ce0c4',
    '#5ce070',
    '#e0e05c',
    '#e0a85c',
    '#e05c5c',
    '#8b5c3c',
    '#f5f5f7',
    '#6b6b7b',
    '#1a1a2e'
];

class SerenoApp {
    constructor() {
        this.db = new ProjectDatabase();
        this.currentProject = null;
        this.currentTool = 'brush';
        this.currentColor = colorPalette[0];
        this.brushSize = 20;
        this.brushOpacity = 1;
        this.isDrawing = false;
        this.lastPoint = null;
        this.history = [];
        this.historyIndex = -1;
        this.maxHistory = 50;
        
        this.baseCanvas = null;
        this.paintCanvas = null;
        this.baseCtx = null;
        this.paintCtx = null;
        
        this.boundaryMask = null;
        this.currentRegionMask = null;
        this.boundaryThreshold = 220;
        this.confinedMode = true;
        
        this.brushEngine = null;
        this.currentBrushType = 'colored_pencil';
        
        this.zoom = 1;
        this.minZoom = 1;
        this.maxZoom = 5;
        this.panX = 0;
        this.panY = 0;
        this.isPanning = false;
        this.lastPinchDist = 0;
        this.lastPanPoint = null;
        this.touchCount = 0;
        this.drawStartTimer = null;
        this.pendingTouchStart = null;
        this.isGesture = false;
        this.touchStartPoint = null;
        this.activePointerId = null;
        this.elements = {};
    }

    async init() {
        await this.db.init();
        this.cacheElements();
        this.setupEventListeners();
        this.setupColorPalette();
        this.renderImageLibrary();
        this.loadSavedProjects();
        this.updateSizePreview();
        this.initBrushEngine();
    }
    
    initBrushEngine() {
    }
    
    initAdvancedBrushEngine() {
        const boundarySystem = {
            currentRegionMask: null,
            boundaryMask: this.boundaryMask,
            isPointInRegion: (x, y) => this.isPointInRegion(x, y)
        };
        
        this.brushEngine = new AdvancedBrushEngine(
            this.paintCanvas,
            this.baseCanvas,
            boundarySystem
        );
        
        this.brushEngine.setCanvasSize(this.paintCanvas.width, this.paintCanvas.height);
        this.brushEngine.setColor(this.currentColor);
        this.brushEngine.setSize(this.brushSize);
        this.brushEngine.setOpacity(this.brushOpacity);
        this.selectBrushType(this.currentBrushType);
    }

    cacheElements() {
        this.elements = {
            galleryScreen: document.getElementById('gallery-screen'),
            paintScreen: document.getElementById('paint-screen'),
            imageLibrary: document.getElementById('image-library'),
            savedProjects: document.getElementById('saved-projects'),
            noProjects: document.getElementById('no-projects'),
            baseCanvas: document.getElementById('base-canvas'),
            paintCanvas: document.getElementById('paint-canvas'),
            projectTitle: document.getElementById('project-title'),
            colorPalette: document.getElementById('color-palette'),
            brushSize: document.getElementById('brush-size'),
            sizePreview: document.getElementById('size-preview'),
            saveModal: document.getElementById('save-modal'),
            projectNameInput: document.getElementById('project-name-input'),
            toast: document.getElementById('toast')
        };
        
        this.baseCanvas = this.elements.baseCanvas;
        this.paintCanvas = this.elements.paintCanvas;
        this.baseCtx = this.baseCanvas.getContext('2d', { willReadFrequently: true });
        this.paintCtx = this.paintCanvas.getContext('2d', { willReadFrequently: true });
    }

    setupEventListeners() {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });

        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.selectTool(e.currentTarget.dataset.tool));
        });
        
        document.querySelectorAll('.brush-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.selectBrushType(e.currentTarget.dataset.brush));
        });

        this.elements.brushSize.addEventListener('input', (e) => {
            this.brushSize = parseInt(e.target.value);
            this.updateSizePreview();
            if (this.brushEngine) {
                this.brushEngine.setSize(this.brushSize);
            }
        });

        document.getElementById('custom-color').addEventListener('input', (e) => {
            this.selectColor(e.target.value);
        });

        document.getElementById('btn-back').addEventListener('click', () => this.goBack());
        document.getElementById('btn-undo').addEventListener('click', () => this.undo());
        document.getElementById('btn-redo').addEventListener('click', () => this.redo());
        document.getElementById('btn-save').addEventListener('click', () => this.showSaveModal());
        document.getElementById('btn-confined').addEventListener('click', () => this.toggleConfinedMode());

        document.getElementById('btn-cancel-save').addEventListener('click', () => this.hideSaveModal());
        document.getElementById('btn-confirm-save').addEventListener('click', () => this.saveCurrentProject());
        document.querySelector('.modal-backdrop').addEventListener('click', () => this.hideSaveModal());

        this.setupCanvasEvents();

        document.addEventListener('keydown', (e) => this.handleKeyboard(e));
        document.addEventListener('gesturestart', (e) => e.preventDefault());
        document.addEventListener('gesturechange', (e) => e.preventDefault());
    }

    setupCanvasEvents() {
        const container = document.querySelector('.canvas-container');

        container.addEventListener('pointerdown', (e) => this.handlePointerDown(e));
        container.addEventListener('pointermove', (e) => this.handlePointerMove(e));
        container.addEventListener('pointerup', (e) => this.handlePointerUp(e));
        container.addEventListener('pointercancel', (e) => this.handlePointerUp(e));
        container.addEventListener('pointerleave', (e) => this.handlePointerUp(e));
        
        container.addEventListener('wheel', (e) => this.handleWheel(e), { passive: false });

        container.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
        container.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
        container.addEventListener('touchend', (e) => this.handleTouchEnd(e));
        container.addEventListener('touchcancel', (e) => this.handleTouchEnd(e));
    }
    
    handlePointerDown(e) {
        if (this.isGesture || this.touchCount >= 2) return;
        
        const isPen = e.pointerType === 'pen';
        const isTouch = e.pointerType === 'touch';
        
        if (isPen) {
            e.preventDefault();
            this.activePointerId = e.pointerId;
            this.startDrawing(e);
        } else if (isTouch) {
        } else {
            e.preventDefault();
            this.activePointerId = e.pointerId;
            this.startDrawing(e);
        }
    }
    
    handlePointerMove(e) {
        if (e.pointerId !== this.activePointerId) return;
        if (!this.isDrawing) return;
        if (this.isGesture) return;
        
        e.preventDefault();
        this.draw(e);
    }
    
    handlePointerUp(e) {
        if (e.pointerId !== this.activePointerId) return;
        
        this.activePointerId = null;
        this.stopDrawing();
    }
    
    handleWheel(e) {
        e.preventDefault();
        
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const rect = this.paintCanvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        this.zoomAt(x, y, delta);
    }
    
    handleTouchStart(e) {
        this.touchCount = e.touches.length;
        
        if (e.touches.length >= 2) {
            e.preventDefault();
            this.isGesture = true;
            
            if (this.isDrawing) {
                this.stopDrawing();
            }
            
            this.lastPinchDist = this.getTouchDistance(e.touches);
            this.lastPanPoint = this.getTouchCenter(e.touches);
        }
    }
    
    handleTouchMove(e) {
        if (e.touches.length >= 2) {
            e.preventDefault();
            this.isGesture = true;
            
            const newDist = this.getTouchDistance(e.touches);
            const center = this.getTouchCenter(e.touches);
            
            if (this.lastPinchDist > 0) {
                const scale = newDist / this.lastPinchDist;
                const rect = this.paintCanvas.getBoundingClientRect();
                this.zoomAt(center.x - rect.left, center.y - rect.top, scale);
            }
            
            if (this.lastPanPoint) {
                this.pan(center.x - this.lastPanPoint.x, center.y - this.lastPanPoint.y);
            }
            
            this.lastPinchDist = newDist;
            this.lastPanPoint = center;
        }
    }
    
    handleTouchEnd(e) {
        if (e.touches.length === 0) {
            this.touchCount = 0;
            this.isGesture = false;
            this.lastPinchDist = 0;
            this.lastPanPoint = null;
        } else if (e.touches.length === 1) {
            this.touchCount = 1;
            this.isGesture = false;
            this.lastPinchDist = 0;
            this.lastPanPoint = null;
        }
    }
    
    getTouchDistance(touches) {
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    getTouchCenter(touches) {
        return {
            x: (touches[0].clientX + touches[1].clientX) / 2,
            y: (touches[0].clientY + touches[1].clientY) / 2
        };
    }
    
    zoomAt(x, y, scale) {
        const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom * scale));
        
        if (newZoom !== this.zoom) {
            const zoomRatio = newZoom / this.zoom;
            this.panX = x - (x - this.panX) * zoomRatio;
            this.panY = y - (y - this.panY) * zoomRatio;
            
            this.zoom = newZoom;
            this.applyTransform();
            this.updateZoomIndicator();
        }
    }
    
    pan(dx, dy) {
        this.panX += dx;
        this.panY += dy;
        this.constrainPan();
        this.applyTransform();
    }
    
    constrainPan() {
        const container = document.querySelector('.canvas-container');
        const maxPan = Math.max(0, (this.zoom - 1) * Math.min(container.clientWidth, container.clientHeight) / 2);
        
        this.panX = Math.max(-maxPan, Math.min(maxPan, this.panX));
        this.panY = Math.max(-maxPan, Math.min(maxPan, this.panY));
    }
    
    applyTransform() {
        const transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`;
        this.baseCanvas.style.transform = transform;
        this.paintCanvas.style.transform = transform;
    }
    
    resetZoom() {
        this.zoom = 1;
        this.panX = 0;
        this.panY = 0;
        this.applyTransform();
        this.updateZoomIndicator();
    }
    
    updateZoomIndicator() {
        let indicator = document.getElementById('zoom-indicator');
        let resetBtn = document.getElementById('zoom-reset-btn');
        
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'zoom-indicator';
            indicator.className = 'zoom-indicator';
            document.querySelector('.canvas-container').appendChild(indicator);
        }
        
        if (!resetBtn) {
            resetBtn = document.createElement('button');
            resetBtn.id = 'zoom-reset-btn';
            resetBtn.className = 'zoom-reset-btn';
            resetBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
            </svg>`;
            resetBtn.addEventListener('click', () => this.resetZoom());
            document.querySelector('.canvas-container').appendChild(resetBtn);
        }
        
        const percent = Math.round(this.zoom * 100);
        indicator.textContent = `${percent}%`;
        indicator.classList.add('visible');
        
        if (this.zoom > 1.05) {
            resetBtn.classList.add('visible');
        } else {
            resetBtn.classList.remove('visible');
        }
        
        clearTimeout(this.zoomIndicatorTimeout);
        this.zoomIndicatorTimeout = setTimeout(() => {
            indicator.classList.remove('visible');
        }, 1500);
    }

    setupColorPalette() {
        const palette = this.elements.colorPalette;
        palette.innerHTML = '';
        
        colorPalette.forEach((color, index) => {
            const swatch = document.createElement('button');
            swatch.className = 'color-swatch' + (index === 0 ? ' active' : '');
            swatch.style.background = color;
            swatch.style.setProperty('--swatch-color', color);
            swatch.dataset.color = color;
            swatch.addEventListener('click', () => this.selectColor(color));
            palette.appendChild(swatch);
        });
    }

    selectColor(color) {
        this.currentColor = color;
        document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
        const swatch = document.querySelector(`.color-swatch[data-color="${color}"]`);
        if (swatch) swatch.classList.add('active');
        this.updateSizePreview();
        
        if (this.brushEngine) {
            this.brushEngine.setColor(color);
        }
    }

    selectTool(tool) {
        this.currentTool = tool;
        document.querySelectorAll('.tool-btn:not(.mode-btn)').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tool === tool);
        });
    }
    
    toggleConfinedMode() {
        this.confinedMode = !this.confinedMode;
        const btn = document.getElementById('btn-confined');
        btn.classList.toggle('active', this.confinedMode);
        
        const message = this.confinedMode 
            ? 'Pintura confinada ativada' 
            : 'Pintura livre ativada';
        this.showToast(message);
    }
    
    selectBrushType(brushId) {
        this.currentBrushType = brushId;
        
        document.querySelectorAll('.brush-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.brush === brushId);
        });
        
        if (this.brushEngine) {
            const brushTypes = {
                'colored_pencil': BrushTypes.COLORED_PENCIL,
                'watercolor': BrushTypes.WATERCOLOR,
                'marker': BrushTypes.MARKER,
                'pastel': BrushTypes.PASTEL,
                'airbrush': BrushTypes.AIRBRUSH,
                'oil_brush': BrushTypes.OIL_BRUSH
            };
            
            if (brushTypes[brushId]) {
                this.brushEngine.setBrush(brushTypes[brushId]);
                this.showToast(brushTypes[brushId].name);
            }
        }
    }

    updateSizePreview() {
        const preview = this.elements.sizePreview;
        const size = Math.min(this.brushSize, 36);
        preview.style.setProperty('--preview-size', `${size}px`);
        preview.style.setProperty('--current-color', this.currentColor);
    }

    switchTab(tab) {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tab}-tab`).classList.add('active');
    }

    renderImageLibrary() {
        const grid = this.elements.imageLibrary;
        grid.innerHTML = '';
        
        imageLibrary.forEach((image, index) => {
            const card = document.createElement('div');
            card.className = 'image-card';
            card.style.animationDelay = `${0.1 + index * 0.05}s`;
            card.innerHTML = `
                <img src="${image.src}" alt="${image.name}" loading="lazy">
                <div class="image-card-overlay">
                    <span class="image-card-title">${image.name}</span>
                </div>
            `;
            card.addEventListener('click', () => this.openImage(image));
            grid.appendChild(card);
        });
    }

    async loadSavedProjects() {
        const projects = await this.db.getAllProjects();
        const grid = this.elements.savedProjects;
        const emptyState = this.elements.noProjects;
        
        grid.innerHTML = '';
        
        if (projects.length === 0) {
            emptyState.style.display = 'flex';
            return;
        }
        
        emptyState.style.display = 'none';
        
        projects.forEach((project, index) => {
            const card = document.createElement('div');
            card.className = 'image-card project-card';
            card.style.animationDelay = `${0.1 + index * 0.05}s`;
            card.innerHTML = `
                <img src="${project.thumbnail}" alt="${project.name}">
                <button class="delete-btn" data-id="${project.id}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                </button>
                <div class="image-card-overlay">
                    <span class="image-card-title">${project.name}</span>
                </div>
            `;
            
            card.querySelector('.delete-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteProject(project.id);
            });
            
            card.addEventListener('click', () => this.openProject(project));
            grid.appendChild(card);
        });
    }

    async openImage(image) {
        this.currentProject = {
            imageId: image.id,
            imageSrc: image.src,
            name: image.name,
            paintData: null
        };
        
        await this.loadImageToCanvas(image.src);
        this.showPaintScreen();
        this.history = [];
        this.historyIndex = -1;
        this.saveToHistory();
    }

    async openProject(project) {
        this.currentProject = { ...project };
        
        await this.loadImageToCanvas(project.imageSrc);
        
        if (project.paintData) {
            const img = new Image();
            img.onload = () => {
                this.paintCtx.drawImage(img, 0, 0);
            };
            img.src = project.paintData;
        }
        
        this.showPaintScreen();
        this.elements.projectTitle.textContent = project.name;
        this.history = [];
        this.historyIndex = -1;
        this.saveToHistory();
    }

    async loadImageToCanvas(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            
            img.onload = () => {
                const container = document.querySelector('.canvas-container');
                const maxWidth = container.clientWidth - 40;
                const maxHeight = container.clientHeight - 40;
                
                let width = img.width;
                let height = img.height;
                
                if (width > maxWidth) {
                    const ratio = maxWidth / width;
                    width = maxWidth;
                    height *= ratio;
                }
                if (height > maxHeight) {
                    const ratio = maxHeight / height;
                    height = maxHeight;
                    width *= ratio;
                }
                
                const minSize = 300;
                if (width < minSize && height < minSize) {
                    const ratio = minSize / Math.max(width, height);
                    width *= ratio;
                    height *= ratio;
                }
                
                width = Math.floor(width);
                height = Math.floor(height);
                
                this.baseCanvas.width = width;
                this.baseCanvas.height = height;
                this.paintCanvas.width = width;
                this.paintCanvas.height = height;
                
                this.baseCtx.fillStyle = '#ffffff';
                this.baseCtx.fillRect(0, 0, width, height);
                this.baseCtx.drawImage(img, 0, 0, width, height);
                
                this.paintCtx.clearRect(0, 0, width, height);
                
                this.createBoundaryMask();
                this.initAdvancedBrushEngine();
                
                if (this.brushEngine && this.brushEngine.boundarySystem) {
                    this.brushEngine.boundarySystem.boundaryMask = this.boundaryMask;
                }
                
                resolve();
            };
            
            img.onerror = reject;
            img.src = src;
        });
    }

    createBoundaryMask() {
        const width = this.baseCanvas.width;
        const height = this.baseCanvas.height;
        const imageData = this.baseCtx.getImageData(0, 0, width, height);
        const data = imageData.data;
        
        this.boundaryMask = new Uint8Array(width * height);
        
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            
            const luminance = (r * 0.299 + g * 0.587 + b * 0.114);
            
            const pixelIndex = i / 4;
            this.boundaryMask[pixelIndex] = luminance < this.boundaryThreshold ? 1 : 0;
        }
    }

    detectRegion(startX, startY) {
        const width = this.baseCanvas.width;
        const height = this.baseCanvas.height;
        
        startX = Math.floor(startX);
        startY = Math.floor(startY);
        
        if (this.boundaryMask[startY * width + startX] === 1) {
            return null;
        }
        
        const regionMask = new Uint8Array(width * height);
        const visited = new Uint8Array(width * height);
        const stack = [[startX, startY]];
        
        while (stack.length > 0) {
            const [x, y] = stack.pop();
            
            if (x < 0 || x >= width || y < 0 || y >= height) continue;
            
            const idx = y * width + x;
            
            if (visited[idx]) continue;
            if (this.boundaryMask[idx] === 1) continue;
            
            visited[idx] = 1;
            regionMask[idx] = 1;
            
            stack.push([x + 1, y]);
            stack.push([x - 1, y]);
            stack.push([x, y + 1]);
            stack.push([x, y - 1]);
        }
        
        return regionMask;
    }

    isPointInRegion(x, y) {
        if (!this.currentRegionMask) return true;
        
        const width = this.baseCanvas.width;
        const height = this.baseCanvas.height;
        
        x = Math.floor(x);
        y = Math.floor(y);
        
        if (x < 0 || x >= width || y < 0 || y >= height) return false;
        
        return this.currentRegionMask[y * width + x] === 1;
    }

    showPaintScreen() {
        this.elements.galleryScreen.classList.remove('active');
        this.elements.paintScreen.classList.add('active');
        this.elements.projectTitle.textContent = this.currentProject.name || 'Sem título';
    }

    goBack() {
        this.elements.paintScreen.classList.remove('active');
        this.elements.galleryScreen.classList.add('active');
        this.loadSavedProjects();
    }

    getPoint(e) {
        const rect = this.paintCanvas.getBoundingClientRect();
        
        const originalWidth = this.paintCanvas.width;
        const originalHeight = this.paintCanvas.height;
        
        const visualWidth = rect.width;
        const visualHeight = rect.height;
        
        let clientX, clientY, pressure = 0.5;
        
        if (e.touches && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
            pressure = e.touches[0].force || 0.5;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
            pressure = e.pressure || 0.5;
        }
        
        const x = ((clientX - rect.left) / visualWidth) * originalWidth;
        const y = ((clientY - rect.top) / visualHeight) * originalHeight;
        
        return {
            x: x,
            y: y,
            pressure: Math.max(0.1, pressure)
        };
    }

    startDrawing(e) {
        if (e.touches && e.touches.length > 1) return;
        
        this.isDrawing = true;
        this.lastPoint = this.getPoint(e);
        
        if (this.currentTool === 'fill') {
            if (this.confinedMode) {
                this.floodFillConstrained(Math.floor(this.lastPoint.x), Math.floor(this.lastPoint.y));
            } else {
                this.floodFillFree(Math.floor(this.lastPoint.x), Math.floor(this.lastPoint.y));
            }
            this.isDrawing = false;
            this.saveToHistory();
        } else {
            if (this.confinedMode) {
                this.currentRegionMask = this.detectRegion(this.lastPoint.x, this.lastPoint.y);
            } else {
                this.currentRegionMask = null;
            }
            
            if (this.brushEngine) {
                this.brushEngine.boundarySystem.currentRegionMask = this.currentRegionMask;
            }
            
            if (this.currentTool === 'eraser') {
                this.brushEngine?.erase(this.lastPoint.x, this.lastPoint.y, this.lastPoint.pressure);
            } else if (this.brushEngine) {
                this.brushEngine.beginStroke(this.lastPoint.x, this.lastPoint.y, this.lastPoint.pressure);
            } else {
                this.drawDot(this.lastPoint);
            }
        }
    }

    draw(e) {
        if (!this.isDrawing || this.currentTool === 'fill') return;
        
        const point = this.getPoint(e);
        
        if (this.currentTool === 'eraser') {
            this.brushEngine?.erase(point.x, point.y, point.pressure);
        } else if (this.brushEngine) {
            this.brushEngine.continueStroke(point.x, point.y, point.pressure);
        } else {
            this.drawLine(this.lastPoint, point);
        }
        
        this.lastPoint = point;
    }

    stopDrawing() {
        if (this.isDrawing) {
            this.isDrawing = false;
            
            if (this.brushEngine && this.currentTool === 'brush') {
                this.brushEngine.endStroke();
            }
            
            this.currentRegionMask = null;
            
            if (this.brushEngine) {
                this.brushEngine.boundarySystem.currentRegionMask = null;
            }
            
            this.saveToHistory();
        }
    }

    drawDot(point) {
        if (!this.isPointInRegion(point.x, point.y)) return;
        
        const ctx = this.paintCtx;
        const size = this.brushSize * (this.currentTool === 'eraser' ? 1.5 : 1) * point.pressure;
        const radius = size / 2;
        
        this.drawConstrainedCircle(point.x, point.y, radius, point.pressure);
    }

    drawLine(from, to) {
        const dist = Math.sqrt(Math.pow(to.x - from.x, 2) + Math.pow(to.y - from.y, 2));
        const steps = Math.max(Math.ceil(dist / 2), 1);
        
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const x = from.x + (to.x - from.x) * t;
            const y = from.y + (to.y - from.y) * t;
            const pressure = from.pressure + (to.pressure - from.pressure) * t;
            const size = this.brushSize * (this.currentTool === 'eraser' ? 1.5 : 1) * pressure;
            const radius = size / 2;
            
            if (this.isPointInRegion(x, y)) {
                this.drawConstrainedCircle(x, y, radius, pressure);
            }
        }
    }

    drawConstrainedCircle(cx, cy, radius, pressure) {
        const ctx = this.paintCtx;
        const width = this.paintCanvas.width;
        const height = this.paintCanvas.height;
        
        if (radius < 3 || !this.currentRegionMask) {
            ctx.save();
            ctx.globalAlpha = this.brushOpacity;
            ctx.globalCompositeOperation = this.currentTool === 'eraser' ? 'destination-out' : 'source-over';
            ctx.fillStyle = this.currentColor;
            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            return;
        }
        
        const startX = Math.max(0, Math.floor(cx - radius));
        const endX = Math.min(width - 1, Math.ceil(cx + radius));
        const startY = Math.max(0, Math.floor(cy - radius));
        const endY = Math.min(height - 1, Math.ceil(cy + radius));
        
        const imageData = ctx.getImageData(startX, startY, endX - startX + 1, endY - startY + 1);
        const data = imageData.data;
        
        const color = this.hexToRgb(this.currentColor);
        const alpha = Math.floor(this.brushOpacity * 255);
        const isEraser = this.currentTool === 'eraser';
        const radiusSq = radius * radius;
        
        for (let y = startY; y <= endY; y++) {
            for (let x = startX; x <= endX; x++) {
                const dx = x - cx;
                const dy = y - cy;
                if (dx * dx + dy * dy > radiusSq) continue;
                
                if (!this.isPointInRegion(x, y)) continue;
                
                const localX = x - startX;
                const localY = y - startY;
                const idx = (localY * (endX - startX + 1) + localX) * 4;
                
                if (isEraser) {
                    data[idx + 3] = 0;
                } else {
                    const existingAlpha = data[idx + 3] / 255;
                    const newAlpha = alpha / 255;
                    const outAlpha = newAlpha + existingAlpha * (1 - newAlpha);
                    
                    if (outAlpha > 0) {
                        data[idx] = (color.r * newAlpha + data[idx] * existingAlpha * (1 - newAlpha)) / outAlpha;
                        data[idx + 1] = (color.g * newAlpha + data[idx + 1] * existingAlpha * (1 - newAlpha)) / outAlpha;
                        data[idx + 2] = (color.b * newAlpha + data[idx + 2] * existingAlpha * (1 - newAlpha)) / outAlpha;
                        data[idx + 3] = outAlpha * 255;
                    }
                }
            }
        }
        
        ctx.putImageData(imageData, startX, startY);
    }

    floodFillFree(startX, startY) {
        const canvas = this.paintCanvas;
        const ctx = this.paintCtx;
        const width = canvas.width;
        const height = canvas.height;
        
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        
        const startIdx = (startY * width + startX) * 4;
        const startR = data[startIdx];
        const startG = data[startIdx + 1];
        const startB = data[startIdx + 2];
        const startA = data[startIdx + 3];
        
        const fillColor = this.hexToRgb(this.currentColor);
        const fillR = fillColor.r;
        const fillG = fillColor.g;
        const fillB = fillColor.b;
        const fillA = Math.floor(this.brushOpacity * 255);
        
        if (startR === fillR && startG === fillG && startB === fillB && startA === fillA) {
            return;
        }
        
        const tolerance = 32;
        const visited = new Uint8Array(width * height);
        const stack = [[startX, startY]];
        
        const matchesStart = (idx) => {
            return Math.abs(data[idx] - startR) <= tolerance &&
                   Math.abs(data[idx + 1] - startG) <= tolerance &&
                   Math.abs(data[idx + 2] - startB) <= tolerance &&
                   Math.abs(data[idx + 3] - startA) <= tolerance;
        };
        
        while (stack.length > 0) {
            const [x, y] = stack.pop();
            
            if (x < 0 || x >= width || y < 0 || y >= height) continue;
            
            const pixelIdx = y * width + x;
            if (visited[pixelIdx]) continue;
            
            const idx = pixelIdx * 4;
            if (!matchesStart(idx)) continue;
            
            visited[pixelIdx] = 1;
            
            data[idx] = fillR;
            data[idx + 1] = fillG;
            data[idx + 2] = fillB;
            data[idx + 3] = fillA;
            
            stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
        }
        
        ctx.putImageData(imageData, 0, 0);
    }

    floodFillConstrained(startX, startY) {
        const canvas = this.paintCanvas;
        const ctx = this.paintCtx;
        const width = canvas.width;
        const height = canvas.height;
        
        if (this.boundaryMask && this.boundaryMask[startY * width + startX] === 1) {
            return;
        }
        
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        
        const fillColor = this.hexToRgb(this.currentColor);
        const fillR = fillColor.r;
        const fillG = fillColor.g;
        const fillB = fillColor.b;
        const fillA = Math.floor(this.brushOpacity * 255);
        
        const visited = new Uint8Array(width * height);
        const toFill = [];
        const stack = [[startX, startY]];
        
        while (stack.length > 0) {
            const [x, y] = stack.pop();
            
            if (x < 0 || x >= width || y < 0 || y >= height) continue;
            
            const pixelIdx = y * width + x;
            
            if (visited[pixelIdx]) continue;
            
            if (this.boundaryMask && this.boundaryMask[pixelIdx] === 1) continue;
            
            visited[pixelIdx] = 1;
            toFill.push(pixelIdx);
            
            stack.push(
                [x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1],
                [x + 1, y + 1], [x - 1, y - 1], [x + 1, y - 1], [x - 1, y + 1]
            );
        }
        
        for (const pixelIdx of toFill) {
            const idx = pixelIdx * 4;
            data[idx] = fillR;
            data[idx + 1] = fillG;
            data[idx + 2] = fillB;
            data[idx + 3] = fillA;
        }
        
        for (const pixelIdx of toFill) {
            const x = pixelIdx % width;
            const y = Math.floor(pixelIdx / width);
            
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    if (dx === 0 && dy === 0) continue;
                    
                    const nx = x + dx;
                    const ny = y + dy;
                    
                    if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
                    
                    const neighborIdx = ny * width + nx;
                    
                    if (this.boundaryMask && this.boundaryMask[neighborIdx] === 1) {
                        const nidx = neighborIdx * 4;
                        const existingA = data[nidx + 3];
                        if (existingA < 50) {
                            data[nidx] = fillR;
                            data[nidx + 1] = fillG;
                            data[nidx + 2] = fillB;
                            data[nidx + 3] = Math.min(255, existingA + fillA * 0.3);
                        }
                    }
                }
            }
        }
        
        ctx.putImageData(imageData, 0, 0);
    }

    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 0, g: 0, b: 0 };
    }

    saveToHistory() {
        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }
        
        const state = this.paintCanvas.toDataURL('image/png');
        this.history.push(state);
        
        if (this.history.length > this.maxHistory) {
            this.history.shift();
        }
        
        this.historyIndex = this.history.length - 1;
    }

    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.loadHistoryState(this.history[this.historyIndex]);
        }
    }

    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.loadHistoryState(this.history[this.historyIndex]);
        }
    }

    loadHistoryState(dataUrl) {
        const img = new Image();
        img.onload = () => {
            this.paintCtx.clearRect(0, 0, this.paintCanvas.width, this.paintCanvas.height);
            this.paintCtx.drawImage(img, 0, 0);
        };
        img.src = dataUrl;
    }

    showSaveModal() {
        this.elements.saveModal.classList.add('active');
        this.elements.projectNameInput.value = this.currentProject.name || '';
        this.elements.projectNameInput.focus();
        this.elements.projectNameInput.select();
    }

    hideSaveModal() {
        this.elements.saveModal.classList.remove('active');
    }

    async saveCurrentProject() {
        const name = this.elements.projectNameInput.value.trim() || 'Sem título';
        
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = this.baseCanvas.width;
        tempCanvas.height = this.baseCanvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(this.baseCanvas, 0, 0);
        tempCtx.drawImage(this.paintCanvas, 0, 0);
        
        const thumbnail = tempCanvas.toDataURL('image/jpeg', 0.7);
        const paintData = this.paintCanvas.toDataURL('image/png');
        
        const project = {
            id: this.currentProject.id || undefined,
            name: name,
            imageId: this.currentProject.imageId,
            imageSrc: this.currentProject.imageSrc,
            paintData: paintData,
            thumbnail: thumbnail
        };
        
        try {
            const id = await this.db.saveProject(project);
            this.currentProject.id = id;
            this.currentProject.name = name;
            this.elements.projectTitle.textContent = name;
            this.hideSaveModal();
            this.showToast('Projeto salvo!', 'success');
        } catch (error) {
            console.error('Erro ao salvar:', error);
            this.showToast('Erro ao salvar projeto', 'error');
        }
    }

    async deleteProject(id) {
        if (confirm('Tem certeza que deseja excluir este projeto?')) {
            await this.db.deleteProject(id);
            this.loadSavedProjects();
            this.showToast('Projeto excluído');
        }
    }

    showToast(message, type = '') {
        const toast = this.elements.toast;
        toast.textContent = message;
        toast.className = 'toast show ' + type;
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 2500);
    }

    handleKeyboard(e) {
        if (e.ctrlKey || e.metaKey) {
            if (e.key === 'z') {
                e.preventDefault();
                if (e.shiftKey) {
                    this.redo();
                } else {
                    this.undo();
                }
            } else if (e.key === 's') {
                e.preventDefault();
                this.showSaveModal();
            }
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const app = new SerenoApp();
    app.init();
});
