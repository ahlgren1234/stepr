// The demo shows the README's framework examples. The README is the source;
// this keeps the copies on the demo page identical to it.
import { readFileSync } from 'node:fs';
import { Window } from 'happy-dom';
import { expect, test } from 'vitest';

const readme = readFileSync('README.md', 'utf8');
const { document } = new Window();
document.write(readFileSync('demo/index.html', 'utf8'));

for (const language of ['tsx', 'vue']) {
  test(`the demo's ${language} example matches the README`, () => {
    const blocks = [
      ...readme.matchAll(
        new RegExp(`\`\`\`${language}\\n([\\s\\S]*?)\`\`\``, 'g'),
      ),
    ];
    expect(blocks).toHaveLength(1);
    const code = document.querySelector(`pre[data-example="${language}"]`);
    expect(code.textContent).toBe(blocks[0][1].trimEnd());
  });
}
