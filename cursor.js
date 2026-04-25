import _ from 'lodash-es';
import DummyManager from './dummy-manager.js';
import ToneMapper from 'tone-mapper';

class CursorManager {
    constructor() {
        this.room = new WebsimSocket();
        this.cursorContainer = document.getElementById('cursor-container');
        this.discoGrid = document.getElementById('disco-grid');
        this.remoteCursors = {};
        
        // Defensive initialization
        this.localCursor = null;
        this.lastMouseEvent = null;
        
        // Audio context
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Existing state tracking
        this.lastTilesWithCursors = new Set();
        this.activeTiles = new Set();
        this.triggeredTiles = new Set();
        
        this.createDiscoGrid();
        this.initializeEventListeners();
        this.setupRoom();
        this.startDiscoAnimation();
        this.startScanlineEffect();
        
        // Replace local dummy management with DummyManager
        this.dummyManager = new DummyManager(
            this.cursorContainer, 
            this.discoGrid, 
            this.room, 
            this.updateTileColors.bind(this)
        );

        // Modify tile click handler to use new DummyManager
        this.discoGrid.addEventListener('click', this.handleTileClick.bind(this));

        // Add tone labels to disco grid
        ToneMapper.createToneLabels(this.discoGrid);

        // Update playRowSound to use ToneMapper
        this.playRowSound = (row) => {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            const frequency = ToneMapper.getFrequencyForRow(row);
            oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
            
            oscillator.type = 'sine';
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            // Increased volume 
            gainNode.gain.setValueAtTime(18.0, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.3);
            
            oscillator.start();
            oscillator.stop(this.audioContext.currentTime + 0.3);
        };
    }

    createDiscoGrid() {
        for (let row = 0; row < 16; row++) {
            for (let col = 0; col < 16; col++) {
                const tile = document.createElement('div');
                tile.classList.add('disco-tile');
                
                // Chromatic scale hue mapping
                const chromaticHues = [
                    0,    // Red
                    30,   // Orange
                    60,   // Yellow
                    90,   // Lime Green
                    120,  // Green
                    150,  // Teal
                    180,  // Cyan
                    210,  // Sky Blue
                    240,  // Blue
                    270,  // Indigo
                    300,  // Purple
                    330,  // Pink
                    360,  // Red (looped)
                    30,   // Orange
                    60,   // Yellow
                    90    // Lime Green
                ];

                const hue = chromaticHues[15 - row];
                tile.style.backgroundColor = `hsla(${hue}, 70%, 20%, 0.3)`;
                
                // Store row and column for later reference
                tile.dataset.row = row;
                tile.dataset.col = col;
                
                this.discoGrid.appendChild(tile);
            }
        }
    }

    createLocalCursor() {
        const localUser = this.room.peers ? this.room.peers[this.room.clientId] || {} : {};
        const username = localUser.username || 'You';
        const avatarUrl = localUser.avatarUrl;

        const cursorElement = document.createElement('div');
        cursorElement.classList.add('remote-cursor', 'local-cursor');
        
        if (avatarUrl) {
            // If avatar exists, use it as a background image
            cursorElement.style.backgroundImage = `url('${avatarUrl}')`;
            cursorElement.style.backgroundSize = 'cover';
            cursorElement.style.backgroundPosition = 'center';
            cursorElement.style.border = '2px solid rgba(0, 255, 0, 0.7)';
            cursorElement.textContent = ''; // Clear text when using image
        } else {
            // Fallback to first character if no avatar
            cursorElement.textContent = username.charAt(0);
            cursorElement.style.backgroundColor = 'rgba(0, 255, 0, 0.5)';
            cursorElement.style.boxShadow = '0 0 8px rgba(0, 255, 0, 0.3)';
        }

        cursorElement.title = username;
        this.cursorContainer.appendChild(cursorElement);
        return cursorElement;
    }

    startDiscoAnimation() {
        setInterval(() => {
            const tiles = this.discoGrid.querySelectorAll('.disco-tile');
            tiles.forEach(tile => {
                // Only apply disco effect to tiles not in triggeredTiles
                if (!this.triggeredTiles.has(tile)) {
                    const row = parseInt(tile.dataset.row);
                    const chromaticHues = [
                        0,    // Red
                        30,   // Orange
                        60,   // Yellow
                        90,   // Lime Green
                        120,  // Green
                        150,  // Teal
                        180,  // Cyan
                        210,  // Sky Blue
                        240,  // Blue
                        270,  // Indigo
                        300,  // Purple
                        330,  // Pink
                        360,  // Red (looped)
                        30,   // Orange
                        60,   // Yellow
                        90    // Lime Green
                    ];
                    const hue = chromaticHues[15 - row];
                    const randomVariation = Math.floor(Math.random() * 20) - 10;
                    tile.style.backgroundColor = `hsla(${hue}, 70%, ${20 + randomVariation}%, 0.3)`;
                }
            });
        }, 500);
    }

    startScanlineEffect() {
        const tiles = Array.from(this.discoGrid.querySelectorAll('.disco-tile'));
        let columnIndex = 0;

        const scanColumn = () => {
            // Reset all tiles
            tiles.forEach(tile => tile.classList.remove('scanned'));

            // Scan current column
            const currentColumnTiles = tiles.filter((tile, index) => index % 16 === columnIndex);
            currentColumnTiles.forEach(tile => {
                tile.classList.add('scanned');
                
                // Only play sound if the tile is already in the triggeredTiles set
                if (this.triggeredTiles.has(tile)) {
                    const row = parseInt(tile.dataset.row);
                    this.playRowSound(row);
                }
            });

            // Move to next column
            columnIndex = (columnIndex + 1) % 16;

            // Schedule next scan
            setTimeout(scanColumn, 200);
        };

        // Start the scanline effect
        scanColumn();
    }

    getCursorsOnRow(targetRow) {
        // Collect all cursor positions (local and remote)
        const allCursors = [];

        // Add local cursor if exists
        const localCursor = this.getCurrentLocalCursorPosition();
        if (localCursor) {
            allCursors.push(localCursor);
        }

        // Add remote cursors
        Object.values(this.remoteCursors).forEach(cursor => {
            allCursors.push({
                x: parseInt(cursor.style.left),
                y: parseInt(cursor.style.top)
            });
        });

        // Filter cursors on the specific row
        return allCursors.filter(cursor => {
            const cursorRow = Math.floor(cursor.y / (window.innerHeight / 16));
            return cursorRow === targetRow;
        });
    }

    getCursorsOnTiles() {
        const rect = this.discoGrid.getBoundingClientRect();
        const tiles = Array.from(this.discoGrid.querySelectorAll('.disco-tile'));

        // Collect all cursors (local and remote)
        const allCursors = [];

        // Add local cursor if exists
        const localCursor = this.getCurrentLocalCursorPosition();
        if (localCursor) {
            allCursors.push({
                x: localCursor.x * rect.width + rect.left,
                y: localCursor.y * rect.height + rect.top
            });
        }

        // Add remote cursors
        Object.values(this.remoteCursors).forEach(cursor => {
            allCursors.push({
                x: parseInt(cursor.style.left),
                y: parseInt(cursor.style.top)
            });
        });

        // Add dummies using new method from DummyManager
        const dummyPositions = this.dummyManager.getDummyPositions();
        dummyPositions.forEach(dummy => {
            allCursors.push({
                x: dummy.x * rect.width + rect.left,
                y: dummy.y * rect.height + rect.top
            });
        });

        // Find tiles with cursors
        return tiles.filter(tile => {
            const tileRect = tile.getBoundingClientRect();
            return allCursors.some(cursor => 
                cursor.x >= tileRect.left && 
                cursor.x <= tileRect.right && 
                cursor.y >= tileRect.top && 
                cursor.y <= tileRect.bottom
            );
        });
    }

    getCurrentLocalCursorPosition() {
        const lastEvent = this.lastMouseEvent;
        if (!lastEvent) return null;

        const rect = this.discoGrid?.getBoundingClientRect();
        if (!rect) return null;

        return { 
            x: (lastEvent.clientX - rect.left) / rect.width, 
            y: (lastEvent.clientY - rect.top) / rect.height 
        };
    }

    async setupRoom() {
        try {
            await this.room.initialize();

            // Create local cursor after room initialization
            this.localCursor = this.createLocalCursor();

            // Subscribe to presence updates to track cursor positions
            this.room.subscribePresence(this.updateRemoteCursors.bind(this));

            // Initial presence update to show our cursor
            this.room.updatePresence({
                cursor: { x: 0, y: 0 }
            });
        } catch (error) {
            console.error('Error initializing room:', error);
        }
    }

    initializeEventListeners() {
        window.addEventListener('mousemove', (e) => {
            // Store the last mouse event for row checking
            this.lastMouseEvent = e;

            // Defensive checks
            if (!this.discoGrid || !this.localCursor) return;

            // Calculate relative position
            const rect = this.discoGrid.getBoundingClientRect();
            const relativeX = (e.clientX - rect.left) / rect.width;
            const relativeY = (e.clientY - rect.top) / rect.height;

            // Update local cursor position
            const absoluteX = e.clientX;
            const absoluteY = e.clientY;
            this.localCursor.style.left = `${absoluteX}px`;
            this.localCursor.style.top = `${absoluteY}px`;

            // Defensive check before updating presence
            if (this.room) {
                this.room.updatePresence({
                    cursor: { 
                        x: relativeX, 
                        y: relativeY 
                    }
                });
            }

            // Update tile colors based on cursor positions
            this.updateTileColors();
        });

        // Modify mousedown event to do nothing
        window.addEventListener('mousedown', (e) => {
            e.preventDefault();
        });
    }

    handleTileClick(e) {
        const tile = e.target.closest('.disco-tile');
        if (!tile) return;

        const row = parseInt(tile.dataset.row);
        const col = parseInt(tile.dataset.col);

        // Check if we already have a dummy at this location
        const existingDummy = this.dummyManager.localDummies.find(
            dummy => dummy.row === row && dummy.col === col
        );

        if (existingDummy) {
            // Remove the dummy if it exists
            this.dummyManager.removeDummy(existingDummy);
        } else {
            // Add a new dummy
            this.dummyManager.addDummy(row, col);
        }
    }

    updateTileColors() {
        const tilesWithCursors = this.getCursorsOnTiles();

        // Restore background for tiles that no longer have cursors
        this.activeTiles.forEach(tile => {
            if (!tilesWithCursors.includes(tile)) {
                const row = parseInt(tile.dataset.row);
                
                const chromaticHues = [
                    0,    // Red
                    30,   // Orange
                    60,   // Yellow
                    90,   // Lime Green
                    120,  // Green
                    150,  // Teal
                    180,  // Cyan
                    210,  // Sky Blue
                    240,  // Blue
                    270,  // Indigo
                    300,  // Purple
                    330,  // Pink
                    360,  // Red (looped)
                    30,   // Orange
                    60,   // Yellow
                    90    // Lime Green
                ];
                const hue = chromaticHues[15 - row];
                
                // Remove from triggered tiles if no cursor
                this.triggeredTiles.delete(tile);
                
                // Restore original disco effect
                tile.style.backgroundColor = `hsla(${hue}, 70%, 20%, 0.3)`;
                this.activeTiles.delete(tile);
            }
        });

        // Highlight new tiles with cursors
        tilesWithCursors.forEach(tile => {
            const row = parseInt(tile.dataset.row);
            
            const chromaticHues = [
                0,    // Red
                30,   // Orange
                60,   // Yellow
                90,   // Lime Green
                120,  // Green
                150,  // Teal
                180,  // Cyan
                210,  // Sky Blue
                240,  // Blue
                270,  // Indigo
                300,  // Purple
                330,  // Pink
                360,  // Red (looped)
                30,   // Orange
                60,   // Yellow
                90    // Lime Green
            ];
            const hue = chromaticHues[15 - row];
            
            // Increase brightness to 70% and saturation to 100%
            tile.style.backgroundColor = `hsla(${hue}, 100%, 70%, 0.8)`;
            this.triggeredTiles.add(tile);
            this.activeTiles.add(tile);
        });
    }

    updateRemoteCursors(presence) {
        // Defensive checks
        if (!presence || !this.room) return;

        // Remove cursors for disconnected peers
        Object.keys(this.remoteCursors).forEach(peerId => {
            if (!presence[peerId]) {
                this.removeRemoteCursor(peerId);
            }
        });

        // Update or add remote cursors
        Object.entries(presence)
            .filter(([peerId]) => peerId !== this.room.clientId)
            .forEach(([peerId, peerData]) => {
                if (peerData.cursor) {
                    this.updateRemoteCursor(peerId, peerData);
                }
            });

        // Update remote dummies, passing entire presence
        if (this.dummyManager) {
            this.dummyManager.updateRemoteDummies(presence);
        }

        // After updating remote cursors and dummies, update tile colors
        this.updateTileColors();
    }

    updateRemoteCursor(peerId, peerData) {
        let cursorElement = this.remoteCursors[peerId];
        
        if (!cursorElement) {
            cursorElement = this.createRemoteCursor(peerId);
        }

        const { cursor } = peerData;
        const rect = this.discoGrid.getBoundingClientRect();
        
        // Convert relative position back to pixel coordinates
        cursorElement.style.left = `${cursor.x * rect.width + rect.left}px`;
        cursorElement.style.top = `${cursor.y * rect.height + rect.top}px`;
    }

    createRemoteCursor(peerId) {
        const cursorElement = document.createElement('div');
        cursorElement.classList.add('remote-cursor');
        
        // Add peer avatar or username
        const peerInfo = this.room.peers[peerId] || {};
        const avatarUrl = peerInfo.avatarUrl;
        const username = peerInfo.username;
        
        if (avatarUrl) {
            // If avatar exists, use it as a background image
            cursorElement.style.backgroundImage = `url('${avatarUrl}')`;
            cursorElement.style.backgroundSize = 'cover';
            cursorElement.style.backgroundPosition = 'center';
            cursorElement.textContent = ''; // Clear text when using image
        } else {
            // Fallback to first character if no avatar
            cursorElement.textContent = (username || 'P').charAt(0);
        }

        cursorElement.title = username || 'Peer';
        this.cursorContainer.appendChild(cursorElement);
        this.remoteCursors[peerId] = cursorElement;
        
        return cursorElement;
    }

    removeRemoteCursor(peerId) {
        const cursorElement = this.remoteCursors[peerId];
        if (cursorElement) {
            this.cursorContainer.removeChild(cursorElement);
            delete this.remoteCursors[peerId];
        }
    }
}

// Export the class directly
export default CursorManager;