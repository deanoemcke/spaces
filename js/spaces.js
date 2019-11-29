/* global chrome */

(() => {
    const UNSAVED_SESSION = '<em>Unnamed window</em>';
    const nodes = {};
    let globalSelectedSpace;
    let bannerState;

    // METHODS FOR RENDERING SIDENAV (spaces list)

    function renderSpacesList(spaces) {
        let spaceEl;

        nodes.openSpaces.innerHTML = '';
        nodes.closedSpaces.innerHTML = '';

        spaces.forEach(space => {
            spaceEl = renderSpaceListEl(space);
            if (space.windowId) {
                nodes.openSpaces.appendChild(spaceEl);
            } else {
                nodes.closedSpaces.appendChild(spaceEl);
            }
        });
    }

    function renderSpaceListEl(space) {
        let hash;

        const listEl = document.createElement('li');
        const linkEl = document.createElement('a');

        if (space.sessionId) {
            hash = `#sessionId=${space.sessionId}`;
        } else if (space.windowId) {
            hash = `#windowId=${space.windowId}`;
        }
        linkEl.setAttribute('href', hash);

        if (space.name) {
            linkEl.innerHTML = space.name;
        } else {
            linkEl.innerHTML = UNSAVED_SESSION;
        }

        if (
            globalSelectedSpace &&
            ((space.windowId &&
                globalSelectedSpace.windowId === space.windowId) ||
                (space.sessionId &&
                    globalSelectedSpace.sessionId === space.sessionId))
        ) {
            linkEl.className = 'selected';
        }

        // if (space && !space.windowId) {
        //     iconEl.className = 'icon fa fa-external-link';
        //     iconEl.setAttribute('title', 'Load this space');
        // } else {
        //     iconEl.className = 'icon fa fa-arrow-circle-right';
        //     iconEl.setAttribute('title', 'Switch to this space');
        // }
        // listEl.appendChild(iconEl);

        // //add event listener for each load/switch icon
        // iconEl.addEventListener("click", () => {
        //     handleLoadSpace(space.sessionId, space.windowId);
        // });

        listEl.appendChild(linkEl);
        return listEl;
    }

    // METHODS FOR RENDERING MAIN CONTENT (space detail)

    function renderSpaceDetail(space, editMode) {
        updateNameForm(space);
        toggleNameEditMode(editMode);
        updateButtons(space);
        renderTabs(space);
    }

    function updateNameForm(space) {
        if (space && space.name) {
            nodes.nameFormInput.value = space.name;
            nodes.nameFormDisplay.innerHTML = space.name;
        } else {
            nodes.nameFormInput.value = '';
            if (space) {
                nodes.nameFormDisplay.innerHTML = UNSAVED_SESSION;
            } else {
                nodes.nameFormDisplay.innerHTML = '';
            }
        }
    }

    function toggleNameEditMode(visible) {
        if (visible) {
            nodes.nameFormDisplay.style.display = 'none';
            nodes.nameFormInput.style.display = 'inline';
            nodes.nameFormInput.focus();
        } else {
            nodes.nameFormDisplay.style.display = 'inline';
            nodes.nameFormInput.style.display = 'none';
        }
    }

    function updateButtons(space) {
        const sessionId = space && space.sessionId ? space.sessionId : false;
        const windowId = space && space.windowId ? space.windowId : false;

        nodes.actionSwitch.style.display = windowId ? 'inline-block' : 'none';
        nodes.actionOpen.style.display =
            space && !windowId ? 'inline-block' : 'none';
        nodes.actionEdit.style.display =
            sessionId || windowId ? 'inline-block' : 'none';
        nodes.actionExport.style.display =
            sessionId || windowId ? 'inline-block' : 'none';
        nodes.actionDelete.style.display =
            !windowId && sessionId ? 'inline-block' : 'none';
    }

    function renderTabs(space) {
        nodes.activeTabs.innerHTML = '';
        nodes.historicalTabs.innerHTML = '';

        if (!space) {
            nodes.spaceDetailContainer.style.display = 'none';
        } else {
            nodes.spaceDetailContainer.style.display = 'block';

            space.tabs.forEach(tab => {
                nodes.activeTabs.appendChild(renderTabListEl(tab, space));
            });
            if (space.history) {
                space.history.forEach(tab => {
                    nodes.historicalTabs.appendChild(
                        renderTabListEl(tab, space)
                    );
                });
            } else {
                // TODO: hide historical tabs section
            }
        }
    }

    function renderTabListEl(tab, space) {
        let faviconSrc;

        const listEl = document.createElement('li');
        const linkEl = document.createElement('a');
        const faviconEl = document.createElement('img');

        // try to get best favicon url path
        if (tab.favIconUrl && tab.favIconUrl.indexOf('chrome://theme') < 0) {
            faviconSrc = tab.favIconUrl;
        } else {
            faviconSrc = `chrome://favicon/${tab.url}`;
        }
        faviconEl.setAttribute('src', faviconSrc);

        linkEl.innerHTML = tab.title ? tab.title : tab.url;
        linkEl.setAttribute('href', tab.url);
        linkEl.setAttribute('target', '_blank');

        // add event listener for each tab link
        linkEl.addEventListener('click', e => {
            e.preventDefault();
            handleLoadTab(space.sessionId, space.windowId, tab.url);
        });

        if (tab.duplicate) {
            linkEl.className = 'duplicate';
        }

        listEl.appendChild(faviconEl);
        listEl.appendChild(linkEl);
        return listEl;
    }

    function initialiseBanner(spaces) {
        let savedSpacesExist = false;

        savedSpacesExist = spaces.some(space => {
            if (space.name) return true;
            return false;
        });

        if (!savedSpacesExist) {
            setBannerState(1);
        }
    }

    function setBannerState(state) {
        const lessonOneEl = document.getElementById('lessonOne');
        const lessonTwoEl = document.getElementById('lessonTwo');

        if (state !== bannerState) {
            bannerState = state;

            toggleBanner(false, () => {
                if (state > 0) {
                    nodes.banner.style.display = 'block';
                    if (state === 1) {
                        lessonOneEl.style.display = 'block';
                        lessonTwoEl.style.display = 'none';
                    } else if (state === 2) {
                        lessonOneEl.style.display = 'none';
                        lessonTwoEl.style.display = 'block';
                    }
                    toggleBanner(true);
                }
            });
        }
    }

    function toggleBanner(visible, callback) {
        setTimeout(() => {
            nodes.banner.className = visible ? ' ' : 'hidden';
            if (typeof callback === 'function') {
                setTimeout(() => {
                    callback();
                }, 200);
            }
        }, 100);
    }

    function toggleModal(visible) {
        nodes.modalBlocker.style.display = visible ? 'block' : 'none';
        nodes.modalContainer.style.display = visible ? 'block' : 'none';

        if (visible) {
            nodes.modalInput.value = '';
            nodes.modalInput.focus();
        }
    }

    // ACTION HANDLERS

    function handleLoadSpace(sessionId, windowId) {
        if (sessionId) {
            performLoadSession(sessionId, () => {
                reroute(sessionId, false, false);
            });
        } else if (windowId) {
            performLoadWindow(windowId, () => {
                reroute(false, windowId, false);
            });
        }
    }

    function handleLoadTab(sessionId, windowId, tabUrl) {
        const noop = () => {};

        if (sessionId) {
            performLoadTabInSession(sessionId, tabUrl, noop);
        } else if (windowId) {
            performLoadTabInWindow(windowId, tabUrl, noop);
        }
    }

    // if background page requests this page update, then assume we need to do a full page update
    function handleAutoUpdateRequest(spaces) {
        let matchingSpaces;
        let selectedSpace;

        // re-render main spaces list
        updateSpacesList(spaces);

        // if we are currently viewing a space detail then update this object from returned spaces list
        if (globalSelectedSpace) {
            // look for currently selected space by sessionId
            if (globalSelectedSpace.sessionId) {
                matchingSpaces = spaces.filter(curSpace => {
                    return curSpace.sessionId === globalSelectedSpace.sessionId;
                });
                if (matchingSpaces.length === 1) {
                    [selectedSpace] = matchingSpaces;
                }

                // else look for currently selected space by windowId
            } else if (globalSelectedSpace.windowId) {
                matchingSpaces = spaces.filter(curSpace => {
                    return curSpace.windowId === globalSelectedSpace.windowId;
                });
                if (matchingSpaces.length === 1) {
                    [selectedSpace] = matchingSpaces;
                }
            }

            // update cache and re-render space detail view
            if (selectedSpace) {
                globalSelectedSpace = selectedSpace;
                updateSpaceDetail(true);
            } else {
                reroute(false, false, true);
            }
        }
    }

    function handleNameSave() {
        const newName = nodes.nameFormInput.value;
        const oldName = globalSelectedSpace.name;
        const { sessionId } = globalSelectedSpace;
        const { windowId } = globalSelectedSpace;

        // if invalid name set then revert back to non-edit mode
        if (newName === oldName || newName.trim() === '') {
            updateNameForm(globalSelectedSpace);
            toggleNameEditMode(false);
            return;
        }

        // otherwise call the save service
        if (sessionId) {
            performSessionUpdate(newName, sessionId, session => {
                if (session) reroute(session.id, false, true);
            });
        } else if (windowId) {
            performNewSessionSave(newName, windowId, session => {
                if (session) reroute(session.id, false, true);
            });
        }

        // handle banner
        if (bannerState === 1) {
            setBannerState(2);
        }
    }

    function handleDelete() {
        const { sessionId } = globalSelectedSpace;

        if (sessionId) {
            performDelete(sessionId, () => {
                updateSpacesList();
                reroute(false, false, true);
            });
        }
    }

    // import accepts either a newline separated list of urls or a json backup object
    function handleImport() {
        let urlList;
        let spacesObject;

        const rawInput = nodes.modalInput.value;

        // check for json object
        try {
            spacesObject = JSON.parse(rawInput);
            performRestoreFromBackup(spacesObject, () => {
                updateSpacesList();
            });
        } catch (e) {
            // otherwise treat as a list of newline separated urls
            if (rawInput.trim().length > 0) {
                urlList = rawInput.split('\n');

                // filter out bad urls
                urlList = urlList.filter(url => {
                    if (url.trim().length > 0 && url.indexOf('://') > 0)
                        return true;
                    return false;
                });

                if (urlList.length > 0) {
                    performSessionImport(urlList, session => {
                        if (session) reroute(session.id, false, true);
                    });
                }
            }
        }
    }

    function handleBackup() {
        const leanSpaces = [];

        fetchAllSpaces(spaces => {
            // strip out unnessary content from each space
            spaces.forEach(space => {
                const leanTabs = [];
                space.tabs.forEach(curTab => {
                    leanTabs.push({
                        title: curTab.title,
                        url: normaliseTabUrl(curTab.url),
                        favIconUrl: curTab.favIconUrl,
                    });
                });

                leanSpaces.push({
                    name: space.name,
                    tabs: leanTabs,
                });
            });

            const blob = new Blob([JSON.stringify(leanSpaces)], {
                type: 'application/json',
            });
            const blobUrl = URL.createObjectURL(blob);
            const filename = 'spaces-backup.json';
            const link = document.createElement('a');
            link.setAttribute('href', blobUrl);
            link.setAttribute('download', filename);
            link.click();
        });
    }

    function handleExport() {
        const { sessionId } = globalSelectedSpace;
        const { windowId } = globalSelectedSpace;
        let csvContent = '';
        let dataString = '';

        fetchSpaceDetail(sessionId, windowId, space => {
            space.tabs.forEach(curTab => {
                const url = normaliseTabUrl(curTab.url);
                dataString += `${url}\n`;
            });
            csvContent += dataString;

            const blob = new Blob([csvContent], { type: 'text/plain' });
            const blobUrl = URL.createObjectURL(blob);
            const filename = `${space.name || 'untitled'}.txt`;
            const link = document.createElement('a');
            link.setAttribute('href', blobUrl);
            link.setAttribute('download', filename);
            link.click();
        });
    }

    function normaliseTabUrl(url) {
        let normalisedUrl = url;
        if (url.indexOf('suspended.html') > 0 && url.indexOf('uri=') > 0) {
            normalisedUrl = url.substring(url.indexOf('uri=') + 4, url.length);
        }
        return normalisedUrl;
    }

    // SERVICES

    function fetchAllSpaces(callback) {
        chrome.runtime.sendMessage(
            {
                action: 'requestAllSpaces',
            },
            callback
        );
    }

    function fetchSpaceDetail(sessionId, windowId, callback) {
        chrome.runtime.sendMessage(
            {
                action: 'requestSpaceDetail',
                sessionId: sessionId || false,
                windowId: windowId || false,
            },
            callback
        );
    }

    function performLoadSession(sessionId, callback) {
        chrome.runtime.sendMessage(
            {
                action: 'loadSession',
                sessionId,
            },
            callback
        );
    }

    function performLoadWindow(windowId, callback) {
        chrome.runtime.sendMessage(
            {
                action: 'loadWindow',
                windowId,
            },
            callback
        );
    }

    function performLoadTabInSession(sessionId, tabUrl, callback) {
        chrome.runtime.sendMessage(
            {
                action: 'loadTabInSession',
                sessionId,
                tabUrl,
            },
            callback
        );
    }

    function performLoadTabInWindow(windowId, tabUrl, callback) {
        chrome.runtime.sendMessage(
            {
                action: 'loadTabInWindow',
                windowId,
                tabUrl,
            },
            callback
        );
    }

    function performDelete(sessionId, callback) {
        chrome.runtime.sendMessage(
            {
                action: 'deleteSession',
                sessionId,
            },
            callback
        );
    }

    function performSessionUpdate(newName, sessionId, callback) {
        chrome.runtime.sendMessage(
            {
                action: 'updateSessionName',
                sessionName: newName,
                sessionId,
            },
            callback
        );
    }

    function performNewSessionSave(newName, windowId, callback) {
        chrome.runtime.sendMessage(
            {
                action: 'saveNewSession',
                sessionName: newName,
                windowId,
            },
            callback
        );
    }

    function performSessionImport(urlList, callback) {
        chrome.runtime.sendMessage(
            {
                action: 'importNewSession',
                urlList,
            },
            callback
        );
    }

    function performRestoreFromBackup(spacesObject, callback) {
        chrome.runtime.sendMessage(
            {
                action: 'restoreFromBackup',
                spaces: spacesObject,
            },
            callback
        );
    }

    // EVENT LISTENERS FOR STATIC DOM ELEMENTS

    function addEventListeners() {
        // register hashchange listener
        window.onhashchange = () => {
            updateSpacesList();
            updateSpaceDetail();
        };

        // register incoming events listener
        chrome.runtime.onMessage.addListener(request => {
            if (request.action === 'updateSpaces' && request.spaces) {
                handleAutoUpdateRequest(request.spaces);
            }
        });

        // register dom listeners
        nodes.nameFormDisplay.addEventListener('click', () => {
            toggleNameEditMode(true);
        });
        nodes.nameFormInput.addEventListener('blur', () => {
            handleNameSave();
        });
        nodes.nameForm.addEventListener('submit', e => {
            e.preventDefault();
            handleNameSave();
        });
        nodes.actionSwitch.addEventListener('click', () => {
            handleLoadSpace(
                globalSelectedSpace.sessionId,
                globalSelectedSpace.windowId
            );
        });
        nodes.actionOpen.addEventListener('click', () => {
            handleLoadSpace(globalSelectedSpace.sessionId, false);
        });
        nodes.actionEdit.addEventListener('click', () => {
            toggleNameEditMode(true);
        });
        nodes.actionExport.addEventListener('click', () => {
            handleExport();
        });
        nodes.actionBackup.addEventListener('click', () => {
            handleBackup();
        });
        nodes.actionDelete.addEventListener('click', () => {
            handleDelete();
        });
        nodes.actionImport.addEventListener('click', e => {
            e.preventDefault();
            toggleModal(true);
        });
        nodes.modalBlocker.addEventListener('click', () => {
            toggleModal(false);
        });
        nodes.modalButton.addEventListener('click', () => {
            handleImport();
            toggleModal(false);
        });
    }

    // ROUTING

    // update the hash with new ids (can trigger page re-render)
    function reroute(sessionId, windowId, forceRerender) {
        let hash;

        hash = '#';
        if (sessionId) {
            hash += `sessionId=${sessionId}`;
        } else if (windowId) {
            hash += `windowId=${sessionId}`;
        }

        // if hash hasn't changed page will not trigger onhashchange event
        if (window.location.hash === hash) {
            if (forceRerender) {
                updateSpacesList();
                updateSpaceDetail();
            }

            // otherwise set new hash and let the change listener call routeHash
        } else {
            window.location.hash = hash;
        }
    }

    function getVariableFromHash(key) {
        if (window.location.hash.length > 0) {
            const hash = window.location.hash.substr(
                1,
                window.location.hash.length
            );
            const pairs = hash.split('&');

            let matchedVal;
            const match = pairs.some(curPair => {
                const [curKey, curVal] = curPair.split('=');
                if (curKey === key) {
                    matchedVal = curVal;
                    return true;
                }
                return false;
            });

            if (match) {
                return matchedVal;
            }
        }
        return false;
    }

    function updateSpacesList(spaces) {
        // if spaces passed in then re-render immediately
        if (spaces) {
            renderSpacesList(spaces);

            // otherwise do a fetch of spaces first
        } else {
            fetchAllSpaces(newSpaces => {
                renderSpacesList(newSpaces);

                // determine if welcome banner should show
                initialiseBanner(newSpaces);
            });
        }
    }

    function updateSpaceDetail(useCachedSpace) {
        const sessionId = getVariableFromHash('sessionId');
        const windowId = getVariableFromHash('windowId');
        const editMode = getVariableFromHash('editMode');

        // use cached currently selected space
        if (useCachedSpace) {
            addDuplicateMetadata(globalSelectedSpace);
            renderSpaceDetail(globalSelectedSpace, editMode);

            // otherwise refetch space based on hashvars
        } else if (sessionId || windowId) {
            fetchSpaceDetail(sessionId, windowId, space => {
                addDuplicateMetadata(space);

                // cache current selected space
                globalSelectedSpace = space;
                renderSpaceDetail(space, editMode);
            });

            // otherwise hide space detail view
        } else {
            // clear cache
            globalSelectedSpace = false;
            renderSpaceDetail(false, false);
        }
    }

    function addDuplicateMetadata(space) {
        const dupeCounts = {};

        space.tabs.forEach(tab => {
            // eslint-disable-next-line no-param-reassign
            tab.title = tab.title || tab.url;
            dupeCounts[tab.title] = dupeCounts[tab.title]
                ? dupeCounts[tab.title] + 1
                : 1;
        });
        space.tabs.forEach(tab => {
            // eslint-disable-next-line no-param-reassign
            tab.duplicate = dupeCounts[tab.title] > 1;
        });
    }

    window.onload = () => {
        // initialise global handles to key elements (singletons)
        nodes.home = document.getElementById('spacesHome');
        nodes.openSpaces = document.getElementById('openSpaces');
        nodes.closedSpaces = document.getElementById('closedSpaces');
        nodes.activeTabs = document.getElementById('activeTabs');
        nodes.historicalTabs = document.getElementById('historicalTabs');
        nodes.spaceDetailContainer = document.querySelector(
            '.content .contentBody'
        );
        nodes.nameForm = document.querySelector('#nameForm');
        nodes.nameFormDisplay = document.querySelector('#nameForm span');
        nodes.nameFormInput = document.querySelector('#nameForm input');
        nodes.actionSwitch = document.getElementById('actionSwitch');
        nodes.actionOpen = document.getElementById('actionOpen');
        nodes.actionEdit = document.getElementById('actionEdit');
        nodes.actionExport = document.getElementById('actionExport');
        nodes.actionBackup = document.getElementById('actionBackup');
        nodes.actionDelete = document.getElementById('actionDelete');
        nodes.actionImport = document.getElementById('actionImport');
        nodes.banner = document.getElementById('banner');
        nodes.modalBlocker = document.querySelector('.blocker');
        nodes.modalContainer = document.querySelector('.modal');
        nodes.modalInput = document.getElementById('importTextArea');
        nodes.modalButton = document.getElementById('importBtn');

        nodes.home.setAttribute('href', chrome.extension.getURL('spaces.html'));

        // initialise event listeners for static elements
        addEventListeners();

        // render side nav
        updateSpacesList();

        // render main content
        updateSpaceDetail();
    };
})();
