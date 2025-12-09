class TextureGenerator {
    constructor() {
        this.noiseCanvas = document.createElement('canvas');
        this.noiseCanvas.width = 256;
        this.noiseCanvas.height = 256;
        this.noiseCtx = this.noiseCanvas.getContext('2d');
        this.generateNoiseTexture();
    }
    
    generateNoiseTexture() {
        const imageData = this.noiseCtx.createImageData(256, 256);
        const data = imageData.data;
        
        for (let i = 0; i < data.length; i += 4) {
            const value = Math.random() * 255;
            data[i] = value;
            data[i + 1] = value;
            data[i + 2] = value;
            data[i + 3] = 255;
        }
        
        this.noiseCtx.putImageData(imageData, 0, 0);
    }
    
    noise(x, y) {
        const xi = Math.floor(x) & 255;
        const yi = Math.floor(y) & 255;
        const pixel = this.noiseCtx.getImageData(xi, yi, 1, 1).data;
        return pixel[0] / 255;
    }
    
    fractalNoise(x, y, octaves = 4) {
        let value = 0;
        let amplitude = 1;
        let frequency = 1;
        let maxValue = 0;
        
        for (let i = 0; i < octaves; i++) {
            value += this.noise(x * frequency, y * frequency) * amplitude;
            maxValue += amplitude;
            amplitude *= 0.5;
            frequency *= 2;
        }
        
        return value / maxValue;
    }
}

const BrushTypes = {
    COLORED_PENCIL: {
        id: 'colored_pencil',
        name: 'Lápis de Cor',
        icon: '✏️',
        opacity: 0.8,
        hardness: 0.6,
        pressureSize: true,
        pressureOpacity: true
    },
    
    WATERCOLOR: {
        id: 'watercolor',
        name: 'Aquarela',
        icon: '💧',
        opacity: 0.4,
        hardness: 0.2,
        pressureSize: true,
        pressureOpacity: true
    },
    
    MARKER: {
        id: 'marker',
        name: 'Marcador',
        icon: '🖊️',
        opacity: 1.0,
        hardness: 0.8,
        pressureSize: false,
        pressureOpacity: true
    },
    
    PASTEL: {
        id: 'pastel',
        name: 'Pastel',
        icon: '🖍️',
        opacity: 0.6,
        hardness: 0.35,
        pressureSize: true,
        pressureOpacity: true
    },
    
    AIRBRUSH: {
        id: 'airbrush',
        name: 'Aerógrafo',
        icon: '🌫️',
        opacity: 0.3,
        hardness: 0.1,
        pressureSize: true,
        pressureOpacity: true
    },
    
    OIL_BRUSH: {
        id: 'oil_brush',
        name: 'Óleo',
        icon: '🎨',
        opacity: 0.9,
        hardness: 0.5,
        pressureSize: true,
        pressureOpacity: false
    }
};

class AdvancedBrushEngine {
    constructor(paintCanvas, baseCanvas, boundarySystem) {
        this.paintCanvas = paintCanvas;
        this.baseCanvas = baseCanvas;
        this.paintCtx = paintCanvas.getContext('2d', { willReadFrequently: true });
        this.boundarySystem = boundarySystem;
        
        this.textureGen = new TextureGenerator();
        this.currentBrush = BrushTypes.COLORED_PENCIL;
        this.color = { r: 224, g: 92, b: 138 };
        this.size = 20;
        this.globalOpacity = 1.0;
        
        this.stampCache = new Map();
        
        this.isStroking = false;
        this.lastStampPos = null;
        this.lastPressure = 0.5;
    }
    
    setCanvasSize(width, height) {
    }
    
    setBrush(brushType) {
        this.currentBrush = brushType;
        this.stampCache.clear();
    }
    
    setColor(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        if (result) {
            this.color = {
                r: parseInt(result[1], 16),
                g: parseInt(result[2], 16),
                b: parseInt(result[3], 16)
            };
        }
        this.stampCache.clear();
    }
    
    setSize(size) {
        this.size = size;
    }
    
    setOpacity(opacity) {
        this.globalOpacity = opacity;
    }
        
    generateBrushStamp(size, pressure = 1.0) {
        const brush = this.currentBrush;
        const actualSize = Math.max(2, Math.round(size * (brush.pressureSize ? (0.5 + pressure * 0.5) : 1)));
        
        const cacheKey = `${brush.id}_${actualSize}_${this.color.r}_${this.color.g}_${this.color.b}`;
        
        if (this.stampCache.has(cacheKey)) {
            return this.stampCache.get(cacheKey);
        }
        
        const stampCanvas = document.createElement('canvas');
        const padding = 4;
        stampCanvas.width = actualSize + padding * 2;
        stampCanvas.height = actualSize + padding * 2;
        const ctx = stampCanvas.getContext('2d');
        
        const centerX = stampCanvas.width / 2;
        const centerY = stampCanvas.height / 2;
        const radius = actualSize / 2;
        
        const imageData = ctx.createImageData(stampCanvas.width, stampCanvas.height);
        const data = imageData.data;
        
        for (let y = 0; y < stampCanvas.height; y++) {
            for (let x = 0; x < stampCanvas.width; x++) {
                const dx = x - centerX;
                const dy = y - centerY;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                if (dist > radius + 2) continue;
                
                let alpha = 0;
                if (dist <= radius) {
                    const normalizedDist = dist / radius;
                    alpha = 1 - Math.pow(normalizedDist, 1 / brush.hardness);
                    alpha = Math.max(0, Math.min(1, alpha));
                }
                
                alpha = this.applyTexture(alpha, x, y, actualSize, brush);
                
                if (brush.opacityVariation > 0) {
                    const variation = (Math.random() - 0.5) * 2 * brush.opacityVariation;
                    alpha *= (1 + variation * 0.5);
                }
                
                alpha *= brush.opacity;
                
                const idx = (y * stampCanvas.width + x) * 4;
                data[idx] = this.color.r;
                data[idx + 1] = this.color.g;
                data[idx + 2] = this.color.b;
                data[idx + 3] = Math.round(alpha * 255);
            }
        }
        
        ctx.putImageData(imageData, 0, 0);
        
        if (this.stampCache.size > 50) {
            const firstKey = this.stampCache.keys().next().value;
            this.stampCache.delete(firstKey);
        }
        
        this.stampCache.set(cacheKey, stampCanvas);
        return stampCanvas;
    }
    
    applyTexture(alpha, x, y, size, brush) {
        const textureScale = size / 20;
        
        switch (brush.texture) {
            case 'grain':
                const grainNoise = this.textureGen.fractalNoise(x * 0.5, y * 0.5, 3);
                const grain = 0.7 + grainNoise * 0.6;
                alpha *= grain;
                if (Math.random() < brush.textureStrength * 0.3) {
                    alpha *= 0.3 + Math.random() * 0.7;
                }
                break;
                
            case 'wet':
                const wetNoise = this.textureGen.fractalNoise(x * 0.3, y * 0.3, 4);
                alpha *= 0.5 + wetNoise * 0.8;
                if (brush.wetEdges) {
                    const edgeFactor = Math.abs(Math.sin(x * 0.2) * Math.cos(y * 0.2));
                    alpha *= 0.8 + edgeFactor * 0.4;
                }
                break;
                
            case 'chalk':
                const chalkNoise = this.textureGen.noise(x * 0.8, y * 0.8);
                alpha *= 0.6 + chalkNoise * 0.6;
                if (Math.random() < brush.textureStrength * 0.5) {
                    alpha *= Math.random();
                }
                break;
                
            case 'spray':
                const sprayNoise = this.textureGen.fractalNoise(x * 0.2, y * 0.2, 2);
                alpha *= sprayNoise * 1.5;
                break;
                
            case 'bristle':
                const bristleNoise = this.textureGen.noise(x * 2, y * 0.5);
                alpha *= 0.7 + bristleNoise * 0.5;
                const bristleLine = Math.sin(x * 0.8) * 0.3 + 0.7;
                alpha *= bristleLine;
                break;
                
            case 'smooth':
            default:
                alpha *= 0.95 + Math.random() * 0.1;
                break;
        }
        
        return Math.max(0, Math.min(1, alpha));
    }
    
    beginStroke(x, y, pressure = 0.5) {
        this.isStroking = true;
        this.lastStampPos = { x, y };
        this.lastPressure = Math.max(0.1, pressure);
        
        this.paintAt(x, y, pressure);
    }
    
    continueStroke(x, y, pressure = 0.5) {
        if (!this.isStroking) return;
        
        pressure = Math.max(0.1, pressure);
        
        const dx = x - this.lastStampPos.x;
        const dy = y - this.lastStampPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        const spacing = Math.max(1, this.size * 0.1);
        
        if (dist >= spacing) {
            const steps = Math.ceil(dist / spacing);
            
            for (let i = 1; i <= steps; i++) {
                const t = i / steps;
                const px = this.lastStampPos.x + dx * t;
                const py = this.lastStampPos.y + dy * t;
                const interpPressure = this.lastPressure + (pressure - this.lastPressure) * t;
                
                this.paintAt(px, py, interpPressure);
            }
            
            this.lastStampPos = { x, y };
            this.lastPressure = pressure;
        }
    }
    
    endStroke() {
        this.isStroking = false;
        this.lastStampPos = null;
    }
    
    paintAt(x, y, pressure) {
        const brush = this.currentBrush;
        const ctx = this.paintCtx;
        const canvas = this.paintCanvas;
        
        let size = this.size;
        if (brush.pressureSize) {
            size *= 0.3 + pressure * 0.7;
        }
        
        const radius = Math.max(2, size / 2);
        
        let opacity = this.globalOpacity * brush.opacity * 0.5;
        if (brush.pressureOpacity) {
            opacity *= 0.2 + pressure * 0.8;
        }
        opacity = Math.min(opacity, 0.6);
        
        const startX = Math.max(0, Math.floor(x - radius));
        const startY = Math.max(0, Math.floor(y - radius));
        const endX = Math.min(canvas.width - 1, Math.ceil(x + radius));
        const endY = Math.min(canvas.height - 1, Math.ceil(y + radius));
        
        const width = endX - startX + 1;
        const height = endY - startY + 1;
        
        if (width <= 0 || height <= 0) return;
        
        const imageData = ctx.getImageData(startX, startY, width, height);
        const data = imageData.data;
        
        const r = this.color.r;
        const g = this.color.g;
        const b = this.color.b;
        const radiusSq = radius * radius;
        
        for (let py = startY; py <= endY; py++) {
            for (let px = startX; px <= endX; px++) {
                if (this.boundarySystem && this.boundarySystem.boundaryMask) {
                    const maskIdx = py * canvas.width + px;
                    if (this.boundarySystem.boundaryMask[maskIdx] === 1) {
                        continue;
                    }
                }
                
                const dx = px - x;
                const dy = py - y;
                const distSq = dx * dx + dy * dy;
                
                if (distSq > radiusSq) continue;
                
                const dist = Math.sqrt(distSq);
                const normalizedDist = dist / radius;
                let falloff = 1 - normalizedDist;
                falloff = Math.pow(falloff, 1 / Math.max(0.1, brush.hardness));
                
                const pixelOpacity = opacity * falloff;
                if (pixelOpacity < 0.01) continue;
                
                const localX = px - startX;
                const localY = py - startY;
                const idx = (localY * width + localX) * 4;
                
                const existingR = data[idx];
                const existingG = data[idx + 1];
                const existingB = data[idx + 2];
                const existingA = data[idx + 3] / 255;
                
                const outA = pixelOpacity + existingA * (1 - pixelOpacity);
                
                if (outA > 0) {
                    data[idx] = (r * pixelOpacity + existingR * existingA * (1 - pixelOpacity)) / outA;
                    data[idx + 1] = (g * pixelOpacity + existingG * existingA * (1 - pixelOpacity)) / outA;
                    data[idx + 2] = (b * pixelOpacity + existingB * existingA * (1 - pixelOpacity)) / outA;
                    data[idx + 3] = outA * 255;
                }
            }
        }
        
        ctx.putImageData(imageData, startX, startY);
    }
    
    erase(x, y, pressure = 0.5) {
        const size = this.size * 1.5;
        const radius = size / 2;
        
        if (this.boundarySystem && this.boundarySystem.currentRegionMask) {
            if (!this.boundarySystem.isPointInRegion(x, y)) {
                return;
            }
        }
        
        this.paintCtx.save();
        this.paintCtx.globalCompositeOperation = 'destination-out';
        this.paintCtx.globalAlpha = 0.3 + pressure * 0.7;
        
        const gradient = this.paintCtx.createRadialGradient(x, y, 0, x, y, radius);
        gradient.addColorStop(0, 'rgba(0,0,0,1)');
        gradient.addColorStop(0.7, 'rgba(0,0,0,0.5)');
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        
        this.paintCtx.fillStyle = gradient;
        this.paintCtx.beginPath();
        this.paintCtx.arc(x, y, radius, 0, Math.PI * 2);
        this.paintCtx.fill();
        this.paintCtx.restore();
    }
}

window.BrushTypes = BrushTypes;
window.AdvancedBrushEngine = AdvancedBrushEngine;
