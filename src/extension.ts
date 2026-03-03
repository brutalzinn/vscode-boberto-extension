import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

let decorations: Record<string, vscode.TextEditorDecorationType> = {};
///@boberto @info teste
export function activate(context: vscode.ExtensionContext) {
    const collection = vscode.languages.createDiagnosticCollection("boberto");
    context.subscriptions.push(collection);

    const updateDiagnostics = (document: vscode.TextDocument) => {
        const config = vscode.workspace.getConfiguration("boberto");

        const marker: string = config.get("marker", "@boberto");
        const severityTags: Record<string, string> = config.get("severityTags", {});
        const emojis: Record<string, string> = config.get("emojis", {});
        const colors: Record<string, string> = config.get("colors", {});
        const enableHighlight: boolean = config.get("enableHighlight", true);
        const enableEmoji: boolean = config.get("enableEmoji", true);

        const diagnostics: vscode.Diagnostic[] = [];
        const lines = document.getText().split(/\r?\n/);

        const commentRegex = /^\s*(\/\/|#|--|\*|\/\*|""")/;
        const markerRegex = new RegExp(`${escapeRegex(marker)}\\s*(?:@(\\w+))?\\s*(.*)`);

        const rangesBySeverity: Record<string, vscode.Range[]> = {};

        lines.forEach((line, index) => {
            if (!commentRegex.test(line)) return;

            const match = line.match(markerRegex);
            if (!match) return;

            const severityTag = match[1] ? `@${match[1]}` : undefined;
            const messageText = match[2] || "";

            let severityKey = "warning";
            if (severityTag && severityTags[severityTag]) {
                severityKey = severityTags[severityTag];
            }

            const severity = mapSeverity(severityKey);

            const startChar = line.indexOf(marker);
            const endChar = line.length;

            const range = new vscode.Range(
                new vscode.Position(index, startChar >= 0 ? startChar : 0),
                new vscode.Position(index, endChar)
            );

            const emoji = enableEmoji ? (emojis[severityKey] || "") : "";

            const diagnostic = new vscode.Diagnostic(
                range,
                `${emoji ? emoji + " " : ""}${marker} ${messageText}`.trim(),
                severity
            );

            diagnostic.source = marker.replace("@", "");
            diagnostics.push(diagnostic);

            if (enableHighlight) {
                if (!rangesBySeverity[severityKey]) {
                    rangesBySeverity[severityKey] = [];
                }
                rangesBySeverity[severityKey].push(range);
            }
        });

        collection.set(document.uri, diagnostics);

        const editor = vscode.window.activeTextEditor;
        if (editor && enableHighlight && editor.document.uri.toString() === document.uri.toString()) {
            Object.keys(rangesBySeverity).forEach(key => {
                if (!decorations[key]) {
                    decorations[key] = vscode.window.createTextEditorDecorationType({
                        backgroundColor: hexToRgba(colors[key] || "#888888", 0.15),
                        border: `1px solid ${colors[key] || "#888888"}`
                    });
                }
                editor.setDecorations(decorations[key], rangesBySeverity[key]);
            });
        }
    };

    const exportCommand = vscode.commands.registerCommand("boberto.exportAll", async () => {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) return;

        const config = vscode.workspace.getConfiguration("boberto");
        const marker: string = config.get("marker", "@boberto");
        const severityTags: Record<string, string> = config.get("severityTags", {});

        const format = await vscode.window.showQuickPick(
            ["JSON", "Markdown"],
            { placeHolder: "Select export format" }
        );

        if (!format) return;

        const files = await vscode.workspace.findFiles("**/*.{ts,js,tsx,jsx,py,java,cs,sql,css,html}");

        const results: any[] = [];

        for (const file of files) {
            const document = await vscode.workspace.openTextDocument(file);
            const lines = document.getText().split(/\r?\n/);
            const markerRegex = new RegExp(`${escapeRegex(marker)}\\s*(?:@(\\w+))?\\s*(.*)`);

            lines.forEach((line, index) => {
                const match = line.match(markerRegex);
                if (!match) return;

                const severityTag = match[1] ? `@${match[1]}` : undefined;
                const messageText = match[2] || "";

                let severityKey = "warning";
                if (severityTag && severityTags[severityTag]) {
                    severityKey = severityTags[severityTag];
                }

                results.push({
                    file: vscode.workspace.asRelativePath(file),
                    line: index + 1,
                    severity: severityKey,
                    message: messageText.trim()
                });
            });
        }

        const rootPath = workspaceFolders[0].uri.fsPath;

        if (format === "JSON") {
            const outputPath = path.join(rootPath, "boberto-report.json");
            fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
            vscode.window.showInformationMessage("Boberto JSON report exported.");
        }

        if (format === "Markdown") {
            const outputPath = path.join(rootPath, "boberto-report.md");
            let markdown = "# Boberto Issues Report\n\n";
            const grouped = groupBySeverity(results);

            for (const severity of Object.keys(grouped)) {
                markdown += `## ${severity.toUpperCase()}\n\n`;
                grouped[severity].forEach((item: any) => {
                    markdown += `- **${item.file}:${item.line}** — ${item.message}\n`;
                });
                markdown += "\n";
            }

            fs.writeFileSync(outputPath, markdown);
            vscode.window.showInformationMessage("Boberto Markdown report exported.");
        }
    });

    context.subscriptions.push(
        exportCommand,
        vscode.workspace.onDidOpenTextDocument(updateDiagnostics),
        vscode.workspace.onDidChangeTextDocument(e => updateDiagnostics(e.document)),
        vscode.workspace.onDidCloseTextDocument(doc => collection.delete(doc.uri)),
        vscode.window.onDidChangeActiveTextEditor(editor => {
            if (editor) updateDiagnostics(editor.document);
        }),
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration("boberto")) {
                vscode.workspace.textDocuments.forEach(updateDiagnostics);
            }
        })
    );

    if (vscode.window.activeTextEditor) {
        updateDiagnostics(vscode.window.activeTextEditor.document);
    }
}

function groupBySeverity(items: any[]) {
    return items.reduce((acc, item) => {
        if (!acc[item.severity]) acc[item.severity] = [];
        acc[item.severity].push(item);
        return acc;
    }, {} as Record<string, any[]>);
}

function mapSeverity(level: string): vscode.DiagnosticSeverity {
    switch (level) {
        case "error":
            return vscode.DiagnosticSeverity.Error;
        case "warning":
            return vscode.DiagnosticSeverity.Warning;
        case "information":
            return vscode.DiagnosticSeverity.Information;
        case "hint":
            return vscode.DiagnosticSeverity.Hint;
        default:
            return vscode.DiagnosticSeverity.Warning;
    }
}

function escapeRegex(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hexToRgba(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function deactivate() {}