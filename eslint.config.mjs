import globals from 'globals';

import eslintReact from '@eslint-react/eslint-plugin';
import pluginVanilla from '@eslint/js';
import pluginPrettier from 'eslint-config-prettier';
import pluginReactHooks from 'eslint-plugin-react-hooks';
import pluginReactRefresh from 'eslint-plugin-react-refresh';
import pluginTypescript from 'typescript-eslint';

const pluginReactHooksWrapper = {
	plugins: { 'react-hooks': pluginReactHooks },
	rules: pluginReactHooks.configs.recommended.rules,
};

/** @type {import('eslint').Linter.Config[]} */
export default [
	{ ignores: ['dist/**', 'node_modules/**', '.vibe/**', '.pnpm-store/**', '**/coverage'] },
	{ files: ['**/*.{js,mjs,cjs,ts,tsx}'] },
	{
		languageOptions: {
			globals: { ...globals.node },
		},
	},
	pluginVanilla.configs.recommended,
	pluginPrettier,
	...pluginTypescript.configs.recommended,
	eslintReact.configs.recommended,
	pluginReactHooksWrapper,
	pluginReactRefresh.configs.recommended,
	{
		rules: {
			'no-unused-expressions': 'off',
			'@typescript-eslint/no-unused-expressions': 'off',
			'@eslint-react/no-array-index-key': 'off',
			'@typescript-eslint/no-explicit-any': 'off',
			'@typescript-eslint/consistent-type-imports': 'error',
			'@typescript-eslint/no-unused-vars': [
				'error',
				{
					args: 'all',
					argsIgnorePattern: '^_',
					caughtErrors: 'all',
					caughtErrorsIgnorePattern: '^_',
					destructuredArrayIgnorePattern: '^_',
					varsIgnorePattern: '^_',
					ignoreRestSiblings: false,
				},
			],
		},
	},
	{
		files: ['**/*.test.{ts,tsx}', 'tests/helpers/**/*.ts'],
		rules: {
			'react-refresh/only-export-components': 'off',
			'@eslint-react/no-unnecessary-use-prefix': 'off',
		},
	},
];
