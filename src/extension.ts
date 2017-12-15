import * as vscode from 'vscode';

import { CocosCreatorCompletionItemProvider } from './cocosCreatorCompletionItemProvider';
import { Ast } from './ast';
import { isCocosCreatorProjectFolder } from './util';

export function activate(context: vscode.ExtensionContext) {
    if (isCocosCreatorProjectFolder()) {
        var ast = new Ast();

        context.subscriptions.push(
            vscode.languages.registerCompletionItemProvider(
                'javascript',
                new CocosCreatorCompletionItemProvider(ast),
                '.',
            )
        );
    }
}
