"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RegisteredAliasProvider = void 0;
const vscode = require("vscode");
class AliasInformationHolder {
    constructor(aliasName, baseFunction, baseFunctionArgs, row) {
        this.aliasName = aliasName;
        this.baseFunction = baseFunction;
        this.baseFunctionArgs = baseFunctionArgs;
        this.row = row;
        this.detail = `${aliasName} defined at line ${row + 1}`;
        this.documentation = this.makeDocumentation();
    }
    makeDocumentation() {
        const args = (this.baseFunctionArgs.length > 0) ? `(${this.baseFunctionArgs.join(', ')}, ` : "(";
        const contents = this.baseFunction + args + "additional args...)";
        return new vscode.MarkdownString(contents);
    }
}
class RegisteredAliasProvider {
    /**
     *
     * @param instanceNameOfToolBox toolboxといった、deap.base.ToolBoxのインスタンス名
     */
    constructor(instanceNameOfToolBox) {
        this.aliases = [];
        this.linePrefix = instanceNameOfToolBox + ".register";
        this.completionTrigger = instanceNameOfToolBox + ".";
    }
    clearAliases() {
        this.aliases = [];
    }
    /**
     * aliasNameを持つクラスを今現在保有するか
     * @param aliasName {string}
     * @returns 既に存在するならTrue
     */
    isExist(aliasName) {
        for (let index = 0; index < this.aliases.length; index++) {
            const cls = this.aliases[index];
            if (cls.aliasName === aliasName) {
                return true;
            }
        }
        return false;
    }
    addAlias(aliasName, baseFunction, baseFunctionArgs, row, overwrite = false) {
        // 上書き処理の場合
        if (overwrite) {
            for (let i = 0; i < this.aliases.length; i++) {
                const cls = this.aliases[i];
                if (cls.aliasName === aliasName) {
                    this.aliases[i] = new AliasInformationHolder(aliasName, baseFunction, baseFunctionArgs, row);
                    break;
                }
            }
            // console.log(`Successfully overwrite class ${aliasName}`);
            // 通常の追加の場合
        }
        else {
            this.aliases.push(new AliasInformationHolder(aliasName, baseFunction, baseFunctionArgs, row));
            // console.log(`Successfully add class ${aliasName}`);
        }
    }
    getAlias(aliasName) {
        for (let index = 0; index < this.aliases.length; index++) {
            const alias = this.aliases[index];
            if (alias.aliasName === aliasName) {
                return alias;
            }
        }
        return undefined;
    }
    /**
     *
     * @param line toolbox.register('attr_bool', random.randint, 0, 1)のような行の文字列
     * @returns 入力から引数だけを取り出す。''attr_bool', random.randint, 0, 1'のような文字列になる
     */
    parseArgs(line) {
        return line.substring(this.linePrefix.length + 1, line.length - 1);
    }
    /**
     *
     * @param args ''attr_bool',random.randint,0,1のような文字列
     * @returns 'attr_bool'のようなエイリアス名
     */
    parseAliasName(args) {
        var _a;
        const aliasName = (_a = args.match(/[\'\"]\w+[\'\"]/)) === null || _a === void 0 ? void 0 : _a.join('');
        if (aliasName === undefined) {
            return undefined;
        }
        return aliasName.substring(1, aliasName.length - 1);
    }
    parseBaseFunction(args, aliasName) {
        const others = args.substring(aliasName.length + 3);
        const commaPos = others.indexOf(',');
        if (commaPos === -1) {
            return others.substring(0);
        }
        else {
            return others.substring(0, commaPos);
        }
    }
    parseBaseFunctionArgs(args, aliasName, baseFunc) {
        // argsはこんな感じ ''individual',tools.initRepeat,creator.Individual,toolbox.attr_bool,(100,200),hoge=10'
        // const others: string = args.substring(aliasName.length+3+baseFunc.length+1);
        const others = args.substring(aliasName.length + 3 + baseFunc.length + 1);
        // 現在こんな感じ：'creator.Individual,toolbox.attr_bool,(100,200,300),hoge=10'
        const funcArgs = [];
        let i = 0;
        let j = 0;
        let bracket = 0;
        for (j = 0; j < others.length; j++) {
            const char = others[j];
            if (char === ',' && bracket === 0) {
                funcArgs.push(others.substring(i, j));
                i = j + 1;
            }
            else if (char === '(') {
                bracket += 1;
            }
            else if (char === ')') {
                bracket -= 1;
            }
        }
        if (i !== j) {
            funcArgs.push(others.substring(i, j));
        }
        return funcArgs;
    }
    loadLine(line, row, doOverWrite = false) {
        const lineRemovedSpace = line.replace(/\s+/g, '');
        if (!lineRemovedSpace.startsWith(this.linePrefix) || !lineRemovedSpace.endsWith(')')) {
            return false;
        }
        const args = this.parseArgs(lineRemovedSpace);
        const aliasName = this.parseAliasName(args);
        if (aliasName === undefined) {
            return false;
        }
        const exist = this.isExist(aliasName);
        let executeOverwrite = false;
        // 既に存在かつ上書き許可がないなら終了
        if (exist && !doOverWrite) {
            return false;
            // 既に存在してかつ上書きするなら、フラグを立てる
        }
        else if (exist && doOverWrite) {
            executeOverwrite = true;
        }
        const baseFunction = this.parseBaseFunction(args, aliasName);
        const baseFunctionArgs = this.parseBaseFunctionArgs(args, aliasName, baseFunction);
        this.addAlias(aliasName, baseFunction, baseFunctionArgs, row, executeOverwrite);
        return true;
    }
    loadDocument(document, doOverWrite = false) {
        const lines = document.getText().split('\n');
        for (let index = 0; index < lines.length; index++) {
            const line = lines[index];
            this.loadLine(line, index, doOverWrite);
        }
    }
    reloadDocument(document) {
        this.clearAliases();
        this.loadDocument(document, true);
    }
    provideCompletionItems(document, position, token, context) {
        const line = document.lineAt(position).text.substring(0, position.character);
        if (!line.endsWith(this.completionTrigger)) {
            return undefined;
        }
        const compList = [];
        for (let index = 0; index < this.aliases.length; index++) {
            const alias = this.aliases[index];
            const compItem = new vscode.CompletionItem(alias.aliasName, vscode.CompletionItemKind.Function);
            compItem.detail = alias.detail;
            compItem.documentation = alias.documentation;
            compList.push(compItem);
        }
        return compList;
    }
    provideDefinition(document, position, token) {
        const wordRange = document.getWordRangeAtPosition(position, /\w+/);
        if (!wordRange) {
            return undefined;
        }
        const currentWord = document.lineAt(position.line).text.slice(wordRange.start.character, wordRange.end.character);
        const alias = this.getAlias(currentWord);
        if (alias === undefined) {
            return undefined;
        }
        const uri = vscode.Uri.file(document.fileName);
        const pos = new vscode.Position(alias.row, 0);
        return new vscode.Location(uri, pos);
    }
    provideHover(document, position, token) {
        const wordRange = document.getWordRangeAtPosition(position, /\w+/);
        if (!wordRange) {
            return undefined;
        }
        const currentWord = document.lineAt(position.line).text.slice(wordRange.start.character, wordRange.end.character);
        const alias = this.getAlias(currentWord);
        if (alias === undefined) {
            return undefined;
        }
        return new vscode.Hover(alias.documentation);
    }
}
exports.RegisteredAliasProvider = RegisteredAliasProvider;
//# sourceMappingURL=RegisteredAliasProvider.js.map