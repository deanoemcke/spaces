/*global chrome, localStorage */

/* spaces
 * Copyright (C) 2015 Dean Oemcke
*/

(function (window) {

    'use strict';

    var spacesService = {

        tabHistoryUrlMap: {},
        closedWindowIds: {},
        sessions: [],
        sessionUpdateTimers: {},
        historyQueue: [],
        eventQueueCount: 0,
        lastVersion: 0,
        debug: false,

        noop: function() {},

        //initialise spaces - combine open windows with saved sessions
        initialiseSpaces: function() {

            var self = this,
                sessionId,
                match;

            console.log("initialising spaces..");

            //update version numbers
            this.lastVersion = this.fetchLastVersion();
            this.setLastVersion(chrome.runtime.getManifest().version);

            dbService.fetchAllSessions(function (sessions) {

                if (chrome.runtime.getManifest().version === "0.18" &&
                        chrome.runtime.getManifest().version !== self.lastVersion) {

                    console.log("resetting all session hashes..");
                    self.resetAllSessionHashes(sessions);
                }

                chrome.windows.getAll({populate: true}, function (windows) {

                    //populate session map from database
                    self.sessions = sessions;

                    //clear any previously saved windowIds
                    self.sessions.forEach(function (session) {
                        session.windowId = false;
                    });

                    //then try to match current open windows with saved sessions
                    windows.forEach(function (curWindow) {

                        if (!self.filterInternalWindows(curWindow)) {
                            self.checkForSessionMatch(curWindow);
                        }
                    });
                });
            });
        },

        resetAllSessionHashes: function(sessions) {

            var self = this;

            sessions.forEach(function (session) {
                session.sessionHash = self.generateSessionHash(session.tabs);
                dbService.updateSession(session);
            });
        },

        //record each tab's id and url so we can add history items when tabs are removed
        initialiseTabHistory: function() {

            var self = this;
            chrome.tabs.query({}, function (tabs) {
                tabs.forEach(function (tab) {
                    self.tabHistoryUrlMap[tab.id] = tab.url;
                });
            });
        },


        //NOTE: if ever changing this funciton, then we'll need to update all
        //saved sessionHashes so that they match next time, using: resetAllSessionHashes()
        _cleanUrl: function(url) {

            if (!url) {
                return '';
            }

            //ignore urls from this extension
            if (url.indexOf(chrome.runtime.id) >= 0) {
                return '';
            }

            //ignore 'new tab' pages
            if (url.indexOf('chrome://newtab/') >= 0) {
                return '';
            }

            //add support for 'The Great Suspender'
            if (url.indexOf('suspended.html') > 0 && url.indexOf('uri=') > 0) {
                url = url.substring(url.indexOf('uri=') + 4, url.length);
            }

            //remove any text after a '#' symbol
            if (url.indexOf('#') > 0) {
                url = url.substring(0, url.indexOf('#'));
            }

            //remove any text after a '?' symbol
            if (url.indexOf('?') > 0) {
                url = url.substring(0, url.indexOf('?'));
            }

            return url;
        },

        generateSessionHash: function(tabs) {

            var self = this,
                text = tabs.reduce(function(prevStr, tab) {
                        return prevStr + self._cleanUrl(tab.url);
                    }, '');

            var hash = 0, i, chr, len;
            if (text.length == 0) return hash;
            for (i = 0, len = text.length; i < len; i++) {
                chr   = text.charCodeAt(i);
                hash  = ((hash << 5) - hash) + chr;
                hash |= 0; // Convert to 32bit integer
            }
            return Math.abs(hash);
        },

        filterInternalWindows: function(curWindow) {

            //sanity check to make sure window isnt an internal spaces window
            if (curWindow.tabs.length === 1 && curWindow.tabs[0].url.indexOf(chrome.runtime.id) >= 0) {
                return true;
            }

            //also filter out popup or panel window types
            if (curWindow.type === 'popup' || curWindow.type === 'panel') {
                return true;
            }
            return false;
        },

        checkForSessionMatch: function(curWindow) {

            var sessionHash = this.generateSessionHash(curWindow.tabs),
                session = this.getSessionBySessionHash(sessionHash, true);

            if (session) {
                if (this.debug) console.log("matching session found: " + session.id + ". linking with window: " + curWindow.id);

                this.matchSessionToWindow(session, curWindow);

            } else {
                if (this.debug) console.log("no matching session found. creating temporary session for window: " + curWindow.id);

                //create a new temporary session for this window (with no sessionId or name)
                this.createTemporaryUnmatchedSession(curWindow);
            }
        },

        matchSessionToWindow: function(session, curWindow) {

            //remove any other sessions tied to this windowId (just in case)
            for (var i = this.sessions.length - 1; i >= 0; i--) {
                if (this.sessions[i].windowId === curWindow.id) {
                    if (this.sessions[i].id) {
                        this.sessions[i].windowId = false;
                    } else {
                        this.sessions.splice(i, 1);
                    }
                }
            }

            //assign windowId to newly matched session
            session.windowId = curWindow.id;
        },

        createTemporaryUnmatchedSession: function(curWindow) {

            if (this.debug) {
                console.dir(this.sessions);
                console.dir(curWindow);
                alert('couldnt match window. creating temporary session');
            }

            var sessionHash = this.generateSessionHash(curWindow.tabs);

            this.sessions.push({
                id: false,
                windowId: curWindow.id,
                sessionHash: sessionHash,
                name: false,
                tabs: curWindow.tabs,
                history: [],
                lastAccess: new Date()
            });
        },


        //local storage getters/setters
        fetchLastVersion: function () {
            var version = localStorage.getItem('spacesVersion');
            if (version !== null) {
                version = JSON.parse(version);
                return version;
            } else {
                return 0;
            }
        },

        setLastVersion: function (newVersion) {
            localStorage.setItem('spacesVersion', JSON.stringify(newVersion));
        },


        //event listener functions for window and tab events
        //(events are received and screened first in background.js)
        //-----------------------------------------------------------------------------------------

        handleTabRemoved: function(tabId, removeInfo, callback) {

            if (this.debug) console.log('handlingTabRemoved event. windowId: ' + removeInfo.windowId);

            //NOTE: isWindowClosing is true if the window cross was clicked causing the tab to be removed.
            //If the tab cross is clicked and it is the last tab in the window
            //isWindowClosing will still be false even though the window will close
            if (removeInfo.isWindowClosing) {
                //be very careful here as we definitley do not want these removals being saved
                //as part of the session (effectively corrupting the session)

                //should be handled by the window removed listener
                this.handleWindowRemoved(removeInfo.windowId, this.noop);

            //if this is a legitimate single tab removal from a window then update session/window
            } else {
                this.historyQueue.push({url: this.tabHistoryUrlMap[tabId], windowId: removeInfo.windowId});
                this.queueWindowEvent(removeInfo.windowId, this.eventQueueCount, callback);

                //remove tab from tabHistoryUrlMap
                delete this.tabHistoryUrlMap[tabId];
            }
        },
        handleTabMoved: function(tabId, moveInfo, callback) {

            if (this.debug) console.log('handlingTabMoved event. windowId: ' + moveInfo.windowId);
            this.queueWindowEvent(moveInfo.windowId, this.eventQueueCount, callback);
        },
        handleTabUpdated: function(tabId, changeInfo, tab, callback) {

            //NOTE: only queue event when tab has completed loading (title property exists at this point)
            if (tab.status === 'complete') {

                if (this.debug) console.log('handlingTabUpdated event. windowId: ' + tab.windowId);

                //update tab history in case the tab url has changed
                this.tabHistoryUrlMap[tab.id] = tab.url;
                this.queueWindowEvent(tab.windowId, this.eventQueueCount, callback);
            }
        },
        handleWindowRemoved: function(windowId, callback) {

            if (this.debug) console.log('handlingWindowRemoved event. windowId: ' + windowId);

            var self = this,
                session = this.getSessionByWindowId(windowId);

            if (session) {
                //if this is a saved session then just remove the windowId reference
                if (session.id) {
                    session.windowId = false;

                //else if it is temporary session then remove the session from the cache
                } else {
                    this.sessions.some(function (session, index) {
                        if (session.windowId === windowId) {
                            self.sessions.splice(index, 1);
                            return true;
                        }
                    });
                }
            }

            //add windowId to closedWindowIds. the idea is that once a window is closed it can never be
            //rematched to a new session (hopefully these window ids never get legitimately re-used)
            this.closedWindowIds[windowId] = true;
            clearTimeout(this.sessionUpdateTimers[windowId]);
            callback();
        },
        handleWindowFocussed: function(windowId) {

            if (this.debug) console.log('handlingWindowFocussed event. windowId: ' + windowId);

            var session = this.getSessionByWindowId(windowId);
            if (session) {
                session.lastAccess = new Date();
            }
        },


        //1sec timer-based batching system.
        //Set a timeout so that multiple tabs all opened at once (like when restoring a session)
        //only trigger this function once (as per the timeout set by the last tab event)
        //This will cause multiple triggers if time between tab openings is longer than 1 sec
        queueWindowEvent: function(windowId, eventId, callback) {
            var self = this;

            //don't allow event if it pertains to a closed window id
            if (this.closedWindowIds[windowId]) {
                if (this.debug) console.log('ignoring event as it pertains to a closed windowId: ' + windowId);
                return;
            }

            clearTimeout(this.sessionUpdateTimers[windowId]);

            this.eventQueueCount++;

            this.sessionUpdateTimers[windowId] = setTimeout(function() {
                self.handleWindowEvent(windowId, eventId, callback);
            }, 1000);
        },

        //careful here as this function gets called A LOT
        handleWindowEvent: function(windowId, eventId, callback) {

            var self = this,
                historyItems,
                historyItem,
                session,
                i;

            callback = typeof callback !== 'function' ? this.noop : callback;

            if (this.debug) console.log("------------------------------------------------");
            if (this.debug) console.log("event: " + eventId + ". attempting session update. windowId: " + windowId);

            //sanity check windowId
            if (!windowId || windowId <= 0) {
                if (this.debug) console.log("received an event for windowId: " + windowId + " which is obviously wrong");
                return;
            }

            chrome.windows.get(windowId, {populate: true}, function(curWindow) {

                if (chrome.runtime.lastError) {
                    console.error(chrome.runtime.lastError.message);
                    return;
                }

                if (!curWindow || self.filterInternalWindows(curWindow)) {
                    return;
                }

                //if window is associated with an open session then update session
                session = self.getSessionByWindowId(windowId);

                if (session) {

                    if (self.debug) console.log('tab statuses: ' + curWindow.tabs.map(function (curTab) {return curTab.status;}).join('|'));

                    //look for tabs recently removed from this session and add then to session history
                    historyItems = self.historyQueue.filter(function(historyItem) {
                            return historyItem.windowId === windowId;
                        });

                    for (i = historyItems.length - 1; i >= 0; i--) {
                        historyItem = historyItems[i];
                        self.addUrlToSessionHistory(session, historyItem.url);
                        self.historyQueue.splice(i, 1);
                    }

                    //override session tabs with tabs from window
                    session.tabs = curWindow.tabs;
                    session.sessionHash = self.generateSessionHash(session.tabs);

                    //if it is a saved session then update db
                    if (session.id) {
                        self.saveExistingSession(session.id);
                    }

                //else if no session found, it must be a new window. check for sessionMatch
                } else {

                    if (self.debug) console.log("session check triggered");
                    self.checkForSessionMatch(curWindow);
                }
                callback();
            });
        },



        //PUBLIC FUNCTIONS

        getSessionBySessionId: function(sessionId) {
            var result = this.sessions.filter(function(session) {
                    return session.id === sessionId;
                });
            return result.length === 1 ? result[0] : false;
        },
        getSessionByWindowId: function(windowId) {
            var result = this.sessions.filter(function(session) {
                    return session.windowId === windowId;
                });
            return result.length === 1 ? result[0] : false;
        },
        getSessionBySessionHash: function(hash, closedOnly) {
            var result = this.sessions.filter(function(session) {
                if (closedOnly) {
                    return session.sessionHash === hash && !session.windowId;
                } else {
                    return session.sessionHash === hash;
                }
            });
            return result.length >= 1 ? result[0] : false;
        },
        getSessionByName: function(name) {
            var result = this.sessions.filter(function(session) {
                    return session.name && session.name.toLowerCase() === name.toLowerCase();
                });
            return result.length >= 1 ? result[0] : false;
        },
        getAllSessions: function() {
            return this.sessions;
        },

        addUrlToSessionHistory: function(session, removedUrl) {

            if (this.debug) console.log('adding tab to history');

            var self = this,
                tabBeingRemoved;

            removedUrl = this._cleanUrl(removedUrl);

            if (removedUrl.length === 0) {
                return false;
            }


            //don't add removed tab to history if there is still a tab open with same url
            //note: assumes tab has NOT already been removed from session.tabs
            tabBeingRemoved = session.tabs.filter(function (curTab) {
                    return self._cleanUrl(curTab.url) === removedUrl;
                });

            if (tabBeingRemoved.length !== 1) {
                return false;
            }

            if (!session.history) session.history = [];

            //see if tab already exists in history. if so then remove it (it will be re-added)
            session.history.some(function (historyTab, index) {
                if (self._cleanUrl(historyTab.url) === removedUrl) {
                    session.history.splice(index, 1);
                    return true;
                }
            });

            //add url to session history
            session.history = tabBeingRemoved.concat(session.history);

            //trim history for this spae down to last 20 items
            session.history = session.history.slice(0, 20);

            return session;
        },


        //Database actions

        updateSessionTabs: function(sessionId, tabs, callback) {

            var session = this.getSessionBySessionId(sessionId);

            callback = typeof callback !== 'function' ? this.noop : callback;

            //update tabs in session
            session.tabs = tabs;
            session.sessionHash = this.generateSessionHash(session.tabs);

            this.saveExistingSession(session.id, callback);
        },

        updateSessionName: function(sessionId, sessionName, callback) {

            var session;

            callback = typeof callback !== 'function' ? this.noop : callback;

            session = this.getSessionBySessionId(sessionId);
            session.name = sessionName;

            this.saveExistingSession(session.id, callback);
        },

        saveExistingSession: function(sessionId, callback) {

            var self = this,
                session = this.getSessionBySessionId(sessionId),
                windowId = session.windowId;

            callback = typeof callback !== 'function' ? this.noop : callback;

            dbService.updateSession(session, callback);
        },

        saveNewSession: function(sessionName, tabs, windowId, callback) {

            var self = this,
                sessionHash = this.generateSessionHash(tabs),
                session;

            callback = typeof callback !== 'function' ? this.noop : callback;

            //check for a temporary session with this windowId
            if (windowId) {
                session = this.getSessionByWindowId(windowId);
            }

            //if no temporary session found with this windowId, then create one
            if (!session) {
                session = {
                    windowId: windowId,
                    history: []
                };
                this.sessions.push(session);
            }

            //update temporary session details
            session.name = sessionName;
            session.sessionHash = sessionHash;
            session.tabs = tabs;
            session.lastAccess = new Date();

            //save session to db
            dbService.createSession(session, function (savedSession) {

                //update sessionId in cache
                //oddly, this seems to get updated without having to do this assignment
                //session.id = savedSession.id;

                callback(session);
            });
        },

        deleteSession: function(sessionId, callback) {

            var self = this;

            callback = typeof callback !== 'function' ? this.noop : callback;

            dbService.removeSession(sessionId, function() {

                //remove session from cached array
                self.sessions.some(function (session, index) {
                    if (session.id === sessionId) {
                        self.sessions.splice(index, 1);
                        return true;
                    }
                });
                callback();
            });
        }

    };
    window.spacesService = spacesService;

}(window));
