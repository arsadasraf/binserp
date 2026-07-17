import js from "@eslint/js";

export default [
    js.configs.recommended,
    {
        ignores: ["node_modules/**", "dist/**"]
    },
    {
        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "module",
            globals: {
                console: "readonly",
                process: "readonly",
                setTimeout: "readonly",
                clearTimeout: "readonly",
                setInterval: "readonly",
                clearInterval: "readonly",
                __dirname: "readonly",
                __filename: "readonly",
                module: "readonly",
                exports: "readonly",
                require: "readonly",
                Buffer: "readonly",
                fetch: "readonly",
                URL: "readonly"
            }
        },
        rules: {
            "no-unused-vars": "warn",
            "no-undef": "warn"
        }
    }
];
