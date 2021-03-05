
import * as vscode from 'vscode';

class AliasInformationHolder {
    aliasName: string;
    baseFunction: string;
    baseFunctionArgs: string[];
    row: number;

    detail: string;
    documentation: vscode.MarkdownString;
    constructor(aliasName: string, baseFunction: string, baseFunctionArgs: string[], row: number) {
        this.aliasName = aliasName;
        this.baseFunction = baseFunction;
        this.baseFunctionArgs = baseFunctionArgs;
        this.row = row;

        this.detail = `${aliasName} defined at line ${row+1}`;
        this.documentation = this.makeDocumentation();
    }

    private makeDocumentation(): vscode.MarkdownString {
        const args: string = (this.baseFunctionArgs.length > 0)? `(${this.baseFunctionArgs.join(', ')}, ` : "(";
        const contents = this.baseFunction + args + "additional args...)";

        return new vscode.MarkdownString(contents);
    }
}

export class RegisteredAliasProvider implements vscode.CompletionItemProvider, vscode.DefinitionProvider, vscode.HoverProvider {

    private aliases: AliasInformationHolder[];
    private linePrefix: string;
    /**
     * 補完を行うトリガー
     */
    private completionTrigger: string;
    /**
     * 
     * @param instanceNameOfToolBox toolboxといった、deap.base.ToolBoxのインスタンス名
     */
    constructor(instanceNameOfToolBox: string) {
        this.aliases = [];
        this.linePrefix = instanceNameOfToolBox + ".register";
        this.completionTrigger = instanceNameOfToolBox + ".";
    }
    public clearAliases(): void {
        this.aliases = [];
    }
    /**
     * aliasNameを持つクラスを今現在保有するか
     * @param aliasName {string}
     * @returns 既に存在するならTrue
     */
    public isExist(aliasName: string): boolean {
        for (let index = 0; index < this.aliases.length; index++) {
            const cls = this.aliases[index];
            if (cls.aliasName === aliasName) {
                return true;
            }
        }

        return false;
    }

    public addAlias(aliasName: string, baseFunction: string, baseFunctionArgs: string[], row: number, overwrite: boolean=false): void {
        // 上書き処理の場合
        if(overwrite){
            for (let i = 0; i < this.aliases.length; i++) {
                const cls = this.aliases[i];
                if(cls.aliasName === aliasName){
                    this.aliases[i] = new AliasInformationHolder(aliasName, baseFunction, baseFunctionArgs, row);
                    break;
                }
            }
            // console.log(`Successfully overwrite class ${aliasName}`);
        // 通常の追加の場合
        }else{
            this.aliases.push(
                new AliasInformationHolder(aliasName, baseFunction, baseFunctionArgs, row)
            );
            // console.log(`Successfully add class ${aliasName}`);
        }
    }

    public getAlias(aliasName: string): AliasInformationHolder|undefined {
        for (let index = 0; index < this.aliases.length; index++) {
            const alias = this.aliases[index];
            if(alias.aliasName === aliasName){
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
    private parseArgs(line: string): string {
        return line.substring(this.linePrefix.length + 1, line.length - 1);
    }

    /**
     * 
     * @param args ''attr_bool',random.randint,0,1のような文字列
     * @returns 'attr_bool'のようなエイリアス名
     */
    private parseAliasName(args: string): string {
        const aliasName: string | undefined = args.match(/\'\w+\'/)?.join('');
        if (aliasName === undefined) {
            throw new Error("Parse Error.");
        }
        return aliasName.substring(1, aliasName.length - 1);
    }
    
    private parseBaseFunction(args: string, aliasName: string): string{
        const others: string = args.substring(aliasName.length+3);
        const commaPos: number = others.indexOf(',');
        if(commaPos === -1){
            return others.substring(0);
        }else{
            return others.substring(0, commaPos);
        }
    }

    private parseBaseFunctionArgs(args: string, aliasName: string, baseFunc: string): string[] {
        // argsはこんな感じ ''individual',tools.initRepeat,creator.Individual,toolbox.attr_bool,(100,200),hoge=10'
        // const others: string = args.substring(aliasName.length+3+baseFunc.length+1);
        const others: string = args.substring(aliasName.length+3+baseFunc.length+1);
        // 現在こんな感じ：'creator.Individual,toolbox.attr_bool,(100,200,300),hoge=10'
        const funcArgs: string[] = [];
        let i: number = 0;
        let j: number = 0;
        let bracket: number = 0;
        for (j = 0; j < others.length; j++) {
            const char = others[j];
            if(char === ',' && bracket === 0){
                funcArgs.push(others.substring(i, j));
                i = j+1;
            }else if(char === '('){
                bracket += 1;
            }else if (char === ')'){
                bracket -= 1;
            }
        }
        if(i !== j){
            funcArgs.push(others.substring(i, j));
        }

        return funcArgs;
    }

    public loadLine(line: string, row: number, doOverWrite: boolean = false): boolean {
        const lineRemovedSpace: string = line.replace(/\s+/g, '');
        if (!lineRemovedSpace.startsWith(this.linePrefix) || !lineRemovedSpace.endsWith(')')) {
            return false;
        }

        const args: string = this.parseArgs(lineRemovedSpace);

        const aliasName: string = this.parseAliasName(args);

        const exist: boolean = this.isExist(aliasName);
        let executeOverwrite: boolean = false;
        // 既に存在かつ上書き許可がないなら終了
        if (exist && !doOverWrite) {
            return false;
            // 既に存在してかつ上書きするなら、フラグを立てる
        } else if (exist && doOverWrite) {
            executeOverwrite = true;
        }

        const baseFunction: string = this.parseBaseFunction(args, aliasName);
        const baseFunctionArgs: string[] = this.parseBaseFunctionArgs(args, aliasName, baseFunction);

        this.addAlias(aliasName, baseFunction, baseFunctionArgs, row, executeOverwrite);

        return true;
    }

    public loadDocument(document: vscode.TextDocument, doOverWrite: boolean=false): void {
        const lines: string[] = document.getText().split('\n');
        for (let index = 0; index < lines.length; index++) {
            const line = lines[index];
            this.loadLine(line, index, doOverWrite);
        }
    }

    public reloadDocument(document: vscode.TextDocument): void {
        this.clearAliases();
        this.loadDocument(document, true);
    }

    public provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, context: vscode.CompletionContext): vscode.CompletionItem[] | undefined {
        const line = document.lineAt(position).text.substring(0, position.character);
        if(!line.endsWith(this.completionTrigger)){
            return undefined;
        }
        const compList: vscode.CompletionItem[] = [];
        for (let index = 0; index < this.aliases.length; index++) {
            const alias = this.aliases[index];
            const compItem = new vscode.CompletionItem(alias.aliasName, vscode.CompletionItemKind.Function);
            compItem.detail = alias.detail;
            compItem.documentation = alias.documentation;
            compList.push(compItem);
        }
        return compList;
    }

    public provideDefinition(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): vscode.Location | undefined {
        const wordRange: vscode.Range | undefined = document.getWordRangeAtPosition(position, /\w+/);
        if (!wordRange) {
            return undefined;
        }
        const currentWord: string = document.lineAt(position.line).text.slice(wordRange.start.character, wordRange.end.character);
        const alias: AliasInformationHolder|undefined = this.getAlias(currentWord);
        if(alias === undefined){
            return undefined;
        }

        const uri = vscode.Uri.file(document.fileName);
        const pos = new vscode.Position(alias.row, 0);
        return new vscode.Location(uri, pos);
    }

    public provideHover(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): vscode.Hover|undefined {
        const wordRange: vscode.Range|undefined = document.getWordRangeAtPosition(position, /\w+/);
        if(!wordRange){
            return undefined;
        }
        const currentWord: string = document.lineAt(position.line).text.slice(wordRange.start.character, wordRange.end.character);
        
        const alias: AliasInformationHolder|undefined = this.getAlias(currentWord);

        if(alias === undefined){
            return undefined;
        }

        return new vscode.Hover(alias.documentation);
    }
}