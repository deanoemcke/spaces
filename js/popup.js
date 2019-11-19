/*global chrome */

(function() {
    'use strict';

    var UNSAVED_SESSION = '(unnamed window)',
        NO_HOTKEY = 'no hotkey set';

    var nodes = {},
        globalCurrentSpace,
        globalTabId,
        globalUrl,
        globalWindowId,
        globalSessionName;

    /*
     * POPUP INIT
     */

    document.addEventListener('DOMContentLoaded', function() {
        chrome.extension
            .getBackgroundPage()
            .spaces.requestCurrentSpace(function(space) {
                globalCurrentSpace = space;
                globalTabId = chrome.extension
                    .getBackgroundPage()
                    .utils.getHashVariable('tabId', window.location.href);
                var url = chrome.extension
                    .getBackgroundPage()
                    .utils.getHashVariable('url', window.location.href);
                globalUrl = url !== '' ? decodeURIComponent(url) : false;
                var windowId = chrome.extension
                    .getBackgroundPage()
                    .utils.getHashVariable('windowId', window.location.href);
                globalWindowId = windowId !== '' ? windowId : false;
                var sessionName = chrome.extension
                    .getBackgroundPage()
                    .utils.getHashVariable('sessionName', window.location.href);
                globalSessionName =
                    sessionName && sessionName !== 'false'
                        ? sessionName
                        : false;

                renderCommon();
                routeView();
            });
    });

    function routeView() {
        var url = window.location.href;
        var action = chrome.extension
            .getBackgroundPage()
            .utils.getHashVariable('action', url);
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

        document.querySelector('body').onkeyup = function(e) {
            //listen for escape key
            if (e.keyCode === 27) {
                handleCloseAction();
            }
        };
    }

    function handleCloseAction() {
        chrome.runtime.sendMessage({
            action: 'requestClose',
        });
    }

    /*
     * MAIN POPUP VIEW
     */

    function renderMainCard() {
        chrome.extension
            .getBackgroundPage()
            .spaces.requestHotkeys(function(hotkeys) {
                document.querySelector(
                    '#switcherLink .hotkey'
                ).innerHTML = hotkeys.switchCode
                    ? hotkeys.switchCode
                    : NO_HOTKEY;
                document.querySelector(
                    '#moverLink .hotkey'
                ).innerHTML = hotkeys.moveCode ? hotkeys.moveCode : NO_HOTKEY;
            });

        var hotkeyEls = document.querySelectorAll('.hotkey');
        for (var i = 0; i < hotkeyEls.length; i++) {
            hotkeyEls[i].addEventListener('click', function(e) {
                chrome.runtime.sendMessage({
                    action: 'requestShowKeyboardShortcuts',
                });
                window.close();
            });
        }

        document
            .querySelector('#allSpacesLink .optionText')
            .addEventListener('click', function(e) {
                chrome.runtime.sendMessage({
                    action: 'requestShowSpaces',
                });
                window.close();
            });
        document
            .querySelector('#switcherLink .optionText')
            .addEventListener('click', function(e) {
                chrome.extension
                    .getBackgroundPage()
                    .spaces.generatePopupParams('switch')
                    .then(params => {
                        if (!params) return;
                        window.location.hash = params;
                        window.location.reload();
                    });
                // renderSwitchCard()
            });
        document
            .querySelector('#moverLink .optionText')
            .addEventListener('click', function(e) {
                chrome.extension
                    .getBackgroundPage()
                    .spaces.generatePopupParams('move')
                    .then(params => {
                        if (!params) return;
                        window.location.hash = params;
                        window.location.reload();
                    });
                // renderMoveCard()
            });
        document
            .getElementById('spaceEdit')
            .addEventListener('click', function(e) {
                handleNameEdit();
            });
        document
            .getElementById('activeSpaceTitle')
            .addEventListener('focus', function(e) {
                handleNameEdit();
            });
        document
            .getElementById('activeSpaceTitle')
            .addEventListener('blur', function(e) {
                handleNameSave();
            });
    }

    function handleNameEdit() {
        var inputEl = document.getElementById('activeSpaceTitle');
        inputEl.focus();
        if (inputEl.value === UNSAVED_SESSION) {
            inputEl.value = '';
        }
    }

    function handleNameSave() {
        var inputEl = document.getElementById('activeSpaceTitle'),
            newName = inputEl.value;

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
                function() {}
            );
        } else {
            chrome.runtime.sendMessage(
                {
                    action: 'saveNewSession',
                    sessionName: newName,
                    windowId: globalCurrentSpace.windowId,
                },
                function() {}
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
        chrome.runtime.sendMessage({ action: 'requestAllSpaces' }, function(
            spaces
        ) {
            spacesRenderer.initialise(8, true);
            spacesRenderer.renderSpaces(spaces);

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
    }

    /*
     * MOVE VIEW
     */

    function renderMoveCard() {
        document.getElementById(
            'popupContainer'
        ).innerHTML = document.getElementById('moveTemplate').innerHTML;

        //initialise global handles to key elements (singletons)
        //nodes.home = document.getElementById('spacesHome');
        nodes.body = document.querySelector('body');
        nodes.spaceEditButton = document.getElementById('spaceEdit');
        nodes.moveForm = document.getElementById('spaceSelectForm');
        nodes.moveInput = document.getElementById('sessionsInput');
        nodes.activeSpaceTitle = document.getElementById('activeSpaceTitle');
        nodes.activeTabTitle = document.getElementById('activeTabTitle');
        nodes.activeTabFavicon = document.getElementById('activeTabFavicon');
        nodes.okButton = document.getElementById('moveBtn');
        nodes.cancelButton = document.getElementById('cancelBtn');

        //nodes.home.setAttribute('href', chrome.extension.getURL('spaces.html'));

        nodes.moveForm.onsubmit = function(e) {
            e.preventDefault();
            handleSelectAction();
        };

        nodes.body.onkeyup = function(e) {
            //highlight ok button when you start typing
            if (nodes.moveInput.value.length > 0) {
                nodes.okButton.className = 'button okBtn selected';
            } else {
                nodes.okButton.className = 'button okBtn';
            }

            //listen for escape key
            if (e.keyCode === 27) {
                handleCloseAction();
                return;
            }
        };

        nodes.spaceEditButton.onclick = function(e) {
            handleEditSpace();
        };
        nodes.okButton.onclick = function(e) {
            handleSelectAction();
        };
        nodes.cancelButton.onclick = function(e) {
            handleCloseAction();
        };

        //update currentSpaceDiv
        //nodes.windowTitle.innerHTML = "Current space: " + (globalSessionName ? globalSessionName : 'unnamed');
        nodes.activeSpaceTitle.innerHTML = globalSessionName
            ? globalSessionName
            : '(unnamed)';
        //selectSpace(nodes.activeSpace);

        updateTabDetails();

        chrome.runtime.sendMessage(
            {
                action: 'requestAllSpaces',
            },
            function(spaces) {
                //remove currently visible space
                spaces = spaces.filter(function(space) {
                    return space.windowId != globalWindowId; //loose matching here
                });
                spacesRenderer.initialise(5, false);
                spacesRenderer.renderSpaces(spaces);

                var allSpaceEls = document.querySelectorAll('.space');
                Array.prototype.forEach.call(allSpaceEls, function(el) {
                    el.onclick = function(e) {
                        handleSelectAction(el);
                    };
                });
            }
        );
    }

    function updateTabDetails() {
        var faviconSrc, cleanUrl;

        //if we are working with an open chrome tab
        if (globalTabId) {
            chrome.runtime.sendMessage(
                {
                    action: 'requestTabDetail',
                    tabId: globalTabId,
                },
                function(tab) {
                    if (tab) {
                        nodes.activeTabTitle.innerHTML = tab.title;

                        //try to get best favicon url path
                        if (
                            tab.favIconUrl &&
                            tab.favIconUrl.indexOf('chrome://theme') < 0
                        ) {
                            faviconSrc = tab.favIconUrl;
                        } else {
                            faviconSrc = 'chrome://favicon/' + tab.url;
                        }
                        nodes.activeTabFavicon.setAttribute('src', faviconSrc);

                        nodes.moveInput.setAttribute(
                            'placeholder',
                            'Move tab to..'
                        );

                        //nodes.windowTitle.innerHTML = tab.title;
                        //nodes.windowFavicon.setAttribute('href', faviconSrc);
                    }
                }
            );

            //else if we are dealing with a url only
        } else if (globalUrl) {
            cleanUrl =
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
        var selectedSpaceEl = document.querySelector('.space.selected'),
            sessionId = selectedSpaceEl.getAttribute('data-sessionId'),
            windowId = selectedSpaceEl.getAttribute('data-windowId'),
            newSessionName = nodes.moveInput.value,
            params = {};

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
        //this window will be closed by background script
    }
    function handleEditSpace() {
        chrome.runtime.sendMessage({
            action: 'requestShowSpaces',
            windowId: globalWindowId,
            edit: 'true',
        });
    }

    function handleCloseAction() {
        chrome.runtime.sendMessage({
            action: 'requestClose',
        });
    }
})();
