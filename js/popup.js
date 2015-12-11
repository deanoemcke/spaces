/*global chrome */

(function () {

    'use strict';

    var UNSAVED_SESSION = '(unnamed window)',
        globalCurrentSpace,
        currentSpaceName;

    function renderSpaceInfo() {
        document.getElementById('activeSpaceTitle').value = globalCurrentSpace.name ? globalCurrentSpace.name : '(unnamed window)';
    }

    function renderHotkeys() {
        chrome.extension.getBackgroundPage().spaces.requestHotkeys(function (hotkeys) {
            document.querySelector('#switcherLink .hotkey').innerHTML = hotkeys.switchCode ? hotkeys.switchCode : 'no hotkey set';
            document.querySelector('#moverLink .hotkey').innerHTML = hotkeys.moveCode ? hotkeys.moveCode : 'no hotkey set';
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

        if (newName === UNSAVED_SESSION || newName === globalCurrentSpace.name) {
            return;
        }

        if (globalCurrentSpace.sessionId) {
            chrome.runtime.sendMessage({
                action: 'updateSessionName',
                sessionName: newName,
                sessionId: globalCurrentSpace.sessionId
            }, function() {});

        } else {
            chrome.runtime.sendMessage({
                action: 'saveNewSession',
                sessionName: newName,
                windowId: globalCurrentSpace.windowId
            }, function() {});
        }
    }


    function addEventListeners() {

        var hotkeyEls = document.querySelectorAll('.hotkey');
        for (var i = 0; i < hotkeyEls.length; i++) {
            hotkeyEls[i].addEventListener('click', function (e) {
                chrome.runtime.sendMessage({
                        action: 'requestShowKeyboardShortcuts'
                    });
                window.close();
            });
        }

        document.querySelector('#allSpacesLink .optionText').addEventListener('click', function (e) {
            chrome.runtime.sendMessage({
                    action: 'requestShowSpaces'
                });
            window.close();
        });
        document.querySelector('#switcherLink .optionText').addEventListener('click', function (e) {
            chrome.runtime.sendMessage({
                    action: 'requestShowSwitcher'
                });
            window.close();
        });
        document.querySelector('#moverLink .optionText').addEventListener('click', function (e) {
            chrome.runtime.sendMessage({
                    action: 'requestShowMover'
                });
            window.close();
        });
        document.getElementById('spaceEdit').addEventListener('click', function (e) {
            handleNameEdit();
        });
        document.getElementById('activeSpaceTitle').addEventListener('focus', function (e) {
            handleNameEdit();
        });
        document.getElementById('activeSpaceTitle').addEventListener('blur', function (e) {
            handleNameSave();
        });
    }

    document.addEventListener('DOMContentLoaded', function () {

        chrome.extension.getBackgroundPage().spaces.requestCurrentSpace(function (space) {

            globalCurrentSpace = space;

            renderSpaceInfo();
            renderHotkeys();
            addEventListeners();
        });
    });

}());