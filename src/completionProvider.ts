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
const validationRequests = new Map<string, number>();
let isValidating = false;
const pendingValidation = new Map<string, vscode.TextDocument>();
const changeValidationTimeouts = new Map<string, NodeJS.Timeout>();
const VALIDATION_TIMEOUT_MS = 4000;
const CHANGE_VALIDATION_DEBOUNCE_MS = 1200;
let outputChannel: vscode.OutputChannel | null = null;

export function activateGrammarProvider(context: vscode.ExtensionContext) {
    diagnosticCollection = vscode.languages.createDiagnosticCollection('plang');
    context.subscriptions.push(diagnosticCollection);
    outputChannel = vscode.window.createOutputChannel('PLang');
    context.subscriptions.push(outputChannel);

    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument((event) => {
            const document = event.document;
            if (document.languageId !== 'plang') return;

            scheduleValidation(document);
        })
    );

    context.subscriptions.push(
        vscode.workspace.onDidOpenTextDocument((document) => {
            if (document.languageId === 'plang') {
                enqueueValidation(document);
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


function enqueueValidation(document: vscode.TextDocument) {
    const key = document.uri.toString();
    pendingValidation.set(key, document);
    try {
        outputChannel?.appendLine(`Enqueued validation for ${key}`);
    } catch {}

    if (!isValidating) {
        const iterator = pendingValidation.entries().next();
        if (!iterator.done) {
            const [nextKey, nextDocument] = iterator.value;
            pendingValidation.delete(nextKey);
            void runValidationForDocument(nextDocument, nextKey);
        }
    }
}

function scheduleValidation(document: vscode.TextDocument) {
    const key = document.uri.toString();
    const existingTimeout = changeValidationTimeouts.get(key);
    if (existingTimeout) {
        clearTimeout(existingTimeout);
    }

    changeValidationTimeouts.set(key, setTimeout(() => {
        changeValidationTimeouts.delete(key);
        enqueueValidation(document);
    }, CHANGE_VALIDATION_DEBOUNCE_MS));
}

function cancelValidation(key: string) {
    pendingValidation.delete(key);
    validationRequests.delete(key);
}

async function runValidationForDocument(document: vscode.TextDocument, key: string) {
    if (isValidating) {
        pendingValidation.set(key, document);
        return;
    }

    isValidating = true;
    const requestId = (validationRequests.get(key) ?? 0) + 1;
    validationRequests.set(key, requestId);
    outputChannel?.appendLine(`Start validation for ${key} (req ${requestId})`);

    let diagnostics: vscode.Diagnostic[] = [];
    try {
        diagnostics = await validateDocument(document, requestId, key);
        if (requestId !== (validationRequests.get(key) ?? 0)) {
            outputChannel?.appendLine(`Stale validation result for ${key} (req ${requestId}), skipping`);
            return;
        }
    } catch (error: any) {
        if (requestId === (validationRequests.get(key) ?? 0)) {
            diagnostics = [
                new vscode.Diagnostic(
                    createFullDocumentRange(document),
                    `PLang validation failed: ${error?.message ?? String(error) ?? 'unknown error'}`,
                    vscode.DiagnosticSeverity.Error
                )
            ];
        }
    } finally {
        if (requestId === (validationRequests.get(key) ?? 0)) {
            diagnosticCollection.set(document.uri, diagnostics);
            outputChannel?.appendLine(`Set ${diagnostics.length} diagnostics for ${key}`);
        }

        isValidating = false;

        const iterator = pendingValidation.entries().next();
        if (!iterator.done) {
            const [nextKey, nextDocument] = iterator.value;
            pendingValidation.delete(nextKey);
            void runValidationForDocument(nextDocument, nextKey);
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
    try { outputChannel?.appendLine(`Temp file exists before run: ${tempFile} => ${fs.existsSync(tempFile)}`); } catch {}
    const isBat = process.platform === 'win32' && plangExecutable.toLowerCase().endsWith('.bat');

    const execOnce = (command: string, args: string[], options: any) => {
        return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
            const child = execFile(command, args, options, (error, stdout, stderr) => {
                const outStr = stdout && typeof stdout === 'string' ? stdout : (stdout.toString());
                const errStr = stderr && typeof stderr === 'string' ? stderr : (stderr.toString());
                if (error) {
                    try { outputChannel?.appendLine(`execOnce error: code=${error.code}, signal=${error.signal}, killed=${error.killed}, message=${error.message}`); } catch {}
                    try { outputChannel?.appendLine(`execOnce output lengths: stdout=${outStr.length}, stderr=${errStr.length}`); } catch {}
                    if (error.killed || error.code === 'ETIMEDOUT') {
                        resolve({ stdout: outStr, stderr: errStr });
                        return;
                    }

                    if (error.code === 'ENOENT') {
                        reject(error);
                        return;
                    }

                    reject(Object.assign(error, { stdout: outStr, stderr: errStr }));
                    return;
                }

                resolve({ stdout: outStr, stderr: errStr });
            });

            child.on('error', (error) => {
                try { outputChannel?.appendLine(`child error: ${String((error as any)?.message || error)}`); } catch {}
                reject(error);
            });
            child.on('close', (code, signal) => {
                try { outputChannel?.appendLine(`Process closed: code=${code}, signal=${signal}`); } catch {}
            });
        });
    };

    try { outputChannel?.appendLine(`Resolved PLang executable: ${plangExecutable}`); } catch {}

    if (isBat) {
        const scriptDir = path.dirname(plangExecutable);
        const pythonCmd = process.env.PYTHON || 'python';
        const pythonArgs = ['-m', 'sources.main', tempFile, '--no-output'];
        const options = { env: { ...process.env, PYTHONPATH: scriptDir }, timeout: VALIDATION_TIMEOUT_MS, windowsHide: true, maxBuffer: 1024 * 1024, cwd: scriptDir };

        try { outputChannel?.appendLine(`Invoking: ${pythonCmd} ${pythonArgs.join(' ')} (PYTHONPATH=${scriptDir})`); } catch {}

        const first = await execOnce(pythonCmd, pythonArgs, options);
        try {
            const s = (first.stdout || '').trim();
            const e = (first.stderr || '').trim();
            outputChannel?.appendLine(`First run returned lengths: stdout=${s.length}, stderr=${e.length}`);
            if (s || e) {
                outputChannel?.appendLine(`First run sample stdout:\n${s.split('\n').slice(0,5).join('\n')}`);
                outputChannel?.appendLine(`First run sample stderr:\n${e.split('\n').slice(0,5).join('\n')}`);
                return { stdout: first.stdout, stderr: first.stderr || '' };
            }
        } catch {}

        try {
            const retryArgs = ['-m', 'sources.main', tempFile];
            try { outputChannel?.appendLine(`No output detected; retrying without --no-output: ${pythonCmd} ${retryArgs.join(' ')}`); } catch {}
            const second = await execOnce(pythonCmd, retryArgs, options);
            try {
                const s2 = (second.stdout || '').trim();
                const e2 = (second.stderr || '').trim();
                outputChannel?.appendLine(`Retry run returned lengths: stdout=${s2.length}, stderr=${e2.length}`);
                if (s2 || e2) {
                    outputChannel?.appendLine(`Retry sample stdout:\n${s2.split('\n').slice(0,5).join('\n')}`);
                    outputChannel?.appendLine(`Retry sample stderr:\n${e2.split('\n').slice(0,5).join('\n')}`);
                }
            } catch {}
            return { stdout: second.stdout, stderr: second.stderr || '' };
        } catch (e) {
            try { outputChannel?.appendLine(`Retry failed: ${String((e as any)?.message || e)}`); } catch {}
            return { stdout: first.stdout, stderr: first.stderr || '' };
        }
    }

    const args = [tempFile, '--no-output'];
    const command = plangExecutable;
    const execCwd = path.dirname(plangExecutable) || undefined;
    try { outputChannel?.appendLine(`Invoking: ${command} ${args.join(' ')} (cwd=${execCwd})`); } catch {}

    const first = await execOnce(command, args, { timeout: VALIDATION_TIMEOUT_MS, windowsHide: true, maxBuffer: 1024 * 1024, cwd: execCwd });
    try {
        const s = (first.stdout || '').trim();
        const e = (first.stderr || '').trim();
        outputChannel?.appendLine(`First run returned lengths: stdout=${s.length}, stderr=${e.length}`);
        if (s || e) {
            outputChannel?.appendLine(`First run sample stdout:\n${s.split('\n').slice(0,5).join('\n')}`);
            outputChannel?.appendLine(`First run sample stderr:\n${e.split('\n').slice(0,5).join('\n')}`);
            return { stdout: first.stdout, stderr: first.stderr || '' };
        }
    } catch {}

    try {
        const retryArgs = [tempFile];
        try { outputChannel?.appendLine(`No output detected; retrying without --no-output: ${command} ${retryArgs.join(' ')}`); } catch {}
        const second = await execOnce(command, retryArgs, { timeout: VALIDATION_TIMEOUT_MS, windowsHide: true, maxBuffer: 1024 * 1024, cwd: execCwd });
        try {
            const s2 = (second.stdout || '').trim();
            const e2 = (second.stderr || '').trim();
            outputChannel?.appendLine(`Retry run returned lengths: stdout=${s2.length}, stderr=${e2.length}`);
            if (s2 || e2) {
                outputChannel?.appendLine(`Retry sample stdout:\n${s2.split('\n').slice(0,5).join('\n')}`);
                outputChannel?.appendLine(`Retry sample stderr:\n${e2.split('\n').slice(0,5).join('\n')}`);
            }
        } catch {}
        return { stdout: second.stdout, stderr: second.stderr || '' };
    } catch (e) {
        try { outputChannel?.appendLine(`Retry failed: ${String((e as any)?.message || e)}`); } catch {}
        return { stdout: first.stdout, stderr: first.stderr || '' };
    }
}

function createFullDocumentRange(document: vscode.TextDocument): vscode.Range {
    const lastLine = document.lineCount > 0 ? document.lineCount - 1 : 0;
    const endChar = document.lineCount > 0 ? document.lineAt(lastLine).text.length : 0;
    return new vscode.Range(new vscode.Position(0, 0), new vscode.Position(lastLine, endChar));
}

function createFileExecutionDiagnostic(document: vscode.TextDocument, message: string): vscode.Diagnostic[] {
    return [new vscode.Diagnostic(
        createFullDocumentRange(document),
        message,
        vscode.DiagnosticSeverity.Error
    )];
}

export async function validateDocument(document: vscode.TextDocument, requestId = 0, key = document.uri.toString()) {
    const diagnostics: vscode.Diagnostic[] = [];
    const tempFile = await getTempFilePath(document);
    
    if (!tempFile) return diagnostics;
    
    try {
        await fs.promises.writeFile(tempFile, document.getText(), 'utf-8');
        try { outputChannel?.appendLine(`Wrote temp file: ${tempFile} exists=${fs.existsSync(tempFile)}`); } catch {}
        const { stdout, stderr } = await runPlangValidation(tempFile, key);
        try { outputChannel?.appendLine(`PLang stdout for ${key}:\n${(stdout||'').trim().split('\n').slice(0,20).join('\n')}`); } catch {}
        try { outputChannel?.appendLine(`PLang stderr for ${key}:\n${(stderr||'').trim().split('\n').slice(0,20).join('\n')}`); } catch {}

        let errors = parseErrors(stderr || '');
        if (!errors.length) {
            errors = parseErrors(stdout || '');
            if (errors.length) {
                try { outputChannel?.appendLine(`Parsed errors from stdout for ${key}`); } catch {}
            }
        }
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

        if (!errors.length && (stderr?.trim() || stdout?.trim())) {
            try { outputChannel?.appendLine(`No parseable errors; pushed output as warning for ${key}`); } catch {}
        }
    } catch (error: any) {
        if (requestId && requestId !== (validationRequests.get(key) ?? 0)) {
            return diagnostics;
        }

        const message = error?.message || 'Unknown PLang execution error';
        if (message === 'PLang executable not found' || error?.code === 'ENOENT' || message.includes('spawn')) {
            return createFileExecutionDiagnostic(document, `Unable to execute PLang: ${message}`);
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
        } else if (message) {
            return createFileExecutionDiagnostic(document, `Unable to execute PLang: ${message}`);
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