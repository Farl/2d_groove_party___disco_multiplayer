export default class ToneMapper {
    // Chromatic scale with tone names
    static CHROMATIC_SCALE = [
        { name: 'C4', frequency: 261.63 },
        { name: 'C#4/Db4', frequency: 277.18 },
        { name: 'D4', frequency: 293.66 },
        { name: 'D#4/Eb4', frequency: 311.13 },
        { name: 'E4', frequency: 329.63 },
        { name: 'F4', frequency: 349.23 },
        { name: 'F#4/Gb4', frequency: 369.99 },
        { name: 'G4', frequency: 392.00 },
        { name: 'G#4/Ab4', frequency: 415.30 },
        { name: 'A4', frequency: 440.00 },
        { name: 'A#4/Bb4', frequency: 466.16 },
        { name: 'B4', frequency: 493.88 },
        { name: 'C5', frequency: 523.25 },
        { name: 'C#5/Db5', frequency: 554.37 },
        { name: 'D5', frequency: 587.33 },
        { name: 'D#5/Eb5', frequency: 622.25 }
    ];

    static getFrequencyForRow(row) {
        // Reversed row calculation to match existing logic
        return this.CHROMATIC_SCALE[15 - row].frequency;
    }

    static getToneNameForRow(row) {
        // Reversed row calculation to match existing logic
        return this.CHROMATIC_SCALE[15 - row].name;
    }

    static createToneLabels(discoGrid) {
        const gridWidth = discoGrid.clientWidth;
        const gridHeight = discoGrid.clientHeight;
        const tileHeight = gridHeight / 16;

        this.CHROMATIC_SCALE.forEach((tone, index) => {
            const label = document.createElement('div');
            label.classList.add('tone-label');
            label.textContent = tone.name;
            
            // Position the label vertically corresponding to the row
            label.style.top = `${(15 - index) * tileHeight}px`;
            label.style.height = `${tileHeight}px`;
            label.style.position = 'absolute';
            label.style.left = '0px';
            
            // More subtle styling with increased transparency
            label.style.fontSize = '10px';
            label.style.color = 'rgba(255, 255, 255, 0.3)'; // Very transparent white
            label.style.textAlign = 'left';
            label.style.paddingLeft = '5px';
            label.style.textShadow = '0 1px 2px rgba(0,0,0,0.2)'; // Soft shadow for depth
            label.style.fontWeight = '300'; // Lighter font weight
            
            discoGrid.appendChild(label);
        });
    }
}