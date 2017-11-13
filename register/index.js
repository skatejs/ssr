// Base Undom implementation.
require('undom/register');

// Interfaces
require('./Comment');
require('./DocumentFragment');
require('./Element');
require('./Event');
require('./History');
require('./HTMLElement');
require('./MutationObserver');
require('./Node');
require('./NodeFilter');

// These require things have been setup.
require('./Window');
require('./Document');

// Startup.
document.readyState = 'interactive';
document.dispatchEvent(new Event('DOMContentLoaded'));
document.readyState = 'complete';
dispatchEvent(new Event('load'));
