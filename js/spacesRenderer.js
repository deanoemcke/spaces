// eslint-disable-next-line no-var
var spacesRenderer = {
    nodes: {},
    maxSuggestions: 10,
    oneClickMode: false,

    initialise: (maxSuggestions, oneClickMode) => {
        spacesRenderer.maxSuggestions = maxSuggestions;
        spacesRenderer.oneClickMode = oneClickMode;

        // if (maxSuggestions > 7) {
        document.getElementById('spacesList').className = 'scroll';
        // }

        spacesRenderer.nodes = {
            spacesList: document.getElementById('savedSpaces'),
            newSpace: document.getElementById('newSpace'),
            newSpaceTitle: document.querySelector('#newSpace .spaceTitle'),
            moveInput: document.getElementById('sessionsInput'),
        };

        spacesRenderer.addEventListeners();
    },

    renderSpaces: spaces => {
        spaces.forEach(space => {
            const spaceEl = spacesRenderer.renderSpaceEl(space);
            spacesRenderer.nodes.spacesList.appendChild(spaceEl);
        });
        spacesRenderer.selectSpace(spacesRenderer.getFirstSpaceEl(), false);

        spacesRenderer.updateSpacesList();

        spacesRenderer.nodes.moveInput.focus();
    },

    renderSpaceEl: space => {
        const listContainer = document.createElement('div');
        const listTitle = document.createElement('span');
        const listDetail = document.createElement('span');

        listContainer.setAttribute('data-sessionId', space.sessionId);
        listContainer.setAttribute('data-windowId', space.windowId);
        listContainer.setAttribute('data-spaceName', space.name || '');
        listContainer.setAttribute(
            'data-placeholder',
            space.name || 'Unnamed space'
        );

        listContainer.style.display = 'flex';
        listContainer.style.visiblilty = 'visible';
        listContainer.className = 'space';
        listTitle.className = 'spaceTitle';
        listDetail.className = 'spaceDetail';

        listTitle.innerHTML =
            space.name || spacesRenderer.getDefaultSpaceTitle(space);
        listDetail.innerHTML = spacesRenderer.getTabDetailsString(space);

        listContainer.appendChild(listTitle);
        listContainer.appendChild(listDetail);

        // if not in oneClickMode, add a default click handler to select space
        if (!spacesRenderer.oneClickMode) {
            listContainer.onclick = e => {
                spacesRenderer.handleSpaceClick(e);
            };
        }

        return listContainer;
    },

    handleSpaceClick: e => {
        const el =
            e.target.tagName === 'SPAN' ? e.target.parentElement : e.target;
        spacesRenderer.selectSpace(el, !spacesRenderer.oneClickMode);
    },

    handleSelectionNavigation: direction => {
        const spaceEls = document.querySelectorAll('#spacesList .space');
        let prevEl = false;
        let selectNext = false;
        let selectedSpaceEl;

        Array.prototype.some.call(spaceEls, el => {
            if (el.style.visibility !== 'visible') return false;

            // locate currently selected space
            if (el.className.indexOf('selected') >= 0) {
                if (direction === 'up' && prevEl) {
                    selectedSpaceEl = prevEl;
                    return true;
                }
                if (direction === 'down') {
                    selectNext = true;
                }
            } else if (selectNext) {
                selectedSpaceEl = el;
                return true;
            }
            prevEl = el;
            return false;
        });
        if (selectedSpaceEl) {
            spacesRenderer.selectSpace(
                selectedSpaceEl,
                !spacesRenderer.oneClickMode
            );
        }
    },

    getFirstSpaceEl: () => {
        const allSpaceEls = document.querySelectorAll('#spacesList .space');
        let firstSpaceEl = false;
        Array.prototype.some.call(allSpaceEls, spaceEl => {
            if (spaceEl.style.visibility === 'visible') {
                firstSpaceEl = spaceEl;
                return true;
            }
            return false;
        });
        return firstSpaceEl;
    },

    selectSpace: (selectedSpaceEl, updateText) => {
        const allSpaceEls = document.querySelectorAll('#spacesList .space');

        for (let i = 0; i < allSpaceEls.length; i += 1) {
            const spaceEl = allSpaceEls[i];
            const windowId = spaceEl.getAttribute('data-windowId');
            const open = windowId && windowId !== 'false';
            const selected = selectedSpaceEl === spaceEl;
            spaceEl.className = 'space';
            if (open) spaceEl.classList.add('open');
            if (selected) spaceEl.classList.add('selected');
        }

        if (updateText) {
            const spaceName = selectedSpaceEl.getAttribute('data-spaceName');
            if (spaceName) {
                spacesRenderer.nodes.moveInput.value = spaceName;
            } else {
                spacesRenderer.nodes.moveInput.value = '';
                spacesRenderer.nodes.moveInput.placeholder = selectedSpaceEl.getAttribute(
                    'data-placeholder'
                );
            }

            // spacesRenderer.nodes.moveInput.select();
        }
    },

    getDefaultSpaceTitle: space => {
        const count = space.tabs && space.tabs.length;
        if (!count) return '';
        const firstTitle = space.tabs[0].title;
        if (count === 1) {
            return `[${firstTitle}]`;
        }
        return firstTitle.length > 30
            ? `[${firstTitle.slice(0, 21)}&hellip;] +${count - 1} more`
            : `[${firstTitle}] +${count - 1} more`;
    },

    getTabDetailsString: space => {
        const count = space.tabs && space.tabs.length;
        const open = space.windowId;

        if (open) {
            return '';
        }
        return `(${count} tab${count > 1 ? 's' : ''})`;
    },

    updateSpacesList: () => {
        const query = spacesRenderer.nodes.moveInput.value;
        let match = false;
        let exactMatch = false;

        // show all spaces that partially match the query
        const savedSpaceEls = document.querySelectorAll('#savedSpaces .space');
        Array.prototype.forEach.call(savedSpaceEls, spaceEl => {
            const curSpaceName = spaceEl.getElementsByClassName('spaceTitle')[0]
                .innerHTML;
            match =
                curSpaceName.toLowerCase().indexOf(query.toLowerCase()) !== -1;
            exactMatch =
                exactMatch ||
                query.toLowerCase() === curSpaceName.toLowerCase();
            if (match) {
                // eslint-disable-next-line no-param-reassign
                spaceEl.style.display = 'flex';
                // eslint-disable-next-line no-param-reassign
                spaceEl.style.visibility = 'visible';
            } else {
                // eslint-disable-next-line no-param-reassign
                spaceEl.style.display = 'none';
                // eslint-disable-next-line no-param-reassign
                spaceEl.style.visibility = 'hidden';
            }
        });

        // show the 'create new' div if exact match not found
        if (spacesRenderer.nodes.newSpace) {
            if (!exactMatch && query.length > 0) {
                spacesRenderer.nodes.newSpaceTitle.innerHTML = query;
                spacesRenderer.nodes.newSpace.setAttribute(
                    'data-spaceName',
                    query
                );
                spacesRenderer.nodes.newSpace.className = 'space';
                spacesRenderer.nodes.newSpace.style.display = 'flex';
                spacesRenderer.nodes.newSpace.style.visibility = 'visible';
            } else {
                spacesRenderer.nodes.newSpace.style.display = 'none';
                spacesRenderer.nodes.newSpace.style.visibility = 'hidden';
            }
        }

        // highlight the first space el in the visible list
        spacesRenderer.selectSpace(spacesRenderer.getFirstSpaceEl(), false);
    },

    addEventListeners: () => {
        spacesRenderer.nodes.moveInput.parentElement.parentElement.onkeyup = e => {
            // listen for 'up' key
            if (e.keyCode === 38) {
                spacesRenderer.handleSelectionNavigation('up');

                // listen for 'down' key
            } else if (e.keyCode === 40) {
                spacesRenderer.handleSelectionNavigation('down');

                // else treat as text input (only trigger on alphanumeric, delete or backspace keys when modifiers are not down)
            } else if (
                !e.altKey &&
                !e.ctrlKey &&
                (e.keyCode === 46 ||
                    e.keyCode === 8 ||
                    (e.keyCode >= 48 && e.keyCode <= 90))
            ) {
                spacesRenderer.updateSpacesList();
            }
        };

        if (spacesRenderer.nodes.newSpace) {
            spacesRenderer.nodes.newSpace.onclick =
                spacesRenderer.handleSpaceClick;
        }
    },
};
