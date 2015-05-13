/*global chrome, dbService, render, createTabHtml */

(function () {

    'use strict';
    var nodes = {},
        globalTabId,
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

        var faviconSrc;

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

                //nodes.windowTitle.innerHTML = tab.title;
                //nodes.windowFavicon.setAttribute('href', faviconSrc);
            }
        });
    }

    function setGlobals() {

        if (location.hash.length > 0 && location.hash.split('&').length === 3) {
            var hash = location.hash.substr(1, location.hash.length),
                pairs = hash.split('&'),
                curKey = false,
                curVal = false;

            pairs.forEach(function(curPair) {
                curKey = curPair.split('=')[0];
                curVal = curPair.split('=')[1];

                if (curKey === 'tabId') {
                    globalTabId = curVal;
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
            newSessionName = nodes.moveInput.value;

        if (sessionId && sessionId !== 'false') {

            chrome.runtime.sendMessage({
                action: 'moveTabToSession',
                tabId: globalTabId,
                sessionId: sessionId
            });

        } else if (windowId && windowId !== 'false') {

            chrome.runtime.sendMessage({
                action: 'moveTabToWindow',
                tabId: globalTabId,
                windowId: windowId
            });

        } else {

            chrome.runtime.sendMessage({
                action: 'moveTabToNewSession',
                tabId: globalTabId,
                sessionName: newSessionName
            });
        }
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


