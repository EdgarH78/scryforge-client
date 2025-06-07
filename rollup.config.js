import typescript from 'rollup-plugin-typescript2';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

export default {
  input: 'src/main.ts', // entry point of your TS code
  output: {
    file: 'dist/main.js',
    format: 'iife', // "Immediately Invoked Function Expression" — runs in global scope
    name: 'ScryForge', // global name (can be anything)
    sourcemap: true,
    globals: {
      'pixi.js': 'PIXI'
    }
  },
  plugins: [
    resolve(), // This plugin helps Rollup find modules in node_modules
    commonjs(),
    typescript()
  ],
  external: ['pixi.js']
};
