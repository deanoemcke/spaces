/* global chrome spacesRenderer */

(() => {
    const UNSAVED_SESSION = '(unnamed window)';
    const NO_HOTKEY = 'no hotkey set';

    const nodes = {};
    let globalCurrentSpace;
    let globalTabId;
    let globalUrl;
    let globalWindowId;
    let globalSessionName;

    /*
     * POPUP INIT
     */

    document.addEventListener('DOMContentLoaded', async () => {
        const { utils, spaces } = chrome.extension.getBackgroundPage();
        const url = utils.getHashVariable('url', window.location.href);
        globalUrl = url !== '' ? decodeURIComponent(url) : false;
        const windowId = utils.getHashVariable(
            'windowId',
            window.location.href
        );
        globalWindowId = windowId !== '' ? windowId : false;
        globalTabId = utils.getHashVariable('tabId', window.location.href);
        const sessionName = utils.getHashVariable(
            'sessionName',
            window.location.href
        );
        globalSessionName =
            sessionName && sessionName !== 'false' ? sessionName : false;
        const action = utils.getHashVariable('action', window.location.href);

        const requestSpacePromise = globalWindowId
            ? new Promise(resolve =>
                  spaces.requestSpaceFromWindowId(
                      parseInt(globalWindowId, 10),
                      resolve
                  )
              )
            : new Promise(resolve => spaces.requestCurrentSpace(resolve));

        requestSpacePromise.then(space => {
            globalCurrentSpace = space;
            renderCommon();
            routeView(action);
        });
    });

    function routeView(action) {
        if (action === 'move') {
            renderMoveCard();
        } else if (action === 'switch') {
            renderSwitchCard();
        } else {
            renderMainCard();
        }
    }

    /*
     * COMMON
     */

    function renderCommon() {
        document.getElementById(
            'activeSpaceTitle'
        ).value = globalCurrentSpace.name
            ? globalCurrentSpace.name
            : UNSAVED_SESSION;

        document.querySelector('body').onkeyup = e => {
            // listen for escape key
            if (e.keyCode === 27) {
                handleCloseAction();
                // } else if (e.keyCode === 13) {
                //     handleNameSave();
            }
        };
        document.getElementById('spaceEdit').addEventListener('click', () => {
            handleNameEdit();
        });
        document
            .getElementById('activeSpaceTitle')
            .addEventListener('focus', () => {
                handleNameEdit();
            });
        document.getElementById('activeSpaceTitle').onkeyup = e => {
            // listen for enter key
            if (e.keyCode === 13) {
                document.getElementById('activeSpaceTitle').blur();
            }
        };
        document
            .getElementById('activeSpaceTitle')
            .addEventListener('blur', () => {
                handleNameSave();
            });
    }

    function handleCloseAction() {
        const { utils } = chrome.extension.getBackgroundPage();
        const opener = utils.getHashVariable('opener', window.location.href);
        if (opener && opener === 'bg') {
            chrome.runtime.sendMessage({
                action: 'requestClose',
            });
        } else {
            window.close();
        }
    }

    /*
     * MAIN POPUP VIEW
     */

    function renderMainCard() {
        const { spaces } = chrome.extension.getBackgroundPage();
        spaces.requestHotkeys(hotkeys => {
            document.querySelector(
                '#switcherLink .hotkey'
            ).innerHTML = hotkeys.switchCode ? hotkeys.switchCode : NO_HOTKEY;
            document.querySelector(
                '#moverLink .hotkey'
            ).innerHTML = hotkeys.moveCode ? hotkeys.moveCode : NO_HOTKEY;
        });

        const hotkeyEls = document.querySelectorAll('.hotkey');
        for (let i = 0; i < hotkeyEls.length; i += 1) {
            hotkeyEls[i].addEventListener('click', () => {
                chrome.runtime.sendMessage({
                    action: 'requestShowKeyboardShortcuts',
                });
                window.close();
            });
        }

        document
            .querySelector('#allSpacesLink .optionText')
            .addEventListener('click', () => {
                chrome.runtime.sendMessage({
                    action: 'requestShowSpaces',
                });
                window.close();
            });
        document
            .querySelector('#switcherLink .optionText')
            .addEventListener('click', () => {
                spaces.generatePopupParams('switch').then(params => {
                    if (!params) return;
                    window.location.hash = params;
                    window.location.reload();
                });
                // renderSwitchCard()
            });
        document
            .querySelector('#moverLink .optionText')
            .addEventListener('click', () => {
                spaces.generatePopupParams('move').then(params => {
                    if (!params) return;
                    window.location.hash = params;
                    window.location.reload();
                });
                // renderMoveCard()
            });
    }

    function handleNameEdit() {
        const inputEl = document.getElementById('activeSpaceTitle');
        inputEl.focus();
        if (inputEl.value === UNSAVED_SESSION) {
            inputEl.value = '';
        }
    }

    function handleNameSave() {
        const inputEl = document.getElementById('activeSpaceTitle');
        const newName = inputEl.value;

        if (
            newName === UNSAVED_SESSION ||
            newName === globalCurrentSpace.name
        ) {
            return;
        }

        if (globalCurrentSpace.sessionId) {
            chrome.runtime.sendMessage(
                {
                    action: 'updateSessionName',
                    sessionName: newName,
                    sessionId: globalCurrentSpace.sessionId,
                },
                () => {}
            );
        } else {
            chrome.runtime.sendMessage(
                {
                    action: 'saveNewSession',
                    sessionName: newName,
                    windowId: globalCurrentSpace.windowId,
                },
                () => {}
            );
        }
    }

    /*
     * SWITCHER VIEW
     */

    function renderSwitchCard() {
        document.getElementById(
            'popupContainer'
        ).innerHTML = document.getElementById('switcherTemplate').innerHTML;
        chrome.runtime.sendMessage({ action: 'requestAllSpaces' }, spaces => {
            spacesRenderer.initialise(8, true);
            spacesRenderer.renderSpaces(spaces);

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
        });
    }

    function getSelectedSpace() {
        return document.querySelector('.space.selected');
    }

    function handleSwitchAction(selectedSpaceEl) {
        chrome.runtime.sendMessage({
            action: 'switchToSpace',
            sessionId: selectedSpaceEl.getAttribute('data-sessionId'),
            windowId: selectedSpaceEl.getAttribute('data-windowId'),
        });
        window.close();
    }

    /*
     * MOVE VIEW
     */

    function renderMoveCard() {
        document.getElementById(
            'popupContainer'
        ).innerHTML = document.getElementById('moveTemplate').innerHTML;

        // initialise global handles to key elements (singletons)
        // nodes.home = document.getElementById('spacesHome');
        nodes.body = document.querySelector('body');
        nodes.spaceEditButton = document.getElementById('spaceEdit');
        nodes.moveForm = document.getElementById('spaceSelectForm');
        nodes.moveInput = document.getElementById('sessionsInput');
        nodes.activeSpaceTitle = document.getElementById('activeSpaceTitle');
        nodes.activeTabTitle = document.getElementById('activeTabTitle');
        nodes.activeTabFavicon = document.getElementById('activeTabFavicon');
        nodes.okButton = document.getElementById('moveBtn');
        nodes.cancelButton = document.getElementById('cancelBtn');

        // nodes.home.setAttribute('href', chrome.extension.getURL('spaces.html'));

        nodes.moveForm.onsubmit = e => {
            e.preventDefault();
            handleSelectAction();
        };

        nodes.body.onkeyup = e => {
            // highlight ok button when you start typing
            if (nodes.moveInput.value.length > 0) {
                nodes.okButton.className = 'button okBtn selected';
            } else {
                nodes.okButton.className = 'button okBtn';
            }

            // listen for escape key
            if (e.keyCode === 27) {
                handleCloseAction();
            }
        };

        nodes.spaceEditButton.onclick = () => {
            handleEditSpace();
        };
        nodes.okButton.onclick = () => {
            handleSelectAction();
        };
        nodes.cancelButton.onclick = () => {
            handleCloseAction();
        };

        // update currentSpaceDiv
        // nodes.windowTitle.innerHTML = "Current space: " + (globalSessionName ? globalSessionName : 'unnamed');
        nodes.activeSpaceTitle.innerHTML = globalSessionName || '(unnamed)';
        // selectSpace(nodes.activeSpace);

        updateTabDetails();

        chrome.runtime.sendMessage(
            {
                action: 'requestAllSpaces',
            },
            spaces => {
                // remove currently visible space
                const filteredSpaces = spaces.filter(space => {
                    return `${space.windowId}` !== globalWindowId;
                });
                spacesRenderer.initialise(5, false);
                spacesRenderer.renderSpaces(filteredSpaces);

                const allSpaceEls = document.querySelectorAll('.space');
                Array.prototype.forEach.call(allSpaceEls, el => {
                    // eslint-disable-next-line no-param-reassign
                    el.onclick = () => {
                        handleSelectAction(el);
                    };
                });
            }
        );
    }

    function updateTabDetails() {
        let faviconSrc;

        // if we are working with an open chrome tab
        if (globalTabId.length > 0) {
            chrome.runtime.sendMessage(
                {
                    action: 'requestTabDetail',
                    tabId: globalTabId,
                },
                tab => {
                    if (tab) {
                        nodes.activeTabTitle.innerHTML = tab.title;

                        // try to get best favicon url path
                        if (
                            tab.favIconUrl &&
                            tab.favIconUrl.indexOf('chrome://theme') < 0
                        ) {
                            faviconSrc = tab.favIconUrl;
                        } else {
                            faviconSrc = `chrome://favicon/${tab.url}`;
                        }
                        nodes.activeTabFavicon.setAttribute('src', faviconSrc);

                        nodes.moveInput.setAttribute(
                            'placeholder',
                            'Move tab to..'
                        );

                        // nodes.windowTitle.innerHTML = tab.title;
                        // nodes.windowFavicon.setAttribute('href', faviconSrc);
                    }
                }
            );

            // else if we are dealing with a url only
        } else if (globalUrl) {
            const cleanUrl =
                globalUrl.indexOf('://') > 0
                    ? globalUrl.substr(
                          globalUrl.indexOf('://') + 3,
                          globalUrl.length
                      )
                    : globalUrl;
            nodes.activeTabTitle.innerHTML = cleanUrl;
            nodes.activeTabFavicon.setAttribute('src', '/img/new.png');

            nodes.moveInput.setAttribute('placeholder', 'Add tab to..');
        }
    }

    function handleSelectAction() {
        const selectedSpaceEl = document.querySelector('.space.selected');
        const sessionId = selectedSpaceEl.getAttribute('data-sessionId');
        const windowId = selectedSpaceEl.getAttribute('data-windowId');
        const newSessionName = nodes.moveInput.value;
        const params = {};

        if (sessionId && sessionId !== 'false') {
            params.sessionId = sessionId;

            if (globalTabId) {
                params.action = 'moveTabToSession';
                params.tabId = globalTabId;
            } else if (globalUrl) {
                params.action = 'addLinkToSession';
                params.url = globalUrl;
            }
        } else if (windowId && windowId !== 'false') {
            params.windowId = windowId;

            if (globalTabId) {
                params.action = 'moveTabToWindow';
                params.tabId = globalTabId;
            } else if (globalUrl) {
                params.action = 'addLinkToWindow';
                params.url = globalUrl;
            }
        } else {
            params.sessionName = newSessionName;

            if (globalTabId) {
                params.action = 'moveTabToNewSession';
                params.tabId = globalTabId;
            } else if (globalUrl) {
                params.action = 'addLinkToNewSession';
                params.url = globalUrl;
            }
        }

        chrome.runtime.sendMessage(params);
        // this window will be closed by background script
    }
    function handleEditSpace() {
        chrome.runtime.sendMessage({
            action: 'requestShowSpaces',
            windowId: globalWindowId,
            edit: 'true',
        });
    }
})();
