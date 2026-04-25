export default class DummyManager {
    constructor(cursorContainer, discoGrid, room, updateTileColorsCallback) {
        this.cursorContainer = cursorContainer;
        this.discoGrid = discoGrid;
        this.room = room;
        this.updateTileColors = updateTileColorsCallback;
        this.localDummies = [];
        this.remoteDummies = {};
        this.MAX_DUMMIES = 7;
    }

    addDummy(row, col) {
        // If max dummies reached, remove the oldest
        if (this.localDummies.length >= this.MAX_DUMMIES) {
            this.removeDummy(this.localDummies[0]);
        }

        const rect = this.discoGrid.getBoundingClientRect();
        const dummyElement = this.createDummyElement();

        // Calculate relative position
        const relativeX = (col + 0.5) / 16;
        const relativeY = (row + 0.5) / 16;

        // Calculate absolute position
        const absoluteX = rect.left + relativeX * rect.width;
        const absoluteY = rect.top + relativeY * rect.height;

        dummyElement.style.left = `${absoluteX}px`;
        dummyElement.style.top = `${absoluteY}px`;

        this.cursorContainer.appendChild(dummyElement);

        const dummyData = {
            element: dummyElement,
            row: row,
            col: col,
            x: relativeX,  // Relative X position
            y: relativeY   // Relative Y position
        };

        this.localDummies.push(dummyData);

        // Sync dummy to other players
        this.syncDummies();

        // Trigger tile color update
        this.updateTileColors();

        return dummyData;
    }

    createDummyElement() {
        // Attempt to get local user info for dummy
        const localUser = this.room.peers ? this.room.peers[this.room.clientId] || {} : {};
        const username = localUser.username || 'D';
        const avatarUrl = localUser.avatarUrl;

        const dummyElement = document.createElement('div');
        dummyElement.classList.add('remote-cursor', 'dummy-cursor');
        
        // Style like a small cursor
        if (avatarUrl) {
            // If avatar exists, use it as a background image
            dummyElement.style.backgroundImage = `url('${avatarUrl}')`;
            dummyElement.style.backgroundSize = 'cover';
            dummyElement.style.backgroundPosition = 'center';
            dummyElement.style.width = '15px';
            dummyElement.style.height = '15px';
            dummyElement.textContent = ''; // Clear text when using image
        } else {
            // Fallback to first character if no avatar
            dummyElement.textContent = username.charAt(0);
            dummyElement.style.backgroundColor = 'rgba(255, 255, 0, 0.5)';
            dummyElement.style.boxShadow = '0 0 6px rgba(255, 255, 0, 0.3)';
        }

        dummyElement.title = `${username}'s Dummy`;
        return dummyElement;
    }

    removeDummy(dummyToRemove) {
        // Remove from DOM
        this.cursorContainer.removeChild(dummyToRemove.element);

        // Remove from local dummies array
        this.localDummies = this.localDummies.filter(dummy => dummy !== dummyToRemove);

        // Sync dummy removal to other players
        this.syncDummies();

        // Trigger tile color update
        this.updateTileColors();
    }

    syncDummies() {
        this.room.updatePresence({
            dummies: this.localDummies.map(dummy => ({
                row: dummy.row,
                col: dummy.col,
                x: dummy.x,
                y: dummy.y
            }))
        });
    }

    updateRemoteDummies(presence) {
        // Remove dummies for disconnected peers
        Object.keys(this.remoteDummies).forEach(peerId => {
            if (!presence[peerId]) {
                this.removeRemotePeerDummies(peerId);
            }
        });

        // Existing remote dummies update logic
        Object.entries(presence)
            .filter(([peerId]) => peerId !== this.room.clientId)
            .forEach(([peerId, peerData]) => {
                if (peerData.dummies) {
                    // Remove existing dummies for this peer
                    if (this.remoteDummies[peerId]) {
                        this.remoteDummies[peerId].forEach(dummy => {
                            this.cursorContainer.removeChild(dummy.element);
                        });
                    }

                    // Create new dummy elements
                    const newDummies = peerData.dummies.map(dummyData => {
                        const rect = this.discoGrid.getBoundingClientRect();
                        const dummyElement = this.createRemoteDummyElement(peerId);

                        // Calculate absolute position using relative coordinates
                        const absoluteX = rect.left + dummyData.x * rect.width;
                        const absoluteY = rect.top + dummyData.y * rect.height;

                        dummyElement.style.left = `${absoluteX}px`;
                        dummyElement.style.top = `${absoluteY}px`;

                        this.cursorContainer.appendChild(dummyElement);

                        return {
                            element: dummyElement,
                            row: dummyData.row,
                            col: dummyData.col,
                            x: dummyData.x,
                            y: dummyData.y
                        };
                    });

                    // Store new dummies
                    this.remoteDummies[peerId] = newDummies;
                }
            });

        // Trigger tile color update
        this.updateTileColors();
    }

    createRemoteDummyElement(peerId) {
        // Get remote user info
        const peerInfo = this.room.peers[peerId] || {};
        const username = peerInfo.username || 'D';
        const avatarUrl = peerInfo.avatarUrl;

        const dummyElement = document.createElement('div');
        dummyElement.classList.add('remote-cursor', 'dummy-cursor');
        
        if (avatarUrl) {
            // If avatar exists, use it as a background image
            dummyElement.style.backgroundImage = `url('${avatarUrl}')`;
            dummyElement.style.backgroundSize = 'cover';
            dummyElement.style.backgroundPosition = 'center';
            dummyElement.style.width = '15px';
            dummyElement.style.height = '15px';
            dummyElement.textContent = ''; // Clear text when using image
        } else {
            // Fallback to first character if no avatar
            dummyElement.textContent = username.charAt(0);
            dummyElement.style.backgroundColor = 'rgba(255, 255, 0, 0.5)';
            dummyElement.style.boxShadow = '0 0 6px rgba(255, 255, 0, 0.3)';
        }

        dummyElement.title = `${username}'s Dummy`;
        return dummyElement;
    }

    getDummyPositions() {
        const localDummyPositions = this.localDummies.map(dummy => ({
            x: dummy.x,
            y: dummy.y
        }));

        const remoteDummyPositions = Object.values(this.remoteDummies).flat().map(dummy => ({
            x: dummy.x,
            y: dummy.y
        }));

        return [...localDummyPositions, ...remoteDummyPositions];
    }

    removeRemotePeerDummies(peerId) {
        const peersRemoteDummies = this.remoteDummies[peerId];
        
        if (peersRemoteDummies) {
            // Remove dummy elements from the DOM
            peersRemoteDummies.forEach(dummy => {
                if (dummy.element && dummy.element.parentNode) {
                    this.cursorContainer.removeChild(dummy.element);
                }
            });

            // Remove the peer's dummies from the remoteDummies object
            delete this.remoteDummies[peerId];

            // Trigger tile color update
            this.updateTileColors();
        }
    }
}