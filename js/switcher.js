/* global chrome, spacesRenderer  */

(() => {
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
            let mainKeyCode;

            // TODO: There's others. Period. Up Arrow etc.
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
    }

    function addEventListeners() {
        document.getElementById('spaceSelectForm').onsubmit = e => {
            e.preventDefault();
            handleSwitchAction(getSelectedSpace());
        };

        const allSpaceEls = document.querySelectorAll('.space');
        Array.prototype.forEach.call(allSpaceEls, el => {
            // eslint-disable-next-line no-param-reassign
            el.onclick = () => {
                handleSwitchAction(el);
            };
        });

        // Here lies some pretty hacky stuff. Yus! Hax!
        getSwitchKeycodes(() => {
            const body = document.querySelector('body');

            body.onkeyup = e => {
                // listen for escape key
                if (e.keyCode === 27) {
                    handleCloseAction();
                }
            };
        });
    }

    window.onload = () => {
        chrome.runtime.sendMessage({ action: 'requestAllSpaces' }, spaces => {
            spacesRenderer.initialise(8, true);
            spacesRenderer.renderSpaces(spaces);
            addEventListeners();
        });
    };
})();
