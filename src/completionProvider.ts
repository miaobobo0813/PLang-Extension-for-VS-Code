import * as vscode from 'vscode';

export class PLangCompletionProvider implements vscode.CompletionItemProvider {
    
    provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        context: vscode.CompletionContext
    ): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {
        if (this.isInTipsComment(document, position)) {
            return undefined;
        }
        
        const lineText = document.lineAt(position.line).text;
        const currentChar = lineText[position.character - 1];
        
        const completions = this.getContextualCompletions(document, position, lineText);
        
        return completions;
    }
    
    private isInTipsComment(document: vscode.TextDocument, position: vscode.Position): boolean {
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
            } else if (lineText[i] === ')') {
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
        
        const textBefore = document.getText(new vscode.Range(
            new vscode.Position(0, 0),
            position
        ));
        
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

    private getContextualCompletions(
        document: vscode.TextDocument,
        position: vscode.Position,
        lineText: string
    ): vscode.CompletionItem[] {
        
        const textBeforeCursor = lineText.substring(0, position.character);
        const completions: vscode.CompletionItem[] = [];
        
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

    private shouldShowKeywords(textBeforeCursor: string): boolean {
        return /^\s*$/.test(textBeforeCursor) || 
               /^\s*\w*$/.test(textBeforeCursor);
    }
    
    private getKeywordCompletions(): vscode.CompletionItem[] {
        const keywords = ['using', 'loop', 'vars', 'ter'];
        
        return keywords.map(keyword => {
            const item = new vscode.CompletionItem(keyword, vscode.CompletionItemKind.Keyword);
            item.insertText = keyword;
            item.detail = 'PLang keyword';
            item.documentation = this.getKeywordDoc(keyword);
            return item;
        });
    }
    
    private shouldShowModifiers(textBeforeCursor: string): boolean {
        return /\.\w*$/.test(textBeforeCursor);
    }
    
    private getModifierCompletions(): vscode.CompletionItem[] {
        const modifiersByKeyword: { [key: string]: string[] } = {
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
            item.detail = 'PLang modifier';
            return item;
        });
    }
    
    private getVariablesInDocument(document: vscode.TextDocument): string[] {
        const text = document.getText();
        const variables: string[] = [];
        
        const varPattern = /vars\.new\((\w+),/g;
        let match;
        
        while ((match = varPattern.exec(text)) !== null) {
            variables.push(match[1]);
        }
        
        return [...new Set(variables)];
    }
    
    private getVariableCompletions(variables: string[]): vscode.CompletionItem[] {
        return variables.map(varName => {
            const item = new vscode.CompletionItem(varName, vscode.CompletionItemKind.Variable);
            item.insertText = varName;
            item.detail = 'Variable';
            return item;
        });
    }
    
    private shouldShowOperators(textBeforeCursor: string): boolean {
        return /[(\s=]\w*$/.test(textBeforeCursor);
    }
    
    private getOperatorCompletions(): vscode.CompletionItem[] {
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
            { label: '>', detail: 'Greater than', insertText: '>' },
            { label: '</=', detail: 'Less than or equal to', insertText: '</=' },
            { label: '>/=', detail: 'Greater than or equal to', insertText: '>/=' }
        ];
        
        return operators.map(op => {
            const item = new vscode.CompletionItem(op.label, vscode.CompletionItemKind.Operator);
            item.insertText = op.insertText;
            item.detail = op.detail;
            return item;
        });
    }
    
    private getTypeCompletions(): vscode.CompletionItem[] {
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

    private getSpecialContextCompletions(textBeforeCursor: string): vscode.CompletionItem[] {
        const completions: vscode.CompletionItem[] = [];
        
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
    
    private getKeywordDoc(keyword: string): vscode.MarkdownString {
        const docs: { [key: string]: string } = {
            'loop': 'Loop control\n\nModifiers: while, for, stop, skip, when, codes, range',
            'vars': 'Variable control\n\nModifiers: new, modify',
            'ter': 'Terminal control\n\nModifiers: otpt (output)'
        };
        
        return new vscode.MarkdownString(docs[keyword] || 'PLang keyword');
    }
}

export function activateCompletionProvider(context: vscode.ExtensionContext) {
    const provider = new PLangCompletionProvider();
    
    const triggerCharacters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_.';
    
    const disposable = vscode.languages.registerCompletionItemProvider(
        'plang',
        provider,
        ...triggerCharacters.split('')
    );
    
    context.subscriptions.push(disposable);
}