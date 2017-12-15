// https://github.com/Microsoft/vscode-go/blob/master/src/util.ts
import * as vscode from 'vscode'

import * as path from 'path';
import * as fs from 'fs';
import { isString } from 'util';

export function isCocosCreatorProjectFolder(): boolean {
	if (!vscode.workspace.workspaceFolders) {
		return false;
	}

	var rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
	if (!fs.existsSync(path.resolve(rootPath, 'assets'))) {
		return false;
	}

	try {
		var jsonPath = path.resolve(rootPath, 'project.json');
		var json = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
	} catch (e) { }

	return json && json.engine === 'cocos2d-html5';
}

export function isCocosCreatorProjectFile(document: vscode.TextDocument | string): boolean {
	if (!vscode.workspace.workspaceFolders) {
		return false;
	}

	var fsPath = isString(document) ? document : document.uri.fsPath;
	if (path.extname(fsPath).toLowerCase() !== '.js') {
		return false;
	}

	var rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
	var relative = path.relative(rootPath, fsPath);
	var inAssets = relative.split(path.sep)[0].toLocaleLowerCase() == 'assets';
	return inAssets;
}

export function isPositionInString(document: vscode.TextDocument, position: vscode.Position): boolean {
	let lineText = document.lineAt(position.line).text;
	let lineTillCurrentPosition = lineText.substr(0, position.character);

	// Count the number of double quotes in the line till current position. Ignore escaped double quotes
	let doubleQuotesCnt = (lineTillCurrentPosition.match(/\"/g) || []).length;
	let escapedDoubleQuotesCnt = (lineTillCurrentPosition.match(/\\\"/g) || []).length;

	doubleQuotesCnt -= escapedDoubleQuotesCnt;
	return doubleQuotesCnt % 2 === 1;
}

export function byteOffsetAt(document: vscode.TextDocument, position: vscode.Position): number {
	let offset = document.offsetAt(position);
	let text = document.getText();
	return Buffer.byteLength(text.substr(0, offset));
}