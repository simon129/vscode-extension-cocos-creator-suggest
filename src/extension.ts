import * as vscode from 'vscode';

import { CocosCreatorCompletionItemProvider } from './cocosCreatorCompletionItemProvider';


export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(
            'javascript',
            new CocosCreatorCompletionItemProvider(vscode.workspace.workspaceFolders[0]),
            '.',
        )
    );
}
