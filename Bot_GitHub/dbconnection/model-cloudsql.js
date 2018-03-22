'use strict';

var mysql = require('mysql');
var config = require('../configurations/dbconfig.js');

var connectionPool = mysql.createPool({
    connectionLimit: 25,
    host: config.DB_HOST,
    user: config.DB_USER,
    password: config.DB_PASSWORD,
    database: config.DB_NAME
});

function list(tableName, limit, token, cb) {
    token = token ? parseInt(token, 10) : 0;
    connectionPool.getConnection(function (e, connection) {
        if (e) {
            return cb(e);
        } else {
            connection.query(
                'SELECT * FROM ' + tableName + ' LIMIT ? OFFSET ?', [limit, token],
                function (err, results) {
                    if (err) {
                        return cb(err);
                    }
                    var hasMore = results.length === limit ? token + results.length : false;
                    cb(null, results, hasMore);
                }
            );
            connection.release();
        }
    });
}

function create(tableName, data, cb) {
    var currMilliSec = Date.now();
    data.createdAt = currMilliSec;
    data.updatedAt = currMilliSec;
    data.isDeleted = false;

    connectionPool.getConnection(function (e, connection) {
        if (e) {
            return cb(e);
        } else {
            connection.query('INSERT INTO ' + tableName + ' SET ?', data, function (err, res) {
                if (err) {
                    return cb(err);
                }
                read(tableName, res.insertId, cb);
            });
            connection.release();
        }
    });
}

function read(tableName, id, cb) {
    connectionPool.getConnection(function (e, connection) {
        if (e) {
            return cb(e);
        } else {
            connection.query(
                'SELECT * FROM ' + tableName + ' WHERE `id` = ? AND `isDeleted` = ? ', [id, false], function (err, results) {
                    if (err) {
                        return cb(err);
                    }
                    if (!results.length) {
                        return cb({
                            code: 404,
                            message: 'Not found'
                        });
                    }
                    cb(null, results[0]);
                });
            connection.release();
        }
    });
}

function update(tableName, id, data, cb) {
    data.updatedAt = Date.now();
    data.isDeleted = false;

    connectionPool.getConnection(function (e, connection) {
        if (e) {
            return cb(e);
        } else {
            connection.query(
                'UPDATE ' + tableName + ' SET ? WHERE `id` = ?', [data, id], function (err) {
                    if (err) {
                        return cb(err);
                    }
                    read(tableName, id, cb);
                });
            connection.release();
        }
    });
}

function _softdelete(tableName, id, cb) {
    var currTime = new Date().getTime();
    connectionPool.getConnection(function (e, connection) {
        if (e) {
            return cb(e);
        } else {
            // Performing soft delete. i.e SET isDeleted to true
            connection.query(
                'UPDATE ' + tableName +
                ' SET `isDeleted` = ?, `updatedAt` = ? ' +
                ' WHERE `id` = ? AND `isDeleted` = ? ', [true, currTime, id, false], function (err, result) {
                    if (err) {
                        return cb(err);
                    }
                    cb(null, result);
                });
            connection.release();
        }
    });
}

function _delete(tableName, id, cb) {
    connectionPool.getConnection(function (e, connection) {
        if (e) {
            return cb(e);
        } else {
            // Performing soft delete. i.e SET isDeleted to true
            connection.query(
                'DELETE FROM ' + tableName + ' WHERE `id` = ?', [id], function (err, result) {
                    if (err) {
                        return cb(err);
                    }
                    cb(null, result);
                });
            connection.release();
        }
    });
}

function executeQueryStatement(query, data, cb) {
    connectionPool.getConnection(function (e, connection) {
        console.log("executeQueryStatement:: "+e);
        if (e) {
            return cb(e);
        } else {
            connection.query(query, data, function (err, results) {
                    if (err) {
                        return cb(err);
                    }

                    if (!results.length) {
                        return cb({
                            code: 404,
                            message: 'Not found'
                        });
                    }
                    cb(null, results);
                }
            );
            connection.release();
        }
    });
}

function executeQuery(query, cb) {
    connectionPool.getConnection(function (e, connection) {
        if (e) {
            return cb(e);
        } else {
            connection.query(query, function (err, results) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, results);
                }
            );
            connection.release();
        }
    });
}

function executeUpdateStatement(query, data, cb) {
    connectionPool.getConnection(function (e, connection) {
        if (e) {
            return cb(e);
        } else {
            connection.query(query, data, function (err) {
                    if (err) {
                        return cb(err);
                    }
                    cb(null);
                }
            );
            connection.release();
        }
    });
}

module.exports = {
    list: list,
    create: create,
    read: read,
    update: update,
    softdelete: _softdelete,
    delete: _delete,
    executeQuery: executeQuery,
    executeQueryStatement: executeQueryStatement,
    executeUpdateStatement: executeUpdateStatement
};
