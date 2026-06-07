"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const completionProvider_1 = require("./completionProvider");
function activate(context) {
    console.log('PLang extension has activated.');
    (0, completionProvider_1.activateCompletionProvider)(context);
}
function deactivate() { }
//# sourceMappingURL=extension.js.map