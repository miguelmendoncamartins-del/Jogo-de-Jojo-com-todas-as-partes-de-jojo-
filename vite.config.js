import { defineConfig } from 'vite';
import { cpSync } from 'node:fs';

const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1];
const base = process.env.GITHUB_ACTIONS === 'true' && repositoryName
  ? `/${repositoryName}/`
  : '/';

export default defineConfig({
  base,
  plugins: [{
    name: 'copy-jojo-sprites-for-static-runtime',
    apply: 'build',
    closeBundle() {
      cpSync('Jojo-Sprite', 'dist/Jojo-Sprite', { recursive: true });
    },
  }],
});
