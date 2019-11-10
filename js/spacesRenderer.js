
'use strict';

var spacesRenderer = {

    UNSAVED_SESSION: '(unnamed window)',
    nodes: {},
    maxSuggestions: 10,
    oneClickMode: false,

    initialise: function(maxSuggestions, oneClickMode) {

        this.maxSuggestions = maxSuggestions;
        this.oneClickMode = oneClickMode;

        if (maxSuggestions > 7) {
            document.getElementById('spacesList').className = 'scroll';
        }

        this.nodes = {
            spacesList: document.getElementById('savedSpaces'),
            newSpace:  document.getElementById('newSpace'),
            newSpaceTitle: document.querySelector('#newSpace .spaceTitle'),
            moveInput: document.getElementById('sessionsInput')
        };

        this.addEventListeners();
    },

    renderSpaces: function(spaces) {

        var self = this,
            option,
            spaceEl;

        spaces.forEach(function(space) {
            spaceEl = self.renderSpaceEl(space);
            self.nodes.spacesList.appendChild(spaceEl);
        });
        this.selectSpace(this.getFirstSpaceEl(), false);

        this.updateSpacesList();

        this.nodes.moveInput.focus();
    },

    renderSpaceEl: function(space) {
        var self = this,
            listContainer = document.createElement('div'),
            listTitle = document.createElement('span'),
            listDetail = document.createElement('span'),
            name = space.name || this.UNSAVED_SESSION;

        listContainer.setAttribute('data-sessionId', space.sessionId);
        listContainer.setAttribute('data-windowId', space.windowId);

        listContainer.style.display = 'block';
        listContainer.className = 'space';
        listTitle.className = 'spaceTitle';
        listDetail.className = 'spaceDetail';

        listTitle.innerHTML = name;
        listDetail.innerHTML = this.getTabDetailsString(space);

        listContainer.appendChild(listTitle);
        listContainer.appendChild(listDetail);

        //if not in oneClickMode, add a default click handler to select space
        if (!this.oneClickMode) {
            listContainer.onclick = function (e) {
                self.handleSpaceClick(e);
            };
        }

        return listContainer;
    },

    handleSpaceClick: function(e) {
        var el =  e.target.tagName === 'SPAN' ? e.target.parentElement : e.target;
        this.selectSpace(el, !this.oneClickMode);
    },

    handleSelectionNavigation: function(direction) {
        var spaceEls = document.querySelectorAll('#spacesList .space'),
            prevEl = false,
            selectNext = false,
            selectedSpaceEl;

        Array.prototype.some.call(spaceEls, function (el) {

            if (el.style.display !== 'block') return false;

            //locate currently selected space
            if (el.className.indexOf('selected') >= 0) {
                if (direction === 'up' && prevEl) {
                    selectedSpaceEl = prevEl;
                    return true;

                } else if (direction === 'down') {
                    selectNext = true;
                }
            } else if (selectNext) {
                selectedSpaceEl = el;
                return true;
            }
            prevEl = el;
        });
        if (selectedSpaceEl) {
            this.selectSpace(selectedSpaceEl, !this.oneClickMode);
        }
    },

    getFirstSpaceEl: function() {
        var allSpaceEls = document.querySelectorAll('#spacesList .space'),
            firstSpaceEl = false;
        Array.prototype.some.call(allSpaceEls, function (spaceEl) {
            if (spaceEl.style.display === 'block') {
                firstSpaceEl = spaceEl;
                return true;
            }
        });
        return firstSpaceEl;
    },

    selectSpace: function(selectedSpaceEl, updateText) {

        var allSpaceEls = document.querySelectorAll('#spacesList .space'),
            spaceTitle,
            spaceEl,
            windowId,
            open,
            selected,
            i;

        for (i = 0; i < allSpaceEls.length; i++) {
            spaceEl = allSpaceEls[i];
            windowId = spaceEl.getAttribute('data-windowId');
            open = windowId && windowId !== 'false';
            selected = selectedSpaceEl === spaceEl;
            spaceEl.className = 'space';
            if (open) spaceEl.className = spaceEl.className + ' open';
            if (selected) spaceEl.className = spaceEl.className + ' selected';
        }

        if (updateText) {
            spaceTitle = selectedSpaceEl.querySelector('.spaceTitle').innerHTML;
            spaceTitle = spaceTitle !== this.UNSAVED_SESSION ? spaceTitle : '';
            this.nodes.moveInput.value = spaceTitle;
            //this.nodes.moveInput.select();
        }
    },

    getTabDetailsString: function(space) {
        var count = space.tabs.length,
            open = space.windowId;

        if (open) {
            return '';
        } else {
            return '(' + status + count + ' tab' + (count > 1 ? 's' : '') + ')';
        }
    },

    updateSpacesList: function() {

        var self = this,
            query = this.nodes.moveInput.value,
            savedSpaceEls,
            curSpaceName,
            match = false,
            exactMatch = false,
            selectFirst = false,
            count = 0;

        //show all spaces that partially match the query
        savedSpaceEls = document.querySelectorAll('#savedSpaces .space');
        Array.prototype.forEach.call(savedSpaceEls, function (spaceEl) {
            curSpaceName = spaceEl.getElementsByClassName('spaceTitle')[0].innerHTML;
            match = curSpaceName.toLowerCase().indexOf(query.toLowerCase()) !== -1;
            exactMatch = exactMatch || query.toLowerCase() === curSpaceName.toLowerCase();
            if (match) {
                spaceEl.style.display = 'block';
            } else {
                spaceEl.style.display = 'none';
            }
        });

        //show the 'create new' div if exact match not found
        if (this.nodes.newSpace) {
            if (!exactMatch && query.length > 0) {
                this.nodes.newSpaceTitle.innerHTML = query;
                this.nodes.newSpace.className = 'space';
                this.nodes.newSpace.style.display = 'block';
            } else {
                this.nodes.newSpace.style.display = 'none';
            }
        }

        //highlight the first space el in the visible list
        this.selectSpace(this.getFirstSpaceEl(), false);
    },

    addEventListeners: function() {

        var self = this;

        this.nodes.moveInput.parentElement.parentElement.onkeyup = function (e) {

            //listen for 'up' key
            if (e.keyCode === 38) {
                self.handleSelectionNavigation('up');

            //listen for 'down' key
            } else if (e.keyCode === 40) {
                self.handleSelectionNavigation('down');

            //else treat as text input (only trigger on alphanumeric, delete or backspace keys when modifiers are not down)
            } else if (!e.altKey && !e.ctrlKey &&
                    (e.keyCode === 46 || e.keyCode === 8 || (e.keyCode >= 48 && e.keyCode <= 90))) {
                self.updateSpacesList();
            }
        };

        if (this.nodes.newSpace) {
            this.nodes.newSpace.onclick = function(e) {
                self.handleSpaceClick;
            };
        }
    }
};