import './styles.css';
const canvas = document.querySelector<HTMLCanvasElement>('#canvas');
const renderButton = document.querySelector<HTMLButtonElement>('#render');
const resetViewButton = document.querySelector<HTMLButtonElement>('#reset-view');
const exportButton = document.querySelector<HTMLButtonElement>('#export-png');
const presetsSelect = document.querySelector<HTMLSelectElement>('#presets');
const axiomInput = document.querySelector<HTMLInputElement>('#axiom');
const rulesInput = document.querySelector<HTMLTextAreaElement>('#rules');
const iterationsInput = document.querySelector<HTMLInputElement>('#iterations');
const angleInput = document.querySelector<HTMLInputElement>('#angle');
const stepInput = document.querySelector<HTMLInputElement>('#step');
const maxSymbolsInput = document.querySelector<HTMLInputElement>('#max-symbols');
const errorOutput = document.querySelector<HTMLElement>('#error-message');
const progressOutput = document.querySelector<HTMLElement>('#progress');
const lengthOutput = document.querySelector<HTMLElement>('#final-length');
const previewOutput = document.querySelector<HTMLElement>('#preview');
const boundsOutput = document.querySelector<HTMLElement>('#bounds');
const maxStackDepthOutput = document.querySelector<HTMLElement>('#max-stack-depth');

if (
  !canvas ||
  !renderButton ||
  !resetViewButton ||
  !exportButton ||
  !presetsSelect ||
  !axiomInput ||
  !rulesInput ||
  !iterationsInput ||
  !angleInput ||
  !stepInput ||
  !maxSymbolsInput ||
  !errorOutput ||
  !progressOutput ||
  !lengthOutput ||
  !previewOutput ||
  !boundsOutput ||
  !maxStackDepthOutput
) {
  throw new Error('Missing required UI elements.');
}

const context = canvas.getContext('2d');

if (!context) {
  throw new Error('Unable to acquire 2D rendering context.');
}

const DEFAULT_MAX_OUTPUT_LENGTH = 2_000_000;
const CANVAS_PADDING_PX = 20;
const ZOOM_MIN = 0.1;
const ZOOM_MAX = 20;

const presets = {
  tree: {
    axiom: 'F',
    rules: 'F=FF-[-F+F+F]+[+F-F-F]',
    iterations: '4',
    angle: '22.5',
    step: '5',
    maxSymbols: String(DEFAULT_MAX_OUTPUT_LENGTH)
  },
  bush: {
    axiom: 'X',
    rules: 'X=F-[[X]+X]+F[+FX]-X\nF=FF',
    iterations: '5',
    angle: '25',
    step: '3',
    maxSymbols: String(DEFAULT_MAX_OUTPUT_LENGTH)
  },
  fractal: {
    axiom: 'F-F-F-F',
    rules: 'F=F-F+F+FF-F-F+F',
    iterations: '3',
    angle: '90',
    step: '4',
    maxSymbols: String(DEFAULT_MAX_OUTPUT_LENGTH)
  }
} as const;

type PresetName = keyof typeof presets;

type RenderInputs = {
  axiom: string;
  rulesText: string;
  iterations: number;
  angle: number;
  step: number;
  maxSymbols: number;
};

type TurtleState = {
  x: number;
  y: number;
  headingRadians: number;
};

type TurtleBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  maxStackDepth: number;
};

type RenderModel = {
  sentence: string;
  bounds: TurtleBounds;
  angle: number;
  step: number;
};

type RewriteResult = {
  sentence: string;
  completedIterations: number;
};

let currentDpr = window.devicePixelRatio || 1;
let zoom = 1;
let panX = 0;
let panY = 0;
let lastModel: RenderModel | null = null;
let lastRewriteKey = '';
let lastRewriteResult = '';
let isDragging = false;
let lastPointerX = 0;
let lastPointerY = 0;
let currentRenderToken = 0;

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const resizeCanvas = (): void => {
  const dpr = window.devicePixelRatio || 1;
  currentDpr = dpr;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;

  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
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

const waitForPaint = async (): Promise<void> =>
  new Promise((resolve) => {
    window.setTimeout(resolve, 0);
  });

const rewrite = async (
  axiom: string,
  rules: Map<string, string>,
  iterations: number,
  maxSymbols: number,
  onProgress: (message: string) => void,
  renderToken: number
): Promise<RewriteResult> => {
  let current = axiom;

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    if (renderToken !== currentRenderToken) {
      throw new Error('Render canceled.');
    }

    const nextParts: string[] = [];
    let nextLength = 0;

    for (let symbolIndex = 0; symbolIndex < current.length; symbolIndex += 1) {
      const symbol = current[symbolIndex] ?? '';
      const replacement = rules.get(symbol) ?? symbol;
      nextLength += replacement.length;

      if (nextLength > maxSymbols) {
        throw new Error(
          `Stopped at iteration ${iteration + 1} because expanded output exceeded Max symbols (${maxSymbols.toLocaleString()}).`
        );
      }

      nextParts.push(replacement);
    }

    current = nextParts.join('');
    onProgress(
      `Iteration ${iteration + 1}/${iterations} complete (${current.length.toLocaleString()} symbols).`
    );
    await waitForPaint();
  }

  return { sentence: current, completedIterations: iterations };
};

const computeBounds = (
  sentence: string,
  angleDeg: number,
  step: number,
  onProgress: (message: string) => void
): TurtleBounds => {
  onProgress('Computing bounds...');
  const angleRadians = (angleDeg * Math.PI) / 180;
  const state: TurtleState = { x: 0, y: 0, headingRadians: -Math.PI / 2 };
  const stack: TurtleState[] = [];

  let minX = state.x;
  let minY = state.y;
  let maxX = state.x;
  let maxY = state.y;
  let maxStackDepth = 0;

  const updateBounds = (): void => {
    minX = Math.min(minX, state.x);
    minY = Math.min(minY, state.y);
    maxX = Math.max(maxX, state.x);
    maxY = Math.max(maxY, state.y);
  };

  const moveForward = (): void => {
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

  onProgress('Bounds ready.');
  return { minX, minY, maxX, maxY, maxStackDepth };
};

const getFitTransform = (bounds: TurtleBounds): { scale: number; offsetX: number; offsetY: number } => {
  const drawingWidth = bounds.maxX - bounds.minX;
  const drawingHeight = bounds.maxY - bounds.minY;
  const availableWidth = Math.max(canvas.clientWidth - CANVAS_PADDING_PX * 2, 1);
  const availableHeight = Math.max(canvas.clientHeight - CANVAS_PADDING_PX * 2, 1);
  const widthScale = drawingWidth > 0 ? availableWidth / drawingWidth : Number.POSITIVE_INFINITY;
  const heightScale = drawingHeight > 0 ? availableHeight / drawingHeight : Number.POSITIVE_INFINITY;
  const fitScale = Math.min(widthScale, heightScale, 1_000_000);

  const offsetX = CANVAS_PADDING_PX + (availableWidth - drawingWidth * fitScale) / 2 - bounds.minX * fitScale;
  const offsetY = CANVAS_PADDING_PX + (availableHeight - drawingHeight * fitScale) / 2 - bounds.minY * fitScale;

  return { scale: fitScale, offsetX, offsetY };
};

const drawModel = (ctx: CanvasRenderingContext2D, model: RenderModel): void => {
  const { scale: fitScale, offsetX: fitOffsetX, offsetY: fitOffsetY } = getFitTransform(model.bounds);
  const angleRadians = (model.angle * Math.PI) / 180;

  const combinedScale = fitScale * zoom;
  const combinedOffsetX = fitOffsetX * zoom + panX;
  const combinedOffsetY = fitOffsetY * zoom + panY;

  ctx.setTransform(currentDpr, 0, 0, currentDpr, 0, 0);
  ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
  ctx.setTransform(
    currentDpr * combinedScale,
    0,
    0,
    currentDpr * combinedScale,
    currentDpr * combinedOffsetX,
    currentDpr * combinedOffsetY
  );

  ctx.strokeStyle = '#1f2937';
  ctx.lineWidth = Math.max(0.5 / combinedScale, 1 / combinedScale);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const state: TurtleState = { x: 0, y: 0, headingRadians: -Math.PI / 2 };
  const stack: TurtleState[] = [];

  ctx.beginPath();
  ctx.moveTo(state.x, state.y);

  for (const symbol of model.sentence) {
    switch (symbol) {
      case 'F': {
        state.x += Math.cos(state.headingRadians) * model.step;
        state.y += Math.sin(state.headingRadians) * model.step;
        ctx.lineTo(state.x, state.y);
        break;
      }
      case 'f':
        state.x += Math.cos(state.headingRadians) * model.step;
        state.y += Math.sin(state.headingRadians) * model.step;
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

const formatBounds = (bounds: TurtleBounds): string =>
  `${bounds.minX.toFixed(2)}, ${bounds.minY.toFixed(2)} → ${bounds.maxX.toFixed(2)}, ${bounds.maxY.toFixed(2)}`;

const showResult = (finalString: string, bounds: TurtleBounds): void => {
  errorOutput.textContent = '';
  lengthOutput.textContent = finalString.length.toLocaleString();
  previewOutput.textContent = finalString.slice(0, 200);
  boundsOutput.textContent = formatBounds(bounds);
  maxStackDepthOutput.textContent = bounds.maxStackDepth.toLocaleString();
  progressOutput.textContent = 'Done.';
};

const showError = (message: string): void => {
  errorOutput.textContent = message;
  lengthOutput.textContent = '-';
  previewOutput.textContent = '-';
  boundsOutput.textContent = '-';
  maxStackDepthOutput.textContent = '-';
  progressOutput.textContent = 'Failed.';
};

const parseInputs = (): RenderInputs => {
  const iterations = Number.parseInt(iterationsInput.value, 10);
  const angle = Number.parseFloat(angleInput.value);
  const step = Number.parseFloat(stepInput.value);
  const maxSymbols = Number.parseInt(maxSymbolsInput.value, 10);

  if (Number.isNaN(iterations) || iterations < 0) {
    throw new Error('Iterations must be a non-negative integer.');
  }

  if (Number.isNaN(angle) || !Number.isFinite(angle)) {
    throw new Error('Angle must be a finite number.');
  }

  if (Number.isNaN(step) || !Number.isFinite(step) || step < 0) {
    throw new Error('Step must be a non-negative finite number.');
  }

  if (Number.isNaN(maxSymbols) || !Number.isFinite(maxSymbols) || maxSymbols < 1) {
    throw new Error('Max symbols must be a positive integer.');
  }

  return {
    axiom: axiomInput.value,
    rulesText: rulesInput.value,
    iterations,
    angle,
    step,
    maxSymbols
  };
};

const buildModel = async (inputs: RenderInputs, renderToken: number): Promise<RenderModel> => {
  const rewriteKey = `${inputs.axiom}\u0000${inputs.rulesText}\u0000${inputs.iterations}\u0000${inputs.maxSymbols}`;

  if (rewriteKey !== lastRewriteKey) {
    const rules = parseRules(inputs.rulesText);
    const rewriteResult = await rewrite(
      inputs.axiom,
      rules,
      inputs.iterations,
      inputs.maxSymbols,
      (message) => {
        progressOutput.textContent = message;
      },
      renderToken
    );
    lastRewriteResult = rewriteResult.sentence;
    lastRewriteKey = rewriteKey;
  } else {
    progressOutput.textContent = 'Reusing cached rewrite.';
  }

  const bounds = computeBounds(lastRewriteResult, inputs.angle, inputs.step, (message) => {
    progressOutput.textContent = message;
  });
  return {
    sentence: lastRewriteResult,
    bounds,
    angle: inputs.angle,
    step: inputs.step
  };
};

const renderCurrentModel = (): void => {
  if (!lastModel) {
    context.setTransform(currentDpr, 0, 0, currentDpr, 0, 0);
    context.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    return;
  }

  drawModel(context, lastModel);
};

const renderFromInputs = async (resetViewport: boolean): Promise<void> => {
  currentRenderToken += 1;
  const renderToken = currentRenderToken;

  try {
    renderButton.disabled = true;
    progressOutput.textContent = 'Starting render...';
    const inputs = parseInputs();
    const model = await buildModel(inputs, renderToken);

    if (renderToken !== currentRenderToken) {
      return;
    }

    lastModel = model;

    if (resetViewport) {
      zoom = 1;
      panX = 0;
      panY = 0;
    }

    renderCurrentModel();
    showResult(lastModel.sentence, lastModel.bounds);
  } catch (error) {
    if (renderToken !== currentRenderToken) {
      return;
    }

    const message = error instanceof Error ? error.message : 'Unknown error while rewriting.';
    showError(message);
  } finally {
    if (renderToken === currentRenderToken) {
      renderButton.disabled = false;
    }
  }
};

const applyPreset = (presetName: PresetName): void => {
  const preset = presets[presetName];
  axiomInput.value = preset.axiom;
  rulesInput.value = preset.rules;
  iterationsInput.value = preset.iterations;
  angleInput.value = preset.angle;
  stepInput.value = preset.step;
  maxSymbolsInput.value = preset.maxSymbols;
};

window.addEventListener('resize', () => {
  resizeCanvas();
  renderCurrentModel();
});

canvas.addEventListener('wheel', (event) => {
  if (!lastModel) {
    return;
  }

  event.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const screenX = event.clientX - rect.left;
  const screenY = event.clientY - rect.top;

  const zoomFactor = Math.exp(-event.deltaY * 0.0015);
  const previousZoom = zoom;
  const nextZoom = clamp(previousZoom * zoomFactor, ZOOM_MIN, ZOOM_MAX);

  if (nextZoom === previousZoom) {
    return;
  }

  const ratio = nextZoom / previousZoom;
  panX = screenX - (screenX - panX) * ratio;
  panY = screenY - (screenY - panY) * ratio;
  zoom = nextZoom;
  renderCurrentModel();
});

canvas.addEventListener('mousedown', (event) => {
  isDragging = true;
  lastPointerX = event.clientX;
  lastPointerY = event.clientY;
  canvas.style.cursor = 'grabbing';
});

window.addEventListener('mouseup', () => {
  isDragging = false;
  canvas.style.cursor = 'grab';
});

window.addEventListener('mousemove', (event) => {
  if (!isDragging || !lastModel) {
    return;
  }

  const deltaX = event.clientX - lastPointerX;
  const deltaY = event.clientY - lastPointerY;
  lastPointerX = event.clientX;
  lastPointerY = event.clientY;

  panX += deltaX;
  panY += deltaY;
  renderCurrentModel();
});

renderButton.addEventListener('click', () => {
  void renderFromInputs(true);
});

resetViewButton.addEventListener('click', () => {
  zoom = 1;
  panX = 0;
  panY = 0;
  renderCurrentModel();
});

exportButton.addEventListener('click', () => {
  const image = canvas.toDataURL('image/png');
  const link = document.createElement('a');
  link.href = image;
  link.download = 'l-system.png';
  link.click();
});

presetsSelect.addEventListener('change', () => {
  const presetName = presetsSelect.value as PresetName;

  if (presetName in presets) {
    applyPreset(presetName);
    void renderFromInputs(true);
  }
});

canvas.style.cursor = 'grab';
applyPreset('tree');
resizeCanvas();
void renderFromInputs(true);
