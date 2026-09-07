import { AsyncLocalStorage } from "node:async_hooks";
const context = new AsyncLocalStorage();
export const activeDesignTokens = () => context.getStore();
export const withDesignTokens = (tokens, render) => context.run(tokens, render);
