/*global chrome */

(function () {

    'use strict';

    var globalCurrentSpace;

    function renderSpaceInfo() {
        document.getElementById('activeSpaceTitle').innerHTML = globalCurrentSpace.name ? globalCurrentSpace.name : '(unnamed window)';
    }

    function renderHotkeys() {
        chrome.extension.getBackgroundPage().spaces.requestHotkeys(function (hotkeys) {
            document.querySelector('#switcherLink .hotkey').innerHTML = hotkeys.switchCode ? hotkeys.switchCode : 'no hotkey set';
            document.querySelector('#moverLink .hotkey').innerHTML = hotkeys.moveCode ? hotkeys.moveCode : 'no hotkey set';
        });
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
            chrome.runtime.sendMessage({
                    action: 'requestShowSpaces',
                    windowId: globalCurrentSpace.windowId,
                    edit: true
                });
            window.close();
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