import { Disposable, CompletionItemProvider, window, workspace, TextDocument, Position, CancellationToken, CompletionContext, CompletionItem, Range, CompletionItemKind } from 'vscode';
import { Property, Identifier } from 'estree';

import * as cocosGlobals from './globals';
import { Ast, Comment } from './ast';
import { isCocosCreatorProjectFile } from './util';

export class CocosCreatorCompletionItemProvider implements CompletionItemProvider {
    private ast: Ast;

    constructor(ast: Ast) {
        this.ast = ast;
    }

    /** CompletionItemProvider 主要的進入點 */
    public provideCompletionItems(document: TextDocument, position: Position, token: CancellationToken, context: CompletionContext): Thenable<CompletionItem[]> {
        var result = [];
        if (position.character >= 5 && isCocosCreatorProjectFile(document)) {
            // check if the prefix is ' this.' or '.node.'
            var distance = position.character > 5 ? 6 : 5;
            var startPosition = new Position(position.line, position.character - distance);
            var range = new Range(startPosition, position);
            var prefix = document.getText(range);
            // add cc.Component to this
            if (prefix === 'this.' || prefix === ' this.') {
                try {
                    var body = this.ast.getAstBody(document.uri.fsPath);
                    this.addCompletionAST(result, body.methods, true, document.uri.fsPath);
                    this.addCompletionAST(result, body.properties, false, document.uri.fsPath);
                }
                catch (e) {
                    window.showErrorMessage(e);
                }

                this.addCompletion(result, cocosGlobals.componentFunctions, true);
                this.addCompletion(result, cocosGlobals.componentProperties, false);
            }
            // add cc.Node to xxx.node
            if (prefix === '.node.') {
                // add our completions
                this.addCompletion(result, cocosGlobals.nodeFunctions, true);
                this.addCompletion(result, cocosGlobals.nodeProperties, false);
            }
        }
        return Promise.resolve(result);
    }

    /** 找出特定行數的註解 */
    private findComment(allComments: Comment[], line: number): Comment {
        return (allComments || []).find(c => c.loc.line == line);
    }

    /** 把提示項目加入最後結果(Creator原生的項目) */
    private addCompletion(completionItems: CompletionItem[], entries: any, isFunction: boolean) {
        for (var name in entries) {
            var proposal = new CompletionItem(name);
            proposal.kind = isFunction ? CompletionItemKind.Function : CompletionItemKind.Property;
            var entry = entries[name];
            if (entry.description) {
                proposal.documentation = entry.description;
            }
            if (entry.signature) {
                proposal.detail = entry.signature;
            }
            completionItems.push(proposal);
        }
    };

    /** 把提示項目加入最後結果(我們自己解析的) */
    private addCompletionAST(completionItems: CompletionItem[], entries: Property[], isFunction: boolean, key: string) {
        entries.forEach(node => {
            var name = (node.key as Identifier).name;

            var proposal = new CompletionItem(name, isFunction ? CompletionItemKind.Function : CompletionItemKind.Property);
            proposal.detail = name;

            var allComments = this.ast.getComments(key);
            var methodLine = node.loc.start.line;
            var comment = this.findComment(allComments, methodLine) || this.findComment(allComments, methodLine - 1);
            proposal.documentation = comment && comment.text || name;

            // make it to top
            proposal.sortText = isFunction ? '00' : '01';
            completionItems.push(proposal);
        });
    }
}