import globals from 'globals';

import pluginVanilla from '@eslint/js';
import pluginPrettier from 'eslint-config-prettier';
import pluginReact from 'eslint-plugin-react';
import pluginReactHooks from 'eslint-plugin-react-hooks';
import pluginReactRefresh from 'eslint-plugin-react-refresh';
import pluginTypescript from 'typescript-eslint';

const pluginReactWrapper = {
	settings: { react: { version: 'detect' } },
	...pluginReact.configs.flat.recommended,
};

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
	pluginReactWrapper,
	pluginReactHooksWrapper,
	pluginReactRefresh.configs.recommended,
	{
		rules: {
			'no-unused-expressions': 'off',
			'react/prop-types': 'off',
			'react/react-in-jsx-scope': 'off',
			'@typescript-eslint/no-unused-expressions': 'off',
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
		files: ['**/*.test.{ts,tsx}'],
		rules: {
			'react-refresh/only-export-components': 'off',
		},
	},
];
