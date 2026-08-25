import { EditorView, basicSetup } from 'codemirror';
import { glsl } from "codemirror-lang-glsl";
import { tags as t } from "@lezer/highlight";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import './style.css';

const canvas = document.getElementById('shader-canvas');
const gl = canvas.getContext('webgl', { preserveDrawingBuffer: true });
const res_sel_x = document.getElementById("res-select-x");
const res_sel_y = document.getElementById("res-select-y");

function resizeCanvas() {
    const res_x = Number(res_sel_x.value);
    const res_y = Number(res_sel_y.value);

    // Actual GPU resolution
    canvas.width = res_x;
    canvas.height = res_y;

    // Preview area
    const preview = document.querySelector(".canvas-preview");
    const availableWidth = preview.clientWidth;
    const availableHeight = preview.clientHeight;
    const aspect = res_x / res_y;

    let width;
    let height;

    if (availableWidth / availableHeight > aspect) {
        // Preview area is relatively wider than the artwork
        height = availableHeight;
        width = height * aspect;
    } else {
        // Preview area is relatively taller than the artwork
        width = availableWidth;
        height = width / aspect;
    }

    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    recompileShaders();
}

res_sel_x.addEventListener('input', resizeCanvas);
res_sel_y.addEventListener('input', resizeCanvas);

function saveCanvas() {
    const dataURL = canvas.toDataURL('image/png');

    const link = document.createElement('a');

    let name = document.getElementById('save-name').value;

    if(name.length == 0) {
        name = "shader-artwork"
    }
    link.download = name + '.png';
    link.href = dataURL;

    link.click();
}

document.getElementById('save-button').addEventListener('click', saveCanvas);

const vsSource = `
  attribute vec2 a_position;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

const boilerplate = `precision highp float;
uniform vec2 u_resolution;
`;

let fsSource = `void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec3 col = 0.5 + 0.5*cos(uv.xyx+vec3(0,2,4));
  gl_FragColor = vec4(col,1.0);
}
`;

function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(shader);
        console.error(log);
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

let currentProgram = null;
let currentVertexShader = null;
let currentFragmentShader = null;
let positionBuffer = null;
let resLocation = 0;

const codeTheme = EditorView.theme({
  // Style the main outer wrapper of CodeMirror
  "&": {
    backgroundColor: "#1e1e24", // Dark background matching your workspace
    color: "#eeeeee",           // Main font color (light gray)
    fontSize: "14px",
    fontFamily: "Fira Code, Consolas, Monaco, monospace"
  },
  // Style the area where you actually type text
  ".cm-content": {
    caretColor: "#ffffff",     // White blinking cursor
    padding: "10px 0"
  },
  // Highlight the active line your cursor is on
  ".cm-activeLine": {
    backgroundColor: "#242631" 
  },
  // Style the vertical gutter where line numbers live
  ".cm-gutters": {
    backgroundColor: "#1e1e24", // Match the main editor background
    color: "#6c757d",           // Muted gray line numbers
    border: "none"              // Remove the default ugly border separator
  },
  // Highlight the active line number in the gutter
  ".cm-activeLineGutter": {
    backgroundColor: "#282a36",
    color: "#ffffff"
  }
}, { dark: true });

const codeHighlightStyle = HighlightStyle.define([
    { tag: t.keyword, color: "#ff79c6"},      // void, return
    { tag: t.typeName, color: "#8be9fd" },                         // vec2, vec3, vec4, float
    { tag: t.variableName, color: "#f8f8f2" },                     // uv, col
    { tag: t.function(t.variableName), color: "#50fa7b" },         // cos, vec3() constructor
    { tag: t.number, color: "#bd93f9" },                           // 0.5, 1.0, 0, 2, 4
    { tag: t.operator, color: "#ff79c6" },                         // =, +, /, *
    { tag: t.comment, color: "#6272a4", fontStyle: "italic" },     // // comments
    { tag: t.punctuation, color: "#f8f8f2" }                       // ;, (), {}, []
]);

const editor = new EditorView({
  // 1. Tell CodeMirror what initial text to hold
  doc: "// Write your shader here...", 

  // 2. Mix and match your feature plugins
  extensions: [
    basicSetup,  // A massive bundle giving you line numbers, undo history, etc.
    glsl(), // The syntax parser that reads the code and applies colors
    codeTheme,
    syntaxHighlighting(codeHighlightStyle)
  ],

  // 3. Pinpoint where to render the visual UI in your HTML
  parent: document.getElementById('code-editor') 
});

function recompileShaders() {
  if (currentProgram) gl.deleteProgram(currentProgram);
  if (currentVertexShader) gl.deleteShader(currentVertexShader);
  if (currentFragmentShader) gl.deleteShader(currentFragmentShader);
  if (positionBuffer) gl.deleteBuffer(positionBuffer);

  // Read code straight from the plain HTML textarea
  fsSource = editor.state.doc.toString();

  currentVertexShader = createShader(gl, gl.VERTEX_SHADER, vsSource);
  currentFragmentShader = createShader(gl, gl.FRAGMENT_SHADER, boilerplate + fsSource);

  currentProgram = gl.createProgram();
  gl.attachShader(currentProgram, currentVertexShader);
  gl.attachShader(currentProgram, currentFragmentShader);
  gl.linkProgram(currentProgram);
  gl.useProgram(currentProgram);

  positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
      -1,  1,
       1, -1,
       1,  1,
    ]),
    gl.STATIC_DRAW
  );

  const aPositionLocation = gl.getAttribLocation(currentProgram, "a_position");
  gl.enableVertexAttribArray(aPositionLocation);
  gl.vertexAttribPointer(aPositionLocation, 2, gl.FLOAT, false, 0, 0);

  resLocation = gl.getUniformLocation(currentProgram, "u_resolution");

  render();
}

editor.dispatch({
  changes: {
    from: 0, 
    to: editor.state.doc.length, 
    insert: fsSource
  }
});

resizeCanvas();

document.getElementById("compile-button").addEventListener("click", recompileShaders);
recompileShaders();

function render(time) {
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.uniform2f(resLocation, canvas.width, canvas.height);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
}