'use strict';

const moment = require('moment');
const tcadif = require('tcadif');

class Op {

    #op_id;
    #callsign;
    #name;

    constructor(data = {}) {
        this.#op_id = data?.op_id;
        this.#callsign = data?.callsign ?? '';
        this.#name = data?.name ?? '';
    }

    toRender() {
        return {
            op_id: this.#op_id,
            callsign: this.#callsign,
            name: this.#name,
        };
    }

    toEdit() {
        return {
            op_id: this.#op_id,
            callsign: this.#callsign,
            name: this.#name,
        };
    }

    toJSON() {
        return {
            op_id: this.#op_id,
            callsign: this.#callsign,
            name: this.#name,
        };
    }

    toDBO() {
        return {
            op_id: this.#op_id,
            callsign: this.#callsign,
            name: this.#name,
        };
    }

    static fromDBO(dbo) {
        return new Op({
            op_id: dbo.op_id,
            callsign: dbo.callsign,
            name: dbo.name,
        });
    }

    toAO() {
        return {
            op_id: this.#op_id,
            callsign: this.#callsign,
            name: this.#name,
        };
    }

    static fromAO(ao) {
        return new Op({
            op_id: ao.op_id,
            callsign: ao.callsign,
            name: ao.name,
        });
    }

}

module.exports = Op;
