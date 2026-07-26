import * as vscode from 'vscode';
import { activateCompletionProvider, activateGrammarProvider } from './completionProvider';



export function activate(context: vscode.ExtensionContext) {
    console.log('PLang extension has activated.');

    activateGrammarProvider(context);

    activateCompletionProvider(context);
}

export function deactivate() {}