describe('Superscript Pattern Debug', () => {
    it('should show what the OLD pattern matches', () => {
        const text = '> Given $R^{+}_{xy}$ and $R^{+}_{yz}$, if x=y or y=z, obviously we have $R^{+}_{xz}$';
        const pattern = /\^([^^~\s]+(?:\s+[^^~\s]+)*)\^/g;
        
        let match;
        while ((match = pattern.exec(text)) !== null) {
            console.log(`Match found at position ${match.index}:`);
            console.log(`  Full match: '${match[0]}'`);
            console.log(`  Captured group: '${match[1]}'`);
            console.log(`  From ${match.index} to ${match.index + match[0].length}`);
        }
    });
    
    it('should test the NEW pattern that excludes $', () => {
        // Just the problematic part
        const text = '$R^{+}_{xy}$ and $R^{+}_{yz}$';
        const pattern = /\^([^^~\s$]+(?:\s+[^^~\s$]+)*)\^/g;
        
        let match;
        while ((match = pattern.exec(text)) !== null) {
            console.log(`Match in problematic text:`);
            console.log(`  Full match: '${match[0]}'`);
            console.log(`  Position: ${match.index} to ${match.index + match[0].length}`);
        }
    });
    
    it('should work with normal superscripts outside math', () => {
        const text = 'This is ^superscript^ and math $x^2$';
        const pattern = /\^([^^~\s$]+(?:\s+[^^~\s$]+)*)\^/g;
        
        let match;
        while ((match = pattern.exec(text)) !== null) {
            console.log(`Normal superscript match:`);
            console.log(`  Full match: '${match[0]}'`);
            console.log(`  Should be: '^superscript^'`);
        }
    });
});