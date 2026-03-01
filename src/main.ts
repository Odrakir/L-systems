const canvas = document.querySelector<HTMLCanvasElement>('#canvas');
const renderButton = document.querySelector<HTMLButtonElement>('#render');

if (!canvas || !renderButton) {
  throw new Error('Missing required canvas or render button elements.');
}

const context = canvas.getContext('2d');

if (!context) {
  throw new Error('Unable to acquire 2D rendering context.');
}

const resizeCanvas = (): void => {
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;

  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);

  context.setTransform(1, 0, 0, 1, 0, 0);
  context.scale(dpr, dpr);
};

const drawTestLine = (): void => {
  context.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
  context.strokeStyle = '#0b7a4b';
  context.lineWidth = 2;

  context.beginPath();
  context.moveTo(32, canvas.clientHeight - 32);
  context.lineTo(canvas.clientWidth - 32, 32);
  context.stroke();
};

window.addEventListener('resize', () => {
  resizeCanvas();
  drawTestLine();
});

renderButton.addEventListener('click', () => {
  drawTestLine();
});

resizeCanvas();
drawTestLine();

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
`;
document.head.append(style);
