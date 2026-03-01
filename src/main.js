const canvas = document.querySelector('#canvas');
const renderButton = document.querySelector('#render');
const axiomInput = document.querySelector('#axiom');
const rulesInput = document.querySelector('#rules');
const iterationsInput = document.querySelector('#iterations');
const angleInput = document.querySelector('#angle');
const stepInput = document.querySelector('#step');
const errorOutput = document.querySelector('#error-message');
const lengthOutput = document.querySelector('#final-length');
const previewOutput = document.querySelector('#preview');
const boundsOutput = document.querySelector('#bounds');
const maxStackDepthOutput = document.querySelector('#max-stack-depth');
if (!canvas ||
    !renderButton ||
    !axiomInput ||
    !rulesInput ||
    !iterationsInput ||
    !angleInput ||
    !stepInput ||
    !errorOutput ||
    !lengthOutput ||
    !previewOutput ||
    !boundsOutput ||
    !maxStackDepthOutput) {
    throw new Error('Missing required UI elements.');
}
const context = canvas.getContext('2d');
if (!context) {
    throw new Error('Unable to acquire 2D rendering context.');
}
const MAX_OUTPUT_LENGTH = 2000000;
const CANVAS_PADDING_PX = 20;
let currentDpr = window.devicePixelRatio || 1;
const resizeCanvas = () => {
    const dpr = window.devicePixelRatio || 1;
    currentDpr = dpr;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.scale(dpr, dpr);
};
const clearCanvas = () => {
    context.setTransform(currentDpr, 0, 0, currentDpr, 0, 0);
    context.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
};
const parseRules = (rawRules) => {
    const ruleMap = new Map();
    const lines = rawRules.split('\n');
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
        const line = lines[lineIndex]?.trim() ?? '';
        if (!line) {
            continue;
        }
        const separatorIndex = line.indexOf('=');
        if (separatorIndex === -1 || line.indexOf('=', separatorIndex + 1) !== -1) {
            throw new Error(`Invalid rule on line ${lineIndex + 1}: expected format "X=..." with exactly one '='.`);
        }
        const key = line.slice(0, separatorIndex).trim();
        const replacement = line.slice(separatorIndex + 1).trim();
        if (key.length !== 1) {
            throw new Error(`Invalid rule on line ${lineIndex + 1}: key must be exactly one character.`);
        }
        ruleMap.set(key, replacement);
    }
    return ruleMap;
};
const rewrite = (axiom, rules, iterations) => {
    let current = axiom;
    for (let iteration = 0; iteration < iterations; iteration += 1) {
        const nextParts = [];
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
const computeBounds = (sentence, angleDeg, step) => {
    const angleRadians = (angleDeg * Math.PI) / 180;
    const state = { x: 0, y: 0, headingRadians: -Math.PI / 2 };
    const stack = [];
    let minX = state.x;
    let minY = state.y;
    let maxX = state.x;
    let maxY = state.y;
    let maxStackDepth = 0;
    const updateBounds = () => {
        minX = Math.min(minX, state.x);
        minY = Math.min(minY, state.y);
        maxX = Math.max(maxX, state.x);
        maxY = Math.max(maxY, state.y);
    };
    const moveForward = () => {
        state.x += Math.cos(state.headingRadians) * step;
        state.y += Math.sin(state.headingRadians) * step;
        updateBounds();
    };
    for (const symbol of sentence) {
        switch (symbol) {
            case 'F':
            case 'f':
                moveForward();
                break;
            case '+':
                state.headingRadians += angleRadians;
                break;
            case '-':
                state.headingRadians -= angleRadians;
                break;
            case '[':
                stack.push({ ...state });
                maxStackDepth = Math.max(maxStackDepth, stack.length);
                break;
            case ']': {
                const previous = stack.pop();
                if (previous) {
                    state.x = previous.x;
                    state.y = previous.y;
                    state.headingRadians = previous.headingRadians;
                    updateBounds();
                }
                break;
            }
            default:
                break;
        }
    }
    return { minX, minY, maxX, maxY, maxStackDepth };
};
const drawLSystem = (ctx, sentence, angleDeg, step) => {
    const bounds = computeBounds(sentence, angleDeg, step);
    const angleRadians = (angleDeg * Math.PI) / 180;
    const drawingWidth = bounds.maxX - bounds.minX;
    const drawingHeight = bounds.maxY - bounds.minY;
    const availableWidth = Math.max(canvas.clientWidth - CANVAS_PADDING_PX * 2, 1);
    const availableHeight = Math.max(canvas.clientHeight - CANVAS_PADDING_PX * 2, 1);
    const widthScale = drawingWidth > 0 ? availableWidth / drawingWidth : Number.POSITIVE_INFINITY;
    const heightScale = drawingHeight > 0 ? availableHeight / drawingHeight : Number.POSITIVE_INFINITY;
    const scale = Math.min(widthScale, heightScale, 1000000);
    const offsetX = CANVAS_PADDING_PX +
        (availableWidth - drawingWidth * scale) / 2 -
        bounds.minX * scale;
    const offsetY = CANVAS_PADDING_PX +
        (availableHeight - drawingHeight * scale) / 2 -
        bounds.minY * scale;
    ctx.setTransform(currentDpr, 0, 0, currentDpr, 0, 0);
    ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    ctx.setTransform(currentDpr * scale, 0, 0, currentDpr * scale, currentDpr * offsetX, currentDpr * offsetY);
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = Math.max(1 / scale, 0.5 / scale);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const state = { x: 0, y: 0, headingRadians: -Math.PI / 2 };
    const stack = [];
    ctx.beginPath();
    ctx.moveTo(state.x, state.y);
    for (const symbol of sentence) {
        switch (symbol) {
            case 'F': {
                state.x += Math.cos(state.headingRadians) * step;
                state.y += Math.sin(state.headingRadians) * step;
                ctx.lineTo(state.x, state.y);
                break;
            }
            case 'f':
                state.x += Math.cos(state.headingRadians) * step;
                state.y += Math.sin(state.headingRadians) * step;
                ctx.moveTo(state.x, state.y);
                break;
            case '+':
                state.headingRadians += angleRadians;
                break;
            case '-':
                state.headingRadians -= angleRadians;
                break;
            case '[':
                stack.push({ ...state });
                break;
            case ']': {
                const previous = stack.pop();
                if (previous) {
                    state.x = previous.x;
                    state.y = previous.y;
                    state.headingRadians = previous.headingRadians;
                    ctx.moveTo(state.x, state.y);
                }
                break;
            }
            default:
                break;
        }
    }
    ctx.stroke();
};
const formatBounds = (bounds) => `${bounds.minX.toFixed(2)}, ${bounds.minY.toFixed(2)} → ${bounds.maxX.toFixed(2)}, ${bounds.maxY.toFixed(2)}`;
const showResult = (finalString, bounds) => {
    errorOutput.textContent = '';
    lengthOutput.textContent = finalString.length.toLocaleString();
    previewOutput.textContent = finalString.slice(0, 200);
    boundsOutput.textContent = formatBounds(bounds);
    maxStackDepthOutput.textContent = bounds.maxStackDepth.toLocaleString();
};
const showError = (message) => {
    errorOutput.textContent = message;
    lengthOutput.textContent = '-';
    previewOutput.textContent = '-';
    boundsOutput.textContent = '-';
    maxStackDepthOutput.textContent = '-';
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
        const angle = Number.parseFloat(angleInput.value);
        const step = Number.parseFloat(stepInput.value);
        if (Number.isNaN(angle) || !Number.isFinite(angle)) {
            throw new Error('Angle must be a finite number.');
        }
        if (Number.isNaN(step) || !Number.isFinite(step) || step < 0) {
            throw new Error('Step must be a non-negative finite number.');
        }
        const finalString = rewrite(axiomInput.value, rules, iterations);
        const bounds = computeBounds(finalString, angle, step);
        drawLSystem(context, finalString, angle, step);
        showResult(finalString, bounds);
    }
    catch (error) {
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
