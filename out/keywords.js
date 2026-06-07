"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.CONSTANTS = exports.TYPES = exports.MODIFIER_PARAMS = exports.MODIFIERS = exports.KEYWORDS = void 0;
const vscode = __importStar(require("vscode"));
exports.KEYWORDS = [
    { name: 'using', kind: vscode.CompletionItemKind.Keyword, detail: 'Import or replace code' },
    { name: 'vars', kind: vscode.CompletionItemKind.Keyword, detail: 'Variable operations' },
    { name: 'ter', kind: vscode.CompletionItemKind.Keyword, detail: 'Terminal input/output' },
    { name: 'loop', kind: vscode.CompletionItemKind.Keyword, detail: 'Loop control' },
    { name: 'operators', kind: vscode.CompletionItemKind.Keyword, detail: 'Operators' }
];
exports.MODIFIERS = {
    'using': ['tips'],
    'vars': ['new', 'modify'],
    'ter': ['otpt'],
    'loop': ['while', 'for', 'stop', 'skip', 'when', 'codes', 'range'],
    'operators': ['+', '-', '*', '`', '%', '/', '&', '=', '~', '<', '>', '</=', '>/=']
};
exports.MODIFIER_PARAMS = {
    'using.tips': { params: ['text'], snippet: 'tips("${1:text}");' },
    'vars.new': { params: ['name', 'type', 'value'], snippet: 'new(${1:name}, ${2:type}, ${3:value});' },
    'vars.modify': { params: ['value'], snippet: '.modify(${1:value});' },
    'ter.otpt': { params: ['text'], snippet: 'otpt("${1:text}");' },
    'loop.while': { params: ['condition', 'codeBlock'], snippet: 'while.when(${1:condition}).codes({${2}});' },
    'loop.for': { params: ['from', 'to', 'in', 'codeBlock'], snippet: 'for.range(${1:1}, ${2:10}, ${3:vars.new(i, number, 1)}).codes({${4}});' },
    'loop.while.when': { params: ['condition'], snippet: 'when(${1:condition})' },
    'loop.while.codes': { params: ['codeBlock'], snippet: 'codes({${1}})' },
    'loop.for.codes': { params: ['codeBlock'], snippet: 'codes({${1}})' },
    'loop.for.range': { params: ['from', 'to', 'in'], snippet: 'range(${1:1}, ${2:10}, ${3:vars.new(i, number, 1)})' }
};
exports.TYPES = [
    { name: 'number', kind: vscode.CompletionItemKind.TypeParameter, detail: 'Integer type' },
    { name: 'dotNum', kind: vscode.CompletionItemKind.TypeParameter, detail: 'Float/Double type' },
    { name: 'text', kind: vscode.CompletionItemKind.TypeParameter, detail: 'String type' },
    { name: 'boolean', kind: vscode.CompletionItemKind.TypeParameter, detail: 'Boolean type (yes/no)' }
];
exports.CONSTANTS = [
    { name: 'yes', kind: vscode.CompletionItemKind.Constant, detail: 'Boolean true' },
    { name: 'no', kind: vscode.CompletionItemKind.Constant, detail: 'Boolean false' }
];
//# sourceMappingURL=keywords.js.map