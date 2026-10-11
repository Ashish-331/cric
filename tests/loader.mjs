import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const mockAsyncStorageURL = pathToFileURL(path.resolve('./tests/mockAsyncStorage.mjs')).href;
const mockReactNativeURL = pathToFileURL(path.resolve('./tests/mockReactNative.mjs')).href;
const mockExpoSqliteURL = pathToFileURL(path.resolve('./tests/mockExpoSqlite.mjs')).href;

export async function resolve(specifier, context, nextResolve) {
  if (specifier === '@react-native-async-storage/async-storage') {
    return {
      url: mockAsyncStorageURL,
      shortCircuit: true,
    };
  }

  if (specifier === 'react-native') {
    return {
      url: mockReactNativeURL,
      shortCircuit: true,
    };
  }

  if (specifier === 'expo-sqlite') {
    return {
      url: mockExpoSqliteURL,
      shortCircuit: true,
    };
  }

  if (specifier.startsWith('.') || specifier.startsWith('/')) {
    try {
      return await nextResolve(specifier, context);
    } catch (err) {
      if (err.code === 'ERR_MODULE_NOT_FOUND') {
        const parentURL = context.parentURL ? new URL(context.parentURL) : pathToFileURL(process.cwd() + '/');
        const resolvedURL = new URL(specifier, parentURL);
        const filePath = fileURLToPath(resolvedURL);
        for (const ext of ['.ts', '.tsx', '.js', '/index.ts', '/index.tsx', '/index.js']) {
          if (fs.existsSync(filePath + ext)) {
            return nextResolve(pathToFileURL(filePath + ext).href, context);
          }
        }
      }
      throw err;
    }
  }
  return nextResolve(specifier, context);
}
