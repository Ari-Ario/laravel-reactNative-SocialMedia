import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
    View,
    StyleSheet,
    ActivityIndicator,
    Alert,
    Platform,
    TouchableOpacity,
    Text,
    useWindowDimensions,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import CollaborationService from '@/services/ChatScreen/CollaborationService';

// HTML string containing the whiteboard canvas with Fabric.js
const WHITEBOARD_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/fabric.js/5.3.0/fabric.min.js"></script>
  <style>
    body {
      margin: 0;
      overflow: hidden;
      touch-action: none;
      background-color: #f5f5f5;
    }
    #canvas-container {
      width: 100vw;
      height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: #f5f5f5;
    }
    canvas {
      border: 1px solid #ddd;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      background-color: white;
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
    }
    .toolbar {
      position: fixed;
      bottom: 16px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(255,255,255,0.9);
      backdrop-filter: blur(8px);
      border-radius: 40px;
      padding: 8px 16px;
      display: flex;
      gap: 16px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 1000;
    }
    .tool-button {
      background: none;
      border: none;
      width: 48px;
      height: 48px;
      border-radius: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: background 0.2s;
    }
    .tool-button.active {
      background: #007AFF20;
    }
    .tool-button svg {
      width: 24px;
      height: 24px;
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
    }
    .color-picker {
      display: flex;
      gap: 8px;
      align-items: center;
      padding: 0 8px;
      border-left: 1px solid #ddd;
    }
    .color-swatch {
      width: 32px;
      height: 32px;
      border-radius: 16px;
      border: 2px solid transparent;
      cursor: pointer;
    }
    .color-swatch.active {
      border-color: #007AFF;
    }
    .slider {
      width: 100px;
      height: 4px;
      background: #ddd;
      border-radius: 2px;
      position: relative;
      margin: 0 8px;
    }
    .slider-thumb {
      width: 16px;
      height: 16px;
      background: #007AFF;
      border-radius: 8px;
      position: absolute;
      top: -6px;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <div id="canvas-container">
    <canvas id="whiteboard-canvas"></canvas>
  </div>
  <div class="toolbar" id="toolbar" style="display: none;">
    <button class="tool-button" data-tool="select" title="Select">
      <svg viewBox="0 0 24 24"><path d="M4 4l16 8-7 3-3 7-6-18z"/></svg>
    </button>
    <button class="tool-button" data-tool="pencil" title="Pencil">
      <svg viewBox="0 0 24 24"><path d="M17 3l4 4L7 21H3v-4L17 3z"/></svg>
    </button>
    <button class="tool-button" data-tool="line" title="Line">
      <svg viewBox="0 0 24 24"><path d="M20 20L4 4"/></svg>
    </button>
    <button class="tool-button" data-tool="rectangle" title="Rectangle">
      <svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" stroke="currentColor" fill="none"/></svg>
    </button>
    <button class="tool-button" data-tool="circle" title="Circle">
      <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" stroke="currentColor" fill="none"/></svg>
    </button>
    <button class="tool-button" data-tool="text" title="Text">
      <svg viewBox="0 0 24 24"><text x="4" y="18" font-family="sans-serif" font-size="14" fill="currentColor">Aa</text></svg>
    </button>
    <button class="tool-button" data-tool="eraser" title="Eraser">
      <svg viewBox="0 0 24 24"><path d="M18 4L20 6L8 18L4 14L16 2L18 4Z"/></svg>
    </button>
    <button class="tool-button" data-tool="clear" title="Clear All">
      <svg viewBox="0 0 24 24"><path d="M3 6h18M5 6v14a2 2 0 002 2h10a2 2 0 002-2V6M9 4h6"/></svg>
    </button>
    <button class="tool-button" data-tool="undo" title="Undo">
      <svg viewBox="0 0 24 24"><path d="M4 10l4-4v8H4V10zm12 0c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5z"/></svg>
    </button>
    <button class="tool-button" data-tool="redo" title="Redo">
      <svg viewBox="0 0 24 24"><path d="M20 10l-4-4v8h4v-4zm-12 0c2.8 0 5 2.2 5 5s-2.2 5-5 5-5-2.2-5-5 2.2-5 5-5z"/></svg>
    </button>
    <div class="color-picker">
      <div class="color-swatch" data-color="#000000" style="background: #000000;"></div>
      <div class="color-swatch" data-color="#FF3B30" style="background: #FF3B30;"></div>
      <div class="color-swatch" data-color="#34C759" style="background: #34C759;"></div>
      <div class="color-swatch" data-color="#007AFF" style="background: #007AFF;"></div>
      <div class="color-swatch" data-color="#FFCC00" style="background: #FFCC00;"></div>
      <div class="color-swatch" data-color="#AF52DE" style="background: #AF52DE;"></div>
      <div class="slider" id="stroke-slider">
        <div class="slider-thumb" id="stroke-thumb" style="left: 0;"></div>
      </div>
    </div>
  </div>
  <script>
    (function() {
      // Canvas setup
      let canvas = new fabric.Canvas('whiteboard-canvas', {
        isDrawingMode: false,
        width: window.innerWidth * 0.8,
        height: window.innerHeight * 0.8,
        backgroundColor: '#ffffff'
      });

      // State
      let currentTool = 'select';
      let currentColor = '#000000';
      let strokeWidth = 3;
      let history = [];
      let historyIndex = -1;

      // Undo/Redo stack management
      function saveState() {
        const state = canvas.toJSON(['id', 'selectable', 'hasControls']);
        // Remove previous future states if we're not at the end
        if (historyIndex < history.length - 1) {
          history = history.slice(0, historyIndex + 1);
        }
        history.push(state);
        historyIndex++;
        // Keep history size manageable
        if (history.length > 50) {
          history.shift();
          historyIndex--;
        }
      }

      // Initialize with empty state
      saveState();

      // Tool handlers
      function setTool(tool) {
        currentTool = tool;
        canvas.isDrawingMode = (tool === 'pencil' || tool === 'eraser');
        if (tool === 'eraser') {
          canvas.freeDrawingBrush.color = '#ffffff';
          canvas.freeDrawingBrush.width = strokeWidth * 2;
        } else if (tool === 'pencil') {
          canvas.freeDrawingBrush.color = currentColor;
          canvas.freeDrawingBrush.width = strokeWidth;
        } else {
          canvas.selection = (tool === 'select');
          canvas.forEachObject(obj => {
            obj.selectable = (tool === 'select');
            obj.hasControls = (tool === 'select');
          });
        }
        highlightTool(tool);
      }

      function highlightTool(tool) {
        document.querySelectorAll('.tool-button').forEach(btn => {
          btn.classList.toggle('active', btn.dataset.tool === tool);
        });
      }

      function setColor(color) {
        currentColor = color;
        canvas.freeDrawingBrush.color = color;
        document.querySelectorAll('.color-swatch').forEach(swatch => {
          swatch.classList.toggle('active', swatch.dataset.color === color);
        });
      }

      function setStrokeWidth(width) {
        strokeWidth = width;
        canvas.freeDrawingBrush.width = width;
        const thumb = document.getElementById('stroke-thumb');
        thumb.style.left = (width - 1) * 8 + 'px'; // scale 1-10 -> 0-72px
      }

      // Drawing events
      canvas.on('object:added', function(e) {
        if (!e.target._skipSave) {
          saveState();
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'objectAdded',
            object: e.target.toJSON(['id', 'selectable', 'hasControls'])
          }));
        }
      });

      canvas.on('object:modified', function(e) {
        if (!e.target._skipSave) {
          saveState();
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'objectModified',
            object: e.target.toJSON(['id', 'selectable', 'hasControls'])
          }));
        }
      });

      canvas.on('object:removed', function(e) {
        saveState();
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'objectRemoved',
          id: e.target.id || e.target._uid
        }));
      });

      canvas.on('path:created', function(e) {
        saveState();
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'objectAdded',
          object: e.path.toJSON(['id', 'selectable', 'hasControls'])
        }));
      });

      // Clear action
      function clearCanvas() {
        canvas.getObjects().forEach(obj => canvas.remove(obj));
        canvas.backgroundColor = '#ffffff';
        canvas.renderAll();
        saveState();
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'clear' }));
      }

      // Undo
      function undo() {
        if (historyIndex > 0) {
          historyIndex--;
          canvas.loadFromJSON(history[historyIndex], () => {
            canvas.renderAll();
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'undo',
              state: history[historyIndex]
            }));
          });
        }
      }

      // Redo
      function redo() {
        if (historyIndex < history.length - 1) {
          historyIndex++;
          canvas.loadFromJSON(history[historyIndex], () => {
            canvas.renderAll();
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'redo',
              state: history[historyIndex]
            }));
          });
        }
      }

      // Toolbar button listeners
      document.querySelectorAll('.tool-button').forEach(btn => {
        btn.addEventListener('click', () => {
          const tool = btn.dataset.tool;
          switch (tool) {
            case 'undo': undo(); break;
            case 'redo': redo(); break;
            case 'clear': clearCanvas(); break;
            default: setTool(tool);
          }
        });
      });

      // Color swatches
      document.querySelectorAll('.color-swatch').forEach(swatch => {
        swatch.addEventListener('click', () => {
          setColor(swatch.dataset.color);
        });
      });

      // Stroke slider (simplified)
      const slider = document.getElementById('stroke-slider');
      const thumb = document.getElementById('stroke-thumb');
      let dragging = false;

      thumb.addEventListener('mousedown', (e) => {
        dragging = true;
        e.preventDefault();
      });

      document.addEventListener('mousemove', (e) => {
        if (!dragging) return;
        const rect = slider.getBoundingClientRect();
        let x = e.clientX - rect.left;
        x = Math.max(0, Math.min(rect.width, x));
        const width = 1 + Math.floor(x / 8); // 1-10
        setStrokeWidth(width);
      });

      document.addEventListener('mouseup', () => {
        dragging = false;
      });

      // Message from React Native
      window.addEventListener('message', (event) => {
        try {
          const data = JSON.parse(event.data);
          switch (data.type) {
            case 'init':
              if (data.elements && data.elements.length) {
                canvas.loadFromJSON({ objects: data.elements }, () => {
                  canvas.renderAll();
                  // Rebuild history
                  history = [canvas.toJSON()];
                  historyIndex = 0;
                });
              }
              document.getElementById('toolbar').style.display = 'flex';
              break;
            case 'addObject':
              fabric.util.enlivenObjects([data.object], (objects) => {
                objects[0]._skipSave = true;
                canvas.add(objects[0]);
                canvas.renderAll();
              });
              break;
            case 'updateObject':
              // Find object by id and update
              const obj = canvas.getObjects().find(o => (o.id || o._uid) === data.object.id);
              if (obj) {
                obj._skipSave = true;
                obj.set(data.object);
                canvas.renderAll();
              }
              break;
            case 'removeObject':
              const toRemove = canvas.getObjects().find(o => (o.id || o._uid) === data.id);
              if (toRemove) {
                toRemove._skipSave = true;
                canvas.remove(toRemove);
                canvas.renderAll();
              }
              break;
            case 'clear':
              clearCanvas();
              break;
          }
        } catch (e) {
          console.error('Failed to parse message', e);
        }
      });

      // Resize handling
      window.addEventListener('resize', () => {
        canvas.setWidth(window.innerWidth * 0.8);
        canvas.setHeight(window.innerHeight * 0.8);
        canvas.renderAll();
      });

      // Expose for RN postMessage
      window.ready = true;
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
    })();
  </script>
</body>
</html>
`;

interface WhiteboardCanvasProps {
    spaceId: string;
    initialElements?: any[];
    onElementsChange?: (elements: any[]) => void;
    onError?: (error: any) => void;
}

export default function WhiteboardCanvas({
    spaceId,
    initialElements = [],
    onElementsChange,
    onError,
}: WhiteboardCanvasProps) {
    const webViewRef = useRef<WebView>(null);
    const [loading, setLoading] = useState(true);
    const [connected, setConnected] = useState(false);
    const { width, height } = useWindowDimensions();

    // Send initial elements when webview is ready
    useEffect(() => {
        if (connected && initialElements.length > 0) {
            webViewRef.current?.postMessage(JSON.stringify({
                type: 'init',
                elements: initialElements,
            }));
        }
    }, [connected, initialElements]);

    // Handle messages from webview
    const handleMessage = useCallback(
        (event: any) => {
            try {
                const data = JSON.parse(event.nativeEvent.data);
                switch (data.type) {
                    case 'ready':
                        setConnected(true);
                        setLoading(false);
                        break;
                    case 'objectAdded':
                    case 'objectModified':
                    case 'objectRemoved':
                    case 'clear':
                        // Forward to parent if needed
                        if (onElementsChange) {
                            // We don't have full elements list here, but we can request it later
                            // For now, just notify that something changed
                            onElementsChange([{ type: 'change', data }]);
                        }
                        break;
                    default:
                        console.log('Unhandled message from whiteboard:', data.type);
                }
            } catch (error) {
                console.error('Whiteboard message error:', error);
                onError?.(error);
            }
        },
        [onElementsChange, onError]
    );

    // WebView error handler
    const handleError = (syntheticEvent: any) => {
        const { nativeEvent } = syntheticEvent;
        console.error('WebView error:', nativeEvent);
        Alert.alert('Whiteboard Error', 'Failed to load whiteboard. Please try again.');
        onError?.(nativeEvent);
    };

    // WebView load end
    const handleLoadEnd = () => {
        setLoading(false);
    };

    return (
        <View style={styles.container}>
            {loading && (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color="#007AFF" />
                    <Text style={styles.loadingText}>Loading whiteboard...</Text>
                </View>
            )}
            <WebView
                ref={webViewRef}
                source={{ html: WHITEBOARD_HTML }}
                style={styles.webview}
                onMessage={handleMessage}
                onError={handleError}
                onLoadEnd={handleLoadEnd}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                allowsInlineMediaPlayback={true}
                mediaPlaybackRequiresUserAction={false}
                scalesPageToFit={false}
                scrollEnabled={false}
                bounces={false}
                overScrollMode="never"
                webviewDebuggingEnabled={__DEV__}
                containerStyle={styles.webviewContainer}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    webviewContainer: {
        flex: 1,
    },
    webview: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255,255,255,0.9)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
        color: '#666',
    },
});