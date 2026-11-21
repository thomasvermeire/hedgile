// Jest setup file
// Mock CSS imports
const mockCSS = {};
require.extensions['.css'] = () => mockCSS;

// Mock Font Awesome if needed
global.FontAwesome = {};
