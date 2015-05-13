/*global chrome, localStorage */
(function (window) {

    'use strict';

    var dbService = {

        DB_SERVER: 'spaces',
        DB_VERSION: '1',
        DB_SESSIONS: 'ttSessions',

        noop: function() {},


       /**
        * INDEXEDDB FUNCTIONS
        */
        getDb: function() {
            var self = this;
            return db.open({
                server: self.DB_SERVER,
                version: self.DB_VERSION,
                schema: self.getSchema
            });
        },

       /**
        * Properties of a session object
        * session.id:           auto-generated indexedDb object id
        * session.sessionHash:  a hash formed from the combined urls in the session window
        * session.name:         the saved name of the session
        * session.tabs:         an array of chrome tab objects (often taken from the chrome window obj)
        * session.history:      an array of chrome tab objects that have been removed from the session
        * session.lastAccess:   timestamp that gets updated with every window focus
        */
        getSchema: function() {
            return {
                ttSessions: {
                    key: {
                        keyPath: 'id',
                        autoIncrement: true
                    },
                    indexes: {
                        id: {}
                    }
                }
            };
        },

        _fetchAllSessions: function() {
            var self = this;
            return this.getDb().then(function (s) {
                return s.query(self.DB_SESSIONS).all().execute();
            });
        },

        _fetchSessionById: function(id) {
            var self = this;

            id = typeof id === 'string' ? parseInt(id, 10) : id;
            return this.getDb().then(function (s) {
                return s.query(self.DB_SESSIONS, 'id' )
                        .only(id)
                        .distinct()
                        .desc()
                        .execute()
                        .then(function(results) {
                    return results.length > 0 ? results[0] : null;
                });
            });
        },

        fetchAllSessions: function(callback) {
            callback = typeof callback !== 'function' ? this.noop : callback;
            this._fetchAllSessions().then(function(sessions) {
                callback(sessions);
            });
        },

        fetchSessionById: function(id, callback) {
            id = typeof id === 'string' ? parseInt(id, 10) : id;
            callback = typeof callback !== 'function' ? this.noop : callback;
            this._fetchSessionById(id).then(function(session) {
                callback(session);
            });
        },

        fetchSessionNames: function(callback) {
            callback = typeof callback !== 'function' ? this.noop : callback;

            this._fetchAllSessions().then(function(sessions) {
                callback(sessions.map(function(session) {
                    return session.name;
                }));
            });
        },

        fetchSessionByName: function(sessionName, callback) {

            var self = this,
                matchFound,
                matchIndex;
            callback = typeof callback !== 'function' ? this.noop : callback;

            this._fetchAllSessions().then(function(sessions) {
                matchFound = sessions.some(function (session, index) {
                    if(session.name.toLowerCase() === sessionName.toLowerCase()) {
                        matchIndex = index;
                        return true;
                    }
                });

                if (matchFound) {
                    callback(sessions[matchIndex]);
                } else {
                    callback(false);
                }
            });
        },

        createSession: function(session, callback) {

            var self = this;
            callback = typeof callback !== 'function' ? this.noop : callback;

            //delete session id in case it already exists
            delete session.id;

            this.getDb().then(function (s) {
                return s.add(self.DB_SESSIONS, session);

            }).then(function(result) {
                if (result.length > 0) {
                    callback(result[0]);
                }
            });
        },

        updateSession: function(session, callback) {

            var self = this;
            callback = typeof callback !== 'function' ? this.noop : callback;

            //ensure session id is set
            if (!session.id) {
                callback(false);
                return;
            }

            this.getDb().then(function (s) {
                return s.update(self.DB_SESSIONS, session);

            }).then(function(result) {
                if (result.length > 0) {
                    callback(result[0]);
                }
            });
        },

        removeSession: function(id, callback) {

            var self = this;
            id = typeof id === 'string' ? parseInt(id, 10) : id;
            callback = typeof callback !== 'function' ? this.noop : callback;

            this.getDb().then(function (s) {
                return s.remove(self.DB_SESSIONS , id);
            }).then(callback);
        }
    };

    window.dbService = dbService;

}(window));
