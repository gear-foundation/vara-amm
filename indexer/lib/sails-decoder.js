"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SailsDecoder = void 0;
const util_internal_hex_1 = require("@subsquid/util-internal-hex");
const node_fs_1 = require("node:fs");
const sails_js_1 = require("sails-js");
const sails_js_parser_1 = require("sails-js-parser");
class SailsDecoder {
    _program;
    constructor(_program) {
        this._program = _program;
    }
    static async new(idlPath) {
        if (!(0, node_fs_1.existsSync)(idlPath)) {
            throw new Error(`File ${idlPath} does not exist`);
        }
        const idlcontent = (0, node_fs_1.readFileSync)(idlPath, "utf8");
        const parser = await sails_js_parser_1.SailsIdlParser.new();
        const sails = new sails_js_1.Sails(parser);
        sails.parseIdl(idlcontent);
        return new SailsDecoder(sails);
    }
    service(data) {
        if (!(0, util_internal_hex_1.isHex)(data)) {
            throw new Error(`Invalid hex string: ${data}`);
        }
        return (0, sails_js_1.getServiceNamePrefix)(data);
    }
    method(data) {
        if (!(0, util_internal_hex_1.isHex)(data)) {
            throw new Error(`Invalid hex string: ${data}`);
        }
        return (0, sails_js_1.getFnNamePrefix)(data);
    }
    decodeInput({ call: { args: { payload }, }, }) {
        const service = this.service(payload);
        const method = this.method(payload);
        const params = this._program.services[service].functions[method].decodePayload(payload);
        return {
            service,
            method,
            params,
        };
    }
    decodeOutput({ args: { message: { payload }, }, }) {
        const service = this.service(payload);
        const method = this.method(payload);
        const _payload = this._program.services[service].functions[method].decodeResult(payload);
        return {
            service,
            method,
            payload: _payload,
        };
    }
    decodeEvent({ args: { message: { payload }, }, }) {
        const service = this.service(payload);
        const method = this.method(payload);
        const _payload = this._program.services[service].events[method].decode(payload);
        return {
            service,
            method,
            payload: _payload,
        };
    }
    encodeQueryInput(service, fn, data) {
        return this._program.services[service].queries[fn].encodePayload(...data);
    }
    decodeQueryOutput(service, fn, data) {
        return this._program.services[service].queries[fn].decodeResult(data);
    }
}
exports.SailsDecoder = SailsDecoder;
