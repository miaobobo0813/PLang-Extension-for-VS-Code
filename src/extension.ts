import * as vscode from 'vscode';
import { PLangCompletionProvider, activateCompletionProvider } from './completionProvider';

export function activate(context: vscode.ExtensionContext) {
    console.log('PLang extension has activated.');

    activateCompletionProvider(context);
}

export function deactivate() {}