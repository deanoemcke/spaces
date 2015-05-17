/*global chrome, dbService, render, createTabHtml */

(function () {

    'use strict';
    var nodes = {},
        globalTabId,
        globalUrl,
        globalWindowId,
        globalSessionName;

    function render() {

        //update currentSpaceDiv
        //nodes.windowTitle.innerHTML = "Current space: " + (globalSessionName ? globalSessionName : 'unnamed');
        nodes.activeSpaceTitle.innerHTML = globalSessionName ? globalSessionName : '(unnamed)';
        //selectSpace(nodes.activeSpace);

        updateTabDetails();

        chrome.runtime.sendMessage({
            action: 'requestAllSpaces'

        }, function (spaces) {

            //remove currently visible space
            spaces = spaces.filter(function(space) {
                return (space.windowId != globalWindowId); //loose matching here
            });
            spacesRenderer.initialise(5, false);
            spacesRenderer.renderSpaces(spaces);
        });
    }

    function updateTabDetails() {

        var faviconSrc,
            cleanUrl;

        //if we are working with an open chrome tab
        if (globalTabId) {

            chrome.runtime.sendMessage({
                action: 'requestTabDetail',
                tabId: globalTabId

            }, function (tab) {

                if (tab) {
                    nodes.activeTabTitle.innerHTML = tab.title;

                    //try to get best favicon url path
                    if (tab.favIconUrl && tab.favIconUrl.indexOf('chrome://theme') < 0) {
                        faviconSrc = tab.favIconUrl;
                    } else {
                        faviconSrc = 'chrome://favicon/' + tab.url;
                    }
                    nodes.activeTabFavicon.setAttribute('src', faviconSrc);

                    nodes.moveInput.setAttribute('placeholder', 'Move tab to..');

                    //nodes.windowTitle.innerHTML = tab.title;
                    //nodes.windowFavicon.setAttribute('href', faviconSrc);
                }
            });

        //else if we are dealing with a url only
        } else if (globalUrl) {

            cleanUrl = globalUrl.indexOf('://') > 0 ?
                globalUrl.substr(globalUrl.indexOf('://') + 3, globalUrl.length) :
                globalUrl;
            nodes.activeTabTitle.innerHTML = cleanUrl;
            nodes.activeTabFavicon.setAttribute('src', '/img/new.png');

            nodes.moveInput.setAttribute('placeholder', 'Add tab to..');
        }

    }

    function setGlobals() {

        if (location.hash.length > 0 && location.hash.split('&').length > 0) {
            var hash = location.hash.substr(1, location.hash.length),
                pairs = hash.split('&'),
                curKey = false,
                curVal = false;

            pairs.forEach(function(curPair) {
                curKey = curPair.split('=')[0];
                curVal = curPair.split('=')[1];

                if (curKey === 'tabId') {
                    globalTabId = curVal;
                } else if (curKey === 'url') {
                    globalUrl = curVal !== '' ? decodeURIComponent(curVal) : false;
                } else if (curKey === 'windowId') {
                    globalWindowId = curVal !== '' ? curVal : false;
                } else if (curKey === 'sessionName') {
                    globalSessionName = curVal && curVal !== 'false' ? curVal : false;
                }
            });
        }
    }

    function handleSelectAction() {

        var selectedSpaceEl =  document.querySelector('.space.selected'),
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
            edit: 'true'
        });
    }

    function handleCloseAction() {
        chrome.runtime.sendMessage({
            action: 'requestClose'
        });
    }

    function addEventListeners() {

        nodes.moveForm.onsubmit = function (e) {
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
    }

    window.onload = function () {

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

        addEventListeners();
        setGlobals();
        render();

    };

}());


