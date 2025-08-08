"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VftTransfer = void 0;
const typeorm_1 = require("typeorm");
const typeorm_store_1 = require("@subsquid/typeorm-store");
let VftTransfer = class VftTransfer {
    constructor(props) {
        Object.assign(this, props);
    }
    id;
    blockNumber;
    timestamp;
    extrinsicHash;
    from;
    to;
    amount;
    fee;
};
exports.VftTransfer = VftTransfer;
__decorate([
    (0, typeorm_1.PrimaryColumn)(),
    __metadata("design:type", String)
], VftTransfer.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)("bigint", { name: "block_number" }),
    __metadata("design:type", BigInt)
], VftTransfer.prototype, "blockNumber", void 0);
__decorate([
    (0, typeorm_1.Column)("timestamp", { name: "timestamp" }),
    __metadata("design:type", Date)
], VftTransfer.prototype, "timestamp", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "extrinsic_hash", nullable: true }),
    __metadata("design:type", String)
], VftTransfer.prototype, "extrinsicHash", void 0);
__decorate([
    (0, typeorm_store_1.StringColumn)({ name: "from" }),
    __metadata("design:type", String)
], VftTransfer.prototype, "from", void 0);
__decorate([
    (0, typeorm_store_1.StringColumn)({ name: "to" }),
    __metadata("design:type", String)
], VftTransfer.prototype, "to", void 0);
__decorate([
    (0, typeorm_1.Column)("bigint"),
    __metadata("design:type", BigInt)
], VftTransfer.prototype, "amount", void 0);
__decorate([
    (0, typeorm_1.Column)("bigint"),
    __metadata("design:type", BigInt)
], VftTransfer.prototype, "fee", void 0);
exports.VftTransfer = VftTransfer = __decorate([
    (0, typeorm_1.Entity)({ name: "vft_transfer" }),
    __metadata("design:paramtypes", [Object])
], VftTransfer);
