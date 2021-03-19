"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreatedClassProvider = void 0;
const vscode = require("vscode");
/**
 * 作られたクラスの情報を保持する。また補完のための情報も保持する。
 */
class ClassInformationHolder {
    constructor(name, base, row, attrs) {
        this.name = name;
        this.base = base;
        this.row = row;
        this.attrs = attrs;
        this.detail = `class creator.${name} created at line ${row + 1}`;
        this.documentation = this.makeDocumentation();
    }
    makeDocumentation() {
        let attrsListItem = "";
        Object.entries(this.attrs).forEach(pair => {
            attrsListItem += `- ${pair[0]} = ${pair[1]}\n`;
        });
        return new vscode.MarkdownString(`class ${this.name}(${this.base})` + "\n" +
            attrsListItem);
    }
}
/**
 * creator.create()によって定義されたクラスに関するproviderを実装するクラス
 * 補完・定義に飛ぶなど。
 */
class CreatedClassProvider {
    constructor(linePrefix) {
        this.classes = [];
        this.linePrefix = linePrefix;
    }
    clearClasses() {
        this.classes = [];
    }
    /**
     * nameを持つクラスを今現在保有するか
     * @param name {string}
     * @returns 既に存在するならTrue
     */
    isExist(name) {
        if (this.classes.length === 0) {
            return false;
        }
        for (let index = 0; index < this.classes.length; index++) {
            const cls = this.classes[index];
            if (cls.name === name) {
                return true;
            }
        }
        return false;
    }
    /**
     * クラスを追加する
     * @param name {string}
     * @param base {string}
     * @param row {number}
     * @param attrs {Dictionary}
     */
    addClass(name, base, row, attrs, overwrite = false) {
        // 上書き処理の場合
        if (overwrite) {
            for (let i = 0; i < this.classes.length; i++) {
                const cls = this.classes[i];
                if (cls.name === name) {
                    this.classes[i] = new ClassInformationHolder(name, base, row, attrs);
                    break;
                }
            }
            // console.log(`Successfully overwrite class ${name}`);
            // 通常の追加の場合
        }
        else {
            this.classes.push(new ClassInformationHolder(name, base, row, attrs));
            // console.log(`Successfully add class ${name}`);
        }
    }
    /**
     * クラス名から検索して、格納している情報を取り出す
     * @param name クラス名
     * @returns クラス名と一致する保持していたClassInformationHolderインスタンス。存在しない場合はundefined
     */
    getClassHolder(name) {
        for (let index = 0; index < this.classes.length; index++) {
            const cls = this.classes[index];
            if (name === cls.name) {
                return cls;
            }
        }
        return undefined;
    }
    /**
     * 引数のみを取り出す
     * @param line creator.create(hoge, fuga, foo, bar)のような文字列
     * @returns {string} args = 'hoge, fuga, foo, bar' のみを取り出した文字列
     */
    getArgs(line) {
        return line.substring(this.linePrefix.length + 1, line.length - 1);
    }
    /**
     * 登録したいクラス名を取り出す
     * @param args ''hoge', fuga, foo' のようなカンマ区切りの文字列
     * @returns 定義されたクラス名
     */
    parseClassName(args) {
        var _a;
        let name = (_a = args.match(/[\'\"]\w+[\'\"]/)) === null || _a === void 0 ? void 0 : _a.join('');
        if (name === undefined) {
            return undefined;
        }
        return name.substring(1, name.length - 1);
    }
    parseBaseClassName(args, name) {
        const others = args.substring(name.length + 3);
        return others.substring(0, others.indexOf(','));
    }
    parseAttributes(args, name, base) {
        // args = ''TestClass',int,hoge=20,fuga=-1'
        const keywords = args.substring(name.length + 3 + base.length + 1).split('=');
        // keywords = ['hoge', '20,fuga','-1']
        let preKey = keywords[0];
        let attrs = {};
        for (let i = 1; i < keywords.length - 1; i++) {
            const keyword = keywords[i];
            const commaPos = keyword.indexOf(',');
            attrs[preKey] = keyword.substring(0, commaPos);
            preKey = keyword.substring(commaPos + 1);
        }
        attrs[preKey] = keywords[keywords.length - 1];
        return attrs;
    }
    loadLine(line, row, doOverWrite = false) {
        const lineRemovedSpace = line.replace(/\s+/g, '');
        if (!lineRemovedSpace.startsWith(this.linePrefix)) {
            return false;
        }
        const args = this.getArgs(lineRemovedSpace);
        const name = this.parseClassName(args);
        if (name === undefined) {
            return false;
        }
        const exist = this.isExist(name);
        let executeOverwrite = false;
        // 既に存在かつ上書き許可がないなら終了
        if (exist && !doOverWrite) {
            return false;
            // 既に存在してかつ上書きするなら、フラグを立てる
        }
        else if (exist && doOverWrite) {
            executeOverwrite = true;
        }
        const base = this.parseBaseClassName(args, name);
        const attrs = this.parseAttributes(args, name, base);
        this.addClass(name, base, row, attrs, executeOverwrite);
        return true;
    }
    loadDocument(document, doOverWrite = CreatedClassProvider.doOverwriteDefault) {
        const lines = document.getText().split('\n');
        for (let index = 0; index < lines.length; index++) {
            const line = lines[index];
            this.loadLine(line, index, doOverWrite);
        }
    }
    reloadDocument(document) {
        this.clearClasses();
        this.loadDocument(document, true);
    }
    provideClassCompletionItems() {
        const compItemList = [];
        for (let index = 0; index < this.classes.length; index++) {
            const cls = this.classes[index];
            const compItem = new vscode.CompletionItem(cls.name, vscode.CompletionItemKind.Class);
            compItem.detail = cls.detail;
            compItem.documentation = cls.documentation;
            compItemList.push(compItem);
        }
        return compItemList;
    }
    provideAttributesCompletionItems(cls) {
        const compItemList = [];
        Object.entries(cls.attrs).forEach(pair => {
            const compItem = new vscode.CompletionItem(pair[0], vscode.CompletionItemKind.Property);
            compItem.detail = `The initial value of ${pair[0]} is ${pair[1]}`;
            compItemList.push(compItem);
        });
        return compItemList;
    }
    provideCompletionItems(document, position, token, context) {
        const line = document.lineAt(position).text.substring(0, position.character);
        if (line.endsWith(CreatedClassProvider.completionTrigger)) {
            return this.provideClassCompletionItems();
        }
        else {
            let targetClass = undefined;
            for (let index = 0; index < this.classes.length; index++) {
                const cls = this.classes[index];
                if (line.endsWith(cls.name + '.')) {
                    targetClass = cls;
                }
            }
            if (targetClass === undefined) {
                return undefined;
            }
            else {
                return this.provideAttributesCompletionItems(targetClass);
            }
        }
    }
    /**
     * 登録したクラスの定義した部分に飛べる
     * @param document
     * @param position
     * @param token
     * @returns
     */
    provideDefinition(document, position, token) {
        const wordRange = document.getWordRangeAtPosition(position, /\w+/);
        if (!wordRange) {
            return undefined;
        }
        const currentWord = document.lineAt(position.line).text.slice(wordRange.start.character, wordRange.end.character);
        const cls = this.getClassHolder(currentWord);
        if (cls === undefined) {
            return undefined;
        }
        const uri = vscode.Uri.file(document.fileName);
        const pos = new vscode.Position(cls.row, 0);
        return new vscode.Location(uri, pos);
    }
    /**
     * 登録したクラス名の上にホバーすると、対応したクラスのドキュメントを提示する
     * @param document
     * @param position
     * @param token
     * @returns
     */
    provideHover(document, position, token) {
        const wordRange = document.getWordRangeAtPosition(position, /\w+/);
        if (!wordRange) {
            return undefined;
        }
        const currentWord = document.lineAt(position.line).text.slice(wordRange.start.character, wordRange.end.character);
        const cls = this.getClassHolder(currentWord);
        if (cls === undefined) {
            return undefined;
        }
        return new vscode.Hover(cls.documentation);
    }
}
exports.CreatedClassProvider = CreatedClassProvider;
/**
 * クラス名補完の際のトリガーになる文章
 * @static
 */
CreatedClassProvider.completionTrigger = 'creator.';
/**
 * デフォルトで上書きするかどうか。
 * ただし基本的にextension.jsから呼び出される時に、ユーザー設定を読み込んで使用するため不要かも。
 * @static
 */
CreatedClassProvider.doOverwriteDefault = false;
//# sourceMappingURL=CreatedClassProvider.js.map