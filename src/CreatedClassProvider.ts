
import * as vscode from 'vscode';

/**
 * 辞書クラス。stringがkey、stringがvalue。
 */
interface Dictionary {
    [name: string] : string;
}
/**
 * 作られたクラスの情報を保持する。また補完のための情報も保持する。
 */
class ClassInformationHolder {
    name: string;
    base: string;
    row: number;
    attrs: Dictionary;
    detail: string;
    documentation: vscode.MarkdownString;
    constructor(name: string, base: string, row: number, attrs: Dictionary){
        this.name = name;
        this.base = base;
        this.row = row;
        this.attrs = attrs;

        this.detail = `class creator.${name} created at line ${row+1}`;
        this.documentation = this.makeDocumentation();

    }

    private makeDocumentation(): vscode.MarkdownString {
        let attrsListItem: string = "";
        Object.entries(this.attrs).forEach(pair => {
            attrsListItem += `- ${pair[0]} = ${pair[1]}\n`;
        });

        return new vscode.MarkdownString(
            `class ${this.name}(${this.base})` + "\n" +
            attrsListItem
        );
    }
}

/**
 * creator.create()によって定義されたクラスに関するproviderを実装するクラス
 * 補完・定義に飛ぶなど。
 */
export class CreatedClassProvider implements vscode.CompletionItemProvider, vscode.DefinitionProvider, vscode.HoverProvider {
    /**
     * 解析の際に、その行の文頭がこれから始まっていないと解析しない
     */
    private linePrefix: string;
    /**
     * クラス名補完の際のトリガーになる文章
     * @static
     */
    private static completionTrigger: string = 'creator.';

    /**
     * 作られたクラスの情報を保持する配列
     */
    private classes: ClassInformationHolder[];

    constructor(linePrefix: string){
        this.classes = [];
        this.linePrefix = linePrefix;
    }

    public clearClasses(): void {
        this.classes = [];
    }
    
    /**
     * nameを持つクラスを今現在保有するか
     * @param name {string}
     * @returns 既に存在するならTrue
     */
    public isExist(name: string): boolean {
        if(this.classes.length === 0){
            return false;
        }

        for (let index = 0; index < this.classes.length; index++) {
            const cls = this.classes[index];
            if(cls.name === name){
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
    public addClass(name: string, base: string, row: number, attrs: Dictionary, overwrite: boolean=false): void {
        // 上書き処理の場合
        if(overwrite){
            for (let i = 0; i < this.classes.length; i++) {
                const cls = this.classes[i];
                if(cls.name === name){
                    this.classes[i] = new ClassInformationHolder(name, base, row, attrs);
                    break;
                }
            }
            // console.log(`Successfully overwrite class ${name}`);
        // 通常の追加の場合
        }else{
            this.classes.push(
                new ClassInformationHolder(name, base, row, attrs)
            );
            // console.log(`Successfully add class ${name}`);
        }
    }

    /**
     * クラス名から検索して、格納している情報を取り出す
     * @param name クラス名
     * @returns クラス名と一致する保持していたClassInformationHolderインスタンス。存在しない場合はundefined
     */
    public getClassHolder(name: string) : ClassInformationHolder|undefined {
        for (let index = 0; index < this.classes.length; index++) {
            const cls = this.classes[index];
            if(name === cls.name){
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
    private getArgs(line: string): string {
        return line.substring(this.linePrefix.length+1, line.length-1);
    }

    /**
     * 登録したいクラス名を取り出す
     * @param args ''hoge', fuga, foo' のようなカンマ区切りの文字列
     * @returns 定義されたクラス名
     */
    private parseClassName(args: string): string|undefined {
        let name: string|undefined = args.match(/[\'\"]\w+[\'\"]/)?.join('');
        if(name === undefined){
            return undefined;
        }
        return name.substring(1, name.length-1);
    }

    private parseBaseClassName(args: string, name: string): string {
        const others: string = args.substring(name.length+3);
        return others.substring(0, others.indexOf(','));
    }

    private parseAttributes(args: string, name: string, base: string): Dictionary {
        // args = ''TestClass',int,hoge=20,fuga=-1'
        const keywords: string[] = args.substring(name.length+3+base.length+1).split('=');

        // keywords = ['hoge', '20,fuga','-1']
        let preKey: string = keywords[0];
        let attrs: Dictionary = {};
        for (let i = 1; i < keywords.length-1; i++) {
            const keyword: string = keywords[i];
            const commaPos: number = keyword.indexOf(',');
            attrs[preKey] = keyword.substring(0, commaPos);
            preKey = keyword.substring(commaPos+1);
        }
        attrs[preKey] = keywords[keywords.length-1];

        return attrs;
    }

    public loadLine(line: string, row: number, doOverWrite: boolean=false): boolean {
        const lineRemovedSpace: string = line.replace(/\s+/g, '');

        if(!lineRemovedSpace.startsWith(this.linePrefix)){
            return false;
        }

        const args: string = this.getArgs(lineRemovedSpace);

        const name: string|undefined = this.parseClassName(args);
        if(name === undefined){
            return false;
        }

        const exist: boolean = this.isExist(name);
        let executeOverwrite: boolean = false;
        // 既に存在かつ上書き許可がないなら終了
        if(exist && !doOverWrite){
            return false;
        // 既に存在してかつ上書きするなら、フラグを立てる
        }else if(exist && doOverWrite){
            executeOverwrite = true;
        }

        const base: string = this.parseBaseClassName(args, name);
        const attrs: Dictionary = this.parseAttributes(args, name, base);

        this.addClass(name, base, row, attrs, executeOverwrite);
        return true;
    }

    public loadDocument(document: vscode.TextDocument, doOverWrite: boolean=true): void {
        const lines: string[] = document.getText().split('\n');
        for (let index = 0; index < lines.length; index++) {
            const line = lines[index].trim();
            this.loadLine(line, index, doOverWrite);
        }
    }

    public reloadDocument(document: vscode.TextDocument): void {
        this.clearClasses();
        this.loadDocument(document, true);
    }

    private provideClassCompletionItems(): vscode.CompletionItem[] {
        const compItemList: vscode.CompletionItem[] = [];
        for (let index = 0; index < this.classes.length; index++) {
            const cls = this.classes[index];
            
            const compItem: vscode.CompletionItem = new vscode.CompletionItem(
                cls.name, vscode.CompletionItemKind.Class
            );
            compItem.detail = cls.detail;
            compItem.documentation = cls.documentation;
            compItemList.push(compItem);
        }
        return compItemList;
    }

    private provideAttributesCompletionItems(cls: ClassInformationHolder): vscode.CompletionItem[]{
        const compItemList: vscode.CompletionItem[] = [];

        Object.entries(cls.attrs).forEach(pair => {
            const compItem: vscode.CompletionItem = new vscode.CompletionItem(
                pair[0], vscode.CompletionItemKind.Property
            );
            compItem.detail = `The initial value of ${pair[0]} is ${pair[1]}`;
            compItemList.push(compItem);
        });

        return compItemList;
    }

    public provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, context: vscode.CompletionContext): vscode.CompletionItem[]|undefined{
        this.loadDocument(document, true);
        const line = document.lineAt(position).text.substring(0, position.character);
        if(line.endsWith(CreatedClassProvider.completionTrigger)){
            return this.provideClassCompletionItems();
        }else{
            let targetClass: undefined | ClassInformationHolder = undefined;
            for (let index = 0; index < this.classes.length; index++) {
                const cls = this.classes[index];
                if(line.endsWith(cls.name+'.')){
                    targetClass = cls;
                }
            }
            if(targetClass === undefined){
                return undefined;
            }else{
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
    public provideDefinition(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): vscode.Location|undefined {
        const wordRange: vscode.Range|undefined = document.getWordRangeAtPosition(position, /\w+/);
        if(!wordRange){
            return undefined;
        }
        const currentWord: string = document.lineAt(position.line).text.slice(wordRange.start.character, wordRange.end.character);

        const cls: ClassInformationHolder|undefined = this.getClassHolder(currentWord);

        if(cls === undefined){
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
    public provideHover(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): vscode.Hover|undefined {
        const wordRange: vscode.Range|undefined = document.getWordRangeAtPosition(position, /\w+/);
        if(!wordRange){
            return undefined;
        }
        const currentWord: string = document.lineAt(position.line).text.slice(wordRange.start.character, wordRange.end.character);
        
        const cls: ClassInformationHolder|undefined = this.getClassHolder(currentWord);

        if(cls === undefined){
            return undefined;
        }
        return new vscode.Hover(cls.documentation);
    }
}