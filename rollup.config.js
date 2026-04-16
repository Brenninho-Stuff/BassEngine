import terser from '@rollup/plugin-terser';
import resolve from '@rollup/plugin-node-resolve';

const input = 'bass-engine.js';

const banner = `/*!
 * BassEngine v1.0.0
 * https://github.com/Brenninho/BassEngine
 * Apache-2.0 License
 */`;

const terserOptions = {
  compress: {
    passes: 2,
    drop_console: true,
  },
  format: {
    comments: /^!/,  // keep the banner comment
  },
};

export default [
  // ── ESM  (for bundlers / import)
  {
    input,
    plugins: [resolve()],
    output: {
      file: 'dist/bass-engine.esm.js',
      format: 'es',
      banner,
      sourcemap: true,
    },
  },

  // ── CommonJS  (for Node / require())
  {
    input,
    plugins: [resolve()],
    output: {
      file: 'dist/bass-engine.cjs.js',
      format: 'cjs',
      exports: 'named',
      banner,
      sourcemap: true,
    },
  },

  // ── UMD  (for <script> tag / CDN)
  {
    input,
    plugins: [resolve()],
    output: {
      file: 'dist/bass-engine.umd.js',
      format: 'umd',
      name: 'BassEngine',
      exports: 'named',
      banner,
      sourcemap: true,
    },
  },

  // ── Minified UMD  (for unpkg / CDN production use)
  {
    input,
    plugins: [resolve(), terser(terserOptions)],
    output: {
      file: 'dist/bass-engine.min.js',
      format: 'umd',
      name: 'BassEngine',
      exports: 'named',
      banner,
      sourcemap: false,
    },
  },
];
