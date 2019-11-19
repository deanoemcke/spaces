/*global chrome, dbService, render, createTabHtml */

(function() {
    function getSelectedSpace() {
        return document.querySelector('.space.selected');
    }

    function handleSwitchAction(selectedSpaceEl) {
        chrome.runtime.sendMessage({
            action: 'switchToSpace',
            sessionId: selectedSpaceEl.getAttribute('data-sessionId'),
            windowId: selectedSpaceEl.getAttribute('data-windowId'),
        });
    }

    function handleCloseAction() {
        chrome.runtime.sendMessage({
            action: 'requestClose',
        });
    }

    function getSwitchKeycodes(callback) {
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
    }

    function addEventListeners() {
        var selectedSpaceEl;
        document.getElementById('spaceSelectForm').onsubmit = function(e) {
            e.preventDefault();
            handleSwitchAction(getSelectedSpace());
        };

        var allSpaceEls = document.querySelectorAll('.space');
        Array.prototype.forEach.call(allSpaceEls, function(el) {
            el.onclick = function(e) {
                handleSwitchAction(el);
            };
        });

        //Here lies some pretty hacky stuff. Yus! Hax!
        getSwitchKeycodes(function(keyCodes) {
            var body = document.querySelector('body');

            body.onkeyup = function(e) {
                //listen for escape key
                if (e.keyCode === 27) {
                    handleCloseAction();
                    return;
                }
            };
        });
    }

    window.onload = function() {
        chrome.runtime.sendMessage({ action: 'requestAllSpaces' }, function(
            spaces
        ) {
            spacesRenderer.initialise(8, true);
            spacesRenderer.renderSpaces(spaces);
            addEventListeners();
        });
    };
})();
