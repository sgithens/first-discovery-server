/*
Copyright 2015 OCAD University

Licensed under the New BSD license. You may not use this file except in
compliance with this License.

You may obtain a copy of the License at
https://raw.githubusercontent.com/GPII/first-discovery-server/master/LICENSE.txt
*/

"use strict";

var fluid = require("infusion");

require("gpii-express");
require("./nfcUtils.js");
require("./preferencesRouter.js");
require("./configUtils.js");

var path = require("path");
var fdDemosDir = path.resolve(__dirname, "../../node_modules/gpii-first-discovery/demos");
var fdSrcDir = path.resolve(__dirname, "../../node_modules/gpii-first-discovery/src");

fluid.defaults("gpii.firstDiscovery.server", {
    gradeNames: ["gpii.express"],
    port: 8088,
    config: {
        express: {
            baseUrl: {
                expander: {
                    funcName: "fluid.stringTemplate",
                    args: ["http://localhost:%port", {port: "{that}.options.config.express.port"}]
                }
            }
        }
    },
    preferencesConfig: {},
    components: {
        json: {
            type: "gpii.express.middleware.bodyparser.json"
        },
        demoRouter: {
            type: "gpii.express.router.static",
            options: {
                path:    "/demos",
                content: fdDemosDir
            }
        },
        srcRouter: {
            type: "gpii.express.router.static",
            options: {
                path:    "/src",
                content: fdSrcDir
            }
        },
        prefsRouter: {
            type: "gpii.firstDiscovery.server.preferences.router",
            options: {
                path: "/user"
            }
        }
    },
    distributeOptions: [{
        source: "{that}.options.port",
        target: "{that}.options.config.express.port"
    }, {
        source: "{that}.options.preferencesConfig",
        target: "{that gpii.firstDiscovery.server.preferences.handler}.options.config"
    }]
});

fluid.defaults("gpii.firstDiscovery.server.configurator", {
    gradeNames: ["gpii.schema"],
    "components": {
        "fdServer": {
            "type": "gpii.firstDiscovery.server",
            "createOnEvent": "validated"
        }
    },
    "distributeOptions": [{
        "source": "{that}.options.port",
        "target": "{that fdServer}.options.port"
    }, {
        "source": "{that}.options.preferencesConfig",
        "target": "{that fdServer}.options.preferencesConfig"
    }],
    "schema": {
        "required": ["port", "preferencesConfig"],
        "properties": {
            "preferencesConfig": {
                "required": ["securityServer", "authentication"],
                "properties": {
                    "securityServer": {
                        "required": ["port", "hostname", "paths"],
                        "properties": {
                            "port": {"type": "string"},
                            "hostname": {"type": "string"},
                            "paths": {
                                "required": ["token", "preferences"],
                                "properties": {
                                    "token": {"type": "string"},
                                    "preferences": {"type": "string"}
                                }
                            }
                        }
                    },
                    "authentication": {
                        "required": ["grant_type", "scope", "client_id", "client_secret"],
                        "properties": {
                            "grant_type": {"type": "string"},
                            "scope": {"type": "string"},
                            "client_id": {"type": "string"},
                            "client_secret": {"type": "string"}
                        }
                    }
                }
            }
        }
    }
});
