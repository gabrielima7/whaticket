"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.index = void 0;
const index = async (req, res) => {
    return res.status(200).json({
        version: "10.0.2"
    });
};
exports.index = index;
