import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
    View,
    StyleSheet,
    ActivityIndicator,
    Alert,
    Platform,
    Text,
    useWindowDimensions,
} from 'react-native';
import { WebView } from 'react-native-webview';

// HTML string containing the enhanced whiteboard canvas with Fabric.js
const WHITEBOARD_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/fabric.js/5.3.0/fabric.min.js"></script>
  <style>
    :root {
      --accent: #007AFF;
      --bg: #f8f9fa;
      --glass: rgba(255, 255, 255, 0.7);
      --shadow: 0 8px 32px rgba(0,0,0,0.12);
    }
    body {
      margin: 0;
      overflow: hidden;
      touch-action: none;
      background-color: var(--bg);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    #canvas-container {
      width: 100vw;
      height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background-image: radial-gradient(#d1d1d1 1px, transparent 1px);
      background-size: 24px 24px;
    }
    #canvas-container.no-grid {
      background-image: none;
    }
    canvas {
      background-color: transparent !important;
    }
    .toolbar {
      position: fixed;
      bottom: 16px;
      left: 50%;
      transform: translateX(-50%);
      background: var(--glass);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(255,255,255,0.4);
      border-radius: 40px;
      padding: 4px 8px;
      display: flex;
      align-items: center;
      gap: 4px;
      box-shadow: var(--shadow);
      z-index: 1000;
      max-width: 92vw;
      overflow-x: auto;
      scrollbar-width: none; /* Firefox */
      -ms-overflow-style: none;  /* IE 10+ */
    }
    .toolbar::-webkit-scrollbar {
      display: none; /* Safari/Chrome */
    }
    .tool-section {
      display: flex;
      gap: 2px;
      padding: 0 2px;
      flex-shrink: 0;
    }
    .divider {
      width: 1px;
      height: 18px;
      background: rgba(0,0,0,0.1);
      flex-shrink: 0;
    }
    .tool-button {
      background: none;
      border: none;
      width: 32px;
      height: 32px;
      border-radius: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      color: #444;
      flex-shrink: 0;
    }
    .tool-button:active {
      transform: scale(0.85);
    }
    .tool-button.active {
      background: var(--accent);
      color: white;
      box-shadow: 0 4px 10px rgba(0,122,255,0.4);
    }
    .tool-button svg {
      width: 16px;
      height: 16px;
      pointer-events: none;
    }
    .color-picker {
      display: flex;
      gap: 4px;
      flex-shrink: 0;
    }
    .color-swatch {
      width: 20px;
      height: 20px;
      border-radius: 10px;
      border: 2px solid white;
      cursor: pointer;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      transition: transform 0.2s;
      flex-shrink: 0;
    }
    .color-swatch.active {
      transform: scale(1.3);
      border-color: var(--accent);
    }
    @media (min-width: 600px) {
       .toolbar { padding: 6px 16px; gap: 8px; bottom: 24px; }
       .tool-button { width: 40px; height: 40px; border-radius: 20px; }
       .tool-button svg { width: 20px; height: 20px; }
       .color-swatch { width: 24px; height: 24px; }
       .divider { height: 24px; }
    }
  </style>
</head>
<body>
  <div id="canvas-container">
    <canvas id="whiteboard-canvas"></canvas>
  </div>
  <div class="toolbar" id="toolbar" style="display: none; opacity: 0; transform: translate(-50%, 40px);">
    <div class="tool-section">
      <button class="tool-button" data-tool="select" title="Select">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5"></path></svg>
      </button>
      <button class="tool-button" data-tool="pencil" title="Draw">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
      </button>
      <button class="tool-button" data-tool="text" title="Text">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5L6 9H2V15H6L11 19V5Z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16m-7 6h7"></path></svg>
      </button>
    </div>
    
    <div class="divider"></div>
    
    <div class="tool-section">
      <button class="tool-button" data-tool="rectangle" title="Rectangle">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2" stroke-width="2"></rect></svg>
      </button>
      <button class="tool-button" data-tool="circle" title="Circle">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" stroke-width="2"></circle></svg>
      </button>
    </div>

    <div class="divider"></div>

    <div class="tool-section">
      <div class="color-picker" id="color-picker">
        <div class="color-swatch" data-color="#000000" style="background: #000000;"></div>
        <div class="color-swatch" data-color="#FF3B30" style="background: #FF3B30;"></div>
        <div class="color-swatch" data-color="#34C759" style="background: #34C759;"></div>
        <div class="color-swatch" data-color="#007AFF" style="background: #007AFF;"></div>
        <div class="color-swatch" data-color="#AF52DE" style="background: #AF52DE;"></div>
      </div>
    </div>

    <div class="divider"></div>

    <div class="tool-section">
      <button class="tool-button" data-tool="undo" title="Undo">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"></path></svg>
      </button>
      <button class="tool-button" data-tool="share" title="Share to Chat" style="color: var(--accent);">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
      </button>
      <button class="tool-button" data-tool="clear" title="Clear">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
      </button>
    </div>
  </div>

  <script>
    (function() {
      // Universal postMessage helper
      window.postToApp = function(data) {
        console.log('[Whiteboard] postToApp:', data.type);
        const msg = typeof data === 'string' ? data : JSON.stringify(data);
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
            window.ReactNativeWebView.postMessage(msg);
        } else if (window.parent && window.parent.postMessage) {
            window.parent.postMessage(msg, '*');
        }
      };

      // Canvas setup with premium defaults
      let canvas = new fabric.Canvas('whiteboard-canvas', {
        isDrawingMode: false,
        width: window.innerWidth,
        height: window.innerHeight,
        backgroundColor: 'transparent'
      });

      // Enable smoothing for pencil
      canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
      canvas.freeDrawingBrush.width = 4;
      canvas.freeDrawingBrush.decimate = 2;

      // State
      let currentTool = 'pencil';
      let currentColor = '#000000';
      let isBusy = false;

      function syncToApp() {
        if (isBusy) return;
        const raw = canvas.toObject(['id', 'selectable', 'hasControls']);
        const validObjects = (raw.objects || []).filter(o => o && o.type);
        
        window.postToApp({
           type: 'elementsChanged',
           elements: validObjects
        });
      }

      function exportAsImage() {
          console.log('[Whiteboard] Exporting snapshot...');
          // 1. Hide grid for clean shot
          const container = document.getElementById('canvas-container');
          const toolbar = document.getElementById('toolbar');
          container.classList.add('no-grid');
          toolbar.style.opacity = '0';

          setTimeout(() => {
              try {
                  // 2. Capture
                  // Limit multiplier to avoid massive data URLs that might crash the bridge
                  const multiplier = Math.min(window.devicePixelRatio || 1, 1.5);
                  console.log('[Whiteboard] Capturing with multiplier:', multiplier);
                  
                  const dataURL = canvas.toDataURL({
                      format: 'png',
                      quality: 0.9,
                      multiplier: multiplier
                  });

                  console.log('[Whiteboard] Snapshot captured, length:', dataURL.length);

                  // 3. Send to App
                  window.postToApp({
                      type: 'shareImage',
                      image: dataURL
                  });
              } catch (err) {
                  console.error('[Whiteboard] Export failed:', err);
              } finally {
                  // 4. Restore UI
                  container.classList.remove('no-grid');
                  toolbar.style.opacity = '1';
              }
          }, 100);
      }

      function setTool(tool) {
        currentTool = tool;
        canvas.isDrawingMode = (tool === 'pencil');
        canvas.selection = (tool === 'select');
        
        if (tool === 'pencil') {
          canvas.freeDrawingBrush.color = currentColor;
          canvas.freeDrawingBrush.width = 4;
        } else {
          canvas.forEachObject(obj => {
            obj.selectable = (tool === 'select');
            obj.hasControls = (tool === 'select');
          });
        }
        
        highlightTool(tool);
      }

      function createShape(tool) {
          const common = {
              left: 100,
              top: 100,
              fill: 'transparent',
              stroke: currentColor,
              strokeWidth: 3,
              id: 'shape_' + Date.now()
          };

          let shape;
          if (tool === 'rectangle') {
              shape = new fabric.Rect({ ...common, width: 100, height: 100 });
          } else if (tool === 'circle') {
              shape = new fabric.Circle({ ...common, radius: 50 });
          } else if (tool === 'text') {
              shape = new fabric.IText('Double click to edit', { ...common, fill: currentColor, strokeWidth: 0, fontSize: 20 });
          }

          if (shape) {
              canvas.add(shape);
              canvas.setActiveObject(shape);
              setTool('select');
              syncToApp();
          }
      }

      function highlightTool(tool) {
        document.querySelectorAll('.tool-button').forEach(btn => {
          btn.classList.toggle('active', btn.dataset.tool === tool);
        });
      }

      function setColor(color) {
        currentColor = color;
        if (canvas.isDrawingMode) {
          canvas.freeDrawingBrush.color = color;
        }
        const active = canvas.getActiveObject();
        if (active) {
            if (active.type === 'i-text') active.set('fill', color);
            else active.set('stroke', color);
            canvas.renderAll();
            syncToApp();
        }
        
        document.querySelectorAll('.color-swatch').forEach(swatch => {
          swatch.classList.toggle('active', swatch.dataset.color === color);
        });
      }

      // Events
      canvas.on('object:added', syncToApp);
      canvas.on('object:modified', syncToApp);
      canvas.on('object:removed', syncToApp);
      canvas.on('path:created', syncToApp);

      // Tool Listeners
      document.querySelectorAll('.tool-button').forEach(btn => {
        btn.addEventListener('click', () => {
          const tool = btn.dataset.tool;
          if (tool === 'clear') {
            canvas.clear();
            syncToApp();
          } else if (tool === 'undo') {
            if (canvas._objects.length > 0) {
                canvas.remove(canvas._objects[canvas._objects.length - 1]);
                syncToApp();
            }
          } else if (tool === 'share') {
            exportAsImage();
          } else if (['rectangle', 'circle', 'text'].includes(tool)) {
            createShape(tool);
          } else {
            setTool(tool);
          }
        });
      });

      document.querySelectorAll('.color-swatch').forEach(swatch => {
        swatch.addEventListener('click', () => setColor(swatch.dataset.color));
      });

      window.addEventListener('message', (event) => {
        try {
          const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
          if (data.type === 'init' || data.type === 'update') {
            isBusy = true;
            if (data.elements) {
                const valid = data.elements.filter(o => o && o.type && typeof fabric[fabric.util.string.camelize(fabric.util.string.capitalize(o.type))] !== 'undefined' || o.type === 'path' || o.type === 'rect' || o.type === 'circle' || o.type === 'i-text');
                
                canvas.loadFromJSON({ objects: valid }, () => {
                   canvas.renderAll();
                   isBusy = false;
                });
            } else {
                isBusy = false;
            }
          }
        } catch (e) {
          console.error('Whiteboard: Parse Error', e);
          isBusy = false;
        }
      });

      setTimeout(() => {
        const tb = document.getElementById('toolbar');
        tb.style.display = 'flex';
        setTimeout(() => {
           tb.style.opacity = '1';
           tb.style.transform = 'translate(-50%, 0)';
        }, 600);
        setTool('pencil');
        window.postToApp({ type: 'ready' });
      }, 600);

      window.addEventListener('resize', () => {
        canvas.setWidth(window.innerWidth);
        canvas.setHeight(window.innerHeight);
        canvas.renderAll();
      });
    })();
  </script>
</body>
</html>
`;

interface WhiteboardCanvasProps {
    spaceId: string;
    initialElements?: any[];
    onElementsChange?: (elements: any[]) => void;
    onShare?: (base64Image: string) => void;
    onError?: (error: any) => void;
}

export default function WhiteboardCanvas({
    spaceId,
    initialElements = [],
    onElementsChange,
    onShare,
    onError,
}: WhiteboardCanvasProps) {
    const webViewRef = useRef<WebView>(null);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [loading, setLoading] = useState(true);
    const [connected, setConnected] = useState(false);

    const handleMessage = useCallback(
        (event: any) => {
            try {
                const data = typeof event.nativeEvent.data === 'string' 
                    ? JSON.parse(event.nativeEvent.data) 
                    : event.nativeEvent.data;

                console.log('[WhiteboardBridge] Received:', data.type);

                if (data.type === 'ready') {
                    setConnected(true);
                    setLoading(false);
                } else if (data.type === 'elementsChanged') {
                    onElementsChange?.(data.elements);
                } else if (data.type === 'shareImage') {
                    onShare?.(data.image);
                }
            } catch (err) {
                console.warn('Whiteboard Bridge Signal Error:', err);
            }
        },
        [onElementsChange, onShare]
    );

    // Initial Sync
    useEffect(() => {
        if (connected) {
            const data = JSON.stringify({ type: 'init', elements: initialElements });
            if (Platform.OS === 'web') iframeRef.current?.contentWindow?.postMessage(data, '*');
            else webViewRef.current?.postMessage(data);
        }
    }, [connected]);

    // Web Event Listener
    useEffect(() => {
        if (Platform.OS !== 'web') return;
        const listener = (e: MessageEvent) => handleMessage({ nativeEvent: { data: e.data } });
        window.addEventListener('message', listener);
        return () => window.removeEventListener('message', listener);
    }, [handleMessage]);

    return (
        <View style={styles.container}>
            {loading && (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color="#007AFF" />
                </View>
            )}
            
            {Platform.OS === 'web' ? (
                <iframe ref={iframeRef as any} srcDoc={WHITEBOARD_HTML} style={styles.iframe} title="whiteboard" />
            ) : (
                <WebView
                    ref={webViewRef}
                    source={{ html: WHITEBOARD_HTML }}
                    style={styles.webview}
                    onMessage={handleMessage}
                    javaScriptEnabled={true}
                    domStorageEnabled={true}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8f9fa' },
    iframe: { flex: 1, width: '100%', height: '100%', borderWidth: 0 },
    webview: { flex: 1, backgroundColor: 'transparent' },
    loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: '#f8f9fa', justifyContent: 'center', alignItems: 'center', zIndex: 10 },
});