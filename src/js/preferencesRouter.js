/*
Copyright 2015 OCAD University

Licensed under the New BSD license. You may not use this file except in
compliance with this License.

You may obtain a copy of the License at
https://github.com/fluid-project/first-discovery-server/raw/master/LICENSE.txt
*/

"use strict";

var fluid = require("infusion");
var gpii = fluid.registerNamespace("gpii");
var lo = require("lodash");
var $ = fluid.registerNamespace("jQuery");

require("kettle");
require("gpii-express");

/***********
 * Handler *
 ***********/



fluid.defaults("gpii.firstDiscovery.server.preferences.handler", {
    gradeNames: ["gpii.express.handler"],
    config: {},
    components: {
        accessTokenDataSource: {
            type: "kettle.dataSource.URL",
            options: {
                url: "{handler}.options.config.securityServer.hostname",
                port: "{handler}.options.config.securityServer.port",
                path: "{handler}.options.config.securityServer.paths.token",
                writable: true,
                writeMethod: "POST",
                components: {
                    encoding: {
                        type: "kettle.dataSource.encoding.formenc"
                    }
                },
                setResponseTransforms: [] // Do not parse the "set" response as formenc - it is in fact JSON
            }
        },
        preferencesDataSource: {
            type: "kettle.dataSource.URL",
            options: {
                url: "{handler}.options.config.securityServer.hostname",
                port: "{handler}.options.config.securityServer.port",
                path: "{handler}.options.config.securityServer.paths.preferences",
                writable: true,
                writeMethod: "POST",
                termMap: {
                    view: "%view"
                }
            }
        }
        // nfc: {
        //     type: "gpii.nfc"
        // }
    },
    invokers: {
        handleRequest: {
            funcName: "gpii.firstDiscovery.server.preferences.handler.storePrefs",
            args:     ["{that}"]
        },
        errorHandler: {
            funcName: "gpii.firstDiscovery.server.preferences.handler.errorHandler",
            args: ["{that}", "{arguments}.0", "{arguments}.1"]
        },
        writeNFCHandler: {
            funcName: "gpii.firstDiscovery.server.preferences.handler.writeNFCHandler",
            args: ["{that}", "{arguments}.0"]
        },
        successHandler: {
            func: "{that}.sendResponse",
            args: [200, "{arguments}.0"]
        },
        getAccessToken: {
            funcName: "gpii.firstDiscovery.server.preferences.handler.getAccessToken",
            args: ["{that}"]
        },
        createUser: {
            funcName: "gpii.firstDiscovery.server.preferences.handler.createUser",
            args: ["{that}", "{arguments}.0", "{arguments}.1", "{arguments}.2"]
        }
    },
    prefContext: {
        "contexts": {
            "gpii-default": {
                "name": "Default preferences",
                "preferences": {}
            }
        }
    }
});

/**
 * Handles error responses
 *
 * @param that {Object} - the component
 * @param error {Object} - the error information to return. If a statusCode property
 *                         is included it will be used for the response code.
 *                         Otherwise 500 will be used as the response code.
 */
gpii.firstDiscovery.server.preferences.handler.errorHandler = function (that, error, errorMsg) {
    var errorObj = $.extend(true, {}, error, {
        statusCode: error.statusCode || 500,
        message: errorMsg + ": " + error.message,
        isError: true
    });

    fluid.log(fluid.logLevel.WARN, errorObj);
    that.sendResponse(errorObj);
};

/**
 * Retrieves the access token from the security accessTokenDataSource
 *
 * @param that {Object} - the component
 *
 * @returns {promise} - returns a fluid.promise. On resolve it will return an
 *                      access object {access_token: "", token_type: ""}. On
 *                      reject an error object will be returned.
 */
gpii.firstDiscovery.server.preferences.handler.getAccessToken = function (that) {

    var promise = fluid.promise();
    var atPromise = that.accessTokenDataSource.set(null, that.options.config.authentication);

    atPromise.then(function (response) {
        var access = JSON.parse(response);
        promise.resolve(access);
    }, promise.reject);

    return promise;
};

/**
 * Creates a new user in the preferencesDataSource.
 *
 * @param that {Object} - the component
 * @param access {Object} - an access object of the form {access_token: "", token_type: ""}
 * @param prefs {Object} - the preferences to store
 * @param view {String} - the name of the view/ontology that the preferences should be stored in.
 *
 * @returns {promise} - returns a fluid.promise. On resolve it will return an
 *                      user object {userToken: "", preferences: {}}. On
 *                      reject an error object will be returned.
 */
gpii.firstDiscovery.server.preferences.handler.createUser = function (that, access, prefs, view) {
    var termMapping = {
        "gpii_firstDiscovery_speak": "http://registry.gpii.net/common/screenReaderTTSEnabled",
        "gpii_firstDiscovery_onScreenKeyboard": "http://registry.gpii.net/common/onScreenKeyboardEnabled"
    }

    lo.forEach(prefs, function(value, key) {
        console.log("Each: ", key, value);
        if (termMapping[key]) {
            // Apparently just the existence of screenReaderTTSEnabled turns on the
            // screenreader even if it's false
            if ((key === "gpii_firstDiscovery_speak" && value === false) ||
                (key === "gpii_firstDiscovery_onScreenKeyboard" && value === false)) {
                return true;
            }
            prefs[termMapping[key]] = value;
        }
    });

    console.log("Prefs: ");
    console.log(JSON.stringify(prefs, null, "  "));
    var toStore = fluid.copy(that.options.prefContext);
    fluid.set(toStore, ["contexts", "gpii-default", "preferences"], prefs);
    console.log("toStore: ");
    console.log(JSON.stringify(toStore, null, "  "));

    return that.preferencesDataSource.set({
        view: 'flat' // sgithens 2016-04-16 view
    }, toStore, {
        headers: {
            Authorization: access.token_type + " " + access.access_token
        }
    });
};

/**
 * Handles requests to store preferences. This requires a workflow that involves
 * retrieving an access token, which is used to create a new user with the preferences
 * sent in the request's body.
 *
 * @param that {Object} - the component
 */
gpii.firstDiscovery.server.preferences.handler.storePrefs = function (that) {
    var view = that.request.query.view || "";
    var body = that.request.body || {};

    var accessTokenPromise = that.getAccessToken();

    accessTokenPromise.then(function (access) {
        var storePromise = that.createUser(access, body, view);
        storePromise.then(that.writeNFCHandler, function (error) {
            that.errorHandler(error, "Failed to store Preferences");
        });
    }, function (error) {
        that.errorHandler(error, "Failed to retrieve access token");
    });
};

gpii.firstDiscovery.server.preferences.handler.writeNFCHandler = function (that, data) {
    console.log("sgithens writeNFCHandler 3 : ", data);
    gpii.nfc.writePlainTextTag(data["userToken"]);
    return that.successHandler(data);
};

/**********
 * Router *
 **********/

fluid.defaults("gpii.firstDiscovery.server.preferences.router", {
    gradeNames: ["gpii.express.contentAware.router"],
    method: "post",
    handlers: {
        json: {
            contentType:  "application/json",
            handlerGrades: ["gpii.firstDiscovery.server.preferences.handler"]
        }
    }
});
