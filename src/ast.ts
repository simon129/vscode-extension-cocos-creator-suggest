import { Disposable, TextDocument, window, workspace } from 'vscode';
import { Program, Expression, CallExpression, MemberExpression, Identifier, ObjectExpression, Property, Node } from 'estree';

import * as acorn from 'acorn/dist/acorn_loose';
import * as FileHound from 'filehound';

import * as path from 'path';
import * as fs from 'fs'

import { isString } from 'util';

import { isCocosCreatorProjectFile } from './util';

interface LineColumn {
	line: Number,
	column: Number,
}

export interface Comment {
	block: boolean,
	text: any,
	start: number
	end: number,
	loc: LineColumn,
	range?: LineColumn,
}

export class Ast {
	private map: Map<string, Program>;
	private comments: Map<string, Comment[]>;
	private _disposable: Disposable;

	constructor() {
		this.map = new Map<string, Program>();
		this.comments = new Map<string, Comment[]>();

		this.tryParseAstDocument(window.activeTextEditor.document)

		let subscriptions: Disposable[] = [];

		workspace.onDidOpenTextDocument(this.tryParseAstDocument, this, subscriptions);
		workspace.onDidSaveTextDocument(this.tryParseAstDocument, this, subscriptions);

		this._disposable = Disposable.from(...subscriptions);

		// parse entire assets folder
		// console.time('parse assets folder');
		// this.parseAstAssetsFolder()
		//     .catch(err => {
		//         window.showErrorMessage(err);
		//     }).then(_ => {
		//         console.timeEnd('parse assets folder')
		//     });

	}

	/** 如果是creator 的js 檔案就parse ast */
	private tryParseAstDocument(document: TextDocument | string): Promise<any> {
		var fsPath = isString(document) ? document : document.uri.fsPath;
		if (isCocosCreatorProjectFile(fsPath)) {
			return new Promise<any>((resolve, reject) => {
				fs.readFile(fsPath, 'utf8', (err, data) => {
					if (err) { return reject(err); }

					this.parseAstBody(fsPath, data);
					console.log(fsPath);
					resolve();
				});
			}).catch(err => {
				console.error(err);
				window.showErrorMessage(err);
			});
		} else {
			return Promise.resolve();
		}
	}

	/** 讀取檔案並且解析AST */
	private parseAstBody(key: string, data: string) {
		var comments = [];
		this.comments.set(key, comments)

		var ast: Program = acorn.parse_dammit(data, {
			locations: true,
			onComment: (block, text, start, end, loc) => {
				comments.push({ block, text, start, end, loc, });
			}
		});
		this.map.set(key, ast);
	}

	public getComments(key: string): Comment[] {
		return this.comments.get(key) || [];
	}

	/** 把acorn 解析過的AST 整理出 Creator 的 property 跟 method */
	public getAstBody(fsPath: string): { node: Node, methods: Property[], properties: Property[] } {
		var ast = this.map.get(fsPath);
		var clazzes = ast.body
			.map(node => {
				var callExpression: CallExpression = null;

				// var Lobby = cc.Class({})
				if (node.type == 'VariableDeclaration') {
					let expression = node.declarations[0].init
					if (expression.type == 'CallExpression') {
						callExpression = expression;
					}

					// cc.Class({})
				} else if (node.type == 'ExpressionStatement') {
					let expression = node.expression;
					if (expression.type == 'CallExpression') {
						callExpression = expression;
					}
				}

				if (callExpression) {
					var callee = callExpression.callee;
					if (callee.type == 'MemberExpression') {
						var { object, property } = callee;
						if (object && (object as Identifier).name == 'cc' && property && (property as Identifier).name == 'Class') {
							// {} in cc.Class({})
							var properties = ((callExpression.arguments as Array<Expression>)[0] as ObjectExpression).properties;

							// 過濾掉 extends, properties 的應該就是他的所有 methods
							var ccClassMethods = properties.filter(prop => {
								return ['extends', 'editor', 'properties'].indexOf((prop.key as Identifier).name) == -1;
							});

							// 找出叫做 'properties' 的那一項 property
							var propertyCalledProperties = properties.find(prop => (prop.key as Identifier).name == 'properties');

							// 如果有的話, 取出他的下面的 properties
							var ccClassProperties = propertyCalledProperties ? (propertyCalledProperties.value as ObjectExpression).properties : [];

							return {
								node: node,
								methods: ccClassMethods,
								properties: ccClassProperties,
							}
						}
					}
				}
			})
			.filter(x => x)

		return clazzes[0];

		// clazzes.forEach((clazz, i) => {
		// 	clazz.methods.forEach(method => {
		// 		console.log('methods:', (method.key as Identifier).name)
		// 	});

		// 	clazz.properties.forEach(prop => {
		// 		console.log('properties:', (prop.key as Identifier).name);
		// 	})
		// });
	}

	/** 處理assets目錄下面所有的js檔案 */
	private parseAstAssetsFolder(): Promise<any> {
		var fsPath = path.resolve(workspace.workspaceFolders[0].uri.fsPath, 'assets');
		return FileHound.create()
			.paths(fsPath)
			.ext('js')
			.find()
			.then(files => {
				// series (promise chain)
				// var p = Promise.resolve();
				// files.forEach(file => {
				//     p = p.then(() => this.generateAstByFile(file));
				// });
				// return p;

				return files.reduce((p, file) => {
					return p.then(() => this.tryParseAstDocument(file))
				}, Promise.resolve());

				// series(block/sync)
				// files.forEach(file => {
				//     var data = fs.readFileSync(file, 'utf8');
				//     this.parseAstBody(file, data)
				// });
				// return Promise.resolve();

				// parallel (promise.all)
				// return Promise.all(
				//     files.map(file => this.generateAstByFile(file))
				// );
			});
	}
}