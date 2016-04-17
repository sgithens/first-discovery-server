"use strict";

var pcsclib = require('pcsclite');
var ndef = require('ndef');
var fluid = require("infusion");
var gpii = fluid.registerNamespace("gpii");

fluid.defaults("gpii.nfc", {
    gradeNames: ["littleComponent", "autoInit"],
    invokers: {
        writePlainTextTag: {
            funcName: "gpii.nfc.writePlainTextTag",
            args: ["{that}", "{arguments}.0"]
        }
    }
});

gpii.nfc.writePlainTextTag = function(plainTextMsg) {
    console.log("Really quick test: ", plainTextMsg);

    var write_tag_data = function(reader, protocol, byteData, cb) {
        var writeCommand = function(block, data) {
            var buf = [0xFF, 0xD6, 0x00, block, 0x04];
            return buf.concat(data);
        }
        var writeBlocks = function(blockNum, bytes) {
            var toWrite = bytes;
            var finished = false;
            if (bytes.length < 4) {
                toWrite.push(0xfe);
                while (toWrite.length < 4) {
                    toWrite.push(0x00);
                }
                finished = true;
            }
            reader.transmit(new Buffer(writeCommand(blockNum, toWrite)), 40, protocol, function(err, data) {
                if (err) {
                    console.log("Error writing tag block: ", err);
                }
                if (finished) {
                    return cb();
                }
                else {
                    return writeBlocks(blockNum+1, byteData.splice(0,4));
                }
            });
        };
        writeBlocks(4, byteData.splice(0,4));
    }

    var pcsc = pcsclib();
    pcsc.on('reader', function(reader) {

        console.log('New reader detected', reader.name);

        reader.on('error', function(err) {
            console.log('Error(', this.name, '):', err.message);
        });

        reader.on('status', function(status) {
            console.log('Status(', this.name, '):', status);
            /* check what has changed */
            var changes = this.state ^ status.state;
            if (changes) {
                if ((changes & this.SCARD_STATE_EMPTY) && (status.state & this.SCARD_STATE_EMPTY)) {
                    console.log("card removed");/* card removed */
                    reader.disconnect(reader.SCARD_LEAVE_CARD, function(err) {
                        if (err) {
                            console.log(err);
                        } else {
                            console.log('Disconnected');
                        }
                    });
                } else if ((changes & this.SCARD_STATE_PRESENT) && (status.state & this.SCARD_STATE_PRESENT)) {
                    console.log("card inserted");/* card inserted */
                    reader.connect({ share_mode : this.SCARD_SHARE_SHARED }, function(err, protocol) {
                        if (err) {
                            console.log(err);
                        } else {
                            console.log('Protocol(', reader.name, '):', protocol);
                            console.log("\n\n\n");
                            console.log("Going to write...\n\n");
                            var msg = [
                                ndef.textRecord(plainTextMsg)
                            ]
                            var ndefBytes = ndef.encodeMessage(msg);
                            console.log("Lenght of the bytes!!!: ", ndefBytes.length);
                            var msgBytes = [0x01, 0x03, 0xA0, 0x0C, 0x34, 0x03, ndefBytes.length].concat(ndefBytes);
                            console.log(msgBytes.toString());
                            write_tag_data(reader, protocol, msgBytes, function() {
                                console.log("Totally wrote it");
                            });
                            reader.transmit(new Buffer([0x00, 0xB0, 0x00, 0x00, 0x20]), 40, protocol, function(err, data) {
                                if (err) {
                                    console.log(err);
                                } else {
                                    console.log('Data received', data);
                                    reader.close();
                                    pcsc.close();
                                }
                            });
                        }
                    });
                }
            }
        });

        reader.on('end', function() {
            console.log('Reader',  this.name, 'removed');
        });
    });

    pcsc.on('error', function(err) {
        console.log('PCSC error', err.message);
    });
};
