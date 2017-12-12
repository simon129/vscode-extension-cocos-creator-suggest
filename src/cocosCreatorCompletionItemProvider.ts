import * as vscode from 'vscode';
import * as cocosGlobals from './globals';

import * as fs from 'fs'
import * as path from 'path';

import * as FileHound from 'filehound';
import * as acorn from 'acorn/dist/acorn_loose';

export class CocosCreatorCompletionItemProvider implements vscode.CompletionItemProvider {
    private map: Map<string, any>;

    constructor(folder: vscode.WorkspaceFolder) {
        this.map = new Map<string, any>();

        console.time('parse AST');
        var fsPath = path.resolve(folder.uri.fsPath, 'assets');
        this.generateAst(fsPath)
            .catch(err => {
                console.error(err);
            }).then(_ => {
                console.timeEnd('parse AST')
            });
    }

    public provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, context: vscode.CompletionContext): Thenable<vscode.CompletionItem[]> {
        var result = [];
        if (position.character >= 5) {
            // check if the prefix is ' this.' or '.node.'
            var distance = position.character > 5 ? 6 : 5;
            var startPosition = new vscode.Position(position.line, position.character - distance);
            var range = new vscode.Range(startPosition, position);
            var prefix = document.getText(range);
            // add cc.Component to this
            if (prefix === 'this.' || prefix === ' this.') {
                this.addCompletion(result, cocosGlobals.componentFunctions, true);
                this.addCompletion(result, cocosGlobals.componentProperties, false);

                try {
                    var ast = this.map[document.uri.fsPath];
                    var body = this.getBody(ast.body)
                    this.addCompletionAST(result, body.methods, true);
                    this.addCompletionAST(result, body.properties, false);
                }
                catch (e) {
                    vscode.window.showErrorMessage(e);
                }
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

    private addCompletion(completionItems: vscode.CompletionItem[], entries: any, isFunction: boolean) {
        for (var name in entries) {
            var proposal = new vscode.CompletionItem(name);
            proposal.kind = isFunction ? vscode.CompletionItemKind.Function : vscode.CompletionItemKind.Property;
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

    private addCompletionAST(completionItems: vscode.CompletionItem[], entries: any, isFunction: boolean) {
        entries.forEach(node => {
            var name = node.key.name;
            var proposal = new vscode.CompletionItem(name);
            proposal.kind = isFunction ? vscode.CompletionItemKind.Function : vscode.CompletionItemKind.Property;
            proposal.detail = name;
            proposal.documentation = name;
            // make it to first item
            proposal.sortText = '';
            completionItems.push(proposal);
        });
    }

    private generateAst(fsPath): Promise<any> {
        return FileHound.create()
            .paths(fsPath)
            .ext('js')
            .find()
            .then(files => {
                // series (promise chain)
                var p = Promise.resolve();
                files.forEach(file => {
                    p = p.then(() => new Promise<any>((resolve, reject) => {
                        fs.readFile(file, 'utf8', (err, data) => {
                            if (err) { return reject(err); }

                            var data = fs.readFileSync(file, 'utf8');
                            this.map[file] = acorn.parse_dammit(data);
                            return resolve();
                        });
                    }));
                });
                return p;

                // series (block/sync)
                // files.forEach(file => {
                //     var data = fs.readFileSync(file, 'utf8');
                //     this.map[file] = acorn.parse_dammit(data);
                // });

                // parallel (promise.all)
                // return Promise.all(
                //     files.map(file => {
                //         return new Promise<any>((resolve, reject) => {
                //             fs.readFile(file, 'utf8', (err, data) => {
                //                 if (err) { return reject(err); }
                //                 var data = fs.readFileSync(file, 'utf8');
                //                 this.map[file] = acorn.parse_dammit(data);
                //                 return resolve();
                //             });
                //         })
                //     })
                // );
            });
    }

    private getBody(body: any): any {
        var clazzes = body
            .map(node => {
                // var Lobby = cc.Class({})
                var expression = null;
                if (node.type == 'VariableDeclaration' && node.declarations[0].init.type == 'CallExpression') {
                    expression = node.declarations[0].init;

                    // cc.Class({})
                } else if (node.type == 'ExpressionStatement' && node.expression.type == 'CallExpression') {
                    expression = node.expression;
                }

                if (expression) {
                    var { object, property } = expression.callee;
                    if (object && object.name == 'cc' && property && property.name == 'Class') {
                        // {} in cc.Class({})
                        var properties = expression.arguments[0].properties
                        return {
                            node: node,

                            methods: properties.filter(prop => {
                                return ['extends', 'properties'].indexOf(prop.key.name) == -1
                            }),

                            properties: (
                                properties.find(prop => prop.key.name == 'properties')
                                || { value: { properties: [] } }
                            ).value.properties,
                        }
                    }
                }
            })
            .filter(x => x)

        return clazzes[0];

        // clazzes.forEach((clazz, i) => {
        //     clazz.methods.forEach(method => {
        //         console.log('methods:', method.key.name)
        //     });

        //     clazz.properties.forEach(prop => {
        //         console.log('properties:', prop.key.name);
        //     })
        // });
    }

}