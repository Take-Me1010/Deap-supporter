"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const vscode = require("vscode");
const CreatedClassProvider_1 = require("./CreatedClassProvider");
const RegisteredAliasProvider_1 = require("./RegisteredAliasProvider");
function activate(context) {
    const editor = vscode.window.activeTextEditor;
    const config = vscode.workspace.getConfiguration('deap-supporter');
    const createCallWay = config.get('createCallWay');
    const instanceNameOfToolBox = config.get('InstanceNameOfToolBox');
    if ((createCallWay === undefined) || (instanceNameOfToolBox === undefined)) {
        throw new Error("cannot read configuration.");
    }
    const createdClassProvider = new CreatedClassProvider_1.CreatedClassProvider(createCallWay);
    const registeredAliasProvider = new RegisteredAliasProvider_1.RegisteredAliasProvider(instanceNameOfToolBox);
    context.subscriptions.push(vscode.languages.registerCompletionItemProvider('python', createdClassProvider, '.'), vscode.languages.registerDefinitionProvider('python', createdClassProvider), vscode.languages.registerHoverProvider('python', createdClassProvider));
    context.subscriptions.push(vscode.languages.registerCompletionItemProvider('python', registeredAliasProvider, '.'), vscode.languages.registerDefinitionProvider('python', registeredAliasProvider), vscode.languages.registerHoverProvider('python', registeredAliasProvider));
    const loadDocument = () => {
        if (editor === undefined) {
            vscode.window.showInformationMessage('Failed to deap-supporter. loadDocument because activeTextEditor is undefined.');
            return;
        }
        const doOverWrite = config.get('alwaysOverwrite');
        createdClassProvider.loadDocument(editor.document, doOverWrite);
        registeredAliasProvider.loadDocument(editor.document, doOverWrite);
        if (!config.get('neverShowSuccessfulInformation')) {
            vscode.window.showInformationMessage('Successfully load document!');
        }
    };
    const loadSelection = () => {
        if (editor === undefined) {
            vscode.window.showInformationMessage('Failed to deap-supporter.loadSelection because activeTextEditor is undefined.');
            return;
        }
        const doOverWrite = config.get('alwaysOverwrite');
        let selection = editor.selection;
        if (selection.isEmpty) {
            vscode.window.showInformationMessage('failed to deap-supporter.loadSelection because of no selection');
            return;
        }
        let startRow = selection.active.line;
        let lines = editor.document.getText(selection).split('\n');
        lines.forEach((line, index) => {
            createdClassProvider.loadLine(line, startRow + index, doOverWrite);
            registeredAliasProvider.loadLine(line, startRow + index, doOverWrite);
        });
        if (!config.get('neverShowSuccessfulInformation')) {
            vscode.window.showInformationMessage('Successfully load selection!');
        }
    };
    const reloadDocument = () => {
        if (editor === undefined) {
            vscode.window.showInformationMessage('Failed to deap-supporter. loadDocument because activeTextEditor is undefined.');
            return;
        }
        createdClassProvider.reloadDocument(editor.document);
        registeredAliasProvider.reloadDocument(editor.document);
        if (!config.get('neverShowSuccessfulInformation')) {
            vscode.window.showInformationMessage('Successfully reload document!');
        }
    };
    context.subscriptions.push(vscode.commands.registerCommand('deap-supporter.loadDocument', loadDocument), vscode.commands.registerCommand('deap-supporter.loadSelection', loadSelection), vscode.commands.registerCommand('deap-supporter.reloadDocument', reloadDocument));
}
exports.activate = activate;
// this method is called when your extension is deactivated
function deactivate() { }
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map