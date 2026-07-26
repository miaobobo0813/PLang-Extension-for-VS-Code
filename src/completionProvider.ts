import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { execFile } from 'child_process';

const variableCache = new Map<string, { version: number; variables: string[] }>();
let cachedPlangExecutable: string | null | undefined = undefined;

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
        const allModifiers: [string, string, string][] = [
            ['tips', 'tips($0);', 'Comment'],
            ['new', 'new(${1:name}, ${2:type}, ${3:value})', 'New variable'], 
            ['modify', 'modify(${0:newValue})', 'Modify variable'], 
            ['otpt', 'otpt(${0:text})', 'Output'], 
            ['inpt', 'inpt(${0:variable})', 'Input'], 
            ['while', 'while', 'While loop'], 
            ['for', 'for', 'For loop'], 
            ['stop', 'stop();', 'Break the loop'], 
            ['skip', 'skip();', 'Skip the loop'], 
            ['if', 'if', 'If loop'], 
            ['codes', 'codes({\n\t$0\n})', 'Code block'], 
            ['when', 'when(${1:condition})', 'Condition'],
            ['range', 'range(${1:from}, ${2:to}, ${3:variable})', 'Range of for'], 
            ['else', 'else({\n\t$0\n})', 'Code block when condition is false']
        ];
        
        return allModifiers.map(modifier => {
            const item = new vscode.CompletionItem(modifier[0], vscode.CompletionItemKind.Method);
            item.insertText = new vscode.SnippetString(modifier[1]);
            item.detail = modifier[2];
            return item;
        });
    }
    
    private getVariablesInDocument(document: vscode.TextDocument): string[] {
        const key = document.uri.toString();
        const cache = variableCache.get(key);
        if (cache?.version === document.version) {
            return cache.variables;
        }

        const text = document.getText();
        const variables: string[] = [];
        const varPattern = /vars\.new\((\w+),/g;
        let match;

        while ((match = varPattern.exec(text)) !== null) {
            variables.push(match[1]);
        }

        const uniqueVariables = [...new Set(variables)];
        variableCache.set(key, { version: document.version, variables: uniqueVariables });
        return uniqueVariables;
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
    
    private getKeywordDoc(keyword: string): vscode.MarkdownString {
        const docs: { [key: string]: string } = {
            'loop': 'Loop control\n\nModifiers: while, for, stop, skip, when, codes, range',
            'vars': 'Variable control\n\nModifiers: new, modify',
            'ter': 'Terminal control\n\nModifiers: otpt (output), inpt (input)'
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


let diagnosticCollection: vscode.DiagnosticCollection;
const timeoutMap = new Map<string, NodeJS.Timeout>();
const validationRequests = new Map<string, number>();
const activeProcesses = new Map<string, ReturnType<typeof execFile>>();
const VALIDATION_DEBOUNCE_MS = 300;
const VALIDATION_TIMEOUT_MS = 4000;

export function activateGrammarProvider(context: vscode.ExtensionContext) {
    diagnosticCollection = vscode.languages.createDiagnosticCollection('plang');
    context.subscriptions.push(diagnosticCollection);

    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument((event) => {
            const doc = event.document;
            if (doc.languageId !== 'plang') return;

            scheduleValidation(doc);
        })
    );

    context.subscriptions.push(
        vscode.workspace.onDidSaveTextDocument((document) => {
            if (document.languageId !== 'plang') return;

            runValidationNow(document);
        })
    );

    context.subscriptions.push(
        vscode.workspace.onDidOpenTextDocument((document) => {
            if (document.languageId === 'plang') {
                runValidationNow(document);
            }
        })
    );

    context.subscriptions.push(
        vscode.workspace.onDidCloseTextDocument((document) => {
            if (document.languageId === 'plang') {
                diagnosticCollection.delete(document.uri);
                cancelValidation(document.uri.toString());
                variableCache.delete(document.uri.toString());
            }
        })
    );
}

function scheduleValidation(document: vscode.TextDocument) {
    const key = document.uri.toString();
    const existingTimeout = timeoutMap.get(key);
    if (existingTimeout) {
        clearTimeout(existingTimeout);
    }

    timeoutMap.set(key, setTimeout(() => {
        timeoutMap.delete(key);
        void runValidationForDocument(document, key);
    }, VALIDATION_DEBOUNCE_MS));
}

function runValidationNow(document: vscode.TextDocument) {
    const key = document.uri.toString();
    const existingTimeout = timeoutMap.get(key);
    if (existingTimeout) {
        clearTimeout(existingTimeout);
        timeoutMap.delete(key);
    }

    void runValidationForDocument(document, key);
}

function cancelValidation(key: string) {
    const timeout = timeoutMap.get(key);
    if (timeout) {
        clearTimeout(timeout);
        timeoutMap.delete(key);
    }

    const activeProcess = activeProcesses.get(key);
    if (activeProcess) {
        activeProcess.kill();
        activeProcesses.delete(key);
    }

    validationRequests.delete(key);
}

async function runValidationForDocument(document: vscode.TextDocument, key: string) {
    const requestId = (validationRequests.get(key) ?? 0) + 1;
    validationRequests.set(key, requestId);

    const existingProcess = activeProcesses.get(key);
    if (existingProcess) {
        existingProcess.kill();
        activeProcesses.delete(key);
    }

    try {
        const diagnostics = await validateDocument(document, requestId, key);
        if (requestId !== (validationRequests.get(key) ?? 0)) {
            return;
        }

        diagnosticCollection.set(document.uri, diagnostics);
    } catch (error) {
        if (requestId === (validationRequests.get(key) ?? 0)) {
            diagnosticCollection.set(document.uri, []);
        }
    }
}

async function getVSCodeDir(document: vscode.TextDocument): Promise<string | null> {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
    if (!workspaceFolder) return null;

    const vscodeDir = path.join(workspaceFolder.uri.fsPath, '.vscode');
    await fs.promises.mkdir(vscodeDir, { recursive: true });
    return vscodeDir;
}

async function getTempFilePath(document: vscode.TextDocument): Promise<string | null> {
    const vscodeDir = await getVSCodeDir(document);
    if (!vscodeDir) return null;

    const originalName = path.basename(document.uri.fsPath, '.plang');
    return path.join(vscodeDir, `_forGrammarCheckFile_${originalName}.plang`);
}

function getExecutableCandidates(): string[] {
    const candidates = new Set<string>();

    if (process.env.PLANG_PATH) {
        candidates.add(process.env.PLANG_PATH);
    }

    const pathValue = process.env.PATH || '';
    for (const entry of pathValue.split(path.delimiter)) {
        if (!entry) continue;
        candidates.add(path.join(entry, 'plang'));
        candidates.add(path.join(entry, 'plang.exe'));
        candidates.add(path.join(entry, 'plang.bat'));
        candidates.add(path.join(entry, 'plang.cmd'));
    }

    if (process.platform === 'win32') {
        const knownLocations = [
            'C:\\PLang\\plang.bat',
            path.join(process.env.USERPROFILE || '', 'AppData', 'Local', 'Programs', 'PLang', 'plang.bat'),
            path.join(process.env.LOCALAPPDATA || '', 'Programs', 'PLang', 'plang.bat'),
            path.join(process.env.ProgramFiles || '', 'PLang', 'plang.bat'),
            path.join(process.env['ProgramFiles(x86)'] || '', 'PLang', 'plang.bat')
        ];

        for (const location of knownLocations) {
            candidates.add(location);
        }
    }

    return Array.from(candidates);
}

async function resolvePlangExecutable(): Promise<string | null> {
    if (cachedPlangExecutable !== undefined) {
        if (cachedPlangExecutable && fs.existsSync(cachedPlangExecutable)) {
            return cachedPlangExecutable;
        }
        cachedPlangExecutable = null;
    }

    for (const candidate of getExecutableCandidates()) {
        if (!candidate) continue;
        if (fs.existsSync(candidate)) {
            cachedPlangExecutable = candidate;
            return candidate;
        }
    }

    if (process.platform === 'win32') {
        const { stdout } = await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
            execFile('where.exe', ['plang'], { windowsHide: true }, (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                    return;
                }

                resolve({ stdout, stderr });
            });
        }).catch(() => ({ stdout: '', stderr: '' }));

        const resolved = stdout.split(/\r?\n/).map(line => line.trim()).find(Boolean);
        if (resolved && fs.existsSync(resolved)) {
            cachedPlangExecutable = resolved;
            return resolved;
        }
    }

    cachedPlangExecutable = null;
    return null;
}

async function runPlangValidation(tempFile: string, key: string): Promise<{ stdout: string; stderr: string }> {
    const plangExecutable = await resolvePlangExecutable();
    if (!plangExecutable) {
        throw new Error('PLang executable not found');
    }

    const args = process.platform === 'win32' && plangExecutable.toLowerCase().endsWith('.bat')
        ? ['/c', plangExecutable, tempFile, '--no-output']
        : [tempFile, '--no-output'];

    const command = process.platform === 'win32' && plangExecutable.toLowerCase().endsWith('.bat')
        ? 'cmd.exe'
        : plangExecutable;

    return new Promise((resolve, reject) => {
        const child = execFile(command, args, {
            timeout: VALIDATION_TIMEOUT_MS,
            windowsHide: true,
            maxBuffer: 1024 * 1024
        }, (error, stdout, stderr) => {
            activeProcesses.delete(key);

            if (error && error.killed) {
                reject(new Error('cancelled'));
                return;
            }

            if (error && error.code === 'ENOENT') {
                reject(error);
                return;
            }

            if (error && error.code === 'ETIMEDOUT') {
                reject(error);
                return;
            }

            resolve({ stdout, stderr: stderr || stdout || '' });
        });

        child.on('error', (error) => {
            activeProcesses.delete(key);
            reject(error);
        });

        activeProcesses.set(key, child);
    });
}

export async function validateDocument(document: vscode.TextDocument, requestId = 0, key = document.uri.toString()) {
    const diagnostics: vscode.Diagnostic[] = [];
    const tempFile = await getTempFilePath(document);
    
    if (!tempFile) return diagnostics;
    
    try {
        await fs.promises.writeFile(tempFile, document.getText(), 'utf-8');
        const { stderr } = await runPlangValidation(tempFile, key);

        const errors = parseErrors(stderr || '');
        for (const err of errors) {
            const range = new vscode.Range(
                new vscode.Position(err.lineStart - 1, err.colStart - 1),
                new vscode.Position(err.lineEnd - 1, err.colEnd)
            );
            
            diagnostics.push(new vscode.Diagnostic(
                range,
                err.message,
                vscode.DiagnosticSeverity.Error
            ));
        }
        
    } catch (error: any) {
        if (requestId && requestId !== (validationRequests.get(key) ?? 0)) {
            return diagnostics;
        }

        if (error?.code === 'ENOENT') {
            return diagnostics;
        }

        if (error?.code === 'ETIMEDOUT' || error?.message === 'cancelled') {
            return diagnostics;
        }

        if (error?.stderr) {
            const errors = parseErrors(error.stderr);
            for (const err of errors) {
                
                const range = new vscode.Range(
                    new vscode.Position(err.lineStart - 1, err.colStart - 1),
                    new vscode.Position(err.lineEnd - 1, err.colEnd)
                );
                
                diagnostics.push(new vscode.Diagnostic(
                    range,
                    err.message,
                    vscode.DiagnosticSeverity.Error
                ));
            }
        }
    } finally {
        await fs.promises.unlink(tempFile).catch(() => {});
    }
    
    return diagnostics;
}

function parseErrors(output: string): Array<{lineStart: number, lineEnd: number, colStart: number, colEnd: number, message: string}> {
    const errors: Array<{lineStart: number, lineEnd: number, colStart: number, colEnd: number, message: string}> = [];
    const lines = output.split('\n');
    
    for (const line of lines) {
        const match = line.match(/Line:\s*(\d+)~(\d+),\s*Column:\s*(\d+)~(\d+):\s*(.+)/);
        if (match) {
            errors.push({
                lineStart: parseInt(match[1]),
                lineEnd: parseInt(match[2]),
                colStart: parseInt(match[3]),
                colEnd: parseInt(match[4]),
                message: match[5].trim()
            });
        }
    }
    
    return errors;
}