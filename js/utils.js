'use strict';

var utils = {
    getHashVariable: function(key, urlStr) {
        var valuesByKey = {},
            keyPairRegEx = /^(.+)=(.+)/,
            hashStr;

        if (!urlStr || urlStr.length === 0 || urlStr.indexOf('#') === -1) {
            return false;
        }

        //extract hash component from url
        hashStr = urlStr.replace(/^[^#]+#+(.*)/, '$1');

        if (hashStr.length === 0) {
            return false;
        }

        hashStr.split('&').forEach(function(keyPair) {
            if (keyPair && keyPair.match(keyPairRegEx)) {
                valuesByKey[
                    keyPair.replace(keyPairRegEx, '$1')
                ] = keyPair.replace(keyPairRegEx, '$2');
            }
        });
        return valuesByKey[key] || false;
    },

    getSwitchKeycodes: function(callback) {
        chrome.runtime.sendMessage({ action: 'requestHotkeys' }, function(
            commands
        ) {
            console.dir(commands);

            var commandStr = commands.switchCode,
                keyStrArray,
                curStr,
                primaryModifier,
                secondaryModifier,
                mainKeyCode;

            keyStrArray = commandStr.split('+');

            //get keyStr of primary modifier
            primaryModifier = keyStrArray[0];

            //get keyStr of secondary modifier
            secondaryModifier =
                keyStrArray.length === 3 ? keyStrArray[1] : false;

            //get keycode of main key (last in array)
            curStr = keyStrArray[keyStrArray.length - 1];

            //TODO: There's others. Period. Up Arrow etc.
            if (curStr === 'Space') {
                mainKeyCode = 32;
            } else {
                mainKeyCode = curStr.toUpperCase().charCodeAt();
            }

            callback({
                primaryModifier: primaryModifier,
                secondaryModifier: secondaryModifier,
                mainKeyCode: mainKeyCode,
            });
        });
    },
};
