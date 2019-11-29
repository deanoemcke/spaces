/* global chrome  */
// eslint-disable-next-line no-var, no-unused-vars
var utils = {
    getHashVariable: (key, urlStr) => {
        const valuesByKey = {};
        const keyPairRegEx = /^(.+)=(.+)/;

        if (!urlStr || urlStr.length === 0 || urlStr.indexOf('#') === -1) {
            return false;
        }

        // extract hash component from url
        const hashStr = urlStr.replace(/^[^#]+#+(.*)/, '$1');

        if (hashStr.length === 0) {
            return false;
        }

        hashStr.split('&').forEach(keyPair => {
            if (keyPair && keyPair.match(keyPairRegEx)) {
                valuesByKey[
                    keyPair.replace(keyPairRegEx, '$1')
                ] = keyPair.replace(keyPairRegEx, '$2');
            }
        });
        return valuesByKey[key] || false;
    },

    getSwitchKeycodes: callback => {
        chrome.runtime.sendMessage({ action: 'requestHotkeys' }, commands => {
            // eslint-disable-next-line no-console
            console.dir(commands);

            const commandStr = commands.switchCode;

            const keyStrArray = commandStr.split('+');

            // get keyStr of primary modifier
            const primaryModifier = keyStrArray[0];

            // get keyStr of secondary modifier
            const secondaryModifier =
                keyStrArray.length === 3 ? keyStrArray[1] : false;

            // get keycode of main key (last in array)
            const curStr = keyStrArray[keyStrArray.length - 1];

            // TODO: There's others. Period. Up Arrow etc.
            let mainKeyCode;
            if (curStr === 'Space') {
                mainKeyCode = 32;
            } else {
                mainKeyCode = curStr.toUpperCase().charCodeAt();
            }

            callback({
                primaryModifier,
                secondaryModifier,
                mainKeyCode,
            });
        });
    },
};
