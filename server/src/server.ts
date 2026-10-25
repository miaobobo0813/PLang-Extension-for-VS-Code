import {
    createConnection, 
    TextDocuments, 
    Diagnostic, 
    DiagnosticSeverity, 
    ProposedFeatures, 
    InitializeParams, 
    DidChangeConfigurationNotification, 
    CompletionItem, 
    CompletionItemKind, 
    InsertTextFormat,
    TextDocumentPositionParams, 
    TextDocumentSyncKind, 
    InitializeResult, 
    DocumentDiagnosticReportKind, 
    type DocumentDiagnosticReport
} from 'vscode-languageserver/node';

import { TextDocument } from 'vscode-languageserver-textdocument';
import { execFile } from 'node:child_process';

const connection = createConnection(ProposedFeatures.all);

const documents = new TextDocuments(TextDocument);

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let hasDiagnosticRelatedInformationCapability = false;

connection.onInitialize((params: InitializeParams) => {
    const capabilities = params.capabilities;

    hasConfigurationCapability = !!(
        capabilities.workspace && !!capabilities.workspace.configuration
    );
    hasWorkspaceFolderCapability = !!(
        capabilities.workspace && !!capabilities.workspace.workspaceFolders
    );
    hasDiagnosticRelatedInformationCapability = !!(
        capabilities.textDocument &&
        capabilities.textDocument.publishDiagnostics &&
        capabilities.textDocument.publishDiagnostics.relatedInformation
    );

    const result: InitializeResult = {
        capabilities: {
            textDocumentSync: TextDocumentSyncKind.Incremental, 
            completionProvider: {
                resolveProvider: true,
                triggerCharacters: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_.'.split('')
            }, 
            diagnosticProvider: {
                interFileDependencies: false, 
                workspaceDiagnostics: false
            }
        }
    };
    if (hasWorkspaceFolderCapability){
        result.capabilities.workspace = {
            workspaceFolders: {
                supported: true
            }
        };
    }
    return result;
});

connection.onInitialized(() => {
    if (hasConfigurationCapability){
        connection.client.register(DidChangeConfigurationNotification.type, undefined);
    }
    if (hasWorkspaceFolderCapability){
        connection.workspace.onDidChangeWorkspaceFolders(_event => {
            connection.console.log("Workspace folder change event received.");
        });
    }
});

interface ExampleSettings {
    maxNumberOfProblems: number;
}

const defaultSettings: ExampleSettings = {
    maxNumberOfProblems: 1000
};
let globalSettings: ExampleSettings = defaultSettings;

const documentSettings = new Map<string, Thenable<ExampleSettings>>();

connection.onDidChangeConfiguration(change => {
    if (hasConfigurationCapability){
        documentSettings.clear();
    } else {
        globalSettings = (
            (change.settings.plangLanguageServer || defaultSettings)
        );
    }
});

function getDocumentSettings(resource: string): Thenable<ExampleSettings> {
    if (!hasConfigurationCapability){
        return Promise.resolve(globalSettings);
    }
    let result = documentSettings.get(resource);
    if (!result){
        result = connection.workspace.getConfiguration({
            scopeUri: resource, 
            section: "plangLanguageServer"
        });
        documentSettings.set(resource, result);
    }
    return result;
}

documents.onDidClose(e => {
    documentSettings.delete(e.document.uri);
});

connection.languages.diagnostics.on(async (params) => {
    const document = documents.get(params.textDocument.uri);
    if (document !== undefined){
        return {
            kind: DocumentDiagnosticReportKind.Full, 
            items: await validateTextDocument(document)
        } satisfies DocumentDiagnosticReport;
    } else {
        return {
            kind: DocumentDiagnosticReportKind.Full, 
            items: []
        } satisfies DocumentDiagnosticReport;
    }
});

async function validateTextDocument(textDocument: TextDocument): Promise<Diagnostic[]> {
    if (!textDocument.getText().trim()) {
        return [];
    }

    const result = await new Promise<{
        stdout: string;
        stderr: string;
        error?: Error;
    }>(resolve => {
        execFile(
            process.env.PLANG_PATH || 'plang',
            ['--no-output', '--code', textDocument.getText()],
            { windowsHide: true, timeout: 10000, maxBuffer: 1024 * 1024 },
            (error, stdout, stderr) => resolve({
                stdout: stdout.toString(),
                stderr: stderr.toString(),
                error: error ?? undefined
            })
        );
    });

    const output = [result.stderr, result.stdout].filter(Boolean).join('\n');
    const diagnostics = parseCompilerDiagnostics(output, textDocument);
    if (diagnostics.length > 0 || !result.error) {
        return diagnostics;
    }

    return [createLocationlessDiagnostic(
        textDocument,
        output.trim() || `Unable to run PLang compiler: ${result.error.message}`
    )];
}

connection.onCompletion(
    (textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
        const document = documents.get(textDocumentPosition.textDocument.uri);
        if (!document || isInTipsComment(document.getText(), document.offsetAt(textDocumentPosition.position))) {
            return [];
        }

        const line = document.getText({
            start: { line: textDocumentPosition.position.line, character: 0 },
            end: textDocumentPosition.position
        });
        const completions: CompletionItem[] = [];

        if (/^\s*$/.test(line) || /^\s*\w*$/.test(line)) {
            const keywordDocs: Record<string, string> = {
                loop: 'Loop control. Modifiers: while, for, stop, skip, when, codes, range',
                vars: 'Variable control. Modifiers: new, modify',
                ter: 'Terminal control. Modifiers: otpt (output), inpt (input)'
            };
            completions.push(...['using', 'loop', 'vars', 'ter'].map(label => ({
                label,
                kind: CompletionItemKind.Keyword,
                detail: 'PLang keyword',
                documentation: keywordDocs[label] ?? 'PLang keyword'
            })));
        }

        if (/\.\w*$/.test(line)) {
            const modifiers: [string, string, string][] = [
                ['tips', 'tips($0);', 'Comment'],
                ['new', 'new(${1:name}, ${2:type}, ${3:value})', 'New variable'],
                ['modify', 'modify(${0:newValue})', 'Modify variable'],
                ['otpt', 'otpt(${0:text})', 'Output'],
                ['inpt', 'inpt(${0:variable})', 'Input'],
                ['while', 'while', 'While loop'],
                ['for', 'for', 'For loop'],
                ['stop', 'stop();', 'Break the loop'],
                ['skip', 'skip();', 'Skip the loop'],
                ['if', 'if', 'If condition'],
                ['codes', 'codes({\n\t$0\n})', 'Code block'],
                ['when', 'when(${1:condition})', 'Condition'],
                ['range', 'range(${1:from}, ${2:to}, ${3:variable})', 'Range of for'],
                ['else', 'else({\n\t$0\n})', 'Code block when condition is false']
            ];
            completions.push(...modifiers.map(([label, insertText, detail]) => ({
                label,
                insertText,
                insertTextFormat: InsertTextFormat.Snippet,
                kind: CompletionItemKind.Method,
                detail
            })));
        }

        const variables = new Set<string>();
        const variablePattern = /vars\.new\((\w+),/g;
        let match: RegExpExecArray | null;
        while ((match = variablePattern.exec(document.getText())) !== null) {
            variables.add(match[1]);
        }
        completions.push(...Array.from(variables, label => ({
            label,
            kind: CompletionItemKind.Variable,
            detail: 'Variable'
        })));

        if (/[(\s=]\w*$/.test(line)) {
            const operators: [string, string][] = [
                ['+', 'Plus'], ['-', 'Subtraction'], ['*', 'Times'], ['`', 'Division'],
                ['%', 'Mod'], ['/', 'Or'], ['&', 'And'], ['=', 'Equal to'],
                ['~', 'Not'], ['<', 'Less than'], ['>', 'Greater than'],
                ['</=', 'Less than or equal to'], ['>/=', 'Greater than or equal to']
            ];
            completions.push(...operators.map(([label, detail]) => ({
                label,
                kind: CompletionItemKind.Operator,
                detail
            })));
        }

        completions.push(...[
            { label: 'number', detail: 'Integer' },
            { label: 'dotNum', detail: 'Float' },
            { label: 'text', detail: 'String' },
            { label: 'boolean', detail: 'Boolean' },
            { label: 'yes', detail: 'Boolean value true' },
            { label: 'no', detail: 'Boolean value false' }
        ].map(type => ({
            ...type,
            kind: CompletionItemKind.TypeParameter
        })));

        return completions;
    }
)

connection.onCompletionResolve(
    (item: CompletionItem): CompletionItem => {
        // TODO: Add details about the completion item.
        return item;
    }
)

documents.listen(connection);
connection.listen();

function parseCompilerDiagnostics(output: string, document: TextDocument): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const rangedPattern = /Line:\s*(\d+)(?:~(\d+))?,\s*Column:\s*(\d+)(?:~(\d+))?:\s*(.+)/;
    const locationlessPattern = /Line:\s*\?,\s*Column:\s*\?:\s*(.+)/;

    for (const line of output.split(/\r?\n/)) {
        const rangedMatch = rangedPattern.exec(line);
        if (rangedMatch) {
            const startLine = Number(rangedMatch[1]) - 1;
            const endLine = Number(rangedMatch[2] ?? rangedMatch[1]) - 1;
            const startCharacter = Number(rangedMatch[3]) - 1;
            const endCharacter = Number(rangedMatch[4] ?? rangedMatch[3]);
            const start = document.positionAt(document.offsetAt({
                line: startLine,
                character: startCharacter
            }));
            const end = document.positionAt(document.offsetAt({
                line: endLine,
                character: endCharacter
            }));
            diagnostics.push({
                range: { start, end },
                message: rangedMatch[5].trim(),
                severity: DiagnosticSeverity.Error,
                source: 'PLang'
            });
            continue;
        }

        const locationlessMatch = locationlessPattern.exec(line);
        if (locationlessMatch) {
            diagnostics.push(createLocationlessDiagnostic(document, locationlessMatch[1].trim()));
        }
    }

    return diagnostics;
}

function createLocationlessDiagnostic(document: TextDocument, message: string): Diagnostic {
    const position = document.positionAt(0);
    return {
        range: { start: position, end: position },
        message,
        severity: DiagnosticSeverity.Error,
        source: 'PLang'
    };
}

function isInTipsComment(text: string, offset: number): boolean {
    const precedingText = text.slice(0, offset);
    const start = precedingText.lastIndexOf('using.tips(');
    if (start === -1) {
        return false;
    }

    let depth = 0;
    for (let index = start + 'using.tips'.length; index < precedingText.length; index++) {
        if (precedingText[index] === '(') {
            depth++;
        } else if (precedingText[index] === ')') {
            depth--;
            if (depth === 0) {
                return false;
            }
        }
    }
    return depth > 0;
}