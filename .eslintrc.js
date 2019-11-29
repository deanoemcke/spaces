module.exports = {
    env: {
        browser: true,
        es6: true,
    },
    extends: ['airbnb-base', 'plugin:prettier/recommended'],
    globals: {
        Atomics: 'readonly',
        SharedArrayBuffer: 'readonly',
    },
    parserOptions: {
        ecmaVersion: 2018,
    },
    ignorePatterns: ['db.js'],
    rules: {
        'no-use-before-define': 0,
        'no-underscore-dangle': 0,
    },
};
