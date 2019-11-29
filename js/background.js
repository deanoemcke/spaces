/* eslint-disable no-restricted-globals */
/* eslint-disable no-alert */
/* global chrome spacesService */

/* spaces
 * Copyright (C) 2015 Dean Oemcke
 */

// eslint-disable-next-line no-unused-vars, no-var
var spaces = (() => {
    let spacesPopupWindowId = false;
    let spacesOpenWindowId = false;
    const noop = () => {};
    const debug = false;

    // LISTENERS

    // add listeners for session monitoring
    chrome.tabs.onCreated.addListener(tab => {
        // this call to checkInternalSpacesWindows actually returns false when it should return true
        // due to the event being called before the globalWindowIds get set. oh well, never mind.
        if (checkInternalSpacesWindows(tab.windowId, false)) return;
        // don't need this listener as the tabUpdated listener also fires when a new tab is created
        // spacesService.handleTabCreated(tab);
        updateSpacesWindow('tabs.onCreated');
    });
    chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
        if (checkInternalSpacesWindows(removeInfo.windowId, false)) return;
        spacesService.handleTabRemoved(tabId, removeInfo, () => {
            updateSpacesWindow('tabs.onRemoved');
        });
    });
    chrome.tabs.onMoved.addListener((tabId, moveInfo) => {
        if (checkInternalSpacesWindows(moveInfo.windowId, false)) return;
        spacesService.handleTabMoved(tabId, moveInfo, () => {
            updateSpacesWindow('tabs.onMoved');
        });
    });
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        if (checkInternalSpacesWindows(tab.windowId, false)) return;

        spacesService.handleTabUpdated(tab, changeInfo, () => {
            updateSpacesWindow('tabs.onUpdated');
        });
    });
    chrome.windows.onRemoved.addListener(windowId => {
        if (checkInternalSpacesWindows(windowId, true)) return;
        spacesService.handleWindowRemoved(windowId, true, () => {
            updateSpacesWindow('windows.onRemoved');
        });

        // if this was the last window open and the spaces window is stil open
        // then close the spaces window also so that chrome exits fully
        // NOTE: this is a workaround for an issue with the chrome 'restore previous session' option
        // if the spaces window is the only window open and you try to use it to open a space,
        // when that space loads, it also loads all the windows from the window that was last closed
        chrome.windows.getAll({}, windows => {
            if (windows.length === 1 && spacesOpenWindowId) {
                chrome.windows.remove(spacesOpenWindowId);
            }
        });
    });
    // don't need this listener as the tabUpdated listener also fires when a new window is created
    // chrome.windows.onCreated.addListener(function (window) {

    //     if (checkInternalSpacesWindows(window.id, false)) return;
    //     spacesService.handleWindowCreated(window);
    // });

    // add listeners for tab and window focus changes
    // when a tab or window is changed, close the move tab popup if it is open
    chrome.windows.onFocusChanged.addListener(windowId => {
        // Prevent a click in the popup on Ubunto or ChroneOS from closing the
        // popup prematurely.
        if (
            windowId === chrome.windows.WINDOW_ID_NONE ||
            windowId === spacesPopupWindowId
        ) {
            return;
        }

        if (!debug && spacesPopupWindowId) {
            if (spacesPopupWindowId) {
                closePopupWindow();
            }
        }
        spacesService.handleWindowFocussed(windowId);
    });

    // add listeners for message requests from other extension pages (spaces.html & tab.html)

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (debug) {
            // eslint-disable-next-line no-console
            console.log(`listener fired: ${JSON.stringify(request)}`);
        }

        let sessionId;
        let windowId;
        let tabId;

        // endpoints called by spaces.js
        switch (request.action) {
            case 'loadSession':
                sessionId = _cleanParameter(request.sessionId);
                if (sessionId) {
                    handleLoadSession(sessionId);
                    sendResponse(true);
                }
                // close the requesting tab (should be spaces.html)
                // if (!debug) closeChromeTab(sender.tab.id);

                return true;

            case 'loadWindow':
                windowId = _cleanParameter(request.windowId);
                if (windowId) {
                    handleLoadWindow(windowId);
                    sendResponse(true);
                }
                // close the requesting tab (should be spaces.html)
                // if (!debug) closeChromeTab(sender.tab.id);

                return true;

            case 'loadTabInSession':
                sessionId = _cleanParameter(request.sessionId);
                if (sessionId && request.tabUrl) {
                    handleLoadSession(sessionId, request.tabUrl);
                    sendResponse(true);
                }
                // close the requesting tab (should be spaces.html)
                // if (!debug) closeChromeTab(sender.tab.id);

                return true;

            case 'loadTabInWindow':
                windowId = _cleanParameter(request.windowId);
                if (windowId && request.tabUrl) {
                    handleLoadWindow(windowId, request.tabUrl);
                    sendResponse(true);
                }
                // close the requesting tab (should be spaces.html)
                // if (!debug) closeChromeTab(sender.tab.id);

                return true;

            case 'saveNewSession':
                windowId = _cleanParameter(request.windowId);
                if (windowId && request.sessionName) {
                    handleSaveNewSession(
                        windowId,
                        request.sessionName,
                        sendResponse
                    );
                }
                return true; // allow async response

            case 'importNewSession':
                if (request.urlList) {
                    handleImportNewSession(request.urlList, sendResponse);
                }
                return true; // allow async response

            case 'restoreFromBackup':
                if (request.spaces) {
                    handleRestoreFromBackup(request.spaces, sendResponse);
                }
                return true; // allow async response

            case 'deleteSession':
                sessionId = _cleanParameter(request.sessionId);
                if (sessionId) {
                    handleDeleteSession(sessionId, false, sendResponse);
                }
                return true;

            case 'updateSessionName':
                sessionId = _cleanParameter(request.sessionId);
                if (sessionId && request.sessionName) {
                    handleUpdateSessionName(
                        sessionId,
                        request.sessionName,
                        sendResponse
                    );
                }
                return true;

            case 'requestSpaceDetail':
                windowId = _cleanParameter(request.windowId);
                sessionId = _cleanParameter(request.sessionId);

                if (windowId) {
                    if (checkInternalSpacesWindows(windowId, false)) {
                        sendResponse(false);
                    } else {
                        requestSpaceFromWindowId(windowId, sendResponse);
                    }
                } else if (sessionId) {
                    requestSpaceFromSessionId(sessionId, sendResponse);
                }
                return true;

            // end points called by tag.js and switcher.js
            // note: some of these endpoints will close the requesting tab
            case 'requestAllSpaces':
                requestAllSpaces(allSpaces => {
                    sendResponse(allSpaces);
                });
                return true;

            case 'requestHotkeys':
                requestHotkeys(sendResponse);
                return true;

            case 'requestTabDetail':
                tabId = _cleanParameter(request.tabId);
                if (tabId) {
                    requestTabDetail(tabId, tab => {
                        if (tab) {
                            sendResponse(tab);
                        } else {
                            // close the requesting tab (should be tab.html)
                            closePopupWindow();
                        }
                    });
                }
                return true;

            case 'requestShowSpaces':
                windowId = _cleanParameter(request.windowId);

                // show the spaces tab in edit mode for the passed in windowId
                if (windowId) {
                    showSpacesOpenWindow(windowId, request.edit);
                } else {
                    showSpacesOpenWindow();
                }
                return false;

            case 'requestShowSwitcher':
                showSpacesSwitchWindow();
                return false;

            case 'requestShowMover':
                showSpacesMoveWindow();
                return false;

            case 'requestShowKeyboardShortcuts':
                createShortcutsWindow();
                return false;

            case 'requestClose':
                // close the requesting tab (should be tab.html)
                closePopupWindow();
                return false;

            case 'switchToSpace':
                windowId = _cleanParameter(request.windowId);
                sessionId = _cleanParameter(request.sessionId);

                if (windowId) {
                    handleLoadWindow(windowId);
                } else if (sessionId) {
                    handleLoadSession(sessionId);
                }

                return false;

            case 'addLinkToNewSession':
                tabId = _cleanParameter(request.tabId);
                if (request.sessionName && request.url) {
                    handleAddLinkToNewSession(
                        request.url,
                        request.sessionName,
                        result => {
                            if (result)
                                updateSpacesWindow('addLinkToNewSession');

                            // close the requesting tab (should be tab.html)
                            closePopupWindow();
                        }
                    );
                }
                return false;

            case 'moveTabToNewSession':
                tabId = _cleanParameter(request.tabId);
                if (request.sessionName && tabId) {
                    handleMoveTabToNewSession(
                        tabId,
                        request.sessionName,
                        result => {
                            if (result)
                                updateSpacesWindow('moveTabToNewSession');

                            // close the requesting tab (should be tab.html)
                            closePopupWindow();
                        }
                    );
                }
                return false;

            case 'addLinkToSession':
                sessionId = _cleanParameter(request.sessionId);

                if (sessionId && request.url) {
                    handleAddLinkToSession(request.url, sessionId, result => {
                        if (result) updateSpacesWindow('addLinkToSession');

                        // close the requesting tab (should be tab.html)
                        closePopupWindow();
                    });
                }
                return false;

            case 'moveTabToSession':
                sessionId = _cleanParameter(request.sessionId);
                tabId = _cleanParameter(request.tabId);

                if (sessionId && tabId) {
                    handleMoveTabToSession(tabId, sessionId, result => {
                        if (result) updateSpacesWindow('moveTabToSession');

                        // close the requesting tab (should be tab.html)
                        closePopupWindow();
                    });
                }
                return false;

            case 'addLinkToWindow':
                windowId = _cleanParameter(request.windowId);

                if (windowId && request.url) {
                    handleAddLinkToWindow(request.url, windowId, result => {
                        if (result) updateSpacesWindow('addLinkToWindow');

                        // close the requesting tab (should be tab.html)
                        closePopupWindow();
                    });
                }
                return false;

            case 'moveTabToWindow':
                windowId = _cleanParameter(request.windowId);
                tabId = _cleanParameter(request.tabId);

                if (windowId && tabId) {
                    handleMoveTabToWindow(tabId, windowId, result => {
                        if (result) updateSpacesWindow('moveTabToWindow');

                        // close the requesting tab (should be tab.html)
                        closePopupWindow();
                    });
                }
                return false;

            default:
                return false;
        }
    });
    function _cleanParameter(param) {
        if (typeof param === 'number') {
            return param;
        }
        if (param === 'false') {
            return false;
        }
        if (param === 'true') {
            return true;
        }
        return parseInt(param, 10);
    }

    // add listeners for keyboard commands

    chrome.commands.onCommand.addListener(command => {
        // handle showing the move tab popup (tab.html)
        if (command === 'spaces-move') {
            showSpacesMoveWindow();

            // handle showing the switcher tab popup (switcher.html)
        } else if (command === 'spaces-switch') {
            showSpacesSwitchWindow();
        }
    });

    // add context menu entry

    chrome.contextMenus.create({
        id: 'spaces-add-link',
        title: 'Add link to space...',
        contexts: ['link'],
    });
    chrome.contextMenus.onClicked.addListener(info => {
        // handle showing the move tab popup (tab.html)
        if (info.menuItemId === 'spaces-add-link') {
            showSpacesMoveWindow(info.linkUrl);
        }
    });

    // runtime extension install listener
    chrome.runtime.onInstalled.addListener(details => {
        if (details.reason === 'install') {
            // eslint-disable-next-line no-console
            console.log('This is a first install!');
            showSpacesOpenWindow();
        } else if (details.reason === 'update') {
            const thisVersion = chrome.runtime.getManifest().version;
            if (details.previousVersion !== thisVersion) {
                // eslint-disable-next-line no-console
                console.log(
                    `Updated from ${details.previousVersion} to ${thisVersion}!`
                );
            }
        }
    });

    function createShortcutsWindow() {
        chrome.tabs.create({ url: 'chrome://extensions/configureCommands' });
    }

    function showSpacesOpenWindow(windowId, editMode) {
        let url;

        if (editMode && windowId) {
            url = chrome.extension.getURL(
                `spaces.html#windowId=${windowId}&editMode=true`
            );
        } else {
            url = chrome.extension.getURL('spaces.html');
        }

        // if spaces open window already exists then just give it focus (should be up to date)
        if (spacesOpenWindowId) {
            chrome.windows.get(
                spacesOpenWindowId,
                { populate: true },
                window => {
                    chrome.windows.update(spacesOpenWindowId, {
                        focused: true,
                    });
                    if (window.tabs[0].id) {
                        chrome.tabs.update(window.tabs[0].id, { url });
                    }
                }
            );

            // otherwise re-create it
        } else {
            chrome.windows.create(
                {
                    type: 'popup',
                    url,
                    height: screen.height - 100,
                    width: Math.min(screen.width, 1000),
                    top: 0,
                    left: 0,
                },
                window => {
                    spacesOpenWindowId = window.id;
                }
            );
        }
    }
    function showSpacesMoveWindow(tabUrl) {
        createOrShowSpacesPopupWindow('move', tabUrl);
    }
    function showSpacesSwitchWindow() {
        createOrShowSpacesPopupWindow('switch');
    }

    async function generatePopupParams(action, tabUrl) {
        // get currently highlighted tab
        const tabs = await new Promise(resolve => {
            chrome.tabs.query({ active: true, currentWindow: true }, resolve);
        });
        if (tabs.length === 0) return '';

        const activeTab = tabs[0];

        // make sure that the active tab is not from an internal spaces window
        if (checkInternalSpacesWindows(activeTab.windowId, false)) {
            return '';
        }

        const session = spacesService.getSessionByWindowId(activeTab.windowId);

        const name = session ? session.name : '';

        let params = `action=${action}&windowId=${activeTab.windowId}&sessionName=${name}`;

        if (tabUrl) {
            params += `&url=${encodeURIComponent(tabUrl)}`;
        } else {
            params += `&tabId=${activeTab.id}`;
        }
        return params;
    }

    function createOrShowSpacesPopupWindow(action, tabUrl) {
        generatePopupParams(action, tabUrl).then(params => {
            const popupUrl = `${chrome.extension.getURL(
                'popup.html'
            )}#opener=bg&${params}`;
            // if spaces  window already exists
            if (spacesPopupWindowId) {
                chrome.windows.get(
                    spacesPopupWindowId,
                    { populate: true },
                    window => {
                        // if window is currently focused then don't update
                        if (window.focused) {
                            // else update popupUrl and give it focus
                        } else {
                            chrome.windows.update(spacesPopupWindowId, {
                                focused: true,
                            });
                            if (window.tabs[0].id) {
                                chrome.tabs.update(window.tabs[0].id, {
                                    url: popupUrl,
                                });
                            }
                        }
                    }
                );

                // otherwise create it
            } else {
                chrome.windows.create(
                    {
                        type: 'popup',
                        url: popupUrl,
                        focused: true,
                        height: 450,
                        width: 310,
                        top: screen.height - 450,
                        left: screen.width - 310,
                    },
                    window => {
                        spacesPopupWindowId = window.id;
                    }
                );
            }
        });
    }

    function closePopupWindow() {
        if (spacesPopupWindowId) {
            chrome.windows.get(
                spacesPopupWindowId,
                { populate: true },
                spacesWindow => {
                    // remove popup from history
                    if (
                        spacesWindow.tabs.length > 0 &&
                        spacesWindow.tabs[0].url
                    ) {
                        chrome.history.deleteUrl({
                            url: spacesWindow.tabs[0].url,
                        });
                    }

                    // remove popup window
                    chrome.windows.remove(spacesWindow.id, () => {
                        if (chrome.runtime.lastError) {
                            // eslint-disable-next-line no-console
                            console.log(chrome.runtime.lastError.message);
                        }
                    });
                }
            );
        }
    }

    function updateSpacesWindow(source) {
        if (debug)
            // eslint-disable-next-line no-console
            console.log(`updateSpacesWindow triggered. source: ${source}`);

        requestAllSpaces(allSpaces => {
            chrome.runtime.sendMessage({
                action: 'updateSpaces',
                spaces: allSpaces,
            });
        });
    }

    function checkInternalSpacesWindows(windowId, windowClosed) {
        if (windowId === spacesOpenWindowId) {
            if (windowClosed) spacesOpenWindowId = false;
            return true;
        }
        if (windowId === spacesPopupWindowId) {
            if (windowClosed) spacesPopupWindowId = false;
            return true;
        }
        return false;
    }

    function checkSessionOverwrite(session) {
        // make sure session being overwritten is not currently open
        if (session.windowId) {
            alert(
                `A session with the name '${session.name}' is currently open an cannot be overwritten`
            );
            return false;

            // otherwise prompt to see if user wants to overwrite session
        }
        return window.confirm(`Replace existing space: ${session.name}?`);
    }

    function checkSessionDelete(session) {
        return window.confirm(
            `Are you sure you want to delete the space: ${session.name}?`
        );
    }

    function requestHotkeys(callback) {
        chrome.commands.getAll(commands => {
            let switchStr;
            let moveStr;
            let spacesStr;

            commands.forEach(command => {
                if (command.name === 'spaces-switch') {
                    switchStr = command.shortcut;
                } else if (command.name === 'spaces-move') {
                    moveStr = command.shortcut;
                } else if (command.name === 'spaces-open') {
                    spacesStr = command.shortcut;
                }
            });

            callback({
                switchCode: switchStr,
                moveCode: moveStr,
                spacesCode: spacesStr,
            });
        });
    }

    function requestTabDetail(tabId, callback) {
        chrome.tabs.get(tabId, callback);
    }

    function requestCurrentSpace(callback) {
        chrome.windows.getCurrent(window => {
            requestSpaceFromWindowId(window.id, callback);
        });
    }

    // returns a 'space' object which is essentially the same as a session object
    // except that includes space.sessionId (session.id) and space.windowId
    function requestSpaceFromWindowId(windowId, callback) {
        // first check for an existing session matching this windowId
        const session = spacesService.getSessionByWindowId(windowId);

        if (session) {
            callback({
                sessionId: session.id,
                windowId: session.windowId,
                name: session.name,
                tabs: session.tabs,
                history: session.history,
            });

            // otherwise build a space object out of the actual window
        } else {
            chrome.windows.get(windowId, { populate: true }, window => {
                // if failed to load requested window
                if (chrome.runtime.lastError) {
                    callback(false);
                } else {
                    callback({
                        sessionId: false,
                        windowId: window.id,
                        name: false,
                        tabs: window.tabs,
                        history: false,
                    });
                }
            });
        }
    }

    function requestSpaceFromSessionId(sessionId, callback) {
        const session = spacesService.getSessionBySessionId(sessionId);

        callback({
            sessionId: session.id,
            windowId: session.windowId,
            name: session.name,
            tabs: session.tabs,
            history: session.history,
        });
    }

    function requestAllSpaces(callback) {
        const sessions = spacesService.getAllSessions();
        const allSpaces = sessions.map(session => {
            return {
                sessionId: session.id,
                windowId: session.windowId,
                name: session.name,
                tabs: session.tabs,
                history: session.history,
                lastAccess: session.lastAccess,
            };
        });

        // sort results
        allSpaces.sort(spaceDateCompare);

        callback(allSpaces);
    }

    function spaceDateCompare(a, b) {
        // order open sessions first
        if (a.windowId && !b.windowId) {
            return -1;
        }
        if (!a.windowId && b.windowId) {
            return 1;
        }
        // then order by last access date
        if (a.lastAccess > b.lastAccess) {
            return -1;
        }
        if (a.lastAccess < b.lastAccess) {
            return 1;
        }
        return 0;
    }

    function handleLoadSession(sessionId, tabUrl) {
        const session = spacesService.getSessionBySessionId(sessionId);

        // if space is already open, then give it focus
        if (session.windowId) {
            handleLoadWindow(session.windowId, tabUrl);

            // else load space in new window
        } else {
            const urls = session.tabs.map(curTab => {
                return curTab.url;
            });
            chrome.windows.create(
                {
                    url: urls,
                    height: screen.height - 100,
                    width: screen.width - 100,
                    top: 0,
                    left: 0,
                },
                newWindow => {
                    // force match this new window to the session
                    spacesService.matchSessionToWindow(session, newWindow);

                    // after window has loaded try to pin any previously pinned tabs
                    session.tabs.forEach(curSessionTab => {
                        if (curSessionTab.pinned) {
                            let pinnedTabId = false;
                            newWindow.tabs.some(curNewTab => {
                                if (curNewTab.url === curSessionTab.url) {
                                    pinnedTabId = curNewTab.id;
                                    return true;
                                }
                                return false;
                            });
                            if (pinnedTabId) {
                                chrome.tabs.update(pinnedTabId, {
                                    pinned: true,
                                });
                            }
                        }
                    });

                    // if tabUrl is defined, then focus this tab
                    if (tabUrl) {
                        focusOrLoadTabInWindow(newWindow, tabUrl);
                    }

                    /* session.tabs.forEach(function (curTab) {
                    chrome.tabs.create({windowId: newWindow.id, url: curTab.url, pinned: curTab.pinned, active: false});
                });

                chrome.tabs.query({windowId: newWindow.id, index: 0}, function (tabs) {
                    chrome.tabs.remove(tabs[0].id);
                }); */
                }
            );
        }
    }
    function handleLoadWindow(windowId, tabUrl) {
        // assume window is already open, give it focus
        if (windowId) {
            focusWindow(windowId);
        }

        // if tabUrl is defined, then focus this tab
        if (tabUrl) {
            chrome.windows.get(windowId, { populate: true }, window => {
                focusOrLoadTabInWindow(window, tabUrl);
            });
        }
    }

    function focusWindow(windowId) {
        chrome.windows.update(windowId, { focused: true });
    }

    function focusOrLoadTabInWindow(window, tabUrl) {
        const match = window.tabs.some(tab => {
            if (tab.url === tabUrl) {
                chrome.tabs.update(tab.id, { active: true });
                return true;
            }
            return false;
        });
        if (!match) {
            chrome.tabs.create({ url: tabUrl });
        }
    }

    function handleSaveNewSession(windowId, sessionName, callback) {
        chrome.windows.get(windowId, { populate: true }, curWindow => {
            const existingSession = spacesService.getSessionByName(sessionName);

            // if session with same name already exist, then prompt to override the existing session
            if (existingSession) {
                if (!checkSessionOverwrite(existingSession)) {
                    callback(false);
                    return;

                    // if we choose to overwrite, delete the existing session
                }
                handleDeleteSession(existingSession.id, true, noop);
            }
            spacesService.saveNewSession(
                sessionName,
                curWindow.tabs,
                curWindow.id,
                callback
            );
        });
    }

    function handleRestoreFromBackup(_spaces, callback) {
        let existingSession;
        let performSave;
        let triggerCallback;

        _spaces.forEach((space, index, spacesArray) => {
            existingSession = spacesService.getSessionByName(space.name);
            performSave = true;
            triggerCallback = index === spacesArray.length - 1;

            // if session with same name already exist, then prompt to override the existing session
            if (existingSession) {
                if (!checkSessionOverwrite(existingSession)) {
                    performSave = false;

                    // if we choose to overwrite, delete the existing session
                } else {
                    handleDeleteSession(existingSession.id, true, noop);
                }
            }

            if (performSave) {
                spacesService.saveNewSession(
                    space.name,
                    space.tabs,
                    false,
                    () => {
                        if (triggerCallback) callback(null);
                    }
                );
            } else if (triggerCallback) {
                callback(null);
            }
        });
    }

    function handleImportNewSession(urlList, callback) {
        let tempName = 'Imported space: ';
        let count = 1;

        while (spacesService.getSessionByName(tempName + count)) {
            count += 1;
        }

        tempName += count;

        const tabList = urlList.map(text => {
            return { url: text };
        });

        // save session to database
        spacesService.saveNewSession(tempName, tabList, false, callback);
    }

    function handleUpdateSessionName(sessionId, sessionName, callback) {
        // check to make sure session name doesn't already exist
        const existingSession = spacesService.getSessionByName(sessionName);

        // if session with same name already exist, then prompt to override the existing session
        if (existingSession && existingSession.id !== sessionId) {
            if (!checkSessionOverwrite(existingSession)) {
                callback(false);
                return;

                // if we choose to override, then delete the existing session
            }
            handleDeleteSession(existingSession.id, true, noop);
        }
        spacesService.updateSessionName(sessionId, sessionName, callback);
    }

    function handleDeleteSession(sessionId, force, callback) {
        const session = spacesService.getSessionBySessionId(sessionId);
        if (!force && !checkSessionDelete(session)) {
            callback(false);
        } else {
            spacesService.deleteSession(sessionId, callback);
        }
    }

    function handleAddLinkToNewSession(url, sessionName, callback) {
        const session = spacesService.getSessionByName(sessionName);
        const newTabs = [{ url }];

        // if we found a session matching this name then return as an error as we are
        // supposed to be creating a new session with this name
        if (session) {
            callback(false);

            // else create a new session with this name containing this url
        } else {
            spacesService.saveNewSession(sessionName, newTabs, false, callback);
        }
    }

    function handleMoveTabToNewSession(tabId, sessionName, callback) {
        requestTabDetail(tabId, tab => {
            const session = spacesService.getSessionByName(sessionName);

            // if we found a session matching this name then return as an error as we are
            // supposed to be creating a new session with this name
            if (session) {
                callback(false);

                //  else create a new session with this name containing this tab
            } else {
                // remove tab from current window (should generate window events)
                chrome.tabs.remove(tab.id);

                // save session to database
                spacesService.saveNewSession(
                    sessionName,
                    [tab],
                    false,
                    callback
                );
            }
        });
    }

    function handleAddLinkToSession(url, sessionId, callback) {
        const session = spacesService.getSessionBySessionId(sessionId);
        const newTabs = [{ url }];

        // if we have not found a session matching this name then return as an error as we are
        // supposed to be adding the tab to an existing session
        if (!session) {
            callback(false);
            return;
        }
        // if session is currently open then add link directly
        if (session.windowId) {
            handleAddLinkToWindow(url, session.windowId, callback);

            // else add tab to saved session in database
        } else {
            // update session in db
            session.tabs = session.tabs.concat(newTabs);
            spacesService.updateSessionTabs(session.id, session.tabs, callback);
        }
    }

    function handleAddLinkToWindow(url, windowId, callback) {
        chrome.tabs.create({ windowId, url, active: false });

        // NOTE: this move does not seem to trigger any tab event listeners
        // so we need to update sessions manually
        spacesService.queueWindowEvent(windowId);

        callback(true);
    }

    function handleMoveTabToSession(tabId, sessionId, callback) {
        requestTabDetail(tabId, tab => {
            const session = spacesService.getSessionBySessionId(sessionId);
            const newTabs = [tab];

            // if we have not found a session matching this name then return as an error as we are
            // supposed to be adding the tab to an existing session
            if (!session) {
                callback(false);
            } else {
                // if session is currently open then move it directly
                if (session.windowId) {
                    moveTabToWindow(tab, session.windowId, callback);
                    return;
                }

                // else add tab to saved session in database
                // remove tab from current window
                chrome.tabs.remove(tab.id);

                // update session in db
                session.tabs = session.tabs.concat(newTabs);
                spacesService.updateSessionTabs(
                    session.id,
                    session.tabs,
                    callback
                );
            }
        });
    }

    function handleMoveTabToWindow(tabId, windowId, callback) {
        requestTabDetail(tabId, tab => {
            moveTabToWindow(tab, windowId, callback);
        });
    }
    function moveTabToWindow(tab, windowId, callback) {
        chrome.tabs.move(tab.id, { windowId, index: -1 });

        // NOTE: this move does not seem to trigger any tab event listeners
        // so we need to update sessions manually
        spacesService.queueWindowEvent(tab.windowId);
        spacesService.queueWindowEvent(windowId);

        callback(true);
    }

    return {
        requestSpaceFromWindowId,
        requestCurrentSpace,
        requestHotkeys,
        generatePopupParams,
    };
})();

spacesService.initialiseSpaces();
spacesService.initialiseTabHistory();
