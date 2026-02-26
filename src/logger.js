const isDebug = process.env.DEBUG === 'true' || process.env.DEBUG === '1';

export const debug = (...args) => { if (isDebug) console.log('DEBUG:', ...args); };
export const debugWarn = (...args) => { if (isDebug) console.warn('DEBUG:', ...args); };
export const debugError = (...args) => { if (isDebug) console.error('DEBUG:', ...args); };
