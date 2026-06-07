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
exports.PLangCompletionProvider = void 0;
exports.activateCompletionProvider = activateCompletionProvider;
const vscode = __importStar(require("vscode"));
class PLangCompletionProvider {
    provideCompletionItems(document, position, token, context) {
        if (this.isInTipsComment(document, position)) {
            return undefined;
        }
        const lineText = document.lineAt(position.line).text;
        const currentChar = lineText[position.character - 1];
        const completions = this.getContextualCompletions(document, position, lineText);
        return completions;
    }
    isInTipsComment(document, position) {
        const line = position.line;
        const lineText = document.lineAt(line).text;
        const charPos = position.character;
        const tipsStart = lineText.indexOf('using.tips(');
        if (tipsStart === -1) {
            return false;
        }
        let parenCount = 0;
        let tipsEnd = -1;
        let foundStart = false;
        for (let i = tipsStart; i < lineText.length; i++) {
            if (lineText[i] === '(') {
                parenCount++;
                foundStart = true;
            }
            else if (lineText[i] === ')') {
                parenCount--;
                if (foundStart && parenCount === 0) {
                    tipsEnd = i;
                    break;
                }
            }
        }
        if (tipsEnd !== -1 && charPos > tipsStart + 11 && charPos < tipsEnd) {
            return true;
        }
        const textBefore = document.getText(new vscode.Range(new vscode.Position(0, 0), position));
        const lastTipsStart = textBefore.lastIndexOf('using.tips(');
        if (lastTipsStart !== -1) {
            const afterLastTips = textBefore.substring(lastTipsStart);
            const parenCount2 = (afterLastTips.match(/\(/g) || []).length;
            const closeCount = (afterLastTips.match(/\)/g) || []).length;
            if (parenCount2 > closeCount) {
                return true;
            }
        }
        return false;
    }
    getContextualCompletions(document, position, lineText) {
        const textBeforeCursor = lineText.substring(0, position.character);
        const completions = [];
        if (this.shouldShowKeywords(textBeforeCursor)) {
            completions.push(...this.getKeywordCompletions());
        }
        if (this.shouldShowModifiers(textBeforeCursor)) {
            completions.push(...this.getModifierCompletions());
        }
        const variables = this.getVariablesInDocument(document);
        completions.push(...this.getVariableCompletions(variables));
        if (this.shouldShowOperators(textBeforeCursor)) {
            completions.push(...this.getOperatorCompletions());
        }
        completions.push(...this.getTypeCompletions());
        completions.push(...this.getSpecialContextCompletions(textBeforeCursor));
        return completions;
    }
    shouldShowKeywords(textBeforeCursor) {
        return /^\s*$/.test(textBeforeCursor) ||
            /^\s*\w*$/.test(textBeforeCursor);
    }
    getKeywordCompletions() {
        const keywords = ['using', 'loop', 'vars', 'ter'];
        return keywords.map(keyword => {
            const item = new vscode.CompletionItem(keyword, vscode.CompletionItemKind.Keyword);
            item.insertText = keyword;
            item.detail = 'PLang Keywords';
            item.documentation = this.getKeywordDoc(keyword);
            return item;
        });
    }
    shouldShowModifiers(textBeforeCursor) {
        return /\.\w*$/.test(textBeforeCursor);
    }
    getModifierCompletions() {
        const modifiersByKeyword = {
            'using': ['use', 'tips', 'sub'],
            'vars': ['new', 'modify'],
            'ter': ['otpt', 'inpt'],
            'loop': ['while', 'for', 'stop', 'skip', 'when', 'codes', 'range']
        };
        const allModifiers = ['use', 'tips', 'sub', 'new', 'modify', 'otpt', 'inpt',
            'while', 'for', 'stop', 'skip', 'when', 'codes', 'range'];
        return allModifiers.map(modifier => {
            const item = new vscode.CompletionItem(modifier, vscode.CompletionItemKind.Method);
            item.insertText = modifier;
            item.detail = 'PLang 修饰符';
            return item;
        });
    }
    getVariablesInDocument(document) {
        const text = document.getText();
        const variables = [];
        const varPattern = /vars\.new\((\w+),/g;
        let match;
        while ((match = varPattern.exec(text)) !== null) {
            variables.push(match[1]);
        }
        return [...new Set(variables)];
    }
    getVariableCompletions(variables) {
        return variables.map(varName => {
            const item = new vscode.CompletionItem(varName, vscode.CompletionItemKind.Variable);
            item.insertText = varName;
            item.detail = 'Variable';
            return item;
        });
    }
    shouldShowOperators(textBeforeCursor) {
        return /[(\s=]\w*$/.test(textBeforeCursor);
    }
    getOperatorCompletions() {
        const operators = [
            { label: '+', detail: 'Plus', insertText: '+' },
            { label: '-', detail: 'Subtranction', insertText: '-' },
            { label: '*', detail: 'Times', insertText: '*' },
            { label: '`', detail: 'Division', insertText: '`' },
            { label: '%', detail: 'Mod', insertText: '%' },
            { label: '/', detail: 'Or', insertText: '/' },
            { label: '&', detail: 'And', insertText: '&' },
            { label: '=', detail: 'Equal to', insertText: '=' },
            { label: '~', detail: 'Not', insertText: '~' },
            { label: '<', detail: 'Less than', insertText: '<' },
            { label: '>', detail: 'Bigger than', insertText: '>' },
            { label: '</=', detail: 'Less than or equal to', insertText: '</=' },
            { label: '>/=', detail: 'Bigger than or equal to', insertText: '>/=' }
        ];
        return operators.map(op => {
            const item = new vscode.CompletionItem(op.label, vscode.CompletionItemKind.Operator);
            item.insertText = op.insertText;
            item.detail = op.detail;
            return item;
        });
    }
    /**
     * 获取类型补全
     */
    getTypeCompletions() {
        const types = [
            { name: 'number', detail: 'Integer' },
            { name: 'dotNum', detail: 'Float' },
            { name: 'text', detail: 'Text' },
            { name: 'boolean', detail: 'Boolean' },
            { name: 'yes', detail: 'Boolean value true' },
            { name: 'no', detail: 'Boolean value false' }
        ];
        return types.map(type => {
            const item = new vscode.CompletionItem(type.name, vscode.CompletionItemKind.TypeParameter);
            item.insertText = type.name;
            item.detail = type.detail;
            return item;
        });
    }
    getSpecialContextCompletions(textBeforeCursor) {
        const completions = [];
        if (/loop\.(while|for)\./.test(textBeforeCursor) &&
            !textBeforeCursor.includes('codes')) {
            const item = new vscode.CompletionItem('codes', vscode.CompletionItemKind.Method);
            item.insertText = new vscode.SnippetString('codes({\n\t$0\n})');
            item.detail = 'Code block';
            completions.push(item);
        }
        if (/loop\.while$/.test(textBeforeCursor) &&
            !textBeforeCursor.includes('when')) {
            const item = new vscode.CompletionItem('when', vscode.CompletionItemKind.Method);
            item.insertText = new vscode.SnippetString('when(${1:condition})');
            item.detail = 'Condition of while';
            completions.push(item);
        }
        return completions;
    }
    getKeywordDoc(keyword) {
        const docs = {
            'loop': 'Loop control\n\nModifiers: while, for, stop, skip, when, codes, range',
            'vars': 'Variable control\n\nModifiers: new, modify',
            'ter': 'Terminal control\n\nModifiers: otpt (output)'
        };
        return new vscode.MarkdownString(docs[keyword] || 'PLang keywords');
    }
}
exports.PLangCompletionProvider = PLangCompletionProvider;
function activateCompletionProvider(context) {
    const provider = new PLangCompletionProvider();
    const triggerCharacters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_.';
    const disposable = vscode.languages.registerCompletionItemProvider('plang', provider, ...triggerCharacters.split(''));
    context.subscriptions.push(disposable);
}
//# sourceMappingURL=completionProvider.js.map