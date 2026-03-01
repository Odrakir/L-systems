const canvas = document.querySelector<HTMLCanvasElement>('#canvas');
const renderButton = document.querySelector<HTMLButtonElement>('#render');
const axiomInput = document.querySelector<HTMLInputElement>('#axiom');
const rulesInput = document.querySelector<HTMLTextAreaElement>('#rules');
const iterationsInput = document.querySelector<HTMLInputElement>('#iterations');
const errorOutput = document.querySelector<HTMLElement>('#error-message');
const lengthOutput = document.querySelector<HTMLElement>('#final-length');
const previewOutput = document.querySelector<HTMLElement>('#preview');

if (
  !canvas ||
  !renderButton ||
  !axiomInput ||
  !rulesInput ||
  !iterationsInput ||
  !errorOutput ||
  !lengthOutput ||
  !previewOutput
) {
  throw new Error('Missing required UI elements.');
}

const context = canvas.getContext('2d');

if (!context) {
  throw new Error('Unable to acquire 2D rendering context.');
}

const MAX_OUTPUT_LENGTH = 2_000_000;

const resizeCanvas = (): void => {
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;

  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);

  context.setTransform(1, 0, 0, 1, 0, 0);
  context.scale(dpr, dpr);
};

const clearCanvas = (): void => {
  context.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
};

const parseRules = (rawRules: string): Map<string, string> => {
  const ruleMap = new Map<string, string>();
  const lines = rawRules.split('\n');

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex]?.trim() ?? '';

    if (!line) {
      continue;
    }

    const separatorIndex = line.indexOf('=');

    if (separatorIndex === -1 || line.indexOf('=', separatorIndex + 1) !== -1) {
      throw new Error(
        `Invalid rule on line ${lineIndex + 1}: expected format "X=..." with exactly one '='.`
      );
    }

    const key = line.slice(0, separatorIndex).trim();
    const replacement = line.slice(separatorIndex + 1).trim();

    if (key.length !== 1) {
      throw new Error(
        `Invalid rule on line ${lineIndex + 1}: key must be exactly one character.`
      );
    }

    ruleMap.set(key, replacement);
  }

  return ruleMap;
};

const rewrite = (axiom: string, rules: Map<string, string>, iterations: number): string => {
  let current = axiom;

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const nextParts: string[] = [];
    let nextLength = 0;

    for (const symbol of current) {
      const replacement = rules.get(symbol) ?? symbol;
      nextLength += replacement.length;

      if (nextLength > MAX_OUTPUT_LENGTH) {
        throw new Error(`Rewrite output exceeds ${MAX_OUTPUT_LENGTH.toLocaleString()} characters.`);
      }

      nextParts.push(replacement);
    }

    current = nextParts.join('');
  }

  return current;
};

const showResult = (finalString: string): void => {
  errorOutput.textContent = '';
  lengthOutput.textContent = finalString.length.toLocaleString();
  previewOutput.textContent = finalString.slice(0, 200);
};

const showError = (message: string): void => {
  errorOutput.textContent = message;
  lengthOutput.textContent = '-';
  previewOutput.textContent = '-';
};

window.addEventListener('resize', () => {
  resizeCanvas();
  clearCanvas();
});

renderButton.addEventListener('click', () => {
  clearCanvas();

  try {
    const rules = parseRules(rulesInput.value);
    const iterations = Number.parseInt(iterationsInput.value, 10);

    if (Number.isNaN(iterations) || iterations < 0) {
      throw new Error('Iterations must be a non-negative integer.');
    }

    const finalString = rewrite(axiomInput.value, rules, iterations);
    showResult(finalString);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error while rewriting.';
    showError(message);
  }
});

resizeCanvas();
clearCanvas();

const style = document.createElement('style');
style.textContent = `
  :root {
    color-scheme: light;
    font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
  }

  * {
    box-sizing: border-box;
  }

  html,
  body,
  #app {
    width: 100%;
    height: 100%;
    margin: 0;
  }

  #app {
    display: flex;
    min-height: 100vh;
    background: #f6f7f9;
  }

  #canvas {
    flex: 1;
    width: 100%;
    height: 100%;
    display: block;
    background: #ffffff;
  }

  .panel {
    width: 320px;
    padding: 20px;
    border-left: 1px solid #d6d9df;
    background: #fdfdfd;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .panel h1 {
    margin: 0 0 8px;
    font-size: 1.25rem;
  }

  .panel label {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-weight: 600;
    font-size: 0.9rem;
  }

  .panel input,
  .panel textarea,
  .panel button {
    font: inherit;
    padding: 8px 10px;
    border: 1px solid #c5c9d2;
    border-radius: 8px;
  }

  .panel textarea {
    resize: vertical;
  }

  .panel button {
    cursor: pointer;
    background: #2452ff;
    color: #fff;
    border-color: #2452ff;
    font-weight: 700;
  }

  .results {
    margin-top: 8px;
    padding-top: 12px;
    border-top: 1px solid #e0e3ea;
    display: grid;
    gap: 8px;
    font-size: 0.9rem;
  }

  .results p {
    margin: 0;
  }

  .error {
    color: #b42318;
    min-height: 1.25rem;
  }

  #preview {
    word-break: break-all;
  }
`;
document.head.append(style);
